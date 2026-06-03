# ڕووتمەپی کاری ماوە — ERPIQ

> **بەروار:** 2026-06-03 · **دۆخ:** دڵی سیستەمی هەژمارداری تەواو + سەلمێنراوە لەسەر داتای ڕاستەقینە.
> ئەم دۆکیومێنتە **ڕێگای تەواو** دادەنێت بۆ هەموو ئەوەی ماوە — کێ دەیکات، چۆن، و بە چ ڕیزبەندییەک.

---

## ✅ ئەوەی تەواو بووە (ئەم سێشنە)

- **تەواوی زنجیرەی double-entry:** AR (فاکتورا→GL، پارە→GL)، AP (پسوولە→GL)، COGS (کۆگا + POS)، ڕاپۆرتەکان (Trial Balance / P&L / Balance Sheet) — **هەمووی لەسەر داتای ڕاستەقینەی دیمۆ سەلمێنرا**.
- **🔴 فیکسی read-after-write** لە `journal_entry_atomic.py` — باگێکی کوشندە کە واتای ئەوە بوو **هیچ JE-یەک هەرگیز لەسەر Firestore-ـی ڕاستەقینە post نەدەبوو** (هەموو org = JEs:0). ئەمە بناغەی هەموو هەژمارداری بوو.
- **١٧+ چاکسازی P0/P1:** کونی account-takeover (storefront)، RBAC escalation، upload validation، چەند crash-ی datetime، EmptyState dark-mode، 404، SideNav notch، error-handling.
- **پشتڕاستی:** `pytest` 1490 سەرکەوتوو · frontend gates سەوز · 44+ تێستی نوێ · ٠ ڕیگرێشن.
- **گرنگ:** هەمووی لە **working tree**-دایە، **commit/deploy نەکراوە**.

---

## ✅ پۆل ١ — Polish-ـی سەلامەت (تەواوبوو 2026-06-03)

هەموو ئایتمەکان جێبەجێکران + پشتڕاستکرانەوە (tsc ٠ · lint ٠ error · build exit 0 · test 1321/1321 · rtl ٠ · glass OK). **٠ commit / ٠ deploy.**

### ١.١ Design tokens ✅ — ~١١٥ ڕەنگی hardcode → token لە ~٣٦ فایل
وۆرکفلۆی ٧-lane-ی پاراڵێل. green→`var(--success-500/-fg)`، red→`var(--danger-500/-fg)`، blue→`var(--accent-500)`، amber→`var(--warning-500)`، greys→`var(--ink-500)`/`var(--border)`/`var(--surface-2)`. recharts بە `dataViz` (hex) لە `tokens.ts`. **لابردرا:** ~٥٠٠ ئاگاداریی `no-hardcoded-colors` (2895→2392). **پارێزرا (بەمەبەست):** color-picker DB values، KDS/kiosk fixed-theme، print receipts، SVG fill props، categorical/rainbow، براندی violet.

### ١.٢ Typography ✅ — پێشتر token-driven-ـە (Vertex CSS-var)
سیستەمی Vertex (`--fs-*`, `--font-display`, `.t-*`) ئێستا سەرچاوەی typography-ـە؛ JS `typography` ramp-ـی کۆن superseded-ـە. `PageHeader`/`KpiCard` px-یان (26/13.5/12.5) **kit-spec-ـی مەبەستدارن** (font+ڕەنگ token-ـن، تەنها size literal). `FormLayout` `16`→`fontSize.lg` (exact-match).

### ١.٣ Density control ✅
`AppShell.tsx` → page padding ئێستا `densityPagePadding[densityFull]` دەگرێت (compact 16 / comfortable 20 / spacious 24) لەبری `space.xl`-ـی hardcode. ئێستا ڕێکخستنی density-ـی بەکارهێنەر کاریگەری لەسەر gutter-ی ناوەڕۆک هەیە، نەک تەنها controlHeight + sider width.

### ١.٤ DataTable memo ✅
### ١.٥ error-handling ✅ — interceptor-ـی ناوەندی + ٢ باگی false-success
`api.ts` response-interceptor پێشتر هەموو هەڵەیەک toast دەکات → ئەو `.catch(() => {})`-ـانە idiom-ی دروستن (نەک باگ). بەڵام ٢ کەیسی **false-success** چاککران (`bodies.tsx`: appearance-save + notification-test — inline `.catch` outer try/catch-ـی پووچ دەکردەوە → success-ی درۆ + interceptor error toast بەیەکەوە).

