# Master Excellence — Consolidated Sprint Plan
**Date:** 2026-04-24 | **Source:** 16 audit reports in MASTER_AUDIT_REPORTS/
**Mandate:** "بەردەوام بە هەتا تەواو دەبێت" — execute every sprint until 100%

---

## 0. Executive Summary

| Domain | Coverage % | P0 count | Effort (days) |
|--------|-----------|----------|---------------|
| Accounting | 62%/71% | 3 | 30 |
| CRM | 30%/25% | 4 | 60 (highest gap) |
| Inventory + MRP | 45% | 3 | 110 |
| HR + Payroll | 50%/55% | 4 | 30 |
| POS | 70% | 5 | 80 |
| Sales + Purchase | 50% | 7 | 22 |
| Iraq Localization | 68% | 4 | 17 |
| Security | 6.5/10 | 4 | 25 |
| **E-commerce** | **0%** | All | **70+ (build from zero)** |
| **Marketing** | **0%** | All | **60+ (build from zero)** |
| Project + Timesheet | 15% | All | 80 |
| UX | ~70% | 0 | 15 |
| Integration | partial | 4 | 30 |
| Migration | 30% | 3 | 25 |
| DevOps | 40% | 6 | 20 |
| **Odoo Platform** (chatter/activities/automated-actions) | **0%** | **4** | **40 (foundational)** |
| **TOTAL** | — | **~50** | **~715 days** (~143 weeks @ 1 dev) |

---

## 1. Cross-Cutting Themes (touch multiple modules)

| # | Theme | Affected Modules | Why First |
|---|-------|------------------|-----------|
| T-1 | **Universal Chatter + Activities + Followers** | ALL (CRM، Sales، Inventory، HR، Projects، Invoices، Bills) | Foundation for collaboration across every record. Block: must build before per-module deepening. |
| T-2 | **Automated Actions Engine** | ALL workflows | Replaces manual cron/scripts — enables Workflows in CRM، POs، payroll، etc. |
| T-3 | **RBAC Sweep** (126 endpoints) | banking، journals، hr، payroll، manufacturing، projects، CRM، reports، exports | Security holes: anyone can read banking/payroll/hr. **MUST FIX FIRST.** |
| T-4 | **State Machine Workflows** | Quote→SO→Invoice، PO→Receipt→Bill، MO state، POS session | Touches Sales، Purchase، Inventory، POS. Standardize once. |
| T-5 | **Field-Level Encryption** | HR، Banking، Payroll، Auth | GDPR + PII protection. national_id، salary، api_key، totp_secret. |
| T-6 | **PDF + RTL templates** | Invoices، Bills، Payslips، Iraq Forms 5/3/SS-1، Quotes، POs | One template engine، many consumers. |
| T-7 | **Iraq Compliance** (ITA + FIB + Arabic + KRG municipal) | Localization + Payments + i18n | Legal/regulatory blocker. |
| T-8 | **Manufacturing UI** (currently 0 pages) | Inventory + MRP | Major UX gap — backend complete، frontend zero. |
| T-9 | **Multi-Company Switching** | All modules | Currently org_id only — no UI selector، no inter-company. |
| T-10| **Email Templates + Mail Threading** | CRM، Sales، Marketing، Notifications | Foundation for Marketing module + customer comms. |

---

## 2. Sprint Skeleton (Sprints 6→18)

**Convention:** Each sprint = 1 working session of focused execution. Verify gate after each: `npm run build` + `python -c "from app.main import app; print(len(app.routes))"` + smoke test.

