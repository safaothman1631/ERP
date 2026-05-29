# Requirements: Super Admin Platform Console

## Introduction

Super Admin (vendor / platform operator) **نابێت** لە هەمان UI ـی tenant (کڕیار) بەکاربهێنێت. ئەم spec ـە console ـێکی تەواو جیا دەخوایە — **لۆجیک، routes، shell، permissions، و دیزاینی Glass Morphism** — کە تەنها بۆ `super_admin` / `is_platform_admin` دەستڕاگەیشتنی هەیە.

**ئامانج:** ERP ـی multi-tenant بە vendor panel ـی پرۆفیشناڵ کە org، license، users، health، audit، و support لە یەک شوێن بەڕێوە دەبرێت.

**پەیوەندی بە spec ـەکانی تر:**
- `module-licensing-access` — license pool + module requests (platform admin بەشێکە)
- `ui-redesign-modern` — glass tokens، RTL، accessibility (platform theme extend دەکات)
- `system-health-backup` — health/backup panels لە platform console
- `phase-2-security-rbac` — RBAC، audit، impersonation policy

---

## Glossary

| Term | Meaning |
|------|---------|
| **Super Admin** | User with `role=super_admin` OR `is_platform_admin=true` + `platform.manage` |
| **Tenant User** | Any user scoped to one org — admin, manager, viewer, … |
| **Platform Console** | Separate SPA shell at `/platform/*` — not `AppShell` |
| **Vendor Org** | Org marked `is_platform_org=true` — home org of super admin |
| **Impersonation** | Super admin views/acts as tenant user with audit trail |
| **Platform scope** | Cross-org operations; never implicit `user.org_id` only |

---

## Requirement 1: Complete UI Separation

1. WHEN user logs in with `role=super_admin` OR `is_platform_admin=true`, THE system SHALL redirect to `/platform` (not `/dashboard`).
2. THE Platform Console SHALL use **`PlatformShell`** — NOT `AppShell`, NOT tenant `SideNav`.
3. TENANT routes (`/dashboard`, `/invoices`, …) SHALL remain inaccessible from Platform Shell navigation (no ERP sidebar).
4. WHEN super admin chooses **"Enter organization"**, THE system SHALL open tenant `AppShell` in **impersonation mode** with visible banner: "Viewing as Org X — Exit".
5. TENANT users SHALL receive HTTP 403 + redirect to `/dashboard` if they navigate to `/platform/*`.
6. THE login page SHALL NOT show platform links; role-based redirect after auth only.
7. Platform UI SHALL have its own layout modes, favorites, and command palette (`⌘K` platform-scoped).

---

## Requirement 2: Authentication & Session

1. JWT SHALL include: `role`, `is_platform_admin`, `org_id` (vendor home org).
2. `GET /api/auth/me` SHALL return platform flags for frontend routing.
3. Platform API routes SHALL use `require_platform_admin` (existing) extended to `require_super_admin` for destructive ops.
4. `PLATFORM_ADMIN_USER_IDS` env allowlist SHALL apply in production (existing).
5. Super admin logout SHALL clear impersonation session if active.
6. Session SHALL support MFA policy (inherit from auth spec) — platform login stricter in production.

---

## Requirement 3: Platform Dashboard (Home)

1. THE `/platform` dashboard SHALL show KPI cards:
   - Total organizations (active / suspended)
   - Total users (active / locked)
   - Pending module requests (global count)
   - Licenses expiring in 30 days
   - API error rate (24h) if metrics available
   - Last backup status
2. Dashboard SHALL show recent platform audit events (last 20).
3. Dashboard SHALL show quick actions: Create org, Review requests, System health, License bundles.
4. All widgets SHALL support ku / en / ar + RTL.

---

## Requirement 4: Organization Management

1. Super admin SHALL list all orgs: `GET /api/platform/orgs` with search, filter (tier, status, bundle), pagination.
2. Super admin SHALL view org detail: license, enabled modules, user count, created_at, platform_tier, flags.
3. Super admin SHALL create org: name, owner email, initial bundle, `require_module_approval` default.
4. Super admin SHALL suspend org: blocks all tenant API except auth/logout with `{code: "org_suspended"}`.
5. Super admin SHALL unsuspend org.
6. Super admin SHALL delete org (soft-delete v1): mark `deleted_at`, hide from list, 90-day retention.
7. Org detail SHALL link to license editor, users list, module requests, audit log filtered by org.

---

## Requirement 5: License & Module Provisioning (extend existing)

1. REUSE `PUT /api/platform/orgs/{id}/license` — extend UI in Platform Console (not buried in tenant Settings).
2. Platform SHALL show bundle presets: `pos_only`, `trading`, `full_core`, `custom` (existing `BUNDLES`).
3. Platform SHALL edit: `allowed_modules`, `expires_at`, `max_users`, `tier`.
4. Platform SHALL preview effective module list before save.
5. Platform SHALL show diff vs current license on save confirmation.
6. All license changes SHALL audit-log with actor + diff.

---

## Requirement 6: Global Module Request Queue

1. Super admin SHALL view ALL pending module requests across orgs: `GET /api/platform/module-requests?status=pending`.
2. Super admin MAY approve/reject on behalf of org (when org has no admin) OR override org admin decision.
3. Queue SHALL show: org name, requester, modules, date, industry, license pool cap.
4. Bulk approve/reject with reason (optional v1.1).
5. Notification to requester on status change (in-app minimum).

