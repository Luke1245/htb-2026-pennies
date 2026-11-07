import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from pennies.errors import DomainError
from pennies.models import Account, MonthlyBudget, Transaction
from pennies.money import ADJUSTMENT, LONDON, OTHER, as_utc, month_bounds, parse_money


def create_account(db: Session, user_sub: str, name: str, opening_balance: Decimal) -> Account:
    account = Account(
        user_sub=user_sub,
        name=name.strip(),
        opening_balance=parse_money(opening_balance),
    )
    if not account.name:
        raise DomainError("Account name is required")
    db.add(account)
    db.flush()
    return account


def list_accounts(db: Session, user_sub: str) -> list[tuple[Account, Decimal]]:
    accounts = db.scalars(
        select(Account).where(Account.user_sub == user_sub).order_by(Account.name, Account.id)
    ).all()
    return [(account, calculated_balance(db, account)) for account in accounts]


def calculated_balance(db: Session, account: Account) -> Decimal:
    amounts = db.scalars(
        select(Transaction.amount).where(Transaction.account_id == account.id)
    ).all()
    total = parse_money(account.opening_balance)
    for amount in amounts:
        total += Decimal(amount)
    return parse_money(total)


def owned_account(db: Session, user_sub: str, account_id: uuid.UUID) -> Account:
    account = db.get(Account, account_id)
    if account is None or account.user_sub != user_sub:
        raise DomainError("Account not found", status_code=404)
    return account


def create_transaction(
    db: Session,
    user_sub: str,
    account_id: uuid.UUID,
    amount: Decimal,
    category: str,
    vendor: str,
    note: str | None,
    occurred_at: datetime,
) -> Transaction:
    account = owned_account(db, user_sub, account_id)
    parsed = parse_money(amount)
    if parsed == 0:
        raise DomainError("Amount must not be zero")
    if category != OTHER:
        raise DomainError("Category must be Other")
    vendor = vendor.strip()
    if not vendor:
        raise DomainError("Vendor is required")
    transaction = Transaction(
        user_sub=user_sub,
        account_id=account.id,
        amount=parsed,
        category=OTHER,
        vendor=vendor,
        note=_note(note),
        occurred_at=as_utc(occurred_at),
        kind="ordinary",
    )
    db.add(transaction)
    db.flush()
    return transaction


def list_transactions(db: Session, user_sub: str, limit: int = 50) -> list[Transaction]:
    return list(
        db.scalars(
            select(Transaction)
            .where(Transaction.user_sub == user_sub)
            .order_by(Transaction.occurred_at.desc(), Transaction.id.desc())
            .limit(limit)
        ).all()
    )


def update_category(
    db: Session, user_sub: str, transaction_id: uuid.UUID, category: str
) -> Transaction:
    transaction = db.get(Transaction, transaction_id)
    if transaction is None or transaction.user_sub != user_sub:
        raise DomainError("Transaction not found", status_code=404)
    if transaction.kind != "ordinary":
        raise DomainError("Only an ordinary transaction's category can be changed")
    if category != OTHER:
        raise DomainError("Category must be Other")
    transaction.category = OTHER
    db.flush()
    return transaction


def create_transfer(
    db: Session,
    user_sub: str,
    from_account_id: uuid.UUID,
    to_account_id: uuid.UUID,
    amount: Decimal,
    occurred_at: datetime,
    note: str | None,
) -> tuple[Transaction, Transaction]:
    if from_account_id == to_account_id:
        raise DomainError("A transfer must use two different accounts")
    source = owned_account(db, user_sub, from_account_id)
    destination = owned_account(db, user_sub, to_account_id)
    parsed = parse_money(amount)
    if parsed <= 0:
        raise DomainError("Transfer amount must be greater than zero")
    when = as_utc(occurred_at)
    transfer_id = uuid.uuid4()
    cleaned = _note(note)
    outflow = Transaction(
        user_sub=user_sub,
        account_id=source.id,
        amount=-parsed,
        category=OTHER,
        vendor=None,
        note=cleaned,
        occurred_at=when,
        kind="transfer",
        transfer_id=transfer_id,
    )
    inflow = Transaction(
        user_sub=user_sub,
        account_id=destination.id,
        amount=parsed,
        category=OTHER,
        vendor=None,
        note=cleaned,
        occurred_at=when,
        kind="transfer",
        transfer_id=transfer_id,
    )
    db.add(outflow)
    db.add(inflow)
    db.flush()
    return outflow, inflow


def reconcile(
    db: Session,
    user_sub: str,
    account_id: uuid.UUID,
    real_balance: Decimal,
    occurred_at: datetime,
) -> tuple[Decimal, Transaction | None]:
    account = owned_account(db, user_sub, account_id)
    real = parse_money(real_balance)
    current = calculated_balance(db, account)
    difference = parse_money(real - current)
    if difference == 0:
        return current, None
    adjustment = Transaction(
        user_sub=user_sub,
        account_id=account.id,
        amount=difference,
        category=ADJUSTMENT,
        vendor=ADJUSTMENT,
        note=None,
        occurred_at=as_utc(occurred_at),
        kind="adjustment",
    )
    db.add(adjustment)
    db.flush()
    return current, adjustment


def set_budget(
    db: Session, user_sub: str, year: int, month: int, amount: Decimal
) -> MonthlyBudget:
    parsed = parse_money(amount)
    if parsed < 0:
        raise DomainError("Monthly budget must be zero or greater")
    budget = db.scalar(
        select(MonthlyBudget).where(
            MonthlyBudget.user_sub == user_sub,
            MonthlyBudget.year == year,
            MonthlyBudget.month == month,
        )
    )
    if budget is None:
        budget = MonthlyBudget(user_sub=user_sub, year=year, month=month, amount=parsed)
        db.add(budget)
    else:
        budget.amount = parsed
    db.flush()
    return budget


def get_budget(db: Session, user_sub: str, year: int, month: int) -> MonthlyBudget | None:
    return db.scalar(
        select(MonthlyBudget).where(
            MonthlyBudget.user_sub == user_sub,
            MonthlyBudget.year == year,
            MonthlyBudget.month == month,
        )
    )


def dashboard(db: Session, user_sub: str, now: datetime) -> dict:
    start, end = month_bounds(now)
    transactions = db.scalars(
        select(Transaction).where(
            Transaction.user_sub == user_sub,
            Transaction.occurred_at >= start,
            Transaction.occurred_at < end,
        )
    ).all()
    spent = Decimal("0.00")
    by_category: dict[str, Decimal] = {}
    for transaction in transactions:
        if transaction.kind != "ordinary" or transaction.amount >= 0:
            continue
        outflow = -Decimal(transaction.amount)
        spent += outflow
        by_category[transaction.category] = by_category.get(transaction.category, Decimal("0.00")) + outflow
    spent = parse_money(spent)
    local = as_utc(now).astimezone(LONDON)
    budget = get_budget(db, user_sub, local.year, local.month)
    left = parse_money(Decimal(budget.amount) - spent) if budget is not None else Decimal("0.00")
    categories = [
        {"name": name, "amount": parse_money(amount)}
        for name, amount in sorted(by_category.items())
    ]
    recent = list_transactions(db, user_sub, limit=20)
    return {
        "spent_this_month": spent,
        "left_to_spend": left,
        "monthly_budget": None if budget is None else parse_money(budget.amount),
        "categories": categories,
        "recent_transactions": recent,
    }


def _note(note: str | None) -> str | None:
    if note is None:
        return None
    cleaned = note.strip()
    return cleaned or None
