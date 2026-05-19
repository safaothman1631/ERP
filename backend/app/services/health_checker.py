"""
System Health Checker service.

Runs concurrent checks across all system components and returns a structured
FullHealthReport. Each component check is an async coroutine gathered via
asyncio.gather(return_exceptions=True) so one failing check never blocks others.

Components checked:
  1. Firestore connectivity
  2. Firebase Auth service
  3. Firebase Cloud Storage
  4. APScheduler (background jobs)
  5. API self-check (response time of /api/health)
  6. Memory usage percentage (psutil)
  7. CPU usage percentage (psutil)
  8. Recent error count (last 1 hour from audit_logs)

Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11,
              1.13, 1.14, 10.5
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Data models
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class HealthCheckResult:
    """Result of a single component health check.

    Attributes:
        component:       Human-readable component name (e.g. "firestore").
        status:          One of "healthy", "degraded", or "unhealthy".
        response_time_ms: Round-trip time in milliseconds for the check.
        message:         Sanitized, human-readable status description.
                         Never contains raw stack traces (Requirement 10.5).
        checked_at:      ISO 8601 UTC timestamp of when the check ran.
    """
    component: str
    status: Literal["healthy", "degraded", "unhealthy"]
    response_time_ms: float
    message: str
    checked_at: str  # ISO8601 UTC


@dataclass
class FullHealthReport:
    """Aggregated health report for all system components.

    Attributes:
        overall_status:   Worst-case status across all components.
        checked_at:       ISO 8601 UTC timestamp of this check run.
        components:       One HealthCheckResult per component (8 total).
        recommendations:  Actionable strings for every non-healthy component.
    """
    overall_status: Literal["healthy", "degraded", "unhealthy"]
    checked_at: str  # ISO8601 UTC
    components: list[HealthCheckResult]
    recommendations: list[str]


# ─────────────────────────────────────────────────────────────────────────────
# HealthChecker
# ─────────────────────────────────────────────────────────────────────────────

# Substrings that must never appear in sanitized error messages (Req 10.5)
_STACK_TRACE_MARKERS = ("Traceback", 'File "', "line ", "raise ")

# Response-time threshold (ms) above which a component is "degraded"
_RESPONSE_TIME_DEGRADED_MS = 500.0

# Memory thresholds (%)
_MEMORY_UNHEALTHY_PCT = 95.0
_MEMORY_DEGRADED_PCT = 85.0

# CPU threshold (%)
_CPU_DEGRADED_PCT = 80.0

# Error count thresholds (last 1 hour)
_ERROR_COUNT_UNHEALTHY = 200
_ERROR_COUNT_DEGRADED = 50


def _now_iso() -> str:
    """Return the current UTC time as an ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


def _sanitize_message(msg: str) -> str:
    """Strip any stack-trace fragments from an error message.

    Requirement 10.5: API responses must never contain raw exception stack
    traces. This function removes lines that contain known stack-trace markers.

    Args:
        msg: Raw exception message or description.

    Returns:
        A sanitized, single-line human-readable string.
    """
    lines = msg.splitlines()
    clean_lines = [
        line for line in lines
        if not any(marker in line for marker in _STACK_TRACE_MARKERS)
    ]
    result = " ".join(clean_lines).strip()
    # Final safety pass: replace any remaining marker occurrences
    for marker in _STACK_TRACE_MARKERS:
        result = result.replace(marker, "")
    return result.strip() or "Component check failed"