---

## Requirement 7: Cross-Org User Management

1. Super admin SHALL search users globally: email, name, org, role, status.
2. Super admin SHALL view user detail: orgs, roles, last login, locked status, MFA status.
3. Super admin SHALL: unlock account, force password reset, deactivate user, promote/demote role (within org).
4. Super admin SHALL NOT read tenant passwords or SECRET_KEY.
5. Destructive actions SHALL require confirmation modal + audit log.

---

## Requirement 8: Impersonation (Support Mode)

1. Super admin SHALL impersonate tenant user: `POST /api/platform/impersonate` `{ target_user_id }`.
2. Impersonation SHALL issue short-lived token (max 1h) with claim `impersonated_by`.
3. ALL actions during impersonation SHALL audit-log with both actor IDs.
4. UI SHALL show persistent top banner with **Exit impersonation** button.
5. Impersonation SHALL be disabled in production unless `PLATFORM_IMPERSONATION_ENABLED=true`.

---

## Requirement 9: System Health & Operations

1. Platform SHALL embed System Health page (from `system-health-backup` spec): API, Firestore, Firebase Auth, disk, queue.
2. Platform SHALL show backup history + trigger manual backup (if permitted).
3. Platform SHALL link to `/api/metrics` summary (request counts, p95 latency).
4. Platform SHALL show environment info (read-only): version, region, `ENVIRONMENT`, feature flags — no secrets.
5. Platform SHALL expose job queue status (mail, automation) if available.

---

## Requirement 10: Audit & Security

1. Platform SHALL provide global audit log viewer: filter by org, user, action, date range.
2. Platform SHALL show security events: failed logins spike, locked accounts, revoked tokens.
3. Platform SHALL allow export audit CSV (max 10k rows per export).
4. Platform actions SHALL use dedicated audit actions prefix: `platform.*`.
5. Rate limit platform APIs stricter than tenant APIs (e.g. 30/min per user).

---

## Requirement 11: Feature Flags & Announcements

1. Platform SHALL manage global feature flags: `{ key, enabled, rollout_percent?, org_allowlist? }`.
2. Tenant app SHALL read flags via `GET /api/system/feature-flags` (cached 60s).
3. Platform SHALL publish maintenance announcements shown to all tenants (banner in AppShell).
4. Announcements SHALL support schedule: start_at, end_at, severity (info/warning/critical).

---

## Requirement 12: Design — Platform Glass Morphism

1. Platform Console SHALL use **distinct visual identity** from tenant ERP:
   - Dark-first glass theme (light mode optional)
   - Accent: indigo/violet gradient (NOT tenant blue `#1F6FEB` primary)
   - Ambient orbs + grid overlay on shell background
   - Glass panels: `backdrop-filter: blur(40px) saturate(180%)`
2. Platform SHALL reuse token architecture from `theme/tokens.ts` via **`theme/platformTokens.ts`** extension.
3. Platform components SHALL live under `frontend/src/platform/` — not mixed in `pages/`.
4. Platform SHALL meet WCAG AA, Lighthouse a11y ≥ 95 on platform routes.
5. Platform SHALL be fully responsive: desktop command center + mobile stacked layout.
6. Platform SHALL support ku (default) / en / ar with RTL-native layout.

---

## Requirement 13: Backend Architecture Separation

1. Platform routes SHALL mount under `/api/platform/*` only (extend `platform.py` → `platform/` package).
2. Platform services SHALL live in `backend/app/services/platform/` — no tenant logic mixed in.
3. Platform queries SHALL explicitly scope or intentionally be global — never leak via accidental `user.org_id` filter on cross-org lists.
4. Super admin calling tenant APIs SHALL either impersonate OR use platform endpoints — not bypass gates silently.
5. Module gate (`require_module`) SHALL NOT apply to `/api/platform/*` routes.

---

## Requirement 14: Testing & DoD

1. Backend tests: `test_platform_orgs.py`, `test_platform_impersonate.py`, `test_platform_audit.py`.
2. Frontend tests: PlatformShell render, route guard, super_admin redirect on login.
3. E2E: `e2e/platform/super-admin.spec.ts` — login → dashboard → edit license → verify tenant 403 on disabled module.
4. Security test: tenant admin cannot access `/api/platform/orgs`.
5. Visual regression: platform dashboard snapshot (optional).

**Definition of Done:**
- Super admin never lands in tenant AppShell unless impersonating
- Full org CRUD + license + global module queue works
- Glass platform UI shipped with ku/en/ar
- Audit trail for all platform mutations
- Documented in `OPERATIONS_RUNBOOK.md`

---

## Out of Scope (v1)

- Multi-vendor SaaS billing/invoicing
- Custom domain per org
- White-label tenant branding editor
- Full PostgreSQL migration

---

## Non-Functional Requirements

| Area | Target |
|------|--------|
| Platform dashboard LCP | ≤ 2.5s |
| Platform API p95 | ≤ 400ms |
| Bundle size (platform chunk) | lazy-loaded, ≤ 150KB gzipped |
| Uptime monitoring | integrate with existing metrics |
