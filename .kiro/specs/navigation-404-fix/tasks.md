# Implementation Plan

## Overview

This plan executes the bugfix using the bug-condition methodology against the four coordinated changes specified in `design.md`:

1. **`frontend/src/layouts/navDestinations.ts`** (new) — single typed registry of every static destination across the seven authenticated nav surfaces (`side_nav_leaf`, `quick_create_item`, `top_bar_menu_item`, `command_palette_command`, `in_page_link`, `breadcrumb_segment`, `module_hub_tile`).
2. **`frontend/src/App.routes.ts`** (new) + **`frontend/src/App.tsx`** (refactor only the route declarations) — route tree extracted as a JS-importable `RouteObject[]` so the audit and the runtime share one source of truth. Catch-all `{ path: '*', element: <NotFound /> }` and `ProtectedRoute` behavior preserved exactly.
3. **`frontend/scripts/nav-audit.mjs`** (extend) — adds a router-semantic pass using `matchRoutes` from `react-router` against `navDestinations` × `routes`. Existing static side-nav check preserved (Requirement 3.6).
4. **`frontend/tests/e2e/nav-sweep.spec.ts`** (new Playwright spec) + **`frontend/src/pages/NotFound.tsx`** (`data-testid="page-not-found"` only) — runtime sweep that signs in as a tenant user, walks every surface, and asserts no destination renders `NotFound`.

