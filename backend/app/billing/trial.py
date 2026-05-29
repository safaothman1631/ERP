"""Free-trial enforcement.

Each tenant gets a ``trial_ends_at`` timestamp set at signup. Default duration
is ``DEFAULT_TRIAL_DAYS`` (90), but a Plan may override it (e.g. a comp plan
with a 365-day trial).

This module is *time-pure*: pass the current ``now`` to every function so the
tests don't need a clock fixture.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from app.billing.plans import DEFAULT_TRIAL_DAYS, get_plan

# Banner re-show interval after dismissal (24 hours).
BANNER_DISMISS_HOURS = 24

# Soft warnings — banner becomes amber/red at these thresholds.
WARN_AMBER_DAYS = 14
WARN_RED_DAYS = 3


def compute_trial_end(*, signup_at: datetime,
                      plan_slug: Optional[str] = None) -> datetime:
    """Default trial end timestamp for a brand-new tenant."""
    days = DEFAULT_TRIAL_DAYS
    if plan_slug:
        plan = get_plan(plan_slug)
        if plan.trial_days_override is not None:
            days = int(plan.trial_days_override)
    return signup_at + timedelta(days=days)


def days_left(*, trial_ends_at: Optional[datetime],
              now: Optional[datetime] = None) -> Optional[int]:
    """Whole days until trial expiry (0 if today, negative if past)."""
    if trial_ends_at is None:
        return None
    now = now or datetime.utcnow()
    delta = trial_ends_at - now
    return int(delta.total_seconds() // 86_400)


def is_trialing(*, trial_ends_at: Optional[datetime],
                billing_status: str,
                now: Optional[datetime] = None) -> bool:
    """``True`` when the tenant is still inside their free trial window."""
    if billing_status != "trialing":
        return False
    left = days_left(trial_ends_at=trial_ends_at, now=now)
    return left is not None and left >= 0


def is_expired(*, trial_ends_at: Optional[datetime],
               now: Optional[datetime] = None) -> bool:
    """``True`` when the trial window has elapsed."""
    if trial_ends_at is None:
        return False
    now = now or datetime.utcnow()
    return now >= trial_ends_at


def banner_state(*, trial_ends_at: Optional[datetime],
                 now: Optional[datetime] = None) -> dict:
    """Return banner-rendering hints for ``TrialBanner.tsx``."""
    if trial_ends_at is None:
        return {"show": False}
    left = days_left(trial_ends_at=trial_ends_at, now=now)
    if left is None:
        return {"show": False}
    if left < 0:
        return {
            "show": True,
            "severity": "expired",
            "days_left": 0,
            "message_key": "billing.trial.expired",
        }
    severity = "info"
    if left <= WARN_RED_DAYS:
        severity = "red"
    elif left <= WARN_AMBER_DAYS:
        severity = "amber"
    return {
        "show": True,
        "severity": severity,
        "days_left": left,
        "message_key": "billing.trial.days_left",
    }


def should_show_banner_after_dismiss(*, dismissed_at: Optional[datetime],
                                     now: Optional[datetime] = None) -> bool:
    """Re-display the banner if the user dismissed it more than 24h ago."""
    if dismissed_at is None:
        return True
    now = now or datetime.utcnow()
    return (now - dismissed_at) >= timedelta(hours=BANNER_DISMISS_HOURS)


def trial_expiry_action(*, trial_ends_at: Optional[datetime],
                        billing_status: str,
                        now: Optional[datetime] = None
                        ) -> Optional[str]:
    """Return the action keyword the cron job should take on expiry.

    Returns ``"start_dunning_day_0"`` if the tenant just transitioned out of
    the trial window without an active subscription, ``None`` otherwise.
    """
    if billing_status not in {"trialing"}:
        return None
    if trial_ends_at is None:
        return None
    if not is_expired(trial_ends_at=trial_ends_at, now=now):
        return None
    return "start_dunning_day_0"
