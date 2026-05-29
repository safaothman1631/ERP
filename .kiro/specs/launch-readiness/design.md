# Design Document: Launch Readiness — The Five Blockers

> **Spec ID:** `launch-readiness`
> **Document:** design
> **Status:** Draft v1.0
> **Owner:** Safa Othman
> **Companion to:** `requirements.md`

---

## Introduction

This document describes **how** we will satisfy the five launch-blocking requirements in `requirements.md`. It is opinionated, specific, and grounded in the actual repository at `C:\Users\SAFA\zoho`. Every file path, library version, ID format, and provider endpoint mentioned here is intended to be directly actionable.

The design proceeds in six sections matching the spec's structure plus a decisions/trade-offs section:

1. TypeScript Health Strategy
2. Backend Endpoint Scaffolding
3. Staging Architecture
4. Onboarding Wizard
5. Dual Payment System
6. Decisions and Trade-offs (ADR-style)

---

## High-level architecture

```
                                  ┌────────────────────────────────┐
                                  │   Vercel (frontend hosting)    │
                                  │  prod ────► erp.zoho.kurd.iq   │
                                  │  staging  ► staging.erp.zoho…  │
                                  │  preview ► auto per-PR URL     │
                                  └────────────┬───────────────────┘
                                               │ HTTPS, content-hashed JS/CSS
                                               ▼
   ┌────────────────────────────┐   ┌──────────────────────────────────┐
   │  GCP project zoho-prod     │   │   GCP project zoho-staging       │
   │                            │   │                                  │
   │  Cloud Run (FastAPI)       │   │  Cloud Run (FastAPI, lower tier) │
   │  Firestore (prod data)     │   │  Firestore (synthetic tenants)   │
   │  Memorystore (Redis)       │   │  Memorystore (Redis, 1GB BASIC)  │
   │  Secret Manager (prod)     │   │  Secret Manager (sandbox keys)   │
   │  Cloud Trace + Logging     │   │  Cloud Trace + Logging           │
   └────────────┬───────────────┘   └────────────┬─────────────────────┘
                │                                │
                ▼                                ▼
   ┌────────────────────────────┐   ┌──────────────────────────────────┐
   │  External integrations     │   │  External integrations (sandbox) │
   │                            │   │                                  │
   │  Stripe Live               │   │  Stripe Test                     │
   │  FastPay Production        │   │  FastPay Sandbox                 │
   │  Qi Card Production        │   │  Qi Card Sandbox                 │
   │  Zain Cash Production      │   │  Zain Cash Sandbox               │
   │  Asia Pay Production       │   │  Asia Pay Sandbox                │
   │  E-Fakhata production      │   │  E-Fakhata test                  │
   └────────────────────────────┘   └──────────────────────────────────┘
```

CI runs in GitHub Actions and gates: PR → preview deploy → preview-smoke → reviewer approve → merge to `main` → staging deploy → staging-smoke (required) → production deploy.

---

## Section 1 — TypeScript Health Strategy

The first blocker is not a missing feature; it is the gap between "we wrote 130+ files" and "the application compiles." This section makes that gap visible and gated.

### 1.1 — `tsc --noEmit` as a CI gate

Today the build relies on Vite's loose TypeScript handling. Vite forgives many TypeScript errors that `tsc --noEmit` rejects. We will adopt the stricter compiler as the source of truth.

Concrete steps:

- Add `"typecheck": "tsc --noEmit"` to `frontend/package.json`.
- Add a GitHub Actions step `Frontend typecheck` to `.github/workflows/ci.yml` that runs `npm run typecheck` in `frontend/` and fails the job on non-zero exit.
- The first run will produce many errors. Capture the count in `_deltas/tsc-baseline.txt` and ratchet downward; PRs that increase the count fail.
- We do NOT enable `"strict": true` immediately. We turn on the existing config and treat the first stable green run as our baseline. Strict-mode is a separate ratchet.

### 1.2 — Pre-commit hook

Husky + lint-staged are present. We tighten them.

