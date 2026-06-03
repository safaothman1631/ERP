"""Security tests for the PUBLIC Iraq payment webhooks (HMAC verification).

Covers the fix that closes a fraud vector: the public webhooks
``POST /api/iraq-payments/webhook/fib`` and ``/webhook/zain-cash`` previously
identified the tenant via an ``org_id`` query param and did NO signature
verification, so a forged POST could mark invoices paid. They now require an
HMAC-SHA256 ``X-Webhook-Signature`` header over the raw body, keyed by
``settings.IRAQ_PAYMENT_WEBHOOK_SECRET``.

Cases:
  (a) no secret configured            → 503 (disabled, safe-by-default)
  (b) bad / missing signature         → 401
  (c) valid signature                 → success path (reaches callback logic)

These follow the repo-mocking pattern used by ``test_payments_webhooks.py`` and
``tests/quick_create/conftest.py``: a tiny FastAPI app is built around just the
router, ``settings.IRAQ_PAYMENT_WEBHOOK_SECRET`` is monkeypatched per-case, and
the Firestore repositories + idempotency helpers are patched so no real
Firestore connection is required.

NOTE: the backend venv is Windows-only — run with ``pytest`` on Windows.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import iraq_payments
from app.api.iraq_payments import router as iraq_payments_router

SECRET = "test-iraq-webhook-secret-0123456789abcdef"
SIGNATURE_HEADER = "X-Webhook-Signature"

# Both public webhooks share the same verification helper; exercise both.
WEBHOOK_PATHS = [
    "/api/iraq-payments/webhook/fib?org_id=org-1",
    "/api/iraq-payments/webhook/zain-cash?org_id=org-1",
]


def _client() -> TestClient:
    """Public webhooks need no auth override — mount the router bare."""
    app = FastAPI()
    app.include_router(iraq_payments_router)
    return TestClient(app, raise_server_exceptions=False)


def _body(status: str = "success") -> bytes:
    """A valid PaymentCallback payload serialised exactly as it will be signed."""
    return json.dumps(
        {"provider_reference": "FIB-20260603-abc", "status": status, "raw_payload": {}}
    ).encode("utf-8")


def _sign(raw: bytes, secret: str = SECRET) -> str:
    return hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()


# ── (a) no secret configured → 503 ──────────────────────────────────────────
@pytest.mark.parametrize("path", WEBHOOK_PATHS)
def test_webhook_no_secret_configured_returns_503(monkeypatch, path):
    monkeypatch.setattr(iraq_payments.settings, "IRAQ_PAYMENT_WEBHOOK_SECRET", "")
    raw = _body()
    # Even with a (meaningless) signature present, an unset secret must disable.
    res = _client().post(path, content=raw, headers={SIGNATURE_HEADER: _sign(raw)})
    assert res.status_code == 503
    assert "not configured" in res.json()["detail"]


@pytest.mark.parametrize("path", WEBHOOK_PATHS)
def test_webhook_whitespace_only_secret_returns_503(monkeypatch, path):
    monkeypatch.setattr(iraq_payments.settings, "IRAQ_PAYMENT_WEBHOOK_SECRET", "   ")
    raw = _body()
    res = _client().post(path, content=raw, headers={SIGNATURE_HEADER: _sign(raw)})
    assert res.status_code == 503


# ── (b) bad / missing signature → 401 ───────────────────────────────────────
@pytest.mark.parametrize("path", WEBHOOK_PATHS)
def test_webhook_missing_signature_header_returns_401(monkeypatch, path):
    monkeypatch.setattr(iraq_payments.settings, "IRAQ_PAYMENT_WEBHOOK_SECRET", SECRET)
    res = _client().post(path, content=_body())  # no X-Webhook-Signature header
    assert res.status_code == 401
    assert res.json()["detail"] == "invalid signature"


@pytest.mark.parametrize("path", WEBHOOK_PATHS)
def test_webhook_bad_signature_returns_401(monkeypatch, path):
    monkeypatch.setattr(iraq_payments.settings, "IRAQ_PAYMENT_WEBHOOK_SECRET", SECRET)
    res = _client().post(
        path, content=_body(), headers={SIGNATURE_HEADER: "deadbeef" * 8}
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "invalid signature"


@pytest.mark.parametrize("path", WEBHOOK_PATHS)
def test_webhook_signature_for_different_body_returns_401(monkeypatch, path):
    """A valid signature over a *different* body must not authenticate this one
    (guards against tampering with the body after signing)."""
    monkeypatch.setattr(iraq_payments.settings, "IRAQ_PAYMENT_WEBHOOK_SECRET", SECRET)
    sig_for_other = _sign(_body(status="failed"))
    res = _client().post(
        path, content=_body(status="success"),
        headers={SIGNATURE_HEADER: sig_for_other},
    )
    assert res.status_code == 401


@pytest.mark.parametrize("path", WEBHOOK_PATHS)
def test_webhook_signature_with_wrong_secret_returns_401(monkeypatch, path):
    monkeypatch.setattr(iraq_payments.settings, "IRAQ_PAYMENT_WEBHOOK_SECRET", SECRET)
    raw = _body()
    res = _client().post(
        path, content=raw, headers={SIGNATURE_HEADER: _sign(raw, secret="wrong-secret")}
    )
    assert res.status_code == 401


# ── (c) valid signature → success path ──────────────────────────────────────
@pytest.mark.parametrize("path,gateway", [
    (WEBHOOK_PATHS[0], "fib"),
    (WEBHOOK_PATHS[1], "zain_cash"),
])
def test_webhook_valid_signature_reaches_callback(monkeypatch, path, gateway):
    """Valid signature → request is authenticated and processed via
    ``_process_gateway_callback`` (invoice flipped to paid on success)."""
    monkeypatch.setattr(iraq_payments.settings, "IRAQ_PAYMENT_WEBHOOK_SECRET", SECRET)
    raw = _body(status="success")

    pmt_repo = MagicMock()
    pmt_repo.list.return_value = (
        [{"id": "pmt-1", "status": "pending", "invoice_id": "inv-1", "amount": 100}],
        1,
    )
    pmt_repo.update.return_value = {"id": "pmt-1", "status": "success"}
    inv_repo = MagicMock()
    inv_repo.get.return_value = {"id": "inv-1", "paid_amount": 0}

    with patch.object(iraq_payments, "IraqPaymentRepository", return_value=pmt_repo), \
         patch.object(iraq_payments, "InvoiceRepository", return_value=inv_repo), \
         patch("app.services.idempotency.get_cached_response", return_value=None), \
         patch("app.services.idempotency.store_response"):
        res = _client().post(path, content=raw, headers={SIGNATURE_HEADER: _sign(raw)})

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["payment_id"] == "pmt-1"
    assert body["status"] == "success"
    # The payment was looked up scoped to the gateway + reference and updated.
    pmt_repo.list.assert_called_once()
    pmt_repo.update.assert_called_once()
    # On success with a linked invoice, the invoice is marked paid.
    inv_repo.update.assert_called_once()
    paid_payload = inv_repo.update.call_args.args[1]
    assert paid_payload["payment_status"] == "paid"


@pytest.mark.parametrize("path", WEBHOOK_PATHS)
def test_webhook_valid_signature_but_payment_not_found_returns_404(monkeypatch, path):
    """Authentication succeeds (200-path entered), but an unknown reference still
    yields the existing 404 — proving the signed body flows into callback logic."""
    monkeypatch.setattr(iraq_payments.settings, "IRAQ_PAYMENT_WEBHOOK_SECRET", SECRET)
    raw = _body()

    pmt_repo = MagicMock()
    pmt_repo.list.return_value = ([], 0)  # no matching payment

    with patch.object(iraq_payments, "IraqPaymentRepository", return_value=pmt_repo), \
         patch("app.services.idempotency.get_cached_response", return_value=None), \
         patch("app.services.idempotency.store_response"):
        res = _client().post(path, content=raw, headers={SIGNATURE_HEADER: _sign(raw)})

    assert res.status_code == 404
    assert res.json()["detail"] == "payment not found"
