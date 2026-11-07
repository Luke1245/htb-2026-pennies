from datetime import datetime
from decimal import Decimal
from typing import Annotated
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
    category: RequiredText
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


class DashboardOut(ApiModel):
    spent_this_month: Money
    left_to_spend: Money
    monthly_budget: Money | None
    categories: list[CategoryTotal]
    recent_transactions: list[TransactionOut]
