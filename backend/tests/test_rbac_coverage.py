"""
RBAC coverage tests for Phase 2 high-risk modules.

Validates:
  - banking POST without write permission returns 403
  - audit helper reports zero unprotected routes in phase-2 scope
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _viewer_user() -> dict:
    return {
        "id": "viewer-1",
        "email": "viewer@test.com",
        "org_id": "org-1",
        "role": "viewer",
        "is_active": True,
    }


class TestBankingRbacSmoke:
    """Viewer role must be denied banking mutations."""

    def test_create_account_without_write_perm_returns_403(self):
        from app.api.banking import router as banking_router
        from app.services.auth import get_current_user

        app = FastAPI()
        app.include_router(banking_router)
        app.dependency_overrides[get_current_user] = _viewer_user

        client = TestClient(app, raise_server_exceptions=False)
        response = client.post(
            "/api/banking/accounts",
            json={
                "account_name": "Test",
                "account_number": "123",
                "bank_name": "Test Bank",
            },
        )

        assert response.status_code == 403
        assert "bank.write" in response.json().get("detail", "")

    def test_list_accounts_without_read_perm_returns_403(self):
        from app.api.banking import router as banking_router
        from app.services.auth import get_current_user

        app = FastAPI()
        app.include_router(banking_router)

        def _no_perms_user() -> dict:
            user = _viewer_user()
            user["role"] = "member"
            return user

        app.dependency_overrides[get_current_user] = _no_perms_user

        with patch("app.services.permissions.get_user_permissions", return_value=set()):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/api/banking/accounts")

        assert response.status_code == 403


class TestAuditRbacCoverage:
    """Phase-2 scoped audit must find no unprotected mutating routes."""

    def test_phase2_scope_has_full_coverage(self):
        from app.main import app
        from scripts.audit_rbac_coverage import PHASE2_PREFIXES, audit_rbac_coverage

        unprotected = audit_rbac_coverage(app, scope_prefixes=PHASE2_PREFIXES)
        assert unprotected == [], (
            "Unprotected phase-2 routes:\n"
            + "\n".join(f"  {u['methods']} {u['path']}" for u in unprotected)
        )
