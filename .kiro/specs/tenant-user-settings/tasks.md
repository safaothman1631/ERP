# Tasks: Tenant User Settings v2

**Version:** 2.0  
**Estimate (remaining):** 2–3 weeks  
**Depends on:** `module-licensing-access`, `super-admin-console`, `phase-2-security-rbac`, `nav-settings-cleanup`

**Order:** Phase 0–J (v1 baseline) → **Phase K–Q (v2 completion)**

---

## Progress summary

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Spec & inventory | ✅ Done |
| A | Registry & types | ✅ Done |
| B | Access hooks | ✅ Done |
| C | Settings shell | ✅ Mostly (C4 partial) |
| D | Module-gated nav | ✅ Done |
| E | Section extraction | ☐ Not started |
| F | Backend enforcement | ✅ Done |
| G | Nav & platform cleanup | ✅ Done |
| H | i18n & help | ✅ Done |
| I | Tests & E2E (v1) | ✅ Done |
| J | Docs & rollout (v1) | ✅ Done |
| **K** | **v2 access fixes** | ☐ NEW |
| **L** | **Specialist scoped read** | ☐ NEW |
| **M** | **Phase E extraction** | ☐ NEW |
| **N** | **Server sync & registry CI** | ☐ NEW |
| **O** | **Feature flag mirror & cleanup** | ☐ NEW |
| **P** | **v2 E2E matrix & QA scenarios** | ☐ NEW |
| **Q** | **Final verification & DoD** | ☐ NEW |

---

## Phase 0 — Spec & inventory (0.5 day) ✅

- [x] **0.1** Audit `Settings.tsx` SectionKey vs catalog
- [x] **0.2** List platform-only UI reachable from tenant
- [x] **0.3** Document `_require_settings_write` in system.py
- [x] **0.4** Cross-link super-admin-console spec
- [x] **0.5** v2: Expand requirements/design/tasks (this document)

---

## Phase A — Registry & types (1–2 days) ✅

- [x] **A1** `frontend/src/settings/registry/types.ts`
- [x] **A2** `moduleSettingsRegistry.ts` — SECTION_BINDINGS, MODULE_PRIMARY_SECTION
- [x] **A3** `platformOnlySections.ts`
- [x] **A4** Unit tests `moduleSettingsRegistry.test.ts`

### v2 additions

- [ ] **A5** Add optional `bagCategory` field to each binding with moduleGate (sync table in design §5)
- [ ] **A6** Document `specialistReadRoles` in types (or defer to roleModuleScope.ts)
- [ ] **A7** Export registry JSON for backend parity script (`registry/export.json`)

---

## Phase B — Access hooks (1 day) ✅

- [x] **B1** `useSettingsAccess.ts`
- [x] **B2** `useVisibleSections.ts`
- [x] **B3** Extend `usePermission.ts` — hasPerm, isTenantOrgAdmin, isImpersonating
- [x] **B4** Tests `useSettingsAccess.test.ts`

### v2 additions (→ Phase K)

- [ ] **B5** Fix org_read immutability in canEdit (remove admin bypass)
- [ ] **B6** Wire specialist scope into visibility pipeline
- [ ] **B7** Add `SettingsEditContext` provider in SettingsShell
- [ ] **B8** Extend tests: admin + activity → canEdit false

---

## Phase C — Settings shell (2–3 days) ✅ partial

- [x] **C1** SettingsShell.tsx
- [x] **C2** SettingsNav.tsx
- [x] **C3** SettingsRouteGuard.tsx
- [ ] **C4** Settings.tsx thin re-export only (< 200 lines) — **blocked by Phase M**
- [x] **C5** Remove feature_flags from tenant nav
- [x] **C6** system-health redirect
- [x] **C7** Open Settings to all authenticated users
- [x] **C8** SettingsGateBanner
- [x] **C9** Mobile drawer filtered nav

### v2 additions

- [ ] **C10** Default landing section per role (requirements §2 table)
- [ ] **C11** Loading guard — no flash of forbidden section before redirect
- [ ] **C12** Persist last visited section in localStorage (respect access on restore)

---

## Phase D — Module-gated nav & Modules tab (1–2 days) ✅

- [x] **D1** Wire isModuleEnabled into useVisibleSections
- [x] **D2** Hide empty groups
- [x] **D3** Enhance ModulesSettings — cards, CTAs
- [x] **D4** ModuleSettingsCard.tsx
- [x] **D5** Store subscription on enabledModules change
- [x] **D6** i18n gate keys

### v2 additions

- [ ] **D7** Module card state: `not_in_pool` vs `in_pool_not_enabled` vs `enabled`
- [ ] **D8** i18n `settings.modules.not_in_license`
- [ ] **D9** License expired banner on Modules tab when API returns license_expired

---

## Phase E — Extract section components → **renamed Phase M in v2**

