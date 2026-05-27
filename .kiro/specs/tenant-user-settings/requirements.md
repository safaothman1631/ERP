# Requirements: Tenant User Settings v2 (Module-Gated, Role-Limited, Platform-Separated)

**Version:** 2.0  
**Status:** Authoritative target — supersedes v1 acceptance gaps where noted  
**Last updated:** 2026-05-25

---

## Introduction

ئەم spec ـە **Settings ـی tenant** (`/settings` لە `AppShell`) بە تەواوی ڕێکدەخات — **جیا لە Platform Console** (`/platform/*`). ئامانجی سەرەکی:

1. **Progressive access** — هەر authenticated user Settings دەبینێت؛ capability بە tier + module + RBAC دەدرێت.
2. **Module-first** — config ـی module تەنها کاتێک `enabled_modules` چالاکە.
3. **Platform hide, backend deny** — vendor infra لە tenant نەماوە؛ API هەرگیز bypass ناکرێت.
4. **Registry-driven** — یەک سەرچاوە بۆ nav، guards، command palette، backend map، tests.

### فلسفەی یەک ڕستە

> **Settings = org config لە ناو license + enabled modules + role. Platform = vendor infra.**

### پەیوەندی بە spec ـەکانی تر

| Spec | پەیوەندی |
|------|----------|
| `super-admin-console` | Platform-only: health, feature flags, license, cross-org |
| `module-licensing-access` | `allowed_modules`, `enabled_modules`, module requests |
| `phase-2-security-rbac` | Roles, permissions, audit, impersonation |
| `settings-documentation` | Settings bags, Firestore layout |
| `nav-settings-cleanup` | Help popovers, empty Select, i18n |
| `system-health-backup` | Infra health → platform only |

### سەرچاوەی کۆد (ئێستا)

| Path | Role |
|------|------|
| `frontend/src/pages/Settings.tsx` | Monolith shell (~5200 lines) — target: thin entry |
| `frontend/src/settings/` | Registry, hooks, shell (partial v1) |
| `frontend/src/onboarding/store.ts` | `enabledModules`, `isModuleEnabled` |
| `frontend/src/hooks/usePermission.ts` | Role + perm helpers |
| `backend/app/services/settings_category_gate.py` | Category → module + write perm |
| `backend/app/api/system.py` | Settings bag GET/PUT |
| `backend/app/api/feature_flags.py` | Platform-only write |

### Implementation status snapshot (v1 → v2 gap)

| Area | v1 done | v2 remaining |
|------|---------|--------------|
| Registry + nav filter | ✅ | Specialist scoped read |
| Open Settings to all users | ✅ | Default landing per role |
| Platform sections removed | ✅ | Feature flag read-only mirror |
| Backend category gate | ✅ | Full category catalog sync |
| Module tab + cards | ✅ | Request flow polish |
| Section extraction (Phase E) | ☐ partial | E1–E12 complete |
| org_read immutability | ☐ gap | Admin cannot edit `activity` |
| Specialist module read | ☐ gap | sales → sales settings read-only |
| Server-side nav validation | ☐ optional | `GET settings-sections` enforced |
| `hasSettingsAccess` deprecation | ☐ partial | Remove legacy gates |
| `VITE_TENANT_SETTINGS_V2` | documented | Remove dual-path |

---

## Glossary

| Term | Definition |
|------|------------|
| **Tenant Settings** | `/settings` in `AppShell` — org-scoped configuration |
| **Platform Console** | `/platform/*` — vendor/super admin only |
| **Settings Tier** | `personal` \| `org_read` \| `org_write` \| `platform_only` |
| **SectionKey** | Nav/API identifier (e.g. `sales`, `profile`) |
| **ModuleKey** | Key from `frontend/src/onboarding/industries.ts` |
| **Settings Bag** | JSON blob: `settings/{org_id}/{category}/blob` |
| **License pool** | `organizations.license.allowed_modules` — vendor cap, tenant read-only |
| **Enabled modules** | `onboarding_preferences.enabled_modules` — drives nav + API |
| **ALWAYS_ON** | `accounting`, `banking` — never blocked by module gate |
| **Module Gate** | Section visible when ANY listed module is enabled (OR semantics) |
| **Org Admin** | `role` ∈ {`admin`, `owner`} in same org |
| **Specialist role** | `sales`, `purchaser`, `inventory`, `accountant`, … — domain-scoped |
| **Platform admin** | `is_platform_admin` / `super_admin` without impersonation |
| **Impersonation** | Super admin in tenant with `impersonating=true` claim |