```jsonc
// frontend/package.json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --max-warnings 0 --fix",
    "tsc-files --noEmit"
  ],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

`tsc-files` runs the compiler on the changed file set, which is fast enough for the median commit. A full project typecheck still happens in CI.

The hook also runs `scripts/detect-truncation.ts` per R1.8 — a tiny Node script that opens each staged file and checks for: empty trailing line, balanced `{}` `[]` `()` in JS/TS contexts, no unterminated template literals, no unclosed JSX fragments. The heuristic is conservative; false positives are acceptable, false negatives are not.

### 1.3 — Path alias verification

The `@/` alias is configured in `frontend/tsconfig.json` and `frontend/vite.config.ts`. Drift between the two has caused production runtime errors before (Vite resolves but tsc doesn't, or vice versa).

We add `scripts/verify-aliases.ts` that:

1. Parses `tsconfig.json` `compilerOptions.paths`.
2. Parses `vite.config.ts` `resolve.alias` via a small AST walk (or evaluation in a sandbox).
3. Asserts the two sets are byte-identical (same keys, same target paths after normalization).
4. Exits non-zero with a diff if not.

Run as a CI step.

### 1.4 — Top-20 expected error recipes

We pre-document the fixes most likely to be needed when devs first run `npm run typecheck` after the 130-file batch. Each entry is a one-line problem + one-line resolution:

1. `Cannot find module '@/x'` — verify the file exists; if it does, run the alias verifier.
2. `Cannot find name 'X'` from React 19 — many components no longer auto-import `React`; either keep `jsx: "react-jsx"` (already set) or add `import * as React from 'react'`.
3. `Type 'undefined' is not assignable to type 'string'` in optional-chain returns — narrow with `??` default.
4. `Module has no exported member 'X'` from a moved file — search for the new export path and update.
5. `Property 'X' does not exist on type 'Y'` when Y has been refactored — re-derive Y by following the import chain to the new schema.
6. `Argument of type 'A' is not assignable to parameter of type 'B'` from quick-create — likely API drift between `quickCreateRegistry` and `SelectWithQuickCreate`; conform to the registry contract.
7. `Cannot read properties of undefined (reading 'X')` in test setup — Vitest config drift after Vite v8 upgrade; check `vitest.config.ts` `test.environment`.
8. `Variable 'X' implicitly has an 'any' type` in new files — add the explicit type from the spec.
9. `Object is possibly 'undefined'` — early return or non-null assertion only with a comment justifying it.
10. `JSX expression must have one parent element` — wrap in a fragment.
11. `'X' is declared but its value is never read` — remove or prefix with `_`.
12. `Generic type 'X' requires N type arguments` — supply the missing generics (most common: `useState<T>()`, `useRef<T | null>()`).
13. `Type 'X' is missing the following properties from type 'Y'` — partial object literal; spread the missing fields or use `Partial<Y>`.
14. `No overload matches this call` from Antd 5 / Antd 6 — verify the Antd version target and reconcile component API.
15. `'Cell' is not exported from 'recharts'` — Recharts version drift; update the chart import.
16. `import type` violation — TS5.x strict on type-only imports; prefix with `type`.
17. `Cannot redeclare block-scoped variable` — colliding identifiers between two files merged by a codemod.
18. `Service worker module not found` — `vite-plugin-pwa` v1 changed the entry path; verify `srcDir` and `filename` in `vite.config.ts`.
19. `Cannot find module 'idb'` — POS DB wrapper depends on `idb`; ensure it is in `dependencies`.
20. `Property 'queryClass' is missing in type 'UseQueryOptions'` — augment `@tanstack/react-query` module declaration to require `queryClass` per `world-class-performance` R2.

These appear in the developer guide at `docs/dev/typecheck-recipes.md`.

### 1.5 — Vite plugin compatibility matrix

| Plugin | Current pin | Vite v8 status | Action |
|--------|-------------|----------------|--------|
| `@vitejs/plugin-react` | ^4.x | ✅ v4 supports vite v8 (via v4.5+) | Verify version, no action if ≥ 4.5 |
| `vite-plugin-pwa` | ^1.3.0 | ✅ v1.3+ supports vite v8 + workbox v7 | Confirmed in CLAUDE.md delta |
| `vite-plugin-html` | ^3.x | ⚠️ unclear vite v8 support | Verify or replace with `vite-plugin-html-template` |
| `vite-plugin-svgr` | ^4.x | ✅ ok | No action |
| `rollup-plugin-visualizer` | latest | ✅ ok | No action |
| `vite-tsconfig-paths` | ^5.x | ✅ ok | Confirm tsconfig paths still match aliases |

### 1.6 — React 19 strict-mode incompatibilities

React 19 made strict-mode behaviors stricter: in dev, effects mount-unmount-mount. The known problematic patterns in this repo:

- `useFirestoreLive` subscriptions that did not cleanup → already addressed in `world-class-performance` R2.6.
- POS IndexedDB connections opened in `useEffect` without cleanup → addressed in R4.3 of `world-class-performance`.
- Sentry init in `main.tsx` running twice → guard with `if (!window.__sentry_initialized__) { ... }`.

A targeted audit file `frontend/src/_double-mount-audit.md` lists every offending pattern with the fix. New files added in the recent batch are reviewed in this audit.

### 1.7 — Mid-Edit truncation detection

Multiple Edit failures during the agent batch left some files cut off mid-statement. A `scripts/detect-truncation.ts` is added with these rules:

- The file must end with a newline.
- Round-trip parse with `@babel/parser` in `errorRecovery: false` mode — if the parser throws, file is truncated.
- The last line of `.tsx` files must be `}` or `);` or `export {…}` (a small whitelist).
- A `.py` file ending mid-`def` or mid-`class` block triggers a fail.

CI runs this on every file in the diff.

### 1.8 — Build verification end-to-end

After all the above, we run a "definitive build" workflow on every PR:

```yaml
- run: npm ci --legacy-peer-deps
- run: npm run typecheck
- run: npm run lint
- run: npm run test -- --run
- run: npm run build
- run: ls -la dist/sw.js dist/index.html
- run: node scripts/check-orphans.ts
- run: node scripts/verify-aliases.ts
- run: node scripts/detect-truncation.ts
```

If all green, the PR is mergeable.

---

## Section 2 — Backend Endpoint Scaffolding

This section provides the implementation skeleton for each of the 13 quick-create endpoints. Common scaffolding first, then per-endpoint detail.

### 2.1 — Shared scaffold

Every endpoint follows this template (Python / FastAPI):

```python
# backend/app/api/v1/<resource>.py
from fastapi import APIRouter, Depends, Header, HTTPException, Response
from typing import Optional
from app.deps import get_current_user, require_permission, get_db
from app.deps.idempotency import idempotency_key
from app.deps.ratelimit import per_tenant_limiter
from app.schemas.<resource> import (
    <Entity>CreateRequest, <Entity>Response, <Entity>ListResponse
)
from app.services.<resource> import <ResourceService>

