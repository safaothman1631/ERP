# Launch Readiness — کارە ماوەکان (Remaining Work)

> **سپێس:** `.kiro/specs/launch-readiness`
> **بەروار:** 2026-05-29
> **دۆخ:** Phase R1 + Integration wiring (R3/R4/R5 routers → main.py) تەواوبوون ✅ — ئەمە لیستی هەموو ئەوەیە کە **نەکراوە**.
>
> **نوێکراوە 2026-05-29:** هەموو ڕووتەرەکانی R3 (onboarding wizard)، R4 (payments)، R5 (SaaS billing) ئێستا لە `main.py` تۆمارکراون و `register_default_providers()` لە startup بانگدەکرێت. `stripe`+`pyyaml` بۆ `requirements.txt` زیادکران. تاقیکردنەوە: ١٩٣ تێست سەوز. → **بەشەکانی R4 (Cash/COD/Stripe کۆد) و R5 (billing کۆد) و R3 (wizard کۆد) ئێستا کاردەکەن.** ئەوەی ماوە تەنها دەرەکییەکانە (خوارەوە).
> **مەبەست:** ئەم فایلە بۆ تۆیە (Safa) تا بە شێوەی تر (دەستی / تیمی تر / ئامرازی تر) جێبەجێیان بکەیت. هەر بەشێک ئەمانەی تێدایە: چی پێویستە، بۆچی Claude نەیتوانی بیکات، و هەنگاوە کردارییەکان.

---

## 📊 پوختەی دۆخ

| Phase | بابەت | دۆخ | بەرپرسی جێبەجێکردن |
|-------|-------|------|---------------------|
| R0 | Compile + Type Health | ❌ نەکراوە | پێویستی بە `npm install` لەسەر Windows |
| R1 | Backend Quick-Create Endpoints | ✅ **تەواوبوو** | — |
| R2.1–R2.4 | Hardening ئەندپۆینتە بەردەستەکان | ⚠️ بەشێک | دەکرێت بە کۆد بکرێت |
| R3 | Staging Environment | ❌ نەکراوە | GCP / DNS / Vercel — دەستگەیشتنی دەرەکی |
| R4 | Tenant-Side Payments | ❌ نەکراوە | sandbox + کۆد |
| R5 | SaaS Subscription Billing | ❌ نەکراوە | Stripe entity + کۆد |
| R6 | Cross-cutting (docs/runbooks) | ❌ نەکراوە | دەکرێت بکرێت |
| R7 | Open Questions / Decisions | ❌ نەکراوە | پەیوەندی بازرگانی / یاسایی |

---

## 🟥 Phase R0 — Compile + Type Health

**بۆچی نەکرا:** هەموو ئەم ئەرکانە پێویستیان بە `node_modules` و کارکردنی toolchain ـی frontend هەیە (`tsc`, `vite`, `vitest`, `eslint`). دەبێت یەکەم جار `npm install` لەسەر Windows جێبەجێ بکرێت — وەک لە CLAUDE.md نووسراوە، ژینگەی sandbox ـی پێشوو نەیتوانی install تەواو بکات.

**هەنگاوی یەکەم (تۆ دەیکەیت):**
```powershell
cd C:\Users\SAFA\zoho\frontend
npm install --legacy-peer-deps
```

**دوای ئەوە، ئەم ئەرکانە جێبەجێ بکە:**

| ئەرک | فەرمان / فایل | پێوەری سەرکەوتن |
|------|----------------|------------------|
| T-LR.0.1 | `npx tsc --noEmit` → تۆمار بکە لە `_deltas/tsc-baseline.txt` | فایلەکە بوونی هەبێت + ژمارەی هەڵە |
| T-LR.0.2 | `lint-staged` + `tsc-files` لە `.husky/pre-commit` | commit < 8 چرکە |
| T-LR.0.3 | `scripts/check-orphans.ts` — گەڕان لە گرافی import لە `main.tsx` + `backend/app/main.py` | لیستی فایلە orphan ـەکان |
| T-LR.0.4 | `scripts/verify-aliases.ts` — `tsconfig.json paths` == `vite.config.ts alias` | drift → exit 1 |
| T-LR.0.5 | `scripts/detect-truncation.ts` — parse بە `@babel/parser` / `ast.parse` | فایلی بڕاو ڕەت بکرێتەوە |
| T-LR.0.6 | `scripts/codemod-relative-to-alias.ts` — `../../` → `@/` (idempotent, `--dry-run`) | diff تەنها guzارشتی چاوەڕوانکراو |
| T-LR.0.7 | `frontend/src/data/quickCreateRegistry.contract.test.ts` — یەک `it()` بۆ هەر entity (13) | تێست fail بکات لەسەر هەر drift |
| T-LR.0.8 | `.github/workflows/ci.yml` — `npm ci → typecheck → lint → test → build → orphan → alias → truncation` | PR سەوز |
| T-LR.0.9 | `frontend/src/_double-mount-audit.md` — لیستی فایلە hستیارەکانی React 19 | ≥ 12 کاندید |
| T-LR.0.10 | typecheck baseline → سفر؛ CI blocking بکە | `tsc --noEmit` exit 0 |

