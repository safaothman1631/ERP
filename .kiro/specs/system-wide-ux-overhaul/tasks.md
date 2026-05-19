# Implementation Plan: System-Wide UX Overhaul

## Overview

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

The implementation follows the **File / Module Layout** from `design.md`:

- Build the foundation (`useViewport`, i18n contract, proper-noun allowlist, perf-budgets) first.
- Add the umbrella runtime layer (`useHelp`, `useAddGate`, the four `Responsive*` wrappers, `EmptyState`).
- Wire CI gates (`i18n-coverage`, `no-hardcoded-literal`, `no-physical-direction-css`, `no-ua-layout-detection`, `bundle-budget`, `release-readiness`, route-walk).
- Apply the umbrella system-wide (replace existing dialogs/forms/tables/charts with `Responsive*`, add Help_Icons to every Section, wire AddGates).
- Validate via property tests (P1–P10), Lighthouse, and Axe.

Implementation language: **TypeScript** (matches every code example in `design.md`; `frontend/` is a React + TypeScript codebase).
PBT library: **`fast-check`** with `@fast-check/vitest`, already a dev dependency per `design.md` Testing Strategy. Property tests target ≥ 100 iterations and live in `frontend/src/system-wide-ux-overhaul.pbt.test.ts` with shared generators under `__generators__/`.

## Tasks

- [x] 1. Foundation — viewport, tokens consumption, perf budgets, proper-noun allowlist
  - [x] 1.1 Add the `useViewport()` hook as the single source of truth for viewport-width decisions
    - Create `frontend/src/hooks/useViewport.ts` exporting `Viewport` type and `useViewport()` returning `{ viewport, isMobile, isTablet, isDesktop }`.
    - Use `window.matchMedia` listeners on `sm` (640), `md` (768), `lg` (1024), `xl` (1280); SSR-safe defaults.
    - Forbid any branching on `navigator.userAgent`, `navigator.userAgentData`, or `pointer: coarse` inside the hook.
    - _Requirements: 2.4, 4.1, 4.5, 4.7_

  - [x] 1.2 Write unit tests for `useViewport` boundaries
    - Mock `matchMedia`; verify classification at 320, 640, 641, 768, 1024, 1280, 1281.
    - Verify SSR-safe default (no `window`) returns `desktop`.
    - _Requirements: 2.4, 2.6, 4.1, 4.5_

  - [x] 1.3 Add the proper-noun allowlist and `TranslationKey` types
    - Create `frontend/src/i18n/properNouns.ts` exporting `PROPER_NOUNS` (`Vercel`, `Firebase`, `Google`, `Apple`, `AntD`, `Tailwind`, `GitHub`, `Stripe`, `iOS`, `Android`, `WCAG`, `ERPIQ`).
    - Create `frontend/src/i18n/types.ts` exporting a branded `TranslationKey` type.
    - _Requirements: 11.7, 13.4, 13.5_

  - [x] 1.4 Add the per-route bundle budget configuration
    - Create `frontend/perf-budgets.json` with the JSON shape from design (`defaults`, `routes`, `noRegressionDeltaPoints: 3`).
    - Seed entries for `/`, `/login`, `/signup` (250 KB public) and `/dashboard`, `/sales/invoices` (350 KB auth).
    - _Requirements: 5.6, 15.1_

  - [x] 1.5 Reserve a Lighthouse no-regression baseline file
    - Create `frontend/perf-baseline.json` with placeholder per-route Performance/Accessibility numbers (to be backfilled by the first CI run).
    - Document update procedure as a comment in the file.
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 14.8_

  - [x] 1.6 Per-locale dynamic loading in `frontend/src/i18n.ts`
    - Switch `i18next.init` to `load: 'currentOnly'`, `partialBundledLanguages: true`.
    - Add `loaders: Record<Language, () => Promise<Resource>>` for `en` and `ku` using dynamic `import()` of `./locales/*.json`.
    - On `languageChanged`, lazy-add the resource bundle for the target locale and recover gracefully on fetch failure (toast in previous locale, no crash, no language reset).
    - _Requirements: 8.4, 11.1, 12.5, 15.5, 15.6_