### ١.٦ Dead code ✅ — ئامرازی audit + سڕینەوەی سەلامەت
`scripts/deadcode-audit.mjs` (+ `npm run audit:deadcode`) — سکریپتی convention-matched کە static + dynamic + `new URL` import resolve دەکات. **دۆزینەوەی گرنگ:** ٧٩ "orphan" دۆزرانەوە، بەڵام زۆربەیان **scaffolding-ی فیچەری چاوەڕوانی wiring-ن** (payments/billing/hardware/PayLink — لە CLAUDE.md وەک pending) یان barrel/template/dev-tool-ـی مەبەستدار — **نەک کۆدی مردوو**. بۆیە تەنها ٢ duplicate-ـی superseded-ـی ڕوون سڕایەوە (`pages/Login.tsx`, `pages/SignUp.tsx` — auth-ـی کۆنی پێش-Vertex). ماوەکان بۆ triage-ـی تیم بە gate-ـی نوێ.
> کۆدبەیسەکە `import.meta.glob` یان template-literal import **بەکارنەهێنێت** — بۆیە "0 references"-ـی سکریپتەکە بەڵگەی تەواوە، و tsc+build وەک oracle هەر deletion-ێک پشتڕاست دەکەن.

---

## 🟡 پۆل ٢ — پێویستی بە **تۆ** هەیە، پاشان Claude بەردەوام دەبێت

### ٢.١ Commit (گرنگترین — ئێستا)
```bash
cd C:\Users\SAFA\zoho
git status            # هەموو گۆڕانکاریەکان ببینە
git diff              # پێداچوونەوە (بەتایبەتی backend/app/services/accounting, invoice_gl, bill_gl, cogs_gl, journal_entry_atomic)
git add -A
git commit -m "feat(accounting): GL/COGS/AP auto-post + read-after-write fix + audit P0/P1 fixes"
```
> **مەهێڵە ون بێت** — ئەمە کارێکی گەورەی هەژمارداریە.

### ٢.٢ Deploy-ی index → پاشان POS query-rewrite
```bash
firebase deploy --only firestore:indexes --project zoho-83cda
```
دوای ئەوە، Claude دەتوانێت `pos.py` reports-ـەکان بنووسێتەوە بۆ بەکارهێنانی index-ـی `pos_orders (org_id, state, created_at)` (لەبری scan-ی 5000-doc).

### ٢.٣ Deploy-ی app (کاتێک ئامادە بوویت)
- Backend: `deploy/migrate-backend-to-zoho-83cda.ps1` (Cloud Run).
- Frontend: `vercel deploy --prod --cwd frontend`.

---

## 🔴 پۆل ٣ — Feature-ی گەورە (تیم + ڕۆژانی فۆکەس)

### ٣.١ Reports N+1 optimization
**کێشە:** هەر ڕاپۆرتێک یەک subcollection read بۆ هەر JE دەکات (N+1).
**چۆن:**
1. لە `journal_entry_atomic.py::create_journal_entry_in_transaction`، `org_id` + `date` زیاد بکە بۆ هەر line doc (denormalize).
2. `firestore.indexes.json`: collectionGroup index لەسەر `lines (org_id, date)`.
3. `report_queries.py::journal_balances` بنووسەرەوە: `db.collection_group("lines").where(org_id).where(date range)` — یەک query لەبری N.
4. **Backfill:** سکریپتێک بۆ زیادکردنی org_id/date بۆ line doc-ـە کۆنەکان.
> پێویستی بە index deploy + backfill + تاقیکردنەوەی داتای ڕاستەقینە هەیە.

### ٣.٢ Consolidation (چەند-کۆمپانیا)
**ئێستا:** `companies.py:213` تەنها `eliminated=True` دادەنێت، JE تۆمار ناکات.
**چۆن:** (a) `company_id` زیاد بکە بۆ هەموو JE؛ (b) per-entity trial balance؛ (c) elimination JE بۆ intercompany (AR↔AP، sales↔purchases)؛ (d) ownership% + minority interest؛ (e) consolidated report کە چەند entity کۆدەکات. ڕێبەر: `_deltas/P1-modules-IMPLEMENTATION.md`.

### ٣.٣ Event bus / Saga
**ئێستا:** `outbox.py` shell-ی ٢٠ دێڕیە، dispatcher تەنها stub.
**چۆن:** (a) outbox table لەگەڵ JE/invoice write (هەمان transaction)؛ (b) dispatcher worker (APScheduler) کە event-ـەکان دەخوێنێتەوە + handler-ـەکان بانگ دەکات (einvoice, inventory, notification)؛ (c) retry + dead-letter؛ (d) saga بۆ multi-step. ڕێبەر: `_deltas/P1-architecture-IMPLEMENTATION.md`. **مەترسی:** hot write path — feature flag + staged.

