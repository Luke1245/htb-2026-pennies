from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from pennies.api import create_app
from pennies.settings import Settings

NOW = datetime(2026, 11, 7, 12, tzinfo=timezone.utc)


def make_client(clock=None, reader=None):
    holder = {"sub": "user-a"}
    app = create_app("sqlite:///:memory:", clock=clock or (lambda: NOW), reader=reader)
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
    assert body["subscriptions"] == "0.00"
    assert "recent_transactions" not in body


def test_spending_rules_and_london_month():
    client, _holder = make_client()
    cash = account(client, "Cash", "100.00")
    bank = account(client, "Bank", "0.00")

    outflow = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-18.40",
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


def test_an_empty_budget_removes_it():
    from tests.test_reading import FakeReader

    client, _holder = make_client(reader=FakeReader())
    account(client, "Cash", "40.00")
    created = client.put("/monthly-budgets/2026/11", json={"amount": "10.00"})
    assert created.status_code == 200, created.text
    assert client.get("/dashboard").json()["left_to_spend"] == "10.00"

    cleared = client.put("/monthly-budgets/2026/11", json={"amount": ""})
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["amount"] is None
    without_budget = client.get("/dashboard").json()
    assert without_budget["monthly_budget"] is None
    assert without_budget["left_to_spend"] == "40.00"

    still_clear = client.put("/monthly-budgets/2026/11", json={"amount": None})
    assert still_clear.status_code == 200
    assert still_clear.json()["amount"] is None
    untouched = client.get("/monthly-budgets/2026/12")
    assert untouched.json()["amount"] is None


def test_summer_time_month_boundary():
    client, _holder = make_client(clock=lambda: datetime(2026, 7, 15, 12, tzinfo=timezone.utc))
    cash = account(client)
    created = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-4.00",
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
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert missing_vendor.status_code == 422

    zero = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "0.00",
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
            "vendor": "Tesco",
            "note": "  milk  ",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert created.status_code == 200
    assert created.json()["note"] == "milk"
    transaction_id = created.json()["id"]

    edited = client.patch(f"/transactions/{transaction_id}", json={"category": "Groceries"})
    assert edited.status_code == 200
    assert edited.json()["category"] == "Groceries"
    rejected = client.patch(f"/transactions/{transaction_id}", json={"category": "Adjustment"})
    assert rejected.status_code == 422
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
    assert stolen.json()["transactions"] == []
    missing = client.post(
        f"/accounts/{cash['id']}/reconciliations",
        json={"real_balance": "5.00"},
    )
    assert missing.status_code == 404


