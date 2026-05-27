"""HTTP integration tests for shopkeeper production paths."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.pos import router as pos_router
from app.services.auth import get_current_user


def _user():
    return {
        "id": "user-1",
        "org_id": "org-1",
        "email": "admin@test.com",
        "name": "Admin",
        "role": "admin",
    }


@pytest.fixture
def pos_client():
    with (
        patch("app.services.module_gate.is_module_enabled", return_value=True),
        patch("app.services.module_gate.is_license_valid", return_value=True),
    ):
        app = FastAPI()
        app.include_router(pos_router)
        app.dependency_overrides[get_current_user] = _user
        yield TestClient(app, raise_server_exceptions=False)


class TestPosPayGuard:
    @patch("app.api.pos.POSPaymentRepository")
    @patch("app.api.pos.POSPaymentMethodRepository")
    @patch("app.api.pos.POSOrderRepository")
    def test_pay_rejects_already_paid(self, mock_order_cls, _pm_cls, _pay_cls, pos_client):
        mock_order_cls.return_value.get.return_value = {
            "id": "o1",
            "state": "paid",
            "total": 1000,
            "session_id": "s1",
        }
        res = pos_client.post(
            "/api/pos/orders/o1/pay",
            json={"payments": [{"payment_method_id": "cash", "amount": 1000}]},
        )
        assert res.status_code == 409
        assert res.json()["detail"]["code"] == "already_paid"


class TestPurchaseReceiveGrn:
    @pytest.fixture
    def po_client(self):
        from app.api.purchase_orders import router as po_router

        with (
            patch("app.services.module_gate.is_module_enabled", return_value=True),
            patch("app.services.module_gate.is_license_valid", return_value=True),
        ):
            app = FastAPI()
            app.include_router(po_router)
            app.dependency_overrides[get_current_user] = _user
            yield TestClient(app, raise_server_exceptions=False)

    @patch("app.api.purchase_orders.PURCHASE_ORDER_SM")
    @patch("app.services.settings_service.get_purchases_settings")
    @patch("app.api.purchase_orders.PurchaseOrderRepository")
    def test_receive_without_grn_blocked(self, mock_repo_cls, mock_settings, mock_sm, po_client):
        mock_sm.transition.side_effect = lambda po, state: po.update({"status": state})
        mock_settings.return_value = {"require_grn": True}
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.get.return_value = {
            "id": "po1",
            "org_id": "org-1",
            "status": "confirmed",
            "lines": [{"qty": 10}],
            "goods_receipts": [],
        }

        res = po_client.post("/api/purchase-orders/po1/receive", json={})
        assert res.status_code == 422
        assert res.json()["detail"]["code"] == "grn_required"
