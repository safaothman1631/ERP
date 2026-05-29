"""Stripe gateway tests (launch-readiness § R4.8).

Most tests run without the ``stripe`` SDK installed by exercising signature
verification + status mapping + configuration guards directly. Tests that
need actual SDK behaviour (``initiate``, ``capture``) are gated on
``pytest.importorskip('stripe')``.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.payments.gateway import (
    Money,
    PaymentOrder,
    PaymentProviderNotConfigured,
    PaymentStatus,
    WebhookSignatureInvalid,
)
from app.payments.stripe_gateway import StripeGateway


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _signed(secret: str, body: bytes, ts: int | None = None) -> tuple[str, bytes]:
    ts = ts or int(time.time())
    signed = f"{ts}.".encode() + body
    sig = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}", body


def test_no_secret_key_raises_not_configured():
    gw = StripeGateway(repo_factory=lambda org: MagicMock(), secret_key=None,
                       webhook_secret=None)
    with pytest.raises(PaymentProviderNotConfigured):
        _run(gw.initiate(
            Money(amount=Decimal("10"), currency="USD"),
            PaymentOrder(metadata={"org_id": "org-1"}),
        ))


def test_verify_webhook_no_secret_raises():
    gw = StripeGateway(repo_factory=lambda org: MagicMock(),
                       secret_key="sk_test_xyz", webhook_secret=None)
    with pytest.raises(PaymentProviderNotConfigured):
        _run(gw.verify_webhook({}, b"{}"))


def test_verify_webhook_valid_signature_parses_event():
    secret = "whsec_test"
    body = json.dumps({
        "id": "evt_123",
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_abc"}},
    }).encode()
    sig_header, _ = _signed(secret, body)
    gw = StripeGateway(repo_factory=lambda org: MagicMock(),
                       secret_key="sk_test_xyz", webhook_secret=secret)
    event = _run(gw.verify_webhook({"stripe-signature": sig_header}, body))
    assert event.provider_event_id == "evt_123"
    assert event.event_type == "payment_intent.succeeded"
    assert event.payment_id == "pi_abc"


def test_verify_webhook_tampered_body_rejected():
    secret = "whsec_test"
    body = b'{"id":"evt_1","type":"x"}'
    sig_header, _ = _signed(secret, body)
    tampered = b'{"id":"evt_1","type":"x","extra":true}'
    gw = StripeGateway(repo_factory=lambda org: MagicMock(),
                       secret_key="sk_test_xyz", webhook_secret=secret)
    with pytest.raises(WebhookSignatureInvalid):
        _run(gw.verify_webhook({"stripe-signature": sig_header}, tampered))


def test_verify_webhook_old_timestamp_rejected():
    secret = "whsec_test"
    body = b'{"id":"evt_old","type":"x"}'
    sig_header, _ = _signed(secret, body, ts=int(time.time()) - 600)
    gw = StripeGateway(repo_factory=lambda org: MagicMock(),
                       secret_key="sk_test_xyz", webhook_secret=secret)
    with pytest.raises(WebhookSignatureInvalid, match="tolerance"):
        _run(gw.verify_webhook({"stripe-signature": sig_header}, body))


def test_verify_webhook_missing_header_rejected():
    gw = StripeGateway(repo_factory=lambda org: MagicMock(),
                       secret_key="sk_test_xyz", webhook_secret="whsec_test")
    with pytest.raises(WebhookSignatureInvalid, match="missing"):
        _run(gw.verify_webhook({}, b"{}"))


def test_money_minor_units_usd():
    assert Money(amount=Decimal("12.50"), currency="USD").minor_units() == 1250


def test_money_minor_units_iqd_has_no_minor_unit():
    assert Money(amount=Decimal("1500"), currency="IQD").minor_units() == 1500


def test_initiate_calls_stripe_sdk():
    """When ``stripe`` is installed, ``initiate`` creates a PaymentIntent."""
    pytest.importorskip("stripe")
    repo = MagicMock()
    repo.create_payment.return_value = {"id": "local-pay-1"}
    gw = StripeGateway(repo_factory=lambda org: repo, secret_key="sk_test_xyz",
                       webhook_secret="whsec_test", publishable_key="pk_test_xyz")
    fake_intent = {"id": "pi_test", "status": "requires_payment_method",
                   "client_secret": "pi_test_secret_xyz"}
    with patch("stripe.PaymentIntent.create", return_value=fake_intent) as create_call:
        result = _run(gw.initiate(
            Money(amount=Decimal("10.00"), currency="USD"),
            PaymentOrder(invoice_id="inv-9", metadata={"org_id": "org-1"}),
        ))
    create_call.assert_called_once()
    assert result.next_action_kind == "client_secret"
    assert result.next_action["publishable_key"] == "pk_test_xyz"
