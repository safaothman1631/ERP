# Tasks: Phase 6

- [x] 1. E2E business scenarios (shopkeeper_core + retail alias)
  - [x] 1.1 `e2e/scenarios/retail.spec.ts`
  - [x] 1.1b `e2e/scenarios/shopkeeper_core.spec.ts`
  - [ ] 1.2 `e2e/scenarios/restaurant.spec.ts`
  - [ ] 1.3 `e2e/scenarios/trading.spec.ts`
  - [ ] 1.4 `e2e/scenarios/service.spec.ts`
  - [ ] 1.5 `e2e/scenarios/sme_payroll.spec.ts`
  - [ ] 1.6 Add scenarios to `ci-quality.yml` blocking gate

- [ ] 2. Load test
  - [ ] 2.1 `tests/load/locustfile.py` for typical flows
  - [ ] 2.2 Staging environment seeding script
  - [ ] 2.3 Run baseline + tune

- [ ] 3. Security penetration
  - [ ] 3.1 Manual checklist run
  - [ ] 3.2 AgentShield deep scan
  - [ ] 3.3 Cross-org leak tests automated as integration tests
  - [ ] 3.4 Document `security-penetration-report.md`

- [ ] 4. Iraq compliance
  - [ ] 4.1 Run sample e-invoice through ITA sandbox
  - [ ] 4.2 Reference payroll calc spreadsheet committed
  - [ ] 4.3 VAT return reconcile script

- [ ] 5. Runbooks
  - [ ] 5.1 `OPERATIONS_RUNBOOK.md`
  - [ ] 5.2 `DISASTER_RECOVERY.md` (already in Phase 5)
  - [ ] 5.3 `LAUNCH_DECISION.md` template

- [ ] 6. Final smoke + sign-off
  - [ ] 6.1 Run all audit scripts; capture outputs to `MASTER_AUDIT_REPORTS/launch-baseline/`
  - [ ] 6.2 Production smoke
  - [ ] 6.3 Launch decision recorded
