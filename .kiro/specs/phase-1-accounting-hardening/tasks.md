# Implementation Plan: Phase 1 — Accounting Hardening

## Overview

Implement seven workstreams in order. Each task references the requirement(s) it satisfies and the file(s) it touches. Sub-tasks are designed so the largest unit of code change is a single function or test class. After every numbered task, run the verification command listed at the end of this file.

---

## Tasks

- [ ] 1. Server-side JE balance validation
  - [ ] 1.1 Add `validate_je_balance(lines, currency)` pure function to `backend/app/services/accounting.py`
    - Compute `Σ debit` and `Σ credit` using `Decimal` to avoid float drift.
    - Tolerance map: `{"IQD": Decimal("0.005"), "USD": Decimal("0.01"), "EUR": Decimal("0.01")}` default `Decimal("0.01")`.
    - Raise `HTTPException(422, detail={"code":"je_unbalanced", "diff": ...})` on imbalance.
    - Validate min 2 lines, no `debit>0 AND credit>0`, no negative.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.9_
  - [ ] 1.2 Add `post_je_atomic(org_id, je_data)` that runs inside `firestore.transactional`
    - Re-validate inside the transaction (defeat TOCTOU).
    - Allocate JE number via `numbering_service.allocate_next(org_id, "journal_entry")`.
    - Write JE doc + lines subcollection in one batch.
    - _Requirements: 1.5, 2.1_
  - [ ] 1.3 Add `reverse_je(org_id, je_id, reversal_date, user_id)`
    - Load original JE; reject if `reversed_by` already set (HTTP 409).
    - Build mirrored lines (swap debit↔credit), set `reverses=original_id`.
    - Call `post_je_atomic` for the new JE.
    - Update original `reversed_by=new_id`.
    - _Requirements: 1.7, 1.8_
  - [ ] 1.4 Wire `validate_je_balance` into invoice/bill/payment posting paths
    - Replace any existing client-side checks with single server-side call.
    - Touch `invoices.py`, `expenses.py` (bills), `payments_received.py`, `payments_made.py`.
    - _Requirements: 1.1_
  - [ ] 1.5 Create `backend/scripts/audit_je_balance.py`
    - Iterate `organizations` collection → for each org iterate `journal_entries` → for each JE compute Σd, Σc → print mismatches → exit 0/1.
    - Support `--org` filter and `--fix-dry-run` for reporting only.
    - _Requirements: 1.6_
  - [ ] 1.6 Write `backend/tests/test_accounting_balance.py`
    - At least 8 tests + 2 Hypothesis properties (`max_examples=200`).
    - Coverage: balanced ok, unbalanced rejected, mixed debit/credit rejected, negative rejected, single-line rejected, IQD tolerance, USD tolerance, reversal idempotency.
    - _Requirements: 8.1, 8.2_

- [ ] 2. Gap-less numbering
  - [ ] 2.1 Refactor `numbering_service.allocate_next` to use `firestore.transactional`
    - Read sequence doc, increment, write — all in one transaction.
    - Add retry-on-contention up to 3 times with exponential backoff.
    - Return formatted string `f"{prefix}{n:0{padding}d}{suffix}"`.
    - _Requirements: 2.1, 2.2_
  - [ ] 2.2 Add `record_abandoned(org_id, doc_type, number, reason)` to `numbering_service.py`
    - Write to `numbering_sequences/{seq_id}/abandoned/{number}`.
    - Called from exception handler in invoice/bill/JE routers when allocation succeeded but persistence failed.
    - _Requirements: 2.4_
  - [ ] 2.3 Add `PATCH /api/settings/numbering/{seq_id}` validation
    - Reject `next_number` value lower than current `next_number` with HTTP 422.
    - _Requirements: 2.5_
  - [ ] 2.4 Add yearly auto-reset logic
    - In `allocate_next`, if `reset_period == "yearly"` AND current FY > `last_reset_year`, set `next_number=1` and `last_reset_year=current_year`.
    - _Requirements: 2.6_
  - [ ] 2.5 Create `backend/scripts/audit_sequence_gaps.py`
    - Iterate every `numbering_sequences` doc → list `journal_entries` (or invoices, bills) for that doc_type → compare expected vs actual numbers → minus abandoned subcollection.
    - Exit 0 if zero true gaps and zero duplicates.
    - _Requirements: 2.3_
  - [ ] 2.6 Write `backend/tests/test_numbering_gaps.py`
    - 6 tests + 1 Hypothesis property: ∀ N concurrent allocate_next calls → all numbers distinct.
    - _Requirements: 8.1, 8.2_

