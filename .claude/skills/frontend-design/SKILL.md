---
name: frontend-design
description: >-
  Build and edit frontend UI in this React 19 + TypeScript + Vite + Ant Design v6 + Zustand
  ERP (Kurdish/Arabic RTL, Zoho-One-like). Use this WHENEVER you create or modify any page,
  screen, form, list/table, modal, drawer, dashboard, KPI card, settings section, or reusable
  component under frontend/src — even when the user only says "add a page", "build a form",
  "make a list view", "add a settings screen", "wire up this module", "fix the layout", or
  names a feature without saying the word "UI". It maps the existing design-system component
  library and theme tokens so you reuse them instead of reinventing, and it enforces the
  project's token-only styling, RTL/i18n, accessibility, performance-budget, and antd v6
  conventions. Trigger for any hands-on frontend implementation work in this repo. For the
  senior-designer "is this good enough / make it excellent" judgment, pair with ux-ui-pro-max.
---

# Frontend Design — building UI the way this codebase does it

This repo has a **mature, token-driven design system** (60+ components, a single token
source, global antd v6 theming, an empty-state/quick-create subsystem). Your first job is
almost never "write a new component" — it's **find the one that already exists and use it
correctly**. Reinventing a table, a form shell, a money input, or an empty state is the most
common mistake here, and it breaks theming, RTL, dark mode, density, and the bundle budget.

When in doubt about *what's good enough*, also load **ux-ui-pro-max** — this skill is the
"how to build it here"; that one is the "is it excellent" eye.

## The stack (so you reach for the right tool)

| Concern | What this repo uses |
|---|---|
| Framework | React **19**, TypeScript ~5.9, Vite **8** |
| UI kit | **Ant Design v6** (`antd`) + `@ant-design/icons` v6 — themed globally, never raw |
| State | **Zustand 5** (`stores/`), persisted; POS uses **IndexedDB** (`idb`), not localStorage |
| Server data | **TanStack React Query v5** (+ persist) via `hooks/useCRUD`, `useMutationRefresh` |
| Motion | **framer-motion 12** — always with a reduced-motion variant |
| i18n | **react-i18next** — namespaced, lazy (`i18n.config.ts`), locales in `public/locales/{ku,en,ar}` |
| Charts | **recharts 3** — colors from `dataViz` token palette |
| Drag/grid | `@dnd-kit`, `react-grid-layout` (dashboards) |

## Golden rules (non-negotiable — and why)

1. **Reuse the design system first.** Import from the barrel (`@/design-system` or a relative
   path) before writing anything new. See `references/component-map.md` for the full catalog
   with "use when" notes. A new bespoke component is a last resort — and if you build one, it
   must obey every rule below and live in `design-system/` if it's reusable.

2. **Token-only styling — no inline colors/spacing/radii/shadows.** Everything comes from
   `frontend/src/theme/tokens.ts` (`palette`, `spacing`/`space`, `radius`, `fontSize`,
   `typography`, `shadow`/`elevation`, `duration`/`easing`, `status`, `zIndex`, `dataViz`,
   `glass`). The README states it plainly: *every component draws from tokens — no inline
   color.* Inline hex/px defeats dark mode, brand-color override, density, and high-contrast
   mode. If you need a value, it already has a token — find it.

3. **Theme is global; don't re-wrap it.** `theme/AppConfigProvider.tsx` is the *only* antd
   `ConfigProvider`. It sets `direction` (rtl for `ku`/`ar`), light/dark algorithm, density,
   locale, and brand color from stores. Never add your own `ConfigProvider`, never pass a
   hardcoded `theme`, never set colors on antd components directly.

4. **RTL-correct by construction.** `ku` (default) and `ar` render right-to-left; the dir
   flips automatically. Never use physical `left`/`right`/`marginLeft`/`textAlign:'left'` for
   layout — use **logical** properties (`marginInlineStart`, `paddingInline`,
   `insetInlineEnd`, `textAlign:'start'`) or let antd handle it. Use `DateRangePickerRTL` for
   date ranges. There's an `rtl:audit` script and RTL Playwright snapshots — broken RTL fails CI.

5. **No hardcoded user-facing strings.** Every label/message goes through `t()` with the
   correct namespace. Add keys to `public/locales/{ku,en,ar}/<namespace>.json` and register
   new namespaces in `i18n.config.ts`. `ku` is the source-of-truth language. `i18n:coverage`
   gates missing keys.

6. **Accessibility is part of "done."** Keyboard-operable, visible focus ring (token
   `a11y.focusRingColor`), correct aria, **44px min touch target** (`a11y.minTouchTarget`),
   `SkipToContent` on shells, and a **reduced-motion** path for every animation. axe runs in
   Playwright. Never signal state by color alone — pair with icon/text (`StatusTag` does this).

