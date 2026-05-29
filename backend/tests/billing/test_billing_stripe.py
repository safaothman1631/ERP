"""Tests for the Stripe adapter (launch-readiness § R5.2).

We don't run real Stripe calls — instead we patch ``_require_stripe`` to
return a MagicMock and assert our adapter calls the right SDK methods with
the right arguments.
"""
import os
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.billing import stripe as adapter


def _fake_stripe():
    """Build a MagicMock that mimics the parts of stripe-python we touch."""
    fake = MagicMock()
    fake.Customer.create.return_value = {"id": "cus_123"}
    fake.Subscription.create.return_value = {
        "id": "sub_123",
        "status": "active",
        "current_period_start": 1700000000,
        "current_period_end": 1702592000,
    }
    fake.Subscription.retrieve.return_value = {
        "id": "sub_123",
        "customer": "cus_123",
        "items": {"data": [{"id": "si_123"}]},
    }
    fake.Subscription.modify.return_value = {"id": "sub_123"}
    fake.Subscription.delete.return_value = {"id": "sub_123", "status": "canceled"}
    fake.Invoice.list.return_value = {"data": []}
    fake.Invoice.upcoming.return_value = {"amount_due": 1500, "total": 6000}
    fake.billing_portal.Session.create.return_value = {"url": "https://stripe.test/portal"}
    fake.Webhook.construct_event.return_value = {"type": "ping", "data": {"object": {}}}
    return fake


def test_create_customer_calls_sdk_with_metadata():
    fake = _fake_stripe()
    with patch.object(adapter, "_require_stripe", return_value=fake):
        cid = adapter.create_customer(
            tenant_id="tenant-1", email="a@b.c", name="Acme",
        )
    assert cid == "cus_123"
    args = fake.Customer.create.call_args.kwargs
    assert args["email"] == "a@b.c"
    assert args["metadata"]["tenant_id"] == "tenant-1"


def test_create_subscription_attaches_trial_end():
    fake = _fake_stripe()
    with patch.object(adapter, "_require_stripe", return_value=fake):
        sub = adapter.create_subscription(
            stripe_customer_id="cus_123",
            price_id="price_x",
            trial_end_unix=1700000999,
        )
    assert sub["id"] == "sub_123"
    args = fake.Subscription.create.call_args.kwargs
    assert args["customer"] == "cus_123"
    assert args["trial_end"] == 1700000999


def test_update_subscription_plan_keeps_item_id():
    fake = _fake_stripe()
    with patch.object(adapter, "_require_stripe", return_value=fake):
        adapter.update_subscription_plan(
            subscription_id="sub_123",
            new_price_id="price_growth_usd_monthly",
        )
    args = fake.Subscription.modify.call_args.kwargs
    assert args["items"][0]["id"] == "si_123"
    assert args["items"][0]["price"] == "price_growth_usd_monthly"
    assert args["proration_behavior"] == "create_prorations"


def test_cancel_subscription_period_end_uses_modify_not_delete():
    fake = _fake_stripe()
    with patch.object(adapter, "_require_stripe", return_value=fake):
        adapter.cancel_subscription(
            subscription_id="sub_123", at_period_end=True,
        )
    fake.Subscription.modify.assert_called_once()
    fake.Subscription.delete.assert_not_called()


def test_cancel_subscription_immediate_uses_delete():
    fake = _fake_stripe()
    with patch.object(adapter, "_require_stripe", return_value=fake):
        adapter.cancel_subscription(
            subscription_id="sub_123", at_period_end=False,
        )
    fake.Subscription.delete.assert_called_once_with("sub_123")


def test_no_stripe_key_raises_not_configured():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(adapter.StripeNotConfigured):
            adapter.create_customer(tenant_id="t", email="a", name="b")


def test_verify_webhook_requires_secret(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    with patch.object(adapter, "_require_stripe", return_value=_fake_stripe()):
        with pytest.raises(adapter.StripeNotConfigured):
            adapter.verify_webhook(payload=b"{}", sig_header="t=1,v1=abc")


def test_derive_amount_for_plan_uses_iqd_passthrough():
    amt = adapter.derive_amount_for_plan("starter", currency="IQD", cycle="monthly")
    assert amt == 30_000


def test_derive_amount_for_plan_converts_usd_to_cents():
    amt = adapter.derive_amount_for_plan("starter", currency="USD", cycle="monthly")
    assert amt == 2500
