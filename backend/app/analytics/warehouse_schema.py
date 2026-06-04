"""Single source of truth for the BigQuery business-data warehouse (Pool 4.6).

Defines the fact-table schemas + the Firestore->BQ row mapping. Imported by:
  - ``services.warehouse_sync``  — creates the tables + loads rows.
  - ``api.analytics``            — queries the same columns (the _FACTS map there
                                   must reference only columns declared here).
  - the BQML revenue forecast    — reads ``fact_invoices``.

Dataset is resolved from ``ANALYTICS_BQ_DATASET`` (``project.dataset``, e.g.
``zoho-83cda.zoho_warehouse``). Import-light by design (no ``google.cloud``
import at module load) so it stays unit-testable without the BQ SDK.
"""
from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any, Callable

DEFAULT_DATASET = "zoho-83cda.zoho_warehouse"


def dataset_ref() -> str:
    """``project.dataset`` for the warehouse (env override, else the default)."""
    return os.environ.get("ANALYTICS_BQ_DATASET") or DEFAULT_DATASET


def table_ref(table: str) -> str:
    """Fully-qualified ``project.dataset.table``."""
    return f"{dataset_ref()}.{table}"


def project_id() -> str:
    """GCP project that owns the warehouse, parsed from ``dataset_ref`` (the
    ``project`` of ``project.dataset``). Pass this to ``bigquery.Client(project=)``
    so jobs bill to the warehouse project explicitly instead of an ambient
    gcloud/ADC default (which may be a stale or unrelated project)."""
    ref = dataset_ref()
    return ref.split(".", 1)[0] if "." in ref else ref


# ── value coercers ──────────────────────────────────────────────────────────

def _f(v: Any) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _s(v: Any) -> str | None:
    return str(v) if v not in (None, "") else None


def _date10(v: Any) -> str | None:
    """Firestore date (str 'YYYY-MM-DD'[...], datetime, or date) -> 'YYYY-MM-DD'."""
    if isinstance(v, (datetime, date)):
        return v.date().isoformat() if isinstance(v, datetime) else v.isoformat()
    if isinstance(v, str) and len(v) >= 10:
        return v[:10]
    return None


def _ts(v: Any) -> str | None:
    """-> ISO-8601 TIMESTAMP string, or None."""
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, str) and v:
        return v.replace(" ", "T")
    return None


# ── fact-table definitions ──────────────────────────────────────────────────
# Each: BQ schema (col -> BQ type), the source Firestore collection, the
# partition column, and a mapper turning one Firestore doc into a BQ row dict.
# Every row carries org_id (tenant) + id (the Firestore doc id) so sync is an
# idempotent MERGE on (org_id, id).

def _map_invoice(doc_id: str, d: dict, org_id: str) -> dict:
    return {
        "org_id": org_id,
        "id": doc_id,
        "date": _date10(d.get("date") or d.get("invoice_date")),
        "total": _f(d.get("total")),
        "balance_due": _f(d.get("balance_due")),
        "tax_amount": _f(d.get("tax_amount")),
        "status": _s(d.get("status")),
        "contact_name": _s(d.get("contact_name") or d.get("customer_name")),
        "branch_id": _s(d.get("branch_id")),
        "created_at": _ts(d.get("created_at")),
    }


def _map_bill(doc_id: str, d: dict, org_id: str) -> dict:
    return {
        "org_id": org_id,
        "id": doc_id,
        "date": _date10(d.get("date") or d.get("bill_date")),
        "total": _f(d.get("total")),
        "balance_due": _f(d.get("balance_due")),
        "status": _s(d.get("status")),
        "vendor_name": _s(d.get("vendor_name") or d.get("contact_name")),
        "created_at": _ts(d.get("created_at")),
    }


def _map_pos_order(doc_id: str, d: dict, org_id: str) -> dict:
    return {
        "org_id": org_id,
        "id": doc_id,
        "created_at": _ts(d.get("created_at")),
        "date": _date10(d.get("created_at")),
        "total": _f(d.get("total")),
        "register_id": _s(d.get("register_id") or d.get("terminal_id")),
        "cashier_id": _s(d.get("cashier_id") or d.get("user_id")),
    }


