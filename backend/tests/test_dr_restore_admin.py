"""Tests for the super-admin DR restore endpoints (SF3 / T-SF.3.9, T-SF.3.11).

All Firestore + GCS access is mocked: we inject a fake in-memory
``DrRestoreRepository`` and patch ``compute_diff_preview`` so the tests run with
no credentials and no network.

Coverage:
  * RBAC — non-super-admin gets 403 on every route.
  * create — 201, persists, attaches a diff preview.
  * four-eyes — the requester CANNOT approve their own request (403);
    a different super-admin CAN (200).
  * execute gate — cannot execute until approved (409); after approval the
    /execute endpoint returns the exact restore-tenant.sh command.
  * diff preview unit — added/changed/unchanged accounting.
  * service transitions — invalid transitions raise.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin.dr_restore import router as DR_ROUTER
from app.services.auth import get_current_user
from app.services.dr_restore_service import (
    DrRestoreService,
    FourEyesViolation,
    InvalidTransition,
    RestoreRequest,
    compute_diff_preview,
)


# ── Fake users ───────────────────────────────────────────────────────────────


def _admin_a() -> dict:
    return {
        "id": "admin-A", "org_id": "platform", "email": "a@zoho.kurd.iq",
        "name": "Admin A", "role": "super_admin", "is_active": True,
        "is_platform_admin": True,
    }


def _admin_b() -> dict:
    return {
        "id": "admin-B", "org_id": "platform", "email": "b@zoho.kurd.iq",
        "name": "Admin B", "role": "super_admin", "is_active": True,
        "is_platform_admin": True,
    }


def _viewer() -> dict:
    return {
        "id": "u-viewer", "org_id": "tenant-1", "email": "v@x.io",
        "name": "Viewer", "role": "viewer", "is_active": True,
        "is_platform_admin": False,
    }


# ── In-memory repository fake ────────────────────────────────────────────────


class _FakeRepo:
    def __init__(self) -> None:
        self.store: dict[str, RestoreRequest] = {}

    def create(self, req: RestoreRequest) -> RestoreRequest:
        self.store[req.id] = req
        return req

    def get(self, request_id: str):
        return self.store.get(request_id)

    def update(self, request_id: str, patch: dict) -> None:
        req = self.store[request_id]
        for k, v in patch.items():
            setattr(req, k, v)

    def list(self, org_id=None, limit: int = 100):
        items = list(self.store.values())
        if org_id:
            items = [r for r in items if r.org_id == org_id]
        items.sort(key=lambda r: r.requested_at, reverse=True)
        return items[:limit]


# Shared fake repo for a single test's app instance.
_REPO_HOLDER: dict[str, _FakeRepo] = {}


def _client(user_fn=_admin_a) -> TestClient:
    app = FastAPI()
    app.include_router(DR_ROUTER)
    app.dependency_overrides[get_current_user] = user_fn
    return TestClient(app, raise_server_exceptions=False)


def _patched_service_factory(repo: _FakeRepo):
    """Return a function suitable for patching app.api.admin.dr_restore._service."""

    def _factory() -> DrRestoreService:
        return DrRestoreService(repo=repo)

    return _factory


# Disable the explicit audit_logs write (it would try to reach Firestore).
@pytest.fixture(autouse=True)
def _no_audit():
    with patch("app.api.admin.dr_restore._audit", lambda *a, **k: None):
        yield


# ── RBAC ─────────────────────────────────────────────────────────────────────


def test_create_forbidden_for_non_super_admin():
    res = _client(_viewer).post(
        "/api/admin/dr/restore",
        json={
            "org_id": "org-1",
            "source_path": "backups/org-1/2026-05-26/backup.json.gz",
            "mode": "upsert",
            "reason": "viewer should be blocked",
            "compute_preview": False,
        },
    )
    assert res.status_code == 403


def test_list_forbidden_for_non_super_admin():
    res = _client(_viewer).get("/api/admin/dr/restore")
    assert res.status_code == 403


# ── create ─────────────────────────────────────────────────────────────────--


def test_create_request_201_with_preview():
    repo = _FakeRepo()
    fake_preview = {"totals": {"added": 1, "changed": 2, "unchanged": 3}, "collections": {}}
    with patch("app.api.admin.dr_restore._service", _patched_service_factory(repo)), \
         patch("app.api.admin.dr_restore.compute_diff_preview", return_value=fake_preview):
        res = _client(_admin_a).post(
            "/api/admin/dr/restore",
            json={
                "org_id": "org-1",
                "source_path": "backups/org-1/2026-05-26/backup.json.gz",
                "mode": "upsert",
                "reason": "accidental bulk delete on invoices",
                "compute_preview": True,
            },
        )
    assert res.status_code == 201
    body = res.json()
    assert body["org_id"] == "org-1"
    assert body["status"] == "requested"
    assert body["requested_by"] == "admin-A"
    assert body["diff_preview"]["totals"]["changed"] == 2
    assert len(repo.store) == 1


def test_create_rejects_short_reason_422():
    repo = _FakeRepo()
    with patch("app.api.admin.dr_restore._service", _patched_service_factory(repo)):
        res = _client(_admin_a).post(
            "/api/admin/dr/restore",
            json={
                "org_id": "org-1",
                "source_path": "backups/org-1/x.json.gz",
                "mode": "upsert",
                "reason": "no",  # < 5 chars
                "compute_preview": False,
            },
        )
    assert res.status_code == 422


# ── four-eyes ────────────────────────────────────────────────────────────────


def _seed_request(repo: _FakeRepo, requested_by="admin-A") -> str:
    svc = DrRestoreService(repo=repo)
    req = svc.request_restore(
        org_id="org-1",
        source_path="backups/org-1/2026-05-26/backup.json.gz",
        mode="upsert",
        reason="four-eyes test seed",
        requested_by=requested_by,
        requested_by_email=f"{requested_by}@zoho.kurd.iq",
    )
    return req.id


def test_four_eyes_self_approval_forbidden():
    repo = _FakeRepo()
    rid = _seed_request(repo, requested_by="admin-A")
    with patch("app.api.admin.dr_restore._service", _patched_service_factory(repo)):
        # admin-A is the requester — must NOT be able to approve.
        res = _client(_admin_a).post(f"/api/admin/dr/restore/{rid}/approve")
    assert res.status_code == 403
    assert "four-eyes" in res.json()["detail"].lower()
    assert repo.store[rid].status == "requested"  # unchanged


def test_four_eyes_different_admin_can_approve():
    repo = _FakeRepo()
    rid = _seed_request(repo, requested_by="admin-A")
    with patch("app.api.admin.dr_restore._service", _patched_service_factory(repo)):
        res = _client(_admin_b).post(f"/api/admin/dr/restore/{rid}/approve")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "approved"
    assert body["approved_by"] == "admin-B"


# ── execute gate ─────────────────────────────────────────────────────────────


def test_execute_blocked_before_approval():
    repo = _FakeRepo()
    rid = _seed_request(repo, requested_by="admin-A")
    with patch("app.api.admin.dr_restore._service", _patched_service_factory(repo)):
        res = _client(_admin_b).post(f"/api/admin/dr/restore/{rid}/execute")
    assert res.status_code == 409
    assert "approved" in res.json()["detail"].lower()


def test_execute_after_approval_returns_command():
    repo = _FakeRepo()
    rid = _seed_request(repo, requested_by="admin-A")
    with patch("app.api.admin.dr_restore._service", _patched_service_factory(repo)):
        # admin-B approves, then executes.
        assert _client(_admin_b).post(f"/api/admin/dr/restore/{rid}/approve").status_code == 200
        res = _client(_admin_b).post(f"/api/admin/dr/restore/{rid}/execute")
    assert res.status_code == 200
    body = res.json()
    assert body["org_id"] == "org-1"
    assert "restore-tenant.sh" in body["command"]
    assert "--org-id org-1" in body["command"]
    assert "--apply" in body["command"]
    assert repo.store[rid].status == "executing"


def test_reject_then_cannot_approve():
    repo = _FakeRepo()
    rid = _seed_request(repo, requested_by="admin-A")
    with patch("app.api.admin.dr_restore._service", _patched_service_factory(repo)):
        assert _client(_admin_b).post(f"/api/admin/dr/restore/{rid}/reject").status_code == 200
        res = _client(_admin_b).post(f"/api/admin/dr/restore/{rid}/approve")
    assert res.status_code == 409  # invalid transition from 'rejected'


def test_get_404_for_unknown():
    repo = _FakeRepo()
    with patch("app.api.admin.dr_restore._service", _patched_service_factory(repo)):
        res = _client(_admin_a).get("/api/admin/dr/restore/does-not-exist")
    assert res.status_code == 404


# ── service-layer unit tests ─────────────────────────────────────────────────


def test_service_self_approval_raises():
    svc = DrRestoreService(repo=_FakeRepo())
    req = svc.request_restore(
        org_id="o", source_path="p", mode="upsert", reason="seed-reason",
        requested_by="x", requested_by_email=None,
    )
    with pytest.raises(FourEyesViolation):
        svc.approve(req.id, approver_id="x", approver_email=None)


def test_service_execute_requires_approved():
    svc = DrRestoreService(repo=_FakeRepo())
    req = svc.request_restore(
        org_id="o", source_path="p", mode="upsert", reason="seed-reason",
        requested_by="x", requested_by_email=None,
    )
    with pytest.raises(InvalidTransition):
        svc.mark_executing(req.id)  # still 'requested'


# ── diff preview unit ────────────────────────────────────────────────────────


def test_compute_diff_preview_accounting():
    # Archive has 3 invoices; live has inv-1 identical, inv-2 changed, inv-3 absent.
    archive = {
        "invoices": [
            {"id": "inv-1", "org_id": "o", "total": 100},
            {"id": "inv-2", "org_id": "o", "total": 200},
            {"id": "inv-3", "org_id": "o", "total": 300},
        ],
        "contacts": [],
    }

    def fake_live_reader(collection: str, org_id: str):
        if collection == "invoices":
            return {
                "inv-1": {"org_id": "o", "total": 100},   # unchanged
                "inv-2": {"org_id": "o", "total": 999},   # changed
                # inv-3 missing -> added
            }
        return {}

    with patch(
        "app.services.dr_restore_service._read_backup_archive", return_value=archive
    ):
        preview = compute_diff_preview(
            org_id="o",
            source_path="backups/o/2026-05-26/backup.json.gz",
            live_reader=fake_live_reader,
        )

    inv = preview["collections"]["invoices"]
    assert inv["unchanged"] == 1
    assert inv["changed"] == 1
    assert inv["added"] == 1
    assert "inv-2" in inv["sample_changed_ids"]
    assert preview["totals"] == {"added": 1, "changed": 1, "unchanged": 1}


def test_compute_diff_preview_ignores_other_tenants():
    # Archive accidentally contains a doc for a different org — must be excluded.
    archive = {
        "invoices": [
            {"id": "inv-1", "org_id": "o", "total": 100},
            {"id": "inv-x", "org_id": "OTHER", "total": 5},
        ]
    }
    with patch(
        "app.services.dr_restore_service._read_backup_archive", return_value=archive
    ):
        preview = compute_diff_preview(
            org_id="o",
            source_path="p",
            live_reader=lambda c, o: {},
        )
    # Only inv-1 (org "o") counted; inv-x excluded.
    assert preview["collections"]["invoices"]["archive_count"] == 1
    assert preview["totals"]["added"] == 1
