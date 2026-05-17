# Implementation Plan: nav-settings-cleanup

## Overview

Clean up the navigation sidebar (`navigation.tsx`) and Settings page (`Settings.tsx`) by eliminating duplicate route sections, adding full Kurdish/English translations, building a reusable `SectionHelpPopover` component, adding an "Add …" escape-hatch to empty `<Select>` components, and wiring help popovers into every settings section. All work is TypeScript/React + Ant Design; no backend changes are required.

Implementation order: locale files first (everything else depends on translation keys), then the `NavLeaf` interface extension, then navigation deduplication and CSS fix, then the two new utility/component files, then Settings page wiring, and finally property-based and unit tests.

---

## Tasks

- [x] 1. Extend locale files with all missing translation keys
  - [x] 1.1 Add missing nav section and zone keys to `en.json`
    - Add `nav.ext_ops`, `nav.ext_ops_blurb`, `nav.ext_platform`, `nav.ext_platform_blurb`, `nav.ext_vertical`, `nav.ext_vertical_blurb`, `nav.admin_config`, `nav.admin_config_blurb`, `nav.setup_blurb`, `nav.zone_core_commerce`, `nav.zone_core_commerce_blurb`, `nav.zone_operations`, `nav.zone_operations_blurb`, `nav.zone_people`, `nav.zone_people_blurb`, `nav.zone_finance_control`, `nav.zone_finance_control_blurb` with English values from the design table
    - _Requirements: 3.6, 3.7, 8.2_

  - [x] 1.2 Add missing nav section and zone keys to `ku.json`
    - Add the same 17 keys as 1.1 with Kurdish values from the design table
    - _Requirements: 3.3, 3.7, 8.1_

  - [x] 1.3 Add missing nav item (module) label keys to `en.json`
    - Add `mod_quality`, `mod_maintenance`, `mod_plm`, `mod_studio`, `mod_rental`, `mod_ai`, `mod_mobile`, `mod_iot`, `mod_helpdesk_ext`, `mod_fs_ext`, `mod_docs_ext`, `mod_kb_ext`, `mod_hr_ext`, `mod_hotel`, `mod_restaurant`, `mod_construction`, `mod_real_estate`, `mod_education`, `mod_logistics`, `mod_agriculture`, `mod_ngo`, `mod_government` with English values
    - _Requirements: 3.6, 3.7_

  - [x] 1.4 Add missing nav item (module) label keys to `ku.json`
    - Add the same 23 keys as 1.3 with Kurdish values from the design table
    - _Requirements: 3.4, 3.7_

  - [x] 1.5 Add `settings.help.*` keys for all settings sections to `en.json`
    - For each settings section key (e.g. `fiscal`, `currencies`, `budgets`, `taxes`, `warehouses`, `units`, `categories`, `brands`, `pricelists`, `payment_methods`, `payment_terms`, `accounts`, `journals`, `cost_centers`, `analytic`, `numbering`, `automation`, `audit`, `jobs`, `users`, `roles`, `company`, `branches`, `localization`, `email`, `sms`, `notifications`, `integrations`, `appearance`, `security`, `backup`, `studio`, `docs_hub`, `ui_gallery`), add `.what`, `.why`, `.step_1` … `.step_N` keys (2–7 steps each)
    - _Requirements: 7.2, 7.7_

  - [x] 1.6 Add `settings.help.*` keys for all settings sections to `ku.json`
    - Mirror all keys added in 1.5 with Kurdish translations
    - _Requirements: 7.3, 7.7_

  - [x] 1.7 Add `add_entity`, `help` / `یارمەتی` utility keys to both locale files
    - `en.json`: `"help": "Help"`, `"add_entity": "Add {{entity}}"`
    - `ku.json`: `"help": "یارمەتی"`, `"add_entity": "زیادکردنی {{entity}}"`
    - _Requirements: 5.2, 7.5_

- [x] 2. Extend `NavLeaf` interface and fix mixed-language keywords in `navigation.tsx`
  - [x] 2.1 Add `keywordsKu?: string[]` field to the `NavLeaf` interface
    - Edit `src/layouts/navigation.tsx` (or the shared types file if the interface lives there)
    - _Requirements: 8.6, 8.7_

  - [x] 2.2 Fix the three mixed-language items in the `setup` section
    - Change `t('users', 'بەکارهێنەران')` fallback to `t('users', 'Users')`
    - Move Kurdish keywords `['یارمەتی', 'دۆکیومێنت']` from `docs_hub` item's `keywords[]` to `keywordsKu: ['یارمەتی', 'دۆکیومێنت']`
    - Move Kurdish keywords `['ڕووکار', 'گاڵەری']` from `ui_gallery` item's `keywords[]` to `keywordsKu: ['ڕووکار', 'گاڵەری']`
    - _Requirements: 8.5, 8.6, 8.7_

