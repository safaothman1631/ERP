# Requirements Document

## Introduction

This feature is the **system-wide UX/quality umbrella** for the entire ERPIQ application. It enforces five cross-cutting quality pillars across **every page, every section, every dialog, every form, every component**:

1. **Full user-friendliness** as a measurable quality bar, not a per-page polish.
2. **Full mobile responsiveness** using production-grade, well-known responsive patterns and libraries (mobile-first Tailwind utilities, container queries, shadcn/ui responsive primitives, drawer-instead-of-modal on small screens, responsive table → card pattern, safe-area-insets, ≥44px touch targets, etc.).
3. **A help icon (?) system** attached to every section, opening a panel/popover that explains what the section is, why it exists, how it connects to other sections, and step-by-step how to create/use it. Settings sub-sections are explicitly included.
4. **Selective Add** behavior on every section that supports adding records: when the section already has data, adding more is **optional**; when the section is empty, adding at least one item is **mandatory** before the user can proceed.
5. **Complete bilingual coverage** (English ⇄ Kurdish Sorani) with **English parity** as a hard gate. Zero untranslated strings, zero hardcoded literals, automated CI coverage checks, and a single i18n source of truth shared with the help-content registry.

This spec is the **umbrella** above the following sibling specs and **must not duplicate** their work — it consumes, extends, and enforces them system-wide:

- `settings-documentation` — Settings management and Settings help patterns; this spec extends the same help/translation pattern to the **whole** product, not only Settings.
- `nav-settings-cleanup` — Empty-Select Add escape-hatch and per-Settings-section help popovers; this spec promotes the same "Selective Add" and "Help icon" rules to a **system-wide** mandate.
- `ui-redesign-modern` — design tokens, RTL, accessibility, command palette; this spec adopts those tokens as the source of truth and adds responsive/help/i18n acceptance criteria on top.
- `landing-auth-vercel-redesign` — landing/auth pages; this spec applies the same responsive and bilingual rules to those public pages.

The Definition of Done is system-wide: a release of this feature is complete only when **every applicable page, dialog, and component in the product** complies with the acceptance criteria below.

---

## Glossary

- **System**: The entire ERPIQ frontend application (React + TypeScript), including authenticated app shell, all modules, all dialogs, drawers, forms, tables, charts, and the public landing/auth pages.
- **Page**: Any top-level route rendered inside `App.routes.tsx`.
- **Section**: Any logical content group inside a page that has a heading or title (e.g., a Settings sub-section, a dashboard card group, a form fieldset, a list panel).
- **Dialog**: Any modal, drawer, popover, or confirmation that opens on top of a page.
- **Form**: Any collection of input fields submitted as a unit (create, edit, settings, search, filter).
- **Component**: Any reusable UI primitive (button, input, table, chart, card, etc.).
- **Mobile_Viewport**: A viewport with width ≤ 640 px (the `sm` breakpoint in Tailwind).
- **Tablet_Viewport**: A viewport with width > 640 px and ≤ 1024 px.
- **Desktop_Viewport**: A viewport with width > 1024 px.
- **Touch_Target**: Any element a user can tap, click, drag, or otherwise activate with a pointer.
- **Help_Icon**: A `?` (question mark) or ⓘ (info) icon button rendered next to a Section title, used to open the Help_Panel for that Section.
- **Help_Panel**: A popover, side drawer, or inline panel that displays the Help_Content for a Section.
- **Help_Content**: A structured record consisting of: (a) `what` — a one-sentence definition of the Section, (b) `why` — a one-sentence purpose statement, (c) `relates_to` — a list of related Sections with their links, (d) `how` — a numbered step-by-step usage guide.
- **Help_Registry**: The single source of truth that stores Help_Content for every Section, keyed by a unique `sectionId`.
- **Selective_Add**: The behavior where, in a Section that supports adding records, the "Add" action is optional when records exist and mandatory (blocking forward navigation) when no records exist.
- **Add_Gate**: The runtime check that enforces Selective_Add — it inspects the Section's current record count and either makes the Add action optional or required.
- **Empty_State**: The UI shown in a Section when it has zero records.
- **i18n_Registry**: The set of locale JSON files (`en.json`, `ku.json`) under `frontend/src/locales/` plus the matching keys in the Help_Registry.
- **Translation_Key**: A string key resolved through `i18next`'s `t()` function whose value must exist in **both** `en.json` and `ku.json`.
- **Hardcoded_Literal**: Any user-facing string in TSX/JSX, attribute (`title`, `aria-label`, `placeholder`, `alt`), or component prop that is not resolved through `t()` or the Help_Registry.
- **Coverage_Check**: An automated CI rule that fails the build if any Translation_Key is missing in either locale, or if any Hardcoded_Literal is detected in user-facing code paths.
- **Drawer_Instead_Of_Modal**: A responsive pattern where a component that renders as a centered modal on Desktop_Viewport renders as a bottom or side drawer on Mobile_Viewport.
- **Responsive_Table**: A table that renders as a traditional grid on Desktop_Viewport / Tablet_Viewport and collapses into a stacked card list on Mobile_Viewport.
- **Container_Query**: A CSS `@container` query that adapts a component to its container size, independent of the viewport size.
- **Safe_Area_Inset**: The CSS `env(safe-area-inset-*)` values that account for device notches, home indicators, and rounded corners on iOS/Android.
- **RTL**: Right-to-left text direction, used when the active language is Kurdish (`ku`).
- **LTR**: Left-to-right text direction, used when the active language is English (`en`).
- **Active_Language**: The language currently selected by the user, persisted in `localStorage` under `i18n.language` (or `app_language`), one of `en` or `ku` for the purposes of this spec.
- **WCAG_AA**: The Web Content Accessibility Guidelines 2.1 Level AA conformance criteria.

