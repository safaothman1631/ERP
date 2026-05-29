# Requirements Document: Empty State + Quick Create — Everywhere

> **Spec ID:** `empty-state-quick-create`
> **Status:** Draft v1.0
> **Owner:** Safa Othman
> **Theme:** *No user should ever see "No data" without a way to create data.*

---

## Introduction

The Kurdish-ERP renders **67+ surfaces today where the user can see "No data" and get stuck**: 42 `<Select>` dropdowns inside forms, 8 list pages, 12 drawers/side panels, and 14 in-form subform sections. The current behavior in most of them is the Antd default empty state — a small inbox icon and the text "No data" — with no path forward.

This is the **single biggest preventable abandonment surface** in the product. When a shopkeeper opens an invoice form for the first time and the Customer dropdown is empty, they have three options:

1. Close the invoice, navigate to Contacts, create a customer, come back to invoices, start over.
2. Leave the app.
3. Give up.

Today the system supports option 1. The next minute the user spends switching tabs is a minute they're not using the app — and a minute closer to giving up.

This spec defines **a single, system-wide pattern**: every empty-state surface in the app surfaces a primary CTA. For most entities, the CTA opens a quick-create modal that creates the record in-place and selects it. For complex entities, the CTA opens a slide-in drawer with the full form. For deeply complex entities, the CTA navigates with a return-path token so the user comes back to where they were.

Two working patterns already exist in the codebase:
- `frontend/src/design-system/EntitySelect.tsx` — generic async select with a `Create new` callback.
- `frontend/src/components/pos/POSCustomerSelector.tsx` — full inline quick-create modal for POS Customer.

Neither has been generalized to the rest of the app. This spec systematizes them.

---

## Glossary

| Term | Definition |
|------|------------|
| **Empty state** | A UI surface that renders when a collection has zero items. |
| **Quick Create** | An in-context create flow that does not leave the current page or context. |
| **Selector** | A `<Select>` dropdown that loads options from an API. |
| **Subform** | A repeating section inside a parent form (e.g., invoice line items). |
| **Class A entity** | An entity that can be created with ≤ 5 required fields — fits a modal. |
| **Class B entity** | An entity with 5–15 fields — fits a drawer. |
| **Class C entity** | An entity that requires a multi-step workflow — full-page navigation with return token. |
| **Return token** | A URL hash or session-stored identifier that lets the system navigate the user back to their original context after a Class-C create. |
| **Optimistic select** | After a quick-create succeeds, the originating selector immediately switches to the newly-created record without a server round-trip. |
| **CTA** | Call To Action — the primary button in an empty state. |
| **Telemetry event** | An emitted event capturing user action with empty states, used to measure quick-create conversion. |

---

## Inventory baseline (from audit at `_deltas/empty-state-audit.md`)

| Category | Surfaces today | Pattern coverage | Quick-create candidates |
|----------|---------------:|------------------|------------------------:|
| **A — Selectors** | 42 | EntitySelect partial (1 of 42); POSCustomerSelector (1 of 42) | 33 |
| **B — List pages** | 8 | Antd `Empty` default | 6 |
| **C — Drawers** | 12 | None | 4 |
| **D — Subforms** | 14 | None | 5 |
| **Total** | **76 surfaces** | **2 working** | **48 priority migrations** |

---

## Requirements

### Requirement 1 — Universal coverage

THE system SHALL render a primary CTA on every empty-state surface where the user could productively create the missing record. Specifically:

1.1. EVERY `<Select>` that loads options from an API SHALL render, when options.length === 0 AND not loading, either: (a) a quick-create CTA per Requirement 2, or (b) a "Request access" CTA per Requirement 9 if the user lacks create permission.

1.2. EVERY list page (`pages/<module>/<Entity>List.tsx`) SHALL render a primary empty state with an explanation of the entity, an illustration, and a primary CTA. The "primary action button in the page header" is NOT a replacement — the empty state must repeat the CTA inside the canvas.

1.3. EVERY drawer or side panel that displays a collection (activity log, payment history, related orders) SHALL render an empty state with explanation when the collection is empty. CTAs are optional here if the data is system-generated.

1.4. EVERY subform inside a parent form that displays a collection (with explicit "no items added yet" semantics — distinct from a placeholder first row) SHALL render an inline empty state with a primary CTA.

1.5. The default Antd empty state ("No data") SHALL NOT appear anywhere user-facing after this spec lands. A custom shared component (`<EmptyState>`, Requirement 4) is the only sanctioned empty UI.

### Requirement 2 — Quick Create modal (Class A entities)

For entities classified Class A (≤ 5 required fields) — Customer, Vendor, Tax Rate, Expense Category, Currency, Tag, Payment Method:

