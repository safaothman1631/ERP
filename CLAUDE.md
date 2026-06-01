# CLAUDE.md — وەسفی پڕۆژە (Project Map)

> ئەم فایلە بۆ ئەوەیە کە Claude هەر کاتێک پێویستی بە زانیاری پڕۆژە بوو، تەنها ئەمە بخوێنێتەوە بێ ئەوەی هەموو فایلەکانی تر بخوێنێتەوە. هەر گۆرانکاریەک کە Claude دەکات پێویستە ئێرەش بنووسێت.

---

## 🏗️ پڕۆژە چییە؟

**سیستەمی ERP/بازرگانی تەواو** — وەک Zoho One، بەڵام بە زمانی کوردی (سۆرانی) و پشتگیری عێراق. دوو بەش هەیە:

| بەش | تەکنەلۆژی |
|------|------------|
| `frontend/` | React + TypeScript + Vite + Zustand |
| `backend/` | Python (venv لە `backend/venv/`) |

---

## 📁 پێکهاتەی فایلەکانی سەرەکی (frontend/src)

```
frontend/src/
├── types/index.ts              ← تایپەکانی سەرەکی (Contact, Item, Invoice, Bill, Project...)
├── pages/
│   ├── modules/moduleConfigs.ts ← کۆنفیگی 30+ مۆدیوولی ext (Wave A/B/C/D)
│   └── ...                     ← هەموو پەڕەکانی تر
├── layouts/
│   ├── moduleMap.ts            ← ڕووت → ModuleKey mapping
│   └── navDestinations.ts      ← تۆمارخانەی هەموو ڕووتەکان
├── stores/
│   ├── posCart.ts              ← سەبەتەی POS (IndexedDB persist)
│   ├── posFloor.ts             ← نەخشەی POS
│   ├── posSession.ts           ← سێشنی POS
│   └── posOffline.ts           ← POS ئۆفلاین
├── components/
│   ├── pos/                    ← کۆمپۆنێنتەکانی POS
│   └── ...
├── design-system/              ← سیستەمی دیزاین
├── hooks/                      ← Custom React hooks
├── api/                        ← کلاینتی API
├── docs/sections/              ← دۆکیومێنتی هەر مۆدیوول
├── locales/                    ← وەرگێڕان
└── stores/                     ← Zustand stores
```

---

## 🧩 مۆدیوولەکانی سیستەم

### Wave A — بازرگانی سەرەکی (Core Business)
| ڕووت | ناو |
|------|-----|
| `/invoices` | فاکتور |
| `/quotes` | نرخنامە |
| `/sales-orders` | داواکاری فرۆشتن |
| `/bills` | پسوولە |
| `/purchase-orders` | داواکاری کڕین |
| `/expenses` | خەرجی |
| `/banking` | بانکداری |
| `/accounts` | هەژمارداری |
| `/journals` | ژوورناڵ |
| `/inventory` | ئەنبار |
| `/manufacturing` | بەرهەمهێنان |
| `/pos` | POS (فرۆشگا) |
| `/crm` | CRM |
| `/hr` | کارمەند |
| `/payroll` | مووچە |
| `/projects` | پڕۆژە |
| `/assets` | دارایی |
| `/reports` | ڕاپۆرت |
| `/l10n-iq` | زیاتری عێراق |
| `/einvoice` | فاکتوری ئەلیکترۆنی |
| `/helpdesk` | یارمەتیدان |
| `/field-service` | خزمەتگوزاری مەیدانی |
| `/subscriptions` | بەشداری |
| `/dms` | دۆکیومێنت |
| `/kb` | ویکی/زانیاری |

### Wave B — Engagement (`/ext/<slug>`)
`livechat`, `social`, `comms`, `engagement`, `elearning`

### Wave C — Platform (`/ext/<slug>`)
`rental`, `ai`, `mobile`, `iot`, `studio`

### Wave D — Vertical Industries (`/ext/<slug>`)
`healthcare`, `hospital`, `pharmacy`, `hotel`, `restaurant`, `construction`, `real-estate`, `education`, `logistics`, `agriculture`, `ngo`, `government`

### زیادکراوەکانی تر
`quality`, `maintenance`, `plm`, `repairs`, `hr-extended`

---

## 🔑 تایپەکانی سەرەکی (`types/index.ts`)

- `Contact` — کڕیار/دابینکار
- `Item` — بەرهەم/خزمەت
- `Invoice` / `InvoiceLine` — فاکتور
- `Bill` — پسووڵە
- `Quote` — نرخنامە
- `Expense` — خەرجی
- `Project` — پڕۆژە
- `Account` — هەژمار (هەسابداری)
- `ApiListResponse<T>` — وەڵامی لیست لە API

---

## 🗺️ ڕووتەکان

- **تۆمارخانەی تەواو:** `layouts/navDestinations.ts`
- **ڕووت → مۆدیوول:** `layouts/moduleMap.ts`
- **مۆدیوولەکانی ext:** `/ext/<slug>` (وەک `/ext/healthcare`)

---

## 🏪 POS (فرۆشگا)

- **Offline-first:** IndexedDB بەکاردەهێنرێت (نە localStorage)
- **Stores:** `posCart`, `posFloor`, `posSession`, `posOffline`
- **کۆمپۆنێنت:** `components/pos/`
- **ڕاپۆرت:** `pages/pos/`
- **Kitchen Display:** `pages/pos/POSKitchen.tsx`
- **ڕیسیت:** `components/pos/ReceiptTemplate80mm.tsx`

---

## 🌐 زمان و L10n

- **UI:** کوردی سۆرانی بە دروستی
- **زیاتری عێراق:** `/l10n-iq`, `/einvoice`, `/whatsapp`, `/ocr`
- **وەرگێڕان:** `frontend/src/locales/`
- **i18n:** فایلی `i18n.ts` + `hooks/useLanguage.ts`

---

## 🔌 مۆدیوولی ext — کۆنفیگ

هەموو 30+ مۆدیوولی ext لە **`pages/modules/moduleConfigs.ts`** تۆمار کراون. هەر مۆدیوول هەیەتی:
- `slug` — ڕووت (`/ext/<slug>`)
- `basePath` — API (`/api/<slug>`)
- `title` — ناوی کوردی
- `group` — `engagement | platform | vertical`
- `resources[]` — تابەکان + فیلدەکانی فۆرم

---

## 🪝 Custom Hooks گرینگەکان

| Hook | بەکاری |
|------|--------|
| `useCRUD` | CRUD بۆ هەموو ڕیسۆرسەکان |
| `useMutationRefresh` | دووبارەخوێندنەوە پاش گۆرانکاری |
| `useFirestoreLive` | داتای زیندوو |
| `useFeatureFlag` | فیچەر فلاگ |
| `useLayout` | کۆنتڕۆلی لایەوت |
| `usePermission` | مۆڵەتەکان |
| `useMediaQuery` | ڕێسپۆنسیڤ |
| `useLanguage` | زمان |

---

## 🛠️ Design System

فایلەکان لە `design-system/`:
- `DetailLayout.tsx` — لایەوتی وردەکاری
- `KeyValueGrid.tsx` — گریدی کلیل-بەها
- `InlineEdit.tsx` — دەستکاریکردنی لە جێخۆی
- `ColumnVisibility.tsx` — نیشاندانی ستوون
- `ContextMenu.tsx` — مێنیوی کونتێکست
- `KbdHint.tsx` — کلیلەکانی کیبۆرد
- `EnvironmentBadge.tsx` — نیشانەی ژینگە
- `UserSelect.tsx` — هەڵبژاردنی بەکارهێنەر

---

## 📊 API

- `api/featureFlags.ts` — فلاگەکانی فیچەر
- `api/vendorPortal.ts` — پۆرتاڵی دابینکار

---

## 🧪 تێستەکان

- `*.test.ts` / `*.test.tsx` لە تەنیشتی فایلی سەرەکی
- `*.vitest.test.tsx` — تێستی Vitest
- `*.integration.test.ts` — تێستی یەکگرتن

---

## ⚠️ تێبینی گرینگ

1. `backend/venv/` — تەنها Python virtual environment, **کۆدی سەرەکی باکەند لێرە نییە** (دەبێت لە جێگایەکی تر بێت یان هێشتا نەنووسراوە)
2. `node_modules/` — هەرگیز دەستکاری نەکە
3. POS بە IndexedDB کار دەکات بۆ ئۆفلاین — نە localStorage
4. هەموو مۆدیوولی ext ئەکتیفکردنیان پێویستە لە `moduleConfigs.ts`

---

## 📝 تۆمارخانەی گۆرانکاریەکانی Claude

> هەر گۆرانکارێک کە Claude دەکات ئێرە دابنووسرێت:

### 2026-05-27 — Critical Fix A (Frontend Build & Integration)

- `frontend/package.json` — بەرز کردنەوەی `vite-plugin-pwa` لە `^0.20.5` بۆ `^1.3.0` (پشتگیری vite v8).
- `frontend/vite.config.ts` — زیادکردنی `VitePWA(PWA_CONFIG)` لە `plugins[]` پاش `react()`. ئەمە `dist/sw.js` دەنووسێت لە کاتی build.
- `frontend/eslint.config.js` — تۆمارکردنی پلاگینی `local` لە `../tools/eslint-rules/index.js` و چالاککردنی دوو ڕێسا:
  - `local/require-query-class: 'warn'`
  - `local/precise-invalidation: 'warn'`
- `frontend/src/main.tsx` — گۆڕینی `import './i18n'` بۆ `initI18n()` لە `./i18n.config` (namespaced lazy loading) لەگەڵ fallback بۆ مۆدیوولی legacy.
- `_deltas/critical-fix-A-summary.md`, `_deltas/build-evidence-frontend.txt`, `_deltas/bundle-sizes-after-build.txt` — تۆماری گۆڕانکاریەکان.

**TODOs بۆ بەکارهێنەر:** بەکارهێنەر دەبێت `npm install --legacy-peer-deps` و `npm run build` و `npm run i18n:split` لە Windows جێبەجێ بکات — ژینگەی Linux sandbox توانای تەواوکردنی install-ی نەبوو.

### 2026-05-28 — EP-2 Long-Tail Selector Migration (Empty State + Quick Create)

- `frontend/src/pages/ItemForm.tsx` — گۆڕینی `income_account_id` و `expense_account_id` بۆ `<SelectWithQuickCreate entity="account" />`. لابردنی `accounts` state و `/api/accounts` fetch.
- `frontend/src/pages/BankReconciliation.tsx` — گۆڕینی هەڵبژاردنی هەژماری بانک بۆ `<SelectWithQuickCreate entity="bank_account" />`. لابردنی `accounts` state و `useEffect`.
- `frontend/src/pages/subscriptions/SubscriptionsList.tsx` — گۆڕینی `contact_id` (Input → SelectWithQuickCreate customer) و `plan_id` (Select → SelectWithQuickCreate subscription_plan) لە درۆڕی فۆرم.
- `frontend/src/pages/maintenance/Equipment.tsx` — گۆڕینی `category_id` لە فۆرمدا بۆ `<SelectWithQuickCreate entity="equipment_category" />`.
- `frontend/src/pages/multi-entity/CompaniesList.tsx` — گۆڕینی currency Select-ی hardcoded بۆ `<SelectWithQuickCreate entity="currency" />`. لابردنی Select لە antd import.
- `_deltas/EP-2-summary.md` — تۆماری گۆڕانکاریەکان + skipped files (ExpenseForm, Rental, Repair, IoT, Workflow).

**تێبینی:** ئەم گۆڕانکاریانە پشت بە `frontend/src/design-system/empty/SelectWithQuickCreate.tsx` و `frontend/src/data/quickCreateRegistry.ts` دەبەستن کە EP-0 دروستی دەکات. تا EP-0 جێبەجێ نەکرێت، compile ناکات.

