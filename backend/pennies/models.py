import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, TypeDecorator, UniqueConstraint, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Pence(TypeDecorator):
    impl = Numeric(14, 2)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return Decimal(value).quantize(Decimal("0.01"))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        amount = value if isinstance(value, Decimal) else Decimal(str(value))
        return amount.quantize(Decimal("0.01"))


class Base(DeclarativeBase):
    pass


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_sub: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(80))
    opening_balance: Mapped[Decimal] = mapped_column(Pence)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_sub: Mapped[str] = mapped_column(String(128), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    amount: Mapped[Decimal] = mapped_column(Pence)
    category: Mapped[str] = mapped_column(String(40))
    vendor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    transfer_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)


class MonthlyBudget(Base):
    __tablename__ = "monthly_budgets"
    __table_args__ = (UniqueConstraint("user_sub", "year", "month"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_sub: Mapped[str] = mapped_column(String(128), index=True)
    year: Mapped[int]
    month: Mapped[int]
    amount: Mapped[Decimal] = mapped_column(Pence)
