# Tasks: Firestore Depth Remediation

**Spec:** [requirements.md](./requirements.md) · [design.md](./design.md) · [gap-matrix.md](./gap-matrix.md)  
**Depends on:** data-integrity-wave ✅ · firestore-performance-resilience ✅ (baseline)

---

## Wave O — Ops & deploy (P0) — do first

- [x] O1 Change `.github/workflows/deploy-cloudrun.yml` `REGION` → `europe-west1`
- [x] O2 Deploy with `--env-vars-file cloudrun-deploy-env.yaml` (not inline 4-line yaml)
- [x] O3 Confirm `FIREBASE_PROJECT_ID=zoho-83cda` in deployed service
- [x] O4 Confirm `deploy-firestore.yml` uses project `zoho-83cda`
- [x] O5 Deploy indexes: `firebase deploy --only firestore:indexes --project zoho-83cda`
- [x] O6 Mark `cloudrun-env.yaml` deprecated in README/OPERATIONS_RUNBOOK
- [x] O7 Staging smoke: health, login, list invoices with cursor, one report

---

## Wave Ix — Indexes (P0, parallel with O)

- [x] Ix1 Add indexes: expenses, payments_received, payments_made (org_id + date)
- [x] Ix2 Add indexes: invoices (org_id + status + date), (org_id + contact_id + date), (org_id + created_at)
- [x] Ix3 Add index: contacts (org_id + display_name)
- [x] Ix4 Add index: stock_movements (org_id + item_id + date) — align field with API
- [x] Ix5 Add index: accounts (org_id + code)
- [x] Ix6 Extend `tools/verify_firestore_indexes.py` for order_by tuples (P2)
- [x] Ix7 Document dual-filter invoice limitation in API OpenAPI

---

## Wave R — Reports.py (P0)

- [x] R1 Create `backend/app/services/report_queries.py` shared helpers
- [x] R2 Refactor `_get_journal_balances` + `general_ledger` (date query + batch lines)
- [x] R3 Refactor `cash_flow_report`, `expense_by_category`, `tax_summary`
- [x] R4 Refactor `sales_by_customer`, `sales_by_item` (fix lines)
- [x] R5 Refactor `project_profitability` (remove per-project loop)
- [x] R6 Fix `top_items` line loading
- [x] R7 Unify aging: `_open_invoice_docs` / `aged_receivable` → shared stream
- [x] R8 Remove all `list(limit=10000)` from `reports.py`
- [x] R9 Tests: `test_reports_streaming.py` (mocked Firestore)

---

## Wave E — Export & compliance (P0)

- [x] E1 `exports.py` → stream all 8 bulk paths
- [x] E2 `l10n_iq.py` → stream 4 paths
- [x] E3 `period_close.py` → stream accounts
- [x] E4 `lot_allocation.py` → stream
- [x] E5 `banking.py:832` → stream dedup scan
- [x] E6 `inventory.py:959` → stream stock moves list

---

## Wave A2 — Atomic wave 2 (P0/P1)

- [x] A2.1 `warehouse_move_atomic.py` + wire validate_stock_move, done_picking
- [x] A2.2 `pos_sync_inventory_atomic.py` + wire sync_orders
- [x] A2.3 `journal_entry_atomic.py` + refactor `AccountingService.create_journal_entry`
- [x] A2.4 `fiscal_close_atomic.py` + wire fiscal year close/reopen
- [x] A2.5 `payroll_post_je_atomic.py`
- [x] A2.6 `grn_receive_atomic.py` + wire GRN endpoint
- [x] A2.7 `po_convert_bill_atomic.py`
- [x] A2.8 Bill payment + JE — single transaction (`create_payment_made_with_je_atomic`)
- [x] A2.9 Transfer complete — warehouse_stock policy doc + implementation
- [x] A2.10 Manufacturing MO done — stock posting with `warehouse_id` query param
- [x] A2.11 Tests per atomic service

---

## Wave P1 — Core API list cleanup

- [x] P1.1 `companies.py`, `branches.py`, `cashflow_forecast.py`
- [x] P1.2 `crm.py`, `einvoice.py`, `payroll.py` list scans
- [x] P1.3 `fx.py`, `bank_import_service.py`, `subscriptions.py`, `audit.py`, `custom_reports.py`

---

## Wave S — Industry scaffold (P2)

- [x] S1 Industry dashboard stats migrated to `collect_stream` (18 API modules)
- [x] S2 Documented in `LAUNCH_DECISION.md` — promote module still requires stream in module spec

---

## Wave M — Monitoring (P1)

- [x] M1 Document weekly reconcile cron per org
- [x] M2 Log-based alert recipe for `list_truncated`
- [x] M3 Dashboard metric for `meta.degraded` (optional)
- [x] M4 Verify `refresh_org_counters` job monthly run
- [x] M5 PITR drill checklist in DISASTER_RECOVERY.md

---

## Wave J / H — Flags (from performance wave)

- [x] J1 Staging: `SEARCH_PREFIX_ENABLED=true` + smoke `/api/search` (documented in runbook)
- [x] H1 Staging: Redis + `RATE_LIMIT_STORAGE_URI` smoke (documented in runbook)

---

## Verification gate

```bash
cd backend && pytest tests/ -q
python tools/firestore_audit.py
python tools/verify_region_alignment.py
python tools/verify_firestore_indexes.py
rg "list\(limit=10000" backend/app/api/reports.py  # expect 0
rg "list\(limit=10000" backend/app/api  # expect 0
python scripts/reconcile_org.py --org-id <ORG>
```

---

## Sign-off

| Role | Gate |
|------|------|
| Engineering | O + Ix + R + E + A2 + S ✅ |
| Ops | O5 deploy, M1 reconcile cron ✅ |
| Product | R reports accuracy sign-off on staging clone |
