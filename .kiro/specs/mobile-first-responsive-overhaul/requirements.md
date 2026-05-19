# Requirements Document

## Introduction

This feature delivers a comprehensive mobile-first responsive overhaul of the entire ERP web application. The system is a Kurdish/Arabic/English ERP built with React + TypeScript + Ant Design + Tailwind CSS. The overhaul ensures every surface — shell, navigation, dashboard, tables, forms, modals, typography, and status bar — is fully usable on mobile devices (≤ 640 px) and progressively enhanced for tablet (641–1024 px) and desktop (> 1024 px) viewports.

The existing codebase already provides `useViewport()` as the single source of truth for breakpoint detection, `ResponsiveDialog`, `ResponsiveTable`, `ResponsiveForm`, and `ResponsiveChart` components, a `BottomNav` component in `LayoutChrome`, and a `safeArea.css` utility. This overhaul wires those primitives consistently across the entire application and fills the remaining gaps.

## Glossary

- **Mobile_Viewport**: viewport width ≤ 640 px (matches `useViewport().isMobile`).
- **Tablet_Viewport**: 641 px ≤ viewport width ≤ 1024 px (matches `useViewport().isTablet`).
- **Desktop_Viewport**: viewport width > 1024 px (matches `useViewport().isDesktop`).
- **AppShell**: the root layout component (`AppShell.tsx`) that composes `SideNav`, `TopBar`, `Layout.Content`, `Footer`, and `BottomNav`.
- **BottomNav**: the fixed bottom tab bar rendered on Mobile_Viewport, defined in `LayoutChrome.tsx`.
- **SideNav**: the collapsible sidebar navigation component (`SideNav.tsx`).
- **TopBar**: the sticky glass-morphism header component (`TopBar.tsx`).
- **Footer**: the sticky status-bar component (`Footer.tsx`).
- **DashboardHero**: the greeting card component at the top of the dashboard page (`DashboardHero.tsx`).
- **KPI_Card**: a single metric card on the dashboard (revenue, receivables, payables, cash).
- **ResponsiveDialog**: the existing bottom-sheet-on-mobile / centered-modal-on-desktop component.
- **ResponsiveTable**: the existing table-to-card-list component.
- **ResponsiveForm**: the existing single-column-on-mobile form wrapper.
- **Safe_Area_Insets**: CSS environment variables `env(safe-area-inset-*)` that account for device notches, rounded corners, and home indicators.
- **Touch_Target**: an interactive element's tappable hit area; must be ≥ 44 × 44 px per WCAG 2.1 AA.
- **Bottom_Sheet**: a drawer anchored to the bottom of the viewport, used in place of centered modals on Mobile_Viewport.
- **RTL**: right-to-left text direction, active when the app language is Kurdish (`ku`) or Arabic (`ar`).
- **LTR**: left-to-right text direction, active when the app language is English (`en`).
- **Hamburger_Button**: a button in the mobile TopBar that opens the SideNav as a Drawer overlay.
- **useViewport**: the existing hook in `hooks/useViewport.ts` — the single source of truth for viewport-width decisions.
- **LayoutMode**: the user-selected layout variant stored in `authStore.layoutMode`.
- **Density**: the user-selected UI density (`compact` | `comfortable` | `spacious`) stored in `uiStore.density`.

---

## Requirements

### Requirement 1: Mobile App Shell Layout

**User Story:** As a mobile user, I want the application shell to adapt to my small screen so that I can navigate and use the ERP without horizontal scrolling or hidden controls.

#### Acceptance Criteria

