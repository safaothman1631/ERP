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

def all_tables() -> list[str]:
    """Every warehouse table this module knows how to sync, in a stable order:
    the generic header facts (``FACTS``), the line-level sales table, and the
    derived/enriched tables (GL, expenses, payments, orders, quotes)."""
    return (
        list(warehouse_schema.FACTS.keys())
        + ["fact_invoice_lines"]
        + list(warehouse_schema.DERIVED_TABLES.keys())
    )


def _dispatch_sync(client, table: str, org_id: str, accounts_map: dict, contacts_map: dict):
    """Route one table to its sync implementation (generic vs derived)."""
    if table == "fact_invoice_lines":
        return _sync_invoice_lines(client, org_id)
    if table == "fact_je_lines":
        return _sync_je_lines(client, org_id, accounts_map)
    if table == "fact_expenses":
        return _sync_expenses(client, org_id, accounts_map)
    if table == "fact_payments":
        return _sync_payments(client, org_id, contacts_map)
    if table in _ORDER_SOURCES:
        return _sync_orders(client, table, _ORDER_SOURCES[table], org_id, contacts_map)
    # generic header facts: invoices / bills / pos_orders / items / contacts / accounts
    return _sync_table(client, table, org_id)


def sync_org(org_id: str, tables: Optional[Iterable[str]] = None) -> dict:
    """Idempotently sync one org's fact tables to BigQuery.

    For each fact table (all of :func:`all_tables` or the given subset): stream
    the org's Firestore collection(s), map each doc to a BQ row (enriching GL /
    expense rows with account names and payment / order rows with contact names),
    then **delete the org's existing rows and insert the fresh batch** (delete-
    then-insert = a clean daily snapshot per org). The dataset + tables are
    provisioned up-front (idempotent) so a first-ever sync works. Returns
    ``{table: row_count}``, or ``{"skipped": "warehouse_not_configured"}`` when
    BQ isn't available. Never raises on a per-table error — logged and reported.
    """
    selected = list(tables) if tables is not None else all_tables()
    # Validate up-front so a typo'd table name fails loudly rather than silently
    # syncing nothing (KeyError surfaces the bad name).
    valid = set(warehouse_schema.FACTS) | {"fact_invoice_lines"} | set(warehouse_schema.DERIVED_TABLES)
    for t in selected:
        if t not in valid:
            raise KeyError(f"unknown fact table: {t!r}")

    client = _bq_client()
    if client is None or not _dataset_reachable(client):
        return dict(_SKIP_NOT_CONFIGURED)

    # Provision the dataset + tables (idempotent) so the very first sync works.
    ensure_warehouse(client)

    # Build name-resolution maps once per org, only if an enriched table is in play.
    needs_maps = any(t in warehouse_schema.DERIVED_TABLES for t in selected)
    accounts_map, contacts_map = _lookup_maps(org_id) if needs_maps else ({}, {})

    counts: dict[str, Any] = {}
    for table in selected:
        try:
            counts[table] = _dispatch_sync(client, table, org_id, accounts_map, contacts_map)
        except Exception as exc:  # noqa: BLE001 - one bad table shouldn't kill the rest
            log.exception(
                "warehouse_sync.table_failed table=%s org=%s: %s", table, org_id, exc
            )
            counts[table] = {"error": str(exc)}
    return counts


def _sync_table(client, table: str, org_id: str) -> int:
    """Delete this org's rows in ``table``, then insert the freshly-mapped
    batch (delete-then-insert = a clean per-org snapshot). Returns rows inserted."""
    return _insert_rows(client, table, list(_stream_rows(table, org_id)), org_id)


def _sync_invoice_lines(client, org_id: str) -> int:
    """Sync line-level sales into ``fact_invoice_lines`` (one BQ row per invoice
    line) for per-item demand forecasting. Lines live in each invoice's ``lines``
    subcollection; we read them via ``BaseRepository.get_lines`` (embedded-list
    fallback). Delete-then-insert per org, like the header tables."""
    import uuid as _uuid

    from app.firestore.invoices import InvoiceRepository

    repo = InvoiceRepository(org_id)
    rows: list[dict] = []
    for inv in repo.stream_org_docs():
        inv_id = inv.get("id")
        inv_date = inv.get("date") or inv.get("invoice_date")
        inv_status = inv.get("status")
        try:
            lines = repo.get_lines(inv_id)
        except Exception:  # noqa: BLE001 - fall back to embedded lines
            lines = inv.get("lines") or []
        for ln in (lines or []):
            line_id = ln.get("id") or ln.get("line_id") or str(_uuid.uuid4())
            rows.append(
                warehouse_schema.map_invoice_line(line_id, ln, inv_id, inv_date, inv_status, org_id)
            )

    return _insert_rows(client, "fact_invoice_lines", rows, org_id)


