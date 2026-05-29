"""Stripe gateway (launch-readiness § R4.8).

For international (non-IQ-resident) tenants. Uses the ``stripe`` Python SDK
(documented in ``_deltas/R4-deps.md``); if ``STRIPE_SECRET_KEY`` is not
configured, every operation raises ``PaymentProviderNotConfigured`` so the
API layer can return a clean 503.

Webhook signatures are verified with HMAC-SHA256 over the timestamped payload
per Stripe's spec (`Stripe-Signature` header parsed with ``stripe.Webhook``).
"""
from __future__ import annotations

import hashlib
import hmac
import os
import time
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from app.payments.gateway import (
    CaptureResult,
    InitiateResult,
    Money,
    PaymentGateway,
    PaymentNotFound,
    PaymentOrder,
    PaymentProviderNotConfigured,
    PaymentStatus,
    RefundResult,
    WebhookEvent,
    WebhookSignatureInvalid,
)


# Stripe → our status mapping. ``requires_action`` covers SCA / 3DS.
_STRIPE_STATUS_MAP: dict[str, PaymentStatus] = {
    "requires_payment_method": PaymentStatus.pending,
    "requires_confirmation": PaymentStatus.pending,
    "requires_action": PaymentStatus.requires_action,
    "requires_capture": PaymentStatus.authorized,
    "processing": PaymentStatus.pending,
    "succeeded": PaymentStatus.succeeded,
    "canceled": PaymentStatus.cancelled,
}


def _stripe_sdk():
    """Import the Stripe SDK lazily so missing dep doesn't break module load."""
    try:
        import stripe  # type: ignore
    except ImportError as exc:
        raise PaymentProviderNotConfigured(
            "stripe SDK not installed — see _deltas/R4-deps.md"
        ) from exc
    return stripe


