"""Prefix search service and API gate."""
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_unified_search_merges_items():
    from app.services.search_service import unified_search

    with patch("app.services.search_service.search_items") as si, patch(
        "app.services.search_service.search_contacts"
    ) as sc:
        si.return_value = [{"id": "i1", "name": "apple"}]
        sc.return_value = []
        out = unified_search("org-1", "ap", types=["items", "contacts"])
        assert out["results"]["items"][0]["id"] == "i1"
        sc.assert_called_once()


def test_search_api_disabled_by_default():
    from app.api.search import router as search_router
    from app.services.auth import get_current_user

    app = FastAPI()
    app.include_router(search_router)

    def _user():
        return {"id": "u1", "org_id": "org-1", "role": "admin"}

    app.dependency_overrides[get_current_user] = _user

    with patch("app.services.permissions.get_user_permissions", return_value={"items.read"}):
        with patch("app.config.get_settings") as gs:
            gs.return_value.SEARCH_PREFIX_ENABLED = False
            client = TestClient(app, raise_server_exceptions=False)
            r = client.get("/api/search?q=test")
    assert r.status_code == 503


def test_prefix_query_min_length():
    from app.services.search_service import search_items

    assert search_items("org-1", "a") == []
