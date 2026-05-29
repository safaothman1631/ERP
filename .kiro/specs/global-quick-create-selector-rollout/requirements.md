# Global Quick-Create Selector Rollout — Requirements

## Context

EP-0 (`empty-state-quick-create`) shipped the `SelectWithQuickCreate`
component plus a 15-entity registry. EP-1 through EP-6 migrated most
forms. A residual long tail of pages still renders the raw Antd
`<Select>` with `options={entities.map(...)}`, which means:

- Empty dropdowns show "No data" with no recovery path; the user has
  to leave the form, open another module, create the prerequisite
  record, and come back.
- Inconsistent UX: some forms have the "+ Add new" CTA inside the
  dropdown, others don't — users learn to expect the CTA on some
  pages and feel the absence on the rest.
- Telemetry blind spots: every raw selector skips the 7 empty-state
  RUM events (impression, cta_click, modal_open, save_attempt,
  save_success, save_error, save_cancel).

The post-EP-0 audit (this spec, 2026-05-28) found **11 raw `<Select>`
sites across 9 files** that still rely on a parent-loaded
`entities.map(...)`. This spec closes that gap.

## Goal (one sentence)

Every selector in the app whose value is a foreign-key reference to
a registry entity goes through `SelectWithQuickCreate`, so the user
can create the prerequisite record inline from any form, on every
surface, without breaking flow.

## In scope

A selector is **in scope** if all of the following are true:

1. It is a single-value or multi-value `<Select>` in a form, table
   row, modal, or drawer.
2. Its `options` prop is derived from a fetched collection of
   first-class records (customers, vendors, items, accounts,
   bank accounts, tax rates, currencies, payment methods, tags,
   teams, subscription plans, locations / warehouses, employees,
   categories of any registered subtype).
3. The corresponding `entity` slug exists in
   `frontend/src/data/quickCreateRegistry.ts` OR can be added in a
   single Class A entry (≤ 6 fields, modal-eligible).
4. The user has at least one role/permission that allows creating
   the entity through the regular form.

## Out of scope

- **Enum/status selectors** (`status: 'draft'|'sent'|'paid'`,
  `currency_code: 'IQD'|'USD'`, lead-source dropdowns built from a
  hard-coded array, etc.). These have no "+ Add" semantics.
- **Composed widgets** that already wrap their own creation path
  (e.g. `<UserSelect>`, `<ContactPicker>` that opens a panel) —
  document them in the design as already-compliant and exempt.
- **Vertical-specific selectors** whose entity has no registry
  entry yet AND is not used cross-module (e.g. `patient_id` in
  healthcare). These get a follow-up spec, not this one.
- **Search/filter dropdowns** on list pages (filter by status,
  filter by tag) — these are read-only navigation, not creation
  surfaces.
- **Backend changes** — every entity already has a working
  `/api/<entity>` POST; this is a frontend-only spec.

## User-visible requirements

| ID | Requirement |
|----|-------------|
| R1 | Opening any in-scope dropdown for an entity with **zero records** renders the v2 empty state inside `notFoundContent`, with the entity's illustration, descriptive copy, and a primary CTA labeled "+ Add `<entity>`". |
| R2 | The CTA opens the registry's Class A modal or Class B drawer; on save, the new record is **prepended** to the dropdown's option list and **selected automatically** without an extra network round-trip. |
| R3 | Selecting from a populated dropdown is identical to today (no regression in keyboard navigation, screen-reader output, or initial render time). |
| R4 | Search-empty (user typed a query, no match) shows the search-empty variant with a "Clear search" button — distinct from the zero-records empty state. |
| R5 | A user without create permission on the entity sees the empty state WITHOUT a CTA (the registry's `permissionGate` already handles this — no extra wiring needed at call sites). |
| R6 | Form submission, validation, dirty-tracking, and error display behave identically to the pre-migration selector. |
| R7 | RTL layout and Kurdish/Arabic labels render correctly inside both the trigger and the empty-state body. |

## Non-functional requirements

| ID | Requirement |
|----|-------------|
| N1 | Bundle-size delta per migrated page ≤ +1.5 KB gzipped (the EmptyState shell is already loaded once via the design-system barrel). |
| N2 | No new request on form mount — `SelectWithQuickCreate` lazy-loads its options on first dropdown open (Requirement 8.1 of EP-0). |
| N3 | The migration is a **pure replacement** at each call site: imports adjusted, JSX changed, no surrounding state machine rewrites. |
| N4 | Every migration is covered by the existing `tools/eslint-rules/quick-create-select.js` rule going forward — re-runs of `npm run lint` flag any new raw `<Select>` against the listed entities. |
| N5 | The `audit/empty-state-baseline.json` ratchet is updated in the same PR; CI rejects future regressions via `.github/workflows/empty-state-ratchet.yml`. |

## Acceptance criteria

1. `grep -rE '<Select\b' frontend/src/pages frontend/src/components` returns **zero** matches whose `options` prop derives from any of: `customers`, `vendors`, `contacts`, `items`, `accounts`, `taxes`, `tax_rates`, `currencies`, `payment_methods`, `tags`, `teams`, `subscription_plans`, `locations`, `warehouses`, `employees`, `categories`.
2. Every page listed in `tasks.md` has its selectors migrated and the page renders without console errors on a fresh tenant with zero records of the in-scope entity.
3. The eslint rule `local/quick-create-select` passes on the entire `frontend/src` tree.
4. Manual smoke (one per migrated page): opening the form on a tenant with zero records shows the empty-state CTA; clicking it opens the modal/drawer; saving auto-selects.
5. `npm run audit:empty-states` records the new coverage and the ratchet workflow is green on the PR.
