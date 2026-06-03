## ١) شیکاری · EPM · BI · UX/مۆبایل/Accessibility

> **ئاستی ئەم بەشە:** ڕێنمایی پێداچوونەوەکراو (reviewed guide) — **جێبەجێ نەکراوە**. هەموو کۆدی ناو ئەم بەشە copy-paste-ـی ئامادەیە بەڵام دەبێت لەسەر Windows (`npx tsc`, `npm run build`, `pytest`) پشتڕاست بکرێت پێش commit. هیچ گۆڕانکارییەک نەکراوە لە کاتی نووسینی ئەم بەشە.

ئەم بەشە شیکاریی دۆخی ئێستای BI/dashboards/EPM-ـی سیستەمەکە دەکات (بەپێی کۆدی ڕاستەقینە)، دواتر ڕێگەی بەرزکردنەوەی بۆ ئاستی world-class دادەنێت: BI layer-ـی ڕاستەقینە لەسەر warehouse، بودجەی driver-based + scenario، سینکی real-time (CDC)، و UX/مۆبایل/Accessibility.

---

### 1.1 دۆخی ئێستا — چی هەیە بەرامبەر چی نییە (grounded in code)

| ناوچە | چی هەیە (فایلی ڕاستەقینە) | کێشەی بنەڕەتی |
|--------|--------------------------|----------------|
| ڕاپۆرتە دارایییەکان | `backend/app/api/reports.py` — ٢٠+ ئەندپۆینتی فیکس (trial-balance, P&L, balance-sheet, AR/AP aging, general-ledger, partner-ledger, sales-by-customer/item, cash-flow, budget-vs-actual, project-profitability, top-customers/items, inventory-valuation) | هەموویان **in-memory fold** دەکەن لەسەر `collect_stream(..., max_docs=LIST_HARD_CAP)` کە `LIST_HARD_CAP = 10_000` (`backend/app/services/firestore_resilience.py:12`). هەر داواکارییەک تەواوی کۆلێکشن لە OLTP (Firestore) دەخوێنێتەوە و لە Python-ـدا کۆدەکاتەوە — **سنوور ١٠k دۆکیومێنت**، بێ pre-aggregation، بێ caching، فشار لەسەر OLTP. |
| Dashboards | `backend/app/api/dashboards.py` — widget builder (kpi/line/bar/pie/table/progress/iframe)، `DashboardRepository`، share/clone، `widget-catalog` بە ١٥ data-source-ـی hardcode (`_execute_data_source`) | هەر widget بە live query لەسەر repo کاردەکات (`InvoiceRepository`, `POSOrderRepository`...) — هەمان فشاری OLTP. data-source-ـەکان **enum-ـی داخراون** لە کۆد؛ بەکارهێنەر ناتوانێت metric-ـی نوێ دروست بکات بێ deploy. `set-default` تەنها placeholder-ـە (`# For now, just return success`). |
| Custom reports | `backend/app/api/custom_reports.py` — `FIELD_MAPS` بۆ ٦ source، filter/sort/group، `run` بە `collect_stream(max_docs=10000)` | بێ pivot/OLAP، بێ join، بێ cross-source. group_by تەنها لە schema-دایە بەڵام لە `run_custom_report`-ـدا **جێبەجێ ناکرێت** (تەنها project + sort + sum/avg). هەمان ١٠k cap. |
| Scheduled reports | `backend/app/api/scheduled_reports.py` + cron-ـی ڕاستەقینە لە `backend/app/services/scheduler.py:440` (`_job_scheduled_reports`) | کاردەکات (email HTML + APScheduler)، بەڵام `_generate_report_html` تەنها `list(limit=1000)` کۆدەکاتەوە — **سنووری ١٠٠٠**، بێ PDF/xlsx-ـی ڕاستەقینە (تەنها HTML با `format` فیلد هەبێت). |
| Budgets / EPM | `backend/app/api/budgets.py` — budget + budget-lines (account×year×month×amount) + `/variance` | تەنها **single-version، flat، account-level**. بێ driver، بێ scenario، بێ rolling forecast، بێ workflow-ـی approval. variance بە full-scan-ـی journal (`collect_stream(max_docs=5000)`) per line — O(lines × journals). |
| Cashflow forecast | `backend/app/api/cashflow_forecast.py` — `/forecast/{days}` | naive: starting-cash = کۆی balance-ـی بانک، inflow/outflow = invoice/bill-ـی نەدراو بەپێی `due_date`. بێ scenario، بێ recurring، بێ probability-weighting، بێ ML. `collect_stream(max_docs=5000)`. |
| Charts (frontend) | `frontend/src/design-system/TrendChart.tsx` (inline SVG line+area، token-driven `var(--accent-500)`)، `MiniSparkline.tsx` (inline SVG polyline)، `ChartCard.tsx` (recharts wrapper — `recharts@^3.8.1` لە `package.json`، skeleton + error + hover) | TrendChart/Sparkline بێ external dep، بەڵام **بێ tooltip، بێ axis، بێ legend، بێ zoom/brush**. ChartCard recharts-ـی hosts دەکات بەڵام هیچ shared chart primitive-ـێک (مثلا `<RevenueAreaChart/>`) نییە — هەر پەڕە چارتی خۆی دروستدەکات. |
| Embedded analytics | `frontend/src/pages/reports/EmbeddedAnalyticsDashboard.tsx` (هەیە) | پێویستی پشکنین، بەڵام هیچ warehouse-backed BI-ـیەک ناخوێنێتەوە. |
| Role dashboards | `frontend/src/pages/dashboard/dashboardLayouts.ts` — `DASHBOARD_LAYOUTS: Record<RoleThemeId, DashboardLayoutConfig>` (executive/finance/sales/purchase/inventory/pos/hr/...) + `getDashboardLayout()` | **بنەڕەتی باشە** — KPI-ـی جیاواز بۆ هەر ڕۆڵ. بەڵام static config-ـە، نە warehouse-driven. |
| Warehouse / CDC | **نییە** بۆ analytics. تەنها BigQuery-ـی ڕاستەقینە لە `backend/app/services/rum_ingest.py` (RUM vitals → `insert_rows_json`، env `RUM_BIGQUERY_DATASET`، lazy `from google.cloud import bigquery`، `asyncio.to_thread`) + `sql/observability/*.sql` | پاتێرنی streaming-insert-ـی BigQuery پێشتر **پرووف کراوە** لە RUM. هیچ business-data CDC (Firestore → BQ) نییە. |
| Mobile native | `mobile/src/bridge/printer.ts` (BLE ESC/POS، per-dialect MTU، WebPrinter fallback)، `scanner.ts` (ML Kit، web ZXing worker fallback)، هەروەها `push.ts`, `nfc.ts`, `app-update.ts` | bridges-ـی پڕۆداکشن-گرەید بۆ POS هەیە. بەڵام هیچ analytics/dashboard-ـی native-optimized نییە؛ مۆبایل هەمان web dashboard-ـی قورس render دەکات. |
| Feature flags | `frontend/src/hooks/useFeatureFlag.ts` (server-evaluated `is_active`، off-by-default on error) + `api/featureFlags.ts` | ئامادە بۆ rollout-ـی هەر فیچەرێکی نوێ. |

