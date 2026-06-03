"""Real, idempotent outbox event handlers (Pool 3.3 event bus).

These are the production side-effect handlers wired into the reliable outbox
dispatcher (``app.services.outbox_dispatcher``). The dispatcher delivers events
*at-least-once*, so every handler here MUST be idempotent and side-effect-safe to
re-run. Each one delegates to an existing, already-validated service where one
exists; if the supporting subsystem/optional dependency is not configured it logs
cleanly and returns rather than raising — a missing optional service is not a
poison event and must not burn through the retry budget toward dead-letter.

This module does NOT touch the JE / invoice hot write-path. It only reacts to
events that some other code path has already durably enqueued.

Wiring: ``register_all()`` imports the dispatcher and registers each handler for
its event type. The orchestrator calls ``register_all()`` from the dispatcher's
``register_default_handlers`` so these replace the inline stubs.
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Event type constants — single source of truth for the wiring + tests.
EINVOICE_DISPATCH = "einvoice_dispatch"
INVENTORY_ADJUST = "inventory_adjust"
NOTIFICATION = "notification"


# ── einvoice_dispatch ────────────────────────────────────────────────────────

def handle_einvoice_dispatch(org_id: Optional[str], payload: dict) -> None:
    """Enqueue an invoice for e-invoice / e-Fakhata submission.

    Idempotent: the underlying ``SubmissionQueueRepository.enqueue`` dedupes by
    ``invoice_id`` (re-emitting the same event returns the existing submission).
    If no signed XML is present we cannot enqueue a real submission, so we log
    the linkage and return — the e-Fakhata subsystem owns the actual MoF flow.
    """
    invoice_id = payload.get("invoice_id") or payload.get("id")
    if not org_id or not invoice_id:
        logger.info(
            "outbox_einvoice_skip_no_target",
            extra={"org_id": org_id, "invoice_id": invoice_id},
        )
        return

    xml_signed = payload.get("xml_signed") or payload.get("signed_xml")
    if not xml_signed:
        # The signed document is produced by the e-Fakhata builder/signing flow,
        # not by this generic handler. Without it there is nothing to submit;
        # record the linkage so the registry is exercised + observable.
        logger.info(
            "outbox_einvoice_linked",
            extra={"org_id": org_id, "invoice_id": invoice_id},
        )
        return

    try:
        from app.efakhata.submission_queue import SubmissionQueueRepository

        repo = SubmissionQueueRepository(org_id)
        record = repo.enqueue(
            invoice_id=str(invoice_id),
            xml_signed=str(xml_signed),
            created_by=str(payload.get("created_by") or "outbox"),
        )
        logger.info(
            "outbox_einvoice_enqueued",
            extra={
                "org_id": org_id,
                "invoice_id": invoice_id,
                "submission_id": (record or {}).get("id"),
            },
        )
    except Exception as exc:  # noqa: BLE001 — optional subsystem / infra absence
        logger.warning(
            "outbox_einvoice_unavailable",
            extra={"org_id": org_id, "invoice_id": invoice_id, "error": str(exc)},
        )


# ── inventory_adjust ─────────────────────────────────────────────────────────

def handle_inventory_adjust(org_id: Optional[str], payload: dict) -> None:
    """Post an inventory stock adjustment (item stock + movement) atomically.

    Idempotent: ``post_adjustment_atomic`` keys the adjustment doc on a stable
    ``id`` (supplied in the payload), so re-delivery re-posts to the same doc.
    Callers SHOULD include an ``id`` to get full dedupe; without one a fresh id
    is generated and the event is treated as best-effort.
    """
    item_id = payload.get("item_id")
    if not org_id or not item_id:
        logger.info(
            "outbox_inventory_skip_no_target",
            extra={"org_id": org_id, "item_id": item_id},
        )
        return

    try:
        from app.services.inventory_adjustment_atomic import post_adjustment_atomic

        result = post_adjustment_atomic(org_id, dict(payload))
        logger.info(
            "outbox_inventory_adjusted",
            extra={
                "org_id": org_id,
                "item_id": item_id,
                "adjustment_id": (result or {}).get("id"),
            },
        )
    except Exception as exc:  # noqa: BLE001 — Firestore / item-not-found / infra
        logger.warning(
            "outbox_inventory_unavailable",
            extra={"org_id": org_id, "item_id": item_id, "error": str(exc)},
        )


# ── notification ─────────────────────────────────────────────────────────────

def _build_push_payload(payload: dict):
    """Map an outbox payload into a ``PushPayload``. Accepts either i18n dicts
    (``title_i18n`` / ``body_i18n``) or flat ``title`` / ``body`` strings."""
    from app.services.push_notifications import PushPayload

    title_i18n = payload.get("title_i18n")
    body_i18n = payload.get("body_i18n")
    if not isinstance(title_i18n, dict):
        title_i18n = {"ku": str(payload.get("title") or "")}
    if not isinstance(body_i18n, dict):
        body_i18n = {"ku": str(payload.get("body") or "")}

    raw_data = payload.get("data") or {}
    data = {str(k): str(v) for k, v in raw_data.items()} if isinstance(raw_data, dict) else {}

    return PushPayload(
        title_i18n=title_i18n,
        body_i18n=body_i18n,
        data=data,
        click_action=payload.get("click_action"),
    )


def handle_notification(org_id: Optional[str], payload: dict) -> None:
    """Deliver a push notification to a user, a tenant, or a topic.

    Routing (first match wins): explicit ``topic`` → topic; ``user_id`` → user;
    otherwise the whole tenant. Idempotent at the messaging layer (re-sending a
    duplicate push is benign), and fully guarded: if FCM/messaging is not
    configured the push service no-ops, and any delivery error is logged rather
    than raised so a notification never poisons the queue.
    """
    tenant_id = payload.get("tenant_id") or org_id
    if not tenant_id:
        logger.info("outbox_notification_skip_no_tenant", extra={"org_id": org_id})
        return

    lang = str(payload.get("lang") or "ku")
    try:
        from app.services import push_notifications as push

        push_payload = _build_push_payload(payload)
        topic = payload.get("topic")
        user_id = payload.get("user_id")
        if topic:
            push.send_to_topic(str(topic), push_payload, lang)
            target = f"topic:{topic}"
        elif user_id:
            push.send_to_user(str(tenant_id), str(user_id), push_payload, lang)
            target = f"user:{user_id}"
        else:
            push.send_to_tenant(str(tenant_id), push_payload, lang)
            target = "tenant"
        logger.info(
            "outbox_notification_sent",
            extra={"org_id": org_id, "tenant_id": tenant_id, "target": target,
                   "type": payload.get("type")},
        )
    except Exception as exc:  # noqa: BLE001 — messaging not configured / delivery
        logger.warning(
            "outbox_notification_unavailable",
            extra={"org_id": org_id, "tenant_id": tenant_id, "error": str(exc)},
        )


# ── Registry wiring ──────────────────────────────────────────────────────────

# event_type -> handler. Single source of truth so register_all + tests agree.
HANDLERS = {
    EINVOICE_DISPATCH: handle_einvoice_dispatch,
    INVENTORY_ADJUST: handle_inventory_adjust,
    NOTIFICATION: handle_notification,
}


def register_all() -> None:
    """Register every real handler with the outbox dispatcher.

    Imported + called by the dispatcher's ``register_default_handlers`` so these
    handlers replace the inline stubs. ``register_handler`` is idempotent per
    function, so calling this more than once is safe.
    """
    from app.services import outbox_dispatcher

    for event_type, fn in HANDLERS.items():
        outbox_dispatcher.register_handler(event_type, fn)
    logger.info("outbox_handlers_registered", extra={"count": len(HANDLERS)})
