"""Inbound support-email routing (G2 / R2.8).

Triggered when ``support@zoho-kurdish.iq`` receives an email. The
delivery service (SendGrid inbound parse, Postmark, or a Cloud Function)
POSTs the parsed envelope to :func:`handle_inbound_email`. We then:

  1. Detect language and classify (bug | billing | how-to | other).
  2. Create a ticket in Crisp/Intercom via their inbound API.
  3. Write a row to ``support_tickets`` for our own analytics.
  4. Send an auto-reply with the ticket number and expected response time.

The actual customer ticketing system is Crisp (per ADR-G-04). We keep a
local mirror so we can build internal dashboards independent of Crisp.
"""
from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.services.whatsapp_routing import detect_language

logger = logging.getLogger(__name__)


# ── Constants ─────────────────────────────────────────────────────────────


SLA_BY_PLAN: dict[str, str] = {
    # Free trial → next business day.
    "free": "1 business day",
    "starter": "4 business hours",
    "growth": "2 business hours",
    "enterprise": "30 minutes",
}

AUTOREPLY_TEMPLATES: dict[str, str] = {
    "ku": (
        "سپاس بۆ پەیوەندیکردنت! تیکێتی پشتگیریت بەناوی #{ticket_id} دروستکرا. "
        "وەڵامەکەت لە ماوەی {sla} دەگەیتە دەستت.\n\n"
        "ـ تیمی پشتگیری Zoho Kurdish"
    ),
    "ar": (
        "شكرًا للتواصل! تم إنشاء تذكرة الدعم #{ticket_id}. "
        "ستتلقى ردًا خلال {sla}.\n\n"
        "- فريق دعم Zoho Kurdish"
    ),
    "en": (
        "Thanks for contacting us — ticket #{ticket_id} has been opened. "
        "You'll hear back within {sla}.\n\n"
        "— Zoho Kurdish support"
    ),
}


# ── Classification ────────────────────────────────────────────────────────


_CATEGORIES: tuple[tuple[str, str], ...] = (
    # Order matters — first match wins. "how do i …" questions are intent-driven
    # and must beat the billing keyword scan (e.g. "how do i create an invoice?"
    # is a how-to, not a billing ticket). Bug/error reports stay highest priority.
    (r"\b(bug|crash|error|exception|500|503)\b", "bug"),
    (r"\b(how to|how do i|چۆن|كيف)\b", "how-to"),
    (r"\b(invoice|charge|billing|refund|پارە|فاتورة)\b", "billing"),
    (r"\b(login|sign in|password|چونەژوور|تسجيل)\b", "auth"),
)


def classify(subject: str, body: str) -> str:
    text = f"{subject or ''} {body or ''}".lower()
    for pat, label in _CATEGORIES:
        if re.search(pat, text, re.IGNORECASE):
            return label
    return "other"


# ── Crisp ingestion ───────────────────────────────────────────────────────


def _forward_to_crisp(
    *,
    from_email: str,
    subject: str,
    body: str,
    language: str,
    category: str,
    ticket_id: str,
) -> bool:
    crisp_id = os.environ.get("CRISP_WEBSITE_ID")
    crisp_key = os.environ.get("CRISP_API_KEY")
    crisp_user = os.environ.get("CRISP_API_IDENTIFIER")
    if not (crisp_id and crisp_key and crisp_user):
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
        body_payload = {
            "type": "text",
            "from": "user",
            "origin": "email",
            "content": f"Subject: {subject}\n\n{body}",
            "user": {"email": from_email},
            "metadata": {
                "channel": "email",
                "language": language,
                "category": category,
                "internal_ticket_id": ticket_id,
            },
        }
        with httpx.Client(timeout=6.0) as cli:
            r = cli.post(
                f"https://api.crisp.chat/v1/website/{crisp_id}/conversation/email/message",
                headers=headers,
                json=body_payload,
            )
        return r.status_code < 300
    except Exception as exc:  # noqa: BLE001
        logger.warning("email.crisp_forward_failed", extra={"err": str(exc)})
        return False


# ── Auto-reply ────────────────────────────────────────────────────────────


def _send_autoreply(to_email: str, ticket_id: str, language: str, plan: str) -> bool:
    """Best-effort outbound. Delegates to the existing mail service."""
    template = AUTOREPLY_TEMPLATES.get(language, AUTOREPLY_TEMPLATES["en"])
    msg = template.format(ticket_id=ticket_id, sla=SLA_BY_PLAN.get(plan, "1 business day"))

    try:
        from app.services.mail import send_email  # type: ignore

        send_email(
            to=to_email,
            subject=f"[Ticket #{ticket_id}] Zoho Kurdish support",
            body=msg,
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.info(
            "email.autoreply_skipped",
            extra={"err": str(exc), "to": to_email[-12:]},
        )
        return False


# ── Public entry-point ────────────────────────────────────────────────────


def handle_inbound_email(envelope: dict) -> dict:
    """Process a parsed inbound email envelope.

    ``envelope`` must contain ``from_email``, ``subject``, ``body``; the
    plan is looked up from the contact registry if available.
    """
    from_email = (envelope.get("from_email") or envelope.get("from") or "").strip()
    subject = envelope.get("subject") or ""
    body = envelope.get("body") or envelope.get("text") or ""

    language = detect_language(body or subject)
    category = classify(subject, body)
    plan = (envelope.get("plan") or "free").lower()
    ticket_id = uuid.uuid4().hex[:10]
    now = datetime.now(timezone.utc)

    # Local mirror — never raises.
    try:
        from app.firebase_client import get_db

        get_db().collection("support_tickets").document(ticket_id).set(
            {
                "ticket_id": ticket_id,
                "channel": "email",
                "from_email": from_email,
                "subject": subject,
                "body": body,
                "language": language,
                "category": category,
                "plan": plan,
                "status": "open",
                "created_at": now,
            }
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("email.ticket_write_failed", extra={"err": str(exc)})

    forwarded = _forward_to_crisp(
        from_email=from_email,
        subject=subject,
        body=body,
        language=language,
        category=category,
        ticket_id=ticket_id,
    )
    autoreplied = _send_autoreply(from_email, ticket_id, language, plan)

    return {
        "ticket_id": ticket_id,
        "language": language,
        "category": category,
        "forwarded_to_crisp": forwarded,
        "autoreply_sent": autoreplied,
    }


__all__ = [
    "handle_inbound_email",
    "classify",
    "SLA_BY_PLAN",
    "AUTOREPLY_TEMPLATES",
]
