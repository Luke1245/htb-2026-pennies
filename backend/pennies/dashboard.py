from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from pennies.budgets import get_budget
from pennies.calendar import YearMonth, month_bounds
from pennies.models import Subscription, Transaction


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
        outflow = transaction.counted_outflow()
        if outflow is None:
            continue
        spent += outflow
        by_category[transaction.category] = by_category.get(transaction.category, Decimal("0.00")) + outflow
    month = YearMonth.containing(now)
    subscriptions = db.scalars(
        select(Subscription).where(
            Subscription.user_sub == user_sub,
            Subscription.year == month.year,
            Subscription.month == month.month,
        )
    ).all()
    subscription_total = sum((item.amount for item in subscriptions), Decimal("0.00"))
    spent += subscription_total
    budget = get_budget(db, user_sub, month)
    left = budget.amount - spent if budget is not None else Decimal("0.00")
    return {
        "spent_this_month": spent,
        "left_to_spend": left,
        "monthly_budget": None if budget is None else budget.amount,
        "categories": [
            {"name": name, "amount": amount} for name, amount in sorted(by_category.items())
        ],
        "subscriptions": subscription_total,
    }
