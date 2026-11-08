"""Seed demo spending history so the AI features have data to read.

Usage: .venv/bin/python scripts/seed_demo.py [--sub auth0|...]

Idempotent: every row has a deterministic UUID derived from the user and its
natural key, so re-running skips rows that already exist. Existing user data
(accounts, transactions, subscriptions) is never modified or deleted.
"""

import argparse
import sys
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pennies.categories import OTHER
from pennies.db import make_engine, make_session_factory
from pennies.models import Account, MonthlyBudget, Subscription, Transaction, TransactionKind
from pennies.settings import load_settings

DEFAULT_SUB = "auth0|6aefbba02376630247ef93e5"
_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "https://pennies.demo/seed")


def deterministic_id(*parts: object) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, ":".join(str(part) for part in parts))


def at(month: int, day: int, hour: int = 12) -> datetime:
    return datetime(2026, month, day, hour, 0, tzinfo=timezone.utc)


# (occurred_at, account, amount, vendor, note) — amounts as strings.
ORDINARY = [
    (at(10, 2), "Monzo", "850.00", "Part-time job", "Wages"),
    (at(10, 5), "Monzo", "-8.60", "Transport for London", "Oyster top-up"),
    (at(10, 6), "Monzo", "-32.40", "Tesco", "Weekly shop"),
    (at(10, 8), "Cash", "-4.80", "Caffe Nero", "Coffee before lecture"),
    (at(10, 10), "Monzo", "-11.00", "Cineworld", "Cinema ticket"),
    (at(10, 12), "Monzo", "-8.60", "Transport for London", "Oyster top-up"),
    (at(10, 13), "Monzo", "-27.85", "Sainsbury's", "Weekly shop"),
    (at(10, 14), "Cash", "-25.00", "Boots", "Pharmacy"),
    (at(10, 15), "Cash", "-12.60", "Pret A Manger", "Lunch"),
    (at(10, 17), "Monzo", "-7.99", "Steam", "Game"),
    (at(10, 19), "Monzo", "-8.60", "Transport for London", "Oyster top-up"),
    (at(10, 20), "Monzo", "-41.10", "Tesco", "Weekly shop"),
    (at(10, 22), "Monzo", "-18.90", "Domino's Pizza", "Friday takeaway"),
    (at(10, 24), "Monzo", "-14.00", "Castle Climbing Centre", "Climbing session"),
    (at(10, 26), "Monzo", "-8.60", "Transport for London", "Oyster top-up"),
    (at(10, 27), "Cash", "-18.75", "Lidl", "Weekly shop"),
    (at(10, 29), "Cash", "-5.20", "Caffe Nero", "Coffee with friends"),
    (at(11, 1), "Monzo", "-11.00", "Cineworld", "Cinema ticket"),
    (at(11, 2), "Monzo", "850.00", "Part-time job", "Wages"),
    (at(11, 2), "Monzo", "-8.60", "Transport for London", "Oyster top-up"),
    (at(11, 3), "Monzo", "-36.20", "Tesco", "Weekly shop"),
    (at(11, 3), "Monzo", "-9.99", "Amazon", "Course textbook"),
    (at(11, 4), "Monzo", "-13.75", "Dishoom", "Dinner out"),
    (at(11, 5), "Monzo", "240.00", "Corner Shop Ltd", "Part-time wages"),
    (at(11, 5), "Cash", "-1.75", "Metroline", "Bus fare"),
    (at(11, 6), "Cash", "-4.60", "Caffe Nero", "Coffee before lecture"),
    (at(11, 7), "Monzo", "-8.60", "Transport for London", "Oyster top-up"),
    (at(11, 7), "Monzo", "-22.45", "Sainsbury's", "Weekly shop"),
    (at(11, 8, 9), "Cash", "-11.20", "Leon", "Lunch"),
]

TRANSFERS = [
    (at(10, 9), "40.00", "Cash for the week"),
    (at(11, 4), "40.00", "Cash for the week"),
]

BUDGETS = [(2026, 10, "750.00"), (2026, 11, "750.00")]

SUBSCRIPTIONS = [
    ("Spotify Premium", "10.99"),
    ("The Gym Group", "24.00"),
    ("VOXI SIM", "12.00"),
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sub", default=DEFAULT_SUB, help="Auth0 user_sub to seed")
    arguments = parser.parse_args()
    user_sub = arguments.sub

    settings = load_settings()
    engine = make_engine(settings.required_database_url())
    factory = make_session_factory(engine)
    session = factory()
    try:
        accounts = {account.name: account for account in session.query(Account).filter_by(user_sub=user_sub)}
        if "Cash" not in accounts:
            cash = Account(id=deterministic_id(user_sub, "account", "Cash"), user_sub=user_sub, name="Cash", opening_balance=Decimal("40.00"))
            session.add(cash)
            accounts["Cash"] = cash
        if "Monzo" not in accounts:
            monzo = Account(id=deterministic_id(user_sub, "account", "Monzo"), user_sub=user_sub, name="Monzo", opening_balance=Decimal("250.00"))
            session.add(monzo)
            accounts["Monzo"] = monzo
        session.flush()

        inserted = {"transactions": 0, "transfers": 0, "budgets": 0, "subscriptions": 0}

        def add_transaction(row_id, account, amount, vendor, note, occurred_at, kind=TransactionKind.ordinary, transfer_id=None):
            if session.get(Transaction, row_id) is not None:
                return
            session.add(
                Transaction(
                    id=row_id,
                    user_sub=user_sub,
                    account_id=accounts[account].id,
                    amount=Decimal(amount),
                    category=OTHER,
                    vendor=vendor,
                    note=note,
                    occurred_at=occurred_at,
                    kind=kind,
                    transfer_id=transfer_id,
                    category_source=None,
                )
            )
            inserted["transactions" if kind is TransactionKind.ordinary else "transfers"] += 1

        for occurred_at, account, amount, vendor, note in ORDINARY:
            add_transaction(
                deterministic_id(user_sub, "transaction", occurred_at.isoformat(), account, vendor, amount),
                account,
                amount,
                vendor,
                note,
                occurred_at,
            )

        for occurred_at, amount, note in TRANSFERS:
            transfer_id = deterministic_id(user_sub, "transfer", occurred_at.isoformat(), amount)
            add_transaction(
                deterministic_id(user_sub, "transaction", occurred_at.isoformat(), "Monzo", "out", amount),
                "Monzo",
                f"-{amount}",
                None,
                note,
                occurred_at,
                kind=TransactionKind.transfer,
                transfer_id=transfer_id,
            )
            add_transaction(
                deterministic_id(user_sub, "transaction", occurred_at.isoformat(), "Cash", "in", amount),
                "Cash",
                amount,
                None,
                note,
                occurred_at,
                kind=TransactionKind.transfer,
                transfer_id=transfer_id,
            )

        for year, month, amount in BUDGETS:
            row_id = deterministic_id(user_sub, "budget", year, month)
            if session.get(MonthlyBudget, row_id) is None:
                session.add(MonthlyBudget(id=row_id, user_sub=user_sub, year=year, month=month, amount=Decimal(amount)))
                inserted["budgets"] += 1

        for name, amount in SUBSCRIPTIONS:
            for month in (10, 11):
                row_id = deterministic_id(user_sub, "subscription", name, month)
                if session.get(Subscription, row_id) is None:
                    session.add(Subscription(id=row_id, user_sub=user_sub, name=name, amount=Decimal(amount), year=2026, month=month))
                    inserted["subscriptions"] += 1

        session.commit()
        print(f"seeded {user_sub}: {inserted}")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