**کۆتاکردن:** سیستەمەکە **report-centric** ـە (ئەندپۆینتی فیکس کە OLTP fold دەکەن)، نە **analytics-centric** (warehouse + saved analysis + pivot). ئەمە لە ١٠k دۆکیومێنت تێدەپەڕێت و لە scale-ـدا OLTP-ـەکە دەکوژێت.

---

### 1.2 BI Layer ڕاستەقینە — لە fixed endpoints بۆ saved analyses + pivot لەسەر warehouse

**ئامانج:** بەشێکی نوێی `analytics` کە لە **warehouse (BigQuery)** دەخوێنێتەوە نەک Firestore. ٣ توخم: (الف) `AnalysisRepository` (saved analysis — کاربەر metric/dimension/filter هەڵدەبژێرێت)، (ب) `warehouse query executor` (SQL-ـی پارامەتەری دژی BQ)، (ج) pivot/OLAP اجرا. ئەمە جیاوازە لە `dashboards.py`-ـی ئێستا (کە OLTP query دەکات) — analytics layer-ـە کە لەسەر pre-aggregated/raw warehouse table کاردەکات.

**جێی دانان — فایلی نوێ:** `backend/app/api/analytics.py`.

```python
# backend/app/api/analytics.py  (NEW)
"""BI analytics layer — saved analyses + pivot, reads from BigQuery warehouse
(NOT Firestore OLTP). Falls back to OLTP fold when warehouse is not configured,
so it is safe to ship behind a flag before CDC is live.

Warehouse env: ANALYTICS_BQ_DATASET (e.g. "myproj.zoho_warehouse").
Pattern mirrors backend/app/services/rum_ingest.py (lazy bigquery import,
asyncio.to_thread offload, graceful degradation when the lib/env is absent).
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# Whitelisted fact tables + their grain. NEVER interpolate raw user strings into
# SQL — only identifiers validated against these maps may reach the query string.
_FACTS: dict[str, dict[str, Any]] = {
    "fact_invoices": {
        "measures": {"total": "SUM(total)", "balance_due": "SUM(balance_due)",
                     "count": "COUNT(1)", "tax": "SUM(tax_amount)"},
        "dimensions": {"month": "FORMAT_DATE('%Y-%m', date)", "status": "status",
                       "contact_name": "contact_name", "branch_id": "branch_id"},
        "date_col": "date",
    },
    "fact_bills": {
        "measures": {"total": "SUM(total)", "balance_due": "SUM(balance_due)", "count": "COUNT(1)"},
        "dimensions": {"month": "FORMAT_DATE('%Y-%m', date)", "status": "status",
                       "vendor_name": "vendor_name"},
        "date_col": "date",
    },
    "fact_pos_orders": {
        "measures": {"total": "SUM(total)", "count": "COUNT(1)", "avg_basket": "AVG(total)"},
        "dimensions": {"day": "DATE(created_at)", "register_id": "register_id",
                       "cashier_id": "cashier_id"},
        "date_col": "created_at",
    },
}


class AnalysisDef(BaseModel):
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


def _validate(defn: AnalysisDef) -> dict[str, Any]:
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
    return fact


def _build_sql(defn: AnalysisDef, fact: dict, dataset: str, org_id: str):
    """Returns (sql, params). All user values go through QueryParameters —
    never string-interpolated — so this is injection-safe."""
    table = f"`{dataset}.{defn.fact}`"
    sel = [f"{fact['dimensions'][d]} AS {d}" for d in defn.dimensions]
    sel += [f"{fact['measures'][m]} AS {m}" for m in defn.measures]
    where = ["org_id = @org_id"]
    params: dict[str, Any] = {"org_id": org_id}
    dc = fact["date_col"]
    if defn.date_from:
        where.append(f"{dc} >= @date_from"); params["date_from"] = defn.date_from
    if defn.date_to:
        where.append(f"{dc} <= @date_to"); params["date_to"] = defn.date_to
    for i, (fk, fv) in enumerate(defn.filters.items()):
        where.append(f"{fact['dimensions'][fk]} = @f{i}"); params[f"f{i}"] = fv
    group = ", ".join(str(i + 1) for i in range(len(defn.dimensions)))
    sql = f"SELECT {', '.join(sel)} FROM {table} WHERE {' AND '.join(where)}"
    if defn.dimensions:
        sql += f" GROUP BY {group}"
    if defn.order_by and (defn.order_by in fact["measures"] or defn.order_by in fact["dimensions"]):
        sql += f" ORDER BY {defn.order_by} {defn.order_dir}"
    sql += f" LIMIT {defn.limit}"
    return sql, params


def _run_warehouse(defn: AnalysisDef, fact: dict, org_id: str) -> Optional[list[dict]]:
    dataset = os.environ.get("ANALYTICS_BQ_DATASET")
    if not dataset:
        return None  # signal: fall back to OLTP
    try:
        from google.cloud import bigquery  # lazy, like rum_ingest.py
    except Exception:
        return None
    sql, params = _build_sql(defn, fact, dataset, org_id)
    client = bigquery.Client()
    job_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter(k, "STRING" if isinstance(v, str) else "INT64", v)
        for k, v in params.items()
    ])
    rows = client.query(sql, job_config=job_config).result()
    return [dict(r) for r in rows]


@router.post("/run", dependencies=[Depends(require_perm("reports.read"))])
def run_analysis(defn: AnalysisDef, user: dict = Depends(get_current_user)):
    """Execute an ad-hoc analysis. Warehouse-first; OLTP fold fallback."""
    fact = _validate(defn)
    rows = _run_warehouse(defn, fact, user["org_id"])
    if rows is None:
        # Graceful degradation: reuse the existing OLTP fold so the feature
        # works before CDC is live. Kept intentionally simple (single fact).
        rows = _oltp_fallback(defn, fact, user["org_id"])
    return {"rows": rows, "row_count": len(rows), "source": "warehouse" if os.environ.get("ANALYTICS_BQ_DATASET") else "oltp"}


def _oltp_fallback(defn: AnalysisDef, fact: dict, org_id: str) -> list[dict]:
    # Minimal in-process group-by over the existing repos. This is the SAME
    # 10k-cap fold that reports.py uses today — acceptable only as a stopgap.
    from collections import defaultdict
    from app.services.report_streams import collect_stream
    repo_map = {"fact_invoices": "app.firestore.invoices.InvoiceRepository",
                "fact_bills": "app.firestore.bills.BillRepository",
                "fact_pos_orders": "app.firestore.pos.POSOrderRepository"}
    mod, cls = repo_map[defn.fact].rsplit(".", 1)
    import importlib
    Repo = getattr(importlib.import_module(mod), cls)
    docs = collect_stream(Repo(org_id))
    agg: dict = defaultdict(lambda: defaultdict(float))
    for d in docs:
        key = tuple(str(d.get(dim, "")) [:10] if dim in ("month", "day") else d.get(dim, "") for dim in defn.dimensions) or ("__all__",)
        for m in defn.measures:
            agg[key]["count" if m == "count" else m] += (1 if m == "count" else float(d.get(m, 0) or 0))
    out = []
    for key, vals in agg.items():
        row = {dim: key[i] for i, dim in enumerate(defn.dimensions)}
        row.update({k: round(v, 2) for k, v in vals.items()})
        out.append(row)
    return out[: defn.limit]


@router.post("", status_code=201, dependencies=[Depends(require_perm("reports.write"))])
def save_analysis(body: SavedAnalysisCreate, user: dict = Depends(get_current_user)):
    _validate(body.definition)
    doc = {"id": str(uuid.uuid4()), "org_id": user["org_id"], "owner_user_id": user["id"],
           "name": body.name, "definition": body.definition.model_dump(),
           "is_shared": body.is_shared, "created_at": datetime.utcnow()}
    _AnalysisRepo(user["org_id"]).create(doc)
    return {"data": doc}


@router.get("", dependencies=[Depends(require_perm("reports.read"))])
def list_analyses(user: dict = Depends(get_current_user)):
    repo = _AnalysisRepo(user["org_id"])
    items, _ = repo.list(limit=500)
    return {"data": [a for a in items if a.get("owner_user_id") == user["id"] or a.get("is_shared")]}


ALL_ROUTERS = [router]
```

