# Implementation Plan: UI Redesign Modern

## Overview

نوێکردنەوەی تەواوی UI/UX بۆ سیستەمی Zoho ERP — گۆڕینی تەواوی دیزاینی فرۆنتئێند بۆ دیزاینێکی مۆدێرن، پرۆفیشناڵ، و نازدار. ئەم پلانە تەنها لایەی UI دەگۆڕێت بەبێ دەستکاری Backend API.

Implementation order: Design Token System and i18n infrastructure first (everything else depends on them), then Zustand stores, then AppShell layout and navigation, then cross-cutting features (Language Switcher, Command Palette, Glass Morphism, Animation Library), then shared design-system components (Skeleton, Page Transitions, Micro-Interactions, ProTable, Forms), then feature pages (Login, Dashboard, List Pages, Form Pages), then quality/compliance (Accessibility, Performance, Print, i18n Completeness), and finally tests.

---

## Tasks

- [x] 1. Design Token System & Theme Setup
  - Create `frontend/src/theme/tokens.ts` exporting all design tokens: `palette`, `space`, `spacing`, `radius`, `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `controlHeight`, `duration`, `motion`, `easing`, `shadow`, `status`, `zIndex`, `typography`, `dataViz`, `elevation`, `transitions`, `layout`, `a11y`, `glass`, and the `Density` type.
  - Implement `buildAntTokens(mode, density, isRTL)` function mapping design tokens to AntD v6 token API: distinct `colorBgBase` for light vs dark, distinct `controlHeight` per density, correct `fontFamily` (`Vazirmatn` for RTL, `Inter` for LTR).
  - Implement `buildAntComponents(mode)` function returning AntD component-level overrides.
  - Create `frontend/src/theme/AppConfigProvider.tsx` wrapping AntD `ConfigProvider` with `buildAntTokens` and `buildAntComponents`, reading theme/density/direction from `useUiStore` and `useAuthStore`.
  - Create `frontend/src/theme/globalStyles.css` with: CSS reset, `transition: background-color 200ms cubic-bezier(0.2,0,0,1)` on `*`, `:focus-visible` focus ring (`2px solid var(--color-primary-500)`, `2px offset`), RTL logical-property utilities, `.flip-rtl` class (`[dir="rtl"] .flip-rtl { transform: scaleX(-1); }`), skeleton CSS variables for light/dark, and `@media print` base rules.
  - Add ESLint rule (or custom plugin) to flag hardcoded hex/rgb values outside `tokens.ts` at build time.
  - Persist theme (`ui.theme`) and density (`ui.density`) to localStorage via Zustand persist middleware; restore on page reload.
  - Support three density modes: `compact` (4px grid, 32px controlHeight, 16px page padding), `comfortable` (6px grid, 36px controlHeight, 20px padding), `spacious` (8px grid, 44px controlHeight, 24px padding).
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8, 1.9_

- [x] 2. i18n Infrastructure & Locale Files
  - Install and configure `i18next`, `react-i18next`, and `i18next-http-backend` with lazy namespace loading per route; set `fallbackLng: 'ku'` and `defaultNS: 'common'`; load only `common` namespace initially.
  - Create locale directory structure: `frontend/src/locales/ku/`, `en/`, `ar/` each containing JSON files for all 20 namespaces: `common`, `nav`, `auth`, `dashboard`, `sales`, `purchases`, `inventory`, `accounting`, `banking`, `crm`, `pos`, `hr`, `payroll`, `manufacturing`, `projects`, `reports`, `settings`, `errors`, `validation`, `iraq`.
  - Populate each locale with ≥ 700 keys total across all namespaces (≥ 2100 keys total across three languages); Kurdish Sorani (`ku`) is the default and most complete.
  - Implement `resolveLanguage(code: string): Language` in `frontend/src/utils/language.ts` returning `'ku'` for any code not in `['ku', 'en', 'ar']`.
  - Implement `formatMoney(amount, currency, lang)` in `frontend/src/utils/format.ts` using `Intl.NumberFormat('ar-IQ')` for IQD/Kurdish/Arabic and `en-US` for USD/English.
  - Implement `formatDate(date, lang)` using `dayjs` with correct locale per language.
  - Ensure missing i18n keys fall back to the key string itself (not empty string or undefined).
  - _Requirements: 3.1, 3.7, 3.8, 10.4, 10.5, 20.1–20.7_

- [x] 3. Zustand Store Architecture
  - Create `frontend/src/stores/uiStore.ts` with `UiState`: `sidebarCollapsed`, `density`, `language`, and setters; persist to localStorage keys `ui.sidebarCollapsed`, `ui.density`, `ui.theme`.
  - Create `frontend/src/stores/navStore.ts` with `NavState`: `favorites: NavItem[]` (max 10), `recents: NavItem[]` (max 5), `pin`, `unpin`, `addRecent`; persist to localStorage; enforce FIFO eviction on recents overflow.
  - Create `frontend/src/stores/authStore.ts` with `user`, `token`, `theme`, `layoutMode`, `logout`; persist to localStorage.
  - Create `frontend/src/stores/orgStore.ts` with `currentOrg`, `currentBranch`; persist to localStorage.
  - Create `frontend/src/stores/notificationsStore.ts` with `notifications`, `unreadCount`; session only (no persist).
  - Create `frontend/src/stores/commandStore.ts` with `open`, `query`, `setOpen`, `setQuery`; session only.
  - Create `frontend/src/stores/draftsStore.ts` with `drafts: Record<string, Record<string, unknown>>`, `saveDraft`, `clearDraft`; persist to localStorage.
  - _Requirements: 4.7, 4.8, 4.10, 15.3_

- [x] 4. AppShell Layout
  - Create `frontend/src/layouts/AppShell.tsx` composing `SideNav` + `TopBar` + `<Outlet />` using AntD `Layout` with `direction={isRTL ? 'rtl' : 'ltr'}`.
  - Set `Layout.Content` margin-inline-start to `sidebarWidth` (240px expanded, 64px collapsed) using CSS logical properties.
  - Create `frontend/src/layouts/AuthLayout.tsx` for the 50/50 split-screen auth pages (branding side + form side; branding hidden on < 768px).
  - Restore `sidebarCollapsed` state from `uiStore` on first render (localStorage key `ui.sidebarCollapsed`).
  - Wrap `<Outlet />` in `<ErrorBoundary>` with friendly error screen (translated message + Retry + Go to Dashboard).
  - Wrap all feature routes in `<Suspense fallback={<LoadingSkeleton variant="table" />}>`.
  - _Requirements: 4.1, 4.4, 4.5, 4.10_

- [x] 5. Sidebar Navigation
  - Create `frontend/src/layouts/SideNav.tsx` as a collapsible AntD `Layout.Sider` (240px expanded, 64px collapsed, Drawer overlay on < 768px).
  - Implement all navigation sections: Home, Sales, Purchases, Inventory, Banking, Accounting, CRM, POS, HR, Manufacturing, Projects, Reports, Iraq, Setup.
  - Show icons-only with Tooltips when collapsed; show icons + labels + section headers when expanded.
  - Implement inline search with debounced filtering (≤ 200ms) filtering items by label/section name (case-insensitive).
  - Implement hover-intent for section opening (700ms continuous hover threshold).
  - Implement flyout panel for each section when sidebar is collapsed (click to open).
  - Render Favorites section (top) and Recents section (below it) from `navStore`; call `navStore.addRecent()` on every page visit.
  - Render `LanguageSwitcher` in the sidebar footer.
  - Hide sections for modules not enabled in onboarding (read from `orgStore` or feature flags).
  - Highlight active item with primary color + accent rail on `inline-start` side.
  - Persist collapsed state to `uiStore.sidebarCollapsed`.
  - _Requirements: 4.2, 4.3, 4.4, 4.7, 4.8, 5.1–5.10_

- [x] 6. Topbar
  - Create `frontend/src/layouts/TopBar.tsx` as a sticky bar (`position: sticky; top: 0; z-index: 1100`), 60px tall.
  - Apply Glass Morphism: `backdrop-filter: blur(20px) saturate(160%)` with light/dark backgrounds from `glass.topbar` tokens; `@supports not (backdrop-filter)` fallback to solid surface token.
  - Include: `OrgSwitcher`, `BranchSwitcher`, `QuickSearch` (⌘K trigger), `NotificationsDrawer` trigger, `LanguageSwitcher`, `ThemeToggle`.
  - Create `frontend/src/layouts/OrgSwitcher.tsx` and `BranchSwitcher.tsx` as dropdown selectors.
  - Create `frontend/src/layouts/NotificationsDrawer.tsx` as an AntD Drawer with notification list.
  - _Requirements: 4.5, 4.6, 4.9, 12.1_

- [x] 7. Language Switcher & RTL/LTR Support
  - Create `frontend/src/components/LanguageSwitcher.tsx` supporting `ku`, `en`, `ar`; always visible in Topbar and Sidebar footer; visible on login page before authentication.
  - On language change: call `i18n.changeLanguage(code)`, update `uiStore.language`, set `document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr')` and `lang` attribute, update AntD `ConfigProvider direction`.
  - Apply direction change with 250ms CSS transition; display active-language indicator (highlighted option or checkmark).
  - Persist language to `localStorage['i18n.language']`; fall back to in-memory Zustand value if localStorage unavailable.
  - Use `resolveLanguage()` to guard against invalid codes (fallback to `'ku'`).
  - Ensure all CSS uses logical properties (`margin-inline-start`, `padding-inline-end`, `border-inline-start`) — never `left`/`right`.
  - Apply `.flip-rtl` (`transform: scaleX(-1)`) to all directional icons (chevrons, arrows) in RTL mode.
  - Wrap mixed-direction strings (numbers + Kurdish/Arabic text) with `<bdi>` tags via `MoneyDisplay`.
  - Display scrollbar on left side in RTL mode (`direction: rtl` on scroll container).
  - Add CI check: automated RTL audit (no `left`/`right` CSS properties outside `tokens.ts`).
  - _Requirements: 3.1–3.9, 10.1–10.9_

