"""Push-notification dispatch service.

Spec refs: growth-to-100 requirements.md §R5.9–§R5.10, design.md §5.4,
tasks.md T-G.5.12.

Uses the official ``firebase-admin`` SDK. FCM handles delivery to both
Android (native) and iOS (FCM routes through APNs internally as long as the
APNs auth key is uploaded to the Firebase Console — see the ops runbook).

Public helpers:
  send_to_user(tenant_id, user_id, payload, *, lang)
  send_to_tenant(tenant_id, payload, *, lang)
  send_to_topic(topic, payload, *, lang)
  send_to_device(tenant_id, device_id, payload, *, lang)

All helpers are sync-friendly (no asyncio) and return a delivery summary
dict so callers can log to Firestore for delivery-success monitoring
(R5.16 — when a tenant trips below 80% delivery, the in-app WebSocket
fallback is flipped on).

Localization: ``payload.title_i18n`` + ``payload.body_i18n`` (Dict[str, str])
are resolved using the recipient's last-known language. Falls back to ku.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)


# ── Lazy import of firebase-admin (avoids import-time crash if not installed) ─

_messaging = None


def _get_messaging():
    global _messaging
    if _messaging is not None:
        return _messaging
    try:
        from firebase_admin import messaging  # type: ignore
        _messaging = messaging
        return _messaging
    except Exception as e:  # noqa: BLE001
        logger.warning("firebase_admin.messaging unavailable: %s", e)
        _messaging = False  # sentinel: tried and failed
        return None


# ── Payload + resolver ───────────────────────────────────────────────────

@dataclass
class PushPayload:
    title_i18n: Dict[str, str] = field(default_factory=dict)
    body_i18n: Dict[str, str] = field(default_factory=dict)
    data: Dict[str, str] = field(default_factory=dict)
    # Optional category/click-action for OS routing.
    click_action: Optional[str] = None
    # iOS-specific: APNs alert sound.
    ios_sound: str = "default"
    # Android: notification channel id (must match a channel created on device).
    android_channel: str = "default"

    def localize(self, lang: str) -> Dict[str, str]:
        title = self.title_i18n.get(lang) or self.title_i18n.get("ku") or self.title_i18n.get("en") or ""
        body = self.body_i18n.get(lang) or self.body_i18n.get("ku") or self.body_i18n.get("en") or ""
        return {"title": title, "body": body}


@dataclass
class DeliveryResult:
    success_count: int = 0
    failure_count: int = 0
    invalid_tokens: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "invalid_token_count": len(self.invalid_tokens),
        }


# ── Internal builders ────────────────────────────────────────────────────

def _build_message_for_token(token: str, payload: PushPayload, lang: str):
    messaging = _get_messaging()
    if not messaging:
        return None
    loc = payload.localize(lang)
    return messaging.Message(
        token=token,
        notification=messaging.Notification(title=loc["title"], body=loc["body"]),
        data={k: str(v) for k, v in payload.data.items()},
        android=messaging.AndroidConfig(
            notification=messaging.AndroidNotification(
                channel_id=payload.android_channel,
                click_action=payload.click_action,
            ),
        ),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(sound=payload.ios_sound, badge=1),
            ),
        ),
    )


def _build_topic_message(topic: str, payload: PushPayload, lang: str):
    messaging = _get_messaging()
    if not messaging:
        return None
    loc = payload.localize(lang)
    return messaging.Message(
        topic=topic,
        notification=messaging.Notification(title=loc["title"], body=loc["body"]),
        data={k: str(v) for k, v in payload.data.items()},
    )


def _send_multicast(tokens: List[str], payload: PushPayload, lang: str) -> DeliveryResult:
    result = DeliveryResult()
    messaging = _get_messaging()
    if not messaging:
        logger.warning("FCM unavailable — skipping multicast of %d tokens", len(tokens))
        result.failure_count = len(tokens)
        return result
    if not tokens:
        return result

    # firebase-admin caps multicast at 500 tokens per call.
    for i in range(0, len(tokens), 500):
        chunk = tokens[i : i + 500]
        loc = payload.localize(lang)
        msg = messaging.MulticastMessage(
            tokens=chunk,
            notification=messaging.Notification(title=loc["title"], body=loc["body"]),
            data={k: str(v) for k, v in payload.data.items()},
        )
        try:
            resp = messaging.send_each_for_multicast(msg)
        except Exception as e:  # noqa: BLE001
            logger.exception("FCM multicast failed: %s", e)
            result.failure_count += len(chunk)
            continue

        result.success_count += resp.success_count
        result.failure_count += resp.failure_count

        for idx, r in enumerate(resp.responses):
            if not r.success:
                err_code = getattr(r.exception, "code", "") if r.exception else ""
                # Standard codes for "this token is dead" — caller prunes them.
                if err_code in ("registration-token-not-registered", "invalid-argument"):
                    result.invalid_tokens.append(chunk[idx])

    return result


# ── Public API ───────────────────────────────────────────────────────────

def send_to_topic(topic: str, payload: PushPayload, lang: str = "ku") -> DeliveryResult:
    """Send to a single FCM topic. Topic strings are validated by FCM
    (must match ``[A-Za-z0-9-_.~%]+``).
    """
    messaging = _get_messaging()
    result = DeliveryResult()
    if not messaging:
        result.failure_count = 1
        return result
    try:
        messaging.send(_build_topic_message(topic, payload, lang))
        result.success_count = 1
    except Exception as e:  # noqa: BLE001
        logger.exception("FCM topic send failed: %s", e)
        result.failure_count = 1
    return result


def send_to_tokens(
    tokens: Iterable[str],
    payload: PushPayload,
    lang: str = "ku",
) -> DeliveryResult:
    return _send_multicast(list(tokens), payload, lang)


def send_to_user(
    tenant_id: str,
    user_id: str,
    payload: PushPayload,
    lang: str = "ku",
) -> DeliveryResult:
    from app.firestore.mobile_devices import MobileDeviceRepository
    repo = MobileDeviceRepository(tenant_id)
    tokens = [d["fcm_token"] for d in repo.list_for_user(user_id) if d.get("fcm_token")]
    result = send_to_tokens(tokens, payload, lang)
    _prune_invalid_tokens(repo, result.invalid_tokens)
    return result


def send_to_tenant(
    tenant_id: str,
    payload: PushPayload,
    lang: str = "ku",
) -> DeliveryResult:
    """Send to every registered device in a tenant. For large tenants prefer
    `send_to_topic(f"tenant_{tenant_id}", ...)` which is server-load O(1)."""
    from app.firestore.mobile_devices import MobileDeviceRepository
    repo = MobileDeviceRepository(tenant_id)
    tokens = [d["fcm_token"] for d in repo.list_for_tenant() if d.get("fcm_token")]
    result = send_to_tokens(tokens, payload, lang)
    _prune_invalid_tokens(repo, result.invalid_tokens)
    return result


def subscribe_topic(tokens: List[str], topic: str) -> None:
    messaging = _get_messaging()
    if not messaging or not tokens:
        return
    for i in range(0, len(tokens), 1000):
        try:
            messaging.subscribe_to_topic(tokens[i : i + 1000], topic)
        except Exception as e:  # noqa: BLE001
            logger.warning("topic subscribe failed: %s", e)


def unsubscribe_topic(tokens: List[str], topic: str) -> None:
    messaging = _get_messaging()
    if not messaging or not tokens:
        return
    for i in range(0, len(tokens), 1000):
        try:
            messaging.unsubscribe_from_topic(tokens[i : i + 1000], topic)
        except Exception as e:  # noqa: BLE001
            logger.warning("topic unsubscribe failed: %s", e)


# ── Maintenance ──────────────────────────────────────────────────────────

def _prune_invalid_tokens(repo, tokens: List[str]) -> None:
    """Delete devices whose tokens FCM reported as dead. Best-effort."""
    for tok in tokens:
        try:
            existing = repo.find_by_token(tok)
            if existing:
                repo.delete(existing["id"])
        except Exception as e:  # noqa: BLE001
            logger.warning("prune token failed: %s", e)
