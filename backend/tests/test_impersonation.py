"""Impersonation backend tests (G2 / R2.3 / R2.4).

Covers:
  * Start session — super-admin OK, regular admin 403, missing reason 422.
  * Audit doc written on start.
  * Read-only middleware: GET passes, POST blocked with 403,
    ``/api/admin/impersonate/end`` whitelisted.
  * Token TTL = 30 minutes; expired token rejected by JWT layer.
  * End session marks audit doc and revokes jti.
  * Cross-tenant attempt by a non-super-admin 403.
  * Audit listing returns inserted docs.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.admin.impersonate import router as impersonate_router  # noqa: E402
from app.middleware.read_only_mode import (  # noqa: E402
    is_read_only_token,
    read_only_mode_middleware,
)
from app.services.auth import get_current_user  # noqa: E402


# ── Fixtures ──────────────────────────────────────────────────────────────


def _super_admin() -> dict:
    return {
        "id": "u-super",
        "email": "super@platform.com",
        "role": "super_admin",
        "is_platform_admin": True,
        "is_active": True,
        "org_id": "platform",
    }


def _regular_admin() -> dict:
    return {
        "id": "u-admin",
        "email": "admin@tenant.com",
        "role": "admin",
        "is_active": True,
        "org_id": "tenant-1",
    }


def _impersonator_token_payload(audit_id: str = "aud-1") -> dict:
    """Mimic the JWT payload an active impersonation session carries."""
    return {
        "id": "u-target",
        "sub": "u-target",
        "_jti": "jti-aud-1",
        "org_id": "tenant-2",
        "act": {"sub": "u-super"},
        "impersonation": True,
        "read_only": True,
        "scope": "read-only",
        "audit_id": audit_id,
        "role": "viewer",
        "is_active": True,
    }


@pytest.fixture
def app_super():
    app = FastAPI()
    app.include_router(impersonate_router)
    app.dependency_overrides[get_current_user] = _super_admin
    return app


@pytest.fixture
def app_admin():
    app = FastAPI()
    app.include_router(impersonate_router)
    app.dependency_overrides[get_current_user] = _regular_admin
    return app


# ── start ────────────────────────────────────────────────────────────────


def test_start_session_as_super_admin_returns_token(app_super):
    with patch(
        "app.api.admin.impersonate._write_audit_doc",
        new=AsyncMock(return_value=None),
    ) as write_audit:
        client = TestClient(app_super)
        res = client.post(
            "/api/admin/impersonate/start",
            json={
                "tenant_id": "tenant-XYZ",
                "reason": "Debugging stuck invoice for customer ticket #1234",
            },
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["access_token"]
    assert body["expires_in"] == 30 * 60
    assert body["tenant_id"] == "tenant-XYZ"
    assert body["read_only"] is True
    assert body["audit_id"]
    write_audit.assert_awaited_once()


def test_start_session_as_regular_admin_returns_403(app_admin):
    client = TestClient(app_admin)
    res = client.post(
        "/api/admin/impersonate/start",
        json={"tenant_id": "tenant-1", "reason": "I want to peek at data"},
    )
    assert res.status_code == 403
    assert "super_admin" in res.json()["detail"].lower()


def test_start_session_missing_reason_returns_422(app_super):
    client = TestClient(app_super)
    res = client.post(
        "/api/admin/impersonate/start",
        json={"tenant_id": "tenant-XYZ"},
    )
    assert res.status_code == 422


def test_start_session_short_reason_returns_422(app_super):
    client = TestClient(app_super)
    res = client.post(
        "/api/admin/impersonate/start",
        json={"tenant_id": "tenant-XYZ", "reason": "short"},
    )
    assert res.status_code == 422


def test_start_session_writes_audit_doc_with_metadata(app_super):
    captured: dict = {}

    async def fake_write(entry):
        captured.update(entry.model_dump(mode="json"))

    with patch("app.api.admin.impersonate._write_audit_doc", new=fake_write):
        client = TestClient(app_super)
        res = client.post(
            "/api/admin/impersonate/start",
            json={
                "tenant_id": "tenant-Z",
                "reason": "Investigating reported data loss in invoices table",
            },
            headers={"X-Forwarded-For": "10.0.0.1", "User-Agent": "tester"},
        )
    assert res.status_code == 200
    assert captured["target_tenant_id"] == "tenant-Z"
    assert captured["impersonator_user_id"] == "u-super"
    assert captured["scope"] == "read-only"
    assert captured["status"] == "active"
    assert captured["ip"] == "10.0.0.1"
    assert captured["user_agent"] == "tester"


# ── token TTL ────────────────────────────────────────────────────────────


def test_issued_token_expires_in_30_minutes(app_super):
    from app.services.auth import settings as auth_settings
    from jose import jwt

    with patch(
        "app.api.admin.impersonate._write_audit_doc",
        new=AsyncMock(return_value=None),
    ):
        client = TestClient(app_super)
        res = client.post(
            "/api/admin/impersonate/start",
            json={
                "tenant_id": "t-1",
                "reason": "Routine smoke test for impersonation flow",
            },
        )
    token = res.json()["access_token"]
    decoded = jwt.decode(
        token,
        auth_settings.SECRET_KEY,
        algorithms=[auth_settings.ALGORITHM],
    )
    assert decoded["read_only"] is True
    assert decoded["impersonation"] is True
    assert decoded["act"]["sub"] == "u-super"
    exp = datetime.utcfromtimestamp(decoded["exp"])
    delta = exp - datetime.utcnow()
    assert timedelta(minutes=29) <= delta <= timedelta(minutes=31)


def test_expired_impersonation_token_rejected_by_jwt_layer():
    """Tokens past their ``exp`` claim are refused by the existing JWT
    verification path — we just confirm the helper sees them as invalid."""
    from app.services.auth import create_access_token, verify_token

    expired_token = create_access_token(
        {"sub": "x", "org_id": "y", "impersonation": True, "read_only": True},
        expires_delta=timedelta(seconds=-10),
    )
    assert verify_token(expired_token) is False


# ── end ──────────────────────────────────────────────────────────────────


def test_end_session_marks_audit_doc_and_revokes_token():
    app = FastAPI()
    app.include_router(impersonate_router)
    app.dependency_overrides[get_current_user] = lambda: _impersonator_token_payload(
        "aud-XYZ"
    )

    with patch(
        "app.api.admin.impersonate._mark_audit_ended",
        new=AsyncMock(return_value=True),
    ) as mark, patch("app.services.auth.revoke_token") as revoke:
        client = TestClient(app)
        res = client.post(
            "/api/admin/impersonate/end",
            json={"audit_id": "aud-XYZ"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ended"
    assert body["audit_id"] == "aud-XYZ"
    mark.assert_awaited_once()
    revoke.assert_called_once_with("jti-aud-1")


def test_end_session_missing_audit_id_returns_400():
    """A plain super-admin (no impersonation token) must pass audit_id."""
    app = FastAPI()
    app.include_router(impersonate_router)
    app.dependency_overrides[get_current_user] = _super_admin
    client = TestClient(app)
    res = client.post("/api/admin/impersonate/end", json={})
    assert res.status_code == 400


def test_end_session_audit_not_found_returns_404():
    app = FastAPI()
    app.include_router(impersonate_router)
    app.dependency_overrides[get_current_user] = lambda: _impersonator_token_payload()
    with patch(
        "app.api.admin.impersonate._mark_audit_ended",
        new=AsyncMock(return_value=False),
    ):
        client = TestClient(app)
        res = client.post(
            "/api/admin/impersonate/end", json={"audit_id": "never-existed"}
        )
    assert res.status_code == 404


# ── audit listing ────────────────────────────────────────────────────────


def test_audit_listing_super_admin_only(app_admin):
    client = TestClient(app_admin)
    res = client.get("/api/admin/impersonate/audit")
    assert res.status_code == 403


def test_audit_listing_returns_items(app_super):
    fake_doc = MagicMock()
    fake_doc.id = "aud-1"
    fake_doc.to_dict.return_value = {
        "audit_id": "aud-1",
        "impersonator_user_id": "u-super",
        "target_tenant_id": "tenant-1",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
        "reason": "Reproducing issue",
        "scope": "read-only",
        "status": "active",
    }

    class _FakeStream:
        def __aiter__(self):
            self._yielded = False
            return self

        async def __anext__(self):
            if self._yielded:
                raise StopAsyncIteration
            self._yielded = True
            return fake_doc

    fake_query = MagicMock()
    fake_query.order_by.return_value = fake_query
    fake_query.limit.return_value = fake_query
    fake_query.stream.return_value = _FakeStream()

    fake_client = MagicMock()
    fake_client.collection.return_value = fake_query

    with patch(
        "app.firestore.client.get_async_client", return_value=fake_client
    ):
        client = TestClient(app_super)
        res = client.get("/api/admin/impersonate/audit?limit=10")
    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["audit_id"] == "aud-1"


# ── read-only middleware ─────────────────────────────────────────────────


def test_is_read_only_token_recognises_flag():
    assert is_read_only_token({"read_only": True}) is True
    assert is_read_only_token({"scope": "read-only", "impersonation": True}) is True
    assert is_read_only_token({"scope": "read-only"}) is False  # no impersonation
    assert is_read_only_token({"read_only": False}) is False
    assert is_read_only_token(None) is False


def test_read_only_middleware_allows_get_and_blocks_post():
    from app.services.auth import create_access_token

    token = create_access_token(
        {
            "sub": "u-target",
            "org_id": "t-1",
            "impersonation": True,
            "read_only": True,
            "scope": "read-only",
            "audit_id": "aud-1",
            "act": {"sub": "u-super"},
            "role": "viewer",
        },
        expires_delta=timedelta(minutes=29),
    )

    app = FastAPI()
    app.middleware("http")(read_only_mode_middleware)

    @app.get("/api/whatever")
    async def read_handler():
        return {"ok": True}

    @app.post("/api/whatever")
    async def write_handler():
        return {"ok": True}

    @app.post("/api/admin/impersonate/end")
    async def end_handler():
        return {"ended": True}

    client = TestClient(app)
    auth = {"Authorization": f"Bearer {token}"}

    # Read passes.
    assert client.get("/api/whatever", headers=auth).status_code == 200
    # Mutation blocked.
    blocked = client.post("/api/whatever", headers=auth)
    assert blocked.status_code == 403
    assert blocked.json()["error"] == "read_only_session"
    # End-impersonation explicit whitelist.
    assert client.post("/api/admin/impersonate/end", headers=auth).status_code == 200


def test_read_only_middleware_lets_normal_tokens_mutate():
    from app.services.auth import create_access_token

    token = create_access_token(
        {"sub": "u-1", "org_id": "t-1", "role": "admin"},
        expires_delta=timedelta(minutes=10),
    )

    app = FastAPI()
    app.middleware("http")(read_only_mode_middleware)

    @app.post("/api/whatever")
    async def write_handler():
        return {"ok": True}

    res = TestClient(app).post(
        "/api/whatever",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
