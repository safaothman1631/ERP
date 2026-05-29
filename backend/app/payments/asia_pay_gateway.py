"""Asia Pay / Asia Hawala gateway (launch-readiness § R4.7 — stub pending R7.5).

Per design § 5.5: largely used for import-export. Token-on-file model for
recurring. Lower priority for v1 unless launch customer needs it.

All methods raise ``PaymentProviderNotConfigured`` until R7.5 closes.
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
    "Asia Pay integration deferred to post-launch — see R7.5 "
    "(_deltas/launch-readiness-REMAINING-WORK.md § Phase R4)"
)


class AsiaPayGateway(PaymentGateway):
    slug = "asia_pay"

    def __init__(self, repo_factory, *, merchant_id: Optional[str] = None,
                 api_key: Optional[str] = None):
        self._repo_factory = repo_factory
        self._merchant_id = merchant_id
        self._api_key = api_key

    def _require_configured(self) -> None:
        if not (self._merchant_id and self._api_key):
            raise PaymentProviderNotConfigured(_BLOCKED)

    async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult:
        self._require_configured()
        # TODO(R7.5): Confirm flow when launch tenant requires it.
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
