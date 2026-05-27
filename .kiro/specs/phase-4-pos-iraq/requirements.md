# Requirements Document: Phase 4 — POS + Iraq Localization

## Introduction

POS is the most user-facing daily-use surface and must work offline. Iraq localization (e-invoice, payroll formulae, FIB/Zain Cash gateways) is the legal blocker for go-live. This phase delivers a robust offline POS, Iraq payroll MVP, e-invoice end-to-end, and real Iraqi payment integrations.

---

## Glossary

- **POS Session**: A cashier shift bracketed by `open_cash` and `close_cash` operations, all orders within it tied to that session.
- **Offline queue**: Orders persisted to IndexedDB while the device is offline, replayed to the server on reconnect.
- **Conflict resolution**: The strategy for merging client-side and server-side state when offline orders arrive late.
- **e-invoice**: Iraq's electronic invoicing format (XML) submitted to the Iraq Tax Authority (ITA) per regulation.
- **WHT brackets**: Iraq's withholding tax tiers (3% standard, 5% certain contract types).
- **SS contribution**: Iraq Social Security: 12% employer + 5% employee.
- **FIB**: First Iraqi Bank — a domestic payment gateway.
- **Zain Cash**: Mobile wallet payment gateway in Iraq.

---

## Requirements

### Requirement 1: POS Session Robustness

1. WHEN a session is opened, THE POS SHALL persist the opening_cash, opening_time, and cashier_id to Firestore.
2. WHEN a session is closed, THE POS SHALL: compute totals (cash, card, mobile), reconcile against actual cash counted, post a session-summary JE per payment method, and mark the session `closed`.
3. WHEN cash variance > configured threshold (default 5,000 IQD or 5 USD), THE POS SHALL require a reason note before closing.
4. THE Backend SHALL expose `GET /api/pos/sessions/{id}/z-report?format=pdf` printing the legal Z-report (RTL, Arabic + Kurdish).

### Requirement 2: POS Offline Queue + Sync

1. THE POS SHALL persist every order to IndexedDB under `posOffline.orders` queue if `navigator.onLine === false` OR if the server returns 5xx/timeout.
2. WHEN the device comes online, THE POS SHALL replay queued orders in chronological order and SHALL retry up to 5 times with exponential backoff.
3. WHEN a queued order's stock is insufficient at sync time, THE Backend SHALL return HTTP 409 with `{code:"insufficient_stock", item_id, available}`; THE POS SHALL surface a conflict dialog and let the cashier choose to discard, partial-fulfill, or override.
4. THE POS SHALL display a queue badge with count of pending orders and a manual "Sync now" button.
5. WHEN the same order_id arrives twice (resubmit), THE Backend SHALL deduplicate via idempotency key (`X-Idempotency-Key` header equal to client UUID).
6. THE POS offline mode SHALL support: cash, card-charge (if reader is local), receipt printing, void within session.
7. THE POS offline mode SHALL NOT support: refunds (require server), gift cards, loyalty redemption.

### Requirement 3: Restaurant POS Polish

1. THE KDS SHALL show new orders within 2 seconds via polling (every 1.5s) or Firestore live snapshot.
2. THE Floor Plan editor SHALL allow drag-and-drop tables, save layout, and assign open orders to tables.
3. WHEN an order is split between guests, THE POS SHALL allow per-line assignment and produce one receipt per assignment.
4. THE Self-Order kiosk SHALL be touch-optimized for ≥10" tablets, RTL-aware, and require a numeric PIN to close.

### Requirement 4: Iraq Payroll MVP

1. THE Payroll Service SHALL implement Iraq tax brackets (current law as of 2024):
   - 0–250,000 IQD/month: 0%
   - 250,001–500,000: 3%
   - 500,001–1,000,000: 5%
   - >1,000,000: 15%
2. THE Payroll Service SHALL compute Social Security: 12% employer + 5% employee on gross.
3. THE Payroll Service SHALL produce a payslip PDF (RTL, Arabic, encoded with arabic-reshaper + python-bidi) showing: gross, tax, SS employee, net.
4. THE Payroll Service SHALL post a JE per payroll run: debit `Salaries Expense`, credit `Salaries Payable` (net), credit `Tax Payable`, credit `SS Payable (employee)`, debit `SS Expense`, credit `SS Payable (employer)`.
5. THE Payroll Service SHALL track each employee's `national_id` (encrypted per Phase 2) and produce the SS-1 monthly contribution report (`GET /api/payroll/iraq/ss1?month=YYYY-MM`).
6. WHEN a payslip is generated, THE Backend SHALL store the PDF in Cloud Storage under `payslips/{org_id}/{run_id}/{employee_id}.pdf` and store the URL on the payslip doc.

### Requirement 5: e-Invoice End-to-End

1. THE e-Invoice Service SHALL produce an XML in the ITA-mandated schema (currently UBL 2.1 subset; latest spec lives in `MASTER_AUDIT_REPORTS/erp-l10n-iraq-2026-q2.md`).
2. WHEN an invoice is `posted` AND `customer.country == "IQ"` AND `org.einvoice_enabled == true`, THE Backend SHALL automatically queue the invoice for ITA submission.
3. THE submission SHALL be asynchronous via APScheduler `einvoice_dispatcher` (every 5 minutes); on success, store the ITA confirmation number on the invoice; on failure (transient), retry up to 5 times.
4. THE Backend SHALL expose `GET /api/einvoice/queue` (admin) showing pending/failed submissions and `POST /api/einvoice/{id}/retry`.
5. WHEN ITA returns a permanent rejection, THE Backend SHALL flag the invoice and notify the org admin via email.
6. THE XML output SHALL pass schema validation in `tests/test_einvoice_xml.py` against the bundled XSD.

### Requirement 6: FIB + Zain Cash Real Gateway

1. THE Backend SHALL implement a real integration with FIB's hosted-checkout API (sandbox first, production via env flag): create payment session, redirect customer, receive webhook, verify signature, mark invoice paid.
2. THE Backend SHALL implement Zain Cash mobile-wallet API integration (sandbox first).
3. WHEN a webhook fires, THE Backend SHALL verify the signature against the gateway's public key/HMAC secret; reject 401 if invalid.
4. THE Backend SHALL idempotently process the webhook (same `transaction_id` processed exactly once).
5. WHEN a payment succeeds via gateway, THE Backend SHALL: register the payment, allocate to the invoice, post the JE, send confirmation email/SMS.
6. THE Backend SHALL expose `POST /api/iraq-payments/fib/webhook` and `POST /api/iraq-payments/zaincash/webhook` (no auth — webhook signature is the auth).

### Requirement 7: Arabic Locale Audit

1. THE frontend SHALL ship a complete `ar.json` locale file with no missing keys vs `en.json`.
2. THE locale-completeness CI test SHALL be extended to enforce ar parity along with ku.
3. THE Arabic locale SHALL render correctly in PDF reports (payslips, invoices) using arabic-reshaper.

---

## Out of Scope

- Loyalty programs deep — POS module already has stub
- POS hardware drivers (ESC/POS, scale) beyond what's stubbed
- Multi-cashier concurrent floor plan (single-device)

## Definition of Done

- POS offline-online cycle handles 50 orders without data loss
- Payroll run for 10 employees produces correct payslips + balanced JE
- e-Invoice XML for sample invoice validates against XSD
- FIB sandbox payment completes end-to-end
- Z-report PDF renders RTL correctly
