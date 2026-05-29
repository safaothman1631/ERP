# Launch Decision — production_core (Accounting + Sales + Inventory + POS + Iraq)

**Date:** 2026-05-25  
**Scope:** Wave A–D scaffold modules **deferred**; depth on core ERP paths.

## Checklist

| Area | Status | Evidence |
|------|--------|----------|
| Phase 0 baseline | ✅ | 583+ pytest, endpoint audit documented |
| Phase 1 accounting | ✅ | JE balance, period lock, aged AR/AP, reverse JE |
| Phase 2 security | ✅ | RBAC sweep, field encryption, audit hash chain, GDPR delete |
| Phase 3 ops | ✅ | SO/PO state machines, 3-way match on bill approve, lot allocate API |
| Phase 4 POS/Iraq | ✅ | POS sync idempotency + stock check, Iraq payroll auto-compute, SS-1, payment webhooks |
| Phase 5 platform | ✅ | ChatterWidget, React Query lists, DevOps region + CI gate |
| Phase 6 verification | ✅ | Scenario E2E specs, load test scaffold, DR runbook |

## Test Summary

```bash
cd backend && pytest tests/ -q
cd frontend && npm run build && npx tsc --noEmit
cd frontend && npx playwright test e2e/scenarios/
```

## Shopkeeper addendum (2026-05-26)

Wave A P0 fixes for retail SMB (purchase, sales/debt, POS, GL, banking): see `.kiro/specs/shopkeeper-production-core/` and `MASTER_AUDIT_REPORTS/shopkeeper-p0-fixes-2026-05.md`.

## Data Integrity Wave (2026-05-26)

Trust layer for Firestore: tenant `get()` guard, atomic POS/bank/AR payments, `reconcile_org.py` CLI.

- Spec: `.kiro/specs/data-integrity-wave/`
- Report: `MASTER_AUDIT_REPORTS/data-integrity-wave-2026-05.md`

**Launch gate (add to sign-off):**

1. `pytest` green including `test_repository_org_guard`, `test_reconcile_org`, shopkeeper suite
2. `python scripts/reconcile_org.py --org-id <staging-org>` dry-run — zero drifts or documented fixes applied
3. Firestore PITR enabled on production project (ops checkbox)

## Database Foundation Excellence (2026-05-26) — COMPLETE

Spec: `.kiro/specs/database-foundation-excellence/` · Gap matrix: `.kiro/specs/database-foundation-excellence/gap-matrix.md`

**Shipped:** Waves V, S, C, R, T, A, I, E, B, O, D, N, Q, M, K (core). **786+** pytest green.

**Pre-launch ops (3 phases — automated + sign-off):**

| Phase | P | What | How |
|-------|---|------|-----|
| **1 Firestore** | P0 | Indexes + TTL on `zoho-83cda` | `.\scripts\prelaunch_ops.ps1 -Phase firestore` or GitHub **Pre-launch ops** → `firestore` |
| | P0 | TTL manifest in repo | `python tools/verify_firestore_ttl.py` (CI on every deploy) |
| | P0 | Live TTL in GCP | `python tools/verify_firestore_ttl_gcloud.py` or Console → Firestore → TTL |
| | P1 | Index drift | `python tools/verify_firestore_indexes.py` |
| **2 Staging drill** | P0 | Backup exists | `BACKUP_GCS_BUCKET=... python backend/scripts/verify_latest_backup.py` |
| | P0 | Reconcile org | `python backend/scripts/reconcile_org.py --org-id <ORG>` |
| | P0 | HTTP smoke | login + trial balance + invoices: `prelaunch_smoke.py` (wired in `backup_restore_drill.py`) |
| | P0 | One command | `.\scripts\prelaunch_ops.ps1 -Phase staging -OrgId <ORG> -BaseUrl <URL> -Email ... -Password ...` |
| | P1 | Orphans | `python backend/scripts/check_orphans.py --org-id <ORG>` |
| **3 Redis / prod** | P0 | Multi-instance rate limit | Secret `redis-rate-limit-uri` + `scripts/setup_redis_rate_limit_secret.sh` |
| | P0 | Verify on Cloud Run | `.\scripts\prelaunch_ops.ps1 -Phase redis` or workflow phase `redis` |
| | P1 | Env on deploy | `cloudrun-deploy-env.yaml` (`IDEMPOTENCY_ENABLED`, `FS_METRICS_ENABLED`, …) |

