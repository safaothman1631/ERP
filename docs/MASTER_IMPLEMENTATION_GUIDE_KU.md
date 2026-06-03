# ڕێبەری ماستەری جێبەجێکردن (ئەوەی لەسەر Claude بوو) — ERPIQ

> **مەبەست:** ئەمە کۆکراوەی هەموو ئەو ڕێنماییە تەکنیکییانەیە کە دەکرا بە بێ مەترسی لێرە دروست بکرێن بۆ گەیاندنی سیستەم بۆ ئاستی world-class بەپێی کتێبەکە. هەمووی **ڕێنمایی پشتڕاستکراون بنچینەی لەسەر کۆدی ڕاستەقینە** — بەڵام **جێبەجێ نەکراون** لێرە، چونکە تاقیکردنەوەی backend پێویستی بە Windows ـی تۆ هەیە. هەر بەشێک: کۆدی copy-paste + خاڵی دانان + پلانی تێست + ڕێگەی پشتڕاستکردنەوە لەسەر Windows.
>
> **هاوبەشی ئەم دیکۆمێنتە:** `OWNER_ACTION_PLAN_KU.md` — هەموو ئەوەی لەسەر تۆ دەمێنێت (Windows + دەرەکی/مرۆڤ).

---

## 📚 ئەندێکسی هەموو ڕێنمایی-دروستکراوەکان

ئەمانە پێشتر دروستکراون و لەگەڵ ئەم ماستەرە تەواوکارن:

| ڕێنمایی | شوێن | ناوەڕۆک |
|---------|------|---------|
| دروستیی دارایی (P0) | `_deltas/P0-finance-correctness-IMPLEMENTATION.md` | GL خۆکار لە فاکتورا/پارە + Decimal |
| ئەرکیتێکچەری P1 | `_deltas/P1-architecture-IMPLEMENTATION.md` | event backbone، saga، Clean Core، API gateway، workflow engine |
| مۆدیوولی P1 | `_deltas/P1-modules-IMPLEMENTATION.md` | WMS، TMS، costing+WIP JE، consolidation، perpetual valuation |
| ADRـەکان | `docs/adr/0021–0024` | کۆگای داتا، event backbone، microservices، Decimal policy |
| **ئەم ماستەرە (٥ بەش)** | ↓ خوارەوە | analytics/EPM/UX · AI/MLOps · DevOps/SRE/DR · migration/QA · payments/e-Fakhata/finance |

---

## 🗺️ ناوەڕۆکی ئەم دیکۆمێنتە

1. **بەشی ١ — شیکاری · EPM · BI · UX/مۆبایل/Accessibility**
2. **بەشی ٢ — AI · فێربوونی ئامێر · MLOps**
3. **بەشی ٣ — DevOps · SRE · Observability · DR**
4. **بەشی ٤ — کۆچکردنی داتا (ETL) · ستراتیژیی تێست/QA**
5. **بەشی ٥ — پارەدانی عێراقی · e-Fakhata · GL/Decimal**

> هەر بەشێک بنچینەی لەسەر فایلی ڕاستەقینەی کۆدە (ناوی فەنکشن/فایل دیقەن کراون). پێش جێبەجێکردن: لە برانچێک کاری لەسەر بکە، `pytest` تەواو ڕان بکە، پاشان deploy.

---
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
## ٢) AI · فێربوونی ئامێر · MLOps

> ئەم بەشە نەخشەی پراکتیکییە بۆ گواستنەوەی پلاتفۆرمەکە لە **scaffold-ی AI ـی preview-only** بۆ **سیستەمی ML ـی پڕۆداکشن-گرەید**. هەموو نموونەکانی کۆد لەسەر بناغەی کۆدی ڕاستەقینەی ئەم ڕیپۆیە نووسراون (FastAPI + Firestore + `BaseRepository` + `get_current_user` ـی org-scoped). ڕێگەکان هەموویان Windows-ـن.

---

### ٢.٠) دۆخی ئێستا — چی هەیە (preview) بەرامبەر چی نییە (missing)

پێش هەر شتێک، با ڕاستگۆیانە بزانین لە کۆدبەیسەکەدا چی هەیە. سکانی `grep -rni "openai\|anthropic\|forecast\|anomaly\|ml\b" backend/app --include=*.py` و خوێندنەوەی `requirements.txt` ئەمەی دەرخست:

| بەش | فایلی ڕاستەقینە | دۆخ | شیکردنەوە |
|------|------------------|------|-----------|
| AI scaffolding | `backend/app/api/ai_features.py` | **preview-only** | docstring بە ڕاشکاوی دەڵێت: `"pure data scaffolding; ML inference handled externally."` تەنها CRUD ـە بەسەر ٥ کۆلێکشن (`ai_models`, `ai_forecasts`, `ai_anomalies`, `ai_recommendations`, `ai_ocr_jobs`). هیچ مۆدێلێک train/serve ناکات. |
| OCR | `backend/app/api/ocr.py` + `backend/app/services/ocr_service.py` | **functional-heuristic** | Tesseract ـی **ئیختیاری** (`try: import pytesseract`)؛ ئەگەر نەبوو → `status='unconfigured'`. parsing بە regex ـە (`_AMOUNT_RX`, `_DATE_RX`, `_TAX_RX`, `_LINE_RX`). **bill خۆکار دروست ناکات** — UI لە ڕێگەی `/api/ocr/confirm` ـەوە `bill_id` ـی دروستکراو هەڵدەواسێت. |
| Cashflow forecast | `backend/app/api/cashflow_forecast.py` | **deterministic arithmetic** | تەنها `due_date` ـی فاکتورا/پسووڵەی نەدراو کۆدەکاتەوە بەپێی ڕۆژ. هیچ مۆدێلی ML نییە. |
| CRM forecast | `backend/app/api/crm.py` (`/forecast`) + `backend/app/services/crm.py` (`forecast_revenue`) | **weighted heuristic** | `sum(value × win_probability)`. هیچ مۆدێل نییە. |
| IoT telemetry | `backend/app/api/iot.py` | **threshold rules** | `IoTAlertRule` بە `operator`/`threshold` کاردەکات. **هیچ anomaly/predictive ML نییە.** |
| Conversational assistant (LLM) | — | **missing بەتەواوی** | هیچ OpenAI/Anthropic/LLM ـێک لە `backend/` نییە. (تەنها چەند ڕیشەی وشە لە `livechat`/`elearning` کە human-chat ـن، نەک AI.) |
| ML deps | `backend/requirements.txt` | **هیچ** | `grep -i "numpy\|pandas\|sklearn\|prophet\|statsmodels\|openai\|anthropic\|lightgbm" requirements.txt` → **٠ ئەنجام**. تەنها `pillow>=10.2.0` بۆ وێنە. |

**ئەنجامی ستراتیژی:** بناغەکە (Firestore collections + org-scoped repos + router registration لە `main.py` هێڵەکانی 412/436/468) ئامادەیە. ئەوەی ماوە، **inference layer** ـە. بۆیە پلانەکە: مۆدێلەکان لە **service worker** ـی جیاواز (یان Cloud Run job/Vertex AI) train بکە، ئەنجامەکان بنووسە بۆ هەمان کۆلێکشنە بوونیارەکان، و UI لە ڕێگەی API ـی بوونیارەوە بیخوێنێتەوە. ئەمە مەترسی کەمدەکاتەوە و scaffold-ـەکە بەکاردێنێتەوە.

---

### ٢.١) چوارچێوەی گشتی — Inference Plane

```
┌───────────────────────────────────────────────────────────────┐
│  Analytics Warehouse (BigQuery — بڕوانە بەشی Analytics)         │
│  fact_invoice_line · fact_inventory_move · fact_txn · fact_iot  │
└────────────────────────┬──────────────────────────────────────┘
                         │ (scheduled extract, per-tenant partitioned)
                         ▼
┌───────────────────────────────────────────────────────────────┐
│  ML Worker (Cloud Run Job / APScheduler nightly)               │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐             │
│  │ Forecasting │ │  Anomaly    │ │  Pred. Maint │   training   │
│  │ (statsmodels│ │  (IForest / │ │  (survival / │   + scoring  │
│  │  /Prophet)  │ │   z-score)  │ │   threshold) │             │
│  └──────┬──────┘ └──────┬──────┘ └──────┬───────┘             │
│         └───────────────┼───────────────┘                      │
│                         ▼   write results                      │
└─────────────────────────┼─────────────────────────────────────┘
                          ▼
┌───────────────────────────────────────────────────────────────┐
│  Firestore (EXISTING collections — scaffold reused)            │
│  ai_models · ai_forecasts · ai_anomalies · ai_recommendations  │
└────────────────────────┬──────────────────────────────────────┘
                         │ org-scoped read (get_current_user)
                         ▼
┌───────────────────────────────────────────────────────────────┐
│  FastAPI (ai_features.router @ /api/ai) → React UI            │
│  Reorder · MRP · Expense review · Maintenance · Assistant      │
└───────────────────────────────────────────────────────────────┘
```

**بنەمای دیزاین:**
1. **Inference جیاوازە لە request path** — هیچ مۆدێلێک لە کاتی HTTP request inference ناکات (latency + مەترسی). مۆدێلەکان بە batch/nightly کاردەکەن، ئەنجام لە Firestore-دا cache دەکرێن.
2. **Scaffold-ـی بوونیار بەکاردێنرێتەوە** — `AIForecastRepo`/`AIAnomalyRepo`/`AIRecommendationRepo` هەمووی org-scoped ـن (`repo_cls(user["org_id"])`)، بۆیە tenant isolation بەخۆڕایی پارێزراوە.
3. **Graceful degradation** — وەک `ocr_service.py` کە بێ Tesseract `status='unconfigured'` دەداتەوە، هەموو مۆدێلێک پێویستە کاتێک مۆدێل نەبوو یان دەیتای کەم بوو، `status` ـی ڕوون بداتەوە نەک exception.
4. **Tenant isolation لە training-یشدا** — هەر org مۆدێلی خۆی (per-tenant) یان مۆدێلی هاوبەش بەڵام feature-ـی per-tenant. هیچ دەیتای org ـێک بۆ org ـێکی تر دەرناچێت (privacy، بەشی ٢.٧).

---

### ٢.٢) پێشبینیی داواکاری (Demand Forecasting)

**ئامانج:** بۆ هەر `(item_id, warehouse_id)` پێشبینیی فرۆشتنی ٣٠/٦٠/٩٠ ڕۆژی داهاتوو، بۆ تێیکردنی **reorder point** و **MRP** (بەرهەمهێنان).

#### دەیتا فلۆ
```
fact_inventory_move (BQ) ──aggregate by day──▶ time series per (item, warehouse)
       │
       ▼
ForecastModel.fit(history) ──▶ yhat[+30d] + lower/upper (prediction interval)
       │
       ▼  write
ai_forecasts collection  ──▶  /api/ai/forecasts  ──▶  Reorder UI + MRP planner
```

#### هەڵبژاردنی مۆدێل (بەپێی ئاستی پێچەڵی)

| ڕێگە | کاتی بەکارهێنان | لایبراری | تێبینی بۆ عێراق |
|------|------------------|----------|------------------|
| **Moving Average / EWMA** | item-ـی نوێ، دەیتای < ٨ هەفتە | NumPy تەنها | baseline، هەرگیز شکست ناهێنێت |
| **Holt-Winters (Triple Exp. Smoothing)** | item-ـی پایەدار بە seasonality (وەرزی) | `statsmodels` | سووک، بێ pip-dep ـی قورس؛ بۆ شتی وەرزی (مثل وەرزی هاوین/زستان) |
| **Prophet** | seasonality ـی پێچەڵ + ڕۆژانی پشوو | `prophet` | پشتگیری holiday regressor — **عیدی فیتر/ئەدحا، نەورۆز، عاشورا** دەتوانرێت بکرێت بە regressor |
| **LightGBM (global model)** | کاتالۆگی گەورە (1000+ item) | `lightgbm` | یەک مۆدێل بۆ هەموو item-ـەکان بە features (lag, day-of-week, promo flag) |

**پێشنیاری گواستنەوە:** دەست پێبکە بە **Holt-Winters** (statsmodels تەنها، بێ dep ـی قورس وەک Prophet/cmdstan)، fallback-ـی EWMA بۆ دەیتای کەم. دواتر Prophet زیاد بکە بۆ holiday-aware.

#### کۆدی نموونە — ML worker (training + serving)

> فایلی نوێی پێشنیارکراو: `backend/app/ml/forecasting.py` (نوێ، لە service worker بانگ دەکرێت).

```python
# backend/app/ml/forecasting.py
"""Demand forecasting worker. Runs in Cloud Run Job / nightly APScheduler.
Reads aggregated history, writes to ai_forecasts (existing collection)."""
from __future__ import annotations
import statistics
from datetime import datetime, timedelta
from app.api.ai_features import AIForecastRepo  # REUSE existing scaffold repo

def _ewma_fallback(daily_qty: list[float], horizon: int, alpha: float = 0.3) -> list[float]:
    """Safe baseline when history is short. Never raises."""
    if not daily_qty:
        return [0.0] * horizon
    s = daily_qty[0]
    for x in daily_qty[1:]:
        s = alpha * x + (1 - alpha) * s
    return [round(s, 2)] * horizon

def _holt_winters(daily_qty: list[float], horizon: int) -> list[float] | None:
    """Triple exp smoothing via statsmodels. Returns None if it can't fit."""
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing  # type: ignore
        if len(daily_qty) < 14:  # too short for seasonal
            return None
        model = ExponentialSmoothing(
            daily_qty, trend="add",
            seasonal="add", seasonal_periods=7,  # weekly seasonality
        ).fit()
        return [max(0.0, round(v, 2)) for v in model.forecast(horizon)]
    except Exception:
        return None  # degrade gracefully -> caller uses EWMA

def forecast_item(org_id: str, item_id: str, warehouse_id: str,
                  daily_qty: list[float], horizon: int = 30) -> dict:
    yhat = _holt_winters(daily_qty, horizon) or _ewma_fallback(daily_qty, horizon)
    method = "holt_winters" if _holt_winters(daily_qty, horizon) else "ewma"
    sigma = statistics.pstdev(daily_qty) if len(daily_qty) > 1 else 0.0
    points = [
        {"day": i + 1, "yhat": v,
         "lower": max(0.0, round(v - 1.96 * sigma, 2)),
         "upper": round(v + 1.96 * sigma, 2)}
        for i, v in enumerate(yhat)
    ]
    # Write to EXISTING ai_forecasts collection (org-scoped repo)
    return AIForecastRepo(org_id).create({
        "entity": f"item:{item_id}@wh:{warehouse_id}",
        "item_id": item_id, "warehouse_id": warehouse_id,
        "horizon_days": horizon, "method": method,
        "total_forecast": round(sum(yhat), 2),
        "points": points,
        "generated_at": datetime.utcnow().isoformat(),
    })
```

#### تێیکردنی Reorder + MRP

پێشبینییەکە دوو شت تەواو دەکات:

```python
# Reorder point = lead-time demand + safety stock
def reorder_point(forecast_doc: dict, lead_time_days: int, service_z: float = 1.65) -> float:
    pts = forecast_doc["points"][:lead_time_days]
    lead_demand = sum(p["yhat"] for p in pts)
    # safety stock from prediction-interval width over lead time
    safety = service_z * (sum((p["upper"] - p["yhat"]) / 1.96 for p in pts))
    return round(lead_demand + safety, 2)
```

- **Reorder:** ئەگەر `on_hand <= reorder_point` → پێشنیاری PO خۆکار (دەنووسرێت بۆ `ai_recommendations` بە `entity="reorder"`).
- **MRP:** پێشبینیی item-ـی کۆتایی (finished good) → bill-of-materials explosion → پێشنیاری بەرهەمهێنان/کڕینی component. (cross-link: مۆدیوولی `/manufacturing` + `/inventory`.)

#### API shape

```http
GET  /api/ai/forecasts?limit=50&offset=0          # بوونیارە (ai_features.py)
GET  /api/ai/forecasts/{rid}                        # بوونیارە
# نوێ (پێشنیارکراو، لە ai_features.py زیاد بکرێت):
GET  /api/ai/forecasts/item/{item_id}?warehouse_id=…&horizon=30
POST /api/ai/reorder-suggestions/run                # trigger batch (admin/perm)
```

نموونەی وەڵام:
```json
{
  "entity": "item:SKU-204@wh:WH-baghdad",
  "method": "holt_winters", "horizon_days": 30,
  "total_forecast": 412.0,
  "points": [{"day": 1, "yhat": 14.2, "lower": 9.1, "upper": 19.3}, "…"]
}
```

---

### ٢.٣) دۆزینەوەی نائاسایی (Anomaly Detection) بۆ مامەڵە/خەرجی

**ئامانج:** دۆزینەوەی خەرجی/مامەڵەی گومانلێکراو (fraud یان هەڵە) — duplicate، مەبلەغی دەرەوەی range، dabینکاری نامۆ، گەشەی نائاسایی.

#### پایپلاینی feature

```
fact_txn / expenses (BQ)
   ▼
feature pipeline per txn:
   • amount_zscore   (نسبەت بە مێژووی هەمان category/vendor)
   • is_duplicate    (هەمان vendor+amount+date لە window)
   • new_vendor      (vendor-ی نوێ بۆ ئەم org)
   • round_amount    (مەبلەغی تەواو — هێمای دەستکاری)
   • off_hours       (تۆمار لە دەرەوەی کاتی کار)
   • amount_vs_median (نسبەت بە median-ی category)
   ▼
scoring: IsolationForest (sklearn) OR rule-weighted z-score
   ▼  score >= threshold
ai_anomalies collection  ▶  /api/ai/anomalies  ▶  Expense review queue (UI badge)
```

#### کۆدی نموونە — scoring

> فایلی نوێ: `backend/app/ml/anomaly.py`

