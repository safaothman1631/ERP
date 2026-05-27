"""Smoke tests for /api/v1/ resource expansion (Phase 3)."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _mock_user() -> dict:
    return {
        "id": "user-1",
        "email": "test@example.com",
        "name": "Test User",
        "org_id": "org-1",
        "role": "admin",
        "is_active": True,
    }


@pytest.fixture()
def v1_client():
    from app.api.v1.router import v1_router
    from app.services.auth import get_current_user

    app = FastAPI()
    app.include_router(v1_router)
    app.dependency_overrides[get_current_user] = _mock_user
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestV1RouterImports:
    def test_v1_router_registers_phase3_resources(self):
        from app.api.v1.router import v1_router

        paths = {getattr(r, "path", "") for r in v1_router.routes}
        assert "/api/v1/bills" in paths
        assert "/api/v1/purchase-orders" in paths
        assert "/api/v1/sales-orders" in paths
        assert "/api/v1/payments" in paths


class TestV1ResourceLists:
    @pytest.mark.parametrize(
        "path,repo_path",
        [
            ("/api/v1/bills", "app.api.v1.bills.BillRepository"),
            ("/api/v1/purchase-orders", "app.api.v1.purchase_orders.PurchaseOrderRepository"),
            ("/api/v1/sales-orders", "app.api.v1.sales_orders.SalesOrderRepository"),
            ("/api/v1/payments", "app.api.v1.payments.PaymentReceivedRepository"),
        ],
    )
    def test_list_returns_200(self, v1_client, path, repo_path):
        repo_cls = repo_path.rsplit(".", 1)
        module_path, class_name = ".".join(repo_cls[:-1]), repo_cls[-1]
        with patch(f"{module_path}.{class_name}") as mock_repo_cls:
            mock_repo = MagicMock()
            mock_repo.list.return_value = ([], 0)
            mock_repo_cls.return_value = mock_repo
            res = v1_client.get(path)
        assert res.status_code == 200
        body = res.json()
        assert "items" in body
        assert body["total"] == 0
