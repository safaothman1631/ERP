# Tasks Document: Launch Readiness — The Five Blockers

> **Spec ID:** `launch-readiness`
> **Document:** tasks
> **Status:** Draft v1.0
> **Owner:** Safa Othman
> **Companion to:** `requirements.md`, `design.md`
> **Effort total:** ~ 60–75 person-days across an 8-week window

---

## Phase overview

| Phase | Theme | Tasks | Effort (days) | Target window |
|-------|-------|-------|---------------|---------------|
| R0 | Compile + Type Health | 10 | 6 | Week 1 |
| R1 | Backend Quick-Create Endpoints | 14 | 10 | Weeks 1–3 |
| R2 | Staging Environment | 8 | 6 | Weeks 2–3 |
| R3 | Onboarding Wizard | 14 | 12 | Weeks 3–5 |
| R4 | Tenant-Side Payments | 16 | 16 | Weeks 4–7 |
| R5 | SaaS Subscription Billing | 9 | 7 | Weeks 6–8 |
| R6 | Cross-cutting | 7 | 5 | Throughout |
| R7 | Decisions / Open Questions | 8 | n/a (research) | Weeks 1–4 |

Total: 86 tasks. Some run in parallel; calendar is 8 weeks.

---

## Phase R0 — Compile + Type Health (Week 1)

### T-LR.0.1 — Establish typecheck baseline
- **Description**: Run `npx tsc --noEmit` from `frontend/`. Capture the error count and the first 50 errors to `_deltas/tsc-baseline.txt`.
- **Acceptance**: file `_deltas/tsc-baseline.txt` exists; CI step `Frontend typecheck` is added but does not yet block (warn-only).
- **Effort**: 0.5 d
- **Owner**: Frontend lead
- **BlockedBy**: none

### T-LR.0.2 — Add lint-staged + tsc-files pre-commit
- **Description**: Update `frontend/package.json` lint-staged config; install `tsc-files`; verify `.husky/pre-commit` runs in < 8 s on the median commit.
- **Acceptance**: a noop commit triggers no extra messages; a commit touching one .ts file with a type error is rejected.
- **Effort**: 0.5 d
- **Owner**: Frontend lead
- **BlockedBy**: none

### T-LR.0.3 — Implement `scripts/check-orphans.ts`
- **Description**: Walk the dependency graph starting from `frontend/src/main.tsx` and `backend/app/main.py`. Anything not reachable is flagged.
- **Acceptance**: orphan list printed; CI step warn-only.
- **Effort**: 1 d
- **Owner**: Frontend lead
- **BlockedBy**: none

### T-LR.0.4 — Implement `scripts/verify-aliases.ts`
- **Description**: Parse `tsconfig.json` paths and `vite.config.ts` resolve.alias; assert byte-identical.
- **Acceptance**: drift produces a unified diff exit-1; matching set exits 0.
- **Effort**: 0.5 d
- **Owner**: Frontend lead
- **BlockedBy**: none