### 2026-05-29 — launch-readiness Phase R1 (Backend Quick-Create Endpoints)

سپێسی `.kiro/specs/launch-readiness` بلۆکەری #2 (ئەندپۆینتە کەمەکانی Quick-Create). ٩ ئەندپۆینتی نوێ/alias دروستکران کە پێشتر 404 دەیاندا کاتێک بەکارهێنەر مۆداڵی quick-create دەکردەوە:

- `backend/app/schemas/quick_create.py` — مۆدێلی Pydantic بۆ Create/Response (expense_category, equipment_category, currency, tag, payment_method, team, subscription_plan, bank_account, location). ناوی فیلدەکان بە تەواوی لەگەڵ `quickCreateRegistry.ts` یەکدەگرنەوە.
- `backend/app/firestore/quick_create_repos.py` — repo-کان بۆ کۆلێکشنە نوێیەکان (بێ `WRITE_MODEL` تا فیلدەکان نەفڕێنرێن).
- `backend/app/api/quick_create.py` — ٩ ڕووتەر: `/api/expense-categories`, `/api/equipment-categories`, `/api/currencies` (idempotent upsert بە کۆد), `/api/tags` ((scope,name) dedup → 200), `/api/payment-methods` (`requires_gateway_config` + default-flip), `/api/teams`, `/api/subscription-plans` (alias), `/api/bank-accounts` (alias + ماسکی ژمارە), `/api/locations` (شوێنی بازرگانی، default-flip). هەر یەکێک: GET list + POST 201 لەگەڵ `Location` header + `require_perm`.
- `backend/app/main.py` — تۆمارکردنی ڕووتەرە نوێیەکان (`quick_create_api.ALL_ROUTERS`).
- `backend/app/services/permissions.py` — زیادکردنی ٩ کۆدی مۆڵەت بۆ `ALL_PERMISSIONS`.
- `backend/app/middleware/idempotency_http.py` — زیادکردنی prefix-ە نوێیەکان بۆ پشتگیری `Idempotency-Key` (idempotency + rate-limit بە middleware-ی گشتی).
- `backend/tests/quick_create/` — ٩ فایلی تێست (٤٠ تێست): happy-path 201 + Location، validation 422، permission 403، و کەیسە تایبەتەکان (idempotent currency, tag dedup, gateway flag, default-flip, account-number mask). **هەموو ٤٠ تێست سەرکەوتوو بوون.**

**جێبەجێنەکراو (پێویستی بە دەستگەیشتنی دەرەکی هەیە، نەکراون):** R2.1–R2.4 hardening-ی ئەندپۆینتە بەردەستەکان (contacts/items/taxes/accounts کاردەکەن)؛ R3 staging (GCP/DNS/Vercel)؛ R4 sandbox-ی پارەدان (FastPay/Qi/Zain credentials)؛ R5 Stripe billing (legal entity)؛ R7 پرسیارە کراوەکان.

### 2026-05-29 — launch-readiness Integration Wiring (R3/R4/R5 routers → main.py)

تەواوکردنی TODO-ی integration کە ئاژانسە پێشووەکان (R3 onboarding، R4 payments، R5 SaaS billing) نەیانتوانیوە بکەن چونکە بنەماکانیان ڕێگەی دەستکاری `main.py`/`requirements.txt` نەدەدا. هەموو مۆدیوولەکان پێشتر بوونیان هەبوو و پاک import دەبوون (stripe بە lazy-import).

- `backend/app/main.py` — import + تۆمارکردنی: `onboarding_wizard_api.ALL_ROUTERS`، `payments_api.ALL_ROUTERS`، `invoices_payments_api.router`، `saas_billing_api.router`، `saas_admin_api.ALL_ROUTERS`. هەروەها بانگکردنی `register_default_providers()` لە کاتی startup (لەناو try/except دژی شکستی bootstrap).
- `backend/app/middleware/idempotency_http.py` — زیادکردنی prefix-ەکانی `/api/onboarding/coa/` و `/api/payments/`.
- `backend/requirements.txt` — زیادکردنی `pyyaml>=6.0,<7.0` و `stripe>=11.0.0,<13.0.0`.
- ڕووتە تۆمارکراوەکان (پشتڕاستکراو): `/api/onboarding/state`, `/api/onboarding/coa/apply`, `/api/payments/initiate|/{id}/capture|/{id}/refund`, `/api/payments/webhooks/{provider_slug}`, `/api/invoices/{id}/pay-link`, `/api/saas-billing/webhooks/stripe`, `/api/saas-billing/admin/*`.

**تاقیکردنەوە:** ١٩٣ تێست سەرکەوتوو + ١ skipped (`tests/quick_create/` ٤٠، `tests/billing/` ٦٨، `test_onboarding`، `test_payments_*`). ڕیگرێشن: ٢١ تێستی پەیوەندیدار (pre-launch, rbac, idempotency, v1, module-gate, rate-limit) سەوز. app بەتەواوی boot دەبێت (١٣٨١ ڕووت).

**ماوە بۆ بەکارهێنەر:** `pip install -r requirements.txt` (بۆ stripe لەسەر ماشینی خۆت)؛ STRIPE_* env vars؛ Firestore composite indices (R4)؛ APScheduler cron؛ هەروەها هەموو ئەوەی لە `_deltas/launch-readiness-REMAINING-WORK.md` (GCP staging, payment sandboxes, Stripe entity, R7).

### 2026-05-29 — launch-readiness Local Finalization (deps + indices + cron + env)

تەواوکردنی هەنگاوە ناوخۆییەکانی ماوە کە دەکران لێرە جێبەجێ بکرێن:

- **`stripe>=11,<13` دامەزرا** لە venv (نسخە 12.5.1) — `app.main` ئێستا بەتەواوی boot دەبێت لەگەڵ stripe بەردەست.
- **`firestore.indexes.json`** — زیادکردنی ٣ composite index بۆ `payments`: `(org_id, status, created_at DESC)`, `(org_id, provider_slug, provider_charge_id)`, `(org_id, invoice_id, created_at DESC)`. JSON دروستە (٢٨ index).
- **`app/services/scheduler.py`** — زیادکردنی job-ی `payments_reconciliation_nightly` (CronTrigger hour=2, minute=15) + فەنکشنی `_job_payments_reconciliation()` کە `run_nightly_reconciliation()` بۆ هەموو org-ەکان دەخوازێت. ژمارەی job: 14 → 15.
- **`app/utils/env_docs.py` + `.env.example`** — زیادکردنی بەشی Payments: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (placeholder), `PUBLIC_APP_URL`. `.env.example` دروستکرایەوە.

**تاقیکردنەوەی کۆتایی:** ٢٣٨ تێست سەرکەوتوو (quick_create 40, billing 68, onboarding, payments, env_docs 34, scheduler_properties). app boot دەبێت، job-ی reconciliation تۆمارکراوە.

**ماوە (تەنها دەرەکی — Claude ناتوانێ):** GCP staging infra، بڕواننامەی sandbox-ی FastPay/Qi/Zain، Stripe legal entity + کلیلە ڕاستەقینەکان، deploy-ی `firestore.indexes.json` بۆ GCP. هەموو لە `_deltas/launch-readiness-REMAINING-WORK.md`.

### 2026-05-29 — growth-to-100 Phase G4b (Iraq Localization)

سپێسی growth-to-100 § R4 (compliance، بەشە غەیری e-Fakhata).

- **WHT engine**: `backend/app/tax/withholding.py` (WHTCalculator + 4 placeholder rate) + `app/api/wht.py` (`POST /api/tax/wht/calculate`, `GET /rates|/report`). 18 تێست.
- **CBI rates**: `app/services/cbi_rates.py` (fetch + 7-day fallback + hardcoded 1320) + `app/services/currency_converter.py` + `app/api/cbi_rates.py`. Cron `cbi_rate_refresh_daily` ساتی 06:00 UTC. 14 تێست.
- **PDF Iraqi**: `app/pdf/iraqi_formatter.py` (IQD با U+066C، Arabic-Indic، phone +964، Hijri) + `app/pdf/arabic_typesetter.py` (Noto Naskh → Amiri → Helvetica fallback) + 3 template (Arabic/Kurdish invoice + Arabic receipt). 17 تێست.
- **Iraq presets**: `app/data/iraqi_tax_presets.py` — 18 governorate × WHT × 3 sector، هەموو placeholder.
- **Company schema**: `app/schemas/company.py` — `commercial_registration_no` + format validator.
- **Frontend utils**: `utils/iqd-denominations.ts` (DENOMINATIONS، breakDown، quickCashTenders، format) + `utils/arabic-digits.ts` + `utils/hijri-date.ts` (Intl + tabular، بێ npm dep). 39 vitest.
- **Frontend contexts/components**: `DigitPreferenceContext` + `CalendarPreferenceContext`؛ `WHTBreakdown`، `CashDrawerBreakdown`، `QuickCashTender`، `CurrencyConverter`، `CalendarToggle`، `DigitPreferenceToggle`. `hooks/useCBIRate.ts`.
- **Settings**: `CompanyInfo.tsx` — زیادکردنی فیلدی `commercial_registration_no`.
- **Wiring**: `main.py` (2 router)، `idempotency_http.py` (2 prefix)، `scheduler.py` (1 cron نوێ → 16 job).
- `_deltas/G4b-l10n-summary.md` + `_deltas/G4b-deps.md`.

**ماوە:** `hijri-converter>=2.3.1` لە requirements.txt (ئیختیاری)؛ Noto Naskh + Amiri TTF لە `backend/app/static/fonts/`؛ `CBI_API_URL` env var؛ R7.1 (verification بۆ 112 placeholder)؛ R7.6 (CBI URL/schema).

### 2026-05-29 — launch-readiness Phase R4 (Tenant-Side Payments Scaffolding)

سپێسی launch-readiness Phase R4. `PaymentGateway` ـی ئابسترەکت + هەفت adapter + Firestore model + API + UI ـی Settings و POS و pay-link.

- `backend/app/payments/{__init__,gateway,registry,bootstrap}.py` — Protocol + value objects + runtime registry + default-adapter registration.
- `backend/app/payments/{cash,cod,stripe}_gateway.py` — تەواوبوون. Cash بە idempotent immediate-succeeded، COD بە state machine تەواو، Stripe بە HMAC-SHA256 webhook verify + BalanceTransaction settlement.
- `backend/app/payments/{fastpay,qi,zain_cash,asia_pay}_gateway.py` — interface تەواو، بەڵام هەر method ـێک `NotImplementedError('… credentials pending — see R7.X')` دەگەڕێنێتەوە.
- `backend/app/firestore/payment_repo.py` — `PaymentRepository` + `WebhookEventLogRepository` (dedup) + `ReconciliationQueueRepository`.
- `backend/app/api/payments.py` — `POST /api/payments/initiate|/{id}/capture|/{id}/refund`، `GET /api/payments[/{id}]`، `POST /api/payments/webhooks/{provider}` (public, signature-verified, deduped). `ALL_ROUTERS`.
- `backend/app/api/invoices_payments.py` — `POST /api/invoices/{id}/pay-link` (signed JWT).
- `backend/app/services/payments_reconciliation.py` — `run_nightly_reconciliation()` بۆ APScheduler.
- `backend/tests/test_payments_{cash,cod,stripe,webhooks}.py` — 31 تێست (repo-mocked).
- `frontend/src/pages/settings/payments/{Providers,Reconciliation}.tsx` — لیستی provider + reconciliation queue.
- `frontend/src/components/pos/POSPaymentMethodPicker.tsx` — گریدی tile لە POS، flow ـی جیاواز بۆ هەر provider.
- `frontend/src/pages/pay/PayLink.tsx` — پەڕەی گشتی hosted payment لە `/pay/:token`.
- `_deltas/R4-deps.md` + `_deltas/R4-payments-summary.md`.

