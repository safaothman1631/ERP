# Operations Runbook — ERPIQ Production

## Daily Checks

- CI green on `main`
- `GET /api/health` returns 200
- Scheduler jobs running (`GET /api/jobs/status`)
- Backup job success in logs

## Data integrity (weekly)

Dry-run drift detection per production org (exit code 1 if drift):

```bash
cd backend
python scripts/reconcile_org.py --org-id ORG_ID
python scripts/reconcile_org.py --org-id ORG_ID --json
```

Fix denormalized fields only (never deletes documents):

```bash
python scripts/reconcile_org.py --org-id ORG_ID --fix
```

Schedule: weekly cron per org; before major launch run on staging clone first.

### Firestore PITR (production)

1. GCP Console → Firestore → **Disaster Recovery** → enable **Point-in-time recovery**
2. Document RPO/RTO in `DISASTER_RECOVERY.md`
3. Run a restore drill quarterly (non-prod project)

Atomic writes (POS pay, bank tx, payment received) are enforced in API layer — see `.kiro/specs/data-integrity-wave/`.

## Depth remediation (remaining DB work)

Full traceability: `.kiro/specs/firestore-depth-remediation/` and `MASTER_AUDIT_REPORTS/firestore-depth-remediation-2026-05.md`.

Depth remediation waves **O, R, E, A2, P1, S** are implemented (2026-05-26). Industry dashboard stats use `collect_stream` instead of `list(10000)`.

### Warehouse stock on transfer complete

`POST /api/inventory/transfers/{id}/complete` updates **`warehouse_stock`** at source and destination (not only `stock_movements`). Requires both `from_warehouse_id` and `to_warehouse_id` on the transfer. Insufficient source qty returns 400.

### Manufacturing MO done

`POST /api/manufacturing/orders/{id}/done?warehouse_id=` optionally consumes BOM components and receives finished goods into `warehouse_stock` in one transaction.

### Monitoring (weekly)

| Check | Command / signal |
|-------|------------------|
| Org drift | `python scripts/reconcile_org.py --org-id ORG` |
| List truncation | Cloud Logging: `list_truncated` or API `meta.truncated` |
| Degraded reads | API responses with `meta.degraded: true` |
| Org counters | Dashboard load refreshes `org_counters/{orgId}` if stale |
| PITR drill | See `DISASTER_RECOVERY.md` quarterly checklist |

### Staging flags (enable after index build)

- `SEARCH_PREFIX_ENABLED=true` — smoke `GET /api/search?q=`
- `RATE_LIMIT_STORAGE_URI` — Redis-backed rate limits (see `docs/architecture/REDIS_RATE_LIMIT.md`)

### Deprecated env file

Do not use root `cloudrun-env.yaml` for deploy. Use **`cloudrun-deploy-env.yaml`** (`FIREBASE_PROJECT_ID=zoho-83cda`, `USE_FIRESTORE_QUERY=true`).

## Firestore performance & topology

| Item | Value |
|------|--------|
| Firestore project | `zoho-83cda` (location `eur3`) |
| Cloud Run | `erp-system-494716` / `europe-west1` / service `zoho-erp` (CI deploy uses `cloudrun-deploy-env.yaml`) |
| List cap | 10,000 docs per `list()` — watch logs for `list_truncated` |
| Quota | Empty lists may include `meta.degraded: true` |
| Server-side query | Set `USE_FIRESTORE_QUERY=true` in Cloud Run env for cursor-friendly lists |
| Indexes | `python tools/verify_firestore_indexes.py` before deploy |
| Counters | `org_counters/{orgId}` refreshed on dashboard if missing |
| Soft-delete purge | `python scripts/purge_soft_deleted.py --org-id ORG --apply` (30d) |
| Rate limit | In-memory per instance; set `RATE_LIMIT_STORAGE_URI` for Redis (see `docs/architecture/REDIS_RATE_LIMIT.md`) |
| Region check | `python tools/verify_region_alignment.py` → `audit/REGION_ALIGNMENT.md` |
| Firestore audit | `python tools/firestore_audit.py` → `audit/FIRESTORE_AUDIT.md` (CI on every build) |
| Prefix search | `SEARCH_PREFIX_ENABLED=true` after index deploy — `GET /api/search?q=` |

Default bank reconcile: all transactions (not reconciled-only). Use `--reconciled-only` for stricter ops audits.

## Pre-launch ops (one-shot before GO)

Three phases — full checklist in `LAUNCH_DECISION.md`.

```powershell
# Phase 1 — Firestore indexes + TTL (project zoho-83cda)
.\scripts\prelaunch_ops.ps1 -Phase firestore

# Phase 2 — staging backup + reconcile + API smoke
.\scripts\prelaunch_ops.ps1 -Phase staging -OrgId YOUR_ORG `
  -BaseUrl https://zoho-erp-i43i2clqva-ew.a.run.app -Email demo-manager@zohoerp.example.com -Password Demo@2026

