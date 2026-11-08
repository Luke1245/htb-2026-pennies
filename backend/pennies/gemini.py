import json
import re

import httpx

from pennies.categories import ORDINARY_CATEGORIES
from pennies.reading import EducationDraft, ReadingDraft, SuggestionDraft

_CATEGORY_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "category": {"type": "STRING", "enum": list(ORDINARY_CATEGORIES)},
    },
    "required": ["category"],
    "propertyOrdering": ["category"],
}

_READING_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "reading": {"type": "STRING"},
        "spending_habits": {"type": "ARRAY", "items": {"type": "STRING"}},
        "projected_habits": {"type": "ARRAY", "items": {"type": "STRING"}},
        "educations": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "subject": {"type": "STRING"},
                    "guide_id": {"type": "STRING"},
                    "body": {"type": "STRING"},
                },
                "required": ["subject", "guide_id", "body"],
                "propertyOrdering": ["subject", "guide_id", "body"],
            },
        },
        "suggestions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "education_index": {"type": "INTEGER"},
                    "body": {"type": "STRING"},
                },
                "required": ["education_index", "body"],
                "propertyOrdering": ["education_index", "body"],
            },
        },
    },
    "required": ["reading", "spending_habits", "projected_habits", "educations", "suggestions"],
    "propertyOrdering": [
        "reading",
        "spending_habits",
        "projected_habits",
        "educations",
        "suggestions",
    ],
}


def _opening(reading: str) -> str:
    text = reading.strip()
    sentences = [part.strip() for part in re.findall(r"[^.!?]+[.!?]+", text)]
    sentences = [part for part in sentences if part]
    if not sentences:
        return text
    return " ".join(sentences[:2])


def _short_lines(items, limit: int) -> list[str]:
    lines = []
    for item in items or []:
        text = str(item).strip()
        if not text:
            continue
        lines.append(text)
        if len(lines) == limit:
            break
    return lines


class GeminiReader:
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    def categorise(self, facts: dict) -> str | None:
        prompt = (
            "Assign one Pennies category to this ordinary transaction. "
            f"Choose only from: {', '.join(ORDINARY_CATEGORIES)}. "
            "Decide from the vendor and the note. "
            "Use the amount only to tell money received from money spent. "
            "Use Income for money received. Use Other when none of the spending categories fit. "
            f"Transaction: {json.dumps(facts)}"
        )
        try:
            body = self._generate(prompt, _CATEGORY_SCHEMA, temperature=0)
        except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, TypeError):
            return None
        category = body.get("category") if isinstance(body, dict) else None
        return category if isinstance(category, str) else None

    def read(self, payload: dict) -> ReadingDraft | None:
        prompt = (
            "You are teaching a teenager or young adult about their own spending in Pennies. "
            "The JSON below is the only history you may treat as fact. "
            "Do not invent transactions, amounts, vendors, notes, dates, account names, or subscription names. "
            "Do not criticize a lack of logged transactions. Never mention a short history, a missing category, "
            "an empty month, unlogged spending, or an unset budget. Write only about transactions and subscriptions that are present. "
            "Be short, plain, and straight to the point. Teach one clear lesson. No jargon and no lecture. "
            "The reading is one or two short sentences: where the money is going, and the one thing worth learning from it. "
            "Give at most three spending habits. Each is one sentence naming a real pattern, good or bad, and why it matters. "
            "Give at most two projected habits. Each is one sentence on what gets worse if this continues. "
            "Give at most two educations. Each teaches one idea from this spending, in two short sentences. "
            "Apply a supplied guide by its guide_id when it fits. Otherwise explain the category, spending habit, "
            "or projected habit, and leave guide_id empty. "
            "Give at most two suggestions. Each follows one education by education_index and is one thing to do this month. "
            f"History: {json.dumps(payload)}"
        )
        try:
            body = self._generate(
                prompt, _READING_SCHEMA, temperature=0.6, max_output_tokens=1200, timeout=120
            )
        except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, TypeError):
            return None
        if not isinstance(body, dict):
            return None
        educations = []
        for item in body.get("educations") or []:
            if not isinstance(item, dict):
                continue
            educations.append(
                EducationDraft(
                    subject=str(item.get("subject") or ""),
                    guide_id=item.get("guide_id") or None,
                    body=str(item.get("body") or ""),
                )
            )
        suggestions = []
        for item in body.get("suggestions") or []:
            if not isinstance(item, dict):
                continue
            suggestions.append(
                SuggestionDraft(
                    education_index=item.get("education_index", -1),
                    body=str(item.get("body") or ""),
                )
            )
        return ReadingDraft(
            reading=_opening(str(body.get("reading") or "")),
            spending_habits=_short_lines(body.get("spending_habits"), 3),
            projected_habits=_short_lines(body.get("projected_habits"), 2),
            educations=educations[:2],
            suggestions=suggestions[:2],
        )

    def _generate(
        self,
        prompt: str,
        schema: dict,
        *,
        temperature: float,
        max_output_tokens: int | None = None,
        timeout: float = 45,
    ) -> dict:
        generation = {
            "temperature": temperature,
            "responseMimeType": "application/json",
            "responseSchema": schema,
        }
        if max_output_tokens is not None:
            generation["maxOutputTokens"] = max_output_tokens
        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
            headers={"x-goog-api-key": self.api_key, "Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": generation,
            },
            timeout=timeout,
        )
        response.raise_for_status()
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
