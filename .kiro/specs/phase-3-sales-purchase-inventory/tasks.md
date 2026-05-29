# Tasks: Phase 3

- [ ] 1. State machine library
  - [ ] 1.1 Create `services/state_machine.py` with `StateMachine` class
  - [ ] 1.2 Define `SALES_SM` and `PURCHASE_SM`
  - [ ] 1.3 Wire into Quote/SO/PO post/confirm/cancel endpoints
  - [ ] 1.4 Tests `tests/test_sales_state_machine.py`

- [ ] 2. 3-way match
  - [ ] 2.1 Refactor `services/three_way_match.py` as pure function
  - [ ] 2.2 Hook into bill post in `api/expenses.py`
  - [ ] 2.3 Add tolerance settings UI in Settings → Purchasing
  - [ ] 2.4 Add `bills.match_override` permission
  - [ ] 2.5 Tests `tests/test_purchase_3way_match.py`

- [ ] 3. Stock quants + lot/serial
  - [ ] 3.1 Create `firestore/stock_quants.py` repository
  - [ ] 3.2 Add `tracking` field to Item master
  - [ ] 3.3 Refactor stock-move logic to update quants
  - [ ] 3.4 Add lot CRUD endpoints
  - [ ] 3.5 Add picking strategy service
  - [ ] 3.6 Frontend lot/serial picker component
  - [ ] 3.7 POS lot picker integration
  - [ ] 3.8 APScheduler `expiry_alerts` job
  - [ ] 3.9 Tests `tests/test_lot_tracking.py`

- [ ] 4. Landed costs
  - [ ] 4.1 Create `api/landed_costs.py` router + `services/landed_cost.py`
  - [ ] 4.2 Implement allocation methods
  - [ ] 4.3 JE generation + reverse
  - [ ] 4.4 Frontend page
  - [ ] 4.5 Tests `tests/test_landed_cost.py`

- [ ] 5. E2E
  - [ ] 5.1 Playwright `quote_to_invoice.spec.ts`
  - [ ] 5.2 Playwright `po_to_bill_3way.spec.ts`