- [x] 3. Deduplicate navigation sections in `navigation.tsx`
  - [x] 3.1 Remove the standalone `quality` section; merge its 5 routes into `ext-ops`
    - Add NavLeafs for `/quality`, `/quality/plans`, `/quality/checks`, `/quality/ncr`, `/quality/capa` to the `ext-ops` section using `t('mod_quality', …)` labels
    - Delete the standalone `quality` section object
    - _Requirements: 1.2, 4.3_

  - [x] 3.2 Remove the standalone `ai-assist` section; merge its 5 routes into `ext-platform`
    - Replace the `/ext/ai` single item in `ext-platform` with the full `/ai`, `/ai/anomalies`, `/ai/suggestions`, `/ai/ocr`, `/ai/predictions` subtree
    - Delete the standalone `ai-assist` section object
    - Rename `ext-platform` label key to `nav.ext_platform` ("Platform & AI")
    - _Requirements: 1.3, 4.4_

  - [x] 3.3 Remove the standalone `admin-config` section; merge its unique items into `setup`
    - Add `/settings/numbering`, `/automation-rules`, `/audit-log-viewer`, `/admin/job-runs`, `/studio` to the `setup` section (skip `/settings` — already present)
    - Delete the standalone `admin-config` section object
    - _Requirements: 1.4, 4.6_

  - [x] 3.4 Remove `/wave-a/helpdesk` from `ext-engagement`
    - Delete the `/wave-a/helpdesk` NavLeaf from the `ext-engagement` items array
    - _Requirements: 1.5_

  - [x] 3.5 Remove `/wave-a/field-service` from `ext-engagement`
    - Delete the `/wave-a/field-service` NavLeaf from the `ext-engagement` items array
    - _Requirements: 1.6, 4.2_

  - [x] 3.6 Remove `/ext/hotel` from `ext-vertical`; remove `/ext/restaurant` from `ext-vertical`
    - Delete the `/ext/hotel` and `/ext/restaurant` NavLeafs from the `ext-vertical` items array
    - _Requirements: 1.7, 1.8, 4.5_

  - [x] 3.7 Update all section label `t()` calls to use the new locale keys
    - Replace any hardcoded English fallback strings in section labels with the new `nav.*` keys added in task 1
    - Ensure `ext-ops`, `ext-platform`, `ext-vertical`, `admin-config` (now removed), and `setup` all use `t('nav.<key>')` with no English fallback string
    - _Requirements: 3.1, 3.6, 8.1, 8.2_

  - [x] 3.8 Add `console.warn` duplicate-route guard to `flattenRoutes()`
    - In development mode (`process.env.NODE_ENV === 'development'`), emit `console.warn('[nav] duplicate route: <path>')` for any key seen more than once
    - _Requirements: 1.10_

- [x] 4. Fix section label CSS decoration
  - [x] 4.1 Add CSS override to remove underline/border-bottom from sidebar section group titles
    - Locate the global stylesheet or sidebar CSS module
    - Add `.ant-menu-item-group-title, .nav-section-label { text-decoration: none !important; border-bottom: none !important; }`
    - _Requirements: 2.1, 2.4_

- [x] 5. Checkpoint — navigation layer complete
  - Run `vitest --run` and confirm no existing nav-related tests regress; verify `flattenRoutes()` emits no duplicate warnings in dev mode.

- [x] 6. Build the `SectionHelpPopover` component
  - [x] 6.1 Create `src/components/ui/SectionHelpPopover.tsx`
    - Define `SectionHelpPopoverProps { what: string; why: string; steps: string[] }`
    - Render an Ant Design `<Popover>` wrapping `<InfoCircleOutlined />` with `trigger="click"`
    - Set `aria-label={t('help')}` on the icon element
    - Render popover content as: bold "What" sentence, bold "Why" sentence, then an `<ol>` of steps
    - _Requirements: 7.1, 7.4, 7.5, 7.6_

  - [x] 6.2 Write unit tests for `SectionHelpPopover`
    - Test that the icon renders with correct `aria-label` in both `en` and `ku`
    - Test that clicking the icon opens the popover
    - Test that pressing Escape closes the popover
    - _Requirements: 7.4, 7.5, 7.6_