See **Phase M** below for full breakdown (E1–E12 retained as task IDs).

---

## Phase F — Backend enforcement (1–2 days) ✅

- [x] **F1** settings_category_gate.py
- [x] **F2** Wire GET/PUT system settings
- [x] **F3** Granular _require_settings_write
- [x] **F4** _require_settings_read
- [x] **F5** Block feature-flags POST from tenant admin
- [x] **F6** GET /api/onboarding/settings-sections (optional)
- [x] **F7** Seed defaults on module approve
- [x] **F8** test_settings_category_gate.py
- [x] **F9** test_settings_permissions.py extensions

### v2 additions (→ Phase N)

- [ ] **F10** READ_ONLY_CATEGORIES = {activity} — PUT returns read_only_section
- [ ] **F11** Specialist GET read for scoped roles (sales → sales category)
- [ ] **F12** test_settings_read_only.py
- [ ] **F13** test_settings_specialist_read.py
- [ ] **F14** settings-sections response includes deny_reason parity with frontend

---

## Phase G — Navigation & platform cleanup (1 day) ✅

- [x] **G1** navigation.tsx — /settings for all auth
- [x] **G2** Remove system-health from tenant SideNav
- [x] **G3** Command palette registry filter
- [x] **G4** Super admin → /platform home
- [x] **G5** Impersonation banner + gating

---

## Phase H — i18n & help (1 day) ✅

- [x] **H1** ku/en gate messages
- [x] **H2** Help popovers
- [x] **H3** Empty state zero modules
- [x] **H4** RTL pass

### v2 additions

- [ ] **H5** ar.json keys for all v2 gate strings
- [ ] **H6** Toast keys: unknown_section, read_only_section
- [ ] **H7** Help popover for Modules tab + specialist view-only banner

---

## Phase I — Tests & E2E v1 (1–2 days) ✅

- [x] **I1** E2E viewer personal sections
- [x] **I2** E2E module gating admin sales-only
- [x] **I3** E2E platform removal
- [x] **I4** Backend integration matrix
- [x] **I5** npm run build green

---

## Phase J — Docs & rollout v1 (0.5 day) ✅

- [x] **J1** docs/settings/SETTINGS.md
- [x] **J2** OPERATIONS_RUNBOOK.md
- [x] **J3** VITE_TENANT_SETTINGS_V2 documented
- [x] **J4** CHANGELOG entry

### v2 additions (→ Phase Q)

- [ ] **J5** SETTINGS.md v2 scenarios A–D
- [ ] **J6** CHANGELOG v2 entry
- [ ] **J7** Remove VITE_TENANT_SETTINGS_V2 from .env.example after Q

---

## Phase K — v2 Access Logic Fixes (1–2 days) ☐ PRIORITY

**Goal:** Align runtime behavior with requirements §2, §5 golden rules.

- [ ] **K1** Fix `useSettingsAccess.ts`:
  - org_read → canEdit ALWAYS false (including isTenantOrgAdmin)
  - Remove redundant `hasPerm` bypass that grants edit on org_read
- [ ] **K2** Update `canEditBinding` — document that caller must not override org_read
- [ ] **K3** Create `SettingsEditContext.tsx` — provide canEdit to SaveBar + forms
- [ ] **K4** Wire context in SettingsShell; hide SaveBar when !canEdit
- [ ] **K5** Ensure `useSettingsBag` respects SettingsEditContext (no PUT when view-only)
- [ ] **K6** Deprecate whole-page `hasSettingsAccess` block anywhere remaining in Settings.tsx
- [ ] **K7** Default landing: profile (standard), organization (admin first visit)
- [ ] **K8** Unit tests:
  - admin + activity → canView true, canEdit false
  - manager + sales → canView true, canEdit false
  - admin + sales → canEdit true
- [ ] **K9** Manual QA: Save bar absent on activity for admin

**PR:** `fix/settings-v2-org-read-immutability`

---

## Phase L — Specialist Scoped Read (2–3 days) ☐

**Goal:** Requirement 10 — sales sees sales only, read-only.

- [ ] **L1** Create `frontend/src/settings/registry/roleModuleScope.ts`
  - ROLE_MODULE_SCOPE map
  - ACCOUNTANT_FINANCE_SECTIONS
  - isSpecialistScopedRead(), isSpecialistRole()
- [ ] **L2** Integrate into `getVisibleBindings()`:
  - viewer/user → personal + modules (+ system) only
  - specialist → personal + scoped module sections (view)
  - manager → personal + all enabled module org_write as view
- [ ] **L3** Integrate into `useSettingsAccess`:
  - specialist on org_write section → canView true, canEdit false
