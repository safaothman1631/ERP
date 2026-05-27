# Gap matrix — Database Foundation Excellence

**Updated:** 2026-05-26 (pre-launch critical pass)  
Legend: ✅ done · 🟡 partial / flag-gated · 🔴 open

---

## Schema validation (V)

| Repo | WRITE_MODEL | Notes |
|------|:-----------:|-------|
| invoices, bills, contacts, items, accounts | ✅ | Pydantic + `extra=ignore` |
| payments_received, payments_made | ✅ | |
| expenses | ✅ | |
| quotes, sales_orders, purchase_orders | ✅ | |
| journal_entries | ✅ | |
| pos_orders, pos_sessions | ✅ | |
| payroll_runs | ✅ | + PII encrypt on bank_account |
| stock_movements, stock_transfers | ✅ | |
| ~70 industry repos | 🟡 | `GENERIC_WRITE_VALIDATION` fallback on `BaseRepository` |
| org_id on payload | ✅ | rejected in `BaseRepository` |
| SERVER_TIMESTAMP everywhere | 🟡 | still `datetime.utcnow()` (compat); flag optional |
| `lint_field_types.py` | ✅ | CI |
| Tests | ✅ | `test_write_models_reject_unknown_fields.py` |

---

## Schema versioning (S)

| Item | Status |
|------|--------|
| `schema_version` on writes | ✅ default via `BaseRepository` |
| Migration registry | ✅ contacts/invoices/bills v2 |
| Lazy upgrade on `get()` | ✅ |
| CLI `migrate_collection.py` | ✅ |
| Round-trip tests | ✅ `test_migrations_roundtrip.py` |
| Audit tool S8 | ✅ `firestore_audit.py` schema section |

---

## Optimistic concurrency (C)

| Collection | `_version` | If-Match API |
|------------|:----------:|:------------:|
| invoices, contacts, items | ✅ | ✅ PUT wired |
| bills, quotes, sales/purchase orders | ✅ | ✅ PUT + If-Match |
| journal_entries | ✅ atomic create | 🟡 no PUT route |
| pos_orders, stock_transfers, pos_configs | ✅ | ✅ PUT wired |
| payroll rules/payslips, v1/contacts | ✅ | ✅ PUT + If-Match |
| Frontend | ✅ | `useVersionedMutation.ts` |
| Tests | ✅ | `test_optimistic_concurrency.py` |
| OpenAPI | ✅ | documented in `main.py` |

---

## Referential integrity (R)

| Item | Status |
|------|--------|
| FK catalogue | ✅ `references.py` |
| Delete guard | ✅ `BaseRepository.delete` |
| Orphan scanner | ✅ `check_orphans.py` |
| Soft-delete FK | ✅ `guarded_soft_deactivate` contacts/items/v1 |
| Item line scan | ✅ invoices/bills/quotes/SO/PO lines |
| API 409 | ✅ `guarded_delete` on payroll, inventory, ocr, + pattern |
| Soft-cascade lines | ✅ invoices + journal_entries |
| reconcile_org + orphans | ✅ R9 |
| Tests | ✅ |

---

## TTL (T)

| Collection | TTL index | Writer `expires_at` |
|------------|:---------:|:-------------------:|
| idempotency_keys | ✅ | ✅ `IdempotencyService` |
| sessions, rate_limit_buckets, ocr_cache, webhook_inbox | ✅ manifest | ✅ writers (auth sessions, rate_limit_firestore, ocr scan, webhook_inbox) |
| audit_logs retention | ✅ | scheduler `_job_audit_retention` |
| soft-delete purge | ✅ | weekly scheduler |
| Deploy verify | 🟡 | `tools/verify_firestore_ttl.py` in CI; console still required |
| Tests | ✅ `test_ttl_field_required_on_create.py` |

---

## Distributed counters (A)

| Item | Status |
|------|--------|
| Sharded counter service | ✅ |
| audit/chatter migration | 🟡 service ready; not all call sites switched |
| GL materialisation | ✅ code; `GL_MATERIALISATION_ENABLED=false` default |
| JE hook | ✅ `journal_entry_atomic` |
| `reconcile_gl_balances.py` | ✅ stub when flag off |
| Tests | ✅ sharded counter; GL full match 🟡 |

---

## Idempotency (I)

| Item | Status |
|------|--------|
| Middleware | ✅ hot-path prefixes only |
| TTL keys | ✅ |
| Outbox + dispatcher | ✅ + scheduler job |
| POS/e-invoice via outbox | 🟡 stub handler |
| Frontend header helper | ✅ `lib/idempotency.ts` + `useVersionedMutation` |
| Tests | ✅ replay + body hash |

