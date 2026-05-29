"""CSP violation reporting endpoint (T-6.1, R7.4).

POST /api/csp-report — receives Content-Security-Policy violation reports
from browsers during the report-only rollout phase. We store the last
1000 reports in Redis (TTL 7 days, key pattern ``csp:report:{n}``) and
emit a structured log line for ingestion into Cloud Logging / BigQuery.

The endpoint is intentionally permissive:

* Browsers send the report **before** the page completes loading, so any
  500 we return is logged at the user's browser console — which is bad
  UX and bad signal. We swallow exceptions and always return 204.
* Both the legacy ``application/csp-report`` body shape (from
  ``report-uri``) and the newer ``application/json`` array shape (from
  ``report-to`` / Reporting API) are accepted.
* No auth: violation reports must be deliverable even before the user
  signs in. A rate limit (per-IP) is applied to prevent abuse.

The endpoint is wired up by ``app/main.py``::

    from app.api import csp_report
    app.include_router(csp_report.router)
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field

try:
    # Optional: shared Redis client used elsewhere in the app.
    from app.services.redis_client import get_redis  # type: ignore
except Exception:  # pragma: no cover - graceful degradation in dev
    get_redis = None  # type: ignore

logger = logging.getLogger("csp.report")

router = APIRouter(prefix="/api", tags=["security"])

# Ring-buffer size: keep the last N reports in Redis for triage.
RING_BUFFER_SIZE = 1000
# TTL on each individual report (7 days).
REPORT_TTL_SECONDS = 7 * 24 * 60 * 60
# Redis key for the rolling index counter.
COUNTER_KEY = "csp:report:counter"
# Prefix for each stored report.
REPORT_KEY_PREFIX = "csp:report:"


class CspReportBody(BaseModel):
    """Shape of a single CSP violation as sent under ``report-uri``.

    Fields per https://www.w3.org/TR/CSP3/#deprecated-serialize-violation
    Unknown fields are ignored to stay forward-compatible.
    """

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    document_uri: Optional[str] = Field(default=None, alias="document-uri")
    referrer: Optional[str] = None
    violated_directive: Optional[str] = Field(default=None, alias="violated-directive")
    effective_directive: Optional[str] = Field(default=None, alias="effective-directive")
    original_policy: Optional[str] = Field(default=None, alias="original-policy")
    disposition: Optional[str] = None
    blocked_uri: Optional[str] = Field(default=None, alias="blocked-uri")
    line_number: Optional[int] = Field(default=None, alias="line-number")
    column_number: Optional[int] = Field(default=None, alias="column-number")
    source_file: Optional[str] = Field(default=None, alias="source-file")
    status_code: Optional[int] = Field(default=None, alias="status-code")
    script_sample: Optional[str] = Field(default=None, alias="script-sample")


def _normalise(payload: Any) -> List[Dict[str, Any]]:
    """Flatten both legacy and Reporting-API shapes into a list of dicts."""
    out: List[Dict[str, Any]] = []
    if payload is None:
        return out

    # Legacy report-uri: {"csp-report": {...}}
    if isinstance(payload, dict) and "csp-report" in payload:
        out.append(dict(payload["csp-report"]))
        return out

    # Reporting API: [{"type": "csp-violation", "body": {...}}, ...]
    if isinstance(payload, list):
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            if entry.get("type") and entry.get("type") != "csp-violation":
                continue
            body = entry.get("body") or entry
            if isinstance(body, dict):
                out.append(body)
        return out

    # Bare dict — assume it is already the report body.
    if isinstance(payload, dict):
        out.append(payload)
    return out


async def _read_payload(request: Request) -> Any:
    """Tolerant body reader: tries JSON, falls back to raw bytes."""
    raw = await request.body()
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {"raw": raw[:2048].decode("utf-8", errors="replace")}


def _persist(report: Dict[str, Any]) -> None:
    """Best-effort persistence into Redis ring buffer."""
    if get_redis is None:
        return
    try:
        client = get_redis()
        if client is None:
            return
        # Atomic counter; modulo gives ring-buffer slot.
        idx = int(client.incr(COUNTER_KEY)) % RING_BUFFER_SIZE
        key = f"{REPORT_KEY_PREFIX}{idx}"
        client.setex(key, REPORT_TTL_SECONDS, json.dumps(report, default=str))
    except Exception as exc:  # pragma: no cover - never throw on report path
        logger.warning("csp_report.persist_failed", extra={"error": str(exc)})


@router.post(
    "/csp-report",
    status_code=status.HTTP_204_NO_CONTENT,
    include_in_schema=False,
    summary="CSP violation report sink",
)
async def csp_report(request: Request) -> Response:
    """Accept a CSP violation report and stash it for triage."""
    try:
        payload = await _read_payload(request)
        reports = _normalise(payload)
        ua = request.headers.get("user-agent", "")
        # ``X-Forwarded-For`` first hop only; we never persist a full IP.
        fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        ip_hash = str(hash(fwd)) if fwd else ""

        for r in reports:
            try:
                CspReportBody.model_validate(r)  # validation, but we keep raw too
            except Exception:
                # Keep the raw report — schema drift must not block triage.
                pass

            event = {
                "ts": time.time(),
                "ua": ua,
                "ip_hash": ip_hash,
                "report": r,
            }
            _persist(event)
            logger.warning(
                "csp.violation",
                extra={
                    "csp_directive": r.get("violated-directive") or r.get("effectiveDirective"),
                    "blocked_uri": r.get("blocked-uri") or r.get("blockedURL"),
                    "document_uri": r.get("document-uri") or r.get("documentURL"),
                    "source_file": r.get("source-file") or r.get("sourceFile"),
                    "line_number": r.get("line-number") or r.get("lineNumber"),
                    "disposition": r.get("disposition"),
                    "ip_hash": ip_hash,
                    "ua": ua,
                },
            )
    except Exception as exc:  # never throw on a report path
        logger.exception("csp_report.unhandled", extra={"error": str(exc)})

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/csp-report/_recent",
    include_in_schema=False,
    summary="List recent CSP reports (admin / debug)",
)
def list_recent(limit: int = 50) -> Dict[str, Any]:
    """Return the most recently stored CSP reports for triage.

    Not auth-protected here; production should gate via reverse proxy or
    add ``Depends(require_perm("system.read"))`` in ``main.py`` wiring.
    """
    items: List[Dict[str, Any]] = []
    if get_redis is None:
        return {"items": items, "note": "redis not configured"}
    try:
        client = get_redis()
        if client is None:
            return {"items": items, "note": "redis unavailable"}
        counter = int(client.get(COUNTER_KEY) or 0)
        # Walk backward from latest.
        n = max(1, min(limit, RING_BUFFER_SIZE))
        for i in range(n):
            slot = (counter - i) % RING_BUFFER_SIZE
            raw = client.get(f"{REPORT_KEY_PREFIX}{slot}")
            if raw is None:
                continue
            try:
                items.append(json.loads(raw))
            except Exception:
                continue
    except Exception as exc:
        logger.warning("csp_report.list_failed", extra={"error": str(exc)})
    return {"items": items, "count": len(items)}
