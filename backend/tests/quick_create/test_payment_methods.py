"""Quick-create: POST/GET /api/payment-methods (R2.13).

Covers the ``requires_gateway_config`` flag and the single-default invariant.
"""
from unittest.mock import patch

from app.api.quick_create import payment_methods_router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.quick_create.PaymentMethodRepository"


def test_cash_method_does_not_require_gateway():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/payment-methods", json={"name": "Cash drawer", "type": "cash"}
        )
    assert res.status_code == 201
    assert res.json()["requires_gateway_config"] is False


def test_fastpay_method_requires_gateway():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/payment-methods", json={"name": "FastPay", "type": "fastpay"}
        )
    assert res.status_code == 201
    assert res.json()["requires_gateway_config"] is True


def test_setting_default_demotes_previous_default():
    prev = {"id": "pm-old", "is_default": True}
    with patch(REPO) as cls:
        repo = cls.return_value
        repo.list.return_value = ([prev], 1)
        repo.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/payment-methods",
            json={"name": "Default cash", "type": "cash", "is_default": True},
        )
        repo.update.assert_called_once_with("pm-old", {"is_default": False})
    assert res.status_code == 201


def test_missing_name_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post("/api/payment-methods", json={"type": "cash"})
    assert res.status_code == 422


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post(
            "/api/payment-methods", json={"name": "Cash", "type": "cash"}
        )
    assert res.status_code == 403
