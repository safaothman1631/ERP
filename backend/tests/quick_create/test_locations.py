"""Quick-create: POST/GET /api/locations (R2.8) — business locations, default flip."""
from unittest.mock import patch

from app.api.quick_create import locations_qc_router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.quick_create.BusinessLocationRepository"


def test_create_returns_201():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/locations", json={"name": "Erbil Store", "type": "retail"}
        )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Erbil Store"
    assert body["type"] == "retail"
    assert body["country"] == "Iraq"


def test_setting_default_demotes_previous():
    prev = {"id": "loc-old", "is_default": True}
    with patch(REPO) as cls:
        repo = cls.return_value
        repo.list.return_value = ([prev], 1)
        repo.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/locations", json={"name": "HQ", "is_default": True}
        )
        repo.update.assert_called_once_with("loc-old", {"is_default": False})
    assert res.status_code == 201


def test_short_name_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post("/api/locations", json={"name": "A"})
    assert res.status_code == 422


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post(
            "/api/locations", json={"name": "Erbil Store"}
        )
    assert res.status_code == 403