| # | Sprint Title | Lead Agent | Fix-IDs | Skills | Deps | Verify | Sessions |
|---|--------------|------------|---------|--------|------|--------|----------|
| **6** | **RBAC Sweep + Security Quick Wins** | شادۆ ئاژێنت‌شیلد | FIX-36..FIX-50 | security/agentshield-rules، meta/karpathy-guidelines | none | route count، permission matrix tests for 6 modules | 1 |
| **7** | **Quick Wins Wave 1** (Accounting + CRM + HR) | زۆهۆ ئەکاونتینگ + ERP CRM + ERP HR | FIX-51..FIX-70 | backend/firestore-patterns، meta/verification-loop | S6 | smoke + reports endpoints | 1 |
| **8** | **Quick Wins Wave 2** (Inventory + POS + Sales + Iraq) | ERP Inventory + ERP POS + ERP Sales + ERP L10n | FIX-71..FIX-90 | backend/api-design-fastapi، frontend/antd-rtl-patterns | S6 | smoke + new endpoints respond | 1 |
| **9** | **Workflow State Machines** (Quote/SO/PO/Quote→Invoice) | ERP Sales + Purchase | FIX-91..FIX-105 | backend/python-patterns، meta/karpathy-guidelines | S7 | E2E test: Quote → SO → Invoice flow | 1-2 |
| **10**| **Iraq Compliance Sprint** (ITA + WHT account + Arabic locale + VAT Form 5) | ERP Localization Iraq | FIX-106..FIX-118 | security/agentshield-rules، frontend/antd-rtl-patterns | S7 | ITA XML validates، Arabic locale loads، PDF renders | 2 |
| **11**| **Iraq Payroll MVP** (SS + tax brackets + payslip PDF + JE) | ERP HR + Payroll | FIX-119..FIX-130 | backend/python-patterns، frontend/antd-rtl-patterns | S7، S10 | E2E: payroll run → confirm → JE balanced + PDF | 2 |
| **12**| **CRM Sprint 1: Sales Teams + Accounts + Contacts + Lost Reasons** | ERP CRM | FIX-131..FIX-150 | backend/firestore-patterns، frontend/react19-patterns | S6 | new pages render، CRUD smoke | 2 |
| **13**| **Manufacturing UI** (BOM، MO، WO، Work Centers pages) | ERP Inventory + MRP | FIX-151..FIX-170 | frontend/react19-patterns، frontend/antd-rtl-patterns | S8 | all 4 pages render، CRUD work | 2 |
| **14**| **Stock Valuation + Picking Flow** | ERP Inventory + زۆهۆ ئەکاونتینگ | FIX-171..FIX-185 | backend/python-patterns (state machines) | S9 | E2E: stock move → JE auto-posted | 2 |
| **15**| **Universal Chatter + Activities + Followers** (PLATFORM) | ERP Integration + شادۆ مێشک | FIX-186..FIX-210 | backend/firestore-patterns (mixins) | S6 | comment/activity on Invoice + CRM Lead works | 2 |
| **16**| **Receipts + 3-Way Match + Delivery Orders** | ERP Sales + Purchase + Inventory | FIX-211..FIX-230 | backend/api-design-fastapi، testing/tdd-workflow | S9، S14 | E2E: PO → Receipt → 3-way match → Bill | 2 |
| **17**| **POS Production-Critical** (variants + fiscal + combo + offline + tips) | ERP POS | FIX-231..FIX-250 | frontend/react19-patterns، testing/e2e-playwright | S8 | E2E full POS flow + offline queue | 2 |
| **18**| **Encryption + GDPR + Audit hardening** | شادۆ ئاژێنت‌شیلد | FIX-251..FIX-265 | security/agentshield-rules | S6 | encrypted fields read/write، GDPR export downloads | 1-2 |
| **19**| **DevOps Production-Ready** (HEALTHCHECK + Sentry + backup + SSL + CD pipeline) | ERP DevOps | FIX-266..FIX-280 | meta/verification-loop | none | docker-compose.prod up + smoke + alerts fire | 2 |
| **20**| **Odoo Platform Foundation** (Automated Actions + Server Actions + Scheduled UI) | شادۆ مێشک | FIX-281..FIX-300 | backend/python-patterns، quality/autonomous-loops | S15 | trigger creates record، scheduled job runs | 2 |
| **21**| **CRM Sprint 2: Workflow Rules + Assignment + Activity Types** | ERP CRM | FIX-301..FIX-320 | (same as S20) | S15، S20 | rule fires on lead create | 2 |
| **22**| **Email Integration + Mail Templates + Threading** | ERP Integration | FIX-321..FIX-340 | backend/python-patterns | S15، S20 | inbound email creates lead، template renders | 2 |
| **23**| **Marketing Module from Zero** (campaigns، email blasts، segmentation) | ERP Marketing | FIX-341..FIX-380 | (same as S22) | S22 | E2E: send campaign، track opens | 3 |
| **24**| **E-commerce Module from Zero** (storefront + cart + checkout + customer portal) | ERP E-commerce | FIX-381..FIX-430 | frontend/react19-patterns | S6، S15 | E2E: browse → cart → checkout | 3-4 |
| **25**| **Project + Timesheet Full** (Gantt + dependencies + billable + profitability + helpdesk) | ERP Project + Timesheet | FIX-431..FIX-470 | frontend/react19-patterns | S15 | Gantt renders، timesheet → invoice | 3 |
| **26**| **MRP Scheduler + Quality + Routes + Putaway** | ERP Inventory + MRP | FIX-471..FIX-510 | backend/python-patterns | S14 | MPS calculates، quality blocks shipment | 3 |
| **27**| **HR Phase 2** (Recruitment Kanban + Appraisals + Self-service portal + Kiosk) | ERP HR | FIX-511..FIX-540 | frontend/react19-patterns | S11 | candidate flows through stages | 2 |
| **28**| **Iraq Payment Gateways** (FIB + Zain Cash + Asia Hawala) | ERP Integration + ERP L10n | FIX-541..FIX-560 | security/agentshield-rules | S10 | E2E payment from invoice via FIB | 2 |
| **29**| **Migration Wizard + Odoo/QuickBooks Import** | ERP Migration | FIX-561..FIX-580 | backend/firestore-patterns | none | import 100 contacts from Odoo | 2 |
| **30**| **UX Polish: Dark mode + Dashboard widgets + Onboarding + Keyboard shortcuts + PWA full** | ERP UX | FIX-581..FIX-600 | frontend/react19-patterns | none | Lighthouse PWA pass، dark mode toggle | 1-2 |
| **31**| **Multi-Company Architecture + Switching** | شادۆ مێشک | FIX-601..FIX-620 | backend/firestore-patterns | S15، S20 | user switches company، data isolated | 2 |
| **32**| **POS Hardware Integration** (Stripe terminal + IoT + ESC/POS + barcode HID) | ERP POS | FIX-621..FIX-640 | backend/python-patterns | S17 | Stripe transaction completes | 2 |
| **33**| **Performance + N+1 fixes + Caching + Bulk operations** | شادۆ ئەدا | FIX-641..FIX-660 | meta/verification-loop | none | reports load <2s، bulk import 1000 rows < 30s | 1-2 |
| **34**| **Reports Library Expansion** (analytic accounting + budget + cashflow + drill-downs) | زۆهۆ ئەکاونتینگ | FIX-661..FIX-680 | backend/firestore-patterns | S15 | new reports render، filters work | 2 |
| **35**| **Final Verification + Sign-off** | شادۆ + شادۆ ئیڤاڵ | — | testing/e2e-playwright | ALL | 100% smoke pass، coverage matrix complete | 1 |