- [ ] 2. Help Registry & Help System
  - [x] 2.1 Define the `SectionId` union and registry types
    - Create `frontend/src/help/sectionIds.ts` exporting `SECTION_IDS as const` and `SectionId = typeof SECTION_IDS[number]`.
    - Seed entries for known Sections: `settings.currencies`, `settings.fiscal`, `settings.taxes`, `sales.invoices`, `sales.invoices.lineItems`, `dashboard.kpis`, plus every Settings sub-section listed in the existing `SectionDef` registry (cross-referenced from `nav-settings-cleanup` / `settings-documentation`).
    - _Requirements: 8.6, 16.4_

  - [x] 2.2 Implement the Help_Registry data structure
    - Create `frontend/src/help/registry.ts` exporting `HelpEntry`, `HelpRegistry`, and `helpRegistry: HelpRegistry`.
    - All text fields are `TranslationKey` references (no raw literals).
    - Branded `howSteps` type that constrains length to `[2, 7]` at compile time.
    - Configure Vite `rollupOptions.output.manualChunks` to split `help/registry.ts` into a `help` chunk (lazy-loaded).
    - _Requirements: 8.1, 8.2, 8.3, 8.6, 15.5, 16.1, 16.4_

  - [x] 2.3 Implement the `useHelp(sectionId)` hook with graceful failure
    - Create `frontend/src/help/useHelp.ts` returning `ResolvedHelp` with `unavailable`, `fellBack` flags.
    - Dynamic-import `helpRegistry`; on chunk-load failure, return inline-fallback values from the always-bundled i18n registry (`help.unavailable.message`).
    - Per-key ku → en fallback with `console.warn` in development and structured `warn` log in production.
    - Hook NEVER throws, NEVER blocks language switching, NEVER force-resets language, NEVER crashes the section.
    - _Requirements: 6.1, 6.4, 8.4, 12.5, 15.5_

  - [x] 2.4 Property test for Help registry coverage and shape
    - **Property 3: Help registry coverage (`useHelp` ↔ registry ↔ i18n)**
    - **Validates: Requirements 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.5, 8.6, 13.6, 16.4**
    - For all `sectionId` referenced via `useHelp(sectionId)` in any `.tsx` file, assert `sectionId ∈ helpRegistry`.
    - For all `e ∈ helpRegistry`: `e.what`, `e.why`, every `e.relatesTo[i].label`, and every `e.howSteps[j]` exist in both `en.json` and `ku.json` with non-empty values; `2 ≤ e.howSteps.length ≤ 7`.
    - For all Settings `sectionId` from the Settings `SectionDef` registry: `helpRegistry[id]` exists and `e.relatesTo.length ≥ 1`.

  - [x] 2.5 Property test for fallback independence (three paths)
    - **Property 10: Fallback independence (UI / log / CI signal)**
    - **Validates: Requirements 6.1, 8.4, 12.5, 15.5**
    - Generate arbitrary subsets `S ⊊ {ui, log, ci}`; simulate failure of each subset; assert remaining paths still execute their effect.

  - [x] 2.6 Implement `HelpPanel` component
    - Create `frontend/src/help/HelpPanel.tsx` rendering `what → why → relatesTo → howSteps` in fixed order.
    - On Mobile_Viewport render as bottom-sheet drawer; otherwise as a popover anchored to `anchorEl`.
    - Dismissible by Escape, outside click, close button. Focus trap on open; focus returns to trigger on close.
    - `relatesTo` items are `<Link>` elements that call React Router `navigate()` and `scrollIntoView({ block: 'start', behavior: prefersReducedMotion ? 'auto' : 'smooth' })`.
    - _Requirements: 6.3, 6.6, 6.7, 6.8, 14.4_

  - [x] 2.7 Implement `HelpIcon` component
    - Create `frontend/src/help/HelpIcon.tsx` rendering a `<button>` with i18n-resolved `aria-label` (e.g., `helpIcon.ariaLabel` formatted with `sectionName`).
    - Keyboard activation by Enter/Space; rendered adjacent to a Section heading.
    - When `useHelp` returns `unavailable: true`, render nothing (or inline fallback) and log a structured `warn`; surrounding Section continues to render.
    - Same component used for non-Settings Sections AND every Settings sub-section (visual treatment identical product-wide).
    - _Requirements: 6.1, 6.2, 6.5, 7.5, 14.2_

  - [x] 2.8 Unit tests for `HelpPanel` + `HelpIcon`
    - Render order assertion (`what → why → relatesTo → howSteps`).
    - Dismissal via Escape, outside click, close button.
    - `useHelp` rejection → `HelpIcon` renders nothing AND surrounding Section still renders.
    - _Requirements: 6.1, 6.3, 6.7, 8.4_

