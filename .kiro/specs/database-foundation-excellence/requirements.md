# Requirements: Database Foundation Excellence

**Status:** Draft 2026-05-26 · **Owner:** Platform / Data engineering  
**Predecessors:**
- `.kiro/specs/data-integrity-wave/` ✅ tenant guard · hot-path atomics · reconcile
- `.kiro/specs/firestore-performance-resilience/` ✅ stream · counters · cursor lists
- `.kiro/specs/firestore-depth-remediation/` ✅ reports / exports / atomic wave 2 / industry stats

This spec consolidates **every remaining database concern** that the previous three waves did not fully cover. It is the foundation layer required to reach Odoo-level reliability before functional scale-up.

**Targets:** Firestore `zoho-83cda` (eur3) · Cloud Run `erp-system-494716` (`europe-west1`) · ≥200 production orgs · ≥10k docs / org / collection · zero silent truncation · zero JE drift.

---

## Introduction & success criteria

A production multi-tenant SaaS ERP must satisfy ten foundation properties:

1. **Validated** — every write conforms to a typed schema
2. **Versioned** — documents carry `schema_version`; migrations are scripted
3. **Concurrent-safe** — optimistic concurrency on hot resources (no last-writer-wins corruption)
4. **Referentially clean** — cross-collection references checked or repaired
5. **Quantified** — slow queries, doc size, read count, write retries are observable
6. **Bounded** — TTL on ephemeral data, archival of cold data, distributed counters
7. **Encrypted** — PII coverage audited; GDPR delete reaches every linked collection
8. **Recoverable** — backup verified weekly; PITR drill quarterly
9. **Standardised** — uniform soft-delete, date typing, naming, audit fields
10. **Tested** — repository contract tests, migration round-trip tests, snapshot tests on reports

The current system meets ~60% of these. This spec closes the remaining 40%.

---

## Requirement V — Schema validation (write-time)

| ID | SHALL | Pri |
|----|-------|-----|
| V1 | Each `BaseRepository` subclass SHALL declare a pydantic `WRITE_MODEL` used on `create` / `update` | P0 |
| V2 | Unknown fields SHALL be rejected unless explicitly listed in `EXTRA_FIELDS_ALLOWED` | P1 |
| V3 | Required fields and type coercion SHALL run before Firestore write | P0 |
| V4 | Pydantic errors SHALL surface as HTTP 422 with field-level paths | P1 |
| V5 | `org_id` SHALL be auto-injected by the repository, never accepted from caller payload | P0 |
| V6 | `created_at` / `updated_at` SHALL always be `Timestamp` (not ISO string) | P0 |
| V7 | `date`, `due_date`, `period_start`, `period_end` SHALL use canonical type (ISO string `YYYY-MM-DD` or Timestamp) consistently per collection | P0 |
| V8 | A type-mismatch CI job SHALL fail the build when API code stores wrong type in a known field | P1 |

---

## Requirement S — Schema versioning & migrations

| ID | SHALL | Pri |
|----|-------|-----|
| S1 | Every document SHALL carry `schema_version: int` (default 1 for legacy) | P0 |
| S2 | A registry `app/firestore/migrations/` SHALL hold per-collection upgrade functions | P0 |
| S3 | Read path SHALL transparently upgrade `schema_version` on first read (lazy migration) | P0 |
| S4 | A bulk migration CLI `scripts/migrate_collection.py --collection X --target N` SHALL exist | P0 |
| S5 | Migrations SHALL be idempotent and reversible where data loss would otherwise occur | P0 |
| S6 | Migration round-trip tests SHALL exist for every registered migration | P1 |
| S7 | Schema version drift SHALL be reported by `tools/firestore_audit.py` | P1 |

---

## Requirement C — Optimistic concurrency control

| ID | SHALL | Pri |
|----|-------|-----|
| C1 | Hot resources (invoices, bills, journal_entries, contacts, items, pos_sessions, payroll_runs, stock_transfers) SHALL carry `_version: int` | P0 |
| C2 | Update API SHALL accept `If-Match` header or `expected_version` body field | P0 |
| C3 | `BaseRepository.update_versioned(doc_id, data, expected_version)` SHALL be transactional and raise `VersionConflict` on mismatch | P0 |
| C4 | API SHALL respond `409 Conflict` with `current_version` on mismatch | P0 |
| C5 | Frontend mutations SHALL pass version through React Query (mutation pre-read) | P1 |
| C6 | Atomic services SHALL bump `_version` on every commit | P0 |
| C7 | Tests SHALL prove `update_versioned` rejects stale write under simulated race | P0 |

---

## Requirement R — Referential integrity

| ID | SHALL | Pri |
|----|-------|-----|
| R1 | Foreign-key catalogue SHALL exist (`app/firestore/references.py`) listing every `*_id` field and target collection | P0 |
| R2 | Repository delete SHALL refuse when referenced (unless soft-cascade declared) | P0 |
| R3 | `scripts/check_orphans.py` SHALL report orphaned references per org | P0 |
| R4 | Contact / item / account hard-delete SHALL be blocked when referenced | P0 |
| R5 | Soft-delete SHALL hide doc from list but keep references resolvable (display name fallback) | P0 |
| R6 | Weekly reconcile (already exists) SHALL extend to flag orphans | P1 |
| R7 | API `DELETE` SHALL return 409 with `referenced_by` summary instead of 500 / silent broken state | P0 |

