# Requirements: Module Licensing & Access Requests (Modular ERP)

## Introduction

Vendor (platform operator) دەبێت بتوانێت بۆ هەر کڕیارێک (org) دیاری بکات چ module ـەکان دەتوانرێت بەکاربهێنرێت — بۆ نموونە تەنیا **POS + Sales + Purchase + Inventory + Banking (قەرز)**. ئێستا `enabled_modules` لە onboarding هەیە بەڵام **self-service** ـە (بێ approval) و **backend enforce** نییە. ئەم spec ـە workflow ـی **request → admin approve → show modules** زیاد دەکات.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Module** | Logical app area keyed by `ModuleKey` (`sales`, `pos`, `inventory`, …) — see `frontend/src/onboarding/industries.ts` |
| **License pool** | Max modules vendor allows for an org (`allowed_modules`) |
| **Enabled modules** | Active modules after approval (`enabled_modules`) — drives sidebar + API |
| **Bundle** | Named preset e.g. `pos_retail`, `trading`, `full_core` mapping to module keys |
| **Module request** | User-submitted list of desired modules pending admin approval |
| **Platform admin** | Vendor operator managing org licenses (super-tenant) |
| **Org admin** | Customer admin approving requests within license pool |

---

## Requirement 1: Org License (Vendor Control)

1. EVERY organization SHALL have `license` metadata: `{ tier, allowed_modules[], bundle_id?, expires_at?, max_users? }`.
2. THE Platform admin SHALL set license via `PUT /api/platform/orgs/{org_id}/license` (requires `platform.manage`).
3. WHEN `allowed_modules` is set, THE onboarding UI SHALL only show checkboxes for modules in that pool (+ `ALWAYS_ON`).
4. WHEN license expires, THE Backend SHALL block mutating API on non-always-on modules with HTTP 403 `{code: "license_expired"}`.
5. Bundles SHALL ship as defaults:

| Bundle ID | Modules (minimum) |
|-----------|-------------------|
| `pos_only` | accounting, banking, sales, inventory, pos |
| `trading` | accounting, banking, sales, purchase, inventory, crm |
| `full_core` | all non-`ext.*` production_core modules |
| `custom` | explicit `allowed_modules` list |

---

## Requirement 2: Module Access Request Workflow

1. DURING onboarding (step 4), THE user SHALL **request** modules — not directly enable them — when org policy `require_module_approval=true` (default for new orgs).
2. THE user SHALL submit `POST /api/onboarding/module-requests` with `{ requested_modules[], note? }`.
3. THE request SHALL start in status `pending`.
4. UNTIL at least one request is approved, THE org's `enabled_modules` SHALL remain empty or `pending_only` subset (dashboard + settings + onboarding only).
5. THE Org admin (role `admin|owner`) SHALL list pending requests via `GET /api/onboarding/module-requests?status=pending`.
6. THE Org admin SHALL approve via `POST /api/onboarding/module-requests/{id}/approve` with optional `{ approved_modules[] }` (subset of requested ∩ allowed).
7. THE Org admin SHALL reject via `POST /api/onboarding/module-requests/{id}/reject` with `{ reason }`.
8. ON approve, THE system SHALL merge `approved_modules` into `onboarding_preferences.enabled_modules`, set `completed=true`, and audit-log the action.
9. THE requester SHALL receive in-app notification (chatter/activity or simple toast on next login) when status changes.

---

## Requirement 3: UI Visibility & Routing

1. THE sidebar (`SideNav`) SHALL continue filtering by `enabled_modules` (existing).
2. THE `ModuleGuard` SHALL block direct URL access to disabled modules (existing).
3. WHEN user has pending request, THE onboarding wizard SHALL show status banner: "چاوەڕێی پەسەندکردنی ئادمین".
4. THE Settings page SHALL expose for org admin: **Module Requests** queue + current enabled list (read-only for non-admin).
5. THE Platform admin UI (Settings → Platform or `/admin/orgs`) SHALL expose license editor per org.

---

## Requirement 4: Backend API Enforcement

1. THE Backend SHALL add `require_module("sales")` dependency on routers: `invoices`, `quotes`, `sales_orders`, `credit_notes`, etc.
2. THE mapping SHALL live in `backend/app/services/module_registry.py` (module → router prefixes).
3. WHEN module disabled, THE API SHALL return HTTP 403 `{code: "module_disabled", module: "sales"}` — not 404.
4. `ALWAYS_ON` modules (`accounting`, `banking`) SHALL never be blocked.
5. RBAC (`require_perm`) AND module gate SHALL both apply (AND logic).

---

## Requirement 5: Roles & Permissions

New permission codes:

| Code | Who |
|------|-----|
| `platform.manage` | Vendor — set org licenses |
| `modules.request` | Any authenticated user |
| `modules.approve` | Org admin/owner |
| `modules.view` | See enabled list |

---

## Requirement 6: Data Model (Firestore)

| Collection | Key fields |
|------------|------------|
| `organizations` | `license: { tier, allowed_modules, bundle_id, expires_at }` |
| `onboarding_preferences` | `enabled_modules`, `completed`, `require_module_approval` |
| `module_access_requests` | `org_id`, `user_id`, `requested_modules`, `approved_modules`, `status`, `reviewed_by`, `note`, `reason` |

---

## Requirement 7: Migration & Legacy

1. EXISTING orgs with `enabled_modules` populated AND `completed=true` SHALL keep working (no re-approval).
2. NEW orgs created after launch SHALL default `require_module_approval=true`.
3. WHEN `enabled_modules` is `null` (legacy), behavior unchanged: show all modules until configured.

---

## Acceptance Criteria (DoD)

- Vendor can set POS-only license; user cannot enable manufacturing via UI or API
- User submits module request in onboarding; admin approves; sidebar shows only approved modules
- Direct API call to `/api/invoices` returns 403 when `sales` not enabled
- Audit log records approve/reject with actor + module list
- Tests: request lifecycle, license pool cap, bundle preset, ModuleGuard integration
