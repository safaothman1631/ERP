"""Per-org-token rate limit middleware.

Reads `api_tokens` settings bag:
- rate_limit_per_minute: int (default 0 = disabled)
- burst: int (default = rate_limit_per_minute)
- exempt_paths: list[str] (default ["/api/system/health"])

Token bucket per (org_id, ip). In-memory, single-process. For multi-worker
production, replace with Redis-backed limiter — flagged with TODO.
"""
from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict
from typing import Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.services import settings_service

logger = logging.getLogger("rate_limit")


class _Bucket:
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
    def __init__(self, app, default_rpm: int = 0):
        super().__init__(app)
        self._default_rpm = default_rpm
        self._buckets: dict[tuple[str, str], _Bucket] = {}
        self._lock = threading.Lock()

    async def dispatch(self, request: Request, call_next: Callable):
        path = request.url.path
        # Resolve org_id from request state if available; otherwise fall back to no-limit.
        org_id = getattr(request.state, "org_id", None) or request.headers.get("x-org-id") or ""
        if not org_id:
            return await call_next(request)

        try:
            cfg = settings_service.get_bag(org_id, "api_tokens") or {}
        except Exception:
            cfg = {}
        rpm = int(cfg.get("rate_limit_per_minute") or self._default_rpm or 0)
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
            logger.warning("rate-limit hit org=%s ip=%s path=%s rpm=%s", org_id, ip, path, rpm)
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded", "retry_after": 60},
                headers={"Retry-After": "60", "X-RateLimit-Limit": str(rpm)},
            )
        return await call_next(request)
