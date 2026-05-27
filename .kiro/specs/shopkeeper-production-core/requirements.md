# Requirements: Shopkeeper Production Core (Iraq Retail SMB)

## Introduction

This spec closes **sale blockers** for a single-org Iraqi retail shopkeeper using only:

**Purchase · Sales (AR/debt) · Inventory · POS · Accounting (GL) · Banking**

It is narrower than full Odoo parity (`gap-matrix.md`) but **deeper** than Phase 6 smoke: every money path must be integer IQD, inventory must move on POS pay, offline POS must dedupe, banking reconciliation math must match stored fields, and AR payments must not silently fail.

**Out of scope:** Wave verticals, portal users, subscriptions, manufacturing MRP, Iraq ITA production credentials (config-only), FIB/Zain merchant keys (config-only).

---

## Glossary

- **Shopkeeper bundle:** Licensed modules `{accounting, sales, purchase, inventory, banking, taxes, pos}` — no scaffold nav.
- **Production path:** User journey that must work daily without workarounds.
- **Money:** All amounts in **integer minor units** (IQD fils = whole IQD in practice).
- **Debt (قەرز):** Customer `balance_due` on invoices + vendor AP on bills; aged AR/AP reports.
- **GRN:** Goods receipt note updating `qty_received` before bill 3-way match.

---

## Requirement 1: Module & Role Gate

1. WHEN a tenant is onboarded as **retail shopkeeper**, THE Platform SHALL enable only the shopkeeper bundle (see `module_registry.py` bundle `retail_core` or equivalent).
2. WHEN a user without `purchase.read` calls purchase APIs, THE Backend SHALL return HTTP 403.
3. WHEN POS-only license is active, THE Backend SHALL deny `POST /api/purchase-orders` (existing `test_org_license.py` pattern).
4. THE Default role for cashier SHALL NOT include `bank.write` or `bills.match_override`.

---

## Requirement 2: Purchase → Stock → Bill (Procure-to-Pay)

1. THE Purchase State Machine SHALL enforce `draft → sent → confirmed → received → billed → done` (existing `state_machine.py`).
2. WHEN `POST /purchase-orders/{id}/receive` is called without any GRN lines, THE Backend SHALL return HTTP 422 with `code: "grn_required"` unless caller has `purchase.receive_shortcut` AND body contains `{"acknowledge_shortcut": true}`.
3. WHEN a GRN is posted, THE Inventory Service SHALL increment `stock_on_hand` and create stock moves (existing GRN path).
4. WHEN `POST /bills/{id}/approve` runs with PO reference, THE 3-Way Match Service SHALL block over-billing (existing `expenses.py` + `ThreeWayMatchService`).
5. WHEN bill is approved, THE Backend SHALL post AP JE (debit expense/inventory, credit AP) — amount equals integer sum of lines.

---

## Requirement 3: Sales → Invoice → Payment (Order-to-Cash / Debt)

1. THE Sales State Machine SHALL reject invalid transitions with HTTP 409 (existing).
2. WHEN `POST /api/invoices/payments` records a payment against `invoice_id`, THE Backend SHALL update `balance_due` atomically; IF update fails, THE Backend SHALL return HTTP 422 (not silent success).
3. WHEN payment zeroes `balance_due`, THE Invoice state SHALL become `paid` and webhook `invoice.paid` MAY fire.
4. THE Reports API SHALL expose aged AR with buckets 0–30, 31–60, 61–90, 90+ (existing `aged_reports.py`).
5. THE Customer statement endpoint SHALL return opening balance, lines, closing balance (existing `customer_statements.py`).

---

## Requirement 4: POS Day (Session → Sell → Pay → Close)

