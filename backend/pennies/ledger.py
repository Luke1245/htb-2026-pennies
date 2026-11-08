import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from pennies.calendar import as_utc
from pennies.categories import ADJUSTMENT_CATEGORY, ADJUSTMENT_VENDOR, OTHER, require_ordinary_category
from pennies.errors import DomainError
from pennies.models import Account, Transaction, TransactionKind


@dataclass(frozen=True)
class NewAccount:
    name: str
    opening_balance: Decimal


@dataclass(frozen=True)
class NewTransaction:
    account_id: uuid.UUID
    amount: Decimal
    category: str
    vendor: str
    note: str | None
    occurred_at: datetime


@dataclass(frozen=True)
class NewTransfer:
    from_account_id: uuid.UUID
    to_account_id: uuid.UUID
    amount: Decimal
    occurred_at: datetime
    note: str | None


@dataclass(frozen=True)
class ReconciliationRequest:
    account_id: uuid.UUID
    real_balance: Decimal
    occurred_at: datetime


def update_account(
    db: Session,
    user_sub: str,
    account_id: uuid.UUID,
    name: str,
    opening_balance: Decimal | None = None,
) -> tuple[Account, Decimal]:
    account = owned_account(db, user_sub, account_id)
    account.name = name
    if opening_balance is not None:
        account.opening_balance = opening_balance
    db.flush()
    return account, calculated_balance(db, account)


def create_account(db: Session, user_sub: str, command: NewAccount) -> Account:
    account = Account(
        user_sub=user_sub,
        name=command.name,
        opening_balance=command.opening_balance,
    )
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
    return account.opening_balance + sum(amounts, Decimal("0.00"))


def owned_account(db: Session, user_sub: str, account_id: uuid.UUID) -> Account:
    account = db.get(Account, account_id)
    if account is None or account.user_sub != user_sub:
        raise DomainError("Account not found", status_code=404)
    return account


def create_transaction(
    db: Session, user_sub: str, command: NewTransaction, category_source: str | None
) -> Transaction:
    account = owned_account(db, user_sub, command.account_id)
    if command.amount == 0:
        raise DomainError("Amount must not be zero")
    if command.category.casefold() == ADJUSTMENT_CATEGORY.casefold():
        raise DomainError("Category must be one of the user's categories")
    transaction = Transaction(
        user_sub=user_sub,
        account_id=account.id,
        amount=command.amount,
        category=command.category,
        vendor=command.vendor,
        note=command.note,
        occurred_at=as_utc(command.occurred_at),
        kind=TransactionKind.ordinary,
        category_source=category_source,
    )
    db.add(transaction)
    db.flush()
    return transaction


def list_transactions(
    db: Session, user_sub: str, limit: int, offset: int, account_id: uuid.UUID | None = None
) -> tuple[list[Transaction], int | None]:
    if limit < 1 or limit > 100:
        raise DomainError("Limit must be from 1 to 100")
    if offset < 0:
        raise DomainError("Offset must be zero or greater")
    where = [Transaction.user_sub == user_sub]
    if account_id is not None:
        where.append(Transaction.account_id == owned_account(db, user_sub, account_id).id)
    rows = list(
        db.scalars(
            select(Transaction)
            .where(*where)
            .order_by(Transaction.occurred_at.desc(), Transaction.id.desc())
            .offset(offset)
            .limit(limit + 1)
        ).all()
    )
    page = rows[:limit]
    next_offset = offset + limit if len(rows) > limit else None
    return page, next_offset


def delete_transaction(db: Session, user_sub: str, transaction_id: uuid.UUID) -> list[uuid.UUID]:
    transaction = db.get(Transaction, transaction_id)
    if transaction is None or transaction.user_sub != user_sub:
        raise DomainError("Transaction not found", status_code=404)
    if transaction.kind is TransactionKind.transfer and transaction.transfer_id is not None:
        rows = list(
            db.scalars(
                select(Transaction).where(
                    Transaction.user_sub == user_sub,
                    Transaction.transfer_id == transaction.transfer_id,
                )
            ).all()
        )
    else:
        rows = [transaction]
    removed = [row.id for row in rows]
    for row in rows:
        db.delete(row)
    db.flush()
    return removed


class _UnsetType:
    pass


UNSET = _UnsetType()


@dataclass(frozen=True)
class TransactionEdit:
    account_id: uuid.UUID | None = None
    amount: Decimal | None = None
    category: str | None = None
    vendor: str | None = None
    note: str | None | _UnsetType = UNSET
    occurred_at: datetime | None = None