---

## Requirements

---

### Requirement 1: System-Wide User-Friendliness Quality Bar

**User Story:** As any user of the ERPIQ application, I want every page, section, dialog, and form to feel polished, predictable, and easy to use, so that I never encounter dead ends, blank screens, ambiguous controls, or inconsistent patterns anywhere in the product.

#### Acceptance Criteria

1. THE System SHALL apply the same primary action pattern across every Page, Section, Dialog, and Form: a single visually dominant primary button labelled with an action verb, with destructive actions rendered with the danger color token from `theme/tokens.ts`.
2. WHEN a Page, Section, Dialog, or Form is in a loading state for more than 300 ms, THE System SHALL render a Skeleton_Loader matching the final content shape, and SHALL NOT render a blank white screen.
3. WHEN a Page, Section, Dialog, or Form fails to load data, THE System SHALL render an inline error state containing a human-readable error message in the Active_Language and a "Retry" action, and SHALL NOT silently fall back to an empty state.
4. WHEN a Section has zero records and the Section supports adding records, THE System SHALL render an Empty_State containing an illustration or icon, a one-sentence description in the Active_Language, and a primary "Add" call-to-action.
5. WHEN a user submits a Form with invalid input, THE System SHALL render inline field-level validation errors next to each invalid field and a summary banner at the top of the Form listing the invalid fields, both in the Active_Language.
6. WHEN a user successfully submits a Form, THE System SHALL render a success notification (toast) within 500 ms of the response, in the Active_Language.
7. THE System SHALL apply a consistent close affordance to every Dialog: an Escape-key handler that closes the Dialog, a backdrop click that closes the Dialog (unless the Dialog explicitly suppresses it for unsaved-changes protection), and a visible close button with an `aria-label` resolved from the i18n_Registry.
8. WHEN a user attempts to close a Dialog or navigate away from a Form with unsaved changes, THE System SHALL render a confirmation Dialog asking whether to discard the changes, in the Active_Language.
9. THE System SHALL render every navigation transition without a full browser reload — every internal link SHALL go through React Router's `navigate()` API or `<Link>` component, and SHALL NOT use `window.location` assignment or anchor tags with full-page hrefs for internal routes.
10. WHEN a user clicks any element labelled as a button or link, THE System SHALL provide visible feedback within 150 ms (hover state, pressed state, focus ring, or loading spinner), so that no click ever feels unregistered.
11. THE System SHALL render every Section heading with a consistent typographic style sourced from `theme/tokens.ts`, with no underline or border-bottom decoration on the heading text itself, across every page in the product.
12. IF a Section is marked as "coming soon" or feature-flagged off, THEN THE System SHALL render a placeholder Empty_State explaining the status in the Active_Language, and SHALL NOT render a blank white screen.

---

### Requirement 2: Full Mobile Responsiveness — Layout and Breakpoints

**User Story:** As a user on any device from a 320 px phone to a 4K desktop, I want every page, dialog, drawer, and component to be fully usable without horizontal overflow, clipped content, overlapping elements, or unreachable controls, so that I can complete any task on any device.

#### Acceptance Criteria

1. THE System SHALL be fully usable on viewports from 320 px in width upward — including Desktop_Viewport widths beyond 1920 px (ultra-wide monitors) — without horizontal page-level overflow, content clipping, or overlapping elements on any Page, Dialog, or Section. THE System SHALL NOT impose an upper viewport width limit; layouts SHALL gracefully expand or center within a `max-inline-size` container sourced from `theme/tokens.ts` on widths beyond the largest defined breakpoint.
2. THE System SHALL adopt a **mobile-first** responsive strategy using Tailwind responsive utility prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) — base styles SHALL define the Mobile_Viewport layout and larger viewports SHALL be opt-in additions.
3. THE System SHALL use **Container_Queries** (`@container`) for components whose layout adapts to their parent container size rather than the viewport size, including but not limited to: KPI cards, dashboard widgets, sidebar flyouts, and embedded forms.
4. THE System SHALL define exactly four named breakpoints in a single source of truth (e.g., Tailwind config) — `sm` (640 px), `md` (768 px), `lg` (1024 px), `xl` (1280 px) — and SHALL NOT introduce ad-hoc inline media queries elsewhere.
5. WHEN the viewport width is at or below the Mobile_Viewport breakpoint, THE System SHALL render every Page in a single-column layout with the primary content occupying 100% of the available inline width minus Safe_Area_Insets.
6. WHEN the viewport width is at or below the Mobile_Viewport breakpoint (640 px), THE System SHALL hide the Desktop sidebar and render navigation either as a bottom navigation bar, a hamburger-triggered drawer, or a top app bar, consistent with the active layout mode. WHEN the viewport width is strictly greater than 640 px (e.g., 641 px), THE System SHALL render the Desktop sidebar according to its desktop layout rules — the Mobile_Viewport boundary SHALL be evaluated as a strict `width <= 640 px` width threshold.
7. THE System SHALL apply `padding-inline-start: env(safe-area-inset-left)` and `padding-inline-end: env(safe-area-inset-right)` (and matching `top` / `bottom` insets where applicable) to all root layout containers and full-screen Dialogs, so that content does not collide with device notches or home indicators on iOS and Android.
8. THE System SHALL be fully usable in both portrait and landscape orientations on Mobile_Viewport and Tablet_Viewport without content loss or layout breakage.
9. IF a third-party component does not support responsive layout natively, THEN THE System SHALL wrap it in a responsive container that handles overflow via horizontal scroll, stacking, or alternate-component substitution, and SHALL NOT allow the third-party component to break the page layout.