---

## Golden Rules (Normative)

1. **Module before settings** — no module config UI without enabled module.
2. **Platform separate** — vendor infra ≠ org config; never mixed in tenant nav.
3. **One registry** — frontend bindings + backend `CATEGORY_MODULE` stay in sync.
4. **Personal for everyone** — Settings ≠ admin-only page.
5. **Read ≠ Write** — `org_read` sections never editable by anyone (including admin).
6. **URL is not authority** — deep links guarded; backend is final say.
7. **Wildcard `*` is org-scoped** — never grants platform flag write or cross-org access.

### Visibility formula (normative)

```
canView(section) =
  authenticated
  AND NOT platform_only
  AND moduleGateSatisfied(section, enabled_modules)   // OR + ALWAYS_ON
  AND tierVisibility(section, role, permissions, moduleScope)

canEdit(section) =
  canView(section)
  AND tier ≠ org_read
  AND tier ≠ platform_only
  AND (
    tier = personal → own data only
    OR tier = org_write → writePermSatisfied(role, permissions, section)
  )
  // NOTE: isTenantOrgAdmin MUST NOT override org_read to edit
```

---

## Requirement 1: Platform vs Tenant Separation

**User Story:** وەک org user، نابێت بەشێکی platform لە Settings ببینم.

### Acceptance Criteria

1. Tenant Settings SHALL NOT render nav entries where `tier = platform_only`.
2. The following SHALL exist ONLY in Platform Console:
   - Global feature flags with rollout percentage
   - Cross-org system health (CPU, Firestore, scheduler, storage)
   - Org license editing (`allowed_modules`, bundle, expiry)
   - Cross-org audit viewer, global module request queue
   - Platform announcements, platform admin allowlist
3. WHEN `role=super_admin` logs in without impersonation, default route SHALL be `/platform` — NOT tenant `/settings`.
4. WHEN super admin impersonates in `AppShell`, Settings SHALL behave as tenant org admin — still NO platform-only sections.
5. Route `/settings/system-health` SHALL redirect:
   - Tenant user → `/settings?s=system` with info toast
   - Super admin (non-impersonating) → `/platform/health`
6. Section `feature_flags` SHALL NOT appear in tenant nav; tenant MAY show read-only mirror (Requirement 12).
7. Modules tab SHALL show license pool read-only; tenant SHALL NOT edit `allowed_modules`.
8. Tenant user navigating to `/platform/*` SHALL receive 403 + redirect to `/dashboard`.
9. Platform admin SHALL NOT use tenant Settings as primary home for infra operations.

### Platform-only removal map

| Former tenant item | Platform destination |
|--------------------|----------------------|
| `feature_flags` (write) | `/platform/feature-flags` |
| `/settings/system-health` (full) | `/platform/health` |
| License pool edit | `/platform/orgs/:id/license` |
| Global module queue | `/platform/module-requests` |
| Cross-org user search | `/platform/users` |

---

## Requirement 2: Settings Tiers & Progressive Access

**User Story:** Employee تەنها کەسی؛ manager read-only؛ admin write لە enabled modules.

### Acceptance Criteria

1. Settings page SHALL be accessible to ALL authenticated tenant users.
2. Nav SHALL filter by: tier AND module gate AND RBAC AND specialist scope (Requirement 10).
3. **Tier `personal`** — any authenticated user:
   - `profile`, `security`, `notifications`, `preferences`
   - `system` — client diagnostics only (version, connectivity, theme)
   - `modules` — read-only enabled list + pool transparency (Requirement 11)
4. **Tier `org_read`** — manager OR `settings.read` OR org admin (view):
   - Read-only org/module sections in permitted scope
   - Save bar hidden; fields disabled; banner shown
   - **IMMUTABLE:** even admin/owner SHALL NOT edit `org_read` sections (e.g. `activity`)
5. **Tier `org_write`** — admin/owner OR `settings.update` OR section-specific perm:
   - Edit within enabled modules and permission scope
6. **Tier `platform_only`** — never in tenant (Requirement 1).
7. WHEN `canView && !canEdit`, UI SHALL show `SettingsGateBanner`: "View only — contact your administrator."
8. WHEN user opens `?s=<key>` without access, redirect to first allowed section + i18n toast — never blank screen.
9. Hook `useSettingsAccess(sectionKey)` SHALL be authoritative for section-level checks.
10. Legacy `hasSettingsAccess` (whole-page admin gate) SHALL be deprecated and removed from Settings entry.