1. WHEN the viewport is Mobile_Viewport, THE AppShell SHALL hide the SideNav entirely and render the BottomNav fixed at the bottom of the screen.
2. WHEN the viewport is Mobile_Viewport, THE AppShell SHALL render a compact TopBar that contains only a Hamburger_Button, the application logo/name, and a notifications bell icon.
3. WHEN the viewport is Mobile_Viewport and the Hamburger_Button is tapped, THE AppShell SHALL open the SideNav as a full-height Drawer overlay sliding in from the inline-start edge.
4. WHEN the SideNav Drawer is open on Mobile_Viewport and the user taps outside the Drawer or swipes it toward the inline-start edge, THE AppShell SHALL close the Drawer.
5. WHEN the viewport is Mobile_Viewport, THE Layout.Content SHALL apply `padding-block-end` equal to `max(80px, 80px + env(safe-area-inset-bottom))` so content is never obscured by the BottomNav.
6. WHEN the viewport is Mobile_Viewport, THE AppShell SHALL apply `padding-inline-start: env(safe-area-inset-left)` and `padding-inline-end: env(safe-area-inset-right)` to the root layout container.
7. WHEN the viewport is Mobile_Viewport, THE AppShell SHALL apply `padding-block-start: env(safe-area-inset-top)` to the root layout container so content is not obscured by device notches.
8. WHEN the viewport transitions from Mobile_Viewport to Tablet_Viewport or Desktop_Viewport, THE AppShell SHALL immediately hide the BottomNav as soon as the transition begins and restore the SideNav without a page reload, ensuring only one navigation element is visible at any time.
9. WHEN the viewport is Tablet_Viewport, THE AppShell SHALL render the SideNav in its collapsed (icon-rail) state by default.
10. THE AppShell SHALL use `useViewport()` exclusively for all viewport-width decisions and SHALL NOT read `window.innerWidth` directly or use user-agent detection.

---

### Requirement 2: Mobile TopBar

**User Story:** As a mobile user, I want the top bar to be compact and uncluttered so that it does not overflow or hide important controls on my small screen.

#### Acceptance Criteria

1. WHEN the viewport is Mobile_Viewport, THE TopBar SHALL render with a height of 56 px and contain exactly three elements: a Hamburger_Button on the inline-start side, a centered application logo/name, and a notifications bell badge on the inline-end side.
2. WHEN the viewport is Mobile_Viewport, THE TopBar SHALL hide the command-search pill, OrgSwitcher, BranchSwitcher, density switcher, theme toggle, language switcher, and user-menu button.
3. WHEN the viewport is Mobile_Viewport and the notifications bell is tapped, THE TopBar SHALL open the NotificationsDrawer.
4. WHEN the viewport is Mobile_Viewport, THE Hamburger_Button SHALL have a Touch_Target of at least 44 × 44 px.
5. WHEN the viewport is Mobile_Viewport, THE notifications bell Touch_Target SHALL be at least 44 × 44 px.
6. WHEN the viewport is Tablet_Viewport, THE TopBar SHALL hide the command-search pill on both mobile and tablet viewports, and collapse the OrgSwitcher and BranchSwitcher to icon-only buttons.
7. WHEN the viewport is Mobile_Viewport, THE TopBar SHALL apply `padding-inline-start: max(16px, env(safe-area-inset-left))` and `padding-inline-end: max(16px, env(safe-area-inset-right))`, always using the larger of 16 px or the safe-area inset value.
8. WHEN the app language is Kurdish or Arabic (RTL), THE TopBar SHALL place the Hamburger_Button on the inline-end (right) edge and the notifications bell on the inline-start (left) edge using CSS logical properties.

---

### Requirement 3: Mobile Bottom Navigation Bar

**User Story:** As a mobile user, I want a persistent bottom navigation bar so that I can switch between the most important ERP sections with one thumb tap.

#### Acceptance Criteria

1. WHEN the viewport is Mobile_Viewport, THE BottomNav SHALL be fixed at the bottom of the viewport with a height of 56 px plus `env(safe-area-inset-bottom)`.
2. THE BottomNav SHALL contain exactly five tab items: Home (`/`), Invoices (`/invoices`), Items (`/items`), Banking (`/banking`), and a Search/Command button that opens the CommandPalette.
3. WHEN a BottomNav tab is active (its route matches the current pathname), THE BottomNav SHALL highlight that tab with the primary brand color and display a filled icon variant.
4. WHEN a BottomNav tab is inactive, THE BottomNav SHALL display the tab with a muted color and an outlined icon variant.
5. WHEN a BottomNav tab is tapped, THE BottomNav SHALL navigate to the corresponding route.
6. WHEN the Search tab is tapped, THE BottomNav SHALL open the CommandPalette overlay.
7. THE BottomNav SHALL apply `padding-block-end: env(safe-area-inset-bottom)` so tab labels are not obscured by the iOS home indicator.
8. EACH BottomNav tab item SHALL have a Touch_Target of at least 44 × 44 px.
9. WHEN the app language is Kurdish or Arabic (RTL), THE BottomNav SHALL maintain the same tab order (Home → Invoices → Items → Banking → Search) without mirroring the order.
10. THE BottomNav SHALL use CSS logical properties exclusively and SHALL NOT use `left`, `right`, `margin-left`, or `padding-right`.

