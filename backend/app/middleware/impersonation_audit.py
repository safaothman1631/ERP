"""Per-request audit log for impersonation sessions (G2 / R2.3).

Every HTTP request whose JWT carries ``impersonation: true`` produces a
single document at::

    impersonation_audit/{audit_id}/events/{event_id}

containing the method, path, response status, body size, IP, and a
timestamp. Retention is 18 months — purged by a scheduler job
(``app.services.scheduler_jobs.purge_old_impersonation_audit``).

The middleware never raises on storage failure: we drop the event row
and log the error rather than break the user-facing request.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request
from jose import JWTError, jwt

from app.config import get_settings

logger = logging.getLogger(__name__)

EVENTS_SUBCOLLECTION = "events"
AUDIT_COLLECTION = "impersonation_audit"


def _decode_bearer(authorization: str | None) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(None, 1)[1].strip()
    if not token:
        return None
    try:
        settings = get_settings()
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": False},
        )
    except JWTError:
        return None


def _client_ip(request: Request) -> Optional[str]:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    client = getattr(request, "client", None)
    return getattr(client, "host", None) if client else None


async def _write_event(
    audit_id: str,
    *,
    method: str,
    path: str,
    status_code: int,
    body_size: int,
    ip: Optional[str],
) -> None:
    """Best-effort write of a single event row."""
    try:
        from app.firestore.client import get_async_client

        client = get_async_client()
        event_id = uuid.uuid4().hex
        await (
            client.collection(AUDIT_COLLECTION)
            .document(audit_id)
            .collection(EVENTS_SUBCOLLECTION)
            .document(event_id)
            .set(
                {
                    "event_id": event_id,
                    "audit_id": audit_id,
                    "method": method,
                    "path": path,
                    "status_code": status_code,
                    "body_size": body_size,
                    "ip": ip,
                    "timestamp": datetime.now(timezone.utc),
                }
            )
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "impersonation.event_write_failed",
            extra={"err": str(exc), "audit_id": audit_id, "path": path},
        )


async def impersonation_audit_middleware(request: Request, call_next):
    """Capture every request issued under an impersonation token."""
    payload = _decode_bearer(request.headers.get("authorization"))
    audit_id: Optional[str] = None
    if payload and (payload.get("impersonation") or payload.get("audit_id")):
        audit_id = payload.get("audit_id")

    response = await call_next(request)

    if audit_id:
        # ``Content-Length`` is the cheapest body-size proxy. Missing
        # header → -1 sentinel rather than reading the body.
        try:
            body_size = int(response.headers.get("content-length") or "-1")
        except ValueError:
            body_size = -1
        # Fire-and-forget the audit write so latency stays low. We still
        # await it in the same event loop so failures surface in logs.
        await _write_event(
            audit_id,
            method=(request.method or "").upper(),
            path=request.url.path or "",
            status_code=getattr(response, "status_code", 0),
            body_size=body_size,
            ip=_client_ip(request),
        )

    return response


__all__ = ["impersonation_audit_middleware", "AUDIT_COLLECTION", "EVENTS_SUBCOLLECTION"]
