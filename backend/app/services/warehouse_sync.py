"""Firestore -> BigQuery warehouse sync (Pool 4.6).

Streams each org's business collections (invoices / bills / pos_orders), maps
every document to a BigQuery row via the shared contract in
``app.analytics.warehouse_schema``, and loads the rows into the pre-built fact
tables with an *idempotent daily-batch* upsert: for each ``(org_id, table)`` we
DELETE the org's existing rows and then INSERT the freshly-streamed batch. This
is simple and correct — re-running a sync converges to the same warehouse state
(a full snapshot per org), so a crashed/duplicated run never double-counts.

The warehouse is **optional and flag-gated**, mirroring ``rum_ingest``:

  * the heavy ``google.cloud.bigquery`` import is lazy (inside the call), and
  * if the dataset isn't configured / reachable, or the lib is missing, the
    sync is a **graceful no-op** that returns ``{"skipped": ...}`` and NEVER
    raises — production is unaffected until ``ANALYTICS_BQ_DATASET`` is set and
    the scheduler/flag is wired by the orchestrator.

Public surface (what the scheduler/flag call):

  * ``sync_org(org_id, tables=None) -> dict`` — sync one org; returns row
    counts per table (or a ``{"skipped": ...}`` sentinel).
  * ``run_warehouse_sync() -> dict`` — iterate every organization and sync each
    (this is the function the scheduler should invoke).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Iterable, Iterator, Optional

from app.analytics import warehouse_schema

log = logging.getLogger("warehouse_sync")

# Small batches: BQ streaming inserts cap at ~10k rows / 10MB per request. We
# chunk inserts so a large org never exceeds the per-request limit.
_INSERT_CHUNK = 500

_SKIP_NOT_CONFIGURED = {"skipped": "warehouse_not_configured"}


# ── Firestore streaming (org-scoped, via the existing repos) ────────────────

def _repo_for(collection: str, org_id: str):
    """Return the org-scoped ``BaseRepository`` for a fact-table collection.

    Imported lazily so this module stays import-light (and unit-testable
    without Firebase configured). Each repo exposes ``stream_org_docs`` from
    ``BaseRepository``, which pages the whole org without the list() cap.
    """
    if collection == "invoices":
        from app.firestore.invoices import InvoiceRepository
        return InvoiceRepository(org_id)
    if collection == "bills":
        from app.firestore.bills import BillRepository
        return BillRepository(org_id)
    if collection == "pos_orders":
        from app.firestore.pos import POSOrderRepository
        return POSOrderRepository(org_id)
    # Defensive: any future fact-table collection -> a generic org-scoped repo.
    from app.firestore.base import BaseRepository

    class _GenericRepo(BaseRepository):
        collection_name = collection

    return _GenericRepo(org_id)


def _stream_rows(table: str, org_id: str) -> Iterator[dict]:
    """Yield mapped BQ rows for one ``table`` of one org.

    Streams the source Firestore collection and runs each doc through
    ``warehouse_schema.map_row`` (the shared contract), so the column shape is
    owned in exactly one place.
    """
    collection = warehouse_schema.FACTS[table]["collection"]
    repo = _repo_for(collection, org_id)
    for doc in repo.stream_org_docs():
        doc_id = doc.get("id")
        yield warehouse_schema.map_row(table, doc_id, doc, org_id)


def _chunked(rows: Iterable[dict], size: int = _INSERT_CHUNK) -> Iterator[list[dict]]:
    batch: list[dict] = []
    for row in rows:
        batch.append(row)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


# ── BigQuery client / availability (mirrors rum_ingest gating) ──────────────

def _bq_client():
    """Construct a BigQuery client, or ``None`` if the lib/credentials are
    unavailable. Lazy import + broad catch so an unconfigured environment is a
    graceful no-op instead of a hard failure (same contract as rum_ingest)."""
    try:
        from google.cloud import bigquery  # type: ignore
    except Exception:  # pragma: no cover - lib optional in dev/test
        log.warning(
            "warehouse_sync.bigquery_lib_missing — install google-cloud-bigquery to enable"
        )
        return None
    try:
        return bigquery.Client(project=warehouse_schema.project_id())
    except Exception as exc:  # pragma: no cover - no creds / unreachable
        log.warning("warehouse_sync.bq_client_init_failed: %s", exc)
        return None


def _dataset_reachable(client) -> bool:
    """True if the configured dataset exists / is reachable.

    Only the *default* dataset is probed; when ``ANALYTICS_BQ_DATASET`` is set
    the operator has opted in, so we trust it and skip the round-trip (the
    insert itself surfaces any misconfiguration via logged errors).
    """
    if os.environ.get("ANALYTICS_BQ_DATASET"):
        return True
    try:
        client.get_dataset(warehouse_schema.dataset_ref())
        return True
    except Exception as exc:
        log.warning(
            "warehouse_sync.dataset_unreachable dataset=%s: %s",
            warehouse_schema.dataset_ref(),
            exc,
        )
        return False


# ── per-org sync ────────────────────────────────────────────────────────────

def sync_org(org_id: str, tables: Optional[Iterable[str]] = None) -> dict:
    """Idempotently sync one org's fact tables to BigQuery.

    For each fact table (all of ``warehouse_schema.FACTS`` or the given subset):
    stream the org's Firestore collection, map each doc to a BQ row, then
    **delete the org's existing rows and insert the fresh batch** (delete-then-
    insert = a clean daily snapshot per org). Returns ``{table: row_count}``,
    or ``{"skipped": "warehouse_not_configured"}`` when BQ isn't available.
    Never raises on a per-table BQ error — failures are logged and reported.
    """
    selected = list(tables) if tables is not None else list(warehouse_schema.FACTS.keys())
    # Validate up-front so a typo'd table name fails loudly rather than silently
    # syncing nothing (KeyError surfaces the bad name).
    for t in selected:
        if t not in warehouse_schema.FACTS:
            raise KeyError(f"unknown fact table: {t!r}")

    client = _bq_client()
    if client is None or not _dataset_reachable(client):
        return dict(_SKIP_NOT_CONFIGURED)

    counts: dict[str, Any] = {}
    for table in selected:
        try:
            counts[table] = _sync_table(client, table, org_id)
        except Exception as exc:  # noqa: BLE001 - one bad table shouldn't kill the rest
            log.exception(
                "warehouse_sync.table_failed table=%s org=%s: %s", table, org_id, exc
            )
            counts[table] = {"error": str(exc)}
    return counts


def _sync_table(client, table: str, org_id: str) -> int:
    """Delete this org's rows in ``table``, then insert the freshly-mapped
    batch. Returns the number of rows inserted."""
    target = warehouse_schema.table_ref(table)
    rows = list(_stream_rows(table, org_id))

    # 1) DELETE existing rows for this org (idempotency: re-run = same state).
    _delete_org_rows(client, table, org_id)

    # 2) INSERT the fresh batch (chunked for streaming-insert limits).
    inserted = 0
    for chunk in _chunked(rows):
        errors = client.insert_rows_json(target, chunk)
        if errors:
            log.error(
                "warehouse_sync.insert_errors table=%s org=%s errors=%s",
                table,
                org_id,
                errors[:5],
            )
        inserted += len(chunk)
    log.info(
        "warehouse_sync.table_done table=%s org=%s rows=%d", table, org_id, inserted
    )
    return inserted


def _delete_org_rows(client, table: str, org_id: str) -> None:
    """``DELETE FROM <table> WHERE org_id=@org`` via a parameterized query job."""
    from google.cloud import bigquery  # type: ignore

    target = warehouse_schema.table_ref(table)
    job = client.query(
        f"DELETE FROM `{target}` WHERE org_id = @org",
        job_config=bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("org", "STRING", org_id)]
        ),
    )
    job.result()  # block until the delete completes (sync, like rum_ingest)


# ── all-orgs sync (scheduler entrypoint) ────────────────────────────────────

def _iter_org_ids() -> list[str]:
    """Enumerate every organization id.

    Same pattern every other cross-org scheduler job uses (see
    ``scheduler._job_daily_backup`` / ``_job_payments_reconciliation``):
    ``get_firestore_client().collection("organizations").stream()`` -> ``doc.id``.
    """
    from app.firebase_client import get_firestore_client

    db = get_firestore_client()
    return [doc.id for doc in db.collection("organizations").stream()]


def run_warehouse_sync() -> dict:
    """Sync the warehouse for every organization. **Scheduler entrypoint.**

    Returns ``{"skipped": ...}`` if BQ isn't configured (checked once up-front,
    so we don't enumerate orgs needlessly), otherwise
    ``{"orgs": <n>, "results": {org_id: {table: count}}}``. A per-org failure is
    logged and recorded without aborting the run.
    """
    # Cheap pre-check: bail before touching Firestore if BQ is unavailable.
    client = _bq_client()
    if client is None or not _dataset_reachable(client):
        return dict(_SKIP_NOT_CONFIGURED)

    try:
        org_ids = _iter_org_ids()
    except Exception as exc:  # noqa: BLE001 - defensive scheduler guard
        log.exception("warehouse_sync.org_enumeration_failed: %s", exc)
        return {"skipped": "org_enumeration_failed", "error": str(exc)}

    results: dict[str, Any] = {}
    for org_id in org_ids:
        try:
            results[org_id] = sync_org(org_id)
        except Exception as exc:  # noqa: BLE001 - never let one org abort the run
            log.exception("warehouse_sync.org_failed org=%s: %s", org_id, exc)
            results[org_id] = {"error": str(exc)}
    log.info("warehouse_sync.run_done orgs=%d", len(org_ids))
    return {"orgs": len(org_ids), "results": results}