# Phase 3 — Redis rate limit on Cloud Run (if >1 instance)
$env:REDIS_URI='redis://10.0.0.3:6379/0'
bash scripts/setup_redis_rate_limit_secret.sh
.\scripts\prelaunch_ops.ps1 -Phase redis
```

GitHub: **Actions → Pre-launch ops (Firestore + drill + Redis check)** with inputs `org_id`, `base_url`.

## Deploy

1. Merge to `main` → CI (`ci.yml`) must pass
2. Deploy workflow (`deploy-cloudrun.yml`) runs after CI
3. Verify `/api/health` and frontend login

## Incident Response

| Symptom | Action |
|---------|--------|
| 5xx spike | Check Cloud Run logs, rollback revision |
| Auth failures | Verify `SECRET_KEY`, Firebase project |
| POS sync duplicates | Check `idempotency_keys` collection |
| e-invoice stuck | `GET /api/einvoice/queue`, check `einvoice_dispatcher` job |

## Secrets Rotation

- `SECRET_KEY`, `FIELD_ENCRYPTION_KEY`: rotate with dual-key period using `FIELD_ENCRYPTION_KEY_PREVIOUS`
- Run `python scripts/migrate_pii_encryption.py --apply` after key rotation

## Monitoring

- Sentry: set `SENTRY_DSN` in Cloud Run env
- Metrics: `GET /api/metrics` (internal)

## Module licensing (vendor provisioning)

Provision a POS-only customer org:

```bash
cd backend
python scripts/set_org_license.py --org-id ORG_ID --bundle pos_only
```

Set platform admin allowlist (comma-separated user IDs):

```bash
export PLATFORM_ADMIN_USER_IDS=vendor-user-id-1,vendor-user-id-2
```

Vendor UI: `/platform/orgs` (requires `platform.manage`).

Org admin approves user module requests at `/settings/module-requests`.

### Super admin / platform vendor

Promote a user to super admin (Firestore + platform RBAC):

```bash
cd backend
python scripts/promote_super_admin.py --email user@example.com
```

Set allowlist (comma-separated user IDs):

```bash
export PLATFORM_ADMIN_USER_IDS=695c9149-f591-430d-9b8f-282e454e8878
```

Super admin console UI: `/platform` (dashboard, orgs, licenses, module queue, users, audit, health, flags).

**Vendor operations (not tenant Settings):** use the platform console for global feature-flag rollout (`/platform/feature-flags`), cross-org infra health (`/platform/health`), and org license editing (`/platform/orgs/:id`). Tenant `/settings` is org-scoped and module-gated only — see `docs/settings/SETTINGS.md` (Tenant vs Platform Settings).

Impersonation (support): set `PLATFORM_IMPERSONATION_ENABLED=true` in dev only; use **Enter organization** on org detail.

User must **log out and log in again** after promotion to land on `/platform`.

## Role-adaptive tenant UX

Tenant users see a **role-specific** dashboard, nav profile, and glass accent — not a one-size-fits-all UI.

| Role | First route after login | UI accent |
|------|-------------------------|-----------|
| `owner` | `/dashboard` | Gold executive |
| `admin` | `/dashboard` | Blue administrator |
| `sales` / `sales_rep` | `/crm/leads` | Sales blue |
| `viewer` | `/dashboard` | Read-only gray (no create CTAs) |
| `super_admin` | `/platform` | Indigo platform console |

**API:** `GET /api/rbac/me/summary` — returns `role`, `permissions`, `persona.theme_id`, `persona.default_route` for the signed-in user.

**Support / demo:** Create separate test accounts per role; vendor uses `super_admin` only. Impersonation shows amber role chip in tenant shell.

**Docs:** `docs/ux/ROLES.md`, `docs/ux/GLASS.md`. Audit modals: `cd frontend && npm run audit:glass-modals`.

## Shopkeeper manual day (AC-5) — دوکاندار

پێش وەسڵکردنی tenantێکی نوێ، ئەم ڕێڕەوە بە دەست یەک جار لە staging جێبەجێ بکە:

1. **Onboarding:** تەنها مۆدڵەکان چالاک بکە: `accounting`, `sales`, `purchase`, `inventory`, `banking`, `taxes`, `pos`.
2. **کڕین:** PO دروست بکە → GRN بنێرە → Bill لە PO → Approve (3-way match).
3. **فرۆشتن/قەرز:** Invoice بۆ کڕیار → Payment Received → `aged-receivables` بپشکنە.
4. **POS:** Session بکەرەوە → فرۆشتن + pay → داخستن (cash count) → Z-report.
5. **بانک:** CSV import → reconciliation-summary → match invoice (`create_payment`).
6. **ئەکاونتانت:** JE balance script: `python scripts/accounting_balance_check.py`.

ئۆتۆماتیک:

```bash
cd backend && pytest tests/test_pos_inventory_qty.py tests/test_shopkeeper_core_flow.py tests/test_banking_reconciliation_summary.py tests/test_pos_accounting.py tests/test_bank_match_payment.py tests/test_shopkeeper_api_integration.py -q
cd frontend && npx vitest run src/pos/__tests__/posOfflineQueue.test.ts
cd frontend && cp .env.e2e.example .env.e2e   # edit URLs + E2E_EMAIL/PASSWORD
cd frontend && npm run e2e:shopkeeper
```

## Schema migrations (database-foundation-excellence)

Boot-time registry check (dry-run by default):

```bash
# Cloud Run env
RUN_MIGRATIONS_ON_BOOT=true
APPLY_MIGRATIONS_ON_BOOT=false   # first deploy: report only
```

Bulk upgrade one collection:

```bash
cd backend
python scripts/migrate_collection.py --collection contacts --org-id ORG_ID --dry-run
python scripts/migrate_collection.py --collection contacts --org-id ORG_ID --apply
```

Seeds (idempotent):

```bash
python scripts/seed_chart_of_accounts.py --org-id ORG_ID
python scripts/seed_iraq_taxes.py --org-id ORG_ID
python scripts/seed_demo_org.py --org-id ORG_ID --months 12
```

Orphan + reconcile gate:

```bash
python scripts/check_orphans.py --org-id ORG_ID
python scripts/reconcile_org.py --org-id ORG_ID
```

