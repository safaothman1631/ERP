# Accounting Audit — 2026-Q2
**Agent:** زۆهۆ ئەکاونتینگ | **Date:** 2026-04-24

## A. Coverage Snapshot

| Reference | Coverage % | Notes |
|-----------|-----------|-------|
| Odoo 19   | ~62%      | Core double-entry + reports هەیە، bank sync + analytic + budget نییە |
| Zoho Books| ~71%      | Invoicing + banking + reports تەواون، recurring + retainer ناتەواون |

## B. Top P0/P1 Gaps (max 10)

| ID | Severity | Title | File(s) | Odoo ref | Zoho ref | Effort |
|----|----------|-------|---------|----------|----------|--------|
| G-1| P0 | Bank reconciliation models نییە | backend/app/api/banking.py:L1 | applications/finance/accounting/bank/reconciliation_models.rst | Books > Banking > Rules | M |
| G-2| P0 | Partner ledger report نییە | backend/app/api/reports.py:L1 | applications/finance/accounting.rst:L344 | Books > Reports > Partner Ledger | S |
| G-3| P0 | Aged receivable/payable reports نییە | backend/app/api/reports.py:L1 | applications/finance/accounting/customer_invoices.rst:L433 | Books > Reports > Aged Receivables | S |
| G-4| P1 | Bank synchronization (Plaid/Yodlee/Ponto) نییە | backend/app/api/banking.py:L1 | applications/finance/accounting/bank/bank_synchronization.rst | Books > Banking > Bank Feeds | L |
| G-5| P1 | Payment terms بە discount نییە | backend/app/schemas/schemas.py | applications/finance/accounting/customer_invoices/cash_discounts.rst | Books > Settings > Payment Terms | M |
| G-6| P1 | Deferred revenue/expense module نییە | new module | applications/finance/accounting/customer_invoices/deferred_revenues.rst | Books > Settings > Preferences > Deferral | L |
| G-7| P1 | Analytic accounting + distribution نییە | new module | applications/finance/accounting/reporting/analytic_accounting.rst | Zoho > Projects بیلینگ | L |
| G-8| P1 | Budget module نییە | new module | applications/finance/accounting/reporting/budget.rst | Books > Accountant > Budget | M |
| G-9| P2 | Fiscal positions (tax mapping) نییە | backend/app/api/taxes.py:L1 | applications/finance/accounting/taxes/fiscal_positions.rst | Books > Settings > Tax Exemptions | M |
| G-10| P2 | Recurring invoices/bills UI ناتەواوە | backend/app/firestore/recurring_bills.py | — | Books > Recurring Invoices | S |

## C. Quick Wins (< 1 session each)

- QW-1: Partner ledger report — backend/app/api/reports.py — JE.list() group by contact_id → JSON
- QW-2: Aged receivable — backend/app/api/reports.py:L150 — Invoice.list() filter status!=paid، group by due_date bucket (0-30/31-60/61-90/90+)
- QW-3: Aged payable — backend/app/api/reports.py:L150 — وەکو aged receivable لەسەر bills
- QW-4: Recurring cron job — new backend/app/api/recurring_invoices.py — FastAPI BackgroundTasks + ScheduleRepository
- QW-5: Invoice sequence config UI — frontend/src/pages/Settings.tsx — form for custom prefix/suffix

## D. Big Rocks

- BR-1: Bank synchronization (Plaid integration) — services/plaid_service.py + banking.py + BankTransactionRepository — 4 sessions
- BR-2: Bank reconciliation models — banking.py + BankRuleRepository.match() — 3 sessions (rule engine، regex، auto-apply)
- BR-3: Analytic accounting — firestore/analytics.py + JE.analytic_distribution — 3 sessions
- BR-4: Budget module — firestore/budgets.py + BudgetLineRepository + reports — 2 sessions
- BR-5: Deferred revenue/expense — services/deferral_service.py + JE — 3 sessions

## E. Odoo Features Missing

### Core Accounting
- bank/bank_synchronization.rst — Plaid/Yodlee/Salt Edge/Ponto
- bank/reconciliation_models.rst:L4 — regex rule auto-match
- taxes/fiscal_positions.rst — tax remapping بۆ foreign customers
- customer_invoices/cash_discounts.rst — "2/10 Net 30"
- customer_invoices/deferred_revenues.rst — Auto deferral entries
- vendor_bills/deferred_expenses.rst — Same for bills
- taxes/cash_basis.rst — Tax recognition at payment date
- vendor_bills/invoice_digitization.rst:L3 — OCR ناتەواو (تەنها stub)

### Reporting
- reporting/analytic_accounting.rst — Cost center/project tracking
- reporting/budget.rst — Budget vs actual
- get_started/consolidation.rst — Multi-company aggregation
- reporting/tax_carryover.rst — Loss carryforward
- reporting/intrastat.rst — EU cross-border
- reporting/data_inalterability.rst — Hash chain audit trail
- reporting/annual-report.rst — Statutory report generator

### Payments
- payments/forecast.rst — Cashflow prediction
- payments/follow_up.rst:L20 — Follow-up levels ناتەواو
- payments/batch_sdd.rst — SEPA XML generation

### Advanced
- bank/loans.rst — Loan amortization + auto JE
- bank/foreign_currency.rst:L110 — Auto FX revaluation scheduling

## F. Zoho Features Missing

### Books Core
- Recurring templates UI — code هەیە، UI ناتەواوە
- Retainer invoice apply-to-regular flow — invoices.py:L516 partial
- Time tracking → invoice billing integration
- Expense reports + reimbursement workflow + approval
- Project profitability (نیازی analytic accounting)
- Vendor portal (vendors view/approve bills)
- Customer portal (customers view/pay invoices)
- Estimates → Invoice direct conversion

### Books Banking
- Auto-execute bank feed match rules (rules exist، execution نا)
- Bank statement import column-mapping wizard

### Books Reports
- Cash flow statement (indirect method)
- Transaction detail by account drill-down
- Sales tax summary by tax rate

## G. Counts
- P0: 3 | P1: 5 | P2: 2 | QW: 5 | BR: 5

## H. Recommended Lead + Skills

**Lead:** زۆهۆ ئەکاونتینگ | **Support:** زۆهۆ باکئێند، زۆهۆ فرۆنتئێند

**Skills:**
- meta/karpathy-guidelines (always-on)
- backend/firestore-patterns
- backend/api-design-fastapi
- testing/tdd-workflow (bank sync)
- security/agentshield-rules (bank credentials)
- frontend/antd-rtl-patterns
- meta/verification-loop

**Sprint Priority:**
1. QW-1/2/3 (Partner + Aged reports) — 1 session
2. G-1 (Bank reconciliation models) — 3 sessions
3. G-5 (Payment terms discount) — 2 sessions
4. BR-3 (Analytic accounting) — dependency بۆ project profitability — 3 sessions

**Notes:** Strengths: Double-entry engine، COA، journal entries validated، Iraq tax. Critical Path: Bank reconciliation → Bank sync. Tech debt: JE.get_lines() N+1 (reports.py:L76 partial-fixed via threadpool، bulk fetch better).