7. **Respect the performance budget.** The app shell is held **≤ 8 KB gzipped**
   (`audit:shell`). Heavy things — modals, drawers, charts, the quick-create forms — are
   **lazy-loaded** via dynamic `import()`. `DataTable` auto-virtualizes at **≥ 200 rows**. Use
   `OptimizedImage` for images. Don't statically import a heavy chunk into a list/shell path.

8. **Motion is purposeful and capped.** Use the shared variants (`utils/animations`,
   `design-system/empty/motion`) and `MotionModal`/`AnimatedList`/`PageTransition`/
   `MotionButton`. Durations 150–250ms, ease-out on enter. Always honor `useReducedMotion()`.

## Standard page recipes

Build to these shapes — they're what the rest of the app does, so they inherit every behavior
above for free. Skeletons only; see `references/component-map.md` for fuller examples and props.

- **List / index page** → `PageHeader` (title + actions) → `FilterBar` / `FilterChipTray`
  (+ `SavedViewsPicker`, `AdvancedFilterDrawer`) → `DataTable` (pass `rowSelection` to get
  `BulkActionBar`, `exportConfig` to get `ExportMenu`; empty + loading states are built in).
  Fetch with React Query / `useCRUD`. `ColumnVisibility` for column control.

- **Create / edit form** → `FormLayout` (titled `FormSection`s + `useUnsavedChangesGuard`) →
  antd `Form` fields, using `EntitySelect` / `SelectWithQuickCreate` (never a raw select for
  contacts/items/accounts), `MoneyInput`, `AddressInput` (`IRAQ_GOVERNORATES`), `PhoneInput`
  (+964), `EditableLineItems` for line tables → `SaveSplitButton` to submit.

- **Detail / record page** → `DetailLayout` (tabs + optional split pane) → `KeyValueGrid` +
  `SectionCard` for fields, `StatusTag` for status, `Timeline` / `AvatarGroup`, `InlineEdit`
  for edit-in-place, `CopyButton` for IDs.

- **Dashboard** → `KpiCard` row → `ChartCard` wrapping `TrendChart` / `MiniSparkline` /
  recharts (colors from `dataViz`), arranged with `react-grid-layout`.

- **Any data surface** → render through the **state matrix**: empty / loading / error /
  populated. Use `StateSwitch`, `EmptyState` (with a CTA, never a dead end), `LoadingSkeleton`
  (skeleton, not a bare spinner), `PageErrorState`, `ConnectionStatus`.

- **Destructive action** → `ConfirmDialog` only. **Transient feedback** → `toast`.

- **Print** → `PrintView` / `usePrint` + the templates in `design-system/print/`.

## Data, state, and modules

- **Server data:** React Query. This repo lints query usage — `local/require-query-class`
  (use a `QueryClassName` from `data/queryClasses.ts`) and `local/precise-invalidation` (don't
  nuke the whole cache). Prefer the `useCRUD` / `useMutationRefresh` hooks. Live data via
  `useFirestoreLive`.
- **Client state:** Zustand stores in `stores/`. Density (`useUiStore`), theme (`useAuthStore`),
  branding (`useSettingsStore`) already exist — read from them, don't duplicate. POS state
  persists to **IndexedDB**.
- **Gating & layout hooks:** `usePermission` (gate actions/empty-state CTAs), `useFeatureFlag`,
  `useMediaQuery` (responsive — never UA-sniff; `lint:no-ua` enforces this), `useLayout`,
  `useLanguage`.
- **`/ext/<slug>` modules** are config-driven: edit the module's entry in
  `pages/modules/moduleConfigs.ts` (its `resources` + `fields`) rather than hand-rolling a
  page. New routes are registered in `layouts/navDestinations.ts` + `layouts/moduleMap.ts`.

## Before you call it done

Run the relevant checks (PowerShell, from `frontend/`):

```
npm run lint          # eslint incl. token + query-class + precise-invalidation rules
npx tsc --noEmit      # types (or: npm run build for the real compile)
npm run rtl:audit     # physical-property / RTL regressions
npm run i18n:coverage # missing translation keys
```

Then sanity-check visually in **both** light and dark, in an **RTL** language (`ku`/`ar`), and
at **compact** density (the ERP default) — that's where layout bugs hide. To actually launch
and view the app, use the **run** skill / `npm run dev`.

**Full component catalog, props, and recipe code → `references/component-map.md`.**
**Making it genuinely excellent (hierarchy, polish, design review) → the `ux-ui-pro-max` skill.**
