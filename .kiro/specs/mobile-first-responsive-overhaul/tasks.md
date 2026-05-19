# Implementation Tasks

## Task 1: Fix Global CSS — overflow-x prevention and mobile typography
- [x] 1.1 Add `html, body { overflow-x: hidden; max-inline-size: 100vw; }` to `global.css`
- [x] 1.2 Add mobile typography rules: body min 14px, captions 12px, h1 max 22px, h2 max 18px, line-height 1.5
- [x] 1.3 Add `font-size: 16px` to all text inputs on mobile to prevent iOS Safari zoom
- [x] 1.4 Add touch target utility: `.touch-target { min-block-size: 44px; min-inline-size: 44px; }`
- [x] 1.5 Verify `index.html` has `viewport-fit=cover` in meta viewport tag (already present, confirm)

## Task 2: Fix BottomNav in LayoutChrome.tsx
- [x] 2.1 Update BottomNav to use `position: fixed; inset-block-end: 0; inset-inline-start: 0; inset-inline-end: 0` (logical properties, no `left/right/bottom`)
- [x] 2.2 Set height to `calc(56px + env(safe-area-inset-bottom, 0px))` and `padding-block-end: env(safe-area-inset-bottom, 0px)`
- [x] 2.3 Add 5th tab: Search/Command button that opens CommandPalette (currently has 4 tabs + search button, verify count)
- [x] 2.4 Add active tab highlighting: primary brand color + filled icon variant when route matches
- [x] 2.5 Add `role="navigation"` and `aria-label` via `useTranslation()` to the nav element
- [x] 2.6 Add `aria-current="page"` to active tab item
- [x] 2.7 Ensure each tab item has min 44×44px touch target
- [x] 2.8 Remove any physical CSS properties (`left`, `right`, `bottom`) — use logical only

## Task 3: Fix TopBar.tsx — compact mobile variant
- [x] 3.1 Import `useViewport` in `TopBar.tsx`
- [x] 3.2 When `isMobile`: render compact 56px bar with only hamburger + logo + bell
- [x] 3.3 Hamburger button: `onToggle` prop, 44×44px touch target, `aria-label` + `aria-expanded`
- [x] 3.4 Centered app name/logo in mobile topbar
- [x] 3.5 Bell badge on inline-end (LTR) / inline-start (RTL) — opens NotificationsDrawer
- [x] 3.6 Hide on mobile: search pill, OrgSwitcher, BranchSwitcher, density switcher, theme toggle, language switcher, user menu
- [x] 3.7 Apply `padding-inline-start: max(16px, env(safe-area-inset-left, 0px))` and `padding-inline-end: max(16px, env(safe-area-inset-right, 0px))`
- [x] 3.8 RTL: hamburger on inline-end, bell on inline-start

## Task 4: Fix AppShell.tsx — mobile drawer navigation
- [x] 4.1 Add `drawerOpen` state for mobile SideNav drawer
- [x] 4.2 Pass `onToggle` to TopBar that opens/closes the drawer on mobile
- [x] 4.3 Render SideNav inside AntD `Drawer` when `isMobile` and `drawerOpen` is true
- [x] 4.4 Drawer placement: `left` for LTR, `right` for RTL
- [x] 4.5 Drawer: `role="navigation"`, `aria-label` via `useTranslation()`
- [x] 4.6 Close drawer on outside tap (AntD Drawer handles this with `maskClosable`)
- [x] 4.7 Apply safe-area padding to root layout: `padding-inline-start: env(safe-area-inset-left, 0px)`, `padding-inline-end: env(safe-area-inset-right, 0px)`, `padding-block-start: env(safe-area-inset-top, 0px)`
- [x] 4.8 `Layout.Content` padding-block-end: `max(80px, calc(80px + env(safe-area-inset-bottom, 0px)))` on mobile
- [x] 4.9 When `isTablet`: default to collapsed sidebar (icon-rail state)
- [x] 4.10 Ensure only one navigation element visible at a time (BottomNav XOR SideNav)

## Task 5: Fix Footer.tsx — hide on mobile, simplify on tablet
- [x] 5.1 Import `useViewport` in `Footer.tsx`
- [x] 5.2 When `isMobile`: return `null` (hide footer entirely)
- [x] 5.3 When `isTablet`: show only online/offline chip and version chip
- [x] 5.4 When `isDesktop`: show all chips (existing behavior unchanged)

## Task 6: Fix DashboardHero.tsx — mobile single-column layout
- [x] 6.1 Import `useViewport` in `DashboardHero.tsx`
- [x] 6.2 When `isMobile`: stack layout vertically (greeting above, CTA below), `flex-direction: column`
- [x] 6.3 When `isMobile`: quick-action chips in 2×2 grid (`display: grid; grid-template-columns: 1fr 1fr`)
- [x] 6.4 When `isMobile`: greeting font-size 20px, sub-text 13px
- [x] 6.5 When `isMobile`: CTA button `min-block-size: 44px`, `width: 100%`
- [x] 6.6 When `isMobile`: no horizontal overflow (`overflow: hidden` on wrap)

## Task 7: Fix Dashboard.tsx — KPI grid responsive layout
- [x] 7.1 KPI cards: `xs={12}` (2×2 grid on mobile), `sm={12}` (2×2 on tablet), `lg={6}` (4-col on desktop)
- [x] 7.2 Each KPI card: `min-block-size: 72px`, touch target 44×44px
- [x] 7.3 KPI value font: 18px on mobile (via KpiCard component or inline style)
- [x] 7.4 Verify dashboard has no horizontal scroll on mobile

## Task 8: Fix i18n language switching (Kurdish not working)
- [x] 8.1 Read `LanguageSwitcher.tsx` to verify it calls `i18n.changeLanguage(lang)`
- [x] 8.2 Verify `AppConfigProvider.tsx` re-renders on language change (subscribes to i18n `languageChanged` event or uses `useTranslation`)
- [x] 8.3 Verify `i18n.ts` `languageChanged` handler sets `document.documentElement.dir` and `document.documentElement.lang`
- [x] 8.4 Verify both `en.json` and `ku.json` are loaded at init (already done in `i18n.ts` via `Promise.all`)
- [x] 8.5 If `AppConfigProvider` uses AntD `ConfigProvider` locale, ensure it switches locale on language change
- [x] 8.6 Test: switch to Kurdish → all text should change to Kurdish

## Task 9: Build and deploy to Firebase Hosting
- [x] 9.1 Run `npm run build` in frontend directory
- [x] 9.2 Fix any TypeScript/build errors
- [x] 9.3 Deploy to Firebase Hosting: `firebase deploy --only hosting`
- [x] 9.4 Verify https://erpiq.web.app loads correctly on mobile viewport
