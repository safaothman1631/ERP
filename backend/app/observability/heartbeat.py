"""Scheduler heartbeat (T-SF.5.14).

The "scheduler down" alert (terraform/monitoring/alerts.tf #15) fires when the
log-based metric ``zoho/scheduler_heartbeat`` is *absent* for 15 minutes. That
metric is derived from a recognizable log line, which this module emits.

It also exposes a tiny ``emit_job_failure`` helper so APScheduler job bodies
(or an event listener) can log failures in the exact shape the
``zoho/scheduler_job_failed`` log metric matches — ``event=job_failed`` with a
``job_id`` field for the alert's group-by.

Wiring (NOT done here to avoid colliding with parallel edits to scheduler.py —
see sharedWiring): register ``heartbeat_job`` on a 5-minute IntervalTrigger and
attach ``on_job_error`` as an APScheduler EVENT_JOB_ERROR listener.
"""

from __future__ import annotations

import logging
from typing import Any

log = logging.getLogger("scheduler")


def heartbeat_job() -> None:
    """Emit one heartbeat line. Registered on a short IntervalTrigger.

    Kept side-effect-free beyond logging so it can never be the cause of a
    scheduler error itself.
    """
    log.info(
        "scheduler.heartbeat",
        extra={"event": "scheduler_heartbeat"},
    )


def emit_job_failure(job_id: str, error: BaseException) -> None:
    """Log a scheduler job failure in the shape the alert metric expects.

    Call from inside a job's ``except`` block, or from the EVENT_JOB_ERROR
    listener below.
    """
    log.error(
        "scheduler.job_failed",
        extra={"event": "job_failed", "job_id": job_id, "error": str(error)},
    )


def on_job_error(event: Any) -> None:
    """APScheduler EVENT_JOB_ERROR listener.

    Usage::

        from apscheduler.events import EVENT_JOB_ERROR
        scheduler.add_listener(on_job_error, EVENT_JOB_ERROR)

    ``event`` is an apscheduler.events.JobExecutionEvent; we read ``job_id``
    and ``exception`` defensively so a change in apscheduler internals can't
    crash the listener.
    """
    job_id = getattr(event, "job_id", "unknown")
    exc = getattr(event, "exception", None) or RuntimeError("unknown error")
    emit_job_failure(str(job_id), exc)


__all__ = ["heartbeat_job", "emit_job_failure", "on_job_error"]