**تێبینی گرینگ:** R1.9 (contract test) — ڕەجیستری ئێستا 16 entity هەیە (customer, vendor جیاکراون) بەڵام سپێس دەڵێ 13 slug. کاتێک contract test دەنووسیت، دڵنیابە کە path ـەکان لەگەڵ ئەندپۆینتە نوێیەکانی R1 یەکدەگرنەوە (بڕوانە خوارەوە).

---

## 🟨 Phase R2.1–R2.4 — Hardening ئەندپۆینتە بەردەستەکان (دەکرێت بە کۆد بکرێت)

ئەمانە ئەندپۆینتی نوێ نین — تەنها چاکسازین. Claude دەیتوانی بیانکات بەڵام پەلەی بە R1 (404ـەکان) بوو. هەر یەکێک بچووکە (~0.5–1 ڕۆژ).

### R2.1 — `POST /api/contacts` (hardening)
- **فایل:** `backend/app/api/contacts.py` + `backend/app/schemas/schemas.py` (`ContactCreate`).
- **کار:** دڵنیابە تەنها `display_name` پێویستە. `email` و `phone` نابێت 400/422 بدەن کاتێک نەبن. زیادکردنی نۆرماڵایزی ژمارەی تەلەفۆنی عێراقی (E.164، +964).
- **پشکنین:** `ContactCreate` ـی ئێستا بپشکنە — ئەگەر `email` یان `phone` `required` بوو، بیکە optional.

### R2.2 — `POST /api/items` (hardening)
- **فایل:** `backend/app/api/items.py`.
- **کار:** auto-generate ـی `sku` ئەگەر نەبوو. FK ـی `tax_rate_id`/`income_account_id`/`expense_account_id` ـی بەتاڵ وەک `null` مامەڵە بکە، نەک 422.

### R2.3 — `POST /api/taxes` (unification)
- **فایل:** `backend/app/api/taxes.py`.
- **دۆخ:** `/api/taxes/rates` ئێستا بوونی هەیە (ڕەجیستری ئەمە بەکاردێنێت). سپێس دەڵێ canonical = `/api/taxes` و `/api/taxes/rates` ببێتە alias.
- **کار:** ڕووتی `POST /api/taxes` (بێ `/rates`) زیاد بکە کە هەمان repo بەکاردێنێت؛ `/rates` بهێڵەرەوە وەک alias لەگەڵ header ـی deprecation.

### R2.4 — `POST /api/accounts` (hardening)
- **فایل:** `backend/app/api/accounts.py`.
- **کار:** auto-generate ـی `code` بەپێی نەریتی ٥-ڕەقەمی عێراق (10000–59999). پشکنینی consistency ـی `parent_id` type ↔ child type. parent ـی هەڵە → 422.

---

## 🟥 Phase R3 — Staging Environment

**بۆچی نەکرا:** هەموو ئەم ئەرکانە پێویستیان بە دەستگەیشتن بە GCP Console، Cloudflare DNS، و Vercel dashboard هەیە — لەگەڵ بڕواننامەی billing و IAM. Claude دەستگەیشتنی بەمانە نییە.

| ئەرک | چی پێویستە | ئامراز |
|------|-------------|--------|
| T-LR.2.1 | پڕۆژەی `zoho-staging` لە GCP، هەمان API ـەکان، region `me-central1`, IAM group `staging-only` | `gcloud` CLI |
| T-LR.2.2 | Firestore Native (staging) + Memorystore Redis 1GB BASIC + Secret Manager (`STAGING_*`) | GCP Console |
| T-LR.2.3 | ژینگەی `staging` لە Vercel، map ـی branch ـی `staging` | Vercel dashboard |
| T-LR.2.4 | DNS: `staging.erp.zoho.kurd.iq` + `api.staging.erp.zoho.kurd.iq` + TLS | Cloudflare |
| T-LR.2.5 | `backend/app/tools/seed_staging.py` — synthetic tenant + `--reset` | **کۆد — دەکرێت بکرێت** |
| T-LR.2.6 | `EnvironmentBadge.tsx` — banner ـی staging بەپێی `VITE_ENV` | **کۆد — دەکرێت بکرێت** |
| T-LR.2.7 | `.github/workflows/staging-smoke.yml` | GitHub + secrets |
| T-LR.2.8 | Cloud Scheduler → reset ـی مانگانە | GCP |

