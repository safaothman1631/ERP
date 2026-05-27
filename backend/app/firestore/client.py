"""Typed Firestore wrapper with OTel tracing (P4 / R5.4, R5.8, R6.3).

This module is the *only* place backend code should reach for Firestore when
performance and observability matter. It exposes:

- :func:`get_async_client` — process-wide Firestore async client (lazy init).
- :func:`traced_get`, :func:`traced_query`, :func:`traced_set`, :func:`traced_delete`
  — each call is wrapped in an OpenTelemetry span with ``firestore.collection``
  and ``firestore.operation`` attributes (R6.3) and records latency. Spans use
  the tracing utility from :mod:`app.observability.tracing` when available
  (no-op fallback otherwise).
- :func:`run_threadpool` — convenience for the few sync-only call sites.

All operations log a ``slow_read=true`` warning when latency exceeds 1000ms
(R5.8) so we can chase regressions in the field.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Iterable, Optional, Sequence

log = logging.getLogger("firestore.client")

# Threshold above which a Firestore operation is considered slow (R5.8).
SLOW_READ_THRESHOLD_MS: float = 1000.0


# ── No-op tracer fallback ────────────────────────────────────────────────────


class _NoOpSpan:
    def set_attribute(self, *_a: Any, **_kw: Any) -> None: ...
    def record_exception(self, *_a: Any, **_kw: Any) -> None: ...
    def __enter__(self) -> "_NoOpSpan": return self
    def __exit__(self, *_e: Any) -> None: ...


def _span(collection: str, op: str):
    """Open an OTel span for a Firestore op; fall back to no-op span on errors."""
    try:
        from app.observability.tracing import traced_firestore_op  # type: ignore
        return traced_firestore_op(collection, op)
    except Exception:  # noqa: BLE001
        # Tracing module not present or not initialised — degrade silently.
        return _NoOpSpan()


# ── Async client singleton ───────────────────────────────────────────────────


_ASYNC_CLIENT: Any = None


def get_async_client() -> Any:
    """Return the process-wide Firestore async client.

    Lazy-initialised on first call. Re-uses the project & credentials wiring
    from :mod:`app.firebase_client` when possible.
    """
    global _ASYNC_CLIENT
    if _ASYNC_CLIENT is not None:
        return _ASYNC_CLIENT

    try:
        from google.cloud import firestore as gfs  # type: ignore
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(
            "google-cloud-firestore is not installed — cannot build async client"
        ) from e

    # Reuse the existing init path to keep credentials handling consistent.
    try:
        from app.firebase_client import init_firebase  # type: ignore
        init_firebase()
    except Exception as e:  # noqa: BLE001
        # If init_firebase fails (e.g. missing creds in tests) we still try
        # to instantiate AsyncClient — ADC may be available.
        log.debug("firestore.async_client.firebase_init_failed", extra={"err": str(e)})

    import os
    project_id = os.environ.get("FIREBASE_PROJECT_ID") or os.environ.get(
        "GOOGLE_CLOUD_PROJECT"
    )
    _ASYNC_CLIENT = gfs.AsyncClient(project=project_id) if project_id else gfs.AsyncClient()
    log.info("firestore.async_client.initialized", extra={"project": project_id})
    return _ASYNC_CLIENT


# ── Traced operations ────────────────────────────────────────────────────────


def _log_slow(op: str, collection: str, elapsed_ms: float, **extra: Any) -> None:
    if elapsed_ms >= SLOW_READ_THRESHOLD_MS:
        log.warning(
            "firestore.slow_op",
            extra={
                "slow_read": True,
                "op": op,
                "collection": collection,
                "elapsed_ms": round(elapsed_ms, 1),
                **extra,
            },
        )


async def traced_get(collection: str, doc_id: str) -> Optional[dict]:
    """Read a single document, traced. Returns ``None`` if missing."""
    client = get_async_client()
    start = time.perf_counter()
    with _span(collection, "get") as span:
        try:
            snap = await client.collection(collection).document(doc_id).get()
            data = snap.to_dict() if snap.exists else None
            if hasattr(span, "set_attribute"):
                span.set_attribute("doc.exists", bool(data is not None))
                span.set_attribute("doc.id", doc_id)
            return data
        except Exception as e:  # noqa: BLE001
            if hasattr(span, "record_exception"):
                span.record_exception(e)
            raise
        finally:
            elapsed = (time.perf_counter() - start) * 1000
            _log_slow("get", collection, elapsed, doc_id=doc_id)


async def traced_query(
    collection: str,
    filters: Optional[Sequence[tuple[str, str, Any]]] = None,
    order_by: Optional[Sequence[tuple[str, str]]] = None,
    limit: Optional[int] = None,
) -> list[dict]:
    """Run a list query, traced.

    Args:
        collection: Top-level collection name.
        filters: Iterable of ``(field, op, value)`` triples — e.g.
            ``[("tenant_id", "==", "t1"), ("status", "==", "open")]``.
        order_by: Iterable of ``(field, direction)`` where direction is
            ``"asc"`` or ``"desc"``.
        limit: Maximum rows to return.
    """
    client = get_async_client()
    start = time.perf_counter()
    with _span(collection, "query") as span:
        q: Any = client.collection(collection)
        for field, op, value in filters or ():
            q = q.where(field, op, value)
        for field, direction in order_by or ():
            try:
                from google.cloud.firestore import Query  # type: ignore
                dir_const = (
                    Query.DESCENDING if direction.lower() == "desc" else Query.ASCENDING
                )
            except Exception:  # noqa: BLE001
                dir_const = direction
            q = q.order_by(field, direction=dir_const)
        if limit is not None:
            q = q.limit(limit)
        try:
            rows: list[dict] = []
            async for snap in q.stream():
                d = snap.to_dict() or {}
                d.setdefault("id", snap.id)
                rows.append(d)
            if hasattr(span, "set_attribute"):
                span.set_attribute("query.result_count", len(rows))
                span.set_attribute("query.limit", int(limit) if limit else -1)
            return rows
        except Exception as e:  # noqa: BLE001
            if hasattr(span, "record_exception"):
                span.record_exception(e)
            raise
        finally:
            elapsed = (time.perf_counter() - start) * 1000
            _log_slow("query", collection, elapsed)


async def traced_set(
    collection: str,
    doc_id: str,
    data: dict,
    *,
    merge: bool = False,
) -> None:
    """Write a document, traced."""
    client = get_async_client()
    start = time.perf_counter()
    with _span(collection, "set") as span:
        try:
            await client.collection(collection).document(doc_id).set(data, merge=merge)
            if hasattr(span, "set_attribute"):
                span.set_attribute("doc.id", doc_id)
                span.set_attribute("set.merge", merge)
        except Exception as e:  # noqa: BLE001
            if hasattr(span, "record_exception"):
                span.record_exception(e)
            raise
        finally:
            elapsed = (time.perf_counter() - start) * 1000
            _log_slow("set", collection, elapsed, doc_id=doc_id)


async def traced_delete(collection: str, doc_id: str) -> None:
    """Delete a document, traced."""
    client = get_async_client()
    start = time.perf_counter()
    with _span(collection, "delete") as span:
        try:
            await client.collection(collection).document(doc_id).delete()
            if hasattr(span, "set_attribute"):
                span.set_attribute("doc.id", doc_id)
        except Exception as e:  # noqa: BLE001
            if hasattr(span, "record_exception"):
                span.record_exception(e)
            raise
        finally:
            elapsed = (time.perf_counter() - start) * 1000
            _log_slow("delete", collection, elapsed, doc_id=doc_id)


# ── Threadpool helper for sync call sites ────────────────────────────────────


async def run_threadpool(fn, *args: Any, **kwargs: Any) -> Any:
    """Run a blocking ``fn(*args, **kwargs)`` off the event loop.

    Shorthand for::

        await asyncio.get_event_loop().run_in_executor(None, lambda: fn(*args, **kwargs))

    Intended for the few legacy sync-only call sites we can't migrate to the
    async client yet. Prefer the traced_* helpers above wherever possible.
    """
    loop = asyncio.get_event_loop()
    if not args and not kwargs:
        return await loop.run_in_executor(None, fn)
    return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))


__all__ = [
    "get_async_client",
    "traced_get",
    "traced_query",
    "traced_set",
    "traced_delete",
    "run_threadpool",
    "SLOW_READ_THRESHOLD_MS",
]
