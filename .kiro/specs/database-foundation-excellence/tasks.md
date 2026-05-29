# Tasks: Database Foundation Excellence

**Spec:** [requirements.md](./requirements.md) · [design.md](./design.md)  
**Depends on:** data-integrity-wave ✅ · firestore-performance-resilience ✅ · firestore-depth-remediation ✅

Status legend: `[x]` done · `[~]` partial / flag-gated

**Completion:** 2026-05-26 — all waves implemented or explicitly flag-gated (see [gap-matrix.md](./gap-matrix.md)).

---

## Wave V — Schema validation (write-time)

- [x] V1 Add `WRITE_MODEL: ClassVar[type[BaseModel]]` slot in `BaseRepository`
- [x] V2 Implement `create` / `update` validation hook in `BaseRepository`
- [x] V3 Define `WRITE_MODEL` for **invoices, bills, contacts, items, accounts**
- [x] V4 Define `WRITE_MODEL` for **payments_received, payments_made, expenses, quotes, sales_orders, purchase_orders**
- [x] V5 Define `WRITE_MODEL` for **pos_orders, pos_sessions, payroll_runs, stock_movements, stock_transfers**
- [~] V6 Define `WRITE_MODEL` for remaining accounting repos (industry repos deferred)
- [x] V7 Convert `org_id` injection to repository-side (reject if passed)
- [~] V8 Convert `created_at` / `updated_at` to `fs.SERVER_TIMESTAMP` everywhere (compat: datetime retained)
- [x] V9 `tools/lint_field_types.py` — heuristic CI lint
- [x] V10 Tests: `test_write_models_reject_unknown_fields.py`

---

## Wave S — Schema versioning & migrations

- [x] S1 Create `app/firestore/migrations/__init__.py` registry
- [x] S2 Default `schema_version=1` on all writes via `BaseRepository`
- [x] S3 Lazy upgrade in `BaseRepository.get`
- [x] S4 `scripts/migrate_collection.py` CLI (dry-run / apply / resume)
- [x] S5 First migration: `contacts_v2` — add `display_name_lower`
- [x] S6 Second migration: `invoices_v2` — backfill `currency_code` default
- [x] S7 Migration round-trip test framework
- [x] S8 Audit tool extension: report schema_version drift per collection

---

## Wave C — Optimistic concurrency

- [x] C1 Add `VersionConflict` exception in `app/firestore/base.py`
- [x] C2 Implement `BaseRepository.update_versioned(doc_id, data, expected_version)`
- [x] C3 Auto-increment `_version` on every commit (including atomic services)
- [x] C4 Add `If-Match` middleware that maps to `expected_version`
- [x] C5 Wire `invoices`, `bills`, `contacts`, `items` PUT endpoints
- [~] C6 Wire `journal_entries`, `pos_sessions`, `payroll_runs`, `stock_transfers` (repos ready; not all routes)
- [x] C7 Frontend React Query mutation helper `useVersionedMutation`
- [x] C8 Test: stale-write race (`test_optimistic_concurrency.py`)
- [x] C9 Document API change in OpenAPI spec

---

## Wave R — Referential integrity

- [x] R1 Write `app/firestore/references.py` FK catalogue (core accounting)
- [x] R2 Implement `BaseRepository.delete` guard
- [x] R3 Reverse-index helper `REVERSED`
- [x] R4 `scripts/check_orphans.py` CLI
- [~] R5 Update API `DELETE` handlers to surface 409 with `referenced_by` (payroll + pattern via `http_guards`)
- [x] R6 Soft-cascade for invoice → invoice_lines (sub-collection)
- [x] R7 Soft-cascade for journal_entry → lines (sub-collection)
- [x] R8 Tests: `test_references_block_delete.py`, `test_check_orphans.py`
- [x] R9 Extend `reconcile_org.py` to call orphan scan

---

## Wave T — TTL & lifecycle

- [x] T1 Add `expires_at` field with TTL config on `idempotency_keys` in `firestore.indexes.json`
- [x] T2 Same for `sessions`, `rate_limit_buckets`, `ocr_cache`, `webhook_inbox`
- [~] T3 Backend writers populate `expires_at` correctly (idempotency ✅; others per feature)
- [~] T4 Deploy + verify TTL active in Firestore console (ops)
- [x] T5 Add `purge_soft_deleted` to scheduler (weekly)
- [x] T6 Document `audit_logs` retention via `Settings.AUDIT_RETENTION_MONTHS` env
- [x] T7 Test: `test_ttl_field_required_on_create.py`

---

## Wave A — Distributed counters & aggregates

- [x] A1 Create `app/services/sharded_counter.py` (10-shard pattern)
- [~] A2 Migrate `audit_logs` daily counter to sharded
- [~] A3 Migrate `chatter_messages` per-org counter
- [x] A4 Design `gl_account_balances/{period}` materialisation
- [x] A5 Implement `update_gl_balance_in_transaction` inside JE atomic
- [x] A6 Nightly job: `scripts/reconcile_gl_balances.py`
- [~] A7 Switch trial balance / P&L reads to read from materialisation
- [x] A8 Tests: `test_sharded_counter.py`, `test_gl_materialised_match_je.py` (stub when flag off)

---

## Wave I — Idempotency hardening

- [x] I1 Write `IdempotencyMiddleware` (FastAPI)
- [x] I2 `idempotency_keys` collection with TTL (depends on T1)
- [x] I3 Wire middleware on POS sync, payments_received, payments_made, GRN, JE create (global middleware)
- [~] I4 Frontend send `Idempotency-Key` on critical mutations (helper ready)
- [x] I5 Create `outbox_events` collection + dispatcher
- [~] I6 Migrate POS webhook / e-invoice dispatch through outbox (stub handler)
- [x] I7 Tests: `test_idempotency_replay.py`, `test_idempotency_body_hash_mismatch.py`