```python
# backend/app/ml/anomaly.py
"""Transaction/expense anomaly scoring. Writes to ai_anomalies (existing)."""
from __future__ import annotations
import statistics
from datetime import datetime
from app.api.ai_features import AIAnomalyRepo  # REUSE scaffold

def _zscore(value: float, history: list[float]) -> float:
    if len(history) < 3:
        return 0.0
    mu, sd = statistics.mean(history), statistics.pstdev(history)
    return 0.0 if sd == 0 else abs(value - mu) / sd

def score_expense(org_id: str, expense: dict, vendor_history: list[float],
                  recent_keys: set[str]) -> dict | None:
    """Rule-weighted score in [0,1]. >=0.6 surfaces in review queue."""
    amount = float(expense.get("total", 0))
    flags, weight = [], 0.0

    z = _zscore(amount, vendor_history)
    if z > 3:   flags.append("amount_outlier"); weight += 0.4
    key = f"{expense.get('vendor_id')}:{amount}:{expense.get('date')}"
    if key in recent_keys:  flags.append("possible_duplicate"); weight += 0.5
    if amount == round(amount, -3) and amount >= 1000:  # تەواو بۆ IQD
        flags.append("round_amount"); weight += 0.1
    if expense.get("vendor_id") and not vendor_history:
        flags.append("new_vendor"); weight += 0.15

    score = min(1.0, weight)
    if score < 0.6:
        return None  # not anomalous enough — don't spam the queue
    return AIAnomalyRepo(org_id).create({
        "entity": f"expense:{expense.get('id')}",
        "score": round(score, 3),
        "description": " · ".join(flags),
        "flags": flags,
        "amount": amount,
        "detected_at": datetime.utcnow().isoformat(),
        "status": "open",   # open → reviewed → dismissed/confirmed
    })
```

> **نووسینی ML-ـی پێشکەوتوو:** بۆ unsupervised، `from sklearn.ensemble import IsolationForest` لەسەر feature matrix-ـی per-org بەکاربهێنە (fit nightly، `contamination=0.02`). هەمان وەڵام بنووسە بۆ `ai_anomalies`. ئەمە rule-ـەکان تەواو دەکات (ئەوانەی precision بەرز و explainable ـن).

#### چۆن لە UI دەردەکەوێت

- **Expense review queue:** `GET /api/ai/anomalies?status=open` → جەدوەلی خەرجی بە badge ـی سوور + `description` (هۆکار).
- **InlineEdit + ContextMenu** (لە `design-system/`): "Dismiss" → `PATCH /api/ai/anomalies/{rid}` بە `status=dismissed`؛ "Confirm fraud" → escalate.
- **StatusTag** (بەشی Vertex): سوور بۆ `score>=0.8`، زەرد بۆ `0.6–0.8`.
- نۆتیفیکەیشن: کاتێک anomaly-ـی `critical` دروستبوو → `NotificationsDrawer`.

---

### ٢.٤) چاککردنی پێشبینانە (Predictive Maintenance) — IoT/Asset

**ئامانج:** پێشبینیی شکستی ئامێر/دارایی پێش ڕوودان، بەپێی سیگناڵی IoT (`iot_telemetry`) + مێژووی چاککردن (`/maintenance`).

#### هووکی بوونیار

کۆدی `backend/app/api/iot.py` پێشتر `IoTTelemetryRepo` + `IoTAlertRule` ـی هەیە بەڵام **تەنها threshold** (`operator`/`threshold`). predictive layer لەسەری زیاد دەکرێت:

```
iot_telemetry (vibration, temp, runtime_hours, error_count)
   ▼  rolling window per device
features: trend slope, EWMA, error_rate, hours-since-service
   ▼
health_score = f(features)   # 0=fail-imminent, 1=healthy
   ▼  score < threshold
ai_anomalies (entity="asset:{id}")  +  ai_recommendations (entity="maintenance")
   ▼
/maintenance work-order خۆکار پێشنیار دەکرێت
```

#### کۆدی نموونە

```python
# backend/app/ml/predictive_maintenance.py
"""Asset health from IoT telemetry. Hooks /maintenance + /iot."""
from __future__ import annotations
from datetime import datetime
from app.api.ai_features import AIRecommendationRepo

def asset_health(org_id: str, device_id: str, readings: list[dict],
                 hours_since_service: float, service_interval_h: float = 2000) -> dict:
    """Composite health score [0..1]. Lower => maintenance sooner."""
    temps = [r["value"] for r in readings if r.get("metric") == "temp"]
    vibs  = [r["value"] for r in readings if r.get("metric") == "vibration"]
    errs  = sum(1 for r in readings if r.get("metric") == "error")

    score = 1.0
    if temps and (max(temps) > 80):          score -= 0.3      # overheat
    if vibs and (max(vibs) > _baseline(vibs) * 1.5): score -= 0.3  # abnormal vibration
    score -= min(0.3, errs * 0.05)                              # error accumulation
    score -= min(0.2, hours_since_service / service_interval_h * 0.2)  # wear
    score = max(0.0, round(score, 3))

    if score < 0.5:  # recommend preventive maintenance
        AIRecommendationRepo(org_id).create({
            "entity": "maintenance",
            "target_entity": f"asset:{device_id}",
            "items": [{"action": "schedule_preventive_maintenance",
                       "urgency": "high" if score < 0.3 else "medium"}],
            "rationale": f"health_score={score} (temp/vibration/wear)",
            "generated_at": datetime.utcnow().isoformat(),
        })
    return {"device_id": device_id, "health_score": score}

def _baseline(vals: list[float]) -> float:
    return sum(vals) / len(vals) if vals else 0.0
```

- **API:** `GET /api/ai/recommendations?entity=maintenance` → لیستی پێشنیار؛ "Create work order" → POST بۆ `/api/maintenance`.
- **سادە دەست پێبکە:** trend + threshold (وەک سەرەوە). دواتر survival model (Weibull / `lifelines`) یان gradient-boosted RUL (Remaining Useful Life) زیاد بکە کاتێک دەیتای labeled-failure کۆبووەوە.

---

### ٢.٥) Document AI / OCR → دروستکردنی خۆکاری Bill

**دۆخی ئێستا** (`ocr_service.py`): Tesseract-ـی ئیختیاری + regex parsing. **Bill خۆکار دروست ناکات** — تەنها `parsed` دەداتەوە و UI لە ڕێگەی `/api/ocr/confirm` ـەوە `bill_id` هەڵدەواسێت.

#### دەیتا فلۆی ئێستا (بوونیار)

```
POST /api/ocr/scan (image) ──▶ extract_from_image() ──▶ {status, raw_text, parsed}
   │  (Tesseract لەبەردەستدا → "ok"؛ نا → "unconfigured")
   ▼  ocr_cache (sha256, TTL 24h)  +  receipt_scans (org-scoped)
   ▼
UI پیشان دەدات parsed → بەکارهێنەر چاک دەکات → دروستکردنی bill بە دەستی
   ▼
POST /api/ocr/confirm {scan_id, bill_id, parsed}  ──▶  linked_bill_id
```

#### پلانی پێشخستن — Intelligent Document Processing (IDP)

سێ ئاستی بەرزکردنەوە، هەریەکە جیاواز و plug-in بۆ هەمان flow:

| ئاست | تەکنەلۆژی | شوێنی زیادکردن |
|------|------------|------------------|
| **١. OCR باشتر** | Tesseract → Google Cloud Vision / Document AI | `ocr_service.py` — `parse_text_payload()` پێشتر ئامادەیە بۆ external OCR (`scan-text` endpoint comment: *"when integrating with external OCR"*) |
| **٢. Layout-aware extraction** | Document AI **Invoice Parser** (key-value + line items) | جێگرەوەی `_AMOUNT_RX`/`_LINE_RX` regex بە structured fields |
| **٣. Auto-create bill** | LLM/rules → map fields → vendor match → POST `/api/bills` | فەنکشنی نوێ `auto_create_bill_from_scan()` |

#### کۆدی نموونە — auto-create bill

> زیادکردن بۆ `backend/app/api/ocr.py` (router-ـی بوونیار):

```python
@router.post("/scan/{scan_id}/auto-bill")
def auto_create_bill(scan_id: str, user: dict = Depends(get_current_user)):
    """Promote a high-confidence scan straight to a draft bill."""
    repo = ReceiptScanRepository(user["org_id"])
    scan = repo.get(scan_id)
    if not scan or scan.get("org_id") != user["org_id"]:
        raise HTTPException(404, "scan not found")
    p = scan.get("parsed", {})
    confidence = _field_confidence(p)            # 0..1 from filled/validated fields
    if confidence < 0.75:
        # Low confidence → keep human-in-the-loop, return for review
        return {"created": False, "reason": "low_confidence",
                "confidence": confidence, "parsed": p}

    # vendor fuzzy-match against existing contacts (no new vendor silently)
    vendor_id = _match_vendor(user["org_id"], p.get("vendor"))
    from app.firestore.bills import BillRepository
    bill = BillRepository(user["org_id"]).create({
        "vendor_id": vendor_id, "vendor_name": p.get("vendor"),
        "bill_date": p.get("date"), "currency": p.get("currency", "IQD"),
        "subtotal": p.get("subtotal", 0), "tax": p.get("tax", 0),
        "total": p.get("total", 0),
        "line_items": p.get("items", []),
        "status": "draft", "source": "ocr_auto",
        "ocr_scan_id": scan_id,
    })
    repo.update(scan_id, {"linked_bill_id": bill["id"], "status": "confirmed"})
    return {"created": True, "bill_id": bill["id"], "confidence": confidence}
```

**گارد گرینگەکان:**
- **Human-in-the-loop بۆ confidence-ـی نزم** — هەرگیز bill خۆکار دروست مەکە ئەگەر `confidence < 0.75`. وەک scaffold-ـی ئێستا کە `/confirm` پێویست دەکات.
- **Vendor matching** — هەرگیز vendor-ـی نوێ بێ دەنگ دروست مەکە (مەترسی duplicate). fuzzy-match بکە، ئەگەر نەدۆزرایەوە → flag بۆ بەکارهێنەر.
- **Duplicate detection** — `ocr_cache` بە `sha256(content)` پێشتر هەیە؛ هەمان وێنە دووبارە scan → هەمان نەتیجە (idempotent).
- **عێراق:** پشتگیری زمانی `eng+ara` پێشتر لە `extract_from_image(languages="eng+ara")` ـدا هەیە. بۆ کوردی، فۆنتی Arabic-script کاردەکات.

---

### ٢.٦) یاریدەدەری گفتوگۆیی (LLM Assistant) — شێوازی "Joule"

> ئاماژە بە **یاریدەدەری شێوازی "Joule"** ـی کتێبەکە: یاریدەدەرێکی LLM-ـی ناو-ERP کە پرسیاری زمانی سروشتی وەردەگرێت، **tool-use** بەکاردێنێت بۆ خوێندنەوەی دەیتای ERP، و وەڵامی ground-ـکراو دەداتەوە. لە ئێستادا **بەتەواوی missing-ـە** لە backend (هیچ OpenAI/Anthropic نییە).

#### ئەرکیتێکچەر

```
بەکارهێنەر: "ئەم مانگە چەند فاکتورای نەدراوم هەیە؟"
   ▼
POST /api/assistant/chat {message, conversation_id}
   ▼
LLM (Anthropic/OpenAI) بە TOOL DEFINITIONS:
   • list_invoices(status, date_range)   ← هەر یەکێک org-scoped
   • get_cashflow_forecast(days)
   • search_contacts(query)
   • get_anomalies(status)
   ▼  tool_use → اجرای فەنکشنی ڕاستەقینەی FastAPI (هەمان repos)
   ▼  tool_result → LLM وەڵامی کوردی ground-ـکراو دروست دەکات
   ▼  audit log + جواب
```

#### کۆدی نموونە — tool-use بە tenant scoping

> فایلی نوێ: `backend/app/api/assistant.py` + `backend/app/services/assistant_tools.py`

```python
# backend/app/services/assistant_tools.py
"""LLM tool definitions. EVERY tool is org-scoped via the calling user."""
from app.firestore.invoices import InvoiceRepository
from app.services.report_streams import collect_stream

# Tools the model is allowed to call — READ-ONLY by default (guardrail)
TOOL_SPECS = [
    {"name": "list_unpaid_invoices",
     "description": "Count and total of unpaid invoices for the current org",
     "input_schema": {"type": "object", "properties": {
         "month": {"type": "string", "description": "YYYY-MM optional"}}}},
    {"name": "get_cashflow_forecast",
     "description": "Cash projection for next N days",
     "input_schema": {"type": "object", "properties": {
         "days": {"type": "integer", "minimum": 1, "maximum": 365}},
         "required": ["days"]}},
]

# Allow-list: ONLY these names can execute. No write tools without explicit perm.
def execute_tool(name: str, args: dict, *, org_id: str, user: dict) -> dict:
    if name == "list_unpaid_invoices":
        inv = collect_stream(InvoiceRepository(org_id), max_docs=5000)
        unpaid = [i for i in inv if i.get("status") not in ("paid", "void")]
        if args.get("month"):
            unpaid = [i for i in unpaid if str(i.get("date","")).startswith(args["month"])]
        return {"count": len(unpaid), "total": round(sum(i.get("total",0) for i in unpaid), 2)}
    if name == "get_cashflow_forecast":
        from app.api.cashflow_forecast import get_cashflow_forecast
        return get_cashflow_forecast(days=int(args["days"]), user=user)
    raise ValueError(f"tool '{name}' not in allow-list")  # GUARDRAIL
```

```python
# backend/app/api/assistant.py
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.auth import get_current_user
from app.services.assistant_tools import TOOL_SPECS, execute_tool

router = APIRouter(prefix="/api/assistant", tags=["Assistant"])

class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None

@router.post("/chat")
def chat(body: ChatRequest, user: dict = Depends(get_current_user)):
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "assistant not configured")  # graceful degrade
    import anthropic                                          # lazy import
    client = anthropic.Anthropic()
    org_id = user["org_id"]

    SYSTEM = (
        "تۆ یاریدەدەری ERP ـیت بۆ ئەم بازرگانییە. تەنها لەسەر بنەمای "
        "ئەنجامی tool وەڵام بدەوە. هەرگیز ژمارە مەهۆنەوە (no hallucinated numbers). "
        "بە کوردیی سۆرانی وەڵام بدەوە. ناتوانیت داتای دەستکاری بکەیت."
    )
    messages = [{"role": "user", "content": body.message}]
    # agentic loop: model may call tools, we execute org-scoped, feed results back
    for _ in range(5):  # bounded — prevent runaway tool loops (guardrail)
        resp = client.messages.create(
            model="claude-sonnet-4-5", max_tokens=1024,
            system=SYSTEM, tools=TOOL_SPECS, messages=messages)
        if resp.stop_reason != "tool_use":
            text = "".join(b.text for b in resp.content if b.type == "text")
            _audit(org_id, user, body.message, text)         # tenant-scoped audit
            return {"reply": text}
        messages.append({"role": "assistant", "content": resp.content})
        tool_results = []
        for block in resp.content:
            if block.type == "tool_use":
                out = execute_tool(block.name, block.input, org_id=org_id, user=user)
                tool_results.append({"type": "tool_result",
                                     "tool_use_id": block.id, "content": str(out)})
        messages.append({"role": "user", "content": tool_results})
    raise HTTPException(500, "assistant exceeded tool budget")
```

#### Guardrails (گرینگ بۆ پڕۆداکشن)

1. **Tenant scoping** — هەموو tool لە ڕێگەی `org_id = user["org_id"]` ـەوە کاردەکات. **هیچ tool ـێک ناتوانێت دەیتای org ـێکی تر ببینێت.** ئەمە هەمان pattern-ـی `_own()` ـی `ai_features.py` ـە.
2. **Read-only by default** — tool-ـی write (دروستکردن/سڕینەوە) **تەنها** بە `require_perm` ـی ڕوون. assistant بە default ناتوانێت دەیتا بگۆڕێت.
3. **Allow-list** — `execute_tool` تەنها ناوە ناسراوەکان جێبەجێ دەکات؛ هەر شتی تر `ValueError`.
4. **Bounded loop** — agentic loop سنووردارە (`for _ in range(5)`) بۆ ڕێگری لە runaway/cost.
5. **No hallucination** — system prompt: *"هەرگیز ژمارە مەهۆنەوە"* + تەنها لەسەر tool_result.
6. **PII** — هیچ secret/raw PII ناچێتە prompt؛ تەنها aggregate (count/total). audit log بێ payload-ـی هەستیار.
7. **Rate-limit** — لە ڕێگەی `slowapi` (پێشتر لە `requirements.txt`) + per-org quota بۆ کۆنترۆڵی تێچوو.

---

### ٢.٧) MLOps — Training · Registry · Serving · Monitoring

#### ٢.٧.١ پایپلاینی Training

```
BigQuery warehouse (per-tenant partitioned)
   ▼  extract (scheduled)
Cloud Run Job  "ml-train-nightly"  (یان APScheduler job)
   ├─ forecasting.py    → fit per (item, warehouse)
   ├─ anomaly.py        → fit IsolationForest per org
   └─ predictive_maint  → fit per asset-class
   ▼  write artifacts
Model Registry (ai_models collection — بوونیار!)
   ▼
Serving: ئەنجامەکان لە ai_forecasts/ai_anomalies (precomputed)
```

- **Trigger:** `app/services/scheduler.py` ـی بوونیار (APScheduler — لە CLAUDE.md نووسراوە ١٩+ job هەیە). job-ـی نوێ زیاد بکە: `ml_train_nightly` (CronTrigger، شەو).
- **Why batch:** request-time inference نا (latency + cost). nightly fit + precomputed serve.

#### ٢.٧.٢ Model Registry — `ai_models` (بوونیار)

scaffold-ـی `AIModelRepo` (collection `ai_models`) پێشتر field-ـی گونجاوی هەیە: `name`, `type`, `target_entity`, `config`, `is_active`. زیادی بکە بۆ versioning:

```python
AIModelRepo(org_id).create({
    "name": "demand-holt-winters",
    "type": "forecast",                 # بوونیار: forecast|anomaly|recommendation|...
    "version": "2026.06.03",
    "metrics": {"mape": 0.18, "rmse": 4.2},   # eval لەسەر holdout
    "params": {"seasonal_periods": 7},
    "is_active": True,                  # تەنها یەک version active بۆ هەر type
    "trained_at": "2026-06-03T02:00:00Z",
    "training_rows": 12480,
})
```

