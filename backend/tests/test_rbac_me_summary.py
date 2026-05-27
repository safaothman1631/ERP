"""Tests for GET /api/rbac/me/summary."""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _user(role: str, **extra) -> dict:
    return {
        "id": "u-1",
        "email": "test@example.com",
        "org_id": "org-1",
        "role": role,
        "is_active": True,
        **extra,
    }


def test_me_summary_sales():
    from app.api.rbac import router as rbac_router
    from app.services.auth import get_current_user

    app = FastAPI()
    app.include_router(rbac_router)
    app.dependency_overrides[get_current_user] = lambda: _user("sales")

    client = TestClient(app)
    with client as c:
        res = c.get("/api/rbac/me/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["role"] == "sales"
    assert body["persona"]["theme_id"] == "sales"
    assert body["persona"]["default_route"] == "/crm/leads"


def test_me_summary_super_admin_platform():
    from app.api.rbac import router as rbac_router
    from app.services.auth import get_current_user

    app = FastAPI()
    app.include_router(rbac_router)
    app.dependency_overrides[get_current_user] = lambda: _user("super_admin", is_platform_admin=True)

    client = TestClient(app)
    with client as c:
        res = c.get("/api/rbac/me/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["persona"]["default_route"] == "/platform"
    assert body["is_platform_admin"] is True
