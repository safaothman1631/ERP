"""Observability package — wires up tracing, logging, Sentry, and RUM hooks
for the FastAPI backend.

Designed to be called from ``main.py``'s lifespan ONCE on app boot, but
deliberately kept side-effect-free at import time so individual modules can
be exercised in tests without pulling in the OTel SDK.

Usage::

    # In backend/app/main.py (LATER — not in this phase):
    from app.observability import init_observability
    init_observability(app)
"""

from __future__ import annotations

import logging as _stdlib_logging
from typing import Any

from app.observability.logging import configure_logging
from app.observability.sentry import init_sentry, SentryConfigurationError
from app.observability.tracing import init_tracing

log = _stdlib_logging.getLogger("observability")


def init_observability(app: Any) -> dict:
    """Initialize structured logging, Sentry, and OpenTelemetry.

    Returns a dict of feature flags showing which subsystems came up so the
    caller can log a summary. Never raises in dev; in prod it propagates
    Sentry's mandatory-DSN failure (R6.4).
    """
    configure_logging()

    sentry_ok = False
    try:
        sentry_ok = init_sentry()
    except SentryConfigurationError:
        # Mandatory in production — propagate so the deploy fails fast.
        raise

    otel_ok = init_tracing(app)

    status = {
        "logging": True,
        "sentry": sentry_ok,
        "otel": otel_ok,
    }
    log.info("observability.initialized", extra={"status": status})
    return status


__all__ = [
    "init_observability",
    "configure_logging",
    "init_sentry",
    "init_tracing",
    "SentryConfigurationError",
]
