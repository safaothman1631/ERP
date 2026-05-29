# Gap matrix — file × line registry

**Legend:** 🔴 P0 · 🟠 P1 · 🟡 P2 · ✅ fixed in prior wave

## P0 — Core financial reads (list 10000)

| File | Lines | Collection(s) | Fix type |
|------|-------|---------------|----------|
| `backend/app/api/reports.py` | 56, 370 | journal_entries | query+date index / materialized GL |
| `backend/app/api/reports.py` | 560 | expenses | stream + `org_id+date` index |
| `backend/app/api/reports.py` | 603–605 | payments_received, payments_made, expenses | stream/query date range |
| `backend/app/api/reports.py` | 954, 977 | invoices | stream or aggregate |
| `backend/app/api/reports.py` | 1005 | items | stream (catalog) |
| `backend/app/api/reports.py` | 1028, 1048 | invoices, bills | replace with `collect_stream` (dup of aging) |
| `backend/app/api/exports.py` | 74, 109, 142, 225, 253, 285, 317, 323 | mixed | `stream_org_docs` export |
| `backend/app/api/l10n_iq.py` | 95, 138, 152, 320 | invoices, bills, payments | stream |
| `backend/app/services/period_close.py` | 114, 174 | accounts | stream |
| `backend/app/services/lot_allocation.py` | 63, 209 | batches/lots | stream |
| `backend/app/api/banking.py` | 832 | bank_transactions | stream |
| `backend/app/api/inventory.py` | 959 | stock_movements | stream |

## P0 — Reports N+1 / logic bugs

| Function | Lines | Issue |
|----------|-------|-------|
| `_get_journal_balances` | 55–78 | JE list 10k + `get_lines` per JE |
| `general_ledger` | 368–382 | Same N+1 |
| `sales_by_item` | 524–537 | `get_lines` per invoice |
| `project_profitability_report` | 739–760 | Per-project `list(5000)` loop |
| `top_items` | 977–983 | `lines` empty on list — under-report |
| `budget_vs_actual_report` | 689–692 | JE all-time, no period filter |

## P0 — Atomic integrity (CRITICAL)

| File | Lines | Flow |
|------|-------|------|
| `backend/app/api/inventory.py` | 856–892 | `validate_stock_move` warehouse partial |
| `backend/app/api/inventory.py` | 1035–1044 | `done_picking` multi ws update |
| `backend/app/services/pos_inventory.py` | 66–79 | deduct non-transactional |
| `backend/app/api/pos.py` | 1464–1524 | `sync_orders` inventory after order |
| `backend/app/api/fiscal.py` | 109–130 | year close 3-step |
| `backend/app/services/period_close.py` | 299–307 | JE not transactional with accounts |
| `backend/app/api/payroll.py` | 371–380 | `post_payroll_je` 3 commits |

## P0 — Deploy / topology

| Item | Current | Target |
|------|---------|--------|
| Cloud Run region | `me-central1` in CI | `europe-west1` |
| Env file in CI | inline minimal | `cloudrun-deploy-env.yaml` |
| `FIREBASE_PROJECT_ID` in deploy | missing | `zoho-83cda` |
| Firestore index deploy project | may be compute project | `zoho-83cda` |

## P1 — Core (list 10000 / 5000)

| File | Lines |
|------|-------|
| `companies.py` | 90, 91, 144 |
| `branches.py` | 62, 63 |
| `cashflow_forecast.py` | 47, 55 |
| `crm.py` | 463, 502, 530, 555 |
| `einvoice.py` | 285, 306 |
| `payroll.py` | 393, 394 |
| `budgets.py` | 166 |
| `customer_statements.py` | 50 |
| `rbac.py` | 142 |
| `fx.py` | 79 |
| `bank_import_service.py` | 242 |
| `subscriptions.py` | 642 |
| `audit.py` | 100 |
| `custom_reports.py` | 285 |

## P1 — Atomic HIGH

| File | Lines | Flow |
|------|-------|------|
| `purchase_orders.py` | 244–264 | convert-to-bill |
| `purchase_orders.py` | 317–330 | GRN + lots |
| `grn_lots.py` | 43–70 | batch + stock per line |
| `expenses.py` | 440–452 | payment + JE split |
| `expenses.py` | 482–487 | void_payment_made |
| `manufacturing.py` | 241–260 | MO done no stock |
| `returns.py` | 209–332 | approve/refund multi-write |

## P2 — Industry scaffold — ✅ migrated (Wave S, 2026-05-26)

Dashboard/stats endpoints in `quality.py`, `helpdesk.py`, `knowledge.py`, `hr_extended.py`, `hospital.py`, `hotel.py`, `pharmacy.py`, `real_estate.py`, `comms.py`, `livechat.py`, `maintenance.py`, `elearning.py`, `education.py`, `agriculture.py`, `field_service.py`, `social.py`, `whatsapp.py` now use `collect_stream(..., max_docs=10000)`.

## Index gaps (add to `firestore.indexes.json`)

| Collection | Fields | Used by |
|------------|--------|---------|
| expenses | org_id, date DESC | reports, cash flow |
| payments_received | org_id, date DESC | cash flow, partner ledger |
| payments_made | org_id, date DESC | cash flow |
| invoices | org_id, status, **date** DESC | list_page status filter |
| invoices | org_id, contact_id, **date** DESC | list + partner ledger |
| invoices | org_id, **created_at** DESC | default list |
| contacts | org_id, **display_name** ASC | contacts list + search |
| stock_movements | org_id, item_id, **date** DESC | inventory list |
| accounts | org_id, code ASC | reports COA |
| credit_notes | org_id, contact_id, date | partner ledger |
| settings | org_id, key, category | system.py |

## ✅ Already shipped (do not regress)

- data-integrity-wave atomics (POS, bank, AR/AP pay)
- firestore-performance: stream_org_docs, org_counters, api_list, po_receive, bill_approve, transfer/adjustment atomic, pos/dashboard stream, PITR, audit CI tools