**تۆمارکردن لە `backend/app/main.py`** (لەسەر هێڵی ~٤١٠، تەنیشت `analytic`/`budgets`):

```python
# backend/app/main.py — لەناو import block (هێڵی ~85)
from app.api import (
    analytic, analytics, budgets, cashflow_forecast, ...   # ← analytics زیادکرا
)
# ... لەناو router-registration block (هێڵی ~410)
app.include_router(analytics.router)   # ← NEW (BI layer)
```

**Embedded dashboard (BI) — frontend:** drop-in بۆ `frontend/src/pages/reports/EmbeddedAnalyticsDashboard.tsx` — analysis picker + pivot table + ChartCard. (بەکاردەهێنێت `ChartCard` + recharts-ـی بەردەست.)

```tsx
// frontend/src/pages/reports/EmbeddedAnalyticsDashboard.tsx  (یان کۆمپۆنێنتی نوێ)
import { useState } from 'react';
import { Select, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from '../../design-system/ChartCard';
import DataTable from '../../design-system/DataTable';
import { api } from '../../api';

const FACTS = ['fact_invoices', 'fact_bills', 'fact_pos_orders'] as const;

export default function EmbeddedAnalyticsDashboard() {
  const [fact, setFact] = useState<(typeof FACTS)[number]>('fact_invoices');
  const defn = { fact, measures: ['total'], dimensions: ['month'], order_by: 'month', order_dir: 'ASC' as const };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['analysis', fact],
    queryFn: () => api.post('/api/analytics/run', defn).then((r) => r.data),
  });
  const rows = data?.rows ?? [];
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Select value={fact} onChange={setFact}
        options={FACTS.map((f) => ({ value: f, label: f }))} style={{ width: 240 }} />
      <ChartCard title="گەشەی کاتی" loading={isLoading} error={error ? String(error) : null} onRetry={refetch}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <XAxis dataKey="month" /><YAxis /><Tooltip />
            <Bar dataKey="total" fill="var(--accent-500)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <DataTable rowKey="month" dataSource={rows}
        columns={[{ title: 'مانگ', dataIndex: 'month' }, { title: 'کۆ', dataIndex: 'total' }]} />
    </Space>
  );
}
```

