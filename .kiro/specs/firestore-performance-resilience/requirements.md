# Requirements: Firestore Performance & Resilience Wave

## Introduction

This spec captures **every database-related issue, risk, and recommendation** identified for the ERPIQ/Zoho ERP stack (Firestore + Cloud Run), including items already fixed in **Data Integrity Wave** and **Shopkeeper Core**, plus remaining gaps down to the smallest operational detail.

**System of record:** Google Firestore Native (`zoho-83cda`), accessed via FastAPI Admin SDK from Cloud Run (`erp-system-494716`, `europe-west1`).

**Non-goals (this wave):** Full PostgreSQL migration; rewriting all 120+ API modules; Odoo parity; replacing denormalization with relational joins.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Root collection** | Flat path e.g. `invoices/{id}` with `org_id` field (production backend default) |
| **Nested collection** | `organizations/{orgId}/invoices/{id}` (legacy rules / some docs) |
| **Python-side filter** | Fetch up to 10k docs by `org_id`, filter/sort/paginate in memory |
| **Drift** | Denormalized field ≠ ledger sum (see data-integrity-wave) |
| **Silent empty list** | On Firestore quota error, `list()` returns `[], 0` without failing the HTTP request |
| **PITR** | Firestore point-in-time recovery (enabled on `zoho-83cda`) |

---

## Baseline — What Is Already Done (MUST NOT regress)

Reference: `.kiro/specs/data-integrity-wave/`, `MASTER_AUDIT_REPORTS/data-integrity-wave-2026-05.md`.

| ID | Item | Status |
|----|------|--------|
| B1 | `BaseRepository.get()` returns `None` if `doc.org_id != repo.org_id` | ✅ Done |
| B2 | Atomic POS pay + payments + stock (`pos_checkout.py`) | ✅ Done |
| B3 | Atomic bank tx + `current_balance` (`bank_transactions.py`) | ✅ Done |
| B4 | Atomic AR payment + invoice (`invoice_payments.py`) | ✅ Done |
| B5 | Atomic AP payment + bill (`bill_payments.py`) | ✅ Done |
| B6 | `reconcile_org.py` + `run_reconcile_for_org()` + platform `/health/reconcile` | ✅ Done |
| B7 | Root `firestore.rules` for core collections deployed | ✅ Done |
| B8 | Firestore PITR `POINT_IN_TIME_RECOVERY_ENABLED` on `zoho-83cda` | ✅ Done |
| B9 | List quota → log warning (not silent without trace) | ✅ Done |
| B10 | Demo org D3 reconcile clean after `--fix` | ✅ Done |

---

## Requirement 1: `BaseRepository.list()` scalability & correctness

### 1.1 Hard cap (10,000 documents)

1. THE current `list()` SHALL be documented as **unsafe** for orgs with >10k documents per collection.
2. WHEN `query.limit(10000).stream()` returns exactly 10,000 rows, THE API or logs SHALL emit a **warning** `list_truncated` (org_id, collection_name).
3. THE `total_count` returned from `list()` SHALL NOT claim accuracy when truncation occurred.

### 1.2 Quota / transient failures

1. WHEN Firestore quota/rate limit is hit during `list()`, THE repository SHALL log at WARNING with `org_id` and `collection_name` (already required).
2. THE HTTP layer for **financial list endpoints** (invoices, bills, payments, bank_transactions, items) SHALL NOT return `200` with empty `items` without an error indicator when quota failure occurred — prefer `503` with `code: firestore_quota` OR include `meta.degraded: true` in response (choose one in design).

### 1.3 Offset pagination

1. THE system SHALL treat `offset > 0` on large collections as **deprecated** for new APIs.
2. New pagination SHALL use **cursor** (`start_after` doc id or encoded cursor) aligned with `/api/v1/*` patterns.

### 1.4 In-memory filter/sort cost

1. FOR collections with expected >2,000 docs per org (invoices, items, stock_movements, bank_transactions, audit_logs), THE wave SHALL provide a **server-side query path** using Firestore `where` + `order_by` + composite indexes (see Requirement 4).

### 1.5 Reconcile script same cap

1. `run_reconcile_for_org()` currently uses `list(limit=10000)` — SHALL either paginate with cursor until exhausted OR document max-org size and add `list_all_for_org()` helper with streaming.

---

## Requirement 2: Remaining atomic write gaps (integrity extension)

Data Integrity Wave covered shopkeeper-critical paths. THIS wave SHALL close:

| Flow | Endpoint / service | Risk if non-atomic |
|------|-------------------|-------------------|
| 2.1 | PO `/receive` + stock + GRN | Partial receive, wrong stock |
| 2.2 | Bill approve + JE + `balance_due` | GL vs AP mismatch |
| 2.3 | `bank_matching_service` match → payment + invoice | Duplicate or orphan payment |
| 2.4 | Stock transfer confirm + both warehouses | One-sided stock |
| 2.5 | Inventory adjustment post + movements | Drift |
| 2.6 | Credit note `apply_to_invoice` | Already batch; verify org guard on cross-refs |