2.1. WHEN the user clicks the empty-state CTA, THE system SHALL open a modal dialog containing only the required fields plus the 2–3 most-common optional fields. The modal SHALL include: a title (entity name + "Quick Create"), a fields section, primary action "Create & Select", secondary action "Cancel", and a "Full form…" link that navigates to the dedicated create page if the user needs more fields.

2.2. THE modal SHALL focus the first input on open and trap focus inside the dialog until closed.

2.3. WHEN the user submits the modal, THE system SHALL: (a) POST to the entity's create endpoint with the form values, (b) on success: close the modal, optimistically select the new record in the originating selector, show a green toast "Customer created and selected", emit `entity.quick_create.succeeded` telemetry; (c) on failure: keep the modal open, display the validation error inline next to the offending field, emit `entity.quick_create.failed` telemetry.

2.4. THE modal SHALL be dismissible via Esc, click outside (with confirmation if any field is dirty), and the X button.

2.5. THE modal SHALL preserve the originating selector's search query — if the user typed "Ali" in the selector before clicking Create, "Ali" is pre-filled as the name in the modal.

### Requirement 3 — Quick Create drawer (Class B entities)

For entities classified Class B (5–15 fields) — Item, Account, Bank Account, Team, Subscription Plan, Location:

3.1. WHEN the user clicks the empty-state CTA, THE system SHALL slide in a right-side drawer (width 480px desktop, full-width mobile) containing the full create form for the entity.

3.2. THE drawer SHALL behave like the modal in Requirement 2 with the addition of: support for sectioned form (e.g., "Basic info", "Pricing", "Accounting") with a vertical Steps indicator on the left edge for long forms; support for file/image upload fields (Item images, Account logo); a "Save & Add another" secondary action that creates the record and resets the form without closing the drawer.

3.3. THE drawer SHALL preserve the originating context — when closed (saved or cancelled), the user returns to exactly the position they were in.

### Requirement 4 — Shared empty-state component

4.1. THE system SHALL ship a single reusable component `<EmptyState>` under `frontend/src/design-system/empty/` with this API:
```ts
<EmptyState
  variant="selector" | "list" | "drawer" | "subform" | "search"
  illustration={IllustrationKey}     // friendly SVG illustration
  titleKey={i18nKey}                  // localized title
  descriptionKey={i18nKey}            // 1-line localized description
  primaryAction={{
    labelKey: i18nKey,
    onClick: () => void,
    icon?: ReactNode,
  }}
  secondaryAction?={{ labelKey, onClick }}  // optional
  permissionGate?={{ resource, verb }}      // optional; renders 'Request access' instead
  context?={Record<string, unknown>}        // for telemetry attribution
/>
```

4.2. THE component SHALL include 8 default illustrations selected from a friendly, locale-neutral library: `customers`, `items`, `documents`, `money`, `inbox`, `chart`, `box`, `lock`. Illustrations SHALL be SVGs subset and inlined ≤ 4 KB each.

4.3. THE component SHALL emit `empty_state.shown` telemetry with the entity, variant, and context attribution. It SHALL emit `empty_state.cta_clicked` when the primary CTA is invoked.

4.4. THE component's typography SHALL match the design system tokens: title 18px / 600, description 14px / 400, button labels per Antd primary. Spacing tokens: 24px between illustration and title, 8px between title and description, 24px before the button.

4.5. THE component SHALL respect RTL — for Arabic/Kurdish, the illustration retains its orientation (icons are direction-neutral), but the button and text reflow right-to-left automatically via the existing `dir="rtl"` propagation.

### Requirement 5 — Per-entity quick-create registry

5.1. THE system SHALL ship a single source of truth at `frontend/src/data/quickCreateRegistry.ts` that maps entity slug → quick-create configuration:

```ts
{
  customer: {
    class: 'A',
    titleKey: 'qc.customer.title',
    illustration: 'customers',
    fields: [
      { name: 'display_name', type: 'text', required: true, labelKey: 'fields.name' },
      { name: 'phone', type: 'tel', required: false, labelKey: 'fields.phone' },
      { name: 'email', type: 'email', required: false, labelKey: 'fields.email' },
      { name: 'contact_type', type: 'select', options: ['customer','vendor'], default: 'customer' },
    ],
    apiCreate: (values) => post('/api/contacts', values),
    listResource: '/api/contacts',
    permission: 'contacts.create',
    onSuccess: (record) => ({ id: record.id, label: record.display_name }),
  },
  // ... 13 more entries
}
```

5.2. EVERY new selector SHALL consume from this registry — no inline quick-create implementations elsewhere.

5.3. THE registry SHALL be exhaustively documented; adding a new entity requires a comment block explaining the class decision and the reasoning behind chosen fields.

### Requirement 6 — Motion and transitions

