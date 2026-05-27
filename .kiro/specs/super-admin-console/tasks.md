# Tasks: Super Admin Platform Console

**Estimate:** 4–6 weeks (1 backend + 1 frontend, or 2 full-stack phases)  
**Depends on:** `module-licensing-access` (done), `ui-redesign-modern` (glass tokens), auth JWT role claims (done)  
**Spec:** `.kiro/specs/super-admin-console/`  
**Related:** `.kiro/specs/tenant-user-settings/` — tenant `/settings` vs platform-only controls (feature flags, health, license)

---

## Phase 0 — Routing & separation foundation (2–3 days)

- [ ] **0.1** Create `frontend/src/platform/hooks/usePlatformAccess.ts` — `isSuperAdmin`, `isPlatformAdmin`, `canAccessPlatform`
- [ ] **0.2** Create `PlatformRoute` + `TenantRoute` guards in `App.routes.tsx`
- [ ] **0.3** Login redirect: super_admin → `/platform`, others → `/dashboard` (`LoginPage`, `RegisterPage`, Google auth)
- [ ] **0.4** Stub `PlatformShell.tsx` + route `/platform` with placeholder dashboard
- [ ] **0.5** Block tenant `/platform/*` for non-platform users (403 redirect)
- [ ] **0.6** Block super_admin from tenant AppShell unless impersonating (redirect to `/platform`)
- [ ] **0.7** Tests: `platform-routing.test.tsx`, `test_login_redirect_super_admin.py`

---

## Phase 1 — Platform Glass Design System (3–4 days)

- [ ] **1.1** Create `frontend/src/platform/theme/platformTokens.ts` — indigo glass palette (extend `theme/tokens.ts`)
- [ ] **1.2** Create `PlatformGlass.module.css` — orbs, grid, glass panels, dark-first + light variant
- [ ] **1.3** Build `PlatformShell.tsx` — full layout (SideNav 260px + TopBar + content)
- [ ] **1.4** Build `PlatformSideNav.tsx` — nav items: Dashboard, Orgs, Requests, Users, Audit, Health, Flags
- [ ] **1.5** Build `PlatformTopBar.tsx` — glass toolbar: search, theme, language, profile, logout
- [ ] **1.6** Build shared `GlassCard`, `KpiStat`, `PlatformPageHeader` components
- [ ] **1.7** i18n: `locales/{ku,en,ar}/platform.json` — nav + shell strings
- [ ] **1.8** RTL + mobile responsive shell (drawer nav on mobile)
- [ ] **1.9** Visual QA: ku RTL screenshot, dark/light toggle

---

## Phase 2 — Platform Dashboard (2 days)

- [ ] **2.1** Backend: `GET /api/platform/stats` — org count, user count, pending requests, expiring licenses
- [ ] **2.2** `PlatformDashboard.tsx` — KPI grid + recent audit feed + quick actions
- [ ] **2.3** Wire stats API with React Query
- [ ] **2.4** Tests: `test_platform_stats.py`, dashboard render test

---

## Phase 3 — Organization management (4–5 days)

- [ ] **3.1** Backend: `backend/app/api/platform/orgs.py`
  - `GET /api/platform/orgs` (pagination, search, filter)
  - `GET /api/platform/orgs/{id}` (detail + license summary + user count)
  - `POST /api/platform/orgs` (create + invite owner)
  - `PATCH /api/platform/orgs/{id}` (suspend/unsuspend, metadata)
  - `DELETE /api/platform/orgs/{id}` (soft delete)
- [ ] **3.2** Firestore: add `status`, `suspended_at`, `deleted_at` on organizations
- [ ] **3.3** Tenant API: reject suspended org with `{code: "org_suspended"}`
- [ ] **3.4** `OrgListPage.tsx` — glass table, search, tier badges, expiry warnings
- [ ] **3.5** `OrgDetailPage.tsx` — tabs: Overview, License, Users, Requests, Audit
- [ ] **3.6** `CreateOrgModal.tsx` — name, owner email, bundle preset
- [ ] **3.7** Tests: `test_platform_orgs.py` (CRUD, suspend blocks tenant API)

---

## Phase 4 — License editor migration (2 days)

- [ ] **4.1** Move `OrgLicenseEditor.tsx` → `platform/licenses/LicenseEditorPage.tsx`
- [ ] **4.2** Redesign with platform glass components (not tenant SectionCard)
- [ ] **4.3** Add license diff preview + confirm modal before save
- [ ] **4.4** Integrate into OrgDetailPage tab + standalone route
- [ ] **4.5** Deprecate old route `/platform/orgs` manual-ID-only UX
- [ ] **4.6** Tests: existing `test_platform_api.py` + UI smoke

---

## Phase 5 — Global module request queue (2–3 days)

- [ ] **5.1** Backend: `GET /api/platform/module-requests` — cross-org, filter by status/org
- [ ] **5.2** Backend: platform approve/reject override endpoints
- [ ] **5.3** `GlobalModuleRequestsPage.tsx` — glass queue table, approve/reject modals
- [ ] **5.4** Dashboard KPI links to queue with pending count badge in SideNav
- [ ] **5.5** Tests: `test_platform_module_requests.py`

---

