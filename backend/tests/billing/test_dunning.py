"""Tests for the dunning engine (launch-readiness § R5.5)."""
from datetime import datetime, timedelta

import pytest

from app.billing.dunning import (
    DunningContext,
    SERVICE_IMPACT_BANNER_INFO,
    SERVICE_IMPACT_BILLING_ONLY,
    SERVICE_IMPACT_NONE,
    SERVICE_IMPACT_READ_ONLY,
    days_until_next,
    is_locked_out,
    next_action,
    record_action,
    service_impact_for,
    step_by_id,
    stop_sequence,
)


def _ctx(issued_at: datetime) -> DunningContext:
    return DunningContext(
        tenant_id="t-1", invoice_ref="inv_1", issued_at=issued_at,
    )


def test_day_zero_only_issued_action_initially():
    issued = datetime(2026, 1, 1)
    ctx = _ctx(issued)
    action = next_action(ctx, now=issued + timedelta(hours=1))
    # Day 0 step has id 0; ctx.last_step_id starts at 0, so we look for id>0.
    # At hour 1 nothing newer is due.
    assert action is None


def test_first_reminder_due_at_day_3():
    issued = datetime(2026, 1, 1)
    ctx = _ctx(issued)
    action = next_action(ctx, now=issued + timedelta(days=3))
    assert action is not None
    assert action["kind"] == "first_reminder"


def test_second_reminder_after_recording_first():
    issued = datetime(2026, 1, 1)
    ctx = _ctx(issued)
    first = next_action(ctx, now=issued + timedelta(days=3))
    assert first is not None
    record_action(ctx, first, now=issued + timedelta(days=3))
    action = next_action(ctx, now=issued + timedelta(days=7))
    assert action is not None
    assert action["kind"] == "second_reminder"


def test_record_action_advances_cursor_and_appends_audit():
    issued = datetime(2026, 1, 1)
    ctx = _ctx(issued)
    step = next_action(ctx, now=issued + timedelta(days=3))
    record_action(ctx, step, delivery_status="sent")
    assert ctx.last_step_id == 1
    assert ctx.audit[-1]["delivery_status"] == "sent"


def test_stop_sequence_halts_future_actions():
    issued = datetime(2026, 1, 1)
    ctx = _ctx(issued)
    stop_sequence(ctx, reason="payment_received", now=issued + timedelta(days=5))
    assert ctx.stopped is True
    assert next_action(ctx, now=issued + timedelta(days=30)) is None


def test_service_impact_starts_at_none():
    ctx = _ctx(datetime(2026, 1, 1))
    assert service_impact_for(ctx) == SERVICE_IMPACT_NONE


def test_service_impact_becomes_read_only_at_final_notice():
    issued = datetime(2026, 1, 1)
    ctx = _ctx(issued)
    for day in (3, 7, 14):
        action = next_action(ctx, now=issued + timedelta(days=day))
        if action:
            record_action(ctx, action, now=issued + timedelta(days=day))
    assert service_impact_for(ctx) == SERVICE_IMPACT_READ_ONLY
    assert is_locked_out(ctx) is True


def test_service_impact_becomes_billing_only_at_suspension():
    issued = datetime(2026, 1, 1)
    ctx = _ctx(issued)
    for day in (3, 7, 14, 30):
        action = next_action(ctx, now=issued + timedelta(days=day))
        if action:
            record_action(ctx, action, now=issued + timedelta(days=day))
    assert service_impact_for(ctx) == SERVICE_IMPACT_BILLING_ONLY


def test_days_until_next_counts_down():
    issued = datetime(2026, 1, 1)
    ctx = _ctx(issued)
    # 0 days elapsed; first reminder is at day 3.
    assert days_until_next(ctx, now=issued) == 3


def test_step_by_id_returns_known_step():
    assert step_by_id(2)["kind"] == "second_reminder"


def test_step_by_id_unknown_raises():
    with pytest.raises(KeyError):
        step_by_id(99)
