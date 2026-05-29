"""Zain Cash gateway (launch-readiness § R4.6 — stub pending R7.4).

Per design § 5.4: provider docs are less public; flow modeled on standard
mobile-wallet OTP pattern. Webhook signature method TBD.

All methods raise ``PaymentProviderNotConfigured`` until R7.4 closes.
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
    "Zain Cash merchant docs + sandbox pending — see R7.4 "
    "(_deltas/launch-readiness-REMAINING-WORK.md § Phase R4)"
)


class ZainCashGateway(PaymentGateway):
    slug = "zain"

    def __init__(self, repo_factory, *, merchant_id: Optional[str] = None,
                 secret: Optional[str] = None, msisdn: Optional[str] = None):
        self._repo_factory = repo_factory
        self._merchant_id = merchant_id
        self._secret = secret
        self._msisdn = msisdn

    def _require_configured(self) -> None:
        if not (self._merchant_id and self._secret):
            raise PaymentProviderNotConfigured(_BLOCKED)

    async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult:
        self._require_configured()
        # TODO(R7.4): Push OTP to wallet MSISDN; return next_action 'otp_input'.
        raise NotImplementedError(_BLOCKED)

    async def capture(self, payment_id: str) -> CaptureResult:
        raise NotImplementedError(_BLOCKED)

    async def refund(
        self, payment_id: str, amount: Optional[Money] = None, *, reason: str = ""
    ) -> RefundResult:
        raise NotImplementedError(_BLOCKED)

    async def verify_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent:
        raise NotImplementedError(_BLOCKED)

    async def get_status(self, payment_id: str) -> PaymentStatus:
        raise NotImplementedError(_BLOCKED)