---

### 1.3 Real-time analytics — CDC لە Firestore بۆ BigQuery (HTAP pattern)

**کێشە:** هەموو ڕاپۆرت OLTP-ـەکە (Firestore) دەخوێنێتەوە و ١٠k cap-ـی هەیە. **چارەسەر:** CDC pipeline کە گۆڕانکارییەکانی Firestore دەنێرێت بۆ BigQuery، analytics لەوێ کاردەکات (HTAP: OLTP بۆ نووسین، warehouse بۆ خوێندنەوەی شیکاری).

**ڕێگەی پێشنیارکراو (٢ option):**

1. **بێ کۆد — managed (پێشنیار بۆ launch):** Firebase Extension **"Stream Firestore to BigQuery"** (`firestore-bigquery-export`) بۆ هەر کۆلێکشنی فاکت (`invoices`, `bills`, `pos_orders`, `payments`, `journal_lines`). دەنووسێت بۆ `*_raw_changelog` table؛ دواتر scheduled query بۆ `fact_*` view. سفر کۆدی backend.

2. **کۆد — Cloud Function trigger (کۆنترۆڵی زیاتر):** Firestore `onWrite` → `insert_rows_json` (هەمان پاتێرنی `rum_ingest.py`). نموونەی mapper:

```python
# backend/app/services/warehouse_cdc.py  (NEW) — fact-row mapper, reused by
# both the Cloud Function and a one-time backfill script.
from __future__ import annotations
import os
from typing import Any, Optional


_FACT_TABLE = {"invoices": "fact_invoices", "bills": "fact_bills", "pos_orders": "fact_pos_orders"}


def to_fact_row(collection: str, org_id: str, doc: dict) -> Optional[dict]:
    """Map an OLTP doc to a flat warehouse fact row. Returns None to skip."""
    if collection == "invoices":
        return {"id": doc["id"], "org_id": org_id, "date": _d(doc.get("date")),
                "status": doc.get("status"), "contact_name": doc.get("contact_name"),
                "branch_id": doc.get("branch_id"), "total": float(doc.get("total") or 0),
                "balance_due": float(doc.get("balance_due") or 0),
                "tax_amount": float(doc.get("tax_amount") or 0), "_synced_at": _now()}
    if collection == "bills":
        return {"id": doc["id"], "org_id": org_id, "date": _d(doc.get("date")),
                "status": doc.get("status"), "vendor_name": doc.get("vendor_name"),
                "total": float(doc.get("total") or 0),
                "balance_due": float(doc.get("balance_due") or 0), "_synced_at": _now()}
    if collection == "pos_orders":
        return {"id": doc["id"], "org_id": org_id, "created_at": _d(doc.get("created_at")),
                "register_id": doc.get("register_id"), "cashier_id": doc.get("cashier_id"),
                "total": float(doc.get("total") or 0), "_synced_at": _now()}
    return None


def stream_fact(collection: str, org_id: str, doc: dict) -> None:
    """Best-effort streaming insert. Never raises into the caller (CDC must not
    break OLTP writes)."""
    dataset = os.environ.get("ANALYTICS_BQ_DATASET")
    if not dataset:
        return
    row = to_fact_row(collection, org_id, doc)
    if not row:
        return
    try:
        from google.cloud import bigquery
        client = bigquery.Client()
        client.insert_rows_json(f"{dataset}.{_FACT_TABLE[collection]}", [row])
    except Exception:  # noqa: BLE001 — CDC is fire-and-forget
        import logging; logging.getLogger("cdc").warning("cdc.insert_failed %s/%s", collection, doc.get("id"))


def _d(v: Any) -> Optional[str]:
    if not v: return None
    if isinstance(v, str): return v[:10]
    try: return v.strftime("%Y-%m-%d")
    except Exception: return str(v)[:10]


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(tz=timezone.utc).isoformat()
```

