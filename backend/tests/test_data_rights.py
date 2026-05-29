"""Tests for the tenant-facing GDPR/PDPL data-rights endpoints (T-SF.2.22).

Follows the repo-mocking convention used elsewhere in the suite: build a tiny
FastAPI app around the router, override ``get_current_user`` for org scoping +
RBAC, and patch the service-layer functions (``app.api.data_rights.*``) so no
real Firestore / GCS connection is needed.

Coverage:
  * export      — 202 happy path (+ Location header), 403 without permission,
                  status lookup 200 / 404, kind mismatch 404.
  * erasure     — 202 happy path (+ confirm_token + Location), 403 without
                  permission, 422 validation, status lookup 200 / 404.
"""
from __future__ import annotations

from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.data_rights import router as ROUTER
from app.services.auth import get_current_user


# ── Users ────────────────────────────────────────────────────────────────


def admin_user() -> dict:
    """Admin role → wildcard perms → passes privacy.export + privacy.erasure."""
    return {
        "id": "user-admin",
        "org_id": "org-1",
        "email": "admin@test.com",
        "name": "Admin",
        "role": "admin",
        "is_active": True,
    }


def viewer_user() -> dict:
    """Read-only role: lacks privacy.* → expects 403."""
    return {
        "id": "user-viewer",
        "org_id": "org-1",
        "email": "viewer@test.com",
        "name": "Viewer",
        "role": "viewer",
        "is_active": True,
    }


def make_client(user_fn=admin_user) -> TestClient:
    app = FastAPI()
    app.include_router(ROUTER)
    app.dependency_overrides[get_current_user] = user_fn
    return TestClient(app, raise_server_exceptions=False)


# ── Sample service records ─────────────────────────────────────────────────


def _export_ready() -> dict:
    return {
        "id": "exp-1",
        "kind": "export",
        "status": "ready",
        "requested_by": "user-admin",
        "requested_by_email": "admin@test.com",
        "requested_at": "2026-05-29T00:00:00",
        "completed_at": "2026-05-29T00:00:05",
        "signed_url": "https://example.com/signed.zip",
        "gcs_path": "data-rights-exports/org-1/123.zip",
        "bytes": 2048,
        "document_count": 42,
        "collections": {"contacts": 10, "invoices": 32},
        "error": None,
        "org_id": "org-1",
    }


def _erasure_awaiting() -> dict:
    return {
        "id": "era-1",
        "kind": "erasure",
        "status": "awaiting_confirmation",
        "requested_by": "user-admin",
        "requested_by_email": "admin@test.com",
        "reason": "customer requested deletion",
        "requested_at": "2026-05-29T00:00:00",
        "confirm_token": "tok-abc123",
        "grace_days": 30,
        "org_id": "org-1",
    }


# ── Export: happy path ──────────────────────────────────────────────────────


def test_request_export_returns_202_with_location():
    with patch("app.api.data_rights.data_rights_service.request_export") as svc:
        svc.return_value = _export_ready()
        res = make_client().post("/api/data-rights/export")
        svc.assert_called_once()
        # org_id is positional; identity bits come from the current user.
        args, kwargs = svc.call_args
        assert args[0] == "org-1"
        assert kwargs["requested_by"] == "user-admin"
        assert kwargs["requested_by_email"] == "admin@test.com"

    assert res.status_code == 202
    body = res.json()
    assert body["id"] == "exp-1"
    assert body["kind"] == "export"
    assert body["status"] == "ready"
    assert body["signed_url"] == "https://example.com/signed.zip"
    assert body["document_count"] == 42
    assert res.headers["Location"] == "/api/data-rights/export/exp-1"


def test_request_export_pending_when_no_bucket():
    pending = {**_export_ready(), "status": "pending", "signed_url": None,
               "error": "export bucket not configured; archive not persisted"}
    with patch("app.api.data_rights.data_rights_service.request_export") as svc:
        svc.return_value = pending
        res = make_client().post("/api/data-rights/export")
    assert res.status_code == 202
    body = res.json()
    assert body["status"] == "pending"
    assert body["signed_url"] is None
    assert body["error"]


def test_request_export_service_failure_returns_503():
    with patch("app.api.data_rights.data_rights_service.request_export") as svc:
        svc.side_effect = RuntimeError("firestore down")
        res = make_client().post("/api/data-rights/export")
    assert res.status_code == 503


def test_request_export_forbidden_without_permission():
    # Patch the service so a regression that skips the gate would surface a 202.
    with patch("app.api.data_rights.data_rights_service.request_export") as svc:
        svc.return_value = _export_ready()
        res = make_client(viewer_user).post("/api/data-rights/export")
        svc.assert_not_called()
    assert res.status_code == 403


# ── Export: status lookup ──────────────────────────────────────────────────


def test_get_export_status_returns_200():
    with patch("app.api.data_rights.data_rights_service.get_export") as svc:
        svc.return_value = _export_ready()
        res = make_client().get("/api/data-rights/export/exp-1")
        svc.assert_called_once_with("org-1", "exp-1")
    assert res.status_code == 200
    assert res.json()["id"] == "exp-1"


