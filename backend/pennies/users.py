from sqlalchemy import select
from sqlalchemy.orm import Session

from pennies.models import User


def display_name_for(db: Session, auth_subject: str) -> str | None:
    user = db.scalar(select(User).where(User.auth_subject == auth_subject))
    if user is None:
        return None
    return user.display_name


def set_display_name(db: Session, auth_subject: str, name: str) -> str:
    user = db.scalar(select(User).where(User.auth_subject == auth_subject))
    if user is None:
        user = User(auth_subject=auth_subject, display_name=name)
        db.add(user)
    else:
        user.display_name = name
    db.flush()
    return user.display_name
