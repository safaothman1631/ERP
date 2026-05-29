"""Read-only enforcement for impersonation tokens (G2 / R2.3).

Any request whose JWT carries ``read_only: true`` (i.e. an impersonation
session) is allowed only GET / HEAD / OPTIONS. Every mutating verb is
rejected with HTTP 403 before reaching the route handler.

The whitelist of mutating paths is intentionally empty by default — the
*only* documented exception is ``/api/admin/impersonate/end``, which must
remain reachable so the impersonator can explicitly terminate the session.

Implementation notes
--------------------
* We decode the bearer token here rather than relying on ``request.state``
  so the middleware works even if it runs *before* the auth dependency
  chain (FastAPI middlewares run on every request, dependencies don't).
* JWT decoding failures fall through silently — the regular auth
  dependency will produce the 401. We must not double-fault.
"""
from __future__ import annotations

import logging
from typing import Iterable

from fastapi import Request
from fastapi.responses import JSONResponse
from jose import JWTError, jwt

from app.config import get_settings

logger = logging.getLogger(__name__)

_SAFE_METHODS: frozenset[str] = frozenset({"GET", "HEAD", "OPTIONS"})

# Paths that are explicitly safe to call with a read-only token even
# though they use a mutating verb. Keep this list MINIMAL.
_WHITELIST_MUTATIONS: tuple[str, ...] = (
    "/api/admin/impersonate/end",
    "/api/auth/logout",
)


def _is_whitelisted(path: str) -> bool:
    return any(path == p or path.startswith(p + "/") for p in _WHITELIST_MUTATIONS)


def _decode_bearer(authorization: str | None) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(None, 1)[1].strip()
    if not token:
        return None
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": False},  # auth dep will 401 on expiry
        )
    except JWTError:
        return None


def is_read_only_token(payload: dict | None) -> bool:
    if not payload:
        return False
    if payload.get("read_only") is True:
        return True
    if payload.get("scope") == "read-only" and payload.get("impersonation"):
        return True
    return False


async def read_only_mode_middleware(request: Request, call_next):
    method = (request.method or "").upper()
    # Fast path: safe verbs are always allowed.
    if method in _SAFE_METHODS:
        return await call_next(request)

    path = request.url.path or ""
    if _is_whitelisted(path):
        return await call_next(request)

    payload = _decode_bearer(request.headers.get("authorization"))
    if not is_read_only_token(payload):
        return await call_next(request)

    audit_id = payload.get("audit_id") if payload else None
    logger.warning(
        "impersonation.read_only_blocked",
        extra={
            "method": method,
            "path": path,
            "audit_id": audit_id,
            "actor": (payload or {}).get("act", {}).get("sub"),
        },
    )
    return JSONResponse(
        status_code=403,
        content={
            "error": "read_only_session",
            "detail": (
                "Impersonation sessions are read-only. Mutations are forbidden "
                "to preserve customer data integrity."
            ),
            "audit_id": audit_id,
        },
    )


__all__ = [
    "read_only_mode_middleware",
    "is_read_only_token",
    "_WHITELIST_MUTATIONS",
]
