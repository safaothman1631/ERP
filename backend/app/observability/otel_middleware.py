"""OTel span enrichment + RUM-correlation middleware (T-SF.5.x).

`opentelemetry.instrumentation.fastapi` (wired in ``tracing.py``) already
creates a SERVER span per request and extracts inbound W3C ``traceparent``
context. What it does NOT do is stamp our domain identifiers onto that span.

This middleware enriches the *current* server span with:

  * ``enduser.org_id`` / ``tenant.id`` — for per-tenant trace filtering (D6),
  * ``request.id``                     — to join a trace back to a log line,
  * ``http.route``                     — the matched route template,

and copies the active ``trace_id`` onto ``request.state.trace_id`` + the
``X-Trace-Id`` response header so the frontend RUM client can attach it to the
vitals beacon (closing the loop between a slow span and a poor LCP sample).

It is intentionally a thin BaseHTTPMiddleware that degrades to a no-op when
OTel isn't installed (dev) — it never raises and never blocks the request.

Wire AFTER the tenant/org_context middleware so ``request.state`` is populated.
See sharedWiring in the task output for the exact ``main.py`` placement.
"""

from __future__ import annotations

import logging
from typing import Awaitable, Callable, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

log = logging.getLogger("observability.otel_middleware")

TRACE_ID_HEADER = "X-Trace-Id"


def _current_span_and_trace() -> tuple[object, Optional[str]]:
    """Return (current_span, trace_id_hex) or (None, None) if OTel absent."""
    try:
        from opentelemetry import trace  # type: ignore
    except Exception:  # noqa: BLE001 — OTel not installed in this env
        return None, None

    span = trace.get_current_span()
    ctx = span.get_span_context() if span is not None else None
    if ctx is None or not getattr(ctx, "is_valid", False):
        return span, None
    # 128-bit trace id as 32-char lowercase hex (W3C format).
    return span, format(ctx.trace_id, "032x")


def _resolve_org_id(request: Request) -> Optional[str]:
    org_id = getattr(request.state, "org_id", None)
    if org_id:
        return org_id
    user = getattr(request.state, "user", None)
    if isinstance(user, dict):
        return user.get("org_id")
    return None


def _route_template(request: Request) -> Optional[str]:
    """The matched route path template (e.g. /api/invoices/{id}), not the raw
    URL — keeps span/metric cardinality bounded."""
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    return path or request.url.path


class OTelEnrichmentMiddleware(BaseHTTPMiddleware):
    """Stamp domain attributes on the active server span + expose trace id."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        span, trace_id = _current_span_and_trace()

        # Make the trace id available to handlers regardless of OTel presence.
        if trace_id:
            request.state.trace_id = trace_id

        if span is not None:
            try:
                org_id = _resolve_org_id(request)
                if org_id:
                    span.set_attribute("enduser.org_id", org_id)
                    span.set_attribute("tenant.id", org_id)
                tenant_id = getattr(request.state, "tenant_id", None)
                if tenant_id and tenant_id != org_id:
                    span.set_attribute("tenant.id", tenant_id)
                request_id = getattr(request.state, "request_id", None)
                if request_id:
                    span.set_attribute("request.id", request_id)
                route = _route_template(request)
                if route:
                    span.set_attribute("http.route", route)
            except Exception as e:  # noqa: BLE001 — never break the request
                log.debug("otel.enrich_failed", extra={"err": str(e)})

        response = await call_next(request)

        if trace_id:
            response.headers[TRACE_ID_HEADER] = trace_id
            # Allow the browser RUM client to read it cross-origin.
            existing = response.headers.get("Access-Control-Expose-Headers")
            response.headers["Access-Control-Expose-Headers"] = (
                f"{existing}, {TRACE_ID_HEADER}" if existing else TRACE_ID_HEADER
            )
        return response


def get_trace_id(request: Request) -> Optional[str]:
    """Convenience accessor for handlers/services."""
    return getattr(request.state, "trace_id", None)


__all__ = [
    "OTelEnrichmentMiddleware",
    "get_trace_id",
    "TRACE_ID_HEADER",
]