- [x] 8. Command Palette (⌘K)
  - Create `frontend/src/layouts/CommandPalette.tsx` as a global overlay rendered inside `AppShell`.
  - Register global keyboard listener for `⌘K` (Mac) and `Ctrl+K` (Windows/Linux) on every page; toggle `commandStore.open`.
  - Build search index on mount from `navDestinations` + quick actions + `navStore.recents`; use `CommandItem` interface (`id`, `label`, `labelEn`, `category`, `icon`, `shortcut`, `action`).
  - Implement fuzzy/substring search returning results within 100ms (synchronous in-memory, no external library needed for < 500 items).
  - Implement full keyboard navigation: ↑↓ to move, Enter to select, Escape to close.
  - On item selection: close palette and navigate to the target page.
  - Apply Glass Morphism: `backdrop-filter: blur(24px)` with `glass.palette` tokens (70% opacity light, 15% opacity dark).
  - Implement focus trap (`useFocusTrap` hook) while open; return focus to trigger on close.
  - Add ARIA: `role="dialog"`, `aria-modal="true"`, `aria-label`, `aria-activedescendant`, `aria-live="polite"` for result count.
  - Ensure correct rendering in both RTL and LTR layouts.
  - _Requirements: 6.1–6.8, 12.2_

- [x] 9. Glass Morphism Effects
  - Implement `getGlassStyle(mode, blur): GlassStyle` helper in `frontend/src/theme/tokens.ts`.
  - Apply glass morphism to Topbar, Command Palette, modals/drawers, and login page card using `glass.*` tokens.
  - Gate all glass morphism with `@supports (backdrop-filter: blur(1px))`; fall back to solid `surface` token when unsupported.
  - Apply correct borders: `1px solid rgba(255,255,255,0.12)` in dark mode, `1px solid rgba(15,23,42,0.08)` in light mode.
  - Apply `backdrop-filter: blur(16px)` with 70% opacity (light) / 70% opacity (dark) to login page card.
  - Apply `backdrop-filter: blur(20px)` with mode-appropriate opacity to modal and drawer backgrounds.
  - _Requirements: 2.4, 4.6, 12.1–12.6_