**نموونەی Champion/Challenger:** `is_active=True` بۆ champion؛ challenger-ـی نوێ shadow-mode (دەنووسرێت بەڵام UI پیشانی نادات) تا metrics ـی باشتر بسەلمێنرێت → flip.

#### ٢.٧.٣ Monitoring + Drift Detection

| پێوەر | چۆن | کارلێک |
|-------|------|---------|
| **Prediction drift** | بەراوردی توزیعی yhat-ـی ئەم هەفتە بەرامبەر هەفتەی ڕابردوو (PSI / KS-test) | PSI > 0.2 → alert |
| **Accuracy drift** | MAPE-ـی پێشبینی بەرامبەر ئەنجامی ڕاستەقینە (دوای ڕووداوەکە) | MAPE بەرز بوو → retrain |
| **Data drift** | گۆڕانی feature distribution (مثل ئەنجامی فرۆشتن دەرکەوتنی promo) | log + dashboard |
| **Anomaly volume** | ژمارەی anomaly-ـی ڕۆژانە؛ زیادبوونی ناکاو = مۆدێل noisy | re-tune `contamination` |

metrics بنووسە بۆ BigQuery (`ml_monitoring` table) → cross-link بۆ بەشی Analytics dashboards (Cloud Monitoring/Grafana). drift-ـی توند → APScheduler retrain trigger خۆکار.

#### ٢.٧.٤ Retraining

- **Scheduled:** nightly fit (هەموو مۆدێل).
- **Triggered:** ئەگەر drift-ـی monitoring تێپەڕی threshold → retrain فۆری.
- **Cold-start:** item/asset-ـی نوێ بێ مێژوو → fallback (EWMA / threshold) تا دەیتا کۆببێتەوە.

#### ٢.٧.٥ Privacy + Tenant Isolation (گرینگترین)

1. **No cross-tenant leakage** — هەر training run per-org-ـە یان global-model بە feature-ـی per-org. **هیچ دەیتای org ـێک نابێت لە مۆدێلی org ـێکی تر بەکاربێت.** هەمان pattern-ـی `repo_cls(user["org_id"])`.
2. **No PII in features** — feature-ـەکان aggregate/numeric ـن (qty, amount, z-score). ناو/تەلەفۆن/ناونیشانی کڕیار **ناچنە** مۆدێل.
3. **LLM:** هیچ raw PII ناچێتە prompt-ـی provider؛ تەنها aggregate. ئەگەر provider-ـی dış بەکاردێت، DPA پێویستە (بڕوانە `legal/` لە CLAUDE.md).
4. **Audit:** هەموو inference/assistant call → audit log-ـی org-scoped (وەک scaffold-ـی بوونیار).
5. **Right-to-erasure:** کاتێک org داتای خۆی دەسڕێتەوە (`data_rights` API لە CLAUDE.md SF2)، مۆدێل/forecast/anomaly-ـی پەیوەندیداریشی دەسڕێتەوە.

---

### ٢.٨) پلانی تێست

| بەش | تێستی پێشنیارکراو | فایل |
|------|-------------------|------|
| Forecasting | EWMA fallback بۆ دەیتای کەم؛ Holt-Winters بۆ ١٤+ خاڵ؛ `points` پێکهاتە دروست؛ org-scoped write | `backend/tests/ml/test_forecasting.py` |
| Anomaly | duplicate flag؛ z-score outlier؛ score < 0.6 → `None` (نەخوازراو queue spam)؛ round-amount IQD | `backend/tests/ml/test_anomaly.py` |
| Pred. maint | overheat → score کەم؛ score < 0.5 → recommendation دروست دەبێت | `backend/tests/ml/test_predictive_maintenance.py` |
| OCR auto-bill | confidence < 0.75 → `created=False`؛ vendor-match؛ idempotent (`ocr_cache`)؛ `eng+ara` | `backend/tests/test_ocr_auto_bill.py` |
| Assistant | tool allow-list (ناوی نامۆ → `ValueError`)؛ tenant scoping (org A ناتوانێ org B ببینێت)؛ bounded loop؛ بێ `ANTHROPIC_API_KEY` → 503 | `backend/tests/test_assistant_tools.py` |
| MLOps | model registry version flip؛ drift PSI calc؛ retrain trigger | `backend/tests/ml/test_mlops.py` |

تێستەکان لەسەر بناغەی `backend/tests/quick_create/` ـی بوونیار بنووسە (repo-mocked، org-scoped). هیچ تێستێک نابێت call-ـی ڕاستەقینەی LLM/Vertex بکات (mock بکە).

---

### ٢.٩) پشتڕاستکردنەوەی Windows

```powershell
# دامەزراندنی ML deps (پێشنیارکراو، لە requirements.txt زیاد بکرێن):
#   statsmodels>=0.14   scikit-learn>=1.4   anthropic>=0.40
#   (prophet/lightgbm ئیختیاری — قورستر)
cd C:\Users\SAFA\zoho\backend
.\venv\Scripts\Activate.ps1
pip install statsmodels scikit-learn anthropic

# تاقیکردنەوەی import ـی app (دەبێت پاک boot بێت — router-ـەکان بوونیارن):
python -c "from app.main import app; print('routes:', len(app.routes))"

# تێستی ML تەنها:
pytest backend/tests/ml -q
pytest backend/tests/test_assistant_tools.py backend/tests/test_ocr_auto_bill.py -q

# OCR ـی بوونیار بێ Tesseract (دەبێت status='unconfigured' بداتەوە، نەک crash):
python -c "from app.services.ocr_service import extract_from_image; print(extract_from_image(b'x')['status'])"
```

> **تێبینی:** sandbox-ـی Linux نەیتوانیوە تەواوی pytest-ـی backend ڕان بکات (venv-ـی Windows + بێ deps). هەموو پشتڕاستکردنەوەی ML دەبێت لەسەر Windows-ـی بەکارهێنەر ئەنجام بدرێت.

---

### ٢.١٠) Rollout · Flags · تێچوو/Latency

#### Feature flags
هەموو AI feature لە پشتی `useFeatureFlag` (frontend) + `api/featureFlags.ts` (بوونیار لە CLAUDE.md):
- `ai.demand_forecast` · `ai.anomaly_detection` · `ai.predictive_maintenance` · `ai.ocr_auto_bill` · `ai.assistant`
- per-tenant rollout: دەست پێبکە بە pilot-ـی چەند org، دواتر گشتی.

#### تێچوو / Latency

| بەش | Latency | تێچوو | تێبینی |
|------|---------|-------|---------|
| Forecasting | **batch nightly** — serve لە Firestore (< 50ms) | کەم (compute-ـی شەو) | request-time inference نا |
| Anomaly | batch + on-write hook | کەم | sklearn سووکە |
| OCR (Tesseract) | ~1–3s/image | بێ تێچوو (لۆکاڵ) | Cloud Vision: ~$1.5/1k page |
| OCR (Document AI) | ~2–5s/doc | ~$30/1k page | تەنها بۆ confidence-ـی بەرز پێویست |
| Assistant (LLM) | ~2–8s/turn (tool loops) | **زۆرترین** — token-based | per-org quota + cache + bounded loop |

**ستراتیژیی کۆنترۆڵی تێچوو:**
1. **Batch > realtime** — هەموو forecast/anomaly precomputed.
2. **Cache** — OCR بە `sha256` (بوونیار)؛ assistant بە conversation cache.
3. **Bounded** — agentic loop ≤ 5 turn.
4. **Quota per-org** — `slowapi` + per-tenant LLM budget.
5. **Model tiering** — مۆدێلی سووک (Holt-Winters/sklearn) بۆ زۆربە؛ گران (Prophet/LLM) تەنها کاتێک پێویست.

#### هەنگاوەکانی rollout
1. **R0:** ML deps زیاد بکە بۆ `requirements.txt` + register کردنی job-ـی nightly (پێشتر `ai_features.router` لە `main.py:468` registered ـە).
2. **R1:** Forecasting + Reorder (مەترسی کەم، arithmetic-ـی بوونیار باشتر دەکات).
3. **R2:** Anomaly (review queue، human-in-loop).
4. **R3:** OCR auto-bill (confidence-gated).
5. **R4:** Predictive maintenance (IoT-ـی پایلۆت).
6. **R5:** Assistant (LLM — دوای guardrail + DPA + cost-quota).

> **بنەمای کۆتایی:** هیچ شتێک خۆکار بڕیاری دارایی/ئەنباری نادات بێ human-in-the-loop لە سەرەتادا. AI پێشنیار دەکات؛ مرۆڤ پەسەند دەکات. ئەمە هەمان فەلسەفەی scaffold-ـی بوونیارە (OCR ـی `/confirm`-required).
## ٣) DevOps · SRE · Observability · DR

> دۆخی ئێستا (grounded لە کۆد، ٢٠٢٦-٠٦-٠٣): production لەسەر **`zoho-83cda` / `europe-west1`** زیندووە
> (`deploy/cloudrun-url.txt` → `https://zoho-erp-backend-6plfqh2hiq-ew.a.run.app`؛ `deploy/redeploy-backend.ps1` →
> `--region europe-west1 --project zoho-83cda`). بەڵام ئەم سێ شوێنە هێشتا ئاماژە بۆ پڕۆژەی **کۆن** دەکەن
> (`erp-system-494716` / `me-central1`): (1) Terraform monitoring variables؛ (2) هەردوو deploy workflow؛
> (3) `DISASTER_RECOVERY.md` + `scripts/dr/*.sh`. ئەمە drift-ی ڕاستەقینەیە و یەکەم کاری ئەم بەشە چاکردنیەتی.

این بەش چوار شتی ناتەواو دەگرێتەوە کە بۆ launch-ی ڕاستەقینە بلۆکەرن:

1. **CI/CD** — `startup_failure`-ی auto-deploy + WIF بۆ `zoho-83cda` + gates + blue/green + rollback.
2. **Scheduler** — ٢٠ job-ی in-process کوژێنراونەتەوە (`SCHEDULER_ENABLED:"false"`)؛ دەبێت بگوازرێنەوە بۆ out-of-process.
3. **Observability** — `terraform apply` (٢٤ alert + ٦ dashboard هەرگیز apply نەکراون)، Sentry DSN، PagerDuty، SLO.
4. **DR** — runbook بۆ پڕۆژەی کۆن ئاماژە دەکات؛ RTO/RPO + drill ڕاستەقینە + PITR.

---

### ٣.١ یەکخستنی project/region (پێش هەموو شتێک)

هیچ یەک لەم چاکسازیانە ناکرێن بەبێ یەکخستنی drift-ی region/project. ئەمە تەنها سێ فایل دەستکاری دەکات و
هیچ runtime-ێک ناگۆڕێت — بەڵام بەبێ ئەمە CI، Terraform، و DR runbook هەموویان لە جێی هەڵە کاردەکەن.

**Source of truth (پشتڕاستکراو):**

| شت | کۆن (لە کۆددا) | دروست (production زیندوو) |
|------|------|------|
| GCP project | `erp-system-494716` | **`zoho-83cda`** |
| Region | `me-central1` | **`europe-west1`** |
| Cloud Run service | `zoho-erp` / `zoho-erp-backend` | **`zoho-erp-backend`** |
| Backup bucket | `zoho-83cda-erp-backups` | `zoho-83cda-erp-backups` ✓ (دروستە) |

> **تێبینی Firestore-region:** PITR + GCS export لە Firestore-ی `zoho-83cda` دەبن. ئەگەر Firestore لە
> `nam5`/`eur3` multi-region بوو (نەک `europe-west1` single-region)، ئەوا `--location`-ی DR scripts
> دەبێت لەگەڵ **Firestore database location** بگونجێت، نەک Cloud Run region. ئەمە دەبێت یەکجار بپشکنرێت:
> ```powershell
> gcloud firestore databases describe --database="(default)" --project=zoho-83cda `
>   --format="value(locationId,type,pointInTimeRecoveryEnablement)"
> ```
> بەهای `locationId`-ی ئەنجام بکە بە بەهای `DR_FIRESTORE_LOCATION` لە هەموو شوێنێک (نەک گریمانەی `me-central1`).

---

### ٣.٢ CI/CD — چاکردنی `startup_failure` + WIF + gates

#### ٣.٢.١ هۆکاری `startup_failure` (diagnosis)

`startup_failure` واتە GitHub Actions نەیتوانی workflow-ـەکە **دەست پێ بکات** — پێش هەر step-ێک شکستی هێنا.
لێرە دوو هۆکاری بنەڕەتی هەیە:

**(أ) دوو workflow-ی deploy-ی دژبەیەک هەن** کە هەردووکیان لەسەر `main` فایر دەبن:

- `.github/workflows/deploy-cloudrun.yml` — `on: workflow_run: workflows:["CI"] types:[completed]`. واتە هەر کاتێک
  workflow-ی ناوی **"CI"** تەواو بوو، ئەمە دەست پێ دەکات. ئەگەر `ci.yml` (ناوی `name: CI`) ڕیفاکتەر بکرێت یان
  بسڕێتەوە، `workflow_run` ناتوانێ ئەو workflow-ـە بدۆزێتەوە → `startup_failure` (trigger-ـی نەماو).
- `.github/workflows/deploy-production.yml` — `on: push: branches:[main]`. ئەمە راستەوخۆ لەسەر push فایر دەبێت
  و **`ci-gate` job**-ـی هەیە کە بە `gh run list` پشتڕاست دەکاتەوە کە `ci.yml` + `ci-quality.yml` سەوزن.

ئەمانە لەیەکتر **دووبارەن**: هەردووکیان بۆ هەمان service (`zoho-erp-backend`) لەسەر هەمان region deploy دەکەن.
دەبێت تەنها **یەکێکیان** بمێنێتەوە. (پێشنیار: `deploy-production.yml` بهێڵە — gates-ـی تەواوتری هەیە؛
`deploy-cloudrun.yml` بسڕەوە یان بیکە بۆ `workflow_dispatch`-ـی تەنها.)

**(ب) WIF secrets بۆ پڕۆژەی کۆن ئاماژە دەکەن.** بەپێی تۆماری CLAUDE.md، `GCP_PROJECT_ID` / `GCP_WIF_PROVIDER` /
`GCP_SA_EMAIL` هێشتا → `erp-system-494716`. کاتێک `google-github-actions/auth@v2` بە provider-ـی پڕۆژەیەکی هەڵە
auth بکات، یان WIF pool لە `zoho-83cda` بوونی نەبێت، job-ـەکە لە دەستپێکدا دەشکێت.

> دوو workflow هەروەها naming-ـی جیاوازی secret بەکاردەهێنن: `deploy-cloudrun.yml` → `GCP_SA_EMAIL`،
> بەڵام `deploy-production.yml` → `GCP_SERVICE_ACCOUNT`. ئەگەر تەنها یەکێکیان set کرابێت، ئەوی تر empty-auth
> دەکات و دەشکێت. ئەمەش دەبێت یەکبخرێتەوە (یەک ناو).

#### ٣.٢.٢ دامەزراندنی WIF بۆ `zoho-83cda` (keyless، یەکجار)

WIF (Workload Identity Federation) ڕێگە دەدات GitHub Actions بێ کلیلی JSON (نە `gha-key.json` — کە بەپێی
CLAUDE.md پێشتر بە هەڵە commit کرابوو) auth بکات. هەنگاوەکان لەسەر ماشینی بەکارهێنەر (gcloud auth کراوە):

```bash
PROJECT=zoho-83cda
PROJECT_NUM=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
POOL=github-pool
PROVIDER=github-provider
REPO="<github-org>/<repo>"          # e.g. safaothman/zoho
SA=gha-deployer@${PROJECT}.iam.gserviceaccount.com

# 1) Service account بۆ deploy
gcloud iam service-accounts create gha-deployer --project "$PROJECT" \
  --display-name "GitHub Actions deployer"

# 2) ڕۆڵە پێویستەکان (least-privilege بۆ Cloud Run + Cloud Build + Artifact Registry + Secret read)
for ROLE in roles/run.admin roles/cloudbuild.builds.editor \
            roles/artifactregistry.writer roles/iam.serviceAccountUser \
            roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${SA}" --role="$ROLE"
done

# 3) Workload Identity Pool + OIDC provider بۆ GitHub
gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT" \
  --location=global --display-name="GitHub pool"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
  --project "$PROJECT" --location=global --workload-identity-pool="$POOL" \
  --display-name="GitHub provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 4) ڕێگەدان بە ئەو repo-ـە کە SA-ـەکە impersonate بکات
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}"

# 5) چاپکردنی provider resource name بۆ GitHub secret
echo "GCP_WIF_PROVIDER=projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "GCP_SA_EMAIL=${SA}"
echo "GCP_PROJECT_ID=${PROJECT}"
```

دواتر GitHub secrets نوێ بکەرەوە (`gh secret set`):

```bash
gh secret set GCP_PROJECT_ID       --body "zoho-83cda"
gh secret set GCP_WIF_PROVIDER     --body "projects/<NUM>/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
gh secret set GCP_SA_EMAIL         --body "gha-deployer@zoho-83cda.iam.gserviceaccount.com"
gh secret set GCP_SERVICE_ACCOUNT  --body "gha-deployer@zoho-83cda.iam.gserviceaccount.com"  # alias بۆ deploy-production.yml
```

#### ٣.٢.٣ چاکردنی region لە هەردوو workflow

```yaml
# .github/workflows/deploy-cloudrun.yml  AND  deploy-production.yml
env:
  REGION: europe-west1          # بوو: me-central1
  SERVICE: zoho-erp-backend     # یەکدەگرنەوە