def test_get_export_status_404_when_missing():
    with patch("app.api.data_rights.data_rights_service.get_export") as svc:
        svc.return_value = None
        res = make_client().get("/api/data-rights/export/nope")
    assert res.status_code == 404


def test_get_export_status_404_on_kind_mismatch():
    # An erasure id must not resolve through the export endpoint.
    with patch("app.api.data_rights.data_rights_service.get_export") as svc:
        svc.return_value = _erasure_awaiting()
        res = make_client().get("/api/data-rights/export/era-1")
    assert res.status_code == 404


def test_get_export_status_forbidden_without_permission():
    with patch("app.api.data_rights.data_rights_service.get_export") as svc:
        res = make_client(viewer_user).get("/api/data-rights/export/exp-1")
        svc.assert_not_called()
    assert res.status_code == 403


# ── Erasure: happy path ─────────────────────────────────────────────────────


def test_request_erasure_returns_202_with_token_and_location():
    with patch("app.api.data_rights.data_rights_service.request_erasure") as svc:
        svc.return_value = _erasure_awaiting()
        res = make_client().post(
            "/api/data-rights/erasure", json={"reason": "customer requested deletion"}
        )
        svc.assert_called_once()
        args, kwargs = svc.call_args
        assert args[0] == "org-1"
        assert kwargs["requested_by"] == "user-admin"
        assert kwargs["reason"] == "customer requested deletion"

    assert res.status_code == 202
    body = res.json()
    assert body["id"] == "era-1"
    assert body["kind"] == "erasure"
    assert body["status"] == "awaiting_confirmation"
    assert body["confirm_token"] == "tok-abc123"
    assert body["grace_days"] == 30
    assert res.headers["Location"] == "/api/data-rights/erasure/era-1"


def test_request_erasure_without_reason_is_allowed():
    with patch("app.api.data_rights.data_rights_service.request_erasure") as svc:
        svc.return_value = {**_erasure_awaiting(), "reason": None}
        res = make_client().post("/api/data-rights/erasure", json={})
    assert res.status_code == 202
    assert res.json()["status"] == "awaiting_confirmation"


def test_request_erasure_rejects_unknown_field_422():
    with patch("app.api.data_rights.data_rights_service.request_erasure") as svc:
        res = make_client().post(
            "/api/data-rights/erasure", json={"bogus": "x"}
        )
        svc.assert_not_called()
    assert res.status_code == 422


def test_request_erasure_rejects_overlong_reason_422():
    with patch("app.api.data_rights.data_rights_service.request_erasure") as svc:
        res = make_client().post(
            "/api/data-rights/erasure", json={"reason": "x" * 2001}
        )
        svc.assert_not_called()
    assert res.status_code == 422


def test_request_erasure_service_failure_returns_503():
    with patch("app.api.data_rights.data_rights_service.request_erasure") as svc:
        svc.side_effect = RuntimeError("firestore down")
        res = make_client().post("/api/data-rights/erasure", json={})
    assert res.status_code == 503


def test_request_erasure_forbidden_without_permission():
    with patch("app.api.data_rights.data_rights_service.request_erasure") as svc:
        svc.return_value = _erasure_awaiting()
        res = make_client(viewer_user).post("/api/data-rights/erasure", json={})
        svc.assert_not_called()
    assert res.status_code == 403


# ── Erasure: status lookup ─────────────────────────────────────────────────


def test_get_erasure_status_returns_200():
    scheduled = {
        **_erasure_awaiting(),
        "status": "scheduled",
        "confirm_token": None,
        "confirmed_at": "2026-05-29T01:00:00",
        "scheduled_purge_at": "2026-06-28T01:00:00",
    }
    with patch("app.api.data_rights.data_rights_service.get_export") as svc:
        svc.return_value = scheduled
        res = make_client().get("/api/data-rights/erasure/era-1")
        svc.assert_called_once_with("org-1", "era-1")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "scheduled"
    assert body["scheduled_purge_at"] == "2026-06-28T01:00:00"


def test_get_erasure_status_404_when_missing():
    with patch("app.api.data_rights.data_rights_service.get_export") as svc:
        svc.return_value = None
        res = make_client().get("/api/data-rights/erasure/nope")
    assert res.status_code == 404


def test_get_erasure_status_404_on_kind_mismatch():
    with patch("app.api.data_rights.data_rights_service.get_export") as svc:
        svc.return_value = _export_ready()
        res = make_client().get("/api/data-rights/erasure/exp-1")
    assert res.status_code == 404


def test_get_erasure_status_forbidden_without_permission():
    with patch("app.api.data_rights.data_rights_service.get_export") as svc:
        res = make_client(viewer_user).get("/api/data-rights/erasure/era-1")
        svc.assert_not_called()
    assert res.status_code == 403
