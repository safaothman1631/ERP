"""Reliable outbox event dispatch (Pool 3.3 event bus).

A scheduled worker (scheduler job ``outbox_dispatch``) drains pending events and
invokes the handler(s) registered for each ``event_type``. A failing handler
retries with an escalating backoff and, after ``MAX_ATTEMPTS``, the event lands
in a ``dead`` (dead-letter) state so a poison event never blocks the queue.

Delivery is at-least-once, so handlers MUST be idempotent. Handlers are looked up
from an extensible in-process registry (``register_handler``) instead of a
hard-coded if/elif, so new side effects (e-invoice, inventory, notifications)
plug in without touching the dispatcher.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Callable

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
# Backoff per attempt number (1-indexed); clamped to the last entry beyond.
_BACKOFF_MINUTES = [1, 5, 30, 120, 720]

# event_type -> [handler(org_id, payload), ...]
_HANDLERS: dict[str, list[Callable[[str | None, dict], None]]] = {}
_DEFAULTS_REGISTERED = False


def register_handler(event_type: str, fn: Callable[[str | None, dict], None]):
    """Register a side-effect handler for an event type (idempotent per fn)."""
    fns = _HANDLERS.setdefault(event_type, [])
    if fn not in fns:
        fns.append(fn)
    return fn


def clear_handlers() -> None:
    """Test helper — reset the registry."""
    _HANDLERS.clear()
    global _DEFAULTS_REGISTERED
    _DEFAULTS_REGISTERED = False


def register_default_handlers() -> None:
    """Wire the built-in handlers once. Thin + guarded so a missing optional
    dependency never breaks dispatch."""
    global _DEFAULTS_REGISTERED
    if _DEFAULTS_REGISTERED:
        return
    _DEFAULTS_REGISTERED = True
    # Real idempotent handlers (Pool 3.6) — einvoice_dispatch / inventory_adjust /
    # notification. Guarded so a missing optional dependency never breaks dispatch.
    try:
        from app.services import outbox_handlers

        outbox_handlers.register_all()
    except Exception:
        logger.warning("default outbox handlers not registered", exc_info=True)


def _backoff(attempts: int) -> timedelta:
    idx = min(max(attempts - 1, 0), len(_BACKOFF_MINUTES) - 1)
    return timedelta(minutes=_BACKOFF_MINUTES[idx])


def _handle_event(org_id: str | None, event_type: str, payload: dict) -> int:
    """Invoke every handler registered for ``event_type``. Returns the number of
    handlers run (0 = no handler; logged, treated as delivered so it doesn't
    retry forever)."""
    handlers = _HANDLERS.get(event_type) or []
    if not handlers:
        logger.info("outbox_no_handler", extra={"event_type": event_type, "org_id": org_id})
        return 0
    for fn in handlers:
        fn(org_id, payload)  # may raise -> caller schedules a retry
    return len(handlers)


def dispatch_pending(org_id: str | None = None, max_events: int = 50) -> int:
    """Drain up to ``max_events`` due pending events. Returns count delivered."""
    from app.firebase_client import get_db

    register_default_handlers()
    db = get_db()
    query = db.collection("outbox_events").where("status", "==", "pending").limit(max_events)
    if org_id:
        query = query.where("org_id", "==", org_id)

    dispatched = 0
    now = datetime.utcnow()
    for doc in query.stream():
        data = doc.to_dict() or {}
        next_retry = data.get("next_retry_at")
        if isinstance(next_retry, datetime) and next_retry > now:
            continue
        event_type = data.get("event_type", "")
        try:
            _handle_event(data.get("org_id"), event_type, data.get("payload") or {})
            doc.reference.update({
                "status": "delivered",
                "delivered_at": now,
                "updated_at": now,
            })
            dispatched += 1
        except Exception as exc:
            attempts = int(data.get("attempts") or 0) + 1
            dead = attempts >= MAX_ATTEMPTS
            doc.reference.update({
                "status": "dead" if dead else "pending",
                "attempts": attempts,
                "last_error": str(exc)[:500],
                "next_retry_at": now + _backoff(attempts),
                "updated_at": now,
            })
            logger.warning(
                "outbox_dispatch_failed",
                extra={"event_type": event_type, "attempts": attempts, "dead": dead,
                       "error": str(exc)},
            )
    return dispatched


def replay_dead_letters(org_id: str | None = None, max_events: int = 50) -> int:
    """Reset ``dead`` events back to pending (e.g. after fixing a handler).
    Returns the number requeued."""
    from app.firebase_client import get_db

    db = get_db()
    query = db.collection("outbox_events").where("status", "==", "dead").limit(max_events)
    if org_id:
        query = query.where("org_id", "==", org_id)
    now = datetime.utcnow()
    requeued = 0
    for doc in query.stream():
        doc.reference.update({"status": "pending", "attempts": 0, "next_retry_at": now,
                              "updated_at": now})
        requeued += 1
    return requeued