1. WHEN a POS order line is stored, THE line document SHALL include both `qty` and `quantity` equal values for inventory consumers.
2. WHEN `POST /api/pos/orders/{id}/pay` runs on a **draft** order with sufficient payment, THE Backend SHALL set `state=paid` AND deduct `stock_on_hand` by line quantity.
3. WHEN `POST /api/pos/orders/{id}/pay` runs on an already **paid** order, THE Backend SHALL return HTTP 409 `already_paid`.
4. WHEN offline orders flush, THE Frontend SHALL call `POST /api/pos/orders/sync` with `temp_id` per queued order (UUID), not duplicate `/orders` + `/pay` pairs without idempotency.
5. WHEN sync replays the same `temp_id`, THE Backend SHALL return the same `order_id` from idempotency cache.
6. WHEN sync fails stock check, THE Backend SHALL return structured error `{code: "insufficient_stock", item_id, available}`.
7. WHEN session closes with cash variance above threshold, THE Backend SHALL require `variance_reason` (existing session close).
8. POS invoice conversion (`/orders/{id}/invoice`) MAY remain preview-tier; shopkeeper AR for walk-in sales is optional if POS totals suffice for Z-report.

---

## Requirement 5: Accounting Integrity

1. EVERY posted JE SHALL satisfy `sum(debit) == sum(credit)` in integer minor units (`validate_je_balance`).
2. WHEN period is locked, THE Backend SHALL reject posting with HTTP 423/409 (existing fiscal lock).
3. WHEN POS session posts cash short/over JE on close, lines SHALL use configured cash account from POS config.

---

## Requirement 6: Banking & Reconciliation

1. Bank transactions SHALL use field `transaction_type ∈ {debit, credit}` consistently.
2. WHEN `GET /banking/accounts/{id}/reconciliation-summary` is called, THE `system_balance` SHALL be computed using `transaction_type`, not legacy `type`.
3. WHEN CSV import runs, THE Backend SHALL update `current_balance` via `BankAccountRepository.update` without calling `.update()` on dict instances.
4. THE Legacy match endpoint SHALL be `POST /transactions/{id}/match-document` to avoid route collision with intelligent matcher `POST /transactions/{id}/match`.
5. WHEN intelligent match applies `create_payment` to invoice, THE Service SHALL call `InvoiceRepository.record_payment` (future P1); v1 MAY link metadata only if documented in design.

---

## Requirement 7: Verification (Tester Agent)

1. THE Backend SHALL ship `tests/test_shopkeeper_core_flow.py` covering: line qty alias, pay guard, sync idempotency shape, reconciliation summary field, payment failure surfacing.
2. THE Backend SHALL ship `tests/test_pos_inventory_qty.py` for stock deduction with `qty`-only lines.
3. THE Frontend SHALL ship `e2e/scenarios/shopkeeper_core.spec.ts` covering: login, items list, invoice list, POS hub, banking accounts, purchase orders, API-level POS sync contract (mock or live).
4. THE Vitest suite SHALL assert offline flush uses `/api/pos/orders/sync`.
5. ALL new tests SHALL pass in CI (`pytest` + `vitest` + Playwright scenario on staging/local).

---

## Acceptance Criteria (Sign-off)

| # | Criterion |
|---|-----------|
| AC-1 | Zero P0 items open in `shopkeeper-production-core/tasks.md` Wave A |
| AC-2 | `pytest tests/test_shopkeeper_core_flow.py tests/test_pos_inventory_qty.py -q` green |
| AC-3 | `npx vitest run src/pos/__tests__/posOfflineQueue.test.ts` green |
| AC-4 | Playwright `shopkeeper_core.spec.ts` green against API+UI |
| AC-5 | Manual script: one day POS + one supplier bill + one customer payment + bank CSV import |

---

## Traceability

| Requirement | gap-matrix | LAUNCH_DECISION |
|-------------|------------|-----------------|
| R4 POS offline | POS offline P0 | Phase 4 ✅ with caveat |
| R6 Banking | Bank recon P1 | banking Tier 3 |
| R2 Purchase | 3-way match | Phase 3 ✅ |
| R3 AR debt | AR/AP 4.0 | Phase 1 aged reports |
