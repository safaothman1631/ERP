"""Dunning engine — the past-due reminder + suspension sequence.

Shared by both the Stripe rail (international) and the FastPay rail (Iraqi).
Stripe's own smart-retry handles the first 3 card retries; this engine layers
*tenant-facing* communication and *platform-side* access restrictions on top.

The sequence, day-counted from the original invoice issue date::

    Day  0 : invoice issued; baseline banner in-app
    Day  3 : first reminder      (email + in-app banner)
    Day  7 : second reminder + warning (banner becomes amber)
    Day 14 : final notice, service restriction begins (read-only)
    Day 30 : suspension — login redirects to billing page
    Day 60 : archive — tenant scheduled for hard deletion (admin override)

The engine itself is pure: ``next_action(period, now)`` returns the action the
scheduler should take *right now*, or ``None`` if nothing is due. The
scheduler (APScheduler / Cloud Tasks) is the side-effecting layer.

Every action transition writes an entry to the per-tenant ``dunning_audit``
collection — see ``record_action``.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional

# Map of step_id -> days_after_issue.
STEPS: List[Dict[str, Any]] = [
    {"id": 0, "day": 0,  "kind": "issued",
     "channel": None,   "service_impact": "none"},
    {"id": 1, "day": 3,  "kind": "first_reminder",
     "channel": "email", "service_impact": "banner_info"},
    {"id": 2, "day": 7,  "kind": "second_reminder",
     "channel": "email+whatsapp", "service_impact": "banner_warn"},
    {"id": 3, "day": 14, "kind": "final_notice",
     "channel": "email+whatsapp+sms", "service_impact": "read_only"},
    {"id": 4, "day": 30, "kind": "suspended",
     "channel": "email", "service_impact": "billing_only"},
    {"id": 5, "day": 60, "kind": "archive_scheduled",
     "channel": None, "service_impact": "scheduled_deletion"},
]

DunningStepId = Literal[0, 1, 2, 3, 4, 5]

# Sentinel values shown in TenantBilling document.
SERVICE_IMPACT_NONE = "none"
SERVICE_IMPACT_BANNER_INFO = "banner_info"
SERVICE_IMPACT_BANNER_WARN = "banner_warn"
SERVICE_IMPACT_READ_ONLY = "read_only"
SERVICE_IMPACT_BILLING_ONLY = "billing_only"


@dataclass
class DunningContext:
    """Mutable cursor over the dunning sequence for one delinquent invoice."""

    tenant_id: str
    invoice_ref: str               # opaque — Stripe invoice id or BillingPeriod.period_id.
    issued_at: datetime
    last_step_id: int = 0          # 0 means "only the initial issue is recorded".
    stopped: bool = False          # set when payment is received.
    stopped_reason: Optional[str] = None
    stopped_at: Optional[datetime] = None
    audit: List[Dict[str, Any]] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.audit is None:
            self.audit = []


def step_by_id(step_id: int) -> Dict[str, Any]:
    for s in STEPS:
        if s["id"] == step_id:
            return s
    raise KeyError(f"unknown dunning step: {step_id}")


def next_action(ctx: DunningContext,
                now: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
    """Return the next step to execute, or ``None`` if nothing is due.

    Implementation detail: we scan ``STEPS`` for the first whose
    ``day`` window has been crossed *and* whose id is greater than
    ``ctx.last_step_id``. If the sequence is stopped, returns ``None``.
    """
    if ctx.stopped:
        return None
    now = now or datetime.utcnow()
    elapsed_days = (now - ctx.issued_at).total_seconds() / 86_400
    for step in STEPS:
        if step["id"] <= ctx.last_step_id:
            continue
        if elapsed_days + 1e-6 >= step["day"]:
            return step
        break  # steps are sorted; stop at first un-eligible one.
    return None


def record_action(ctx: DunningContext, step: Dict[str, Any], *,
                  now: Optional[datetime] = None,
                  delivery_status: str = "queued",
                  detail: Optional[Dict[str, Any]] = None) -> DunningContext:
    """Persist the action in the audit log and advance the cursor."""
    now = now or datetime.utcnow()
    entry = {
        "step_id": step["id"],
        "kind": step["kind"],
        "channel": step["channel"],
        "service_impact": step["service_impact"],
        "at": now.isoformat(),
        "delivery_status": delivery_status,
        "detail": detail or {},
    }
    ctx.audit.append(entry)
    ctx.last_step_id = max(ctx.last_step_id, int(step["id"]))
    return ctx


def stop_sequence(ctx: DunningContext, *, reason: str,
                  now: Optional[datetime] = None) -> DunningContext:
    """Halt further actions (e.g. tenant paid, admin overrode)."""
    ctx.stopped = True
    ctx.stopped_reason = reason
    ctx.stopped_at = now or datetime.utcnow()
    ctx.audit.append({
        "step_id": -1,
        "kind": "stopped",
        "at": ctx.stopped_at.isoformat(),
        "detail": {"reason": reason},
    })
    return ctx


# ── Derived helpers used by the API + frontend ──────────────────────────

def service_impact_for(ctx: DunningContext) -> str:
    """Current access-restriction tier (informs middleware + UI banners)."""
    if ctx.stopped:
        return SERVICE_IMPACT_NONE
    step = step_by_id(ctx.last_step_id)
    return step["service_impact"]


def days_until_next(ctx: DunningContext,
                    now: Optional[datetime] = None) -> Optional[int]:
    """How many days remain until the next dunning step fires."""
    if ctx.stopped:
        return None
    now = now or datetime.utcnow()
    elapsed_days = (now - ctx.issued_at).total_seconds() / 86_400
    for step in STEPS:
        if step["id"] <= ctx.last_step_id:
            continue
        delta = int(step["day"] - elapsed_days)
        return max(0, delta)
    return None


def is_locked_out(ctx: DunningContext) -> bool:
    """Convenience: ``True`` when service_impact restricts day-to-day work."""
    impact = service_impact_for(ctx)
    return impact in {
        SERVICE_IMPACT_READ_ONLY,
        SERVICE_IMPACT_BILLING_ONLY,
    }
