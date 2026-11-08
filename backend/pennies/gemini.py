import json

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


class GeminiReader:
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    def categorise(self, facts: dict) -> str | None:
        prompt = (
            "Assign one Pennies category to this ordinary transaction. "
            f"Choose only from: {', '.join(ORDINARY_CATEGORIES)}. "
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
            "You are writing a Pennies Financial portrait. The JSON below is the only history you may treat as fact. "
            "Do not invent transactions, amounts, vendors, notes, dates, account names, or subscription names. "
            "Do extrapolate. A short history is enough for a strong point of view. "
            "State bold assumptions in plain language, then build a detailed picture of what this spending implies: "
            "where the money is really going, which patterns matter, what is about to get expensive, "
            "and what a few more weeks of the same behaviour would mean. "
            "Name spending habits, good or bad, as concrete observations, not labels. "
            "Name projected habits as the bad patterns you expect if this behaviour continues, "
            "and say the assumption that makes each one likely. "
            "Write education that either applies one of the supplied guides by its guide_id, "
            "or explains a category, spending habit, or projected habit that no guide covers. "
            "Make each explanation specific to this history. "
            "Write suggestions that follow from one of those educations by education_index, "
            "focused primarily on the current month, and concrete enough to act on this month. "
            "Leave guide_id empty when the education does not apply a guide. "
            "The reading itself should be several paragraphs: specific, opinionated, and interesting. "
            "Habits, education, and suggestions should be detailed sentences. "
            f"History: {json.dumps(payload)}"
        )
        try:
            body = self._generate(
                prompt, _READING_SCHEMA, temperature=1.2, max_output_tokens=4096, timeout=120
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
            reading=str(body.get("reading") or ""),
            spending_habits=[str(item) for item in body.get("spending_habits") or []],
            projected_habits=[str(item) for item in body.get("projected_habits") or []],
            educations=educations,
            suggestions=suggestions,
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
