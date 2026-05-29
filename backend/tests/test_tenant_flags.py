"""Per-tenant feature flag override tests (G2 / R2.4)."""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.admin.tenant_flags import router as flag_router  # noqa: E402
from app.services import feature_flags_tenant as svc  # noqa: E402
from app.services.auth import get_current_user  # noqa: E402


def _super() -> dict:
    return {"id": "u-super", "role": "super_admin", "is_platform_admin": True}


def _regular() -> dict:
    return {"id": "u-admin", "role": "admin", "is_platform_admin": False}


@pytest.fixture(autouse=True)
def _clear_cache():
    svc._CACHE.clear()
    yield
    svc._CACHE.clear()


def _make_app(user_fn=_super) -> TestClient:
    app = FastAPI()
    app.include_router(flag_router)
    app.dependency_overrides[get_current_user] = user_fn
    return TestClient(app)


# ── API permissions ──────────────────────────────────────────────────────


def test_set_flag_requires_super_admin():
    client = _make_app(_regular)
    res = client.put(
        "/api/admin/tenants/t1/flags/new_dashboard",
        json={"enabled": True, "reason": "hotfix bug #42"},
    )
    assert res.status_code == 403


def test_set_flag_invalid_key_returns_422():
    client = _make_app()
    res = client.put(
        "/api/admin/tenants/t1/flags/UPPER_CASE",
        json={"enabled": True, "reason": "test"},
    )
    assert res.status_code == 422


def test_set_flag_short_reason_returns_422():
    client = _make_app()
    res = client.put(
        "/api/admin/tenants/t1/flags/x", json={"enabled": True, "reason": "x"}
    )
    assert res.status_code == 422


def test_set_flag_round_trip():
    with patch("app.services.feature_flags_tenant._doc_path") as path_fn:
        path_doc = MagicMock()
        path_fn.return_value = path_doc
        client = _make_app()
        res = client.put(
            "/api/admin/tenants/t1/flags/new_dashboard",
            json={"enabled": True, "reason": "Pilot for tenant t1 (ticket #42)"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["enabled"] is True
    assert body["flag_key"] == "new_dashboard"
    assert body["tenant_id"] == "t1"
    path_doc.set.assert_called_once()


def test_delete_flag_returns_204():
    with patch("app.services.feature_flags_tenant._doc_path") as path_fn:
        path_fn.return_value = MagicMock()
        client = _make_app()
        res = client.delete("/api/admin/tenants/t1/flags/new_dashboard")
    assert res.status_code == 204


# ── Service unit tests ───────────────────────────────────────────────────


def test_is_enabled_returns_override_when_present():
    with patch("app.services.feature_flags_tenant.get_override") as gov:
        gov.return_value = {"enabled": True}
        assert svc.is_enabled("flag-x", "tenant-1") is True
        gov.return_value = {"enabled": False}
        assert svc.is_enabled("flag-x", "tenant-1") is False


def test_get_override_expired_returns_none():
    expired_doc = MagicMock()
    expired_doc.exists = True
    expired_doc.to_dict.return_value = {
        "enabled": True,
        "expires_at": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    with patch("app.services.feature_flags_tenant._doc_path") as path_fn:
        path_fn.return_value.get.return_value = expired_doc
        assert svc.get_override("t1", "x") is None
