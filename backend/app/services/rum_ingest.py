"""RUM ingest service (T-0.1, R6.2).

In-memory asyncio.Queue that batches incoming Core Web Vitals events and
flushes either every FLUSH_INTERVAL_S seconds or when QUEUE_HIGH_WATERMARK
events accumulate. When the env var ``RUM_BIGQUERY_DATASET`` is set, events
are streamed to BigQuery via google.cloud.bigquery; otherwise they are
written to the structured logger so they are visible in dev and in Cloud
Logging if BigQuery isn't wired yet.

Design notes:
  - The flusher is a background task created lazily on first enqueue and
    bound to the running event loop, so callers don't have to wire it from
    main.py.
  - We do not block the request thread on the BigQuery insert; an insert
    failure is logged but never re-raised.
  - The service is a process-singleton; multiple Cloud Run instances each
    keep their own queue (which is the BigQuery streaming-insert model).
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, List, Optional

if TYPE_CHECKING:
    # Avoid a hard import dependency in the type checker; we import lazily.
    from app.api.rum import VitalEvent

log = logging.getLogger("rum")

# Tunables (overridable via env for stress testing).
FLUSH_INTERVAL_S = float(os.environ.get("RUM_FLUSH_INTERVAL_S", "5"))
QUEUE_HIGH_WATERMARK = int(os.environ.get("RUM_HIGH_WATERMARK", "100"))
QUEUE_MAX_SIZE = int(os.environ.get("RUM_QUEUE_MAX", "10000"))


@dataclass
class _Enqueued:
    """One event with optional tenant attribution captured at request time."""

    event: "VitalEvent"
    tenant_id: Optional[str] = None
    received_at_ms: int = field(default_factory=lambda: _now_ms())


def _now_ms() -> int:
    import time
    return int(time.time() * 1000)


class RUMIngestService:
    """Background batcher for RUM vitals."""

    def __init__(
        self,
        *,
        flush_interval_s: float = FLUSH_INTERVAL_S,
        high_watermark: int = QUEUE_HIGH_WATERMARK,
        max_size: int = QUEUE_MAX_SIZE,
        bigquery_dataset: Optional[str] = None,
        bigquery_table: str = "vitals_raw",
    ) -> None:
        self._queue: asyncio.Queue[_Enqueued] = asyncio.Queue(maxsize=max_size)
        self._flush_interval_s = flush_interval_s
        self._high_watermark = high_watermark
        self._bq_dataset = bigquery_dataset or os.environ.get(
            "RUM_BIGQUERY_DATASET"
        )
        self._bq_table = bigquery_table
        self._flusher_task: Optional[asyncio.Task[None]] = None
        self._stopped = False

    # ------ public API ------------------------------------------------

    async def enqueue(
        self,
        events: List["VitalEvent"],
        *,
        tenant_id: Optional[str] = None,
    ) -> int:
        """Enqueue events. Returns the number actually enqueued.

        Drops on queue-full rather than blocking the request: RUM is
        best-effort by definition.
        """
        self._ensure_flusher()
        accepted = 0
        for ev in events:
            try:
                self._queue.put_nowait(
                    _Enqueued(event=ev, tenant_id=tenant_id)
                )
                accepted += 1
            except asyncio.QueueFull:
                log.warning(
                    "rum.queue_full", extra={"dropped": len(events) - accepted}
                )
                break
        if self._queue.qsize() >= self._high_watermark:
            # Wake the flusher early.
            self._trigger_flush()
        return accepted

    async def stop(self) -> None:
        """Cancel the flusher and drain remaining events."""
        self._stopped = True
        if self._flusher_task and not self._flusher_task.done():
            self._flusher_task.cancel()
            try:
                await self._flusher_task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        await self._flush_now()

    @property
    def queue_size(self) -> int:
        return self._queue.qsize()

    # ------ internals -------------------------------------------------

    def _ensure_flusher(self) -> None:
        if self._flusher_task is None or self._flusher_task.done():
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                return
            self._stopped = False
            self._flusher_task = loop.create_task(
                self._flusher_loop(), name="rum-flusher"
            )

    def _trigger_flush(self) -> None:
        # We can't easily wake an asyncio.sleep — instead create a one-shot
        # flush task that runs concurrently. The periodic loop dedups via
        # an empty queue check.
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._flush_now(), name="rum-flush-oneshot")
        except RuntimeError:
            pass

    async def _flusher_loop(self) -> None:
        try:
            while not self._stopped:
                await asyncio.sleep(self._flush_interval_s)
                await self._flush_now()
        except asyncio.CancelledError:  # graceful shutdown
            raise

    async def _flush_now(self) -> None:
        if self._queue.empty():
            return
        batch: List[_Enqueued] = []
        while not self._queue.empty() and len(batch) < QUEUE_HIGH_WATERMARK * 10:
            try:
                batch.append(self._queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        if not batch:
            return
        await self._emit(batch)

    async def _emit(self, batch: List[_Enqueued]) -> None:
        """Send a batch downstream. Errors are caught and logged."""
        try:
            if self._bq_dataset:
                await self._emit_bigquery(batch)
            else:
                self._emit_log(batch)
        except Exception as e:  # noqa: BLE001
            log.exception("rum.emit_failed", extra={"err": str(e), "count": len(batch)})

    def _emit_log(self, batch: List[_Enqueued]) -> None:
        """Local-only mode: write each event to structured logs."""
        for item in batch:
            ev = item.event
            log.info(
                "rum.vital",
                extra={
                    "tenant_id": item.tenant_id,
                    "session_id": ev.sessionId,
                    "app_version": ev.appVersion,
                    "route": ev.route,
                    "device_class": ev.deviceClass,
                    "network": ev.network,
                    "metric": ev.metric,
                    "value": ev.value,
                    "rating": ev.rating,
                    "received_at_ms": item.received_at_ms,
                },
            )

    async def _emit_bigquery(self, batch: List[_Enqueued]) -> None:
        """Streaming insert into BigQuery. Stubbed for environments that
        don't have google-cloud-bigquery installed yet."""
        try:
            from google.cloud import bigquery  # type: ignore
        except Exception:  # pragma: no cover - lib optional in dev
            log.warning(
                "rum.bigquery_lib_missing — install google-cloud-bigquery to enable"
            )
            self._emit_log(batch)
            return

        client = bigquery.Client()
        table = f"{self._bq_dataset}.{self._bq_table}"
        rows = [self._row_for(item) for item in batch]
        # The BQ client uses sync I/O; offload it so we don't stall the loop.
        errors: Any = await asyncio.to_thread(
            client.insert_rows_json, table, rows
        )
        if errors:
            log.error("rum.bq_insert_errors", extra={"errors": errors[:5]})

    @staticmethod
    def _row_for(item: _Enqueued) -> dict:
        ev = item.event
        # Match the schema in design §9.1.
        return {
            "session_id": ev.sessionId,
            "tenant_id": item.tenant_id,
            "app_version": ev.appVersion,
            "route": ev.route,
            "device_class": ev.deviceClass,
            "network": ev.network,
            "metric": ev.metric,
            "value": ev.value,
            "rating": ev.rating,
            "ts": _to_iso(ev.ts) if ev.ts else _now_iso(),
        }


def _to_iso(ms: int) -> str:
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).isoformat()


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(tz=timezone.utc).isoformat()


# Module-level singleton accessor.
_SERVICE: Optional[RUMIngestService] = None


def get_rum_ingest_service() -> RUMIngestService:
    """Return the process-singleton ingest service (lazy-created)."""
    global _SERVICE
    if _SERVICE is None:
        _SERVICE = RUMIngestService()
    return _SERVICE


def reset_rum_ingest_service_for_tests() -> None:
    """Tests only: clear the singleton so a fresh queue/flusher is created."""
    global _SERVICE
    _SERVICE = None