### Default role matrix (normative minimum)

| Role | Personal edit | Org general | Module settings view | Module settings edit | RBAC admin | Platform |
|------|---------------|-------------|----------------------|----------------------|------------|----------|
| viewer / user | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| sales / purchaser / inventory | ✅ | ❌ | own module read | ❌ | ❌ | ❌ |
| manager | ✅ | read | enabled modules read | ❌ | ❌ | ❌ |
| accountant | ✅ | ❌ | finance read | finance write* | ❌ | ❌ |
| admin / owner | ✅ | ✅ write | ✅ enabled | ✅ enabled | ✅ | ❌ |
| super_admin (normal) | via `/platform` | via `/platform` | via `/platform` | via `/platform` | via `/platform` | ✅ |
| super_admin (impersonating) | ✅ | ✅ write | ✅ enabled | ✅ enabled | ✅ | ❌ in tenant |

*Accountant write only where section permission matches: `settings.fiscal`, `taxes.update`, `accounts.budget`, `bank.write`.

### Default landing section

| User type | First visit default `?s=` |
|-----------|---------------------------|
| viewer / employee | `profile` |
| specialist (sales, etc.) | `profile` |
| manager | `profile` or last visited if allowed |
| admin / owner | last visited if allowed, else `organization` or `general` |
| impersonating super admin | same as admin |

---

## Requirement 3: Module-Gated Visibility

**User Story:** Org بە sales + inventory تەنها settings ـی ئەو modules دەبینێت.

### Acceptance Criteria

1. Nav SHALL use `isModuleEnabled(moduleKey, enabledModules)` — same semantics as `SideNav.tsx`.
2. WHEN `enabled_modules` empty/pending, show: personal + `modules` + `module_requests` (if permitted) — NO commerce/ops module settings.
3. WHEN module approved mid-session, store refresh SHALL update nav without full reload.
4. Disabled module deep link → redirect `?s=modules` + CTA "Request module access".
5. **ALWAYS_ON** (`accounting`, `banking`) SHALL unlock finance sections per catalog even if not in onboarding checkbox UI.
6. **Shared sections** (OR semantics) SHALL appear when ANY required module enabled:
   - `numbering`: sales \| purchase \| inventory \| hr
   - `workflows`: any commerce/ops module
   - `payment_methods`: sales \| pos
   - `marketing`: crm \| sales
   - `approvals`: sales \| purchase \| hr
7. Modules tab: each enabled module card → "Open settings" → `?s=<MODULE_PRIMARY_SECTION[key]>`.
8. Pool module not enabled → "Request access" → module request flow.
9. License expired (from `module-licensing-access`) → module settings hidden + API 403 `license_expired`.

### Module lifecycle states

| State | Sidebar | Settings module sections | API module routes |
|-------|---------|--------------------------|-------------------|
| Not in pool | hidden | hidden | 403 |
| In pool, not enabled | hidden | hidden (request CTA) | 403 |
| Enabled | visible | visible (if tier/perm) | allowed |
| ALWAYS_ON | visible (finance) | visible (if tier/perm) | allowed |
| License expired | hidden* | hidden | 403 |

*ALWAYS_ON may remain per license spec — follow `module-licensing-access` Requirement 1.4.

---

## Requirement 4: Full Section Catalog

Every `SectionKey` MUST declare: `tier`, `group`, `moduleGate?`, `permission?`, `bagCategory?`, `platform_only?`.

### 4.1 Personal (always)

| SectionKey | Tier | Module | Permission | Data scope |
|------------|------|--------|------------|------------|
| profile | personal | — | auth | own user doc |
| security | personal | — | auth | own 2FA/password |
| notifications | personal | — | auth | own prefs |
| preferences | personal | — | auth | theme/density/lang |

### 4.2 General & Organization (org_write)

| SectionKey | Tier | Module | Permission |
|------------|------|--------|------------|
| general | org_write | — | settings.update |
| appearance | org_write | — | settings.update |
| organization | org_write | — | org.manage |
| branches | org_write | — | settings.update |
| branding | org_write | — | settings.update |
| working_hours | org_write | — | settings.update |
| holidays | org_write | — | settings.update |

**Visibility:** admin/owner OR `settings.update`. NOT visible to specialist roles without explicit perm.

### 4.3 Users & Access (org_write)

| SectionKey | Permission | Notes |
|------------|------------|-------|
| users | rbac.manage | |
| roles | rbac.manage | |
| permissions | rbac.manage | |
| sso | settings.update | |
| portals | settings.update | |