---

### Requirement 3: Full Mobile Responsiveness — Dialogs, Drawers, and Modals

**User Story:** As a mobile user, I want every modal and drawer to fit my screen, be reachable with my thumb, and be dismissible without trapping me, so that I can complete actions on a small screen as easily as on a desktop.

#### Acceptance Criteria

1. WHEN the viewport width is at or below the Mobile_Viewport breakpoint, THE System SHALL render every centered modal Dialog as a bottom sheet (Drawer_Instead_Of_Modal pattern), occupying 100% of the inline width and at most 90% of the block height, with a drag handle and a swipe-to-dismiss gesture.
2. WHEN the viewport width is above the Mobile_Viewport breakpoint, THE System SHALL render the same Dialog as a centered modal with a maximum width sourced from `theme/tokens.ts` (no Dialog SHALL render edge-to-edge on Desktop_Viewport).
3. THE System SHALL render every Dialog with a sticky header containing the title and close button, and a sticky footer containing the primary and secondary actions, so that on any viewport the user can read the title and reach the actions without scrolling the surrounding chrome out of view.
4. WHEN a Dialog's content exceeds the available block height, THE System SHALL make only the Dialog's body scrollable, while the header and footer remain pinned, and SHALL prevent body-scroll on the underlying page (scroll lock).
5. WHEN a Dialog is open, THE System SHALL trap focus inside the Dialog and return focus to the triggering element when the Dialog closes.
6. WHEN a Dialog is open on Mobile_Viewport, THE System SHALL place its primary action button within the bottom 25% of the viewport (thumb zone) and SHALL make the action button at least 44 px tall.
7. THE System SHALL render Drawer components (side drawers) with a width of 100% on Mobile_Viewport, and a max-width sourced from `theme/tokens.ts` on Tablet_Viewport and Desktop_Viewport.
8. IF the Active_Language is Kurdish (RTL), THEN THE System SHALL anchor side Drawers and Dialog actions to the inline-end edge using logical CSS properties (`inline-start` / `inline-end`), and SHALL NOT use `left` / `right` directly in component code.

---

### Requirement 4: Full Mobile Responsiveness — Tables, Forms, and Charts

**User Story:** As a mobile user, I want tables, forms, and charts to remain readable and usable on a small screen, so that I am not forced to a desktop to view or edit my data.

#### Acceptance Criteria

1. WHEN the viewport width is at or below the Mobile_Viewport breakpoint (640 px), THE System SHALL render every Responsive_Table as a stacked card list, where each row becomes a card whose label/value pairs are stacked vertically, preserving the same data and the same row-level actions as the desktop table. The card-vs-grid choice SHALL be made by viewport width, not by user-agent device-type detection.
2. WHEN the viewport width is above the Mobile_Viewport breakpoint, THE System SHALL render the same Responsive_Table as a traditional grid table with sortable columns and sticky header.
3. WHEN a table has more than 5 columns and the viewport is at or below the Tablet_Viewport breakpoint, THE System SHALL render only the columns marked as `priority: 'high'` and SHALL hide lower-priority columns behind an expandable per-row "Show more" affordance.
4. THE System SHALL render every Form input with a minimum height of 44 px on Mobile_Viewport for any Touch_Target (input, select, button, checkbox, radio, switch, date picker trigger).
5. WHEN the viewport width is at or below the Mobile_Viewport breakpoint (640 px), THE System SHALL render every Form in a single-column layout regardless of how many columns the same Form uses on Desktop_Viewport — the layout choice SHALL be driven by viewport width, not by user-agent device-type detection.
6. THE System SHALL render every chart (recharts or equivalent) with a responsive container that fills 100% of its parent inline width, and SHALL use a minimum visible height of 240 px on Mobile_Viewport.
7. WHEN the viewport width is at or below the Mobile_Viewport breakpoint (640 px) and a chart includes a legend whose intrinsic width exceeds the chart's container inline-size, THE System SHALL move the legend below the chart and SHALL allow it to wrap onto multiple lines. The "does not fit" determination SHALL be made by comparing the rendered chart container width against the Mobile_Viewport breakpoint, not by user-agent device-type detection.
8. IF a Form contains line items with many columns (e.g., invoice line items), THEN on Mobile_Viewport THE System SHALL render each line item as an expandable card with the most important fields visible by default and the remaining fields available behind an "Edit details" affordance.

---

### Requirement 5: Full Mobile Responsiveness — Touch Targets, Gestures, and Performance

