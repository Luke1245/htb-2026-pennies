import json

import httpx

from pennies.api import create_app
from pennies.reading import EducationDraft, ReadingDraft, RecommendationDraft, SuggestionDraft
from tests.test_api import NOW, account, make_client


class FakeReader:
    def __init__(self):
        self.facts = []
        self.payloads = []
        self.fail_categorise = False
        self.fail_read = False
        self.recommendations = [
            RecommendationDraft("guide", "budgeting-basics", None, "The grocery shops need a budget."),
            RecommendationDraft("resource", None, "moneyhelper-budget-planner", "A budget planner fits this month."),
        ]

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
            recommendations=self.recommendations,
        )


def test_vendor_and_note_select_a_category_once():
    reader = FakeReader()
    client, _holder = make_client(reader=reader)
    cash = account(client)
    suggested = client.post(
        "/category-suggestions",
        json={"vendor": "Pret", "note": "  lunch  ", "amount": "-3.40"},
    )
    assert suggested.status_code == 200, suggested.text
    assert suggested.json()["category"] == "Groceries"
    assert reader.facts[-1]["vendor"] == "Pret"
    assert reader.facts[-1]["note"] == "lunch"
    assert reader.facts[-1]["amount"] == "-3.40"

    created = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-3.40",
            "vendor": "Pret",
            "note": "lunch",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert created.status_code == 200, created.text
    assert created.json()["category"] == "Groceries"
    assert len(reader.facts) == 1

    reader.fail_categorise = True
    missed = client.post(
        "/category-suggestions",
        json={"vendor": "Unknown stall", "note": None, "amount": "-1.00"},
    )
    assert missed.status_code == 200
    assert missed.json()["category"] == "Other"
    blank = client.post("/category-suggestions", json={"vendor": "  ", "note": "lunch"})
    assert blank.status_code == 422


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
    assert built.json()["stored"] is True
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
    fallback = client.get("/reading").json()["reading"]
    assert "Tesco" not in fallback["reading"]
    assert "Music" not in fallback["reading"]
    assert "Groceries" in fallback["reading"]
    client.post("/reading")
    quiet = reader.payloads[-1]
    assert quiet["sharing_mode"] == "sanitised"
    assert "vendor" not in quiet["transactions"][0]
    assert "name" not in quiet["subscriptions"][0]
    assert "name" not in quiet["accounts"][0]
    assert quiet["accounts"][0]["calculated_balance"]


def test_one_transaction_has_a_spending_insight_before_gemini_writes_one():
    reader = FakeReader()
    client, _holder = make_client(reader=reader)
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

    response = client.get("/reading").json()
    assert response["stored"] is False
    reading = response["reading"]
    assert reader.payloads == []
    assert reading["reading"] == "£6.00 went to Groceries this month."
    assert "Tesco" not in reading["reading"]
    assert reading["spending_habits"] == ["£6.00 went to Groceries this month."]
    assert reading["educations"][0]["subject"] == "Groceries"
    assert "Groceries" in reading["educations"][0]["body"]
    assert reading["suggestions"][0]["body"]
    dashboard = client.get("/dashboard").json()
    assert dashboard["categories"] == [{"name": "Groceries", "amount": "6.00"}]
    assert dashboard["spent_this_month"] == "6.00"


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
    assert failed.json()["stored"] is True
    assert failed.json()["reading"]["reading"] == "Shops little and often."

    guides = client.get("/guides")
    assert guides.status_code == 200
    titles = [guide["title"] for guide in guides.json()]
    assert titles == ["Budgeting basics", "Scam avoidance", "Investing basics"]

    holder["sub"] = "user-b"
    assert client.get("/subscriptions").json() == []
    empty = client.get("/reading").json()
    assert empty["reading"] is None
    assert empty["stored"] is False


def test_gemini_client_reads_structured_json(monkeypatch):
    def fake_post(url, headers, json, timeout):
        assert headers["x-goog-api-key"] == "secret"
        assert "gemini-3.5-flash" in url
        prompt = json["contents"][0]["parts"][0]["text"]
        if prompt.startswith("Assign"):
            assert "Decide from the vendor and the note." in prompt
            assert json["generationConfig"]["temperature"] == 0
            assert json["generationConfig"]["thinkingConfig"] == {"thinkingBudget": 0}
            text = '{"category": "Transport"}'
        else:
            assert "one or two short sentences" in prompt
            assert "lack of logged transactions" in prompt
            assert json["generationConfig"]["temperature"] == 0.6
            assert json["generationConfig"]["maxOutputTokens"] == 4096
            assert json["generationConfig"]["thinkingConfig"] == {"thinkingBudget": 0}
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


def test_gemini_client_keeps_the_lesson_short(monkeypatch):
    def fake_post(url, headers, json, timeout):
        text = (
            '{"reading":"  Rent comes first. Lunches are the leak. The rest can wait.  ",'
            '"spending_habits":["One","Two","Three","Four"],'
            '"projected_habits":["Watch one","Watch two","Watch three"],'
            '"educations":['
            '{"subject":"A","guide_id":"","body":"First lesson."},'
            '{"subject":"B","guide_id":"","body":"Second lesson."},'
            '{"subject":"C","guide_id":"","body":"Third lesson."}],'
            '"suggestions":['
            '{"education_index":0,"body":"Do one thing."},'
            '{"education_index":1,"body":"Do another."},'
            '{"education_index":0,"body":"Do a third."}]}'
        )
        request = httpx.Request("POST", url)
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": text}]}}]},
            request=request,
        )

    monkeypatch.setattr("pennies.gemini.httpx.post", fake_post)
    from pennies.gemini import GeminiReader

    draft = GeminiReader("secret", "gemini-3.5-flash").read({})
    assert draft.reading == "Rent comes first. Lunches are the leak."
    assert draft.spending_habits == ["One", "Two", "Three"]
    assert draft.projected_habits == ["Watch one", "Watch two"]
    assert [item.subject for item in draft.educations] == ["A", "B"]
    assert [item.body for item in draft.suggestions] == ["Do one thing.", "Do another."]


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