**Total estimated sessions:** ~52 (Sprints 6→35)
**At 1 sprint/day pace:** ~10 weeks of focused work
**Realistic with multitasking:** ~14-18 weeks

---

## 3. Fix-ID Registry (Detailed)

### Sprint 6 — RBAC Sweep + Security Quick Wins (15 fixes)

| FIX-ID | Module | Action | File:Line | Effort |
|--------|--------|--------|-----------|--------|
| FIX-36 | Banking | Add require_perm to 13 endpoints | backend/app/api/banking.py:L114-L631 | 2h |
| FIX-37 | Journals | Add require_perm to 6 endpoints | backend/app/api/accounts.py (journal_router) | 1h |
| FIX-38 | HR | Add require_perm to 22 endpoints | backend/app/api/hr.py | 3h |
| FIX-39 | Payroll | Add require_perm to 10 endpoints | backend/app/api/payroll.py | 2h |
| FIX-40 | Manufacturing | Add require_perm to 15 endpoints | backend/app/api/manufacturing.py | 3h |
| FIX-41 | Projects | Add require_perm to 12 endpoints | backend/app/api/projects.py | 2h |
| FIX-42 | CRM | Add require_perm to 18 endpoints | backend/app/api/crm.py | 3h |
| FIX-43 | Reports | Add require_perm reports.read to 16 | backend/app/api/reports.py | 2h |
| FIX-44 | Exports | Add require_perm reports.export to 14 | backend/app/api/exports.py | 1h |
| FIX-45 | Headers | Add HSTS header | backend/app/main.py:L82 | 15min |
| FIX-46 | Audit | Make audit logs immutable (Firestore rules) | firestore.rules | 1h |
| FIX-47 | Auth | 2FA enforcement for admin/accountant | backend/app/api/auth.py | 4h |
| FIX-48 | Auth | Password policy validation (8+upper+digit+blacklist) | backend/app/services/auth.py | 1d |
| FIX-49 | Audit | Sensitive GET path whitelist | backend/app/middleware/audit.py:L44 | 1d |
| FIX-50 | Audit | confirmed_by + timestamp on payroll/JE/bill approvals | various | 1d |

