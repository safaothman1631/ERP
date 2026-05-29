"""Redis-backed slowapi limiter (P4 / R5.5, design §3.8).

Replaces the in-memory limiter for production. Falls back to memory in dev.

Key layout
----------
``{tenant_id}:{remote_addr}`` — so a single noisy IP cannot exhaust the limit
across all tenants on shared hosts (e.g. mobile carrier NATs).

Per-tenant defaults
-------------------
- authenticated traffic: ``600/minute``
- unauthenticated traffic: ``60/minute``

Wiring
------
In ``main.py``::

    from app.middleware.rate_limit_redis import (
        limiter,
        register_rate_limit_middleware,
    )

    app.state.limiter = limiter
    register_rate_limit_middleware(app)

Then per-route overrides::

    @router.get("/items")
    @limiter.limit("600/minute")
    async def list_items(request: Request): ...

    @router.post("/items")
    @limiter.limit("60/minute")
    async def create_item(request: Request): ...
"""
from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

log = logging.getLogger("middleware.rate_limit_redis")


DEFAULT_AUTHED_RATE = "600/minute"
DEFAULT_ANON_RATE = "60/minute"


def _tenant_aware_key(request: Request) -> str:
    """Build the limiter partition key.

    Format::

        {tenant_id|anon}:{remote_addr}

    Reads ``request.state.tenant_id`` (populated by the tenant middleware).
    Falls back to ``anon`` when the tenant is not yet resolved (e.g. on
    allowlisted routes that don't go through the tenant middleware).
    """
    tenant = getattr(request.state, "tenant_id", None) or "anon"
    return f"{tenant}:{get_remote_address(request)}"


def _build_storage_uri() -> str:
    """Resolve the slowapi storage backend URI from env.

    Order:
      1. ``REDIS_URL`` (Memorystore / Upstash / local Docker)
      2. ``RATE_LIMIT_REDIS_URL`` (override just for the limiter)
      3. ``memory://`` (dev fallback only)
    """
    url = os.environ.get("RATE_LIMIT_REDIS_URL") or os.environ.get("REDIS_URL")
    if not url:
        log.warning("rate_limit.no_redis_url — falling back to in-memory store")
        return "memory://"
    # slowapi accepts ``async+redis://...`` for async storage. We coerce here.
    if url.startswith("redis://"):
        return f"async+{url}"
    if url.startswith("rediss://"):
        return f"async+{url}"
    return url


def _build_limiter() -> Limiter:
    storage_uri = _build_storage_uri()
    log.info(
        "rate_limit.init",
        extra={"storage": storage_uri.split("@")[-1], "key": "tenant:ip"},
    )
    return Limiter(
        key_func=_tenant_aware_key,
        storage_uri=storage_uri,
        default_limits=[DEFAULT_AUTHED_RATE],
        headers_enabled=True,
        strategy="moving-window",
    )


# Module-level limiter — imported by routers for the @limiter.limit(...) decorator.
limiter: Limiter = _build_limiter()


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """JSON 429 response with retry info."""
    log.info(
        "rate_limit.exceeded",
        extra={
            "tenant": getattr(request.state, "tenant_id", None),
            "remote": get_remote_address(request),
            "path": request.url.path,
            "detail": str(exc.detail),
        },
    )
    retry_after = getattr(exc, "retry_after", None)
    headers = {"Retry-After": str(retry_after)} if retry_after else {}
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "detail": "ڕێژەی داواکانت زۆرە، تکایە چەند چرکەیەک چاوەڕێ بکە.",
            "limit": str(exc.detail) if exc.detail else None,
        },
        headers=headers,
    )


def register_rate_limit_middleware(app: FastAPI) -> None:
    """Wire the Redis-backed limiter into a FastAPI app.

    Idempotent: safe to call once at startup. Must be invoked before any
    router declares ``@limiter.limit(...)`` on a route handler.
    """
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)  # type: ignore[arg-type]
    app.add_middleware(SlowAPIMiddleware)
    log.info("rate_limit.middleware_registered")


__all__ = [
    "limiter",
    "register_rate_limit_middleware",
    "DEFAULT_AUTHED_RATE",
    "DEFAULT_ANON_RATE",
]
