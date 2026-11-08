from pennies.errors import DomainError

OTHER = "Other"
ADJUSTMENT_CATEGORY = "Adjustment"
ADJUSTMENT_VENDOR = "Adjustment"
ORDINARY_CATEGORIES = (
    "Groceries",
    "Transport",
    "Eating out",
    "Entertainment",
    "Income",
    "Other",
)


def require_ordinary_category(category: str) -> None:
    if category not in ORDINARY_CATEGORIES:
        raise DomainError("Category must be one of Pennies' ordinary categories")
