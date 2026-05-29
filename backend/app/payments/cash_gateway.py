"""Cash gateway (launch-readiness § R4.2).

A degenerate adapter: there's no external API call, no webhook, no signature
to verify. Money is collected in person and immediately marked ``succeeded``.

Refunds create a negative ``Payment`` row chained via ``parent_payment_id``.
The accounting service posts the matching reversing journal entry.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from app.payments.gateway import (
    CaptureResult,
    InitiateResult,
    Money,
    PaymentGateway,
    PaymentNotFound,
    PaymentOrder,
    PaymentStatus,
    RefundResult,
    WebhookEvent,
)


class CashGateway(PaymentGateway):
    """In-person cash collection. Always-online; no provider call."""

    slug = "cash"

    def __init__(self, repo_factory):
        """``repo_factory(org_id) -> PaymentRepository`` — kept injected so
        unit tests can patch Firestore. The API layer passes a real factory
        bound to the caller's org.
        """
        self._repo_factory = repo_factory

    async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult:
        org_id = order.metadata.get("org_id")
        if not org_id:
            raise ValueError("cash gateway requires order.metadata['org_id']")
        repo = self._repo_factory(org_id)
        payment = repo.create_payment(
            provider_slug=self.slug,
            amount=amount.amount,
            currency=amount.currency,
            status=PaymentStatus.succeeded,    # cash is immediate
            invoice_id=order.invoice_id,
            pos_sale_id=order.pos_sale_id,
            customer_id=order.customer_id,
            provider_reference=f"cash-{order.invoice_id or order.pos_sale_id or 'pos'}",
            created_by=order.metadata.get("actor", "system"),
        )
        return InitiateResult(
            payment_id=payment["id"],
            provider_slug=self.slug,
            status=PaymentStatus.succeeded,
            next_action_kind="confirm",
            next_action={"message": "Cash collected"},
        )

    async def capture(self, payment_id: str) -> CaptureResult:
        """No-op — cash is captured at the moment of initiation."""
        # The caller knows the org_id from the route; we accept it via meta.
        # If we don't have it (raw call), we treat as a no-op success.
        return CaptureResult(
            payment_id=payment_id,
            status=PaymentStatus.succeeded,
            captured_at=datetime.utcnow(),
        )

    async def refund(
        self, payment_id: str, amount: Optional[Money] = None, *, reason: str = ""
    ) -> RefundResult:
        """Cash refund — opens cash drawer; immediately succeeds.

        Resolution of the original payment + org binding happens in the API
        layer, which calls ``refund_with_repo`` after pulling the parent.
        """
        # Stub return — real flow goes through refund_with_repo so we can
        # fetch the parent payment's org/amount/currency in one place.
        raise NotImplementedError(
            "cash refunds must be initiated via the API layer "
            "(`POST /api/payments/{id}/refund`) so the repo is bound to org"
        )

    async def refund_with_repo(
        self,
        repo,
        parent_payment: dict,
        amount: Optional[Money] = None,
        *,
        reason: str = "",
        actor: str = "system",
    ) -> RefundResult:
        """Concrete refund path used by the API layer."""
        if parent_payment.get("provider_slug") != self.slug:
            raise PaymentNotFound(f"not a cash payment: {parent_payment.get('id')}")
        original = Decimal(str(parent_payment["amount"]))
        refund_amount = amount.amount if amount else original
        if refund_amount > original:
            raise ValueError("refund_amount_exceeds_original")
        refund = repo.create_payment(
            provider_slug=self.slug,
            amount=-refund_amount,
            currency=parent_payment["currency"],
            status=PaymentStatus.refunded,
            invoice_id=parent_payment.get("invoice_id"),
            pos_sale_id=parent_payment.get("pos_sale_id"),
            customer_id=parent_payment.get("customer_id"),
            parent_payment_id=parent_payment["id"],
            provider_reference=f"cash-refund-{parent_payment['id']}",
            provider_data={"reason": reason},
            created_by=actor,
        )
        # Mark the parent as refunded (full) or partially_refunded.
        parent_status = (
            PaymentStatus.refunded if refund_amount == original
            else PaymentStatus.partially_refunded
        )
        repo.update_status(parent_payment["id"], parent_status, actor=actor)
        return RefundResult(
            refund_id=refund["id"],
            payment_id=parent_payment["id"],
            amount=Money(amount=refund_amount, currency=parent_payment["currency"]),
            status=parent_status,
            refunded_at=datetime.utcnow(),
            provider_reference=refund["provider_reference"],
        )

    async def verify_webhook(self, headers, body) -> WebhookEvent:
        """Cash has no webhooks — returning an empty event signals 'ignore'."""
        return WebhookEvent(
            provider_slug=self.slug,
            provider_event_id="",
            event_type="noop",
        )

    async def get_status(self, payment_id: str) -> PaymentStatus:
        # Status lives in DB; the API layer reads it directly. This implementation
        # just confirms the contract.
        return PaymentStatus.succeeded
