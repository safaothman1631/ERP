"""Platform reconcile API."""
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.platform.health import router as health_router


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(health_router, prefix="/api/platform")
    from app.api.platform._guards import require_platform_admin

    app.dependency_overrides[require_platform_admin] = lambda: {
        "id": "admin-1",
        "org_id": "platform-org",
        "role": "super_admin",
    }
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


def test_reconcile_preview(client):
    summary = {
        "org_id": "org-demo",
        "drift_count": 0,
        "fixed": False,
        "reconciled_only": False,
        "drifts": [],
    }
    with patch(
        "app.api.platform.health.run_reconcile_for_org",
        return_value=summary,
    ):
        res = client.get("/api/platform/health/reconcile", params={"org_id": "org-demo"})
    assert res.status_code == 200
    assert res.json()["drift_count"] == 0