---

### Requirement 4: Mobile Dashboard

**User Story:** As a mobile user, I want the dashboard to display KPI cards and the hero section in a readable, stacked layout so that I can quickly check business metrics on my phone.

#### Acceptance Criteria

1. WHEN the viewport is Mobile_Viewport, THE DashboardHero SHALL render in a single-column stacked layout with the greeting text above and the primary CTA button below.
2. WHEN the viewport is Mobile_Viewport, THE DashboardHero quick-action chips SHALL wrap into a 2 × 2 grid instead of a single horizontal row.
3. WHEN the viewport is Mobile_Viewport, THE DashboardHero greeting font size SHALL be 20 px and the sub-text font size SHALL be 13 px.
4. WHEN the viewport is Mobile_Viewport, THE DashboardHero primary CTA button SHALL have a minimum height of 44 px and full inline width.
5. WHEN the viewport is Mobile_Viewport, THE KPI_Card grid (DashboardKpiStrip) SHALL render as a 2 × 2 grid of cards instead of a single horizontal row of four.
6. WHEN the viewport is Mobile_Viewport, EACH KPI_Card SHALL have a minimum height of 72 px and a Touch_Target of at least 44 × 44 px.
7. WHEN the viewport is Mobile_Viewport, THE KPI_Card value font size SHALL be 18 px and the label font size SHALL be 11 px.
8. WHEN the viewport is Tablet_Viewport, THE KPI_Card grid SHALL render as a 2 × 2 grid.
9. WHEN the viewport is Desktop_Viewport, THE KPI_Card grid SHALL render as a single row of four cards.
10. WHEN the viewport is Mobile_Viewport, THE dashboard page SHALL NOT require horizontal scrolling.

---

### Requirement 5: Mobile Data Tables

**User Story:** As a mobile user, I want data tables to display as readable card lists so that I can view and act on records without horizontal scrolling.

#### Acceptance Criteria

1. WHEN the viewport is Mobile_Viewport, THE ResponsiveTable SHALL render each row as a stacked card with label/value pairs in the same column order as the desktop table.
2. WHEN the viewport is Mobile_Viewport and a table card has row actions, THE ResponsiveTable SHALL provide both a swipe-to-reveal gesture and a tap-accessible overflow menu button (≥ 44 × 44 px) to reach those actions.
3. WHEN the viewport is Mobile_Viewport and a table has more than five columns, THE ResponsiveTable SHALL show only `priority: 'high'` columns by default and provide a "Show more" toggle per card.
4. WHEN the viewport is Tablet_Viewport and a table has more than five columns, THE ResponsiveTable SHALL show only `priority: 'high'` columns and provide a per-row expandable "Show more" affordance.
5. WHEN the viewport is Desktop_Viewport, THE ResponsiveTable SHALL render as a standard AntD grid table with a sticky header.
6. WHEN the viewport is Mobile_Viewport, THE ResponsiveTable SHALL NOT require horizontal scrolling.
7. IF a table cannot be converted to card view (e.g., a financial ledger requiring column alignment), THEN THE ResponsiveTable SHALL render with horizontal scroll and a visible scroll indicator on Mobile_Viewport.
8. WHEN the viewport is Mobile_Viewport, THE ResponsiveTable card list SHALL apply `padding-inline: max(16px, env(safe-area-inset-left))` and `padding-inline-end: max(16px, env(safe-area-inset-right))`.
9. WHEN the viewport is Mobile_Viewport, THE ResponsiveTable SHALL use `useViewport()` exclusively for the mobile/desktop branch decision.

