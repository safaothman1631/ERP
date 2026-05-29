"""Quick-create: POST/GET /api/currencies (R2.11) — idempotent upsert by code."""
from unittest.mock import patch

from app.api.quick_create import currencies_router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.quick_create.CurrencyRepository"


def test_create_uppercases_code_and_returns_201():
    with patch(REPO) as cls:
        repo = cls.return_value
        repo.get.return_value = None
        repo.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/currencies", json={"code": "irr", "name": "Iranian Rial", "symbol": "﷼"}
        )
    assert res.status_code == 201
    body = res.json()
    assert body["code"] == "IRR"
    assert body["id"] == "IRR"
    assert res.headers["Location"] == "/api/currencies/IRR"


def test_re_add_existing_code_returns_200_with_existing():
    existing = {"id": "IRR", "code": "IRR", "name": "Iranian Rial", "symbol": "﷼"}
    with patch(REPO) as cls:
        repo = cls.return_value
        repo.get.return_value = existing
        res = make_client(ROUTER).post(
            "/api/currencies", json={"code": "IRR", "name": "Rial", "symbol": "R"}
        )
        # idempotent: must not create a duplicate
        repo.create.assert_not_called()
    assert res.status_code == 200
    assert res.json()["code"] == "IRR"


def test_invalid_code_length_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post(
            "/api/currencies", json={"code": "US", "name": "Dollar", "symbol": "$"}
        )
    assert res.status_code == 422


def test_missing_symbol_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post(
            "/api/currencies", json={"code": "USD", "name": "Dollar"}
        )
    assert res.status_code == 422


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post(
            "/api/currencies", json={"code": "USD", "name": "Dollar", "symbol": "$"}
        )
    assert res.status_code == 403