**Backfill (یەکجار):** سکریپتی `backend/scripts/warehouse_backfill.py` کە `collect_stream` بۆ هەر کۆلێکشن دەکات و `insert_rows_json` بە batch-ـی ٥٠٠ — بۆ پڕکردنەوەی warehouse لە داتای کۆن پێش چالاککردنی CDC.

**Freshness contract:** streaming-insert ~چەند چرکە latency-ـی هەیە؛ بۆ analytics ئەمە تەواوە. بۆ KPI-ـی "today" (POS sales today) دەکرێت hybrid بکرێت — warehouse بۆ مێژوو، OLTP counter (`get_counters` کە پێشتر لە `dashboards.py` بەکاردێت) بۆ ئەمڕۆ.

---

### 1.4 EPM — planning/budgeting (driver-based + scenario + rolling forecast)

**بنەما:** فراوانکردنی `budgets.py`-ـی ئێستا (single-version flat) بۆ multi-version + driver-based + scenario، بێ شکاندنی ئەندپۆینتە بەردەستەکان.

**گۆڕانکاریی schema (additive، backward-compatible) — `backend/app/firestore/budgets.py` model:**
- `budgets` کۆلێکشن: زیادکردنی `version: int = 1`، `scenario: str = "base"` (base/best/worst/custom)، `parent_version_id: Optional[str]` (بۆ "Save as new version")، `status` (draft/submitted/approved).
- کۆلێکشنی نوێ `budget_drivers`: `{ driver_id, name, base_value, growth_pct_monthly, applies_to_account_id }` — مثلا "headcount × avg_salary" یان "unit_sales × price".

**فایلی نوێ:** `backend/app/api/epm.py` (تەنیشت budgets، بەڵام بۆ driver/scenario/forecast جیا).

