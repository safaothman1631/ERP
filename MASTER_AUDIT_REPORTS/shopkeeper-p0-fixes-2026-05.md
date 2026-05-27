# Shopkeeper P0 Fixes — 2026-05-26

**Spec:** `.kiro/specs/shopkeeper-production-core/`

## Fixed (Wave A)

| ID | Issue | Fix |
|----|-------|-----|
| A1 | POS stock never deducted (`qty` vs `quantity`) | Alias `quantity` on lines + `line_quantity()` helper |
| A2 | Double pay on paid orders | HTTP 409 `already_paid`; draft-only pay |
| A3 | Offline flush without idempotency | `flushQueue` → `POST /api/pos/orders/sync` |
| A4 | Bank recon summary wrong field | Use `transaction_type` |
| A5 | CSV import crashes on `account.update` | `account_repo.update` with running balance |
| A6 | Duplicate `/match` routes | Legacy → `/match-document` |
| A7 | AR payment silent failure | HTTP 422 on `record_payment` error |
| A8 | PO receive without GRN | 422 `grn_required` unless shortcut perm |

## Tests added

- `backend/tests/test_pos_inventory_qty.py`
- `backend/tests/test_shopkeeper_core_flow.py`
- `backend/tests/test_banking_reconciliation_summary.py`
- `frontend/src/pos/__tests__/posOfflineQueue.test.ts` (updated)
- `frontend/e2e/scenarios/shopkeeper_core.spec.ts`

## Wave E (complete)

| ID | Deliverable |
|----|-------------|
| E1 | `post_session_sales_journal` on session close |
| E2 | `create_invoice_from_pos_order` |
| E3 | Bank match → PaymentReceived + JE |
| E4 | `purchases.require_grn` default true |
| E5 | IndexedDB offline queue |

## Extended tests

- `test_pos_accounting.py`, `test_bank_match_payment.py`, `test_shopkeeper_api_integration.py`