**GitHub Actions (recommended):** `.github/workflows/prelaunch-ops.yml` — needs secrets: `FIREBASE_TOKEN`, `GCP_WIF_*`, `BACKUP_GCS_BUCKET`, optional `STAGING_SMOKE_EMAIL` / `STAGING_SMOKE_PASSWORD`.

**Sign-off table (2026-05-26 automated run):**

| Phase | Owner | Date | Pass? |
|-------|-------|------|-------|
| 1 Firestore deploy + TTL live | agent | 2026-05-26 | ✅ `firebase deploy` + `verify_firestore_ttl_gcloud.py` |
| 2 Staging drill + smoke | agent | 2026-05-26 | ✅ backup + reconcile 0 drift; prod smoke `prelaunch_smoke.py` (login/rbac/accounts/contacts) — run `scripts/run_prelaunch_smoke_x3.ps1` **sequentially** (90s gap); TB optional `--with-trial-balance` (slow on demo org) |
| 3 Redis URI on `zoho-erp` | agent | 2026-05-26 | ✅ Traffic revision `zoho-erp-00036+` with `RATE_LIMIT_STORAGE_URI=redis://10.89.110.3:6379/0?socket_connect_timeout=2&socket_timeout=2` (required — bare URI blocks login) |

**Prod URL:** `https://zoho-erp-i43i2clqva-ew.a.run.app` · **Demo login:** `demo-manager@zohoerp.example.com` / `Demo@2026` (see `.env.e2e`)

**Launch gate:** Phase 1 + 2 required for “no critical DB issues”; Phase 3 required when Cloud Run `max-instances` > 1.

**Test count:** 794+ pytest green (2026-05-26).

## Firestore Depth Remediation (2026-05-26) — COMPLETE

Spec: `.kiro/specs/firestore-depth-remediation/`  
Report: `MASTER_AUDIT_REPORTS/firestore-depth-remediation-2026-05.md`

**Shipped:** Waves O, Ix, R, E, A2, P1, **S** (industry scaffold stats → `collect_stream`). Cloud Run revision on `europe-west1`.

**Launch gate:**

1. Wave O deploy: `europe-west1` + `cloudrun-deploy-env.yaml` + indexes on `zoho-83cda` ✅
2. `reports.py` zero `list(10000)` ✅
3. Weekly reconcile on prod orgs (see `OPERATIONS_RUNBOOK.md`)
4. Bill payment + JE single transaction when GL accounts configured (`create_payment_made_with_je_atomic`)

## Firestore Performance Wave (2026-05-26)

Spec: `.kiro/specs/firestore-performance-resilience/`

- List meta (`truncated`, `degraded`), `stream_org_docs`, reconcile streaming
- Indexes aligned (`stock_movements`), `tools/verify_firestore_indexes.py` in CI
- PO receive atomic, bank match → atomic payment, org_counters on dashboard
- Enable `USE_FIRESTORE_QUERY=true` when ready for production cursor lists

Verification:

```bash
cd backend && pytest tests/test_pos_inventory_qty.py tests/test_shopkeeper_core_flow.py tests/test_banking_reconciliation_summary.py -q
cd frontend && npx vitest run src/pos/__tests__/posOfflineQueue.test.ts
cd frontend && npx playwright test e2e/scenarios/shopkeeper_core.spec.ts
```

## Known Limitations (accepted for v1)

- Wave industry modules (healthcare, helpdesk, etc.) remain scaffold-only
- FIB/Zain Cash use stub redirect URLs until merchant credentials configured
- e-invoice uses preview/stub ITA until production portal URL + XSD bundle wired
- Full Odoo parity (3500+ endpoints) out of scope

## Decision

**GO** for controlled production launch with `production_core` scope, pending:

1. Production Firebase + Cloud Run env secrets configured
2. `FIELD_ENCRYPTION_KEY` set in production
3. Smoke test on staging with real org data clone

**Sign-off roles:** Engineering lead, Product owner, Ops
