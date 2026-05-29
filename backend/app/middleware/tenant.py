"""Tenant resolution middleware (P4 / R7.1, R7.2).

Reads the JWT ``Authorization: Bearer <token>`` header, extracts the
``tenant_id`` claim (with fallback to ``org_id`` for legacy tokens), and
attaches it to ``request.state.tenant_id``.

Allowlist
---------
The following routes are exempt from tenant enforcement (they precede auth
or are needed for liveness probes):

- ``/api/health`` (any sub-path)
- ``/api/version``
- ``/api/auth/*``
- ``/api/rum/vitals``

For everything else, a missing tenant claim returns HTTP 401.

Wiring
------
::

    from app.middleware.tenant import TenantMiddleware
    app.add_middleware(TenantMiddleware)
"""
from __future__ import annotations

import logging
from typing import Iterable, Optional

from fastapi import status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

log = logging.getLogger("middleware.tenant")


# Path prefixes that bypass tenant enforcement.
DEFAULT_ALLOWLIST: tuple[str, ...] = (
    "/api/health",
    "/api/version",
    "/api/auth/",
    "/api/rum/vitals",
    # Docs & openapi:
    "/docs",
    "/openapi.json",
    "/redoc",
    # Prometheus scrape endpoint:
    "/metrics",
)


def _is_allowlisted(path: str, allowlist: Iterable[str]) -> bool:
    """True if ``path`` matches any allowlist prefix."""
    for prefix in allowlist:
        if path == prefix or path.startswith(prefix):
            return True
    return False


def _extract_bearer(request: Request) -> Optional[str]:
    """Return the JWT string from the Authorization header, or None."""
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        return None
    parts = auth.strip().split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


def _decode_tenant_id(token: str) -> Optional[str]:
    """Decode the JWT and return ``tenant_id`` (or ``org_id`` for legacy).

    Returns ``None`` on any decode failure — the caller decides what to do.
    Verification of signature / expiry is left to ``get_current_user`` so
    we don't duplicate the JWT validation logic; here we only need the claim
    early enough to scope rate limiting and caching.
    """
    try:
        from jose import jwt  # type: ignore
        from app.config import settings  # type: ignore
    except Exception:  # noqa: BLE001
        return None
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[getattr(settings, "ALGORITHM", "HS256")],
            options={"verify_exp": False},  # let auth dep produce the canonical 401
        )
    except Exception:  # noqa: BLE001
        return None
    tid = payload.get("tenant_id") or payload.get("org_id")
    return str(tid) if tid else None


class TenantMiddleware(BaseHTTPMiddleware):
    """Attach ``request.state.tenant_id`` from the bearer JWT.

    Returns 401 for non-allowlisted requests with no resolvable tenant.
    """

    def __init__(self, app, allowlist: Optional[Iterable[str]] = None) -> None:
        super().__init__(app)
        self.allowlist = tuple(allowlist) if allowlist else DEFAULT_ALLOWLIST

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path

        # Always default to None so downstream code can rely on the attribute.
        request.state.tenant_id = None

        token = _extract_bearer(request)
        if token:
            tid = _decode_tenant_id(token)
            if tid:
                request.state.tenant_id = tid

        # Allowlisted paths proceed regardless of tenant resolution.
        if _is_allowlisted(path, self.allowlist):
            return await call_next(request)

        if request.state.tenant_id is None:
            log.info("tenant.missing", extra={"path": path})
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "error": "tenant_required",
                    "detail": "داواکارییەکە بەبێ tenant_id هاتووە. تکایە چوونەژوورەوە بکە.",
                },
                headers={"WWW-Authenticate": "Bearer"},
            )

        return await call_next(request)


__all__ = ["TenantMiddleware", "DEFAULT_ALLOWLIST"]