- [ ] 3. Period lock enforcement
  - [ ] 3.1 Add `check_lock(org_id, date, allow_equal=False)` to `period_close.py`
    - Read `org/{id}/settings/accounting.fiscal_lock_date`.
    - Raise `HTTPException(409, ...)` if condition met.
    - _Requirements: 3.1_
  - [ ] 3.2 Wire `check_lock` into every JE-emitting path
    - `accounting.post_je_atomic` (top-level call).
    - Invoice/bill/payment routers via `accounting.build_*_je`.
    - Payroll runs (`payroll.py` create_run).
    - Depreciation runs (`depreciation_service.py`).
    - FX revaluation (`fx_service.revalue_period`).
    - _Requirements: 3.7_
  - [ ] 3.3 Implement `close_fiscal_year(org_id, fy_id, user_id)`
    - Validate FY status is "open".
    - Compute net P&L: query JEs in FY range, sum lines per account, filter to accounts with `type IN ("revenue","expense")`.
    - Build closing JE: each non-zero P&L account gets a debit/credit to zero balance, offset to Retained Earnings.
    - Post via `post_je_atomic` with `skip_lock_check=True` (it's the closing JE itself).
    - Set FY status, `closed_at`, `closed_by`, `closing_je_id`.
    - Set `org.settings.accounting.fiscal_lock_date = fy.end_date`.
    - All in one transaction.
    - _Requirements: 3.5_
  - [ ] 3.4 Implement `reopen_fiscal_year(org_id, fy_id, user_id)`
    - Validate FY status is "closed".
    - Reverse the closing JE via `reverse_je`.
    - Set FY status open, clear `closing_je_id`.
    - Set `fiscal_lock_date` back to previous FY end_date (or null if no previous).
    - _Requirements: 3.6_
  - [ ] 3.5 Add `GET /api/fiscal/lock-status` endpoint
    - Query string `date=YYYY-MM-DD`.
    - Returns `{locked: bool, lock_date: ISO8601, reason: str}`.
    - _Requirements: 3.4_
  - [ ] 3.6 Update reversal logic in `accounting.reverse_je`
    - Allow reversal when `reversal_date > lock_date` even if `original.date <= lock_date`.
    - Reject when both are `<= lock_date`.
    - _Requirements: 3.2, 3.3_
  - [ ] 3.7 Write `backend/tests/test_period_lock.py`
    - 8 tests covering: post before lock rejected, post after lock allowed, lock on payroll, lock on FX revaluation, FY close + post rejected, reopen + post allowed, reversal across lock.
    - _Requirements: 8.1, 8.2_

- [ ] 4. Tax engine v2
  - [ ] 4.1 Create `backend/app/services/tax_engine.py`
    - Define `TaxComputation` dataclass.
    - Implement `compute_line_taxes(quantity, unit_price, discount_pct, tax_id, tax_repo)` for simple/group/compound modes using `Decimal`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ] 4.2 Implement `build_je_tax_lines(tax_computation, is_sale, settings)` helper
    - For sale invoices: credit Output VAT Payable per tax_id; for purchase: debit Input VAT Receivable per tax_id.
    - Iraq WHT: bills credit `WHT Payable` and reduce AP credit accordingly.
    - _Requirements: 4.6, 4.7_
  - [ ] 4.3 Add `GET /api/taxes/vat-return?period=YYYY-MM`
    - Query JEs in period whose lines reference accounts mapped to VAT settings.
    - Aggregate `taxable_sales`, `output_vat`, `taxable_purchases`, `input_vat`, `net_vat_due`.
    - Return sample JE list (max 10) for audit.
    - _Requirements: 4.8_
  - [ ] 4.4 Add reverse-charge VAT support
    - When a tax is configured with `reverse_charge=true`, `build_je_tax_lines` produces both debit input VAT and credit output VAT for the same amount.
    - _Requirements: 4.9_
  - [ ] 4.5 Add feature flag fallback
    - In `invoices.py` and `expenses.py` posting paths, check `feature_flags.is_enabled("TAX_ENGINE_V2", org_id)`.
    - If false, call legacy `tax_calc.py` single-rate path.
    - If true, use new `tax_engine.py`.
    - _Requirements: 4.10_
  - [ ] 4.6 Write `backend/tests/test_tax_engine_v2.py`
    - At least 12 tests covering: simple, group additive, group compound, discount applied before tax, WHT split on bill JE, reverse charge, decimal rounding, zero-rate, tax-exempt line.
    - 2 Hypothesis properties: `compute_line_taxes` is deterministic; `build_je_tax_lines` produces balanced JE lines.
    - _Requirements: 8.1, 8.2_