---

## PII / GDPR (E)

| Collection | Encrypted |
|------------|:---------:|
| contacts | ✅ |
| users | ✅ email, phone, totp |
| hr_employees | ✅ |
| payroll_runs | ✅ bank_account |
| iraq_gateway_config | ✅ (pre-existing) |
| audit_pii_coverage.py | ✅ CI |
| GDPR delete | ✅ grace + anonymize + FK traversal |
| Org manifest / org-user-erasure API | ✅ `/api/privacy/*` |
| GCS manifest on delete | 🟡 future |
| Audit log PII scrub | ✅ `audit_pii.scrub_audit_entry` + middleware |
| E2E test | ✅ smoke |
| Key rotation runbook | 🟡 in OPERATIONS_RUNBOOK |

---

## Backup / DR (B)

| Item | Status |
|------|--------|
| Daily backup | ✅ |
| `backup-verify.yml` | ✅ |
| `verify_latest_backup.py` | ✅ + sha256 |
| GCS lifecycle JSON | ✅ |
| Platform export | ✅ `GET /api/platform/orgs/{id}/export` |
| `archive_fiscal_year.py` | ✅ |
| PITR | ✅ |
| Drill log | ✅ Q2 2026 entry |

---

## Observability (O)

| Item | Status |
|------|--------|
| FS reads/writes per request | ✅ middleware + repo hooks |
| Slow query log | ✅ |
| Doc size guard | ✅ 600K warn / 950K hard |
| Atomic retry counter | ✅ `atomic_retry.py` |
| `list_truncated` | ✅ (prior wave) |
| dashboard.json / alerts.yaml | ✅ templates |
| SLO.md | ✅ |
| Test doc size | ✅ |

---

## Doc size / sub-collection (D)

| Item | Status |
|------|--------|
| COLLECTION_POLICY.md | ✅ |
| Chatter root + parent_id | ✅ |
| Audit truncation | ✅ 100 KiB |
| Embedded array audit | 🟡 manual review |
| Tests | ✅ chatter |

---

## Naming (N)

| Item | Status |
|------|--------|
| lint_naming.py | ✅ |
| CI | ✅ |
| pre-commit | ✅ |
| Rename sweep | 🟡 no drift found |

---

## Per-tenant quotas (Q)

| Item | Status |
|------|--------|
| slowapi global | ✅ |
| Hot-path POS/chatter RPM | ✅ middleware defaults |
| 429 + Retry-After | ✅ |
| `/api/platform/orgs/{id}/usage` | ✅ |
| Redis | 🟡 optional `RATE_LIMIT_STORAGE_URI` |
| Tests | ✅ |

---

## Migration framework (M)

| Item | Status |
|------|--------|
| Registry + boot hook | ✅ |
| Seed CLIs | ✅ CoA, taxes, demo |
| OPERATIONS_RUNBOOK | ✅ |

---

## Test infrastructure (K)

| Item | Status |
|------|--------|
| FakeRepo + versioned | ✅ |
| Contract tests | ✅ expanded |
| Report snapshots | ✅ golden `aged_ar_single.json` |
| large_org fixture | ✅ |
| CI gate scripts | ✅ |
| Coverage 85% firestore | 🟡 not enforced in CI yet |

---

## Bottom line

| Capability | Coverage |
|------------|---------:|
| Hot-path atomic writes | 100% ✅ |
| Server-side pagination | 100% ✅ |
| Stream-based reads | 100% ✅ |
| Region + indexes | ✅ |
| **Validated writes (core)** | **~90%** ✅ |
| **Schema versioning** | **core collections** ✅ |
| **Concurrency control** | **hot PUTs** ✅ |
| **FK integrity** | **catalogue + guard** ✅ |
| **TTL policies** | **manifest + idempotency** ✅ |
| **PII coverage (core)** | **~95%** ✅ |
| **Observability** | **~85%** ✅ |
| **Backup verification** | **workflow** ✅ |

**Pre-launch ops:** `scripts/prelaunch_ops.ps1` + `.github/workflows/prelaunch-ops.yml` + `LAUNCH_DECISION.md` sign-off table. Firestore deploy to `zoho-83cda` automated (2026-05-26). Staging drill + Redis URI: run with org credentials / `setup_redis_rate_limit_secret.sh`.

Remaining engineering 🟡: industry-repo WRITE_MODEL sweep, full SERVER_TIMESTAMP migration, GL materialisation enabled after soak.
