# Tasks: Phase 4

- [ ] 1. POS session + Z-report
  - [ ] 1.1 Implement session-close JE posting (per payment method)
  - [ ] 1.2 Cash variance threshold reason
  - [ ] 1.3 `GET /api/pos/sessions/{id}/z-report` PDF endpoint
  - [ ] 1.4 Frontend session-close wizard

- [ ] 2. POS offline + idempotency
  - [ ] 2.1 Add `services/idempotency.py` cache (Firestore + in-memory)
  - [ ] 2.2 Middleware honoring `X-Idempotency-Key`
  - [ ] 2.3 Frontend `posOffline.ts` retry/back-off + UUID
  - [ ] 2.4 ConflictDialog component
  - [ ] 2.5 SyncStatusBadge in shell
  - [ ] 2.6 Playwright `pos_offline.spec.ts`

- [ ] 3. Restaurant polish
  - [ ] 3.1 KDS Firestore live snapshot
  - [ ] 3.2 Floor plan drag-drop stable
  - [ ] 3.3 Order split per guest
  - [ ] 3.4 Self-order PIN close

- [ ] 4. Iraq payroll
  - [ ] 4.1 `services/iraq_payroll.py` brackets + SS
  - [ ] 4.2 Wire into payroll run
  - [ ] 4.3 Payslip PDF (RTL Arabic)
  - [ ] 4.4 Payroll JE auto-post
  - [ ] 4.5 SS-1 monthly report endpoint
  - [ ] 4.6 Frontend Iraq payroll wizard
  - [ ] 4.7 Tests `tests/test_iraq_payroll.py`

- [ ] 5. e-Invoice end-to-end
  - [ ] 5.1 Bundle XSD in `backend/resources/einvoice.xsd`
  - [ ] 5.2 `services/einvoice_xml.py` builder
  - [ ] 5.3 `einvoice_queue` collection + scheduler job
  - [ ] 5.4 Retry + permanent-fail handling
  - [ ] 5.5 Admin queue page
  - [ ] 5.6 Tests `tests/test_einvoice_xml.py`

- [ ] 6. Iraq payments
  - [ ] 6.1 Adapter interface `services/iraq_payments/base.py`
  - [ ] 6.2 FIB adapter (sandbox)
  - [ ] 6.3 Zain Cash adapter (sandbox)
  - [ ] 6.4 Webhook handlers + signature verify
  - [ ] 6.5 Idempotent webhook processing
  - [ ] 6.6 Frontend "Pay with FIB" button on customer portal
  - [ ] 6.7 Tests `tests/test_iraq_payments_fib.py`, `tests/test_iraq_payments_zaincash.py`

- [ ] 7. Arabic locale
  - [ ] 7.1 Generate ar.json from en.json (tooling pass + manual translation)
  - [ ] 7.2 Extend locale-completeness test for ar
  - [ ] 7.3 Verify PDF arabic-reshaper output
