"""Tenant org admin cannot mutate feature flags — platform admin only (F5)."""
from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.feature_flags import router as feature_flags_router
from app.services.auth import get_current_user


def _tenant_admin():
    return {
        "id": "user-tenant-admin",
        "org_id": "org-1",
        "role": "admin",
        "email": "admin@example.com",
    }


def _platform_admin():
    return {
        "id": "platform-1",
        "org_id": "org-vendor",
        "role": "super_admin",
        "is_platform_admin": True,
        "email": "vendor@example.com",
    }


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(feature_flags_router)
    return TestClient(app, raise_server_exceptions=False)


class TestFeatureFlagsTenantWriteGate:
    def test_tenant_admin_post_returns_403(self, client):
        app = client.app
        app.dependency_overrides[get_current_user] = _tenant_admin
        response = client.post(
            "/api/feature-flags/test_flag",
            json={"enabled": True, "rollout_pct": 100},
        )
        assert response.status_code == 403

    def test_platform_admin_post_allowed(self, client):
        app = client.app
        app.dependency_overrides[get_current_user] = _platform_admin
        with patch("app.api.feature_flags._ff.set_flag") as mock_set:
            mock_set.return_value = {
                "key": "test_flag",
                "enabled": True,
                "rollout_pct": 100,
                "description": "",
                "org_id": "org-vendor",
            }
            with patch("app.api.feature_flags._ff.is_enabled", return_value=True):
                response = client.post(
                    "/api/feature-flags/test_flag",
                    json={"enabled": True, "rollout_pct": 50},
                )
        assert response.status_code == 200
        mock_set.assert_called_once()
