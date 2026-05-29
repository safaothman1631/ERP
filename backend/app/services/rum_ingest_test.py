"""Tests for the RUM ingest queueing logic (T-0.1).

Exercises the batcher without requiring BigQuery — the local-log fallback
is used and counted.
"""

from __future__ import annotations

import asyncio

import pytest

from app.api.rum import VitalEvent
from app.services.rum_ingest import (
    RUMIngestService,
    reset_rum_ingest_service_for_tests,
)


def _ev(metric: str = "LCP", value: float = 1500.0) -> VitalEvent:
    return VitalEvent(
        sessionId="s-1",
        appVersion="test",
        route="/x",
        deviceClass="desktop",
        network="wifi",
        metric=metric,  # type: ignore[arg-type]
        value=value,
        rating="good",
    )


@pytest.fixture(autouse=True)
def _reset():
    reset_rum_ingest_service_for_tests()
    yield
    reset_rum_ingest_service_for_tests()


@pytest.mark.asyncio
async def test_enqueue_accepts_events():
    svc = RUMIngestService(flush_interval_s=60, high_watermark=999)
    n = await svc.enqueue([_ev(), _ev("INP", 80)])
    assert n == 2
    assert svc.queue_size == 2
    await svc.stop()


@pytest.mark.asyncio
async def test_periodic_flush_drains_queue():
    svc = RUMIngestService(flush_interval_s=0.05, high_watermark=999)
    await svc.enqueue([_ev() for _ in range(3)])
    assert svc.queue_size == 3
    # Let the flusher run.
    await asyncio.sleep(0.2)
    assert svc.queue_size == 0
    await svc.stop()


@pytest.mark.asyncio
async def test_high_watermark_triggers_immediate_flush():
    svc = RUMIngestService(flush_interval_s=60, high_watermark=5)
    await svc.enqueue([_ev() for _ in range(5)])
    # Allow the one-shot flush task to run.
    await asyncio.sleep(0.05)
    assert svc.queue_size == 0
    await svc.stop()


@pytest.mark.asyncio
async def test_drops_when_full():
    svc = RUMIngestService(flush_interval_s=60, high_watermark=999, max_size=3)
    accepted = await svc.enqueue([_ev() for _ in range(10)])
    assert accepted == 3
    assert svc.queue_size == 3
    await svc.stop()


@pytest.mark.asyncio
async def test_stop_drains_remaining():
    svc = RUMIngestService(flush_interval_s=60, high_watermark=999)
    await svc.enqueue([_ev() for _ in range(4)])
    await svc.stop()
    assert svc.queue_size == 0
