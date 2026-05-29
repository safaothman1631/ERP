"""Sentry initialization for the backend (T-0.6, R6.4).

Production-mandatory: raises if ``SENTRY_DSN`` is missing while
``ENVIRONMENT=production``. In dev with no DSN, this is a no-op.

Sample rate per R6.4: 100% errors, 10% performance traces (matches the
frontend policy).
"""

from __future__ import annotations

import logging
import os
from typing import Optional

log = logging.getLogger("observability.sentry")


class SentryConfigurationError(RuntimeError):
    """Raised when Sentry is mandatory but DSN is unset."""


def init_sentry(
    *,
    dsn: Optional[str] = None,
    environment: Optional[str] = None,
    release: Optional[str] = None,
) -> bool:
    """Initialize Sentry. Returns True if Sentry was actually configured.

    Args:
        dsn: Optional override for the DSN. Defaults to ``SENTRY_DSN`` env.
        environment: Defaults to ``ENVIRONMENT`` env or 'development'.
        release: Defaults to ``APP_VERSION`` env.

    Raises:
        SentryConfigurationError: in production when no DSN is configured.
    """
    env = environment or os.environ.get("ENVIRONMENT", "development")
    dsn_value = dsn if dsn is not None else os.environ.get("SENTRY_DSN")

    if not dsn_value:
        if env == "production":
            raise SentryConfigurationError(
                "SENTRY_DSN must be set in production (R6.4)"
            )
        log.info("sentry.skipped (no DSN in %s)", env)
        return False

    try:
        import sentry_sdk  # type: ignore
        from sentry_sdk.integrations.fastapi import FastApiIntegration  # type: ignore
        from sentry_sdk.integrations.asgi import SentryAsgiMiddleware  # type: ignore  # noqa: F401
    except Exception as e:  # noqa: BLE001
        if env == "production":
            raise SentryConfigurationError(
                f"sentry-sdk is required in production: {e}"
            ) from e
        log.warning("sentry.sdk_missing — install sentry-sdk to enable")
        return False

    sentry_sdk.init(
        dsn=dsn_value,
        environment=env,
        release=release or os.environ.get("APP_VERSION"),
        # R6.4 — 100% error sampling.
        sample_rate=1.0,
        # R6.4 — 10% performance traces.
        traces_sample_rate=0.1,
        integrations=[FastApiIntegration()],
        # Sensitive data scrubbing is enabled by default; keep it on.
        send_default_pii=False,
    )
    log.info("sentry.initialized", extra={"environment": env})
    return True
