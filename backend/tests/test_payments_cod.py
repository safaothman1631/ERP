"""COD gateway tests (launch-readiness § R4.3)."""
from __future__ import annotations

import asyncio
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.payments.cod_gateway import CODGateway, CODTransitionInvalid
from app.payments.gateway import Money, PaymentOrder, PaymentStatus


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _repo_with(payment: dict) -> MagicMock:
    repo = MagicMock()
    state = {"doc": dict(payment)}

    def _get(pid):
        return state["doc"] if state["doc"]["id"] == pid else None

    def _update_status(pid, new_status, actor="system", **_):
        state["doc"]["status"] = new_status.value if hasattr(new_status, "value") else new_status
        return state["doc"]

    repo.get.side_effect = _get
    repo.update_status.side_effect = _update_status
    return repo


def test_initiate_creates_pending_payment():
    repo = MagicMock()
    repo.create_payment.return_value = {"id": "p1"}
    gw = CODGateway(repo_factory=lambda org: repo)
    order = PaymentOrder(invoice_id="inv-1", metadata={"org_id": "org-1"})
    result = _run(gw.initiate(Money(amount=Decimal("500"), currency="IQD"), order))
    assert result.status == PaymentStatus.pending
    assert result.provider_slug == "cod"
    kwargs = repo.create_payment.call_args.kwargs
    assert kwargs["status"] == PaymentStatus.pending


def test_pending_to_out_for_delivery_allowed():
    repo = _repo_with({"id": "p1", "status": "pending", "provider_slug": "cod"})
    gw = CODGateway(repo_factory=lambda org: repo)
    updated = gw.mark_out_for_delivery(repo, "p1", actor="courier-1")
    assert updated["status"] == "out_for_delivery"


def test_out_for_delivery_to_delivered_allowed():
    repo = _repo_with({"id": "p1", "status": "out_for_delivery", "provider_slug": "cod"})
    gw = CODGateway(repo_factory=lambda org: repo)
    updated = gw.mark_delivered(repo, "p1", actor="courier-1")
    assert updated["status"] == "delivered"


def test_delivered_to_settled_allowed():
    repo = _repo_with({"id": "p1", "status": "delivered", "provider_slug": "cod"})
    gw = CODGateway(repo_factory=lambda org: repo)
    updated = gw.mark_settled(repo, "p1", actor="finance")
    assert updated["status"] == "settled"


def test_pending_to_delivered_skipping_dispatch_rejected():
    repo = _repo_with({"id": "p1", "status": "pending", "provider_slug": "cod"})
    gw = CODGateway(repo_factory=lambda org: repo)
    with pytest.raises(CODTransitionInvalid):
        gw.mark_delivered(repo, "p1", actor="courier-1")


def test_settled_is_terminal():
    repo = _repo_with({"id": "p1", "status": "settled", "provider_slug": "cod"})
    gw = CODGateway(repo_factory=lambda org: repo)
    with pytest.raises(CODTransitionInvalid):
        gw.mark_returned(repo, "p1", actor="finance")


def test_pending_to_cancelled_allowed():
    repo = _repo_with({"id": "p1", "status": "pending", "provider_slug": "cod"})
    gw = CODGateway(repo_factory=lambda org: repo)
    updated = gw.mark_cancelled(repo, "p1", actor="user", note="customer cancelled")
    assert updated["status"] == "cancelled"


def test_delivered_to_returned_allowed():
    repo = _repo_with({"id": "p1", "status": "delivered", "provider_slug": "cod"})
    gw = CODGateway(repo_factory=lambda org: repo)
    updated = gw.mark_returned(repo, "p1", actor="warehouse", note="damaged")
    assert updated["status"] == "returned"


def test_transition_rejects_non_cod_payment():
    repo = _repo_with({"id": "p1", "status": "pending", "provider_slug": "cash"})
    gw = CODGateway(repo_factory=lambda org: repo)
    from app.payments.gateway import PaymentNotFound
    with pytest.raises(PaymentNotFound):
        gw.mark_out_for_delivery(repo, "p1", actor="courier-1")