**User Story:** As a mobile user, I want every tappable element to be large enough for my finger, gestures to feel native, and the app to remain fast on a mid-range phone, so that the mobile experience is not a degraded version of the desktop one.

#### Acceptance Criteria

1. THE System SHALL render every Touch_Target with a minimum hit area of 44 × 44 px on Mobile_Viewport and Tablet_Viewport, even when the visual size is smaller (using padding or `::before` pseudo-elements to extend the hit area).
2. THE System SHALL provide a minimum spacing of 8 px between adjacent Touch_Targets on Mobile_Viewport to prevent mis-taps.
3. WHEN a user performs a horizontal swipe gesture on a Responsive_Table row card on Mobile_Viewport, THE System SHALL reveal contextual actions (edit, delete) consistent with the row's available actions, and SHALL provide an equivalent tap-only path for users who do not use gestures.
4. WHEN a user performs a vertical drag-down gesture on a bottom-sheet Dialog on Mobile_Viewport, THE System SHALL dismiss the Dialog if the drag distance exceeds 30% of the Dialog's height, and SHALL animate it back to its original position otherwise.
5. THE System SHALL achieve a Lighthouse Performance score of at least 85 on a Slow 4G profile (1.6 Mbps / 150 ms RTT) for the home page, login page, dashboard, and any list page measured in CI on a mobile emulation profile.
6. THE System SHALL enforce per-route initial-JavaScript bundle-size budgets in CI, with default values of 250 KB gzipped for the public landing and auth routes and 350 KB gzipped for any single authenticated route after code-splitting. THE budget values SHALL be configurable via a single configuration file (e.g., `frontend/perf-budgets.json`) so that thresholds can be tuned over time without editing the spec or the CI workflow itself; CI SHALL fail when the measured bundle exceeds the configured budget for that route.
7. THE System SHALL serve images via a responsive `<picture>` or equivalent that selects an appropriately sized variant for the active viewport, and SHALL lazy-load all images below the fold.
8. WHEN the user's device reports `prefers-reduced-motion: reduce`, THE System SHALL disable non-essential animations on Mobile_Viewport (parallax, particle effects, decorative motion) while preserving functional motion (focus rings, loading indicators).

---

### Requirement 6: Help Icon System — Universal Coverage

**User Story:** As a user encountering an unfamiliar Section anywhere in the app, I want a help icon I can click to learn what the section is, why it exists, how it relates to other sections, and how to use it, so that I never need external documentation to operate the product.

#### Acceptance Criteria

1. THE System SHALL render a Help_Icon adjacent to the heading of every Section in the product where a Section is defined as a content group with a visible heading, including but not limited to: every Page top-level Section, every Settings sub-section, every dashboard widget group, every Form fieldset that represents a distinct concept, and every list panel that has its own heading. IF the Help_Icon fails to render at runtime due to a transient error (e.g., the Help_Registry chunk failed to load), THEN the surrounding Section SHALL still render normally without the Help_Icon, and the System SHALL log the error so it surfaces in monitoring; the Section SHALL NOT be blocked or hidden by a Help_Icon failure.
2. WHEN a user activates a Help_Icon (click, tap, or keyboard Enter/Space), THE System SHALL open the Help_Panel for that Section's `sectionId`, displaying the Help_Content sourced from the Help_Registry.
3. THE Help_Panel SHALL display the four parts of Help_Content in this fixed order: (a) `what` — one-sentence definition, (b) `why` — one-sentence purpose, (c) `relates_to` — a labelled list of related Section names with clickable links that navigate to those Sections, (d) `how` — a numbered step-by-step list with at least 2 and at most 7 steps.
4. WHEN the Active_Language is English, THE Help_Panel SHALL render every part of the Help_Content in English; WHEN the Active_Language is Kurdish, THE Help_Panel SHALL render every part in Kurdish.
5. THE System SHALL render the Help_Icon as a button element with `aria-label` resolved from the i18n_Registry (e.g., "Help: {sectionName}" / "یارمەتی: {ناوی بەش}"), and SHALL make it focusable in the keyboard tab order.
6. WHEN the viewport width is at or below the Mobile_Viewport breakpoint, THE System SHALL render the Help_Panel as a bottom-sheet drawer (Drawer_Instead_Of_Modal); on larger viewports it SHALL render as a popover anchored to the Help_Icon.
7. THE Help_Panel SHALL be dismissible by clicking outside it, pressing Escape, or activating its close button.
8. WHEN navigating to a Section by any trigger — a `relates_to` link in a Help_Panel, a deep link from search, a URL with a `#sectionId` fragment, or a step in a multi-step flow — THE System SHALL use React Router's `navigate()` and SHALL scroll the target Section into view (using `scrollIntoView({ block: 'start', behavior: 'smooth' })`, falling back to `'auto'` when `prefers-reduced-motion: reduce` is set).

---

### Requirement 7: Help Icon System — Settings Sub-Section Coverage

**User Story:** As a user configuring the system in Settings, I want every single sub-section of Settings to have its own help icon and explanation, so that I can configure the product without ever guessing what a setting does.

#### Acceptance Criteria

