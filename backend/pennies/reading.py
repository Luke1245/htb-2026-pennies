from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from pennies.calendar import LONDON, YearMonth, as_utc
from pennies.categories import ORDINARY_CATEGORIES, OTHER
from pennies.dashboard import dashboard
from pennies.errors import DomainError
from pennies.guides import get_guide, guide_ids, list_guides
from pennies.ledger import list_accounts
from pennies.models import (
    EducationItem,
    Habit,
    Portrait,
    RecommendationItem,
    SharingPreference,
    Subscription,
    SuggestionItem,
    Transaction,
    TransactionKind,
)
from pennies.money import money_str
from pennies.resources import get_resource, list_resources, resource_ids

RAW = "raw"
SANITISED = "sanitised"
GEMINI = "gemini"
SPENDING = "spending"
PROJECTED = "projected"


@dataclass(frozen=True)
class EducationDraft:
    subject: str
    guide_id: str | None
    body: str


@dataclass(frozen=True)
class SuggestionDraft:
    education_index: int
    body: str


@dataclass(frozen=True)
class RecommendationDraft:
    kind: str
    guide_id: str | None
    resource_id: str | None
    reason: str


@dataclass(frozen=True)
class ReadingDraft:
    reading: str
    spending_habits: list[str]
    projected_habits: list[str]
    educations: list[EducationDraft]
    suggestions: list[SuggestionDraft]
    recommendations: list[RecommendationDraft]


class UnavailableReader:
    def categorise(self, facts: dict) -> str | None:
        return None

    def read(self, payload: dict) -> ReadingDraft | None:
        return None


def sharing_mode(db: Session, user_sub: str) -> str:
    preference = db.get(SharingPreference, user_sub)
    if preference is None or preference.mode not in {RAW, SANITISED}:
        return RAW
    return preference.mode


def set_sharing_mode(db: Session, user_sub: str, mode: str) -> str:
    if mode not in {RAW, SANITISED}:
        raise DomainError("Sharing mode must be raw or sanitised")
    preference = db.get(SharingPreference, user_sub)
    if preference is None:
        preference = SharingPreference(user_sub=user_sub, mode=mode)
        db.add(preference)
    elif preference.mode != mode:
        _delete_portrait(db, user_sub)
        preference.mode = mode
    db.flush()
    return preference.mode


def assigned_category(reader, facts: dict, cache: dict | None = None) -> tuple[str, str | None]:
    key = (facts.get("vendor"), facts.get("note"), facts.get("amount"))
    if cache is not None and key in cache:
        return cache[key], GEMINI
    try:
        category = reader.categorise(facts)
    except Exception:
        return OTHER, None
    if not isinstance(category, str) or category not in ORDINARY_CATEGORIES:
        if category is None:
            return OTHER, None
        category = OTHER
    if cache is not None:
        cache[key] = category
    return category, GEMINI


def build_reading(db: Session, user_sub: str, now: datetime, reader) -> tuple[dict | None, bool]:
    mode = sharing_mode(db, user_sub)
    _categorise_unset(db, user_sub, reader)
    if not _has_history(db, user_sub):
        _delete_portrait(db, user_sub)
        return None, True
    try:
        draft = reader.read(_payload(db, user_sub, now, mode))
    except Exception:
        draft = None
    if draft is None:
        return _portrait_out(db, user_sub), False
    stored = _store_portrait(db, user_sub, mode, draft)
    if stored is None:
        return _portrait_out(db, user_sub), False
    return _portrait_out(db, user_sub), True


def current_reading(db: Session, user_sub: str) -> dict | None:
    mode = sharing_mode(db, user_sub)
    portrait = db.scalar(select(Portrait).where(Portrait.user_sub == user_sub))
    if portrait is None or portrait.sharing_mode != mode:
        return None
    return _portrait_out(db, user_sub)


def transaction_facts(vendor: str, amount, note: str | None, occurred_at: datetime) -> dict:
    return {
        "vendor": vendor,
        "amount": money_str(amount),
        "note": note,
        "occurred_at": as_utc(occurred_at).astimezone(LONDON).isoformat(),
    }


def _categorise_unset(db: Session, user_sub: str, reader) -> None:
    rows = db.scalars(
        select(Transaction).where(
            Transaction.user_sub == user_sub,
            Transaction.kind == TransactionKind.ordinary,
            Transaction.category_source.is_(None),
        )
    ).all()
    for transaction in rows:
        category, source = assigned_category(
            reader,
            transaction_facts(transaction.vendor or "", transaction.amount, transaction.note, transaction.occurred_at),
        )
        if source is None:
            continue
        transaction.category = category
        transaction.category_source = source
    db.flush()