### Sprint 7 — Quick Wins Wave 1 (Accounting + CRM + HR) (20 fixes)

| FIX-ID | Module | Action | Effort |
|--------|--------|--------|--------|
| FIX-51 | Accounting | Partner ledger report endpoint | 2h |
| FIX-52 | Accounting | Aged receivable report (0-30/31-60/61-90/90+) | 2h |
| FIX-53 | Accounting | Aged payable report | 2h |
| FIX-54 | Accounting | Recurring invoice cron job | 4h |
| FIX-55 | Accounting | Invoice sequence config UI | 4h |
| FIX-56 | CRM | CRMLostReasonRepository + endpoint | 2h |
| FIX-57 | CRM | Merge duplicate leads/opps endpoints | 4h |
| FIX-58 | CRM | Lead/Opp detail pages | 3h |
| FIX-59 | CRM | Expected Revenue report | 2h |
| FIX-60 | CRM | Bulk actions (archive، assign) | 3h |
| FIX-61 | CRM | Activity reminders/due-today badge | 2h |
| FIX-62 | CRM | Tags field for leads/opps | 1h |
| FIX-63 | CRM | Probability bounds validation [0,100] | 30min |
| FIX-64 | HR | Iraq SS rules (5% emp + 12% employer) seed | 1h |
| FIX-65 | HR | Income tax brackets service (IraqPayrollService) | 1d |
| FIX-66 | HR | apply_on=gross support (two-pass) | 4h |
| FIX-67 | HR | leave_allocations CRUD | 4h |
| FIX-68 | HR | Time-off overlap validation | 2h |
| FIX-69 | HR | confirmed_by timestamp on payroll runs | 2h |
| FIX-70 | HR | RBAC for approve time-off / confirm payroll | 4h |

### Sprint 8 — Quick Wins Wave 2 (Inventory + POS + Sales + Iraq) (20 fixes)