- [ ] **L4** Hide org general/users/automation from specialist roles
- [ ] **L5** Accountant: finance sections per ACCOUNTANT_FINANCE_SECTIONS + write per perm
- [ ] **L6** Backend F11: specialist GET allowed for scoped category
- [ ] **L7** Tests:
  - `roleModuleScope.test.ts`
  - extend `useSettingsAccess.test.ts`
  - `test_settings_specialist_read.py`
- [ ] **L8** Update default RBAC role templates (if seed exists) with settings.read for manager only — NOT for sales unless product decision

**PR:** `feat/settings-specialist-scoped-read`

---

## Phase M — Section Extraction (3–5 days) ☐

**Goal:** Requirement 13 — Settings.tsx < 200 lines; lazy sections.

Extract from `Settings.tsx` into `frontend/src/settings/sections/`:

- [ ] **E1 / M1** `personal/` — Profile, Security, Notifications, Preferences
- [ ] **E2 / M2** `organization/` — General, Appearance, Org, Branches, Branding, WH, Holidays
- [ ] **E3 / M3** `users/` — Users, Roles, Permissions, SSO, Portals
- [ ] **E4 / M4** `localization/` — Localization, Languages, Formats, Currencies
- [ ] **E5 / M5** `finance/` — Fiscal, Budgets, Taxes, Banking, Payment methods, E-invoice, Templates, Reminders
- [ ] **E6 / M6** `commerce/` — Sales, CRM, Purchases, Inventory, MRP, POS, Ecommerce, Helpdesk
- [ ] **E7 / M7** `operations/` — HR, Payroll, Projects, Marketing
- [ ] **E8 / M8** `automation/` — Workflows, Approvals, Integrations, Webhooks, API tokens
- [ ] **E9 / M9** `content/` — Documents, Email, SMS/WhatsApp
- [ ] **E10 / M10** `system/` — Modules, Backup, Activity, Audit, GDPR, Mobile, SystemInfo
- [ ] **E11 / M11** Lazy `sections/index.ts` — SectionKey → React.lazy
- [ ] **E12 / M12** Trim SystemInfo — remove infra strings
- [ ] **M13** `Settings.tsx` → `export { default } from '../settings/shell/SettingsShell'`
- [ ] **M14** Snapshot or smoke test per extracted section (render without crash)
- [ ] **M15** Verify each section uses SettingsEditContext + useSettingsAccess

**Recommended PR sequence:** M1 → M2+M3 → M4+M5 → M6+M7 → M8+M9 → M10+M11+M13

---

## Phase N — Server Sync & Registry CI (1–2 days) ☐

**Goal:** Requirements 12, 13 — tamper-resistant nav; FE/BE sync.

- [ ] **N1** Implement Python mirror of visibility OR enhance settings-sections endpoint with full deny_reason
- [ ] **N2** Create `frontend/src/settings/hooks/useSettingsSectionsSync.ts`
  - fetch settings-sections on mount
  - if server denies visible client section → hide + dev warning
- [ ] **N3** Script `scripts/check-settings-registry-sync.ts`
  - compare frontend bagCategory keys vs CATEGORY_MODULE
  - exit 1 on drift
- [ ] **N4** Add npm script `check:settings-registry`
- [ ] **N5** Optional: GitHub Actions step in CI
- [ ] **N6** Backend READ_ONLY_CATEGORIES (F10)
- [ ] **N7** Tests for settings-sections API response shape

**PR:** `feat/settings-server-sections-sync`

---

## Phase O — Feature Flag Mirror & Env Cleanup (1 day) ☐

**Goal:** Requirement 9; single code path.

- [ ] **O1** Create `FeatureFlagMirror.tsx` — read-only table under Modules or System (admin only)
- [ ] **O2** GET effective flags API — confirm tenant read allowed, write blocked
- [ ] **O3** i18n: settings.flags.contact_vendor
- [ ] **O4** Remove VITE_TENANT_SETTINGS_V2 from code paths (if any runtime branch)
- [ ] **O5** Update frontend/.env.example — remove or mark deprecated
- [ ] **O6** Test: admin sees mirror; POST flag as admin → 403

**PR:** `feat/settings-feature-flag-mirror`

---

## Phase P — v2 E2E Matrix & QA Scenarios (2 days) ☐

**Goal:** Requirement 14 scenarios A–D automated where possible.

- [ ] **P1** E2E `settings-specialist.spec.ts` — sales user sees sales read-only, not crm
- [ ] **P2** E2E `settings-manager.spec.ts` — manager read sales, no save bar
- [ ] **P3** E2E `settings-admin-activity.spec.ts` — admin views activity, no save
- [ ] **P4** E2E scenario A retail org matrix (subset)
- [ ] **P5** E2E scenario C empty modules
- [ ] **P6** Unit matrix generator test (optional) — roles × modules × sections
- [ ] **P7** Backend test matrix: specialist PUT → 403
- [ ] **P8** Document manual QA checklist in `docs/settings/QA_SCENARIOS.md`

