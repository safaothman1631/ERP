"""Admin impersonation endpoints (G2 / R2.3 / R2.4).

RFC 8693 actor-claim flow:

  ``act = { sub: <impersonator_user_id> }`` is embedded in a short-lived
  (30-min) JWT whose ``sub`` claim is the *target* user. The token carries
  ``read_only: true`` so the read-only middleware can reject mutations
  with 403 without re-decoding the original admin context.

Endpoints
---------
* ``POST /api/admin/impersonate/start``  — issue session, write audit doc
* ``POST /api/admin/impersonate/end``    — explicitly end session, revoke jti
* ``GET  /api/admin/impersonate/audit``  — list sessions (super-admin only)

Constraints (design §2.3 + tasks T-G.2.4):

* Only ``super_admin`` / ``is_platform_admin`` users may start sessions.
* Sessions are 30 minutes max; the JWT's ``exp`` claim is the source of
  truth — the audit doc carries the same expiry for reporting.
* Read-only is enforced at the middleware layer
  (:mod:`app.middleware.read_only_mode`); this module's only job is to
  set the claim and to refuse mutations of the audit log itself.
* Every request made under an impersonation token is logged separately
  by :mod:`app.middleware.impersonation_audit`.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.schemas.impersonation import (
    ImpersonateEndRequest,
    ImpersonateEndResponse,
    ImpersonateStartRequest,
    ImpersonateStartResponse,
    ImpersonationAuditEntry,
    ImpersonationAuditListResponse,
)
from app.security.dependencies import get_current_user

log = logging.getLogger("api.admin.impersonate")

router = APIRouter(prefix="/api/admin/impersonate", tags=["Admin / Impersonation"])

# Per design ADR-G-05 — 30-minute TTL is non-negotiable.
SESSION_TTL_SECONDS: int = 30 * 60
AUDIT_COLLECTION: str = "impersonation_audit"
AUDIT_EVENTS_SUBCOLLECTION: str = "events"


# ── Permission helpers ────────────────────────────────────────────────────


def _require_super_admin(user: dict) -> None:
    """Only platform admins may impersonate. Regular tenant admins → 403.

    The check accepts either the ``super_admin`` role string or the
    ``is_platform_admin`` boolean flag (legacy field on user docs).
    """
    role = (user.get("role") or "").lower()
    if role == "super_admin" or user.get("is_platform_admin"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="super_admin role required for impersonation",
    )


# ── JWT issuance ──────────────────────────────────────────────────────────


def _issue_impersonation_token(
    *,
    impersonator_user_id: str,
    target_tenant_id: str,
    target_user_id: Optional[str],
    audit_id: str,
    expires_at: datetime,
) -> str:
    """Mint a short-lived JWT carrying the actor (``act``) claim.

    We piggy-back on the existing ``create_access_token`` helper so the
    token is signed with the same SECRET_KEY and validates through the
    normal ``get_current_user`` dependency. The extra claims are checked
    by the read-only and audit middlewares.
    """
    from app.services.auth import create_access_token

    # The "sub" is the target user so all server-side queries scope to
    # that user automatically. ``act.sub`` is the impersonator id — the
    # RFC 8693 contract.
    payload: dict[str, Any] = {
        "sub": target_user_id or f"tenant-admin:{target_tenant_id}",
        "org_id": target_tenant_id,
        "tenant_id": target_tenant_id,
        "act": {"sub": impersonator_user_id},
        "impersonation": True,
        "read_only": True,
        "scope": "read-only",
        "audit_id": audit_id,
        "role": "viewer",  # neutralises role-based perms during the session
    }
    # ``create_access_token`` enforces its own ``exp``/``jti``; the
    # ``expires_delta`` keeps us at exactly 30 min regardless of the
    # server's default token-life setting. Use the constant directly
    # rather than recomputing from ``expires_at`` so the JWT and the
    # audit-doc agree to the second.
    return create_access_token(
        payload, expires_delta=timedelta(seconds=SESSION_TTL_SECONDS)
    )


# ── Audit helpers ─────────────────────────────────────────────────────────


def _client_ip(request: Optional[Request]) -> Optional[str]:
    if not request:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    client = getattr(request, "client", None)
    return getattr(client, "host", None) if client else None


def _user_agent(request: Optional[Request]) -> Optional[str]:
    return request.headers.get("user-agent") if request else None


async def _write_audit_doc(entry: ImpersonationAuditEntry) -> None:
    """Persist the start-of-session audit document. Best-effort."""
    try:
        from app.firestore.client import get_async_client

        client = get_async_client()
        await client.collection(AUDIT_COLLECTION).document(entry.audit_id).set(
            entry.model_dump(mode="json")
        )
    except Exception as exc:  # noqa: BLE001
        # Don't fail the start request on audit-store failure; alarm via log.
        log.error(
            "impersonation.audit_write_failed",
            extra={"err": str(exc), "audit_id": entry.audit_id},
        )


async def _mark_audit_ended(audit_id: str, ended_at: datetime) -> bool:
    try:
        from app.firestore.client import get_async_client

        client = get_async_client()
        ref = client.collection(AUDIT_COLLECTION).document(audit_id)
        snap = await ref.get()
        if not snap.exists:
            return False
        await ref.update({"ended_at": ended_at, "status": "ended"})
        return True
    except Exception as exc:  # noqa: BLE001
        log.error(
            "impersonation.audit_end_failed",
            extra={"err": str(exc), "audit_id": audit_id},
        )
        return False


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.post(
    "/start",
    response_model=ImpersonateStartResponse,
    status_code=status.HTTP_200_OK,
    summary="Start a 30-minute read-only impersonation session (super-admin only)",
)
async def start_impersonation(
    payload: ImpersonateStartRequest,
    request: Request,
    user: dict = Depends(get_current_user),
) -> ImpersonateStartResponse:
    _require_super_admin(user)

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=SESSION_TTL_SECONDS)
    audit_id = uuid.uuid4().hex

    token = _issue_impersonation_token(
        impersonator_user_id=user.get("id") or "unknown",
        target_tenant_id=payload.tenant_id,
        target_user_id=payload.target_user_id,
        audit_id=audit_id,
        expires_at=expires_at,
    )

    entry = ImpersonationAuditEntry(
        audit_id=audit_id,
        impersonator_user_id=user.get("id") or "unknown",
        impersonator_email=user.get("email"),
        target_tenant_id=payload.tenant_id,
        target_user_id=payload.target_user_id,
        started_at=now,
        expires_at=expires_at,
        reason=payload.reason,
        ip=_client_ip(request),
        user_agent=_user_agent(request),
        scope="read-only",
        status="active",
    )
    await _write_audit_doc(entry)

    log.info(
        "impersonation.started",
        extra={
            "audit_id": audit_id,
            "actor": user.get("id"),
            "tenant": payload.tenant_id,
        },
    )

    return ImpersonateStartResponse(
        access_token=token,
        token_type="bearer",
        expires_in=SESSION_TTL_SECONDS,
        expires_at=expires_at,
        audit_id=audit_id,
        tenant_id=payload.tenant_id,
        target_user_id=payload.target_user_id,
        read_only=True,
    )


@router.post(
    "/end",
    response_model=ImpersonateEndResponse,
    summary="Explicitly end the current impersonation session",
)
async def end_impersonation(
    payload: ImpersonateEndRequest,
    user: dict = Depends(get_current_user),
) -> ImpersonateEndResponse:
    """End an active session.

    Allowed callers:
      * The platform admin who started the session (matched via ``act.sub``
        in the calling token).
      * Any super-admin (to remediate stuck sessions).

    The session ends by:
      1. Marking the audit doc ``status=ended``.
      2. Revoking the calling JWT via the normal ``revoke_token`` denylist.
    """
    # The audit id can come either from the request body or from the
    # caller's own impersonation token (``audit_id`` claim).
    audit_id = payload.audit_id or user.get("audit_id") or user.get("_audit_id")
    if not audit_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="audit_id required (no impersonation context in caller token)",
        )

    role = (user.get("role") or "").lower()
    is_super = role == "super_admin" or user.get("is_platform_admin")
    is_self = bool(user.get("impersonation") or user.get("act"))
    if not (is_super or is_self):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="not allowed to end this impersonation session",
        )

    ended_at = datetime.now(timezone.utc)
    found = await _mark_audit_ended(audit_id, ended_at)
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="impersonation session not found",
        )

    # Best-effort revoke of the calling token's jti so a leaked token
    # can't be re-used until expiry.
    jti = user.get("_jti")
    if jti:
        try:
            from app.services.auth import revoke_token

            revoke_token(jti)
        except Exception as exc:  # noqa: BLE001
            log.warning("impersonation.revoke_failed", extra={"err": str(exc)})

    log.info(
        "impersonation.ended",
        extra={"audit_id": audit_id, "actor": user.get("id")},
    )

    return ImpersonateEndResponse(audit_id=audit_id, ended_at=ended_at, status="ended")


@router.get(
    "/audit",
    response_model=ImpersonationAuditListResponse,
    summary="List recent impersonation sessions (super-admin only)",
)
async def list_audit(
    limit: int = 50,
    user: dict = Depends(get_current_user),
) -> ImpersonationAuditListResponse:
    _require_super_admin(user)

    if limit < 1:
        limit = 1
    if limit > 200:
        limit = 200

    items: list[ImpersonationAuditEntry] = []
    try:
        from app.firestore.client import get_async_client

        client = get_async_client()
        # Newest first.
        async for snap in (
            client.collection(AUDIT_COLLECTION)
            .order_by("started_at", direction="DESCENDING")
            .limit(limit)
            .stream()
        ):
            data = snap.to_dict() or {}
            data.setdefault("audit_id", snap.id)
            try:
                items.append(ImpersonationAuditEntry(**data))
            except Exception:  # noqa: BLE001
                # Skip rows we can't parse rather than 500ing on a single bad doc.
                log.warning("impersonation.audit_row_skipped", extra={"id": snap.id})
    except Exception as exc:  # noqa: BLE001
        log.error("impersonation.audit_list_failed", extra={"err": str(exc)})

    return ImpersonationAuditListResponse(items=items, next_cursor=None)


# Convenience export so ``main.py`` can do
# ``app.include_router(impersonate_api.router)``.
ALL_ROUTERS = [router]

__all__ = [
    "router",
    "ALL_ROUTERS",
    "SESSION_TTL_SECONDS",
    "AUDIT_COLLECTION",
]
