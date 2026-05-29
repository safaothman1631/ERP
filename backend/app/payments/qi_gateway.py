"""Qi Card gateway (launch-readiness § R4.5 — stub pending R7.3).

Sandbox base: ``https://api.sandbox.qicard.iq/v1/`` (per design § 5.3 —
placeholder until Qi Card business API team confirms).

Flow (hosted payment page, PCI SAQ-A): redirect customer to Qi-hosted URL
with intent token → customer enters PIN on a Qi-secured page (3DS handled by
Qi) → Qi calls back to our webhook with auth code, then capture endpoint.

All methods raise ``PaymentProviderNotConfigured`` until R7.3 closes.
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
    "Qi Card credentials + sandbox access pending — see R7.3 "
    "(_deltas/launch-readiness-REMAINING-WORK.md § Phase R4)"
)


class QiCardGateway(PaymentGateway):
    slug = "qi"

    SANDBOX_BASE = "https://api.sandbox.qicard.iq/v1/"

    def __init__(self, repo_factory, *, merchant_id: Optional[str] = None,
                 api_key: Optional[str] = None, webhook_secret: Optional[str] = None):
        self._repo_factory = repo_factory
        self._merchant_id = merchant_id
        self._api_key = api_key
        self._webhook_secret = webhook_secret

    def _require_configured(self) -> None:
        if not (self._merchant_id and self._api_key):
            raise PaymentProviderNotConfigured(_BLOCKED)

    async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult:
        self._require_configured()
        # TODO(R7.3): POST /intents → returns hosted-page URL + intent_token.
        raise NotImplementedError(_BLOCKED)

    async def capture(self, payment_id: str) -> CaptureResult:
        # TODO(R7.3): POST /intents/{id}/capture after auth code received.
        raise NotImplementedError(_BLOCKED)

    async def refund(
        self, payment_id: str, amount: Optional[Money] = None, *, reason: str = ""
    ) -> RefundResult:
        # TODO(R7.3): POST /charges/{id}/refund.
        raise NotImplementedError(_BLOCKED)

    async def verify_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent:
        # TODO(R7.3): Confirm signature scheme with Qi business team; placeholder HMAC.
        raise NotImplementedError(_BLOCKED)

    async def get_status(self, payment_id: str) -> PaymentStatus:
        raise NotImplementedError(_BLOCKED)
