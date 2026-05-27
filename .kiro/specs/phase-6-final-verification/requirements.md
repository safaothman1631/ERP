# Requirements Document: Phase 6 — Final Verification & Launch

## Introduction

Phase 6 proves production-readiness across business scenarios, security, performance, and operations. No new features land in this phase — only verification, documentation, and the launch sign-off. The output is a green production checklist and a working `erpiq.systems` deployment.

---

## Requirements

### Requirement 1: End-to-End Business Scenarios

1. THE QA Suite SHALL run 5 real-world scenarios end-to-end in Playwright against staging:
   1. **Retail shop** — onboarding, item import, POS day, end-of-day close, inventory cycle count
   2. **Restaurant** — table layout, KDS flow, split bill, end-of-day, week-over-week reports
   3. **Trading company** — Quote → SO → DO → Invoice → Payment, multi-currency invoice with revaluation
   4. **Service company** — Project setup, timesheet entry, invoice from timesheet, payment, expense reimbursement
   5. **SME with 5 employees** — onboarding, employee setup, payroll run, payslips PDF, SS-1 report
2. EACH scenario SHALL be implemented as a distinct Playwright spec at `frontend/e2e/scenarios/<name>.spec.ts`.
3. EACH scenario SHALL pass at the same time on a single run.

### Requirement 2: Load Test

1. THE Backend SHALL sustain 20 concurrent users performing typical workflows for 10 minutes with p95 < 800ms and 0% error rate.
2. THE load test SHALL be implemented with `locust` or `k6` and committed under `tests/load/`.
3. THE load test SHALL be run against staging Cloud Run with realistic Firestore data (~5,000 invoices).

### Requirement 3: Security Penetration Checklist

1. THE Security Lead SHALL run AgentShield + manual checks for:
   - Auth bypass attempts on sensitive routes
   - SQL/NoSQL injection on filter params
   - XSS via input fields (post-sanitization)
   - CSRF on state-changing endpoints (verify same-origin)
   - Rate-limit bypass attempts
   - Cross-org data leakage tests (force-fetch with mismatched org_id)
2. THE result SHALL be documented in `MASTER_AUDIT_REPORTS/security-penetration-report.md`.
3. ZERO critical or high findings SHALL remain open.

### Requirement 4: Iraq Compliance Checklist

1. SAMPLE invoices SHALL pass ITA e-invoice validation.
2. SAMPLE payslips SHALL match a manually-computed reference for Iraq tax + SS.
3. VAT return for one sample month SHALL reconcile to GL within 0.01 IQD.
4. WHT report (3% and 5%) SHALL match invoiced amounts.

### Requirement 5: Operational Runbook

1. THE repo SHALL contain `OPERATIONS_RUNBOOK.md` covering:
   - On-call escalation path
   - Common alerts and resolution steps
   - How to restart services, restore backups, rotate keys
   - How to enable/disable feature flags per org
   - How to onboard a new org

### Requirement 6: Sign-Off Criteria

1. ALL phase 0–5 acceptance criteria SHALL be satisfied.
2. ALL audit scripts (JE balance, sequence gaps, RBAC coverage, endpoint coverage) SHALL exit 0.
3. THE production smoke after deploy SHALL show: 200 on `/api/ready`, signed-in admin can navigate, sample invoice posts, sample payment posts, sample backup runs successfully.
4. THE launch decision SHALL be recorded in `LAUNCH_DECISION.md` with sign-off names and date.