# ── Table provisioning (idempotent) ─────────────────────────────────────────

def ensure_warehouse(client) -> None:
    """Create the dataset + every warehouse table if they don't already exist.

    Idempotent (``exists_ok=True``): safe to call on every sync. Schemas come
    from ``warehouse_schema.all_table_schemas`` (one source of truth), and each
    table is DATE/TIMESTAMP-partitioned on its ``partition_col`` when it has one
    (cheaper scans for the time-series facts). Without this, the very first sync
    would fail because BigQuery streaming inserts require the table to exist —
    so this is what makes "set ANALYTICS_BQ_DATASET and go" actually work.
    """
    from google.cloud import bigquery  # type: ignore

    ds_ref = warehouse_schema.dataset_ref()
    dataset = bigquery.Dataset(ds_ref)
    try:
        client.create_dataset(dataset, exists_ok=True)
    except Exception as exc:  # noqa: BLE001 - may lack create perms; tables may still exist
        log.warning("warehouse_sync.ensure_dataset_failed dataset=%s: %s", ds_ref, exc)

    for table, schema in warehouse_schema.all_table_schemas().items():
        fields = [bigquery.SchemaField(col, bq_type) for col, bq_type in schema.items()]
        tbl = bigquery.Table(warehouse_schema.table_ref(table), schema=fields)
        pcol = warehouse_schema.partition_col(table)
        if pcol and schema.get(pcol) in ("DATE", "TIMESTAMP"):
            tbl.time_partitioning = bigquery.TimePartitioning(field=pcol)
        try:
            client.create_table(tbl, exists_ok=True)
        except Exception as exc:  # noqa: BLE001 - one table failing shouldn't abort the rest
            log.warning("warehouse_sync.ensure_table_failed table=%s: %s", table, exc)


# ── Per-org lookup maps (for name enrichment) ───────────────────────────────

def _lookup_maps(org_id: str) -> tuple[dict, dict]:
    """Build ``(accounts_map, contacts_map)`` once per org for name resolution.

    ``accounts_map``: ``{account_id: {"name", "account_type"}}`` — used to
    denormalize the GL & expense account name/type so each fact row is
    self-contained (the LLM never joins). ``contacts_map``: ``{contact_id:
    name}`` — used for payments & order headers. Read via the generic org-scoped
    repos; failures degrade to empty maps (rows just carry ids, not names)."""
    accounts: dict[str, dict] = {}
    contacts: dict[str, str] = {}
    try:
        for a in _repo_for("accounts", org_id).stream_org_docs():
            accounts[a.get("id")] = {
                "name": a.get("name") or a.get("account_name"),
                "account_type": a.get("account_type"),
            }
    except Exception as exc:  # noqa: BLE001
        log.warning("warehouse_sync.accounts_map_failed org=%s: %s", org_id, exc)
    try:
        for c in _repo_for("contacts", org_id).stream_org_docs():
            contacts[c.get("id")] = c.get("display_name") or c.get("company_name") or c.get("name")
    except Exception as exc:  # noqa: BLE001
        log.warning("warehouse_sync.contacts_map_failed org=%s: %s", org_id, exc)
    return accounts, contacts


# ── Derived-table sync (enriched / merged) ──────────────────────────────────

def _insert_chunk(client, target: str, chunk: list[dict], attempts: int = 6) -> list:
    """``insert_rows_json`` with retry-on-NotFound.

    A *freshly created* BigQuery table can take a few seconds before it accepts
    streaming inserts (metadata propagation) — so the very first sync after
    provisioning would otherwise fail with "table not found". We retry on
    ``NotFound`` with a short exponential backoff; row-level errors (a list, not
    an exception) are returned to the caller to log. Steady-state syncs hit the
    table immediately and never sleep."""
    import time

    try:
        from google.api_core.exceptions import NotFound  # type: ignore
    except Exception:  # pragma: no cover - api_core always present with bigquery
        NotFound = ()  # type: ignore
    last_exc = None
    for i in range(attempts):
        try:
            return client.insert_rows_json(target, chunk)
        except NotFound as exc:  # table not propagated yet -> wait & retry
            last_exc = exc
            log.info("warehouse_sync.table_not_ready target=%s attempt=%d", target, i + 1)
            time.sleep(min(2 ** i, 8))
    if last_exc is not None:
        raise last_exc
    return []