1. THE System SHALL render a Help_Icon and corresponding Help_Content for every sub-section listed in the Settings page's `SectionDef` registry, with no exceptions, including any sub-section marked as `badge: 'soon'`.
2. WHEN a Settings sub-section is added or renamed, THE System SHALL require a corresponding entry in the Help_Registry before the change can pass the Coverage_Check; the build SHALL fail if a Settings `sectionId` is present in the route registry but missing from the Help_Registry.
3. THE Help_Content for each Settings sub-section SHALL include `relates_to` links to at least one related Section (e.g., the Currencies sub-section relates to "Multi-Currency in invoices and bills"), so that users learn how settings cascade through the product.
4. THE Help_Content for Settings sub-sections SHALL not duplicate the explanations defined in the `settings-documentation` spec — instead, this spec's Help_Registry SHALL be the rendering surface and the `settings-documentation` spec SHALL be the authoring source for the underlying text.
5. THE System SHALL render the Help_Icon for every Settings sub-section using the same component used for non-Settings Sections, so that the visual treatment is identical product-wide.

---

### Requirement 8: Help Registry — Centralized Source of Truth

**User Story:** As a content editor or developer, I want all help content to live in one structured registry keyed by section id, so that I can maintain it centrally, translate it consistently, and prevent drift between what the UI shows and what the documentation says.

#### Acceptance Criteria

1. THE System SHALL store all Help_Content in a single Help_Registry implemented as either (a) typed TypeScript records under `frontend/src/help/registry.ts`, (b) JSON files under `frontend/src/help/`, or (c) the equivalent of these structured by `sectionId`.
2. THE Help_Registry SHALL define a TypeScript type with the shape `{ sectionId: string; what: TranslationKey; why: TranslationKey; relatesTo: Array<{ label: TranslationKey; route: string }>; howSteps: TranslationKey[] }`, where every text field is a Translation_Key, not a raw literal.
3. THE Help_Registry SHALL be the only source consulted at runtime when rendering a Help_Panel — Help_Content SHALL NOT be inlined in component files.
4. THE System SHALL expose a single React hook `useHelp(sectionId)` that returns the resolved Help_Content for the Active_Language, falling back to English if a Kurdish translation is missing for a specific key, and emitting a warning to the console in development mode when such a fallback occurs. IF the `useHelp` hook fails (e.g., the Help_Registry module fails to load), THEN the System SHALL allow the Active_Language — including Kurdish — to remain selected and the surrounding Section to render normally; the hook failure SHALL NOT block language switching, force-reset the language, or crash the page.
5. WHEN a `sectionId` is referenced in JSX but does not exist in the Help_Registry, THE Coverage_Check SHALL fail the build with a message identifying the file, line, and missing `sectionId`.
6. THE Help_Registry SHALL be versioned in source control alongside the i18n_Registry, with a single canonical list of all `sectionId` values exported as a TypeScript union type used to type-check `useHelp` calls.

---

### Requirement 9: Selective Add — Behavior Specification

**User Story:** As a user navigating a section that supports adding records, I want adding to be optional when records already exist and required when the section is empty, so that I am only forced to add data when it is truly needed.

#### Acceptance Criteria

1. THE System SHALL apply Selective_Add behavior to every Section that supports adding records, where "supports adding records" means the Section exposes a primary "Add" or "Create" action.
2. WHEN a Section has at least one record, THE System SHALL render the Add action as **optional** — the Add button SHALL be visible and enabled, and the user SHALL be able to leave the Section, submit a parent Form, or proceed to the next step in a multi-step flow without adding any new record.
3. WHEN a Section has zero records, THE System SHALL render the Add action as **mandatory** — the user SHALL be blocked from leaving the Section, submitting a parent Form, or proceeding to the next step in a multi-step flow until at least one record has been added.
4. WHEN a Section's Add action is mandatory and the user attempts to proceed, THE System SHALL display an inline validation message in the Active_Language explaining that at least one record is required, and SHALL focus the Add button.
5. THE System SHALL implement the Selective_Add gate as a reusable hook or component (e.g., `useAddGate(sectionId)`) so that the same logic applies uniformly across the product, rather than being re-implemented per Section.
6. WHEN a Section's record count changes from 0 to ≥ 1 (the user just added the first record), THE Add_Gate SHALL automatically transition the Add action from mandatory to optional, and SHALL remove any "at least one required" validation message without requiring a page reload.
7. WHEN a Section's record count changes from ≥ 1 back to 0 (the user deleted the last record), THE Add_Gate SHALL automatically transition the Add action back to mandatory if the Section is currently within a multi-step flow that has not yet been completed; outside such a flow, the Add action SHALL remain optional.
8. THE System SHALL render the Empty_State of every Section that supports Selective_Add with an explicit "Add at least one to continue" prompt in the Active_Language when the Add action is mandatory.

---

### Requirement 10: Selective Add — Integration with Onboarding and Multi-Step Flows

**User Story:** As a user going through onboarding or a multi-step setup wizard, I want the system to require me to add records only when a step truly needs them, and otherwise let me skip optional steps with my existing data, so that onboarding feels respectful of my time.

#### Acceptance Criteria

