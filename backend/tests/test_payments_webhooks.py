"""Webhook ingress contract tests (launch-readiness § R4.9).

These cover the dispatching behaviour in ``app/api/payments.py`` independent
of the provider SDK: registry lookup, signature failure handling, dedup, and
status mapping.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.payments import router as payments_router
from app.payments import registry as registry_mod
from app.payments.gateway import (
    PaymentStatus,
    WebhookEvent,
    WebhookSignatureInvalid,
)
from app.services.auth import get_current_user


def _admin():
    return {"id": "u1", "org_id": "org-1", "role": "admin", "is_active": True}


def _client():
    app = FastAPI()
    app.include_router(payments_router)
    app.dependency_overrides[get_current_user] = _admin
    return TestClient(app, raise_server_exceptions=False)


def _fake_provider(slug: str, *, verify_returns=None, verify_raises=None):
    fp = MagicMock()
    fp.slug = slug

    async def _verify(headers, body):
        if verify_raises:
            raise verify_raises
        return verify_returns

    fp.verify_webhook.side_effect = _verify
    return fp


def test_webhook_unknown_provider_returns_404():
    registry_mod.clear()
    res = _client().post("/api/payments/webhooks/nope", content=b"{}")
    assert res.status_code == 404


def test_webhook_invalid_signature_returns_400():
    registry_mod.clear()
    registry_mod.register(_fake_provider(
        "stripe", verify_raises=WebhookSignatureInvalid("bad")))
    res = _client().post(
        "/api/payments/webhooks/stripe",
        content=b"{}", headers={"stripe-signature": "garbage"},
    )
    assert res.status_code == 400


def test_webhook_noop_event_returns_ok():
    registry_mod.clear()
    registry_mod.register(_fake_provider(
        "cash",
        verify_returns=WebhookEvent(
            provider_slug="cash", provider_event_id="", event_type="noop",
        ),
    ))
    res = _client().post("/api/payments/webhooks/cash", content=b"{}")
    assert res.status_code == 200
    assert res.json() == {"ok": True, "noop": True}


def test_webhook_dedups_replayed_event():
    registry_mod.clear()
    event = WebhookEvent(
        provider_slug="stripe", provider_event_id="evt_dup",
        event_type="payment_intent.succeeded", payment_id="pi_1",
        raw={"data": {"object": {"metadata": {"org_id": "org-1"}}}},
    )
    registry_mod.register(_fake_provider("stripe", verify_returns=event))
    with patch("app.api.payments.WebhookEventLogRepository") as log_cls, \
         patch("app.api.payments.PaymentRepository") as pay_cls:
        log = log_cls.return_value
        log.has_seen.return_value = True
        res = _client().post("/api/payments/webhooks/stripe", content=b"{}")
    assert res.status_code == 200
    assert res.json() == {"ok": True, "dedup": True}
    pay_cls.assert_not_called()


def test_webhook_succeeded_event_flips_local_payment_status():
    registry_mod.clear()
    event = WebhookEvent(
        provider_slug="stripe", provider_event_id="evt_new",
        event_type="payment_intent.succeeded", payment_id="pi_1",
        raw={"data": {"object": {"metadata": {"org_id": "org-1"}}}},
    )
    registry_mod.register(_fake_provider("stripe", verify_returns=event))
    with patch("app.api.payments.WebhookEventLogRepository") as log_cls, \
         patch("app.api.payments.PaymentRepository") as pay_cls:
        log_cls.return_value.has_seen.return_value = False
        pay_repo = pay_cls.return_value
        pay_repo.find_by_provider_reference.return_value = {"id": "local-1"}
        res = _client().post("/api/payments/webhooks/stripe", content=b"{}")
    assert res.status_code == 200
    pay_repo.update_status.assert_called_once()
    call_args = pay_repo.update_status.call_args
    assert call_args.args[0] == "local-1"
    assert call_args.args[1] == PaymentStatus.succeeded
