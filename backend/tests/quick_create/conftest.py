"""Shared fixtures/helpers for quick-create endpoint tests (launch-readiness § R2.14).

Tests follow the repo-mocking pattern used elsewhere in the suite: build a tiny
FastAPI app around a single router, override ``get_current_user``, and patch the
Firestore repository class so no real Firestore connection is needed.
"""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.services.auth import get_current_user  # noqa: E402


def admin_user() -> dict:
    return {
        "id": "user-admin",
        "org_id": "org-1",
        "email": "admin@test.com",
        "name": "Admin",
        "role": "admin",
        "is_active": True,
    }


def viewer_user() -> dict:
    """Read-only role: lacks every ``*.create`` permission → expects 403."""
    return {
        "id": "user-viewer",
        "org_id": "org-1",
        "email": "viewer@test.com",
        "name": "Viewer",
        "role": "viewer",
        "is_active": True,
    }


def make_client(router, user_fn=admin_user) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = user_fn
    return TestClient(app, raise_server_exceptions=False)


def echo_create(data: dict) -> dict:
    """Stand-in for ``BaseRepository.create`` — echoes the payload with org scope."""
    return {**data, "org_id": "org-1"}