1. WHEN a multi-step flow includes a step that maps to a Section with Selective_Add, THE System SHALL evaluate the Add_Gate at the moment the user attempts to advance, and SHALL block advancement only if the Section is empty.
2. WHEN onboarding asks the user to configure a Section that already has records (e.g., default tax rates seeded by the system), THE System SHALL mark that step as "Optional — already configured" in the Active_Language and SHALL allow the user to skip it.
3. THE System SHALL surface the Selective_Add status of each step in the multi-step flow's progress indicator, distinguishing between "required and incomplete", "optional", and "completed", in the Active_Language.
4. IF a multi-step flow is being completed for the first time and any of its required Sections are still empty when the user reaches the final step, THEN THE System SHALL list the unsatisfied Sections in the final step's summary with deep links back to each, in the Active_Language.

---

### Requirement 11: Bilingual Coverage — Source of Truth and Locale Files

**User Story:** As a bilingual user, I want every visible string in the product to exist in both English and Kurdish with full parity, so that I never see leaked words from the other language regardless of which language I have selected.

#### Acceptance Criteria

1. THE System SHALL maintain locale JSON files at `frontend/src/locales/en.json` and `frontend/src/locales/ku.json` as the single source of truth for all Translation_Keys; no other locale source SHALL be consulted at runtime.
2. THE i18n_Registry SHALL contain identical key sets in `en.json` and `ku.json` — the symmetric difference of the two key sets SHALL be empty.
3. THE i18n_Registry SHALL provide a non-empty translation value for every Translation_Key in both locales — empty strings, the literal `"TODO"`, or the literal `"[missing]"` SHALL count as missing translations and SHALL fail the Coverage_Check.
4. THE System SHALL resolve every user-visible string through the `t()` function, including: titles, labels, sublabels, placeholders, helper text, validation messages, empty-state text, button labels, tooltips, `aria-label` attributes, `title` attributes, image `alt` text, dialog content, toast messages, onboarding step text, and Help_Content.
5. THE System SHALL resolve every Help_Content text field through the i18n_Registry, with the Help_Registry referencing Translation_Keys rather than embedding raw strings.
6. WHEN the Active_Language is English, THE System SHALL render every visible string in English; no Kurdish word SHALL appear in any visible UI element, including Settings, Onboarding, navigation, dialogs, and forms.
7. WHEN the Active_Language is Kurdish, THE System SHALL render every visible string in Kurdish; no English word SHALL appear in any visible UI element, except for proper nouns (e.g., "Vercel", "Firebase", "Google"), product names, and code/identifier values that are intentionally untranslated and explicitly marked as such in the i18n_Registry.
8. WHERE the existing Onboarding flow currently contains Kurdish text without an English equivalent, THE System SHALL add the corresponding English Translation_Key with a complete English translation before this feature is considered done.

---

### Requirement 12: Bilingual Coverage — Settings and Onboarding Parity

**User Story:** As an English-speaking user, I want Settings and Onboarding (where Kurdish currently leaks through) to be fully translated into English, so that I never see Kurdish words when I have selected English.

#### Acceptance Criteria

1. THE System SHALL render every label, sublabel, badge, group heading, and section title in the Settings page in the Active_Language with no leaked strings from the other language.
2. THE System SHALL render every step title, step description, helper text, illustration caption, and button in the Onboarding flow in the Active_Language with no leaked strings from the other language.
3. THE System SHALL replace every hardcoded Kurdish fallback string passed as the second argument to `t(key, fallback)` (e.g., `t('users', 'بەکارهێنەران')`) with an English fallback string, and SHALL provide the Kurdish translation in `ku.json` instead.
4. THE System SHALL move every hardcoded Kurdish keyword used for navigation/search (e.g., entries inside `keywords[]` arrays containing Kurdish characters) into the i18n_Registry, so that search keywords are themselves translated and not language-mixed.
5. WHEN a Translation_Key resolves to an empty string in the Active_Language, THE System SHALL render the value from the other locale as a fallback, log a missing-translation warning at `console.warn` level in development and at a structured `warn` log level in production (so support teams can detect translation gaps from telemetry), and emit a Coverage_Check failure in CI. THE three responses (UI fallback, log emission, CI failure) SHALL be implemented as independent code paths — a failure of one (e.g., logging infrastructure unavailable) SHALL NOT prevent the others from succeeding (e.g., the UI MUST still render the fallback string and CI MUST still flag the missing key).
6. THE System SHALL provide an English equivalent for every short description currently used to describe Sections and Help_Content in Kurdish, such that the Help_Registry and the Section description registry have full English parity at release time.

---

### Requirement 13: Bilingual Coverage — Automated Coverage Checks (Lint and CI)

**User Story:** As a maintainer, I want CI to fail when any string is left untranslated or hardcoded, so that translation gaps are caught at PR review time rather than discovered in production.

#### Acceptance Criteria

