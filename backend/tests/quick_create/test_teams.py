"""Quick-create: POST/GET /api/teams (R2.9)."""
from unittest.mock import patch

from app.api.quick_create import teams_router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.quick_create.TeamRepository"


def test_create_returns_201():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/teams", json={"name": "Field crew", "lead_id": "u-9"}
        )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Field crew"
    assert body["lead_id"] == "u-9"


def test_manager_user_id_maps_to_lead():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/teams", json={"name": "Ops", "manager_user_id": "u-3"}
        )
    assert res.status_code == 201
    assert res.json()["lead_id"] == "u-3"


def test_missing_name_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post("/api/teams", json={"description": "x"})
    assert res.status_code == 422


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post("/api/teams", json={"name": "Ops"})
    assert res.status_code == 403