**PR:** `test/settings-v2-e2e-matrix`

---

## Phase Q — Final Verification & Definition of Done (1 day) ☐

- [ ] **Q1** Run full test suite: frontend unit, backend pytest, E2E, build
- [ ] **Q2** Update `docs/settings/SETTINGS.md` — v2 matrix, golden rules, scenarios
- [ ] **Q3** Update CHANGELOG — Tenant Settings v2 complete
- [ ] **Q4** Update OPERATIONS_RUNBOOK — feature flag mirror, specialist roles
- [ ] **Q5** Cross-link from `module-licensing-access/tasks.md` and `super-admin-console/tasks.md`
- [ ] **Q6** Verify Definition of Done in requirements §16 — all boxes checked
- [ ] **Q7** Remove deprecated hasSettingsAccess usages (grep cleanup)
- [ ] **Q8** Line count check: Settings.tsx < 200 lines
- [ ] **Q9** Security review: grep tenant for platform.admin, feature-flags POST
- [ ] **Q10** Sign-off checklist for product owner

---

## Checklist: Platform-only removal (tenant)

| Item | Task | v1 | v2 |
|------|------|----|----|
| Feature flags write | C5, F5 | ✅ | O6 verify |
| Feature flags nav | C5 | ✅ | — |
| Read-only mirror | — | ❌ | O1 |
| Full system health | C6, G2 | ✅ | — |
| License pool edit | D3 | ✅ | D7 |
| Cross-org module queue | Platform | ✅ | — |
| super_admin tenant home | G4 | ✅ | — |

---

## Checklist: User capability limits (v2 target)

| Capability | viewer | sales | manager | accountant | admin | Platform |
|------------|--------|-------|---------|------------|-------|----------|
| Edit own profile | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| View modules tab | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| View org sales settings | ❌ | ✅ read | ✅ read | ❌ | ✅ | N/A |
| Edit org sales settings | ❌ | ❌ | ❌ | ❌ | ✅ | N/A |
| View activity log | ❌ | ❌ | ✅ read | ❌ | ✅ read | N/A |
| Edit activity log | ❌ | ❌ | ❌ | ❌ | ❌ | N/A |
| Manage roles/RBAC | ❌ | ❌ | ❌ | ❌ | ✅ | N/A |
| Edit fiscal/taxes | ❌ | ❌ | ❌ | ✅* | ✅ | N/A |
| Feature flags rollout | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View feature flags mirror | ❌ | ❌ | ❌ | ❌ | ✅ read | ✅ |
| System infra health | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Edit license pool | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

*Accountant with matching perm only.

---

## Recommended PR sequence (v2)

```
PR-A:  K1-K9   (org_read fix + SettingsEditContext)     ← ship first
PR-B:  L1-L8  (specialist scoped read)
PR-C:  M1-M5  (extract personal, org, users, l10n, finance)
PR-D:  M6-M10 (extract commerce, ops, automation, content, system)
PR-E:  M11-M15 (lazy index + thin Settings.tsx)
PR-F:  N1-N7  (server sync + CI + read_only backend)
PR-G:  O1-O6  (feature flag mirror + env cleanup)
PR-H:  P1-P8 + Q1-Q10 (E2E matrix + docs + DoD)
```

---

## Definition of Done (v2 — final)

- [ ] Requirements §16 all criteria met
- [ ] Phase K–Q complete
- [ ] Scenario A–D documented and tested
- [ ] org_read immutability verified (admin cannot save activity)
- [ ] Specialist sales sees sales read-only only
- [ ] Settings.tsx < 200 lines
- [ ] Registry sync script in CI (or documented manual check)
- [ ] ku/en/ar i18n for all gate UX
- [ ] No platform sections in tenant nav or successful deep links
- [ ] API 403 structured for module_disabled, permission_denied, read_only_section
- [ ] Super admin primary UI remains `/platform/*`
- [ ] `npm run build` + all tests green
- [ ] Product sign-off on role matrix

---

## Time estimate summary

| Phase | Days |
|-------|------|
| K Access fixes | 1–2 |
| L Specialist read | 2–3 |
| M Extraction | 3–5 |
| N Server sync | 1–2 |
| O Flag mirror | 1 |
| P E2E matrix | 2 |
| Q Verification | 1 |
| **Total remaining** | **11–16 days** |

---

## Notes for implementers

1. **Ship K before M** — behavior fixes are small and high value; extraction is large.
2. **One section group per PR** — reduces regression risk in monolith split.
3. **Do not re-introduce whole-page admin gate** — use per-section access only.
4. **When in doubt:** platform → `/platform`; org config → tenant; module off → modules tab CTA.
5. **Sync registry** — any new SectionKey requires frontend binding + backend CATEGORY_MODULE + test row in matrix.