router = APIRouter(
    prefix="/<plural>", tags=["quick-create", "<resource>"],
)

@router.post(
    "",
    response_model=<Entity>Response,
    status_code=201,
    responses={
        201: {"description": "Created"},
        409: {"description": "Idempotent replay or unique conflict"},
        422: {"description": "Validation error"},
        403: {"description": "Permission denied"},
        429: {"description": "Rate limit exceeded"},
    },
)
async def create_<resource>(
    body: <Entity>CreateRequest,
    user = Depends(get_current_user),
    _perm = Depends(require_permission("<resource>.create")),
    _rl = Depends(per_tenant_limiter(rate="60/min")),
    idem_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    db = Depends(get_db),
    response: Response,
):
    cached = await idempotency_key.get_or_set(
        tenant_id=user.tenant_id, key=idem_key, route="POST /<plural>",
    )
    if cached.replay:
        response.headers["X-Idempotent-Replay"] = "true"
        return cached.response

    svc = <ResourceService>(db=db, tenant_id=user.tenant_id, actor=user)
    created = await svc.create(body)
    response.headers["Location"] = f"/api/<plural>/{created.id}"
    await cached.store(created)
    return created
```

The `IdempotencyKey` helper persists `(tenant_id, key, route) → response_json` in Firestore with a 24h TTL.

### 2.2 — `POST /api/contacts` (hardening)

Schema lives at `backend/app/schemas/contact.py`. The required fields are tightened to `display_name` only:

```python
class ContactCreateRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=120)
    phone: Optional[str] = Field(default=None, pattern=r"^\+?[1-9]\d{6,14}$")
    email: Optional[EmailStr] = None
    contact_type: Literal["customer","vendor","both"] = "customer"

    @field_validator("phone")
    def normalize_iraqi_phone(cls, v):
        # Accept 07XXXXXXXXX (local) and +9647XXXXXXXXX; normalize to E.164.
        return _normalize_iqd_phone(v)
```

### 2.3 — `POST /api/items` (hardening)

Schema at `backend/app/schemas/item.py`. SKU auto-generation falls back to a slug + tenant-monotonic counter.

### 2.4 — `POST /api/taxes` (unification)

Drift fix:

```python
# Canonical
router = APIRouter(prefix="/taxes")
# Permanent alias
alias_router = APIRouter(prefix="/taxes/rates", deprecated=True, tags=["deprecated"])
alias_router.include_router(router)
```

Add a comment in `_deltas/api-renames.md` documenting the rename.

### 2.5 — `POST /api/accounts` (hardening)

The hardening pass focuses on auto-code generation when `code` is missing. Iraq COA convention uses 5-digit codes: 10000-asset, 20000-liability, 30000-equity, 40000-income, 50000-expense. The generator finds the highest code with the same parent prefix and increments by 10 within that range.

### 2.6 — `POST /api/expense-categories` (new)

```python
class ExpenseCategoryCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    code: Optional[str] = None
    default_account_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=400)
    is_active: bool = True
```

Firestore path: `tenants/{tenant_id}/expense_categories/{id}`. ID = uuid4 hex truncated to 12 chars for human-friendly URLs.

### 2.7 — `POST /api/equipment-categories` (new)

```python
class EquipmentCategoryCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=400)
    parent_id: Optional[str] = None
    maintenance_interval_days: Optional[int] = Field(default=None, gt=0)
    is_active: bool = True
```

Service enforces parent cycle detection (max depth 5).

### 2.8 — `POST /api/subscription-plans` (new)

```python
class SubscriptionPlanCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    code: Optional[str] = None
    billing_period: Literal["monthly","quarterly","annual"]
    price: Decimal = Field(ge=0, max_digits=14, decimal_places=4)
    currency: str = Field(min_length=3, max_length=3)  # ISO-4217
    trial_days: int = Field(default=0, ge=0, le=365)
    features: list[str] = Field(default_factory=list, max_length=50)
    is_active: bool = True
```

### 2.9 — `POST /api/locations` (new)

```python
class LocationCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    code: Optional[str] = None
    type: Literal["warehouse","retail","kitchen","office","virtual"] = "warehouse"
    address: Optional[str] = Field(default=None, max_length=300)
    governorate: Optional[str] = None  # IQ-BG, IQ-AR, IQ-SU, …
    phone: Optional[str] = None
    is_active: bool = True
    is_default: bool = False
```

Service transactionally demotes prior default when `is_default=True`.

### 2.10 — `POST /api/teams` (new)

```python
class TeamCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=400)
    manager_user_id: Optional[str] = None
    members: list[str] = Field(default_factory=list, max_length=200)
    is_active: bool = True