```python
# backend/app/api/epm.py  (NEW) — driver-based budgeting + scenario + rolling forecast
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.firestore.base import BaseRepository
from app.firestore.budgets import BudgetRepository, BudgetLineRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/epm", tags=["EPM"])


class Driver(BaseModel):
    name: str
    base_value: float
    growth_pct_monthly: float = 0.0       # compounding per month
    applies_to_account_id: str
    multiplier_account_id: Optional[str] = None  # e.g. price account


class _DriverRepo(BaseRepository):
    collection_name = "budget_drivers"


class ScenarioRequest(BaseModel):
    base_budget_id: str
    scenario: Literal["best", "worst", "custom"]
    revenue_delta_pct: float = 0.0        # apply to income accounts
    expense_delta_pct: float = 0.0        # apply to expense accounts
    name: str = Field(..., min_length=1)


@router.post("/drivers", status_code=201, dependencies=[Depends(require_perm("accounts.create"))])
def create_driver(d: Driver, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "org_id": user["org_id"], **d.model_dump(),
           "created_at": datetime.utcnow()}
    _DriverRepo(user["org_id"]).create(doc)
    return doc


@router.post("/budgets/{budget_id}/expand-drivers",
             dependencies=[Depends(require_perm("accounts.update"))])
def expand_drivers(budget_id: str, months: int = Query(12, ge=1, le=36),
                   user: dict = Depends(get_current_user)):
    """Generate budget lines from drivers: line[m] = base * (1+growth)^m,
    optionally × a multiplier driver. This is the heart of driver-based planning."""
    b = BudgetRepository(user["org_id"]).get(budget_id)
    if not b or b.get("org_id") != user["org_id"]:
        raise HTTPException(404, "بودجە نەدۆزرایەوە")
    drivers, _ = _DriverRepo(user["org_id"]).list(limit=500)
    line_repo = BudgetLineRepository(user["org_id"])
    year = b.get("fiscal_year", datetime.utcnow().year)
    created = 0
    for drv in drivers:
        for m in range(months):
            amount = drv["base_value"] * ((1 + drv.get("growth_pct_monthly", 0) / 100) ** m)
            line_repo.create({
                "id": str(uuid.uuid4()), "org_id": user["org_id"], "budget_id": budget_id,
                "account_id": drv["applies_to_account_id"], "period_year": year,
                "period_month": (m % 12) + 1, "amount": round(amount, 2),
                "driver_id": drv["id"], "created_at": datetime.utcnow()})
            created += 1
    return {"created": created, "budget_id": budget_id}


@router.post("/scenario", status_code=201, dependencies=[Depends(require_perm("accounts.create"))])
def create_scenario(req: ScenarioRequest, user: dict = Depends(get_current_user)):
    """Clone a base budget into a new scenario version with revenue/expense deltas.
    Multi-version: the clone gets version = max(existing)+1."""
    from app.services.report_queries import build_account_map
    base = BudgetRepository(user["org_id"]).get(req.base_budget_id)
    if not base:
        raise HTTPException(404, "بنەما نەدۆزرایەوە")
    accounts = build_account_map(user["org_id"])
    income = {"income", "sales", "other_income"}
    expense = {"expense", "cost_of_goods_sold", "operating_expense", "other_expense"}
    new_budget = BudgetRepository(user["org_id"]).create({
        "id": str(uuid.uuid4()), "org_id": user["org_id"], "name": req.name,
        "fiscal_year": base.get("fiscal_year"), "status": "draft",
        "scenario": req.scenario, "parent_version_id": req.base_budget_id,
        "version": int(base.get("version", 1)) + 1, "created_at": datetime.utcnow()})
    line_repo = BudgetLineRepository(user["org_id"])
    for ln in line_repo.get_by_budget(req.base_budget_id):
        at = accounts.get(ln["account_id"], {}).get("account_type", "")
        amt = ln["amount"]
        if at in income:
            amt *= (1 + req.revenue_delta_pct / 100)
        elif at in expense:
            amt *= (1 + req.expense_delta_pct / 100)
        line_repo.create({**{k: v for k, v in ln.items() if k != "id"},
                          "id": str(uuid.uuid4()), "budget_id": new_budget["id"],
                          "amount": round(amt, 2), "created_at": datetime.utcnow()})
    return {"data": new_budget}


@router.get("/rolling-forecast/{budget_id}", dependencies=[Depends(require_perm("reports.read"))])
def rolling_forecast(budget_id: str, user: dict = Depends(get_current_user)):
    """Rolling forecast = actuals for elapsed months + budget for remaining months.
    Reuses the existing budget-vs-actual variance logic per month."""
    from app.api.budgets import get_budget_variance
    var = get_budget_variance(budget_id=budget_id, user=user)
    now = datetime.utcnow()
    out = []
    for v in var["variances"]:
        elapsed = (v["period_year"], v["period_month"]) <= (now.year, now.month)
        out.append({**v, "forecast": v["actual"] if elapsed else v["budgeted"],
                    "basis": "actual" if elapsed else "budget"})
    total = round(sum(r["forecast"] for r in out), 2)
    return {"budget_id": budget_id, "rows": out, "forecast_total": total}


ALL_ROUTERS = [router]
```

**تۆمارکردن:** `from app.api import ... epm` + `app.include_router(epm.router)` لە `main.py`.

**Plan-vs-actual:** ئەندپۆینتی بەردەست `GET /api/budgets/{id}/variance` (`budgets.py:151`) و `GET /api/reports/budget-vs-actual` (`reports.py:525`) پێشتر ئەمە دەکەن — تەنها UI-ـی نوێ پێویستە کە version/scenario-ـی تەنیشت یەک پیشان بدات.

**Cashflow forecast بەرزکردنەوە:** زیادکردنی `scenario` query param بۆ `/api/cashflow/forecast/{days}` (`cashflow_forecast.py`) کە inflow-ـەکان بە `collection_probability` (بەپێی aging/مێژووی کڕیار) کێش بکات، و recurring bills/payroll-ـی پێشبینیکراو زیاد بکات.

