# Requirements Document: Phase 1 — Accounting Hardening

## Introduction

This phase brings the accounting subsystem of Zoho ERP (ERPIQ) to production-ready integrity. Today the system has functional CRUD for invoices, bills, journals, payments, and reports, but it lacks the **server-side correctness guarantees** that make ERPs trustworthy for real businesses: server-validated double-entry balance, gap-less document numbering, period locking that actually rejects writes, multi-currency revaluation, a tax engine that supports tax groups and Iraq compound taxes, and aged AR/AP / partner ledger reports. In addition, 18 frontend endpoints documented in `MASTER_AUDIT_REPORTS/endpoints.md` are referenced by the UI but missing in the backend, causing 405/404 errors in production scenarios.

The goal of Phase 1 is: **zero unbalanced journal entries, zero sequence gaps, period close enforced on every write, Iraq VAT 5% + WHT 3-5% computed correctly, and every endpoint the frontend calls actually responds.**

---

## Glossary

- **JE (Journal Entry)**: A double-entry document with two or more lines whose debits equal credits.
- **JE Line**: A row in a JE with `account_id`, `debit`, `credit`, optional `analytic_account_id`, and metadata.
- **Posting**: The act of finalizing a JE — after posting, lines may not be edited; a JE may only be reversed.
- **Period Lock**: A configuration on `fiscal_years` or per-journal that rejects any write whose date is on or before the lock date.
- **Sequence**: A `numbering_sequences` document defining `prefix`, `suffix`, `padding`, `next_number`, scoped per `(org_id, branch_id, doc_type)`.
- **Tax Group**: A composite tax that applies multiple child taxes in sequence, supporting compound (tax-on-tax) calculation.
- **Aged Bucket**: One of `0–30`, `31–60`, `61–90`, `90+` days based on invoice/bill due date relative to a report date.
- **Partner Ledger**: A report listing every accounting movement involving a specific contact (customer or vendor) over a date range, with running balance.
- **Revaluation Entry**: A journal entry posted at a period boundary that adjusts foreign-currency receivables/payables to the latest FX rate, recognizing unrealized gain/loss.
- **3-Way Match**: The accounting control that requires PO, Goods Receipt, and Bill to match on quantity and price within tolerance before payment is allowed.
- **WHT (Withholding Tax)**: An Iraq tax (3% or 5% depending on contract type) that the buyer withholds from a vendor payment and remits to the tax authority.
- **VAT Form**: Iraq's monthly VAT return form (Form 5 / Form 3) listing taxable sales and purchases.

---

## Requirements

### Requirement 1: Server-Side Journal Entry Balance Validation

**User Story:** As an accountant, I want the system to reject any unbalanced journal entry server-side before it is persisted, so that the general ledger can never enter an invalid state.

#### Acceptance Criteria

1. WHEN a JE is posted via `POST /api/journals/{id}/post` or any internal service that produces a JE (invoice posting, bill posting, payment posting, payroll, depreciation, FX revaluation), THE Accounting Service SHALL compute `Σ debit` and `Σ credit` across all JE lines and SHALL reject the write with HTTP 422 if `abs(Σ debit − Σ credit) > 0.005` (rounding half-cent tolerance for IQD; 0.01 for USD/EUR).
2. WHEN a JE has fewer than 2 lines, THE Accounting Service SHALL reject the write with HTTP 422 and message `"Journal entry must have at least 2 lines"`.
3. WHEN any JE line has both `debit > 0` AND `credit > 0`, THE Accounting Service SHALL reject the write with HTTP 422 and message `"Each line must be either debit or credit, not both"`.
4. WHEN any JE line has `debit < 0` OR `credit < 0`, THE Accounting Service SHALL reject the write with HTTP 422 and message `"Debit and credit must be non-negative"`.
5. WHEN a JE is posted, THE Accounting Service SHALL persist the write inside a Firestore transaction that re-validates the balance and the period lock atomically; concurrent posts that would race SHALL be serialized by the transaction.
6. THE Accounting Service SHALL expose a CLI script `backend/scripts/audit_je_balance.py` that scans every JE in every org, reports unbalanced entries with `(org_id, je_id, total_debit, total_credit, diff)`, and exits with code 0 if zero unbalanced entries are found, code 1 otherwise.
7. WHEN a posted JE is reversed via `POST /api/journals/{id}/reverse`, THE Accounting Service SHALL create a new JE with the same lines and amounts swapped (debit↔credit) on the reversal date, and SHALL link the reversal to the original via `reversed_by`/`reverses` fields.
8. WHEN a JE that has already been reversed is reversed again, THE Accounting Service SHALL reject the write with HTTP 409 and message `"Journal entry already reversed"`.
9. THE balance validation SHALL be implemented in `backend/app/services/accounting.py` as a pure function `validate_je_balance(lines: list[dict]) -> None` that raises `HTTPException(422, ...)` on failure, and SHALL be unit-testable without Firestore.

