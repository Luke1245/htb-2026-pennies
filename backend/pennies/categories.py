from pennies.errors import DomainError

OTHER = "Other"
ADJUSTMENT_CATEGORY = "Adjustment"
ADJUSTMENT_VENDOR = "Adjustment"


def require_ordinary_category(category: str) -> None:
    if category != OTHER:
        raise DomainError("Category must be Other")