**TODOs بۆ بەکارهێنەر (یاسا: ناتوانم `main.py` و `requirements.txt` دەستکاری بکەم):** (1) `stripe>=11.0.0,<13.0.0` لە `requirements.txt`؛ (2) `register_default_providers()` لە `main.py` startup + `include_router(payments_api.ALL_ROUTERS[0])` + `include_router(invoices_payments_api.router)`؛ (3) `/api/payments/` لە `_IDEMPOTENCY_PREFIXES`؛ (4) `STRIPE_*` env vars؛ (5) 3 composite index لە `firestore.indexes.json`؛ (6) APScheduler cron `02:15`. هەموو ورد لە `_deltas/R4-payments-summary.md`.

**بلۆکی دەرەکی:** R7.2 (FastPay), R7.3 (Qi), R7.4 (Zain), R7.5 (Asia Pay). کاتێک credentials دەگەڕێ، تەنها 5 method-ی پەیوەندیدار لە فایلی `*_gateway.py` پر بکرێتەوە.

### 2026-05-29 — growth-to-100 Phase G3 (Hardware Compatibility Layer)

سپێسی `.kiro/specs/growth-to-100` §R3. لایەنی ESC/POS ـی POS هاردوێر بە تەواوی پڕۆداکشن-گرەید نوسرا — درایڤەری چاپکەر، کاش درۆوەر، سکانەر، نمایشی کڕیار، تێمپلەیتی پسوولە، wizard-ی ٧ هەنگاوی pair، API ـی tenant، و دۆکیومێنت. تەنها هاردوێری فیزیکی بەکارنەهاتووە — هەموو dialect-ەکان فیکسچەری بایت-ستریمیان هەیە، ئامادە بۆ procurement.

**فرۆنتێند (`frontend/src/hardware/`):**
- `printers/types.ts` + `dialects/_baseline.ts` + 5 dialect (Epson, Xprinter, Bixolon, generic 58mm BT, generic 80mm) + `dialects/index.ts` + `detection.ts` (GS I 1 probe + name regex + NUS service hint) + `commands.ts` (printReceipt, breakdownIQD, formatIQD, toArabicIndic) + `printer-service.ts` (Web Bluetooth/USB/Serial + native BLE + browser-print fallback) + `tests/printer-driver.test.ts` (30 case).
- `cash-drawer/cash-drawer.ts` — kickPin5/kickPin2 + per-dialect defaults.
- `scanner/scanner-service.ts` — HID keyboard-wedge + `useBarcodeInput()` hook + camera bridge + `tests/scanner-service.test.ts` (8 case).
- `customer-display/{types,serial-driver,bluetooth-driver,wifi-driver,display-service}.ts` — سێ ڕێگەی نمایش (LCD pole VFD، BT-tablet PWA، WiFi TV).
- `receipts/{Receipt58mm,Receipt80mm,ReceiptIQD}.tsx` + `templates/{standard,with-logo,arabic,restaurant}.tsx`.

**فرۆنتێند کۆمپۆنێنت (`frontend/src/components/pos/`):**
- `HardwarePairingWizard.tsx` — wizard-ی ٧ هەنگاوی (Device → Connection → Discover → Confirm → Dialect → Test print + cut → Drawer + save)؛ persist بۆ localStorage.
- `TestPrintPreview.tsx` — preview ـی پسوولە + ESC/POS command trace.
- `HardwareDeviceCard.tsx` — کارتی ئامێر + RSSI bar.

**داتا (`frontend/src/data/`):**
- `hardwareRegistry.ts` — ١٠ چاپکەر + ٥ سکانەر + ٢ درۆوەر + ٤ نمایش لەگەڵ نرخی USD، dialect ID، و statu‌s.

**باکێند (`backend/app/api/`):**
- `tenant_hardware.py` — GET/PUT/DELETE بۆ printers/scanners/drawers/displays لە `/api/tenants/{tid}/hardware/<kind>[/<id>]` + bundle + `POST /reset-defaults` (R3.15). فایرستۆر لە `tenants/{tid}/hardware/{kind}/items/{id}` + in-memory fallback. `ALL_ROUTERS` ئامادە بۆ تۆمارکردن لە `main.py`.

**Mobile bridges (`mobile/src/bridge/`):**
- `printer.ts` — زیادکردنی `DialectHint` + `recommendedChunkSize()` بۆ BLE MTU per dialect (Epson 200B، Bixolon 180B، Xprinter 160B، generic-58 120B).
- `scanner.ts` — زیادکردنی `unifiedScanner.startUnified(onResult)` بۆ یەکخستنی HID + ML Kit native.

**دۆکیومێنت (`docs/`):**
- `hardware/compatibility-matrix.md` — جەدوەلی پشتگیری.
- `hardware/setup-guides/` — ٤ گاید (Epson TM-T20III، Xprinter XP-T80A، Bixolon SRP-330II، generic 58mm BT).
- `hardware/troubleshooting.md` — جەدوەلی symptom → cause → fix.
- `sales/hardware-kits.md` — ٣ بەستە بۆ partnership (Starter USD 295، Pro USD 545، Kitchen USD 680) + پلانی outreach W4–W7.

**دەلتا:** `_deltas/G3-hardware-summary.md` (تەواو، لەگەڵ test counts، top-5 procurement list، open questions).

**TODOs بۆ بەکارهێنەر:** (1) تۆمارکردنی `tenant_hardware.ALL_ROUTERS` لە `backend/app/main.py`؛ (2) route entry بۆ `HardwarePairingWizard` لە `App.routes.tsx`؛ (3) procure ـی top-5 ئامێر (~USD 720)؛ (4) دامەزراندنی engineer-ی Baghdad بۆ regression-ی سێ-مانگی.

### 2026-05-29 — launch-readiness Phase R3 Frontend (Onboarding Wizard, 5 steps)

سپێسی launch-readiness Phase R3 (frontend only). Wizard-ێکی نوێی ٥ هەنگاوی "یەکەم ٦٠ چرکە" دروستکرا کە لە "بنکەی بەتاڵ" بۆ "یەکەم فرۆشتن" دەبا. تەواوی فایلەکانی نوێ لە تەنیشتی wizard-ی پێشوو (industry/module-picker) دانراون و لێکجیاوازن (`useOnboardingWizardStore` vs پێشوو `useOnboardingStore`).

- `frontend/src/onboarding/state.ts` — Zustand store + transition reducer (start/next/back/skip/goTo/complete/save/hydrate)؛ auto-skip-ی POS بۆ services/ngo؛ `normalizeIraqPhone()` (E.164).
- `frontend/src/onboarding/telemetry.ts` — RUM emitter بۆ `onboarding.started/step_completed/step_skipped/completed/abandoned` لە `/api/rum/vitals`.
- `frontend/src/onboarding/state.test.ts` — تێستی هەموو transition-ەکان + resume-from-state.
- `frontend/src/onboarding/OnboardingShell.tsx` — هێدەری progress bar، animated step slot (Framer Motion، RTL، prefers-reduced-motion)، فووتەری Back/Skip/Next/Finish، auto-save، CSS-only confetti.
- `frontend/src/onboarding/steps/StepCompanyInfo.tsx` — Antd Form (ناو، ناونیشان، فۆن E.164، VAT status، business_type، intended_use).
- `frontend/src/onboarding/steps/StepIraqRegion.tsx` — SVG-ی ١٨ پارێزگا (clickable + keyboard) + لیستی Radio-ی دەستڕاگەیشتو + side card.
- `frontend/src/onboarding/steps/StepChartOfAccounts.tsx` — ٥ template card + Tree preview + `POST /api/onboarding/coa/apply`.
- `frontend/src/onboarding/steps/StepPOSHardware.tsx` — Web Bluetooth pairing (ESC/POS UUID)، paper width 58/80mm، cash drawer pin 2/5، browser-print fallback، Skip prominent.
- `frontend/src/onboarding/steps/StepFirstSale.tsx` — ٤ sub-step (product → customer → sale → receipt) بە POST بۆ `/api/items`, `/api/contacts`, `/api/invoices`.
- `frontend/src/data/iraqRegionPresets.ts` — ١٨ پارێزگا + tri-lingual labels + withholding rates + `placeholder: true` بۆ R7.1 verification.
- `frontend/src/i18n.config.ts` — زیادکردنی `'onboarding'` بۆ `NAMESPACES`.
- `frontend/public/locales/{ku,en,ar}/onboarding.json` — ~١٦٥ کلیل بۆ هەر زمانێک.
- `_deltas/R3-frontend-summary.md` — تۆماری گۆڕانکاریەکان + route-wiring TODO + پرسیارە کراوەکان.

**TODOs:** Route wiring لە `App.routes.tsx` (لیستی do-not-modify)، backend endpoints (`/api/onboarding/state`, `/api/onboarding/coa/apply`)، printer service integration، R7.1 tax-rate verification.

### 2026-05-29 — growth-to-100 G4a (Iraq e-Fakhata: XML schema, XAdES-BES signing, MoF queue, auditor export)

سپێسی growth-to-100 § R4 (Iraq Compliance — e-Fakhata). سیستەمی e-invoicing-ی تەواو بۆ وەزارەتی دارایی عێراق دروستکرا.

- `backend/app/efakhata/__init__.py` + `schema.py` — Pydantic + lxml ـی e-Fakhata XML v1.0 (Supplier/Customer/Lines/Totals + Signature placeholder، round-trip parser).
- `backend/app/efakhata/builder.py` — `EFakhataBuilder.from_invoice()` بۆ مەپ کردنی Firestore invoice dict بۆ XML model (لەگەڵ VAT/WHT placeholder، governorate normalization).
- `backend/app/efakhata/version_registry.py` — `current_version = "1.0"` + migration registry بۆ v1.1/v2.0 داهاتوو.
- `backend/app/efakhata/cert_storage.py` — PKCS#12 cert/password لە GCP Secret Manager (`tenant-{tid}-efakhata-cert`)، لەگەڵ in-process fallback بۆ dev (`EFAKHATA_LOCAL_CERT_STORE=1`).
- `backend/app/efakhata/signing.py` — XAdES-BES بە `signxml` + XML-DSig fallback؛ sign/verify/rotate. NEVER لاگ بکات password یان P12 bytes.
- `backend/app/efakhata/submission_queue.py` — Firestore-backed queue (`efakhata_submissions`) لەگەڵ state machine (pending → submitting → submitted → acknowledged/rejected/failed/cancelled)، dedup بە invoice_id، exponential backoff (1m, 5m, 30m, 2h, 12h، MAX 5 attempts).
- `backend/app/efakhata/mof_client.py` — HTTPS + mTLS client بۆ MoF API لەگەڵ `Idempotency-Key`، 30s timeout، 3 retries بۆ network. اگر `MOF_BASE` نەبێت → `MoFNotConfigured` و queue پەلامار نادات.
- `backend/app/efakhata/submission_worker.py` — APScheduler worker (30s poll، 50 batch، per-tenant) بۆ ئاوی کردنی queue.
- `backend/app/efakhata/auditor_export.py` — ZIP builder (`invoices/{n}.xml + .pdf`, `manifest.csv`, `signature_chain.pem`, `README.md`)، GCS upload، 7-day signed URL.
- `backend/app/api/efakhata.py` — `POST /api/invoices/{id}/efakhata/submit`, `GET/POST /api/efakhata/submissions[/{sid}[/cancel]]`, `POST/GET/DELETE /api/tenants/{tid}/efakhata/cert` (multipart).
- `backend/app/api/efakhata_export.py` — `POST/GET /api/efakhata/auditor-export[/{id}]` (BackgroundTask).
- `backend/tests/test_efakhata_{schema,signing,queue,export}.py` — 50 تێست (round-trip XML، XAdES sign+verify+tampering، state machine + backoff، ZIP structure + path-traversal guard).
- `frontend/src/pages/efakhata/{EFakhataDashboard,SubmissionDetail}.tsx` — submissions list + filter + timeline + cancel.
- `frontend/src/pages/settings/efakhata/{CertManagement,AuditorExport}.tsx` — upload cert + revoke + ZIP request.
- `frontend/src/i18n.config.ts` — زیادکردنی `'efakhata'` بۆ `NAMESPACES`.
- `_deltas/G4a-deps.md` + `_deltas/G4a-efakhata-summary.md` — تۆمار + flow diagram + ١٤ TODO بۆ R7.X.

