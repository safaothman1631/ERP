# Requirements: Role Navbar, Setup & Settings Audit

**Version:** 1.0  
**Status:** Authoritative target  
**Last updated:** 2026-05-25  
**Companion:** `design.md`, `tasks.md`

---

## Introduction

ئەم spec ـە **ئۆدیتی تەواوی UX ـی role-adaptive** بۆ ١٢ demo user لە **org ـی هاوبەش** دەپارێزێت:

1. **Sidebar Nav** — هەر section و leaf route بەپێی nav profile + module gate
2. **Setup section** — ١٤ leaf route + parity لەگەڵ Settings
3. **Settings shell** — ١١ group، ~٤٨ tab، dropdown/form fields
4. **TopBar dropdowns** — Org/Branch، Quick actions، Density، Language، User menu
5. **Security parity** — UX progressive disclosure + backend RBAC source of truth

**Demo org:** `064a4a1a-487b-4835-a42a-4806ba8add72` · Password: `Demo@2026`

**پەیوەندی:**

| Spec | پەیوەندی |
|------|----------|
| `role-adaptive-glass-ux` | Nav profiles، themes، identity chip |
| `tenant-user-settings` | Settings tiers + module gate |
| `phase-2-security-rbac` | Role codes + permissions |
| `module-licensing-access` | Enabled modules filter |

**Out of scope:** Backend RBAC rule changes (تەنها consumption + noisy fetch fixes).

---

## Glossary

| Term | Meaning |
|------|---------|
| **Nav Profile** | `full_admin`, `sales_cluster`, `readonly`, … — filters sidebar sections |
| **Nav Leaf** | Single route in a section (e.g. `/settings`, `/users`) |
| **Setup Section** | Nav section `key: setup` with admin/config routes |
| **Settings Binding** | Tab definition in `SECTION_BINDINGS` with tier + permission |
| **Specialist Scope** | Limited org_write tabs via `ROLE_MODULE_SCOPE` |
| **Audit Matrix** | Expected visible/hidden map per role for automated tests |

---

## Requirement 1: Per-Role Nav Section Visibility

**User Story:** وەک demo tester، دەمەوێت هەر role تەنها sections ـی گونجاو ببینێت.

### Acceptance Criteria

1. WHEN role is `owner` or `admin`, THE Nav_Sidebar SHALL show all 25 sections including `setup`.
2. WHEN role is `viewer`, THE Nav_Sidebar SHALL NOT show the `setup` section.
3. WHEN role is `cashier`, THE Nav_Sidebar SHALL default to collapsed mode (`pos_minimal`).
4. WHEN role is `sales_rep`, THE default home route SHALL be `/crm/leads`.
5. WHEN role is `cashier`, THE default home route SHALL be `/pos`.
6. THE Nav_Sidebar SHALL apply `applyNavProfile()` before module gating.
7. IF a section is hidden by nav profile, THEN no leaf from that section SHALL appear in the sidebar for that role.

---

## Requirement 2: Setup Section Completeness

**User Story:** وەک org admin، دەمەوێت Setup ـەکە هەموو config routes ـی پێویست لە یەک شوێندا کۆ بکاتەوە.

### Acceptance Criteria

1. THE `setup` NavSection SHALL contain exactly these routes (no duplicates elsewhere):
   `/custom-fields`, `/users`, `/rbac-roles`, `/user-roles`, `/settings`, `/settings/numbering`, `/automation-rules`, `/audit-log-viewer`, `/admin/job-runs`, `/studio`, `/onboarding`, `/docs`, `/ui-gallery`, `/trash`.
2. WHEN user navigates to `/settings` from Setup nav, THE page SHALL render the same Settings shell as user menu → Settings.
3. WHEN org is demo (`is_demo_org=true`), THE `/onboarding` route SHALL NOT force-open the onboarding wizard overlay.
4. WHEN role lacks admin permissions, THEN admin-only Setup routes (`/users`, `/rbac-roles`, `/admin/job-runs`) SHALL return 403 from API or show access-denied UI — not a blank crash.
5. THE `flattenRoutes()` function SHALL emit zero duplicate-route warnings in development for the current nav tree.

---

## Requirement 3: Settings Tab Scope by Role

**User Story:** وەک specialist employee، دەمەوێت تەنها settings tabs ـی پەیوەندیدار ببینم.

### Acceptance Criteria