1. THE System SHALL include a CI job named `i18n-coverage` that runs on every pull request and on the `main` branch, and SHALL fail the build if any of the following conditions are detected.
2. THE `i18n-coverage` job SHALL fail if the symmetric difference of the key sets of `en.json` and `ku.json` is non-empty, and SHALL print the missing keys per locale.
3. THE `i18n-coverage` job SHALL fail if any Translation_Key has an empty string, a `null` value, the literal `"TODO"`, or the literal `"[missing]"` in either `en.json` or `ku.json`.
4. THE System SHALL include a static-analysis lint rule (custom ESLint rule or equivalent) named `no-hardcoded-literal` that scans `frontend/src/**/*.tsx` and `frontend/src/**/*.ts` for user-visible string literals not resolved through `t()`, and SHALL fail the lint on detected violations.
5. THE `no-hardcoded-literal` rule SHALL apply to JSX text content, JSX attribute values for `title`, `aria-label`, `placeholder`, `alt`, and to props named `label`, `tooltip`, `description`, `message`, or `text` on Ant Design / shadcn-ui components, with an explicit allowlist of safe-to-skip identifiers (e.g., `data-testid` values, route paths, class names).
6. THE `i18n-coverage` job SHALL fail if any `sectionId` referenced in JSX via `useHelp(sectionId)` is missing from the Help_Registry, or if any `sectionId` in the Help_Registry references a Translation_Key missing from `en.json` or `ku.json`.
7. THE `i18n-coverage` job SHALL produce a coverage summary printed to the CI logs, listing total Translation_Keys, total Help_Registry entries, and the per-locale completion percentage. AT release time, every individual locale's completion percentage SHALL equal 100 % — release SHALL be blocked if any single locale (e.g., `ku`) reports less than 100 %, even if the aggregate percentage averaged across locales appears higher; release readiness SHALL be the per-locale minimum, not an average.
8. THE System SHALL include a Playwright end-to-end test that loads the home page, the Settings page, and the Onboarding flow once with `localStorage.app_language = 'en'` and once with `localStorage.app_language = 'ku'`. THE test SHALL inspect only **user-visible** text nodes — elements whose computed style is not `display: none` or `visibility: hidden`, that are not inside `aria-hidden="true"` ancestors, and that are not test-only artifacts (e.g., elements marked with the attribute `data-i18n-test="ignore"`) — and SHALL fail if any such visible text node contains characters from the other language's primary script (Latin vs. Arabic-script). Cross-script characters appearing only in hidden elements, test scaffolding, or proper-noun allowlist entries SHALL NOT trigger a failure.

---

### Requirement 14: Accessibility (WCAG AA) — Cross-Cutting

**User Story:** As a user with assistive needs (keyboard-only, screen reader, reduced motion, high contrast), I want every page, dialog, and interactive component to meet WCAG AA conformance, so that the entire product is accessible.

#### Acceptance Criteria

1. THE System SHALL meet WCAG_AA color contrast on every text element: ≥ 4.5:1 for normal text and ≥ 3:1 for large text and UI components, in both Light_Mode and Dark_Mode.
2. THE System SHALL provide full keyboard operability for every interactive element: Tab and Shift+Tab for focus movement, Enter and Space for activation, Escape for closing overlays, Arrow keys for menus, listboxes, and radio groups.
3. THE System SHALL render a visible focus ring on every interactive element when focused via the keyboard, sourced from `theme/tokens.ts`, and SHALL NOT remove focus rings via `outline: none` without providing a replacement focus indicator that meets the WCAG_AA non-text contrast requirement.
4. WHEN a Dialog or overlay opens, THE System SHALL move focus to the first interactive element inside it, trap focus within it while open, and return focus to the triggering element when it closes. WHEN no Dialog or overlay is currently open, THE System SHALL NOT trap focus on the page — focus SHALL be free to traverse the natural document tab order.
5. THE System SHALL set `aria-label` or `aria-labelledby` on every interactive element that lacks visible text, sourced from the i18n_Registry.
6. THE System SHALL announce dynamic content changes (toasts, validation summaries, lockout countdowns) via `aria-live` regions with appropriate politeness levels.
7. WHEN the Active_Language is Kurdish (or any other RTL locale), THE System SHALL apply RTL layout (`dir="rtl"`) at the document root, mirror directional icons (chevrons, arrows), and use logical CSS properties (`inline-start`, `inline-end`, `padding-inline`, `margin-inline`) so that mirrored layouts are correct without ad-hoc fixes per component. WHEN the Active_Language is English (or any other LTR locale), THE System SHALL NOT activate RTL-specific behaviors — icon mirroring SHALL be off, and `dir="ltr"` SHALL be applied at the document root — so that LTR users are not exposed to mirrored layouts.
8. THE System SHALL achieve a Lighthouse Accessibility score of at least 95 on the home page, login page, dashboard, and Settings page, measured in CI; IF the score drops below 95, THEN the CI build SHALL fail.
9. WHEN the user's device reports `prefers-reduced-motion: reduce`, THE System SHALL disable non-essential animations (page transitions, particle effects, parallax, decorative motion) while preserving functional motion (focus rings, loading indicators, validation animations).

---

### Requirement 15: Performance — No Mobile Regression

**User Story:** As a mobile user on a mid-range device and a slow network, I want this UX overhaul not to make the app slower, so that responsiveness, help icons, and translation infrastructure pay for themselves in usability without paying in performance.

#### Acceptance Criteria

