# Requirements Document: Launch Readiness — The Five Blockers

> **Spec ID:** `launch-readiness`
> **Status:** Draft v1.0
> **Owner:** Safa Othman
> **Tier:** 1 (Critical / launch-blocking)
> **Target window:** 8 weeks
> **North-star goal:** Close the five remaining blockers between "the code compiles on my laptop" and "we have a first paying customer in Iraq using this system to take real money."

---

## Introduction

This spec is an **honest assessment**. The Kurdish/Iraq ERP at `C:\Users\SAFA\zoho` currently consists of 276 frontend pages, 115 FastAPI route modules, 30+ extension modules, a POS subsystem with IndexedDB offline persistence, a 3-language i18n stack, a Cloud Run + Firestore + Redis deployment configuration, and a Vercel-fronted frontend. On paper the system is feature-complete. In reality it has never served a paying customer, no end-to-end flow has been validated against the most recent 130+ files added across `world-class-performance` phases P0–P6, the `empty-state-quick-create` migration, and the validation + deploy-kit deliverables.

The work captured here is not aspirational. It is the minimum that has to be true before a single real Iraqi shopkeeper, restaurant manager, hospital admin, or NGO finance officer can be onboarded without us being beside them when something inevitably breaks.

Five blockers stand in the way:

1. **Build verification is missing.** A large batch of recently-generated files has never been compiled. Cross-cutting imports, API drift between `quickCreateRegistry` and `SelectWithQuickCreate`, Vite v8 + `vite-plugin-pwa@1.3.0` compatibility, React 19 strict-mode incompatibilities, mid-Edit truncation from the bash mount (which we have observed multiple times), and a half-finished `@/` path-alias migration all conspire to make the current `main` branch *very likely* broken when `npm run build` is run from a clean Windows checkout.

2. **Backend endpoint completeness is incomplete.** The frontend quick-create registry advertises 13 entity slugs. Only four of them have a confirmed-working `POST` endpoint today (`contacts`, `items`, `accounts`, and a partially-named taxes endpoint). The remaining nine quick-create CTAs will surface a 404 to the user the first time they try to create an expense category, an equipment category, a subscription plan, a location, a team, a currency, a tag, a payment method, or a bank account.

3. **There is no staging environment.** Every deploy goes straight from a developer machine to the production Cloud Run revision serving the production Firestore database. A first mistake of any kind will be a customer-facing incident. The cost of fixing this is small. The cost of not fixing it is the entire reputation of the product in the first month.

4. **There is no first-run experience.** A user signs up, lands on an empty dashboard, and has no idea what to do. There is no wizard, no seeded chart of accounts, no tax-rate seeding by governorate, no POS hardware pairing flow, no "create your first product / first customer / first sale" guided overlay. The product effectively expects the user to already be an ERP administrator.

