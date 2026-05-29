"""FastPay gateway (launch-readiness § R4.4 — stub pending R7.2).

Sandbox base: ``https://sandbox.fastpaywallet.com/api/v1/`` (per design § 5.2).

Flow once credentials arrive:
  1. OAuth: ``POST /oauth/token`` with client_credentials → bearer (TTL ~3600s).
  2. Create intent: ``POST /payments`` body ``{amount:int, currency:'IQD',
     description, merchant_reference, callback_url}`` → returns ``{id,
     qr_string, expires_at}``. Customer scans QR.
  3. Webhook: FastPay POSTs ``{payment_id, status, timestamp, signature}`` to
     our callback. Signature = ``HMAC_SHA256(secret, raw_body)``.

All five methods raise ``PaymentProviderNotConfigured`` until R7.2 closes.
The structure mirrors the Stripe adapter so wiring is identical at the API
layer — just register the live instance and the routes light up.
"""
from __future__ import annotations

from typing import Optional

from app.payments.gateway import (
    CaptureResult,
    InitiateResult,
    Money,
    PaymentGateway,
    PaymentOrder,
    PaymentProviderNotConfigured,
    PaymentStatus,
    RefundResult,
    WebhookEvent,
)


_BLOCKED = (
    "FastPay credentials pending — see R7.2 "
    "(_deltas/launch-readiness-REMAINING-WORK.md § Phase R4)"
)


class FastPayGateway(PaymentGateway):
    slug = "fastpay"

    SANDBOX_BASE = "https://sandbox.fastpaywallet.com/api/v1/"
    QR_TTL_SECONDS = 300  # FastPay QRs expire after 5 min per design § 5.2.

    def __init__(self, repo_factory, *, client_id: Optional[str] = None,
                 client_secret: Optional[str] = None, sandbox: bool = True):
        self._repo_factory = repo_factory
        self._client_id = client_id
        self._client_secret = client_secret
        self._sandbox = sandbox

    def _require_configured(self) -> None:
        if not (self._client_id and self._client_secret):
            raise PaymentProviderNotConfigured(_BLOCKED)

    async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult:
        self._require_configured()
        # TODO(R7.2): POST /oauth/token, then POST /payments; persist QR.
        raise NotImplementedError(_BLOCKED)

    async def capture(self, payment_id: str) -> CaptureResult:
        # TODO(R7.2): FastPay captures on QR scan; this is effectively no-op.
        raise NotImplementedError(_BLOCKED)

    async def refund(
        self, payment_id: str, amount: Optional[Money] = None, *, reason: str = ""
    ) -> RefundResult:
        # TODO(R7.2): POST /payments/{id}/refund — confirm FastPay supports refunds.
        raise NotImplementedError(_BLOCKED)

    async def verify_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent:
        # TODO(R7.2): HMAC_SHA256(secret, raw_body) constant-time compare.
        raise NotImplementedError(_BLOCKED)

    async def get_status(self, payment_id: str) -> PaymentStatus:
        # TODO(R7.2): GET /payments/{id}; map FastPay statuses to PaymentStatus.
        raise NotImplementedError(_BLOCKED)