def _has_history(db: Session, user_sub: str) -> bool:
    ordinary = db.scalar(
        select(Transaction.id).where(
            Transaction.user_sub == user_sub,
            Transaction.kind == TransactionKind.ordinary,
        )
    )
    if ordinary is not None:
        return True
    subscription = db.scalar(select(Subscription.id).where(Subscription.user_sub == user_sub))
    return subscription is not None


def _payload(db: Session, user_sub: str, now: datetime, mode: str) -> dict:
    figures = dashboard(db, user_sub, now)
    month = YearMonth.containing(now)
    transactions = db.scalars(
        select(Transaction)
        .where(Transaction.user_sub == user_sub, Transaction.kind == TransactionKind.ordinary)
        .order_by(Transaction.occurred_at, Transaction.id)
    ).all()
    subscriptions = db.scalars(
        select(Subscription)
        .where(Subscription.user_sub == user_sub)
        .order_by(Subscription.year, Subscription.month, Subscription.name, Subscription.id)
    ).all()
    accounts = []
    for account, balance in list_accounts(db, user_sub):
        if mode == RAW:
            accounts.append({"name": account.name, "calculated_balance": money_str(balance)})
        else:
            accounts.append({"calculated_balance": money_str(balance)})
    return {
        "sharing_mode": mode,
        "current_month": {"year": month.year, "month": month.month},
        "monthly_budget": None if figures["monthly_budget"] is None else money_str(figures["monthly_budget"]),
        "spent_this_month": money_str(figures["spent_this_month"]),
        "left_to_spend": money_str(figures["left_to_spend"]),
        "transactions": [_transaction_view(transaction, mode) for transaction in transactions],
        "subscriptions": [_subscription_view(subscription, mode) for subscription in subscriptions],
        "accounts": accounts,
        "guides": [
            {
                "id": guide["id"],
                "title": guide["title"],
                "summary": guide["summary"],
                "takeaways": guide["takeaways"],
            }
            for guide in list_guides()
        ],
        "resources": [
            {
                "id": resource["id"],
                "title": resource["title"],
                "publisher": resource["publisher"],
                "summary": resource["summary"],
            }
            for resource in list_resources()
        ],
    }


def _transaction_view(transaction: Transaction, mode: str) -> dict:
    occurred = as_utc(transaction.occurred_at).astimezone(LONDON)
    view = {
        "amount": money_str(transaction.amount),
        "category": transaction.category,
        "calendar_month": f"{occurred.year:04d}-{occurred.month:02d}",
    }
    if mode == RAW:
        view["vendor"] = transaction.vendor
        view["note"] = transaction.note
        view["occurred_at"] = occurred.isoformat()
    return view


def _subscription_view(subscription: Subscription, mode: str) -> dict:
    view = {
        "amount": money_str(subscription.amount),
        "calendar_month": f"{subscription.year:04d}-{subscription.month:02d}",
    }
    if mode == RAW:
        view["name"] = subscription.name
    return view


