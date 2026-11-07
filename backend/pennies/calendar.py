from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from pennies.errors import DomainError

LONDON = ZoneInfo("Europe/London")


class YearMonth:
    def __init__(self, year: int, month: int):
        if year < 2000 or year > 2100 or month < 1 or month > 12:
            raise DomainError("Month must be a calendar month from 2000 to 2100")
        self.year = year
        self.month = month

    @classmethod
    def containing(cls, moment: datetime) -> "YearMonth":
        local = as_utc(moment).astimezone(LONDON)
        return cls(local.year, local.month)


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