- [ ] 3. Selective Add System
  - [x] 3.1 Implement the `useAddGate(sectionId)` hook
    - Create `frontend/src/components/AddGate/useAddGate.ts` exporting `AddGateState` and `useAddGate`.
    - Implement the state machine: `mode` derived from `recordCount` and `flow`; transitions clear `blockedMessage` on `0 → ≥ 1`; re-promote to `mandatory` only inside an incomplete flow on `≥ 1 → 0`.
    - Return `emptyStateCtaKey` (e.g., `addGate.atLeastOneRequired`) and `blockedMessageKey`.
    - _Requirements: 9.2, 9.3, 9.5, 9.6, 9.7_

  - [x] 3.2 Property test for AddGate monotonicity and transitions
    - **Property 4: AddGate monotonicity and transition correctness**
    - **Validates: Requirements 9.2, 9.3, 9.5, 9.6, 9.7, 10.1**
    - Generators in `frontend/src/components/AddGate/__generators__/` for `recordCount`, `flow`, transitions.
    - Assert `mode(s) = 'mandatory' ⇔ s.recordCount === 0`; assert transition rules per the formal state machine in design.

  - [x] 3.3 Implement `AddGateProvider` and shared store
    - Create `frontend/src/components/AddGate/AddGateProvider.tsx` with the `AddGateStore` (records, flows, `setRecordCount`, `registerFlow`, `advance(flowId)`).
    - `advance` returns `{ ok: false, blockedSection }` when a required Section is empty; on success advances the step.
    - Surface step status as `required-incomplete` | `optional` | `completed`.
    - On the final step, expose unsatisfied required Sections with deep links.
    - _Requirements: 9.4, 10.1, 10.2, 10.3, 10.4_

  - [x] 3.4 Implement shared `EmptyState` component
    - Create `frontend/src/components/AddGate/EmptyState.tsx`.
    - Renders illustration/icon, one-sentence description, primary CTA — all from `t()`.
    - When `mandatory`, description switches to the mandatory CTA copy ("Add at least one to continue").
    - Reusable by every Section, including the `nav-settings-cleanup` Empty-Select escape-hatch (no duplicate component).
    - _Requirements: 1.4, 9.8, 17.2_

  - [x] 3.5 Unit tests for `AddGateProvider.advance`
    - Blocks on empty required Section, returns `blockedSection`.
    - "Optional — already configured" path skips a satisfied step.
    - Final-step summary lists unsatisfied required Sections.
    - _Requirements: 9.4, 10.2, 10.4_