6.1. THE empty state SHALL appear with a **fade + scale-up** transition: opacity 0 → 1, scale 0.95 → 1, duration 220ms, spring(stiffness=240, damping=22) — via Framer Motion.

6.2. THE primary CTA on hover SHALL elevate (`scale 1.03`, `shadow lg`) over 120ms; on press SHALL depress (`scale 0.97`) for tactile feedback.

6.3. WHEN the quick-create modal opens, THE backdrop SHALL fade in over 180ms and the dialog SHALL slide+scale from `translateY(20px) scale 0.95` to `0,0,1` over 240ms spring.

6.4. WHEN a quick-create succeeds, THE new option in the originating selector SHALL flash with a subtle highlight pulse (`background opacity 0 → 30 → 0` over 600ms) so the user's eye locks to it.

6.5. List pages SHALL render their rows with a **stagger** entrance — each row offset by 30ms — when transitioning from empty/loading to populated. Max stagger total: 480ms; rows beyond index 16 are not staggered.

6.6. ALL motion SHALL respect `prefers-reduced-motion: reduce` — fall back to crossfade only, max 120ms.

### Requirement 7 — Loading vs empty vs error states

7.1. EVERY collection-bound surface SHALL distinguish three states explicitly:

- **Loading**: skeleton shimmer (Antd `Skeleton` or shadcn equivalent). Never the empty state. Never a spinner-on-blank.
- **Empty**: the `<EmptyState>` component per Requirement 4.
- **Error**: a separate `<ErrorState>` with a "Retry" button and a one-line message. Never a stack trace user-facing.

7.2. THE state transitions SHALL be deterministic and ordered: loading → (empty | populated | error), and from any non-loading state back to loading on refresh. Mixing states is forbidden.

7.3. WHEN search returns zero results in a non-empty collection (search-with-no-matches), THE system SHALL render a *search empty* variant: "No results for '<query>'", with a "Clear search" CTA (not a "create new" CTA — the collection itself isn't empty).

### Requirement 8 — Auto-select and search inheritance

8.1. AFTER quick-create succeeds, THE originating selector SHALL immediately set its value to the new record without an additional server fetch. The new record's data SHALL be merged into the selector's local options cache and pushed to the top of the list.

8.2. WHEN the user has typed a search query in the selector before clicking Create, THE quick-create form SHALL pre-fill the most relevant field (typically `display_name` or `name`) with that query. The user can edit it before submitting.

8.3. WHEN the user has typed something that looks like a phone number or email, THE registry's field-classifier SHALL route it to the right field (e.g., `phone` instead of `name`).

### Requirement 9 — Permissions awareness

9.1. EVERY `<EmptyState>` SHALL accept a `permissionGate` prop. When the user lacks the required permission, the primary CTA SHALL be replaced by a tertiary "Request access" link that opens the admin notification flow.

9.2. THE quick-create modal/drawer SHALL also enforce server-side permissions — the client never trusts client-side gating alone. A 403 from the create endpoint SHALL surface as a friendly "You don't have permission to create <entity>" toast, not a stack trace.

### Requirement 10 — Internationalization

10.1. ALL copy (titles, descriptions, CTAs, validation messages) SHALL be i18n keys in `pages/settings/sections.registry` style — namespaced as `qc.<entity>.<key>`.

10.2. THE Kurdish, Arabic, and English bundles SHALL ship with each new entity's keys. The Arabic bundle SHALL be at parity with the Kurdish baseline — if Arabic translation lags, the entity SHALL NOT ship its quick-create UI until parity is reached.

10.3. RTL layouts SHALL be verified per entity via the Playwright RTL snapshot suite added in P5.

### Requirement 11 — Accessibility

11.1. THE empty state SHALL have an `aria-live="polite"` region that announces the empty state when it appears, in the user's locale.

11.2. THE quick-create modal SHALL have `role="dialog"` and `aria-labelledby` pointing at its title. Focus traps the modal until closed; Esc closes; Tab cycles within.

11.3. ALL CTAs SHALL have a minimum 44x44 px hit target on mobile (per the existing touch-target utility).

11.4. Color contrast: title and description SHALL meet WCAG AA against the empty-state background (4.5:1 for body text, 3:1 for large text).

11.5. Illustrations SHALL be `aria-hidden="true"` — they are decorative, not informative.

### Requirement 12 — Telemetry

12.1. THE system SHALL emit the following events to the existing RUM ingest endpoint:

| Event | Attributes |
|-------|-----------|
| `empty_state.shown` | entity, variant, surface_path, has_search_query, locked_by_permission |
| `empty_state.cta_clicked` | entity, variant, surface_path |
| `quick_create.opened` | entity, surface_path, prefilled_field_name? |
| `quick_create.cancelled` | entity, time_open_ms, was_dirty |
| `quick_create.succeeded` | entity, time_to_save_ms |
| `quick_create.failed` | entity, error_code |
| `quick_create.full_form_link_clicked` | entity, time_open_ms |

12.2. THE conversion funnel `empty_state.shown` → `cta_clicked` → `opened` → `succeeded` SHALL be visible in a dashboard, with per-entity breakdowns.

12.3. Targeted conversion rates (post-spec): 70% of `shown` → `cta_clicked`; 90% of `opened` → `succeeded`. Below those targets triggers a UX review.

### Requirement 13 — Performance

13.1. THE empty state component SHALL be **always-loaded** (in the app shell, not lazy) since it appears on first paint. Budget: ≤ 8 KB gzipped including 8 illustrations.

13.2. THE quick-create modal SHALL be **lazy-loaded** when the user clicks the CTA. First open of any modal: ≤ 200 ms time-to-interactive (chunk fetch + render).

13.3. THE registry config SHALL be tree-shakable so that loading the Customer quick-create doesn't pull in the Item quick-create code.

### Requirement 14 — Search empty (Category E)

14.1. WHEN a user searches inside a populated collection and gets zero hits, the system SHALL render the *search empty* variant per Requirement 7.3 — visually distinct from the "no data" variant.

14.2. THE search-empty CTA SHALL be "Clear search" by default. If the user's query plausibly looks like a new record name (e.g., contains a space, looks like a person's name) AND the entity supports quick-create, the system MAY offer a secondary CTA "Create '<query>' as new <entity>" — this is the *paste-and-create* flow.