def _insert_rows(client, table: str, rows: list[dict], org_id: str) -> int:
    """Delete this org's rows in ``table`` then insert ``rows`` (chunked)."""
    _delete_org_rows(client, table, org_id)
    target = warehouse_schema.table_ref(table)
    inserted = 0
    for chunk in _chunked(rows):
        errors = _insert_chunk(client, target, chunk)
        if errors:
            log.error("warehouse_sync.insert_errors table=%s org=%s errors=%s", table, org_id, errors[:5])
        inserted += len(chunk)
    log.info("warehouse_sync.table_done table=%s org=%s rows=%d", table, org_id, inserted)
    return inserted


def _sync_je_lines(client, org_id: str, accounts_map: dict) -> int:
    """Sync the General Ledger into ``fact_je_lines`` (one row per JE line).

    Streams ``journal_entries`` headers, skips void/cancelled entries, reads each
    entry's ``lines`` subcollection, and enriches every line with its account
    name/type + the header's status/date/source — making the GL a complete,
    self-contained fact that answers almost any financial question."""
    db = None  # fetched lazily on the first non-void header (keeps tests offline)
    rows: list[dict] = []
    for hdr in _repo_for("journal_entries", org_id).stream_org_docs():
        if str(hdr.get("status") or "").lower() in ("void", "voided", "cancelled", "canceled"):
            continue
        if db is None:
            from app.firebase_client import get_firestore_client
            db = get_firestore_client()
        je_id = hdr.get("id")
        try:
            line_docs = db.collection("journal_entries").document(je_id).collection("lines").stream()
            lines = [{"id": d.id, **(d.to_dict() or {})} for d in line_docs]
        except Exception:  # noqa: BLE001 - fall back to an embedded lines list
            lines = hdr.get("lines") or []
        for ln in lines:
            line_id = ln.get("id") or ln.get("line_id")
            account = accounts_map.get(ln.get("account_id")) or {}
            rows.append(warehouse_schema.map_je_line(line_id, ln, hdr, account, org_id))
    return _insert_rows(client, "fact_je_lines", rows, org_id)


def _sync_expenses(client, org_id: str, accounts_map: dict) -> int:
    """Sync ``expenses`` into ``fact_expenses`` with the account (category) resolved."""
    rows: list[dict] = []
    for d in _repo_for("expenses", org_id).stream_org_docs():
        account = accounts_map.get(d.get("account_id")) or {}
        rows.append(warehouse_schema.map_expense(d.get("id"), d, account, org_id))
    return _insert_rows(client, "fact_expenses", rows, org_id)


def _sync_payments(client, org_id: str, contacts_map: dict) -> int:
    """Merge ``payments_received`` + ``payments_made`` into one ``fact_payments``
    table (a ``direction`` column distinguishes them) so cash-flow is one fact."""
    rows: list[dict] = []
    for collection, direction in (("payments_received", "received"), ("payments_made", "made")):
        for d in _repo_for(collection, org_id).stream_org_docs():
            name = contacts_map.get(d.get("contact_id"))
            rows.append(warehouse_schema.map_payment(d.get("id"), d, direction, name, org_id))
    return _insert_rows(client, "fact_payments", rows, org_id)


def _sync_orders(client, table: str, collection: str, org_id: str, contacts_map: dict) -> int:
    """Sync a sales-order / purchase-order / quote collection into its fact table
    (shared header shape), with the contact name resolved."""
    rows: list[dict] = []
    for d in _repo_for(collection, org_id).stream_org_docs():
        name = contacts_map.get(d.get("contact_id"))
        rows.append(warehouse_schema.map_order(table, d.get("id"), d, name, org_id))
    return _insert_rows(client, table, rows, org_id)


_ORDER_SOURCES = {
    "fact_sales_orders": "sales_orders",
    "fact_purchase_orders": "purchase_orders",
    "fact_quotes": "quotes",
}


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