**Visibility:** admin/owner OR `rbac.manage` (users/roles) OR `settings.update` (sso/portals).

### 4.4 Localization (org_write)

| SectionKey | Module Gate | Permission |
|------------|-------------|------------|
| localization | l10n_iq (optional) | settings.update |
| currencies | accounting (ALWAYS_ON) | settings.update |
| languages | — | settings.update |
| formats | — | settings.update |

### 4.5 Finance & Compliance

| SectionKey | Tier | Module Gate | Write Permission |
|------------|------|-------------|------------------|
| fiscal | org_write | accounting | settings.fiscal |
| budgets | org_write | accounting | accounts.budget |
| taxes | org_write | accounting | taxes.update |
| banking | org_write | banking | bank.write |
| payment_methods | org_write | sales OR pos | settings.update |
| einvoice | org_write | einvoice | settings.update |
| templates | org_write | sales | settings.update |
| reminders | org_write | sales | settings.update |

### 4.6 Commerce (module-gated, org_write default)

| SectionKey | ModuleKey | Bag category |
|------------|-----------|--------------|
| sales | sales | sales |
| crm | crm | crm |
| purchases | purchase | purchases |
| inventory | inventory | inventory |
| mrp | manufacturing | mrp |
| pos | pos | pos |
| ecommerce | ext.subscriptions | ecommerce |
| helpdesk | ext.helpdesk | helpdesk |

Default permission: `settings.update`. Specialist read via Requirement 10.

### 4.7 Operations

| SectionKey | Module Gate | Bag |
|------------|-------------|-----|
| hr | hr | hr |
| payroll | hr | payroll |
| projects | projects | projects |
| marketing | crm OR sales | marketing |

### 4.8 Automation & Integrations

| SectionKey | Module Gate | Permission |
|------------|-------------|------------|
| workflows | commerce OR ops (see design) | settings.update |
| approvals | sales OR purchase OR hr | settings.update |
| integrations | — | settings.update |
| webhooks | — | settings.update |
| api_tokens | — | settings.update |

Admin/owner only unless explicit perm — NOT for specialist roles.

### 4.9 Content & Messaging

| SectionKey | Module Gate | Permission |
|------------|-------------|------------|
| documents | ext.documents | settings.update |
| numbering | sales OR purchase OR inventory OR hr | settings.numbering |
| email | — | settings.update |
| sms_whatsapp | whatsapp OR ext.comms | settings.update |

### 4.10 System (tenant-scoped)

| SectionKey | Tier | Visibility | Notes |
|------------|------|------------|-------|
| modules | personal | all users | pool read-only, enabled list |
| module_requests | org_write | admin + settings.update | approve/request |
| backup | org_write | admin | org export only — NOT infra backup |
| activity | org_read | manager + settings.read + admin | **immutable log** |
| audit | org_write | admin | org audit policy |
| gdpr | org_write | admin | org privacy |
| mobile | org_write | ext.mobile module | |
| system | personal | all users | client diagnostics |

### 4.11 Platform-only (never tenant)

See Requirement 1 map.

---

## Requirement 5: Specialist Role Scoped Access

**User Story:** Sales staff تەنها sales settings ببینێت (read-only)، نەک general/org/webhooks.

### Acceptance Criteria

1. Roles `sales`, `purchaser`, `inventory`, `warehouse`, `pos_cashier` SHALL have **module-scoped read** for their primary module's settings sections ONLY when:
   - Module is enabled for org, AND
   - Role maps to module via `ROLE_MODULE_SCOPE` (see design), AND
   - User does NOT have broader `settings.read` / admin role
2. Specialist scoped read SHALL NOT grant:
   - general, organization, branding, users, roles, webhooks, api_tokens, integrations
   - other modules' settings (sales user SHALL NOT see CRM if both enabled)
3. Specialist SHALL NOT receive Save bar on org_write sections (view-only banner).
4. Accountant role SHALL see finance sections per Requirement 4.5 with write on matching perms.
5. Manager SHALL see all **enabled module** org_write sections as read-only (not RBAC/users unless `rbac.manage`).
6. Registry field `specialistRoles?: SettingsRole[]` OR central `ROLE_MODULE_SCOPE` map SHALL drive this — not ad-hoc in Settings.tsx.

---

## Requirement 6: Backend Enforcement

**User Story:** Frontend hide bypass via curl SHALL fail with structured 403.