### Requirement 2: Gap-Less Document Numbering

**User Story:** As an auditor, I want every business document (invoice, bill, JE, payment, quote, SO, PO, credit note) to have a strictly monotonic, gap-less number per organization, so that I can detect missing or fraudulent documents immediately.

#### Acceptance Criteria

1. THE Numbering Service SHALL atomically increment `next_number` in `numbering_sequences/{org_id}_{doc_type}_{branch_id?}` inside a Firestore transaction so that two concurrent requests can never receive the same number.
2. WHEN a sequence has `prefix="INV-"`, `padding=6`, `next_number=42`, the next allocation SHALL produce `"INV-000042"` and increment `next_number` to `43`.
3. THE Numbering Service SHALL expose a CLI script `backend/scripts/audit_sequence_gaps.py` that scans every doc_type for every org, sorts allocated numbers, reports any gap or duplicate with `(org_id, doc_type, missing_numbers, duplicates)`, and exits with code 0 if zero gaps and zero duplicates, code 1 otherwise.
4. WHEN a document creation fails after a number has been allocated, THE Numbering Service SHALL record the abandoned number in `numbering_sequences/{seq_id}/abandoned/{number}` collection so that the gap script does not flag it as a real gap.
5. WHEN `next_number` is manually edited by an admin via `PATCH /api/settings/numbering/{seq_id}`, THE Numbering Service SHALL reject any value lower than the current `next_number` with HTTP 422 and message `"Cannot decrease next_number"`.
6. WHEN a sequence is created with `reset_period="yearly"` and the org's fiscal year rolls over, THE Numbering Service SHALL reset `next_number` to `1` automatically on the first allocation of the new fiscal year.

### Requirement 3: Period Lock Enforcement

**User Story:** As a CFO, I want to lock closed accounting periods so that no user (including admins) can post or modify JEs dated on or before the lock date.

#### Acceptance Criteria

1. WHEN a JE is created or posted with `date <= lock_date` where `lock_date` is the org's `fiscal_lock_date` setting, THE Accounting Service SHALL reject the write with HTTP 409 and message `"Period locked: cannot post on or before <lock_date>"`.
2. WHEN a JE is reversed and the original JE's date is `<= lock_date` AND the reversal date is also `<= lock_date`, THE Accounting Service SHALL reject the reversal with HTTP 409.
3. WHEN a JE is reversed with reversal date `> lock_date`, THE Accounting Service SHALL allow the reversal even if the original JE's date is `<= lock_date`.
4. THE Accounting Service SHALL expose `GET /api/fiscal/lock-status?date=YYYY-MM-DD` returning `{locked: bool, lock_date: ISO8601, reason: string}`.
5. WHEN a fiscal year is closed via `POST /api/fiscal/years/{fy_id}/close`, THE Accounting Service SHALL atomically (a) compute net P&L for the fiscal year, (b) post a closing JE that debits/credits all P&L accounts to zero against the configured Retained Earnings account, (c) set `fy.status="closed"`, and (d) set `org.fiscal_lock_date = fy.end_date`.
6. WHEN a closed fiscal year is reopened via `POST /api/fiscal/years/{fy_id}/reopen`, THE Accounting Service SHALL reverse the closing JE, set `fy.status="open"`, and shift `org.fiscal_lock_date` to the previous fiscal year's end date.
7. THE period lock check SHALL be invoked by every service that posts a JE, including invoice/bill posting, payment posting, payroll runs, depreciation runs, FX revaluation, and manual JE entry.

### Requirement 4: Tax Engine v2