def _store_portrait(db: Session, user_sub: str, mode: str, draft: ReadingDraft) -> Portrait | None:
    reading = draft.reading.strip()
    if not reading:
        return None
    known_guides = guide_ids()
    educations = []
    for item in draft.educations:
        subject = item.subject.strip()
        body = item.body.strip()
        if not subject or not body:
            continue
        guide_id = item.guide_id if item.guide_id in known_guides else None
        educations.append((subject, guide_id, body))
    suggestions = []
    for item in draft.suggestions:
        body = item.body.strip()
        if not body or not isinstance(item.education_index, int):
            continue
        if item.education_index < 0 or item.education_index >= len(educations):
            continue
        suggestions.append((item.education_index, body))
    known_resources = resource_ids()
    recommendations = []
    seen_targets = set()
    for item in draft.recommendations:
        reason = item.reason.strip()
        if not reason:
            continue
        target = None
        if item.kind == "guide" and item.guide_id in known_guides and item.resource_id is None:
            target = (item.kind, item.guide_id)
        elif item.kind == "resource" and item.resource_id in known_resources and item.guide_id is None:
            target = (item.kind, item.resource_id)
        if target is None or target in seen_targets:
            continue
        seen_targets.add(target)
        if target[0] == "guide":
            recommendations.append(("guide", target[1], None, reason))
        else:
            recommendations.append(("resource", None, target[1], reason))
        if len(recommendations) == 3:
            break
    _delete_portrait(db, user_sub)
    portrait = Portrait(user_sub=user_sub, sharing_mode=mode, reading=reading)
    db.add(portrait)
    db.flush()
    for description in _clean_lines(draft.spending_habits):
        db.add(Habit(portrait_id=portrait.id, kind=SPENDING, description=description))
    for description in _clean_lines(draft.projected_habits):
        db.add(Habit(portrait_id=portrait.id, kind=PROJECTED, description=description))
    stored_educations = []
    for subject, guide_id, body in educations:
        education = EducationItem(portrait_id=portrait.id, subject=subject, guide_id=guide_id, body=body)
        db.add(education)
        stored_educations.append(education)
    db.flush()
    for index, body in suggestions:
        db.add(
            SuggestionItem(
                portrait_id=portrait.id,
                education_id=stored_educations[index].id,
                body=body,
            )
        )
    for position, (kind, guide_id, resource_id, reason) in enumerate(recommendations):
        db.add(
            RecommendationItem(
                portrait_id=portrait.id,
                position=position,
                kind=kind,
                guide_id=guide_id,
                resource_id=resource_id,
                reason=reason,
            )
        )
    db.flush()
    return portrait


def _clean_lines(lines: list[str]) -> list[str]:
    cleaned = []
    for line in lines:
        text = line.strip()
        if text:
            cleaned.append(text)
    return cleaned


def _delete_portrait(db: Session, user_sub: str) -> None:
    portrait = db.scalar(select(Portrait).where(Portrait.user_sub == user_sub))
    if portrait is None:
        return
    db.execute(delete(SuggestionItem).where(SuggestionItem.portrait_id == portrait.id))
    db.execute(delete(EducationItem).where(EducationItem.portrait_id == portrait.id))
    db.execute(delete(Habit).where(Habit.portrait_id == portrait.id))
    db.execute(delete(RecommendationItem).where(RecommendationItem.portrait_id == portrait.id))
    db.delete(portrait)
    db.flush()


def _portrait_out(db: Session, user_sub: str) -> dict | None:
    portrait = db.scalar(select(Portrait).where(Portrait.user_sub == user_sub))
    if portrait is None:
        return None
    habits = db.scalars(select(Habit).where(Habit.portrait_id == portrait.id).order_by(Habit.id)).all()
    educations = db.scalars(
        select(EducationItem).where(EducationItem.portrait_id == portrait.id).order_by(EducationItem.id)
    ).all()
    suggestions = db.scalars(
        select(SuggestionItem).where(SuggestionItem.portrait_id == portrait.id).order_by(SuggestionItem.id)
    ).all()
    stored_recommendations = db.scalars(
        select(RecommendationItem)
        .where(RecommendationItem.portrait_id == portrait.id)
        .order_by(RecommendationItem.position)
    ).all()
    recommendations = []
    for item in stored_recommendations:
        if item.kind == "guide":
            guide = get_guide(item.guide_id) if item.guide_id else None
            if guide is None:
                continue
            recommendations.append(
                {
                    "id": item.id,
                    "kind": "guide",
                    "guide_id": item.guide_id,
                    "resource_id": None,
                    "reason": item.reason,
                    "title": guide["title"],
                    "url": None,
                    "publisher": None,
                }
            )
        elif item.kind == "resource":
            resource = get_resource(item.resource_id) if item.resource_id else None
            if resource is None:
                continue
            recommendations.append(
                {
                    "id": item.id,
                    "kind": "resource",
                    "guide_id": None,
                    "resource_id": item.resource_id,
                    "reason": item.reason,
                    "title": resource["title"],
                    "url": resource["url"],
                    "publisher": resource["publisher"],
                }
            )
    return {
        "reading": portrait.reading,
        "spending_habits": [habit.description for habit in habits if habit.kind == SPENDING],
        "projected_habits": [habit.description for habit in habits if habit.kind == PROJECTED],
        "educations": [
            {
                "id": education.id,
                "subject": education.subject,
                "guide_id": education.guide_id,
                "body": education.body,
            }
            for education in educations
        ],
        "suggestions": [
            {"id": suggestion.id, "education_id": suggestion.education_id, "body": suggestion.body}
            for suggestion in suggestions
        ],
        "recommendations": recommendations,
    }