- [ ] 5. Aged AR/AP and Partner Ledger reports
  - [ ] 5.1 Create `backend/app/services/aged_reports.py`
    - Pure function `build_aged_buckets(open_docs, as_of)` that takes pre-fetched invoice/bill list and returns aged buckets per customer.
    - _Requirements: 5.1, 5.2, 5.7_
  - [ ] 5.2 Add `GET /api/reports/aged-receivable?as_of=...&format=json|pdf|excel`
    - Fetch open invoices (status != paid, balance_due > 0) with `due_date <= as_of` (allow undated → b_90_plus default).
    - Group by `customer_id`; produce buckets.
    - JSON default; PDF/Excel via existing `pdf_generator.py`/`export_service.py`.
    - _Requirements: 5.1, 5.4, 5.6_
  - [ ] 5.3 Add `GET /api/reports/aged-payable?as_of=...`
    - Same logic, mirrored on bills.
    - _Requirements: 5.2_
  - [ ] 5.4 Implement `build_partner_ledger(contact_id, je_lines, from, to, opening)`
    - Sort lines by date.
    - Compute running balance.
    - Include opening + closing balance.
    - _Requirements: 5.3_
  - [ ] 5.5 Add `GET /api/reports/partner-ledger?contact_id=...&from=...&to=...`
    - Fetch JE lines tagged with that contact_id (use Python filter, not Firestore composite).
    - Compute opening balance from JE lines before `from`.
    - _Requirements: 5.3, 5.5_
  - [ ] 5.6 Write `backend/tests/test_aged_reports.py`
    - 8 tests + 1 Hypothesis property: ∀ aged buckets, sum equals total.
    - _Requirements: 8.1, 8.2_

- [ ] 6. Multi-currency revaluation
  - [ ] 6.1 Create `backend/app/api/revaluations.py` router
    - Implements `POST /api/fx/revaluations` with body validation.
    - `GET /api/fx/revaluations` — list past revaluations.
    - `DELETE /api/fx/revaluations/{id}` — post reversing JE.
    - Apply `require_perm("accounts.fx_revalue")`.
    - _Requirements: 6.1, 6.4_
  - [ ] 6.2 Implement `fx_service.revalue_period(...)`
    - Fetch open foreign-currency invoices/bills in period.
    - Fetch period-end FX rate from `currency_rates`.
    - Compute revaluation per currency: `(period_end_rate - invoice_date_rate) * balance`.
    - Build single JE per currency: debit/credit Unrealized FX Gain/Loss vs AR/AP control.
    - Persist or return dry-run.
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ] 6.3 Add idempotency check
    - Reject if `revaluations` collection already has entry for `(org_id, period_end, currency)` unless `force=true`.
    - _Requirements: 6.6_
  - [ ] 6.4 Wire `currency_rates` repo + manual entry endpoint
    - `POST /api/fx/rates` — manual entry by accountant.
    - `GET /api/fx/rates?from=...&to=...&date=...` — read.
    - _Requirements: 6.5_
  - [ ] 6.5 Write `backend/tests/test_fx_revaluation.py`
    - 6 tests covering: revaluation balanced, dry-run no persist, gain JE direction, loss JE direction, idempotency, force override.
    - _Requirements: 8.1, 8.2_