class StripeGateway(PaymentGateway):
    """Stripe Payment Intents flow + webhook signature verification."""

    slug = "stripe"

    # 5-minute tolerance on Stripe-Signature timestamp (Stripe's default).
    WEBHOOK_TOLERANCE_SECONDS = 300

    def __init__(self, repo_factory, *, secret_key: Optional[str] = None,
                 webhook_secret: Optional[str] = None,
                 publishable_key: Optional[str] = None):
        self._repo_factory = repo_factory
        self._secret_key = secret_key or os.environ.get("STRIPE_SECRET_KEY")
        self._webhook_secret = webhook_secret or os.environ.get("STRIPE_WEBHOOK_SECRET")
        self._publishable_key = publishable_key or os.environ.get("STRIPE_PUBLISHABLE_KEY")

    def _require_configured(self) -> None:
        if not self._secret_key:
            raise PaymentProviderNotConfigured(
                "STRIPE_SECRET_KEY not set — Stripe gateway disabled"
            )

    @property
    def publishable_key(self) -> Optional[str]:
        """Surfaced to the frontend so the browser can mount Stripe Elements."""
        return self._publishable_key

    async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult:
        self._require_configured()
        stripe = _stripe_sdk()
        stripe.api_key = self._secret_key

        org_id = order.metadata.get("org_id")
        if not org_id:
            raise ValueError("stripe gateway requires order.metadata['org_id']")
        repo = self._repo_factory(org_id)

        metadata = {
            "org_id": org_id,
            "invoice_id": order.invoice_id or "",
            "pos_sale_id": order.pos_sale_id or "",
        }
        metadata.update({k: str(v) for k, v in order.metadata.items()
                         if k not in metadata and v is not None})

        intent = stripe.PaymentIntent.create(
            amount=amount.minor_units(),
            currency=amount.currency.lower(),
            metadata=metadata,
            description=order.description or f"Invoice {order.invoice_id or ''}",
            receipt_email=order.customer_email or None,
            # Iraqi tenants don't go through Stripe; for international the
            # default automatic_payment_methods is what we want.
            automatic_payment_methods={"enabled": True},
        )

        status = _STRIPE_STATUS_MAP.get(intent["status"], PaymentStatus.pending)
        payment = repo.create_payment(
            provider_slug=self.slug,
            amount=amount.amount,
            currency=amount.currency,
            status=status,
            invoice_id=order.invoice_id,
            pos_sale_id=order.pos_sale_id,
            customer_id=order.customer_id,
            provider_reference=intent["id"],
            provider_data={"client_secret": intent["client_secret"]},
            created_by=order.metadata.get("actor", "system"),
        )
        return InitiateResult(
            payment_id=payment["id"],
            provider_slug=self.slug,
            status=status,
            next_action_kind="client_secret",
            next_action={
                "client_secret": intent["client_secret"],
                "publishable_key": self._publishable_key,
            },
            provider_reference=intent["id"],
        )

    async def capture(self, payment_id: str) -> CaptureResult:
        self._require_configured()
        stripe = _stripe_sdk()
        stripe.api_key = self._secret_key
        # The caller resolves provider_reference; we accept the Stripe id directly
        # when called from the API layer (which passes it through).
        intent = stripe.PaymentIntent.retrieve(payment_id)
        if intent["status"] == "requires_capture":
            intent = stripe.PaymentIntent.capture(payment_id)
        status = _STRIPE_STATUS_MAP.get(intent["status"], PaymentStatus.pending)
        return CaptureResult(
            payment_id=payment_id,
            status=status,
            captured_at=datetime.utcnow() if status == PaymentStatus.succeeded else None,
            provider_reference=intent["id"],
        )

    async def refund(
        self, payment_id: str, amount: Optional[Money] = None, *, reason: str = ""
    ) -> RefundResult:
        """``payment_id`` here is the **Stripe** payment_intent id.

        The API layer's wrapper (``refund_with_repo``) handles local Payment
        bookkeeping; this method just talks to Stripe.
        """
        self._require_configured()
        stripe = _stripe_sdk()
        stripe.api_key = self._secret_key

        kwargs: dict[str, Any] = {"payment_intent": payment_id}
        if amount is not None:
            kwargs["amount"] = amount.minor_units()
        if reason:
            # Stripe only accepts a fixed set; pass arbitrary as metadata.
            stripe_reasons = {"duplicate", "fraudulent", "requested_by_customer"}
            if reason in stripe_reasons:
                kwargs["reason"] = reason
            else:
                kwargs["metadata"] = {"reason": reason}
        refund = stripe.Refund.create(**kwargs)
        amt = Money(
            amount=Decimal(refund["amount"]) / Decimal("100"),
            currency=refund["currency"].upper(),
        )
        return RefundResult(
            refund_id=refund["id"],
            payment_id=payment_id,
            amount=amt,
            status=PaymentStatus.refunded,
            refunded_at=datetime.utcnow(),
            provider_reference=refund["id"],
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
        """End-to-end refund: Stripe call + local Payment chain + status flip."""
        intent_id = parent_payment.get("provider_reference") or parent_payment.get(
            "provider_charge_id"
        )
        if not intent_id:
            raise PaymentNotFound(
                f"payment {parent_payment.get('id')} has no Stripe provider_reference"
            )
        result = await self.refund(intent_id, amount=amount, reason=reason)
        original = Decimal(str(parent_payment["amount"]))
        is_partial = result.amount.amount < original
        local_refund = repo.create_payment(
            provider_slug=self.slug,
            amount=-result.amount.amount,
            currency=result.amount.currency,
            status=PaymentStatus.refunded,
            invoice_id=parent_payment.get("invoice_id"),
            pos_sale_id=parent_payment.get("pos_sale_id"),
            customer_id=parent_payment.get("customer_id"),
            parent_payment_id=parent_payment["id"],
            provider_reference=result.provider_reference,
            provider_data={"reason": reason, "stripe_refund_id": result.refund_id},
            created_by=actor,
        )
        parent_status = (
            PaymentStatus.partially_refunded if is_partial else PaymentStatus.refunded
        )
        repo.update_status(parent_payment["id"], parent_status, actor=actor)
        return RefundResult(
            refund_id=local_refund["id"],
            payment_id=parent_payment["id"],
            amount=result.amount,
            status=parent_status,
            refunded_at=datetime.utcnow(),
            provider_reference=result.provider_reference,
        )

    async def verify_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent:
        """HMAC verify per Stripe's `t=...,v1=...` signature scheme."""
        if not self._webhook_secret:
            raise PaymentProviderNotConfigured("STRIPE_WEBHOOK_SECRET not set")
        sig_header = headers.get("stripe-signature") or headers.get("Stripe-Signature")
        if not sig_header:
            raise WebhookSignatureInvalid("missing Stripe-Signature header")

        # Parse `t=...,v1=...,v1=...`
        parts = {}
        for item in sig_header.split(","):
            k, _, v = item.partition("=")
            parts.setdefault(k.strip(), []).append(v.strip())
        try:
            timestamp = int(parts["t"][0])
        except (KeyError, ValueError, IndexError) as exc:
            raise WebhookSignatureInvalid("malformed signature header") from exc
        if abs(time.time() - timestamp) > self.WEBHOOK_TOLERANCE_SECONDS:
            raise WebhookSignatureInvalid("timestamp outside tolerance")
        signed = f"{timestamp}.".encode() + body
        expected = hmac.new(
            self._webhook_secret.encode(), signed, hashlib.sha256
        ).hexdigest()
        candidates = parts.get("v1", [])
        if not any(hmac.compare_digest(expected, c) for c in candidates):
            raise WebhookSignatureInvalid("signature mismatch")

        # Body is verified — parse JSON. ``stripe`` SDK would do this too but we
        # avoid forcing it as a hard import dependency for verify-only paths.
        import json
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception as exc:
            raise WebhookSignatureInvalid(f"body not JSON: {exc}") from exc

        event_id = payload.get("id", "")
        event_type = payload.get("type", "")
        data_obj = (payload.get("data") or {}).get("object", {})
        provider_reference = data_obj.get("id")
        return WebhookEvent(
            provider_slug=self.slug,
            provider_event_id=event_id,
            event_type=event_type,
            payment_id=provider_reference,
            raw=payload,
        )

    async def get_status(self, payment_id: str) -> PaymentStatus:
        """``payment_id`` is the Stripe PaymentIntent id."""
        self._require_configured()
        stripe = _stripe_sdk()
        stripe.api_key = self._secret_key
        intent = stripe.PaymentIntent.retrieve(payment_id)
        return _STRIPE_STATUS_MAP.get(intent["status"], PaymentStatus.pending)

    # Reconciliation hook used by the nightly job.
    async def get_settlements(self, *, date_from, date_to) -> list[dict]:
        """Return Stripe BalanceTransactions for the date range."""
        self._require_configured()
        stripe = _stripe_sdk()
        stripe.api_key = self._secret_key
        start = int(time.mktime(date_from.timetuple()))
        end = int(time.mktime(date_to.timetuple()))
        out: list[dict] = []
        # Paginate until exhausted; small windows for nightly job.
        for txn in stripe.BalanceTransaction.list(
            created={"gte": start, "lt": end}, limit=100
        ).auto_paging_iter():
            out.append(
                {
                    "id": txn["id"],
                    "amount": Decimal(txn["amount"]) / Decimal("100"),
                    "currency": txn["currency"].upper(),
                    "source": txn["source"],   # PaymentIntent or Refund id
                    "type": txn["type"],
                    "available_on": txn["available_on"],
                }
            )
        return out
