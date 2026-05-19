# Design Document: Mobile-First Responsive Overhaul

## Overview

This design delivers a complete mobile-first responsive overhaul of the ERP application. The existing codebase already has `useViewport()`, `ResponsiveDialog`, `ResponsiveTable`, `ResponsiveForm`, `ResponsiveChart`, and a `BottomNav` component. This overhaul wires them consistently, fixes the mobile shell layout, and fills remaining gaps.

## Architecture

### Component Hierarchy

```
AppShell
├── [mobile] MobileTopBar (56px, hamburger + logo + bell)
│   └── SideNav as Drawer overlay (slides from inline-start)
├── [desktop] TopBar (full glass-morphism header)
├── SideNav (hidden on mobile, collapsed on tablet)
├── Layout.Content (safe-area padded, no horizontal overflow)
├── [mobile] BottomNav (fixed 56px + safe-area-inset-bottom)
└── [desktop] Footer (hidden on mobile, simplified on tablet)
```

### Key Design Decisions

1. **useViewport() is the single source of truth** — no `window.innerWidth`, no UA detection, no CSS media queries in JS.
2. **CSS logical properties only** — `inline-start/end`, `block-start/end` everywhere. No `left/right/top/bottom`.
3. **Safe-area insets** — `env(safe-area-inset-*)` with `0px` fallback on all four edges.
4. **Touch targets** — minimum 44×44px via `a11y.minTouchTarget` token.
5. **i18n** — all strings via `useTranslation()`, RTL via `direction: rtl` on root.

## Component Designs

### 1. AppShell Mobile Layout (Requirement 1)

**Changes to `AppShell.tsx`:**
- When `isMobile`: hide SideNav, show BottomNav, render compact TopBar
- When `isMobile` and hamburger tapped: open SideNav as AntD `Drawer` with `placement={isRTL ? 'right' : 'left'}`
- `Layout.Content` padding-block-end: `max(80px, calc(80px + env(safe-area-inset-bottom)))`
- Root layout: `padding-inline-start: env(safe-area-inset-left)`, `padding-inline-end: env(safe-area-inset-right)`, `padding-block-start: env(safe-area-inset-top)`
- When `isTablet`: SideNav collapsed (icon-rail) by default

### 2. Mobile TopBar (Requirement 2)

**Changes to `TopBar.tsx`:**
- When `isMobile`: render compact 56px bar with only:
  - Hamburger button (inline-start on LTR, inline-end on RTL) — 44×44px touch target
  - Centered app logo/name
  - Bell badge (inline-end on LTR, inline-start on RTL) — 44×44px touch target
- Hide: search pill, OrgSwitcher, BranchSwitcher, density switcher, theme toggle, language switcher, user menu
- `padding-inline-start: max(16px, env(safe-area-inset-left))`
- `padding-inline-end: max(16px, env(safe-area-inset-right))`

### 3. BottomNav (Requirement 3)

**Changes to `LayoutChrome.tsx` BottomNav:**
- Height: `calc(56px + env(safe-area-inset-bottom))`
- `padding-block-end: env(safe-area-inset-bottom)`
- 5 tabs: Home, Invoices, Items, Banking, Search (⌘K)
- Active tab: primary brand color + filled icon
- Inactive tab: muted color + outlined icon
- Each tab: min 44×44px touch target
- `role="navigation"`, `aria-label` via `useTranslation()`
- `aria-current="page"` on active tab
- CSS logical properties only, `width: 100%`
- Use `position: fixed; inset-block-end: 0; inset-inline-start: 0; inset-inline-end: 0`

### 4. Dashboard Mobile Layout (Requirement 4)

**Changes to `DashboardHero.tsx`:**
- When `isMobile`: single-column stacked layout (greeting above, CTA below)
- Quick-action chips: 2×2 grid on mobile
- Greeting font: 20px on mobile
- Sub-text font: 13px on mobile
- CTA button: min-height 44px, full inline width on mobile

**Changes to `Dashboard.tsx` KPI grid:**
- `xs={12}` (2×2 grid) on mobile/tablet, `lg={6}` (4-col row) on desktop
- Each KPI card: min-height 72px, touch target 44×44px
- Value font: 18px on mobile, label: 11px

### 5. Footer Mobile (Requirement 12)

**Changes to `Footer.tsx`:**
- When `isMobile`: `display: none`
- When `isTablet`: show only online/offline chip + version chip
- When `isDesktop`: show all chips (current behavior)

### 6. Global CSS (Requirements 13, 8)

**Changes to `global.css` / `index.css`:**
- `html, body { overflow-x: hidden; max-inline-size: 100vw; }`
- Mobile typography: body min 14px, captions min 12px, h1 max 22px, h2 max 18px
- Line-height: 1.5 for body text on mobile
- `font-size: 16px` on all text inputs (prevent iOS zoom)

### 7. i18n Language Switching Fix

**Root cause:** The `i18n.ts` already loads both `en.json` and `ku.json` at init via `Promise.all`. The issue is that `LanguageSwitcher` component may not be calling `i18n.changeLanguage()` correctly, or the `languageChanged` event handler has a bug.

**Fix:** Verify `LanguageSwitcher.tsx` calls `i18n.changeLanguage(lang)` and that the `languageChanged` handler in `i18n.ts` correctly updates `document.documentElement.dir` and `document.documentElement.lang`. Also ensure `AppConfigProvider` re-renders on language change.

## File Change Map

| File | Changes |
|------|---------|
| `layouts/AppShell.tsx` | Mobile drawer nav, safe-area padding, tablet collapsed sidebar |
| `layouts/TopBar.tsx` | Compact mobile topbar (56px, 3 elements only) |
| `layouts/Footer.tsx` | Hide on mobile, simplified on tablet |
| `layouts/LayoutChrome.tsx` | BottomNav: 5 tabs, safe-area, touch targets, ARIA |
| `components/DashboardHero.tsx` | Mobile single-column, 2×2 chips, font sizes |
| `pages/Dashboard.tsx` | KPI 2×2 on mobile/tablet, 4-col on desktop |
| `global.css` | overflow-x hidden, mobile typography, touch targets |
| `components/LanguageSwitcher.tsx` | Verify i18n.changeLanguage() call |
| `i18n.ts` | Verify languageChanged handler |

## Token Usage

- `a11y.minTouchTarget` = 44px — touch target minimum
- `layout.topbarHeight` — desktop topbar height
- `space.*` — spacing
- `palette.*` — colors
- `radius.*` — border radius
- `zIndex.*` — z-index layers

## RTL Considerations

- All layout uses CSS logical properties
- Hamburger on inline-end when RTL, bell on inline-start
- SideNav Drawer slides from inline-end when RTL
- BottomNav tab order unchanged (Home→Invoices→Items→Banking→Search)
- `direction: rtl` on root when `ku` or `ar`
- Vazirmatn font for RTL languages
