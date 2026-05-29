"""WhatsApp Business inbound routing (G2 / R2.9).

Inbound 360Dialog webhook hits :func:`handle_inbound_message`, which:

  1. Persists the raw payload to ``whatsapp_inbox/{message_id}``.
  2. Detects the message language (ku / ar / en) for downstream tagging.
  3. Decides a destination: ``bot``, ``human``, or ``tenant_support``.
  4. If outside support hours, queues an auto-reply pointing to the
     status page.

The bot is a thin FAQ classifier — a literal substring match against
common Kurdish/Arabic/English questions. Anything unmatched escalates
to ``human`` (Crisp/Intercom forwarding).

This module is **deliberately small** — the actual chat surface is in
Crisp; the backend's only job is to route, tag, log, and send the
out-of-hours auto-reply.
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, time, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────


SUPPORT_HOURS_START = time(9, 0)  # 09:00 Baghdad
SUPPORT_HOURS_END = time(20, 0)  # 20:00 Baghdad
SUPPORT_TIMEZONE = "Asia/Baghdad"

DEFAULT_AUTOREPLY = {
    "ku": (
        "ئەم پەیامەت وەرگیرا. کاتی پشتگیری ٩ سەعات بۆ ٢٠ بەکاتی بەغداد. "
        "بۆ بارودۆخی خزمەتگوزاری بڕوانە: https://status.zoho-kurdish.iq"
    ),
    "ar": (
        "تم استلام رسالتك. أوقات الدعم 9 صباحًا - 8 مساءً بتوقيت بغداد. "
        "للحالة الخدمية: https://status.zoho-kurdish.iq"
    ),
    "en": (
        "Thanks — your message is received. Support hours are 09:00–20:00 "
        "Baghdad time. Service status: https://status.zoho-kurdish.iq"
    ),
}


# ── Language detection (cheap heuristic) ──────────────────────────────────


_KURDISH_LETTERS = re.compile(r"[ێۆڕڵڤ]")  # letters distinctive to sorani
_ARABIC_BLOCK = re.compile(r"[؀-ۿ]")


def detect_language(text: str) -> str:
    """Return ``ku``, ``ar``, or ``en``."""
    if not text:
        return "en"
    if _KURDISH_LETTERS.search(text):
        return "ku"
    if _ARABIC_BLOCK.search(text):
        return "ar"
    return "en"


# ── Bot FAQ classifier ────────────────────────────────────────────────────


_FAQ_PATTERNS: tuple[tuple[str, str], ...] = (
    (r"\bprice|پلان|قیمە|سعر\b", "pricing"),
    (r"\binvoice|فاکتور|فاتورة\b", "invoicing"),
    (r"\bpos|فرۆشگا|نقاط\b", "pos"),
    (r"\blogin|چونەژوور|تسجيل\b", "login"),
    (r"\boffline|ئۆفلاین|دون اتصال\b", "offline"),
    (r"\bwhatsapp\b", "whatsapp"),
)


def classify_intent(text: str) -> Optional[str]:
    low = (text or "").lower()
    for pat, intent in _FAQ_PATTERNS:
        if re.search(pat, low, re.IGNORECASE):
            return intent
    return None


# ── Support hours ─────────────────────────────────────────────────────────


def is_in_support_hours(now: Optional[datetime] = None) -> bool:
    now = now or datetime.now(timezone.utc)
    try:
        from zoneinfo import ZoneInfo

        baghdad = now.astimezone(ZoneInfo(SUPPORT_TIMEZONE)).time()
    except Exception:  # noqa: BLE001
        # Fall back to UTC if zoneinfo data missing.
        baghdad = now.time()
    return SUPPORT_HOURS_START <= baghdad <= SUPPORT_HOURS_END


# ── Inbound entry point ───────────────────────────────────────────────────


def _persist_inbound(payload: dict) -> Optional[str]:
    try:
        from app.firebase_client import get_db

        msg_id = payload.get("id") or payload.get("message_id") or None
        if not msg_id:
            import uuid

            msg_id = uuid.uuid4().hex
        get_db().collection("whatsapp_inbox").document(msg_id).set(
            {**payload, "_received_at": datetime.now(timezone.utc)}
        )
        return msg_id
    except Exception as exc:  # noqa: BLE001
        logger.warning("whatsapp.persist_failed", extra={"err": str(exc)})
        return None


def _outbound_text(text: str, to: str) -> bool:
    """Send via 360Dialog. No-op when the env vars are missing."""
    token = os.environ.get("DIALOG360_API_KEY")
    base = os.environ.get(
        "DIALOG360_API_URL", "https://waba.360dialog.io/v1/messages"
    )
    if not token:
        logger.info(
            "whatsapp.outbound_skipped",
            extra={"reason": "missing_api_key", "to": to[-4:]},
        )
        return False
    try:
        import httpx  # type: ignore

        with httpx.Client(timeout=8.0) as cli:
            r = cli.post(
                base,
                headers={"D360-API-KEY": token, "Content-Type": "application/json"},
                json={
                    "to": to,
                    "type": "text",
                    "text": {"body": text},
                },
            )
        return r.status_code < 300
    except Exception as exc:  # noqa: BLE001
        logger.warning("whatsapp.outbound_failed", extra={"err": str(exc)})
        return False


def _forward_to_crisp(payload: dict, lang: str, intent: Optional[str]) -> bool:
    """Forward inbound message to Crisp via website-update API."""
    crisp_id = os.environ.get("CRISP_WEBSITE_ID")
    crisp_key = os.environ.get("CRISP_API_KEY")
    crisp_user = os.environ.get("CRISP_API_IDENTIFIER")
    if not (crisp_id and crisp_key and crisp_user):
        logger.info("whatsapp.crisp_skipped", extra={"reason": "missing_env"})
        return False
    try:
        import base64
        import httpx  # type: ignore

        creds = base64.b64encode(f"{crisp_user}:{crisp_key}".encode()).decode()
        headers = {
            "Authorization": f"Basic {creds}",
            "X-Crisp-Tier": "plugin",
            "Content-Type": "application/json",
        }
        body = {
            "type": "text",
            "from": "user",
            "origin": "chat",
            "content": payload.get("text") or payload.get("body") or "",
            "fingerprint": int(
                (payload.get("id") or "0").replace("-", "")[:12] or 0, 16
            )
            if payload.get("id")
            else None,
            "metadata": {
                "channel": "whatsapp",
                "language": lang,
                "intent": intent,
                "from_msisdn": payload.get("from"),
            },
        }
        with httpx.Client(timeout=6.0) as cli:
            r = cli.post(
                f"https://api.crisp.chat/v1/website/{crisp_id}/conversation/whatsapp/message",
                headers=headers,
                json=body,
            )
        return r.status_code < 300
    except Exception as exc:  # noqa: BLE001
        logger.warning("whatsapp.crisp_forward_failed", extra={"err": str(exc)})
        return False


def handle_inbound_message(payload: dict) -> dict:
    """Process a 360Dialog inbound webhook payload.

    Returns a dict describing the routing decision (used by the webhook
    handler to build its response).
    """
    text = payload.get("text") or payload.get("body") or ""
    from_msisdn = payload.get("from") or payload.get("msisdn") or ""

    lang = detect_language(text)
    intent = classify_intent(text)
    msg_id = _persist_inbound(payload)
    in_hours = is_in_support_hours()

    decision = {
        "msg_id": msg_id,
        "language": lang,
        "intent": intent,
        "in_support_hours": in_hours,
        "destination": "human",
        "auto_reply_sent": False,
    }

    if intent in {"pricing", "pos", "invoicing", "login", "offline"}:
        # Bot handles common FAQs; we still forward to Crisp for visibility.
        decision["destination"] = "bot"

    # Out-of-hours: always queue the auto-reply pointing at the status page.
    if not in_hours and from_msisdn:
        decision["auto_reply_sent"] = _outbound_text(
            DEFAULT_AUTOREPLY.get(lang, DEFAULT_AUTOREPLY["en"]),
            from_msisdn,
        )

    # Always forward to Crisp so a human can pick it up if needed.
    decision["forwarded_to_crisp"] = _forward_to_crisp(payload, lang, intent)

    logger.info(
        "whatsapp.routed",
        extra={k: v for k, v in decision.items() if k != "auto_reply_sent"},
    )
    return decision


__all__ = [
    "handle_inbound_message",
    "detect_language",
    "classify_intent",
    "is_in_support_hours",
    "DEFAULT_AUTOREPLY",
]