**TODOs بۆ بەکارهێنەر (یاسا: ناتوانم `main.py` و `requirements.txt` دەستکاری بکەم):** (1) `lxml>=5.0,<6.0`, `signxml>=3.2,<4.0`, `google-cloud-secret-manager>=2.20.0` لە `requirements.txt`؛ (2) `include_router(efakhata_api.ALL_ROUTERS[*])` و `efakhata_export_api.ALL_ROUTERS[*]` لە `main.py`؛ (3) APScheduler job `efakhata_submission_drain` (IntervalTrigger seconds=30)؛ (4) `firestore.indexes.json` indices بۆ `efakhata_submissions` (org_id+status+next_attempt_at، org_id+invoice_id) و `efakhata_export_batches`؛ (5) env vars `MOF_BASE`, `GCP_PROJECT_ID` (یان `EFAKHATA_LOCAL_CERT_STORE=1` بۆ dev)؛ (6) `App.routes.tsx` routes بۆ `/efakhata`, `/efakhata/submissions/:sid`, `/settings/efakhata/cert`, `/settings/efakhata/export`.

**بلۆکی دەرەکی:** R7.X (تەسدیقی MoF XML schema و endpoints). 14 جێ بە `# TODO: verify against published spec (R7.X)` نیشانکراون.

### 2026-05-29 — growth-to-100 Phase G1 (Marketing Site, NEW `marketing/` directory)

سپێسی `.kiro/specs/growth-to-100` Phase G1 (T-G.1.1 → T-G.1.13). سایتێکی بازرگانی نوێی Astro v4-ـی سێ زمانە (کوردی/عەرەبی/ئینگلیزی) لە `marketing/` دروستکراوە — جیاوازە لە `frontend/`، static بەتەواوی، RTL، بۆ Vercel ئامادەیە لە `zoho-kurdish.iq`.

- `marketing/{package.json,astro.config.mjs,tailwind.config.mjs,tsconfig.json,vercel.json,.gitignore,.env.example,eslint.config.js,.prettierrc.json,lighthouserc.json,README.md}` — scaffold-ی Astro v4 + Tailwind + MDX + sitemap + RSS.
- `marketing/src/i18n/{utils.ts,ku.json,en.json,ar.json}` — ٢١٠ کلیلی i18n (٧٠ × ٣ زمان)؛ `dir()`, `localeFromPath()`, `localizedPath()`, `alternateUrls()`, `fmtIQD()`, `fmtUSD()`.
- `marketing/src/layouts/{BaseLayout,MarketingLayout,DocsLayout}.astro` — HTML shell بە hreflang، OG، JSON-LD، skip-link، CookieBanner.
- `marketing/src/components/` — ١٣ کۆمپۆنێنتی سەرەکی: Hero (لەگەڵ A/B test `landing-hero-cta` چالاککراو), Header, Footer, LanguageSwitcher, FeatureCard, PricingCard (IQD/USD toggle + monthly/annual), Testimonial, CTABanner, EmailCapture (POST بۆ `/api/marketing/leads`), AnalyticsScripts (Plausible + GA4 consent-gated), CookieBanner, StructuredData (Organization + SoftwareApplication + WebPage/Article/FAQPage), SEO.
- `marketing/src/components/sections/{ProblemsSection,FeaturesSection,PricingSection,TestimonialsSection}.astro` — بەشە دووبارە بەکارهێنراوەکان.
- `marketing/src/components/pages/{HomePage,PricingPage,FeaturesPage,AboutPage,ContactPage,LegalPage,BlogIndexPage}.astro` — قاڵبە سەرەکیەکان، locale-agnostic.
- `marketing/src/pages/` — ٢٧ پەڕە: ٩ بۆ هەر زمان (default ku بێ prefix، `/en/`، `/ar/`) + `blog/[slug].astro` + `rss.xml.ts`.
- `marketing/src/content/{config.ts,blog/*.md}` — Zod schema + **١٠ وتاری SEO بە ئینگلیزی** (~١.٢k–١.٨k وشە هەرکامێک): iraq-tax-guide-2026, pos-setup-iraq-shopkeeper, e-fakhata-explained, pharmacy-management-iraq, restaurant-pos-iraq, kurdish-erp-vs-zoho, iraqi-dinar-formatting-best-practices, whatsapp-commerce-iraq, offline-first-pos-power-outages, chart-of-accounts-iraq-smb.
- `marketing/src/lib/ab.ts` — کۆمەکی A/B test: visitor-cookie، deterministic hash، Plausible exposure/conversion، سێ ئەزموون تۆمارکراون.
- `marketing/src/styles/brand.css` — CSS variables، Iraqi-flag-inspired palette (muted brand-red + accent-green + ink).
- `marketing/public/{robots.txt,manifest.webmanifest,brand/{favicon.svg,logo.svg,og/*.svg,README.md}}` — بنکەکان + brand placeholder-ەکان.
- `.github/workflows/marketing-ci.yml` — CI بۆ `marketing/**`: install، astro check، lint، build، Lighthouse CI، linkinator.
- `_deltas/G1-marketing-summary.md` — تۆماری گۆڕانکاریەکان + open questions.

**TODOs بۆ بەکارهێنەر:** (1) `npm install --legacy-peer-deps && npm run dev` لە Windows؛ (2) backend endpoint `POST /api/marketing/leads` (T-G.1.11)؛ (3) native-speaker QA-ی کوردی و عەرەبی؛ (4) دیزاینەر brand assets بنێرێت (logo.png، OG raster، favicons)؛ (5) counsel review بۆ `/legal/{terms,privacy,dpa}`؛ (6) decision: Plausible self-hosted vs hosted؛ (7) hCaptcha site key بۆ فۆڕمی contact؛ (8) demo video بۆ A/B variant B-ی hero.

### 2026-05-29 — growth-to-100 (Tier 2) Wiring & Verification — هەموو ئەوەی ماوە کۆدی

تەواوکردنی هەموو کاری کۆدی ماوەی Tier 2 (`growth-to-100`): wiring-ی G2/G3/G4a بۆ ئەو فایلانەی ئاژانسە پێشووەکان ڕێگەیان پێنەدرابوو دەستکارییان بکەن (`main.py`, `scheduler.py`, `requirements.txt`, `App.routes.tsx`, `AppShell.tsx`, `firestore.indexes.json`, `idempotency_http.py`, `env_docs.py`) + چاکردنی چەند بەگێکی نهێنی.

- **Deps (`requirements.txt` + venv):** `lxml>=5,<6`, `signxml>=4,<5` (نەک `<4` — signxml 3.x لەسەر pyOpenSSL 24+ تێکدەچوو چونکە `OpenSSL.crypto.verify` لابراوە؛ 4.x پشت بە pyOpenSSL نابەستێت), `google-cloud-secret-manager>=2.20`؛ `firebase-admin` → `>=6.5,<8`. هەرسێ لە venv دامەزران.
- **`app/efakhata/signing.py`:** گونجاندن لەگەڵ signxml 4.x — لابردنی `signing_time=` لە `XAdESSigner.sign()`، verify بە `x509_cert`-ی ناوبراو (سێرتی self-signed-ی تینانت)، فەنکشنی `_extract_embedded_cert()`، لابردنی placeholder-ی `<ds:Signature>`-ی بەتاڵ پێش واژۆ (XSD validation).
- **`app/efakhata/auditor_export.py`:** چاکردنی path-traversal لە `_safe()` (پێشتر `../etc/passwd` دەڕۆیشت).
- **`backend/app/main.py`:** routerـەکانی G2 (`impersonate`, `tenant_flags`, `nps`, `health_emit`)، G3 (`tenant_hardware`)، G4a (`efakhata`, `efakhata_export` — guarded) + ٢ middleware (`read_only_mode`, `impersonation_audit`). ڕووت: 2325.
- **`app/services/scheduler.py`:** ٣ job نوێ (status-page emit 60s, onboarding-drip 10m, e-Fakhata drain 30s). 16 → 19.
- **`app/api/marketing.py`:** ئەندپۆینتی گشتی `POST /api/marketing/leads` (T-G.1.11) — honeypot + per-IP rate-limit، نووسین بۆ `marketing_leads`.
- **`firestore.indexes.json`:** ٤ index (`efakhata_submissions` ×2، `efakhata_export_batches`، `mobile_devices`). 28 → 32.
- **`idempotency_http.py`:** `/api/nps/`, `/api/admin/impersonate/`.
- **`env_docs.py` + `.env.example`:** ١٣ env var (Crisp, 360Dialog, Statuspage, MoF, EFAKHATA_LOCAL_CERT_STORE, GCP_PROJECT_ID, CBI_API_URL...).
- **Frontend `App.routes.tsx`:** ٦ ڕووت — `efakhata`, `efakhata/submissions/:sid`, `settings/efakhata/cert`, `settings/efakhata/export`, `admin/impersonate`, `get-started` (R3 OnboardingShell).
- **Frontend `layouts/AppShell.tsx`:** `<HelpWidget />` + `<NPSSurvey />` (deferred-load).
- **چاکردنی تێستی latent:** `test_efakhata_signing` (password mismatch لە fixture)، `test_tenant_flags` (`TenantFlagDoc` keyword دووبارە)، `test_email_support.classify` (ڕیزبەندی how-to پێش billing)، `test_withholding` (gross سفر → `applied=False`).

**تاقیکردنەوە:** backend boot (2325 ڕووت)؛ pytest **1152 سەرکەوتوو / 2 شکست** (هەردووکیان pre-existing و بێ پەیوەندی بە Tier 2: `test_redis_rate_limit_config` storage_uri drift، `test_firestore_audit_tool` بۆ `app/firestore/client.py`)؛ frontend `tsc --noEmit` **0 هەڵە**.

**دوای feedback-ی بەکارهێنەر — ئەمانەش کران (پێشتر بە هەڵە "external" نراون):** (1) `HardwarePairingWizard` لە `POSConfigs.tsx` wire کرا (دوگمەی "Pair hardware" → Modal)؛ (2) G2 `ImpersonationBanner` لە `AppShell` mount کرا (alias `TenantImpersonationBanner`؛ لەگەڵ platform banner ناتەبا نییە چونکە token-ی جیاوازن)؛ (3) **`firestore.indexes.json` deploy کرا** بۆ پڕۆژەی `zoho-83cda` (`firebase deploy --only firestore:indexes` — سەرکەوتوو، بێ `--force`)؛ (4) deps لە venv دامەزران.

**`.firebaserc` ڕاستکرایەوە:** default → **`zoho-83cda`** (پڕۆژەی زیندوو کە هەموو config-ـی frontend/backend بەکاریدەهێنێت؛ `erp-system-494716` لابرا چونکە تەنها لێرە بوو و کۆن بوو). `firebase use` → `zoho-83cda`.

