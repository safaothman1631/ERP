"""Tests for the Iraqi recurring-billing state machine (§ R5.3)."""
from datetime import datetime, timedelta

import pytest

from app.billing.fastpay_recurring import (
    BillingPeriod,
    GRACE_DAYS,
    PAST_DUE_DAYS,
    advance_to_past_due,
    advance_to_suspended,
    issue_period,
    mark_paid,
    record_reminder,
    render_invoice_payload,
    tick,
    void_period,
)


def test_issue_period_uses_iqd_monthly_starter_price():
    period = issue_period(
        tenant_id="tenant-iq",
        plan_slug="starter",
        now=datetime(2026, 5, 1),
    )
    assert period.amount_iqd == 30_000
    assert period.state == "issued"
    assert period.tenant_id == "tenant-iq"


def test_record_reminder_promotes_issued_to_reminded():
    p = issue_period(
        tenant_id="t-1", plan_slug="starter", now=datetime(2026, 5, 1),
    )
    record_reminder(p, channel="whatsapp", now=datetime(2026, 5, 3))
    assert p.state == "reminded"
    assert len(p.reminders_sent) == 1
    assert p.reminders_sent[0]["channel"] == "whatsapp"


def test_mark_paid_sets_state_provider_reference():
    p = issue_period(
        tenant_id="t-1", plan_slug="starter", now=datetime(2026, 5, 1),
    )
    mark_paid(p, provider="fastpay", reference="FP-12345")
    assert p.state == "paid"
    assert p.payment_provider == "fastpay"
    assert p.payment_reference == "FP-12345"


def test_mark_paid_rejects_already_paid():
    p = issue_period(
        tenant_id="t-1", plan_slug="starter", now=datetime(2026, 5, 1),
    )
    mark_paid(p, provider="cash", reference="A")
    with pytest.raises(ValueError):
        mark_paid(p, provider="cash", reference="B")


def test_advance_to_past_due_after_grace():
    issued = datetime(2026, 5, 1)
    p = issue_period(tenant_id="t", plan_slug="starter", now=issued)
    advance_to_past_due(p, now=issued + timedelta(days=PAST_DUE_DAYS))
    assert p.state == "past_due"


def test_advance_to_past_due_is_noop_before_grace():
    issued = datetime(2026, 5, 1)
    p = issue_period(tenant_id="t", plan_slug="starter", now=issued)
    advance_to_past_due(p, now=issued + timedelta(days=3))
    assert p.state == "issued"


def test_advance_to_suspended_after_full_grace():
    issued = datetime(2026, 5, 1)
    p = issue_period(tenant_id="t", plan_slug="starter", now=issued)
    advance_to_past_due(p, now=issued + timedelta(days=PAST_DUE_DAYS))
    advance_to_suspended(
        p, now=issued + timedelta(days=PAST_DUE_DAYS + GRACE_DAYS),
    )
    assert p.state == "suspended"
    assert p.suspended_at is not None


def test_void_period_rejects_paid():
    p = issue_period(
        tenant_id="t", plan_slug="starter", now=datetime(2026, 5, 1),
    )
    mark_paid(p, provider="cash", reference="X")
    with pytest.raises(ValueError):
        void_period(p, reason="duplicate")


def test_tick_is_idempotent():
    issued = datetime(2026, 5, 1)
    p = issue_period(tenant_id="t", plan_slug="starter", now=issued)
    later = issued + timedelta(days=PAST_DUE_DAYS + GRACE_DAYS + 1)
    tick(p, now=later)
    state_first = p.state
    tick(p, now=later)
    assert p.state == state_first


def test_render_invoice_payload_includes_tenant_and_amount():
    p = issue_period(
        tenant_id="tenant-99", plan_slug="growth", now=datetime(2026, 5, 1),
    )
    payload = render_invoice_payload(p, pay_url="https://pay.test/abc")
    assert payload["tenant_id"] == "tenant-99"
    assert payload["amount_iqd"] == 80_000
    assert payload["pay_url"].endswith("abc")
