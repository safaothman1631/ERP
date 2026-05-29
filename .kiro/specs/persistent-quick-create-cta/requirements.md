# Persistent Quick-Create CTA — Requirements

## Context

`SelectWithQuickCreate` (shipped in EP-0 `empty-state-quick-create`)
exposes a "+ Add <entity>" call-to-action **only** when the dropdown
has zero options. The instant the user has any matching records, the
CTA disappears from the dropdown — they must close the picker,
navigate to the entity's module, create the record, navigate back,
re-open the picker, and select.

Power users of Notion, Linear, Airtable, and Zoho's own newer
modules expect the create action to live **inside** the dropdown
forever: the "+ Add" footer is always one Tab away from the search
input, no matter how many existing records are present.

The post-rollout audit (2026-05-28) confirms the leverage point:

- 58 `<SelectWithQuickCreate>` call sites across 32 files.
- One component file (`SelectWithQuickCreate.tsx`).
- One Antd API (`popupRender` — `dropdownRender` is deprecated in
  Antd 6.3.5 per the console deprecation we already observe).

Modifying the component once propagates to every selector the
codebase ships.

## Goal (one sentence)

Every `<SelectWithQuickCreate>` dropdown — regardless of whether it
is empty, populated, loading, searching, or showing an error —
renders a single persistent "+ Add <entity>" footer that opens the
registered quick-create modal/drawer, so the user can create a
prerequisite record without ever leaving the form.

## In scope

1. The `frontend/src/design-system/empty/SelectWithQuickCreate.tsx`
   component itself.
2. The `frontend/src/design-system/empty/EmptyState.css` (footer
   styling tokens and RTL handling).
3. Localised CTA label keys (already shipped per EP-0 as
   `qc.<entity>.cta`).
4. The existing `useEmptyStateTelemetry` hook — the `cta_click`
   event must continue to fire correctly from the new footer.
5. The Storybook / dev gallery preview if present
   (`frontend/src/dev-gallery/`).

## Out of scope

- Raw Antd `<Select>` instances NOT wrapped in
  `SelectWithQuickCreate`. They render enum/status values and have
  no create semantics (audit confirmed 2026-05-28).
- Adding new registry entries (the 15 existing entries are
  sufficient; per-entity additions are tracked under separate
  specs).
- Changing the modal/drawer rendering itself (Class A modal,
  Class B drawer, Class C navigate paths are unchanged).
- Changing search debouncing, optimistic merge, or load-options
  semantics (Requirements 8.x of EP-0 are preserved).
- Migrating other custom pickers (`UserSelect`, `ContactPicker` in
  `ChatterPanel.tsx`) — they own their own creation paths.

## User-visible requirements

| ID | Requirement |
|----|-------------|
| R1 | Every open `<SelectWithQuickCreate>` dropdown displays a footer row at the bottom of the popup containing: an icon (PlusOutlined), the localised CTA text from the registry (`qc.<entity>.cta` key), and is clickable. |
| R2 | The footer is **always visible** regardless of: empty / populated state, search query, loading state, error state, single-select / multi-select mode. |
| R3 | The footer is **hidden** only when: (a) the parent `<Select>` is `disabled`, (b) the registry permission gate (`config.permission`) blocks the current user from creating, or (c) the entity slug is missing from the registry (graceful degrade). |
| R4 | Clicking the footer (or pressing `Enter` while it is focused) opens the same modal / drawer / navigate path that the empty-state CTA currently triggers — no functional change to the creation flow. |
| R5 | When the dropdown is empty (zero options), the body still renders the EmptyState illustration + title + description, but **no longer includes its own inline primary action button** — the footer is the single, canonical create entry point. |
| R6 | When the dropdown is in search-empty state (user typed a query, no match), the body still renders the search-empty variant (illustration + "Clear search" link), AND the footer "+ Add" remains visible so the user can create what they searched for. |
| R7 | The footer respects RTL: in Kurdish / Arabic, the icon sits to the right of the text and the row hugs the right edge. |
| R8 | Keyboard navigation: pressing `Tab` from the search input visits the listed options (existing behaviour), then visits the footer; pressing `Enter` while the footer has focus triggers it; `Escape` closes the dropdown as before. |
| R9 | Screen-reader output: the footer is labelled with the same translated CTA text (e.g. "Add customer") and announces as a button. |

