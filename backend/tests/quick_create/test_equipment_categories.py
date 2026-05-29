"""Quick-create: POST/GET /api/equipment-categories (R2.6)."""
from unittest.mock import patch

from app.api.quick_create import equipment_categories_router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.quick_create.EquipmentCategoryRepository"


def test_create_returns_201():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/equipment-categories",
            json={"name": "Forklifts", "maintenance_interval_days": 30},
        )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Forklifts"
    assert body["maintenance_interval_days"] == 30
    assert res.headers["Location"].startswith("/api/equipment-categories/")


def test_non_positive_interval_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post(
            "/api/equipment-categories",
            json={"name": "Forklifts", "maintenance_interval_days": 0},
        )
    assert res.status_code == 422


def test_missing_name_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post("/api/equipment-categories", json={})
    assert res.status_code == 422


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post(
            "/api/equipment-categories", json={"name": "Forklifts"}
        )
    assert res.status_code == 403


def test_list_returns_items_envelope():
    with patch(REPO) as cls:
        cls.return_value.list.return_value = ([{"id": "eq-1", "name": "X"}], 1)
        res = make_client(ROUTER).get("/api/equipment-categories")
    assert res.status_code == 200
    assert res.json()["total"] == 1
