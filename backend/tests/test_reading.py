import json

import httpx

from pennies.api import create_app
from pennies.reading import EducationDraft, ReadingDraft, SuggestionDraft
from tests.test_api import NOW, account, make_client


class FakeReader:
    def __init__(self):
        self.facts = []
        self.payloads = []
        self.fail_categorise = False
        self.fail_read = False

    def categorise(self, facts):
        self.facts.append(facts)
        if self.fail_categorise:
            return None
        if str(facts["amount"]).startswith("-"):
            return "Groceries"
        return "Income"

    def read(self, payload):
        self.payloads.append(payload)
        if self.fail_read:
            return None
        return ReadingDraft(
            reading="Shops little and often.",
            spending_habits=["Regular grocery shops"],
            projected_habits=["Grocery spending could keep rising"],
            educations=[
                EducationDraft("Budgeting basics", "budgeting-basics", "The grocery shops fit a small budget."),
                EducationDraft("Eating out", None, "Eating out is not the pattern here."),
            ],
            suggestions=[SuggestionDraft(0, "Keep the grocery shops inside this month's budget.")],
        )


def test_gemini_assigns_once_and_a_user_edit_sticks():
    reader = FakeReader()
    reader.fail_categorise = True
    client, _holder = make_client(reader=reader)
    cash = account(client)
    created = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-6.00",
            "vendor": "Tesco",
            "note": "fruit",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert created.status_code == 200, created.text
    assert created.json()["category"] == "Other"

    reader.fail_categorise = False
    built = client.post("/reading")
    assert built.status_code == 200, built.text
    assert built.json()["updated"] is True
    assert built.json()["reading"]["spending_habits"] == ["Regular grocery shops"]
    assert built.json()["reading"]["suggestions"][0]["body"].startswith("Keep the grocery")
    categorised = client.get("/transactions").json()["transactions"][0]
    assert categorised["category"] == "Groceries"

    edited = client.patch(f"/transactions/{categorised['id']}", json={"category": "Entertainment"})
    assert edited.status_code == 200
    again = client.post("/reading")
    assert again.json()["updated"] is True
    kept = client.get("/transactions").json()["transactions"][0]
    assert kept["category"] == "Entertainment"
    assert reader.payloads[-1]["transactions"][0]["category"] == "Entertainment"
    assert "Tesco" in reader.facts[-1]["vendor"]


def test_subscriptions_count_as_spending_and_sanitised_reading_hides_names():
    reader = FakeReader()
    client, _holder = make_client(reader=reader)
    cash = account(client, "Cash", "30.00")
    client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-6.00",
            "vendor": "Tesco",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    client.post(
        "/transfers",
        json={
            "from_account_id": cash["id"],
            "to_account_id": account(client, "Bank")["id"],
            "amount": "5.00",
            "occurred_at": "2026-11-03T12:00:00+00:00",
        },
    )
    logged = client.post(
        "/subscriptions",
        json={"name": "Music", "amount": "4.00", "year": 2026, "month": 11},
    )
    assert logged.status_code == 200, logged.text
    previous = client.post(
        "/subscriptions",
        json={"name": "Old music", "amount": "9.00", "year": 2026, "month": 10},
    )
    assert previous.status_code == 200, previous.text
    rejected = client.post(
        "/subscriptions",
        json={"name": "Zero", "amount": "0.00", "year": 2026, "month": 11},
    )
    assert rejected.status_code == 422

    dashboard = client.get("/dashboard").json()
    assert dashboard["spent_this_month"] == "10.00"
    assert dashboard["subscriptions"] == "4.00"
    assert dashboard["categories"] == [{"name": "Groceries", "amount": "6.00"}]

    client.post("/reading")
    raw_payload = reader.payloads[-1]
    assert raw_payload["subscriptions"][0]["name"] == "Old music"
    assert raw_payload["transactions"][0]["vendor"] == "Tesco"
    assert len(raw_payload["transactions"]) == 1
    assert raw_payload["accounts"][0]["name"] == "Bank"

    switched = client.put("/sharing-mode", json={"mode": "sanitised"})
    assert switched.json()["mode"] == "sanitised"
    assert client.get("/reading").json()["reading"] is None
    client.post("/reading")
    quiet = reader.payloads[-1]
    assert quiet["sharing_mode"] == "sanitised"
    assert "vendor" not in quiet["transactions"][0]
    assert "name" not in quiet["subscriptions"][0]
    assert "name" not in quiet["accounts"][0]
    assert quiet["accounts"][0]["calculated_balance"]


def test_a_failed_reading_keeps_the_previous_one_and_guides_stay_curated():
    reader = FakeReader()
    client, holder = make_client(reader=reader)
    cash = account(client)
    client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-2.00",
            "vendor": "Cafe",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert client.post("/reading").json()["reading"]["reading"] == "Shops little and often."
    reader.fail_read = True
    failed = client.post("/reading")
    assert failed.json()["updated"] is False
    assert failed.json()["reading"]["reading"] == "Shops little and often."

    guides = client.get("/guides")
    assert guides.status_code == 200
    titles = [guide["title"] for guide in guides.json()]
    assert titles == ["Budgeting basics", "Scam avoidance", "Investing basics"]

    holder["sub"] = "user-b"
    assert client.get("/subscriptions").json() == []
    assert client.get("/reading").json()["reading"] is None


def test_gemini_client_reads_structured_json(monkeypatch):
    def fake_post(url, headers, json, timeout):
        assert headers["x-goog-api-key"] == "secret"
        assert "gemini-3.5-flash" in url
        prompt = json["contents"][0]["parts"][0]["text"]
        if prompt.startswith("Assign"):
            text = '{"category": "Transport"}'
        else:
            text = json_dumps_reading()
        request = httpx.Request("POST", url)
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]}, request=request)

    monkeypatch.setattr("pennies.gemini.httpx.post", fake_post)
    from pennies.gemini import GeminiReader

    reader = GeminiReader("secret", "gemini-3.5-flash")
    assert reader.categorise({"vendor": "Bus", "amount": "-2.00", "note": None, "occurred_at": "x"}) == "Transport"
    draft = reader.read({"sharing_mode": "raw"})
    assert draft.reading == "A careful picture."
    assert draft.educations[0].guide_id == "budgeting-basics"
    assert draft.suggestions[0].education_index == 0


def json_dumps_reading():
    return json.dumps(
        {
            "reading": "A careful picture.",
            "spending_habits": ["Takes the bus"],
            "projected_habits": ["Bus fares could become a habit"],
            "educations": [{"subject": "Budgeting basics", "guide_id": "budgeting-basics", "body": "Plan the fares."}],
            "suggestions": [{"education_index": 0, "body": "Set aside the bus fare."}],
        }
    )


def test_clock_is_november():
    assert NOW.month == 11