```

هەروەها `deploy-production.yml` env-var-ـی hardcoded-ی deploy-candidate لە secret وەربگرە (پێشتر
`FIREBASE_PROJECT_ID=${{ secrets.GCP_PROJECT_ID }}` بەکاردەهێنێت — دروستە، بەس دڵنیابە secret-ـەکە
ئێستا `zoho-83cda`-ـە).

#### ٣.٢.٤ Gates لەسەر PR (tsc/lint/build/test + pytest)

`ci.yml` ئێستا backend + frontend دەپشکنێت، بەڵام دوو لاوازی هەیە کە دەبێت چاک بکرێن:

- **Lint advisory-یە** (`npx eslint . --max-warnings 9999 || true`) — هیچ کاتێک ناشکێت. بەپێی CLAUDE.md، lint
  ئێستا `0 error` دەداتەوە، بۆیە دەکرێ بکرێت بە **blocking بۆ error-ـەکان** (warning-ـەکان نا):
  ```yaml
  - name: Lint (block on errors only)
    run: npx eslint . --max-warnings 9999   # بێ '|| true' → error → fail
  ```
- **Frontend `Install` بەبێ `--legacy-peer-deps`** (`npm ci || npm install`). بەپێی CLAUDE.md، پڕۆژەکە
  پشت بە vite v8 دەبەستێت کە peer-dep conflict-ی هەیە، بۆیە `npm ci`-ـی ساده دەشکێت و دەکەوێتە سەر
  `npm install` (lockfile-ـی ناهەماهەنگ). دەبێت ڕاست بکرێت بۆ هاوتایی لەگەڵ `deploy-production.yml`:
  ```yaml
  - name: Install (legacy peer deps for vite v8)
    run: npm install --legacy-peer-deps
  ```
- **Pytest** لە `ci.yml` کاردەکات (`python -m pytest tests/ -q --maxfail=5`)، بەڵام بەبێ coverage-gate.
  بەپێی تۆماری P0، `pytest.ini` ئێستا `--cov=app --cov-fail-under=0` هەیە (بێ شکاندن). دوای stabilize،
  بەرز بکەرەوە بۆ نموونە `--cov-fail-under=35`.

**ڕیزبەندیی gate-ـی پێشنیارکراو لەسەر PR** (هەمووی blocking):
`backend` (compile + import + pytest + firestore-lints) → `frontend` (tsc + lint-errors + i18n parity + build) →
`e2e-scenarios` + `lighthouse-a11y` (a11y ≥ 0.95). تەنها دوای سەوزبوونی هەمووی، merge بۆ `main` →
`deploy-production.yml`.

#### ٣.٢.٥ Blue/green + revision-tag rollout + rollback

`deploy-production.yml` پێشتر blue/green-ـی ڕاستەقینەی هەیە (`scripts/deploy-bluegreen.sh`، deploy بۆ
`--tag candidate --no-traffic` دواتر traffic-shift 1%→10%→100%). ئەمە بهێڵە، بەس region/project ڕاست بکە.
ئەو نمونەیەی لە `deploy-cloudrun.yml` (deploy ڕاستەوخۆ بۆ 100% traffic) بۆ production باش نییە — ئەمەش
هۆکارێکی تری سڕینەوەی `deploy-cloudrun.yml`-ـە.

**Manual rollback (instant، بەبێ rebuild):**

```bash
# لیستی revision-ەکان
gcloud run revisions list --service zoho-erp-backend \
  --region europe-west1 --project zoho-83cda \
  --format='table(name, active, creationTimestamp)' --limit 10

# 100%-ی traffic بگەڕێنەوە بۆ revision-ی سەوزی پێشوو (~30s)
gcloud run services update-traffic zoho-erp-backend \
  --region europe-west1 --project zoho-83cda \
  --to-revisions=<PREV_REVISION>=100

# پشتڕاست بکەرەوە
curl -sf https://erpiq.systems/api/health
```

**Frontend rollback (Vercel):** `vercel rollback <prev-deployment-url> --token "$VERCEL_TOKEN"` (~5min CDN re-alias).

---

### ٣.٣ Out-of-process scheduler (ئەرکی بلۆکی launch)

#### ٣.٣.١ هۆکار: بۆچی in-process کوژێنرایەوە

`cloudrun-deploy-env.yaml` بە ڕوونی دەڵێت:

```yaml
SCHEDULER_ENABLED: "false"
# Disabled: the in-process APScheduler jobs (e-Fakhata drain, outbox dispatcher)
# hung on Firestore and wedged the shared gRPC channel, causing every query
# (login/signup/me) to time out -> 504.
```

ئەمە بەهۆی **single-uvicorn-process**-ـەوەیە (`Dockerfile` CMD، بێ `--workers`): forking-ی process-ێک کە
Firestore gRPC channel-ـی هەیە، channel-ـەکە دەفڕێنێت (`KeyError in grpc channel_spin`). بۆیە APScheduler
کە لەناو هەمان process-دا job-ـی Firestore-قورس دەخوازێت، channel-ـی هاوبەش wedge دەکات و login تایم-ئاوت دەکات.

ئەنجام: ئەم ٢٠ job-ـە (لە `backend/app/services/scheduler.py`) **هیچیان لە production کار ناکەن**، لەوانە
ئەو ٤ـەی launch-بلۆکەرن:

| Job | Trigger | کاریگەری ئەگەر کار نەکات |
|------|---------|------|
| `efakhata_submission_drain` | هەر 30s | فاکتورا بۆ وەزارەتی دارایی نانێردرێت (compliance) |
| `outbox_dispatch` | هەر 1m | event-ـەکان (webhook/email) ناگەن |
| `payments_reconciliation_nightly` | 02:15 | mismatch-ـی پارەدان دۆزرایەوە نییە |
| `cbi_rate_refresh_daily` | 06:00 UTC | نرخی USD↔IQD نوێ نابێتەوە |
| (+ `daily_backup`, `audit_retention`, `gdpr_hard_delete`, `monthly_depreciation`, `subscription_renewal`, `dunning`, `observability_heartbeat`…) | | backup/retention/billing هەمووی ڕاوەستاون |

> هەروەها `observability_heartbeat` (هەر 5m) ناکار دەبێت، بۆیە alert #15 ("Scheduler heartbeat absent")
> بەردەوام فایر دەکات کاتێک Terraform apply بکرێت — ئەمە یەکێکی تر لە هۆکارەکانە بۆ چارەسەری scheduler
> پێش apply-کردنی observability.

#### ٣.٣.٢ چارەسەر: Cloud Run Job + Cloud Scheduler (پێشنیاری یەکەم)

بنەما: کۆدی job-ـەکان لە جێی خۆیان دەمێننەوە، بەڵام لە **container-ێکی جیاواز** (Cloud Run **Job**، نەک
service) کار دەکەن، کە بە **Cloud Scheduler** (cron-ی managed) trigger دەکرێن. ئەمە channel-ـی Firestore-ی
service-ـی سەرەکی هەرگیز دەستکاری ناکات.

**هەنگاو ١ — entrypoint-ێکی نوێ بۆ job runner** (فایلی نوێ، نموونە `backend/app/jobs_entrypoint.py`):

```python
"""Out-of-process scheduler entrypoint بۆ Cloud Run Jobs.
هەر job-ێک بە env-var ـی JOB_NAME دیاری دەکرێت، یەکجار کاردەکات، دواتر exit.
"""
import os, sys, asyncio, logging
logging.basicConfig(level=logging.INFO)

def main() -> int:
    job = os.environ["JOB_NAME"]
    from app.services import scheduler as s
    table = {
        "efakhata_drain":     s._job_efakhata_submission_drain,
        "outbox_dispatch":    s._job_outbox_dispatch,
        "payments_recon":     s._job_payments_reconciliation,
        "cbi_rate_refresh":   s._job_cbi_rate_refresh,
        "daily_backup":       s._job_daily_backup,
        "audit_retention":    s._job_audit_retention,
        "gdpr_hard_delete":   s._job_gdpr_hard_delete,
        # ...باقیماندە
    }
    fn = table.get(job)
    if fn is None:
        logging.error("unknown JOB_NAME=%s", job); return 2
    fn()   # هەر فەنکشنێک خۆی try/except-ـی هەیە
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**هەنگاو ٢ — دروستکردنی Cloud Run Job** (هەمان image، entrypoint-ـی جیاواز):

```bash
PROJECT=zoho-83cda; REGION=europe-west1
IMAGE="europe-west1-docker.pkg.dev/${PROJECT}/zoho-images/zoho-erp-backend:latest"

gcloud run jobs create zoho-scheduler-job \
  --image "$IMAGE" --region "$REGION" --project "$PROJECT" \
  --command python --args app/jobs_entrypoint.py \
  --memory 1Gi --cpu 1 --max-retries 1 --task-timeout 600s \
  --set-env-vars "ENVIRONMENT=production,SCHEDULER_ENABLED=false,FIREBASE_PROJECT_ID=${PROJECT}" \
  --set-secrets "SECRET_KEY=zoho-secret-key:latest,FIELD_ENCRYPTION_KEY=field-encryption-key:latest"
```

**هەنگاو ٣ — Cloud Scheduler cron بۆ هەر job-ێک** (یەک entry بۆ هەر تایمینگ، `JOB_NAME` بە override
دەدرێت). نموونە بۆ e-Fakhata drain (هەر 1m — Cloud Scheduler کەمترین granularity-ـی 1 خولەکە، بۆیە
30s-ـی in-process دەبێتە 1m لێرە کە بۆ drain-ـی queue تەواو باشە):

```bash
SA=gha-deployer@${PROJECT}.iam.gserviceaccount.com   # یان SA-ـێکی تایبەت بە scheduler

create_cron () {  # $1=name $2=cron $3=JOB_NAME
  gcloud scheduler jobs create http "$1" --project "$PROJECT" --location "$REGION" \
    --schedule="$2" --time-zone="Etc/UTC" \
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT}/jobs/zoho-scheduler-job:run" \
    --http-method=POST \
    --oauth-service-account-email="$SA" \
    --message-body="{\"overrides\":{\"containerOverrides\":[{\"env\":[{\"name\":\"JOB_NAME\",\"value\":\"$3\"}]}]}}"
}

create_cron efakhata-drain   "* * * * *"    efakhata_drain
create_cron outbox-dispatch  "* * * * *"    outbox_dispatch
create_cron payments-recon   "15 2 * * *"   payments_recon
create_cron cbi-rate-refresh "0 6 * * *"    cbi_rate_refresh
create_cron daily-backup     "0 2 * * *"    daily_backup
create_cron audit-retention  "0 6 1 * *"    audit_retention
create_cron gdpr-hard-delete "0 3 * * *"    gdpr_hard_delete
```

> ئەم SA پێویستی بە `roles/run.invoker` لەسەر job-ـەکە هەیە:
> `gcloud run jobs add-iam-policy-binding zoho-scheduler-job --member="serviceAccount:${SA}" --role=roles/run.invoker --region $REGION --project $PROJECT`

**هەنگاو ٤ — heartbeat لە Cloud Run Job:** چونکە alert #15 پشت بە log-line-ـی `scheduler.heartbeat` دەبەستێت،
زیاد بکە یەک Cloud Scheduler cron (هەر 5m) کە `JOB_NAME=heartbeat` بانگ بکات، کە `heartbeat_job()`-ـی
`observability/heartbeat.py` بانگ بکات. ئەمە log-metric-ـی `zoho/scheduler_heartbeat` زیندوو دەکاتەوە.

**هەڵبژاردەی دووەم (Pub/Sub):** ئەگەر fan-out یان retry-ـی پێچیدەترت دەوێت، Cloud Scheduler → Pub/Sub topic →
push subscription بۆ endpoint-ـێکی پارێزراوی Cloud Run. بۆ ئەم ٢٠ job-ـە، Cloud Scheduler → Job-ـی
ڕاستەوخۆ سادەترە و بەس.

> **مەترسیی هاوکات (concurrency):** ئەگەر max-instances-ی service > 1 بوایە، چەند instance هەمان job-یان
> دەخواند. لەگەڵ Cloud Run **Job** ئەمە نییە (تەنها یەک execution فایر دەکرێت)، بەڵام بۆ idempotency،
> job-ـەکان (وەک `daily_backup`) پێشتر per-org loop-یان هەیە کە continue-on-error-ـن.

---

### ٣.٤ Observability — `terraform apply` + Sentry + PagerDuty + SLO

#### ٣.٤.١ دۆخی ئێستا: هەرگیز apply نەکراوە

`terraform/monitoring/` تەواوە و پڕۆداکشن-گرەیدە — ٦ فایل، **٢٤ alert policy** (`alerts.tf`، `outputs.tf`
ـی `alert_policy_count` ئەمە دەژمێرێت) + **٦ dashboard** (`d1_api`…`d6_per_tenant` لە `dashboards.tf`) +
٢ uptime check + ٢ SLO (availability + latency) + ٧ log-based metric + BigQuery RUM dataset. بەڵام:

- **هیچ tfstate نییە** (هیچ `*.tfstate` نەدۆزرایەوە) → هەرگیز apply نەکراوە.
- **`backend "gcs" {}`** بەتاڵە (`main.tf`) — پێویستی بە `backend.hcl` هەیە کە بوونی نییە.
- **variables بۆ پڕۆژەی کۆن default-ـن** (`variables.tf`): `region=me-central1`، `frontend_base_url=https://app.zoho-kurdish.iq`،
  `api_base_url=https://api.zoho-kurdish.iq` — هیچیان لەگەڵ production زیندوو (`erpiq.systems` /
  `europe-west1`) ناگونجێن.

#### ٣.٤.٢ apply-کردن (لەسەر ماشینی بەکارهێنەر)

**یەکەم: GCS bucket بۆ tfstate** (یەکجار):

```bash
gcloud storage buckets create gs://zoho-83cda-tfstate \
  --project zoho-83cda --location europe-west1 --uniform-bucket-level-access
gcloud storage buckets update gs://zoho-83cda-tfstate --versioning  # state-ـی نهێنی بپارێزە
```

**دووەم: `backend.hcl`** (لە `terraform/monitoring/`):

```hcl
bucket = "zoho-83cda-tfstate"
prefix = "monitoring/production"
```

**سێیەم: `production.auto.tfvars`** (git-ignored — نهێنی تێیدایە؛ بپشکنە لە `.gitignore`):

```hcl
project_id        = "zoho-83cda"
region            = "europe-west1"
environment       = "production"
frontend_base_url = "https://erpiq.systems"
api_base_url      = "https://zoho-erp-backend-6plfqh2hiq-ew.a.run.app"
notification_email = "safaothman1631@gmail.com"

# PagerDuty (دوای دروستکردنی account + service — ٣.٤.٤):
# pagerduty_service_key = "<events-api-v2-integration-key>"   # یان TF_VAR_pagerduty_service_key

# Slack (ئیختیاری):
# slack_auth_token = "<oauth-token>"
# slack_channel    = "#alerts-prod"
```

> **ئاگاداری uptime check:** `api_base_url`-ـی `*.run.app` کاردەکات بۆ `/api/health` (uptime check لە
> `main.tf` پات `/api/health` بەکاردەهێنێت). بەڵام `frontend_base_url` دەبێت `erpiq.systems` بێت (Vercel)،
> نەک `app.zoho-kurdish.iq`-ـی کۆن کە هەرگیز deploy نەکراوە. هەروەها دڵنیابە `/api/health` ڕاستەقینە
> بوونی هەیە (نەک تەنها `/api/live`) — `cloudrun-deploy-env.yaml`-ـی healthcheck-ـی Dockerfile پات
> `/api/health` بەکاردەهێنێت، بۆیە بوونی هەیە.

**چوارەم: API-ـە پێویستەکان چالاک بکە + init + plan + apply:**

```bash
gcloud services enable monitoring.googleapis.com bigquery.googleapis.com \
  cloudtrace.googleapis.com logging.googleapis.com --project zoho-83cda

cd terraform/monitoring
terraform init -backend-config=backend.hcl
terraform plan  -var-file=production.auto.tfvars -out=tfplan
terraform apply tfplan
terraform output dashboard_urls       # ٦ URL-ی dashboard
terraform output alert_policy_count   # دەبێت 24 بداتەوە
```

> پێش apply، scheduler (٣.٣) دەبێت زیندوو بێت، نەینا alert #15 (scheduler-down) + #9/#10 (backup-verify)
> یەکسەر فایر دەکەن چونکە هیچ heartbeat/backup-ێک نییە.

#### ٣.٤.٣ Sentry DSN

`backend/app/observability/sentry.py` **mandatory-ـە لە production**: ئەگەر `SENTRY_DSN` نەبێت و
`ENVIRONMENT=production`، `SentryConfigurationError` هەڵدەدات. بەڵام `cloudrun-deploy-env.yaml`-ـی ئێستا
`SENTRY_DSN`-ـی نییە، و `main.py` تەنها init دەکات ئەگەر `settings.SENTRY_DSN` هەبێت (`if getattr(settings,
"SENTRY_DSN", "")`) — بۆیە ئێستا silently skip دەکرێت.

دروستکردنی project لە Sentry → وەرگرتنی DSN → دانانی وەک secret:

```bash
echo -n "https://<key>@<org>.ingest.sentry.io/<project>" | \
  gcloud secrets create zoho-sentry-dsn --data-file=- --project zoho-83cda
gcloud secrets add-iam-policy-binding zoho-sentry-dsn --project zoho-83cda \
  --member="serviceAccount:<cloud-run-runtime-SA>" --role=roles/secretmanager.secretAccessor

# دانانی لە service (یان لە cloudrun-deploy-env.yaml وەک secret-ref):
gcloud run services update zoho-erp-backend --region europe-west1 --project zoho-83cda \
  --update-secrets "SENTRY_DSN=zoho-sentry-dsn:latest"
```

> sample rates پێشتر set کراون لە کۆد (R6.4): `sample_rate=1.0` (100% error)، `traces_sample_rate=0.1`
> (10% perf). `deploy-production.yml` پێشتر `SENTRY_DSN=zoho-sentry-dsn:latest` set دەکات لە candidate —
> بۆیە یەک جار دروستکردنی secret-ـەکە بەسە.

#### ٣.٤.٤ PagerDuty + on-call

`main.tf` کەناڵی PagerDuty تەنها دروست دەکات ئەگەر `pagerduty_service_key != ""` (`local.enable_pagerduty`).
ئەگەر بەتاڵ بێت، alert-ـە page-worthy-ـەکان (CRITICAL) دەکەونە سەر email-ـی تەنها (`local.page_channels`
fallback). بۆ on-call-ـی ڕاستەقینە:

1. لە PagerDuty: دروستکردنی **service** + escalation policy + rotation (`zoho-platform`، کە
   `DISASTER_RECOVERY.md §11` ئاماژەی پێ دەکات).