---

### 1.5 UX — role dashboards, Vertex, mobile native, accessibility

**1.5.1 Role-based dashboards (لەسەر بناغەی بەردەست):**
`dashboardLayouts.ts` پێشتر `DASHBOARD_LAYOUTS` بە `RoleThemeId` هەیە. بەرزکردنەوە: ئەو layout-ـانە بکە **warehouse-driven** — هەر KPI-ـی ناو layout بکە `AnalysisDef` کە لە `/api/analytics/run` دەخوێنێتەوە (نەک live OLTP). نموونەی mapping لە تەنیشت layout-ـەکە:

```ts
// frontend/src/pages/dashboard/dashboardAnalytics.ts  (NEW)
import type { DashboardKpiId } from './dashboardLayouts';

export const KPI_ANALYSIS: Record<DashboardKpiId, { fact: string; measures: string[] }> = {
  income:     { fact: 'fact_invoices', measures: ['total'] },
  receivable: { fact: 'fact_invoices', measures: ['balance_due'] },
  payable:    { fact: 'fact_bills', measures: ['balance_due'] },
  expenses:   { fact: 'fact_bills', measures: ['total'] },
  overdue:    { fact: 'fact_invoices', measures: ['count'] },
  contacts:   { fact: 'fact_invoices', measures: ['count'] }, // distinct contacts via dim
};
```

**1.5.2 Vertex design system:** هەموو چارت/کارتی نوێ دەبێت **token-driven** بێت (وەک `TrendChart`/`ChartCard`-ـی ئێستا کە `var(--accent-500)`, `var(--surface)`, `var(--border)`, `var(--radius-lg)`, `var(--font-display)` بەکاردەهێنن). **هیچ hex-ـی hardcode نا** — یەک ئیستیسنا لە `MiniSparkline.tsx:14` ماوە (`color = '#7B61FF'` default) کە دەبێت بکرێت `var(--accent-500)` بۆ یەکدەستی + dark-mode flip:

```tsx
// frontend/src/design-system/MiniSparkline.tsx — هێڵی ١٤
const MiniSparklineInner: React.FC<MiniSparklineProps> = ({
  data, width = 80, height = 24, color = 'var(--accent-500)',  // ← '#7B61FF' → token
}) => {
```

recharts-ـی ناو `ChartCard` دەبێت هەمیشە `fill="var(--accent-500)"` / `stroke="var(--accent-500)"` بەکاربهێنێت (نەک categorical hardcode) — تەنها series-ـی categorical (وەک AppsLauncher) دەمێننەوە hardcode بەمەبەست.

**1.5.3 Mobile native (Capacitor):**
bridges-ـی POS پێشتر پڕۆداکشن-گرەیدن (`printer.ts` BLE/ESC-POS + per-dialect MTU `recommendedChunkSize()`؛ `scanner.ts` ML Kit + web ZXing fallback). بۆ analytics لەسەر مۆبایل:
- چارتەکان دەبێت **lightweight** بن — `TrendChart`/`MiniSparkline`-ـی inline SVG (بێ recharts) باشترن لەسەر low-end Android-ـی عێراق. recharts تەنها لەسەر tablet/desktop dashboard بەکاربهێنە.
- KPI-ـی dashboard لەسەر مۆبایل دەبێت لە warehouse بێت (یەک query) نەک ١٥ live OLTP call.
- offline: dashboard-ـی مۆبایل دەبێت last-good snapshot لە IndexedDB cache بکات (هەمان پاتێرنی POS offline).

**1.5.4 Accessibility (WCAG 2.1 AA):**
| پێوەر | دۆخ | کردار |
|--------|------|-------|
| Contrast ≥ 4.5:1 (body) / 3:1 (large/UI) | token-ـەکان لە `tokens.test.ts` تاقیکراون (violet UI ≥3:1، body ≥4.5:1) | چارتی نوێ: مەتن لەسەر چارت دەبێت ≥4.5:1؛ تەنها ڕەنگ بۆ گەیاندنی زانیاری بەس نییە — pattern/label زیاد بکە. |
| Focus visible | `a11y.css` + focus-ring violet | دڵنیابە چارت/widget-ـی interactive `:focus-visible` ring-ـی هەیە. |
| RTL | logical properties (`paddingInline`, `start/end`) لە سەرانسەری design-system | چارتی نوێ: axis/legend دەبێت RTL-aware بێت؛ `TrendChart` بەهۆی `preserveAspectRatio` و SVG-ـەوە RTL-safe-ـە. |
| Reduced motion | `ChartCard` بەکاردەهێنێت `useReducedMotion()` (هێڵی ٧٩) + `reduced-motion.css` | هەر animation-ـی چارتی نوێ دەبێت `prefers-reduced-motion` ڕەچاو بکات. |
| Screen reader | `TrendChart` `role="img" aria-label`؛ `MiniSparkline` `aria-hidden` | چارتی گرنگ (نەک دیکۆری) دەبێت `<table>`-ـی alternative یان `aria-label`-ـی واتادار هەبێت (`MiniSparkline` بە `aria-hidden` دروستە چونکە دیکۆرییە). |

