# HR + Payroll Audit — 2026-Q2
**Agent:** ERP HR + Payroll | **Date:** 2026-04-24

## A. Coverage Snapshot

| Reference | Coverage % | Notes |
|-----------|-----------|-------|
| Odoo 19   | ~50%      | Core HR + payroll هەیە، Recruitment/Appraisals/Fleet/Lunch/Frontdesk/Referrals نییە |
| Zoho People | ~55%    | Employees/Attendance/Leave هەیە، Self-service portal، Performance، Onboarding ناتەواوە |

## B. Top P0/P1 Gaps (max 10)

| ID | Severity | Title | File(s) | Odoo ref | Zoho ref | Effort |
|----|----------|-------|---------|----------|----------|--------|
| G-1 | P0 | No Iraq payroll rules (SS 5%/12%، tax brackets) | backend/app/api/payroll.py:L62 | applications/hr/payroll/payroll_localizations | — | M |
| G-2 | P0 | No payroll → accounting JE (DR Salary / CR Payable/Tax) | backend/app/api/payroll.py:L160 | applications/hr/payroll/saudi_arabia.rst:L327 | — | M |
| G-3 | P0 | No salary structures (permanent/temp/hourly types) | backend/app/api/payroll.py | applications/hr/payroll/salaries.rst:L62 | Salary Structures | S |
| G-4 | P0 | No work_entries (attendance → payroll hours) | backend/app/api/payroll.py:L100 | applications/hr/payroll/work_entries | Time Tracking | M |
| G-5 | P1 | No leave_allocations (annual days per employee) | backend/app/api/hr.py:L350 | applications/hr/time_off/allocations | Leave Quota | S |
| G-6 | P1 | No Recruitment module (jobs، candidates، stages) | new module | applications/hr/recruitment/ | Recruit | L |
| G-7 | P1 | No Appraisals (reviews، goals، 360 feedback) | new module | applications/hr/appraisals/ | Performance | L |
| G-8 | P1 | No payslip PDF (Kurdish RTL) | new | applications/hr/payroll/payslips | Payslip Templates | M |
| G-9 | P1 | No employee self-service portal | new pages | — | Self-Service | M |
| G-10| P1 | national_id not encrypted (PII) | backend/app/firestore/hr.py | GDPR-like | — | S |

## C. Quick Wins

- QW-1: Iraq social security 5% emp + 12% employer — payroll.py:L20 default rules — 1 session
- QW-2: Income tax brackets (0-250k=0%، 250k-500k=3%، 500k-1M=5%، 1M+=15%) — services/iraq_payroll.py:new — 1 session
- QW-3: apply_on=gross support (two-pass) — payroll.py:L72 — 0.5d
- QW-4: leave_allocations CRUD — hr.py — 0.5d
- QW-5: Time-off overlap validation — hr.py:L334 — 0.3d
- QW-6: confirmed_by + timestamp on payroll runs — payroll.py:L160 — 0.3d
- QW-7: RBAC for approve time-off / confirm payroll (require_perm) — hr.py / payroll.py — 0.5d

## D. Big Rocks

- BR-1: Iraq Payroll Service (تاکست + سوشیال + بیمە + end-of-service) — services/iraq_payroll.py — 2 sessions
- BR-2: Payroll → Accounting JE — payroll.py + AccountingService — 3 sessions
- BR-3: Recruitment module (job openings + candidates + Kanban pipeline) — 3 sessions
- BR-4: Appraisals (reviews + goals + 360 feedback) — 3 sessions
- BR-5: Employee self-service portal (/portal/my-attendance، /my-leaves) — 2 sessions
- BR-6: Payslip PDF generator (jsPDF + Amiri RTL font) — 1.5 sessions
- BR-7: Attendance kiosk mode (full-screen PIN/Face check-in) — 1 session

## E. Odoo Features Missing

- hr/recruitment/ — job openings، candidates، stages، Kanban
- hr/appraisals/ — performance reviews، goals، 360 feedback
- hr/fleet/ — vehicles، maintenance، fuel logs
- hr/frontdesk/ — visitor logs، badges
- hr/lunch/ — meal vouchers، providers
- hr/referrals/ — employee referral program
- hr/attendances/ — kiosk mode، biometric integration
- hr/payroll/work_entries — bridge attendance/timesheet → payslips
- hr/payroll/saudi_arabia.rst (template for IQ) — localized rules
- hr/payroll/structure-types — wage_type + default schedule
- hr/employees/certifications — skills tracking
- hr/employees/badges — achievements
- hr/employees/equipment — laptops/phones issued
- hr/time_off/allocations — annual days per employee/year + remaining

## F. Zoho People Features Missing

- Self-service portal (my attendance، my leaves، my payslips)
- Onboarding workflow (offer letter، documents، tasks)
- Performance management (goals، KPIs، reviews)
- Training (courses، assignments، tracking)
- Org chart (visual tree)
- Mobile app (native iOS/Android)
- Document management (employee docs، signatures)
- Helpdesk integration (employee tickets to HR)

## G. Counts
- P0: 4 | P1: 6 | P2: ~10 | QW: 7 | BR: 7

## H. Recommended Lead + Skills

**Lead:** ERP HR + Payroll | **Support:** زۆهۆ ئەکاونتینگ (JE)، زۆهۆ فرۆنتئێند، ERP UX

**Skills:**
- backend/python-patterns
- backend/firestore-patterns
- backend/api-design-fastapi
- frontend/antd-rtl-patterns (PDF + RTL)
- security/agentshield-rules (PII encryption)
- meta/karpathy-guidelines

**Sprint Priority:**
1. Iraq MVP (G-1، G-2، G-3، G-4) — 2 weeks
2. Recruitment + Appraisals — 2 weeks
3. Self-service portal + Payslip PDF + Kiosk — 1.5 weeks

**Strengths:** type hints، org_id scoping، attendance check-in/out logic ڕێک، payslip computation works for simple cases.
**Critical path:** Iraq payroll service → JE integration → work_entries.
