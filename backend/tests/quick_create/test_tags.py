"""Quick-create: POST/GET /api/tags (R2.12) — (scope,name) collision returns existing."""
from unittest.mock import patch

from app.api.quick_create import tags_router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.quick_create.TagRepository"


def test_create_returns_201():
    with patch(REPO) as cls:
        repo = cls.return_value
        repo.list.return_value = ([], 0)
        repo.create.side_effect = echo_create
        res = make_client(ROUTER).post("/api/tags", json={"name": "vip", "color": "red"})
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "vip"
    assert body["color"] == "red"
    assert body["scope"] == "global"


def test_duplicate_scope_name_returns_200_existing():
    existing = {"id": "tag-1", "name": "vip", "scope": "global", "color": "blue"}
    with patch(REPO) as cls:
        repo = cls.return_value
        repo.list.return_value = ([existing], 1)
        res = make_client(ROUTER).post("/api/tags", json={"name": "vip"})
        repo.create.assert_not_called()
    assert res.status_code == 200
    assert res.json()["id"] == "tag-1"


def test_missing_name_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post("/api/tags", json={"color": "red"})
    assert res.status_code == 422


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post("/api/tags", json={"name": "vip"})
    assert res.status_code == 403