---

### Requirement 6: Mobile Forms

**User Story:** As a mobile user, I want forms to display in a single column with large, easy-to-tap inputs so that I can fill in data accurately on a touchscreen.

#### Acceptance Criteria

1. WHEN the viewport is Mobile_Viewport, THE ResponsiveForm SHALL render all fields in a single column regardless of the `layout` prop passed by the consumer; mobile viewport always forces single column and this cannot be overridden by consumers.
2. WHEN the viewport is Mobile_Viewport, EVERY form input, select, textarea, date-picker trigger, and button inside a ResponsiveForm SHALL have a minimum block-size of 44 px.
3. WHEN the viewport is Mobile_Viewport, adjacent Touch_Targets inside a ResponsiveForm SHALL be separated by at least 8 px of vertical space.
4. WHEN the viewport is Mobile_Viewport, THE ResponsiveForm SHALL apply `font-size: 16px` to all text inputs to prevent iOS Safari from auto-zooming the viewport on focus.
5. WHEN the viewport is Mobile_Viewport and a form contains line-item rows, THE ResponsiveForm.LineItem SHALL render each line item as an expandable card with the item name and total visible in the summary and the remaining fields behind a "Edit details" disclosure.
6. WHEN the viewport is Mobile_Viewport, form labels SHALL be positioned above their corresponding inputs (block-start), not inline-start.
7. WHEN the viewport is Mobile_Viewport, THE ResponsiveForm SHALL apply `padding-inline: max(16px, env(safe-area-inset-left))` to prevent content from touching the screen edge.
8. WHEN the viewport is Tablet_Viewport, THE ResponsiveForm SHALL honour the consumer's `layout` prop (`'single'` or `'two-column'`).
9. WHEN the viewport is Desktop_Viewport, THE ResponsiveForm SHALL honour the consumer's `layout` prop.

---

### Requirement 7: Mobile Modals and Drawers

**User Story:** As a mobile user, I want dialogs and drawers to appear as bottom sheets so that they are easy to dismiss and interact with using my thumb.

#### Acceptance Criteria

1. WHEN the viewport is Mobile_Viewport, THE ResponsiveDialog SHALL render as a Bottom_Sheet anchored to the bottom of the viewport with rounded top corners (border-start-start-radius and border-start-end-radius of 16 px).
2. WHEN the viewport is Mobile_Viewport, THE Bottom_Sheet SHALL display a drag handle pill at the top center and support a swipe-down gesture to dismiss.
3. WHEN the swipe-down drag distance exceeds 30% of the Bottom_Sheet's block-size, THE ResponsiveDialog SHALL dismiss the dialog.
4. WHEN the viewport is Mobile_Viewport, THE Bottom_Sheet SHALL have a maximum block-size of 90 vh.
5. WHEN the viewport is Mobile_Viewport, THE Bottom_Sheet primary action button SHALL be positioned in the bottom 25% of the dialog (thumb zone) and have a minimum height of 44 px.
6. WHEN the viewport is Mobile_Viewport, THE Bottom_Sheet SHALL apply `padding-block-end: max(16px, env(safe-area-inset-bottom))` so the primary action is not obscured by the home indicator.
7. WHEN the viewport is Mobile_Viewport, THE Bottom_Sheet body SHALL be the only scrollable region; the header and footer SHALL remain sticky.
8. WHEN the viewport is Tablet_Viewport or Desktop_Viewport, THE ResponsiveDialog SHALL render as a centered modal with a maximum inline-size of 560 px; mobile viewports are restricted to only render as bottom sheets.
9. WHEN `suppressSwipeDismiss` is true, THE ResponsiveDialog SHALL completely disable all swipe gesture detection (not just the dismiss action) to prevent accidental data loss.
10. WHEN the viewport is Mobile_Viewport, THE Bottom_Sheet SHALL use CSS logical properties exclusively and SHALL NOT use `left`, `right`, `margin-left`, or `padding-right`.