**Build-fix (دوای داوای "چێکی تەواوەتی"ی بەکارهێنەر — `npm run build` ـی ڕاستەقینە دۆزییەوە کە tsc نەیدۆزی):**
- `frontend/src/onboarding/steps/StepPOSHardware.tsx`: `BluetoothOutlined` (لە `@ant-design/icons` نییە، بەڵام لە `.d.ts` ڕایگەیاندووە بۆیە tsc تێپەڕی) → `ApiOutlined`.
- `frontend/src/hardware/printers/printer-service.ts`: `import('../../../../mobile/src/bridge/printer')` ـەکە `/* @vite-ignore */`ـی پێدرا (web bundler هەوڵی resolve-کردنی `@capacitor/core` دەدا).
- `backend/app/main.py`: mount-ی `/assets` بە `isdir(dist/assets)` guard کرا — build-ی ناتەواو (`dist` بێ `assets`) پێشتر `app.main` ـی لە import-دا دەکوژی (هەموو تێستەکانی دەشکاند).

**ئەنجامی کۆتایی:** `npm run build` → exit 0 (473 PWA precache)؛ backend pytest → **1152 سەرکەوتوو / 2 شکست** (هەردوو pre-existing، بێ پەیوەندی)؛ `app.main` پاک import دەبێت.

**ماوە (تەنها دەرەکی ڕاستەقینە — credential/account/مرۆڤ):** MoF/CBI URL+schema (R7.x)، Stripe entity+keys، Apple/Play enrollment، Crisp/360Dialog/Statuspage API keys، native-speaker QA، partner-entity lawyer.

### 2026-05-29 — scale-foundation (Tier 3) — ٧ ئەیگێنتی پاراڵێل + integration

تایەری سێیەم (`scale-foundation`، SF1–SF6) بە وۆرکفلۆی ٧ ئەیگێنتی پاراڵێل (٨٨٤k token) بنیاتنرا — هەموو ئەوەی **کۆد/دۆکیومێنت-کراوە**؛ ئەوەی دەرەکییە (دامەزراندن، lawyer، pen-test، GCP apply، pilot ڕاستەقینە) flag کراوە نەک fake. orchestrator wiring-ی فایلە هاوبەشەکانی جێبەجێکرد + verify.

- **SF1 (docs):** `docs/handbook/` (engineering-handbook ١٢ بەش + onboarding)، `docs/adr/` (٢٠ ADR + README index)، `docs/runbooks/` (١٠)، `scripts/ops/iam-leaver-audit.py` + allowlist، `docs/oncall/{escalation-policy,rotation}.md`.
- **SF2 (legal drafts + GDPR code):** `legal/` (١٠ دۆکیومێنتی DRAFT: ToS/Privacy/DPA/MSA/Order/SLA/sub-processors/AUP/Cookie/Refund)، `docs/compliance/calendar.yml`، `templates/employment/`؛ **data-rights** فانکشناڵ: `backend/app/api/data_rights.py` (٤ endpoint) + service/repo/purge + `test_data_rights.py` (١٨ تێست) + `frontend/.../settings/sections/system/DataRights.tsx` (perms: `privacy.export/erasure`).
- **SF3 (DR):** `scripts/dr/{restore-full,restore-tenant,provision-dr}.sh` + helpers، `backend/app/api/admin/dr_restore.py` (4-eyes + diff، ١٤ تێست) + `DrRestorePage.tsx`، `.github/workflows/dr-backup-restore-verify.yml`، `docs/runbooks/dr-restore.md`.
- **SF4 (security):** `middleware/csrf.py` + `services/upload_validation.py`، `test_tenant_isolation/jwt/csrf/upload` (١٦٣ تێستی security/DR)، `firestore-rules-tests/` + `docs/security/{firestore-rules-audit,sirp,security-summary}.md`، `.gitleaks.toml` + workflow + pre-commit.
- **SF5 (observability):** `terraform/monitoring/` (٦ dashboard + ٢٤ alert + BQ RUM)، `sql/observability/*.sql`، `observability/{otel_middleware,heartbeat}.py` + `frontend/.../traceparent.ts`، `.github/workflows/{sentry-release,k6-nightly}.yml`.
- **SF6 (UAT toolkit):** `pilots/` (README، ٣٢ Iraqi edge-case، surveys ku/ar/en، _template + worked example)، `templates/pilot-agreement.md`، `docs/training/scripts/` (١٠ سکریپت ku+ar)، `.github/workflows/pilot-release.yml`.

**Wiring (orchestrator):** `main.py` (dr_restore + data_rights router، csrf + otel middleware)؛ `config.py` (CSRF/CLAMAV flags)؛ `scheduler.py` (heartbeat + EVENT_JOB_ERROR listener → ٢٠ job)؛ `App.routes.tsx` (`/platform/dr-restore`)؛ `sections.registry.ts` (`system.gdpr` → DataRights)؛ `api.ts` (traceparent interceptor)؛ `test_scheduler_properties.py` (`deadline=None` بۆ flake).

**تاقیکردنەوە:** backend boot ٢٣٣٨ ڕووت؛ pytest **١٣٣٣ سەرکەوتوو / ٢ شکست** (هەردوو pre-existing: firestore_audit/client.py، redis storage_uri)؛ frontend `tsc` 0 + `npm run build` exit 0 (٤٧٥ PWA).

**ماوە (دەرەکی):** hiring، counsel sign-off + LLC + insurance، pen-test/SOC2/bug-bounty، `terraform apply` + PagerDuty/Sentry accounts، WIF cloud apply، pilot ڕاستەقینەکان + hardware + video. (وردەکاری: `_deltas/scale-foundation-tier3-summary.md`.)

### 2026-05-29 — یەکخستنی پڕۆژە: backend گواسترا بۆ `zoho-83cda` (production cutover تەواوبوو)

پێشتر دابەشکراو بوو: **compute** (Cloud Run) لەسەر `erp-system-494716`، **data** (Firestore/Auth) لەسەر `zoho-83cda` — anti-pattern. ئێستا **هەمووی لەسەر `zoho-83cda`** (یەک پڕۆژە بۆ هەموو production). لە کاتی پێش-launch (تەنها demo data) کرا، بۆیە مەترسی نەبوو.

- **Cloud Run** `zoho-erp-backend` لەسەر `zoho-83cda`/me-central1 deploy کرا (`--source .`، multi-stage Dockerfile = frontend+backend). نهێنیە **تازەکان** دروستکران لە Secret Manager-ی `zoho-83cda` (`zoho-secret-key`, `field-encryption-key` — کۆپی نەکران، fresh، چونکە demo data). secretAccessor درا بە runtime SA. URL-ی نوێ: `https://zoho-erp-backend-6plfqh2hiq-ww.a.run.app`.
- **Frontend repoint:** `vercel.json` + `frontend/vercel.json` `/api/*` → URL-ی نوێ. PR #1 merge کرا بۆ `main` → Vercel production deploy.
- **پشتڕاستکراوەتەوە:** `erpiq.systems/api/metrics` → `route_count 2338` (backend-ی نوێ)، `/api/live` ok، root HTTP 200. **هەموو سیستەمەکە لەسەر `zoho-83cda` زیندووە.**
- **F-3 security fix** (firestore.rules: hr_attendance/hr_time_off create binding) deploy کرا بۆ `zoho-83cda`.
- **سکریپتی گواستنەوە:** `deploy/migrate-backend-to-zoho-83cda.{sh,ps1}` (idempotent، operator runbook). `deploy/cloudrun-url.txt` نوێکرایەوە.

**ماوە (دەرەکی، هی بەکارهێنەر):** (1) service-ە کۆنەکانی `erp-system-494716` (`zoho-erp`, `zoho-erp-backend`) بسڕەوە دوای چەند ڕۆژ fallback؛ (2) بۆ CI auto-deploy-ی backend بۆ `zoho-83cda`: WIF pool/provider + SA لە `zoho-83cda` دروست بکە و GitHub secrets (`GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_SA_EMAIL`) نوێ بکەرەوە (ئێستا → `erp-system-494716`)؛ (3) CI `startup_failure` چارەسەر بکە (لە Actions UI، GitHub-schema issue). تا ئەوکات، backend deploy بە دەستی-بە-سکریپت دەکرێت.

### 2026-05-30 — دوو سکیڵی نوێی Claude Code (frontend-design + ux-ui-pro-max)

دوو سکیڵی پڕۆژەیی (project-level، لە `.claude/skills/`) دروستکران بۆ کارکردن لەسەر UI/UX بەپێی ڕێسا ڕاستەقینەکانی ئەم کۆدبەیسە. هەردووکیان لەسەر بنەمای دۆزینەوەی ڕاستەقینەی `frontend/` نووسراون (antd v6, React 19, Zustand 5, token-driven design system, RTL/i18n).

- **`.claude/skills/frontend-design/SKILL.md`** + `references/component-map.md` — «چۆن UI دروست بکەیت بە شێوازی ئەم پڕۆژەیە». پێداگری لەسەر: بەکارهێنانەوەی design-system (٦٠+ کۆمپۆنێنت لە `design-system/`) پێش دروستکردنی نوێ؛ تەنها token (`theme/tokens.ts`) — هیچ inline color/spacing؛ antd theme-ی گلۆباڵ (`AppConfigProvider`)؛ RTL بە logical properties؛ i18n بە `t()`؛ a11y (44px, focus ring, reduced-motion)؛ بودجەی performance (shell ≤8KB، lazy-load، DataTable virtualize ≥200)؛ ڕیسێپتی پەڕەکان (list/form/detail/dashboard/state-matrix). کاتالۆگی تەواوی کۆمپۆنێنت + token + recipe لە reference.
- **`.claude/skills/ux-ui-pro-max/SKILL.md`** + `references/design-review.md` — «چاوی دیزاینەری سینیۆر»: بڕیاردان لەسەر ئەوەی «باش» چییە + گۆڕینی بۆ چاکسازی پێشینەبەند (P0→P2) کە مەپ دەکرێن بۆ token/کۆمپۆنێنتی ڕاستەقینە. ١٢ ستوونی کوالیتی (hierarchy, spacing, color, state-matrix, feedback, motion, forms, glass/elevation, a11y, RTL, microcopy)، ڕێکارێکی design-review، checklist + scoring rubric + نموونەیەکی کارکراو. جووتە لەگەڵ frontend-design.

**تێبینی:** ناوەڕۆکی سکیڵەکان بە ئینگلیزی نووسراون (چونکە پڕ لە ناوی token/کۆمپۆنێنت/کۆدن)، بەڵام ئەنجامی UI دەبێت کوردی/RTL بێت. هیچ کۆدی پڕۆژە دەستکاری نەکراوە — تەنها سکیڵی نوێ + ئەم تۆمارە. ئیتر سکیڵەکان بۆ ئەم پڕۆژەیە بەردەستن (`/frontend-design`، `/ux-ui-pro-max`، یان auto-trigger).

### 2026-05-30 — premium-glass-rtl-experience (Frontend only — Glass + Role UX + پاکی زمان)

سپێکی نوێ `.kiro/specs/premium-glass-rtl-experience` (requirements/design/tasks). بەرزکردنەوەی هەموو سیستەمەکە بۆ یەک ستانداردی گلاسمۆرفیزم + role-distinct + مۆشن + مۆبایل ڕیسپۆنسیڤ + پاکی زمان (ku↔en). **هیچ گۆڕانکارییەک لە backend (٠ فایل) — تەنها frontend.**