## Non-functional requirements

| ID | Requirement |
|----|-------------|
| N1 | Bundle-size delta for the component: ≤ +0.5 KB gzipped (the footer is plain JSX + reused CSS tokens). |
| N2 | No new network calls: the footer reuses the existing `handleCtaClick` handler, which already mounts the lazy modal/drawer chunk. |
| N3 | No regressions in option loading, debounced search, optimistic merge, or row-stagger animations. |
| N4 | The `cta_click` telemetry event fires from the footer with the same payload shape as today (entity slug, surface=`selector`, source=`footer`). The optional `source` discriminator is a new field that does not break existing dashboards (additive). |
| N5 | Antd deprecation: switch from `dropdownRender` (deprecated) to `popupRender`. The component is the only consumer in our tree per the audit. |
| N6 | RTL parity: snapshot the footer in en / ku / ar locales during the dev-gallery preview to confirm direction-correct rendering. |
| N7 | TypeScript strictness: the new prop wiring stays inside the component; the public `SelectWithQuickCreateProps` type is **unchanged** so the 58 existing call sites compile without edits. |

## Acceptance criteria

1. Opening any `<SelectWithQuickCreate>` dropdown on `http://127.0.0.1:5173` after this change shows a "+ Add <entity>" footer, regardless of whether the underlying collection has records.
2. The console emits no `dropdownRender` deprecation warning from `SelectWithQuickCreate` after the switch to `popupRender`.
3. Clicking the footer opens the registry-driven modal / drawer / navigate path and, on save, the new record is prepended and auto-selected (existing EP-0 behaviour preserved).
4. `npm run build` in `frontend/` succeeds with no new TypeScript errors.
5. The dev-gallery preview (`frontend/src/dev-gallery/`) renders the new footer correctly in en / ku / ar locales.
6. A new test in `frontend/src/design-system/empty/SelectWithQuickCreate.test.tsx` (or sibling file) covers: (a) footer visible when options exist, (b) footer hidden when `disabled`, (c) footer hidden when permission denied, (d) `cta_click` telemetry fires on footer click.
7. Manual smoke across the 32 call-site files (one quick open per file is enough — the component is the lever): every dropdown shows the footer.
8. The `empty-state-ratchet` CI workflow remains green; the audit baseline is regenerated if the snapshot format changed.

## Backwards compatibility

- Public type `SelectWithQuickCreateProps` is unchanged. Every
  existing call site (Bills, Quotes, Invoices, BOM, BankRules, …)
  compiles without modification.
- The `notFoundContent` rendering path still emits an EmptyState
  with illustration + title + description — only the inline
  `primaryAction` is removed (delegated to the footer).
- The optional `ctaOverride` prop (used by vertical pages with
  custom entities) keeps its precedence: when provided, the footer
  renders `ctaOverride.labelKey` + `ctaOverride.onClick` instead of
  the registry default.
- Telemetry payload gains an optional `source: 'footer' | 'body'`
  field. Existing dashboards that don't read this field are
  unaffected.

## Risk register

| Risk | Mitigation |
|------|------------|
| Antd v6 `popupRender` signature differs from `dropdownRender`. | Verified in `node_modules/antd/lib/select/index.d.ts`: `dropdownRender?: SelectProps['popupRender']` — same signature; pure rename. |
| Virtualized option list (`virtual=true`) clips the footer. | `popupRender` wraps the entire panel; the footer renders outside the virtualization container by spec. Manual smoke verifies. |
| Two CTAs in empty state (body inline + footer) confuse the user. | R5: remove the inline `primaryAction` from the empty state; the footer is canonical. |
| Footer wraps below the option list in a 1-option dropdown and looks like an option. | Add a 1px divider above the footer (existing EP-0 styling tokens; no new design work). |
| Telemetry double-fires if both empty-body CTA and footer CTA were retained. | We collapse to one CTA (footer-only); single fire path. |
| Permission gate evaluates async; footer flashes in then disappears. | The `usePermission` hook resolves synchronously in the local cache after first call (existing behaviour); a one-frame flash is acceptable and matches current EP-0 behaviour for the body CTA. |
