"""Quick-create: POST/GET /api/expense-categories (R2.5)."""
from unittest.mock import MagicMock, patch

from app.api.quick_create import expense_categories_router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.quick_create.ExpenseCategoryRepository"


def test_create_returns_201_with_location_and_record():
    with patch(REPO) as cls:
        repo = cls.return_value
        repo.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/expense-categories", json={"name": "Travel", "code": "TRV"}
        )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Travel"
    assert body["code"] == "TRV"
    assert "id" in body
    assert res.headers["Location"] == f"/api/expense-categories/{body['id']}"


def test_create_record_is_listable():
    created = {"id": "ec-1", "name": "Travel", "org_id": "org-1"}
    with patch(REPO) as cls:
        repo = cls.return_value
        repo.list.return_value = ([created], 1)
        res = make_client(ROUTER).get("/api/expense-categories")
    assert res.status_code == 200
    assert any(it["id"] == "ec-1" for it in res.json()["items"])


def test_missing_required_name_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post("/api/expense-categories", json={"code": "X"})
    assert res.status_code == 422


def test_short_name_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post("/api/expense-categories", json={"name": "A"})
    assert res.status_code == 422


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post(
            "/api/expense-categories", json={"name": "Travel"}
        )
    assert res.status_code == 403
