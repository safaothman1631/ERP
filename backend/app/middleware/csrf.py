"""CSRF protection middleware (SF4 / T-SF.4.6).

Threat model
------------
The primary API authentication scheme is a stateless Bearer JWT carried in the
``Authorization`` header (see ``app/services/auth.py``). Bearer-header auth is
**not** automatically attached by the browser to cross-site requests, so a pure
Bearer client is inherently immune to classic CSRF. However, the platform also:

  * issues a refresh-token *cookie* on some flows, and
  * is consumed by a first-party web app that may, in future, fall back to a
    cookie/session for convenience or for endpoints hit by ``<form>`` posts.

To keep that surface safe we implement **defense-in-depth** rather than relying
on any single control:

  1. **SameSite=Strict cookies** — :func:`harden_set_cookie_headers` rewrites
     any ``Set-Cookie`` header emitted by the app to add ``SameSite=Strict``,
     ``Secure`` (in production), and ``HttpOnly`` when not already present. A
     Strict cookie is never sent on a cross-site navigation, which neutralises
     the cookie-replay vector for the vast majority of CSRF attacks.

  2. **Double-submit token check** — for *cookie-authenticated* state-changing
     requests (POST/PUT/PATCH/DELETE) the caller must echo the CSRF token from
     the ``csrf_token`` cookie in the ``X-CSRF-Token`` header. Because a
     cross-site attacker can neither read the victim's cookie (same-origin
     policy) nor set a custom request header on a simple form post, a matching
     header proves the request originated from first-party JavaScript.

Bearer-authenticated requests are exempt from rule (2): they already carry an
unguessable, non-cookie credential, and forcing a CSRF header on every API
client (mobile, integrations, server-to-server) would break them for no
security gain. The middleware therefore only enforces the token when a request
is **cookie-authenticated and not Bearer-authenticated**.

Configuration
-------------
``settings.CSRF_PROTECTION_ENABLED`` (default ``True``) toggles enforcement.
When ``False`` the middleware still hardens ``Set-Cookie`` headers (cheap, no
downside) but skips the double-submit check.

Wiring (see :mod:`app.main`)::

    from app.middleware.csrf import csrf_middleware
    app.middleware("http")(csrf_middleware)

Requirements covered: T-SF.4.6 (CSRF), OWASP Top-10 A01/A05.
"""
from __future__ import annotations

import hmac
import logging
import re
import secrets
from typing import Iterable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.responses import Response

from app.config import get_settings

logger = logging.getLogger("middleware.csrf")

# ── Constants ────────────────────────────────────────────────────────────────

#: Name of the cookie that carries the CSRF token (readable by first-party JS).
CSRF_COOKIE_NAME = "csrf_token"
#: Header the client must echo the cookie value in.
CSRF_HEADER_NAME = "x-csrf-token"
#: Bytes of entropy in a freshly minted token (43 url-safe chars).
_CSRF_TOKEN_BYTES = 32

_SAFE_METHODS: frozenset[str] = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})

#: Path prefixes exempt from the double-submit check. These either run before a
#: session exists (login/refresh), are public webhooks that authenticate via a
#: provider signature, or are liveness probes.
DEFAULT_EXEMPT_PREFIXES: tuple[str, ...] = (
    "/api/auth/login",
    "/api/auth/setup",
    "/api/auth/refresh",
    "/api/auth/status",
    "/api/health",
    "/api/version",
    "/api/rum/vitals",
    # Provider-signed public webhooks — authenticated by HMAC, not a session.
    "/api/payments/webhooks/",
    "/api/saas-billing/webhooks/",
    "/api/webhooks/",
)


def generate_csrf_token() -> str:
    """Return a fresh, cryptographically-random CSRF token (url-safe)."""
    return secrets.token_urlsafe(_CSRF_TOKEN_BYTES)


def _is_exempt(path: str, exempt: Iterable[str]) -> bool:
    return any(path == p or path.startswith(p) for p in exempt)


def _has_bearer(request: Request) -> bool:
    """True when the request carries an ``Authorization: Bearer`` header."""
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    return bool(auth and auth.strip().lower().startswith("bearer "))


def _tokens_match(cookie_token: str, header_token: str) -> bool:
    """Constant-time comparison of the cookie and header CSRF tokens."""
    if not cookie_token or not header_token:
        return False
    return hmac.compare_digest(str(cookie_token), str(header_token))