### Acceptance Criteria

1. `GET/PUT /api/system/settings/{category}` SHALL call module gate when category is module-bound.
2. GET SHALL use `_require_settings_read(user, category)`:
   - personal categories: not via org bag API
   - org: `settings.read` OR manager OR admin OR section read perm + module
3. PUT SHALL use `_require_settings_write(user, category)` + `CATEGORY_WRITE_PERM` + module gate.
4. Responses:
   - Module disabled: `403 { "code": "module_disabled", "module": "sales" }`
   - Permission denied: `403 { "code": "permission_denied", "perm": "settings.fiscal" }`
   - License expired: `403 { "code": "license_expired" }`
   - org_read category attempted PUT: `403 { "code": "read_only_section" }` (activity log bags if exposed)
5. `POST/DELETE /api/feature-flags/*` SHALL require `is_platform_admin` — tenant org admin with `*` SHALL NOT pass.
6. Super admin tenant API without impersonation SHALL use vendor home org only — never cross-org settings.
7. Platform routes under `/api/platform/*` SHALL use `require_platform_admin` — never mounted on tenant UI.
8. On module approve, backend SHALL seed default bags for new categories if missing.
9. `CATEGORY_MODULE` in backend SHALL stay synchronized with frontend `moduleGate` / `bagCategory` (CI check recommended).

### Read vs write permission table

| Operation | Minimum check |
|-----------|---------------|
| GET org bag | module + (`settings.read` \| manager \| admin \| specialist scope read) |
| PUT org bag | module + (`settings.update` \| admin \| section write perm) |
| PUT activity/audit log | admin only; activity bag read-only |
| RBAC CRUD | `rbac.manage` |
| Module approve | `settings.update` + org admin |
| Personal prefs | `/api/users/me/*` — separate from org bags |

---

## Requirement 7: Navigation, Deep Links & Command Palette

### Acceptance Criteria

1. SideNav `/settings` link visible to ALL authenticated tenant users.
2. Settings sidebar hides empty groups after filtering.
3. Deep routes:
   - `/settings?s=<key>`
   - `/settings/numbering`
   - `/settings/module-requests`
4. Command palette (⌘K) SHALL only suggest accessible sections — same registry pipeline as nav.
5. Modules card "Open settings" uses `MODULE_PRIMARY_SECTION`.
6. Invalid `?s=` → first visible section.
7. Platform section `?s=feature_flags` → toast + redirect to `profile` or `modules`.
8. Bookmarks to removed routes SHALL redirect gracefully with i18n message.

---

## Requirement 8: UX, i18n & Empty States

### Acceptance Criteria

1. Zero module settings visible → empty state with onboarding CTA + link to `modules`.
2. Read-only mode → SaveBar hidden; `SettingsGateBanner` visible; form controls disabled.
3. All strings in `en.json`, `ku.json`, `ar.json` (project standard).
4. Help popover (`SectionHelpPopover`) for every visible section per `nav-settings-cleanup`.
5. Mobile drawer uses same filtered list as desktop sidebar.
6. RTL: nav groups, banners, CTAs mirror correctly.
7. Loading states: section skeleton while bag fetches; no flash of forbidden content before guard redirect.
8. Toast messages for: `module_disabled`, `permission_denied`, `platform_only`, `view_only`.

### i18n key catalog (minimum)

| Key | Use |
|-----|-----|
| `settings.gate.view_only` | Read-only banner |
| `settings.gate.module_disabled` | Module off redirect |
| `settings.gate.platform_only` | Platform section attempt |
| `settings.gate.permission_denied` | RBAC fail |
| `settings.empty_modules_title` | No modules empty state |
| `settings.empty_modules_body` | Onboarding CTA |
| `settings.modules.open_settings` | Card CTA |
| `settings.modules.request_access` | Pool not enabled |

---

## Requirement 9: Feature Flag Read-Only Mirror (Tenant)

**User Story:** Org admin بزانێت feature X چالاکە بەڵام ناتوانێت rollout بگۆڕێت.

### Acceptance Criteria

1. Tenant SHALL NOT expose rollout percentage editor or POST/DELETE flag endpoints.
2. Optional section or panel under `modules` or `system` MAY list org-effective flags as read-only badges (source: GET mirror API).
3. Mirror API SHALL NOT accept writes from tenant roles.
4. "Contact vendor" link for flag change requests → support email or platform ticket (future).

---

## Requirement 10: Wildcard Permission & Platform Isolation

### Acceptance Criteria

