"""
Health Check API router.

Exposes GET /api/system/health/full — runs a comprehensive system health check
across all components and returns a FullHealthReport.

Caching:
  Results are cached per organisation for 30 seconds (Requirement 9.1, 9.2).
  The cache key is ``health:full:{org_id}``.  The cached value is a dict with
  two keys:
    - "result"     : the serialised FullHealthReport (as a dict)
    - "cached_at"  : a float (time.monotonic() value) recording when the result
                     was stored

  On each non-forced request the handler checks whether the cached entry is
  strictly less than 30 seconds old.  If so, the cached result is returned
  immediately without re-running component checks (Requirement 9.2).

  When ``force=True`` is passed the cache is bypassed, a fresh check is run,
  and the cache is updated with the new result (Requirement 9.4).

Authentication:
  Any authenticated user is allowed (Requirement 1.12, 10.1).
  Unauthenticated requests are rejected with HTTP 401 by the
  ``get_current_user`` FastAPI dependency.

Requirements: 1.12, 9.1, 9.2, 9.3, 9.4, 10.1
"""
from __future__ import annotations

import dataclasses
import time

from fastapi import APIRouter, Depends, Query

from app.cache import cache
from app.services.auth import get_current_user
from app.services.health_checker import FullHealthReport, HealthChecker

router = APIRouter(prefix="/api/system", tags=["Health"])

# How long (in seconds) a cached health result is considered fresh.
_CACHE_TTL_SECONDS: float = 30.0


def _report_to_dict(report: FullHealthReport) -> dict:
    """Serialise a FullHealthReport dataclass to a plain dict.

    Uses ``dataclasses.asdict`` which recursively converts nested dataclasses
    (i.e. each HealthCheckResult in ``components``) to dicts as well.

    Args:
        report: The FullHealthReport instance to serialise.

    Returns:
        A JSON-serialisable dict representation of the report.
    """
    return dataclasses.asdict(report)


@router.get("/health/full")
async def get_full_health(
    force: bool = Query(False, description="Bypass cache and run a fresh health check"),
    user: dict = Depends(get_current_user),
) -> dict:
    """Return a full system health report for the authenticated user's organisation.

    Behaviour:
      - Without ``force``: returns a cached result if it is less than 30 seconds
        old; otherwise runs a fresh check, updates the cache, and returns the
        new result.
      - With ``force=True``: always runs a fresh check, updates the cache, and
        returns the new result.

    Args:
        force: When ``True``, bypass the cache and force a fresh check.
        user:  The authenticated user dict injected by ``get_current_user``.
               Unauthenticated requests never reach this handler — FastAPI
               raises HTTP 401 before the function is called.

    Returns:
        A JSON-serialisable dict matching the ``FullHealthReport`` schema.

    Requirements: 1.12, 9.1, 9.2, 9.3, 9.4, 10.1
    """
    org_id: str = user["org_id"]
    cache_key: str = f"health:full:{org_id}"

    # ── Try to serve from cache (non-force requests only) ─────────────────
    if not force:
        cached_entry = cache.get(cache_key)
        if cached_entry is not None:
            age_seconds = time.monotonic() - cached_entry["cached_at"]
            if age_seconds < _CACHE_TTL_SECONDS:
                # Cache hit — return the stored result without re-running checks
                return cached_entry["result"]

    # ── Run a fresh health check ───────────────────────────────────────────
    checker = HealthChecker()
    report: FullHealthReport = await checker.run_full_check()
    result_dict = _report_to_dict(report)

    # ── Update the cache with the fresh result ────────────────────────────
    cache.set(cache_key, {
        "result": result_dict,
        "cached_at": time.monotonic(),
    })

    return result_dict