Both audits are wired into `.github/workflows/ci-quality.yml` as required quality gates (Requirement 2.7). The plan follows the strict workflow ordering: Bug Condition exploration test → Preservation property tests → Implementation → Verification (re-run the SAME tests, do NOT write new ones).

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Authenticated Static Nav Destination Falls Through to NotFound
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface concrete counterexamples that demonstrate at least one static authenticated nav destination falls through to the `*` catch-all and renders `NotFound`
  - **Scoped PBT Approach**: The bug is deterministic per `(surface, path)` pair, so scope the property to the concrete enumerated destinations from each of the seven surfaces rather than free-form path generation — this maximizes reproducibility and gives a stable counterexample list
  - Build a temporary enumeration script `frontend/scripts/nav-audit.exploration.mjs` that:
    - Walks all seven surfaces by reading destinations from `navigation.tsx` (via `buildNavSections`), `QuickCreateMenu.tsx`, `TopBar.tsx` (user/language/notifications/org-switcher menus), `CommandPalette.tsx`, breadcrumb builders / `RouteTitleSync`, in-page CTA components, and `ModuleHub` tiles
    - Filters for static destinations only (`isStatic(path)` — must start with `/`, no `:` segments, no `*`)
    - Imports `matchRoutes` from `react-router` and the route tree extracted from `App.tsx` (temporary JSX parse acceptable here since `App.routes.ts` does not exist yet)
    - For every `(surface, source, path)` triple, asserts `matchRoutes(routes, path) ≠ null`
  - Property under test (encodes `isBugCondition` from `bugfix.md` and design Glossary):
    - For input `(surface, destination, sessionState = authenticated_user)` where `destination` is static, there SHALL exist `route ∈ registeredRoutes(App.tsx)` such that `matchPath({ path: route.path, end: true }, destination) ≠ null`
    - Equivalently the rendered page after navigating to `destination` SHALL NOT be `NotFound`
  - Add a minimal Playwright variant `frontend/tests/e2e/nav-sweep.exploration.spec.ts` that:
    - Signs in as a regular tenant user via the existing auth fixture
    - Clicks a sampled subset of side-nav dropdown sub-items, quick-create entries, and command-palette commands taken from the enumeration above
    - Asserts the rendered DOM does not contain a NotFound marker (use a temporary text-based check `Result status="404"` since the testid lands in task 3.4)
  - Run both on UNFIXED `main`
  - **EXPECTED OUTCOME**: Tests FAIL — at least one `(surface, path)` pair fails `matchRoutes`, and at least one Playwright click renders the NotFound page (this is correct, it proves the bug exists)
  - Document counterexamples in `frontend/scripts/nav-audit.report.txt` (committed as a reference artifact) grouped by root-cause category from design "Hypothesized Root Cause": spelling drift, missing index routes, never-audited surfaces, param-vs-static confusion, renamed routes
  - Mark task complete when the script and Playwright variant are written, run, and the failure is documented with a concrete unmatched-destinations list
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Buggy Inputs Behave Identically Between F and F'
  - **IMPORTANT**: Follow observation-first methodology — observe behavior on UNFIXED code first, then encode it as property-based tests
  - **GOAL**: Capture the existing behavior for every input where `isBugCondition(X)` is false so the fix can be proven not to regress anything
  - Set up `fast-check` (already present as a frontend dev dep; otherwise add it) and create `frontend/tests/preservation/nav-preservation.spec.ts`
  - **Observation phase (run against UNFIXED code, record baselines):**
    - Hand-typed unknown URLs: visit `/this-route-does-not-exist`, `/totally/made/up`, `/foo bar`, `/leases//double-slash` — record that `<Result status="404">` (NotFound) renders
    - Parameterized detail routes (valid id shapes): `/leases/abc123`, `/banking/acc-1/import`, `/portal/c/sample-token/dashboard`, `/assets/42`, `/super/tenants/t-7` — record rendered page-component identifier per route
    - Public routes: `/welcome`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/store/`, `/portal/login`, `/vendor-portal/login`, `/403`, `/server-error` — record rendered components
    - SuperShell nested routes (super-admin fixture): `/super`, `/super/tenants`, `/super/plans`, `/super/catalog`, `/super/payments`, `/super/audit-log`, `/super/health`, `/super/settings` — record rendered components and confirm `<SuperGuard>` is invoked
    - Already-working side-nav leaves: snapshot the rendered page component for every leaf in `buildNavSections` whose `key` already matches a registered route in unfixed `App.tsx`
    - `ProtectedRoute` redirect: from an unauthenticated session, sample protected paths and record redirect target (`/welcome`)
    - Existing static audit: run `node scripts/nav-audit.mjs` on unfixed code and record exit code 0
  - **Property tests (encode observed behavior across the input domain):**
    - **P2 — Unknown URL preservation** (Requirement 3.1): with `fast-check`, generate arbitrary path strings; filter those NOT matched by `matchRoutes(routes, path)`; assert both unfixed and fixed builds render the NotFound marker
    - **P3 — Parameterized detail preservation** (Requirement 3.2): for each parameterized route, generate valid id-shaped strings (UUIDs, numeric ids, slugs) with `fast-check`; assert the rendered page-component identifier equals the unfixed baseline
    - **P4 — Working leaf preservation** (Requirement 3.3): for each currently-passing nav leaf, assert the matched component identifier on the fixed build equals the unfixed baseline snapshot
    - **Public-route preservation** (Requirement 3.4): visit each public route; assert identical rendered component to baseline
    - **SuperShell preservation** (Requirement 3.5): visit each `/super/*` route under the super-admin fixture; assert identical rendered component plus `<SuperGuard>` invocation
    - **Existing static audit preservation** (Requirement 3.6): run `node scripts/nav-audit.mjs` independently of the new audit and assert exit code 0
    - **ProtectedRoute redirect preservation** (Requirement 3.7): with `fast-check`, generate arbitrary protected paths from an unauthenticated session; assert redirect to `/welcome`
    - **P5 — Static-vs-runtime parity** (cross-property; lands fully once `navDestinations` exists in 3.1): for every entry in `navDestinations`, the static `matchRoutes` outcome and the runtime Playwright click outcome agree (both succeed or both fail) — they MUST never disagree. P5 may be deferred to wave 6 verification (task 3.8) but the harness is authored here
  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS — confirms baseline behavior to preserve. P5 may be skipped in this run; P2/P3/P4 plus public/SuperShell/audit/redirect cases MUST pass on unfixed code
  - Mark task complete when tests are written, run, and passing on unfixed code with baseline snapshots committed
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for navigation 404 bug across all seven authenticated nav surfaces

  - [x] 3.1 Create the `navDestinations` registry as the single source of truth
    - Create `frontend/src/layouts/navDestinations.ts`
    - Export the `NavSurface` union covering all seven surfaces: `'side_nav_leaf' | 'quick_create_item' | 'top_bar_menu_item' | 'command_palette_command' | 'in_page_link' | 'breadcrumb_segment' | 'module_hub_tile'`
    - Export the `NavDestination` interface: `{ surface: NavSurface; source: string; path: string }` where `source` is a human-readable origin (e.g. `"TopBar.userMenu"`, `"CommandPalette.commands"`)
    - Export `navDestinations: readonly NavDestination[]`
    - Build `side_nav_leaf` entries by importing `buildNavSections` from `frontend/src/layouts/navigation.tsx` (call with identity `t`) and flattening every `NavLeaf.key` whose value is a static path; skip parameterized leaves
    - Refactor `frontend/src/layouts/QuickCreateMenu.tsx` to extract its destinations into an exported `quickCreateItems` constant, then re-import that constant in the registry as `quick_create_item` entries (the menu must continue to render the same array — extract-and-re-import only)
    - Refactor `frontend/src/layouts/TopBar.tsx` to extract user-menu / language-menu / notifications-drawer / org-switcher static destinations into named exported constants and re-import them as `top_bar_menu_item` entries
    - Import the command list from `frontend/src/layouts/CommandPalette.tsx`, filter for entries that produce a `navigate(path)` action with a static path, and add as `command_palette_command`
    - Add static breadcrumb segment paths emitted by `Breadcrumb.tsx` / `RouteTitleSync` for each top-level area as `breadcrumb_segment` entries
    - Add a curated list of static in-page CTA destinations (`in_page_link`) and `ModuleHub` tile destinations (`module_hub_tile`)
    - Implement runtime invariants in the module: every `path` MUST start with `/`, MUST NOT contain `:`, MUST NOT contain `*`; throw at import time if any invariant fails
    - _Bug_Condition: `isBugCondition(input)` from design — `surface ∈ authenticated_app_shell ∧ isStatic(destination) ∧ ¬∃ route. matchPath({ path: route.path, end: true }, destination) ≠ null`_
    - _Expected_Behavior: every entry in `navDestinations` exposes a stable `(surface, source, path)` triple consumable by both the audit and the Playwright sweep_
    - _Preservation: `QuickCreateMenu`, `TopBar`, `CommandPalette`, `ModuleHub`, breadcrumb builders continue to render the exact same items (refactor is extract-and-re-import, no behavior change)_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Extract the route tree to `App.routes.ts` and refactor `App.tsx` to consume it
    - Create `frontend/src/App.routes.ts` exporting `routes: RouteObject[]` containing every `<Route>` currently declared in `frontend/src/App.tsx`, including the `SuperShell` nested children, all public routes, and the catch-all `{ path: '*', element: <NotFound /> }` as the final entry
    - Refactor `frontend/src/App.tsx` to consume `routes` via `useRoutes(routes)` (or a tiny adapter that drives `<Routes>` from the same array)
    - Preserve the `ProtectedRoute` wrapper around protected routes — wrap them inside `routes` so the array faithfully represents the runtime tree
    - Preserve lazy-loading via the existing hardened `lazy()` wrapper, all `<Suspense>` fallbacks, and `RouteTitleSync` exactly as today
    - The audit (3.3) and the Playwright sweep (3.5) MUST import `routes` from `App.routes.ts` so audit semantics, sweep semantics, and runtime semantics are identical
    - _Bug_Condition: the audit needed a JS-importable representation of the route tree to apply `matchRoutes` correctly; string-equality on `<Route path="...">` literals (current `nav-audit.mjs`) cannot decide router matches_
    - _Expected_Behavior: `routes` is an importable `RouteObject[]` whose semantics under `matchRoutes` match the runtime exactly, with the catch-all at the end_
    - _Preservation: `App.tsx` renders the same tree; `ProtectedRoute`, `SuperShell`, public routes, the catch-all, lazy + Suspense + RouteTitleSync all behave identically (Requirements 3.2, 3.3, 3.4, 3.5, 3.7)_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.2, 3.3, 3.4, 3.5, 3.7_

  - [x] 3.3 Extend `frontend/scripts/nav-audit.mjs` with a router-semantic match pass
    - Preserve all existing logic (section/duplicate/wrong-section checks) so the script continues to exit 0 for the currently passing scenarios — Requirement 3.6
    - Add a second pass after the existing checks: dynamically `import()` `frontend/src/layouts/navDestinations.ts` and `frontend/src/App.routes.ts` (use `tsx` or `vite-node` if needed for TS resolution at script time) and import `matchRoutes` from `react-router`
    - For every entry in `navDestinations`, call `matchRoutes(routes, entry.path)`; collect failures into a structured report grouped by surface
    - Exit non-zero when any destination fails to match; print the report to stderr with `surface | source | path` columns
    - Add a `nav:audit` script entry to `frontend/package.json` if not already present, wired to run both the legacy static check and the new router-semantic pass within the same invocation
    - _Bug_Condition: static string equality cannot detect drift covered by `matchRoutes` semantics (nested routes, optional segments, parent/child relationships, trailing-slash equivalence)_
    - _Expected_Behavior: audit fails when any `navDestinations` entry is unmatched; passes when all match (Requirement 2.7 regression gate)_
    - _Preservation: existing static side-nav check still runs and continues to exit 0 for currently passing scenarios (Requirement 3.6)_
    - _Requirements: 2.6, 2.7, 3.6_

  - [x] 3.4 Add stable test-id marker to the NotFound page
    - Edit `frontend/src/pages/NotFound.tsx` to add `data-testid="page-not-found"` to the outer `<Result>` wrapper
    - This is the ONLY edit to a page component anywhere in this plan — it adds a test hook and changes no visible behavior
    - The "Go home" button MUST continue to navigate to `/` exactly as today; `<Result status="404" title="404" />` content and layout MUST remain identical
    - _Bug_Condition: the Playwright sweep needs a stable selector to assert "this page is not the 404"_
    - _Expected_Behavior: `getByTestId('page-not-found')` resolves to the NotFound page when (and only when) NotFound renders_
    - _Preservation: NotFound visible content, layout, and "Go home" navigation remain identical (Requirement 3.1)_
    - _Requirements: 3.1_

  - [x] 3.5 Create the Playwright runtime sweep `frontend/tests/e2e/nav-sweep.spec.ts`
    - Reuse the existing Playwright auth fixture to sign in as a regular tenant user (NOT super-admin) so the standard authenticated app shell loads
    - For each surface in `navDestinations`, walk and click as follows:
      - `side_nav_leaf`: open each side-nav dropdown via its trigger, click each leaf
      - `quick_create_item`: click the quick-create trigger, click each item
      - `top_bar_menu_item`: open each top-bar menu (user, language, notifications drawer, org switcher), click each entry
      - `command_palette_command`: open the command palette via hotkey, type each command's label, press Enter
      - `in_page_link`, `breadcrumb_segment`, `module_hub_tile`: navigate via direct URL since these surfaces are page-context-dependent
    - Per-click assertion: `await expect(page.getByTestId('page-not-found')).toHaveCount(0)` AND `await expect(page).toHaveURL(new RegExp(escapeRegex(entry.path) + '$'))`
    - Shard the spec across 4 Playwright workers (≈300+ entries in `navDestinations`)
    - Add a separate **negative-control test** in the same spec: navigate to `/this-route-does-not-exist` and assert `getByTestId('page-not-found')` IS visible (guards Property 2 / Requirement 3.1)
    - Add a **cross-context switching test**: walk side nav → quick-create → command palette → top-bar menu in a single session and assert active-state highlighting and breadcrumbs update correctly after each navigation (Requirement 3.3)
    - Add a `nav:sweep` script entry to `frontend/package.json`: `"nav:sweep": "playwright test tests/e2e/nav-sweep.spec.ts"`
    - _Bug_Condition: a static audit alone cannot prove that surface controls (dropdowns, palette, menus) actually open and dispatch to working pages — only a runtime click can_
    - _Expected_Behavior: every static destination clicked through its native surface renders a non-NotFound page (P5 static-vs-runtime parity validated end-to-end)_
    - _Preservation: negative-control test guarantees NotFound still renders for genuinely unknown URLs (Requirement 3.1); cross-context test guards active-state and breadcrumb behavior (Requirement 3.3)_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 3.1, 3.3_

  - [x] 3.6 Wire both audits into CI as required quality gates
    - Edit `.github/workflows/ci-quality.yml` to add a step that runs `frontend run nav:audit` (use the repo's package manager, e.g. `pnpm --filter frontend run nav:audit` or `npm --prefix frontend run nav:audit`) — failure fails the build
    - Add a step that runs `frontend run nav:sweep` against a built/preview frontend with the Playwright auth fixture available — failure fails the build
    - Ensure both steps run on every PR and on `main` pushes
    - The existing legacy `node scripts/nav-audit.mjs` invocation MUST continue to be executed independently (or as part of `nav:audit`) and continue to exit 0 — Requirement 3.6
    - Document the gate in the PR description checklist template
    - Add a CI gate verification step (manual or scripted): a synthetic PR that intentionally introduces an unmatched destination into `navDestinations` MUST fail CI; reverting MUST make CI pass — proves Requirement 2.7 wiring is correct
    - _Bug_Condition: drift between surfaces and routes recurs over time without a CI regression gate_
    - _Expected_Behavior: any PR that introduces an unmatched static destination on any of the seven surfaces fails CI before merge_
    - _Preservation: pre-existing CI steps and the legacy `nav-audit.mjs` invocation continue to run with identical semantics (Requirement 3.6)_
    - _Requirements: 2.7, 3.6_

  - [x] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Authenticated Static Nav Destination Resolves to a Real Page
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior: every entry produced by the seven-surface enumeration must satisfy `matchRoutes(routes, entry.path) ≠ null` and the runtime click must not render NotFound. When this test passes, Property 1 is satisfied
    - Run `node frontend/scripts/nav-audit.mjs` (extended) and assert exit 0
    - Run `playwright test tests/e2e/nav-sweep.spec.ts` (and the exploration variant from task 1) and assert all sharded workers pass
    - **EXPECTED OUTCOME**: Tests PASS (confirms bug is fixed across all seven surfaces)
    - Confirm `frontend/scripts/nav-audit.report.txt` now shows zero unmatched destinations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Buggy Inputs Behave Identically After Fix
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run the property-based preservation suite (`fast-check`-driven P2/P3/P4 plus the public-route, SuperShell, ProtectedRoute, and existing-audit cases)
    - Run `node scripts/nav-audit.mjs` (legacy invocation, independent of new audit) and assert exit code 0 (Requirement 3.6)
    - Run the static-vs-runtime parity property (P5) and assert no disagreement between `matchRoutes` and the Playwright click outcome for any entry in `navDestinations`
    - Run the negative-control Playwright test and assert NotFound IS rendered for `/this-route-does-not-exist` (Requirement 3.1)
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions on hand-typed unknown URLs, parameterized detail routes, public routes, SuperShell, working leaves, the ProtectedRoute redirect, and the existing static audit)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Confirm `nav:audit` exits 0 in CI (extended router-semantic pass + legacy static check)
  - Confirm `nav:sweep` exits 0 across all Playwright shards in CI
  - Confirm the property-based preservation suite (P2, P3, P4, P5 plus public/SuperShell/audit/redirect cases) is green
  - Confirm `node scripts/nav-audit.mjs` (legacy invocation) still exits 0 (Requirement 3.6)
  - Confirm the negative-control test still asserts NotFound for `/this-route-does-not-exist` (Requirement 3.1)
  - Verify unit-test invariants on `navDestinations.ts` (every `path` starts with `/`, no `:`, no `*`; no duplicate `(surface, path)` pairs; every surface has at least one entry) and on `App.routes.ts` (catch-all `{ path: '*', element: <NotFound /> }` is the last entry)
  - Confirm the synthetic-PR gate verification from task 3.6 succeeded (intentional unmatched destination fails CI; revert restores CI)
  - Ensure all tests pass; ask the user if questions arise (e.g. Playwright fixture availability, CI runner constraints, whether `tsx` / `vite-node` is acceptable for the audit's TypeScript import).

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2"],
      "parallel": true,
      "description": "Bug Condition exploration test (must FAIL on unfixed code) and Preservation property tests (must PASS on unfixed code via observation-first methodology). Run independently against UNFIXED main; both gate the start of any 3.x work."
    },
    {
      "wave": 2,
      "tasks": ["3.1", "3.2", "3.4"],
      "parallel": true,
      "description": "Foundation modules: 3.1 navDestinations registry consolidating all seven surfaces, 3.2 App.routes.ts extraction with App.tsx refactor, 3.4 NotFound data-testid marker. None depend on each other (3.1 and 3.2 share no exports; 3.4 is a one-line attribute add). All depend on wave 1 having captured baselines."
    },
    {
      "wave": 3,
      "tasks": ["3.3", "3.5"],
      "parallel": true,
      "description": "Consumers of the foundation: 3.3 extends nav-audit.mjs to import navDestinations + routes and call matchRoutes (depends on 3.1 + 3.2). 3.5 creates Playwright nav-sweep.spec.ts (depends on 3.1 registry, 3.2 routes, 3.4 testid). They have no dependency on each other and run in parallel."
    },
    {
      "wave": 4,
      "tasks": ["3.6"],
      "parallel": false,
      "description": "Wire both audits into ci-quality.yml as required quality gates; run the synthetic-PR gate verification. Depends on 3.3 audit and 3.5 sweep being executable end-to-end."
    },
    {
      "wave": 5,
      "tasks": ["3.7", "3.8"],
      "parallel": true,
      "description": "Verification-only: re-run the SAME tests from tasks 1 and 2 against the fixed code. 3.7 confirms Property 1 (Bug Condition) now passes; 3.8 confirms Property 2 (Preservation) still passes. DO NOT author new tests in this wave."
    },
    {
      "wave": 6,
      "tasks": ["4"],
      "parallel": false,
      "description": "Final checkpoint: every CI gate green (nav:audit, nav:sweep, legacy nav-audit.mjs, negative-control, unit invariants on navDestinations.ts and App.routes.ts, synthetic-PR gate verification)."
    }
  ]
}
```

Notes on the graph:

- Tasks 1 and 2 MUST complete before any 3.x work begins — the bug must be observed and the preservation baseline captured before any module's export shape changes.
- 3.1, 3.2, 3.4 are listed as parallel because they touch disjoint files (`navDestinations.ts`, `App.routes.ts` + `App.tsx`, `NotFound.tsx`). If a contributor prefers, 3.1 → 3.2 → 3.4 sequentially also works.
- 3.3 (extended audit) and 3.5 (Playwright sweep) both depend on 3.1 and 3.2; 3.5 additionally depends on 3.4.
- 3.7 and 3.8 are deliberately verification-only. They re-run the exact tests authored in tasks 1 and 2.

## Notes

- **Property numbering**: Property 1 is the Bug Condition exploration test (task 1, re-verified in 3.7). Property 2 is the Preservation suite (task 2, re-verified in 3.8). The design's P3 / P4 / P5 sub-properties are implemented as part of the task 2 `fast-check` suite and re-verified in 3.8.
- **Observation-first**: Task 2 must observe and record real outputs from UNFIXED code before encoding properties. Do not assume behavior — read it from the running app and from existing component snapshots.
- **Scoped PBT for the deterministic bug**: Task 1's property is scoped to the concrete enumerated `(surface, path)` pairs rather than a free-form path generator because the bug is deterministic per-pair; reproducibility of counterexamples is more valuable than coverage at the exploration stage.
- **Single source of truth**: `navDestinations.ts` (3.1) and `App.routes.ts` (3.2) together replace ad-hoc enumeration. The audit (3.3) and the sweep (3.5) MUST import these modules directly — never re-parse `App.tsx` source text.
- **Backward-compat invariant**: The original `node scripts/nav-audit.mjs` invocation must keep exiting 0 (Requirement 3.6). The new router-semantic pass is additive within the same file.
- **CI wiring (Requirement 2.7)**: Both `nav:audit` and `nav:sweep` are required steps in `.github/workflows/ci-quality.yml`. Either failing fails the build. The synthetic-PR gate verification in 3.6 proves the wiring is correct.
- **Playwright auth fixture**: The sweep signs in as a regular tenant user (not super-admin) so the standard authenticated shell loads. SuperShell preservation is covered separately in task 2 with a super-admin fixture (Requirement 3.5).
- **No page-component edits except 3.4**: The only edit to any page component anywhere in this plan is adding `data-testid="page-not-found"` to `NotFound.tsx`. Every other change is registry, routing-array, audit, sweep, or CI wiring.
