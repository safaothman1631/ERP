"""Rate limiting middleware for the Zoho ERP backend.

Two complementary layers:

1. **slowapi IP-based limiter** (Requirement 10.1, 10.2)
   - Uses ``slowapi.Limiter`` with ``get_remote_address`` as the key function.
   - Applied globally via ``app.state.limiter`` in ``main.py``.
   - Returns HTTP 429 with ``RateLimitExceeded`` when the limit is exceeded
     (Requirement 10.4).
   - Enabled/disabled via ``settings.RATE_LIMITING_ENABLED`` (Requirement 10.3).
   - Default limit string is ``settings.DEFAULT_RATE_LIMIT`` (Requirement 10.5).

2. **Per-org token-bucket middleware** (legacy / advanced)
   - Reads ``api_tokens`` settings bag per organisation.
   - ``rate_limit_per_minute: 0`` (default) means disabled for that org.
   - Runs as a Starlette ``BaseHTTPMiddleware`` regardless of the global flag.

Requirements covered: 10.1, 10.2, 10.3, 10.4, 10.5
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.services import settings_service

logger = logging.getLogger("rate_limit")


# ─────────────────────────────────────────────────────────────────────────────
# slowapi limiter instance
# Requirement 10.1: use slowapi for rate limiting
# Requirement 10.2: key function is get_remote_address (IP-based)
# ─────────────────────────────────────────────────────────────────────────────

def _build_limiter() -> Limiter:
    """Build the slowapi Limiter.

    When ``RATE_LIMITING_ENABLED`` is False the limiter is still created but
    the ``enabled`` flag is set to False so slowapi skips all checks.
    This satisfies Requirement 10.3 (opt-in via settings).

    When ``RATE_LIMIT_STORAGE_URI`` is set (H2), limits are shared across
    Cloud Run instances via Redis.
    """
    kwargs: dict = {
        "key_func": get_remote_address,
        "enabled": settings.RATE_LIMITING_ENABLED,
        "default_limits": (
            [settings.DEFAULT_RATE_LIMIT] if settings.RATE_LIMITING_ENABLED else []
        ),
    }
    raw_uri = getattr(settings, "RATE_LIMIT_STORAGE_URI", "") or ""
    uri = raw_uri.strip() if isinstance(raw_uri, str) else ""
    if uri:
        if "socket_connect_timeout" not in uri:
            sep = "&" if "?" in uri else "?"
            uri = f"{uri}{sep}socket_connect_timeout=2&socket_timeout=2"
        kwargs["storage_uri"] = uri
        logger.info("rate-limit using shared storage_uri (redis)")
    return Limiter(**kwargs)


# Module-level limiter — imported by main.py and attached to app.state
limiter: Limiter = _build_limiter()


# ─────────────────────────────────────────────────────────────────────────────
# 429 exception handler
# Requirement 10.4: return 429 with RateLimitExceeded when limit exceeded
# ─────────────────────────────────────────────────────────────────────────────

async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return a structured 429 response when the slowapi rate limit is exceeded.

    Requirement 10.4: return 429 status with RateLimitExceeded error.
    """
    logger.warning(
        "rate-limit exceeded ip=%s path=%s limit=%s",
        get_remote_address(request),
        request.url.path,
        str(exc.detail),
    )
    return JSONResponse(
        status_code=429,
        content={
            "error": "RateLimitExceeded",
            "detail": f"Rate limit exceeded: {exc.detail}",
            "retry_after": 60,
        },
        headers={
            "Retry-After": "60",
            "X-RateLimit-Limit": str(exc.detail),
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# Per-org token-bucket (legacy layer)
# ─────────────────────────────────────────────────────────────────────────────

class _Bucket:
    """Simple token-bucket for per-org rate limiting."""

    __slots__ = ("tokens", "last", "rate", "burst")

    def __init__(self, rate: float, burst: float) -> None:
        self.tokens = burst
        self.last = time.monotonic()
        self.rate = rate
        self.burst = burst

    def consume(self, amount: float = 1.0) -> bool:
        now = time.monotonic()
        elapsed = now - self.last
        self.last = now
        self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
        if self.tokens >= amount:
            self.tokens -= amount
            return True
        return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-org token-bucket middleware.

    Reads ``api_tokens`` settings bag:
    - ``rate_limit_per_minute``: int (default 0 = disabled for this org)
    - ``burst``: int (default = rate_limit_per_minute)
    - ``exempt_paths``: list[str] (default ["/api/system/health"])

    Token bucket per (org_id, ip). In-memory, single-process.
    For multi-worker production, set ``RATE_LIMIT_STORAGE_URI`` (see REDIS_RATE_LIMIT.md).

    This middleware is independent of the global ``RATE_LIMITING_ENABLED``
    flag — it is always registered but only activates when an org has a
    non-zero ``rate_limit_per_minute`` in their settings bag.
    """

    def __init__(self, app, default_rpm: int = 0) -> None:
        super().__init__(app)
        self._default_rpm = default_rpm
        self._buckets: dict[tuple[str, str], _Bucket] = {}
        self._lock = threading.Lock()

    async def dispatch(self, request: Request, call_next: Callable):
        path = request.url.path
        method = request.method.upper()
        # Resolve org_id from request state if available; otherwise skip.
        org_id = (
            getattr(request.state, "org_id", None)
            or request.headers.get("x-org-id")
            or ""
        )
        if not org_id:
            return await call_next(request)

        try:
            cfg = settings_service.get_bag(org_id, "api_tokens") or {}
        except Exception:
            cfg = {}

        rpm = int(cfg.get("rate_limit_per_minute") or self._default_rpm or 0)
        if rpm <= 0 and method in {"POST", "PUT", "PATCH", "DELETE"}:
            if path.startswith("/api/pos/"):
                rpm = 300
            elif path.startswith("/api/chatter"):
                rpm = 120
        if rpm <= 0:
            return await call_next(request)

        exempt = cfg.get("exempt_paths") or ["/api/system/health"]
        if any(path.startswith(p) for p in exempt):
            return await call_next(request)

        burst = float(cfg.get("burst") or rpm)
        rate_per_sec = rpm / 60.0
        ip = request.client.host if request.client else "unknown"
        key = (org_id, ip)

        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None or bucket.rate != rate_per_sec or bucket.burst != burst:
                bucket = _Bucket(rate_per_sec, burst)
                self._buckets[key] = bucket
            allowed = bucket.consume(1.0)

        if not allowed:
            try:
                from app.services.rate_limit_firestore import record_hit

                record_hit(org_id, path)
            except Exception:
                pass
            logger.warning(
                "org-rate-limit hit org=%s ip=%s path=%s rpm=%s",
                org_id, ip, path, rpm,
            )
            # Requirement 10.4: return 429 with RateLimitExceeded error
            return JSONResponse(
                status_code=429,
                content={
                    "error": "RateLimitExceeded",
                    "detail": "Rate limit exceeded",
                    "retry_after": 60,
                },
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit": str(rpm),
                },
            )
        return await call_next(request)