def _map_item(doc_id: str, d: dict, org_id: str) -> dict:
    """Current item master + stock snapshot (for reorder / stockout prediction)."""
    return {
        "org_id": org_id,
        "id": doc_id,
        "name": _s(d.get("name") or d.get("item_name")),
        "sku": _s(d.get("sku")),
        "stock_on_hand": _f(d.get("stock_on_hand")),
        "reorder_point": _f(d.get("reorder_point")),
        "cost_price": _f(d.get("cost_price")),
        "selling_price": _f(d.get("selling_price") or d.get("rate") or d.get("price")),
        "track_inventory": bool(d.get("track_inventory", True)),
        "synced_at": _ts(datetime.utcnow()),
    }


def map_invoice_line(line_id: str, line: dict, invoice_id: str, invoice_date,
                     invoice_status, org_id: str) -> dict:
    """One sold line (for per-item demand forecasting). Carries the parent
    invoice's date/status so item sales can be aggregated over time."""
    return {
        "org_id": org_id,
        "invoice_id": invoice_id,
        "line_id": line_id,
        "item_id": _s(line.get("item_id")),
        "description": _s(line.get("description") or line.get("item_name")),
        "quantity": _f(line.get("quantity") or line.get("qty")),
        "unit_price": _f(line.get("unit_price") or line.get("rate")),
        "line_total": _f(line.get("line_total") or line.get("total") or line.get("amount")),
        "date": _date10(invoice_date),
        "status": _s(invoice_status),
    }


# table -> {schema, collection, partition_col, mapper}
FACTS: dict[str, dict[str, Any]] = {
    "fact_invoices": {
        "collection": "invoices",
        "partition_col": "date",
        "mapper": _map_invoice,
        "schema": {
            "org_id": "STRING", "id": "STRING", "date": "DATE", "total": "FLOAT",
            "balance_due": "FLOAT", "tax_amount": "FLOAT", "status": "STRING",
            "contact_name": "STRING", "branch_id": "STRING", "created_at": "TIMESTAMP",
        },
    },
    "fact_bills": {
        "collection": "bills",
        "partition_col": "date",
        "mapper": _map_bill,
        "schema": {
            "org_id": "STRING", "id": "STRING", "date": "DATE", "total": "FLOAT",
            "balance_due": "FLOAT", "status": "STRING", "vendor_name": "STRING",
            "created_at": "TIMESTAMP",
        },
    },
    "fact_pos_orders": {
        "collection": "pos_orders",
        "partition_col": "date",
        "mapper": _map_pos_order,
        "schema": {
            "org_id": "STRING", "id": "STRING", "created_at": "TIMESTAMP",
            "date": "DATE", "total": "FLOAT", "register_id": "STRING",
            "cashier_id": "STRING",
        },
    },
    # Item master + live stock snapshot — not time-series, so no date partition
    # (clustered by org_id only). Powers reorder / stockout / dead-stock.
    "fact_items": {
        "collection": "items",
        "partition_col": None,
        "mapper": _map_item,
        "schema": {
            "org_id": "STRING", "id": "STRING", "name": "STRING", "sku": "STRING",
            "stock_on_hand": "FLOAT", "reorder_point": "FLOAT", "cost_price": "FLOAT",
            "selling_price": "FLOAT", "track_inventory": "BOOL", "synced_at": "TIMESTAMP",
        },
    },
}

# Line-level sales (one row per invoice line) for per-item demand forecasting.
# NOT a standard header collection — it is the "lines" subcollection under each
# invoice, so warehouse_sync syncs it via a dedicated path (map_invoice_line).
INVOICE_LINES = {
    "table": "fact_invoice_lines",
    "partition_col": "date",
    "schema": {
        "org_id": "STRING", "invoice_id": "STRING", "line_id": "STRING",
        "item_id": "STRING", "description": "STRING", "quantity": "FLOAT",
        "unit_price": "FLOAT", "line_total": "FLOAT", "date": "DATE", "status": "STRING",
    },
}


def map_row(table: str, doc_id: str, doc: dict, org_id: str) -> dict:
    """Map a Firestore doc to a BQ row for ``table`` (raises on unknown table)."""
    return FACTS[table]["mapper"](doc_id, doc, org_id)
