"""Stripe Subscriptions adapter for international SaaS billing.

Scope: tenants whose billing country is NOT Iraq use Stripe Subscriptions.
Iraqi tenants use ``fastpay_recurring`` instead (Stripe does not operate in
Iraq).

This module is import-safe even if ``stripe`` isn't installed or
``STRIPE_SECRET_KEY`` isn't configured — we lazy-import the SDK inside each
function and raise a clear ``StripeNotConfigured`` error if the call is
attempted without credentials. That lets tests stub the helpers and prevents
the absent SDK from blocking module load during boot.

All Stripe IDs we hold are persisted on the ``TenantBilling`` doc; nothing in
this module touches Firestore directly — callers compose the two.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.billing.plans import (
    Plan,
    get_plan,
    to_stripe_amount,
)

logger = logging.getLogger(__name__)

# Webhook events we react to. Anything outside this set is ignored with a 200.
SUPPORTED_EVENTS = frozenset({
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "invoice.finalized",
})


class StripeNotConfigured(RuntimeError):
    """Raised when a Stripe call is attempted without ``STRIPE_SECRET_KEY``."""


class StripeBillingError(RuntimeError):
    """Wraps any Stripe SDK error so callers can present a friendly message."""


@dataclass(frozen=True)
class StripePriceMap:
    """Resolved Stripe price IDs for one plan."""

    plan_slug: str
    prices: Dict[str, str]  # ``"usd_monthly" -> "price_…"`` etc.

    def get(self, *, currency: str, cycle: str) -> str:
        key = f"{currency.lower()}_{cycle.lower()}"
        if key not in self.prices:
            raise KeyError(f"no stripe price for {self.plan_slug}/{key}")
        return self.prices[key]


# ── SDK bootstrap ────────────────────────────────────────────────────────

def _require_stripe():
    """Import & configure the Stripe SDK; raise if env is missing."""
    key = os.getenv("STRIPE_SECRET_KEY")
    if not key:
        raise StripeNotConfigured(
            "STRIPE_SECRET_KEY is not set — international SaaS billing is "
            "disabled until Safa completes Stripe entity setup (R7.7)."
        )
    try:
        import stripe  # noqa: WPS433 — lazy import is intentional.
    except ImportError as exc:  # pragma: no cover - import guard.
        raise StripeNotConfigured(
            "The `stripe` package is not installed. Add it to "
            "backend/requirements.txt once R7.7 is unblocked."
        ) from exc
    stripe.api_key = key
    return stripe


def _wrap_errors(fn):
    """Decorator that converts Stripe SDK errors into ``StripeBillingError``."""

    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except StripeNotConfigured:
            raise
        except Exception as exc:  # noqa: BLE001 - stripe.error.* is broad.
            raise StripeBillingError(str(exc)) from exc

    wrapper.__name__ = fn.__name__
    return wrapper


# ── Customer + Subscription lifecycle ────────────────────────────────────

@_wrap_errors
def create_customer(*, tenant_id: str, email: str, name: str,
                    metadata: Optional[Dict[str, str]] = None) -> str:
    """Create a Stripe Customer and return its id."""
    stripe = _require_stripe()
    meta = {"tenant_id": tenant_id, **(metadata or {})}
    obj = stripe.Customer.create(email=email, name=name, metadata=meta)
    return obj["id"]


@_wrap_errors
def create_subscription(*, stripe_customer_id: str, price_id: str,
                        trial_end_unix: Optional[int] = None,
                        coupon: Optional[str] = None) -> Dict[str, Any]:
    """Create a Subscription and return the raw Stripe response.

    Caller persists ``id``, ``current_period_start/end``, ``status`` to the
    TenantBilling doc.
    """
    stripe = _require_stripe()
    params: Dict[str, Any] = {
        "customer": stripe_customer_id,
        "items": [{"price": price_id}],
        "payment_behavior": "default_incomplete",
        "payment_settings": {"save_default_payment_method": "on_subscription"},
        "expand": ["latest_invoice.payment_intent"],
    }
    if trial_end_unix:
        params["trial_end"] = trial_end_unix
    if coupon:
        params["coupon"] = coupon
    return stripe.Subscription.create(**params)


@_wrap_errors
def update_subscription_plan(*, subscription_id: str,
                             new_price_id: str,
                             proration_behavior: str = "create_prorations"
                             ) -> Dict[str, Any]:
    """Upgrade/downgrade an existing subscription with proration.

    ``proration_behavior`` is one of: ``create_prorations`` (default — credit
    the unused portion of the old plan), ``none``, ``always_invoice``.
    """
    stripe = _require_stripe()
    sub = stripe.Subscription.retrieve(subscription_id)
    item_id = sub["items"]["data"][0]["id"]
    return stripe.Subscription.modify(
        subscription_id,
        items=[{"id": item_id, "price": new_price_id}],
        proration_behavior=proration_behavior,
        cancel_at_period_end=False,
    )


@_wrap_errors
def preview_proration(*, subscription_id: str, new_price_id: str
                      ) -> Dict[str, Any]:
    """Return an upcoming-invoice preview showing the proration amount.

    Used by the change-plan modal to display the immediate charge/credit
    before the tenant confirms.
    """
    stripe = _require_stripe()
    sub = stripe.Subscription.retrieve(subscription_id)
    item_id = sub["items"]["data"][0]["id"]
    return stripe.Invoice.upcoming(
        customer=sub["customer"],
        subscription=subscription_id,
        subscription_items=[{"id": item_id, "price": new_price_id}],
        subscription_proration_behavior="create_prorations",
    )


@_wrap_errors
def cancel_subscription(*, subscription_id: str,
                        at_period_end: bool = True) -> Dict[str, Any]:
    """Cancel a subscription immediately or schedule for period end."""
    stripe = _require_stripe()
    if at_period_end:
        return stripe.Subscription.modify(
            subscription_id, cancel_at_period_end=True,
        )
    return stripe.Subscription.delete(subscription_id)


@_wrap_errors
def reactivate_subscription(*, subscription_id: str) -> Dict[str, Any]:
    """Undo a scheduled cancellation (only works before period_end)."""
    stripe = _require_stripe()
    return stripe.Subscription.modify(
        subscription_id, cancel_at_period_end=False,
    )


@_wrap_errors
def list_invoices(*, stripe_customer_id: str, limit: int = 24
                  ) -> List[Dict[str, Any]]:
    stripe = _require_stripe()
    res = stripe.Invoice.list(customer=stripe_customer_id, limit=limit)
    return list(res.get("data", []))


@_wrap_errors
def create_billing_portal_session(*, stripe_customer_id: str,
                                  return_url: str) -> str:
    """Hosted portal URL the tenant can use to manage card + invoices."""
    stripe = _require_stripe()
    sess = stripe.billing_portal.Session.create(
        customer=stripe_customer_id, return_url=return_url,
    )
    return sess["url"]


# ── Webhook signature verification ───────────────────────────────────────

@_wrap_errors
def verify_webhook(*, payload: bytes, sig_header: str) -> Dict[str, Any]:
    """Verify a Stripe webhook signature and return the parsed event.

    Raises ``StripeBillingError`` on invalid signature; caller returns 400.
    """
    stripe = _require_stripe()
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise StripeNotConfigured("STRIPE_WEBHOOK_SECRET is not set.")
    return stripe.Webhook.construct_event(payload, sig_header, secret)


# ── Price lookup helpers ─────────────────────────────────────────────────

def load_price_map() -> Dict[str, StripePriceMap]:
    """Read the audit/stripe-prices.json output from the bootstrap script.

    Returns ``{}`` if the file doesn't exist yet (Stripe not bootstrapped).
    """
    import json
    from pathlib import Path

    path = Path("audit/stripe-prices.json")
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        logger.exception("Failed to parse audit/stripe-prices.json")
        return {}
    return {
        slug: StripePriceMap(plan_slug=slug, prices=prices)
        for slug, prices in raw.items()
    }


def derive_amount_for_plan(plan: Plan | str, *, currency: str, cycle: str
                           ) -> int:
    """Smallest-unit integer for a plan/currency/cycle.

    Useful for the Iraqi recurring flow (which doesn't go through Stripe) so
    the same authoritative price comes from one place.
    """
    if isinstance(plan, str):
        plan = get_plan(plan)
    price: Decimal | int = plan.price(currency=currency, cycle=cycle)
    return to_stripe_amount(price, currency)
