"""Firestore repository for the TenantBilling state document.

There is exactly **one** ``TenantBilling`` document per tenant, stored at
``tenants/{tenant_id}/billing/state`` (note: not under the org_id-scoped
``BaseRepository`` collection — this is platform-side data, not tenant-owned).

The document captures everything the SaaS-billing UI and the dunning engine
need to make decisions without round-tripping Stripe:

  * plan_slug, billing_cycle  (monthly/annual)
  * status   (trialing|active|past_due|suspended|cancelled)
  * current_period_start/end (server-tracked, sourced from Stripe when present)
  * trial_ends_at
  * stripe_customer_id, stripe_subscription_id
  * payment_method_type   ('card'|'fastpay'|'manual')
  * last_payment_at
  * dunning_step          (int 0–5; see dunning.STEPS)
  * cancellation_reason   (free text, optional)

We deliberately do not extend ``BaseRepository`` because the access pattern is
"one doc per tenant, read often, write rarely" — direct Firestore calls keep
the contract explicit. Tenancy is enforced by always passing ``tenant_id``.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from app.firebase_client import get_db
from app.billing.plans import DEFAULT_TRIAL_DAYS

logger = logging.getLogger(__name__)

VALID_STATUSES = {
    "trialing", "active", "past_due", "suspended", "cancelled", "incomplete",
}

VALID_PAYMENT_METHODS = {
    "card",            # Stripe-managed card.
    "fastpay",         # Iraqi FastPay business.
    "zain_cash",       # Iraqi Zain Cash.
    "qi",              # Iraqi Qi Card.
    "bank_transfer",   # Manual confirmation.
    "cash",            # In-person.
    "manual",          # Unspecified manual.
    None,              # Not yet configured (during trial).
}


def _now() -> datetime:
    return datetime.utcnow()


class TenantBillingRepository:
    """Tiny repo around ``tenants/{tid}/billing/state``."""

    def __init__(self, tenant_id: str):
        if not tenant_id:
            raise ValueError("tenant_id is required")
        self.tenant_id = tenant_id
        self._db = get_db()

    # ── Doc ref ─────────────────────────────────────────────────────────
    def _doc_ref(self):
        return (
            self._db
            .collection("tenants").document(self.tenant_id)
            .collection("billing").document("state")
        )

    # ── Read ────────────────────────────────────────────────────────────
    def get(self) -> Optional[Dict[str, Any]]:
        snap = self._doc_ref().get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        return {"tenant_id": self.tenant_id, **data}

    # ── Create / upsert ─────────────────────────────────────────────────
    def initialize_for_trial(self, *, plan_slug: str = "starter",
                             trial_days: int = DEFAULT_TRIAL_DAYS,
                             signup_at: Optional[datetime] = None
                             ) -> Dict[str, Any]:
        """Create the initial state for a freshly-signed-up tenant."""
        signup_at = signup_at or _now()
        trial_ends_at = signup_at + timedelta(days=trial_days)
        payload: Dict[str, Any] = {
            "plan_slug": plan_slug,
            "billing_cycle": "monthly",
            "currency": "IQD",
            "status": "trialing",
            "trial_ends_at": trial_ends_at,
            "current_period_start": signup_at,
            "current_period_end": trial_ends_at,
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "payment_method_type": None,
            "last_payment_at": None,
            "dunning_step": 0,
            "cancellation_reason": None,
            "created_at": signup_at,
            "updated_at": signup_at,
        }
        self._doc_ref().set(payload)
        return {"tenant_id": self.tenant_id, **payload}

    # ── Targeted updates ────────────────────────────────────────────────
    def update(self, patch: Dict[str, Any]) -> Dict[str, Any]:
        """Apply a partial patch; validates ``status``/``payment_method_type``."""
        if "status" in patch and patch["status"] not in VALID_STATUSES:
            raise ValueError(f"unknown status: {patch['status']!r}")
        if ("payment_method_type" in patch
                and patch["payment_method_type"] not in VALID_PAYMENT_METHODS):
            raise ValueError(
                f"unknown payment_method_type: {patch['payment_method_type']!r}"
            )
        patch = {**patch, "updated_at": _now()}
        self._doc_ref().update(patch)
        return self.get() or {}

    # ── Convenience transitions ─────────────────────────────────────────
    def set_status(self, status: str) -> Dict[str, Any]:
        return self.update({"status": status})

    def set_dunning_step(self, step: int) -> Dict[str, Any]:
        return self.update({"dunning_step": int(step)})

    def attach_stripe_ids(self, *, customer_id: str,
                          subscription_id: Optional[str] = None
                          ) -> Dict[str, Any]:
        patch: Dict[str, Any] = {"stripe_customer_id": customer_id}
        if subscription_id is not None:
            patch["stripe_subscription_id"] = subscription_id
        return self.update(patch)

    def record_payment(self, *, paid_at: Optional[datetime] = None,
                       new_period_start: Optional[datetime] = None,
                       new_period_end: Optional[datetime] = None,
                       payment_method_type: Optional[str] = None
                       ) -> Dict[str, Any]:
        patch: Dict[str, Any] = {
            "last_payment_at": paid_at or _now(),
            "status": "active",
            "dunning_step": 0,
        }
        if new_period_start:
            patch["current_period_start"] = new_period_start
        if new_period_end:
            patch["current_period_end"] = new_period_end
        if payment_method_type:
            patch["payment_method_type"] = payment_method_type
        return self.update(patch)

    def cancel(self, *, reason: str = "", at_period_end: bool = True
               ) -> Dict[str, Any]:
        return self.update({
            "status": "cancelled" if not at_period_end else "active",
            "cancellation_reason": reason,
            "cancel_at_period_end": at_period_end,
        })


# ── Aggregate admin queries ─────────────────────────────────────────────

class SaasBillingAdminRepository:
    """Read-only queries used by the Super-Admin dashboard."""

    def __init__(self):
        self._db = get_db()

    def iter_states(self):
        """Yield every TenantBilling doc across all tenants.

        Uses Firestore's ``collection_group`` index on the ``billing`` group.
        Callers expect this to be paged in production — small SaaS tenant
        counts (< 10k) make scanning acceptable.
        """
        try:
            cg = self._db.collection_group("billing")
            for snap in cg.stream():
                if snap.id != "state":
                    continue
                data = snap.to_dict() or {}
                # parent.parent walks billing/state -> tenants/{tid}.
                tenant_doc = snap.reference.parent.parent
                tenant_id = tenant_doc.id if tenant_doc else None
                yield {"tenant_id": tenant_id, **data}
        except Exception:  # pragma: no cover - falls back when index missing
            logger.exception("collection_group(billing) failed; returning none")
            return