---

## Requirement T — TTL & lifecycle

| ID | SHALL | Pri |
|----|-------|-----|
| T1 | Firestore TTL policies SHALL be deployed for: `idempotency_keys` (24h), `sessions` (30d), `rate_limit_buckets` (1h), `ocr_cache` (90d), `webhook_inbox` (90d), `audit_logs` (24mo or `Settings.AUDIT_RETENTION_MONTHS`) | P0 |
| T2 | `firestore.indexes.json` SHALL include the `ttlConfig` per collection | P0 |
| T3 | Documents created without TTL field SHALL fail validation (V1) for above collections | P1 |
| T4 | A purge job for non-TTL soft-deleted docs older than 30 days SHALL run weekly | P1 |
| T5 | Cold storage policy (archived closed fiscal years) SHALL be documented | P2 |

---

## Requirement A — Distributed counters & aggregates

| ID | SHALL | Pri |
|----|-------|-----|
| A1 | Hot write counters (audit_logs/day, posts/day, attendance/day) SHALL use sharded counters (N=10) | P0 |
| A2 | `org_counters` per-collection SHALL be computed from sharded base where applicable | P1 |
| A3 | Audit_log writes SHALL not contend on a single document | P0 |
| A4 | A `tools/measure_counter_contention.py` SHALL profile retry counts | P2 |
| A5 | Materialized aggregates for trial balance / general ledger SHALL be designed for orgs with >5k journal entries | P1 |
| A6 | `gl_account_balances/{period}` materialisation job SHALL exist (writes nightly + on period close) | P1 |

---

## Requirement I — Idempotency hardening

| ID | SHALL | Pri |
|----|-------|-----|
| I1 | All write endpoints exposed to clients SHALL accept `Idempotency-Key` header | P0 |
| I2 | Idempotency record SHALL store request hash and last response; mismatched hash → 409 | P0 |
| I3 | Idempotency keys SHALL TTL after 24h (see T1) | P0 |
| I4 | POS, payment_received, payment_made, GRN, JE create SHALL be covered (tests) | P0 |
| I5 | Webhook dispatch SHALL be exactly-once via outbox table | P1 |

---

## Requirement E — Encryption & GDPR coverage

| ID | SHALL | Pri |
|----|-------|-----|
| E1 | A registry of PII fields per collection SHALL exist | P0 |
| E2 | `scripts/audit_pii_coverage.py` SHALL list collections containing PII not encrypted | P0 |
| E3 | `users.email`, `contacts.phone`, `contacts.tax_id`, employee national IDs SHALL be encrypted at rest | P0 |
| E4 | `migrate_pii_encryption.py` SHALL be run with rotated key annually | P1 |
| E5 | GDPR delete (`gdpr_service.delete_user_data`) SHALL traverse the FK catalogue (R1) | P0 |
| E6 | GDPR delete SHALL produce signed manifest for audit | P0 |
| E7 | E2E test SHALL prove delete reaches every PII collection | P0 |

---

## Requirement B — Backup, archive, disaster recovery

| ID | SHALL | Pri |
|----|-------|-----|
| B1 | Daily backup SHALL be verified by a weekly restore probe on a non-prod project | P0 |
| B2 | PITR SHALL be enabled and quarterly drill recorded in `DISASTER_RECOVERY.md` | P0 |
| B3 | `BACKUP_BUCKET` SHALL have GCS lifecycle policy: 30d nearline, 365d coldline, 7y delete | P1 |
| B4 | Per-org export to GCS (signed URL) SHALL exist for tenant offboarding | P1 |
| B5 | Archive of closed fiscal years SHALL move JE + lines to `journal_entries_archive` collection (P2) | P2 |
| B6 | Backup integrity SHALL be checksummed (SHA256 manifest per snapshot) | P1 |

---

## Requirement O — Observability

| ID | SHALL | Pri |
|----|-------|-----|
| O1 | Each request SHALL emit a Firestore read counter (response header `X-FS-Reads`, log field `fs_reads`) | P0 |
| O2 | Slow queries (>500ms or >1000 reads) SHALL be logged structured (`slow_firestore_query`) | P0 |
| O3 | Document size warning SHALL log when any write approaches 800 KiB (80% of 1 MiB limit) | P0 |
| O4 | Transaction retry counter SHALL be exported per atomic service | P1 |
| O5 | `meta.degraded` and `meta.truncated` SHALL be alertable via log-based metrics | P1 |
| O6 | A dashboard JSON for Cloud Monitoring SHALL ship in `infra/monitoring/` | P1 |
| O7 | SLOs SHALL be defined: list p95 <800ms, write p95 <1500ms, error rate <0.5% | P1 |

---

## Requirement D — Document size & sub-collection policy

