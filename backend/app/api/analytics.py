"""BI analytics layer (Pool 4.6) — saved analyses + pivot, reads from the
BigQuery warehouse (NOT Firestore OLTP).

This is the *analytics* counterpart to ``api/dashboards.py`` (which folds OLTP
collections at request time). Here a user picks a fact table, measures and
dimensions; the request is compiled into a **parameterized** BigQuery query and
run against the warehouse defined in ``app.analytics.warehouse_schema``.

Design (mirrors ``app/services/rum_ingest.py``):
  - Lazy ``from google.cloud import bigquery`` — the SDK is optional in dev.
  - Graceful degradation: when ``ANALYTICS_BQ_DATASET`` is unset (warehouse not
    wired / CDC not live yet) ``_run_warehouse`` returns ``None`` and the
    endpoint falls back to a minimal OLTP response that never errors. This lets
    the feature ship behind a flag before the warehouse exists.

Injection safety:
  - Only identifiers validated against the ``_FACTS`` whitelist are ever placed
    into the SQL string (measures, dimensions, the date column, the table name
    via ``warehouse_schema.table_ref``).
  - EVERY user-supplied value (org_id, date_from/to, filter values) is bound as
    a BigQuery ``ScalarQueryParameter`` (``@named``) — never string-formatted.
  - ``limit``/``order_dir`` are constrained by the pydantic model (int range /
    Literal) and ``order_by`` must itself be a whitelisted column.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from app.analytics import warehouse_schema
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

log = logging.getLogger("analytics")

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# Required permission. ``reports.read`` is an existing code (the ``reports``
# module × the ``read`` action — see app/services/permissions.py); we reuse it
# rather than minting a new analytics-specific permission.
_PERM_READ = "reports.read"
_PERM_WRITE = "reports.write"  # existing meta-permission for saving analyses


# ── Fact whitelist ───────────────────────────────────────────────────────────
# fact -> {measures, dimensions, date_col}. Every SQL fragment below references
# ONLY columns declared in ``warehouse_schema.FACTS[<fact>]["schema"]`` — these
# two maps are kept in lock-step. ``measures``/``dimensions`` map a stable
# client key to a SQL expression; ``date_col`` is the column used for the
# date_from/date_to range filter (a real column in the schema).
_FACTS: dict[str, dict[str, Any]] = {
    "fact_invoices": {
        # schema cols: total, balance_due, tax_amount, status, contact_name,
        # branch_id, date, created_at
        "measures": {
            "total": "SUM(total)",
            "balance_due": "SUM(balance_due)",
            "tax": "SUM(tax_amount)",
            "count": "COUNT(1)",
            "avg": "AVG(total)",
        },
        "dimensions": {
            "month": "FORMAT_DATE('%Y-%m', date)",
            "day": "date",
            "status": "status",
            "contact_name": "contact_name",
            "branch_id": "branch_id",
        },
        "date_col": "date",
    },
    "fact_bills": {
        # schema cols: total, balance_due, status, vendor_name, date, created_at
        # (NOTE: fact_bills has no tax_amount column -> no tax measure.)
        "measures": {
            "total": "SUM(total)",
            "balance_due": "SUM(balance_due)",
            "count": "COUNT(1)",
            "avg": "AVG(total)",
        },
        "dimensions": {
            "month": "FORMAT_DATE('%Y-%m', date)",
            "day": "date",
            "status": "status",
            "vendor_name": "vendor_name",
        },
        "date_col": "date",
    },
    "fact_pos_orders": {
        # schema cols: total, register_id, cashier_id, created_at, date
        "measures": {
            "total": "SUM(total)",
            "count": "COUNT(1)",
            "avg_basket": "AVG(total)",
        },
        "dimensions": {
            "month": "FORMAT_DATE('%Y-%m', date)",
            "day": "date",
            "register_id": "register_id",
            "cashier_id": "cashier_id",
        },
        "date_col": "date",
    },
    # ── General Ledger (the complete financial truth) ────────────────────────
    # Every posted invoice/bill/payment/COGS/manual entry is a row here. With
    # account_type you read revenue (income: credit side), expense (debit side),
    # and balances (net = debit - credit). Excludes void entries (sync-side).
    "fact_je_lines": {
        # schema cols: account_id, account_name, account_type, debit, credit,
        # net, date, status, source_type, company_id, description, contact_id
        "measures": {
            "debit": "SUM(debit)",
            "credit": "SUM(credit)",
            "net": "SUM(net)",          # debit - credit (signed balance amount)
            "count": "COUNT(1)",
        },
        "dimensions": {
            "month": "FORMAT_DATE('%Y-%m', date)",
            "day": "date",
            "account_name": "account_name",
            "account_type": "account_type",
            "status": "status",
            "source_type": "source_type",
            "company_id": "company_id",
        },
        "date_col": "date",
    },
    # ── Expenses (with the expense account as the 'category') ─────────────────
    "fact_expenses": {
        # schema cols: amount, tax_amount, account_name, account_type, status, date
        "measures": {
            "total": "SUM(amount)",
            "tax": "SUM(tax_amount)",
            "count": "COUNT(1)",
            "avg": "AVG(amount)",
        },
        "dimensions": {
            "month": "FORMAT_DATE('%Y-%m', date)",
            "day": "date",
            "account_name": "account_name",   # the expense category
            "account_type": "account_type",
            "status": "status",
        },
        "date_col": "date",
    },
    # ── Payments / cash-flow (received + made, merged by direction) ───────────
    "fact_payments": {
        # schema cols: amount, direction, payment_mode, contact_name, date
        "measures": {
            "total": "SUM(amount)",
            "count": "COUNT(1)",
            "avg": "AVG(amount)",
        },
        "dimensions": {
            "month": "FORMAT_DATE('%Y-%m', date)",
            "day": "date",
            "direction": "direction",        # 'received' (in) | 'made' (out)
            "payment_mode": "payment_mode",
            "contact_name": "contact_name",
        },
        "date_col": "date",
    },
    # ── Sales orders / Purchase orders / Quotes (shared header shape) ─────────
    "fact_sales_orders": {
        "measures": {
            "total": "SUM(total)", "subtotal": "SUM(subtotal)",
            "tax": "SUM(tax_amount)", "count": "COUNT(1)", "avg": "AVG(total)",
        },
        "dimensions": {
            "month": "FORMAT_DATE('%Y-%m', date)", "day": "date",
            "status": "status", "contact_name": "contact_name",
        },
        "date_col": "date",
    },
    "fact_purchase_orders": {
        "measures": {
            "total": "SUM(total)", "subtotal": "SUM(subtotal)",
            "tax": "SUM(tax_amount)", "count": "COUNT(1)", "avg": "AVG(total)",
        },
        "dimensions": {
            "month": "FORMAT_DATE('%Y-%m', date)", "day": "date",
            "status": "status", "contact_name": "contact_name",
        },
        "date_col": "date",
    },
    "fact_quotes": {
        "measures": {
            "total": "SUM(total)", "subtotal": "SUM(subtotal)",
            "tax": "SUM(tax_amount)", "count": "COUNT(1)", "avg": "AVG(total)",
        },
        "dimensions": {
            "month": "FORMAT_DATE('%Y-%m', date)", "day": "date",
            "status": "status", "contact_name": "contact_name",
        },
        "date_col": "date",
    },
    # ── Line-level sales (per-item revenue & quantity) ───────────────────────
    "fact_invoice_lines": {
        # schema cols: item_id, description, quantity, unit_price, line_total, date, status
        "measures": {
            "revenue": "SUM(line_total)",
            "quantity": "SUM(quantity)",
            "count": "COUNT(1)",
            "avg_price": "AVG(unit_price)",
        },
        "dimensions": {
            "month": "FORMAT_DATE('%Y-%m', date)",
            "day": "date",
            "description": "description",   # item/line label
            "item_id": "item_id",
            "status": "status",
        },
        "date_col": "date",
    },
    # ── Master data (no time axis -> date_col = None) ────────────────────────
    "fact_items": {
        # schema cols: name, sku, stock_on_hand, reorder_point, cost_price,
        # selling_price, track_inventory
        "measures": {
            "count": "COUNT(1)",
            "total_stock": "SUM(stock_on_hand)",
            "stock_value": "SUM(stock_on_hand * cost_price)",
            "avg_cost": "AVG(cost_price)",
            "avg_price": "AVG(selling_price)",
        },
        "dimensions": {
            "name": "name",
            "sku": "sku",
            "track_inventory": "track_inventory",
        },
        "date_col": None,
    },
    "fact_contacts": {
        # schema cols: name, contact_type, currency_code, opening_balance, is_active
        "measures": {
            "count": "COUNT(1)",
            "opening_balance": "SUM(opening_balance)",
        },
        "dimensions": {
            "contact_type": "contact_type",   # 'customer' | 'vendor'
            "currency_code": "currency_code",
            "is_active": "is_active",
        },
        "date_col": None,
    },
    "fact_accounts": {
        # schema cols: code, name, account_type, balance, is_active
        "measures": {
            "count": "COUNT(1)",
            "balance": "SUM(balance)",
        },
        "dimensions": {
            "name": "name",
            "account_type": "account_type",
            "is_active": "is_active",
        },
        "date_col": None,
    },
}

# OLTP fallback: fact -> the Firestore collection it shadows (used only to label
# the stopgap response; we deliberately do NOT re-implement the OLTP fold here).
_FACT_COLLECTION = {
    "fact_invoices": "invoices",
    "fact_bills": "bills",
    "fact_pos_orders": "pos_orders",
}


# ── Models ───────────────────────────────────────────────────────────────────

class AnalysisDef(BaseModel):
    """An ad-hoc / saved analysis: what to aggregate and how to slice it."""

    fact: str
    measures: list[str] = Field(..., min_length=1)
    dimensions: list[str] = Field(default_factory=list)   # group-by (pivot rows/cols)
    filters: dict[str, Any] = Field(default_factory=dict)  # {dimension: value}
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    order_by: Optional[str] = None
    order_dir: Literal["ASC", "DESC"] = "DESC"
    limit: int = Field(500, ge=1, le=50_000)


class SavedAnalysisCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    definition: AnalysisDef
    is_shared: bool = False


class _AnalysisRepo(BaseRepository):
    collection_name = "saved_analyses"


# ── Validation + SQL builder (injection-safe) ────────────────────────────────

def _validate(defn: AnalysisDef) -> dict[str, Any]:
    """Reject anything not on the whitelist. Returns the fact config on success.

    Raises ``HTTPException(400)`` for an unknown fact/measure/dimension/filter or
    an ``order_by`` that is not itself a whitelisted column.
    """
    fact = _FACTS.get(defn.fact)
    if not fact:
        raise HTTPException(400, f"Unknown fact table: {defn.fact}")
    for m in defn.measures:
        if m not in fact["measures"]:
            raise HTTPException(400, f"Unknown measure: {m}")
    for d in defn.dimensions:
        if d not in fact["dimensions"]:
            raise HTTPException(400, f"Unknown dimension: {d}")
    for fk in defn.filters:
        if fk not in fact["dimensions"]:
            raise HTTPException(400, f"Unknown filter dimension: {fk}")
    if defn.order_by is not None and (
        defn.order_by not in fact["measures"] and defn.order_by not in fact["dimensions"]
    ):
        raise HTTPException(400, f"Unknown order_by column: {defn.order_by}")
    return fact


def _bq_param(bigquery, name: str, value: Any):
    """Build a ScalarQueryParameter with a type inferred from the Python value.

    bool is checked before int because ``bool`` is a subclass of ``int``.
    """
    if isinstance(value, bool):
        bq_type = "BOOL"
    elif isinstance(value, int):
        bq_type = "INT64"
    elif isinstance(value, float):
        bq_type = "FLOAT64"
    else:
        bq_type = "STRING"
        value = str(value)
    return bigquery.ScalarQueryParameter(name, bq_type, value)


def _build_sql(defn: AnalysisDef, fact: dict, org_id: str) -> tuple[str, dict[str, Any]]:
    """Compile the analysis into ``(sql, params)``.

    The table name comes from ``warehouse_schema.table_ref`` and every column
    fragment from the validated ``fact`` config; all user *values* are returned
    in ``params`` for binding as query parameters (never interpolated).
    """
    table = f"`{warehouse_schema.table_ref(defn.fact)}`"

    select = [f"{fact['dimensions'][d]} AS {d}" for d in defn.dimensions]
    select += [f"{fact['measures'][m]} AS {m}" for m in defn.measures]

    where = ["org_id = @org_id"]
    params: dict[str, Any] = {"org_id": org_id}

    # Master-data facts (items / contacts / accounts) have no time axis -> a
    # None date_col simply means date_from/date_to are ignored (no bogus column).
    date_col = fact.get("date_col")
    if date_col and defn.date_from:
        where.append(f"{date_col} >= @date_from")
        params["date_from"] = defn.date_from
    if date_col and defn.date_to:
        where.append(f"{date_col} <= @date_to")
        params["date_to"] = defn.date_to

    for i, (fk, fv) in enumerate(defn.filters.items()):
        pname = f"f{i}"
        where.append(f"{fact['dimensions'][fk]} = @{pname}")
        params[pname] = fv

    sql = f"SELECT {', '.join(select)} FROM {table} WHERE {' AND '.join(where)}"

    if defn.dimensions:
        group = ", ".join(str(i + 1) for i in range(len(defn.dimensions)))
        sql += f" GROUP BY {group}"

    if defn.order_by:  # already validated to be a whitelisted column
        sql += f" ORDER BY {defn.order_by} {defn.order_dir}"

    sql += f" LIMIT {int(defn.limit)}"
    return sql, params


# ── Execution ────────────────────────────────────────────────────────────────

def _run_warehouse(defn: AnalysisDef, fact: dict, org_id: str) -> Optional[list[dict]]:
    """Run the analysis against BigQuery.

    Returns the rows, or ``None`` to signal the caller to fall back to OLTP:
      - ``ANALYTICS_BQ_DATASET`` unset -> warehouse not configured -> None.
      - ``google-cloud-bigquery`` not importable -> None.
    A query error propagates (it is a real failure, not "warehouse absent").
    """
    if not os.environ.get("ANALYTICS_BQ_DATASET"):
        return None  # warehouse not wired -> OLTP fallback
    try:
        from google.cloud import bigquery  # lazy, like rum_ingest.py
    except Exception:  # pragma: no cover - lib optional in dev
        log.warning("analytics.bigquery_lib_missing — falling back to OLTP")
        return None

    sql, params = _build_sql(defn, fact, org_id)
    client = bigquery.Client(project=warehouse_schema.project_id())
    job_config = bigquery.QueryJobConfig(
        query_parameters=[_bq_param(bigquery, k, v) for k, v in params.items()]
    )
    rows = client.query(sql, job_config=job_config).result()
    return [dict(r) for r in rows]


def _run_oltp(defn: AnalysisDef, fact: dict, org_id: str) -> list[dict]:
    """Minimal OLTP fallback used when the warehouse is not configured.

    Intentionally returns no rows rather than re-folding Firestore here: the
    OLTP analytics path is owned by ``api/dashboards.py``/``api/reports.py``.
    The point of this stub is that ``/query`` never errors when the warehouse is
    off — it returns an empty, clearly-labelled result so the UI can degrade.
    """
    return []


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/query", dependencies=[Depends(require_perm(_PERM_READ))])
def run_query(defn: AnalysisDef, user: dict = Depends(get_current_user)):
    """Execute an ad-hoc analysis. Warehouse-first, OLTP-fallback.

    Returns ``{rows, row_count, source}`` where ``source`` is ``"warehouse"``
    when the query ran against BigQuery, else ``"oltp"``.
    """
    fact = _validate(defn)
    rows = _run_warehouse(defn, fact, user["org_id"])
    if rows is None:
        rows = _run_oltp(defn, fact, user["org_id"])
        source = "oltp"
    else:
        source = "warehouse"
    return {"rows": rows, "row_count": len(rows), "source": source}


@router.post("/saved", status_code=201, dependencies=[Depends(require_perm(_PERM_WRITE))])
def create_saved(body: SavedAnalysisCreate, user: dict = Depends(get_current_user)):
    """Persist an analysis definition for reuse."""
    _validate(body.definition)  # never save an invalid definition
    doc = {
        "org_id": user["org_id"],
        "owner_user_id": user.get("id"),
        "name": body.name,
        "definition": body.definition.model_dump(),
        "is_shared": bool(body.is_shared),
        "created_at": datetime.utcnow(),
    }
    created = _AnalysisRepo(user["org_id"]).create(doc)
    return {"data": created}


@router.get("/saved", dependencies=[Depends(require_perm(_PERM_READ))])
def list_saved(user: dict = Depends(get_current_user)):
    """List analyses owned by the caller or shared within the org."""
    repo = _AnalysisRepo(user["org_id"])
    items, _ = repo.list(order_by="created_at", order_dir="DESCENDING", limit=500)
    uid = user.get("id")
    visible = [a for a in items if a.get("owner_user_id") == uid or a.get("is_shared")]
    return {"data": visible}


@router.delete("/saved/{analysis_id}", dependencies=[Depends(require_perm(_PERM_WRITE))])
def delete_saved(
    analysis_id: str = Path(...),
    user: dict = Depends(get_current_user),
):
    """Delete a saved analysis (owner only)."""
    repo = _AnalysisRepo(user["org_id"])
    existing = repo.get(analysis_id)
    if not existing:
        raise HTTPException(404, "Saved analysis not found")
    if existing.get("owner_user_id") not in (None, user.get("id")):
        raise HTTPException(403, "Not the owner of this analysis")
    repo.delete(analysis_id)
    return {"success": True}


@router.get("/facts", dependencies=[Depends(require_perm(_PERM_READ))])
def list_facts(user: dict = Depends(get_current_user)):
    """Return the fact/measure/dimension whitelist for the analysis builder UI."""
    out: dict[str, Any] = {}
    for fact, cfg in _FACTS.items():
        out[fact] = {
            "measures": sorted(cfg["measures"].keys()),
            "dimensions": sorted(cfg["dimensions"].keys()),
            "date_col": cfg["date_col"],
        }
    return {"facts": out}


ALL_ROUTERS = [router]
