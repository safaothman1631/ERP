# Requirements: Data Integrity Wave (ERP Trust Layer)

## Introduction

Firestore is the system of record. Financial and inventory correctness must not depend on UI discipline alone. This wave establishes **detect → prevent → recover** for shopkeeper and all `production_core` tenants.

**Non-goals:** Migrating to PostgreSQL; rewriting all 120 routes; Odoo feature parity.

---

## Glossary

- **Drift:** Denormalized field (e.g. `balance_due`, `stock_on_hand`, `current_balance`) differs from ledger of movements/payments beyond tolerance.
- **Atomic write:** Firestore transaction or batch where all writes succeed or none apply.
- **Tenant guard:** `document.org_id` must equal repository `org_id` on every `get()` by id.

---

## Requirement 1: Tenant isolation on read-by-id

1. WHEN `BaseRepository.get(doc_id)` loads a document, THE Repository SHALL return `None` if `doc.org_id != repository.org_id`.
2. WHEN a cross-tenant id is requested, THE Backend SHALL NOT leak document body (same as 404).
3. THE change SHALL apply to all collections using `BaseRepository`.

---

## Requirement 2: Atomic money and inventory writes

1. WHEN `POST /api/pos/orders/{id}/pay` succeeds, THE Backend SHALL atomically: set order paid, create payments, deduct stock (same transaction or sequential transaction with rollback policy documented).
2. WHEN `POST /api/banking/transactions` creates a row, THE Backend SHALL atomically update `bank_accounts.current_balance`.
3. WHEN `POST /api/invoices/payments` allocates to an invoice, THE Backend SHALL atomically create payment record and update invoice `balance_due` / status.
4. IF any step fails mid-chain, THE Backend SHALL NOT leave orphan partial state where avoidable.

---

## Requirement 3: Reconciliation engine (detect drift)

1. THE CLI `scripts/reconcile_org.py` SHALL accept `--org-id` and optional `--fix` (dry-run default).
2. FOR each invoice with `balance_due`, THE script SHALL compute expected balance from `total - sum(allocations)` and report drift > 0.01 IQD.
3. FOR each trackable item, THE script SHALL compare `stock_on_hand` vs sum of `stock_movements.quantity` (per org).
4. FOR each bank account, THE script SHALL compare `current_balance` vs `opening_balance + credits - debits` on reconciled or all transactions (config flag).
5. THE script SHALL exit code `1` if any drift found (CI gate friendly).
6. WITH `--fix`, THE script SHALL only update denormalized fields, never delete documents.

---

## Requirement 4: Operations and launch gate

1. `OPERATIONS_RUNBOOK.md` SHALL document: PITR enablement, daily reconcile cron, launch checklist.
2. `LAUNCH_DECISION.md` SHALL reference Data Integrity Wave sign-off.
3. `GET /api/system/health` (or reconcile sub-endpoint) SHALL expose last reconcile summary if run via API optional — v1 CLI only acceptable.

---

## Requirement 5: Firestore resilience

1. WHEN quota error on `list()`, THE Repository SHALL NOT return empty list without logging (upgrade: log warning).
2. THE Idempotency store TTL SHALL remain 7 days for POS sync keys.

---

## Requirement 6: Verification

1. `tests/test_repository_org_guard.py` — cross-org get returns None.
2. `tests/test_reconcile_org.py` — unit tests for drift math helpers.
3. `tests/test_atomic_money_paths.py` — mocked transaction paths for banking/payment.
4. Existing shopkeeper suite (14+) and full pytest SHALL pass.

---

## Acceptance criteria

| ID | Criterion |
|----|-----------|
| AC-1 | `reconcile_org.py --org-id X` runs dry-run without crash |
| AC-2 | Cross-org `get()` covered by test |
| AC-3 | Banking create uses transaction |
| AC-4 | Invoice payment path uses transaction batch |
| AC-5 | Kiro tasks.md all Wave A/B checked |
