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
