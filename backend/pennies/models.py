import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    DateTime,
    Enum as SqlEnum,
    Integer,
    Numeric,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class TransactionKind(str, Enum):
    ordinary = "ordinary"
    transfer = "transfer"
    adjustment = "adjustment"


class MoneyColumn(TypeDecorator):
    impl = Numeric(14, 2)
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        amount = value if isinstance(value, Decimal) else Decimal(str(value))
        return amount.quantize(Decimal("0.01"))


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    auth_subject: Mapped[str] = mapped_column(Text, unique=True)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_name: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserCategory(Base):
    __tablename__ = "user_categories"
    __table_args__ = (UniqueConstraint("user_sub", "name"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_sub: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(40))
    position: Mapped[int]


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_sub: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(80))
    opening_balance: Mapped[Decimal] = mapped_column(MoneyColumn)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_sub: Mapped[str] = mapped_column(String(128), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    amount: Mapped[Decimal] = mapped_column(MoneyColumn)
    category: Mapped[str] = mapped_column(String(40))
    vendor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    kind: Mapped[TransactionKind] = mapped_column(
        SqlEnum(
            TransactionKind,
            native_enum=False,
            length=20,
            values_callable=lambda kinds: [kind.value for kind in kinds],
        )
    )
    transfer_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    category_source: Mapped[str | None] = mapped_column(String(20), nullable=True)

    def counted_outflow(self) -> Decimal | None:
        if self.kind is not TransactionKind.ordinary or self.amount >= 0:
            return None
        return -self.amount


class MonthlyBudget(Base):
    __tablename__ = "monthly_budgets"
    __table_args__ = (UniqueConstraint("user_sub", "year", "month"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_sub: Mapped[str] = mapped_column(String(128), index=True)
    year: Mapped[int]
    month: Mapped[int]
    amount: Mapped[Decimal] = mapped_column(MoneyColumn)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_sub: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(120))
    amount: Mapped[Decimal] = mapped_column(MoneyColumn)
    year: Mapped[int]
    month: Mapped[int]


class SharingPreference(Base):
    __tablename__ = "sharing_preferences"

    user_sub: Mapped[str] = mapped_column(String(128), primary_key=True)
    mode: Mapped[str] = mapped_column(String(20))


class Portrait(Base):
    __tablename__ = "portraits"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_sub: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    sharing_mode: Mapped[str] = mapped_column(String(20))
    reading: Mapped[str] = mapped_column(Text)


class Habit(Base):
    __tablename__ = "habits"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    portrait_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    kind: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(Text)


class EducationItem(Base):
    __tablename__ = "educations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    portrait_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    subject: Mapped[str] = mapped_column(String(160))
    guide_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    body: Mapped[str] = mapped_column(Text)


class SuggestionItem(Base):
    __tablename__ = "suggestions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    portrait_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    education_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    body: Mapped[str] = mapped_column(Text)


class RecommendationItem(Base):
    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    portrait_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    position: Mapped[int]
    kind: Mapped[str] = mapped_column(String(20))
    guide_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    reason: Mapped[str] = mapped_column(Text)
