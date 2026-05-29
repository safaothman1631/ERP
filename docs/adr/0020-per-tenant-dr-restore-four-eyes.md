# ADR 0020 — Per-tenant DR restore with four-eyes approval + diff preview

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Ops/SRE, Security review |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | `.kiro/specs/scale-foundation` §SF3 (T-SF.3.7, T-SF.3.8); `scripts/dr/restore-tenant.sh`; `backend/app/api/admin/dr_restore.py`; `backend/app/services/dr_restore_service.py`; `frontend/src/platform/pages/DrRestorePage.tsx`; `DISASTER_RECOVERY.md`; ADR-0001 (Firestore multi-tenancy) |

## 1. Context

The platform is **single Firestore project, many tenants**, every document
scoped by `org_id` (ADR-0001). Firestore-native PITR and full exports restore
the **whole database** — useless when exactly one tenant corrupts or deletes
their own data and the other tenants must not be rolled back. We need a
**selective, per-tenant** restore.

A per-tenant restore is also dangerous: it writes to the live `(default)`
database, scoped to one org. A single operator with a typo in the `org_id`
could overwrite the wrong tenant. Restore is a high-blast-radius action that
must not be a one-person, one-click operation.

## 2. Decision

Ship per-tenant restore as a **two-control** capability:

1. **Tooling (`scripts/dr/restore-tenant.sh` + helpers):** export → filter to a
   single `org_id` → re-import. Idempotent, `--dry-run` first, integrity-checked
   before any write, loud distinct exit codes, never touches `(default)` except
   the explicit org-scoped apply.
2. **Super-admin console (`/platform/dr-restore`, `dr_restore.py`):** wraps the
   same operation behind **four-eyes approval** — one super-admin *requests* a
   restore, a *different* super-admin must *approve* before it executes
   (self-approval is rejected) — and a **diff preview** showing exactly which
   documents would change, with cross-tenant writes excluded by construction.

Every step is audit-logged (hash-chained, 18-month retention per ADR-0001-era
audit design).

## 3. Consequences

**Positive:** scoped recovery without collateral rollback; the four-eyes gate
makes a wrong-tenant restore require two independent mistakes; the diff preview
turns a blind operation into a reviewed one; satisfies SF3's per-tenant exit
criterion and the DR drill.

**Negative / costs:** two super-admins must be available for a restore (a tiny
team can be a bottleneck — the founder + one hire is the minimum viable set,
reinforcing the SF1 hiring sequence); the diff preview adds an export+compare
pass before execution (slower, but restore is rare and correctness dominates
speed).

**Verification:** `backend/tests/test_dr_restore_admin.py` (14 tests) asserts
RBAC 403s, self-approval rejection, approval-gated execution, and cross-tenant
exclusion in the diff. The shell tooling is exercised by the weekly
`dr-backup-restore-verify.yml` restore-to-sandbox drill.
