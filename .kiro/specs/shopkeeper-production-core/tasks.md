# Tasks: Shopkeeper Production Core

**Spec:** [requirements.md](./requirements.md) · [design.md](./design.md)  
**Status:** Complete (2026-05-26)

---

## Wave A — P0 Fixes

- [x] A1–A9 (see `MASTER_AUDIT_REPORTS/shopkeeper-p0-fixes-2026-05.md`)

---

## Wave B — Backend tests

- [x] B1 `test_pos_inventory_qty.py`
- [x] B2 `test_shopkeeper_core_flow.py`
- [x] B3 `test_banking_reconciliation_summary.py`
- [x] B4 `test_shopkeeper_api_integration.py`
- [x] B5 `test_pos_accounting.py`
- [x] B6 `test_bank_match_payment.py`

---

## Wave C — Frontend tests

- [x] C1 `posOfflineQueue.test.ts`
- [x] C2 `shopkeeper_core.spec.ts`
- [x] C3 `retail.spec.ts` → delegates to shopkeeper_core
- [x] C4 `ci.yml` shopkeeper pytest gate

---

## Wave D — Documentation

- [x] D1 Kiro spec trio
- [x] D2 `LAUNCH_DECISION.md` addendum
- [x] D3 `shopkeeper-p0-fixes-2026-05.md` + Wave E log below
- [x] D4 Manual AC-5 (KU) in `OPERATIONS_RUNBOOK.md`

---

## Wave E — P1 depth

- [x] E1 POS session close → `post_session_sales_journal`
- [x] E2 POS `/orders/{id}/invoice` → `create_invoice_from_pos_order`
- [x] E3 Bank `apply_match` → `PaymentReceived` + `record_payment` + JE
- [x] E4 `purchases.require_grn` default `true` in settings
- [x] E5 IndexedDB queue (`posOfflineDb.ts`) + localStorage fallback

---

## Verification commands

```bash
cd backend
pytest tests/test_pos_inventory_qty.py tests/test_shopkeeper_core_flow.py tests/test_banking_reconciliation_summary.py tests/test_pos_accounting.py tests/test_bank_match_payment.py tests/test_shopkeeper_api_integration.py -q

cd frontend
npx vitest run src/pos/__tests__/posOfflineQueue.test.ts
npx playwright test e2e/scenarios/shopkeeper_core.spec.ts
```