```

### 2.11 — `POST /api/bank-accounts` (unification + hardening)

Validation of `iban` uses `schwifty` (Python IBAN validator) when imported; absent that, ISO 13616 mod-97 check inline.

### 2.12 — `POST /api/currencies` (new)

Document ID = uppercase code (e.g., `USD`, `IQD`, `IRR`). Permits idempotent re-add returning 200 with the existing record.

### 2.13 — `POST /api/tags` (new)

`(scope, name)` unique. The 2nd attempt returns 200 with the existing record — *not* 409 — because quick-create UX demands idempotency-friendly tag creation (the user is mid-form).

### 2.14 — `POST /api/payment-methods` (new)

Foreign-key validation: when `type` is one of the gateway-backed types, the service checks that the tenant has the corresponding gateway configured. If not, the response includes `requires_gateway_config: true` and the frontend renders an inline "Configure FastPay first →" link.

### 2.15 — Cross-cutting tests

Each endpoint ships with a test file `backend/tests/quick_create/test_<resource>.py` implementing the 5 cases from R2.14. A shared fixture `quick_create_tester` reduces boilerplate.

---

## Section 3 — Staging Architecture

### 3.1 — GCP project setup

Run from a sandbox account with `roles/resourcemanager.projectCreator`:

```bash
gcloud projects create zoho-staging --name="Zoho ERP Staging"
gcloud beta billing projects link zoho-staging --billing-account=XXXX-XXXX
gcloud services enable run.googleapis.com firestore.googleapis.com \
  redis.googleapis.com secretmanager.googleapis.com cloudtrace.googleapis.com \
  logging.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project=zoho-staging
```

Provision Firestore in Native mode, region `me-central1`. Provision Memorystore (Redis 1GB BASIC) in the same region.

Service accounts:

- `staging-runtime@zoho-staging.iam.gserviceaccount.com` — for Cloud Run.
- `staging-deploy@zoho-staging.iam.gserviceaccount.com` — used by GitHub Actions via Workload Identity Federation. Production deploy SA has NO permissions on staging and vice versa.

### 3.2 — Vercel staging environment

The Vercel project gains a `staging` environment. The `staging` git branch deploys to it. Environment variables:

```
VITE_API_BASE_URL=https://api.staging.erp.zoho.kurd.iq
VITE_FIREBASE_PROJECT_ID=zoho-staging
VITE_SENTRY_DSN=<sentry-staging-dsn>
VITE_ENV=staging
VITE_STRIPE_PUBLIC_KEY=<stripe-test-pk>
VITE_FASTPAY_MERCHANT_ID=<sandbox-merchant>
```

Preview environments (per-PR) point at staging by default and SHALL never point at production.

### 3.3 — DNS subdomain

Cloudflare DNS:

- `staging.erp.zoho.kurd.iq` → CNAME → Vercel
- `api.staging.erp.zoho.kurd.iq` → CNAME → Cloud Run staging service hostname

TLS managed by Vercel and Google-managed certs respectively.

### 3.4 — Synthetic tenant seeding

A management CLI `python -m app.tools.seed_staging` provisions:

- A tenant `acme-staging-{date}` with seeded Firebase Auth user `safa+staging@zoho.kurd.iq`.
- Chart of Accounts using the `medium_general_trade` template.
- 30 items across electronics, groceries, and services.
- 50 customers.
- 90 days of invoices with realistic state distribution (60% paid, 20% partially paid, 15% open, 5% overdue).
- 12 months of past sales for reports.
- 3 employees for payroll.
- 1 POS terminal with seeded floor plan.

Re-running with `--reset` wipes the synthetic tenant and re-seeds. Cron in Cloud Scheduler triggers `--reset` on the 1st of every month at 02:00 me-central1.

### 3.5 — E2E test harness pointing at staging

Playwright reads `process.env.PLAYWRIGHT_BASE_URL` (default `https://staging.erp.zoho.kurd.iq`). A nightly GitHub Actions job runs the full suite against staging; PR jobs run a 10-test smoke against the preview URL.

### 3.6 — CI integration

```yaml
# .github/workflows/staging-smoke.yml
name: staging-smoke
on:
  push:
    branches: [main]
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: gcloud run deploy zoho-api-staging --image=$IMAGE --region=me-central1 --project=zoho-staging
      - run: ./scripts/wait-for-staging.sh
      - run: npx playwright test smoke/ --project=staging
```

Production deploy workflow's required check list includes `staging-smoke`.

### 3.7 — Staging banner

`frontend/src/design-system/EnvironmentBadge.tsx` reads `VITE_ENV`; if `staging`, renders a fixed top banner: "STAGING — synthetic data, do not use for real transactions." The banner is full-width, 32px tall, `bg-amber-500`, and impossible to dismiss.

### 3.8 — Monthly reset cron

```yaml
# infra/scheduler/staging-monthly-reset.yaml
name: staging-monthly-reset
schedule: "0 2 1 * *"
timeZone: Asia/Baghdad
target: cloud-run-job/staging-reset
```

The Cloud Run Job runs `python -m app.tools.seed_staging --reset --all-synthetic-tenants`.

---

## Section 4 — Onboarding Wizard

### 4.1 — State machine

The wizard is a finite-state machine with these states:

```
idle ─► step1_company ─► step2_region ─► step3_coa ─► step4_pos? ─► step5_first_sale ─► completed
       │                │                │            │              │
       └─► skipped ◄────┴────────────────┴────────────┴──────────────┘
```

`step4_pos` is conditionally skipped if the user selects "I don't use POS" in Step 1's `intended_use` field.

State persists to `tenants/{tenant_id}/onboarding/state` after each transition. The frontend hydrates state on mount and resumes at the last incomplete step.