### ٣.٤ Perpetual valuation (moving-average / FIFO)
**ئێستا:** COGS لەسەر standard cost (`item.cost_price`).
**چۆن:** (a) cost-layer ledger (هەر کڕینێک layer زیاد دەکات)؛ (b) moving-average یان FIFO لە کاتی فرۆش؛ (c) COGS لەسەر cost-ـی ڕاستەقینەی layer؛ (d) inventory revaluation. پەیوەستە بە COGS-ـی ئێستا (cogs_gl.py). ڕێبەر: `_deltas/P1-modules-IMPLEMENTATION.md`.

### ٣.٥ WMS / TMS
WMS: picking/putaway/bin/zone قووڵ. TMS: route optimization + freight rating. `tms_routing.py`/`tms_rating.py` نین. ڕێبەر: `_deltas/P1-modules-IMPLEMENTATION.md`.

### ٣.٦ MDM / BPMN / API gateway
golden record، workflow engine، OpenAPI gateway. ڕێبەر: `_deltas/P1-architecture-IMPLEMENTATION.md`.

---

## 🔵 پۆل ٤ — Infra / Cloud accounts

| ئایتم | چی پێویستە | چۆن |
|------|-----------|------|
| **BigQuery warehouse** | BigQuery dataset + CDC | dataset دروست بکە، Firestore→BQ pipeline (Dataflow یان scheduled export)، analytics queries. `docs/MASTER_IMPLEMENTATION_GUIDE_KU.md §١`. |
| **AI/ML** | ML worker + deps | warehouse (#بالا) یەکەم، پاشان forecast models. `MASTER §٢`. |
| **CSP staged** | browser regression | nonce-based script-src، تاقیکردنەوەی GA/Firebase، بەرەبەرە لابردنی unsafe-inline. `main.py:314`. |
| **Monitoring** | Sentry/PagerDuty accounts | DSN دابنێ، `observability/` wire (پێشتر ئامادەیە). |
| **CI auto-deploy** | GCP WIF | WIF pool/provider + GitHub secrets بۆ `zoho-83cda`. |

---

## ⚫ پۆل ٥ — مرۆڤی / بزنس (هیچیان کۆد نین)

| ئەرک | تێبینی |
|------|--------|
| **کیانی یاسایی** (LLC + CR) | پێش هەر کڕیار/پارەدان. |
| **سەرمایە** | pre-seed/seed. `docs/business/fundraising-onepager.md`. |
| **تیم** | CTO + ئەندازیار + QA + پشتگیری. `docs/business/hiring-plan.md`. |
| **سپێسی MoF** | بۆ e-Fakhata. `docs/compliance/e-fakhata-mof-verification-checklist.md`. |
| **بڕواننامەی پارەدان** | FastPay/Qi/Zain merchant + sandbox. کۆد ئامادەیە (`*_gateway.py`). |
| **پایلۆت** | ٣–٥ کڕیاری ڕاستەقینەی عێراقی. `docs/business/pilot-onboarding-checklist.md`. |
| **بڕواننامەی ئاسایش** | SOC2 / pen-test / ISO. `docs/compliance/soc2-iso27001-readiness-checklist.md`. |

---

## 🎯 ڕیزبەندی پێشنیارکراو

1. **ئێستا:** Commit (٢.١) ← مەهێڵە کارەکە ون بێت.
2. **ئەم هەفتە:** پۆل ١ polish (Claude) + deploy-ی index (٢.٢) + POS rewrite (Claude).
3. **پێش launch:** کیانی یاسایی + سەرمایە + سپێسی MoF + بڕواننامەی پارەدان (پۆل ٥، existential).
4. **پاش یەکەم کڕیار:** Reports N+1 + valuation + consolidation (پۆل ٣، بەپێی پێویست).
5. **مەزنبوون:** event bus + WMS + BigQuery + AI (پۆل ٣/٤).

---

> **کورتە:** دڵی ERP (هەژمارداری) کاردەکات + سەلمێنراوە. ئەوەی ماوە یان **polish-ی سەلامەتە** (Claude دەیکات)، یان پێویستی بە **deploy/infra/team/business** هەیە — هەمووی لێرە بە ڕێگاوە دانراوە.
