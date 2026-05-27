"""Request-ID middleware (T-0.2, R6.5).

Reads an ``X-Request-Id`` header from the incoming request or generates a
new UUIDv4. The id is:

  * stored on ``request.state.request_id`` so handlers and downstream
    services can include it in logs and Firestore audit entries;
  * echoed back on the response via the ``X-Request-Id`` header so clients
    (and Sentry breadcrumbs) can correlate.

Trace correlation is intentionally light here — the OTel span carries the
real trace_id; this id is a stable per-request handle.
"""

from __future__ import annotations

import uuid
from typing import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-Id"
# Allow forwarded request ids only when they match this character class —
# prevents log-injection via crafted headers.
_ALLOWED_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")
_MAX_LEN = 128


def _sanitize(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    if not v or len(v) > _MAX_LEN:
        return None
    if any(c not in _ALLOWED_CHARS for c in v):
        return None
    return v


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a request id to every request/response."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        incoming = _sanitize(request.headers.get(REQUEST_ID_HEADER))
        request_id = incoming or uuid.uuid4().hex
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response


def get_request_id(request: Request) -> str | None:
    """Convenience accessor — returns the current request's id, or None
    if the middleware wasn't applied."""
    return getattr(request.state, "request_id", None)