1. EACH flow in table 2.1–2.5 SHALL use Firestore `transaction` or `batch` with read-before-write on all touched docs.
2. Failures SHALL return explicit HTTP 409/422 with `code`, not silent partial success.

---

## Requirement 3: Reconciliation model improvements (smallest correctness gaps)

1. **Stock drift math** SHALL support optional `opening_stock` / `initial_movement` on item OR document that reconcile compares `stock_on_hand` vs `opening + sum(movements)`.
2. **Bank drift** SHALL document whether `reconciled_only` is default for ops (stricter) vs all txns (looser).
3. **Bill drift** SHALL be included in weekly cron (already in code; SHALL be in ops doc).
4. `--fix` SHALL never create missing payment/movement rows — only update denormalized fields (unchanged policy).
5. Reconcile results SHALL be storable to `organizations/{orgId}/reconcile_runs/{runId}` or root `reconcile_runs` for audit (optional P1).

---

## Requirement 4: Firestore indexes & server-side queries

### 4.1 Index hygiene

1. `firestore.indexes.json` SHALL use **exact collection ids** matching code (`stock_movements` not `stock_moves` unless alias proven).
2. Missing index errors in production SHALL be monitored (Firebase console / log scrape).
3. Deploy indexes with every rules deploy in CI (`deploy-firestore.yml`).

### 4.2 Priority server-side list (P0 collections)

For each collection, implement `list_page(filters, cursor, limit)` using Firestore query (max 1 inequality field per query per Firestore rules):

| Collection | Minimum query shape |
|------------|---------------------|
| invoices | `org_id` + `status` + `order_by date` |
| bills | `org_id` + `status` + `order_by date` |
| items | `org_id` + `order_by name` or `sku` |
| bank_transactions | `org_id` + `bank_account_id` + `order_by date` |
| stock_movements | `org_id` + `item_id` + `order_by created_at` |
| contacts | `org_id` + prefix search via `name` range |
| audit_logs | `org_id` + `order_by created_at` (admin only) |

### 4.3 Repository exceptions (pre-approved composite queries)

1. `contacts.py` email lookup: SHALL add `.where("org_id", "==", org_id)` if not already on all code paths.
2. `system.py` settings key lookup: composite `(org_id, category, key)` — index required or keep single-doc id pattern.
3. `users.py` email lookup: SHALL verify global email uniqueness vs per-org policy; document cross-org leak risk.

---

## Requirement 5: Security rules & client path alignment

1. Nested rules under `organizations/{orgId}/**` AND root rules with `tenantDocRead()` SHALL both remain valid during transition.
2. IF frontend uses Firebase Client SDK for realtime, THE paths MUST match backend (root + `org_id`), not nested-only.
3. `audit_logs`: client create/update/delete denied (append-only backend).
4. `firebase.json` hosting rewrite region (`europe-west1`) SHALL match Cloud Run service region for `zoho-erp`.
5. Document: Admin SDK bypasses rules — all tenant security is **API + JWT org_id** first line of defense.

---

## Requirement 6: Cross-tenant & API-layer IDOR (beyond `get()`)

1. Spot-check audit from `MASTER_AUDIT_REPORTS/security-penetration-report.md` SHALL be expanded to automated test: every route with `{id}` uses repo scoped to `user["org_id"]`.
2. Request body fields `org_id` MUST be ignored or rejected if ≠ JWT org (except platform routes).
3. Platform impersonation SHALL log to platform audit + tenant audit.

---

## Requirement 7: Caching semantics

1. Document cache key `"{collection}:{doc_id}"` — safe if doc ids are globally unique UUIDs.
2. WHEN `get()` returns `None` due to org mismatch, THE cache entry for that key SHALL be invalidated (prevent stale cross-tenant if doc were ever reassigned — defensive).
3. Tax/COA/settings caches SHALL have TTL documented in `OPERATIONS_RUNBOOK.md`.

---

## Requirement 8: Multi-instance Cloud Run & rate limiting

1. In-memory rate limiter (slowapi / middleware) is **best-effort** per instance — document for ops.
2. P1: optional Redis/Memorystore for shared rate limits when `max-instances > 1`.
3. Idempotency keys collection TTL 7 days for POS sync — verify scheduler cleanup job exists.

---

## Requirement 9: Operations, DR, and multi-project topology

| Topic | Requirement |
|-------|-------------|
| 9.1 | Document two-project layout: Run `erp-system-494716`, Data `zoho-83cda`, secret `firebase-sa-zoho-83cda` |
| 9.2 | Daily backup RPO ~24h; PITR for minute-level between backups |
| 9.3 | Quarterly PITR restore drill in non-prod |
| 9.4 | Weekly `reconcile_org.py` per prod org (cron / platform UI) |
| 9.5 | Firestore location `eur3` vs Run `europe-west1` — document latency expectation for Iraq users |
| 9.6 | Free tier / billing alerts on Firestore read spikes from `list(10000)` |

