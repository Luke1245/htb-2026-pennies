import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from pennies.calendar import YearMonth
from pennies.errors import DomainError
from pennies.models import Subscription


@dataclass(frozen=True)
class SubscriptionCommand:
    name: str
    amount: Decimal
    year: int
    month: int


def create_subscription(db: Session, user_sub: str, command: SubscriptionCommand) -> Subscription:
    _check_amount(command.amount)
    period = YearMonth(command.year, command.month)
    subscription = Subscription(
        user_sub=user_sub,
        name=command.name,
        amount=command.amount,
        year=period.year,
        month=period.month,
    )
    db.add(subscription)
    db.flush()
    return subscription


def list_subscriptions(db: Session, user_sub: str) -> list[Subscription]:
    return list(
        db.scalars(
            select(Subscription)
            .where(Subscription.user_sub == user_sub)
            .order_by(Subscription.year.desc(), Subscription.month.desc(), Subscription.name, Subscription.id)
        ).all()
    )


def update_subscription(
    db: Session, user_sub: str, subscription_id: uuid.UUID, command: SubscriptionCommand
) -> Subscription:
    subscription = _owned(db, user_sub, subscription_id)
    _check_amount(command.amount)
    period = YearMonth(command.year, command.month)
    subscription.name = command.name
    subscription.amount = command.amount
    subscription.year = period.year
    subscription.month = period.month
    db.flush()
    return subscription


def delete_subscription(db: Session, user_sub: str, subscription_id: uuid.UUID) -> None:
    subscription = _owned(db, user_sub, subscription_id)
    db.delete(subscription)
    db.flush()


def _owned(db: Session, user_sub: str, subscription_id: uuid.UUID) -> Subscription:
    subscription = db.get(Subscription, subscription_id)
    if subscription is None or subscription.user_sub != user_sub:
        raise DomainError("Subscription not found", status_code=404)
    return subscription


def _check_amount(amount: Decimal) -> None:
    if amount <= 0:
        raise DomainError("Subscription amount must be greater than zero")
