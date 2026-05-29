"""Iraqi tenant recurring-billing rail (FastPay business or manual invoice).

Stripe does not operate in Iraq, so for ``country == IQ`` tenants we issue a
monthly invoice (PDF link sent via WhatsApp + email), the tenant pays via
FastPay/Zain Cash/Qi/bank, and a Super-Admin marks the invoice as paid.

State machine for one billing period::

    issued ──► reminded ──► paid                 (happy path)
            └► reminded ──► past_due ──► suspended  (delinquency)

Functions in this module are intentionally pure — they take a current
``BillingPeriod`` dict and return the next state. Side effects (Firestore
writes, WhatsApp send, audit log) happen in the API layer or scheduled job
that calls them.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional

from app.billing.plans import Plan, get_plan

# Public state values. Mirrored on the frontend in TenantBilling.tsx.
PERIOD_STATES = (
    "issued",       # invoice created, awaiting payment.
    "reminded",     # >= 1 reminder sent.
    "paid",         # tenant has paid (manual mark or FastPay webhook).
    "past_due",     # >= 7 days unpaid after issue date.
    "suspended",    # >= grace period expired — tenant access restricted.
    "void",         # admin voided this period (no charge).
)

PeriodState = Literal[
    "issued", "reminded", "paid", "past_due", "suspended", "void",
]

# 7 days from issue → past_due; 7 more days → suspended.
PAST_DUE_DAYS = 7
GRACE_DAYS = 7


@dataclass
class BillingPeriod:
    """One monthly cycle of the Iraqi rail.

    Persisted at ``tenants/{tid}/billing_periods/{period_id}``.
    """

    period_id: str
    tenant_id: str
    plan_slug: str
    amount_iqd: int
    currency: str = "IQD"
    cycle: str = "monthly"
    state: PeriodState = "issued"
    issued_at: datetime = field(default_factory=datetime.utcnow)
    due_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    suspended_at: Optional[datetime] = None
    payment_reference: Optional[str] = None         # FastPay transaction id, slip #, etc.
    payment_provider: Optional[str] = None          # 'fastpay'|'zain_cash'|'qi'|'cash'|'bank'
    reminders_sent: List[Dict[str, Any]] = field(default_factory=list)
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "period_id": self.period_id,
            "tenant_id": self.tenant_id,
            "plan_slug": self.plan_slug,
            "amount_iqd": self.amount_iqd,
            "currency": self.currency,
            "cycle": self.cycle,
            "state": self.state,
            "issued_at": self.issued_at.isoformat(),
            "due_at": self.due_at.isoformat() if self.due_at else None,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "suspended_at": (
                self.suspended_at.isoformat() if self.suspended_at else None
            ),
            "payment_reference": self.payment_reference,
            "payment_provider": self.payment_provider,
            "reminders_sent": list(self.reminders_sent),
            "notes": self.notes,
        }


def _gen_period_id(tenant_id: str, now: datetime) -> str:
    return f"{tenant_id}_{now:%Y%m}_{secrets.token_hex(3)}"


# ── State transitions ───────────────────────────────────────────────────

def issue_period(*, tenant_id: str, plan_slug: str,
                 now: Optional[datetime] = None) -> BillingPeriod:
    """Create a fresh billing period in ``issued`` state."""
    plan = get_plan(plan_slug)
    now = now or datetime.utcnow()
    period = BillingPeriod(
        period_id=_gen_period_id(tenant_id, now),
        tenant_id=tenant_id,
        plan_slug=plan_slug,
        amount_iqd=int(plan.price(currency="IQD", cycle="monthly")),
        issued_at=now,
        due_at=now + timedelta(days=PAST_DUE_DAYS),
    )
    return period


def record_reminder(period: BillingPeriod, *, channel: str,
                    now: Optional[datetime] = None) -> BillingPeriod:
    """Append a reminder send event. Flips ``issued -> reminded``."""
    if period.state not in {"issued", "reminded", "past_due"}:
        raise ValueError(
            f"cannot remind on period in state {period.state!r}"
        )
    now = now or datetime.utcnow()
    period.reminders_sent.append({"channel": channel, "at": now.isoformat()})
    if period.state == "issued":
        period.state = "reminded"
    return period


def mark_paid(period: BillingPeriod, *,
              provider: str, reference: str,
              now: Optional[datetime] = None) -> BillingPeriod:
    """Mark the period paid. Allowed from any non-final state except ``void``."""
    if period.state in {"paid", "void"}:
        raise ValueError(f"period already {period.state!r}")
    period.state = "paid"
    period.paid_at = now or datetime.utcnow()
    period.payment_provider = provider
    period.payment_reference = reference
    return period


def advance_to_past_due(period: BillingPeriod,
                        now: Optional[datetime] = None
                        ) -> BillingPeriod:
    """Promote ``issued/reminded`` → ``past_due`` if grace window passed."""
    now = now or datetime.utcnow()
    if period.state not in {"issued", "reminded"}:
        return period
    if (now - period.issued_at) >= timedelta(days=PAST_DUE_DAYS):
        period.state = "past_due"
    return period


def advance_to_suspended(period: BillingPeriod,
                         now: Optional[datetime] = None
                         ) -> BillingPeriod:
    """Promote ``past_due`` → ``suspended`` after the grace window."""
    now = now or datetime.utcnow()
    if period.state != "past_due":
        return period
    if (now - period.issued_at) >= timedelta(days=PAST_DUE_DAYS + GRACE_DAYS):
        period.state = "suspended"
        period.suspended_at = now
    return period


def void_period(period: BillingPeriod, *, reason: str
                ) -> BillingPeriod:
    """Admin override — wipe out the charge (e.g. duplicate, comp month)."""
    if period.state == "paid":
        raise ValueError("cannot void a paid period; issue a refund instead")
    period.state = "void"
    period.notes = (period.notes + f"\nVoid: {reason}").strip()
    return period


# ── Whole-cycle convenience for the scheduler ───────────────────────────

def tick(period: BillingPeriod, now: Optional[datetime] = None) -> BillingPeriod:
    """Run all time-based transitions appropriate for ``now``.

    Idempotent — calling repeatedly produces the same final state.
    """
    period = advance_to_past_due(period, now)
    period = advance_to_suspended(period, now)
    return period


# ── Generate WhatsApp/email content (stubs that return a payload) ───────

def render_invoice_payload(period: BillingPeriod, *,
                           plan: Optional[Plan] = None,
                           pay_url: str = "") -> Dict[str, Any]:
    """Return a renderer-agnostic dict the WhatsApp/email module can format."""
    plan = plan or get_plan(period.plan_slug)
    return {
        "tenant_id": period.tenant_id,
        "period_id": period.period_id,
        "plan_name_ku": plan.name_ku,
        "amount_iqd": period.amount_iqd,
        "due_at": period.due_at.isoformat() if period.due_at else None,
        "pay_url": pay_url,
    }
