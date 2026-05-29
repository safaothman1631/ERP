# Tasks: Role Navbar, Setup & Settings Audit

**Status:** COMPLETE  
**Spec:** `role-navbar-settings-audit-v1`

---

## Progress summary

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Kiro spec (requirements, design, tasks) | ✅ |
| A | roleModuleScope aliases + hr specialist | ✅ |
| B | Permission-gated module-requests fetch | ✅ |
| C | Audit matrix module + unit tests | ✅ |
| D | Expanded Playwright E2E audit | ✅ |
| E | Docs + ROLES.md update | ✅ |
| F | Final checkpoint (vitest + build) | ✅ |

---

## Definition of Done

- [x] `sales_rep`, `inventory_manager`, `cashier`, `hr` see correct settings tabs
- [x] No 403 spam from `loadPendingAdminCount` for non-admin roles
- [x] `roleAuditMatrix.ts` encodes expected nav/settings per role
- [x] E2E visits setup leaves + settings tabs per role
- [x] E2E JSON report written to `frontend/e2e/reports/`
- [x] Unit tests green for new alias coverage
- [x] `docs/ux/ROLES.md` references audit commands
- [x] `npm run build` green

---

## Tasks

### Phase A — Settings role scope fixes

- [ ] **A1** Extend `roleModuleScope.ts`
  - Add `normalizeSettingsRole()` with aliases: `sales_rep`, `inventory_manager`, `cashier`, `pos_manager`, `hr_manager`, `warehouse`
  - Extend `ROLE_MODULE_SCOPE` with direct alias keys
  - Add `hr` to `SPECIALIST_ROLES` and `ROLE_MODULE_SCOPE`
  - Use normalization in `bindingMatchesSpecialistScope` and `isSpecialistRole`
  - _Requirements: 3.4–3.7, 3.10_

- [ ] **A2** Unit tests for role scope aliases
  - File: `frontend/src/settings/registry/__tests__/roleModuleScope.test.ts`
  - Assert `sales_rep` sees `sales` tab when sales module enabled
  - Assert `inventory_manager` sees `inventory` tab
  - Assert `cashier` sees `pos` tab
  - Assert `hr` sees `hr` tab
  - _Requirements: 3.4–3.7, NFR-2_

---

### Phase B — Noisy API fetch fix

- [ ] **B1** Gate `loadPendingAdminCount` in onboarding store
  - Add optional `canManageSettings` param to `loadForOrg` / `loadPendingAdminCount`
  - Skip fetch when false; set `pendingAdminCount: 0`
  - _Requirements: 5.1, 5.2_

- [ ] **B2** Wire permission from app bootstrap
  - Find caller of `loadForOrg` (AppShell / auth init)
  - Pass `canManageSettings` from role + permissions (`settings.update` or owner/admin)
  - _Requirements: 5.1, 5.2_

---

### Phase C — Audit matrix

- [ ] **C1** Create `frontend/src/audit/roleAuditMatrix.ts`
  - Export `ROLE_NAV_EXPECTATIONS`, `ROLE_SETUP_VISIBLE`, `SETUP_LEAVES`, `DEMO_ROLES`
  - Export helper `expectedSettingsTabs(role, modules, permissions)` wrapping `getVisibleBindings`
  - _Requirements: 6.6_

- [ ] **C2** Unit tests `frontend/src/audit/__tests__/roleAuditMatrix.test.ts`
  - viewer has no setup
  - full_admin roles have setup
  - _Requirements: 1.2, 6.6_

---

### Phase D — E2E expansion

- [ ] **D1** Expand `frontend/e2e/role-full-audit.spec.ts`
  - Import audit matrix constants
  - Per role: verify nav sections (soft), visit setup leaves if allowed
  - Visit `/settings` and first 3 visible tabs via `?s=`
  - Smoke TopBar: density dropdown, user menu items exist
  - _Requirements: 6.1–6.4_

- [ ] **D2** Write JSON report in `afterAll`
  - `frontend/e2e/reports/role-audit-{iso}.json`
  - gitignore entry if needed
  - _Requirements: 6.5_

---

### Phase E — Documentation

- [ ] **E1** Update `docs/ux/ROLES.md`
  - Link to `.kiro/specs/role-navbar-settings-audit/`
  - Add commands: `npx playwright test role-full-audit`, `vitest roleModuleScope`
  - _Requirements: 7.1_

---

### Phase F — Checkpoint

- [ ] **F1** Run `vitest --run` for audit + registry tests
- [ ] **F2** Run `npm run build` in frontend
- [ ] **F3** Mark tasks complete in this file

---

## Parallel execution waves

```json
{
  "waves": [
    { "id": 0, "tasks": ["A1", "A2"], "agent": "scope-fix" },
    { "id": 1, "tasks": ["B1", "B2"], "agent": "fetch-gate" },
    { "id": 2, "tasks": ["C1", "C2"], "agent": "audit-matrix" },
    { "id": 3, "tasks": ["D1", "D2"], "agent": "e2e-expand", "depends": ["C1"] },
    { "id": 4, "tasks": ["E1"], "agent": "docs" },
    { "id": 5, "tasks": ["F1", "F2", "F3"], "agent": "checkpoint", "depends": ["A","B","C","D","E"] }
  ]
}
```

---

## Notes

- Tasks A, B, C can run fully in parallel (no file conflicts except careful merge on imports)
- Task D depends on C1 for shared constants
- owner/admin E2E remains skipped when TOTP required — document in report