1. JWT permission `*` in tenant context SHALL grant org-scoped admin capabilities ONLY.
2. `*` SHALL NOT grant:
   - `POST /api/feature-flags`
   - `PUT /api/platform/orgs/*/license`
   - Cross-org reads
3. Backend platform endpoints SHALL check `is_platform_admin` independently of wildcard perms.
4. Frontend `hasPerm` for tenant SHALL NOT treat `*` as platform.admin.

---

## Requirement 11: Security, Audit & Personal Data

### Acceptance Criteria

1. All org settings writes SHALL audit-log (actor, org, category, diff summary).
2. Personal settings SHALL NOT expose other users' PII.
3. API tokens / webhooks SHALL mask secrets after creation (show once).
4. Standard users SHALL NOT invoke `PUT /api/rbac/roles` even via direct API.
5. Settings bags SHALL be org-scoped — query always includes `user.org_id`.
6. Impersonation writes SHALL log `impersonated_by` in audit trail.

---

## Requirement 12: Server-Side Visibility Validation (Recommended)

### Acceptance Criteria

1. `GET /api/onboarding/settings-sections` SHALL return computed list: `{ key, can_view, can_edit, module?, deny_reason? }`.
2. Frontend MAY validate nav against server list on mount (tamper-resistant).
3. Mismatch (client shows, server denies) SHALL log warning in dev; server always wins on save.

---

## Requirement 13: Refactor & Maintainability

### Acceptance Criteria

1. Package `frontend/src/settings/` structure per design.md.
2. `Settings.tsx` SHALL become thin re-export of `SettingsShell` after Phase E.
3. Registry single source: nav, guards, command palette, tests, docs table.
4. Unit tests: registry matrix ≥ 80% branch coverage.
5. CI script (optional): diff frontend `bagCategory` vs backend `CATEGORY_MODULE`.
6. Remove `VITE_TENANT_SETTINGS_V2` after v2 stable — single code path.

---

## Requirement 14: Concrete QA Scenarios (Acceptance)

### Scenario A — Retail org (POS + Sales + Inventory)

**Enabled:** accounting, banking, sales, inventory, pos  
**Roles tested:** viewer, cashier, manager, admin

| Section | viewer | cashier | manager | admin |
|---------|--------|---------|---------|-------|
| profile | edit | edit | edit | edit |
| sales | hidden | read | read | edit |
| pos | hidden | read | read | edit |
| crm | hidden | hidden | hidden | hidden |
| fiscal | hidden | hidden | read | edit |
| users | hidden | hidden | hidden | edit |
| feature_flags | hidden | hidden | hidden | hidden |

### Scenario B — Trading org (Sales + Purchase + CRM)

**Enabled:** accounting, banking, sales, purchase, inventory, crm

| Section | sales role | purchaser | admin |
|---------|------------|-----------|-------|
| sales | read | hidden | edit |
| purchases | hidden | read | edit |
| crm | hidden | hidden | edit |
| numbering | hidden | hidden | edit |

### Scenario C — Empty modules (pending approval)

**Enabled:** []  
**All roles see:** profile, security, notifications, preferences, system, modules  
**Admin also sees:** module_requests  
**Nobody sees:** sales, crm, fiscal (except ALWAYS_ON finance for admin with accounting always on)

### Scenario D — Platform admin

| Action | Expected |
|--------|----------|
| Login | `/platform` |
| Tenant `/settings` direct | redirect or 403 unless impersonating |
| Impersonate org admin | full tenant settings minus platform sections |
| POST feature flag | success only from platform API |

---

## Requirement 15: Out of Scope (v2)

- Per-field ACL inside a section (v3)
- Custom settings for every `ext.*` vertical (stub + link to `/ext/<slug>/settings` acceptable)
- Moving org backup to cold storage (platform ops)
- Self-service license upgrade (vendor sales flow)
- Multi-org user settings aggregation

---

## Requirement 16: Definition of Done (v2 complete)

- [ ] All Requirement 1–15 acceptance criteria verified by automated tests where feasible
- [ ] Scenario A–D pass manual or E2E checklist
- [ ] Phase E section extraction complete; `Settings.tsx` < 200 lines
- [ ] org_read immutability enforced in `useSettingsAccess`
- [ ] Specialist scoped read implemented
- [ ] Backend + frontend registry sync documented
- [ ] ku/en/ar i18n complete for gate UX
- [ ] `npm run build` + unit + E2E green
- [ ] CHANGELOG + SETTINGS.md updated for v2
