"""Tenant-side payment system (launch-readiness § R4).

Modules:
  * gateway   — abstract ``PaymentGateway`` Protocol + value objects.
  * registry  — runtime registry of provider adapters.
  * cash_gateway, cod_gateway, stripe_gateway — fully-implemented adapters.
  * fastpay_gateway, qi_gateway, zain_cash_gateway, asia_pay_gateway —
    stubbed adapters that raise ``PaymentProviderNotConfigured`` until the
    corresponding R7.x credentials are obtained.

The R1 quick-create routes already provide ``/api/payment-methods`` for the
tenant-side PaymentMethod records; here we add the engine that actually
authorises money movement.
"""
from __future__ import annotations

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
from app.payments.registry import get, list_enabled, register

__all__ = [
    "CaptureResult",
    "InitiateResult",
    "Money",
    "PaymentGateway",
    "PaymentOrder",
    "PaymentProviderNotConfigured",
    "PaymentStatus",
    "RefundResult",
    "WebhookEvent",
    "get",
    "list_enabled",
    "register",
]
