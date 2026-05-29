# Engineering Handbook — ERPIQ / Zoho Kurdish ERP

> **Spec ref:** `.kiro/specs/scale-foundation` — T-SF.1.8 (R1.8).
> **Owner:** Founder → Ops/SRE Lead (after T-SF.1.6 transfer).
> **Status:** Living document. Edit it the moment reality drifts.
> **Audience:** Every engineer, on day one and forever after.

This is the canonical "how we build and run the product" reference. It is
**grounded in the code that actually ships** — every claim here points at a
file you can open in `backend/app/` or `frontend/src/`. When a chapter and the
code disagree, the code wins and this chapter is a bug — fix it in the same PR.

Companion docs (do not duplicate them here, link to them):

| Topic | Document |
|---|---|
| Disaster recovery (SEV-1 playbook) | [`DISASTER_RECOVERY.md`](../../DISASTER_RECOVERY.md) |
| Production runbooks (per-incident) | [`docs/runbooks/`](../runbooks/) |
| Architecture decisions | [`docs/adr/`](../adr/) |
| On-call escalation + rotation | [`docs/oncall/`](../oncall/) |
| New-hire ramp | [`docs/handbook/onboarding.md`](./onboarding.md) |
| Secret rotation | [`docs/security/secret-rotation.md`](../security/secret-rotation.md) |
| PII handling | [`docs/security/pii-handling.md`](../security/pii-handling.md) |

**A note on cloud projects (read this before any `gcloud`/`firebase` command).**
We run across **two** Google Cloud projects, on purpose, and they are easy to
confuse:

* **Firestore / Firebase data project: `zoho-83cda`.** This is where every
  tenant's data, the security rules (`firestore.rules`), the indexes
  (`firestore.indexes.json`), Auth, and the backup bucket
  (`gs://zoho-83cda-erp-backups`) live. Confirmed by
  `backend/app/config.py` (`FIREBASE_PROJECT_ID = "zoho-83cda"`) and the
  `firebase deploy ... --project zoho-83cda` step in
  `.github/workflows/deploy-firestore.yml`.
* **Compute project (Cloud Run, Cloud DNS, Memorystore, Secret Manager):**
  supplied to CI as the `GCP_PROJECT_ID` secret. The DR runbook and the
  per-incident runbooks use the compute project for `gcloud run` /
  `gcloud redis` / `gcloud dns` commands.

The split exists because Firebase Auth + Firestore were stood up first under
`zoho-83cda`, and the containerised API was later deployed into a dedicated
compute project. **Never `firebase deploy` against the compute project, and
never point the API's `FIREBASE_PROJECT_ID` anywhere but `zoho-83cda`.**

---

## Table of contents