> **دەکرێت Claude بیکات:** T-LR.2.5 (seeder script) و T-LR.2.6 (EnvironmentBadge). ئەوانی تر infra ـن.

**بڕواننامە/زانیاری پێویست لە تۆ:**
- ID ـی پڕۆژەی GCP و دەستگەیشتنی billing.
- دۆمەینی Cloudflare (`zoho.kurd.iq` یان هاوشێوە).
- Vercel team/project access.

---

## 🟥 Phase R4 — Tenant-Side Payments

**بۆچی نەکرا:** بەشی هەرە گەورەی پێویستی بە **بڕواننامەی sandbox** هەیە لە دابینکەرە عێراقییەکان (FastPay, Qi Card, Zain Cash, Asia Pay) کە دەبێت بە پەیوەندی بازرگانی بەدەست بهێنرێن (R7.2–R7.5). بەبێ ئەوانە، adapter ـەکان ناتوانرێ تاقی بکرێنەوە.

**بەڵام ئەم بەشانە دەکرێت بە کۆد بکرێن (بێ بڕواننامەی دەرەکی):**

| ئەرک | چی | دەکرێت بکرێت؟ |
|------|-----|---------------|
| T-LR.4.1 | `PaymentGateway` interface + registry (`backend/app/payments/gateway.py`, `registry.py`) | ✅ بەڵێ |
| T-LR.4.2 | `CashGateway` (بێ بانگی دەرەکی) | ✅ بەڵێ |
| T-LR.4.3 | `CODGateway` + state machine (pending → delivered → settled) | ✅ بەڵێ |
| T-LR.4.4 | `FastPayGateway` (sandbox) | ❌ پێویستی بە OAuth credentials (R7.2) |
| T-LR.4.5 | `QiCardGateway` (sandbox) | ❌ پێویستی بە Qi business API (R7.3) |
| T-LR.4.6 | `ZainCashGateway` (sandbox) | ❌ docs/sandbox نادیار (R7.4) |
| T-LR.4.7 | `AsiaPayGateway` | ❌ deferred تا داواکرێت (R7.5) |
| T-LR.4.8 | `StripeGateway` (tenant-side) | ⚠️ کۆد دەکرێت، تاقیکردن پێویستی بە Stripe test key |
| T-LR.4.9 | Webhook ingress + signature verify (`POST /api/payments/webhooks/<provider>`) | ✅ کۆد دەکرێت |
| T-LR.4.10 | `Payment` aggregate Firestore model + indices | ✅ بەڵێ |
| T-LR.4.11 | Refund endpoint + GL reversal | ✅ بەڵێ (بۆ Cash/Stripe) |
| T-LR.4.12 | Reconciliation nightly job | ⚠️ کۆد دەکرێت، پێویستی بە settlement report |
| T-LR.4.13 | Settings UI: Providers (`frontend/src/pages/settings/payments/Providers.tsx`) | ✅ بەڵێ |
| T-LR.4.14 | Settings UI: Reconciliation queue | ✅ بەڵێ |
| T-LR.4.15 | POS payment-method picker + QR/numpad | ✅ بەڵێ |
| T-LR.4.16 | Hosted payment link (`POST /api/invoices/{id}/pay-link`) | ✅ بەڵێ |

> **پێشنیار:** Claude دەتوانێ `PaymentGateway` abstraction + `Cash` + `COD` + ساختاری `Stripe` + Firestore model + webhook scaffold + UI ـەکان دروست بکات. دابینکەرە عێراقییەکان (FastPay/Qi/Zain) دەمێننەوە تا بڕواننامەکان بەدەست بهێنیت.

**بڕواننامە پێویست لە تۆ:** OAuth client_id/secret ـی FastPay sandbox، Qi merchant API، Zain Cash merchant_id، Stripe test secret key.

---

## 🟥 Phase R5 — SaaS Subscription Billing

**بۆچی نەکرا:** پێویستی بە **Stripe legal entity** هەیە (R7.7 — Stripe Iraq-resident sole proprietorship پشتگیری ناکات؛ پێویستی بە US/UK/Delaware C-corp). هەروەها بڕواننامەی Stripe test mode.