- [ ] 4. Responsive Patterns Catalog
  - [x] 4.1 Implement `ResponsiveDialog` (drawer-instead-of-modal)
    - Create `frontend/src/components/responsive/ResponsiveDialog.tsx` with the props shape from design.
    - Mobile_Viewport renders as bottom sheet with drag handle, swipe-to-dismiss threshold ≥ 30 % height, primary action in bottom 25 % thumb zone (≥ 44 px tall).
    - Above 640 px renders as centered modal with `max-inline-size` from `tokens.ts`.
    - Sticky header + footer; body is the only scrollable region; background scroll-lock; focus trap; focus returns to trigger; Escape, outside-click, close-button dismissal.
    - Logical-CSS only (`inline-start` / `inline-end`).
    - _Requirements: 1.7, 1.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 5.1, 5.4, 6.6_

  - [x] 4.2 Implement `ResponsiveTable` (table → cards)
    - Create `frontend/src/components/responsive/ResponsiveTable.tsx` with `ResponsiveColumn<T>` (`priority: 'high' | 'medium' | 'low'`).
    - Mobile_Viewport: render rows as cards with stacked label/value pairs; same data + same row actions; horizontal-swipe reveals actions with a tap-only equivalent path.
    - Above Mobile_Viewport: traditional grid table with sortable columns and sticky header.
    - When `> 5` columns and viewport ≤ Tablet, only `priority: 'high'` columns render; rest behind per-row "Show more".
    - Decision driven by `useViewport()` width only (no UA detection).
    - _Requirements: 4.1, 4.2, 4.3, 5.3_

  - [x] 4.3 Implement `ResponsiveForm` (single-column on mobile, ≥ 44 px touch targets)
    - Create `frontend/src/components/responsive/ResponsiveForm.tsx`.
    - All inputs/selects/buttons/checkboxes/radios/switches/date-picker triggers have `min-block-size: 44px` on Mobile_Viewport.
    - Adjacent Touch_Targets ≥ 8 px spacing via a `formSpacing` token group from `tokens.ts`.
    - Forced single-column on Mobile_Viewport regardless of declared `layout`.
    - Line-item subforms render as expandable cards on Mobile_Viewport with most-important fields visible by default.
    - _Requirements: 4.4, 4.5, 4.8, 5.1, 5.2_

  - [x] 4.4 Implement `ResponsiveChart` (legend reflow)
    - Create `frontend/src/components/responsive/ResponsiveChart.tsx` wrapping recharts `<ResponsiveContainer>`.
    - 100 % inline width; minimum visible block size 240 px on Mobile_Viewport (default, configurable).
    - Measure intrinsic legend inline-size with `ResizeObserver`; if `intrinsicLegendInlineSize > containerInlineSize`, move legend below chart and allow wrap.
    - No UA detection.
    - _Requirements: 4.6, 4.7_

  - [x] 4.5 Touch-target utility & RTL / safe-area shell
    - Create `frontend/src/components/responsive/clickable.css` exporting `.touchTarget` mixin (`min-block-size`/`min-inline-size: 44px`; sibling spacing 8 px).
    - Apply `padding-inline-*` and `padding-block-*` with `env(safe-area-inset-*)` to root layout containers (`AppShell` content region, `AuthLayout`) and full-screen Dialogs.
    - Set document root `dir` in `App.tsx` from Active_Language (`ku → rtl`, `en → ltr`).
    - _Requirements: 2.5, 2.7, 3.8, 5.1, 5.2, 14.7_

  - [x] 4.6 Property test for no horizontal page overflow
    - **Property 5: Responsive invariant — `scrollWidth ≤ clientWidth`**
    - **Validates: Requirements 2.1, 2.5, 4.1, 18.1, 18.2**
    - Generate `(route, viewport ∈ {320, 768, 1280}, locale ∈ {en, ku})` triples; assert `document.scrollingElement.scrollWidth ≤ clientWidth` after mount and data settle.

  - [x] 4.7 Property test for touch-target sizing and spacing
    - **Property 7: Touch target sizing and spacing**
    - **Validates: Requirements 4.4, 5.1, 5.2**
    - For all rendered Touch_Target elements at viewport ≤ 640 px, assert hit area ≥ 44 × 44 px (computed including `::before` extension or padding) and adjacent-pair distance ≥ 8 px.

  - [x] 4.8 Property test for Dialog focus discipline
    - **Property 8: Dialog focus discipline**
    - **Validates: Requirements 3.5, 6.7, 14.4**
    - For all Dialog instances: focus moves into the dialog on open, Tab/Shift+Tab cycles only inside while open, focus returns to trigger on close. No focus trap when no Dialog is open.

  - [x] 4.9 Unit tests for `ResponsiveDialog`, `ResponsiveTable`, `ResponsiveChart`
    - Sticky header/footer on overflow body; scroll lock on background; primary action in bottom 25 % on mobile.
    - High-priority columns retained on mobile; "Show more" reveal on mobile-card row.
    - Legend reflow when measured intrinsic legend inline-size > container; min block size 240 px on mobile.
    - _Requirements: 3.1, 3.3, 3.6, 4.3, 4.6, 4.7_

