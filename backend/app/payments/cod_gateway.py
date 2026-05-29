"""Cash-on-Delivery gateway (launch-readiness § R4.3).

State machine — kept as a first-class adapter per ADR-LR-003 because 60% of
Iraqi e-commerce is COD and treating it as a workaround creates bad UX.

    pending ──► out_for_delivery ──► delivered ──► settled
       │                                  │
       │                                  └──► returned
       └──► cancelled

Helpers drive the transitions; the API layer dispatches based on the courier
event (manual mark-shipped, marked-delivered scan, return-to-warehouse).

Optional courier integrations (Aramex, local couriers) plug in by importing
this module and calling ``mark_*`` after their webhook fires; the integration
itself is out of scope for v1.
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


_ALLOWED_TRANSITIONS: dict[PaymentStatus, set[PaymentStatus]] = {
    PaymentStatus.pending: {
        PaymentStatus.out_for_delivery,
        PaymentStatus.cancelled,
    },
    PaymentStatus.out_for_delivery: {
        PaymentStatus.delivered,
        PaymentStatus.returned,
        PaymentStatus.cancelled,
    },
    PaymentStatus.delivered: {
        PaymentStatus.settled,
        PaymentStatus.returned,
    },
    PaymentStatus.settled: set(),
    PaymentStatus.cancelled: set(),
    PaymentStatus.returned: set(),
}


class CODTransitionInvalid(Exception):
    """Raised when a state transition is not on the allowed-edges list."""


class CODGateway(PaymentGateway):
    """COD lifecycle adapter. No external HTTP call required for v1."""

    slug = "cod"

    def __init__(self, repo_factory):
        self._repo_factory = repo_factory

    async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult:
        org_id = order.metadata.get("org_id")
        if not org_id:
            raise ValueError("cod gateway requires order.metadata['org_id']")
        repo = self._repo_factory(org_id)
        payment = repo.create_payment(
            provider_slug=self.slug,
            amount=amount.amount,
            currency=amount.currency,
            status=PaymentStatus.pending,
            invoice_id=order.invoice_id,
            pos_sale_id=order.pos_sale_id,
            customer_id=order.customer_id,
            created_by=order.metadata.get("actor", "system"),
        )
        return InitiateResult(
            payment_id=payment["id"],
            provider_slug=self.slug,
            status=PaymentStatus.pending,
            next_action_kind="confirm",
            next_action={"message": "Order set to COD; awaiting dispatch."},
        )

    async def capture(self, payment_id: str) -> CaptureResult:
        """Capture = delivery person confirms cash collected.

        Equivalent to ``mark_delivered``; provided so the abstract
        ``capture`` endpoint is uniform across providers.
        """
        # API layer will call mark_delivered with the org-scoped repo;
        # this method just enforces protocol uniformity.
        raise NotImplementedError(
            "use CODGateway.transition(repo, payment_id, PaymentStatus.delivered)"
        )

    async def refund(
        self, payment_id: str, amount: Optional[Money] = None, *, reason: str = ""
    ) -> RefundResult:
        """Returning a COD package: status flips to ``returned``.

        Money never moved (parent was ``delivered`` → return reverses GL).
        """
        raise NotImplementedError(
            "COD refunds must go through the return flow — call "
            "CODGateway.transition(repo, id, PaymentStatus.returned)"
        )

    def transition(
        self,
        repo,
        payment_id: str,
        new_status: PaymentStatus,
        *,
        actor: str = "system",
        note: str = "",
    ) -> dict:
        """Validated state transition. Returns the updated Payment doc."""
        current = repo.get(payment_id)
        if current is None:
            raise PaymentNotFound(payment_id)
        if current.get("provider_slug") != self.slug:
            raise PaymentNotFound(f"not a COD payment: {payment_id}")
        try:
            curr_status = PaymentStatus(current["status"])
        except ValueError:
            raise CODTransitionInvalid(f"unknown stored status: {current['status']}")
        allowed = _ALLOWED_TRANSITIONS.get(curr_status, set())
        if new_status not in allowed:
            raise CODTransitionInvalid(
                f"cannot transition {curr_status.value} → {new_status.value}"
            )
        provider_data = {"transition_note": note} if note else None
        return repo.update_status(
            payment_id, new_status, actor=actor, provider_data=provider_data
        )

    async def verify_webhook(self, headers, body) -> WebhookEvent:
        """COD has no provider webhooks; couriers integrate elsewhere."""
        return WebhookEvent(
            provider_slug=self.slug, provider_event_id="", event_type="noop"
        )

    async def get_status(self, payment_id: str) -> PaymentStatus:
        return PaymentStatus.pending  # caller should read from repo

    # Public convenience wrappers for the API layer.
    def mark_out_for_delivery(self, repo, payment_id: str, *, actor: str) -> dict:
        return self.transition(
            repo, payment_id, PaymentStatus.out_for_delivery, actor=actor
        )

    def mark_delivered(self, repo, payment_id: str, *, actor: str) -> dict:
        return self.transition(
            repo, payment_id, PaymentStatus.delivered, actor=actor
        )

    def mark_settled(self, repo, payment_id: str, *, actor: str) -> dict:
        return self.transition(
            repo, payment_id, PaymentStatus.settled, actor=actor
        )

    def mark_returned(self, repo, payment_id: str, *, actor: str, note: str = "") -> dict:
        return self.transition(
            repo, payment_id, PaymentStatus.returned, actor=actor, note=note
        )

    def mark_cancelled(self, repo, payment_id: str, *, actor: str, note: str = "") -> dict:
        return self.transition(
            repo, payment_id, PaymentStatus.cancelled, actor=actor, note=note
        )
