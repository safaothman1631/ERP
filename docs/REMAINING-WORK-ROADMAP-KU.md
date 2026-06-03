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

## ✅ پۆل ٣ — Feature-ی گەورە (تەواوبوو 2026-06-03)

**هەر ٦ بەشەکە جێبەجێکران + wire + validated** (backend 1619 passed / 3 pre-existing · frontend tsc 0 · build 0 · vitest 1321 · هەموو gate سەوز). **٠ commit/deploy تا ئەو کاتە.**

### ٣.١ Reports N+1 ✅ — collection_group + **چالاککراو (flag ON)**
denormalize-ی `org_id`+`je_date` بۆ هەر line (write path)، `journal_balances_cg()` بە یەک `collection_group('lines')` query، legacy fallback، dispatcher. index deploy کراوە، backfill ڕان کرا (68 entry / 137 line)، **validated لەسەر داتای ڕاستەقینە: `journal_balances_cg == legacy` byte-for-byte**. `REPORTS_USE_COLLECTION_GROUP = True` (auto-fallback لەسەر هەر هەڵە).

### ٣.٢ Consolidation ✅
`consolidation.py` (per-entity TB + consolidated TB + P&L/BS + minority interest)؛ `company_id` tagging لە هەموو JE (invoice/bill/COGS/**payment/POS** — ئەم سێشنە payment+POS threading زیادکرا)؛ ئەندپۆینتە کۆنەکانی `/consolidated/pl,bs` ئێستا delegate دەکەن بۆ GL engine؛ **IC-transaction-driven elimination** (لەگەڵ account-based، tagged بە `source`).

### ٣.٣ Event bus ✅ — registry + reliable dispatch + **hot-path coupling (flag-gated)**
handler registry + backoff + dead-letter + replay + `enqueue_in_transaction` + handlerە ڕاستەقینەکان. ئەم سێشنە: `emit_event` coupling زیادکرا بۆ JE write (invoice.confirmed)، **validated لەسەر Firestore-ی ڕاستەقینە (outbox doc لە هەمان transaction، بێ ReadAfterWriteError)**. `OUTBOX_HOTPATH_ENABLED = False` (staged rollout — کۆد تەواو، چالاککردن بڕیاری deploy-time).

### ٣.٤ Perpetual valuation ✅ (کۆد تەواو، flag بەمەبەست OFF)
FIFO + moving-average engine + service + receive/issue hooks. `PERPETUAL_VALUATION_ENABLED = False` **بەمەبەست** — flip-ی گلۆباڵ COGS-ـی org-ـە بێ cost-layer دەشکێنێت (short to 0)؛ چالاککردن per-org پاش seed-ی layer. **نەک کەلێنی کۆد — switch-ی rollout.**

### ٣.٥ WMS / TMS ✅
engine + firestore + API (`/api/wms`, `/api/tms`) + frontend pages + **nav entries** (ئەم سێشنە زیادکرا) + main.py wired. ٤٥ تێست.

### ٣.٦ MDM / BPMN / API gateway ✅
MDM golden + BPMN workflow engine + API (`/api/mdm`, `/api/bpmn`) + frontend + nav. **API gateway** (ئەم سێشنە): `/api/public/v1` بە API-key auth + rate-limit + key management (`api_keys.manage` perm). ٢٢+١٢ تێست.

> **ماوەی deploy-time (operational، نەک کۆد):** flip-ی `OUTBOX_HOTPATH_ENABLED` کاتێک ئامادە بۆ event-driven؛ flip-ی `PERPETUAL_VALUATION_ENABLED` per-org پاش seed-ی cost-layer.

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
