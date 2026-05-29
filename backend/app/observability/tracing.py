"""OpenTelemetry initialization (T-0.2, R6.3).

Wires the FastAPI app to Cloud Trace via the OTel SDK with the GCP exporter.
Exposes ``traced_firestore_op`` and ``traced_cache_op`` context managers so
service-layer code can annotate spans without taking a hard dependency on
the OTel API itself.

The init function is safe in dev: if the OTel libraries aren't installed
yet, it logs a warning and returns without raising. Production builds will
fail at import time of those libs once the dependency is added — that's the
intended progression.
"""

from __future__ import annotations

import contextlib
import logging
import os
from typing import Any, Iterator, Optional

log = logging.getLogger("observability.tracing")


# Module-level tracer; set during init. Until then, we hand out a no-op.
_TRACER: Optional[Any] = None
_INITIALIZED = False


class _NoOpSpan:
    """Stand-in span when OTel isn't initialized — duck-types the OTel API."""

    def set_attribute(self, *_args: Any, **_kwargs: Any) -> None:
        return None

    def set_status(self, *_args: Any, **_kwargs: Any) -> None:
        return None

    def record_exception(self, *_args: Any, **_kwargs: Any) -> None:
        return None

    def __enter__(self) -> "_NoOpSpan":
        return self

    def __exit__(self, *_exc: Any) -> None:
        return None


class _NoOpTracer:
    @contextlib.contextmanager
    def start_as_current_span(self, *_args: Any, **_kwargs: Any) -> Iterator[_NoOpSpan]:
        yield _NoOpSpan()


def init_tracing(app: Any) -> bool:
    """Initialize OpenTelemetry with FastAPI auto-instrumentation.

    Args:
        app: The FastAPI app instance to instrument.

    Returns:
        True if OTel was fully initialized; False if libs missing (dev mode).
    """
    global _TRACER, _INITIALIZED
    if _INITIALIZED:
        return True

    try:
        from opentelemetry import trace  # type: ignore
        from opentelemetry.sdk.trace import TracerProvider  # type: ignore
        from opentelemetry.sdk.trace.export import BatchSpanProcessor  # type: ignore
        from opentelemetry.sdk.resources import Resource  # type: ignore
        from opentelemetry.instrumentation.fastapi import (  # type: ignore
            FastAPIInstrumentor,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("otel.libs_missing", extra={"err": str(e)})
        _TRACER = _NoOpTracer()
        return False

    # Optional GCP exporter — present in prod, may be missing locally.
    exporter: Any
    try:
        from opentelemetry.exporter.cloud_trace import (  # type: ignore
            CloudTraceSpanExporter,
        )
        exporter = CloudTraceSpanExporter()
    except Exception:  # noqa: BLE001
        # Fall back to stdout exporter for local dev.
        try:
            from opentelemetry.sdk.trace.export import (  # type: ignore
                ConsoleSpanExporter,
            )
            exporter = ConsoleSpanExporter()
            log.info("otel.using_console_exporter (no GCP exporter installed)")
        except Exception:  # noqa: BLE001
            log.warning("otel.no_exporter_available")
            _TRACER = _NoOpTracer()
            return False

    service_name = os.environ.get("OTEL_SERVICE_NAME", "zoho-backend")
    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    try:
        FastAPIInstrumentor.instrument_app(app)
    except Exception as e:  # noqa: BLE001
        log.warning("otel.fastapi_instrument_failed", extra={"err": str(e)})

    _TRACER = trace.get_tracer("zoho.backend")
    _INITIALIZED = True
    log.info("otel.initialized", extra={"service": service_name})
    return True


def get_tracer() -> Any:
    """Return the active tracer (real or no-op)."""
    return _TRACER if _TRACER is not None else _NoOpTracer()


# ---- Convenience context managers (T-0.2) -------------------------------


@contextlib.contextmanager
def traced_firestore_op(collection: str, op: str) -> Iterator[Any]:
    """Wrap a Firestore call in an OTel span.

    Usage::

        with traced_firestore_op("invoices", "get") as span:
            doc = await db.collection("invoices").document(id).get()
            span.set_attribute("doc.exists", doc.exists)
    """
    tracer = get_tracer()
    with tracer.start_as_current_span(f"firestore.{op}") as span:
        span.set_attribute("firestore.collection", collection)
        span.set_attribute("firestore.operation", op)
        try:
            yield span
        except Exception as e:  # noqa: BLE001
            span.record_exception(e)
            raise


@contextlib.contextmanager
def traced_cache_op(key: str) -> Iterator[Any]:
    """Wrap a Redis cache lookup in an OTel span.

    The caller is responsible for setting ``cache.hit`` on the span after
    the lookup completes so dashboards can compute hit ratios.
    """
    tracer = get_tracer()
    with tracer.start_as_current_span("cache.get") as span:
        span.set_attribute("cache.key", key)
        try:
            yield span
        except Exception as e:  # noqa: BLE001
            span.record_exception(e)
            raise