class HealthChecker:
    """Runs all system component health checks concurrently.

    Usage::

        checker = HealthChecker()
        report = await checker.run_full_check()

    The checker is stateless — a new instance can be created per request.
    """

    # ── Public entry point ────────────────────────────────────────────────

    async def run_full_check(self) -> FullHealthReport:
        """Run all 8 component checks concurrently and return a FullHealthReport.

        Uses asyncio.gather(return_exceptions=True) so that one failing check
        never blocks the others (Requirement 1.6).

        Returns:
            A FullHealthReport with overall_status, per-component results,
            and actionable recommendations.
        """
        checked_at = _now_iso()

        checks = [
            self._check_firestore(),
            self._check_auth(),
            self._check_storage(),
            self._check_scheduler(),
            self._check_api_self(),
            self._check_memory(),
            self._check_cpu(),
            self._check_recent_errors(),
        ]

        raw_results = await asyncio.gather(*checks, return_exceptions=True)

        results: list[HealthCheckResult] = []
        for i, result in enumerate(raw_results):
            if isinstance(result, Exception):
                # A check coroutine itself raised — treat as unhealthy
                component_names = [
                    "firestore", "auth", "storage", "scheduler",
                    "api_self", "memory", "cpu", "recent_errors",
                ]
                component = component_names[i] if i < len(component_names) else f"component_{i}"
                results.append(
                    self._classify_result(
                        component=component,
                        response_time_ms=0.0,
                        exception=result,
                        extra={},
                    )
                )
            else:
                results.append(result)

        overall = self._compute_overall(results)
        recommendations = self._build_recommendations(results)

        return FullHealthReport(
            overall_status=overall,
            checked_at=checked_at,
            components=results,
            recommendations=recommendations,
        )

    # ── Component check implementations (task 1.4) ───────────────────────

    async def _check_firestore(self) -> HealthCheckResult:
        """Ping Firestore by reading a lightweight sentinel document.

        Reads (or creates) the ``_healthcheck/ping`` document and measures
        the round-trip latency.  Any exception is caught by the caller via
        ``asyncio.gather(return_exceptions=True)``.

        Requirements: 1.1, 1.2
        """
        start = time.monotonic()
        exception: Exception | None = None
        try:
            from app.firebase_client import get_db
            db = get_db()
            # Run the blocking Firestore call in a thread pool so we don't
            # block the event loop.
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: db.collection("_healthcheck").document("ping").get(),
            )
        except Exception as exc:
            exception = exc
        finally:
            elapsed_ms = (time.monotonic() - start) * 1000.0

        return self._classify_result(
            component="firestore",
            response_time_ms=elapsed_ms,
            exception=exception,
            extra={},
        )

    async def _check_auth(self) -> HealthCheckResult:
        """Verify Firebase Auth is reachable via list_users(max_results=1).

        Calls the Firebase Admin SDK ``list_users`` with ``max_results=1`` to
        confirm the Auth service is reachable.  Measures round-trip latency.

        Requirements: 1.1, 1.2
        """
        start = time.monotonic()
        exception: Exception | None = None
        try:
            from firebase_admin import auth as firebase_auth
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: firebase_auth.list_users(max_results=1),
            )
        except Exception as exc:
            exception = exc
        finally:
            elapsed_ms = (time.monotonic() - start) * 1000.0

        return self._classify_result(
            component="auth",
            response_time_ms=elapsed_ms,
            exception=exception,
            extra={},
        )

    async def _check_storage(self) -> HealthCheckResult:
        """Verify Firebase Cloud Storage bucket is accessible.

        Calls ``get_bucket().exists()`` to confirm the bucket is reachable.
        Measures round-trip latency.

        Requirements: 1.1, 1.2
        """
        start = time.monotonic()
        exception: Exception | None = None
        try:
            from app.firebase_client import get_bucket
            bucket = get_bucket()
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, bucket.exists)
        except Exception as exc:
            exception = exc
        finally:
            elapsed_ms = (time.monotonic() - start) * 1000.0

        return self._classify_result(
            component="storage",
            response_time_ms=elapsed_ms,
            exception=exception,
            extra={},
        )

    async def _check_scheduler(self) -> HealthCheckResult:
        """Check that the APScheduler instance is running.

        Calls ``get_scheduler()`` from ``scheduler.py`` and verifies the
        returned instance is not ``None`` and reports ``running == True``.

        Requirements: 1.1, 1.2
        """
        start = time.monotonic()
        exception: Exception | None = None
        try:
            from app.services.scheduler import get_scheduler
            scheduler = get_scheduler()
            if scheduler is None:
                raise RuntimeError("Scheduler instance is None — scheduler has not been started")
            if not scheduler.running:
                raise RuntimeError("Scheduler is not running")
        except Exception as exc:
            exception = exc
        finally:
            elapsed_ms = (time.monotonic() - start) * 1000.0

        return self._classify_result(
            component="scheduler",
            response_time_ms=elapsed_ms,
            exception=exception,
            extra={},
        )

    async def _check_api_self(self) -> HealthCheckResult:
        """HTTP GET to /api/health and measure response time.

        Uses ``httpx.AsyncClient`` to call the local ``/api/health`` endpoint.
        The base URL is read from the ``API_SELF_CHECK_URL`` environment
        variable (default: ``http://localhost:8000``).  Raises on connection
        failure or non-2xx response.

        Requirements: 1.1, 1.2
        """
        import os
        import httpx

        base_url = os.environ.get("API_SELF_CHECK_URL", "http://localhost:8000")
        url = f"{base_url}/api/health"

        start = time.monotonic()
        exception: Exception | None = None
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                response.raise_for_status()
        except Exception as exc:
            exception = exc
        finally:
            elapsed_ms = (time.monotonic() - start) * 1000.0

        return self._classify_result(
            component="api_self",
            response_time_ms=elapsed_ms,
            exception=exception,
            extra={},
        )

    async def _check_memory(self) -> HealthCheckResult:
        """Read system memory usage via psutil.virtual_memory().percent.

        Passes the percentage to ``_classify_result`` via the ``extra`` dict
        so that memory-specific thresholds (85 % / 95 %) are applied.

        Requirements: 1.7, 1.8
        """
        import psutil

        start = time.monotonic()
        exception: Exception | None = None
        memory_pct: float = 0.0
        try:
            loop = asyncio.get_event_loop()
            memory_pct = await loop.run_in_executor(
                None,
                lambda: psutil.virtual_memory().percent,
            )
        except Exception as exc:
            exception = exc
        finally:
            elapsed_ms = (time.monotonic() - start) * 1000.0

        return self._classify_result(
            component="memory",
            response_time_ms=elapsed_ms,
            exception=exception,
            extra={"memory_pct": memory_pct},
        )

    async def _check_cpu(self) -> HealthCheckResult:
        """Read CPU usage via psutil.cpu_percent(interval=5).

        Passes the percentage to ``_classify_result`` via the ``extra`` dict
        so that the CPU threshold (80 %) is applied.  The ``interval=5``
        argument causes psutil to block for 5 seconds while sampling; this is
        run in a thread pool executor to avoid blocking the event loop.

        Requirements: 1.9
        """
        import psutil

        start = time.monotonic()
        exception: Exception | None = None
        cpu_pct: float = 0.0
        try:
            loop = asyncio.get_event_loop()
            cpu_pct = await loop.run_in_executor(
                None,
                lambda: psutil.cpu_percent(interval=5),
            )
        except Exception as exc:
            exception = exc
        finally:
            elapsed_ms = (time.monotonic() - start) * 1000.0

        return self._classify_result(
            component="cpu",
            response_time_ms=elapsed_ms,
            exception=exception,
            extra={"cpu_pct": cpu_pct},
        )

    async def _check_recent_errors(self) -> HealthCheckResult:
        """Count audit_log entries with action == "error" in the last 1 hour.

        Queries the ``audit_logs`` Firestore collection for documents where
        ``action == "error"`` and ``created_at`` is within the last 60 minutes.
        Passes the count to ``_classify_result`` via the ``extra`` dict so that
        error-count thresholds (50 / 200) are applied.

        Requirements: 1.10, 1.11
        """
        from datetime import timedelta

        start = time.monotonic()
        exception: Exception | None = None
        error_count: int = 0
        try:
            from app.firebase_client import get_db
            db = get_db()
            one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)

            loop = asyncio.get_event_loop()

            def _query() -> int:
                docs = (
                    db.collection("audit_logs")
                    .where("action", "==", "error")
                    .where("created_at", ">=", one_hour_ago)
                    .stream()
                )
                return sum(1 for _ in docs)

            error_count = await loop.run_in_executor(None, _query)
        except Exception as exc:
            exception = exc
        finally:
            elapsed_ms = (time.monotonic() - start) * 1000.0

        return self._classify_result(
            component="recent_errors",
            response_time_ms=elapsed_ms,
            exception=exception,
            extra={"error_count": error_count},
        )

    # ── Classification helpers (implemented in task 1.2) ─────────────────

    def _classify_result(
        self,
        component: str,
        response_time_ms: float,
        exception: Exception | None,
        extra: dict[str, Any],
    ) -> HealthCheckResult:
        """Determine the status of a component check and build a HealthCheckResult.

        Classification rules (applied in priority order):
          1. exception is not None → "unhealthy" with sanitized message
          2. component == "memory":
               memory_pct >= 95 → "unhealthy"
               memory_pct > 85  → "degraded"
          3. component == "cpu":
               cpu_pct > 80 → "degraded"
          4. component == "recent_errors":
               error_count >= 200 → "unhealthy"
               error_count >= 50  → "degraded"
          5. response_time_ms >= 500 → "degraded"
          6. Otherwise → "healthy"

        Args:
            component:        Component name string.
            response_time_ms: Measured round-trip time in milliseconds.
            exception:        Exception raised during the check, or None.
            extra:            Dict with optional keys:
                                "memory_pct"  (float) — memory usage %
                                "cpu_pct"     (float) — CPU usage %
                                "error_count" (int)   — recent error count

        Returns:
            A HealthCheckResult with the appropriate status and message.
        """
        # Rule 1: exception → "unhealthy" with sanitized message (Req 1.5, 10.5)
        if exception is not None:
            raw_msg = str(exception)
            message = _sanitize_message(raw_msg)
            return HealthCheckResult(
                component=component,
                status="unhealthy",
                response_time_ms=response_time_ms,
                message=message,
                checked_at=_now_iso(),
            )

        # Rule 2: memory thresholds (Req 1.7, 1.8)
        if component == "memory":
            memory_pct: float = float(extra.get("memory_pct", 0.0))
            if memory_pct >= _MEMORY_UNHEALTHY_PCT:
                return HealthCheckResult(
                    component=component,
                    status="unhealthy",
                    response_time_ms=response_time_ms,
                    message=f"Memory usage critical: {memory_pct:.1f}% (threshold: {_MEMORY_UNHEALTHY_PCT}%)",
                    checked_at=_now_iso(),
                )
            if memory_pct > _MEMORY_DEGRADED_PCT:
                return HealthCheckResult(
                    component=component,
                    status="degraded",
                    response_time_ms=response_time_ms,
                    message=f"Memory usage elevated: {memory_pct:.1f}% (threshold: {_MEMORY_DEGRADED_PCT}%)",
                    checked_at=_now_iso(),
                )
            return HealthCheckResult(
                component=component,
                status="healthy",
                response_time_ms=response_time_ms,
                message=f"Memory usage normal: {memory_pct:.1f}%",
                checked_at=_now_iso(),
            )

        # Rule 3: CPU threshold (Req 1.9)
        if component == "cpu":
            cpu_pct: float = float(extra.get("cpu_pct", 0.0))
            if cpu_pct > _CPU_DEGRADED_PCT:
                return HealthCheckResult(
                    component=component,
                    status="degraded",
                    response_time_ms=response_time_ms,
                    message=f"CPU usage elevated: {cpu_pct:.1f}% (threshold: {_CPU_DEGRADED_PCT}%)",
                    checked_at=_now_iso(),
                )
            return HealthCheckResult(
                component=component,
                status="healthy",
                response_time_ms=response_time_ms,
                message=f"CPU usage normal: {cpu_pct:.1f}%",
                checked_at=_now_iso(),
            )

        # Rule 4: error count thresholds (Req 1.10, 1.11)
        if component == "recent_errors":
            error_count: int = int(extra.get("error_count", 0))
            if error_count >= _ERROR_COUNT_UNHEALTHY:
                return HealthCheckResult(
                    component=component,
                    status="unhealthy",
                    response_time_ms=response_time_ms,
                    message=f"High error rate: {error_count} errors in the last hour (threshold: {_ERROR_COUNT_UNHEALTHY})",
                    checked_at=_now_iso(),
                )
            if error_count >= _ERROR_COUNT_DEGRADED:
                return HealthCheckResult(
                    component=component,
                    status="degraded",
                    response_time_ms=response_time_ms,
                    message=f"Elevated error rate: {error_count} errors in the last hour (threshold: {_ERROR_COUNT_DEGRADED})",
                    checked_at=_now_iso(),
                )
            return HealthCheckResult(
                component=component,
                status="healthy",
                response_time_ms=response_time_ms,
                message=f"Error rate normal: {error_count} errors in the last hour",
                checked_at=_now_iso(),
            )

        # Rule 5: response time threshold (Req 1.4)
        if response_time_ms >= _RESPONSE_TIME_DEGRADED_MS:
            return HealthCheckResult(
                component=component,
                status="degraded",
                response_time_ms=response_time_ms,
                message=f"Slow response: {response_time_ms:.1f}ms (threshold: {_RESPONSE_TIME_DEGRADED_MS}ms)",
                checked_at=_now_iso(),
            )

        # Rule 6: healthy (Req 1.3)
        return HealthCheckResult(
            component=component,
            status="healthy",
            response_time_ms=response_time_ms,
            message=f"Component responding normally ({response_time_ms:.1f}ms)",
            checked_at=_now_iso(),
        )

    def _compute_overall(
        self,
        results: list[HealthCheckResult],
    ) -> Literal["healthy", "degraded", "unhealthy"]:
        """Aggregate individual component statuses into a single overall status.

        Rules (Requirement 1.13):
          - "unhealthy" if at least one component is "unhealthy"
          - "degraded"  if at least one component is "degraded" and none are "unhealthy"
          - "healthy"   only when all components are "healthy"

        Args:
            results: List of HealthCheckResult objects.

        Returns:
            The worst-case overall status string.
        """
        statuses = {r.status for r in results}
        if "unhealthy" in statuses:
            return "unhealthy"
        if "degraded" in statuses:
            return "degraded"
        return "healthy"

    def _build_recommendations(
        self,
        results: list[HealthCheckResult],
    ) -> list[str]:
        """Build actionable recommendation strings for non-healthy components.

        Requirement 1.14: at least one recommendation per non-healthy component.

        Args:
            results: List of HealthCheckResult objects.

        Returns:
            A list of human-readable recommendation strings. Empty when all
            components are healthy.
        """
        # Per-component actionable advice keyed by component name and status.
        _ADVICE: dict[str, dict[str, str]] = {
            "firestore": {
                "degraded": (
                    "Firestore response time is elevated. Check network latency "
                    "between Cloud Run and Firestore, and review active indexes."
                ),
                "unhealthy": (
                    "Firestore is unreachable. Verify Firebase project credentials, "
                    "firewall rules, and service account permissions."
                ),
            },
            "auth": {
                "degraded": (
                    "Firebase Auth is responding slowly. Check Firebase console for "
                    "service degradation notices."
                ),
                "unhealthy": (
                    "Firebase Auth is unreachable. Verify the Firebase Admin SDK "
                    "credentials and network connectivity to auth.googleapis.com."
                ),
            },
            "storage": {
                "degraded": (
                    "Firebase Cloud Storage is responding slowly. Check bucket "
                    "permissions and regional latency."
                ),
                "unhealthy": (
                    "Firebase Cloud Storage is unreachable. Verify bucket name, "
                    "service account storage permissions, and CORS configuration."
                ),
            },
            "scheduler": {
                "degraded": (
                    "APScheduler is running but may be under load. Review scheduled "
                    "job execution times and consider reducing job frequency."
                ),
                "unhealthy": (
                    "APScheduler is not running. Restart the backend service and "
                    "check scheduler initialization logs for errors."
                ),
            },
            "api_self": {
                "degraded": (
                    "API self-check response time exceeds 500ms. Profile slow "
                    "middleware or startup dependencies that may be blocking requests."
                ),
                "unhealthy": (
                    "API self-check failed. The /api/health endpoint is unreachable "
                    "or returning a non-2xx response. Check application logs."
                ),
            },
            "memory": {
                "degraded": (
                    "Memory usage is above 85%. Investigate memory-intensive "
                    "operations and consider scaling up the Cloud Run instance."
                ),
                "unhealthy": (
                    "Memory usage is critically high (above 95%). Immediate action "
                    "required: restart the service or scale up to prevent OOM crashes."
                ),
            },
            "cpu": {
                "degraded": (
                    "CPU usage is above 80%. Identify CPU-intensive background jobs "
                    "or requests and consider scaling out Cloud Run instances."
                ),
                "unhealthy": (
                    "CPU usage is critically high. Scale up the Cloud Run service "
                    "immediately and investigate runaway processes."
                ),
            },
            "recent_errors": {
                "degraded": (
                    "Error rate is elevated (50+ errors in the last hour). Review "
                    "recent audit logs to identify the source of errors."
                ),
                "unhealthy": (
                    "Error rate is critically high (200+ errors in the last hour). "
                    "Investigate application logs immediately for systemic failures."
                ),
            },
        }

        _GENERIC_ADVICE: dict[str, str] = {
            "degraded": (
                "{component} is degraded. Review application logs and monitor "
                "the component for further deterioration."
            ),
            "unhealthy": (
                "{component} is unhealthy. Investigate immediately and check "
                "application logs for error details."
            ),
        }

        recommendations: list[str] = []
        for result in results:
            if result.status == "healthy":
                continue
            component_advice = _ADVICE.get(result.component, {})
            advice = component_advice.get(result.status)
            if advice is None:
                # Fallback for unknown components or unexpected statuses
                template = _GENERIC_ADVICE.get(
                    result.status,
                    "{component} requires attention.",
                )
                advice = template.format(component=result.component)
            recommendations.append(advice)
        return recommendations