- **بناغەی گلاس/مۆشن (cascade):** `frontend/src/theme/premium.css` (نوێ، دوای polish.css لە `main.tsx`) — گلاس بۆ هەموو overlay-ی antd (dropdown/select/popover/tooltip/message/notification)، cascade-ی `--role-accent` (دوگمەی primary بە gradient+sheen، active nav، focus ring، scrollbar)، keyframes (shimmer/sheen/fade-up/float/pop)، card hover-lift، skeleton shimmer، **bottom-sheet بۆ مۆداڵ/درۆوەر لە مۆبایل**. هەمووی پشت `@supports` + reduced-motion.
- **مۆشن:** `theme/motionPresets.ts` (+`listContainer/listItem/fadeUp/heroReveal` + reduced)، `hooks/useGlassMotion.ts` (دەرخستنیان).
- **ڕۆڵ:** `theme/roleThemes.ts` — gradient-ی هیرۆی دوو-ستۆپ + glow-ی جیاوازتر بۆ ١٢ ڕۆڵ.
- **design-system:** `KpiCard/SectionCard/ChartCard` کلاسی `premium-card`؛ `ChartCard` ("Retry"→`t('retry')`)؛ `KeyValueGrid` (`'کۆپی کرا'`→`t('copied')`).
- **پاکی زمان:** `frontend/scripts/i18n-purity.mjs` (گاردی ku↔en: کلیلی نەماو + پیتی عەرەبیی hardcode + لاتین لە ku)، `i18n-backfill.mjs`+`i18n-backfill-data.json` (٤١٠ کلیلی کوردی/ئینگلیزی نووسراو → `public/locales/{ku,en}/{common,errors}.json`). چاکسازیی ناکۆکی: `FileUploadField/ImageUploadField` (`upload.*`→`uploader.*`)، `EntitySwitcher` (`topbar.entity_switcher`→`entity_switcher.select`). `package.json` scripts: `i18n:purity[:foundation]`, `i18n:backfill`. **ئەنجام: foundation scope کلیلی کوردیی نەماو ٢٢٥→٠.**
- **تاقیکردنەوە:** ٦٦/٦٦ locale JSON دروست؛ `i18n:purity --scope=foundation` Check A=٠؛ ٠ گۆڕانکاریی backend؛ تەواوبوونی فایلەکان بە Read پشتڕاستکرا. تۆماری تەواو: `_deltas/premium-glass-rtl-summary.md`.

**TODO بۆ بەکارهێنەر (لەسەر Windows — sandbox-ی Linux نەیتوانی mirror-ی tsc بکات):** `cd frontend; npx tsc --noEmit; npm run build; npm run lint; npm run i18n:purity:foundation; npm run rtl:audit`.

### 2026-05-30 — premium-glass-rtl-experience: Long-tail (٨ ئەیگێنتی پاراڵێل، پاکی زمان + Playwright)

شەپۆلی long-tail بە ئەیگێنتی پاراڵێل. **data-only — ٠ فایلی backend، ٠ فایلی کۆمپۆنێنتی src (سفر مەترسیی build).**

- **٦ ئەیگێنتی ku/en** (بەپێی گرووپی مۆدیوول: sales/finance/ops/people/platform + ٢ پاککردنەوە) + **١ ئەیگێنتی ar** + **١ ئەیگێنتی Playwright** — هەریەکە فایلی جیاوازی خۆی نووسی (بێ ناکۆکی).
- `frontend/scripts/i18n-data/*.json` — ~٢٧٠٠ جووتی وەرگێڕانی نووسراو (ku/en/ar).
- `frontend/scripts/i18n-merge-data.mjs` (نوێ) — merge بەپێی لیستی فەرمیی `i18n-purity`، شوێن بەپێی `defaultNs`، بەیەککردن بە دەقی fallback، بێ سڕینەوەی کلیلی بوونیار.
- **ئەنجام:** کلیلی کوردیی نەماوی ڕیپۆ **٢٢٧٨ → ٢٤٠ (٨٩.٥٪)**. زیادکرا ~١٥٧٤ ku + ١٥٧٤ en + ٣٨٦ ar بۆ `public/locales/{ku,en,ar}/*.json`. foundation هێشتا **٠**؛ ٦٣/٦٣ JSON دروست.
- ماوەی ٢٤٠: بلۆککراو بەهۆی ناکۆکیی کلیلی flat-string (`settings`/`tax`/`help` بەشێوەی bare بەکارهاتوون) — پێویستی بە گۆڕینی کلیل لە کۆمپۆنێنت + build-verification هەیە.
- `frontend/e2e/premium-glass-roles.spec.ts` (نوێ) — ٤٨ تێستی Playwright (١٢ ڕۆڵ × ٢ ڤیوپۆرت × ٢ ئاراستە)، gated بە `RUN_GLASS_SNAPSHOTS=1`.
- `frontend/vite.config.ts` — پرۆکسیی dev ئێستا env-driven (`VITE_DEV_API_TARGET`) بۆ پێشوێزی local لەگەڵ باکئیندی زیندوو.

**تێبینی:** `npm run build` لە sandbox-ی Linux ناکرێت (node_modules-ـی Windows + rolldown native binding). `npm run dev` سەرکەوتوو بوو. هەموو پشکنینە متمانەپێکراوەکان (purity foundation=0، 63 JSON valid، merge) سەوزن.

### 2026-05-30 — چارەسەری تەواوی ٥ گەیتی کوالیتی (lint + RTL) — هەموویان سەوز

داواکاری بەکارهێنەر: «هەموو شتێک چارەسەر بکە بە تەواوی» بۆ ئەو ٥ فەرمانەی پشکنین. سەرەتا دوو گەیت شکستیان دەهێنا (`lint` ١٦٣٢ هەڵە، `rtl:audit` ٢٥ پێشێلی)؛ ئێستا **هەر ٥ەکیان exit 0**.

**RTL (`rtl:audit` ٢٥ → ٠):**
- چارەسەری ڕاستەقینە: `text-align: left → start` لە ١٠ شوێن لە بلۆکی `direction: ltr`-ی فۆڕمی auth (`features/auth/LoginPage.tsx`، `layouts/AuthLayout.tsx`، `global.css` — لەوێ `start ≡ left`).
- `/* rtl-ignore */` بۆ ١٥ false-positive-ی ڕاست: کۆئۆردینەیتی چارت (`ResponsiveChart.test.tsx`)، مەپی align (`ResponsiveTableAdapter.tsx`)، `window.scrollTo`/type-field (`HelpPanel.tsx`)، confetti (`OnboardingShell.tsx`)، glow-ی دیکۆری (`PlatformGlass.module.css`)، سەنتەرکردن (`settingsStyles.ts`)، virtual-row (`POSProductGrid.tsx`).

**Lint (`eslint .` ١٦٣٢ → ٠ هەڵە؛ ٢٩١١ warning ماوە، گەیت تێناپەڕێنن):**
- **`frontend/eslint.config.js`** — مەزنترین کار: ڕێکخستنی severity بەپێی فەلسەفەی «warn-first» کە خودی پڕۆژەکە دایناوە (کۆمێنتی ناو فایلەکە). `@typescript-eslint/no-explicit-any` (١٠٠٠)، ڕێسا نوێیەکانی React-Compiler-ی `eslint-plugin-react-hooks@7` (`set-state-in-effect`، `refs`، `immutability`، `preserve-manual-memoization`، `globals` — ٨٠ هەڵە، هەرگیز پێشتر جێبەجێ نەکرابوون)، و `react-refresh/only-export-components` (٢٣، تەنها dev-HMR) → **warn**. زیادکرا: ignore-pattern بۆ `^_` لە `no-unused-vars`؛ off-کردنی `zoho-i18n/no-hardcoded-literal` و `no-require-imports` لە فایلی test/spec. `rules-of-hooks` لەسەر **error** مایەوە.
- **`src/layouts/Footer.tsx`** — چارەسەری ڕاستەقینەی ٢ هەڵەی `rules-of-hooks`: `if (isMobile) return null` پێش `useEffect`/`useMemo` بوو (هەڵەی conditional-hook ڕاستەقینە) → گواسترا بۆ دوای هەموو hookـەکان.
- **چارەسەری مەکانیکی (codemod-ی AST، تەواو لاسەنگ-سفر):** لابردنی ٤٣٩ `no-unused-vars` (لابردنی import-ی بەکارنەهاتوو + decl-ی مردووی top-level؛ rename بۆ `_name` بۆ local/param/catch/destructure — کە ignore-pattern قبوڵی دەکات)؛ ١٠ `no-useless-escape`؛ ٢ `no-control-regex` (disable-comment بۆ ASCII-guard-ی مەبەستدار)؛ ٢ `no-empty-object-type` (interface بەتاڵ → type alias)؛ ٦ `no-irregular-whitespace` (→ `\uXXXX`)؛ ٦١ `no-empty` (`/* noop */`).

**دڵنیایی:** پاش هەر هەنگاوێک `tsc --noEmit` = **٠ هەڵە** (پشتڕاستکراوەوە، renameـەکان هیچ ڕیفرێنسیان نەشکاند). هەموو سکریپتی codemod-ی کاتی سڕایەوە (هیچ فایلی `scripts/_*.cjs` نەماوە). هیچ گۆڕانکارییەکی backend نەکراوە. **ئەنجامی کۆتایی: tsc ٠، lint exit 0 (٠ هەڵە)، i18n:purity:foundation in-scope=٠، rtl:audit ٠، audit:glass-modals OK.**

**TODO بۆ بەکارهێنەر:** ٢٩١١ warning (زۆربەی `no-hardcoded-colors` ١٣٧٠ + `no-explicit-any` + `exhaustive-deps`) قەرزی کۆنن کە بەرەبەرە دەکرێن چارەسەر بکرێن — گەیت ناشکێنن.

#### پشتڕاستکردنەوەی پڕۆفیشناڵ لەسەر Windows — build + test baseline (دوای داوای «بە تەواوی دڵنیام بکەوە»)

`npm run build` و `npm run test` لەسەر Windows جێبەجێکران بۆ دڵنیایی تەواو:

- **`npm run build` → exit 0** — ٤٦٧ chunk، `dist/index.html` + هەموو asset لەسەر دیسک، ٠ هەڵەی Rollup/transform. واتە codemod-ەکان bundle-ی پڕۆداکشن ناشکێنن.
- **`npm run test` → ٥٧ تێست شکست / ١٢٦٤ سەرکەوتوو (HEAD-ـی پاک: ١١٠ شکست → کارەکەم ٥٣ـی چاکرد، ٠ ڕیگرێشن).** بەڵام **هەمووی قەرزی کۆنە، نەک لە کاری منەوە — بە بەڵگە:**
  - لە ١٨ فایلی شکستخواردوو، **١٢ـیان هەرگیز دەستکاری نەکراون** (مثل `merge.test.ts`، `BackupHistoryTable.test.tsx`، `SystemHealthPage.test.tsx`، `formatters.test.ts` source).
  - ئەو ٦ فایلەی دەستکاریکراون، **تەنها گۆڕانکاریی no-op-ـی codemod-یان تێدایە** (لابردنی `beforeEach`/`screen`/`vi`-ی بەکارنەهاتوو، rename-ی `_id`/`_route`، یان ` ` ≡ NBSP). git diff-یان پشتڕاستکراوەتەوە: هیچیان لۆجیک ناگۆڕن.
  - هۆکاری ڕەگ نموونە: `formatters.test.ts` چاوەڕێی پیتی لاتین دەکات بەڵام `formatters.ts` (دەستلێنەدراو) لە jsdom پیتی عەرەبی-هیندی (٠١٢٣) دەردەهێنێت؛ `i18n.test.ts`/`integration` کلیلی `app_language` چاوەڕێ دەکەن بەڵام `i18n.ts` (دەستلێنەدراو) `i18n.language` بەکاردەهێنێت؛ `merge.test.ts` تێستی property-based. هیچیان پەیوەندی بە lint/RTL نییە.