- [x] 10. Animation Library Integration — React Bits + Framer Motion
  - Install `react-bits@^1.0.0` (pinned major) in `frontend/package.json`.
  - Create `frontend/src/components/MotionGate.tsx` HOC that checks `useReducedMotion()` (Framer Motion) and renders the final static state immediately when `prefers-reduced-motion: reduce` is set.
  - Wrap all React Bits components (`<Typewriter>`, `<GradientText>`, `<ShimmerText>`, `<CountUp>`, `<Particles>`) in `MotionGate`.
  - Implement `PageTransition` component using Framer Motion `motion.div` with `variants: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } }` and `transition: { duration: 0.2, ease: [0.2, 0, 0, 1] }`.
  - Configure `AnimatePresence mode="wait"` in `App.tsx` to ensure sequential (not simultaneous) exit → enter transitions.
  - Implement button micro-interaction variants: `rest`, `hover` (y: -2, shadow.md, 150ms), `pressed` (y: 1, shadow.none, 50ms).
  - Implement card hover micro-interaction: upward shift + increased shadow within 150ms.
  - Ensure all non-page-transition animations complete within 300ms; page transitions within 600ms maximum.
  - Ensure `prefers-reduced-motion` fully disables (not merely reduces) all animations — duration becomes 0.
  - _Requirements: 2.1–2.7, 7.1–7.7, 8.1–8.8, 9.1, 9.2, 9.7_

