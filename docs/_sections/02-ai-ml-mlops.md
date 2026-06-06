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
