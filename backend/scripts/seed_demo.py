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

from pennies.db import make_engine, make_session_factory
from pennies.models import Account, MonthlyBudget, Transaction, TransactionKind
from pennies.reading import discard_reading
from pennies.settings import load_settings

DEFAULT_SUB = "auth0|6aefc93491d1d3240c2c45ca"
ACCOUNT_NAME = "Everyday"
_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "https://pennies.demo/seed")


def deterministic_id(*parts: object) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, ":".join(str(part) for part in parts))


def at(month: int, day: int, hour: int = 12) -> datetime:
    return datetime(2026, month, day, hour, 0, tzinfo=timezone.utc)


# (occurred_at, amount, vendor, note, category). No rent, bills, or phone contract.
ORDINARY = [
    (at(10, 1), "30.00", "Family", "Weekly money", "Income"),
    (at(10, 1, 13), "-3.60", "Greggs", "Sausage roll and juice", "Eating out"),
    (at(10, 2), "-6.99", "Steam", "Game", "Entertainment"),
    (at(10, 3), "-4.15", "Tesco", "Meal deal", "Groceries"),
    (at(10, 4), "-5.49", "McDonald's", "After school", "Eating out"),
    (at(10, 5), "-8.99", "Cineworld", "Film with friends", "Entertainment"),
    (at(10, 6), "-3.25", "Costa", "Hot chocolate", "Eating out"),
    (at(10, 7), "-9.00", "Primark", "T-shirt", "Other"),
    (at(10, 8), "30.00", "Family", "Weekly money", "Income"),
    (at(10, 8, 13), "-3.40", "Greggs", "Lunch", "Eating out"),
    (at(10, 9), "-7.99", "PlayStation", "Store game", "Entertainment"),
    (at(10, 10), "-2.80", "Tesco", "Snacks", "Groceries"),
    (at(10, 11), "-12.99", "Domino's", "Friday pizza", "Eating out"),
    (at(10, 12), "-6.80", "ScotRail", "Day out", "Transport"),
    (at(10, 13), "-4.99", "McDonald's", "Lunch", "Eating out"),
    (at(10, 14), "-2.50", "Tesco", "Sweets", "Groceries"),
    (at(10, 15), "30.00", "Family", "Weekly money", "Income"),
    (at(10, 15, 16), "-4.99", "Steam", "Sale game", "Entertainment"),
    (at(10, 16), "-3.80", "Greggs", "Breakfast", "Eating out"),
    (at(10, 17), "-13.50", "Nando's", "Meal with friends", "Eating out"),
    (at(10, 18), "-11.00", "Primark", "Hoodie", "Other"),
    (at(10, 19), "-3.45", "Costa", "Iced drink", "Eating out"),
    (at(10, 20), "-6.20", "McDonald's", "Dinner", "Eating out"),
    (at(10, 21), "-8.99", "Cineworld", "Film", "Entertainment"),
    (at(10, 22), "30.00", "Family", "Weekly money", "Income"),
    (at(10, 22, 18), "-5.10", "Tesco", "Meal deal and crisps", "Groceries"),
    (at(10, 23), "-11.50", "Domino's", "Pizza with friends", "Eating out"),
    (at(10, 24), "48.00", "Cafe", "Saturday shift", "Income"),
    (at(10, 25), "-3.10", "Greggs", "Breakfast", "Eating out"),
    (at(10, 26), "-9.99", "PlayStation", "Game", "Entertainment"),
    (at(10, 27), "-6.50", "Primark", "Beanie", "Other"),
    (at(10, 28), "-5.10", "McDonald's", "Lunch", "Eating out"),
    (at(10, 29), "30.00", "Family", "Weekly money", "Income"),
    (at(10, 30), "-12.99", "Steam", "Sale game", "Entertainment"),
    (at(10, 31), "-4.20", "Greggs", "Lunch", "Eating out"),
    (at(11, 1), "30.00", "Family", "Weekly money", "Income"),
    (at(11, 1, 16), "48.00", "Cafe", "Saturday shift", "Income"),
    (at(11, 1, 18), "-3.70", "Greggs", "Sausage roll", "Eating out"),
    (at(11, 2), "-8.99", "Cineworld", "Film with friends", "Entertainment"),
    (at(11, 2, 19), "-6.40", "McDonald's", "After the film", "Eating out"),
    (at(11, 3), "-3.90", "Tesco", "Meal deal", "Groceries"),
    (at(11, 3, 20), "-7.99", "Steam", "Game", "Entertainment"),
    (at(11, 4), "-3.55", "Costa", "Hot chocolate", "Eating out"),
    (at(11, 5), "-3.30", "Greggs", "Breakfast", "Eating out"),
    (at(11, 5, 17), "-4.99", "PlayStation", "Add-on", "Entertainment"),
    (at(11, 6), "-11.95", "Nando's", "With mates", "Eating out"),
    (at(11, 6, 21), "-2.15", "Tesco", "Sweets", "Groceries"),
    (at(11, 7), "-14.49", "Domino's", "Friday pizza", "Eating out"),
    (at(11, 7, 15), "-8.00", "Primark", "Beanie", "Other"),
    (at(11, 8), "-3.85", "Greggs", "Breakfast", "Eating out"),
    (at(11, 8, 13), "-4.79", "McDonald's", "Lunch", "Eating out"),
]

BUDGETS = [(2026, 10, "120.00"), (2026, 11, "120.00")]


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
        if ACCOUNT_NAME not in accounts:
            everyday = Account(
                id=deterministic_id(user_sub, "account", ACCOUNT_NAME),
                user_sub=user_sub,
                name=ACCOUNT_NAME,
                opening_balance=Decimal("20.00"),
            )
            session.add(everyday)
            accounts[ACCOUNT_NAME] = everyday
        session.flush()

        inserted = {"transactions": 0, "budgets": 0}

        def add_transaction(row_id, amount, vendor, note, occurred_at, category):
            if session.get(Transaction, row_id) is not None:
                return
            session.add(
                Transaction(
                    id=row_id,
                    user_sub=user_sub,
                    account_id=accounts[ACCOUNT_NAME].id,
                    amount=Decimal(amount),
                    category=category,
                    vendor=vendor,
                    note=note,
                    occurred_at=occurred_at,
                    kind=TransactionKind.ordinary,
                    category_source="user",
                )
            )
            inserted["transactions"] += 1

        for occurred_at, amount, vendor, note, category in ORDINARY:
            add_transaction(
                deterministic_id(user_sub, "transaction", occurred_at.isoformat(), ACCOUNT_NAME, vendor, amount),
                amount,
                vendor,
                note,
                occurred_at,
                category,
            )

        for year, month, amount in BUDGETS:
            already = session.query(MonthlyBudget).filter_by(user_sub=user_sub, year=year, month=month).one_or_none()
            if already is None:
                session.add(
                    MonthlyBudget(
                        id=deterministic_id(user_sub, "budget", year, month),
                        user_sub=user_sub,
                        year=year,
                        month=month,
                        amount=Decimal(amount),
                    )
                )
                inserted["budgets"] += 1

        discard_reading(session, user_sub)
        session.commit()
        print(f"seeded {user_sub}: {inserted}")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