2. زیادکردنی **Events API v2** integration → کۆپیکردنی integration/routing key.
3. دانانی لە `production.auto.tfvars` (یان `export TF_VAR_pagerduty_service_key=...`) → `terraform apply`.
4. پشتڕاستکردنەوە: `terraform output notification_channels` → دەبێت `pagerduty` id-ـێک نیشان بدات.

routing پێشتر لە کۆد دیاریکراوە: **CRITICAL** (POS checkout latency, 5xx, fast-burn, memory OOM,
backup-fail, scheduler-down, e-Fakhata reject, API uptime) → `page_channels` (PagerDuty)؛ **WARNING**
(Firestore quota, cert, slow-burn, RUM, rate-limit, CPU, instance-ceiling) → `alert_channels` (email/Slack).

#### ٣.٤.٥ SLO + error budget

پێشتر لە `main.tf` پێناسەکراون و apply دەبن لەگەڵ هەموو شتەکە:

- **Availability SLO** = `0.999` (سێ نۆ، `slo_availability_target`)، 28-day rolling، good-ratio = non-5xx.
- **Latency SLO** = 95%-ی request-ـەکان < `300ms` (`slo_api_latency_p95_ms`)، 28-day.
- **Burn-rate alerts** (Google SRE workbook): fast-burn (1h, 14.4×) → PAGE؛ slow-burn (6h, 6×) → TICKET.
  بۆ هەردوو availability و latency.

**Error budget-ـی مانگانە بۆ 99.9%:** ≈ 43m 12s دانابوون لە مانگدا. سیاسەت: ئەگەر بودجە تەواو بوو،
deploy-ی فیچەری نوێ ڕابگرە تا بگەڕێتەوە دۆخی سەوز (تەنها چاکسازیی reliability). ئەمە دەبێت لە
`docs/oncall/` تۆمار بکرێت (CLAUDE.md ئاماژەی پێدەدات کە escalation-policy لەوێیە).

**SLO-ـی تایبەت بە POS** (`slo_pos_checkout_p95_ms = 400`) پێشتر وەک alert #2 (CRITICAL) هەیە، چونکە POS
داهات-گرنگە (revenue-critical).

---

### ٣.٥ چاکردنی DR runbook + RTO/RPO + drill ڕاستەقینە

#### ٣.٥.١ چاکسازیی project/region لە DR (هەموو ئاماژەکان)

`DISASTER_RECOVERY.md` و `scripts/dr/*.sh` بە تەواوی بۆ پڕۆژەی کۆن نووسراون. ئەمانە دەبێت یەکبخرێنەوە
چونکە **drill-ـێکی ڕاستەقینە بەم گریمانانە دەکەوێتە سەر پڕۆژەیەکی هەڵە یان نەماو** و شکست دەهێنێت لە
ساتی هەرە خراپدا (incident-ی ڕاستەقینە).

| فایل | شوێن | بوو | بکە بۆ |
|------|------|------|------|
| `DISASTER_RECOVERY.md` §4.1, §4.2, §12 | Cloud Run rollback/failover | `zoho-erp` / `me-central1` / `erp-system-494716` | `zoho-erp-backend` / `europe-west1` / `zoho-83cda` |
| `DISASTER_RECOVERY.md` §4.3, §4.4 | Firestore PITR/import | `projects/erp-system-494716/databases/(default)` | `projects/zoho-83cda/databases/(default)` |
| `DISASTER_RECOVERY.md` §4.8 | Cloud DNS zone | project `erp-system-494716` | پڕۆژەی DNS-ـی ڕاستەقینەی `erpiq.systems` |
| `scripts/dr/restore-full.sh` | `PROJECT` default (L54) | `erp-system-494716` | `zoho-83cda` |
| `scripts/dr/restore-full.sh` | `LOCATION` default (L58) | `me-central1` | Firestore location-ی ڕاستەقینە (٣.١) |
| `scripts/dr/restore-full.sh` §7 | promotion command | `zoho-erp` / `me-central1` | `zoho-erp-backend` / `europe-west1` |
| `scripts/dr/restore-tenant.sh` | هەمان default-ـەکان | — | هەمان چاکسازی |
| `scripts/dr/provision-dr.sh` | `PROJECT`/`PRIMARY`/`SECONDARY` (L52-56) | `erp-system-494716` / `ME-CENTRAL1` | `zoho-83cda` / `EUROPE-WEST1` (+ secondary واقیعی) |
| `.github/workflows/dr-backup-restore-verify.yml` | `GCP_PROJECT`/`FIRESTORE_LOCATION` (L48,50) | `erp-system-494716` / `me-central1` | `zoho-83cda` / Firestore location |

> **تێبینی promotion-ـی restore-full.sh:** کۆمانتی promotion پات `FIRESTORE_DATABASE_ID` env-var-ـی
> backend دادەنێت. دڵنیابە `main.py`/`config.py` ئەم env-var-ـە دەخوێنێتەوە بۆ هەڵبژاردنی database؛ ئەگەر نا،
> promotion-ـەکە کاری ناکات و دەبێت بە secret-swap (وەک تۆماری migration) بکرێت. ئەمە یەکجار بپشکنرێت.

#### ٣.٥.٢ RTO/RPO (پێشتر دیاریکراو، تەنها reaffirm)

`DISASTER_RECOVERY.md §1` پێشتر RTO/RPO-ـی دیاریکراوی هەیە — ئەمە بهێڵە و بیکە بە official:

| Tier | RTO | RPO |
|------|-----|-----|
| Cloud Run + Vercel (user-facing) | 1 hour | 5 min |
| Firestore (accounting/sales) | 1h (PITR) / 4h (GCS) | 1 min (PITR) / 24h (GCS) |
| Audit log + invoices (legal) | 4 hours | 1 hour |
| RUM/analytics | 24 hours | 24 hours |

این هەژمارەکان دەبێت پشتڕاست بکرێن بە **drill-ـی ڕاستەقینە** (خوارەوە)، نەک تەنها لەسەر کاغەز بمێننەوە.

#### ٣.٥.٣ PITR (پشتڕاستکردن + چالاککردن)

`DISASTER_RECOVERY.md §6` دەڵێت PITR لەسەر `zoho-83cda` چالاکراوە لە 2026-05-26. ئەمە تەنها یەک
فەرمانە بۆ پشتڕاستکردنەوە — دەبێت بکرێت:

```bash
gcloud firestore databases describe --database="(default)" --project=zoho-83cda \
  --format="value(pointInTimeRecoveryEnablement)"
# پێویستە بداتەوە: POINT_IN_TIME_RECOVERY_ENABLED
```

ئەگەر نەبوو، `scripts/dr/provision-dr.sh --project zoho-83cda --dry-run` سەرەتا، دواتر بێ `--dry-run`.
(ئەو سکریپتە idempotent-ـە و PITR + dual-region bucket + WORM retention + lifecycle دادەنێت.)

#### ٣.٥.٤ Drill-ـی ڕاستەقینە (نەک illustrative)

`dr-backup-restore-verify.yml` پێشتر **drill-ـی restore-to-sandbox-ـی ئۆتۆماتیکی هەفتانەی** هەیە (Sundays
03:30 UTC): export-ـێکی هەڕەمەکی هەڵدەبژێرێت، restore دەکاتە sandbox DB-ـێکی throwaway، integrity-sample
دەکات (`verify_restore_sample.py`)، دواتر sandbox-ـەکە دەسڕێتەوە. ئەمە تەنها کار دەکات ئەگەر:

1. **WIF secrets set بن بۆ `zoho-83cda`** (`GCP_WIF_PROVIDER` + `GCP_DR_SERVICE_ACCOUNT`) — وەرنا job-ـەکە
   به-clean skip دەکات (gate لە L57-65). ئەم SA پێویستی بە `roles/datastore.importExportAdmin` +
   `roles/datastore.owner` (بۆ create/delete-ی sandbox DB) + GCS read هەیە.
2. **repo variable-ـەکان نوێ بکرێنەوە:** `DR_GCP_PROJECT=zoho-83cda`، `DR_FIRESTORE_LOCATION=<location>`،
   `BACKUP_GCS_BUCKET=zoho-83cda-erp-backups`:
   ```bash
   gh variable set DR_GCP_PROJECT       --body "zoho-83cda"
   gh variable set DR_FIRESTORE_LOCATION --body "<firestore-location>"
   gh variable set BACKUP_GCS_BUCKET    --body "zoho-83cda-erp-backups"
   ```

**یەکەم drill-ـی manual (لەسەر ماشینی بەکارهێنەر، یەکجار، بۆ پشتڕاستکردنی RTO):**

```bash
# پلانی dry-run (هیچ mutation)
scripts/dr/restore-full.sh --project zoho-83cda --bucket zoho-83cda-erp-backups \
  --location <firestore-location> --dry-run

# restore-ـی ڕاستەقینە بۆ sandbox، + کات بگرە بۆ بەراورد لەگەڵ RTO (1-4h)
time scripts/dr/restore-full.sh --project zoho-83cda --bucket zoho-83cda-erp-backups \
  --destination dr-drill-$(date -u +%Y%m%d) --location <firestore-location> --yes

# تەواوبوون: sandbox-ـەکە بسڕەوە
gcloud firestore databases delete --database=dr-drill-<date> --project zoho-83cda --quiet
```

ئەنجامەکە (کاتی ڕاستەقینەی restore + integrity) لە `DISASTER_RECOVERY.md §10` (drill log) تۆمار بکە، و
بەراوردی بکە لەگەڵ RTO budget-ـی §1. ئەگەر تێپەڕاند، follow-up issue دروست بکە.

**PITR drill (تری، quarterly)** — §8: لە staging یان clone، document-ـێکی test دروست بکە، restore بۆ
`T-5min`، دڵنیابە document-ـەکە نییە. ئەمەش لە drill log تۆمار بکە.

---

### ٣.٦ Scaling — کەی Cloud Run → GKE، HPA، multi-region

#### ٣.٦.١ Single-uvicorn-process — سنوورە بنەڕەتییەکە

`Dockerfile` بە ئەنقەست single-process-ـە (بێ `--workers`):

```dockerfile
# Single process (NO --workers): on Cloud Run you scale by INSTANCES, not by
# in-container workers. `--workers N` forks child processes, and forking a
# process that holds a Firestore gRPC channel corrupts the channel ...
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers ...
```

واتە concurrency تەنها لە دوو ڕێگەوە دێت: (أ) `--concurrency` (request-ـی هاوکات لەناو یەک instance —
ئاسایی لە async FastAPI)، (ب) `--max-instances` (ژمارەی container). **هیچ کاتێک `--workers` زیاد مەکە** —
هەمان channel-corruption-ـی scheduler دەهێنێتەوە.

دۆخی ئێستا (`redeploy-backend.ps1`): `--cpu 1 --memory 1Gi --min-instances 1 --max-instances 3
--concurrency 20`. ئەمە بۆ pre-launch تەواوە.

#### ٣.٦.٢ Cloud Run scaling-ـی نۆرماڵ (پێش GKE)

پێش بیرکردنەوە لە GKE، ئەم چەند knob-ـە بەکاربهێنە — Cloud Run بۆ زۆربەی scale-ـی ERP بەسە:

- **بەرزکردنی `--max-instances`** کاتێک alert #24 (instance-ceiling، threshold=18 لە 20) فایر دەکات.
- **بەرزکردنی `--concurrency`** (مثلاً 20→40) ئەگەر CPU-ی هەر instance کەمە بەڵام instance-ـەکان زۆرن.
- **`--cpu 2` + `--memory`** کاتێک alert #22 (CPU>80%) یان #23 (memory>90% OOM) فایر دەکات.
- **`--min-instances ≥ 1`** بۆ نەهێشتنی cold-start (پێشتر set کراوە؛ هەروەها بۆ scheduler-ـی in-process
  پێویست بوو — بەڵام دوای ٣.٣ ئەو هۆکارە نامێنێت).

#### ٣.٦.٣ کەی بچیتە GKE / K8s

Cloud Run-ـی بهێڵە تا یەکێک لەمانە ڕووبدات (هیچیان لە pre-launch دۆخدا ڕوویان نەداوە):

- **request-ـی زۆر دوور و درێژ (long-lived):** WebSocket/streaming-ی بەردەوام، یان job-ـی > 60 خولەک
  (Cloud Run task timeout سنووردارە). ئەگەر e-Fakhata/backup-ـەکان > 10 خولەک بوون، Cloud Run **Job**
  (٣.٣) بەسە؛ GKE تەنها بۆ کاری زۆر درێژتر.
- **پێداویستیی sidecar/DaemonSet-ی پێچیدە** (service mesh، per-node agent) کە Cloud Run پشتگیری ناکات.
- **کۆنترۆڵی وردی autoscaling** (custom metrics، scale-to-specific-replica) کە Cloud Run knob-ـەکانی
  بەسیان نییە — لێرە **HPA** (HorizontalPodAutoscaler) بەکاردێت کە لەسەر CPU/memory/custom-metric replica
  زیاد/کەم دەکات.
- **هاوبەشی node-ی هەرزانتر لە scale-ی گەورە:** لە throughput-ـی زۆر بەردەوامدا، GKE Autopilot/Standard
  دەکرێت لە Cloud Run هەرزانتر بێت (بەڵام operational-overhead-ـی زۆر زیاترە — patch، upgrade، security).

**ئەگەر بڕیار بە GKE درا:** Autopilot دەست پێ بکە (managed nodes)؛ هەمان single-process container بهێڵە
بەڵام `replicas` بە HPA کۆنترۆڵ بکە (نەک `--workers`)؛ Firestore gRPC channel هەر per-pod-ـە بۆیە
fork-safety-ـی هەمان دەمێنێتەوە. Workload Identity (GKE) جێگەی WIF-ـی CI دەگرێتەوە بۆ pod→GCP auth.

#### ٣.٦.٤ Multi-region

پێش launch پێویست نییە، بەڵام پلانەکە (لە `DISASTER_RECOVERY.md §4.2` ئاماژەی پێدراوە، بەڵام region-ـی
کۆنی تێدایە) دەبێت چاک بکرێت:

- **Cloud Run multi-region:** deploy-ی هەمان image بۆ region-ـی دووەم (مثلاً `europe-west4`)، دواتر
  **Global External HTTPS Load Balancer** + Serverless NEG لەسەر هەردوو region بۆ failover/geo-routing.
  ئەمە بکە بە DR §4.2 (پێشتر "pre-warmed standby" دەڵێت بەڵام بە DNS-CNAME-ـی manual — LB باشترە).
- **Firestore:** multi-region (`eur3`) خۆی replication-ـی دەکات؛ یان dual-region GCS export (پێشتر
  `provision-dr.sh` ئەمە بۆ backup bucket دادەنێت، RPO SLA 15min بە turbo replication).
- **RUM/BigQuery:** `bigquery_location` لە `variables.tf` بە ئەنقەست لە compute-region جیاکراوەتەوە
  (default `EU`) چونکە BQ لە هەندێ region بەردەست نییە — ئەمە بهێڵە.

---

### ٣.٧ پشتڕاستکردنەوە (Windows / cloud) + ڕیزبەندیی rollout

**ڕیزبەندیی جێبەجێکردن (deliberate — هەر هەنگاوێک پشتگیری ئەوی دواتر دەکات):**

1. **یەکخستنی project/region** (٣.١) لە CI workflows + Terraform vars + DR scripts/runbook. هیچ runtime
   ناگۆڕێت — تەنها چاکردنی drift.
2. **Out-of-process scheduler** (٣.٣) — **پێش** observability apply، نەینا alert #15 (scheduler-down) +
   #9/#10 (backup) یەکسەر فایر دەکەن.
3. **WIF بۆ `zoho-83cda`** + سڕینەوەی deploy workflow-ـی دووبارە + چاکردنی gate-ـەکان (٣.٢).
4. **Sentry DSN secret** (٣.٤.٣) — چونکە production-mandatory-ـە، ئەمە پێش deploy-ـی نوێ.
5. **PagerDuty service** (٣.٤.٤) → `terraform apply` (٣.٤.٢) — ٢٤ alert + ٦ dashboard.
6. **DR scripts/runbook چاکسازی** (٣.٥) + repo variables بۆ `dr-backup-restore-verify.yml`.
7. **یەکەم DR drill-ـی manual** (٣.٥.٤) + تۆمارکردن لە drill log.

**فەرمانەکانی پشتڕاستکردنەوە (لەسەر ماشینی بەکارهێنەر):**

```powershell
# CI/CD — push بکە بۆ branch، dispatch بکە، بزانە startup_failure نەماوە
gh workflow run "Production Deploy"
gh run watch --exit-status

# Backend زیندوو (cloud)
curl.exe -sf https://erpiq.systems/api/health
gcloud run services describe zoho-erp-backend --region europe-west1 --project zoho-83cda `
  --format="value(status.url,status.traffic)"

# Scheduler (out-of-process) — execution-ـی یەکەم بپشکنە
gcloud run jobs executions list --job zoho-scheduler-job --region europe-west1 --project zoho-83cda
gcloud scheduler jobs list --location europe-west1 --project zoho-83cda

# Observability — apply سەرکەوتوو بوو؟
cd terraform/monitoring; terraform output alert_policy_count   # 24
gcloud monitoring dashboards list --project zoho-83cda --format="value(displayName)" | Measure-Object  # 6

# Sentry — DSN زیندووە؟ (لۆگی startup-ی Cloud Run)
gcloud run services logs read zoho-erp-backend --region europe-west1 --project zoho-83cda `
  --limit 50 | Select-String "sentry"

# PITR + backup
gcloud firestore databases describe --database="(default)" --project zoho-83cda `
  --format="value(pointInTimeRecoveryEnablement)"