Implementation: `frontend/src/onboarding/state.ts` exports a typed reducer + a Zustand store `useOnboardingStore`. The reducer accepts events `{type: 'NEXT' | 'BACK' | 'SKIP' | 'COMPLETE', payload?}` and produces the next state.

### 4.2 — Component tree

```
<OnboardingShell>
  ├─ <OnboardingHeader />            (logo, progress bar 1/5, skip link)
  ├─ <OnboardingStepContainer>       (animated route)
  │    ├─ <StepCompanyInfo />        (step 1)
  │    ├─ <StepIraqRegion />         (step 2)
  │    ├─ <StepChartOfAccounts />    (step 3)
  │    ├─ <StepPOSHardware />        (step 4, optional)
  │    └─ <StepFirstSale />          (step 5)
  └─ <OnboardingFooter />            (back, continue, skip)
```

Files in `frontend/src/onboarding/`. The shell is part of the lazy bundle `onboarding.chunk` (not loaded for repeat sessions where `onboarding.completed_at` is set).

### 4.3 — Step 1: Company info (`StepCompanyInfo.tsx`)

Form fields per R4.3. Submits to `PUT /api/tenants/{tenant_id}/profile` (existing endpoint, may need hardening). The `intended_use` extra field is multi-select with options `[retail, restaurant, service, manufacturing, wholesale, ngo]`. The selection influences which COA templates appear in step 3.

### 4.4 — Step 2: Iraq region preset (`StepIraqRegion.tsx`)

The map is an inline SVG of Iraq with clickable governorate paths. Selection highlights the governorate and previews the tax-rate set in a side panel.

The preset data structure (`frontend/src/data/iraqRegionPresets.ts`):

```ts
export const IRAQ_REGION_PRESETS = {
  'IQ-BG': {  // Baghdad
    label_en: 'Baghdad', label_ku: 'بەغدا', label_ar: 'بغداد',
    governorate_code: 'IQ-BG',
    krg_region: false,
    tax_rates: [
      { name: 'Sales Tax — Hospitality', rate_percent: 10, applies_to: 'sales' },
      { name: 'Sales Tax — Telecom', rate_percent: 20, applies_to: 'sales' },
      // ...
    ],
    locale_defaults: { currency: 'IQD', date_format: 'YYYY-MM-DD' },
  },
  'IQ-AR': {  // Erbil (Kurdistan Region)
    label_en: 'Erbil', label_ku: 'هەولێر', label_ar: 'أربيل',
    governorate_code: 'IQ-AR',
    krg_region: true,
    tax_rates: [
      { name: 'KRG Hospitality Tax', rate_percent: 10, applies_to: 'sales' },
      // ...
    ],
    locale_defaults: { currency: 'IQD', date_format: 'YYYY-MM-DD' },
  },
  // ... all 18 governorates
} as const;
```

On submit, the wizard posts each tax rate to `POST /api/taxes` and stores the IDs in onboarding state.

> Note: actual rates SHALL be verified with a Kurdish/Iraqi tax accountant before launch. The values above are placeholders.

### 4.5 — Step 3: Chart of Accounts (`StepChartOfAccounts.tsx`)

Five templates. The list (file paths under `backend/app/data/coa_templates/`):

- `small_general_trade.yaml` — 40 accounts, simple retail
- `medium_general_trade.yaml` — 80 accounts, multi-location retail
- `restaurant_cafe.yaml` — 60 accounts, F&B specific (food cost, beverage cost, tips, delivery)
- `pharmacy.yaml` — 70 accounts, pharmaceutical specific (controlled substances, insurance receivables)
- `construction_contractor.yaml` — 120 accounts, WIP, retention, subcontractor

Each YAML file shape (excerpt):

```yaml
template: small_general_trade
version: 1
accounts:
  - code: "10000"
    name_en: "Assets"
    name_ku: "دارایی"
    name_ar: "الأصول"
    type: asset
    is_header: true
  - code: "10100"
    name_en: "Cash on Hand"
    name_ku: "پارەی نەختی"
    name_ar: "النقدية في الصندوق"
    type: asset
    parent_code: "10000"
    is_default_for: default_cash
  - code: "10200"
    name_en: "Bank — Main"
    name_ku: "بانک — سەرەکی"
    name_ar: "البنك — الرئيسي"
    type: asset
    parent_code: "10000"
    is_bank: true
  # ...
  - code: "40100"
    name_en: "Sales Revenue"
    name_ku: "داهاتی فرۆشتن"
    name_ar: "إيرادات المبيعات"
    type: income
    is_default_for: default_sales_revenue
```

The wizard calls `POST /api/onboarding/coa/apply` with `{ template: 'small_general_trade' }`. The backend reads the YAML, bulk-creates the accounts, and links the `is_default_for` accounts to the tenant's default-mapping in `tenants/{tenant_id}/profile.default_accounts`.

### 4.6 — Step 4: POS hardware (`StepPOSHardware.tsx`)

Web Bluetooth flow:

1. Show "Pair printer" button → `navigator.bluetooth.requestDevice({ filters: [{ services: [0x18F0] }] })` (ESC/POS printer service).
2. Connect to the GATT server, get the characteristic, store the device ID.
3. Paper width radio: 58mm or 80mm.
4. Test-print: send a fixed payload (logo + "TEST PRINT — اختبار" + a barcode + a cut command). Read back any error.
5. Confirmation: "Did it print? Yes / No / Retry."
6. Cash-drawer: optional. Cash drawer is a kick-out command sent through the printer (`ESC p 0 25 250` for most ESC/POS); the test fires the command and asks the user "Did the drawer open?"

On Yes for both: store `{printer_device_id, paper_width, cash_drawer_enabled}` in `tenants/{tenant_id}/pos_terminals/default`.

On No: offer "Skip for now". The user can re-run from Settings → POS later.

### 4.7 — Step 5: First sale (`StepFirstSale.tsx`)

A 3-mini-step overlay:

- Mini-step A: create first product. Reuses `<QuickCreateItem>` modal. Defaults `unit_price = 1000` IQD so the test sale is small.
- Mini-step B: create first customer. Reuses `<QuickCreateContact>` modal.
- Mini-step C: ring up the sale. A simplified POS terminal with one product, one customer, "Cash" payment method. Tap "Charge", confirm IQD 1,000 received, print receipt (or skip print).

On C success: the wizard posts `onboarding.completed_at = now`, navigates to `/dashboard?welcome=true` which renders a confetti-and-checklist greeting.

### 4.8 — Telemetry

Wizard emits to the RUM endpoint per `world-class-performance` R6.1:

```ts
emit('onboarding.started', { tenant_id });
emit('onboarding.step_completed', { step: 'company_info', elapsed_ms });
emit('onboarding.skipped', { step: 'pos_hardware' });
emit('onboarding.completed', { total_elapsed_ms, steps_skipped: [...] });
```

### 4.9 — Accessibility

The wizard passes `axe-core` with zero serious/critical violations. Keyboard navigation: `Tab` walks fields, `Enter` advances when valid, `Esc` opens the skip dialog. `aria-live="polite"` announces step transitions.

### 4.10 — Animation

Framer Motion handles step transitions: slide horizontally (RTL-aware) with 240ms spring. `prefers-reduced-motion` falls back to crossfade.

---

## Section 5 — Dual Payment System

### 5.1 — Tenant-side abstraction

`backend/app/payments/gateway.py`:

```python
from abc import ABC, abstractmethod
from typing import Optional
from decimal import Decimal

class Intent:
    id: str
    provider: str
    client_secret: Optional[str]
    qr_payload: Optional[str]
    next_action: Optional[dict]

class PaymentGateway(ABC):
    name: str
    sandbox: bool

    @abstractmethod
    async def create_intent(self, *, amount: Decimal, currency: str, metadata: dict) -> Intent: ...

    @abstractmethod
    async def confirm(self, intent_id: str, params: dict) -> "Result": ...

    @abstractmethod
    async def refund(self, charge_id: str, amount: Decimal, reason: str) -> "RefundResult": ...

    @abstractmethod
    async def webhook_verify(self, payload: bytes, signature: str) -> "Event": ...

    @abstractmethod
    async def webhook_handle(self, event: "Event") -> None: ...

    @abstractmethod
    async def reconcile(self, date_from, date_to) -> "ReconciliationReport": ...
```

Concrete adapters live in `backend/app/payments/providers/`:

- `cash.py`
- `cod.py`
- `qi_card.py`
- `fastpay.py`
- `zain_cash.py`
- `asia_pay.py`
- `stripe_tenant.py`

A registry in `backend/app/payments/registry.py` maps `provider_code → class` and is configured per-tenant.

### 5.2 — FastPay adapter detail

Sandbox base URL: `https://sandbox.fastpaywallet.com/api/v1/` (verify with FastPay business team — confirmed flow below is the documented one as of last published spec).

OAuth flow:

- `POST /oauth/token` with `grant_type=client_credentials&client_id=...&client_secret=...`
- Returns `access_token` (TTL ~3600s). Cached in Redis per tenant.

Create intent:

- `POST /payments` body: `{amount: <iqd_integer>, currency: "IQD", description, merchant_reference, callback_url}`
- Returns `{id, qr_string, expires_at}`

Confirm:

- The customer scans the QR; FastPay posts to `callback_url` with `{payment_id, status: 'paid' | 'failed', timestamp, signature}`.

Webhook signature verification:

- `signature = HMAC_SHA256(secret, raw_body)` compared in constant time.

Failure modes: network timeout, expired QR (5 minutes), insufficient balance, blocked customer wallet.

### 5.3 — Qi Card adapter detail

Sandbox URL: `https://api.sandbox.qicard.iq/v1/` (to verify with Qi Card business API team — written here as a placeholder; an open question in the tasks list).

Flow: hosted payment page (PCI SAQ-A), tenant redirects customer to Qi-hosted URL with intent token; customer enters PIN on a Qi-secured page; Qi calls back to the tenant's webhook with auth code, then capture endpoint to confirm.

3DS: the Qi hosted page handles SCA. Our server does not see PAN data.

### 5.4 — Zain Cash adapter detail

Status: provider docs are less public; flow modeled on standard mobile-wallet OTP pattern. To be confirmed in implementation phase. Webhook signature method TBD.

### 5.5 — Asia Pay / Asia Hawala adapter detail

Status: largely used for import-export. Token-on-file model for recurring. Lower priority for v1 unless launch customer needs it.

### 5.6 — Stripe (tenant-side) detail