- [x] 11. Skeleton Loading System
  - Create `frontend/src/design-system/LoadingSkeleton.tsx` with four variants: `row`, `card`, `chart`, `table`; each variant must match the dimensions of its real content.
  - Implement shimmer animation in `globalStyles.css`: `@keyframes shimmer` with `background-position` sweep at 1.4s cycle; reverse direction in RTL (`[dir="rtl"] .skeleton { animation-direction: reverse; }`); disable when `prefers-reduced-motion: reduce`.
  - Apply light/dark CSS variables: `--skeleton-base` and `--skeleton-highlight` per mode.
  - Implement `useLoadingState(isLoading: boolean)` hook in `frontend/src/hooks/useLoadingState.ts`: show skeleton after 300ms delay; hide immediately when data is ready with 200ms fade-out; show error state with retry after 5000ms.
  - Ensure no spinner is shown for any loading state ≥ 300ms — only skeleton.
  - Support `isDark` prop for explicit dark mode override.
  - _Requirements: 7.3, 9.3, 9.4, 11.1–11.7_

- [x] 12. Page Transitions
  - Wrap every feature page component in `<PageTransition>` (from Task 10).
  - Ensure `AnimatePresence mode="wait"` in `App.tsx` so exit animation completes before enter animation starts.
  - Apply instant transitions (no animation, no delay) when `prefers-reduced-motion` is enabled.
  - Show `LoadingSkeleton` (appropriate variant) when data fetch takes ≥ 300ms; show nothing for < 300ms.
  - Show error screen with "Retry" button and "Go to Dashboard" link when page fails to load or data fetch takes ≥ 5000ms.
  - _Requirements: 9.1–9.7_

- [x] 13. Micro-Interactions
  - Apply Framer Motion `buttonVariants` (`rest`, `hover`, `pressed`) to all Button components in the design system.
  - Apply card hover micro-interaction (upward shift + increased shadow, 150ms) to `KpiCard`, `ChartCard`, and other card components.
  - Ensure focus ring is visible on all interactive elements via `:focus-visible` CSS (from `globalStyles.css`).
  - Show spinner + disabled state on button loading; restore normal state on completion.
  - Show red border + error icon on invalid form inputs; green border + success icon on valid inputs.
  - Change sidebar nav item background on hover within 120ms.
  - Ensure all micro-interactions complete within 150ms maximum.
  - _Requirements: 8.1–8.8_

- [x] 14. ProTable / DataTable Component
  - Create `frontend/src/design-system/DataTable.tsx` as a ProTable-style wrapper around AntD Table with `DataTableProps<T>` interface.
  - Support sticky header, sortable columns, and resizable columns.
  - Show quick actions (view, edit, more) on row hover via CSS opacity transition.
  - Show `BulkActionBar` when rows are selected; create `frontend/src/design-system/BulkActionBar.tsx` with `role="toolbar"`.
  - Auto-enable `rc-virtual-list` virtualization for datasets ≥ 200 rows (`shouldVirtualize = dataSource.length >= 200 || props.virtualize`).
  - Show `LoadingSkeleton variant="table"` when `loading` prop is true.
  - Show `EmptyState` component (illustration + headline + CTA) when `dataSource` is empty; create `frontend/src/design-system/EmptyState.tsx`.
  - Create `frontend/src/design-system/ExportMenu.tsx` for CSV/Excel/PDF export dropdown.
  - Update table within 200ms when a column is sorted.
  - Create `frontend/src/design-system/PageHeader.tsx` and `FilterBar.tsx` as companion components.
  - _Requirements: 14.1–14.9_

