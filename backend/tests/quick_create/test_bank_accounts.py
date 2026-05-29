"""Quick-create: POST/GET /api/bank-accounts (R2.10) — account number masked on read."""
from unittest.mock import patch

from app.api.quick_create import bank_accounts_router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.quick_create.BankAccountRepository"


def test_create_returns_201_with_masked_number():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/bank-accounts",
            json={"name": "Main", "bank_name": "RT Bank", "account_number": "1234567890"},
        )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Main"
    assert body["account_number"].endswith("7890")
    assert body["account_number"] != "1234567890"


def test_list_masks_account_numbers():
    rows = [{"id": "b1", "name": "Main", "account_number": "1234567890"}]
    with patch(REPO) as cls:
        cls.return_value.list.return_value = (rows, 1)
        res = make_client(ROUTER).get("/api/bank-accounts")
    assert res.status_code == 200
    assert res.json()["items"][0]["account_number"].endswith("7890")
    assert res.json()["items"][0]["account_number"] != "1234567890"


def test_missing_required_fields_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post("/api/bank-accounts", json={"name": "Main"})
    assert res.status_code == 422


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post(
            "/api/bank-accounts",
            json={"name": "Main", "bank_name": "RT", "account_number": "1"},
        )
    assert res.status_code == 403
