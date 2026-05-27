"""Richer /api/health endpoint (P4 / R7.2 allowlist, design §3).

Returns a JSON payload covering app + dependency health, suitable for the
load balancer / readiness probe AND human inspection.

Distinct from the deeper ``/api/system/health/full`` introspection — this
endpoint is unauthenticated, fast, and side-effect free.

Response shape
--------------
::

    {
      "status": "ok" | "degraded" | "down",
      "version": "<git-sha-or-package-version>",
      "firestore": "ok" | "degraded" | "down",
      "redis": "ok" | "down",
      "scheduler": "running" | "stopped",
      "timestamp": "2026-05-27T12:34:56Z"
    }

Overall ``status`` is the worst of the components: any "down" downgrades to
"down"; any "degraded" downgrades to "degraded"; otherwise "ok".
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

log = logging.getLogger("api.health_check")

router = APIRouter(tags=["Health"])


HEALTH_PROBE_TIMEOUT_S: float = 1.0


# ── Schema ──────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: Literal["ok", "degraded", "down"]
    version: str
    firestore: Literal["ok", "degraded", "down"]
    redis: Literal["ok", "down"]
    scheduler: Literal["running", "stopped"]
    timestamp: datetime
    detail: Optional[str] = Field(None, description="Human note when not 'ok'")


# ── Probes ──────────────────────────────────────────────────────────────────


async def _probe_firestore() -> str:
    """1-second timeout Firestore ping — uses the async client root if possible."""
    try:
        from app.firestore.client import get_async_client
        client = get_async_client()
    except Exception as e:  # noqa: BLE001
        log.warning("health.firestore_no_client", extra={"err": str(e)})
        return "down"

    async def _ping() -> bool:
        # Read a single doc from a known small collection — cheap and bounded.
        try:
            await client.collection("_health").document("ping").get()
            return True
        except Exception as e:  # noqa: BLE001
            log.warning("health.firestore_probe_failed", extra={"err": str(e)})
            return False

    try:
        ok = await asyncio.wait_for(_ping(), timeout=HEALTH_PROBE_TIMEOUT_S)
        return "ok" if ok else "degraded"
    except asyncio.TimeoutError:
        return "degraded"


async def _probe_redis() -> str:
    """1-second timeout Redis PING via the cache facade."""
    try:
        from app.services.cache import get_cache
        cache = get_cache()
    except Exception as e:  # noqa: BLE001
        log.debug("health.redis_no_cache", extra={"err": str(e)})
        return "down"
    try:
        ok = await asyncio.wait_for(cache.ping(), timeout=HEALTH_PROBE_TIMEOUT_S)
        return "ok" if ok else "down"
    except asyncio.TimeoutError:
        return "down"
    except Exception as e:  # noqa: BLE001
        log.warning("health.redis_probe_failed", extra={"err": str(e)})
        return "down"


def _probe_scheduler() -> str:
    """Reflect the global scheduler instance, if registered."""
    try:
        # Convention: main.py stores the scheduler on app.state, but here we
        # don't have ``request`` — we look it up via a module-level fallback.
        from app.services import scheduler as scheduler_mod  # type: ignore
    except Exception:  # noqa: BLE001
        return "stopped"
    sched = getattr(scheduler_mod, "scheduler", None)
    if sched is None:
        return "stopped"
    running = getattr(sched, "running", False)
    return "running" if running else "stopped"


def _resolve_version() -> str:
    """Return a short version string from env or fallback to 'dev'."""
    return (
        os.environ.get("APP_VERSION")
        or os.environ.get("GIT_SHA")
        or os.environ.get("K_REVISION")  # Cloud Run revision name
        or "dev"
    )


def _aggregate_status(firestore: str, redis: str, scheduler: str) -> str:
    """Reduce per-component states into the overall status."""
    if firestore == "down" or redis == "down" or scheduler == "stopped":
        return "down"
    if firestore == "degraded":
        return "degraded"
    return "ok"


# ── Endpoint ────────────────────────────────────────────────────────────────


@router.get("/api/health", response_model=HealthResponse, summary="Liveness / readiness")
async def health() -> HealthResponse:
    """Return per-component health with a 1-second probe timeout per dep."""
    started = time.perf_counter()

    firestore_status, redis_status = await asyncio.gather(
        _probe_firestore(),
        _probe_redis(),
    )
    scheduler_status = _probe_scheduler()
    overall = _aggregate_status(firestore_status, redis_status, scheduler_status)

    elapsed_ms = (time.perf_counter() - started) * 1000
    log.info(
        "health.check",
        extra={
            "overall": overall,
            "firestore": firestore_status,
            "redis": redis_status,
            "scheduler": scheduler_status,
            "elapsed_ms": round(elapsed_ms, 1),
        },
    )

    return HealthResponse(
        status=overall,  # type: ignore[arg-type]
        version=_resolve_version(),
        firestore=firestore_status,  # type: ignore[arg-type]
        redis=redis_status,  # type: ignore[arg-type]
        scheduler=scheduler_status,  # type: ignore[arg-type]
        timestamp=datetime.now(timezone.utc),
    )


__all__ = ["router", "HealthResponse", "HEALTH_PROBE_TIMEOUT_S"]