**دەکرێت بە کۆد بکرێت (ساختار، بێ تاقیکردنەوەی زیندوو):**

| ئەرک | چی | دەکرێت بکرێت؟ |
|------|-----|---------------|
| T-LR.5.1 | `backend/app/billing/plans.py` + `scripts/bootstrap-stripe.ts` | ✅ کۆد، تاقیکردن پێویستی بە Stripe key |
| T-LR.5.2 | `backend/app/billing/stripe.py` — Stripe Subscriptions | ⚠️ کۆد دەکرێت |
| T-LR.5.3 | `backend/app/billing/fastpay_recurring.py` (یان invoice + manual fallback) | ⚠️ پێویستی بە FastPay (R7.2) |
| T-LR.5.4 | `POST /api/saas-billing/webhooks/stripe` | ✅ کۆد دەکرێت |
| T-LR.5.5 | Dunning sequence engine (day 0/3/7/14/30) | ✅ کۆد دەکرێت |
| T-LR.5.6 | `frontend/src/pages/billing/TenantBilling.tsx` | ✅ بەڵێ |
| T-LR.5.7 | Super-Admin billing dashboard (MRR/churn/past_due) | ✅ بەڵێ |
| T-LR.5.8 | Free-trial enforcement (`billing.trial_ends_at`, 90 ڕۆژ) | ✅ بەڵێ |
| T-LR.5.9 | Public `/pricing` page (IQD + USD) | ✅ بەڵێ |

**بڕواننامە/بڕیار پێویست لە تۆ:** Stripe account (legal entity)، Stripe test/live keys، `STRIPE_WEBHOOK_SECRET`، بڕیاری price IDs.

---

## 🟨 Phase R6 — Cross-cutting (دۆکیومێنت — دەکرێت بکرێت)

ئەمانە دۆکیومێنتن و دەکرێت بکرێن (هەندێکیان پاش ئەرکی پەیوەندیدار):

| ئەرک | فایل | دۆخ |
|------|------|------|
| T-LR.6.1 | Translation pass (Kurdish) بۆ wizard/billing/payments | پاش R3/R5 UI |
| T-LR.6.2 | Translation pass (Arabic) → 100% | پاش UI |
| T-LR.6.3 | `docs/runbooks/onboarding-troubleshooting.md` | پاش R3 |
| T-LR.6.4 | `docs/runbooks/payment-reconciliation.md` | پاش R4.12 |
| T-LR.6.5 | `docs/runbooks/saas-dunning.md` | پاش R5.5 |
| T-LR.6.6 | `docs/dev/typecheck-recipes.md` (20 recipe) | پاش R0.10 |
| T-LR.6.7 | `docs/adr/` — 10 ADR | هەرکات |

---

## 🟥 Phase R7 — Open Questions / Decisions (تەنها تۆ دەتوانیت)

ئەمانە ئەرکی کۆد نین — بڕیار/پەیوەندی دەرەکین. هیچیان Claude ناتوانێ بیکات.

| ئەرک | پرسیار | بەرپرس |
|------|---------|---------|
| T-LR.7.1 | ڕێژەی باجی هەر پارێزگا 2026 (ژمێریاری عێراقی/کوردی) | تۆ + ژمێریار |
| T-LR.7.2 | FastPay business sandbox credentials + پشتگیری recurring | تۆ |
| T-LR.7.3 | Qi Card business API access + KYC + settlement timing | تۆ |
| T-LR.7.4 | Zain Cash merchant API docs + OTP/webhook contract | تۆ |
| T-LR.7.5 | Asia Pay / Asia Hawala — پێویستە بۆ launch؟ | تۆ |
| T-LR.7.6 | E-Fakhata (E-Invoice IQ) ـی schema version | تۆ |
| T-LR.7.7 | Stripe legal entity (US/UK/Delaware C-corp) | تۆ + یاسایی |
| T-LR.7.8 | لیستی پرینتەری thermal ـی باو لە عێراق (Web Bluetooth) | تۆ |

---

## 🟦 R3 (کۆد) — Onboarding Wizard (دەکرێت بە تەواوی بکرێت)

ئەمە لە لیستی سەرەوەدا نەهاتووە بەڵام **هەموو کۆدی wizard دەکرێت بکرێت** بێ infra (تەنها داتای ڕاستەقینەی باج پێویستی بە R7.1):

