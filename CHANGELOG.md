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
- _Pending_ — system-wide UX overhaul (`useViewport`, `useHelp`, `useAddGate`,
  `Responsive*` wrappers). See `.kiro/specs/system-wide-ux-overhaul/`.

### i18n Keys

#### Added
- _None yet._

#### Removed
- _None yet._

### Help Registry (sectionId)

#### Added
- _None yet._

#### Removed
- _None yet._