### Requirement 15 — Migration safety

15.1. THE migration SHALL be incremental, surface-by-surface, behind a feature flag `ui.empty_state_v2`. With the flag OFF, the legacy Antd empty is preserved; with ON, the new pattern renders.

15.2. EACH migrated surface SHALL ship a Playwright snapshot test asserting: (a) the new empty state renders, (b) clicking the CTA opens the right modal/drawer, (c) a successful submit closes the modal and selects the new record.

15.3. ROLLBACK procedure: flip the feature flag OFF — instantly reverts every migrated surface to legacy.

### Requirement 16 — Documentation

16.1. THE system SHALL ship a developer guide at `docs/ui/empty-state-quick-create.md` with: when to use which pattern, how to add a new entity to the registry, copy-writing rules ("describe what this is in 1 line"), illustration usage rules, telemetry instrumentation.

16.2. THE Storybook (if added later) SHALL have a story per variant (selector, list, drawer, subform, search) and per locale (ku, en, ar) — 15 stories minimum.

---

## Non-Functional Requirements Summary

| Dimension | Target |
|-----------|--------|
| Coverage | 76 surfaces / 76 (100%) by end of Phase 4 |
| Modal first-paint | ≤ 200 ms after CTA click |
| Empty-state CTA conversion | ≥ 70% of shown → cta_clicked |
| Quick-create success rate | ≥ 90% of opened → succeeded |
| Bundle impact (shell) | ≤ 8 KB gzipped |
| Bundle impact (per quick-create chunk) | ≤ 12 KB gzipped each |
| Accessibility | WCAG 2.1 AA verified per surface |
| i18n coverage | 100% on ku/en/ar before ship |
| Reduced-motion fallback | Full crossfade-only mode |
| Rollback time | Instant (feature flag) |

---

## Out of Scope (this spec)

- **Bulk import** flows (CSV / Excel). Empty states MAY link to those but the importer itself is a separate spec.
- **Onboarding wizard** (first-time tenant). Quick-create is for ongoing use, not first setup.
- **Form-builder Studio** entities. Custom entities defined by the user are handled by Studio's own pattern.
- **Settings configuration screens**. These have their own pattern (legacy `EmptySelectState` under `AddGate`).
- **POS-specific** edge cases beyond `POSCustomerSelector`. The pattern is reusable, but POS-specific behaviors (kitchen-display empty, floor-plan empty) live in the POS spec.

---

## Acceptance: when this spec is done

This spec is "done" when, on production:

1. The `<EmptyState>` component renders on every one of the 76 surfaces catalogued in `_deltas/empty-state-audit.md`.
2. The default Antd empty state appears in zero user-facing screens (CI gate via Playwright snapshot diff).
3. Quick-create success rate ≥ 90% across the top-10 entities, measured over a 28-day window.
4. Conversion rate from `empty_state.shown` to `quick_create.succeeded` ≥ 50% for Class-A entities.
5. The developer guide at `docs/ui/empty-state-quick-create.md` is current.
6. The feature flag `ui.empty_state_v2` is removed (default ON post-migration, kill-switch retired).
7. All 76 surfaces have a Playwright snapshot test green in CI.

Until all seven are true, this spec stays in progress.