For international (non-IQ-resident) tenants. Standard `paymentIntents.create` → `confirmCardPayment` on the client → webhook `payment_intent.succeeded`. Tax handling via `automatic_tax: { enabled: true }` if the tenant opts in.

### 5.7 — Webhook handler architecture

Single ingress per provider at `POST /api/payments/webhooks/<provider>`. Each handler:

1. Reads raw body + signature header.
2. Calls `gateway.webhook_verify(raw, signature)`.
3. On success, dedupes by `(provider, provider_event_id)` in Firestore (TTL 7 days).
4. Calls `gateway.webhook_handle(event)`.
5. Returns `200 OK` quickly (within 5s) to avoid provider retries.

Long-running work (e.g., emailing a receipt) is deferred to a background task via `BackgroundTasks` or pushed to Cloud Tasks.

### 5.8 — Reconciliation jobs

A nightly Cloud Run Job per provider:

- Pull settlement report for date D-1 from the provider's API.
- Iterate each settlement entry and match against `Payment` documents by `provider_charge_id`.
- Mark matched as `settled` with `settled_at`.
- Unmatched entries → log to `payments.reconciliation_queue` subcollection with status `unmatched_inbound` (provider says we got paid but we don't know about it) or `unmatched_outbound` (we think we got paid but provider has no record).

A UI in **Settings → Payments → Reconciliation** lists queue items with one-click actions: Match Manually, Investigate, Ignore (with audit reason).

### 5.9 — Refund + dispute handling

Refund: user with `payments.refund` permission clicks Refund → enters amount + reason → backend calls `gateway.refund` → on success creates `Refund` document, updates `Payment.status` to `refunded` or `partially_refunded`, reverses GL entries via `accounting.post_refund`.

Disputes: Stripe `charge.dispute.created` webhook → creates `Dispute` document → notifies the tenant via in-app + email. Iraqi providers' dispute model is provider-specific and may be manual.

### 5.10 — Failed-payment retry logic (SaaS billing dunning)

Stripe's smart retry handles the first few attempts. We layer:

- Day 0 (initial failure): in-app notice + email to tenant_admin.
- Day 3: second notice.
- Day 7: third notice — "Pay within 7 days to avoid restrictions".
- Day 14: tenant enters **read-only mode** (no new transactions; existing data viewable).
- Day 30: tenant enters **frozen mode** (login redirects to billing only).
- Day 60: tenant scheduled for hard deletion (Super-Admin override required).

### 5.11 — Tax handling per region

For tenant-side payments, the tenant chooses the tax rate from their own tax table when creating an invoice or POS sale. The payment provider does not compute tax — it only processes the gross amount.

For SaaS billing: Stripe Tax is enabled for international tenants (US/EU rates auto-computed). Iraqi tenants pay a flat USD-equivalent price with no Stripe Tax (Iraq is not in Stripe Tax's coverage).

### 5.12 — Settings UI

**Settings → Payments → Providers**: list of available providers with on/off toggles. Each provider expands to its config form (merchant ID, API keys — stored in Secret Manager via a thin proxy).

**Settings → Payments → Methods**: list of configured `PaymentMethod` records. Drag-to-reorder for POS display order.

**Settings → Payments → Reconciliation**: per-provider queue.

### 5.13 — SaaS billing decisions

- Stripe Tax mode: **automatic** for international (US/EU/UK), **off** for Iraq.
- Stripe Customer Portal: enabled, branded.
- Plans defined in code, prices created in Stripe via a one-time script `scripts/bootstrap-stripe.ts`.
- Trial: 90 days, tracked in our DB (Stripe trial would also work but we keep authority).

---

## Section 6 — Decisions and Trade-offs

ADR-style entries. Each has Context, Decision, Consequences.

### ADR-LR-001 — Stripe for international SaaS billing, FastPay for Iraqi

**Context**: We need recurring billing globally; Stripe does not operate in Iraq.

**Decision**: Stripe for `country != IQ`, FastPay business recurring (or manual invoice if FastPay does not support recurring at v1) for `country == IQ`.

**Consequences**: Two billing code paths to maintain. Iraqi tenants get a less-polished experience in v1. Future work: consolidate when local rails support recurring.

### ADR-LR-002 — Hosted payment pages over raw PAN handling

**Context**: PCI compliance scope.

**Decision**: We do not accept raw PAN. All card payments route through provider-hosted pages or SDKs that tokenize at the source. We are SAQ-A scope.

**Consequences**: We cannot offer a fully white-labeled card payment UI. The trade is accepted.

### ADR-LR-003 — Cash on Delivery as first-class

**Context**: 60% of Iraq e-commerce is COD. Treating it as a workaround creates bad UX.

**Decision**: COD is a first-class `PaymentGateway` implementation with its own state machine (`pending_delivery → delivered → settled`). Couriers (manual or integrated) drive the state.

**Consequences**: Settlement is delayed; reconciliation is more complex. Tenants must be educated.

### ADR-LR-004 — Wizard as a forced first-run, skippable but tertiary

**Context**: Skippable wizards have low completion. Mandatory wizards frustrate.

**Decision**: Wizard auto-launches on first sign-in. Skip is a tertiary text link, not a button. Re-run available later from help menu.

**Consequences**: Higher completion than skippable, lower frustration than mandatory.

### ADR-LR-005 — Staging is a separate GCP project, not a separate Firestore database in the same project

**Context**: Same-project, multi-database is a Firestore feature but rules + IAM still cross.

**Decision**: Full project isolation. `zoho-staging` is its own GCP project with its own IAM.

**Consequences**: Higher GCP overhead. Worth it for true isolation.

### ADR-LR-006 — Path alias `@/` is enforced for depth ≥ 2

**Context**: Mixed relative and alias imports cause confusion and tooling drift.

**Decision**: Codemod migrates `../../` and deeper to `@/`. Shallow `./` allowed.

**Consequences**: Large one-time diff. Long-term clarity win.

### ADR-LR-007 — Tenant scoping enforced at service layer, not just rules

**Context**: Firestore rules alone are not enough when a misconfigured route uses Admin SDK.

**Decision**: Every service in `backend/app/services/` takes `tenant_id` as a required constructor argument and adds it to every query. Rules remain as a second line of defense.

**Consequences**: Slightly more verbose service signatures. Defense in depth.

### ADR-LR-008 — Onboarding state in Firestore, not localStorage

**Context**: A user may resume on a second device.

**Decision**: Onboarding state lives in `tenants/{tenant_id}/onboarding/state` on the server.

**Consequences**: Extra read on every wizard mount. Acceptable; the document is small.

### ADR-LR-009 — Quick-create tag uniqueness returns 200 not 409

**Context**: Quick-create UX should not surface conflict errors on a benign retry.

**Decision**: `POST /api/tags` returns 200 with the existing record when `(scope, name)` matches.

**Consequences**: Subtle non-REST behavior, but documented.

### ADR-LR-010 — Iraqi tax data ships as code, regulator-confirmed before GA

**Context**: Tax rates change. Hard-coding rots.

**Decision**: Rates live in `frontend/src/data/iraqRegionPresets.ts` and `backend/app/data/iraq_tax_rates.yaml` with a `last_verified` field per region. The Tasks document includes "Verify with KRG Tax Directorate" as an explicit open question.

**Consequences**: Engineering owns regulatory currency; quarterly review.

---

## Cross-references

- `world-class-performance` R2 — React Query query classes (our quick-create selectors honor classes).
- `world-class-performance` R6.1 — RUM ingest endpoint (we send wizard + payment telemetry there).
- `empty-state-quick-create` R4 — `<EmptyState>` component (used inside wizard sub-steps).
- `super-admin-console` — Billing dashboard (consumes our SaaS billing data).
- `phase-4-pos-iraq` — POS terminal flow (our wizard's step 4 reuses the printer pairing primitives).

---

## Appendix A — File map

```
backend/app/
├── api/v1/
│   ├── expense_categories.py        (new)
│   ├── equipment_categories.py      (new)
│   ├── subscription_plans.py        (new)
│   ├── locations.py                 (new)
│   ├── teams.py                     (new)
│   ├── currencies.py                (new)
│   ├── tags.py                      (new)
│   ├── payment_methods.py           (new)
│   └── bank_accounts.py             (unify/new)
├── schemas/
│   ├── expense_category.py          (new)
│   ├── equipment_category.py        (new)
│   ├── subscription_plan.py         (new)
│   ├── location.py                  (new)
│   ├── team.py                      (new)
│   ├── currency.py                  (new)
│   ├── tag.py                       (new)
│   ├── payment_method.py            (new)
│   └── bank_account.py              (new/unify)
├── services/  (one per resource)
├── payments/
│   ├── gateway.py                   (new abstract base)
│   ├── registry.py                  (new)
│   ├── reconciliation.py            (new)
│   └── providers/
│       ├── cash.py
│       ├── cod.py
│       ├── qi_card.py
│       ├── fastpay.py
│       ├── zain_cash.py
│       ├── asia_pay.py
│       └── stripe_tenant.py
├── billing/
│   ├── plans.py
│   ├── stripe.py
│   ├── fastpay_recurring.py
│   ├── dunning.py
│   └── webhooks.py
├── data/
│   ├── coa_templates/
│   │   ├── small_general_trade.yaml
│   │   ├── medium_general_trade.yaml
│   │   ├── restaurant_cafe.yaml
│   │   ├── pharmacy.yaml
│   │   └── construction_contractor.yaml
│   └── iraq_tax_rates.yaml
└── tools/
    └── seed_staging.py

frontend/src/
├── onboarding/
│   ├── OnboardingShell.tsx
│   ├── state.ts                     (FSM + Zustand store)
│   ├── StepCompanyInfo.tsx
│   ├── StepIraqRegion.tsx
│   ├── StepChartOfAccounts.tsx
│   ├── StepPOSHardware.tsx
│   └── StepFirstSale.tsx
├── data/
│   ├── iraqRegionPresets.ts
│   └── coaTemplatePreviews.ts
└── payments/
    ├── PaymentMethodPicker.tsx
    ├── HostedPaymentLink.tsx
    └── ReconciliationQueue.tsx

scripts/
├── check-orphans.ts
├── verify-aliases.ts
├── detect-truncation.ts
├── codemod-relative-to-alias.ts
└── bootstrap-stripe.ts

.github/workflows/
├── ci.yml                            (typecheck, lint, test, build)
├── staging-smoke.yml                 (deploy + smoke)
└── prod-deploy.yml                   (gated by staging-smoke)
```