- [x] 5. Checkpoint — Foundation, Help, AddGate, Responsive wrappers
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. i18n Registry, Hardcoded-Literal Replacements, Bilingual Parity
  - [x] 6.1 Replace hardcoded Kurdish fallbacks in `t(key, fallback)` call sites
    - Replace every `t('users', 'بەکارهێنەران')`-style call with an English fallback (e.g., `t('users', 'Users')`).
    - Move the Kurdish translations into `ku.json`.
    - _Requirements: 12.3_

  - [x] 6.2 Move hardcoded Kurdish nav/search keywords into the i18n registry
    - Move `keywords[]` arrays containing Kurdish characters (e.g., `'یارمەتی'`, `'دۆکیومێنت'`, `'ڕووکار'`) into `ku.json`; nav search resolves per-locale.
    - _Requirements: 12.4_

  - [x] 6.3 Add Settings Help_Content translation keys to both locales
    - For every Settings sub-section in `SectionDef`, add `what` / `why` / `relatesTo[].label` / `howSteps[]` keys to both `en.json` and `ku.json`.
    - Values for Settings keys are owned by `settings-documentation` (rendering surface only here).
    - Each Settings entry includes ≥ 1 `relatesTo` link to a non-Settings Section.
    - _Requirements: 7.1, 7.3, 7.4, 11.5, 12.6, 17.1_

  - [x] 6.4 Backfill missing translations across the existing key set
    - Translate every `en.json` key that lacks a Kurdish equivalent and vice versa; replace `""`, `null`, `"TODO"`, `"[missing]"` placeholders.
    - Add the always-bundled `help.unavailable.message` key to both locales.
    - _Requirements: 11.2, 11.3, 11.6, 11.7, 11.8, 12.1, 12.2_

  - [x] 6.5 Property test for i18n key-set parity
    - **Property 1: i18n key-set parity**
    - **Validates: Requirements 11.1, 11.2, 11.3, 13.2, 13.3, 13.7, 16.1, 16.2**
    - For all keys `k`: `k ∈ en.json ⇔ k ∈ ku.json`; values are non-empty (rejects `""`, `null`, `"TODO"`, `"[missing]"`).

  - [x] 6.6 Property test for language purity in rendered text
    - **Property 6: Language purity in rendered text**
    - **Validates: Requirements 11.6, 11.7, 12.1, 12.2, 13.8**
    - For all visible text nodes (excluding `display: none`, `visibility: hidden`, `aria-hidden="true"` ancestors, `data-i18n-test="ignore"`), assert no cross-script characters appear in the active locale (proper-noun allowlist exempt).

