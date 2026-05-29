"""Cron-driven status-page emitter (G2 / R2.5).

Pushes per-component health to a public status page provider (Statuspage.io
or self-hosted Cachet). Component sources:

  * **API** — derived from ``_ROUTE_STATS`` rolling 5xx rate and p95 latency.
  * **Firestore** — derived from recent quota-error counts.
  * **POS offline sync** — derived from outbox-drain success rate.
  * **Email delivery** — derived from SendGrid bounce/defer recent counts.

The emitter is invoked from APScheduler every 60s. Failures are logged
but never raise — a broken status-page push must not take down the app.

Environment variables consumed (all optional; if absent we no-op):

  * ``STATUSPAGE_API_KEY``      — Bearer token for api.statuspage.io
  * ``STATUSPAGE_PAGE_ID``      — Page identifier
  * ``STATUSPAGE_COMPONENTS``   — JSON dict ``{"api": "<id>", ...}``
  * ``CACHET_URL`` / ``CACHET_TOKEN`` — fallback (self-hosted)
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, status

log = logging.getLogger("api.internal.health_emit")

router = APIRouter(prefix="/api/internal", tags=["Internal / Health"])


# ── Component health derivation ───────────────────────────────────────────


def _route_stats() -> dict[str, Any]:
    """Return a snapshot of recent route metrics.

    We import lazily — ``_ROUTE_STATS`` lives in the observability module
    which is allowed to be absent in tests.
    """
    try:
        from app.middleware.fs_observability import _ROUTE_STATS  # type: ignore

        return dict(_ROUTE_STATS)
    except Exception:  # noqa: BLE001
        return {}


def _api_status() -> str:
    """Map rolling 5xx rate to a statuspage status string."""
    stats = _route_stats()
    err = 0
    total = 0
    for entry in stats.values():
        if isinstance(entry, dict):
            err += int(entry.get("err_5xx", 0))
            total += int(entry.get("total", 0))
    if not total:
        return "operational"
    rate = err / total
    if rate >= 0.10:
        return "major_outage"
    if rate >= 0.02:
        return "partial_outage"
    if rate >= 0.005:
        return "degraded_performance"
    return "operational"


def _firestore_status() -> str:
    """Quota-error indicator. Best-effort."""
    try:
        from app.cache import cache

        quota = cache.get("fs_quota_errors_60s") or 0
        if int(quota) > 50:
            return "major_outage"
        if int(quota) > 5:
            return "degraded_performance"
    except Exception:  # noqa: BLE001
        pass
    return "operational"


def _pos_sync_status() -> str:
    try:
        from app.cache import cache

        pending = int(cache.get("pos_outbox_pending") or 0)
        failed = int(cache.get("pos_outbox_failed_24h") or 0)
        if failed > 100:
            return "major_outage"
        if failed > 10 or pending > 1000:
            return "degraded_performance"
    except Exception:  # noqa: BLE001
        pass
    return "operational"


def _email_status() -> str:
    try:
        from app.cache import cache

        bounce_pct = float(cache.get("email_bounce_pct_24h") or 0)
        if bounce_pct >= 5.0:
            return "major_outage"
        if bounce_pct >= 1.0:
            return "degraded_performance"
    except Exception:  # noqa: BLE001
        pass
    return "operational"


def collect_component_status() -> dict[str, str]:
    return {
        "api": _api_status(),
        "firestore": _firestore_status(),
        "pos_offline_sync": _pos_sync_status(),
        "email_delivery": _email_status(),
    }


# ── Statuspage push ───────────────────────────────────────────────────────


def _statuspage_push(components: dict[str, str]) -> dict[str, Any]:
    """PATCH each configured component to its current status.

    Returns a summary dict; never raises.
    """
    api_key = os.environ.get("STATUSPAGE_API_KEY")
    page_id = os.environ.get("STATUSPAGE_PAGE_ID")
    mapping_raw = os.environ.get("STATUSPAGE_COMPONENTS", "{}")
    if not api_key or not page_id:
        return {"provider": "statuspage", "skipped": "missing_env"}

    try:
        mapping = json.loads(mapping_raw)
    except Exception:  # noqa: BLE001
        mapping = {}

    pushed: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    try:
        import httpx  # type: ignore
    except Exception:  # noqa: BLE001
        return {"provider": "statuspage", "skipped": "httpx_missing"}

    headers = {
        "Authorization": f"OAuth {api_key}",
        "Content-Type": "application/json",
    }
    for comp_key, comp_status in components.items():
        comp_id = mapping.get(comp_key)
        if not comp_id:
            continue
        url = (
            f"https://api.statuspage.io/v1/pages/{page_id}/components/{comp_id}.json"
        )
        body = {"component": {"status": comp_status}}
        try:
            with httpx.Client(timeout=5.0) as cli:
                r = cli.patch(url, headers=headers, json=body)
            if r.status_code >= 300:
                errors.append({"component": comp_key, "status": r.status_code})
            else:
                pushed.append({"component": comp_key, "status": comp_status})
        except Exception as exc:  # noqa: BLE001
            errors.append({"component": comp_key, "err": str(exc)})

    return {"provider": "statuspage", "pushed": pushed, "errors": errors}


def _cachet_push(components: dict[str, str]) -> dict[str, Any]:
    """Self-hosted Cachet fallback."""
    base = os.environ.get("CACHET_URL")
    token = os.environ.get("CACHET_TOKEN")
    mapping_raw = os.environ.get("CACHET_COMPONENTS", "{}")
    if not base or not token:
        return {"provider": "cachet", "skipped": "missing_env"}
    try:
        mapping = json.loads(mapping_raw)
    except Exception:  # noqa: BLE001
        mapping = {}
    try:
        import httpx  # type: ignore
    except Exception:  # noqa: BLE001
        return {"provider": "cachet", "skipped": "httpx_missing"}

    # Cachet uses 1..4 (1=Operational, 4=Major Outage).
    cachet_map = {
        "operational": 1,
        "degraded_performance": 2,
        "partial_outage": 3,
        "major_outage": 4,
    }
    headers = {"X-Cachet-Token": token, "Content-Type": "application/json"}
    pushed, errors = [], []
    for k, s in components.items():
        cid = mapping.get(k)
        if not cid:
            continue
        try:
            with httpx.Client(timeout=5.0) as cli:
                r = cli.put(
                    f"{base.rstrip('/')}/api/v1/components/{cid}",
                    headers=headers,
                    json={"status": cachet_map.get(s, 1)},
                )
            if r.status_code >= 300:
                errors.append({"component": k, "status": r.status_code})
            else:
                pushed.append({"component": k, "status": s})
        except Exception as exc:  # noqa: BLE001
            errors.append({"component": k, "err": str(exc)})
    return {"provider": "cachet", "pushed": pushed, "errors": errors}


# ── Cron entry-point ──────────────────────────────────────────────────────


def emit_status_now() -> dict[str, Any]:
    """Called by APScheduler every 60 seconds."""
    comps = collect_component_status()
    out: dict[str, Any] = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "components": comps,
    }
    out["statuspage"] = _statuspage_push(comps)
    out["cachet"] = _cachet_push(comps)
    log.info("status_page.emit", extra={"components": comps})
    return out


# ── HTTP trigger (for manual ops + cron-style external triggers) ──────────


@router.post(
    "/health-emit",
    summary="Manually push the current component status to the status page",
)
async def trigger_emit(
    x_internal_token: Optional[str] = Header(default=None, alias="X-Internal-Token"),
):
    expected = os.environ.get("INTERNAL_CRON_TOKEN")
    if expected and x_internal_token != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="internal token required"
        )
    return emit_status_now()


@router.get(
    "/health-snapshot",
    summary="Read the component status the next push would emit (no side effects)",
)
async def snapshot():
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "components": collect_component_status(),
    }


ALL_ROUTERS = [router]

__all__ = [
    "router",
    "ALL_ROUTERS",
    "emit_status_now",
    "collect_component_status",
]