- [x] 15. Form Components & Auto-Save
  - Create `frontend/src/design-system/FormLayout.tsx` implementing the two-column layout: main form (8 cols) + sticky summary panel (4 cols).
  - Create `frontend/src/design-system/EditableLineItems.tsx` with drag-reorder (using `@dnd-kit/sortable` or equivalent) and keyboard navigation (Tab/Enter).
  - Implement `useAutoSave(entity, id, formValues)` hook in `frontend/src/hooks/useAutoSave.ts`: `setInterval` every 30,000ms calling `draftsStore.saveDraft`; show error toast within 3 seconds if auto-save fails.
  - Implement unsaved-changes guard using React Router `useBlocker(isDirty)`; show `ConfirmDialog` when blocker is triggered.
  - Show inline validation + summary banner at top of form listing all validation errors.
  - Implement "Save / Save & New / Save & Send" split button component.
  - Create `frontend/src/design-system/MoneyInput.tsx` for IQD/USD multi-currency input.
  - Create `frontend/src/design-system/MoneyDisplay.tsx` wrapping formatted money in `<bdi>`.
  - Create `frontend/src/design-system/EntitySelect.tsx` as async select for Customer/Item/Account.
  - Create `frontend/src/design-system/ConfirmDialog.tsx` for danger/neutral confirmation modals.
  - _Requirements: 15.1–15.7_

- [x] 16. Login Page Redesign
  - Create `frontend/src/features/auth/LoginPage.tsx` using `AuthLayout` (50/50 split-screen).
  - Branding side (hidden on < 768px): `<Particles>` background (React Bits, via `MotionGate`), company logo, tagline, `<Typewriter>` hero text.
  - Form side (full width on < 768px): Glass Morphism card (`backdrop-filter: blur(16px)`, `glass.login` tokens), email + password inputs, login button.
  - Render `LanguageSwitcher` in the top corner of the login page (accessible before authentication).
  - Support Dark Mode and Light Mode.
  - Implement login attempt tracking: show error message in selected language on failure; lock form for 15 minutes after 5 failed attempts; display countdown timer while locked.
  - Support full keyboard navigation: Tab cycles through fields, Enter submits, focus visually indicated on all inputs.
  - _Requirements: 16.1–16.7_

- [x] 17. Dashboard & KPI Cards
  - Create `frontend/src/design-system/KpiCard.tsx` with `KpiCardProps`: `title`, `value` (with `<CountUp>` via `MotionGate`), `delta` (%), `sparklineData` (recharts `<AreaChart>`), `icon`, `currency`, `loading`, `onClick`.
  - Show `LoadingSkeleton variant="card"` when `loading` is true; navigate to filtered list page on card click.
  - Create `frontend/src/features/dashboard/DashboardPage.tsx` with 12-column CSS Grid layout and responsive breakpoints (4 KPI cards per row desktop, 2 tablet, 1 mobile; chart cards span 6 desktop, 12 mobile).
  - Add `<Particles>` background effect to dashboard hero section (via `MotionGate`).
  - Implement filter bar: date range, branch, currency.
  - Create `frontend/src/design-system/ChartCard.tsx` wrapping recharts with skeleton + error state.
  - Add charts: Revenue trend, Top customers, Aging, Cash flow (all using recharts).
  - Refresh all KPI cards and charts within 500ms when dashboard filter changes.
  - _Requirements: 13.1–13.8_

- [x] 18. List Pages
  - Create representative list page templates for: Invoices, Customers, Items, Bills, Purchase Orders, Payments.
  - Each list page must follow the anatomy: `<PageHeader>` + `<FilterBar>` + `<BulkActionBar>` + `<DataTable>` + `<Pagination>`.
  - Wrap each list page in `<PageTransition>` and `<Suspense fallback={<LoadingSkeleton variant="table" />}>`.
  - Ensure export (CSV, Excel, PDF) is available via `ExportMenu` on all list pages.
  - Show empty state with illustration + headline + CTA when no data.
  - _Requirements: 14.1–14.9_

- [x] 19. Form Pages
  - Create representative form page templates for: Invoice Form, Bill Form, Purchase Order Form.
  - Each form page must use `<FormLayout>` (two-column), `<EditableLineItems>`, `useAutoSave`, unsaved-changes guard, inline validation, summary banner, and split save button.
  - Wrap each form page in `<PageTransition>` and `<Suspense>`.
  - _Requirements: 15.1–15.7_