- [ ] 7. CI / Lint Enforcement
  - [x] 7.1 Implement the `no-hardcoded-literal` ESLint rule
    - Create `frontend/eslint-rules/no-hardcoded-literal.js`.
    - Scan JSX text content and the JSX attributes `title`, `aria-label`, `placeholder`, `alt`; scan props named `label`, `tooltip`, `description`, `message`, `text` on AntD/shadcn components.
    - Allowlist `data-testid`, route paths, class names, `PROPER_NOUNS`.
    - Wire into `eslint.config.js` (or `eslint.config.mjs`).
    - _Requirements: 11.4, 13.4, 13.5_

  - [x] 7.2 Implement the `no-physical-direction-css` lint rule
    - Extend `frontend/scripts/rtl-audit.mjs` (or add a Stylelint config) to flag raw `left:`/`right:`/`margin-left`/`padding-right`/`text-align: left|right` outside `theme/tokens.ts` and the existing exemption list.
    - Tighten the existing `rtl-audit` CI step to **blocking** (remove `continue-on-error: true`) once pre-existing violations in `LandingPage.tsx`, `POSFloorPlan.tsx`, `KitchenDisplay.tsx` are resolved.
    - _Requirements: 3.8, 14.7_

  - [x] 7.3 Implement the `no-ua-layout-detection` lint rule
    - Add a custom ESLint rule (or grep-based script) forbidding `navigator.userAgent`, `navigator.userAgentData`, and `matchMedia('(pointer: coarse)')` in `frontend/src/components/responsive/**` and `frontend/src/layouts/**`.
    - _Requirements: 4.1, 4.5, 4.7_

  - [x] 7.4 Implement the `i18n-coverage` script and CI job
    - Create `frontend/scripts/i18n-coverage.mjs` enforcing P1 + P3 conditions.
    - Symmetric-difference check; reject `""`, `null`, `"TODO"`, `"[missing]"`.
    - Walk `.tsx` for every `useHelp(id)` call site; fail when `id` not in `helpRegistry`.
    - Walk `helpRegistry` entries; fail when any referenced key is missing in either locale or `howSteps.length` is outside `[2, 7]`.
    - Print coverage summary; per-locale 100 % gate (never average).
    - Add `npm run i18n:coverage` script and wire into `.github/workflows/ci-quality.yml` as a new job.
    - _Requirements: 7.2, 8.5, 13.1, 13.2, 13.3, 13.6, 13.7_

  - [-] 7.5 Implement the `i18n:report` and `help:report` scripts
    - Create `frontend/scripts/i18n-report.mjs` (per-locale total keys, empty values, values longer than 240 chars).
    - Create `frontend/scripts/help-report.mjs` (per-`sectionId` locale completion of `what` / `why` / `relatesTo` / `howSteps`).
    - Add `npm run i18n:report` and `npm run help:report`.
    - _Requirements: 16.2, 16.3_

  - [-] 7.6 Implement the `bundle-budget` CI job
    - Add a CI step reading `frontend/perf-budgets.json`; measure per-route gzipped initial-JS bundle via Vite's `rollup-plugin-visualizer` metadata or `import-meta` chunk reports.
    - Fail when any measured route exceeds its configured budget.
    - _Requirements: 5.6, 15.1_

  - [x] 7.7 Extend the `lighthouse` CI job for thresholds and no-regression
    - Update `frontend/lighthouserc.json` to enforce Performance ≥ 85, Accessibility ≥ 95, LCP ≤ 2.5 s on `/` and `/login`, CLS ≤ 0.1 every route, INP ≤ 200 ms on `/dashboard` and a sample list route.
    - No-regression delta vs `frontend/perf-baseline.json` minus 3 points.
    - Routes: `/`, `/login`, `/dashboard`, `/settings`, sample list (`/sales/invoices`).
    - _Requirements: 5.5, 14.8, 15.1, 15.2, 15.3, 15.4_

  - [x] 7.8 Add Axe accessibility smoke tests for measured routes
    - Use `@axe-core/playwright` in `frontend/e2e/05-a11y-axe.spec.ts` (extend existing) to assert zero serious or critical violations on `/`, `/login`, `/dashboard`, `/settings`, and a sample list route.
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.6, 14.8_

- [ ] 8. Route-Walk End-to-End Suite (Definition of Done)
  - [x] 8.1 Implement the route-walk Playwright spec
    - Create `frontend/tests/e2e/route-walk.spec.ts` that walks every entry in the route registry on viewports `{320, 768, 1280}` × locales `{en, ku}`.
    - Assert P5 (no horizontal overflow), P6 (visible-text-node language matches active locale, skipping `display: none`, `visibility: hidden`, `aria-hidden="true"`, `data-i18n-test="ignore"`), P9 (every Section has a Help_Icon resolving to a registry entry; every Add-supporting Section uses `useAddGate`).
    - _Requirements: 13.8, 18.1, 18.2_

  - [x] 8.2 Property test for the Definition-of-Done conjunction
    - **Property 9: DoD conjunction (per-route)**
    - **Validates: Requirements 18.1, 18.2, 18.4, 18.5**
    - For every route `r`: simultaneously assert no overflow at 320 px; full Help coverage; full AddGate coverage; full i18n parity for visible text.

  - [x] 8.3 Implement the release-readiness report script
    - Create `frontend/scripts/release-readiness.mjs` aggregating per-route Help_Icon coverage %, AddGate coverage %, i18n parity %, Lighthouse Performance, Accessibility.
    - Block release when any cell falls below threshold (`100 %`, `100 %`, `100 %`, `≥ 85`, `≥ 95`).
    - Emit a markdown report consumed by the CI summary.
    - _Requirements: 18.3, 18.4_

  - [x] 8.4 New-route safeguard
    - Wire route-walk and `help-registry-coverage` to run on every PR (including PRs adding a new route); failures block merge.
    - _Requirements: 18.5_