| ID | SHALL | Pri |
|----|-------|-----|
| D1 | Documents SHALL stay under 800 KiB (warning at 600 KiB) | P0 |
| D2 | `chatter_messages` attached to invoices/bills SHALL live in sub-collection (`<parent>/messages`) — not flat array | P0 |
| D3 | Journal entry lines SHALL stay in sub-collection (already so) — confirm + lint | P0 |
| D4 | Inventory `stock_movements` SHALL never be embedded inside item docs | P0 |
| D5 | Audit logs SHALL never embed full request bodies >100 KiB (truncate + GCS for large) | P1 |
| D6 | A policy doc `docs/architecture/COLLECTION_POLICY.md` SHALL list every collection: root / sub / flat array — with rationale | P0 |

---

## Requirement N — Naming & conventions

| ID | SHALL | Pri |
|----|-------|-----|
| N1 | Collection names SHALL be `snake_case` plural | P0 |
| N2 | Foreign keys SHALL end in `_id` | P0 |
| N3 | Audit fields SHALL be exactly: `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`, `_version`, `schema_version` | P0 |
| N4 | Tenant field SHALL always be `org_id` (no `tenant_id`, no `organization_id`) | P0 |
| N5 | Money amounts SHALL be `float`, currency in `currency_code` (ISO 4217) | P0 |
| N6 | Booleans SHALL not be nullable; defaults documented | P1 |
| N7 | A lint rule SHALL detect violations on PR (CI) | P1 |

---

## Requirement Q — Quota & per-tenant fairness

| ID | SHALL | Pri |
|----|-------|-----|
| Q1 | Per-tenant per-minute write quota SHALL exist on hot endpoints (POS sync, audit, chatter) | P1 |
| Q2 | A noisy tenant SHALL not impact others (Firestore quotas + slowapi rate limit) | P1 |
| Q3 | Quota breach SHALL return 429 with `Retry-After` | P1 |
| Q4 | Org-level usage metrics SHALL be exposed under `/api/platform/orgs/{id}/usage` | P2 |

---

## Requirement M — Migration & seeding

| ID | SHALL | Pri |
|----|-------|-----|
| M1 | A migration framework `app/firestore/migrations/__init__.py` SHALL exist with version registry | P0 |
| M2 | New deployments SHALL run pending migrations on startup (with dry-run flag) | P0 |
| M3 | Seed data (chart of accounts, default Iraq tax) SHALL be versioned and re-runnable | P1 |
| M4 | Demo data CLI SHALL produce realistic 12-month dataset for staging | P2 |

---

## Requirement K — Testing infrastructure

| ID | SHALL | Pri |
|----|-------|-----|
| K1 | A `FakeRepo` base SHALL cover `stream_org_docs`, `list_page`, `update_versioned` for unit tests | P0 |
| K2 | Contract tests SHALL run against every `BaseRepository` subclass | P0 |
| K3 | Snapshot tests SHALL exist for: trial balance, P&L, balance sheet, aged AR, aged AP | P0 |
| K4 | Property-based tests SHALL exist for accounting balance laws (already partial — extend) | P1 |
| K5 | A 1k-doc fixture SHALL be available for slow-query regression tests | P1 |
| K6 | CI SHALL run pytest + audit tools + index verify + region verify on every PR | P0 |

---

## Traceability summary

| Req | Owner | Effort | Risk if skipped |
|-----|-------|--------|-----------------|
| V Schema validation | Backend | 4–6 d | bad data, late errors |
| S Schema versioning | Backend | 3 d | breaking changes hard |
| C Concurrency | Backend + FE | 4–5 d | clobbered edits |
| R Refs integrity | Backend | 3–4 d | orphans, broken UI |
| T TTL | Ops + Backend | 1 d + deploy | unbounded growth |
| A Distributed counters | Backend | 2–3 d | hot-spot retry storm |
| I Idempotency | Backend | 2–3 d | duplicate writes |
| E PII / GDPR | Backend + Compliance | 3 d | legal exposure |
| B Backup / DR | Ops | 2 d + drills | data loss |
| O Observability | Backend + Ops | 2–3 d | blind in prod |
| D Doc size | Backend | 1–2 d | 1MB write failures |
| N Naming | Backend + Lint | 1 d | drift over time |
| Q Quotas | Backend | 1–2 d | noisy neighbor |
| M Migrations | Backend | 2 d | every change risky |
| K Tests | Backend | 3–4 d | regressions |

**Total estimate:** ~6–8 weeks at one engineer, parallelisable.

---

## Acceptance (wave complete)

1. `pytest` ≥ 800 tests pass; contract tests cover every repository
2. `tools/firestore_audit.py` reports zero schema_version drift, zero unencrypted PII
3. `scripts/check_orphans.py` zero orphans on demo org
4. `scripts/reconcile_org.py --org-id <prod>` weekly clean
5. SLO dashboard live; alerts wired
6. PITR drill recorded for current quarter
7. Stale-write race test passes for all C1 collections
8. All TTL policies active and verified in Firestore console
9. GDPR delete E2E test green
10. Snapshot tests for TB / P&L green on staging clone