- [x] 20. Accessibility (WCAG AA)
  - Audit all interactive elements (buttons, links, inputs, selects) and add `aria-label` or `aria-labelledby` where missing; add `aria-live` regions for all dynamic content updates.
  - Verify full keyboard navigation: Tab/Shift+Tab, Enter/Space, Escape, Arrow Keys for menus/listboxes/radio groups.
  - Verify WCAG AA color contrast: ≥ 4.5:1 for text, ≥ 3:1 for UI elements — fix any failing token pairs.
  - Enforce minimum touch targets of `44px × 44px` on mobile via `a11y.minTouchTarget` token.
  - Assign correct ARIA roles to all custom components: `dialog` for modals, `navigation` for nav, `list`/`listitem` for lists, `menu`/`menuitem` for dropdowns, `alert` for error messages, `grid` for DataTable, `status` for StatusTag, `toolbar` for BulkActionBar.
  - Implement `useFocusTrap` hook in `frontend/src/hooks/useFocusTrap.ts`; apply to all modals, drawers, and Command Palette.
  - Verify focus moves to first interactive element on modal open; returns to trigger on close.
  - Add Lighthouse accessibility score ≥ 95 check to CI/CD pipeline; block deployment if score < 95.
  - _Requirements: 17.1–17.8_

- [x] 21. Performance & Bundle Optimization
  - Ensure all feature routes use `React.lazy` + `Suspense` in `frontend/src/App.routes.tsx` (approximately 75 pages).
  - Configure Vite `build.rollupOptions.output.manualChunks` to split AntD, recharts, and framer-motion into separate vendor chunks.
  - Verify initial JS bundle < 300 KB gzipped; per-feature chunk < 50 KB gzipped; AntD < 120 KB gzipped; Framer Motion < 30 KB gzipped.
  - Apply `React.memo` to all design-system components (KpiCard, StatusTag, DataTable rows, etc.); apply `useMemo` to column definitions, filter options, and formatted values; `useCallback` to event handlers passed to memoized children.
  - Ensure `rc-virtual-list` virtualization is used for ≥ 200 rows; standard rendering for < 200 rows.
  - Create `frontend/src/design-system/OptimizedImage.tsx` with lazy loading + WebP with JPEG/PNG fallback; replace all raw `<img>` tags in design-system components.
  - Verify LCP ≤ 2s on Slow 4G profile (1.6 Mbps / 150ms RTT) and Lighthouse Performance score ≥ 90 in mobile throttled mode.
  - _Requirements: 18.1–18.7_

- [x] 22. Print Templates
  - Create `frontend/src/design-system/PrintView.tsx` wrapper that calls `window.print()` and hides navigation/sidebar via `@media print` CSS.
  - Create print template components for: Invoice, Quote, Bill, Purchase Order, Receipt — each implementing `PrintTemplateProps` (`document`, `company`, `isRTL`, `currency`).
  - Format all templates for A4 paper size (`@page { size: A4; margin: 20mm; }`).
  - Support RTL (`dir="rtl"`) and LTR (`dir="ltr"`) rendering per `isRTL` prop.
  - Format IQD using `ar-IQ` locale and USD using `en-US` locale in all templates.
  - Display company logo (`OptimizedImage`) and company info at the top of every template.
  - Apply `@media print` CSS to hide `.sidebar`, `.topbar`, `.no-print` and show `.print-only`.
  - _Requirements: 19.1–19.7_

- [x] 23. i18n Completeness & Localization
  - Verify all 20 namespaces are populated in all three locales (`ku`, `en`, `ar`) with ≥ 700 keys per locale.
  - Ensure no English-only error messages exist — all `errors` namespace keys must be present in all three locales.
  - Verify Kurdish Sorani is the default language (`fallbackLng: 'ku'`).
  - Verify missing keys fall back to the key string (not empty string or undefined).
  - Apply `ar-IQ` number/currency formatting for Kurdish and Arabic; `en-US` for English.
  - Write Vitest integration test `frontend/src/locales/i18n.integration.test.ts` verifying every key in any locale file exists in all three locale files; add to CI to block deployment on failure.
  - _Requirements: 20.1–20.7_