**User Story:** As an Iraqi business owner, I want the tax engine to compute VAT 5% and WHT 3-5% correctly on every line, support tax groups and compound taxes, and produce a VAT return that reconciles to the GL.

#### Acceptance Criteria

1. THE Tax Engine SHALL support three tax types: `"simple"` (single rate), `"group"` (sum of children), and `"compound"` (each child applies on top of the previous including children's tax).
2. WHEN an invoice line has `quantity=10`, `unit_price=100`, `discount_pct=10`, and a simple 5% VAT, THE Tax Engine SHALL compute `subtotal = 10 * 100 * 0.9 = 900`, `tax = 900 * 0.05 = 45`, `total = 945`.
3. WHEN a line has a tax group containing 5% VAT and 3% WHT (additive, not compound), THE Tax Engine SHALL compute `vat = subtotal * 0.05`, `wht = subtotal * 0.03`, and report each tax separately on the invoice and the JE.
4. WHEN a line has a compound tax `[5% A, 3% B]`, THE Tax Engine SHALL compute `tax_a = subtotal * 0.05`, then `tax_b = (subtotal + tax_a) * 0.03`.
5. THE Tax Engine SHALL be implemented as a pure function `compute_line_taxes(quantity, unit_price, discount_pct, tax_id, tax_repo) -> dict` returning `{subtotal, tax_lines: [{tax_id, name, rate, amount, type}], total}`, unit-testable without Firestore.
6. WHEN an invoice is posted, THE Accounting Service SHALL produce JE lines that credit the configured tax payable account (per tax_id) for each tax computed on each invoice line.
7. WHEN a bill with WHT is posted, THE Accounting Service SHALL produce a JE that debits the expense, credits the AP account for `total - wht`, and credits the WHT payable account for `wht`.
8. THE VAT Return endpoint `GET /api/taxes/vat-return?period=YYYY-MM` SHALL return `{taxable_sales, output_vat, taxable_purchases, input_vat, net_vat_due, sample_journal_entries: [...]}` and SHALL reconcile against the GL within 0.01 IQD.
9. THE Tax Engine SHALL handle reverse-charge scenarios where an input VAT both debits input VAT receivable and credits output VAT payable for the same amount (for imported services).
10. WHEN tax engine v2 is enabled via the feature flag `TAX_ENGINE_V2`, the system SHALL use the new engine; when disabled, THE Tax Engine SHALL fall back to the v1 single-rate behavior to avoid breaking existing invoices.

### Requirement 5: Aged AR/AP and Partner Ledger Reports

**User Story:** As an accountant, I want aged receivable, aged payable, and partner ledger reports so that I can chase overdue customers and reconcile vendor balances.

#### Acceptance Criteria

1. THE Reports Service SHALL expose `GET /api/reports/aged-receivable?as_of=YYYY-MM-DD` returning per-customer aged buckets `{customer_id, customer_name, total, b_0_30, b_31_60, b_61_90, b_90_plus}` for every customer with non-zero open balance.
2. THE Reports Service SHALL expose `GET /api/reports/aged-payable?as_of=YYYY-MM-DD` returning the equivalent for vendors using bills.
3. THE Reports Service SHALL expose `GET /api/reports/partner-ledger?contact_id=...&from=...&to=...` returning `{opening_balance, lines: [{date, doc_type, doc_number, ref, debit, credit, running_balance}], closing_balance}` for the specified contact and date range.
4. THE three reports SHALL all support `format=pdf`, `format=excel`, and default JSON output.
5. WHEN the partner ledger is generated for a contact with no movements in the date range, THE Reports Service SHALL return `opening_balance` and `closing_balance` from the GL (computed by summing all JE lines tagged with that `contact_id` before `from` date) and `lines: []`.
6. THE aged reports SHALL respect period locks — closed periods' invoices/bills SHALL be included, but only their snapshot at `as_of` SHALL be considered (no post-asof activity SHALL leak in).
7. THE Reports Service SHALL produce results within 5 seconds for an org with up to 50,000 invoices and 50,000 bills.

### Requirement 6: Multi-Currency Revaluation

**User Story:** As a CFO managing multi-currency operations, I want the system to revalue open foreign-currency receivables and payables at month-end FX rates, so that my financial statements reflect realistic gain/loss.

#### Acceptance Criteria

1. THE FX Service SHALL expose `POST /api/fx/revaluations` with body `{period_end: YYYY-MM-DD, currencies?: list[str], dry_run?: bool}` that computes for every open foreign-currency invoice and bill the difference between the invoice-date FX rate and the period-end FX rate, and posts a single revaluation JE per currency.
2. WHEN `dry_run=true`, THE FX Service SHALL return the proposed JE lines without persisting any data.
3. THE revaluation JE SHALL debit/credit `Unrealized Gain/Loss on FX` (mapped from settings) against the AR/AP control account in functional currency.
4. WHEN a revaluation is reversed via `DELETE /api/fx/revaluations/{id}`, THE FX Service SHALL post a reversing JE on the first day of the next period.
5. THE FX Service SHALL fetch daily FX rates from a configurable provider (default: a manual-entry-only provider; pluggable to ECB/Open Exchange Rates if API key is configured) and store them in `currency_rates`.
6. WHEN the revaluation is run for a period that has already been revalued, THE FX Service SHALL reject the call with HTTP 409 unless `force=true` is passed.

### Requirement 7: Fix 18 Missing Frontend Endpoints

**User Story:** As a developer, I want every endpoint that the frontend calls to actually exist on the backend, so that no production scenario crashes with 404 or 405.

#### Acceptance Criteria

1. THE Backend SHALL implement or document-as-deprecated each of the 18 mismatched/missing endpoints listed in `MASTER_AUDIT_REPORTS/endpoints.md`:
   - `delivery-challans` CRUD (5 endpoints)
   - `fiscal/budgets` CRUD (5 endpoints)
   - `fiscal/years/{id}/close` and `/reopen` (2 endpoints)
   - `credit-notes/{id}/applications` and apply/unapply (3 endpoints)
   - `invoices/{id}/apply-retainer` (1 endpoint)
   - 8 dynamic action endpoints (verified by sample call from frontend route audit)
2. WHEN the endpoint audit script `frontend/scripts/endpoint-audit.mjs` is re-run, the output SHALL show `mismatch=0, missing=0`.
3. EVERY new endpoint SHALL require authentication via `get_current_user` and SHALL apply the relevant `require_perm` for the doc type.
4. EVERY new endpoint SHALL have at least one pytest unit test covering the success path and one covering the unauthorized path.

### Requirement 8: Test Coverage and Verification

**User Story:** As a release manager, I want comprehensive automated tests that prove accounting correctness, so that no regression can ship to production.

#### Acceptance Criteria

1. THE backend SHALL ship at least the following new test files:
   - `backend/tests/test_accounting_balance.py` — JE balance validation properties (Hypothesis)
   - `backend/tests/test_numbering_gaps.py` — sequence gap-less property
   - `backend/tests/test_period_lock.py` — period lock enforcement
   - `backend/tests/test_tax_engine_v2.py` — tax computation properties
   - `backend/tests/test_aged_reports.py` — aged AR/AP correctness
   - `backend/tests/test_fx_revaluation.py` — revaluation JE balanced and signed correctly
2. EACH test file SHALL include at least 5 distinct test functions and at least 1 Hypothesis property test with `max_examples >= 100`.
3. THE backend's full pytest run SHALL complete with 0 failures and 0 errors.
4. THE CI workflow `.github/workflows/ci.yml` SHALL run backend pytest in addition to the existing compile check, and SHALL fail the build if any pytest test fails.

---

## Out of Scope (Phase 1)

- Bank synchronization (Plaid/Yodlee) — defer to Phase 5+
- Analytic accounting cost-center tracking — defer
- Budget vs Actual reports — defer (data model only in Phase 1)
- Deferred revenue/expense module — defer
- Loan amortization — defer
- Consolidation across companies — defer
- Studio custom field on JE — defer

---

## Definition of Done

- `audit_je_balance.py` exits 0 on production-like dataset of ≥1000 JEs
- `audit_sequence_gaps.py` exits 0 on the same dataset
- VAT return for one sample month reconciles to the GL within 0.01 IQD
- All 6 new test files pass; full pytest run is green
- `endpoint-audit.mjs` shows `mismatch=0, missing=0`
- A reversal JE that crosses a period lock is correctly handled (allowed when reversal date > lock_date, rejected otherwise)
