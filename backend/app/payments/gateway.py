"""``PaymentGateway`` protocol + value objects (launch-readiness § R4.1).

The protocol is intentionally narrow — concrete adapters implement the same
five async methods, and the registry treats them uniformly. Adapters live in
sibling modules (``cash_gateway``, ``stripe_gateway``, etc.).

The value objects use Pydantic v2 so we get free serialisation for webhook
event logs and API responses.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional, Protocol, runtime_checkable

from pydantic import BaseModel, Field


# ── Errors ───────────────────────────────────────────────────────────────


class PaymentError(Exception):
    """Base class for adapter-level failures the API layer should translate."""


class PaymentProviderNotConfigured(PaymentError):
    """Raised when an adapter is asked to operate without required credentials.

    Iraqi providers (FastPay, Qi Card, Zain Cash, Asia Pay) raise this until
    R7.2–R7.5 close. Stripe raises it if ``STRIPE_SECRET_KEY`` is missing.
    """


class PaymentNotFound(PaymentError):
    """Raised when the adapter cannot resolve a provider-side payment id."""


class WebhookSignatureInvalid(PaymentError):
    """Raised when ``verify_webhook`` cannot authenticate the inbound payload."""


# ── Value objects ────────────────────────────────────────────────────────


class Money(BaseModel):
    """Amount + ISO-4217 currency, e.g. ``Money(amount='1500.00', currency='IQD')``.

    All amounts are ``Decimal`` to avoid float rounding errors in finance code.
    The IQD currency uses 0 decimals (Iraqi dinar has no minor unit in
    practice); USD/EUR/etc. use 2.
    """

    amount: Decimal = Field(..., ge=Decimal("0"))
    currency: str = Field(..., min_length=3, max_length=3)

    def minor_units(self) -> int:
        """Return amount in the smallest currency unit (cents/fils).

        Stripe expects integer minor units; FastPay accepts IQD integers.
        """
        if self.currency.upper() == "IQD":
            return int(self.amount)
        return int(self.amount * 100)


class PaymentOrderLine(BaseModel):
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Money


class PaymentOrder(BaseModel):
    """Describes what the customer is paying for.

    Either ``invoice_id`` (for an existing invoice) or ``line_items`` (for a
    POS sale that has not yet been invoiced) must be provided. The adapters
    pass this through to the provider as ``metadata`` so settlement reports
    can be matched back to ERP entities.
    """

    invoice_id: Optional[str] = None
    pos_sale_id: Optional[str] = None
    line_items: list[PaymentOrderLine] = Field(default_factory=list)
    customer_id: Optional[str] = None
    customer_email: Optional[str] = None
    description: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PaymentStatus(str, Enum):
    """Lifecycle states stored on the ``Payment`` aggregate."""

    pending = "pending"                  # created, awaiting customer action
    requires_action = "requires_action"  # SCA / OTP / scan QR
    out_for_delivery = "out_for_delivery"  # COD-specific
    delivered = "delivered"              # COD-specific (cash collected)
    authorized = "authorized"            # captured later
    succeeded = "succeeded"              # captured and money received
    settled = "settled"                  # cleared in the provider settlement
    refunded = "refunded"
    partially_refunded = "partially_refunded"
    returned = "returned"                # COD-specific
    failed = "failed"
    cancelled = "cancelled"


class InitiateResult(BaseModel):
    """What an adapter returns from ``initiate``.

    ``next_action`` is provider-specific — Stripe returns a client secret,
    FastPay returns a QR string, Qi returns a hosted page URL. The frontend
    uses the ``kind`` field to dispatch the right widget.
    """

    payment_id: str
    provider_slug: str
    status: PaymentStatus
    next_action_kind: Optional[str] = None  # 'qr' | 'redirect' | 'confirm' | 'client_secret'
    next_action: dict[str, Any] = Field(default_factory=dict)
    provider_reference: Optional[str] = None
    expires_at: Optional[datetime] = None


class CaptureResult(BaseModel):
    payment_id: str
    status: PaymentStatus
    captured_at: Optional[datetime] = None
    provider_reference: Optional[str] = None


class RefundResult(BaseModel):
    refund_id: str
    payment_id: str
    amount: Money
    status: PaymentStatus
    refunded_at: Optional[datetime] = None
    provider_reference: Optional[str] = None


class WebhookEvent(BaseModel):
    """Normalised representation of a provider webhook after signature check."""

    provider_slug: str
    provider_event_id: str
    event_type: str           # e.g. 'payment_intent.succeeded'
    payment_id: Optional[str] = None
    raw: dict[str, Any] = Field(default_factory=dict)


# ── Protocol ─────────────────────────────────────────────────────────────


@runtime_checkable
class PaymentGateway(Protocol):
    """Adapter contract. ``slug`` must be unique across registered providers."""

    slug: str

    async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult: ...

    async def capture(self, payment_id: str) -> CaptureResult: ...

    async def refund(
        self, payment_id: str, amount: Optional[Money] = None, *, reason: str = ""
    ) -> RefundResult: ...

    async def verify_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent: ...

    async def get_status(self, payment_id: str) -> PaymentStatus: ...