| FIX-ID | Module | Action | Effort |
|--------|--------|--------|--------|
| FIX-71 | Inventory | By-products on BOM | 1d |
| FIX-72 | Inventory | Transfer Orders approval status | 1d |
| FIX-73 | Inventory | Item images URL field | 1d |
| FIX-74 | Inventory | MO Backorders | 2d |
| FIX-75 | Inventory | Stock Moves POST + validate | 2d |
| FIX-76 | Inventory | Lot traceability endpoint | 2d |
| FIX-77 | Inventory | Landed Costs API | 2d |
| FIX-78 | POS | Tips field on payment | 1d |
| FIX-79 | POS | Pricelist enforcement in order create | 1d |
| FIX-80 | POS | Multi-session prevention | 1d |
| FIX-81 | POS | Discount restriction enforcement | 4h |
| FIX-82 | POS | Cash short/over JE on session close | 1d |
| FIX-83 | Sales | Quote send/accept/decline endpoints | 2h |
| FIX-84 | Sales | Quote → SO conversion | 3h |
| FIX-85 | Sales | Quote → Invoice conversion | 2h |
| FIX-86 | Sales | Quote expiry cron | 2h |
| FIX-87 | Iraq | WHT Payable account 2155 in seed CoA | 15min |
| FIX-88 | Iraq | VAT rate documentation comment | 5min |
| FIX-89 | Iraq | Reverse-charge VAT UI label | 1h |
| FIX-90 | Iraq | Consistent IQD formatter (replace toLocaleString in ~15 files) | 1h |

### Sprints 9-35 — see detailed audit reports per module

(Each subsequent sprint follows the FIX-ID convention from §B/C/D of relevant audit report.)

---

## 4. Verification Gate (after EVERY sprint)

```powershell
# 1. Backend route count
cd c:\Users\SAFA\zoho\backend
venv\Scripts\python.exe -c "from app.main import app; print(len(app.routes))"

# 2. Frontend full build (NOT just tsc --noEmit)
cd c:\Users\SAFA\zoho\frontend
npm run build

# 3. Smoke tests
cd c:\Users\SAFA\zoho\backend
venv\Scripts\python.exe test_all.py

# 4. Update memory
# /memories/session/parity-execution.md ← log sprint outcome
```

**Sprint exit criteria:**
- Build green (no TS errors)
- Smoke pass (all relevant endpoints respond)
- Memory updated
- Karpathy 4 satisfied: simplicity، surgical، goal-driven، think-first

---

## 5. Karpathy 4 (always-on)

1. **Think first** — assumptions out loud، disambiguate before coding
2. **Simplicity first** — minimal code، no extra abstraction
3. **Surgical changes** — only lines required by the FIX-ID
4. **Goal-driven** — reproduce → fix → verify

---

## 6. NEVER

- ❌ Skip `npm run build` (only `tsc --noEmit` hides errors)
- ❌ Use `&&` in PowerShell — `;` only
- ❌ Composite Firestore indexes — filter in Python
- ❌ English-only error messages — Kurdish required
- ❌ Destructive Git without confirmation
- ❌ task_complete before Sprint 35 sign-off

---

## 7. Success Criteria for "تەواوبوون"

1. ✅ All 16 audit reports accepted (DONE — see MASTER_AUDIT_REPORTS/)
2. ✅ Sprint Skeleton populated (DONE — this file)
3. ⏳ Sprint 6 done — RBAC sweep + security QWs verified
4. ⏳ Sprints 7-8 done — 40 quick wins shipped
5. ⏳ Sprint 9-11 — Workflow state machines + Iraq compliance + Iraq payroll
6. ⏳ Sprints 12-22 — Domain deepening (CRM، Inventory، POS، Encryption، DevOps، Platform foundation)
7. ⏳ Sprints 23-25 — New modules (Marketing، E-commerce، Projects)
8. ⏳ Sprints 26-32 — Specialty (MRP scheduler، HR phase 2، payment gateways، migration، UX، multi-company، POS hardware)
9. ⏳ Sprints 33-34 — Performance + Reports library
10. ⏳ Sprint 35 — Final sign-off → MASTER_AUDIT_REPORTS/_FINAL_SIGNOFF_2026Q2.md

---

**Next action:** Begin Sprint 6 — RBAC Sweep. Start with FIX-36 (Banking module: add `dependencies=[Depends(require_perm("bank.create|update|delete"))]` to 13 endpoints).