- [x] 24. Unit & Property-Based Tests
  - Set up Vitest + React Testing Library in `frontend/` if not already configured; install `fast-check` as a devDependency if not already present.
  - Write unit tests for: `buildAntTokens` output correctness, `resolveLanguage`, `formatMoney`, `formatDate`, `navStore` favorites/recents limits, `draftsStore` auto-save, `useLoadingState` threshold logic, `LoginPage` lock logic, `KpiCard` rendering, `LoadingSkeleton` variants, `DataTable` virtualization threshold.
  - [x] 24.1 Write property test for Property 1: Theme modes produce distinct background colors (**Validates: Requirements 1.2**)
  - [x] 24.2 Write property test for Property 2: Density modes produce distinct control heights (**Validates: Requirements 1.5**)
  - [x] 24.3 Write property test for Property 3: RTL font family contains Vazirmatn; LTR contains Inter (**Validates: Requirements 1.7**)
  - [x] 24.4 Write property test for Property 4: Theme and density preferences round-trip through localStorage (**Validates: Requirements 1.9**)
  - [x] 24.5 Write property test for Property 5: Reduced-motion disables all animation durations (**Validates: Requirements 2.5, 7.6, 9.7**)
  - [x] 24.6 Write property test for Property 6: All non-page-transition duration tokens are ≤ 300ms (**Validates: Requirements 2.6, 7.7**)
  - [x] 24.7 Write property test for Property 7: RTL languages set dir="rtl" on the html element (**Validates: Requirements 3.5**)
  - [x] 24.8 Write property test for Property 8: Language selection persists to localStorage (**Validates: Requirements 3.7**)
  - [x] 24.9 Write property test for Property 9: Invalid language codes fall back to Kurdish Sorani (**Validates: Requirements 3.8**)
  - [x] 24.10 Write property test for Property 10: Sidebar favorites never exceed 10 items (**Validates: Requirements 4.7**)
  - [x] 24.11 Write property test for Property 11: Sidebar recents never exceed 5 items and most recent is always first (**Validates: Requirements 4.7, 4.8**)
  - [x] 24.12 Write property test for Property 12: Sidebar search returns only matching items (**Validates: Requirements 5.2**)
  - [x] 24.13 Write property test for Property 13: Sidebar only shows sections for enabled modules (**Validates: Requirements 5.9**)
  - [x] 24.14 Write property test for Property 14: Command Palette fuzzy search finds items by substring (**Validates: Requirements 6.2**)
  - [x] 24.15 Write property test for Property 15: Command Palette works correctly in both RTL and LTR (**Validates: Requirements 6.7**)
  - [x] 24.16 Write property test for Property 16: Typewriter animation duration is within bounds (**Validates: Requirements 7.1**)
  - [x] 24.17 Write property test for Property 17: Counter animation duration is within 800–1200ms (**Validates: Requirements 7.4**)
  - [x] 24.18 Write property test for Property 18: All micro-interaction duration tokens are ≤ 150ms (**Validates: Requirements 8.8**)
  - [x] 24.19 Write property test for Property 19: Skeleton is shown for loading durations ≥ 300ms; not shown for < 300ms (**Validates: Requirements 9.3, 9.4, 11.3, 11.7**)
  - [x] 24.20 Write property test for Property 20: Directional icons are flipped in RTL mode (**Validates: Requirements 10.2**)
  - [x] 24.21 Write property test for Property 21: IQD money formatting uses ar-IQ locale (**Validates: Requirements 10.4**)
  - [x] 24.22 Write property test for Property 22: Date formatting returns non-empty strings for all locales (**Validates: Requirements 10.5**)
  - [x] 24.23 Write property test for Property 23: Skeleton variants have distinct colors in dark vs light mode (**Validates: Requirements 11.6**)
  - [x] 24.24 Write property test for Property 24: Glass morphism fallback uses solid surface token (**Validates: Requirements 12.5**)
  - [x] 24.25 Write property test for Property 25: Glass morphism border is correct for each mode (**Validates: Requirements 12.6**)
  - [x] 24.26 Write property test for Property 26: KpiCard renders all five required elements for any KPI data (**Validates: Requirements 13.1**)
  - [x] 24.27 Write property test for Property 27: List pages contain all five required structural elements (**Validates: Requirements 14.1**)
  - [x] 24.28 Write property test for Property 28: Virtualization is used for datasets ≥ 200 rows (**Validates: Requirements 14.5, 18.5**)
  - [x] 24.29 Write property test for Property 29: Auto-save persists form state after 30 seconds (**Validates: Requirements 15.3**)
  - [x] 24.30 Write property test for Property 30: Login form is locked after ≥ 5 failed attempts (**Validates: Requirements 16.6**)
  - [x] 24.31 Write property test for Property 31: All interactive design-system elements have aria-label or aria-labelledby (**Validates: Requirements 17.1**)
  - [x] 24.32 Write property test for Property 32: Token color pairs meet WCAG AA contrast ratio (**Validates: Requirements 17.4**)
  - [x] 24.33 Write property test for Property 33: Custom components have correct ARIA roles (**Validates: Requirements 17.6**)
  - [x] 24.34 Write property test for Property 34: All feature routes use React.lazy (**Validates: Requirements 18.2**)
  - [x] 24.35 Write property test for Property 35: Images are rendered via OptimizedImage (**Validates: Requirements 18.6**)
  - [x] 24.36 Write property test for Property 36: Print templates render with correct direction (**Validates: Requirements 19.3**)
  - [x] 24.37 Write property test for Property 37: Print templates format currency correctly (**Validates: Requirements 19.4**)
  - [x] 24.38 Write property test for Property 38: Print templates always contain company logo and info (**Validates: Requirements 19.6**)
  - [x] 24.39 Write property test for Property 39: All error message keys exist in all three locale files (**Validates: Requirements 20.2**)
  - [x] 24.40 Write property test for Property 40: Each locale has ≥ 700 i18n keys (**Validates: Requirements 20.4**)
  - [x] 24.41 Write property test for Property 41: Missing i18n keys fall back to the key string (**Validates: Requirements 20.5**)
  - [x] 24.42 Write property test for Property 42: IQD and USD formatting differ for the same amount (**Validates: Requirements 20.6**)
  - [x] 24.43 Write property test for Property 43: All i18n keys are present in all three locale files (**Validates: Requirements 20.7**)
  - _Requirements: All (via design.md Correctness Properties 1–43)_