## Phase 6 — Cross-org user management (3–4 days)

- [ ] **6.1** Backend: `GET /api/platform/users` — search email/name/org/role
- [ ] **6.2** Backend: `GET /api/platform/users/{id}`, `POST unlock`, `POST deactivate`
- [ ] **6.3** `GlobalUsersPage.tsx` — search, filters, glass data table
- [ ] **6.4** `UserDetailPage.tsx` — profile, roles, last login, actions
- [ ] **6.5** Audit all destructive user actions
- [ ] **6.6** Tests: `test_platform_users.py`

---

## Phase 7 — Impersonation (3 days)

- [ ] **7.1** Backend: `POST /api/platform/impersonate`, `POST /api/platform/impersonate/exit`
- [ ] **7.2** JWT claims: `impersonated_by`, `impersonation=true`, 1h expiry
- [ ] **7.3** `useImpersonationStore.ts` — save admin token, restore on exit
- [ ] **7.4** `ImpersonationBanner.tsx` — sticky glass banner in tenant AppShell
- [ ] **7.5** Org detail: **"Enter organization"** button → impersonate org owner
- [ ] **7.6** Env gate: `PLATFORM_IMPERSONATION_ENABLED` (default false prod)
- [ ] **7.7** Tests: audit trail, exit restores admin session

---

## Phase 8 — Audit, health, operations (3 days)

- [ ] **8.1** Backend: `GET /api/platform/audit` — global audit with filters + CSV export
- [ ] **8.2** `PlatformAuditPage.tsx` — glass filter bar + infinite scroll table
- [ ] **8.3** `PlatformHealthPage.tsx` — wrap/adapt `SystemHealthPage` in platform shell
- [ ] **8.4** Platform SideNav badge for health degraded state
- [ ] **8.5** Tests: audit query pagination, export limit

---

## Phase 9 — Feature flags & announcements (2–3 days)

- [ ] **9.1** Backend: CRUD `feature_flags` collection + tenant read endpoint
- [ ] **9.2** Backend: CRUD `platform_announcements` + tenant banner endpoint
- [ ] **9.3** `FeatureFlagsPage.tsx` — toggle list + rollout percent
- [ ] **9.4** `AnnouncementsPage.tsx` — schedule editor
- [ ] **9.5** Tenant `AppShell`: render active announcement banner (glass strip)
- [ ] **9.6** Tests: flag read cache, announcement date window

---

## Phase 10 — Platform command palette & polish (2 days)

- [ ] **10.1** `PlatformCommandPalette.tsx` — jump to org, user, pages (⌘K)
- [ ] **10.2** Platform notifications (pending requests, expiring licenses)
- [ ] **10.3** Empty states, loading skeletons (platform glass variant)
- [ ] **10.4** Accessibility pass: focus order, aria labels, keyboard nav
- [ ] **10.5** Performance: lazy routes, bundle analyze platform chunk

---

## Phase 11 — E2E, docs, runbook (2 days)

- [ ] **11.1** E2E: `tests/e2e/platform/super-admin.spec.ts`
- [ ] **11.2** Update `OPERATIONS_RUNBOOK.md` — platform console section
- [ ] **11.3** Update `.env.example` — `PLATFORM_ADMIN_USER_IDS`, `PLATFORM_IMPERSONATION_ENABLED`
- [ ] **11.4** Script: `promote_super_admin.py` docs link to platform console
- [ ] **11.5** Final QA checklist (ku/en/ar, dark/light, mobile)

---

## Implementation order (recommended)

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
                              ↓
                    Phase 5 + Phase 6 (parallel)
                              ↓
                    Phase 7 (impersonation)
                              ↓
                    Phase 8 → Phase 9 → Phase 10 → Phase 11
```

**First shippable milestone (MVP ~2 weeks):** Phase 0–4 + Phase 5  
Super admin gets dedicated glass console, org list, license editor, global module queue — no impersonation yet.

**Full v1 (~4–6 weeks):** All phases through 11.

---

## Agent assignment matrix

| Task block | Agent type | Notes |
|------------|------------|-------|
| 0.1–0.7 routing | `generalPurpose` | Small, critical — do first |
| 1.1–1.9 design system | `generalPurpose` | CSS-heavy, reference onboarding glass |
| 3.1–3.3 backend orgs | `generalPurpose` | Firestore + tests |
| 3.4–3.6 org UI | `generalPurpose` | After shell ready |
| 5 + 6 parallel | 2× `generalPurpose` | Independent API surfaces |
| 7 impersonation | `generalPurpose` | Security-sensitive — review carefully |
| 11 E2E | `shell` | Playwright |
| CI failures | `ci-investigator` | After PR |

---

## Acceptance checklist (copy for PR)

- [ ] Super admin lands on `/platform` after login (email + Google)
- [ ] Tenant user cannot open `/platform`
- [ ] Platform UI visually distinct (indigo glass, not tenant blue shell)
- [ ] Org suspend blocks tenant API
- [ ] License edit audits + reflects in tenant onboarding pool
- [ ] Global module queue approve works
- [ ] ku / en / ar + RTL on all platform pages
- [ ] Dark + light mode on platform shell
- [ ] All platform mutations in audit log
