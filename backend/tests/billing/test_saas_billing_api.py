"""Tests for the tenant-facing SaaS billing endpoints (R5.4/5.6)."""
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.saas_billing import router as ROUTER
from app.services.auth import get_current_user


def _user() -> dict:
    return {
        "id": "u-1", "org_id": "tenant-1",
        "email": "a@b.c", "name": "A",
        "role": "admin", "is_active": True,
    }


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(ROUTER)
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


def _sample_state() -> dict:
    return {
        "tenant_id": "tenant-1",
        "plan_slug": "starter",
        "billing_cycle": "monthly",
        "currency": "IQD",
        "status": "trialing",
        "trial_ends_at": datetime.utcnow() + timedelta(days=30),
        "current_period_start": datetime.utcnow(),
        "current_period_end": datetime.utcnow() + timedelta(days=30),
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "payment_method_type": None,
        "last_payment_at": None,
        "dunning_step": 0,
    }


def test_get_plans_is_publicly_accessible():
    res = _client().get("/api/saas-billing/plans")
    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 3
    assert body["trial_days"] == 90


def test_get_state_initializes_when_missing():
    with patch("app.api.saas_billing.TenantBillingRepository") as cls:
        repo = cls.return_value
        repo.get.return_value = None
        repo.initialize_for_trial.return_value = _sample_state()
        res = _client().get("/api/saas-billing/state")
    assert res.status_code == 200
    body = res.json()
    assert body["plan_slug"] == "starter"
    assert body["status"] == "trialing"


def test_change_plan_preview_does_not_persist():
    with patch("app.api.saas_billing.TenantBillingRepository") as cls:
        repo = cls.return_value
        repo.get.return_value = _sample_state()
        res = _client().post(
            "/api/saas-billing/change-plan",
            json={"to_plan": "growth", "billing_cycle": "monthly",
                  "currency": "IQD", "confirm": False},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["applied"] is False
    assert body["preview"]["amount_due_now"] == 80_000


def test_change_plan_unknown_plan_returns_400():
    with patch("app.api.saas_billing.TenantBillingRepository") as cls:
        cls.return_value.get.return_value = _sample_state()
        res = _client().post(
            "/api/saas-billing/change-plan",
            json={"to_plan": "enterprise++", "confirm": False},
        )
    assert res.status_code == 400


def test_change_plan_confirm_applies_update():
    with patch("app.api.saas_billing.TenantBillingRepository") as cls:
        repo = cls.return_value
        repo.get.return_value = _sample_state()
        new_state = {**_sample_state(), "plan_slug": "growth"}
        repo.update.return_value = new_state
        res = _client().post(
            "/api/saas-billing/change-plan",
            json={"to_plan": "growth", "billing_cycle": "monthly",
                  "currency": "IQD", "confirm": True},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["applied"] is True
    assert body["new_state"]["plan_slug"] == "growth"


def test_cancel_calls_repo_cancel():
    with patch("app.api.saas_billing.TenantBillingRepository") as cls:
        repo = cls.return_value
        repo.get.return_value = _sample_state()
        repo.cancel.return_value = {
            **_sample_state(),
            "status": "active",
            "cancel_at_period_end": True,
            "cancellation_reason": "too expensive",
        }
        res = _client().post(
            "/api/saas-billing/cancel",
            json={"at": "period_end", "reason": "too expensive"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["cancel_at_period_end"] is True


def test_invoices_empty_when_no_stripe_customer():
    with patch("app.api.saas_billing.TenantBillingRepository") as cls:
        cls.return_value.get.return_value = _sample_state()
        res = _client().get("/api/saas-billing/invoices")
    assert res.status_code == 200
    assert res.json()["total"] == 0


def test_webhook_bad_signature_returns_400():
    with patch("app.api.saas_billing.stripe_billing") as sb:
        sb.StripeNotConfigured = type("X", (Exception,), {})
        sb.StripeBillingError = type("Y", (Exception,), {})
        sb.verify_webhook.side_effect = sb.StripeBillingError("bad sig")
        res = _client().post(
            "/api/saas-billing/webhooks/stripe", content=b"{}",
            headers={"Stripe-Signature": "junk"},
        )
    assert res.status_code == 400


def test_webhook_ignores_unsupported_event():
    with patch("app.api.saas_billing.stripe_billing") as sb:
        sb.StripeNotConfigured = type("X", (Exception,), {})
        sb.StripeBillingError = type("Y", (Exception,), {})
        sb.SUPPORTED_EVENTS = frozenset({"invoice.payment_succeeded"})
        sb.verify_webhook.return_value = {
            "type": "ping.unrelated",
            "data": {"object": {"customer": "cus_1", "metadata": {"tenant_id": "tenant-1"}}},
        }
        res = _client().post(
            "/api/saas-billing/webhooks/stripe", content=b"{}",
            headers={"Stripe-Signature": "t=1"},
        )
    assert res.status_code == 200
    assert res.json().get("ignored") == "ping.unrelated"