- [x] 9. Checkpoint — i18n parity and CI gates
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. System-Wide Application & Sibling-Spec Wiring
  - [x] 10.1 Migrate every existing modal/Drawer to `ResponsiveDialog`
    - Sweep `frontend/src/**/*.tsx` for AntD `<Modal>` and `<Drawer>` usages; replace with `ResponsiveDialog` (preserving `suppressSwipeDismiss` for unsaved-changes guards).
    - Wire React Router `useBlocker` for unsaved-changes guard, rendering a confirmation `ResponsiveDialog`.
    - _Requirements: 1.7, 1.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_

  - [x] 10.2 Migrate every existing data table to `ResponsiveTable`
    - Sweep list pages and tables; assign `priority` to each column; replace AntD/native tables with `ResponsiveTable`.
    - _Requirements: 4.1, 4.2, 4.3, 5.3_

  - [x] 10.3 Migrate every existing form to `ResponsiveForm`
    - Sweep create/edit/settings/search/filter forms; wrap with `ResponsiveForm`; ensure ≥ 44 px touch targets and ≥ 8 px spacing on Mobile_Viewport; render line items as expandable cards on mobile.
    - _Requirements: 1.5, 1.6, 4.4, 4.5, 4.8, 5.1, 5.2_

  - [x] 10.4 Migrate every existing chart to `ResponsiveChart`
    - Sweep recharts usages (dashboard widgets, KPI cards); wrap with `ResponsiveChart`; verify legend reflow on Mobile_Viewport.
    - _Requirements: 4.6, 4.7_

  - [x] 10.5 Add `<HelpIcon>` next to every Section heading in the product
    - For every Page top-level Section, every Settings sub-section, every dashboard widget group, every Form fieldset that represents a distinct concept, and every list panel with its own heading.
    - Same component product-wide; identical visual treatment for Settings and non-Settings.
    - _Requirements: 6.1, 6.5, 7.1, 7.5_

  - [x] 10.6 Wire `useAddGate(sectionId)` into every Section that exposes Add/Create
    - Sweep Sections with primary "Add" / "Create" action; replace inline gating logic with `useAddGate(sectionId)`; render mandatory `EmptyState` CTA when `mode === 'mandatory'`.
    - Reuse `EmptyState` for the `nav-settings-cleanup` Empty-Select escape-hatch (no duplicate component).
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.8, 17.2_

  - [x] 10.7 Integrate `AddGateProvider` with onboarding and multi-step flows
    - Wrap onboarding and multi-step setup wizards in `AddGateProvider`; bind each step to a `sectionId`.
    - Surface step status in the progress indicator (`required-incomplete` | `optional` | `completed`); mark already-configured steps "Optional — already configured" in Active_Language; final-step summary lists unsatisfied required Sections with deep links.
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 10.8 Apply unified loading, error, and success patterns
    - Replace blank-white loading screens with `Skeleton_Loader` matching final content shape after 300 ms.
    - Replace silent fall-through-to-empty error states with inline error containing localized message + Retry action.
    - Toast success notifications within 500 ms in Active_Language.
    - Consistent primary-action styling, danger color from `tokens.ts`, no border/underline on Section headings, "coming soon" placeholder Empty_State.
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.10, 1.11, 1.12_

  - [x] 10.9 Apply umbrella rules to landing/auth pages
    - Apply `ResponsiveDialog`, `ResponsiveForm`, `useViewport`, `useHelp` (where applicable), and bilingual coverage to `LandingPage`, `Login_Page`, `SignUp_Page`.
    - Confirm public-route bundle budgets (250 KB gzipped) hold.
    - _Requirements: 17.4, 5.6_

  - [x] 10.10 Add responsive image handling and motion preferences
    - Replace below-the-fold `<img>` with responsive `<picture>` (or equivalent) + `loading="lazy"`.
    - Disable non-essential animations when `prefers-reduced-motion: reduce`; preserve focus rings, loading indicators, validation animations.
    - _Requirements: 5.7, 5.8, 14.9_

  - [x] 10.11 Document the `data-i18n-test="ignore"` opt-out and ARIA contracts
    - Document the opt-out in `frontend/src/i18n/types.ts` JSDoc; ensure production-visible nodes never carry the attribute.
    - Set `aria-label` / `aria-labelledby` on every interactive element lacking visible text from the i18n registry.
    - Use `aria-live` regions for toasts, validation summaries, lockout countdowns.
    - Visible focus ring sourced from `tokens.ts`; no `outline: none` without replacement.
    - _Requirements: 13.8, 14.3, 14.5, 14.6_