- [ ] 7. Fix 18 missing endpoints
  - [ ] 7.1 Re-run `frontend/scripts/endpoint-audit.mjs` to capture current state
    - Save report under `MASTER_AUDIT_REPORTS/endpoints-phase1-baseline.json`.
    - _Requirements: 7.2_
  - [ ] 7.2 Implement `delivery-challans` CRUD
    - Create `backend/app/api/delivery_challans.py` with router.
    - Repository in `backend/app/firestore/delivery_challans.py`.
    - Pydantic schemas in router file (no `from __future__ import annotations`).
    - 5 endpoints: list, create, get, patch, delete.
    - Apply `require_perm("inventory.shipment")`.
    - _Requirements: 7.1, 7.3_
  - [ ] 7.3 Implement `fiscal/budgets` CRUD
    - Create `backend/app/api/budgets.py` (or extend existing if present).
    - 5 endpoints + budget vs actual aggregation helper.
    - _Requirements: 7.1, 7.3_
  - [ ] 7.4 Implement `credit-notes/{id}/applications`
    - GET applications, POST apply to invoice (decrease invoice balance + JE), POST unapply.
    - _Requirements: 7.1, 7.3_
  - [ ] 7.5 Implement `invoices/{id}/apply-retainer`
    - Apply a retainer (advance payment) to an invoice; reduce balance + JE.
    - _Requirements: 7.1, 7.3_
  - [ ] 7.6 Audit and add the 8 dynamic action endpoints
    - Diff frontend route audit JSON vs backend route catalog.
    - For each missing action, implement or document `410 Gone` if intentionally removed.
    - _Requirements: 7.1_
  - [ ] 7.7 Re-run `endpoint-audit.mjs`; expect `mismatch=0, missing=0`
    - Save report under `MASTER_AUDIT_REPORTS/endpoints-phase1-final.json`.
    - _Requirements: 7.2_
  - [ ] 7.8 Write smoke tests for new endpoints
    - At least 1 success-path + 1 unauthorized-path test per endpoint.
    - _Requirements: 7.4, 8.1_

- [ ] 8. CI integration
  - [ ] 8.1 Extend `.github/workflows/ci.yml` backend job
    - Add `pytest tests/ --tb=short --maxfail=5` step after current import-check.
    - Requires `pip install -r requirements.txt` (dev deps).
    - _Requirements: 8.4_
  - [ ] 8.2 Add `audit_je_balance.py` and `audit_sequence_gaps.py` as nightly job
    - New workflow `.github/workflows/audit-nightly.yml` triggered on schedule.
    - Runs against staging Firestore credentials (read-only service account).
    - Fails workflow + opens issue on mismatch.
    - _Requirements: 1.6, 2.3_

---

## Verification Command

After every task completion, run:

```powershell
cd c:\Users\SAFA\zoho\backend
.\venv\Scripts\python.exe -m pytest tests/ --tb=short -q
.\venv\Scripts\python.exe -c "from app.main import app; print('routes=', len(app.routes))"
.\venv\Scripts\python.exe scripts\audit_je_balance.py
.\venv\Scripts\python.exe scripts\audit_sequence_gaps.py
cd ..\frontend
node scripts\endpoint-audit.mjs
```

Expected at end of Phase 1:
- pytest: 0 failures
- routes: ≥ 2138 + ~25 new
- audit_je_balance: exit 0
- audit_sequence_gaps: exit 0
- endpoint-audit: `mismatch=0, missing=0`
