"""Structured JSON logging (T-0.2, R6.5).

Configures the root logger with ``python-json-logger`` so every line emitted
becomes a JSON object with a fixed key shape::

    {
      "timestamp":   ISO-8601 with ms,
      "severity":    one of DEBUG/INFO/WARNING/ERROR/CRITICAL,
      "request_id":  set by request_id middleware (UUID per request),
      "tenant_id":   set by tenant middleware,
      "user_id":     set by auth middleware,
      "route":       FastAPI path (set by middleware),
      "latency_ms":  request total latency,
      "status_code": HTTP status,
      "message":     human-readable text
    }

Cloud Logging will auto-promote ``severity`` and ``timestamp`` when ingest.
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any, Optional


# Fields we always want present on every record (R6.5).
_FIXED_FIELDS = (
    "timestamp",
    "severity",
    "request_id",
    "tenant_id",
    "user_id",
    "route",
    "latency_ms",
    "status_code",
    "message",
)


def _try_get_formatter_class() -> Optional[type]:
    """Return the JsonFormatter class if python-json-logger is available."""
    try:
        from pythonjsonlogger import jsonlogger  # type: ignore
        return jsonlogger.JsonFormatter
    except Exception:  # noqa: BLE001
        return None


def _make_formatter() -> logging.Formatter:
    """Build the JSON formatter, falling back to a plain text one in dev
    when python-json-logger isn't installed."""
    cls = _try_get_formatter_class()
    if cls is None:
        # Plain dev formatter — mirrors fields with KV format.
        return logging.Formatter(
            fmt=(
                "%(asctime)s %(levelname)s "
                "request_id=%(request_id)s tenant_id=%(tenant_id)s "
                "user_id=%(user_id)s route=%(route)s "
                "status=%(status_code)s latency_ms=%(latency_ms)s — %(message)s"
            )
        )

    class FixedFieldsFormatter(cls):  # type: ignore[misc, valid-type]
        """JsonFormatter that maps standard LogRecord attrs to our schema."""

        # Reserved record attribute names — anything else becomes "extra".
        _RESERVED = {
            "args", "asctime", "created", "exc_info", "exc_text", "filename",
            "funcName", "levelname", "levelno", "lineno", "module", "msecs",
            "name", "pathname", "process", "processName", "relativeCreated",
            "stack_info", "thread", "threadName", "message",
        }

        def add_fields(  # type: ignore[override]
            self,
            log_record: dict,
            record: logging.LogRecord,
            message_dict: dict,
        ) -> None:
            super().add_fields(log_record, record, message_dict)
            # Severity from levelname; Cloud Logging recognizes this key.
            log_record["severity"] = record.levelname
            # Standard ISO-8601 timestamp. NOTE: logging.Formatter.formatTime
            # uses time.strftime, which does NOT support %f (microseconds) and
            # raises "Invalid format string" on every record. datetime.strftime
            # does support %f, so format from record.created directly.
            from datetime import datetime as _dt, timezone as _tz
            log_record["timestamp"] = _dt.fromtimestamp(
                record.created, tz=_tz.utc
            ).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            # Ensure all fixed fields exist (null if not set).
            for k in _FIXED_FIELDS:
                log_record.setdefault(k, None)
            # Preserve message under the message key for readability.
            log_record["message"] = record.getMessage()

    # JsonFormatter takes a format string listing the keys to extract.
    fmt = " ".join(f"%({k})s" for k in _FIXED_FIELDS)
    return FixedFieldsFormatter(fmt)


def configure_logging(level: Optional[str] = None) -> None:
    """Configure the root logger to emit structured JSON.

    Idempotent: replacing handlers if called multiple times so test runners
    don't double-log.
    """
    lvl = (level or os.environ.get("LOG_LEVEL") or "INFO").upper()
    root = logging.getLogger()
    # Clear existing handlers (uvicorn installs its own).
    for h in list(root.handlers):
        root.removeHandler(h)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_make_formatter())
    root.addHandler(handler)
    root.setLevel(getattr(logging, lvl, logging.INFO))

    # Quiet some chatty libs at INFO level.
    for noisy in ("httpx", "httpcore", "urllib3", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def bind_request_context(record_extra: dict[str, Any]) -> dict[str, Any]:
    """Helper for middleware/services: produce an ``extra`` dict for ``log.info(..., extra=...)``
    that includes the conventional fields. Unknown keys are accepted but only the fixed set
    is guaranteed to render."""
    out: dict[str, Any] = {k: None for k in _FIXED_FIELDS}
    out.update(record_extra)
    return out