### T-LR.0.5 — Implement `scripts/detect-truncation.ts`
- **Description**: For every changed file in the PR, parse with `@babel/parser` (or Python's `ast.parse` for `.py`); exit non-zero on parse failure.
- **Acceptance**: a deliberately-truncated test file is rejected; a normal file passes.
- **Effort**: 0.5 d
- **Owner**: Frontend lead
- **BlockedBy**: none

### T-LR.0.6 — Implement `scripts/codemod-relative-to-alias.ts`
- **Description**: Codemod that rewrites `../../` and deeper to `@/` form. Idempotent. Includes a `--dry-run`.
- **Acceptance**: a `git diff` on a sample directory shows only the expected rewrite; the project still typechecks after.
- **Effort**: 1 d
- **Owner**: Frontend lead
- **BlockedBy**: T-LR.0.4

### T-LR.0.7 — Author `frontend/src/data/quickCreateRegistry.contract.test.ts`
- **Description**: For each entity in the registry, assert: required fields are present, `apiCreate` is a function, the registry's expected return shape matches `SelectWithQuickCreate` consumer.
- **Acceptance**: test file exists with one `it()` per registered entity (13 entries); test fails on any drift.
- **Effort**: 1 d
- **Owner**: Frontend lead
- **BlockedBy**: T-LR.0.1

### T-LR.0.8 — Wire CI `definitive build` workflow
- **Description**: Add `.github/workflows/ci.yml` job that runs `npm ci → typecheck → lint → test → build → orphan check → alias check → truncation check` on every PR. Initially warn-only on the type/orphan/alias steps until baselines stabilize.
- **Acceptance**: PR shows green checks; manually breaking a step turns the corresponding check red.
- **Effort**: 0.5 d
- **Owner**: Platform
- **BlockedBy**: T-LR.0.3, T-LR.0.4, T-LR.0.5

### T-LR.0.9 — Author `frontend/src/_double-mount-audit.md`
- **Description**: Enumerate every component/hook in the codebase that has React 19 double-mount risk; document mitigation.
- **Acceptance**: file exists; lists at least the 12 candidates from the design doc.
- **Effort**: 1 d
- **Owner**: Frontend lead
- **BlockedBy**: none

### T-LR.0.10 — Drive typecheck baseline to zero
- **Description**: Iteratively fix typecheck errors using the recipes in `docs/dev/typecheck-recipes.md`. Convert the CI step from warn-only to blocking once at zero.
- **Acceptance**: `npx tsc --noEmit` exits 0 on `main`; CI gate blocking.
- **Effort**: 1.5 d
- **Owner**: Frontend lead + Safa
- **BlockedBy**: T-LR.0.1, T-LR.0.7

---

## Phase R1 — Backend Quick-Create Endpoints (Weeks 1–3)

Each endpoint task includes: schema + service + route + 5 integration tests + OpenAPI tag + permission addition.

### T-LR.1.1 — Cross-cutting idempotency helper
- **Description**: Implement `app/deps/idempotency.py` with Firestore-backed `(tenant_id, key, route) → response` cache, 24h TTL.
- **Acceptance**: unit test asserts replay returns the same body and sets `X-Idempotent-Replay: true`.
- **Effort**: 1 d
- **Owner**: Backend lead
- **BlockedBy**: none

### T-LR.1.2 — Cross-cutting per-tenant rate limiter
- **Description**: Wrap slowapi with Redis-backed per-tenant key; expose `per_tenant_limiter(rate)` dependency.
- **Acceptance**: 61st request in a minute returns 429; counter resets after the minute window.
- **Effort**: 0.5 d
- **Owner**: Backend lead
- **BlockedBy**: none

### T-LR.1.3 — Harden `POST /api/contacts`
- **Description**: Audit current endpoint, relax over-strict required fields, add normalization for Iraqi phone numbers, ensure idempotency hook present.
- **Acceptance**: integration tests T1–T5 pass; the registry's customer quick-create works end-to-end.
- **Effort**: 0.5 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.1.1, T-LR.1.2

### T-LR.1.4 — Harden `POST /api/items`
- **Description**: Audit; add SKU auto-generation; ensure flexible tax_rate/account FK validation (treat missing FK as null, not 422).
- **Acceptance**: integration tests pass; the registry's item quick-create works end-to-end.
- **Effort**: 0.5 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.1.1, T-LR.1.2

### T-LR.1.5 — Unify `POST /api/taxes`
- **Description**: Canonicalize on `/api/taxes`; add `/api/taxes/rates` deprecated alias; update OpenAPI tags.
- **Acceptance**: both paths return 201 on a valid body; deprecated path logs a deprecation warning header.
- **Effort**: 0.5 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.1.1, T-LR.1.2

### T-LR.1.6 — Harden `POST /api/accounts`
- **Description**: Add auto-code generation per Iraq 5-digit convention; validate parent → child type consistency.
- **Acceptance**: missing `code` is auto-filled; invalid parent type triggers 422.
- **Effort**: 1 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.1.1

### T-LR.1.7 — Build `POST /api/expense-categories`
- **Description**: New schema + service + route + tests per design §2.6.
- **Acceptance**: 5 integration tests green; OpenAPI updated.
- **Effort**: 0.75 d
- **Owner**: Backend dev B
- **BlockedBy**: T-LR.1.1, T-LR.1.2

### T-LR.1.8 — Build `POST /api/equipment-categories`
- **Description**: New schema + service + route + tests per design §2.7; cycle detection in parent_id.
- **Acceptance**: 5 integration tests + cycle-detection test green.
- **Effort**: 0.75 d
- **Owner**: Backend dev B
- **BlockedBy**: T-LR.1.1, T-LR.1.2

### T-LR.1.9 — Build `POST /api/subscription-plans`
- **Description**: New schema + service + route + tests per design §2.8.
- **Acceptance**: 5 integration tests green; currency validated via ISO-4217 enum.
- **Effort**: 0.75 d
- **Owner**: Backend dev B
- **BlockedBy**: T-LR.1.1, T-LR.1.2

### T-LR.1.10 — Build `POST /api/locations`
- **Description**: New schema + service + route + tests per design §2.9; transactional default-flip behavior.
- **Acceptance**: 5 tests + default-flip transaction test green.
- **Effort**: 1 d
- **Owner**: Backend dev B
- **BlockedBy**: T-LR.1.1, T-LR.1.2

### T-LR.1.11 — Build `POST /api/teams`
- **Description**: New schema + service + route + tests per design §2.10.
- **Acceptance**: 5 tests green.
- **Effort**: 0.5 d
- **Owner**: Backend dev B
- **BlockedBy**: T-LR.1.1, T-LR.1.2

### T-LR.1.12 — Unify `POST /api/bank-accounts`
- **Description**: Resolve drift with `/api/banking/accounts`; add IBAN + SWIFT validation; mask account_number on read.
- **Acceptance**: 5 tests green; reading a created record returns masked account_number.
- **Effort**: 1 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.1.1, T-LR.1.6

### T-LR.1.13 — Build `POST /api/currencies`
- **Description**: New schema + service + route + tests per design §2.12; idempotent upsert keyed by uppercased code.
- **Acceptance**: 5 tests + idempotent-re-add returns 200 with existing.
- **Effort**: 0.75 d
- **Owner**: Backend dev B
- **BlockedBy**: T-LR.1.1, T-LR.1.2

### T-LR.1.14 — Build `POST /api/tags`, `POST /api/payment-methods`
- **Description**: New per design §§2.13, 2.14. Tags return 200 on `(scope, name)` collision. Payment-methods response indicates `requires_gateway_config`.
- **Acceptance**: 10 tests (5 per endpoint) green; gateway-config flag tested with and without configured gateway.
- **Effort**: 1.5 d
- **Owner**: Backend dev B
- **BlockedBy**: T-LR.1.1, T-LR.1.2

---

## Phase R2 — Staging Environment (Weeks 2–3)

### T-LR.2.1 — Provision `zoho-staging` GCP project
- **Description**: Per design §3.1. Enable APIs, set IAM, configure billing.
- **Acceptance**: `gcloud config list account` shows access; `gcloud services list --project=zoho-staging` shows the required APIs enabled.
- **Effort**: 0.5 d
- **Owner**: Safa + platform
- **BlockedBy**: none

### T-LR.2.2 — Provision staging Firestore, Memorystore, Secret Manager
- **Description**: Firestore Native me-central1; Redis 1GB BASIC; populate `STAGING_*` secrets.
- **Acceptance**: Cloud Run can connect to both; secrets retrievable via `gcloud secrets versions access`.
- **Effort**: 1 d
- **Owner**: Platform
- **BlockedBy**: T-LR.2.1

### T-LR.2.3 — Configure Vercel staging environment
- **Description**: New `staging` Vercel environment; env vars; map `staging` branch.
- **Acceptance**: push to `staging` branch triggers a staging deploy that resolves to the staging API URL.
- **Effort**: 0.5 d
- **Owner**: Safa
- **BlockedBy**: T-LR.2.1

### T-LR.2.4 — DNS for `staging.erp.zoho.kurd.iq` and `api.staging.erp.zoho.kurd.iq`
- **Description**: Cloudflare records; verify TLS.
- **Acceptance**: both URLs return 200 with valid certs.
- **Effort**: 0.25 d
- **Owner**: Safa
- **BlockedBy**: T-LR.2.3

### T-LR.2.5 — Build synthetic-tenant seeder `app/tools/seed_staging.py`
- **Description**: Per design §3.4. Idempotent with `--reset`.
- **Acceptance**: running the command produces the seeded tenant; re-running with `--reset` resets it.
- **Effort**: 1.5 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.2.2

### T-LR.2.6 — Add `EnvironmentBadge.tsx` staging banner behavior
- **Description**: Read `VITE_ENV`; render the staging banner on staging only; cannot be dismissed.
- **Acceptance**: staging shows the banner; production does not.
- **Effort**: 0.25 d
- **Owner**: Frontend lead
- **BlockedBy**: T-LR.2.3

### T-LR.2.7 — `staging-smoke` GitHub Actions workflow
- **Description**: Per design §3.6.
- **Acceptance**: push to `main` triggers staging deploy + smoke; smoke result is reflected as a required check on the prod deploy workflow.
- **Effort**: 1 d
- **Owner**: Platform
- **BlockedBy**: T-LR.2.2, T-LR.2.5

### T-LR.2.8 — Monthly reset cron
- **Description**: Cloud Scheduler hits a Cloud Run Job that resets synthetic tenants on the 1st.
- **Acceptance**: triggering the job manually re-seeds the tenant; scheduler shows next-run time.
- **Effort**: 0.5 d
- **Owner**: Platform
- **BlockedBy**: T-LR.2.5

---

## Phase R3 — Onboarding Wizard (Weeks 3–5)

### T-LR.3.1 — Wizard state machine + Zustand store
- **Description**: `frontend/src/onboarding/state.ts` per design §4.1.
- **Acceptance**: unit tests for every transition; resume-from-state test.
- **Effort**: 1 d
- **Owner**: Frontend dev A
- **BlockedBy**: none

### T-LR.3.2 — `<OnboardingShell>` + header + footer + progress bar
- **Description**: Skeleton + animation primitives.
- **Acceptance**: Storybook story shows all 5 steps with mocked content.
- **Effort**: 1 d
- **Owner**: Frontend dev A
- **BlockedBy**: T-LR.3.1

### T-LR.3.3 — `<StepCompanyInfo>` form + validation
- **Description**: Per design §4.3.
- **Acceptance**: submitting a valid form writes to `tenants/{id}/profile`; invalid fields stay inline; i18n keys present.
- **Effort**: 1 d
- **Owner**: Frontend dev A
- **BlockedBy**: T-LR.3.2

### T-LR.3.4 — `<StepIraqRegion>` SVG map + region preset selection
- **Description**: Per design §4.4. Inline SVG of Iraq, governorate paths clickable.
- **Acceptance**: hover/focus highlights each governorate; selecting writes the preset to state; preview pane lists tax rates.
- **Effort**: 1.5 d
- **Owner**: Frontend dev A
- **BlockedBy**: T-LR.3.2, T-LR.3.11

### T-LR.3.5 — Iraq region preset data table
- **Description**: Author `frontend/src/data/iraqRegionPresets.ts` with all 18 governorates, with placeholders explicitly marked where the regulator-confirmed rate is pending.
- **Acceptance**: all 18 keys exist; each has at least `label_*` fields and an explicit `tax_rates` array (possibly empty + a `placeholder: true` flag).
- **Effort**: 1 d
- **Owner**: Backend dev B (in collaboration with a tax accountant later)
- **BlockedBy**: none

### T-LR.3.6 — Author Chart of Accounts YAML templates
- **Description**: `backend/app/data/coa_templates/*.yaml` (5 files) per design §4.5.
- **Acceptance**: each file parses; `is_default_for` markers cover all required GL functions.
- **Effort**: 2 d
- **Owner**: Backend dev A + a junior accountant reviewer
- **BlockedBy**: none

### T-LR.3.7 — `POST /api/onboarding/coa/apply` endpoint
- **Description**: Reads the chosen YAML, bulk-creates accounts in a transaction, wires `default_accounts` on tenant profile.
- **Acceptance**: applying a template to a synthetic tenant produces the right account count and default mappings.
- **Effort**: 1 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.3.6

### T-LR.3.8 — `<StepChartOfAccounts>` template picker + preview
- **Description**: Per design §4.5. Render 5 template cards; clicking shows preview; "Apply" calls the new endpoint.
- **Acceptance**: applying redirects to step 4 with the GL accounts visible in a "Verify" panel.
- **Effort**: 1.5 d
- **Owner**: Frontend dev A
- **BlockedBy**: T-LR.3.2, T-LR.3.7

### T-LR.3.9 — `<StepPOSHardware>` Web Bluetooth pairing
- **Description**: Per design §4.6.
- **Acceptance**: pairing a known test printer prints a test receipt; user can confirm Yes/No/Retry.
- **Effort**: 1.5 d
- **Owner**: Frontend dev A + a hardware test (Safa with a printer)
- **BlockedBy**: T-LR.3.2

### T-LR.3.10 — `<StepFirstSale>` guided overlay
- **Description**: Per design §4.7. Mini-step A, B, C.
- **Acceptance**: on completion, an Invoice document and a POS sale document exist; GL entries balance; user lands on `/dashboard?welcome=true`.
- **Effort**: 1.5 d
- **Owner**: Frontend dev A
- **BlockedBy**: T-LR.3.2

### T-LR.3.11 — Wizard onboarding state persistence endpoint
- **Description**: `GET /api/onboarding/state` + `PUT /api/onboarding/state` per design §4.1.
- **Acceptance**: wizard mounting after a reload resumes at the last completed step.
- **Effort**: 0.5 d
- **Owner**: Backend dev B
- **BlockedBy**: none

### T-LR.3.12 — Telemetry hooks for wizard events
- **Description**: Emit per requirements §R4.9 to the RUM endpoint.
- **Acceptance**: BigQuery shows `onboarding.*` events with attributes.
- **Effort**: 0.5 d
- **Owner**: Frontend dev A
- **BlockedBy**: T-LR.3.1

### T-LR.3.13 — Full Kurdish + Arabic + English translations for wizard
- **Description**: All UI strings keyed under `onboarding.*`.
- **Acceptance**: switching language renders correctly in all 5 steps; Playwright RTL snapshots green.
- **Effort**: 1 d (excluding actual translation calendar time for Arabic).
- **Owner**: Frontend dev A + translator
- **BlockedBy**: T-LR.3.10

### T-LR.3.14 — Wizard accessibility audit
- **Description**: axe-core pass; manual keyboard walkthrough.
- **Acceptance**: zero serious/critical violations; keyboard-only user can complete the wizard.
- **Effort**: 0.5 d
- **Owner**: QA
- **BlockedBy**: T-LR.3.13

---

## Phase R4 — Tenant-Side Payments (Weeks 4–7)

### T-LR.4.1 — `PaymentGateway` interface + registry
- **Description**: `backend/app/payments/gateway.py`, `registry.py`.
- **Acceptance**: registry lookup returns the correct class per provider code; unit tests for the interface contract.
- **Effort**: 0.5 d
- **Owner**: Backend lead
- **BlockedBy**: none

### T-LR.4.2 — `CashGateway` implementation
- **Description**: Degenerate adapter; no external call.
- **Acceptance**: unit tests on create/confirm/refund all succeed locally.
- **Effort**: 0.25 d
- **Owner**: Backend lead
- **BlockedBy**: T-LR.4.1

### T-LR.4.3 — `CODGateway` implementation + state machine
- **Description**: pending_delivery → delivered → settled.
- **Acceptance**: state transitions test; courier confirmation endpoint exists.
- **Effort**: 1 d
- **Owner**: Backend lead
- **BlockedBy**: T-LR.4.1

### T-LR.4.4 — `FastPayGateway` adapter (sandbox)
- **Description**: OAuth + create intent + webhook verify per design §5.2.
- **Acceptance**: a sandbox test transaction (manual QR scan or simulated) completes end-to-end; webhook posted to our staging endpoint is verified and handled.
- **Effort**: 2 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.4.1, T-LR.7.2 (FastPay sandbox credentials)

### T-LR.4.5 — `QiCardGateway` adapter (sandbox)
- **Description**: Hosted page flow per design §5.3.
- **Acceptance**: a sandbox test transaction completes; webhook signature verified.
- **Effort**: 2 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.4.1, T-LR.7.3 (Qi sandbox)

### T-LR.4.6 — `ZainCashGateway` adapter (sandbox)
- **Description**: OTP flow per design §5.4.
- **Acceptance**: sandbox transaction completes if sandbox is accessible; otherwise task is marked **deferred** and tracked under R7.4.
- **Effort**: 1.5 d (subject to docs availability)
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.4.1, T-LR.7.4

### T-LR.4.7 — `AsiaPayGateway` adapter (deferred to post-launch unless needed)
- **Description**: Token-on-file model.
- **Acceptance**: deferred — no acceptance unless launch tenant requires Asia Pay.
- **Effort**: 1.5 d (when activated)
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.4.1, T-LR.7.5

### T-LR.4.8 — `StripeGateway` (tenant-side) adapter
- **Description**: Standard payment intent flow for international card payments.
- **Acceptance**: a test payment via Stripe test cards completes; webhook handled.
- **Effort**: 1 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.4.1

### T-LR.4.9 — Provider webhook ingress + signature verification
- **Description**: `POST /api/payments/webhooks/<provider>` per design §5.7. Dedup table; <5s response.
- **Acceptance**: contract test per provider; deliberate signature mismatch returns 400.
- **Effort**: 1 d
- **Owner**: Backend lead
- **BlockedBy**: T-LR.4.1

### T-LR.4.10 — `Payment` aggregate Firestore model + indices
- **Description**: Document shape per requirements §R5.A.4; composite indices for `(tenant_id, status, created_at)` and `(tenant_id, provider, provider_charge_id)`.
- **Acceptance**: indices deployed; queries return in p95 < 200ms.
- **Effort**: 0.5 d
- **Owner**: Backend lead
- **BlockedBy**: T-LR.4.1

### T-LR.4.11 — Refund endpoint + GL reversal
- **Description**: `POST /api/payments/{id}/refund`. Calls provider; on success creates Refund doc + GL reversal.
- **Acceptance**: full refund and partial refund tested for at least 2 providers (Cash, Stripe).
- **Effort**: 1.5 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.4.10

### T-LR.4.12 — Reconciliation nightly job per provider
- **Description**: Per design §5.8. Cloud Run Job, one per provider.
- **Acceptance**: a simulated mismatch produces a reconciliation queue entry visible in the UI.
- **Effort**: 2 d
- **Owner**: Backend dev A
- **BlockedBy**: T-LR.4.10

### T-LR.4.13 — Tenant-side Settings UI: Providers
- **Description**: `frontend/src/pages/settings/payments/Providers.tsx`.
- **Acceptance**: tenant can enable/disable any provider; the corresponding payment methods become visible/hidden in POS.
- **Effort**: 1 d
- **Owner**: Frontend dev B
- **BlockedBy**: T-LR.4.1

### T-LR.4.14 — Tenant-side Settings UI: Reconciliation queue
- **Description**: `ReconciliationQueue.tsx` per design §A.
- **Acceptance**: queue entries listed with actions; resolving an entry updates the Payment + clears the queue item.
- **Effort**: 1 d
- **Owner**: Frontend dev B
- **BlockedBy**: T-LR.4.12

### T-LR.4.15 — POS payment-method picker + provider-specific UIs
- **Description**: `PaymentMethodPicker.tsx`; QR code render for FastPay/Zain Cash; cash numpad; hosted-page redirect for Qi/Stripe.
- **Acceptance**: each provider's happy path runs end-to-end in staging.
- **Effort**: 2 d
- **Owner**: Frontend dev B
- **BlockedBy**: T-LR.4.4, T-LR.4.5, T-LR.4.6, T-LR.4.8

### T-LR.4.16 — Hosted payment link for invoices
- **Description**: `POST /api/invoices/{id}/pay-link` generates a tenant-branded URL; the page accepts the user's choice of provider.
- **Acceptance**: a customer with the link can pay an invoice with any enabled provider.
- **Effort**: 1.5 d
- **Owner**: Backend + Frontend dev B
- **BlockedBy**: T-LR.4.15

---

## Phase R5 — SaaS Subscription Billing (Weeks 6–8)

### T-LR.5.1 — Plans defined in code + Stripe bootstrap script
- **Description**: `backend/app/billing/plans.py` + `scripts/bootstrap-stripe.ts` creates the prices in Stripe.
- **Acceptance**: running the script in test mode creates 3 Stripe prices; re-running is idempotent.
- **Effort**: 0.5 d
- **Owner**: Backend lead
- **BlockedBy**: none

### T-LR.5.2 — Stripe Subscriptions integration for international tenants
- **Description**: `backend/app/billing/stripe.py` per design §5.13.
- **Acceptance**: signing up with a US billing address routes to Stripe; the subscription is created.
- **Effort**: 1.5 d
- **Owner**: Backend lead
- **BlockedBy**: T-LR.5.1

### T-LR.5.3 — Iraqi tenant billing rail (FastPay business or manual invoice)
- **Description**: `backend/app/billing/fastpay_recurring.py` — if FastPay business supports recurring, use it; else fall back to monthly invoice + manual confirmation with 7-day grace.
- **Acceptance**: a synthetic Iraqi tenant receives a billing notice; manual mark-as-paid transitions to `active`.
- **Effort**: 1.5 d (depends on FastPay sandbox)
- **Owner**: Backend lead
- **BlockedBy**: T-LR.4.4, T-LR.7.2

### T-LR.5.4 — Stripe webhook ingress
- **Description**: `POST /api/saas-billing/webhooks/stripe` handling the events from requirements §R5.B.9.
- **Acceptance**: simulated Stripe events update tenant `billing.status` correctly.
- **Effort**: 1 d
- **Owner**: Backend lead
- **BlockedBy**: T-LR.5.2

### T-LR.5.5 — Dunning sequence engine
- **Description**: APScheduler or Cloud Tasks-driven sequence per requirements §R5.B.7 + design §5.10.
- **Acceptance**: a synthetic failure walks through day-0/3/7/14/30 states with notifications emitted.
- **Effort**: 1.5 d
- **Owner**: Backend lead
- **BlockedBy**: T-LR.5.4

### T-LR.5.6 — Tenant Admin → Billing UI
- **Description**: `frontend/src/pages/billing/TenantBilling.tsx` per requirements §R5.B.6.
- **Acceptance**: page renders in 3 locales; "Change plan" CTA triggers the Stripe Portal or our equivalent.
- **Effort**: 1 d
- **Owner**: Frontend dev B
- **BlockedBy**: T-LR.5.2

### T-LR.5.7 — Super-Admin billing dashboard view
- **Description**: Extend `super-admin-console` with MRR / churn / past_due / frozen views.
- **Acceptance**: numbers match a hand-computed sample from the synthetic data set.
- **Effort**: 1 d
- **Owner**: Frontend dev B
- **BlockedBy**: T-LR.5.5

### T-LR.5.8 — Free-trial enforcement (90-day Iraqi tenants)
- **Description**: `billing.trial_ends_at` set at tenant creation; same-email reuse blocked.
- **Acceptance**: a second sign-up by the same email is detected and offered the paid path immediately.
- **Effort**: 0.5 d
- **Owner**: Backend lead
- **BlockedBy**: T-LR.5.1

### T-LR.5.9 — Public pricing page `/pricing`
- **Description**: Plan comparison; IQD + USD; locale-aware.
- **Acceptance**: renders correctly in 3 locales; correct geo-detected default plan suggestion.
- **Effort**: 1 d
- **Owner**: Frontend dev B
- **BlockedBy**: T-LR.5.1

---

## Phase R6 — Cross-cutting Tasks

### T-LR.6.1 — Translation pass (Kurdish baseline)
- **Description**: Verify Kurdish copy for wizard, billing, payments.
- **Acceptance**: reviewer signs off; no untranslated strings.
- **Effort**: 1 d
- **Owner**: Safa or assigned native reviewer
- **BlockedBy**: T-LR.3.13, T-LR.5.6

### T-LR.6.2 — Translation pass (Arabic catch-up)
- **Description**: Drive Arabic to 100% for the wizard + billing + payment UIs. Other modules out of scope.
- **Acceptance**: i18n coverage gate green on the affected namespaces.
- **Effort**: ~5 calendar days (small daily slice).
- **Owner**: Translator + Safa
- **BlockedBy**: T-LR.3.13, T-LR.5.6

### T-LR.6.3 — Runbook: tenant onboarding troubleshooting
- **Description**: `docs/runbooks/onboarding-troubleshooting.md` covering: wizard stuck, COA already applied conflict, printer pairing failure.
- **Acceptance**: file exists; rehearsed once on a synthetic tenant.
- **Effort**: 0.5 d
- **Owner**: Safa
- **BlockedBy**: T-LR.3.10

### T-LR.6.4 — Runbook: payment reconciliation
- **Description**: `docs/runbooks/payment-reconciliation.md` per provider.
- **Acceptance**: file exists; covers happy path and a worked example for each provider.
- **Effort**: 0.5 d
- **Owner**: Backend lead
- **BlockedBy**: T-LR.4.12

### T-LR.6.5 — Runbook: SaaS dunning
- **Description**: `docs/runbooks/saas-dunning.md`; what to do when a tenant disputes a charge or asks for a grace extension.
- **Acceptance**: file exists.
- **Effort**: 0.25 d
- **Owner**: Safa
- **BlockedBy**: T-LR.5.5

### T-LR.6.6 — Developer guide: typecheck recipes
- **Description**: `docs/dev/typecheck-recipes.md` per design §1.4.
- **Acceptance**: file exists with the 20 entries.
- **Effort**: 0.5 d
- **Owner**: Frontend lead
- **BlockedBy**: T-LR.0.10

### T-LR.6.7 — Architecture Decision Records
- **Description**: Write the 10 ADRs from design §6 into `docs/adr/`.
- **Acceptance**: 10 files, each ~ 1 page.
- **Effort**: 1 d
- **Owner**: Safa
- **BlockedBy**: none

---

## Phase R7 — Open Questions / Decision Tasks

These are not implementation tasks; they are unresolved external dependencies that the spec records explicitly. Each has an Owner who pursues the answer.

### T-LR.7.1 — Verify Iraq tax rates per governorate with a Kurdish/Iraqi tax accountant
- **Question**: What are the correct sales tax, hospitality tax, telecom tax, alcohol/tobacco rates per governorate in 2026?
- **Why blocks**: wizard Step 2 ships placeholders until verified.
- **Owner**: Safa
- **Target**: Week 2

### T-LR.7.2 — FastPay business sandbox credentials + recurring availability
- **Question**: Confirm sandbox URL, OAuth credentials process, and whether merchant-initiated recurring is supported.
- **Why blocks**: FastPay adapter (T-LR.4.4) and Iraqi SaaS billing rail (T-LR.5.3).
- **Owner**: Safa
- **Target**: Week 1

### T-LR.7.3 — Qi Card business API access
- **Question**: Confirm sandbox URL, application process, KYC requirements, settlement timing.
- **Why blocks**: Qi Card adapter (T-LR.4.5).
- **Owner**: Safa
- **Target**: Week 2

### T-LR.7.4 — Zain Cash merchant API documentation
- **Question**: Is there a public sandbox? What is the OTP/webhook contract?
- **Why blocks**: Zain Cash adapter (T-LR.4.6).
- **Owner**: Safa
- **Target**: Week 3

### T-LR.7.5 — Asia Pay / Asia Hawala API
- **Question**: Is a v1 integration needed for launch?
- **Why blocks**: defers T-LR.4.7 until decided.
- **Owner**: Safa
- **Target**: Week 4

### T-LR.7.6 — E-Fakhata (Iraq E-Invoice) schema version
- **Question**: Confirm the regulator's current XML schema version; identify whether v1 launch tenant is in-scope.
- **Why blocks**: not strictly launch-blocking unless tenant is VAT-registered above threshold.
- **Owner**: Safa
- **Target**: Week 4

### T-LR.7.7 — Stripe Atlas vs direct US entity for SaaS billing
- **Question**: What is the legal entity Stripe is paid into? Iraq-resident sole proprietorship is not supported by Stripe; we need a US/UK/Delaware C-corp or equivalent.
- **Why blocks**: SaaS billing T-LR.5.2.
- **Owner**: Safa + legal
- **Target**: Week 2

### T-LR.7.8 — Iraqi POS thermal printer compatibility list
- **Question**: Which models are most common in Iraqi markets (Xprinter, Epson TM-T20, Bixolon)? Compatible with Web Bluetooth?
- **Why blocks**: Step 4 hardware pairing UX assumptions.
- **Owner**: Safa
- **Target**: Week 3

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| RR-1 | `tsc --noEmit` baseline turns out > 500 errors | High | High | Time-box T-LR.0.10 to 3 days; if baseline > 300, ratchet downward over 2 weeks, not 1 |
| RR-2 | Vite v8 / vite-plugin-pwa v1.3 break on Windows | Medium | High | Pin known-good versions; document fallback to PWA-via-Workbox-CLI |
| RR-3 | One or more Iraqi payment providers do not have an accessible sandbox | Medium | High | Stripe + Cash + COD must be functional regardless; gateway abstraction is provider-pluggable |
| RR-4 | FastPay business does not support recurring | Medium | Medium | Fall back to invoice + manual confirmation for Iraqi SaaS billing |
| RR-5 | Qi Card business onboarding takes > 4 weeks | Medium | Medium | Launch with FastPay + Cash + COD; add Qi post-launch |
| RR-6 | Tax rate verification with accountant delays Step 2 | Low | Medium | Ship Step 2 with placeholders + visible "verify before going live" banner per region |
| RR-7 | Synthetic seeder for staging produces data that diverges from real tenants over time | Low | Low | Re-bench monthly; update seeder when prod schema changes |
| RR-8 | Stripe Tax for international tenants triggers unforeseen VAT registration obligation | Medium | High | Legal review T-LR.7.7 includes Stripe Tax scope confirmation |
| RR-9 | Web Bluetooth is unreliable on Android tablets at the counter | Medium | Medium | Fall back to USB / serial via a small Cordova plugin in mobile build; document workaround |
| RR-10 | First customer abandons at Step 3 (COA template feels overwhelming) | Medium | Medium | Default to Small General Trade; offer Skip with safe defaults |
| RR-11 | Production deploy goes out without staging-smoke green check accidentally | Low | High | The required-check is set at GitHub branch-protection level; cannot be bypassed |
| RR-12 | Onboarding wizard takes > 5 min for new users despite design budget | Medium | Medium | Watch telemetry T-LR.3.12 for the first 50 tenants; iterate on bottleneck step |
| RR-13 | Iraqi PDPL is ratified between now and launch with breaking obligations | Low | High | Architecture already targets GDPR equivalence; one-week sprint reserved if needed |
| RR-14 | Stripe entity-formation delay blocks SaaS billing collection | Medium | High | Launch with Iraqi-only customers first; international takes a month later |
| RR-15 | Translation calendar slips for Arabic | Medium | Medium | Wizard + billing + payments are tightly scoped; the rest of the app can lag |

---

## Success Metrics

By end of Week 8, the following SHALL be true on staging or production where indicated:

| Metric | Target | Measured where |
|--------|--------|----------------|
| `npx tsc --noEmit` errors on `main` | 0 | CI |
| Backend test pass rate | 100% | CI |
| Quick-create endpoints implemented + tested | 13/13 | OpenAPI + tests |
| Orphan-file count | 0 | CI |
| Staging deploy time (push → URL ready) | ≤ 8 min | GitHub Actions |
| Wizard completion rate (synthetic tests) | 5/5 fresh tenants | Manual + Playwright |
| Median wizard time-to-completion (synthetic) | ≤ 90 s | Telemetry replay |
| Webhook signature verification | 100% | Integration tests |
| Payment intent → succeeded (sandbox) | ≥ 99% across providers | E2E |
| SaaS billing dunning steps run | 5/5 transitions | Synthetic test |
| Localization coverage (wizard + billing + payments) | 100% in ku/ar/en | i18n CI gate |
| First real paying customer | 1 | Operations |
| First real SaaS subscription invoice paid | 1 | Stripe / FastPay |

When all of those are green AND the acceptance checklist in `requirements.md` § Acceptance is green, this spec is closed.

---

## Dependencies on other specs

- `world-class-performance` — its R0/R1 phases (PWA + service worker, persistent React Query cache) are upstream of our wizard's offline tolerance.
- `empty-state-quick-create` — its `<SelectWithQuickCreate>` is the consumer for the registry that our R1 endpoints serve.
- `super-admin-console` — its dashboard shell is extended in T-LR.5.7.
- `phase-4-pos-iraq` — its POS receipt primitives are reused in T-LR.3.9 and T-LR.4.15.
- `data-integrity-wave` — its tenant-scoping enforcement is the foundation our payment + billing data leans on.

If those specs slip, the slippage cascades here. Treat them as upstream dependencies and notify the relevant owners on every standup.