- [x] 7. Build the `buildAddOption` / `buildEffectiveOptions` utility
  - [x] 7.1 Create `src/utils/buildAddOption.ts`
    - Export `buildAddOption(entityName: string, route: string, navigate: NavigateFunction, lang?: string)` returning an Ant Design Select option with `value: '__add__'` and a styled label using `token.colorTextSecondary`
    - Export `buildEffectiveOptions(options: SelectOption[], entityName: string, route: string, navigate: NavigateFunction)` that returns `options` when non-empty, or `[buildAddOption(...)]` when empty
    - Include the `onChange` guard: `if (value === '__add__') { navigate(route); return; }`
    - Fall back to `window.location.href = route` if `navigate` is unavailable
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 7.2 Write property test for `buildEffectiveOptions` — Property 4
    - **Property 4: Empty Select always renders exactly one Add_Option**
    - **Validates: Requirements 5.1, 5.5**
    - Use `fc.array(arbitrarySelectOption())` with `minLength: 0, maxLength: 0` to confirm exactly one `__add__` item is returned
    - _Requirements: 5.1, 5.5_

  - [x] 7.3 Write property test for `buildAddOption` label pattern — Property 5
    - **Property 5: Add_Option label matches required pattern**
    - **Validates: Requirements 5.2**
    - Use `fc.string({ minLength: 1, maxLength: 50 })` as entity name; assert label text equals `＋ Add ${entityName}` in `en` and `＋ زیادکردنی ${entityName}` in `ku`
    - _Requirements: 5.2_

- [x] 8. Checkpoint — shared utilities complete
  - Run `vitest --run` to confirm `SectionHelpPopover` and `buildAddOption` tests pass.

- [x] 9. Wire help popovers and fix Settings.tsx
  - [x] 9.1 Remove the duplicate `{active === 'currencies' && <Currencies />}` render conditional
    - Locate the duplicate block in `Settings.tsx` and delete it, leaving exactly one occurrence
    - _Requirements: 6.7_

  - [x] 9.2 Add `soon` placeholder screens for all sections with `badge: 'soon'`
    - For each `SectionDef` with `badge: 'soon'`, render a `<Result status="info" title={t('coming_soon')} />` (or equivalent) instead of a blank screen
    - _Requirements: 6.6_

  - [x] 9.3 Apply `buildEffectiveOptions` to the fiscal year `<Select>` in the Budgets section
    - Import `buildEffectiveOptions` and wrap the `fiscalYears`-derived options array
    - Set `entityName` to `t('fiscal_year', 'Fiscal Year')` and `route` to `'/settings?s=fiscal'`
    - Add the `onChange` guard for `'__add__'`
    - _Requirements: 5.1, 5.3, 5.4_

  - [x] 9.4 Audit and apply `buildEffectiveOptions` to all other empty-capable Selects in Settings.tsx
    - Identify every `<Select>` whose `options` is derived from an API response (currencies, warehouses, cost centers, analytic accounts, payment methods, etc.)
    - Wrap each with `buildEffectiveOptions` using the appropriate entity name and creation route
    - _Requirements: 5.1, 5.4_

  - [x] 9.5 Add `<SectionHelpPopover>` to every settings section content area
    - Import `SectionHelpPopover` in `Settings.tsx`
    - For each section, pass `what={t('settings.help.<key>.what')}`, `why={t('settings.help.<key>.why')}`, and `steps={[t('settings.help.<key>.step_1'), …]}` props
    - Place the component in the `actions` slot of `SectionCard` (or adjacent to the section title if no `actions` slot exists)
    - _Requirements: 7.1, 7.2, 7.3, 7.7_

- [x] 10. Checkpoint — Settings page wiring complete
  - Run `vitest --run`; verify no TypeScript errors with `tsc --noEmit`; confirm no blank screens for any section key.