---

## Requirement 10: Denormalization & query limitations (document, don’t “fix” wrong)

1. No SQL JOIN — contact_name on invoice, totals on headers; document required fields when adding modules.
2. No `LIKE %x%` — prefix search or external search (Algolia/Typesense) for P2.
3. `COUNT(*)` without read — use counter docs (`org_stats/{orgId}`) for dashboard totals P1.
4. Firestore `in` queries max 30 values — batch ids in chunks of 30 for bulk get.
5. Subcollection `lines` replace via batch — document 500-op batch limit per transaction.

---

## Requirement 11: Observability & CI gates

1. Metrics (or structured logs): `firestore_list_duration_ms`, `firestore_list_doc_count`, `list_truncated`, `firestore_quota`.
2. CI: `pytest` green; optional `reconcile_org` dry-run on demo org in staging workflow.
3. `tools/firestore_audit.py` regenerated in CI when `backend/app/firestore/*.py` changes.
4. p95 API list endpoints target <500ms for orgs with <2k invoices (per performance rule).

---

## Requirement 12: Performance targets (frontend + backend)

| Metric | Target |
|--------|--------|
| API p95 (list pages, org <2k docs) | < 500ms |
| API p95 (org >10k — before fix) | N/A — must use cursor path |
| LCP | < 2.5s |
| INP | < 200ms |
| React lists | React Query + pagination; no unbounded `list` from API |

---

## Requirement 13: Future triggers (document only)

PostgreSQL / read replica consideration WHEN any of:

- Single collection >50k docs per org with SLA list <1s
- Complex reporting joins exceed denormalization maintenance cost
- Reconcile drift rate >1% of entities weekly after fixes

---

## Acceptance criteria (wave complete)

| AC | Criterion |
|----|-----------|
| AC-1 | No financial list returns silent empty on quota without `degraded` or 503 |
| AC-2 | P0 collections have cursor list + indexes deployed |
| AC-3 | Flows 2.1–2.3 atomic with tests |
| AC-4 | Stock reconcile supports opening baseline OR documented limitation in UI |
| AC-5 | `contacts`/`users` email queries org-safe |
| AC-6 | Ops runbook updated with topology, cron, alerts, index deploy |
| AC-7 | `MASTER_AUDIT_REPORTS/firestore-performance-2026-05.md` published |

---

## Traceability matrix (user Q&A — nothing omitted)

| # | User-facing concern | Requirement |
|---|---------------------|-------------|
| 1 | DB is Firestore not SQL | Intro, R13 |
| 2 | 10k list cap | R1.1, R1.5 |
| 3 | Python filter slow | R1.4, R4, R12 |
| 4 | Quota → empty list | R1.2 |
| 5 | Offset pagination | R1.3 |
| 6 | get() IDOR | B1, R6 |
| 7 | body org_id | R6 |
| 8 | POS/bank/AR/AP atomic | B2–B5, R2 remainder |
| 9 | balance_due / stock / bank drift | B6, R3 |
| 10 | reconcile --fix limits | R3.4 |
| 11 | stock sum without opening | R3.1 |
| 12 | rules nested vs root | R5 |
| 13 | client SDK path | R5.2 |
| 14 | two GCP projects | R9.1 |
| 15 | region eur3 vs europe-west1 | R9.5, R5.4 |
| 16 | PITR + daily backup | B8, R9.2–9.3 |
| 17 | index name mismatch | R4.1 |
| 18 | contacts/system/users where | R4.3 |
| 19 | cache key | R7 |
| 20 | rate limit multi-instance | R8 |
| 21 | idempotency POS | R8.3 |
| 22 | no JOIN / denormalization | R10 |
| 23 | search LIKE | R10.2 |
| 24 | COUNT(*) | R10.3 |
| 25 | in-query 30 limit | R10.4 |
| 26 | subcollection lines batch | R10.5 |
| 27 | platform reconcile UI | B6 |
| 28 | shopkeeper flows | B2, depends on shopkeeper spec |
| 29 | penetration IDOR spot-check | R6 |
| 30 | audit_logs immutability | R5.3 |
| 31 | GDPR retention vs delete | R2 (transactional records in privacy.py) |
| 32 | deploy firestore rules | B7, R4.3 |
| 33 | Cloud Run deploy | R9.1 (ops) |
| 34 | v1 cursor API exists partially | R1.3, R4.2 |
| 35 | reports/dashboard heavy list() | R4, R10.3, R11 |
| 36 | free tier cost spike | R9.6 |
| 37 | soft-delete 30d purge | R1 (include_deleted); design D7 |
| 38 | bank_matching | R2.3 |
| 39 | credit note batch | R2.6 |
| 40 | JE batch accounting | R2.2, R10.5 |
