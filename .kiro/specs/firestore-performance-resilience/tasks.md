# Tasks: Firestore Performance & Resilience Wave



**Spec:** [requirements.md](./requirements.md) · [design.md](./design.md)  

**Depends on:** [data-integrity-wave](../data-integrity-wave/tasks.md) (baseline B1–B10 must stay ✅)



---



## Wave 0 — Baseline verification (P0, no regressions)



- [x] V0.1 Run `pytest tests/ -q` — 716+ pass

- [x] V0.2 `python scripts/reconcile_org.py --org-id 064a4a1a-487b-4835-a42a-4806ba8add72` → exit 0

- [x] V0.3 Confirm PITR: `gcloud firestore databases describe --project=zoho-83cda`

- [x] V0.4 Document baseline in `MASTER_AUDIT_REPORTS/firestore-performance-2026-05.md`



---



## Wave A — Observability & list safety (P0)



- [x] A1 `base.py`: `list_truncated` warning when len ≥ 10_000

- [x] A2 API meta `truncated` / `degraded` on invoices, bills, items list endpoints

- [x] A3 Quota path: set `meta.degraded=true` (or 503 policy per design) — test

- [x] A4 `get()`: `cache.delete` on org mismatch

- [x] A5 `stream_org_docs()` batch iterator on BaseRepository

- [x] A6 `run_reconcile_for_org()` use streaming (no 10k cap blind spot)

- [x] A7 Tests: `test_list_truncated_meta.py`, `test_reconcile_streaming.py`



---



## Wave B — Index & query hygiene (P0)



- [x] B1 Fix `firestore.indexes.json`: `stock_movements` (deprecate wrong `stock_moves` if unused)

- [x] B2 Add indexes: invoices, bills, bank_transactions per design D4

- [x] B3 `tools/verify_firestore_indexes.py` + CI step in `deploy-firestore.yml` or `ci.yml`

- [x] B4 `users.py` email query: add `org_id` where clause (or document global-email exception)

- [x] B5 Regenerate `audit/FIRESTORE_AUDIT.md` via `tools/firestore_audit.py` + CI step



---



## Wave C — Server-side pagination (P1)



- [x] C1 `backend/app/firestore/query.py` — `list_page()` helper

- [x] C2 Migrate `InvoiceRepository.list` / API `GET /api/invoices` to cursor path (feature flag `USE_FIRESTORE_QUERY=true`)

- [x] C3 Migrate bills list (`api_list` + cursor on `/api/bills`)

- [x] C4 Migrate bank_transactions list (account filter + `api_list`)

- [x] C5 Migrate items list (`api_list` + item_type index)

- [x] C6 Extend `/api/v1/invoices` and `/api/v1/bills` — uses `base.list` + `USE_FIRESTORE_QUERY`

- [x] C7 Tests: `test_api_list_cursor.py` + index in `firestore.indexes.json`



---



## Wave D — Remaining atomic flows (P1)



- [x] D1 `services/po_receive.py` + wire `purchase_orders.py` `/receive`

- [x] D2 `services/bill_approve.py` + wire `expenses.py` `/approve`

- [x] D3 `bank_matching_service.py` → `invoice_payments` atomic helpers

- [x] D4 Stock transfer atomic — `stock_transfer_atomic.py` + `complete_transfer`

- [x] D5 Inventory adjustment atomic — `inventory_adjustment_atomic.py`

- [x] D6 `services/firestore_tx.py` — `assert_org` helper

- [x] D7 Tests: `test_po_receive_atomic.py`, `test_bank_match_payment.py`, `test_bill_approve_atomic.py`, `test_inventory_adjustment_atomic.py`



---



## Wave E — Reconcile v2 (P1)



- [x] E1 `opening_stock` on items + `compute_stock_drift` update

- [x] E2 UI hint on `/platform/health` when stock drift without opening

- [x] E3 Optional `reconcile_runs` collection write after scan

- [x] E4 Document `reconciled_only` default in OPERATIONS_RUNBOOK



---



## Wave F — Dashboard counters (P2)



- [x] F1 `org_counters/{orgId}` schema

- [x] F2 Increment on invoice/bill status transitions

- [x] F3 Dashboard API read counters instead of full list scan

- [x] F4 Reconcile counters vs actual monthly (scheduler `refresh_org_counters`)



---



## Wave G — Security & docs (P1)



- [x] G1 `docs/firestore/CLIENT_PATHS.md` (root vs nested)

- [x] G2 Automated `test_rbac_idor_routes.py` sample (top 20 entities)

- [x] G3 `OPERATIONS_RUNBOOK.md`: two-project topology, regions, cron, billing alerts

- [x] G4 `LAUNCH_DECISION.md` addendum — performance wave gate

- [x] G5 Review `firebase.json` hosting region = Cloud Run region (`tools/verify_region_alignment.py`)



---



## Wave H — Rate limit & jobs (P2)



- [x] H1 Document in-memory limiter limits per instance

- [x] H2 Optional Redis backend spike (`RATE_LIMIT_STORAGE_URI`, `REDIS_RATE_LIMIT.md`)

- [x] H3 Soft-delete purge job uses `stream_org_docs` not `list(10000)`

- [x] H4 Verify idempotency cleanup scheduler



---



## Wave I — Reports & heavy modules (P2, incremental)



- [x] I1 Inventory `reports.py` top 5 list() calls → `report_streams.collect_stream`

- [x] I2 `dashboard.py` / `dashboards.py` — counters + stream for hot widgets

- [x] I3 `pos.py` — hot paths `list(10000)` → `collect_stream` (KPI, catalog, loyalty, gift cards)



---



## Wave J — Future / document only (P3)



- [x] J1 `docs/architecture/POSTGRES_TRIGGER_CRITERIA.md` from Req 13

- [x] J2 Algolia/Typesense evaluation one-pager (search)

- [x] J3 Full-text search spike — `search_service.py`, `/api/search`, indexes (flag `SEARCH_PREFIX_ENABLED`)



---



## Production flags



- [x] `USE_FIRESTORE_QUERY=true` in `cloudrun-deploy-env.yaml`



---



## CI / deploy checklist



```bash

cd backend && pytest tests/ -q

python scripts/reconcile_org.py --org-id <ORG>

firebase deploy --only firestore:rules,firestore:indexes --project zoho-83cda

gcloud run deploy zoho-erp --source . --region europe-west1 --project erp-system-494716 ...

```



---



## Sign-off



| Role | Gate |

|------|------|

| Engineering | A1–A7, B1–B3, C1–C7, D1–D7, E, F, I complete |

| Ops | G3, V0.2–V0.3, weekly reconcile cron live |

| Product | Cursor lists enabled in production env |

