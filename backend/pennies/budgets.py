from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from pennies.calendar import YearMonth
from pennies.errors import DomainError
from pennies.models import MonthlyBudget


def get_budget(db: Session, user_sub: str, month: YearMonth) -> MonthlyBudget | None:
    return db.scalar(
        select(MonthlyBudget).where(
            MonthlyBudget.user_sub == user_sub,
            MonthlyBudget.year == month.year,
            MonthlyBudget.month == month.month,
        )
    )


def clear_budget(db: Session, user_sub: str, month: YearMonth) -> None:
    budget = get_budget(db, user_sub, month)
    if budget is None:
        return
    db.delete(budget)
    db.flush()


def set_budget(db: Session, user_sub: str, month: YearMonth, amount: Decimal) -> MonthlyBudget:
    if amount < 0:
        raise DomainError("Monthly budget must be zero or greater")
    budget = get_budget(db, user_sub, month)
    if budget is None:
        budget = MonthlyBudget(
            user_sub=user_sub, year=month.year, month=month.month, amount=amount
        )
        db.add(budget)
    else:
        budget.amount = amount
    db.flush()
    return budget