def harden_set_cookie_headers(response: Response, *, is_production: bool) -> None:
    """Rewrite every ``Set-Cookie`` on *response* to be CSRF-safe.

    Adds ``SameSite=Strict`` and ``HttpOnly`` when absent, and ``Secure`` in
    production. The exception is the CSRF token cookie itself, which must be
    readable by JavaScript to power the double-submit pattern and therefore
    keeps ``HttpOnly`` off (it is non-sensitive — it grants nothing on its own).

    Starlette stores multiple Set-Cookie headers as separate raw header tuples,
    so we rebuild the raw header list to mutate each one independently.
    """
    raw_headers = []
    changed = False
    for name, value in response.raw_headers:
        if name.lower() != b"set-cookie":
            raw_headers.append((name, value))
            continue
        try:
            cookie_str = value.decode("latin-1")
        except Exception:  # noqa: BLE001
            raw_headers.append((name, value))
            continue

        is_csrf_cookie = cookie_str.lower().startswith(f"{CSRF_COOKIE_NAME}=".lower())
        lowered = cookie_str.lower()

        local_changed = False
        # Upgrade a weak/absent SameSite to Strict. Starlette's set_cookie
        # defaults to ``SameSite=lax`` which still permits top-level cross-site
        # navigation; Strict is the correct posture for session/CSRF cookies.
        if "samesite=lax" in lowered or "samesite=none" in lowered:
            cookie_str = re.sub(
                r"SameSite=(lax|none)", "SameSite=Strict", cookie_str, flags=re.IGNORECASE
            )
            lowered = cookie_str.lower()
            local_changed = True

        additions: list[str] = []
        if "samesite=" not in lowered:
            additions.append("SameSite=Strict")
        if is_production and "secure" not in lowered:
            additions.append("Secure")
        # The CSRF cookie must stay JS-readable; all others get HttpOnly.
        if not is_csrf_cookie and "httponly" not in lowered:
            additions.append("HttpOnly")

        if additions:
            cookie_str = cookie_str.rstrip("; ") + "; " + "; ".join(additions)
            local_changed = True
        if local_changed:
            changed = True
        raw_headers.append((name, cookie_str.encode("latin-1")))

    if changed:
        response.raw_headers[:] = raw_headers


async def csrf_middleware(request: Request, call_next):
    """Enforce double-submit CSRF on cookie-auth mutations; harden cookies always.

    Order of checks (fail-fast):
      1. Safe verbs (GET/HEAD/OPTIONS/TRACE) → pass through, then harden cookies.
      2. Exempt path prefixes → pass through, then harden cookies.
      3. Bearer-authenticated request → not CSRF-able, pass through.
      4. No ``csrf_token`` cookie present → request is not cookie-authenticated
         (e.g. anonymous or token-less); the auth dependency will reject it with
         401 if it needed a session. Pass through.
      5. Cookie present but header missing/mismatched → **403**.
    """
    settings = get_settings()
    enabled = bool(getattr(settings, "CSRF_PROTECTION_ENABLED", True))
    is_production = getattr(settings, "ENVIRONMENT", "development") == "production"

    method = (request.method or "").upper()
    path = request.url.path or ""

    async def _finish() -> Response:
        response: Response = await call_next(request)
        harden_set_cookie_headers(response, is_production=is_production)
        return response

    if not enabled:
        return await _finish()
    if method in _SAFE_METHODS:
        return await _finish()
    if _is_exempt(path, DEFAULT_EXEMPT_PREFIXES):
        return await _finish()
    if _has_bearer(request):
        # Bearer credential is not auto-attached cross-site → CSRF-immune.
        return await _finish()

    cookie_token = request.cookies.get(CSRF_COOKIE_NAME, "")
    if not cookie_token:
        # Not cookie-authenticated: nothing to protect here. Downstream auth
        # will 401 if a credential was actually required.
        return await _finish()

    header_token = request.headers.get(CSRF_HEADER_NAME, "") or request.headers.get(
        CSRF_HEADER_NAME.title(), ""
    )
    if not _tokens_match(cookie_token, header_token):
        logger.warning(
            "csrf.token_mismatch",
            extra={"path": path, "method": method, "has_header": bool(header_token)},
        )
        return JSONResponse(
            status_code=403,
            content={
                "error": "csrf_failed",
                "detail": (
                    "CSRF validation failed: the X-CSRF-Token header is missing or "
                    "does not match the csrf_token cookie."
                ),
            },
        )

    return await _finish()


__all__ = [
    "csrf_middleware",
    "harden_set_cookie_headers",
    "generate_csrf_token",
    "CSRF_COOKIE_NAME",
    "CSRF_HEADER_NAME",
    "DEFAULT_EXEMPT_PREFIXES",
]