5. **The system cannot take money.** There is no production payment integration on either side: not on the *tenant-payment* side (the tenant's customer paying the tenant via POS or invoice), and not on the *SaaS-billing* side (the tenant paying us a monthly fee). Iraq's payment landscape is specific: FastPay, Qi Card, Zain Cash, Asia Pay / Asia Hawala, Cash-on-Delivery, and Stripe for international tenants. Each of these has its own sandbox, webhook contract, reconciliation model, and refund flow that we have not implemented.

This spec defines, in the **EARS** ("THE system SHALL …") format used by the `world-class-performance` and `empty-state-quick-create` specs, what each of these five blockers requires before launch can be called a launch.

The spec is *not* the place to fix every issue in the system. The bar is narrow: a single paying customer can sign up, complete the wizard, make their first sale, and the money can clear into their bank account; we can then take a monthly SaaS subscription from them.

---

## Glossary

### Iraq-specific terms

| Term | Definition |
|------|------------|
| **E-Fakhata / E-Invoice IQ** | The Iraqi General Commission for Taxes' e-invoice platform; mandatory for VAT-registered entities above the small-taxpayer threshold. Submission is XML-over-HTTPS with a per-tenant signing certificate. Status of the public schema/spec must be re-verified per quarter — the regulator publishes changes irregularly. |
| **Qi Card** | The dominant local debit/credit card in Iraq, operated by International Smart Card Co. on a MasterCard-Iraq rail. Accepted at most POS terminals in Baghdad, Erbil, Sulaymaniyah, Basra, Mosul, and at government salary disbursement points. |
| **FastPay** | The largest local mobile wallet in Iraq, operated by FastPay (Al-Mansour Bank). Used for peer-to-peer transfers and merchant payments via QR. Has a public REST API for merchant onboarding; sandbox credentials available by application. |
| **Zain Cash** | Telecom-tied mobile wallet operated by Iraq Wallet / Zain Telecom. Largely used by Zain Iraq subscribers; accepts deposits from a Zain SIM. Merchant API exists but is less widely documented than FastPay's. |
| **Asia Pay / Asia Hawala** | Payment gateway / money-transfer service operated by Asia Hawala. Used by import-export businesses and provides a card-on-file model for recurring payments. |
| **COD** | Cash on Delivery — still ~60% of all e-commerce transactions in Iraq as of 2025. Any payment abstraction must treat COD as a first-class settlement method, not an afterthought. |
| **IQD** | Iraqi Dinar. ISO 4217 code, denominated in whole dinars (no fractional minor unit in practice; formal `IQD` minor is 1/1000 fils which has not circulated since the 1990s). Common denominations: 250, 500, 1000, 5000, 10000, 25000, 50000 dinar notes. Receipts and invoices format without decimal places. |
| **Governorate** | Iraqi first-level administrative division ("muhafadha"). There are 18 governorates including Baghdad, Erbil, Sulaymaniyah, Duhok, Basra, Mosul (Nineveh), Najaf, Karbala, Diyala, Kirkuk, Wasit, Maysan, Dhi Qar, Muthanna, Babil, Anbar, Salah al-Din, and Halabja. Tax rates and reporting requirements vary by region — Kurdistan Region (Erbil, Sulaymaniyah, Duhok, Halabja) administers its own income tax and customs schedule. |
| **Mutawassit** | "Medium" — refers in this spec to the medium-sized SMB tier in the chart-of-accounts templates. |
| **PDPL** | Iraq's draft Personal Data Protection Law. Not yet ratified at the time of writing; we comply to GDPR-equivalent practices in anticipation. |
| **Iraqi VAT** | Federal Iraq does not levy a general VAT as of writing; it levies sales tax on specific items (telecom 20%, mobile recharge 20%, alcoholic and tobacco products at varying rates) and a 5–15% sales tax on hospitality services in many governorates. The Kurdistan Region has its own consumption-tax regime. This spec implements a *per-region tax-table* abstraction rather than a single national VAT rate. |

### Technical terms

| Term | Definition |
|------|------------|
| **tsc --noEmit** | TypeScript compiler invocation that performs type checking but does not produce output files; used as a CI gate. |
| **Path alias** | A non-relative import prefix (e.g., `@/components/X`) configured in `tsconfig.json` `paths` and `vite.config.ts` `resolve.alias`, requiring both sides to be in sync. |
| **Pydantic model** | A FastAPI request/response body schema. |
| **Idempotency key** | A client-supplied unique key (`Idempotency-Key` HTTP header) that ensures a retried POST is processed once. |
| **Webhook** | An asynchronous HTTP POST sent by a third-party service to a tenant-specific callback URL when a relevant event occurs. |
| **Reconciliation** | The process of matching internal records (e.g., invoices) against external records (e.g., bank settlements) and resolving differences. |
| **Synthetic tenant** | A non-customer-facing tenant in staging used for E2E tests and load tests. |
| **PaymentGateway** | The internal interface implemented per provider (FastPay, Qi, Zain Cash, Asia Pay, Stripe, COD). |
| **Settlement** | The provider's confirmation that funds have moved into the merchant's bank account; distinct from the authorization step. |
| **3DS** | Three-Domain Secure — the SCA (Strong Customer Authentication) layer for card-present-online payments. |
| **SaaS billing** | Recurring billing where the tenant pays us a monthly subscription fee. |
| **Onboarding state machine** | The five-step finite state machine driving the first-run wizard. |
| **Region preset** | A bundled object containing tax-rates, COA template, and locale defaults for a given Iraqi governorate or business type. |

---

## Requirements

### Requirement R1 — Compile and Build Health

The system SHALL be provably buildable from a clean Windows + Node 20 + Python 3.11 environment with zero errors and bounded warnings. "It works on my laptop" is not evidence; CI is.

**R1.1.** THE Frontend SHALL pass `npx tsc --noEmit` with **zero errors** on a clean checkout. Warnings are tracked in `_deltas/tsc-baseline.txt` and the baseline number SHALL NOT increase per PR.

**R1.2.** THE Frontend SHALL pass `npm run build` (Vite production build) end-to-end producing a `dist/` directory with: `index.html`, hashed `assets/*.js` and `assets/*.css`, a `sw.js` (service worker) from `vite-plugin-pwa`, a `manifest.webmanifest`, and the i18n split bundles under `dist/locales/`.

**R1.3.** THE Frontend SHALL pass `npm run lint` with the new flat-config ESLint setup (eslint.config.js) including the locally-registered `local/require-query-class` and `local/precise-invalidation` rules at `warn` level today and `error` level by the end of Phase R0.

**R1.4.** THE Frontend SHALL pass `npm run test` (Vitest) with **zero failing tests**. Snapshot tests are not exempt; if a snapshot is intentionally updated, the diff SHALL appear in the PR.

**R1.5.** THE Backend SHALL pass `pytest backend/tests` with **zero failing tests** and a coverage gate of ≥ 70% on the `app/` package.

**R1.6.** THE Backend SHALL pass `ruff check` and `mypy --strict-optional app/` with zero new errors. The `mypy` baseline is captured in `_deltas/mypy-baseline.txt`.

**R1.7.** EVERY new file added by the recent 130-file batch SHALL be imported and referenced by at least one route, page, or test. Orphan files (defined as files reachable by no `import` graph traversal from `main.tsx` or `backend/app/main.py`) SHALL be flagged by a CI step (`scripts/check-orphans.ts`) and either wired up or deleted.

**R1.8.** WHEN a file added by the agent is truncated mid-Edit (which has occurred multiple times via the bash mount), THE CI SHALL detect this. The detection rule: any file ending without a final newline AND containing an unterminated string, regex, JSX expression, or unclosed brace triggers a hard fail with the offending file path printed. A helper script `scripts/detect-truncation.ts` SHALL implement this.

**R1.9.** THE `quickCreateRegistry` SHALL match the `SelectWithQuickCreate` consumer API exactly. A contract test (`frontend/src/data/quickCreateRegistry.contract.test.ts`) SHALL assert: every entity slug declared in the registry resolves a valid Pydantic-schema-compatible field list, every `apiCreate` returns a record with `id` and the label-mapping function does not throw on a synthetic happy-path record.

**R1.10.** THE `vite-plugin-pwa@^1.3.0` SHALL be confirmed compatible with `vite@^8` on Windows. Verification step: a smoke `npm run build` on Windows produces a non-empty `dist/sw.js` whose `precacheManifest` contains the index `html`. If `vite-plugin-pwa` later removes Workbox v7 support, THE spec SHALL pin to the last compatible minor.

**R1.11.** EVERY import that uses the `@/` path alias SHALL resolve. A CI step SHALL fail if any `import` statement points at a path under `@/` that does not exist in `frontend/src/`.

**R1.12.** EVERY import that uses a relative path SHALL be reviewed for migration to `@/`. A codemod (`scripts/codemod-relative-to-alias.ts`) SHALL convert relative imports of depth ≥ 2 (i.e., `../../`) to alias form. Shallow `./` imports remain.

**R1.13.** REACT 19's strict-mode behaviors SHALL be validated: every store and effect that performs side-effects in `useEffect` SHALL tolerate being mounted twice in dev. A documented list of "double-mount sensitive" files SHALL exist in `frontend/src/_double-mount-audit.md`.

**R1.14.** THE TypeScript "common-fix recipes" SHALL be documented for the **top 20 expected errors** in the design document (see `design.md` § Section 1.4) so that a developer encountering one of them on Day 1 can self-serve.

**R1.15.** THE pre-commit hook (`.husky/pre-commit`) SHALL run, at minimum: `lint-staged` (formatting + lint for changed files only), `tsc --noEmit` on changed files (via `tsc-files`), and the truncation detector. The hook SHALL complete in ≤ 8 seconds on the median commit; otherwise the developer disables it and the gate ceases to work.

**R1.16.** WHEN `tsc --noEmit` exits non-zero in CI, THE pipeline SHALL post a comment on the PR with the first 20 errors and the count of additional errors. Silent CI failures are forbidden.

---

### Requirement R2 — Backend Endpoint Completeness for Quick-Create

The frontend's quick-create registry advertises 13 entity slugs. Every one of them SHALL have a working production-grade backend endpoint with consistent shape, scoping, validation, idempotency, rate-limiting, and permission enforcement. Entity by entity below.

**R2.0 — Cross-cutting endpoint contract.**

THE following SHALL hold for every quick-create endpoint regardless of entity:

- The endpoint accepts `POST /api/<resource>` with a JSON body.
- The endpoint accepts `Idempotency-Key` as an optional header. If present and a stored response exists for the (tenant_id, idempotency_key, route) tuple within 24 hours, the cached response SHALL be returned with `X-Idempotent-Replay: true`.
- The endpoint scopes to the authenticated user's `tenant_id` from the JWT. Writes outside the tenant SHALL be denied with 403.
- The endpoint enforces RBAC via `Depends(require_permission('<resource>.create'))`.
- The endpoint validates input with a Pydantic model (`<Entity>CreateRequest`) and returns a flat response model (`<Entity>Response`).
- The endpoint rate-limits at **60 req/min per tenant** for create operations.
- The endpoint emits a structured log line and an OpenTelemetry span.
- The endpoint returns **201 Created** on success with `Location: /api/<resource>/<id>`.
- The endpoint returns **422** with a per-field `detail` array on validation failure, **403** on permission failure, **409** on idempotency conflict, **429** on rate-limit exhaustion.

**R2.1 — `POST /api/contacts` (exists, hardening only).**

- Body: `display_name (str, required, 2–120 chars)`, `phone (str, optional, E.164)`, `email (EmailStr, optional)`, `contact_type ('customer' | 'vendor' | 'both', default 'customer')`.
- Response: full `Contact` model.
- Permission: `contacts.create`.
- Hardening: SHALL accept the `display_name` as the sole required field and SHALL NOT 400 on missing `email`. The current implementation SHALL be audited for over-strict required fields.

**R2.2 — `POST /api/items` (exists, hardening only).**

- Body: `name (str, required, 2–120)`, `sku (str, optional; auto-generated if missing)`, `type ('product' | 'service', default 'product')`, `unit_price (Decimal, optional, default 0)`, `tax_rate_id (str, optional)`, `income_account_id (str, optional)`, `expense_account_id (str, optional)`.
- Response: full `Item` model.
- Permission: `items.create`.

**R2.3 — `POST /api/taxes` (unification required).**

- Today there is drift: some code paths call `/api/taxes/rates`, some call `/api/taxes`. The canonical path SHALL be `/api/taxes`. The `/api/taxes/rates` path SHALL be retained as a permanent alias (HTTP 301 redirect or proxy route) to avoid breaking older clients.
- Body: `name (str, required)`, `rate_percent (Decimal, required, 0–100)`, `is_compound (bool, default false)`, `region (str, optional, governorate code)`, `applies_to ('sales' | 'purchases' | 'both', default 'both')`.
- Response: `TaxRate` model.
- Permission: `taxes.create`.

**R2.4 — `POST /api/accounts` (exists, hardening only).**

- Body: `name (str, required)`, `code (str, optional; auto-generated)`, `type ('asset'|'liability'|'equity'|'income'|'expense', required)`, `parent_id (str, optional)`, `currency (ISO-4217, optional, default tenant base)`, `is_bank (bool, default false)`.
- Response: `Account` model.
- Permission: `accounts.create`.

**R2.5 — `POST /api/expense-categories` (MISSING — must build).**

- File: `backend/app/api/v1/expense_categories.py`.
- Body: `name (str, required, 2–80)`, `code (str, optional)`, `default_account_id (str, optional)`, `description (str, optional)`, `is_active (bool, default true)`.
- Response: `ExpenseCategory` model.
- Permission: `expenses.categories.create`.
- Firestore: subcollection `tenants/{tenant_id}/expense_categories/{id}`.
- Pydantic models live in `backend/app/schemas/expense_category.py`.

**R2.6 — `POST /api/equipment-categories` (MISSING — must build).**

- File: `backend/app/api/v1/equipment_categories.py`.
- Body: `name (str, required, 2–80)`, `description (str, optional)`, `parent_id (str, optional, self-FK)`, `maintenance_interval_days (int, optional, > 0)`, `is_active (bool, default true)`.
- Response: `EquipmentCategory` model.
- Permission: `maintenance.categories.create`.
- Firestore: subcollection `tenants/{tenant_id}/equipment_categories/{id}`.

**R2.7 — `POST /api/subscription-plans` (MISSING — must build).**

- File: `backend/app/api/v1/subscription_plans.py`.
- Body: `name (str, required)`, `code (str, optional)`, `billing_period ('monthly'|'quarterly'|'annual', required)`, `price (Decimal, required, ≥ 0)`, `currency (ISO-4217, required)`, `trial_days (int, optional, default 0)`, `features (list[str], optional)`, `is_active (bool, default true)`.
- Response: `SubscriptionPlan` model.
- Permission: `subscriptions.plans.create`.
- Firestore: subcollection `tenants/{tenant_id}/subscription_plans/{id}`.

**R2.8 — `POST /api/locations` (MISSING — must build).**

- File: `backend/app/api/v1/locations.py`.
- Body: `name (str, required, 2–80)`, `code (str, optional)`, `type ('warehouse'|'retail'|'kitchen'|'office'|'virtual', default 'warehouse')`, `address (str, optional)`, `governorate (str, optional, Iraq governorate code)`, `phone (str, optional)`, `is_active (bool, default true)`, `is_default (bool, default false)`.
- Response: `Location` model.
- Permission: `locations.create`.
- Firestore: subcollection `tenants/{tenant_id}/locations/{id}`.
- Side-effect: WHEN `is_default=true`, all other locations SHALL be flipped to `is_default=false` atomically (transaction).

**R2.9 — `POST /api/teams` (MISSING — must build).**

- File: `backend/app/api/v1/teams.py`.
- Body: `name (str, required, 2–80)`, `description (str, optional)`, `manager_user_id (str, optional)`, `members (list[str], optional, user IDs)`, `is_active (bool, default true)`.
- Response: `Team` model.
- Permission: `teams.create`.
- Firestore: subcollection `tenants/{tenant_id}/teams/{id}`.

**R2.10 — `POST /api/bank-accounts` (may exist under `/api/banking`; unify).**

- The canonical path SHALL be `/api/bank-accounts`. If today's route is under `/api/banking/accounts`, an alias SHALL be added.
- Body: `name (str, required)`, `account_number (str, required, masked storage)`, `iban (str, optional, validated)`, `swift (str, optional, validated)`, `bank_name (str, required)`, `currency (ISO-4217, required)`, `gl_account_id (str, required, must reference a `type=asset` and `is_bank=true` account)`, `opening_balance (Decimal, default 0)`, `is_active (bool, default true)`.
- Response: `BankAccount` model.
- Permission: `bank_accounts.create`.

**R2.11 — `POST /api/currencies` (MISSING — config today).**

- Today currencies are config-only. They SHALL become a tenant-scoped subcollection so a tenant can add fringe currencies (e.g., Iranian Rial for cross-border trade).
- File: `backend/app/api/v1/currencies.py`.
- Body: `code (str, required, ISO-4217 3-letter)`, `name (str, required)`, `symbol (str, required, 1–4 chars)`, `decimal_places (int, default 2)`, `exchange_rate_to_base (Decimal, required, > 0)`, `is_active (bool, default true)`.
- Response: `Currency` model.
- Permission: `currencies.create`.
- Firestore: subcollection `tenants/{tenant_id}/currencies/{code_upper}` — note the document ID is the code (idempotent).

**R2.12 — `POST /api/tags` (MISSING — must build).**

- File: `backend/app/api/v1/tags.py`.
- Body: `name (str, required, 1–40)`, `color (str, optional, hex `#RRGGBB`)`, `scope (str, optional, e.g., 'contact'|'item'|'invoice'|'global', default 'global')`.
- Response: `Tag` model.
- Permission: `tags.create`.
- Firestore: subcollection `tenants/{tenant_id}/tags/{id}`.
- Uniqueness: `(scope, name)` SHALL be unique per tenant; second attempt returns the existing record with 200 OK (not 409) — quick-create semantics favor idempotency.

**R2.13 — `POST /api/payment-methods` (MISSING — must build).**

- File: `backend/app/api/v1/payment_methods.py`.
- Body: `name (str, required)`, `type ('cash'|'card'|'wallet'|'bank_transfer'|'qi_card'|'fastpay'|'zain_cash'|'asia_pay'|'cod'|'other', required)`, `provider_code (str, optional, references a configured PaymentGateway)`, `gl_account_id (str, optional)`, `is_active (bool, default true)`, `is_default (bool, default false)`.
- Response: `PaymentMethod` model.
- Permission: `payment_methods.create`.
- Side-effect: WHEN `is_default=true`, demote previous default in transaction.
- Side-effect: WHEN `type` is a known wallet/card provider, the response SHALL include a `requires_gateway_config: bool` field indicating whether the tenant must also configure the gateway in settings.

**R2.14 — Common test harness.** EACH endpoint above SHALL ship with:
- A happy-path integration test (POST → 201 → record retrievable).
- A validation-failure test (missing required field → 422).
- A permission-failure test (lacking role → 403).
- An idempotency replay test (same `Idempotency-Key` twice → second is replay).
- A rate-limit test (61st request in a minute → 429).

Tests live in `backend/tests/quick_create/` with one file per entity.

**R2.15 — OpenAPI documentation.** EACH endpoint SHALL appear in the generated OpenAPI spec with full Pydantic schemas, response examples, and tag `quick-create`. The OpenAPI JSON SHALL be diff'd against `_deltas/openapi-baseline.json` per PR.

---

### Requirement R3 — Staging Environment with Production Parity

A staging environment SHALL exist that mirrors production at the infrastructure and data-shape levels, and SHALL gate every promotion to production.

**R3.1.** THE GCP organization SHALL host two projects: `zoho-production` (existing) and `zoho-staging` (new). The staging project SHALL be created with the same APIs enabled, same region (`me-central1`), and same IAM principals as production, with a `staging-only` IAM group for write access to staging.

**R3.2.** THE Vercel project SHALL be configured with two environments: `production` (deploys from `main`) and `preview` (deploys from any PR branch) and `staging` (deploys from the `staging` branch). Preview deploys SHALL point their API base URL at staging.

**R3.3.** THE DNS SHALL expose `staging.erp.zoho.kurd.iq` (or the equivalent Cloudflare-managed domain) pointing at the staging Vercel deployment. The certificate SHALL be auto-managed.

**R3.4.** THE Firestore database for staging SHALL be a separate database (project `zoho-staging`) with the same security rules. Production Firestore SHALL NOT be reachable from staging code paths; the staging service account SHALL NOT have any IAM role on production.

**R3.5.** THE Redis instance for staging SHALL be a separate Memorystore instance with a smaller tier (1GB BASIC). It SHALL exist before staging Cloud Run is deployed.

**R3.6.** THE Secret Manager SHALL host a parallel set of secrets in `zoho-staging`: `SECRET_KEY`, `FIREBASE_ADMIN_KEY`, `SENTRY_DSN_STAGING`, `STRIPE_SECRET_KEY_TEST`, `FASTPAY_API_KEY_SANDBOX`, etc. Production secrets SHALL never appear in staging configuration.

**R3.7.** THE synthetic-tenant seeding SHALL exist: a CLI command `python -m app.tools.seed_staging --tenant=acme --reset` provisions a tenant with a deterministic UID, seeded chart of accounts, seeded items, seeded customers, seeded invoices in mixed states, and 90 days of seeded sales data. Re-running the seed resets the tenant.

**R3.8.** THE E2E test harness SHALL point at `staging.erp.zoho.kurd.iq` for nightly runs. A subset of the E2E suite SHALL run on every PR against the preview deployment and gate merge.

**R3.9.** THE promotion path SHALL be: PR opened → preview deploy → preview E2E (10 critical paths) → reviewer approval → merge to `main` → production deploy. A separate `staging` branch deploys to staging on every push, used for canary and long-running validation.

**R3.10.** THE production deploy SHALL be blocked unless the most recent commit on `main` has a green `staging-smoke` check (a workflow that deploys the same commit to staging first and runs a 5-minute smoke suite). Direct production deploys via `workflow_dispatch` SHALL be disabled in the protected workflow.

**R3.11.** THE staging environment SHALL ship a banner in the top bar of the frontend ("STAGING — synthetic data, no real customers") rendered via `EnvironmentBadge.tsx`. The banner SHALL be impossible to disable through user settings.

**R3.12.** THE staging environment SHALL be cleared and re-seeded on the 1st of every month (cron in Cloud Scheduler) so that test data does not accumulate to misleading volumes.

---

### Requirement R4 — First-Run Onboarding Wizard

A new tenant SHALL be productive within 60 seconds of completing sign-up. The wizard is a five-step finite state machine driving a guided experience that ends with the tenant having a populated company, region-aware tax rates, a starting chart of accounts, optionally a paired POS printer, and at minimum one product, one customer, and one completed sale.

**R4.1.** THE wizard SHALL be triggered when a user completes sign-up AND the tenant document does NOT have `onboarding.completed_at`. The wizard SHALL be skippable but the skip CTA is a tertiary link, not a button. Skipping records `onboarding.skipped_at` and SHALL NOT be re-prompted.

**R4.2.** THE wizard SHALL be a 5-step linear flow with progress indicator: (1) Company info, (2) Region preset, (3) Chart of Accounts template, (4) POS hardware (optional), (5) First product + customer + sale (guided).

**R4.3 — Step 1: Company info.** THE form SHALL collect: `company_name (required, 2–120)`, `legal_name (optional)`, `address_line (optional)`, `governorate (required, select)`, `phone (required, Iraqi format)`, `email (required, EmailStr)`, `vat_status ('exempt'|'registered'|'small_taxpayer', required)`, `tax_id (conditional on vat_status != 'exempt')`. On submit, write to `tenants/{tenant_id}/profile`. Validation errors stay inline.

**R4.4 — Step 2: Iraq region preset.** THE wizard SHALL show a map or select of Iraq's 18 governorates. Selecting a governorate SHALL auto-populate the tax-rate table with regional defaults: Baghdad (10% hospitality, 20% telecom), Erbil/Sulaymaniyah/Duhok/Halabja (Kurdistan Region) using KRG-specific schedules, Basra (federal + local), and a "Federal Iraq generic" preset for governorates without a custom schedule. The user can override any seeded rate before continuing.

**R4.5 — Step 3: Chart of Accounts.** THE wizard SHALL present 5 templates: **Small General Trade** (simple retail), **Medium General Trade** (multi-location retail), **Restaurant / Cafe**, **Pharmacy**, **Construction / Contractor**. Each template seeds 40–120 GL accounts in the Iraq accounting convention (5-digit codes 10000–59999, with English + Kurdish + Arabic display names). The user can preview the template and customize before applying.

**R4.6 — Step 4: POS hardware (optional).** WHEN the tenant intends to use POS, THE wizard SHALL show: pair a Bluetooth thermal printer (Web Bluetooth API), select the paper width (58mm or 80mm), test-print a sample receipt, configure cash-drawer kick-out (Bluetooth, USB, or skip), and confirm. The user MAY skip and configure later. The confirmation flow shows the test-printed receipt with a "Did it print correctly? Yes / No / Retry" question and only proceeds to step 5 on Yes.

**R4.7 — Step 5: First product + customer + sale.** THE wizard SHALL run a 3-mini-step guided overlay: (a) create your first product (name, price, unit), (b) create your first customer (name, optional phone), (c) ring up a 1 IQD sale, mark it paid, and print or skip-print the receipt. The mini-steps SHALL use the existing quick-create modals so the same code path is exercised on real first-touch.

**R4.8.** THE wizard SHALL persist state every step in `tenants/{tenant_id}/onboarding/state` so a refresh or close-and-resume returns the user to the last completed step. The state is a small document: `{step, completed_steps[], company_info, governorate, coa_template, pos_configured, first_sale_id}`.

**R4.9.** THE wizard SHALL emit telemetry: `onboarding.started`, `onboarding.step_completed` (with step name and time-in-step ms), `onboarding.skipped` (with step name), `onboarding.completed` (with total elapsed ms), `onboarding.abandoned` (no progress for 24h after start).

**R4.10.** THE wizard SHALL be fully translated to Kurdish (Sorani), Arabic, and English with RTL handled. The Arabic translation SHALL be complete before the wizard ships — partial Arabic is forbidden per the i18n-completeness rule (Spec `world-class-performance` R9.1).

**R4.11.** THE wizard SHALL be accessible: keyboard-navigable with `Tab` and `Enter`, focusable headings, ARIA-live announcements for step transitions, and color contrast ≥ AA. Tested via `axe-core` in CI.

**R4.12.** THE Region preset SHALL be data-driven. The presets live in `frontend/src/data/iraqRegionPresets.ts`; adding a new governorate or correcting a tax rate is a data edit, not a code change. The preset format is documented in `design.md` § Section 4.4.

**R4.13.** THE Chart of Accounts templates SHALL live in `backend/app/data/coa_templates/` as YAML files (one per template), with English / Kurdish / Arabic display names per account, account type, parent reference, and an `is_default_for` field that maps to GL functions (e.g., `default_sales_revenue`, `default_cash`, `default_ar`, `default_ap`, `default_tax_payable`). The backend uses these defaults to wire freshly-seeded accounts to their expected roles.

**R4.14.** THE wizard SHALL NOT block users who decline to provide a tax ID or who choose to skip step 4 (POS). The minimum required path is Steps 1, 2, 3, 5 with VAT status set to exempt; this completes in well under 60 seconds for a casual user.

**R4.15.** THE wizard SHALL be re-runnable from the help menu via "Re-run onboarding". Re-running is non-destructive: it walks the same steps but skips any step whose target data already exists, surfacing it as already-done.

---

### Requirement R5 — Dual Payment System

The system SHALL implement two distinct payment flows:

- **Tenant-side payments**: a tenant's customer paying the tenant via POS, invoice, or subscription. The tenant chooses which gateways are enabled.
- **SaaS billing**: the tenant paying us monthly. We charge the tenant via Stripe (international tenants) or FastPay business (Iraq-resident tenants).

Both flows share a `PaymentGateway` abstraction but have independent UIs, dashboards, and reconciliation logic.

#### R5.A — Tenant-side payment abstraction

**R5.A.1.** THE backend SHALL define a `PaymentGateway` interface in `backend/app/payments/gateway.py` with methods: `create_intent(amount, currency, metadata) -> Intent`, `confirm(intent_id) -> Result`, `refund(charge_id, amount) -> RefundResult`, `webhook_verify(payload, signature) -> Event`, `webhook_handle(event) -> None`, `reconcile(date_range) -> ReconciliationReport`.

**R5.A.2.** THE following provider adapters SHALL be implemented in order of priority:

1. `CashGateway` — degenerate adapter for cash payments (no external call; records the transaction).
2. `CODGateway` — Cash on Delivery; records the transaction and the delivery commitment; settles when courier confirms delivery.
3. `QiCardGateway` — Qi Card via the International Smart Card Co. merchant API. Sandbox URL: must be confirmed with Qi business team; spec assumes `https://api.sandbox.qicard.iq/v1/`. Webhook contract: HMAC-SHA256 signature in `X-Qi-Signature`. Auth flow: authorize → 3DS challenge if cardholder enrolled → capture.
4. `FastPayGateway` — FastPay merchant API. Sandbox URL: `https://sandbox.fastpaywallet.com/api/v1/`. Auth: OAuth2 client credentials. QR-code + push-notification confirmation. Webhook signature: `X-FastPay-Signature` HMAC-SHA256.
5. `ZainCashGateway` — Zain Cash merchant API. Sandbox URL must be confirmed with Zain Cash business team. Auth: API key + merchant_id. SMS-OTP confirmation. Webhook signature: TBD per provider docs.
6. `AsiaPayGateway` — Asia Hawala / Asia Pay payment gateway. Auth and webhook spec to be confirmed with Asia Hawala business team.
7. `StripeGateway` — Stripe for international (non-Iraq-resident) tenants whose customers pay with international cards. Standard Stripe Connect or Standard Accounts model.

**R5.A.3.** EACH provider adapter SHALL be feature-flagged behind `payments.providers.<provider>`. A tenant can enable a subset; the union of enabled providers determines what appears in the POS and invoice "Pay" UIs.

**R5.A.4.** THE `Payment` aggregate SHALL be a Firestore document with fields: `id`, `tenant_id`, `provider`, `provider_intent_id`, `provider_charge_id`, `amount`, `currency`, `status (initiated | authorized | captured | settled | refunded | failed)`, `linked_doc_type (invoice|pos_sale|subscription)`, `linked_doc_id`, `customer_id`, `created_at`, `captured_at`, `settled_at`, `refunded_amount`, `metadata`.

**R5.A.5.** THE webhook endpoints SHALL be per-provider at `POST /api/payments/webhooks/<provider>` with signature verification before any business logic. Unverified webhooks SHALL be rejected with 400. The handler SHALL be idempotent on the (provider, provider_event_id) tuple.

**R5.A.6.** THE retry policy SHALL be: failed webhook handling retries 3 times at 5s, 30s, 5min, then escalates to a manual reconciliation queue.

**R5.A.7.** THE refund flow SHALL be: user with `payments.refund` permission clicks Refund on a payment; the system shows the refundable amount and reason field; submits to the provider; on success records `RefundResult` and updates the linked invoice or POS sale to reflect partial/full refund.

**R5.A.8.** THE reconciliation job SHALL run nightly per provider, pulling the provider's settlement report for the previous day and matching against `Payment` documents. Mismatches SHALL be logged to a reconciliation queue with a UI in Settings → Payments → Reconciliation.

**R5.A.9.** THE PCI / data-residency posture SHALL be: NO raw PAN data passes through our servers for card payments. Card data SHALL be tokenized at the provider's hosted page or SDK. For local providers without hosted pages, this requirement is downgraded to "PCI-equivalent" with extra controls (TLS-only, no logging of intent payloads).

**R5.A.10.** THE POS UI SHALL show a payment-method picker with the tenant's enabled providers. Selecting a provider that requires a QR scan (FastPay, Zain Cash) renders a QR code; tap-to-card providers (Qi Card) prompt the operator to tap the card on a paired NFC reader (future) or to type the PAN into a virtual terminal (interim). Cash payments render a numpad and change calculator.

**R5.A.11.** THE invoice UI SHALL include a "Pay Online" button that emails the customer a hosted payment page link. The hosted page allows the customer to choose any of the tenant's enabled providers. The page is tenant-branded and locale-aware.

**R5.A.12.** THE failure UX SHALL be specific per provider: declined card → "Payment declined by the card issuer", insufficient wallet balance → "Wallet balance is insufficient", network timeout → "We did not hear back from the provider; the payment may have gone through — check the receipt or try again". A timeout state SHALL be retryable with the same idempotency key for 24 hours.

#### R5.B — SaaS subscription billing

**R5.B.1.** THE SaaS billing system SHALL operate independently of the tenant-side payment system. A tenant signs up to one of three plans: **Starter** (small tenants, free for first 90 days, then $19/mo), **Business** ($49/mo), **Enterprise** (custom pricing). Plans are defined in `backend/app/billing/plans.py`.

**R5.B.2.** THE SaaS billing SHALL use **Stripe Subscriptions** for non-Iraqi tenants and **FastPay business recurring** for Iraqi tenants (or a manual / wire-transfer flow as a fallback if FastPay does not support recurring at the time of launch).

**R5.B.3.** WHEN a tenant signs up, THE system SHALL determine the billing rail: country code (from Stripe Customer or tenant profile) in Iraq → FastPay billing; otherwise → Stripe billing. The choice SHALL be re-evaluable from Tenant Admin → Billing.

**R5.B.4.** THE Stripe Subscription flow SHALL be: create Customer → create Subscription with a price ID matching the chosen plan → on subscription `invoice.paid` webhook, mark tenant `billing.status = active`; on `invoice.payment_failed`, transition to `billing.status = past_due` and start the dunning sequence per R5.B.7.

**R5.B.5.** THE FastPay business billing flow (if available) SHALL use a tokenized merchant-initiated transaction model. If FastPay does not support recurring, the system SHALL send an invoice via FastPay each cycle and accept manual confirmation, with a 7-day grace period.

**R5.B.6.** THE tenant SHALL access **Tenant Admin → Billing** to see: current plan, next renewal date, payment method, invoice history (PDF downloadable), and a "Change plan" CTA. The page SHALL render in Kurdish, Arabic, and English.

**R5.B.7.** THE dunning sequence (failed billing) SHALL be: email + in-app notification on day 0, day 3, day 7. On day 14, tenant enters read-only mode (no new transactions). On day 30, tenant enters frozen state (login blocked except for billing page). A grace-period extension can be granted manually from Super-Admin.

**R5.B.8.** THE Super-Admin Console SHALL include a Billing view showing MRR, churn rate, plan distribution, and tenants in past_due / frozen states. Existing Super-Admin Console spec is referenced (`super-admin-console`).

**R5.B.9.** THE Stripe webhook endpoint SHALL be `POST /api/saas-billing/webhooks/stripe` with signature verification via `STRIPE_WEBHOOK_SECRET`. Handled events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `payment_method.attached`, `payment_method.detached`.

**R5.B.10.** THE refund / dispute on SaaS billing SHALL be a manual flow handled by Super-Admin. There is no self-serve refund; cancellations stop renewal but do not refund mid-period.

**R5.B.11.** THE pricing page (`/pricing` public route) SHALL render plan comparison with Iraqi pricing in IQD next to USD equivalents, and SHALL respect locale.

**R5.B.12.** THE FREE tier (first 90 days for new Iraqi tenants only) SHALL be tracked and cannot be re-claimed by the same tenant_admin email. The trial is implemented as a `billing.trial_ends_at` field, set on tenant creation.

**R5.B.13.** THE billing system SHALL handle tax/VAT correctly: Iraqi tenants are out-of-scope for US sales tax; US/EU tenants are charged Stripe Tax-computed VAT. The chosen Stripe Tax mode is documented in `design.md` § Section 5.13.

---

## Non-Functional Requirements Summary

| Dimension | Target |
|-----------|--------|
| `tsc --noEmit` errors (frontend) | 0 |
| `mypy --strict-optional` errors (backend) | 0 above baseline |
| `npm run build` outcome | green on Windows + Linux |
| Orphan files (post-batch) | 0 |
| Backend quick-create endpoints | 13/13 implemented + tested |
| Staging deploy time per PR | ≤ 8 min from merge to staging-ready |
| Wizard time-to-first-sale (median user) | ≤ 90 seconds |
| Wizard completion rate (sign-up → completed_at) | ≥ 60% |
| Payment intent success rate (tenant-side) | ≥ 99.5% excluding declines |
| Webhook handler idempotency | 100% (no double-processing) |
| SaaS billing dunning compliance | 0 frozen tenants without dunning history |
| Localization (wizard) | Kurdish 100%, Arabic 100%, English 100% |

---

## Out of Scope (for this spec, not forever)

- Native iOS / Android app store releases. The PWA is the launch target.
- Multi-merchant Stripe Connect setups (one Stripe account = one tenant for SaaS billing; tenant-side Stripe is per-tenant).
- Embedded finance (lending, BNPL) — separate spec.
- Multi-currency tax tables beyond the per-region presets shipped with the wizard.
- Automatic exchange-rate updates from a third-party FX API — manual update in Settings for v1.
- Voice or chatbot-driven onboarding — text + form UI only for v1.
- Marketplace / third-party plugin store — separate spec.
- A second SaaS billing region (e.g., GCC outside Iraq) — Stripe handles international generically.
- Full PCI-DSS Level 1 certification — we target SAQ-A scope by tokenizing all card data through hosted provider pages.

---

## Acceptance — How We Know We Are Done

This spec is "done" when, on a one-week canary in staging followed by a controlled launch with one paying customer:

1. `npm run build` and `pytest` both produce green outputs on a clean checkout from `main` on both Windows and Linux.
2. `scripts/check-orphans.ts` reports zero orphan files.
3. The 13 quick-create endpoints are deployed, integration-tested, and rate-limited; the contract test in `frontend/src/data/quickCreateRegistry.contract.test.ts` is green.
4. The staging environment is reachable at `staging.erp.zoho.kurd.iq`, deploys on every push to `staging`, and the `staging-smoke` workflow is the required check for production promotion.
5. A new tenant can sign up, complete the 5-step wizard in ≤ 90 seconds median, and complete a 1-IQD first sale that posts to the correct GL accounts.
6. A tenant can configure at least one of {FastPay, Qi Card, Cash, COD} as a tenant-side payment method and complete a real test transaction in the provider's sandbox.
7. A tenant can be billed by Stripe (international) or be tracked under FastPay-business / manual-invoice billing (Iraqi) with a 90-day trial honored.
8. The Super-Admin Billing dashboard shows MRR, churn, and dunning states.
9. The localization gate (Kurdish 100%, Arabic 100%, English 100% for wizard + billing + payment UIs) is green.
10. The dunning sequence has been exercised end-to-end on a synthetic tenant (intentional card-decline test).

Until all ten are true, the launch is not a launch — it is a beta.
