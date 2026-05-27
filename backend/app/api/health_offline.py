"""
health_offline.py
-----------------------------------------------------------------------------
Internal admin endpoint that exposes the most recent synthetic-probe results
from `audit/probes/` so that external alerters (Cloud Monitoring uptime
checks, Slackbot, etc.) can poll a single URL to know whether the latest
probe is healthy.

This is companion to `scripts/production-reality-probe.mjs` — the probe
writes JSON to `audit/probes/probe-{ISO}.json`, this endpoint surfaces the
latest file.

Endpoint:
  GET /api/health/synthetic-summary?since=24h

Query:
  since   — relative window (e.g. "1h", "24h", "7d"). Defaults to 24h.
            We surface only probe files whose mtime is newer than `now - since`.
            If no fresh file exists, the response is { ok: false, reason: ... }.

Authentication:
  Authenticated user required; admin role required (any tenant). The endpoint
  exposes operational data only — never customer PII.

Mounting:
  Self-contained APIRouter. Mount from app.main with::

      try:
          from app.api import health_offline as _ho
          app.include_router(_ho.router)
      except Exception as _e:  # noqa: BLE001
          logging.getLogger(__name__).warning("health_offline not mounted: %s", _e)

References:
  validation.md V-PR.1 / V-PR.7 (synthetic probe surfacing)
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.services.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health · Synthetic"])

# Path discovery — repo root is two levels up from `backend/app/api/`.
# Allow override for tests / containerised deploys via PROBE_AUDIT_DIR.
_DEFAULT_PROBE_DIR = Path(__file__).resolve().parents[3] / "audit" / "probes"


def _probe_dir() -> Path:
    env = os.environ.get("PROBE_AUDIT_DIR")
    return Path(env) if env else _DEFAULT_PROBE_DIR


def _parse_since(since: str) -> int:
    """Parse a duration string like '24h', '90m', '7d' into seconds. Defaults to 24h."""
    if not since:
        return 24 * 3600
    m = re.fullmatch(r"\s*(\d+)\s*([smhd])\s*", since.lower())
    if not m:
        return 24 * 3600
    n = int(m.group(1))
    unit = m.group(2)
    return n * {"s": 1, "m": 60, "h": 3600, "d": 86_400}[unit]


def _is_admin(user: dict) -> bool:
    role = (user.get("role") or user.get("system_role") or "").lower()
    return role in {"admin", "owner", "platform_admin", "tenant_admin"}


def _latest_probe_file(window_sec: int) -> Optional[Path]:
    """Return the newest `probe-*.json` modified within `window_sec` of now."""
    pdir = _probe_dir()
    if not pdir.exists():
        return None
    cutoff = time.time() - window_sec
    candidates: list[tuple[float, Path]] = []
    for p in pdir.glob("probe-*.json"):
        try:
            mtime = p.stat().st_mtime
        except OSError:
            continue
        if mtime >= cutoff:
            candidates.append((mtime, p))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][1]


def _summarise(payload: dict[str, Any]) -> dict[str, Any]:
    results = payload.get("results", []) or []
    total = len(results)
    passed = sum(1 for r in results if r.get("verdict", {}).get("status") == "pass")
    warned = sum(1 for r in results if r.get("verdict", {}).get("status") == "warn")
    failed = sum(1 for r in results if r.get("verdict", {}).get("status") == "fail")
    skipped = sum(1 for r in results if r.get("verdict", {}).get("status") == "skip")
    worst = None
    for r in results:
        p95 = r.get("p95_ms")
        if p95 is None:
            continue
        if worst is None or p95 > worst.get("p95_ms", 0):
            worst = r
    return {
        "ok": failed == 0,
        "total_endpoints": total,
        "passed": passed,
        "warned": warned,
        "failed": failed,
        "skipped": skipped,
        "worst_endpoint": (
            None if worst is None else {
                "path": worst.get("path"),
                "slo_class": worst.get("slo_class"),
                "p95_ms": worst.get("p95_ms"),
                "verdict": worst.get("verdict"),
            }
        ),
    }


@router.get(
    "/api/health/synthetic-summary",
    summary="Latest synthetic probe summary (admin-only)",
)
async def synthetic_summary(
    since: str = Query("24h", description="Lookback window: e.g. 1h, 24h, 7d"),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Return the latest probe JSON inside `since`, with summary fields prepended.

    Response shape::

        {
          "ok": true|false,
          "reason": "...",            # only when ok=false
          "generated_at": "...",
          "base_url": "...",
          "summary": { passed, warned, failed, skipped, worst_endpoint },
          "results": [...],            # raw rows from the probe
          "source_file": "probe-...json"
        }
    """
    if not _is_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )

    window_sec = _parse_since(since)
    latest = _latest_probe_file(window_sec)
    if latest is None:
        return {
            "ok": False,
            "reason": f"No probe artifact found within last {since}",
            "checked_dir": str(_probe_dir()),
            "now": datetime.now(tz=timezone.utc).isoformat(),
        }

    try:
        with latest.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        logger.warning("synthetic-summary: failed to read %s: %s", latest, exc)
        return {
            "ok": False,
            "reason": "Could not parse latest probe file",
            "source_file": latest.name,
        }

    summary = _summarise(payload)
    return {
        **summary,
        "generated_at": payload.get("generated_at"),
        "base_url": payload.get("base_url"),
        "samples_per_endpoint": payload.get("samples_per_endpoint"),
        "results": payload.get("results", []),
        "source_file": latest.name,
        "now": datetime.now(tz=timezone.utc).isoformat(),
    }