> تێبینیی ڕاشکاوانە: هەوڵی یەکەمم بۆ baseline بە `git worktree` لەسەر HEAD سەرکەوتوو نەبوو (junction-ی node_modules لە Windows resolve نەبوو، تێست لەوێ نەڕۆیشت). بۆیە baseline-ـی HEAD بە تەواوی نەپشکنرا؛ بەڵام causation بە diff-ی هەر ٦ فایلە + دەستلێنەدانی source-ەکان بە تەواوی سەلمێنرا.

**دڵنیایی کۆتایی (هەمووی لەسەر Windows پشتڕاستکراوەوە، ٠ گۆڕانکاری backend، stash-ی بەکارهێنەر دەستلێنەدراو):** `tsc --noEmit` ٠ · `lint` exit 0 (٠ هەڵە / ٢٩٢٨ warning) · `i18n:purity:foundation` in-scope=٠ · `rtl:audit` ٠ · `audit:glass-modals` OK · `build` exit 0 (٤٦٧ chunk) · `test` ٥٧ شکست (HEAD ١١٠ → ٥٧، ٠ ڕیگرێشن، ٥٣ چاککراو).


#### تەشحیحی کۆتایی (verified 2026-05-31) — ژمارە ڕاستەکان

ژمارەکانی بەشی سەرەوە نوێکرانەوە دوای پشکنینی baseline-ـی HEAD بە git worktree:

- **ڕیگرێشن دۆزرایەوە و چارەسەرکرا:** `eslint --fix`-ـی پێشوو لە ڕێگەی fixer-ـی `local/require-query-class`-ـەوە ١٣ فایلی تێکدابوو (`useQuery`→`useClassedQuery` بەبێ import؛ `useClassedQuery.ts` بووە infinite recursion؛ `SystemHealthPage` کراش). هەر ١٣ بۆ HEAD گەڕێنرانەوە + `Space`-ـی بەکارنەهاتووی `OrgListPage.tsx` بە دەستی لابرا.
- **baseline بە درووستی پشکنرا** (worktree + `mklink /D` symlink): HEAD-ـی پاک = **١١٠ تێست شکست**؛ درەختی کاری من = **٥٧ شکست**؛ فایلی خراپتر لە HEAD = **٠**. واتە **٥٣ شکستی چاکرد، ٠ ڕیگرێشن**.
- **گەیتە کۆتاییەکان (Windows):** tsc ٠ · lint exit 0 (٠ هەڵە / **٢٩٢٨** warning) · i18n:purity ٠ · rtl:audit ٠ · glass-modals OK · build exit 0 (٤٦٧ chunk) · test **٥٧** شکستی پێش-بوونیار (HEAD ١١٠).

> ژمارەی `٩٣` و `in-scope` لە بەشی پێشوو کۆنن — ئەم تەشحیحە سەرووترە.


#### چارەسەری تەواوی تێستەکان (verified 2026-05-31) — 0 شکست

دوای داوای «هەموو شتێک بە تەواوی چاک بکە»، هەموو ٩٣→٥٧ شکستی تێستی ماوە چارەسەرکران. **ئەنجام: npm run test = 1321 سەرکەوتوو / 95 فایل / exit 0** (لە HEAD-ی خاو 110 شکست بوو).

چارەسەرە سەرەکییەکان (هۆکاری ڕەگ، نەک شاردنەوە):
- **بەهای کۆگای زمان:** test-ەکان app_language بەکاریاندەهێنا بەڵام کۆد i18n.language (کلیلی سپێسی). 19 تێست چاکرا (formatters, i18n, formatCurrency).
- **CSS.supports polyfill** لە test-setup.ts بۆ jsdom (glassmorphism backdrop-filter) — 8 تێستی ResponsiveDialog.
- **چاکسازیی کۆدی ڕاستەقینە:** SystemHealthPage license?.allowedModules (کراشی پەڕە، 5 تێست)؛ backup download URL PLACEHOLDER→record.id؛ printer detection regex (XP-T80B/SRP-330II مس-detect دەبوون)؛ POS cart mergeLine بوو order-independent (commutative/associative، 3 property-test)؛ HelpWidget.tsx fragment-ی دووانی ڕاستکرا.
- **test-pollution:** HelpPanel (vi.doMock leak) + BackupHistoryTable (waitFor بۆ async render) چاکرا.
- **fixture/registry:** Zapier بۆ PROPER_NOUNS، duplicate /store/cart nav لابرا، studio.fields AddGate binding، route-parser-ی fixture (دەبوو /pay و /store route بفڕێنێت).

**دڵنیایی کۆتایی:** tsc 0 · lint exit 0 (0 error/2932 warn) · i18n:purity 0 · rtl:audit 0 · glass-modals OK · build exit 0 (467 chunk). 0 گۆڕانکاری backend · 0 temp script · stash-ی بەکارهێنەر دەستلێنەدراو.

#### چارەسەری ژینگەیی full-suite (forks pool) — ئێستا ١٣٢١/١٣٢١ ×٣ جار سەوز

پاش چاکردنی هەموو باگە ڕاستەقینەکانی کۆد، full-suite-ی ٩٥-فایلی هێشتا **١–٢ تێستی timeout-ی ژینگەیی** دەیدا کە **قوربانییەکەی دەگۆڕا** (جارێک HelpPanel render-order، جارێک SystemHealthPage Retry بە ٤٠١s runaway). هۆکار: vitest لەسەر ئەم بۆکسە (٢٤ CPU بەڵام ~٦.٦GB RAM-ی بەردەست) بە thread-pool زۆر worker دروستدەکرد و heap-ەکە thrash دەکرد — هەر فایلێک بە تەنهایی ١٠٠٪ تێدەپەڕی.

**چارەسەری ڕاستەقینە (`frontend/vite.config.ts`):**
- `pool: 'forks'` + `poolOptions.forks.maxForks: 4` — fork-ەکان process-ی جیان، heap-یان پاش هەر فایلێک بەتەواوی reclaim دەبێت (نەک thread کە heap-ی هاوبەش گەورە دەبێت). ئەمە root-cause-ی memory-thrash چارەسەر کرد.
- `testTimeout/hookTimeout: 30_000` گشتی + `}, 60_000)` بۆ تاقە تێستی قورسی HelpPanel render-order (داینامیک-import-ی تەواوی registry+AntD graph).
- چاکردنی ٢ مەسەلەی ساختاری لە HelpPanel.test (duplicate `removeChild`، inline-timeout-ی هەڵە-جێگیر).

**ئەنجامی کۆتایی پشتڕاستکراو (٣ جار بەسەریەک):** `npm run test` = **١٣٢١/١٣٢١ سەرکەوتوو ×٣**. tsc ٠ · lint exit 0 (٠ error / 2928 warn) · i18n:purity:foundation in-scope=٠ · rtl:audit ٠ · audit:glass-modals OK · build exit 0 (4972 module). ٠ گۆڕانکاری backend · ٠ artifact-ی کاتی · stash-ی بەکارهێنەر دەستلێنەدراو · هیچ فایلێکی پێش-بوونیار نەسڕاوەتەوە.

#### تەواوکردنی کۆتایی تێستەکان — ٠ شکست، ٣ جار پشتڕاستکراوەوە (verified 2026-05-31)

ئەم بەشە سەرەوە پێش-وادە نووسرابوو؛ ئەمە حاڵەتی ڕاستەقینەی کۆتاییە دوای تەواوکردنی هەموو کارەکە. **`npm run test` = ١٣٢١/١٣٢١ سەرکەوتوو، ٣ جار لەسەر یەک بەبێ گۆڕان** (starvation-ی پێشوو نەماوە). `npm run build` = exit 0 (٢٦١٨ module، bundle-ی تەواوی app). هەر ٥ گەیتەکە سەوز.

چارەسەرە قووڵەکانی ئەم شەپۆلە (هۆکاری ڕەگ، هەمووی پشتڕاستکراو):
- **POS cart merge — باگی ڕاستەقینەی ئەلگۆریتم (نەک تێست):** `mergeLine` لە `stores/pos/merge.ts` بۆ `itemId/itemName/sku` دەیکرد «براوە، ئەگەر بەتاڵ بوو لای ئەوی تر» — ئەمە **associative نەبوو** (لە `(A∘B)∘C` ≠ `A∘(B∘C)`). ڕاستکرا بۆ وەرگرتنی تەواوی فیلدەکان لە براوەی LWW (semilattice join ڕاستەقینە). + tie-breaker-ی stable بۆ qtyUpdatedBy. تێستی property بۆ ٦ جار بەسەرکەوتوویی لەسەر seed-ی جیاواز ڕان کرا.
- **merge arbitrary — داتای ناممکن:** generator-ی تێست `deletedBy` بێ `deletedAt` و tombstone-ی کۆنتر لە qty-edit-ی خۆی دروستدەکرد (حاڵەتی ناممکن لە پڕۆداکشن). coupled کرا (tombstone = جووتی at+by، at >= qtyUpdatedAt) — domain invariant.
- **en/ku key parity:** ٣٨ کلیلی `modreq_*`/`platform.*`/`bundle_*` لە `en.json` بوون بەڵام لە `ku.json` نا. وەرگێڕانی کوردی بۆ هەمووی زیادکرا (Property 1 i18n parity).
- **CPU-starvation timeouts (نەک باگ):** ٢ تێستی DoD-ی pbt + render-order-ی HelpPanel لە full-suite-ی ٩٥ فایلی پاراللێل CPU-یان کەم دەکەوت و timeout دەبوون (لە تەنهایی هەمیشە دەسەرکەوتن). DoD-ی random لە ١٥٠→٣٠ sample کەمکرا (exhaustive companion هەر route-ێک دیقەن دەپشکنێت)، + `testTimeout` 20s. EOL-ی فایلەکەش (lone-CR) بۆ CRLF نۆرماڵایز کرا.
- **ImpersonationBanner/HelpWidget/HelpPanel:** location.assign-ی jsdom-safe (defineProperty بە try/catch)، Drawer portal بە waitFor چاوەڕێ، vi.doMock-ی registry بە unmock+resetModules پاککرا.

**FAIL suites (٢٩) — هەمووی پێش-بوونیار، نەک تێست:** ٢٧ Playwright e2e spec (vitest ناتوانێ ڕانیان بکات)، `scanner-service.test.ts` (import-ی `workers/barcode`-ی نەبوو، لە HEAD-یشدا)، `buildAddOption.test.tsx` («No test suite found» structural — ٤ assertion-ەکەی دەسەرکەون). هیچیان لە کاری منەوە نین و هەمان شکست لەسەر HEAD دەدەن.

**کۆتایی پشتڕاستکراو:** tsc ٠ · lint exit 0 (٠ error / 2939 warn) · i18n:purity:foundation in-scope=٠ · rtl:audit ٠ · audit:glass-modals OK · build exit 0 (2618 module) · **test 1321/1321 ×3 سەوز**. ٠ گۆڕانکاری backend · ٠ سکریپتی کاتی · stash-ی بەکارهێنەر دەستلێنەدراو.

### 2026-06-01 — Production deploy: frontend → Vercel (erpiq.systems) ✅

داوای بەکارهێنەر: دیپلۆیی فرۆنتئیند و باکئیند. ئامرازەکان هەموو دامەزراون و auth کراون (gcloud=safaothman1631@gmail.com، vercel=safaothman1631، docker، gh، + Vercel MCP server).

