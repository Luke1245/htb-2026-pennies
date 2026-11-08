from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pennies.errors import DomainError
from pennies.models import UserCategory

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


def _clean_category_name(name: str) -> str:
    cleaned = name.strip()
    if not cleaned:
        raise DomainError("Enter a category name")
    if len(cleaned) > 40:
        raise DomainError("A category name must be 40 characters or fewer")
    if cleaned.casefold() == ADJUSTMENT_CATEGORY.casefold():
        raise DomainError("Adjustment is reserved")
    return cleaned


def list_categories(db: Session, user_sub: str) -> list[UserCategory]:
    rows = list(
        db.scalars(
            select(UserCategory)
            .where(UserCategory.user_sub == user_sub)
            .order_by(UserCategory.position, UserCategory.name)
        ).all()
    )
    if rows:
        return rows
    for position, name in enumerate(ORDINARY_CATEGORIES):
        db.add(UserCategory(user_sub=user_sub, name=name, position=position))
    db.flush()
    return list_categories(db, user_sub)


def category_names(db: Session, user_sub: str) -> tuple[str, ...]:
    return tuple(category.name for category in list_categories(db, user_sub))


def add_category(db: Session, user_sub: str, name: str) -> UserCategory:
    cleaned = _clean_category_name(name)
    existing = category_names(db, user_sub)
    if cleaned.casefold() in {item.casefold() for item in existing}:
        raise DomainError("Category already exists")
    position = db.scalar(
        select(func.max(UserCategory.position)).where(UserCategory.user_sub == user_sub)
    )
    category = UserCategory(user_sub=user_sub, name=cleaned, position=(position or 0) + 1)
    db.add(category)
    db.flush()
    return category


def rename_category(db: Session, user_sub: str, category_id, name: str) -> UserCategory:
    cleaned = _clean_category_name(name)
    category = db.get(UserCategory, category_id)
    if category is None or category.user_sub != user_sub:
        raise DomainError("Category not found", status_code=404)
    taken = {
        item.casefold()
        for item in category_names(db, user_sub)
        if item.casefold() != category.name.casefold()
    }
    if cleaned.casefold() in taken:
        raise DomainError("Category already exists")
    category.name = cleaned
    db.flush()
    return category