1. [Repository layout](#1-repository-layout)
2. [Branching, review, and merge](#2-branching-review-and-merge)
3. [Deployment](#3-deployment)
4. [Secret access](#4-secret-access)
5. [Customer-data access](#5-customer-data-access)
6. [On-call](#6-on-call)
7. [Incident response](#7-incident-response)
8. [Refund authorization](#8-refund-authorization)
9. [RBAC — roles & permissions](#9-rbac--roles--permissions)
10. [Billing webhook (Stripe)](#10-billing-webhook-stripe)
11. [Firestore data model](#11-firestore-data-model)
12. [Multi-tenancy](#12-multi-tenancy)

---

## 1. Repository layout

This is a **monorepo**. Root contains the backend, frontend, mobile shell,
marketing site, infra config, docs, and CI.

```
zoho/
├── backend/                  FastAPI + Firestore API (Python)
│   ├── app/
│   │   ├── main.py           App factory: router includes + middleware stack + lifespan
│   │   ├── config.py         pydantic-settings; validate_env() hard-fails prod on insecure config
│   │   ├── firebase_client.py  init_firebase() + get_db()/get_firestore_client()
│   │   ├── api/              ~130 routers, one module per domain (invoices.py, pos.py, …)
│   │   │   ├── v1/           /api/v1 router: cursor pagination + RFC 7807 errors
│   │   │   ├── admin/        super-admin endpoints (exports, pii_delete, impersonate, …)
│   │   │   └── internal/     internal-only (health_emit, …)
│   │   ├── firestore/        Repository layer — base.py + one repo file per collection
│   │   │   ├── base.py       BaseRepository(org_id): all CRUD, versioning, soft-delete, caching
│   │   │   └── write_models/ Pydantic write-validation models (optional per repo)
│   │   ├── services/         Business logic: auth, permissions, scheduler, gdpr, backup, …
│   │   ├── middleware/       request_id, org_context, rate_limit, idempotency, audit, …
│   │   ├── schemas/          Pydantic request/response models
│   │   ├── billing/          SaaS billing: stripe.py, plans.py, dunning.py, trial.py
│   │   ├── payments/         Tenant-side gateways: gateway.py + {cash,cod,stripe,fastpay,…}
│   │   ├── efakhata/         Iraq e-invoicing: schema, signing (XAdES), submission queue
│   │   ├── observability/    init_observability() — Sentry + OTel + Prometheus /metrics
│   │   └── pdf/, tax/, data/ formatting, WHT engine, Iraq presets
│   ├── tests/                pytest suites grouped by feature
│   └── requirements.txt      ⚠️ shared file — see ch. 2 for the change protocol
├── frontend/                 React + TS + Vite + Antd + Zustand
│   └── src/
│       ├── App.routes.tsx    Route table — lazyWithRetry() code-split per page ⚠️ shared
│       ├── layouts/          AppShell.tsx (shell), moduleMap.ts, navDestinations.ts ⚠️ shared
│       ├── pages/            One file per screen; pages/modules/moduleConfigs.ts for ext modules
│       ├── stores/           Zustand stores (posCart, posSession, posOffline, …)
│       ├── hooks/            useCRUD, useFirestoreLive, useFeatureFlag, usePermission, …
│       ├── api/              Typed API clients
│       ├── design-system/    Shared primitives (DetailLayout, SelectWithQuickCreate, …)
│       └── i18n.config.ts    Namespaced lazy i18n loader (ku / ar / en)
├── mobile/                   Capacitor shell (iOS + Android) + native bridges
├── marketing/                Astro static site (ku/ar/en), deployed to Vercel separately
├── docs/                     ADRs, runbooks, handbook, security, observability
├── firestore.rules           ⚠️ shared — security rules (deploy: deploy-firestore.yml)
├── firestore.indexes.json    ⚠️ shared — composite indexes
├── vercel.json               ⚠️ shared — frontend build + /api/* rewrite to Cloud Run
├── DISASTER_RECOVERY.md      SEV-1 playbook
└── .github/workflows/        CI/CD (ci.yml, deploy-cloudrun.yml, deploy-firestore.yml, …)
```

### Where things really live

* **A new API endpoint** → add a router in `backend/app/api/<domain>.py`, then
  include it in `backend/app/main.py` (a shared file — see the change protocol
  in ch. 2). Mirror the read path through a repository in
  `backend/app/firestore/`.
* **A new screen** → add a page under `frontend/src/pages/`, register the route
  in `frontend/src/App.routes.tsx` (shared file), and add nav metadata in
  `layouts/navDestinations.ts` + `layouts/moduleMap.ts`.
* **Background work** → add a job in `backend/app/services/scheduler.py`
  (APScheduler). It scans all orgs; see ch. 11/12 for the tenant-loop pattern.
* **A cross-cutting request behaviour** → middleware in
  `backend/app/middleware/`, wired in `main.py` in a deliberate order (ch. 3).

### The `backend/venv/` trap

`backend/venv/` is **only** the Python virtual environment. Application code is
under `backend/app/`. Never edit anything inside `venv/`. Run the interpreter
as `backend/venv/Scripts/python.exe` on Windows.

---

## 2. Branching, review, and merge

### Trunk

* Default branch: **`main`**. It is always deployable.
* Feature work lands on a branch named `feat/<topic>` or `fix/<topic>` (e.g.
  the current `feat/platform-overhaul-2026-05-27`). Spec-driven work may use the
  spec slug (`feat/scale-foundation-<stream>`).
* Never commit directly to `main`. If you find yourself on `main`, branch first.

### Commit messages

* Imperative subject, scoped where it helps: `fix(billing): ack unknown Stripe
  events with 200`.
* End every commit authored with AI assistance with the trailer:
  `Co-Authored-By: <model> <noreply@anthropic.com>`.
* Reference the spec task when one exists: `(T-SF.1.8)`.

### Pull requests

1. PR targets `main`. Title mirrors the lead commit.
2. **CI must be green.** `ci.yml` and `ci-quality.yml` run on every PR:
   backend pytest, frontend typecheck/lint/build, the Firestore-query→index
   audit (`scripts/audit-firestore-queries.py`), and the scorecard gates.
3. **At least one reviewer approval.** Two for anything touching money
   (`billing/`, `payments/`, journal posting), auth (`services/auth.py`,
   `services/permissions.py`), or `firestore.rules`.
4. Squash-merge by default; keep the merge commit message clean.

### The shared-file change protocol

A handful of files are edited by nearly every stream, so uncoordinated edits
cause merge collisions and, worse, silent route/middleware drift. Treat these
as **shared** — small, surgical diffs only, called out explicitly in the PR
description:

* `backend/app/main.py` (router includes + middleware order)
* `backend/requirements.txt`
* `firestore.rules`, `firestore.indexes.json`
* `frontend/src/App.routes.tsx`, `frontend/src/layouts/AppShell.tsx`
* `frontend/package.json`, `vercel.json`
* Any existing file under `.github/workflows/`

Rules for shared files:

* One logical change per PR. Don't reformat the file.
* New router? Add the `include_router(...)` line in the matching numbered
  section of `main.py` and nothing else.
* New dependency? Pin it with a bounded range (`pkg>=X,<Y`) and say why in the
  PR body. Cold-start budget is real (ch. 3) — heavy deps get scrutiny.
* New Firestore composite query? You must add the index to
  `firestore.indexes.json` in the same PR or the query audit gate fails.

### Branch hygiene

* Rebase onto `main` before requesting review if your branch is more than a day
  behind.
* Delete merged branches.
* No long-lived release branches — we ship from `main` (ch. 3).

---

## 3. Deployment

We deploy three independently shippable artifacts. None of them are coupled at
the build step.

### 3.1 Backend → Cloud Run

* Workflow: `.github/workflows/deploy-cloudrun.yml`.
* Service: `zoho-erp`. Region and compute project come from CI config
  (`REGION` env in the workflow; `GCP_PROJECT_ID` secret).
* **Auth to GCP is Workload Identity Federation** — `GCP_WIF_PROVIDER` +
  `GCP_SA_EMAIL` secrets. There are **no long-lived JSON service-account keys**
  in CI (see ADR-0019 and ch. 4).
* The app boots via the `lifespan` context manager in `main.py`: it optionally
  inits Sentry, starts the APScheduler (`start_scheduler`), and runs a
  migration dry-run when `RUN_MIGRATIONS_ON_BOOT` is set. Boot is **best-effort
  resilient** — a missing optional dependency logs a warning instead of
  crashing the process (see the many `try/except` router includes in `main.py`).
* Readiness: Cloud Run hits `GET /api/ready`, which does a real Firestore
  round-trip and returns 503 until the DB is reachable. Liveness is
  `GET /api/live`.
* **Cold-start budget:** `min-instances=1`, `cpu-throttling=no`. Boot must stay
  under ~1.5s. If a deploy makes the image heavier, the cold-start runbook
  (`docs/runbooks/cloud-run-cold-start.md`) is how you find it.

**Deploy:** merge to `main`. The workflow builds, deploys a new revision with
no traffic, smoke-checks it, then shifts traffic. For the manual path and the
exact commands, see `docs/runbooks/deploy.md`.

**Roll back:** traffic-shift to the previous green revision — instant, no
rebuild. See `docs/runbooks/rollback.md`.

### 3.2 Frontend → Vercel

* Build is driven by `vercel.json`:
  `cd frontend && npm install --legacy-peer-deps && npm run build`, output
  `frontend/dist`.
* `/api/:path*` is rewritten to the Cloud Run URL (`${CLOUDRUN_URL}`), so the
  browser sees a same-origin API.
* `--legacy-peer-deps` is **required** — the dependency graph has known peer
  conflicts (see the i18n/PWA upgrade notes in `CLAUDE.md`). Removing it breaks
  the Vercel build. This is captured in ADR-0020.
* Roll back via the Vercel dashboard or `vercel rollback <prev-url>`
  (DISASTER_RECOVERY.md §4.5).

### 3.3 Firestore rules + indexes → `zoho-83cda`

* Workflow: `.github/workflows/deploy-firestore.yml`, triggered when
  `firestore.rules` or `firestore.indexes.json` changes.
* It verifies indexes and TTL first (`tools/verify_firestore_indexes.py`,
  `tools/verify_firestore_ttl.py`), then
  `firebase deploy --only firestore:rules,firestore:indexes --project zoho-83cda`.
* **This is a security-sensitive deploy.** A bad rules change can expose tenant
  data. Two approvals required; verify in the Firebase console rules
  playground before merge for non-trivial changes.

### 3.4 Marketing → Vercel (separate project)

* `marketing/` is an Astro static site with its own CI
  (`.github/workflows/marketing-ci.yml`) and Vercel project. It never imports
  from `frontend/`.

---

## 4. Secret access

### Where secrets live

* **Production:** Google Secret Manager in the **compute project**. Cloud Run
  mounts them as env vars (`--update-secrets` / `--set-secrets`). The app reads
  them through `backend/app/config.py` (`Settings`, pydantic-settings).
* **CI:** GitHub Actions secrets (`GCP_WIF_PROVIDER`, `GCP_SA_EMAIL`,
  `GCP_PROJECT_ID`, `VERCEL_TOKEN`, …). No secret values in workflow YAML.
* **Local dev:** a `backend/.env` (gitignored). Start from
  `backend/.env.example`. Development defaults are intentionally insecure and
  `validate_env()` will **warn** locally and **hard-fail** in production.

### The secrets that matter

| Secret | Purpose | Rotation |
|---|---|---|
| `SECRET_KEY` | Signs all JWTs (HS256). Rotating it logs everyone out. | Quarterly + on suspected compromise |
| `FIELD_ENCRYPTION_KEY` (+ `_PREVIOUS`) | Fernet key for PII-at-rest. `_PREVIOUS` enables zero-downtime rotation. | Quarterly |
| `FIREBASE_CREDENTIALS_PATH` / ADC | Firestore Admin SDK auth. In Cloud Run, prefer Workload Identity (ADC). | n/a (identity, not a key) |
| `STRIPE_SECRET_KEY` | Stripe API (SaaS billing) | Per Stripe guidance / on compromise |
| `STRIPE_WEBHOOK_SECRET` | Verifies inbound Stripe webhooks (ch. 10) | On endpoint re-creation |
| `RATE_LIMIT_STORAGE_URI` | Redis URI for cross-instance rate limits | On Memorystore recreate |

### Rules of secret access

1. **Least privilege.** Only `gcp-admins@` (ch. on IAM, T-SF.1.16) can read
   production secrets. Engineers do not routinely need them — the app reads
   them, you don't.
2. **Never log a secret.** `Settings.__repr__` redacts `SECRET_KEY` by design;
   `services/auth.py` documents that the key is never written to logs or
   responses. Follow that pattern for any new secret.
3. **Never paste a secret into Slack, a PR, an ADR, or a ticket.** If you do, it
   is compromised — rotate it (`scripts/rotate-secret.sh`) and tell on-call.
4. **Rotation is scripted.** `scripts/rotate-secret.sh --secret <NAME>` adds a
   new Secret Manager version and rolls Cloud Run. See
   `docs/runbooks/secret-rotation.md` and `docs/security/secret-rotation.md`.
5. **Access is audited.** Secret Manager access logs are reviewed during the
   weekly IAM audit (`scripts/ops/iam-leaver-audit.py`, T-SF.1.17) and after any
   incident.

---

## 5. Customer-data access

Customer data is the company. Treat read access as a privilege with a paper
trail, not a convenience.

### Principle: the app accesses data, humans rarely do

The normal path to any tenant's data is **through the product** as that tenant
— never by querying Firestore directly. Direct console access to `zoho-83cda`
production data is reserved for incident response and is logged.

### Support impersonation (the sanctioned path)

When support genuinely needs to see what a customer sees, use the **admin
impersonation** flow (`backend/app/api/admin/impersonate.py`, RFC 8693 token
exchange), not a raw DB read. It is deliberately constrained:

* Impersonation tokens are **read-only**: `read_only_mode_middleware` rejects
  any mutating method on an impersonation token (`backend/app/main.py` wires it
  right after the audit middleware).
* Every impersonated request is audited by `impersonation_audit_middleware` —
  including blocked mutation attempts.
* The customer-facing org-suspension check in `get_current_user` honours the
  `impersonating` claim so support can still help a suspended tenant.

### Direct Firestore access (break-glass only)

Reading production Firestore by hand is a **break-glass** action:

1. There must be an active incident or an explicit, logged customer request.
2. Announce it in `#incident` / `#ops` before you do it.
3. Use the least-scoped query; never export an entire collection to your
   laptop.
4. Console reads are themselves logged in `zoho-83cda` Cloud Audit Logs and
   reviewed weekly.

### PII, encryption, export, and deletion

* **Encryption at rest:** sensitive fields are encrypted with Fernet via the
  `ENCRYPTED_FIELDS` repository hook (`FIELD_ENCRYPTION_KEY`). See
  `docs/security/pii-handling.md`.
* **GDPR export:** `backend/app/api/admin/exports.py` +
  `backend/app/services/gdpr_service.py`.
* **GDPR delete (Article 17):** `request_user_deletion()` anonymises PII
  immediately (name → `Deleted User <hash>`, email/phone/`totp_secret` → null)
  and schedules a **hard delete after a 30-day grace period**. The
  `gdpr_hard_delete_grace` APScheduler job (`scheduler.py`, daily 03:00) runs
  `hard_delete_due_users()`.
* **Firestore rules are defence-in-depth:** even if the API had a bug,
  `firestore.rules` denies any client read where `request.auth.token.org_id`
  doesn't match the document's `org_id`, and HR/payroll/audit collections add
  role guards on top (ch. 9, ch. 11).

---

## 6. On-call

Full policy: [`docs/oncall/escalation-policy.md`](../oncall/escalation-policy.md)
and [`docs/oncall/rotation.md`](../oncall/rotation.md). The essentials:

### Rotation

* **3-engineer rotation**, one week each, **handoff Sunday 00:00 Baghdad time**.
* Primary carries the pager; secondary is the backup; the founder is the final
  human layer until the Ops/SRE transfer (T-SF.1.6) completes.
* Holidays/PTO handled via the paging tool's override feature — never leave the
  pager unattended.

### Paging platform

* **PagerDuty** (ADR-0101 in the spec; SMS reliability into Iraq was the
  deciding factor over Opsgenie).
* Alert policies feed PagerDuty from Cloud Monitoring and Sentry.

### Escalation (4 layers)

| Layer | Who | When |
|---|---|---|
| 0 | Primary on-call | Immediately |
| 1 | Secondary on-call | +10 min unacked |
| 2 | Founder | +15 min after L1 |
| 3 | Founder voice + WhatsApp | +30 min after L1 |

### What pages you

P1/SEV-1 conditions page immediately: API down, POS can't take payments,
Firestore unavailable, auth failing broadly, billing webhook failing. Lower
severities are ticketed (see ch. 7 severities). Each alert links to the
matching runbook in `docs/runbooks/`.

### The on-call contract

* Acknowledge within the layer window. If you can't, let it escalate — that's
  the system working.
* Open the linked runbook **first**. Runbooks are the institutional memory; if
  one is wrong or missing a step, fix it in the post-incident PR.
* "Doc-hygiene Friday": 30 min where on-call closes stale notes and reviews any
  runbook touched that week.

---

## 7. Incident response

The authoritative SEV-1 procedure is [`DISASTER_RECOVERY.md`](../../DISASTER_RECOVERY.md).
This chapter is the everyday operating model that sits above it.

### Severities

| Severity | Definition | First response |
|---|---|---|
| **SEV-1 / P1** | Customer-impacting outage; service unavailable; data-integrity risk. | Page on-call; bridge in 10 min; founder informed in 30 min. Triggers `DISASTER_RECOVERY.md`. |
| **SEV-2 / P2** | Degraded service; a major feature down; no data-integrity risk. | Page on-call; bridge in 30 min. Use the per-component runbook. |
| **SEV-3 / P3** | Single-tenant impact or latent risk (e.g. expiring cert). | Ticketed; same business day. |

### Roles on a SEV-1 bridge

* **Incident Commander (IC)** — runs the bridge, makes go/no-go calls. Not
  necessarily the most senior; the calmest.
* **Operator** — the only person typing production commands.
* **Scribe** — minute-by-minute log in `audit/incidents/<date>-<topic>.md`.
* **Comms** — customer-facing updates (status page, in-app banner, email).

### First 15 minutes

1. Post `#incident sev=<n> ts=<utc>` in Slack.
2. Open the Cloud Monitoring incident dashboard + Sentry.
3. Assign IC / Operator / Scribe / Comms.
4. Classify the failure class (Cloud Run / Firestore / Vercel / Redis / DNS /
   billing) and open the matching runbook.
5. Decide: isolated rollback vs region failover vs wait.

### Diagnostics you'll reach for

* `GET /api/health` and `GET /api/ready` — service + DB reachability.
* `GET /api/version` — running git SHA / build, so you know what's deployed.
* `GET /api/metrics/routes?sort=max` — per-route latency aggregates (process
  local; `main.py`).
* `GET /api/jobs` — APScheduler job-run history (`job_runs` collection) for
  scheduler incidents.
* Sentry for exceptions; Cloud Logging filtered by `X-Request-Id`
  (the `RequestIDMiddleware` stamps it on every log line).

### After the incident (within 48h)

1. Scribe finalises the incident log.
2. IC writes a **blameless postmortem** in `audit/incidents/postmortems/`.
3. Action items become GitHub issues labelled `incident-followup`.
4. The runbook used is reviewed and corrected.

---

## 8. Refund authorization

Refunds move money out. They are gated in code, and the gate has a policy
behind it. There are **two distinct refund surfaces** — keep them separate.

### 8.1 Customer payment refunds (tenant → their buyer)

These are refunds a tenant issues against payments they collected via the
tenant-side payment gateways (`backend/app/payments/`).

* **API:** `POST /api/payments/{id}/refund` (`backend/app/api/payments.py`).
* **Adapter:** each gateway implements `refund()` on the `PaymentGateway`
  protocol (`payments/gateway.py`). `cash` and `stripe` are fully implemented;
  the Iraqi gateways (`fastpay`, `qi`, `zain_cash`, `asia_pay`) raise
  `NotImplementedError` pending credentials (ADR-0015, R7.x).
* **Authorization:** POS refunds require the `pos.refund` permission
  (`services/permissions.py`). A plain cashier (`pos_cashier`) **cannot**
  refund; `pos_manager` / `pos_admin` can. Non-POS refund paths require the
  relevant module write permission.
* **Idempotency:** refund endpoints are under the `/api/payments/` idempotency
  prefix (`middleware/idempotency_http.py`) — a retried refund with the same
  `Idempotency-Key` and body returns the original result, never a double
  refund. A reused key with a *different* body returns HTTP 409.
* **Audit:** the audit middleware logs the mutation; the reconciliation job
  (`payments_reconciliation_nightly`) will surface any provider/ledger
  mismatch the next night.

### 8.2 SaaS billing credits (us → a tenant)

Refunding a tenant's subscription payment is a **founder-authorized** action,
not a self-serve one.

* It is performed through Stripe (dashboard or a super-admin endpoint in
  `backend/app/api/saas_admin.py`), which then emits webhook events we ingest
  (ch. 10).
* Authorization: super-admin only (`_require_platform_admin` /
  `platform.manage`). Tenant-facing billing endpoints (`saas_billing.read/write`,
  `settings.billing`) can change plan / cancel, **but cannot issue a refund.**

### Policy (the human part)

* **Who can authorize:** payment refunds — a POS/store manager with
  `pos.refund` for in-store, or the founder for SaaS credits. **Two-person rule
  for any refund above the tier set in `audit/finance/refund-policy.md`** (to be
  filled by Finance, T-SF.2.x).
* **Always leave a reason** in the refund note. The audit log + reconciliation
  queue make every refund reviewable.
* **No refund without a matching original charge.** The gateways enforce this;
  do not work around it with a manual ledger entry.

---

## 9. RBAC — roles & permissions

Authoritative source: `backend/app/services/permissions.py`. Client-side gating
mirrors it via `usePermission` / `useFeatureFlag`, but **the server is the
enforcement point** — never trust the client.

### The model

* A permission is a string `"<module>.<action>"`, e.g. `invoices.create`,
  `pos.refund`. Actions are `create | read | update | delete` plus meta
  permissions (`rbac.manage`, `audit.view_all`, `settings.billing`,
  `platform.manage`, the quick-create codes, etc.).
* **Wildcards:** `"*"` grants everything; `"<module>.*"` grants a whole module.
  Legacy roles `admin` / `owner` / `super_admin` resolve to `{"*"}`.
* **Default roles** are defined in `DEFAULT_ROLES` (administrator, accountant,
  sales, purchaser, inventory, hr_manager, hr_employee, project_manager,
  cashier, pos_cashier, pos_manager, pos_admin, viewer, platform_admin). Each
  ships with a Kurdish display name.
* **Custom roles** live per-org in Firestore (`RoleRepository`,
  `UserRoleRepository` in `app/api/rbac.py`). A user's effective permissions are
  the union of their legacy `role` mapping and their assigned RBAC roles
  (`get_user_permissions`).

### Aliases (the part that bites people)

`user_has_perm` expands codes before checking:

* **Action aliases:** `write` satisfies `{write, create, update}`; `create`
  also matches `write`; `update` also matches `write`.
* **Module aliases:** `payroll` ↔ `hr.payroll`; `manufacturing` ↔ `inventory`.

So `require_perm("bank.write")` is satisfied by a role holding
`bank.create`/`bank.update`, and a role with `inventory.read` can read
manufacturing. If a permission check behaves "too permissively," check the
alias tables first.

### Enforcing it in an endpoint

```python
from app.services.permissions import require_perm

@router.post("")
def create_thing(user: dict = Depends(require_perm("things.create"))):
    repo = ThingRepository(user["org_id"])
    ...
```

`require_perm(code)` is a FastAPI dependency: it resolves the current user via
`get_current_user`, calls `user_has_perm`, and raises `403` (with a Kurdish
detail) if denied. Module access is gated separately by
`require_module(...)` (the `module_gate` middleware + dependency), so an
endpoint can require *both* an enabled module and a permission.

### When you add a permission

1. Add the code to `ALL_PERMISSIONS` in `permissions.py`.
2. Grant it in the relevant entries of `DEFAULT_ROLES`.
3. Keep the code identical to the frontend's expectation (the quick-create codes
   are deliberately matched to `frontend/src/data/quickCreateRegistry.ts`).
4. Add a test under `backend/tests/` asserting 403 for a role without it.

---

## 10. Billing webhook (Stripe)

SaaS subscription state is reconciled from Stripe via a single webhook.
Source: `backend/app/api/saas_billing.py` (`POST /api/saas-billing/webhooks/stripe`)
and `backend/app/billing/stripe.py`.

### Contract

* **Signature is verified first.** `stripe_billing.verify_webhook(payload,
  sig_header)` calls `stripe.Webhook.construct_event` with
  `STRIPE_WEBHOOK_SECRET`. A bad/missing signature returns **HTTP 400** so a
  misconfigured endpoint surfaces immediately.
* **If Stripe isn't configured** (`StripeNotConfigured`), the endpoint returns
  **200 `stripe-not-configured`** — webhook ingress must never 500 just because
  billing isn't wired in an environment.
* **Unknown event types return 200** (`{"ok": true, "ignored": <type>}`).
  Stripe retries 4xx forever; we ack everything we don't act on.
* **Events we act on** (`SUPPORTED_EVENTS`):
  * `customer.subscription.created` / `.updated` → write
    `stripe_subscription_id`, mapped status, period bounds,
    `cancel_at_period_end`.
  * `customer.subscription.deleted` → status `cancelled`.
  * `invoice.payment_succeeded` → `repo.record_payment(...)` (advances the
    billing period, sets `payment_method_type=card`).
  * `invoice.payment_failed` → status `past_due` (the dunning engine takes it
    from here — `billing/dunning.py`, ADR-0008 in the spec).
* **Tenant resolution.** We read `tenant_id` from event metadata; in this
  codebase `tenant_id == org_id`. If the event arrives before we've stored the
  Stripe customer↔tenant mapping, we **ack with `{"deferred": true}`** and let
  nightly reconciliation fix it — we never guess.

### Operating it

* The webhook endpoint URL and `STRIPE_WEBHOOK_SECRET` are configured in the
  Stripe dashboard and Secret Manager. Re-creating the endpoint mints a new
  secret — rotate it (ch. 4).
* Failures (rising 4xx/5xx, or Stripe's dashboard showing retries) are a **P2**
  and have a dedicated runbook: `docs/runbooks/billing-webhook-failure.md`.
* **Money never moves from a webhook handler.** The handler only *reflects*
  Stripe's state into our `TenantBilling` document. The source of truth for SaaS
  payments is Stripe.

---

## 11. Firestore data model

We are on Firestore by deliberate choice (ADR-0001). Understand the repository
layer (`backend/app/firestore/base.py`) and you understand 90% of the backend.

### Every document carries these fields

`BaseRepository.create()` stamps:

| Field | Meaning |
|---|---|
| `org_id` | Tenant owner. **Set by the server, never the client.** (ch. 12) |
| `created_at` / `updated_at` | UTC datetimes. |
| `_version` | Optimistic-concurrency counter, starts at 1. |
| `schema_version` | For lazy migrations (`SCHEMA_TARGET_VERSION`). |
| `is_active` | Defaults true. |
| `deleted_at` | Present ⇒ soft-deleted; `is_deleted` is derived from it. |

### Collection shape

* Two physical shapes coexist (see `firestore.rules`):
  1. **Nested** `organizations/{orgId}/<collection>/{docId}` — legacy and
     client-subcollection writes.
  2. **Flat root** `<collection>/{docId}` with an `org_id` field — the
     production default, matching the Python `BaseRepository`.
* **Line items are subcollections.** Invoices, quotes, orders, journal entries
  keep their lines under `.../lines/{lineId}` (`get_lines`/`set_lines`,
  ordered by `sort_order`).
* **Global, read-only collections** like `currencies` sit outside
  `organizations/` and are writable only by backend seed.

### Repository behaviours you must know

* **Reads are cached.** `get()` checks the cache facade first and *verifies
  `org_id` matches* before returning — a cross-tenant cache hit is treated as a
  miss (ch. 12). Writes invalidate the cache key.
* **Optimistic concurrency.** `update_versioned(doc_id, data, expected_version)`
  runs a Firestore transaction, compares `_version`, and raises
  `VersionConflict` (→ HTTP 409) on a stale write. Core document PUTs accept
  `If-Match: W/"<version>"`.
* **Soft delete by default.** `delete()` sets `deleted_at` and soft-cascades
  invoice/journal lines; `hard=True` actually removes. Reference guarding
  (`reference_guard`) blocks deleting something still in use (raises
  `ReferenceConflict`).
* **List has a hard cap.** `list()`/`_fetch_org_docs_capped()` cap at
  `LIST_HARD_CAP` and set `last_list_meta` (`truncated` / `degraded`). For full
  scans (jobs, backups) use `stream_org_docs()`, which paginates without the cap.
* **Quota resilience.** On a Firestore quota error, reads fall back to cache and
  set `degraded=True` rather than throwing.
* **Document-size guard.** Writes over ~600KB warn and over ~950KB raise — stay
  well under Firestore's 1MB document limit.
* **Write validation.** A repo may set `WRITE_MODEL` (Pydantic) to validate and
  strip unknown fields. With `GENERIC_WRITE_VALIDATION` on, a generic model
  applies even without a specific one. Server-managed fields (`id`, `org_id`,
  `_version`, `schema_version`, `created_at`, `updated_at`) are always stripped
  from client input.

### Indexes & query discipline

* Every multi-field `.where(...).order_by(...)` query needs a composite index in
  `firestore.indexes.json`.
* CI enforces this: `scripts/audit-firestore-queries.py` AST-walks the API and
  fails the build if a query lacks a matching index.
* Add the index in the **same PR** as the query (ch. 2).

### Scheduled / cross-tenant jobs

Background jobs (`services/scheduler.py`) operate across tenants by streaming
`db.collection("organizations")` and instantiating a repository per `org_id`.
They write run history to the `job_runs` collection via
`JobRunRepository("__system__")`. There are **19 jobs** today (renewals,
dunning, depreciation, daily backup, GDPR hard-delete, e-invoice + e-Fakhata
dispatch, CBI rate refresh, payments reconciliation, audit/soft-delete
retention, …). See ADR-0017 for why APScheduler in-process and not Cloud Tasks.

---

## 12. Multi-tenancy

**One tenant = one `org_id`.** There is no per-tenant database, schema, or
project. Isolation is enforced in **three independent layers**, any one of which
denies a cross-tenant access on its own.

### Layer 1 — JWT carries the tenant

`get_current_user` (`services/auth.py`) decodes the HS256 JWT, requires both
`sub` (user id) and `org_id`, checks the jti denylist, loads the user, and
rejects suspended orgs (honouring the `impersonating` claim). The
`org_context_middleware` lifts `org_id` onto `request.state` early so the
rate-limit and idempotency middleware can scope by tenant before the route runs.

### Layer 2 — the repository scopes every query

You instantiate a repository **with** the tenant: `InvoiceRepository(user["org_id"])`.
From there:

* `create()` ignores any client-supplied `org_id` (`_reject_client_org_id`
  raises if it mismatches) and stamps the server's `org_id`.
* `get()` returns `None` if the loaded doc's `org_id` doesn't match — including
  on a cache hit (the cache is checked for cross-tenant leakage and purged).
* `list()` always filters `where("org_id", "==", self.org_id)`.
* `update_versioned()` re-checks `org_id` inside the transaction.

**The rule for new code:** never accept `org_id` from the request body or query
string. Always derive it from `user["org_id"]`. A code review that sees
`org_id` coming off the client should block the PR.

### Layer 3 — Firestore security rules

`firestore.rules` is the backstop for the client SDK (realtime listeners,
offline POS). Core helpers:

* `belongsToOrg(orgId)` / `tenantDocRead()` require
  `request.auth.token.org_id == <doc/path org_id>`.
* Create requires the **incoming** `org_id` to match the caller's claim
  (`tenantDocCreate` / `hasCorrectOrgId`).
* Sensitive collections add role guards on top of tenancy: `hr_employees`,
  `payroll_runs`, `hr_*` require `isHROrAbove`; `journal_entries`, `accounts`,
  `taxes`, `bank_*` require `isAccountantOrAbove`; `audit_logs` are
  **append-only** (no client create/update/delete, admin read only); `chatter`
  is immutable.
* Everything not explicitly matched is denied (`match /{document=**} { allow
  read, write: if false; }`).

### Things that are NOT per-tenant

* **`SECRET_KEY`** is global — rotating it invalidates *all* tenants' JWTs.
* **Rate-limit Redis** and the **APScheduler** process are shared
  infrastructure. A noisy tenant is contained by the per-org token bucket
  (`RateLimitMiddleware`), not by isolation.
* **`currencies`** and other seed collections are shared, read-only.

### Cross-tenant operations (super-admin)

Platform admins (`platform.manage`, `is_platform_admin`) can operate across
tenants for support and billing (`api/admin/*`, `api/saas_admin.py`). These
paths bypass `require_perm` via explicit platform checks and are the **only**
sanctioned cross-tenant reads — always audited (ch. 5).

### The multi-tenancy test you should be able to pass in your head

> A user with `org_id = A` sends a request that references a document owned by
> `org_id = B`. What stops them?

Answer: the JWT pins them to `A` (L1); the repository filters/verifies on `A`
and refuses to load B's doc, even from cache (L2); and if they went straight to
Firestore from the browser, the rules reject the read because their token's
`org_id` is `A`, not `B` (L3). All three, independently.

---

*Last reviewed: 2026-05-29. Owner: Founder → Ops/SRE Lead. Review cadence:
quarterly, and immediately whenever the code this references changes. If you
changed `main.py`, `permissions.py`, `firestore.rules`, `base.py`,
`scheduler.py`, or the billing webhook and did not update this handbook in the
same PR, you left a bug.*