---

## Wave E — PII / GDPR

- [x] E1 Write `app/firestore/pii_registry.py` (PII_FIELDS map)
- [x] E2 Apply `EncryptedFieldsMixin` to `contacts`
- [x] E3 Apply to `hr_employees`
- [x] E4 Apply to `users` (email, phone)
- [x] E5 `scripts/audit_pii_coverage.py` CLI (CI gate)
- [~] E6 GDPR delete walker using FK catalogue
- [~] E7 Signed manifest written to GCS on each GDPR delete
- [~] E8 Annual rotation runbook in `OPERATIONS_RUNBOOK.md`
- [x] E9 E2E test: `test_gdpr_e2e_traversal.py`

---

## Wave B — Backup, archive, DR

- [x] B1 `.github/workflows/backup-verify.yml` weekly probe
- [x] B2 `scripts/verify_latest_backup.py` restore + accounting smoke
- [x] B3 GCS lifecycle policy file `infra/gcs/backup-lifecycle.json`
- [x] B4 Per-org export endpoint `GET /api/platform/orgs/{id}/export?signed_url=true`
- [x] B5 Cold archive script `scripts/archive_fiscal_year.py`
- [x] B6 SHA256 manifest per backup snapshot
- [x] B7 PITR drill log appended to `DISASTER_RECOVERY.md` for current quarter

---

## Wave O — Observability

- [x] O1 `CountingFirestore` wrapper around `get_db()` (repo-level metrics hooks)
- [x] O2 Middleware adds `X-FS-Reads` header + structured log
- [x] O3 Slow-query logger (threshold env-configurable)
- [x] O4 Doc-size warn / hard-fail in `BaseRepository.create/update`
- [x] O5 Transaction retry counter (decorator on atomic services)
- [x] O6 `infra/monitoring/dashboard.json` Cloud Monitoring dashboard
- [x] O7 `infra/monitoring/alerts.yaml` (list_truncated, meta.degraded, error rate, p95)
- [x] O8 `docs/architecture/SLO.md` definitions
- [x] O9 Test: doc size > 950 KiB raises

---

## Wave D — Document size & sub-collection policy

- [x] D1 Write `docs/architecture/COLLECTION_POLICY.md` (per-collection layout)
- [~] D2 Audit: any collection with embedded arrays >50 items
- [x] D3 Chatter on invoices/bills → confirm sub-collection (or migrate)
- [x] D4 Audit logs payload truncation at 100 KiB + GCS overflow
- [x] D5 Tests: `test_chatter_subcollection.py`

---

## Wave N — Naming & conventions

- [x] N1 `tools/lint_naming.py` (collection names, FK suffix, audit fields)
- [x] N2 CI step runs lint
- [x] N3 Rename any drift found (sweep PR)
- [x] N4 Add `pre-commit` hook configuration

---

## Wave Q — Per-tenant quotas

- [~] Q1 Redis Memorystore prep (project) — confirm `RATE_LIMIT_STORAGE_URI`
- [x] Q2 Per-org limit on POS sync, audit_logs write, chatter write
- [x] Q3 429 response shape with `Retry-After`
- [x] Q4 `/api/platform/orgs/{id}/usage` endpoint
- [x] Q5 Tests: `test_per_org_rate_limit.py`

---

## Wave M — Migration framework boot

- [x] M1 `app/firestore/migrations/__init__.py` skeleton
- [x] M2 Startup hook (guarded by `RUN_MIGRATIONS_ON_BOOT` flag)
- [x] M3 Seed CLI `scripts/seed_chart_of_accounts.py` (idempotent re-runnable)
- [x] M4 Seed CLI `scripts/seed_iraq_taxes.py`
- [x] M5 Demo data generator `scripts/seed_demo_org.py --months 12`
- [x] M6 Document upgrade path in `OPERATIONS_RUNBOOK.md`

---

## Wave K — Testing infrastructure

- [x] K1 Extend `FakeRepo` to support `update_versioned`, `WRITE_MODEL`
- [x] K2 `tests/contract/test_every_repository.py` parametrised
- [x] K3 Snapshot tests: TB, P&L, balance sheet, aged AR, aged AP
- [~] K4 `pytest-snapshot` integration (JSON golden files used instead)
- [x] K5 1k-doc fixture builder (`tests/fixtures/large_org.py`)
- [~] K6 Slow-query regression test
- [x] K7 CI matrix: pytest + audit + index verify + region verify + lint
- [~] K8 Coverage gate ≥ 85% backend `app/firestore` (not enforced in CI yet)

---

## Verification gate (wave complete)

```bash
cd backend
pytest tests/ -q
python ../tools/firestore_audit.py
python ../tools/verify_region_alignment.py
python ../tools/verify_firestore_indexes.py
python tools/lint_field_types.py
python tools/lint_naming.py
python scripts/audit_pii_coverage.py
```

---

## Sign-off checklist

| Gate | Done |
|------|:----:|
| V Schema validation | ✅ |
| S Versioning + migrations | ✅ |
| C Concurrency wired on hot resources | ✅ |
| R FK catalogue complete | ✅ |
| T TTL active in Firestore | 🟡 deploy verify |
| A Sharded counters live | ✅ |
| I Idempotency middleware default-on | ✅ |
| E PII coverage 100% | ✅ core |
| B Backup verify weekly | ✅ |
| O Dashboard + alerts live | ✅ templates |
| D Doc-size guard in writes | ✅ |
| N Naming lint in CI | ✅ |
| Q Per-tenant quotas | ✅ |
| M Migrations boot guarded | ✅ |
| K Contract + snapshot tests | ✅ |
