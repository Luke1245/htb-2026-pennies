import json as jsonlib

import httpx

from pennies.gemini import GeminiReader
from tests.test_api import account, make_client


def test_gemini_reader_parses_recommendations(monkeypatch):
    def fake_post(url, headers, json, timeout):
        prompt = json["contents"][0]["parts"][0]["text"]
        assert "recommend" in prompt.lower()
        assert "moneyhelper-budget-planner" in prompt
        schema = json["generationConfig"]["responseSchema"]
        assert "recommendations" in schema["properties"]
        assert "recommendations" in schema["required"]
        text = jsonlib.dumps(
            {
                "reading": "A careful picture.",
                "spending_habits": ["Takes the bus"],
                "projected_habits": ["Bus fares could become a habit"],
                "educations": [{"subject": "Budgeting basics", "guide_id": "budgeting-basics", "body": "Plan the fares."}],
                "suggestions": [{"education_index": 0, "body": "Set aside the bus fare."}],
                "recommendations": [
                    {"kind": "guide", "guide_id": "budgeting-basics", "resource_id": None, "reason": "The fares need a plan."},
                    {
                        "kind": "resource",
                        "guide_id": None,
                        "resource_id": "moneyhelper-budget-planner",
                        "reason": "A budget planner fits this month.",
                    },
                ],
            }
        )
        request = httpx.Request("POST", url)
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]}, request=request)

    monkeypatch.setattr("pennies.gemini.httpx.post", fake_post)
    reader = GeminiReader("secret", "gemini-3.5-flash")
    draft = reader.read(
        {
            "sharing_mode": "raw",
            "resources": [{"id": "moneyhelper-budget-planner", "title": "Budget planner"}],
        }
    )
    assert draft.recommendations[0].kind == "guide"
    assert draft.recommendations[0].guide_id == "budgeting-basics"
    assert draft.recommendations[0].reason == "The fares need a plan."
    assert draft.recommendations[1].kind == "resource"
    assert draft.recommendations[1].resource_id == "moneyhelper-budget-planner"


def _client_with_history():
    from tests.test_reading import FakeReader

    reader = FakeReader()
    client, holder = make_client(reader=reader)
    cash = account(client)
    created = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-6.00",
            "vendor": "Tesco",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert created.status_code == 200, created.text
    return client, holder, reader


def test_portrait_carries_enriched_recommendations():
    client, _holder, _reader = _client_with_history()
    built = client.post("/reading")
    assert built.status_code == 200, built.text

    reading = client.get("/reading").json()["reading"]
    guide, resource = reading["recommendations"]
    assert guide["kind"] == "guide"
    assert guide["guide_id"] == "budgeting-basics"
    assert guide["title"] == "Budgeting basics"
    assert guide["reason"] == "The grocery shops need a budget."
    assert resource["kind"] == "resource"
    assert resource["resource_id"] == "moneyhelper-budget-planner"
    assert resource["title"] == "Budget planner"
    assert resource["publisher"] == "MoneyHelper"
    assert resource["url"] == "https://www.moneyhelper.org.uk/en/everyday-money/budgeting/budget-planner"
    assert resource["guide_id"] is None


def test_unknown_recommendation_targets_and_blank_reasons_are_dropped():
    from pennies.reading import RecommendationDraft
    from tests.test_reading import FakeReader

    client, _holder, reader = _client_with_history()
    reader.recommendations = [
        RecommendationDraft("guide", "no-such-guide", None, "A fine reason."),
        RecommendationDraft("resource", None, "no-such-resource", "Another fine reason."),
        RecommendationDraft("guide", "budgeting-basics", None, "   "),
        RecommendationDraft("resource", None, "stepchange", "Free debt advice fits the pattern."),
    ]
    built = client.post("/reading")
    assert built.status_code == 200, built.text

    recommendations = client.get("/reading").json()["reading"]["recommendations"]
    assert len(recommendations) == 1
    assert recommendations[0]["resource_id"] == "stepchange"


def test_payload_lists_resources_without_urls():
    client, _holder, reader = _client_with_history()
    client.post("/reading")

    payload = reader.payloads[-1]
    resources = payload["resources"]
    assert len(resources) >= 5
    planner = next(resource for resource in resources if resource["id"] == "moneyhelper-budget-planner")
    assert planner["title"] == "Budget planner"
    assert planner["publisher"] == "MoneyHelper"
    assert planner["summary"]
    assert "url" not in planner
    assert "reviewed" not in planner


def test_rebuild_replaces_recommendations():
    from pennies.reading import RecommendationDraft

    client, _holder, reader = _client_with_history()
    client.post("/reading")
    first = client.get("/reading").json()["reading"]["recommendations"]
    assert len(first) == 2

    reader.recommendations = [
        RecommendationDraft("resource", None, "national-debtline", "The overdraft needs attention.")
    ]
    client.post("/reading")
    second = client.get("/reading").json()["reading"]["recommendations"]
    assert [item["resource_id"] for item in second] == ["national-debtline"]
    assert all(item["guide_id"] != "budgeting-basics" for item in second)
