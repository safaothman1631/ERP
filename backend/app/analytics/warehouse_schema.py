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


def _map_contact(doc_id: str, d: dict, org_id: str) -> dict:
    """Customer / vendor master (the 'who' behind every sale & purchase)."""
    return {
        "org_id": org_id,
        "id": doc_id,
        "name": _s(d.get("display_name") or d.get("company_name") or d.get("name")),
        "contact_type": _s(d.get("contact_type")),  # 'customer' | 'vendor'
        "email": _s(d.get("email")),
        "phone": _s(d.get("phone") or d.get("mobile")),
        "currency_code": _s(d.get("currency_code")),
        "opening_balance": _f(d.get("opening_balance")),
        "is_active": bool(d.get("is_active", True)),
        "created_at": _ts(d.get("created_at")),
    }


def _map_account(doc_id: str, d: dict, org_id: str) -> dict:
    """Chart-of-accounts entry + current balance (the financial backbone)."""
    return {
        "org_id": org_id,
        "id": doc_id,
        "code": _s(d.get("code")),
        "name": _s(d.get("name") or d.get("account_name")),
        "name_ku": _s(d.get("name_ku")),
        "account_type": _s(d.get("account_type")),
        "balance": _f(d.get("balance")),
        "parent_id": _s(d.get("parent_id")),
        "is_active": bool(d.get("is_active", True)),
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
    # Customer/vendor master — not time-series (clustered by org only). Powers
    # "who are my customers/vendors", segment counts, contactability.
    "fact_contacts": {
        "collection": "contacts",
        "partition_col": None,
        "mapper": _map_contact,
        "schema": {
            "org_id": "STRING", "id": "STRING", "name": "STRING",
            "contact_type": "STRING", "email": "STRING", "phone": "STRING",
            "currency_code": "STRING", "opening_balance": "FLOAT",
            "is_active": "BOOL", "created_at": "TIMESTAMP",
        },
    },
    # Chart of accounts + live balance snapshot. Powers account balances, the
    # account dimension behind the GL, and "what's in account X".
    "fact_accounts": {
        "collection": "accounts",
        "partition_col": None,
        "mapper": _map_account,
        "schema": {
            "org_id": "STRING", "id": "STRING", "code": "STRING", "name": "STRING",
            "name_ku": "STRING", "account_type": "STRING", "balance": "FLOAT",
            "parent_id": "STRING", "is_active": "BOOL",
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


# ── Derived / enriched fact tables ──────────────────────────────────────────
# These need a name resolved from another collection (account_name for GL &
# expenses, contact_name for payments & orders) or merge two source collections
# into one table (payments). They are NOT synced via the generic ``map_row``
# path — ``services.warehouse_sync`` has a dedicated function per table that
# builds the per-org lookup maps once and calls the builders below. Their
# schemas live here so table provisioning covers every table in one place.


def map_je_line(line_id: str, line: dict, header: dict, account: dict, org_id: str) -> dict:
    """One General-Ledger line — the single most complete financial record.

    ``line`` is a doc from ``journal_entries/{id}/lines``; ``header`` its parent
    journal entry; ``account`` the resolved chart-of-accounts entry (name +
    type). Every posted invoice, bill, payment, COGS move and manual entry flows
    through here, so this table answers almost any financial question on its own.
    ``net`` = debit − credit (a natural signed amount for balance-style sums).
    """
    debit = _f(line.get("debit"))
    credit = _f(line.get("credit"))
    return {
        "org_id": org_id,
        "je_id": _s(header.get("id")),
        "line_id": line_id,
        "account_id": _s(line.get("account_id")),
        "account_name": _s((account or {}).get("name") or (account or {}).get("account_name")),
        "account_type": _s((account or {}).get("account_type")),
        "debit": debit,
        "credit": credit,
        "net": round(debit - credit, 4),
        "date": _date10(line.get("je_date") or header.get("date")),
        "status": _s(header.get("status")),
        "source_type": _s(header.get("source_type")),
        "company_id": _s(line.get("company_id") or header.get("company_id") or org_id),
        "description": _s(line.get("description") or header.get("description")),
        "contact_id": _s(line.get("contact_id")),
    }


def map_expense(doc_id: str, d: dict, account: dict, org_id: str) -> dict:
    """One expense, with its expense account name/type resolved (the 'category')."""
    return {
        "org_id": org_id,
        "id": doc_id,
        "date": _date10(d.get("date")),
        "amount": _f(d.get("total") or d.get("amount")),
        "tax_amount": _f(d.get("tax_amount")),
        "account_id": _s(d.get("account_id")),
        "account_name": _s((account or {}).get("name") or (account or {}).get("account_name")),
        "account_type": _s((account or {}).get("account_type")),
        "contact_id": _s(d.get("contact_id")),
        "status": _s(d.get("status")),
        "currency_code": _s(d.get("currency_code")),
        "project_id": _s(d.get("project_id")),
        "created_at": _ts(d.get("created_at")),
    }


def map_payment(doc_id: str, d: dict, direction: str, contact_name, org_id: str) -> dict:
    """One payment (money in/out). ``direction`` is 'received' or 'made'; the two
    source collections are merged into one table so cash-flow is a single fact."""
    return {
        "org_id": org_id,
        "id": doc_id,
        "date": _date10(d.get("date")),
        "amount": _f(d.get("amount")),
        "direction": direction,
        "payment_mode": _s(d.get("payment_mode") or d.get("payment_method") or d.get("mode")),
        "contact_id": _s(d.get("contact_id")),
        "contact_name": _s(contact_name),
        "currency_code": _s(d.get("currency_code")),
        "created_at": _ts(d.get("created_at")),
    }


def map_order(table: str, doc_id: str, d: dict, contact_name, org_id: str) -> dict:
    """One sales order / purchase order / quote header (shared shape), with the
    contact name resolved. ``due_date`` folds delivery_date (orders) / expiry_date
    (quotes) into one column."""
    return {
        "org_id": org_id,
        "id": doc_id,
        "date": _date10(d.get("date")),
        "due_date": _date10(d.get("delivery_date") or d.get("expiry_date")),
        "total": _f(d.get("total")),
        "subtotal": _f(d.get("subtotal")),
        "tax_amount": _f(d.get("tax_amount")),
        "discount_amount": _f(d.get("discount_amount")),
        "status": _s(d.get("status")),
        "contact_id": _s(d.get("contact_id")),
        "contact_name": _s(contact_name),
        "number": _s(d.get("order_number") or d.get("quote_number") or d.get("number")),
        "currency_code": _s(d.get("currency_code")),
        "created_at": _ts(d.get("created_at")),
    }


_ORDER_SCHEMA = {
    "org_id": "STRING", "id": "STRING", "date": "DATE", "due_date": "DATE",
    "total": "FLOAT", "subtotal": "FLOAT", "tax_amount": "FLOAT",
    "discount_amount": "FLOAT", "status": "STRING", "contact_id": "STRING",
    "contact_name": "STRING", "number": "STRING", "currency_code": "STRING",
    "created_at": "TIMESTAMP",
}

# table -> {schema, partition_col, source} for the enriched/merged tables.
# ``source`` documents the Firestore collection(s) feeding each (for sync).
DERIVED_TABLES: dict[str, dict[str, Any]] = {
    "fact_je_lines": {
        "partition_col": "date",
        "source": "journal_entries/lines",
        "schema": {
            "org_id": "STRING", "je_id": "STRING", "line_id": "STRING",
            "account_id": "STRING", "account_name": "STRING", "account_type": "STRING",
            "debit": "FLOAT", "credit": "FLOAT", "net": "FLOAT", "date": "DATE",
            "status": "STRING", "source_type": "STRING", "company_id": "STRING",
            "description": "STRING", "contact_id": "STRING",
        },
    },
    "fact_expenses": {
        "partition_col": "date",
        "source": "expenses",
        "schema": {
            "org_id": "STRING", "id": "STRING", "date": "DATE", "amount": "FLOAT",
            "tax_amount": "FLOAT", "account_id": "STRING", "account_name": "STRING",
            "account_type": "STRING", "contact_id": "STRING", "status": "STRING",
            "currency_code": "STRING", "project_id": "STRING", "created_at": "TIMESTAMP",
        },
    },
    "fact_payments": {
        "partition_col": "date",
        "source": "payments_received+payments_made",
        "schema": {
            "org_id": "STRING", "id": "STRING", "date": "DATE", "amount": "FLOAT",
            "direction": "STRING", "payment_mode": "STRING", "contact_id": "STRING",
            "contact_name": "STRING", "currency_code": "STRING", "created_at": "TIMESTAMP",
        },
    },
    "fact_sales_orders": {"partition_col": "date", "source": "sales_orders", "schema": dict(_ORDER_SCHEMA)},
    "fact_purchase_orders": {"partition_col": "date", "source": "purchase_orders", "schema": dict(_ORDER_SCHEMA)},
    "fact_quotes": {"partition_col": "date", "source": "quotes", "schema": dict(_ORDER_SCHEMA)},
}


def all_table_schemas() -> dict[str, dict[str, str]]:
    """Every warehouse table -> its ``{column: BQ type}`` schema.

    The single source for **provisioning** (create dataset + tables): the
    generic header facts (``FACTS``), the line-level sales table
    (``INVOICE_LINES``), and the derived/enriched tables (``DERIVED_TABLES``).
    """
    out: dict[str, dict[str, str]] = {t: cfg["schema"] for t, cfg in FACTS.items()}
    out[INVOICE_LINES["table"]] = INVOICE_LINES["schema"]
    for t, cfg in DERIVED_TABLES.items():
        out[t] = cfg["schema"]
    return out


def partition_col(table: str) -> str | None:
    """The DATE/TIMESTAMP partition column for ``table`` (or None if unpartitioned)."""
    if table in FACTS:
        return FACTS[table]["partition_col"]
    if table == INVOICE_LINES["table"]:
        return INVOICE_LINES["partition_col"]
    if table in DERIVED_TABLES:
        return DERIVED_TABLES[table]["partition_col"]
    return None
