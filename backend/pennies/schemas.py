from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, BeforeValidator

from pennies.money import money_str, parse_money

Money = Annotated[
    Decimal,
    BeforeValidator(parse_money),
    PlainSerializer(lambda value: money_str(value), return_type=str),
]


def _required_text(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("Must be text")
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Must not be blank")
    return cleaned


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Must be text")
    cleaned = value.strip()
    return cleaned or None


RequiredText = Annotated[str, BeforeValidator(_required_text)]
OptionalText = Annotated[str | None, BeforeValidator(_optional_text)]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AccountIn(ApiModel):
    name: RequiredText = Field(max_length=80)
    opening_balance: Money


class AccountOut(ApiModel):
    id: UUID
    name: str
    opening_balance: Money
    calculated_balance: Money


class TransactionIn(ApiModel):
    account_id: UUID
    amount: Money
    vendor: RequiredText = Field(max_length=120)
    note: OptionalText = None
    occurred_at: datetime


class TransactionPatch(ApiModel):
    category: RequiredText


class TransactionOut(ApiModel):
    id: UUID
    account_id: UUID
    amount: Money
    category: str
    vendor: str | None
    note: str | None
    occurred_at: datetime
    kind: str
    transfer_id: UUID | None


class TransferIn(ApiModel):
    from_account_id: UUID
    to_account_id: UUID
    amount: Money
    occurred_at: datetime
    note: OptionalText = None


class TransferOut(ApiModel):
    id: UUID
    outflow: TransactionOut
    inflow: TransactionOut


class ReconciliationIn(ApiModel):
    real_balance: Money
    occurred_at: datetime | None = None


class ReconciliationOut(ApiModel):
    calculated_balance: Money
    real_balance: Money
    adjustment: TransactionOut | None


class BudgetIn(ApiModel):
    amount: Money


class BudgetOut(ApiModel):
    year: int
    month: int
    amount: Money | None


class CategoryTotal(ApiModel):
    name: str
    amount: Money


class TransactionPage(ApiModel):
    transactions: list[TransactionOut]
    next_offset: int | None


class DashboardOut(ApiModel):
    spent_this_month: Money
    left_to_spend: Money
    monthly_budget: Money | None
    categories: list[CategoryTotal]
    subscriptions: Money


class SubscriptionIn(ApiModel):
    name: RequiredText = Field(max_length=120)
    amount: Money
    year: int
    month: int


class SubscriptionOut(ApiModel):
    id: UUID
    name: str
    amount: Money
    year: int
    month: int


class SharingIn(ApiModel):
    mode: Literal["raw", "sanitised"]


class SharingOut(ApiModel):
    mode: str


class EducationOut(ApiModel):
    id: UUID
    subject: str
    guide_id: str | None
    body: str


class SuggestionOut(ApiModel):
    id: UUID
    education_id: UUID
    body: str


class PortraitOut(ApiModel):
    reading: str
    spending_habits: list[str]
    projected_habits: list[str]
    educations: list[EducationOut]
    suggestions: list[SuggestionOut]


class ReadingOut(ApiModel):
    sharing_mode: str
    updated: bool
    reading: PortraitOut | None
