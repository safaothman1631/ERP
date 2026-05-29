"""Tenant onboarding drip campaign (G2 / R2.14).

Triggered on tenant create. Schedules a series of emails at:

  * Day 0 / Day 1 — welcome
  * Day 3 — tutorial video
  * Day 7 — tips & deeper-feature nudge
  * Day 14 — feedback survey
  * Day 30 — NPS prompt

Implementation pattern: enqueue a single document per email at the
``drip_queue/{tenant_id}-{template}`` doc path with ``send_at`` set to
the target time. An APScheduler job
(``app.services.scheduler_jobs.dispatch_due_drip``, ran every 10 min)
sweeps documents whose ``send_at <= now`` and ``sent_at IS NULL``,
delivers them via the mail service, and stamps ``sent_at``.

This module is responsible only for:

  * Scheduling — :func:`schedule_for_tenant`
  * Dispatch — :func:`dispatch_due` (called from the scheduler job)
  * Template registration — :data:`DRIP_STEPS`
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Each step: (offset_days, template_key, subject_by_lang)
DRIP_STEPS: tuple[tuple[int, str, dict[str, str]], ...] = (
    (
        1,
        "welcome",
        {
            "ku": "بەخێربێیت بۆ Zoho Kurdish — یەکەم فاکتورت دروست بکە",
            "ar": "مرحبا بك في Zoho Kurdish — أنشئ أول فاتورة",
            "en": "Welcome to Zoho Kurdish — create your first invoice",
        },
    ),
    (
        3,
        "tutorial_video",
        {
            "ku": "ڤیدیۆی ڕێبەری ٥ خولەکی — لێرە دەستپێبکە",
            "ar": "فيديو إرشادي 5 دقائق - ابدأ هنا",
            "en": "A 5-minute tutorial video to get you running",
        },
    ),
    (
        7,
        "tips",
        {
            "ku": "٧ تیپس بۆ زیادکردنی بەرهەمهێنان لە Zoho Kurdish",
            "ar": "7 نصائح لتعزيز إنتاجيتك",
            "en": "7 tips to get more from Zoho Kurdish in week 2",
        },
    ),
    (
        14,
        "feedback",
        {
            "ku": "چۆن بوو ٢ هەفتەی یەکەمت؟ بڕیارت پێ بدە",
            "ar": "كيف كان أول أسبوعين؟ شاركنا رأيك",
            "en": "How did your first two weeks go? Tell us",
        },
    ),
    (
        30,
        "nps",
        {
            "ku": "تەنها یەک پرسیار: چەند Zoho Kurdish پێشنیار دەکەیت؟",
            "ar": "سؤال واحد فقط: مدى استعدادك لتوصية Zoho Kurdish؟",
            "en": "Just one question: how likely are you to recommend us?",
        },
    ),
)


DRIP_COLLECTION = "drip_queue"


# ── Schedule on tenant create ─────────────────────────────────────────────


def _doc_id(tenant_id: str, template_key: str) -> str:
    return f"{tenant_id}__{template_key}"


def schedule_for_tenant(
    tenant_id: str,
    *,
    tenant_email: Optional[str] = None,
    locale: str = "ku",
    signup_at: Optional[datetime] = None,
) -> list[dict]:
    """Enqueue every drip step for a freshly-created tenant.

    Idempotent: re-running won't duplicate rows because the doc id is
    deterministic.
    """
    now = (signup_at or datetime.now(timezone.utc)).astimezone(timezone.utc)
    rows: list[dict] = []
    try:
        from app.firebase_client import get_db

        db = get_db()
        for offset_days, template_key, subjects in DRIP_STEPS:
            send_at = now + timedelta(days=offset_days)
            doc_id = _doc_id(tenant_id, template_key)
            row = {
                "tenant_id": tenant_id,
                "template_key": template_key,
                "subject": subjects.get(locale, subjects["en"]),
                "to_email": tenant_email,
                "locale": locale,
                "send_at": send_at,
                "sent_at": None,
                "status": "pending",
                "created_at": now,
            }
            db.collection(DRIP_COLLECTION).document(doc_id).set(row, merge=False)
            rows.append(row)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "drip.schedule_failed",
            extra={"err": str(exc), "tenant": tenant_id},
        )
    return rows


# ── Dispatch (called from scheduler) ──────────────────────────────────────


def _render_template(template_key: str, locale: str, context: dict) -> str:
    """Look up the rendered body from
    ``backend/app/data/email_templates/{template_key}.{locale}.txt`` —
    falling back to the English version and finally a generic body."""
    from pathlib import Path

    base = Path(__file__).resolve().parents[1] / "data" / "email_templates"
    candidates = [
        base / f"{template_key}.{locale}.txt",
        base / f"{template_key}.en.txt",
    ]
    for path in candidates:
        if path.exists():
            try:
                return path.read_text(encoding="utf-8")
            except Exception:  # noqa: BLE001
                continue
    return (
        f"Hi from Zoho Kurdish!\n\n"
        f"(template {template_key} not yet authored — generic fallback)\n"
    )


def dispatch_due(now: Optional[datetime] = None) -> dict:
    """Send every queued drip email whose ``send_at <= now``.

    Returns a dict of counters used by the scheduler job log.
    """
    now = now or datetime.now(timezone.utc)
    sent = 0
    skipped = 0
    errors: list[dict] = []

    try:
        from app.firebase_client import get_db

        db = get_db()
        query = (
            db.collection(DRIP_COLLECTION)
            .where("status", "==", "pending")
            .where("send_at", "<=", now)
            .limit(200)
        )
        for snap in query.stream():
            row = snap.to_dict() or {}
            to_email = row.get("to_email")
            if not to_email:
                skipped += 1
                continue
            body = _render_template(
                row.get("template_key") or "welcome",
                row.get("locale") or "en",
                {"tenant_id": row.get("tenant_id")},
            )
            try:
                from app.services.mail import send_email  # type: ignore

                send_email(
                    to=to_email,
                    subject=row.get("subject") or "Zoho Kurdish",
                    body=body,
                )
                snap.reference.update({"sent_at": datetime.now(timezone.utc), "status": "sent"})
                sent += 1
            except Exception as exc:  # noqa: BLE001
                errors.append({"id": snap.id, "err": str(exc)})
                snap.reference.update({"status": "error", "last_error": str(exc)})
    except Exception as exc:  # noqa: BLE001
        logger.error("drip.dispatch_failed", extra={"err": str(exc)})
        errors.append({"id": "?", "err": str(exc)})

    return {"sent": sent, "skipped": skipped, "errors": errors}


__all__ = [
    "schedule_for_tenant",
    "dispatch_due",
    "DRIP_STEPS",
    "DRIP_COLLECTION",
]
