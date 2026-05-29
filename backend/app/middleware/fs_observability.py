"""Firestore read/write metrics per HTTP request (Wave O)."""
from __future__ import annotations

import logging
import time

from fastapi import Request, Response

from app.config import settings
from app.services import fs_metrics

logger = logging.getLogger(__name__)

_SLOW_READS = 1000
_SLOW_MS = 500


async def fs_observability_middleware(request: Request, call_next):
    if not getattr(settings, "FS_METRICS_ENABLED", True):
        return await call_next(request)

    fs_metrics.reset()
    start = time.perf_counter()
    response: Response = await call_next(request)
    duration_ms = int((time.perf_counter() - start) * 1000)
    metrics = fs_metrics.get_metrics()

    response.headers["X-FS-Reads"] = str(metrics["reads"])
    response.headers["X-FS-Writes"] = str(metrics["writes"])

    org_id = getattr(request.state, "org_id", None)
    if not org_id:
        user = getattr(request.state, "user", None) or {}
        org_id = user.get("org_id") if isinstance(user, dict) else None

    log_payload = {
        "event": "firestore_request",
        "path": request.url.path,
        "method": request.method,
        "org_id": org_id,
        "fs_reads": metrics["reads"],
        "fs_writes": metrics["writes"],
        "duration_ms": duration_ms,
        "status": response.status_code,
    }
    logger.info("firestore_request", extra=log_payload)

    if metrics["reads"] > _SLOW_READS or duration_ms > _SLOW_MS:
        logger.warning("slow_firestore_query", extra={**log_payload, "event": "slow_firestore_query"})

    return response