1. THE System SHALL achieve a Lighthouse Performance score of at least 85 on a Mobile_Viewport profile (Slow 4G: 1.6 Mbps / 150 ms RTT, mid-tier CPU throttle) for the home page, login page, dashboard, and any list page, measured in CI; the Performance score SHALL NOT regress by more than 3 points compared to the baseline measured before this feature is implemented.
2. THE System SHALL keep Largest Contentful Paint (LCP) at or below 2.5 seconds on the Mobile_Viewport profile for the home page and login page.
3. THE System SHALL keep Cumulative Layout Shift (CLS) at or below 0.1 on every Page measured in CI.
4. THE System SHALL keep Interaction-to-Next-Paint (INP) at or below 200 ms on the Mobile_Viewport profile for the dashboard and any list page.
5. THE System SHALL load the Help_Registry and the Help_Panel UI lazily — the help bundle SHALL NOT be included in the initial JavaScript bundle for any route, and SHALL be fetched on first activation of any Help_Icon. IF the lazy fetch of the help bundle fails (e.g., network error, offline, CDN failure), THEN the System SHALL gracefully degrade by displaying a minimal inline help fallback (e.g., a short "Help is temporarily unavailable. Please try again." message in the Active_Language) sourced from the always-bundled i18n_Registry, and SHALL retry the fetch on the next Help_Icon activation; the surrounding Section SHALL remain fully usable.
6. THE System SHALL load locale JSON files via dynamic import keyed by Active_Language — only the active locale SHALL be loaded on initial render, and the inactive locale SHALL be loaded on first language switch.

---

### Requirement 16: Content Registries — Versioning and Maintenance

**User Story:** As a content owner, I want the help content and the translations to live in versioned, structured registries, so that I can update them centrally without hunting through component files.

#### Acceptance Criteria

1. THE System SHALL maintain the i18n_Registry (`en.json`, `ku.json`) and the Help_Registry under source control with the rest of the frontend codebase.
2. THE System SHALL include a script (e.g., `npm run i18n:report`) that prints, for each locale, the total Translation_Key count, the count of empty values, and the count of values longer than 240 characters (so editors can spot truncation candidates).
3. THE System SHALL include a script (e.g., `npm run help:report`) that prints, for each `sectionId` in the Help_Registry, the locale completion status of all four parts (`what`, `why`, `relatesTo`, `howSteps`).
4. THE System SHALL define a single canonical list of all `sectionId` values as a TypeScript union type exported from `frontend/src/help/sectionIds.ts`, and SHALL use that type for both `useHelp` arguments and Help_Registry keys, so that adding or removing a `sectionId` is a typed, traceable change.
5. THE System SHALL include a CHANGELOG entry pattern that flags every new or removed Translation_Key and every new or removed `sectionId`, so that release notes can summarize content changes.

---

### Requirement 17: Cross-Spec Alignment — No Duplication

**User Story:** As a developer working across multiple specs in this workspace, I want this umbrella spec to reference and extend the sibling specs without duplicating their requirements, so that I have one canonical place for each rule.

#### Acceptance Criteria

1. THE System SHALL treat the `settings-documentation` spec as the authoring source for Settings sub-section help text; THIS spec SHALL define the rendering, registry, and coverage rules but SHALL NOT redefine the per-Settings-section content already specified there.
2. THE System SHALL treat the `nav-settings-cleanup` spec's Add_Option-on-Empty-Select rule as a special case of Selective_Add scoped to Empty_Select components; THIS spec SHALL extend the rule to **all** Sections that support adding records, with consistent Active_Language behavior.
3. THE System SHALL adopt the design tokens, RTL rules, and accessibility rules from the `ui-redesign-modern` spec as the implementation foundation; THIS spec SHALL NOT redefine `theme/tokens.ts` or the breakpoint set.
4. THE System SHALL apply this spec's responsive, help, and bilingual rules to the public landing and auth pages defined by the `landing-auth-vercel-redesign` spec, including the `Landing_Page`, `Login_Page`, and `SignUp_Page`.
5. WHEN a conflict is found between this spec and a sibling spec at implementation time, THE System SHALL resolve the conflict by treating this spec as the cross-cutting umbrella and the sibling spec as the local source, escalating the conflict to design review rather than silently overriding either.

---

### Requirement 18: System-Wide Definition of Done

**User Story:** As a release owner, I want a clear, verifiable Definition of Done for this feature that proves the five pillars hold across the entire product, so that we can ship it with confidence and not page-by-page.

#### Acceptance Criteria

1. THE System SHALL be considered done only when **every** Page in the application's route registry passes the following checks: (a) no horizontal page-level overflow at 320 px viewport width, (b) every Section on the Page has a Help_Icon wired to a Help_Registry entry, (c) every Section that supports adding records has a working Add_Gate, (d) every visible string is resolved through the i18n_Registry in both Active_Languages.
2. THE System SHALL include an end-to-end Playwright test suite that walks every route in the route registry on three viewports (320 px, 768 px, 1280 px) in both Active_Languages, and SHALL fail if any of the four checks above are violated on any route.
3. THE System SHALL block release if the `i18n-coverage` CI job, the `no-hardcoded-literal` lint rule, or the route-walk Playwright test fails on the release branch.
4. THE System SHALL produce a release readiness report listing, per route: Help_Icon coverage percentage, Selective_Add coverage percentage, i18n coverage percentage, and the Lighthouse Performance / Accessibility scores on Mobile_Viewport; release SHALL require 100 % on the first three and ≥ 85 / ≥ 95 on the last two respectively.
5. WHEN a new Page is added to the route registry after this feature ships, THE System SHALL fail CI if the new Page does not satisfy the same Definition of Done, so that the quality bar holds going forward.