- [x] 11. CHANGELOG & Maintenance
  - [x] 11.1 Add CHANGELOG pattern for translation/help changes
    - Update `CHANGELOG.md` with a section pattern that flags new/removed Translation_Keys and `sectionId` values per release.
    - _Requirements: 16.5_

- [x] 12. Final Checkpoint — System-wide Definition of Done
  - Ensure all tests pass (unit, property, route-walk, Lighthouse, Axe, bundle-budget, i18n-coverage, no-hardcoded-literal, no-physical-direction-css, no-ua-layout-detection).
  - Confirm release-readiness report shows 100 % Help_Icon / AddGate / i18n coverage and ≥ 85 / ≥ 95 Lighthouse on every measured route.
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP. Per the workflow rules, the model MUST NOT implement `*`-marked sub-tasks; it MUST implement non-starred sub-tasks.
- Each task references specific requirements (granular sub-requirements, e.g., `R3.1`, `R8.4`, `R12.5`) for traceability.
- Property tests sit close to the code they validate to catch errors early (`fast-check` ≥ 100 iterations each, organized one-per-property in `frontend/src/system-wide-ux-overhaul.pbt.test.ts` with shared generators under `__generators__/`).
- Property numbers (P1–P10) and the requirement clauses each property validates are pulled directly from the design's "Correctness Properties" and "Coverage Matrix" sections.
- The umbrella runtime layer (`useHelp`, `useAddGate`, `Responsive*`, `useViewport`) is foundational — it must be built before sibling specs (`settings-documentation`, `nav-settings-cleanup`, `ui-redesign-modern`, `landing-auth-vercel-redesign`) can be migrated to consume it.
- `frontend/src/theme/tokens.ts` is owned by `ui-redesign-modern` and is consumed read-only here; missing tokens are added there via a sibling-spec change, not here.
- The `nav-settings-cleanup` Empty-Select Add escape-hatch reuses `EmptyState` with `mandatory=true` — no duplicate component.
- The CI workflow file `.github/workflows/ci-quality.yml` is **extended in-place**; no parallel sibling-spec workflow is created.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.4", "1.5", "2.1", "11.1"] },
    { "id": 1, "tasks": ["1.2", "1.6", "2.2", "3.1", "4.5", "7.1", "7.2", "7.3"] },
    { "id": 2, "tasks": ["2.3", "2.6", "3.2", "3.3", "3.4", "4.1", "4.2", "4.3", "4.4", "6.1", "6.2", "6.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.7", "3.5", "4.6", "4.7", "4.8", "4.9", "6.4", "7.4", "7.5", "7.6", "7.7", "7.8"] },
    { "id": 4, "tasks": ["2.8", "6.5", "6.6", "8.1", "8.3", "10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10", "10.11"] },
    { "id": 5, "tasks": ["8.2", "8.4"] }
  ]
}
```
