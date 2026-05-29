"""Quick-create: POST/GET /api/subscription-plans (R2.7) — alias of subscriptions/plans."""
from unittest.mock import patch

from app.api.quick_create import subscription_plans_router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.quick_create.SubscriptionPlanRepository"


def test_create_returns_201():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/subscription-plans",
            json={"name": "Gold", "billing_period": "monthly", "price": 25000, "currency": "IQD"},
        )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Gold"
    assert body["price"] == 25000.0
    assert res.headers["Location"].startswith("/api/subscription-plans/")


def test_negative_price_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post(
            "/api/subscription-plans",
            json={"name": "Gold", "billing_period": "monthly", "price": -1},
        )
    assert res.status_code == 422


def test_missing_price_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post(
            "/api/subscription-plans", json={"name": "Gold", "billing_period": "monthly"}
        )
    assert res.status_code == 422


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post(
            "/api/subscription-plans",
            json={"name": "Gold", "billing_period": "monthly", "price": 1},
        )
    assert res.status_code == 403