---

### Requirement 8: Mobile Typography

**User Story:** As a mobile user, I want text to be legible at comfortable sizes so that I can read content without zooming.

#### Acceptance Criteria

1. WHEN the viewport is Mobile_Viewport, THE application SHALL apply a minimum body font size of 14 px for all paragraph and label text.
2. WHEN the viewport is Mobile_Viewport, THE application SHALL apply a minimum caption/overline font size of 12 px.
3. WHEN the viewport is Mobile_Viewport, page heading (h1) font sizes SHALL be at most 22 px and at least 18 px to prevent overflow while maintaining visual hierarchy.
4. WHEN the viewport is Mobile_Viewport, page sub-heading (h2) font sizes SHALL be at most 18 px and at least 15 px.
5. WHEN the viewport is Mobile_Viewport, THE application SHALL apply a line-height of at least 1.5 for body text to ensure readability.
6. WHEN the app language is Kurdish or Arabic (RTL), THE application SHALL use the `Vazirmatn` font family (defined in `fontFamily.rtl` token) on all viewports.
7. WHEN the viewport is Mobile_Viewport, text inputs SHALL use `font-size: 16px` to prevent iOS Safari from auto-zooming on focus.
8. WHEN the viewport is Mobile_Viewport, THE application SHALL NOT truncate primary content text with `text-overflow: ellipsis` unless the element has an explicit `title` attribute providing the full text.

---

### Requirement 9: Touch Targets

**User Story:** As a mobile user, I want all interactive elements to have large enough tap areas so that I can activate them accurately without mis-tapping.

#### Acceptance Criteria

1. THE application SHALL ensure every interactive element (button, link, input, select, checkbox, radio, switch, date-picker trigger) on Mobile_Viewport and Tablet_Viewport has a minimum Touch_Target size of 44 × 44 px.
2. WHEN an interactive element's visual size is smaller than 44 × 44 px, THE application SHALL expand the element's hit area using `min-block-size: 44px` and `min-inline-size: 44px` or equivalent padding without changing the visual appearance.
3. WHEN two Touch_Targets are adjacent, THE application SHALL ensure at least 8 px of space between them to prevent accidental activation.
4. THE BottomNav tab items SHALL each have a Touch_Target of at least 44 × 44 px on Mobile_Viewport and Tablet_Viewport.
5. THE Hamburger_Button in the mobile TopBar SHALL have a Touch_Target of at least 44 × 44 px on Mobile_Viewport and Tablet_Viewport.
6. THE Bottom_Sheet drag handle SHALL have a Touch_Target of at least 44 × 44 px on Mobile_Viewport and Tablet_Viewport.
7. THE ResponsiveTable card overflow menu button SHALL have a Touch_Target of at least 44 × 44 px on Mobile_Viewport and Tablet_Viewport.
8. WHEN the viewport is Tablet_Viewport, THE application SHALL apply a minimum Touch_Target of 44 × 44 px to all interactive elements.
9. THE application SHALL use the `a11y.minTouchTarget` token (44 px) from `theme/tokens.ts` as the single source of truth for the minimum Touch_Target size.

---

### Requirement 10: Safe Area Insets

**User Story:** As a mobile user on a notched or rounded-corner device, I want the application content to avoid the device's unsafe areas so that no controls or text are hidden behind hardware features.

#### Acceptance Criteria