- [x] 25. Integration & E2E Tests
  - Write Vitest integration test `i18n.integration.test.ts` verifying locale completeness (all keys in all three locale files); add to CI.
  - Write Vitest integration test verifying all feature routes in `App.routes.tsx` use `React.lazy` (not static imports).
  - Write Vitest integration test for RTL audit: no `left`/`right` CSS properties outside `tokens.ts`; add to CI.
  - Write Playwright E2E smoke flows: Login → Dashboard → Create Invoice → Mark Paid → Print; Language switch (ku → en → ar) with RTL/LTR direction verification; Command Palette (⌘K) navigation; Accessibility audit using axe-core (Lighthouse accessibility ≥ 95).
  - Write Storybook stories for all design-system components covering: default, dark mode, RTL mode, loading state, empty state, error state.
  - _Requirements: 17.8, 18.2, 20.7_

---

## Notes

- Tasks 1, 2, and 3 have no dependencies and can be started in parallel.
- Tasks 4–6 (AppShell, Sidebar, Topbar) depend on Tasks 1–3 and should be implemented together as a unit.
- Tasks 7–10 (Language Switcher, Command Palette, Glass Morphism, Animation Library) depend on the AppShell being in place (Tasks 4–6) and can be parallelized with each other.
- Tasks 11–15 (Skeleton, Page Transitions, Micro-Interactions, ProTable, Forms) are shared design-system components that depend on Tasks 1 and 10; they can be parallelized.
- Tasks 16–19 (Login, Dashboard, List Pages, Form Pages) are feature pages that depend on the design-system components being ready (Tasks 11–15).
- Tasks 20–23 (Accessibility, Performance, Print, i18n Completeness) are quality/compliance tasks that should be done after all feature pages are implemented.
- Tasks 24–25 (Unit/PBT Tests, Integration/E2E Tests) are the final validation phase.
- All property-based tests (Task 24.1–24.43) use `fast-check` with a minimum of 100 iterations each, as specified in the design document.
- The RTL audit CI check (Task 7) and locale completeness CI check (Task 23) must block deployment on failure.
- The Lighthouse accessibility score ≥ 95 CI check (Task 20) must block deployment on failure.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3"] },
    { "id": 1, "tasks": ["4", "10"] },
    { "id": 2, "tasks": ["5", "6"] },
    { "id": 3, "tasks": ["7", "8", "9"] },
    { "id": 4, "tasks": ["11", "13"] },
    { "id": 5, "tasks": ["12", "14", "15"] },
    { "id": 6, "tasks": ["16", "17"] },
    { "id": 7, "tasks": ["18", "19"] },
    { "id": 8, "tasks": ["20", "21", "22", "23"] },
    { "id": 9, "tasks": ["24", "24.1", "24.2", "24.3", "24.4", "24.5", "24.6", "24.7", "24.8", "24.9", "24.10", "24.11", "24.12", "24.13", "24.14", "24.15", "24.16", "24.17", "24.18", "24.19", "24.20", "24.21", "24.22", "24.23", "24.24", "24.25", "24.26", "24.27", "24.28", "24.29", "24.30", "24.31", "24.32", "24.33", "24.34", "24.35", "24.36", "24.37", "24.38", "24.39", "24.40", "24.41", "24.42", "24.43"] },
    { "id": 10, "tasks": ["25"] }
  ]
}
```