def test_transactions_can_be_read_past_the_first_page():
    client, _holder = make_client()
    cash = account(client)
    for index in range(3):
        created = client.post(
            "/transactions",
            json={
                "account_id": cash["id"],
                "amount": f"-{index + 1}.00",
                "vendor": f"Shop {index}",
                "occurred_at": f"2026-11-0{index + 1}T10:00:00+00:00",
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["kind"] == "ordinary"

    first = client.get("/transactions?limit=2&offset=0")
    assert first.status_code == 200, first.text
    page = first.json()
    assert len(page["transactions"]) == 2
    assert page["next_offset"] == 2
    second = client.get("/transactions?limit=2&offset=2")
    assert len(second.json()["transactions"]) == 1
    assert second.json()["next_offset"] is None


def test_display_name_is_stored_for_the_signed_in_user():
    client, holder = make_client()
    assert client.get("/me").json() == {"display_name": None}

    created = client.put("/me", json={"display_name": "  Ada  "})
    assert created.status_code == 200, created.text
    assert created.json() == {"display_name": "Ada"}
    assert client.get("/me").json() == {"display_name": "Ada"}

    blank = client.put("/me", json={"display_name": "   "})
    assert blank.status_code == 422

    holder["sub"] = "user-b"
    assert client.get("/me").json() == {"display_name": None}
    other = client.put("/me", json={"display_name": "Bo"})
    assert other.status_code == 200, other.text

    holder["sub"] = "user-a"
    assert client.get("/me").json() == {"display_name": "Ada"}


def test_opening_balance_is_money_available_when_there_is_no_budget():
    from tests.test_reading import FakeReader

    client, _holder = make_client(reader=FakeReader())
    cash = account(client, "Cash", "40.00")
    bank = account(client, "Bank", "10.00")
    assert client.get("/dashboard").json()["left_to_spend"] == "50.00"
    recorded = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-6.00",
            "vendor": "Tesco",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert recorded.status_code == 200, recorded.text
    dashboard = client.get("/dashboard").json()
    assert dashboard["spent_this_month"] == "6.00"
    assert dashboard["left_to_spend"] == "44.00"
    assert dashboard["monthly_budget"] is None


def test_renaming_a_category_does_not_change_recorded_transactions():
    from tests.test_reading import FakeReader

    client, _holder = make_client(reader=FakeReader())
    cash = account(client)
    recorded = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-6.00",
            "vendor": "Tesco",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert recorded.json()["category"] == "Groceries"
    categories = client.get("/categories").json()
    groceries = next(item for item in categories if item["name"] == "Groceries")
    renamed = client.patch(f"/categories/{groceries['id']}", json={"name": "Food"})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Food"
    added = client.post("/categories", json={"name": "Clothes"})
    assert added.status_code == 200, added.text
    names = [item["name"] for item in client.get("/categories").json()]
    assert "Food" in names
    assert "Clothes" in names
    assert "Groceries" not in names
    assert client.get("/transactions").json()["transactions"][0]["category"] == "Groceries"


def test_deleting_a_transaction_restores_the_balance():
    from tests.test_reading import FakeReader

    client, holder = make_client(reader=FakeReader())
    cash = account(client, "Cash", "40.00")
    recorded = client.post(
        "/transactions",
        json={
            "account_id": cash["id"],
            "amount": "-6.00",
            "vendor": "Tesco",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert recorded.status_code == 200, recorded.text
    transaction_id = recorded.json()["id"]

    holder["sub"] = "user-b"
    hidden = client.delete(f"/transactions/{transaction_id}")
    assert hidden.status_code == 404

    holder["sub"] = "user-a"
    removed = client.delete(f"/transactions/{transaction_id}")
    assert removed.status_code == 200, removed.text
    assert removed.json()["deleted"] is True
    assert removed.json()["ids"] == [transaction_id]
    assert client.get("/transactions").json()["transactions"] == []
    assert client.get("/accounts").json()[0]["calculated_balance"] == "40.00"
    dashboard = client.get("/dashboard").json()
    assert dashboard["spent_this_month"] == "0.00"
    assert dashboard["left_to_spend"] == "40.00"

    missing = client.delete(f"/transactions/{transaction_id}")
    assert missing.status_code == 404


def test_deleting_a_transfer_removes_both_sides():
    client, _holder = make_client()
    cash = account(client, "Cash", "20.00")
    bank = account(client, "Bank", "0.00")
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
    removed = client.delete(f"/transactions/{transfer.json()['outflow']['id']}")
    assert removed.status_code == 200, removed.text
    removed_ids = set(removed.json()["ids"])
    assert transfer.json()["outflow"]["id"] in removed_ids
    assert transfer.json()["inflow"]["id"] in removed_ids
    assert client.get("/transactions").json()["transactions"] == []
    balances = {item["name"]: item["calculated_balance"] for item in client.get("/accounts").json()}
    assert balances["Cash"] == "20.00"
    assert balances["Bank"] == "0.00"


def test_an_account_name_and_opening_balance_can_be_edited():
    from tests.test_reading import FakeReader

    client, holder = make_client(reader=FakeReader())
    created = account(client, "Cash", "10.00")
    recorded = client.post(
        "/transactions",
        json={
            "account_id": created["id"],
            "amount": "-4.00",
            "vendor": "Shop",
            "occurred_at": "2026-11-02T10:00:00+00:00",
        },
    )
    assert recorded.status_code == 200, recorded.text

    edited = client.patch(
        f"/accounts/{created['id']}",
        json={"name": "Bank", "opening_balance": "25.00"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["name"] == "Bank"
    assert edited.json()["opening_balance"] == "25.00"
    assert edited.json()["calculated_balance"] == "21.00"
    assert client.get("/accounts").json()[0]["name"] == "Bank"

    blank = client.patch(
        f"/accounts/{created['id']}",
        json={"name": "  ", "opening_balance": "25.00"},
    )
    assert blank.status_code == 422

    holder["sub"] = "user-b"
    missing = client.patch(
        f"/accounts/{created['id']}",
        json={"name": "Theirs", "opening_balance": "1.00"},
    )
    assert missing.status_code == 404


def test_database_url_must_be_postgres():
    with pytest.raises(RuntimeError):
        Settings(database_url="").required_database_url()
    with pytest.raises(RuntimeError):
        Settings(database_url="sqlite:///pennies.db").required_database_url()
    assert (
        Settings(database_url="postgres://localhost/pennies").required_database_url()
        == "postgres://localhost/pennies"
    )