ئامرازی verification-ـی پڕۆژە: `npm run rtl:audit`, `npm run audit:glass-modals`, `npm run i18n:purity:foundation` — هەر چارتی نوێ دەبێت ئەمانە تێبپەڕێنێت.

---

### 1.6 Test plan + Windows verification + rollout/flags

**Backend tests (فایلی نوێ لە `backend/tests/`):**
- `test_analytics.py`: (الف) `_validate` ڕەتکردنەوەی fact/measure/dimension-ـی نەناسراو (422)؛ (ب) `_build_sql` injection-safe بوون (هیچ user-value لە SQL string-دا نا — تەنها `@param`)؛ (ج) `run_analysis` بە `ANALYTICS_BQ_DATASET` نەبوو → `source == "oltp"` و OLTP fallback کاردەکات؛ (د) save/list analysis + sharing (owner-only + is_shared).
- `test_epm.py`: (الف) `expand-drivers` — line[m] = base×(1+growth)^m درووستە (مثلا base=100, growth=10% → m=1 → 110)؛ (ب) `create_scenario` — version increment + revenue/expense delta تەنها لەسەر account-type-ـی دروست؛ (ج) `rolling_forecast` — مانگی ڕابردوو=actual، داهاتوو=budget basis.
- `test_warehouse_cdc.py`: `to_fact_row` mapping بۆ هەر ٣ کۆلێکشن + `stream_fact` بێ `ANALYTICS_BQ_DATASET` → no-op (هیچ هەڵە).
- ڕیگرێشن: دڵنیابە `reports.py`, `dashboards.py`, `budgets.py`, `cashflow_forecast.py` هێشتا تێدەپەڕن (هیچ گۆڕانکارییەکی breaking نەکراوە — هەمووی additive).

**Frontend tests:**
- `MiniSparkline.test.tsx`: snapshot بە `var(--accent-500)` default (نەک hex).
- `EmbeddedAnalyticsDashboard.test.tsx`: fact-switch + loading/error/empty state via `ChartCard`.
- `dashboardAnalytics.test.ts`: هەموو `DashboardKpiId` لە `KPI_ANALYSIS` mapping هەیە.

**Windows verification (پێویستە — sandbox-ـی Linux ناتوانێت mirror بکات):**
```powershell
# Backend
cd C:\Users\SAFA\zoho\backend
.\venv\Scripts\Activate.ps1
pytest tests/test_analytics.py tests/test_epm.py tests/test_warehouse_cdc.py -v
pytest -q   # full suite — regression check (هیچ report/dashboard/budget test نەشکێت)

# Frontend
cd C:\Users\SAFA\zoho\frontend
npx tsc --noEmit
npm run test
npm run build
npm run lint
npm run i18n:purity:foundation
npm run rtl:audit
npm run audit:glass-modals
```
> **تێبینی:** ئەم بەشە لە sandbox نووسراوە؛ `pytest`/`tsc`/`build`-ـی ڕاستەقینە **لەسەر Windows نەکراوە**. هەموو snippet-ـەکان دەبێت پێش commit کۆمپایل/تاقی بکرێن.

**Rollout / feature flags:**
- هەموو شت پشت `useFeatureFlag` (`frontend/src/hooks/useFeatureFlag.ts` — off-by-default on error، server-evaluated gradual rollout):
  - `analytics-bi-layer` — embedded analytics + saved analyses UI.
  - `epm-driver-budgeting` — driver/scenario/rolling-forecast UI.
  - `warehouse-analytics` — لای backend بە env `ANALYTICS_BQ_DATASET` (نەبوو → OLTP fallback خۆکار). یەکەم بەبێ flag deploy بکە (fallback سەلامەتە)، دواتر CDC چالاک بکە، دواتر flag-ـی UI بۆ ١٠٪ → ١٠٠٪.
- **ڕیزبەندی deploy:** (١) `analytics.py` + `epm.py` routers (بەبێ warehouse — OLTP fallback)؛ (٢) BigQuery dataset + fact tables + CDC (extension یان Cloud Function)؛ (٣) backfill script؛ (٤) `ANALYTICS_BQ_DATASET` env لە Cloud Run؛ (٥) flag-ـی UI بەرەبەرە.
- **Firestore indices:** بۆ `saved_analyses`, `budget_drivers` (org_id + created_at)؛ زیاد بکە بۆ `firestore.indexes.json` و deploy بکە (`firebase deploy --only firestore:indexes`).
- **Scheduler:** scheduled-reports cron پێشتر هەیە (`scheduler.py:440`)؛ بۆ warehouse، scheduled query-ـی BigQuery (نەک APScheduler) بەکاربهێنە بۆ `fact_*` materialization.
