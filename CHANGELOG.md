# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## Content Registry Entry Pattern

> Specified by `system-wide-ux-overhaul` Requirement 16.5: every release that adds or
> removes a `Translation_Key` (i18n key in `frontend/src/locales/en.json` /
> `ku.json`) or a Help_Registry `sectionId` (declared in
> `frontend/src/help/sectionIds.ts` and used by `useHelp(sectionId)`) **must** record
> the change in this file under the matching release section.

Every release section below uses the standard Keep a Changelog groups (`Added`,
`Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`) **plus** two umbrella-spec
groups for content-registry changes:

### `### i18n Keys`

Used to flag every new or removed `Translation_Key`. List both locales together —
keys must land in `en.json` and `ku.json` simultaneously (R11.2, P1).

```markdown
### i18n Keys

#### Added
- `addGate.atLeastOneRequired` — empty-state CTA when a Section's Add action is mandatory.
- `helpIcon.ariaLabel` — accessible label template for the universal Help_Icon.
- `help.unavailable.message` — always-bundled inline fallback when the lazy
  Help_Registry chunk fails to load (R6.1, R8.4, R15.5).

#### Removed
- `legacy.invoices.title` — replaced by `sales.invoices.title`.

#### Renamed
- `users` → `auth.users`  (old key removed; both locales updated)
```

### `### Help Registry (sectionId)`

Used to flag every new or removed `sectionId`. A Settings-area `sectionId` change
must be cross-referenced to the owning sibling spec (`settings-documentation`,
`nav-settings-cleanup`) per R7.4 / R17.1.

```markdown
### Help Registry (sectionId)

#### Added
- `settings.currencies` — Help_Content authored in `settings-documentation`.
- `sales.invoices.lineItems` — line-item editor; `relatesTo` → `sales.invoices`.

#### Removed
- `dashboard.legacyKpis` — superseded by `dashboard.kpis`.

#### Renamed
- `inventory.stock` → `inventory.onHand`  (old `sectionId` removed; both `useHelp`
  call sites and registry entries updated)
```

### Required entries per release

A release that touches any of the following **must** include the matching group(s):

| Change                                                  | Required group(s)                         |
| ------------------------------------------------------- | ----------------------------------------- |
| Added/removed key in `en.json` or `ku.json`             | `### i18n Keys` → `Added` / `Removed`     |
| Renamed Translation_Key                                 | `### i18n Keys` → `Renamed`               |
| Added/removed entry in `frontend/src/help/registry.ts`  | `### Help Registry (sectionId)`           |
| Added/removed `sectionId` in `sectionIds.ts`            | `### Help Registry (sectionId)`           |
| Added Settings sub-section in `SectionDef`              | `### Help Registry (sectionId)` (R7.1, R7.2) |

CI gates that observe this pattern:

- `i18n-coverage` (P1, R13.2) — fails when `en.json` ⊕ `ku.json` is non-empty or any
  value is `""` / `null` / `"TODO"` / `"[missing]"`.
- `help-registry-coverage` (P3, R7.2) — fails when a Settings `sectionId` exists in
  the route registry but is missing from the Help_Registry, or a `useHelp(id)` call
  references an `id` not in `SECTION_IDS`.
- `release-readiness` (R18.3, R18.4) — blocks release when Help_Icon, AddGate, or
  i18n parity coverage falls below 100 % on any route.

---

## [Unreleased]

### Added
- Tenant user settings v2: module-gated settings nav, role-limited sections, platform-only
  feature flags / system health removed from tenant `/settings`. See
  `.kiro/specs/tenant-user-settings/`.
- `VITE_TENANT_SETTINGS_V2` feature flag (default `true` in `.env.example`).

### Changed
- Settings page open to all authenticated users; personal sections for standard users;
  org/module sections filtered by `enabled_modules` and RBAC.
- Command palette includes visible settings sections from the settings registry.
- `/settings/system-health` redirects tenant users; full dashboard at `/platform/health`.

### i18n Keys

#### Added
- `settings.gate.*` — view-only, module disabled, platform-only gate messages.
- `settings.open_module_settings`, `settings.request_module_access`, `license_pool_readonly`.
- `settings.empty_modules_title`, `settings.empty_modules_desc`.

#### Removed
- _None yet._

---

## [Unreleased] — Role-Adaptive Glass UX

### Added
- Role-adaptive dashboard homes (12 personas), `DashboardRouter`, `RoleHomeHero`, `RoleIdentityChip`, `RoleWelcomeSheet`.
- Glass component library: `GlassDialog`, `GlassDrawer`, `GlassPopover`, `GlassConfirm`, `GlassSaveButton`.
- Nav profiles (`navProfiles.ts`) filtering SideNav and Command palette by role.
- `GET /api/rbac/me/summary` — role UX persona hints for the signed-in user.
- Global modal/drawer glass CSS; `npm run audit:glass-modals`.
- E2E: `role-ux.spec.ts`, `role-ux-visual.spec.ts`.
- Docs: `docs/ux/ROLES.md`, `docs/ux/GLASS.md`.
- UIGallery `RolePersonaGallery` section.

### Changed
- TopBar: role chip, quick actions, role-accent primary CTA.
- Settings SaveBar: glass strip + morph save button.
- Post-login redirect uses `getPostLoginPath()` per role.
- Platform top bar: Platform Admin identity chip.

### i18n Keys

#### Added
- `roles.*`, `persona.*`, `role.home.*`, `role.welcome.*`, `roles.platform_admin` — en, ku, ar (core).

### Help Registry (sectionId)

#### Added
- _None._

#### Removed
- _None yet._