gcloud storage ls gs://zoho-83cda-erp-backups/firestore/ | Select-Object -Last 3
```

**Gate-ـی frontend (پێش deploy، وەک CLAUDE.md):**

```powershell
cd frontend
npx tsc --noEmit            # 0
npm run lint                # exit 0 (0 error)
npm run build               # exit 0
npm run test                # 1322/1322
```

> **تێبینیی پاکیی repo (لە P0):** `gha-key.json` + `deploy/TEST*.txt` پێشتر بە `git rm --cached` لابران
> (commit نەکراون). دڵنیابە CI هیچ کلیلی JSON-ـی deploy بەکارناهێنێت — تەنها WIF (keyless). `deploy/`-ـی
> `*.ps1` سکریپتەکان (`migrate-backend-to-zoho-83cda.ps1`، `redeploy-backend.ps1`) source-of-truth-ـی
> ڕاستەقینەن بۆ region/project دروست (`europe-west1`/`zoho-83cda`) و دەکرێن وەک مۆدێل بۆ یەکخستنی CI.
## ٤) کۆچکردنی داتا (ETL) · ستراتیژیی تێست/QA

> ئەم بەشە دوو ئەرکی launch-blocking دادەپۆشێت: (الف) چۆن داتای کڕیارێکی نوێ (Excel/CSV/سیستەمی کۆنی هەژمارداری) بە شێوەیەکی دووبارەکراوە و سەلامەت بهێنینە ناو سیستەمەکە؛ (ب) چۆن لە دۆخی ئێستای تێستەوە (کۆد دەکار دەکات بەڵام coverage-گەیتی ڕاستەقینەی نییە) بگەینە پێشکەوتنێکی launch-ready. هەموو شت لەسەر بنەمای کۆدی ڕاستەقینەی ناو ڕیپۆ نووسراوە.

---

### ٤.١ دۆخی ئێستا — ئەوەی هەیە و ئەوەی کەمە (ground truth)

**کۆچکردن/import-ی بەردەست (دوو ڕێگەی جیاواز، یەک نەکراون):**

| فایل | ئەوەی دەیکات | بەربەست |
|------|--------------|----------|
| `backend\app\api\imports.py` + `backend\app\services\import_service.py` | `POST /api/import/preview` (یەکەم ١٠ ڕیز)؛ `POST /api/import/{entity_type}` بۆ `contacts/items/accounts/bank_transactions`؛ CSV **و** Excel (`openpyxl`)؛ `dry_run=true` بانگی `validate_rows()` دەکات (بێ نووسین) | **هیچ تۆماری job، هیچ rollback، هیچ idempotency.** هەر ڕیز `uuid4()` ی نوێ وەردەگرێت → دووبارە import = داتای دووبار. `float(...)` بێ try جیا → ڕیزی خراپ تەنها لە import-ی ڕاستەقیندا دەردەکەوێت |
| `backend\app\api\migration.py` | `POST /api/migration/dry-run` + `POST /api/migration/apply` بۆ `contacts/items/chart_of_accounts`؛ **تۆماری job دەنووسێت** (`migration_jobs`: status `running/completed/partial/failed`, `inserted`, `failures[:100]`)؛ `GET /api/migration/jobs[/{id}]` | **تەنها CSV** (نە Excel)؛ **هیچ rollback** (لە `apply`-دا هەر ڕیز سەربەخۆ `repo.create` دەکات، شکستی نیوەڕێ = داتای ناتەواو)؛ **هیچ idempotency** (دووبارە apply = دووبار)؛ هیچ opening-balance / JE generation نییە |
| `backend\app\api\exports.py` | ١٧ ئەندپۆینتی `GET /api/export/*` (invoices, bills, journal-entries, trial-balance, customers, products, pos-sales, inventory, P&L, balance-sheet, cash-flow, aging, ...) بە `?format=excel\|csv` | بۆ round-trip و auditor handoff باشە؛ بەڵام schema-ی export **یەک ناکات** لەگەڵ schema-ی import (مثلاً export-ی customers ستوونی `display_name` دەنووسێت، import-ی contacts `name` پێشینە دەکات) |

**بنەماکانی idempotency/versioning کە پێشتر لە `backend\app\firestore\base.py` هەن (دەبێت ETL بەکاریان بهێنێت):**
- `VersionConflict` + `update_versioned(..., expected_version=...)` — کۆنترۆڵی هاوکاتیی ئۆپتیمیستی (OCC).
- `WRITE_MODEL` (Pydantic validation لە create/update) و `SCHEMA_TARGET_VERSION` (lazy migration لە خوێندنەوەدا).
- HTTP-ی گشتی `Idempotency-Key` لە `backend\app\middleware\idempotency_http.py` (لیستی prefix؛ ETL-ی نوێ دەبێت prefix-ی خۆی زیاد بکات).

**دۆخی تێست (ground truth، نەک ئاواتخوازی):**
- باکێند: `153` فایلی `test_*.py` لە `backend\tests\`؛ CLAUDE.md ئاماژە بە **~١٣٢١–١٣٣٣ تێستی باکێند** دەکات (شەپۆڵی scale-foundation: «1333 سەرکەوتوو / 2 شکست»). بەڵام `backend\pytest.ini` هێشتا `--cov-fail-under=0` ـە — واتە coverage **پێوەکراوە بەڵام هەرگیز build ناشکێنێت**. ئەمە لە P0 بەئەنقەست وەسا دانراوە تا بەرەبەرە بەرز بکرێتەوە.
- فرۆنتئیند: **٢٩٢** فایلی پەڕەی `.tsx` لە `frontend\src\pages\`، بەڵام تەنها **٤** فایلی تێستی پەڕەیی (`*.test.tsx` لەناو `pages\`)؛ کۆی گشتیی تێستی یەکەی فرۆنتئیند `67` فایل (`1322/1322` پاسد، بڕوانە vite.config forks-pool خوارەوە). واتە ~٢٨٨ پەڕە تێستی یەکەییان نییە.
- «تێستی contract»-ی ئێستا (`backend\tests\contract\test_every_repository.py`) **contract-ی ڕاستەقینە نییە**: تەنها `hasattr(repo_cls, "get"/"create"/...)` و بوونی پارامەتری `expected_version` پشکنین دەکات — هیچ behavior یان شێوەی payload/response تاقی ناکاتەوە.
- e2e: ٢٦+ فایلی Playwright لە `frontend\e2e\` و `frontend\tests\e2e\`. زۆربەیان **gated** ن (مثلاً `premium-glass-roles.spec.ts` بە `RUN_GLASS_SNAPSHOTS=1`)، یان `test.skip` دەکەن کاتێک API/session بەردەست نییە. ئەو ٢٩ «شکستە»ی پێش-بوونیار کە لە CLAUDE.md باسکراون = هەر هەمان Playwright spec-ەکان + `scanner-service.test.ts` (import-ی worker-ی نەبوو) + `buildAddOption` (structural) — هیچیان لۆجیکی app ناشکێنن.
- بار/Load: k6 suite-ی تەواو لە `load\k6-suite\` (contacts-search, dashboard, invoice-list, pos-checkout, _shared) + workflow-ی `.github\workflows\k6-nightly.yml` و `load-test.yml`. SLO-ـەکان لە `_shared.js` پێناسەکراون.

---

### ٤.٢ A — کۆچکردنی داتای کڕیار (Repeatable ETL)

ئامانج: importer-ێکی **یەک-جار-بنووسە، هەموو-کات-بەکاریبهێنە** کە لە پایپلاینی شەش-قۆناغیدا کار بکات، بۆ هەر سەرچاوەیەک (Excel/CSV/dump-ی سیستەمی کۆنی هەژمارداری). ئەمە دەبێت لەسەر `migration.py` (job-tracking-ی هەیە) بنیات بنرێت، نەک `imports.py` (بێ-job).

#### ٤.٢.١ پایپلاینی شەش قۆناغ

```
1. Profile   → سەرچاوە بخوێنەوە، ستوون/جۆر/null/دووبارە دەربخە (هیچ نانووسێت)
2. Cleanse   → trim، ناوی ستوون نۆرماڵایز بکە، جۆر coerce بکە، ناونیشانی IQ ڕێکبخە
3. Map       → ستوونی سەرچاوە → فیلدی ناوخۆ بەپێی قاڵبی mapping (بۆ هەر سەرچاوە)
4. Load      → بە batch بنووسە لەناو یەک migration job، بە idempotency-key
5. Validate  → دوای-load: کۆکردنەوەی هەژمار، تاقیکردنەوەی هاوسەنگیی JE، ڕاپۆرت
6. Rollback  → ئەگەر validate تێکچوو یان بەکارهێنەر داوای کرد: job-ـی پێچەوانە بکە
```

هەر قۆناغ دەبێت **idempotent** بێت و **dry-run** پشتگیری بکات (وەک `migration.py/dry-run`-ی ئێستا، بەڵام فراوانتر).

#### ٤.٢.٢ گۆڕانکارییە پێویستەکان (لەسەر `migration.py`)

1. **Idempotency بە `source_row_key`:** بۆ هەر ڕیز کلیلێکی بەرز (مثلاً `code` بۆ chart_of_accounts، `email\|phone` بۆ contacts، `sku` بۆ items) دروست بکە و پێش `repo.create` بەدوایدا بگەڕێ (upsert). ئەمە دووبارە-import = no-op دەکات (هەمان نموونەی `/api/currencies`-ی idempotent upsert-ی quick-create).
2. **Batch + transaction-per-batch:** لە جیاتی `repo.create`-ی تاک-ڕیز، Firestore `WriteBatch` (٥٠٠ ڕیز/batch) بەکاربهێنە. هەر batch-ێک یان تەواو دەنووسرێت یان هیچ → شکستی نیوەڕێ داتای ناتەواو بەجێناهێڵێت.
3. **Rollback log:** لە `migration_jobs`-دا لیستی `created_ids` تۆمار بکە. ئەندپۆینتی نوێ `POST /api/migration/jobs/{id}/rollback` → هەموو ئەو docـانە بسڕەوە (soft-delete بەلایەنی کەمەوە). ئەمە ئەو کەلێنە پڕ دەکاتەوە کە ئێستا هیچ rollback-ێک نییە.
4. **Excel بۆ migration:** `parse_excel()`-ی ئێستای `import_service.py` بهێنە ناو `migration.py/_parse_csv` (یەک fork بکە بۆ `_parse_table` کە پشت بە پاشگری فایل دەبەستێت).
5. **Validation report (structured):** dry-run ئێستا `valid_rows/error_count/errors[:50]` دەداتەوە — ئەمە فراوان بکە بۆ: warning (نەک تەنها error) وەک «contact-ی دووبار بەپێی email»، «account-code-ی نەدۆزراوەی parent»، و خشتەی mapping-ی کارکراو.

#### ٤.٢.٣ قاڵبی Mapping بۆ هەر سەرچاوە

`_map_row()`-ی ئێستا hardcoded-ـە (تەنها `name`/`Name`). بیگۆڕە بۆ ڕیجستریی قاڵب — هەر سەرچاوەیەک (مثلاً «QuickBooks-IQ»، «Excel-ی دەستی»، «سیستەمی کۆنی فلانی») پڕۆفایلێکی JSON-ی mapping-ی خۆی هەبێت:

```jsonc
// نموونەی قاڵب — chart_of_accounts لە سەرچاوەیەکی عەرەبی
{
  "source": "legacy-arabic-coa",
  "entity": "chart_of_accounts",
  "columns": {
    "رقم الحساب": "code",
    "اسم الحساب": "name",
    "النوع":      "type"
  },
  "transforms": { "type": { "أصول": "asset", "خصوم": "liability" } }
}
```

#### ٤.٢.٤ Opening balances + JE generation (کەلێنی گەورە)

ئەمە ئێستا **بەتەواوی نییە** — نە لە `imports.py` و نە لە `migration.py`. هەرچەند `import_accounts()` فیلدی `opening_balance` دەخوێنێتەوە، بەڵام تەنها بەهای `balance` دادەنێت؛ هیچ Journal Entry-یەکی هاوسەنگ دروست ناکات. بۆ launch پێویستە:

1. سەرچاوەی opening trial balance وەربگرە (account_code → debit/credit).
2. **یەک** Journal Entry-ـی «Opening Balances» دروست بکە بەرامبەر `Opening Balance Equity` (بەپێی نموونەی GL-ی P0-finance).
3. دڵنیابە کۆی debit == کۆی credit پێش نووسین (هەر invariant-ی JE-validation کە لە تێستی `je_validation` ـی P0 هەیە).
4. open invoices/bills وەک سند جیاکراو import بکە (نەک تەنها balance)، تا aging-ـی receivables/payables ڕاست بێت — exporter-ی aging پێشتر بەردەستە بۆ پشتڕاستکردنەوە.

> **ڕێسای دارایی (P0):** هیچ منطقی opening-balance یان GL بێ تێستی Decimal-بنیاد و هاوسەنگیی JE نانووسرێت. ئەمە لە `_deltas/P0-finance-correctness-IMPLEMENTATION.md` بەئەنقەست **جێبەجێ نەکراوە** هەتا تێستی پێویستی هەبێت.

---

### ٤.٣ B — ستراتیژیی تێست/QA

#### ٤.٣.١ هەرەمی تێست (Test Pyramid) + گەیتەکانی CI

```
        ╱╲   e2e (Playwright)         ← کەم، تەنها flow-ی سەرەکی (O2C, P2P, POS)
       ╱──╲  contract + integration   ← schema/behavior-ی ڕاستەقینە، نەک hasattr
      ╱────╲ unit (pytest + vitest)    ← بنکە؛ coverage-گەیت بەرەبەرە بەرز
```

| گەیت | ئێستا | ئامانج |
|------|--------|--------|
| `pytest --cov-fail-under` | `0` (ناشکێنێت) | بەرەبەرە بەرز بکە (٤.٣.٢) |
| frontend `vitest` | `1322/1322` پاس | بپارێزە؛ پەڕەی نوێ = تێستی نوێ |
| `tsc --noEmit` | `0` هەڵە | بپارێزە (blocking) |
| `lint` | exit 0 (٠ error / ~٢٩٠٠ warning) | warning بەرەبەرە کەم بکە |
| `rtl:audit` / `audit:glass-modals` | پاس | بپارێزە |
| e2e | gated/skip | un-gate-ی flow-ی سەرەکی لە CI (٤.٣.٤) |

#### ٤.٣.٢ بەرزکردنەوەی Coverage (per-package ramp)

`--cov-fail-under=0` بەرەبەرە بەرز مەکە بە یەک ژمارەی گشتی — ئەمە CI دەشکێنێت بەهۆی مۆدیوولی بێ-تێست. لەجیاتی، **per-package floor** دابنێ لە `pytest.ini` یان بە `coverage` config، و یەکەم ئەو مۆدیوولە گەورانە تاقی بکەوە کە ئێستا کەمترین coverage و بەرزترین مەترسییان هەیە:

ڕیزبەندیی پێشینە (داتا/پارە یەکەم، بەپێی مەترسی):
1. `app\api\invoices.py` + service — O2C-ـی ناوەند، GL دروستدەکات.
2. `app\api\purchase_orders.py` — P2P.
3. `app\api\crm*.py` — گەورەترین سەرئاو، کەمترین coverage.
4. `app\api\hr*.py` + `payroll` — هەژماری مووچە، حەساس.
5. `app\api\manufacturing.py` — BOM/costing.

ستراتیژی: بۆ هەر یەک، تێستی unit زیاد بکە تا ≥٧٠٪، پاشان floor-ی هەمان مۆدیوول بەرز بکە (مثلاً `--cov-fail-under` گشتی لە `0`→`40`→`60` بەرز بکە کاتێک ئەم ٥ مۆدیوولە دەگەنە ئامانج). هەرگیز floor بەرز مەکە پێش ئەوەی تێست نووسرابێت.

#### ٤.٣.٣ تێستی Contract-ـی ڕاستەقینە

`backend\tests\contract\test_every_repository.py` تەنها بوونی method پشکنین دەکات. جێگرەوەی بکە/زیادی بکە بە تێستی schema/behavior-ـی ڕاستەقینە:

1. **Schema contract:** بۆ هەر ئەندپۆینتی سەرەکی، شێوەی response بەرامبەر مۆدێلی Pydantic/JSON-Schema تاقی بکەوە (نەک تەنها `hasattr`). نموونە: `GET /api/invoices/{id}` دەبێت `total`, `balance_due`, `status`-ی لیستی دیاریکراو، و `currency_code` بگەڕێنێتەوە.
2. **Behavior contract:** نموونەی ڕاستەقینی هەڵسوکەوت — «POST-ـی دووبار بە هەمان `Idempotency-Key` یەک سند دروست دەکات»، «`update_versioned` بە version-ی هەڵە `409 VersionConflict` دەداتەوە»، «import-ـی دووبار no-op-ـە».
3. **Round-trip contract:** export → import → export دیسان دەبێت هەمان داتا بداتەوە (ئەمە import/export schema-ـەکان یەکدەخات — کەلێنی ٤.١).

#### ٤.٣.٤ e2e — un-gate-کردن لە CI + flow-ی سەرەکی

ئەو spec-ـانەی پشت `RUN_GLASS_SNAPSHOTS=1` و `test.skip(login unavailable)`-ـن، لە CI ناڕۆن. بۆ launch-confidence پێویستە سێ flow-ـی سەرەکی **بێ-gate** بن لەسەر backend-ی staging-ـی زیندوو:

- **O2C (Order-to-Cash):** contact → invoice → payment → بینینی balance. (`frontend\e2e\scenarios\shopkeeper_core.spec.ts` پێشتر ئەمەی هەیە بەڵام skip دەکات کاتێک session نییە.)
- **P2P (Procure-to-Pay):** vendor → purchase-order → bill → payment.
- **POS:** session بکەرەوە → سەبەتە → tender → settle → receipt (`scenarios\shopkeeper_core.spec.ts/POS offline sync` پێشتر شێوەی payload تاقی دەکاتەوە).

پلان:
1. لە CI، backend-ـی staging + دیمۆ-یوزەری دیاریکراو (`Demo@2026`، بڕوانە `premium-glass-roles.spec.ts`) دروست بکە تا `tryLogin` skip نەکات.
2. یەک Playwright project-ـی نوێ `@critical` دروست بکە کە تەنها ئەم سێ flow-ـە ڕان بکات (نەک visual snapshot-ـی gated).
3. لە workflow-ـی CI، `@critical` blocking بکە؛ visual snapshot-ـەکان opt-in بهێڵەرەوە.

#### ٤.٣.٥ Performance / Load (k6) + نیگەرانیی single-process

suite-ـی k6 پێشتر بەردەستە (`load\k6-suite\`) لەگەڵ SLO-ـی ڕاستەقینە لە `_shared.js`:

| پۆل | p95 | ڕێژەی هەڵە |
|-----|-----|------------|
| read-1 | 150ms | <0.1% |
| read-N | 300ms | <0.1% |
| write-1 | 350ms | <0.2% |
| pos-co | 400ms | <0.05% |
| report | 1500ms | <0.5% |

پلان:
1. `k6-nightly.yml`-ـەکە بەرامبەر staging-ـی زیندوو بەکار بهێنە (env: `K6_BASE_URL`, `K6_USER_EMAIL/PASSWORD` — هیچ credential-ـی hardcoded نییە، `_shared.js` fail-fast دەکات).
2. سەرەتا `pos-checkout.js` (٥٠ VU، ١٠ خولەک sustained) و `invoice-list` ڕان بکە — ئەمانە گرنگترینن بۆ کڕیاری عێراق.
3. **نیگەرانیی single-process:** backend لەسەر یەک Cloud Run service-ـی `zoho-erp-backend`-ـە. APScheduler (١٩+ job: reconciliation، e-Fakhata drain، status-emit...) لە هەمان process-دا ڕان دەکات. لەژێر بار، job-ـە cron-ـەکان دەتوانن لەگەڵ داواکاریی HTTP کێبڕکێ بکەن. k6-ـی sustained دەبێت ئەمە دەربخات؛ ئەگەر p95 تێپەڕی، scheduler بۆ worker/Cloud Run job-ـی جیا بگوازەوە (نەک هەمان instance).

#### ٤.٣.٦ سیاسەتی تێستی Flaky (forks-pool fix)

ئەم پڕۆژەیە پێشتر باگی ژینگەیی flaky-ی چارەسەرکردووە — **مۆدێل بکە، مەیگەڕێنەوە:**
- لە `frontend\vite.config.ts`، vitest بە `pool: 'forks'` + `maxForks: 4` ڕان دەکات (نەک `threads`). هۆکار لە کۆمێنتدا تۆمارکراوە: لەسەر ئەم بۆکسە (٢٤ CPU بەڵام ~١٦GB RAM)، thread-pool heap-ی هاوبەش گەورە دەکرد تا تێستە قورسەکان (HelpPanel render، SystemHealthPage retry، PBT sweep) دەچوونە GC death-spiral و timeout دەبوون — هەرچەند هەر فایلێک بە تەنها ١٠٠٪ تێدەپەڕی.
- `testTimeout: 30_000` گشتی + `}, 60_000)` بۆ تاقە تێستی قورس.

سیاسەت بۆ هەر تێستێکی flaky-ـی نوێ:
1. سەرەتا بپشکنە ئایا flake-ـەکە **ژینگەییە** (memory/CPU/timer) یان **باگی ڕاستەقینەی کۆد** (وەک associativity-ـی `mergeLine`-ـی POS کە چارەسەرکرا). هەرگیز timeout بەرز مەکە بۆ شاردنەوەی باگی ڕاستەقینە.
2. test-pollution چارەسەر بکە لە بنەوە (`vi.doMock` leak، `waitFor`-ـی async render) — نموونەکان لە CLAUDE.md.
3. quarantine (skip) تەنها کاتێک پشتڕاست بوویت flake-ـەکە ژینگەییە و نەک ڕیگرێشن، لەگەڵ تیکێتی follow-up.

---

### ٤.٤ فەرمانەکانی پشتڕاستکردنەوە (Windows / PowerShell)

> ئاگاداری: mount-ـی sandbox-ی Linux دەکرێت کۆن بێت و pytest-ـی باکێند ناتوانێت بەتەواوی ڕان بکات (venv-ـی Windows + بێ deps). هەموو پشتڕاستکردنەوەی کۆتایی دەبێت لەسەر Windows بکرێت.

```powershell
# ── باکێند ──
cd C:\Users\SAFA\zoho\backend
.\venv\Scripts\Activate.ps1
pytest                                  # coverage ڕاپۆرت دەکات، --cov-fail-under=0 ناشکێنێت
pytest tests\contract -v                # تێستی contract
pytest tests\test_migrations_roundtrip.py -v
pytest --cov=app --cov-report=term-missing | Select-String "TOTAL"   # ڕێژەی coverage ببینە

# ── فرۆنتئیند ──
cd C:\Users\SAFA\zoho\frontend
npx tsc --noEmit
npm run test                            # vitest — 1322/1322 چاوەڕوانە
npm run build
npm run lint
npm run rtl:audit
npm run audit:glass-modals

# ── e2e (پێویستی بە dev server + backend هەیە) ──
npm run dev                             # تەرمیناڵی جیا، port 5173
npx playwright test e2e\scenarios\shopkeeper_core.spec.ts   # O2C/P2P/POS smoke
$env:RUN_GLASS_SNAPSHOTS="1"; npx playwright test e2e\premium-glass-roles.spec.ts  # visual (gated)

# ── Load (پێویستی بە k6 + staging هەیە) ──
$env:K6_BASE_URL="https://erpiq.systems"; $env:K6_USER_EMAIL="..."; $env:K6_USER_PASSWORD="..."
k6 run C:\Users\SAFA\zoho\load\k6-suite\pos-checkout.js
```
## ٥) پارەدانی عێراقی · e-Fakhata · GL/Decimal

> ئەم بەشە ڕێنمایی جێبەجێکردنی **پارەدانی عێراقی**، **e-Fakhata (فاکتوری ئەلیکترۆنیی وەزارەتی دارایی)**، و چاکسازیی **GL/Decimal**ـی دارایی دەگرێتەوە. هەموو ئەو شتانەی لێرە باسکراون لەسەر کۆدی ڕاستەقینەی `backend/app/` بنیاتنراون. **هیچ گۆڕانکارییەک هێشتا جێبەجێ نەکراوە** — ئەمە ڕێنماییەکی پشکنراوە (reviewed guide)؛ کۆدی کۆپی-پەیست لێرە هەیە بەڵام دەبێت لەسەر Windows جێبەجێ بکرێت + `pytest` ڕان بکرێت.

دۆخی ئێستا بەکورتی:

| پارت | دۆخ |
|------|-----|
| **Stripe** (نێودەوڵەتی) | ✅ **تەواو ڕاستەقینە** — PaymentIntents + webhook HMAC + reconciliation. تەنها `STRIPE_SECRET_KEY` پێویستە. |
| **Cash / COD** | ✅ کار دەکات — cash یەکسەر `succeeded`، refund بە zincîreی negative payment. |
| **FastPay / Qi / Zain Cash / Asia Pay** | ⏳ **سکێلێتۆن** — هەر پێنج میتۆد `NotImplementedError` دەدەن تا credential-ی merchant بێت (R7.2–R7.5). |
| **FIB / Zain Cash webhook (سپرینتی Iraq Payments)** | ✅ **HMAC-SHA256 verify** زیادکرا (P0 fix) — `app/api/iraq_payments.py`. |
| **e-Fakhata (MoF)** | ⏳ **پایپلاینی تەواو** (schema/sign/queue/worker/client) بەڵام endpoint-ەکان `# TODO: verify (R7.X)`ن و `MOF_BASE` بەتاڵە. |
| **GL/Decimal دارایی** | ⏳ ڕێنمایی پشکنراو لە `_deltas/P0-finance-correctness-IMPLEMENTATION.md` — **جێبەجێ نەکراوە**. |

---

### ٥.١) کۆنترات/Interfaceـی Gateway (پێنج میتۆد)

هەموو adapter-ەکانی پارەدان هەمان کۆنتراتی `PaymentGateway` جێبەجێ دەکەن — ئەمە لە `backend/app/payments/gateway.py` پێناسەکراوە وەک `Protocol`ـێکی تەسک. هەر adapter پێویستە `slug`ـێکی بێهاوتای هەبێت + ئەم **پێنج میتۆدە async**ـە:

```python
# backend/app/payments/gateway.py
@runtime_checkable
class PaymentGateway(Protocol):
    """Adapter contract. ``slug`` must be unique across registered providers."""

    slug: str

    async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult: ...

    async def capture(self, payment_id: str) -> CaptureResult: ...

    async def refund(
        self, payment_id: str, amount: Optional[Money] = None, *, reason: str = ""
    ) -> RefundResult: ...

    async def verify_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent: ...

    async def get_status(self, payment_id: str) -> PaymentStatus: ...
```

Value object-ە گرینگەکان (هەمان فایل):

- **`Money(amount: Decimal, currency: str)`** — هەموو بڕەکان `Decimal`ـن (نەک float). `minor_units()` بۆ IQD ژمارەی تەواو (بێ fils) دەگەڕێنێتەوە، بۆ USD/EUR ×100.
- **`PaymentOrder`** — `invoice_id` یان `line_items` + `metadata` (کە `org_id`ـی تێدایە — هەموو adapter پێویستی پێیەتی).
- **`InitiateResult`** — `next_action_kind` ∈ `'qr' | 'redirect' | 'confirm' | 'client_secret'` کە frontend پێی دیاری دەکات کام widget بنوێنێت.
- **`PaymentStatus`** (Enum) — `pending`, `requires_action`, `out_for_delivery`, `delivered`, `authorized`, `succeeded`, `settled`, `refunded`, `partially_refunded`, `returned`, `failed`, `cancelled`.
- **هەڵەکان** — `PaymentProviderNotConfigured` (credential نییە → 503)، `WebhookSignatureInvalid` (verify شکست → 401)، `PaymentNotFound`.

**Registry** (`backend/app/payments/registry.py`): adapter-ەکان لە کاتی import خۆیان `register()` دەکەن، API layer بە `get(slug)` دۆزینەوەیان دەکات، و per-tenant enablement بە `list_enabled(TenantPaymentConfig)` لەسەری دادەنرێت (دەخوێنرێتەوە لە `tenants/{tid}/payment_providers/{slug}`).

**گرینگ:** هەر چوار gateway-ی عێراقی (`FastPayGateway`, `QiCardGateway`, `ZainCashGateway`, `AsiaPayGateway`) ئێستا هەر پێنج میتۆدیان `raise NotImplementedError(_BLOCKED)` دەکەن (یان `PaymentProviderNotConfigured` لە `_require_configured()`). ساختاریان **تەواو وەک Stripe** دانراوە بۆ ئەوەی wiring-ی API layer هەمان بێت — کاتێک credential دێت، تەنها بدرکێنرێنەوە و route-ەکان زیندوو دەبن.

---

### A) Gateway-ە عێراقییەکان — سکێلێتۆنی پڕکردنەوە

هەر چوار فایل (`fastpay_gateway.py`, `qi_gateway.py`, `zain_cash_gateway.py`, `asia_pay_gateway.py`) ئێستا `__init__`ـیان credential وەردەگرن (بەڵام `None`ـن) و `_require_configured()`ـیان هەیە کە `PaymentProviderNotConfigured` دەداتەوە ئەگەر credential نەبێت. خوارەوە بۆ هەر یەکێک: پلانی پڕکردنەوەی میتۆد-بە-میتۆد + قاڵبی پڕکردنەوە.

> **یاسای هاوبەش بۆ هەموویان:** (1) هیچ secret/key لاگ مەکە. (2) لە `verify_webhook` هەمیشە `hmac.compare_digest` بەکاربهێنە (constant-time)، نەک `==`. (3) لە `initiate` بڕ بە `amount.minor_units()` بنێرە (IQD → integer). (4) `org_id` لە `order.metadata['org_id']` وەربگرە و `repo = self._repo_factory(org_id)` دروست بکە — هەمان نموونەی Stripe لە `stripe_gateway.py:91-94`. (5) status-ی provider مەپ بکە بۆ `PaymentStatus` بە dict (وەک `_STRIPE_STATUS_MAP`).

#### A.1) FastPay (`backend/app/payments/fastpay_gateway.py` — R7.2)

دۆکیومێنتی فلۆ لە سەرەی فایلەکە: sandbox base `https://sandbox.fastpaywallet.com/api/v1/`، OAuth `client_credentials` (TTL ~3600s)، `POST /payments` → `{id, qr_string, expires_at}` (QR ٥ خولەک دەمێنێتەوە — `QR_TTL_SECONDS = 300`)، webhook بە `HMAC_SHA256(secret, raw_body)`.

| میتۆد | TODO-ی تایبەتی FastPay | پلان |
|-------|------------------------|------|
| `initiate` | `# TODO(R7.2): POST /oauth/token, then POST /payments; persist QR.` | OAuth bearer بگرە → intent دروست بکە → QR persist بکە، `next_action_kind="qr"` بگەڕێنەوە. |
| `capture` | `# TODO(R7.2): FastPay captures on QR scan; this is effectively no-op.` | FastPay لە کاتی scan خۆی capture دەکات → no-op success. |
| `refund` | `# TODO(R7.2): POST /payments/{id}/refund — confirm FastPay supports refunds.` | پشتڕاست بکەوە FastPay refund پشتگیری دەکات. |
| `verify_webhook` | `# TODO(R7.2): HMAC_SHA256(secret, raw_body) constant-time compare.` | **بڕواننە A.5** — هەمان نموونەی P0 fix لە `iraq_payments.py`. |
| `get_status` | `# TODO(R7.2): GET /payments/{id}; map FastPay statuses to PaymentStatus.` | `GET /payments/{id}` → status mapping. |

قاڵبی پڕکردنەوە (هەر میتۆد بەهەمان شێوە):

```python
# fastpay_gateway.py — وەک نموونە بۆ initiate
async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult:
    self._require_configured()
    import httpx
    org_id = order.metadata.get("org_id")
    if not org_id:
        raise ValueError("fastpay gateway requires order.metadata['org_id']")
    repo = self._repo_factory(org_id)

    base = self.SANDBOX_BASE if self._sandbox else "https://api.fastpaywallet.com/api/v1/"
    async with httpx.AsyncClient(timeout=30) as client:
        # 1) OAuth client_credentials → bearer
        tok = await client.post(f"{base}oauth/token", data={
            "grant_type": "client_credentials",
            "client_id": self._client_id,
            "client_secret": self._client_secret,
        })
        tok.raise_for_status()
        bearer = tok.json()["access_token"]   # TODO(R7.2): verify field name
        # 2) create intent
        resp = await client.post(
            f"{base}payments",
            headers={"Authorization": f"Bearer {bearer}"},
            json={
                "amount": amount.minor_units(),       # IQD integer
                "currency": amount.currency,          # 'IQD'
                "description": order.description or "",
                "merchant_reference": order.invoice_id or order.pos_sale_id or "",
                "callback_url": order.metadata.get("callback_url"),  # → /webhook/fastpay?org_id=
            },
        )
        resp.raise_for_status()
        data = resp.json()    # {id, qr_string, expires_at}

    payment = repo.create_payment(
        provider_slug=self.slug, amount=amount.amount, currency=amount.currency,
        status=PaymentStatus.pending, invoice_id=order.invoice_id,
        pos_sale_id=order.pos_sale_id, customer_id=order.customer_id,
        provider_reference=data["id"], provider_data={"qr": data.get("qr_string")},
        created_by=order.metadata.get("actor", "system"),
    )
    return InitiateResult(
        payment_id=payment["id"], provider_slug=self.slug, status=PaymentStatus.pending,
        next_action_kind="qr", next_action={"qr_string": data.get("qr_string")},
        provider_reference=data["id"],
    )
```

#### A.2) Qi Card (`backend/app/payments/qi_gateway.py` — R7.3)

فلۆ (لە سەرەی فایلەکە): sandbox `https://api.sandbox.qicard.iq/v1/`، **hosted payment page (PCI SAQ-A)** — کڕیار ڕەوانە دەکرێت بۆ URL-ی Qi، PIN لەسەر پەڕەی Qi دەنووسێت (3DS لای Qi)، Qi callback دەکات.

| میتۆد | TODO | پلان |
|-------|------|------|
| `initiate` | `# TODO(R7.3): POST /intents → returns hosted-page URL + intent_token.` | `next_action_kind="redirect"`, `next_action={"redirect_url": ...}`. |
| `capture` | `# TODO(R7.3): POST /intents/{id}/capture after auth code received.` | پاش وەرگرتنی auth code. |
| `refund` | `# TODO(R7.3): POST /charges/{id}/refund.` | — |
| `verify_webhook` | `# TODO(R7.3): Confirm signature scheme with Qi business team; placeholder HMAC.` | scheme لەگەڵ تیمی Qi پشتڕاست بکە؛ بەشێوەی پێشینە HMAC. |
| `get_status` | (بێ کۆمێنت) | `GET /intents/{id}` → mapping. |

#### A.3) Zain Cash (`backend/app/payments/zain_cash_gateway.py` — R7.4)

فلۆ: نموونەی **mobile-wallet OTP** (`merchant_id`, `secret`, `msisdn`). webhook signature method **TBD**.

| میتۆد | TODO | پلان |
|-------|------|------|
| `initiate` | `# TODO(R7.4): Push OTP to wallet MSISDN; return next_action 'otp_input'.` | `next_action_kind="otp_input"`. |
| `capture` / `refund` / `verify_webhook` / `get_status` | (بێ کۆمێنت، هەموو `NotImplementedError`) | پاش وەرگرتنی دۆکیومێنتی merchant. **ئاگاداری:** signature scheme دیاری نییە — پێش جێبەجێکردن لەگەڵ Zain پشتڕاست بکە. |

#### A.4) Asia Pay / Asia Hawala (`backend/app/payments/asia_pay_gateway.py` — R7.5)

فلۆ: زۆرتر بۆ import-export، **token-on-file** بۆ recurring. **کەمترین لەپێشینە** بۆ v1 مەگەر کڕیارێکی launch پێویستی پێی هەبێت. هەموو میتۆدەکان `NotImplementedError` تا R7.5.

#### A.5) Webhook HMAC verify — کرۆس-لینک بۆ P0 fix

پێش ئەوەی هیچ webhook-ێکی provider جێبەجێ بکرێت، نموونەی **P0 webhook fix**ـی جێبەجێکراو لە `backend/app/api/iraq_payments.py` ببینە — ئەمە لەمەوبەر چاککراوە بۆ FIB + Zain Cash و دەبێت وەک قاڵب بۆ هەر `verify_webhook`ـێک بەکاربهێنرێت:

```python
# backend/app/api/iraq_payments.py — P0 fix (جێبەجێکراو)
WEBHOOK_SIGNATURE_HEADER = "X-Webhook-Signature"

async def _verify_and_parse_webhook(request: Request) -> PaymentCallback:
    secret = (settings.IRAQ_PAYMENT_WEBHOOK_SECRET or "").strip()
    if not secret:
        # Safe-by-default: بێ secret ناتوانین caller authenticate بکەین → ڕەت بکەرەوە
        raise HTTPException(503, "webhook disabled: signature secret not configured")

    raw_body = await request.body()          # body یەک جار دەخوێنرێتەوە، پێش parse
    provided_sig = request.headers.get(WEBHOOK_SIGNATURE_HEADER, "")
    if not provided_sig:
        raise HTTPException(401, "invalid signature")

    expected_sig = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, provided_sig):   # constant-time
        raise HTTPException(401, "invalid signature")
    # body authenticated → ئێستا parse بکە
    ...
```

خاڵە گرینگەکان کە دەبێت هەر provider-ێک پەیڕەویان بکات:
- **secret unset → 503** (safe-by-default — هەرگیز callback-ی واژۆنەکراو پرۆسێس مەکە).
- **signature header نییە/هەڵە → 401**.
- raw body **یەک جار** بخوێنەرەوە و **پێش هەر parse** verify بکە (بۆ ئەوەی callback-ی فۆرج کراو نەگاتە لۆجیکی مارک-کردنی فاکتورا وەک paid).
- `hmac.compare_digest` (نەک `==`).

سکرتی شارەد لە `backend/app/config.py:96` → `IRAQ_PAYMENT_WEBHOOK_SECRET: str = ""` (دۆکیومێنت لە `config.py:90-96` + `env_docs.py:236`). بۆ provider-ە نوێیەکان (FastPay/Qi) لەوانەیە هەر یەکێک secret-ی جیاوازی هەبێت لە `tenants/{tid}/payment_providers/{slug}` — adapter ئەوە بەکاردەهێنێت نەک سکرتی گشتی.

> **تێبینی wiring:** دوو سیستەمی پارەدان هەن: (1) adapter-ی `app/payments/*_gateway.py` (نوێ، `PaymentGateway` protocol، Stripe/Cash/COD زیندوو)، (2) `app/api/iraq_payments.py` (سپرینتی Iraq Payments، FIB/Zain/Asia Hawala بە config + callback، webhook-ـی P0-fixed). adapter-ە عێراقییەکان (`FastPayGateway` هتد) بۆ سیستەمی یەکەمن؛ کاتێک پڕکرانەوە، `register_default_providers()` لە startup ئەکتیڤیان دەکات.

---

### B) ئەکتیڤکردنی e-Fakhata

پایپلاینی e-Fakhata بەتەواوی نووسراوە بەڵام **بۆ live نەکراوەتەوە**. کۆمپۆنێنتە بوونیارەکان:

- `backend/app/efakhata/schema.py` — مۆدێلی Pydantic + lxml بۆ XML v1.0. **١٤+ جێگا بە `# TODO: verify against published spec (R7.X)` نیشانکراون** (نموونە: `NS_EFK = "http://efakhata.mof.gov.iq/schema/v1"  # TODO: verify (R7.X)` لە `schema.py:32`، governorate validator لە `schema.py:78`).
- `backend/app/efakhata/mof_client.py` — HTTPS + mTLS client. `MOF_BASE` لە env (`mof_client.py:101`)؛ ئەگەر **بەتاڵ بێت → `MoFNotConfigured`** دەداتەوە بۆ ئەوەی queue کۆ بێتەوە بێ تەقینەوەی worker. هەر سێ endpoint بە `# TODO: verify (R7.X)` نیشانکراون:
  - `POST {MOF_BASE}/api/v1/invoices/submit` (`mof_client.py:118`)
  - `GET {MOF_BASE}/api/v1/invoices/{ack}/status` (`mof_client.py:135`)
  - `POST {MOF_BASE}/api/v1/invoices/{ack}/cancel` (`mof_client.py:147`)
  - هەروەها ناوی فیلدی `ack_number`/`ackNumber` لە `mof_client.py:130` بە `# TODO: verify (R7.X)`.
- `backend/app/efakhata/signing.py` — XAdES-BES بە `signxml` (4.x). cert لە PKCS#12 (password یەک جار دەخوێنرێتەوە و دەسڕێتەوە، هەرگیز لاگ نابێت).
- `backend/app/efakhata/submission_queue.py` — Firestore queue، state machine (`pending → submitting → submitted → acknowledged/rejected/failed/cancelled`)، dedup بە `invoice_id`، exponential backoff `BACKOFF_MINUTES = [1, 5, 30, 120, 720]`، `MAX_ATTEMPTS = 5`.
- `backend/app/efakhata/submission_worker.py` — `run_once()` / `process_tenant_queue(tid)`؛ ئەگەر `MoFNotConfigured` → `skipped_not_configured` و break (بێ شکاندنی queue).
- `backend/app/efakhata/version_registry.py` — `current_version = "1.0"`، notes: `"Initial public draft — verify against MoF release (R7.X)."` (`version_registry.py:36`).
- `backend/app/api/efakhata.py` — `POST /api/invoices/{invoice_id}/efakhata/submit` (`efakhata.py:126`).

> **تێبینی:** فلاگی `preview_mode` (default **`True`**) لە سیستەمی گشتیی e-invoice-دا (`app/services/einvoice_service.py:29`، `DEFAULT_EINVOICE_CONFIG`) دەستەمۆ دەکات کە هیچ شتێک بۆ portal نانێردرێت تا `preview_mode=False` بکرێتەوە. ئەمە لایەنی config-ی tenant-ـی e-invoice-ـە (جیاوازە لە queue-ی e-Fakhata-ی MoF کە بە `MOF_BASE` کۆنترۆڵ دەکرێت). بۆ live: هەردووکیان دەبێت ئەکتیڤ بکرێن.

**هەنگاوەکانی live-کردن** (دوای تەسدیقی سپێسی MoF — کرۆس-لینک: `docs/compliance/e-fakhata-mof-verification-checklist.md` ← ئەم چێک-لیستە دەبێت دروست بکرێت/پڕ بکرێتەوە بۆ R7.X پێش live):

1. **تەسدیقی سپێس (R7.X):** هەموو `# TODO: verify against published spec (R7.X)`ـەکان لە `schema.py` + `mof_client.py` + `version_registry.py` لەگەڵ سپێسی بڵاوکراوەی MoF بپشکنە — ناوی namespace، شێوەی فیلد، ڕێگەی endpoint، ناوی `ack_number`. ئەنجامەکان لە چێک-لیستی verification تۆمار بکە.
2. **`MOF_BASE` دابنێ:** env var `MOF_BASE=https://efakhata.mof.gov.iq` (بەڵگە: `env_docs.py:341`؛ دەبێت HTTPS بێت — `mof_client.py:110-111` هەر شتێکی تر ڕەت دەکاتەوە).
3. **Cert بار بکە:** PKCS#12-ـی tenant بار بکە (هەمان cert بۆ XAdES + mTLS). بۆ پڕۆداکشن لە GCP Secret Manager (`tenant-{tid}-efakhata-cert`)؛ بۆ dev/CI `EFAKHATA_LOCAL_CERT_STORE=1` (`cert_storage.py:60`، `env_docs.py:354`).
4. **Submission drain ئەکتیڤ بکە:** job-ـی `efakhata_submission_drain` پێشتر تۆمارکراوە لە scheduler (`scheduler.py:207-215`، `IntervalTrigger(seconds=30)`، `_job_efakhata_submission_drain` → `run_once()`). دەبێت scheduler-ـی **دەرەوەی پرۆسێس** ڕان بکات (APScheduler) — دڵنیابە لە دامەزراندنی production کە scheduler دەستی پێکردووە. کاتێک `MOF_BASE` بەتاڵ بێت، job بێ هەڵە ڕادەوەستێت (`scheduler.py:347`).
5. **ڕەیتە placeholder-ەکان بگۆڕە:** ڕەیتی باج (WHT لە `app/tax/withholding.py`، هەمووی `placeholder=True`) بە ڕەیتی واژۆکراوی ژمێریار بگۆڕەوە (R7.1) — بڕواننە بەشی C.
6. **`preview_mode` بکوژێنەوە:** لە config-ی tenant `preview_mode=False` + `portal_url` دابنێ (`einvoice_service.py:219`) بۆ سیستەمی e-invoice، و دڵنیابە `MOF_BASE` بۆ queue-ی MoF دانراوە.
7. **تێستی end-to-end submit:** فاکتورێکی تاقیکردنەوە دروست بکە → `POST /api/invoices/{id}/efakhata/submit` → دڵنیابە لە queue → چاوەڕێی worker بکە → status بگۆڕێت بۆ `submitted` → `acknowledged` (یان `rejected` بە هۆکار). ack-number لە sandbox-ـی MoF پشتڕاست بکەرەوە پێش پڕۆداکشن.

---

### C) GL/Decimal — ئامادە بۆ جێبەجێکردن

ڕێنماییەکی تەواو لە `_deltas/P0-finance-correctness-IMPLEMENTATION.md` هەیە (**جێبەجێ نەکراوە** — دارایی نابێت بێ تێست بگۆڕدرێت). سێ کەلێنی دروستی نیشان دەدات:

| # | کەلێن | فایل | مەترسی |
|---|------|------|--------|
| **1** | تایبکردنی (confirm/`send`) فاکتوری کڕیار **هیچ JE-یەک ناخات**؛ void/cancel هیچ reversal ناکات. | `app/api/invoices.py`, `app/services/invoice_gl.py` (نوێ) | GL Revenue & AR لە sub-ledger جیا دەبنەوە — لیستە داراییەکان هەڵە. **بێدەنگ** تا audit. |
| **2** | پارەی **وەرگیراو** بەس `balance_due` نوێ دەکات — هیچ Dr Cash / Cr AR ناخات. | `app/services/invoice_payments.py` | Cash & AR لە GL هەرگیز ناجوڵێن کاتێک کڕیار پارە دەدات. |
| **3** | حسابی balance بە **`float`**؛ `withholding.py` لە `round(x + 1e-9, 2)`ـی epsilon-hack بەکاردەهێنێت. | `invoice_payments.py`, `withholding.py` | لادانی ژێر-cent، rounding-ی نا-deterministic، شکستی audit. |

> **پلانی commit (سێ commit-ـی جیا بۆ bisect):** commit 1 = Fix 3 (Decimal — بچووکترین blast radius)؛ commit 2 = Fix 1 (GL on confirm)؛ commit 3 = Fix 2 (GL on payment). engine-ـی double-entry پێشتر ڕاست و atomic-ـە (`accounting.py`, `journal_entry_atomic.py`, `je_validation.py`) — Fix 1 و 2 زۆرتر **wiring + idempotency + reversal**ـن. نموونەی کۆپیکردن: AP side-ـی `bill_payments.create_payment_made_with_je_atomic`.

#### C.1) Fix 3 (دەستپێک — جیاکراوە، مەترسیی کەم): `withholding._round` Decimal

ئێستا لە `backend/app/tax/withholding.py:127-131` (epsilon-hack):

```python
def _round(value: float) -> float:
    """Round to 2 decimals, half away from zero — matches ``tax_calc._round``."""
    if value >= 0:
        return round(value + 1e-9, 2)
    return -round(-value + 1e-9, 2)
```

جێگرەوەی Decimal/ROUND_HALF_UP (کۆپی-پەیست):

```python
from decimal import Decimal, ROUND_HALF_UP

_CENT = Decimal("0.01")

def _round(value) -> float:
    """Round to 2 dp, HALF_UP, via Decimal. Returns float for the public API."""
    d = value if isinstance(value, Decimal) else Decimal(str(value or 0))
    return float(d.quantize(_CENT, rounding=ROUND_HALF_UP))
```

دواتر دوو دێڕی حسابکردن (ئێستا `withholding.py:275-276`) بگۆڕە بۆ Decimal:

```python
        gross_d = Decimal(str(gross))
        rate_d = Decimal(str(rate_pct))
        withheld = _round(gross_d * rate_d / Decimal("100"))
        net = _round(gross_d - Decimal(str(withheld)))
```

**بۆچی:** `round(value + 1e-9, 2)`ـی کۆن هەموو بەهایەک بەرەو سەرەوە پاڵ دەدات بۆ خۆلابوون لە banker's-rounding-ی Python؛ ئەمە لە tie-point نا-deterministic-ـە و audit-ـی reproducible سەرناخات. `Decimal.quantize(ROUND_HALF_UP)` tie-ـەکان بەرەو دوور لە سفر deterministic-ـانە round دەکات — کە ئەوەیە کۆمێنتی کۆد بانگەشەی دەکات بەڵام hack-ـەکە تەنها نزیکی دەکردەوە. (تێستە بوونیارەکانی `test_withholding.py` هێشتا سەوز دەمێننەوە — بڕواننە دۆکیومێنتی delta § 4.2.)

#### C.2) Fix 3 (بەردەوام): حسابی balance-ـی `invoice_payments`

ئێستا لە `backend/app/services/invoice_payments.py:13-17` (`float`، لە `<= 0` دادەخات):

```python
def _invoice_balance_after(inv: dict, amount: float) -> tuple[float, str]:
    current = float(inv.get("balance_due") or inv.get("total") or 0)
    new_balance = current - float(amount or 0)
    status = "paid" if new_balance <= 0 else "partially_paid"
    return max(0.0, new_balance), status
```

جێگرەوەی Decimal (کۆپی-پەیست):

```python
from decimal import Decimal, ROUND_HALF_UP

_CENT = Decimal("0.01")

def _money(value) -> Decimal:
    """Parse to Decimal via str() (never float()) and quantise to 2 dp, HALF_UP."""
    if isinstance(value, Decimal):
        d = value
    else:
        d = Decimal(str(value or 0))
    return d.quantize(_CENT, rounding=ROUND_HALF_UP)


def _invoice_balance_after(inv: dict, amount) -> tuple[float, str]:
    current = _money(inv.get("balance_due") if inv.get("balance_due") is not None else inv.get("total") or 0)
    new_balance = current - _money(amount)
    if new_balance <= _CENT:                       # <= 0.01 closes it (وەک AP side)
        return 0.0, "paid"
    status = "partially_paid"
    return float(new_balance), status
```

**تێبینی:** `Decimal(str(value))` بەکاربهێنە — هەرگیز `Decimal(float)` (binary float هەمان هەڵە هەڵدەگرێت کە دەیسڕینەوە). Firestore ژمارە وەک float هەڵدەگرێت، بۆیە return type لە boundary-دا `float` دەمێنێتەوە بەڵام هەموو arithmetic/comparison بە `Decimal`ـە. قاعیدەی داخستن لە `<= _CENT` لەگەڵ `bill_payments._bill_balance_after` یەکدەگرێتەوە (AR و AP وەک یەک هەڵس دەکەن؛ کۆد ئێستا لە `<= 0` دادەخات کە دەکرێت 0.004ـێک وەک "partially_paid" بۆ هەتاهەتایە بهێڵێتەوە). `apply_invoice_payment_atomic` و `create_payment_received_atomic` هەردووکیان بانگی `_invoice_balance_after` دەکەن، بۆیە دوای Decimal-کردنی helper، هەردووکیان rounding-ی ڕاست وەردەگرن بێ گۆڕانکاریی زیاتر.

#### C.3) Fix 1 + 2 — GL-on-confirm / GL-on-payment (pointer)

ئەمانە فایلی نوێ + wiring پێویستە، بۆیە لێرە تەنها ئاماژەیان پێ دەکەین (کۆدی تەواو لە `_deltas/P0-finance-correctness-IMPLEMENTATION.md` § 2–3):

- **Fix 1 (GL on confirm):** فایلی نوێ `app/services/invoice_gl.py` (`post_invoice_confirmation_je` + `reverse_invoice_je`، idempotent بە `uuid5` deterministic id + `gl_posted` guard). Wire لە `app/api/invoices.py` → `send_invoice` (پۆست)، `void_invoice`/`cancel_invoice` (reverse). builder-ـی `AccountingService.create_invoice_journal` پێشتر balanced lines دروست دەکات (Dr AR / Cr Revenue / Cr Tax 2140 / discount / shipping).
- **Fix 2 (GL on payment):** `create_payment_received_with_je_atomic` لە `invoice_payments.py` زیاد بکە (Dr Cash/Bank / Cr AR لە **هەمان transaction**ـی balance decrement، idempotent بە `uuid5("receipt-je:{payment_id}")`). نموونەی AP: `bill_payments.create_payment_made_with_je_atomic`.

> **هۆشداریی گرینگ:** هەموو ئەم چاکسازیانە **دەست لە پارە دەدەن**. دەبێت لەسەر **Windows** جێبەجێ بکرێن و بە `pytest`-ـی تەواوی backend پشتڕاست بکرێنەوە (sandbox-ـی Linux ناتوانێت backend ڕان بکات — venv-ـی Windows + بێ deps). تێستی property (Hypothesis) لە `test_accounting_integrity.py` بەهێزترین زەمانەتە کە debits==credits بۆ inputـی هەڕەمەکی. فەرمانی پشتڕاستکردنەوە:

```powershell
cd C:\Users\SAFA\zoho\backend
.\venv\Scripts\Activate.ps1
pytest -q
# فۆکەسی یەکەم:
pytest -q tests\test_withholding.py tests\test_atomic_money_paths.py `
          tests\test_accounting_integrity.py tests\test_accounting_balance.py
```

پاش جێبەجێکردن: boot-check (`python -c "import app.main"` + `/api/metrics`)، idempotency soak (هەمان confirm/payment دووجار → تەنها یەک JE)، و backfill-ـی مێژوویی (فاکتورا/پارەی پێش-فێکس بێ GL — بە ئیدێمپۆتانس، per-org/per-period، لە staging سەرەتا).