1. THE AppShell root container SHALL apply the `responsive-shell` CSS class (defined in `safeArea.css`) to ensure `env(safe-area-inset-*)` padding is applied on all four sides.
2. THE BottomNav SHALL apply `padding-block-end: env(safe-area-inset-bottom)` so tab labels are not obscured by the iOS home indicator.
3. WHEN the device has a notch and `env(safe-area-inset-top)` is greater than zero, THE mobile TopBar SHALL apply `padding-block-start: env(safe-area-inset-top)` to avoid content being obscured by the status-bar notch.
4. THE Bottom_Sheet footer SHALL apply `padding-block-end: max(16px, env(safe-area-inset-bottom))` so the primary action button is not obscured by the home indicator.
5. THE Layout.Content area SHALL apply `padding-block-end: max(80px, 80px + env(safe-area-inset-bottom))` on all viewports to account for both the BottomNav height (on mobile) and the home indicator.
6. THE application SHALL use `env(safe-area-inset-*)` with a fallback value of `0px` so the layout is not broken on browsers that do not support the environment variable.
7. THE application SHALL add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` to the HTML `<head>` to enable safe-area-inset support on iOS Safari.
8. THE application SHALL use CSS logical properties (`padding-inline-start`, `padding-inline-end`, `padding-block-start`, `padding-block-end`) when applying safe-area insets and SHALL NOT use physical properties (`padding-left`, `padding-right`, `padding-top`, `padding-bottom`).

---

### Requirement 11: RTL Support on Mobile

**User Story:** As a Kurdish or Arabic-speaking mobile user, I want the entire mobile interface to be correctly mirrored for right-to-left reading so that navigation and content flow naturally.

#### Acceptance Criteria

1. WHEN the app language is Kurdish (`ku`) or Arabic (`ar`), THE AppShell SHALL set `direction: rtl` on the root layout container.
2. WHEN the app language is RTL, THE SideNav Drawer SHALL slide in from the inline-end (right) edge instead of the inline-start (left) edge.
3. WHEN the app language is RTL, THE BottomNav tab order SHALL remain unchanged (Home → Invoices → Items → Banking → Search) and the visual layout SHALL mirror automatically via `direction: rtl`.
4. WHEN the app language is RTL, THE Bottom_Sheet drag handle SHALL remain centered and the swipe-to-dismiss gesture SHALL work in the same downward direction.
5. WHEN the app language is RTL, THE ResponsiveTable card swipe-to-reveal gesture SHALL reveal actions from the inline-end edge.
6. WHEN the app language is RTL, THE mobile TopBar SHALL place the Hamburger_Button on the inline-end (right) edge and the notifications bell on the inline-start (left) edge using CSS logical properties, keeping both elements swapped as specified.
7. THE application SHALL use CSS logical properties exclusively (`inline-start`, `inline-end`, `block-start`, `block-end`) and SHALL NOT use physical directional properties (`left`, `right`, `top`, `bottom`) in any mobile layout component.
8. WHEN the app language is RTL, THE Vazirmatn font SHALL be applied to all text elements via the `fontFamily.rtl` token.
9. WHEN the app language is RTL on Mobile_Viewport, THE DashboardHero greeting text SHALL be right-aligned and the quick-action chips SHALL flow from right to left.

---

### Requirement 12: Mobile Footer / Status Bar

**User Story:** As a mobile user, I want the status bar to be hidden or simplified on mobile so that it does not consume valuable screen space.

#### Acceptance Criteria

1. WHEN the viewport is Mobile_Viewport, THE Footer (status bar) SHALL be hidden entirely.
2. WHEN the viewport is Mobile_Viewport, THE BottomNav SHALL serve as the primary persistent chrome at the bottom of the screen.
3. WHEN the viewport is Tablet_Viewport, THE Footer SHALL be visible but SHALL display only the online/offline status chip and the app version chip.
4. WHEN the viewport is Desktop_Viewport, THE Footer SHALL display all chips (online status, fiscal year, user/org, sync time, version, environment, help, API links).
5. WHEN the viewport is Mobile_Viewport and the app is offline, THE application SHALL display an offline banner below the TopBar instead of the Footer status chip.

---

### Requirement 13: Horizontal Scroll Prevention

**User Story:** As a mobile user, I want the application to never require horizontal scrolling so that I can read all content without panning.

#### Acceptance Criteria

1. THE application SHALL set `overflow-x: hidden` on the `<html>` and `<body>` elements to prevent horizontal overflow on Mobile_Viewport.
2. WHEN the viewport is Mobile_Viewport, THE AppShell Layout.Content SHALL have `max-inline-size: 100vw` to prevent content from exceeding the viewport width.
3. WHEN the viewport is Mobile_Viewport, THE TopBar SHALL NOT overflow horizontally; all elements that do not fit SHALL be hidden or moved to a secondary menu.
4. WHEN the viewport is Mobile_Viewport, THE DashboardHero SHALL NOT overflow horizontally; the inner layout SHALL use `flex-wrap: wrap` or a single-column grid.
5. IF a component cannot avoid horizontal overflow (e.g., a wide financial ledger table), THEN THE component SHALL wrap its content in a horizontally scrollable container with `-webkit-overflow-scrolling: touch` and a visible scroll indicator.
6. WHEN the viewport is Mobile_Viewport, THE BottomNav SHALL have `width: 100%` and SHALL NOT overflow horizontally.

---

### Requirement 14: Existing Responsive Component Adoption

**User Story:** As a developer, I want all pages and features in the application to use the existing responsive component primitives so that mobile behavior is consistent across the entire ERP.

#### Acceptance Criteria

1. THE application SHALL use `ResponsiveDialog` for every modal and drawer interaction across all ERP modules.
2. THE application SHALL use `ResponsiveTable` for every data table across all ERP modules.
3. THE application SHALL use `ResponsiveForm` for every form across all ERP modules.
4. THE application SHALL use `ResponsiveChart` for every chart across all ERP modules.
5. THE application SHALL use `useViewport()` as the single source of truth for all viewport-width decisions and SHALL NOT use `window.innerWidth` directly, `navigator.userAgent`, or CSS media queries in JavaScript.
6. WHEN a page or module does not yet use the responsive primitives, THE application SHALL wrap its tables in `ResponsiveTable`, its forms in `ResponsiveForm`, and its modals in `ResponsiveDialog` as part of this overhaul.
7. THE application SHALL apply the `responsive-shell` CSS class to the AppShell root container to enable safe-area-inset support globally.

---

### Requirement 15: Mobile Performance

**User Story:** As a mobile user on a slower network or lower-powered device, I want the application to load and respond quickly so that I can work efficiently.

#### Acceptance Criteria

1. WHEN the viewport is Mobile_Viewport, THE application SHALL lazy-load non-critical dashboard widgets (charts, secondary KPI panels) so that the initial paint is not blocked.
2. WHEN the viewport is Mobile_Viewport, THE BottomNav and TopBar SHALL be rendered synchronously (not lazy-loaded) so navigation is always available immediately.
3. WHEN the viewport is Mobile_Viewport, THE application SHALL lazy-load the SideNav component bundle and only load it when the user taps the Hamburger_Button for the first time, not on initial page load.
4. WHEN the viewport is Mobile_Viewport, images and avatars SHALL use `loading="lazy"` and SHALL be sized appropriately for the mobile viewport.
5. WHEN the viewport is Mobile_Viewport, THE application SHALL debounce scroll and resize event handlers to at most one invocation per 16 ms (one animation frame).

---

### Requirement 16: Accessibility on Mobile

**User Story:** As a mobile user relying on assistive technology, I want the mobile interface to be accessible so that I can navigate and operate the ERP with a screen reader or switch access.

#### Acceptance Criteria

1. THE BottomNav SHALL have `role="navigation"` and an `aria-label` resolved through `useTranslation()`.
2. EACH BottomNav tab item SHALL have an `aria-label` and `aria-current="page"` when active.
3. THE Hamburger_Button SHALL have an `aria-label` resolved through `useTranslation()` and SHALL toggle `aria-expanded` to reflect the Drawer open/closed state.
4. THE Bottom_Sheet SHALL trap focus within the sheet while open and SHALL return focus to the trigger element when closed.
5. THE Bottom_Sheet drag handle SHALL have an `aria-label` resolved through `useTranslation()`.
6. WHEN the SideNav Drawer is open on Mobile_Viewport, THE Drawer SHALL have `role="navigation"` and an `aria-label` resolved through `useTranslation()`.
7. THE application SHALL maintain a visible focus ring (2 px solid, `palette.primary500` color) on all interactive elements when navigated by keyboard or switch access.
8. WHEN the app language is RTL, THE `dir` attribute on the root `<html>` element SHALL be set to `"rtl"` to ensure correct screen reader announcement order.