| ئەرک | فایل | دەکرێت بکرێت؟ |
|------|------|---------------|
| T-LR.3.1 | `frontend/src/onboarding/state.ts` (state machine + Zustand) | ✅ بەڵێ |
| T-LR.3.2 | `<OnboardingShell>` + header/footer/progress | ✅ بەڵێ |
| T-LR.3.3 | `<StepCompanyInfo>` | ✅ بەڵێ |
| T-LR.3.4 | `<StepIraqRegion>` SVG map | ✅ بەڵێ |
| T-LR.3.5 | `frontend/src/data/iraqRegionPresets.ts` (18 پارێزگا، placeholders) | ✅ بەڵێ (ڕێژەکان placeholder تا R7.1) |
| T-LR.3.6 | `backend/app/data/coa_templates/*.yaml` (5 قاڵب) | ✅ بەڵێ |
| T-LR.3.7 | `POST /api/onboarding/coa/apply` | ✅ بەڵێ |
| T-LR.3.8 | `<StepChartOfAccounts>` | ✅ بەڵێ |
| T-LR.3.9 | `<StepPOSHardware>` (Web Bluetooth) | ⚠️ کۆد دەکرێت، تاقیکردن پێویستی بە پرینتەر |
| T-LR.3.10 | `<StepFirstSale>` guided overlay | ✅ بەڵێ |
| T-LR.3.11 | `GET/PUT /api/onboarding/state` | ✅ بەڵێ |
| T-LR.3.12 | Telemetry hooks | ✅ بەڵێ |
| T-LR.3.13 | وەرگێڕانی ku/ar/en | ✅ بەڵێ |
| T-LR.3.14 | Accessibility audit (axe-core) | ✅ بەڵێ |

---

## ✅ گرینگ: ئەوەی R1 دروستی کرد (بۆ ئاگاداری)

تا کاری دووبارە نەکەیت — ئەم ئەندپۆینتانە ئێستا کاردەکەن و تاقیکراونەتەوە (40 تێست سەوز):

| Path | فایل | کەیسی تایبەت |
|------|------|---------------|
| `POST/GET /api/expense-categories` | `backend/app/api/quick_create.py` | — |
| `POST/GET /api/equipment-categories` | هاوشێوە | — |
| `POST/GET /api/currencies` | هاوشێوە | idempotent upsert بە کۆد → 200 |
| `POST/GET /api/tags` | هاوشێوە | `(scope,name)` dedup → 200 |
| `POST/GET /api/payment-methods` | هاوشێوە | `requires_gateway_config` + default-flip |
| `POST/GET /api/teams` | هاوشێوە | `lead_id`/`manager_user_id` |
| `POST/GET /api/subscription-plans` | هاوشێوە | alias ـی subscriptions/plans |
| `POST/GET /api/bank-accounts` | هاوشێوە | alias + ماسکی ژمارە |
| `POST/GET /api/locations` | هاوشێوە | شوێنی بازرگانی + default-flip |

- سکیما: `backend/app/schemas/quick_create.py`
- repo: `backend/app/firestore/quick_create_repos.py`
- تێست: `backend/tests/quick_create/` (9 فایل، 40 تێست)
- مۆڵەت: 9 کۆد زیادکراون لە `backend/app/services/permissions.py`
- idempotency: prefix ـەکان زیادکراون لە `backend/app/middleware/idempotency_http.py`

---

## 🎯 پێشنیاری ڕیزبەندی (ئەگەر بمەوێ بەردەوام بم بە کۆد)

ئەمانە دەکرێت بەبێ هیچ دەستگەیشتنێکی دەرەکی بکرێن، بە ڕیزبەندی بەها:

1. **R2.1–R2.4 hardening** — بچووک، خێرا، ئەندپۆینتە بەردەستەکان پتەو دەکات.
2. **R0 scripts** (check-orphans, verify-aliases, detect-truncation, codemod, contract test) — پاش `npm install`.
3. **R3 onboarding wizard کۆد** — گەورەترین بەشی UI کە دەکرێت بکرێت.
4. **R4.1–R4.3 + R4.9–R4.11** — `PaymentGateway` + Cash + COD + webhook scaffold + Payment model.
5. **R5 کۆدی ساختار** — plans, dunning engine, billing UI (بێ Stripe key زیندوو).
6. **R6 docs/runbooks** — پاش ئەرکی پەیوەندیدار.

دابینکەرە عێراقییەکان (R4.4–R4.7)، staging infra (R3 spec)، Stripe entity (R5/R7.7)، و R7 هەموو دەمێننەوە بۆ تۆ.
