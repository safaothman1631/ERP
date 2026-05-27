"""Outbound webhook dispatcher.

Reads configuration from settings bag `webhooks`:
- endpoints: list[{url, events, active, secret}]
- signing_secret: str (global fallback)
- retry_count: int (default 3)
- timeout_seconds: int (default 10)
- delivery_log_enabled: bool (default True)

Usage from any handler:
    from app.services.webhook_dispatcher import dispatch_event
    dispatch_event(org_id, "invoice.created", {"id": doc_id, "total": 100})

Delivery is fire-and-forget on a background thread; failures are logged
but do NOT raise to the caller.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import threading
import time
from typing import Any
from urllib import request as urlrequest
from urllib.error import URLError

from app.services import settings_service

logger = logging.getLogger("webhook_dispatcher")

_DEFAULT_TIMEOUT = 10
_DEFAULT_RETRIES = 3


def _sign(payload: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _post_one(url: str, payload: bytes, signature: str, event: str, timeout: int) -> tuple[int, str]:
    req = urlrequest.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            "X-Webhook-Signature": f"sha256={signature}",
            "User-Agent": "ZohoERP-Webhook/1.0",
        },
    )
    try:
        with urlrequest.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read(1024).decode("utf-8", errors="ignore")
    except URLError as exc:
        return 0, str(exc)


def _enqueue_inbox(org_id: str, event: str, body: dict[str, Any]) -> str | None:
    """Persist outbound event to ``webhook_inbox`` for TTL + retry (Wave I/T)."""
    try:
        from datetime import datetime

        from app.firebase_client import get_db
        from app.services.ttl_fields import expires_at_from_hours

        doc_id = hashlib.sha256(f"{org_id}:{event}:{time.time()}".encode()).hexdigest()[:24]
        get_db().collection("webhook_inbox").document(doc_id).set({
            "org_id": org_id,
            "event_type": event,
            "payload": body,
            "status": "pending",
            "created_at": datetime.utcnow(),
            "expires_at": expires_at_from_hours(24 * 7),
        })
        return doc_id
    except Exception as exc:
        logger.debug("webhook_inbox_enqueue_failed: %s", exc)
        return None


def _deliver(org_id: str, event: str, body: dict[str, Any]) -> None:
    _enqueue_inbox(org_id, event, body)
    try:
        cfg = settings_service.get_bag(org_id, "webhooks") or {}
    except Exception:
        return
    endpoints = cfg.get("endpoints") or []
    if not endpoints:
        return
    global_secret = cfg.get("signing_secret") or ""
    timeout = int(cfg.get("timeout_seconds") or _DEFAULT_TIMEOUT)
    retries = max(1, int(cfg.get("retry_count") or _DEFAULT_RETRIES))
    payload = json.dumps({"event": event, "org_id": org_id, "data": body, "ts": int(time.time())}, default=str).encode("utf-8")

    for ep in endpoints:
        if not isinstance(ep, dict):
            continue
        if not ep.get("active", True):
            continue
        url = ep.get("url")
        if not url:
            continue
        events_filter = ep.get("events") or []
        if events_filter and event not in events_filter and "*" not in events_filter:
            continue
        secret = ep.get("secret") or global_secret
        signature = _sign(payload, secret) if secret else ""
        for attempt in range(1, retries + 1):
            status, msg = _post_one(url, payload, signature, event, timeout)
            if 200 <= status < 300:
                logger.info("webhook delivered event=%s url=%s status=%s", event, url, status)
                break
            logger.warning("webhook attempt %s failed event=%s url=%s status=%s msg=%s", attempt, event, url, status, msg[:200])
            if attempt < retries:
                time.sleep(min(2 ** attempt, 10))


def dispatch_event(org_id: str, event: str, body: dict[str, Any]) -> None:
    """Fire-and-forget webhook dispatch on a daemon thread."""
    if not org_id or not event:
        return
    try:
        t = threading.Thread(target=_deliver, args=(org_id, event, body), daemon=True)
        t.start()
    except Exception as exc:
        logger.error("dispatch_event failed: %s", exc)


def test_delivery(
    url: str,
    org_id: str,
    event: str = "webhook.test",
    secret: str | None = None,
) -> dict[str, Any]:
    """Synchronously POST a test payload to *url* and return delivery outcome."""
    try:
        cfg = settings_service.get_bag(org_id, "webhooks") or {}
    except Exception:
        cfg = {}
    global_secret = secret if secret is not None else (cfg.get("signing_secret") or "")
    timeout = int(cfg.get("timeout_seconds") or _DEFAULT_TIMEOUT)
    payload = json.dumps(
        {"event": event, "org_id": org_id, "data": {"test": True}, "ts": int(time.time())},
        default=str,
    ).encode("utf-8")
    signature = _sign(payload, global_secret) if global_secret else ""
    status, msg = _post_one(url, payload, signature, event, timeout)
    return {
        "success": 200 <= status < 300,
        "status": status,
        "message": msg[:500],
        "event": event,
        "url": url,
    }
