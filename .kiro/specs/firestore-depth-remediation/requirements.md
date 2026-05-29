# Requirements: Firestore Depth Remediation

## Introduction

Deep remediation spec consolidating **every remaining database concern** after:

- `.kiro/specs/data-integrity-wave/` (tenant guard, hot-path atomics, reconcile)
- `.kiro/specs/firestore-performance-resilience/` (stream, counters, cursor lists, partial reports)

**Evidence:** parallel audit 2026-05-26 → `gap-matrix.md`, `MASTER_AUDIT_REPORTS/firestore-depth-remediation-2026-05.md`

**System:** Firestore `zoho-83cda` (eur3) · Cloud Run `erp-system-494716` · Hosting rewrite `europe-west1`

---

## Requirement 1: Production deploy correctness (Wave O)

| ID | SHALL | Priority |
|----|-------|----------|
| O1 | Cloud Run deploy region SHALL be `europe-west1` (match `firebase.json` hosting rewrite) | P0 |
| O2 | Deploy env SHALL load from `cloudrun-deploy-env.yaml` (single source of truth) | P0 |
| O3 | `FIREBASE_PROJECT_ID=zoho-83cda` SHALL be set on Cloud Run | P0 |
| O4 | `USE_FIRESTORE_QUERY=true` SHALL be set when indexes are deployed and verified | P0 |
| O5 | Firestore rules/indexes deploy SHALL target project `zoho-83cda` (not compute project only) | P0 |
| O6 | Deprecate misleading `cloudrun-env.yaml` (wrong project id) in docs | P1 |
| O7 | `SEARCH_PREFIX_ENABLED` SHALL only be `true` after index deploy + staging smoke | P1 |

---

## Requirement 2: Accounting reports (`reports.py`) (Wave R)

| ID | SHALL | Priority |
|----|-------|----------|
| R1 | No endpoint SHALL use `list(limit=10000)` without `meta.truncated` or stream alternative | P0 |
| R2 | Journal reports SHALL NOT use unbounded `get_lines` N+1 on full org JE set | P0 |
| R3 | Date-range reports SHALL push `date >= / <=` to Firestore where index exists | P0 |
| R4 | `receivable_aging` / `aged_receivable` SHALL share one code path (no duplicate full scans) | P1 |
| R5 | `top_items` SHALL load line data correctly (fix empty `lines` on list) | P0 |
| R6 | `project_profitability` SHALL NOT loop per-project `list(5000)` | P0 |
| R7 | `cash_flow_report` SHALL use streamed or queried payments/expenses by date | P0 |
| R8 | Trial balance / GL MAY use materialized balances (P2) if JE volume >5k | P2 |

---

## Requirement 3: Bulk export & compliance reads (Wave E)

| ID | SHALL | Priority |
|----|-------|----------|
| E1 | `exports.py` bulk paths SHALL use `stream_org_docs` or paginated cursor | P0 |
| E2 | `l10n_iq.py` tax paths SHALL not cap at 10k silent truncation | P0 |
| E3 | `period_close.py` account scans SHALL stream | P0 |
| E4 | `lot_allocation.py` batch scans SHALL stream | P0 |

---

## Requirement 4: Composite indexes (Wave Ix)

| ID | SHALL | Priority |
|----|-------|----------|
| Ix1 | Indexes SHALL match `list_page` order fields (`date` not `due_date` where API sorts by date) | P0 |
| Ix2 | Indexes for `expenses`, `payments_received`, `payments_made` date queries | P0 |
| Ix3 | `contacts.display_name` index for list + prefix search alignment | P1 |
| Ix4 | `verify_firestore_indexes.py` SHALL validate (collection, filter, order_by) tuples | P2 |
| Ix5 | Dual filter `status` + `contact_id` on invoices SHALL be documented or fixed | P1 |

---

## Requirement 5: Atomic wave 2 (Wave A2)

| ID | SHALL | Priority |
|----|-------|----------|
| A2.1 | Warehouse `validate_stock_move` + `done_picking` SHALL be transactional | P0 |
| A2.2 | POS `sync_orders` / `deduct_inventory_for_order` SHALL match `checkout_order_atomic` guarantees | P0 |
| A2.3 | Fiscal year close SHALL be single transaction or compensating saga with idempotency | P0 |
| A2.4 | `create_journal_entry` + account `increment` SHALL be one transaction | P0 |
| A2.5 | Payroll `post_payroll_je` SHALL not orphan JE vs run link | P0 |
| A2.6 | GRN + `receive_lots_for_grn` SHALL be atomic with PO status | P1 |
| A2.7 | PO `convert-to-bill` SHALL be atomic | P1 |
| A2.8 | Bill payment + GL post SHALL not split across commits without repair | P1 |
| A2.9 | Stock transfer complete SHALL update warehouse_stock OR document explicit movement-only model | P1 |
| A2.10 | Manufacturing MO `done` SHALL post component/finished stock (or block with clear error) | P1 |

---

## Requirement 6: Industry / scaffold modules (Wave S)

| ID | SHALL | Priority |
|----|-------|----------|
| S1 | Industry modules MAY keep `list(10000)` until traffic justifies — document in module maturity | P2 |
| S2 | WHEN module promoted to functional, SHALL adopt `collect_stream` before GA | P2 |

---

## Requirement 7: Observability & ops (Wave M)

| ID | SHALL | Priority |
|----|-------|----------|
| M1 | Weekly `reconcile_org.py` on all prod orgs | P0 |
| M2 | Alert on log pattern `list_truncated` | P1 |
| M3 | Alert on `meta.degraded` rate on list endpoints | P1 |
| M4 | Monthly `refresh_org_counters` job verified in scheduler logs | P1 |
| M5 | Quarterly PITR restore drill (non-prod) | P1 |

---

## Requirement 8: Search (Wave J — from performance wave)

| ID | SHALL | Priority |
|----|-------|----------|
| J1 | Prefix search indexes deployed before `SEARCH_PREFIX_ENABLED` | P1 |
| J2 | Optional `display_name_lower` / `name_lower` fields for case-insensitive search | P2 |
| J3 | External search (Typesense/Algolia) evaluation when items >50k/org | P3 |

---

## Requirement 9: Rate limiting (Wave H — from performance wave)

| ID | SHALL | Priority |
|----|-------|----------|
| H1 | Document Redis Memorystore + `RATE_LIMIT_STORAGE_URI` for multi-instance | P1 |
| H2 | Staging test with Redis before prod enable | P2 |

---

## Traceability summary

| Wave | Req IDs | Est. effort |
|------|---------|-------------|
| O Ops/deploy | O1–O7 | 0.5–1 d |
| R Reports | R1–R8 | 3–5 d |
| E Export/compliance | E1–E4 | 1–2 d |
| Ix Indexes | Ix1–Ix5 | 1 d + deploy wait |
| A2 Atomics | A2.1–A2.10 | 5–8 d |
| S Scaffold | S1–S2 | backlog |
| M Monitoring | M1–M5 | 1 d |

---

## Acceptance (wave complete)

1. `pytest` ≥ 723 pass (no regressions)
2. `reports.py` zero `list(limit=10000)`
3. `deploy-cloudrun` uses `europe-west1` + full env yaml
4. Staging: large-org fixture — reports AR aging matches reconcile within tolerance
5. `python tools/firestore_audit.py` + `verify_region_alignment.py` + `verify_firestore_indexes.py` green