def update_transaction(
    db: Session, user_sub: str, transaction_id: uuid.UUID, edit: TransactionEdit
) -> Transaction:
    transaction = db.get(Transaction, transaction_id)
    if transaction is None or transaction.user_sub != user_sub:
        raise DomainError("Transaction not found", status_code=404)
    if transaction.kind is TransactionKind.adjustment:
        raise DomainError("An adjustment cannot be edited")
    if transaction.kind is TransactionKind.transfer:
        return _update_transfer_leg(db, user_sub, transaction, edit)

    if edit.account_id is not None:
        transaction.account_id = owned_account(db, user_sub, edit.account_id).id
    if edit.amount is not None:
        if edit.amount == 0:
            raise DomainError("Amount must not be zero")
        transaction.amount = edit.amount
    if edit.category is not None:
        if edit.category.casefold() == ADJUSTMENT_CATEGORY.casefold():
            raise DomainError("Category must be one of the user's categories")
        require_ordinary_category(edit.category)
        transaction.category = edit.category
        transaction.category_source = "user"
    if edit.vendor is not None:
        transaction.vendor = edit.vendor
    if edit.note is not UNSET:
        transaction.note = edit.note or None
    if edit.occurred_at is not None:
        transaction.occurred_at = as_utc(edit.occurred_at)
    db.flush()
    return transaction


def _update_transfer_leg(
    db: Session, user_sub: str, leg: Transaction, edit: TransactionEdit
) -> Transaction:
    if edit.vendor is not None or edit.category is not None:
        raise DomainError("A transfer's vendor and category cannot be changed")
    if edit.account_id is not None:
        leg.account_id = owned_account(db, user_sub, edit.account_id).id
    if edit.note is not UNSET:
        leg.note = edit.note or None
    when = as_utc(edit.occurred_at) if edit.occurred_at is not None else None
    if edit.amount is not None:
        if edit.amount == 0:
            raise DomainError("Amount must not be zero")
        magnitude = abs(edit.amount)
    else:
        magnitude = None
    twin = db.scalar(
        select(Transaction).where(
            Transaction.user_sub == user_sub,
            Transaction.transfer_id == leg.transfer_id,
            Transaction.id != leg.id,
        )
    )
    if edit.amount is not None:
        leg.amount = magnitude if leg.amount > 0 else -magnitude
        if twin is not None:
            twin.amount = -leg.amount
    if when is not None:
        leg.occurred_at = when
        if twin is not None:
            twin.occurred_at = when
    if twin is not None and twin.account_id == leg.account_id:
        raise DomainError("A transfer must use two different accounts")
    db.flush()
    return leg


def create_transfer(
    db: Session, user_sub: str, command: NewTransfer
) -> tuple[Transaction, Transaction]:
    if command.from_account_id == command.to_account_id:
        raise DomainError("A transfer must use two different accounts")
    source = owned_account(db, user_sub, command.from_account_id)
    destination = owned_account(db, user_sub, command.to_account_id)
    if command.amount <= 0:
        raise DomainError("Transfer amount must be greater than zero")
    when = as_utc(command.occurred_at)
    transfer_id = uuid.uuid4()
    outflow = _transfer_leg(user_sub, source.id, -command.amount, command.note, when, transfer_id)
    inflow = _transfer_leg(user_sub, destination.id, command.amount, command.note, when, transfer_id)
    db.add(outflow)
    db.add(inflow)
    db.flush()
    return outflow, inflow


def reconcile(
    db: Session, user_sub: str, command: ReconciliationRequest
) -> tuple[Decimal, Transaction | None]:
    account = owned_account(db, user_sub, command.account_id)
    current = calculated_balance(db, account)
    difference = command.real_balance - current
    if difference == 0:
        return current, None
    adjustment = Transaction(
        user_sub=user_sub,
        account_id=account.id,
        amount=difference,
        category=ADJUSTMENT_CATEGORY,
        vendor=ADJUSTMENT_VENDOR,
        note=None,
        occurred_at=as_utc(command.occurred_at),
        kind=TransactionKind.adjustment,
    )
    db.add(adjustment)
    db.flush()
    return current, adjustment


def _transfer_leg(
    user_sub: str,
    account_id: uuid.UUID,
    amount: Decimal,
    note: str | None,
    occurred_at: datetime,
    transfer_id: uuid.UUID,
) -> Transaction:
    return Transaction(
        user_sub=user_sub,
        account_id=account_id,
        amount=amount,
        category=OTHER,
        vendor=None,
        note=note,
        occurred_at=occurred_at,
        kind=TransactionKind.transfer,
        transfer_id=transfer_id,
    )
