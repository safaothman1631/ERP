"""Prometheus-compatible metrics surface (P4 / R6.6, design §4.1).

Exports a `/metrics` endpoint (registered via the ``router``) and the metric
primitives the rest of the codebase imports. Falls back to a no-op surface
when ``prometheus_client`` is not installed — production builds will install
it; dev environments don't have to.

Wire from ``main.py``::

    from app.observability.metrics import router as metrics_router
    app.include_router(metrics_router)
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Response

log = logging.getLogger("observability.metrics")


# ── prometheus_client (optional) ────────────────────────────────────────────


try:
    from prometheus_client import (  # type: ignore
        CONTENT_TYPE_LATEST,
        Counter,
        Histogram,
        Gauge,
        generate_latest,
    )

    _PROM_AVAILABLE = True
except Exception as e:  # noqa: BLE001
    _PROM_AVAILABLE = False
    log.warning("metrics.prometheus_client_missing", extra={"err": str(e)})

    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4; charset=utf-8"  # type: ignore

    class _NoOpMetric:
        def __init__(self, *_a: Any, **_kw: Any) -> None: ...
        def labels(self, *_a: Any, **_kw: Any) -> "_NoOpMetric":
            return self
        def inc(self, *_a: Any, **_kw: Any) -> None: ...
        def observe(self, *_a: Any, **_kw: Any) -> None: ...
        def set(self, *_a: Any, **_kw: Any) -> None: ...

    Counter = _NoOpMetric  # type: ignore
    Histogram = _NoOpMetric  # type: ignore
    Gauge = _NoOpMetric  # type: ignore

    def generate_latest() -> bytes:  # type: ignore
        return b"# prometheus_client not installed\n"


# ── Metric definitions ──────────────────────────────────────────────────────

# Counters
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests served, labelled by route, method and status",
    labelnames=("route", "method", "status"),
)

firestore_operations_total = Counter(
    "firestore_operations_total",
    "Total Firestore operations, labelled by collection and op type",
    labelnames=("collection", "op"),
)

redis_cache_hits_total = Counter(
    "redis_cache_hits_total",
    "Total Redis cache hits, labelled by resource",
    labelnames=("resource",),
)

redis_cache_misses_total = Counter(
    "redis_cache_misses_total",
    "Total Redis cache misses, labelled by resource",
    labelnames=("resource",),
)

# Histograms — buckets tuned for our SLO targets in R5.
_HTTP_LATENCY_BUCKETS = (5, 25, 50, 100, 150, 250, 400, 600, 1000, 2000, 4000, 8000)
_FS_LATENCY_BUCKETS = (5, 10, 25, 50, 100, 150, 250, 400, 800, 1500, 3000)

http_request_duration_ms = Histogram(
    "http_request_duration_ms",
    "HTTP request duration in milliseconds",
    labelnames=("route", "method"),
    buckets=_HTTP_LATENCY_BUCKETS,
)

firestore_op_duration_ms = Histogram(
    "firestore_op_duration_ms",
    "Firestore operation duration in milliseconds",
    labelnames=("collection", "op"),
    buckets=_FS_LATENCY_BUCKETS,
)

# Gauges
pos_orders_offline_queued = Gauge(
    "pos_orders_offline_queued",
    "POS orders currently queued for offline sync (client-reported)",
)


# ── Convenience recorders ───────────────────────────────────────────────────


def record_http(route: str, method: str, status: int, duration_ms: float) -> None:
    """Update both the counter and histogram for one HTTP request."""
    http_requests_total.labels(route=route, method=method, status=str(status)).inc()
    http_request_duration_ms.labels(route=route, method=method).observe(duration_ms)


def record_firestore(collection: str, op: str, duration_ms: float) -> None:
    """Update both the counter and histogram for one Firestore op."""
    firestore_operations_total.labels(collection=collection, op=op).inc()
    firestore_op_duration_ms.labels(collection=collection, op=op).observe(duration_ms)


def record_cache_hit(resource: str) -> None:
    redis_cache_hits_total.labels(resource=resource).inc()


def record_cache_miss(resource: str) -> None:
    redis_cache_misses_total.labels(resource=resource).inc()


# ── /metrics endpoint ──────────────────────────────────────────────────────


router = APIRouter(tags=["Observability"])


@router.get("/metrics", include_in_schema=False)
async def metrics() -> Response:
    """Prometheus scrape endpoint.

    Returns plaintext metrics in the Prometheus exposition format. When
    ``prometheus_client`` is not installed, returns a placeholder so the
    scrape doesn't error.
    """
    payload = generate_latest() if _PROM_AVAILABLE else (
        b"# prometheus_client not installed on this build\n"
    )
    return Response(content=payload, media_type=CONTENT_TYPE_LATEST)


__all__ = [
    "router",
    "http_requests_total",
    "firestore_operations_total",
    "redis_cache_hits_total",
    "redis_cache_misses_total",
    "http_request_duration_ms",
    "firestore_op_duration_ms",
    "pos_orders_offline_queued",
    "record_http",
    "record_firestore",
    "record_cache_hit",
    "record_cache_miss",
]