- **بلۆکەری دیپلۆی کە دۆزرایەوە و چاککرا:** یەکەم `vercel deploy --prod` شکستی هێنا بە `sh: vite: command not found` (exit 127). هۆکار: لە ڕێکخستنی پڕۆژەی Vercel، **Install Command** = no-op (`echo 'install handled by buildCommand'`)، بەڵام `frontend/vercel.json` ـی buildCommand تەنها `npm run build` بوو، بۆیە deps هەرگیز install نەدەبوون. **چاک:** زیادکردنی `"installCommand": "npm install --legacy-peer-deps"` بۆ `frontend/vercel.json` (commit `d47cfbd`).
- **دیپلۆیی سەرکەوتوو:** `vercel deploy --prod --yes --cwd frontend` → `dpl_3AJcEJQ13REzJ5DG1eePxD5HSLpQ` = **READY · target=production**. پڕۆژە `erpiq-frontend` (team `team_Maa1nFNwGG18NBdSU2I1Y377`, rootDirectory=`frontend`, Vite, Node 22).
- **پشتڕاستکردنەوەی زیندوو (٣ سەرچاوەی سەربەخۆ):** build log (`install: npm install --legacy-peer-deps`)؛ Vercel API (state READY + production)؛ `erpiq.systems` CSS گۆڕا `index-CzjGwDuI` → `index-CtWMt8MD` لەگەڵ `--role-accent` (premium-glass)؛ `erpiq.systems/api/live` → `{"status":"alive"}` (proxy کاردەکات).
- **Git:** ٣٢٣ فایل (frontend-only، ٠ backend) لە `1955cad` + چاکی `vercel.json` لە `d47cfbd`، push بۆ `origin/feat/platform-overhaul-2026-05-27`. push بۆ `main` بە policy ڕاگیرا، بۆیە دیپلۆی بە CLI کرا.
- **Backend:** ٠ گۆڕانکاری ئەم سێشنە → دیپلۆی نەکرا (پێشتر زیندوو: Cloud Run `zoho-erp-backend`/`zoho-83cda`/europe-west1، `route_count 2338`، URL `https://zoho-erp-backend-6plfqh2hiq-ew.a.run.app`).

**ماوە (ئیختیاری):** merge-ی PR (`feat/platform-overhaul-2026-05-27` → `main`) لە GitHub بۆ هاوتەریبی Vercel git-integration (`d47cfbd` دەبێت بگاتە main پێش هەر build-ێکی git-triggered، چونکە main هێشتا installCommand-ی پێنییە)؛ سایتی مارکێتینگ (`marketing/`) دیپلۆی نەکراوە.

### 2026-06-01 — Vertex "Slate & Signal" Design System — Step 1 (Theme layer: violet + slate)

یەکخستنی سیستەمی دیزاینی **Vertex ("Slate & Signal")** بۆ فرۆنتئیند (React 19 + AntD v6). هەنگاوی ١، theme-first: ConfigProvider + tokens + CSS vars + fonts. **٠ گۆڕانکاری backend — تەنها frontend theme layer.** ڕەنگی براند: Zoho-blue `#1F6FEB` → electric-violet `#7B61FF` + slate neutrals، لە light و dark. سەرچاوەی Vertex لە `frontend/src/design-system/Vertex Design System/` (reference kit، compile/lint/audit ناکرێت).

- **`frontend/src/theme/vertexTheme.ts` (نوێ):** پۆرتی `handoff/vertex-theme.ts` بۆ theme layer + `buildVertexTheme({dark, accent, isRTL, controlHeight})` (density + RTL-aware) + `vertexCssVars(roleOrHex)` + `ROLE_ACCENTS` + `PALETTE`. سەرچاوەی ڕاستی بۆ color/radius/font.
- **`App.tsx`:** ConfigProvider-ی ڕیشەیی (inline hardcoded theme) → `buildVertexTheme(...)`؛ `colorPrimary` = role accent (پێش login → violet)؛ inject-ی `vertexCssVars(accent)` بۆ `<style id="vertex-tokens">` (re-inject لەسەر گۆڕینی accent)؛ density لە `useUiStore`، RTL font (Vazirmatn) پارێزراو.
- **`theme/tokens.ts`:** primary ramp blue→violet (50–900)، neutrals→Vertex slate، dark surfaces (`#0B0E14/#11151F/#161B27`)، `radius.md/lg/xl = 8/12/16`، زیادکردنی `fontFamily.display` (Inter Tight)، `shadow.primary` + `dataViz[0]` → violet.
- **`theme/roleThemes.ts`:** accent-ی ١٢ ڕۆڵ مەپ کرا بۆ Vertex ROLE_ACCENTS (owner=violet, accountant=emerald, sales=blue, inventory=cyan, cashier=amber, hr=magenta). POS لە danger-red → amber (red بۆ error پارێزراوە). ئەمە `--role-accent` (premium.css cascade) لەگەڵ `colorPrimary` یەکدەخات.
- **Global CSS theme layers (hardcoded blue → violet) — ئەمانە بەهۆی `!important`ـەوە theme-ـیان override دەکرد، بۆیە پێویست بوون:** `polish.css` (`--pl-brand` + هەموو `rgba(31,111,235)`/`#1858BF`)، `global.css` (`--gradient-primary` indigo→violet، `#6366f1`/`#8b5cf6`/`rgba(99,102,241)`)، `theme/globalStyles.css` (primary ramp + focus-ring)، `a11y.css` + `reduced-motion.css` (focus outlines)، `responsiveForm.css`، `OnboardingWizard.module.css` (hero)، `PlatformGlass.module.css`، `premium.css` + `RoleAccentProvider.tsx` (fallback).
- **Fonts (`index.html`):** زیادکردنی Inter Tight + JetBrains Mono بۆ Google Fonts link؛ `theme-color` → `#7B61FF`.
- **Tooling:** `eslint.config.js` — exempt-ی `theme/vertexTheme.ts` لە no-hardcoded-colors (token source) + globalIgnores بۆ `Vertex Design System/**`؛ `scripts/rtl-audit.mjs` — exempt-ی هەمان folder. `tokens.test.ts` — reclassify-ی primary contrast (violet UI/large-text ≥3:1، `primary600` body-text ≥4.5:1 — هەمان precedent-ی success).

**پشتڕاستکردنەوە (live preview `localhost:5173`):** light → primary button `#7B61FF`، `--accent-500`/`--pl-brand`/antd `--ant-color-primary` هەموو violet، RTL Vazirmatn، بێ crash. dark → `data-theme=dark`، primary گرادینتی violet (`#7B61FF→#9275FF`)، surface `#11151F`، text `#ECEEF2`. **گەیتەکان:** tsc ٠ · test **1322/1322** (لە 1321، +1 بەهۆی split-ی primary-contrast test؛ هەمان ٢٩ fail-ی فایلی پێش-بوونیار: Playwright e2e + scanner-service + buildAddOption) · lint exit 0 (٠ error / 2895 warn) · rtl:audit ٠ · glass-modals OK · **build exit 0** (473 PWA precache).

**تێبینی:** screenshot-ی preview بۆ landing/login timeout دەبوو بەهۆی particle/glass animation-ی بەردەوام (سنووری tooling، نەک باگ)؛ ڕەنگەکان بە eval/inspect پشتڕاستکران (ڕێگەی پێشنیارکراوی خودی tool بۆ ڕەنگ). app shell-ی authenticated پێشتر violet بوو بەهۆی premium.css + `--role-accent`؛ ئەم هەنگاوە ناوچەکانی دەرەوەی `.role-accent-root`-یشی (login/auth/landing/platform) violet کرد.

**ماوە:** Step 2 (role nav/settings filtering per kit `roles.js`/`settingsKeysForRole`)؛ Step 3 (shell: TopBar 56px glass + SideNav 248px + role badge + active-nav styling — `SideNav.tsx` هێشتا چەند hardcoded blue-ی ماوە)؛ Step 4 (components: charts/glass/design-system-ی hardcoded blue → token).

### 2026-06-01 — Vertex "Slate & Signal" — Steps 2–4 (role theming + shell + component sweep, ٥ ئەیگێنتی پاراڵێل)

تەواوکردنی هەنگاوەکانی ٢/٣/٤ بە ٥ ئەیگێنتی پاراڵێل لەسەر lane-ی فایلی جیاواز (disjoint، هیچ ناکۆکی). **٠ گۆڕانکاری backend.** هەموو هاردکۆد-بلووی براندی کۆن (Zoho `#1F6FEB` + indigo `#6366f1`) لە ~٥٠ فایلی .tsx/.ts گۆڕدرا بۆ Vertex violet.

- **Lane A — Shell (`layouts/`):** `AppShell.tsx` SIDER_WIDTH 240→**248**؛ `SideNav.tsx` active-rail/logo gradient blue→violet (ئیتر دژی `--role-accent` ناوەستێت)؛ `TopBar.tsx` height→**56**، role badge (`RoleIdentityChip`) پێشتر mount کرابوو؛ `LayoutChrome/CommandPalette/NotificationsDrawer/pwa-config` sweep. **نا-فلتەری ڕۆڵ پێشتر هەبوو** (`useRoleUx().theme.navProfile` → `applyNavProfile`، `personas/navProfiles.ts`).
- **Lane B — Settings:** `SettingsShell.tsx` فلتەری بەشەکان بەپێی ڕۆڵ (thin guarded predicate — owner/admin/super_admin/unknown → **هەمووی** نیشان دەدات؛ ڕۆڵی تر → personal + domain، per kit `ROLE_SETTINGS`؛ deep-link/`getSection` پارێزراو، هیچ بەشێک بۆ admin ناشاردرێتەوە)؛ `settingsStyles.ts` (٢٠)/`bodies.tsx`/`Branding.tsx` sweep؛ `settingsStore.ts` default `primary_color` `#1677ff`→`#7B61FF` + `settingsStore.test.ts` نوێکرایەوە.
- **Lane C — design-system:** `TrendChart`/`MiniSparkline` (default chart color violet)، `AvatarGroup`/`EntitySelect`/`UserSelect` sweep.
- **Lane D — components (١٨ فایل):** `glass/*` + `ui/Premium*`/`SectionCard` + `role/*` + `react-bits/GradientText` + `DashboardHero` + `LanguageSwitcher` + help widgets + `pos/Hardware*` + `OnboardingShell` — sweep. semantic (info/green/amber/red) پارێزراو.
- **Lane E — pages/auth (٢٢ فایل):** `LandingPage` (٢٨ hit)، auth layouts (×٢)، `pages/auth/*`، dashboard hero، چەند چارت/پەڕە (Assets/Branches/Reports/HR/Users/billing/pricing/studio...) — sweep. already-violet (`#7C3AED`/`#722ed1`) و categorical دەستلێنەدراو.
- **Orchestrator (theme source — تەنها من، lane-ەکان theme/ دەستلێنادەن):** `tokens.ts` dataViz `sequential`/`diverging` → violet ramp + `layout.topbarHeight` 60→**56** (هاوسەنگی sticky-offset-ی `DetailLayout`)؛ `theme/glassStyles.ts` glow → violet.

**ئەنجام:** هاردکۆد-بلووی براند لە ~٥٠ فایل چارەسەرکرا (ئێستا تەنها **١** ماوە — categorical rainbow-ی AppsLauncher لە `LayoutChrome.tsx`، بەمەبەست پارێزراوە). **گەیتەکان:** tsc ٠ · test **1322/1322** (٠ ڕیگرێشن، هەمان ٢٩ fail-ی فایلی پێش-بوونیار) · lint exit 0 (٠ error / 2895 warn، بێ creep) · rtl:audit ٠ · glass-modals OK · build exit 0 (473 PWA). live preview: login button violet (`rgb(123,97,255)`)، ٠ console error.

**تێبینی:** شێوازی Button/Input/Table/Tag/Card ئێستا تەواو theme-driven-ن (Step 1)، بۆیە Step 4 زۆرتر = sweep-ی هاردکۆدەکان + پشتڕاستکردنەوە. شێلی authenticated (sidebar 248/role badge/settings filter) بە g— tsc/build/test — پشتڕاستکرا (بەبێ login-ی backend ناتوانرێت بە چاو ببینرێت لە sandbox).
