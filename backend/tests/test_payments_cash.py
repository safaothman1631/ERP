"""Cash gateway tests (launch-readiness § R4.2)."""
from __future__ import annotations

import asyncio
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.payments.cash_gateway import CashGateway
from app.payments.gateway import Money, PaymentOrder, PaymentStatus


def _fake_repo() -> MagicMock:
    repo = MagicMock()
    repo.create_payment.side_effect = lambda **kwargs: {
        "id": "pay-1",
        **kwargs,
        "amount": str(kwargs["amount"]),
    }
    return repo


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def test_initiate_creates_succeeded_payment_immediately():
    repo = _fake_repo()
    gw = CashGateway(repo_factory=lambda org: repo)
    order = PaymentOrder(invoice_id="inv-9", metadata={"org_id": "org-1"})
    result = _run(gw.initiate(Money(amount=Decimal("100"), currency="IQD"), order))
    assert result.status == PaymentStatus.succeeded
    assert result.provider_slug == "cash"
    repo.create_payment.assert_called_once()
    call_kwargs = repo.create_payment.call_args.kwargs
    assert call_kwargs["status"] == PaymentStatus.succeeded
    assert call_kwargs["amount"] == Decimal("100")


def test_initiate_requires_org_id_in_metadata():
    gw = CashGateway(repo_factory=lambda org: _fake_repo())
    with pytest.raises(ValueError, match="org_id"):
        _run(gw.initiate(
            Money(amount=Decimal("1"), currency="IQD"),
            PaymentOrder(invoice_id="inv-1"),
        ))


def test_capture_is_idempotent_noop():
    gw = CashGateway(repo_factory=lambda org: _fake_repo())
    result = _run(gw.capture("pay-1"))
    assert result.status == PaymentStatus.succeeded
    assert result.payment_id == "pay-1"


def test_refund_creates_negative_payment_and_flips_parent_to_refunded():
    repo = _fake_repo()
    parent = {
        "id": "pay-1",
        "provider_slug": "cash",
        "amount": "100",
        "currency": "IQD",
        "invoice_id": "inv-9",
    }
    gw = CashGateway(repo_factory=lambda org: repo)
    result = _run(gw.refund_with_repo(repo, parent, reason="customer changed mind"))
    assert result.status == PaymentStatus.refunded
    repo.update_status.assert_called_once_with(
        "pay-1", PaymentStatus.refunded, actor="system"
    )
    refund_call_kwargs = repo.create_payment.call_args.kwargs
    assert refund_call_kwargs["amount"] == Decimal("-100")
    assert refund_call_kwargs["parent_payment_id"] == "pay-1"


def test_partial_refund_flips_parent_to_partially_refunded():
    repo = _fake_repo()
    parent = {
        "id": "pay-1", "provider_slug": "cash",
        "amount": "100", "currency": "IQD", "invoice_id": "inv-9",
    }
    gw = CashGateway(repo_factory=lambda org: repo)
    money = Money(amount=Decimal("40"), currency="IQD")
    result = _run(gw.refund_with_repo(repo, parent, amount=money, reason="partial"))
    assert result.status == PaymentStatus.partially_refunded
    repo.update_status.assert_called_once_with(
        "pay-1", PaymentStatus.partially_refunded, actor="system"
    )


def test_refund_amount_exceeding_original_raises():
    repo = _fake_repo()
    parent = {
        "id": "pay-1", "provider_slug": "cash",
        "amount": "50", "currency": "IQD",
    }
    gw = CashGateway(repo_factory=lambda org: repo)
    money = Money(amount=Decimal("200"), currency="IQD")
    with pytest.raises(ValueError, match="exceeds"):
        _run(gw.refund_with_repo(repo, parent, amount=money))


def test_verify_webhook_returns_noop_event():
    gw = CashGateway(repo_factory=lambda org: _fake_repo())
    event = _run(gw.verify_webhook({}, b""))
    assert event.event_type == "noop"
    assert event.provider_slug == "cash"


def test_get_status_returns_succeeded():
    gw = CashGateway(repo_factory=lambda org: _fake_repo())
    assert _run(gw.get_status("any")) == PaymentStatus.succeeded