- [x] 11. Write property-based and unit tests
  - [x] 11.1 Write property test for `flattenRoutes` — Property 1
    - **Property 1: No duplicate route paths in flattened navigation**
    - **Validates: Requirements 1.1, 1.10**
    - Call `buildNavSections(mockT)` then `flattenRoutes(sections)`; assert `new Set(keys).size === keys.length`
    - Tag: `// Feature: nav-settings-cleanup, Property 1`
    - _Requirements: 1.1, 1.10_

  - [x] 11.2 Write property test for deduplication preserves routes — Property 2
    - **Property 2: Deduplication preserves all unique routes**
    - **Validates: Requirements 1.9**
    - Use `fc.array(arbitraryNavSection(), { minLength: 1, maxLength: 20 })` and assert the set of unique keys before equals the set after `deduplicateSections()`
    - Tag: `// Feature: nav-settings-cleanup, Property 2`
    - _Requirements: 1.9_

  - [x] 11.3 Write property test for no English fallback in Kurdish UI — Property 3
    - **Property 3: No English fallback rendered in Kurdish UI**
    - **Validates: Requirements 3.1, 3.2, 8.1**
    - Build sections with a `kuT` mock that resolves from `ku.json`; collect all section and leaf labels; assert none equals the English fallback string passed to `t()`
    - Tag: `// Feature: nav-settings-cleanup, Property 3`
    - _Requirements: 3.1, 3.2, 8.1_

  - [x] 11.4 Write property test for every section renders non-empty content — Property 6
    - **Property 6: Every settings section renders non-empty content**
    - **Validates: Requirements 6.1**
    - Iterate `getAllSectionKeys()`; render `<Settings initialActive={key} />`; assert `.st-content` has at least one child
    - Tag: `// Feature: nav-settings-cleanup, Property 6`
    - _Requirements: 6.1_

  - [x] 11.5 Write property test for every section has a help icon — Property 7
    - **Property 7: Every settings section has a help icon**
    - **Validates: Requirements 7.1, 7.5**
    - Iterate `getAllSectionKeys()`; render `<Settings initialActive={key} />`; assert `getByLabelText(/help|یارمەتی/i)` is in the document
    - Tag: `// Feature: nav-settings-cleanup, Property 7`
    - _Requirements: 7.1, 7.5_

  - [x] 11.6 Write unit tests for navigation deduplication
    - Assert that `buildNavSections(mockT)` produces no section pair from Requirements 1.2–1.8
    - Assert that `setup` contains all items previously in `admin-config`
    - Assert that `ext-engagement` contains no field-service items
    - Assert that `ext-vertical` contains no `/ext/hotel` or `/ext/restaurant` items
    - _Requirements: 1.2–1.8, 4.2–4.6_

  - [x] 11.7 Write unit tests for mixed-language keyword fix
    - Assert that no `keywords[]` array in any NavLeaf contains characters in the Kurdish Unicode range (`\u0600`–`\u06FF`)
    - Assert that the `users` item in `setup` has fallback string `'Users'` (not Kurdish)
    - _Requirements: 8.5, 8.6, 8.7_

  - [x] 11.8 Write unit tests for locale key completeness
    - Assert that every key added in tasks 1.1–1.7 exists in both `en.json` and `ku.json`
    - Assert that every `settings.help.<key>.what` / `.why` / `.step_1` key exists for all section keys
    - _Requirements: 3.3, 3.4, 3.6, 3.7, 7.7_

  - [x] 11.9 Write unit tests for Add_Option navigation
    - Assert that selecting `'__add__'` in the fiscal year Select calls `navigate('/settings?s=fiscal')`
    - Assert that when `fiscalYears` is non-empty the Add_Option is not present
    - _Requirements: 5.3, 5.5_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Run `vitest --run`; run `tsc --noEmit`; confirm zero TypeScript errors and all property/unit tests green. Ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Tasks 1.1–1.7 (locale files) must be completed before any component or page task that calls `t()` with the new keys
- Task 2 (NavLeaf interface) must precede task 3 (deduplication) since the new `keywordsKu` field is used there
- Property tests (11.1–11.5) and the utilities tests (7.2, 7.3) use **fast-check** which is already available via Vitest in this project
- Each property test should run a minimum of 100 iterations (`numRuns: 100`)
- The `SectionHelpPopover` component is placed in the `actions` slot of `SectionCard` — no changes to `SectionCard` itself are needed
- The CSS fix (task 4.1) is a one-liner override; check both the global stylesheet and any sidebar CSS module for the correct insertion point
- `buildEffectiveOptions` (task 7.1) is a pure function — it is easy to test in isolation before wiring into Settings.tsx

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["1.5", "1.6", "1.7", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "4.1"] },
    { "id": 3, "tasks": ["3.7", "3.8", "6.1", "7.1"] },
    { "id": 4, "tasks": ["6.2", "7.2", "7.3", "9.1", "9.2"] },
    { "id": 5, "tasks": ["9.3", "9.4"] },
    { "id": 6, "tasks": ["9.5"] },
    { "id": 7, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6", "11.7", "11.8", "11.9"] }
  ]
}
```
