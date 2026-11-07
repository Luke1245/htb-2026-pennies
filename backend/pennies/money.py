from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")
PENCE = Decimal("0.01")
OTHER = "Other"
ADJUSTMENT = "Adjustment"


def parse_money(value) -> Decimal:
    if isinstance(value, bool) or value is None:
        raise ValueError("Amount must be a decimal number of pounds")
    try:
        amount = Decimal(str(value).strip())
    except (InvalidOperation, AttributeError):
        raise ValueError("Amount must be a decimal number of pounds") from None
    if amount != amount.quantize(PENCE):
        raise ValueError("Amount must be in pence")
    return amount.quantize(PENCE)


def money_str(value: Decimal) -> str:
    return f"{Decimal(value).quantize(PENCE):.2f}"


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=LONDON)
    return value.astimezone(timezone.utc)


def month_bounds(moment: datetime) -> tuple[datetime, datetime]:
    local = as_utc(moment).astimezone(LONDON)
    start = datetime(local.year, local.month, 1, tzinfo=LONDON)
    if local.month == 12:
        end = datetime(local.year + 1, 1, 1, tzinfo=LONDON)
    else:
        end = datetime(local.year, local.month + 1, 1, tzinfo=LONDON)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)
