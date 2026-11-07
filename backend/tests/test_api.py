from datetime import datetime, timezone

from fastapi.testclient import TestClient

from pennies.api import create_app

NOW = datetime(2026, 11, 7, 12, tzinfo=timezone.utc)


def make_client(clock=None):
    holder = {"sub": "user-a"}
    app = create_app("sqlite:///:memory:", clock=clock or (lambda: NOW))
    app.dependency_overrides[app.state.get_current_user] = lambda: holder["sub"]
    return TestClient(app), holder


def account(client, name="Cash", opening="0.00"):
    response = client.post("/accounts", json={"name": name, "opening_balance": opening})
    assert response.status_code == 200, response.text
    return response.json()


def test_health_does_not_require_auth():
    app = create_app("sqlite:///:memory:")
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_missing_token_is_rejected():
    app = create_app("sqlite:///:memory:")
    response = TestClient(app).get("/accounts")
    assert response.status_code == 401


def test_dashboard_starts_empty():
    client, _holder = make_client()
    response = client.get("/dashboard")
    assert response.status_code == 200
    body = response.json()
    assert body["spent_this_month"] == "0.00"
    assert body["left_to_spend"] == "0.00"
    assert body["monthly_budget"] is None
    assert body["categories"] == []
    assert body["recent_transactions"] == []


def test_spending_rules_and_london_month():
    client, _holder = make_client()
    cash = account(client, "Cash", "100.00")
    bank = account(client, "Bank", "0.00")

    outflow = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-18.40",
            "category": "Other",
            "vendor": "Tesco",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert outflow.status_code == 200, outflow.text

    income = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "1850.00",
            "category": "Other",
            "vendor": "Employer",
            "occurred_at": "2026-11-01T09:00:00+00:00",
        },
    )
    assert income.status_code == 200, income.text

    old = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-50.00",
            "category": "Other",
            "vendor": "Old shop",
            "occurred_at": "2026-10-31T23:30:00+00:00",
        },
    )
    assert old.status_code == 200, old.text

    transfer = client.post(
        "/transfers",
        json={
            "from_account_id": cash["id"],
            "to_account_id": bank["id"],
            "amount": "20.00",
            "occurred_at": "2026-11-03T12:00:00+00:00",
        },
    )
    assert transfer.status_code == 200, transfer.text
    assert transfer.json()["outflow"]["vendor"] is None

    reconciled = client.post(
        f"/accounts/{bank['id']}/reconciliations",
        json={"real_balance": "15.00", "occurred_at": "2026-11-04T12:00:00+00:00"},
    )
    assert reconciled.status_code == 200, reconciled.text
    adjustment = reconciled.json()["adjustment"]
    assert adjustment["amount"] == "-5.00"
    assert adjustment["category"] == "Adjustment"
    assert adjustment["vendor"] == "Adjustment"

    budget = client.put("/monthly-budgets/2026/11", json={"amount": "10.00"})
    assert budget.status_code == 200, budget.text
    untouched = client.get("/monthly-budgets/2026/12")
    assert untouched.json()["amount"] is None

    dashboard = client.get("/dashboard").json()
    assert dashboard["spent_this_month"] == "18.40"
    assert dashboard["left_to_spend"] == "-8.40"
    assert dashboard["monthly_budget"] == "10.00"
    assert dashboard["categories"] == [{"name": "Other", "amount": "18.40"}]

    balances = {item["name"]: item["calculated_balance"] for item in client.get("/accounts").json()}
    assert balances["Cash"] == "1861.60"
    assert balances["Bank"] == "15.00"


def test_summer_time_month_boundary():
    client, _holder = make_client(clock=lambda: datetime(2026, 7, 15, 12, tzinfo=timezone.utc))
    cash = account(client)
    created = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-4.00",
            "category": "Other",
            "vendor": "Cafe",
            "occurred_at": "2026-07-01T00:30:00+01:00",
        },
    )
    assert created.status_code == 200, created.text
    previous = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-9.00",
            "category": "Other",
            "vendor": "Late",
            "occurred_at": "2026-06-30T23:30:00+01:00",
        },
    )
    assert previous.status_code == 200, previous.text
    assert client.get("/dashboard").json()["spent_this_month"] == "4.00"


def test_rejects_invalid_transactions_and_limits_edits():
    client, _holder = make_client()
    cash = account(client)
    missing_vendor = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-1.00",
            "category": "Other",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert missing_vendor.status_code == 422

    zero = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "0.00",
            "category": "Other",
            "vendor": "Tesco",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert zero.status_code == 422

    wrong_category = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-1.00",
            "category": "Groceries",
            "vendor": "Tesco",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert wrong_category.status_code == 422

    created = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-1.00",
            "category": "Other",
            "vendor": "Tesco",
            "note": "  milk  ",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert created.status_code == 200
    assert created.json()["note"] == "milk"
    transaction_id = created.json()["id"]

    edited = client.patch(f"/transactions/{transaction_id}", json={"category": "Other"})
    assert edited.status_code == 200
    forbidden = client.patch(
        f"/transactions/{transaction_id}", json={"category": "Other", "amount": "-2.00"}
    )
    assert forbidden.status_code == 422

    same_account = client.post(
        "/transfers",
        json={
            "from_account_id": cash["id"],
            "to_account_id": cash["id"],
            "amount": "1.00",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert same_account.status_code == 422

    no_change = client.post(
        f"/accounts/{cash['id']}/reconciliations",
        json={"real_balance": "-1.00"},
    )
    assert no_change.status_code == 200
    assert no_change.json()["adjustment"] is None


def test_records_stay_with_their_user():
    client, holder = make_client()
    cash = account(client, "Cash")
    holder["sub"] = "user-b"
    hidden = client.get("/accounts")
    assert hidden.status_code == 200
    assert hidden.json() == []
    stolen = client.get("/transactions")
    assert stolen.json() == []
    missing = client.post(
        f"/accounts/{cash['id']}/reconciliations",
        json={"real_balance": "5.00"},
    )
    assert missing.status_code == 404