1. WHEN any authenticated user opens `/settings`, THE Settings shell SHALL show all `tier: personal` tabs (profile, security, notifications, preferences, modules, system).
2. WHEN role is `viewer` or `user`, THE Settings shell SHALL NOT show `tier: org_write` tabs unless explicit permission grants access.
3. WHEN role is `accountant`, THE Settings shell SHALL show personal tabs plus finance scope: fiscal, budgets, taxes, banking, currencies (when accounting module enabled).
4. WHEN role is `sales_rep`, THE Settings shell SHALL show personal tabs plus sales module settings (primary section + module-gated tabs).
5. WHEN role is `inventory_manager`, THE Settings shell SHALL resolve scope via `inventory` module alias.
6. WHEN role is `cashier`, THE Settings shell SHALL resolve scope via `pos` module alias.
7. WHEN role is `hr`, THE Settings shell SHALL show personal tabs plus HR module settings when `hr` module enabled.
8. WHEN role is `owner` or `admin`, THE Settings shell SHALL show all enabled org tabs subject to module gate.
9. WHEN user deep-links to `?s=<key>` for a tab they cannot access, THE Settings shell SHALL redirect to the first allowed tab with `replace: true`.
10. THE `ROLE_MODULE_SCOPE` map SHALL include aliases for legacy role codes: `sales_rep→sales`, `inventory_manager→inventory`, `cashier→pos_cashier`, `hr→hr`.

---

## Requirement 4: TopBar & Dropdown Audit

**User Story:** وەک user، دەمەوێت TopBar dropdowns بەپێی role دروست بن.

### Acceptance Criteria

1. THE TopBar SHALL show role-specific quick actions (max 2 visible) from `resolveRoleTheme().quickActions`.
2. WHEN role is `viewer`, THE QuickCreate footer SHALL be hidden (`hideCreateFooter`).
3. THE RoleIdentityChip dropdown SHALL offer: Profile, Settings, Logout for all tenant roles.
4. THE Density dropdown SHALL offer compact / comfortable / spacious for all roles.
5. WHEN user logs out, THE system SHALL revoke JWT only — `is_2fa_enabled` SHALL remain unchanged on re-login.
6. THE OrgSwitcher and BranchSwitcher SHALL render without error for all demo roles in the shared org.

---

## Requirement 5: Noisy API Fetch Prevention

**User Story:** وەک developer، دەمەوێت console ـدا 403 ـی expected نەبینم.

### Acceptance Criteria

1. WHEN user lacks `settings.update` permission, THE onboarding store SHALL NOT call `GET /api/onboarding/module-requests?status=pending`.
2. WHEN user has `settings.update`, THE pending admin count fetch MAY run and update badge counts.
3. WHEN `ModuleRequestsPage` loads without permission, THE page SHALL show access-denied UI instead of firing failing requests in a loop.

---

## Requirement 6: Automated Role Audit

**User Story:** وەک QA، دەمەوێت Playwright هەموو role ـەکان بە خۆکار تاقی بکاتەوە.

### Acceptance Criteria

1. THE E2E suite SHALL audit all 12 demo roles against the shared org.
2. FOR each non-2FA role, THE suite SHALL visit: home route, `/settings`, all visible Setup leaves (if setup in profile), and sample nav leaves.
3. FOR each role, THE suite SHALL assert: RoleIdentityChip visible, zero page crashes, zero API 5xx.
4. FOR `owner` and `admin` with TOTP enabled, THE suite SHALL skip browser audit with documented reason (API login returns `2fa_code_required`).
5. THE audit SHALL produce a markdown/JSON summary artifact under `frontend/e2e/reports/`.
6. A static **audit matrix module** SHALL encode expected nav sections and settings tabs per role for unit + E2E consumption.

---

## Requirement 7: Documentation & Demo Ops

### Acceptance Criteria

1. `docs/ux/ROLES.md` SHALL reference this spec and list audit commands.
2. Seed script `backend/scripts/seed_role_demo_users.py` SHALL remain the source of demo credentials.
3. `backend/scripts/audit_demo_users_api_access.py` SHALL remain compatible with the shared org id.

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Nav/settings audit E2E completes within 15 min for 10 non-2FA roles |
| NFR-2 | Unit tests for role scope aliases ≥ 100% coverage of `roleModuleScope.ts` |
| NFR-3 | No regression in `npm run build` |
| NFR-4 | Kurdish/RTL: dropdown placement `bottomLeft` when RTL |
