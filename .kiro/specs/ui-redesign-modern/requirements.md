# Requirements Document

## Introduction

نوێکردنەوەی تەواوی UI/UX بۆ سیستەمی Zoho ERP — گۆڕینی تەواوی دیزاینی فرۆنتئێند بۆ دیزاینێکی مۆدێرن، پرۆفیشناڵ، و نازدار. ئەم فیچەرە تەنها لایەی UI دەگۆڕێت بەبێ دەستکاری Backend API. ئامانجی سەرەکی: دروستکردنی ERP ـێکی جوان، خێرا، و ئاسان بۆ بازاڕی عێراق و هەرێمی کوردستان، بە پشتگیری تەواوی زمانی کوردی سۆرانی (RTL)، ئینگلیزی (LTR)، و عەرەبی (RTL).

---

## Glossary

- **UI_System**: سیستەمی دیزاینی تەواوی فرۆنتئێند — tokens، components، layouts، و animations.
- **Design_Tokens**: گۆڕاوەکانی بنەڕەتی دیزاین (رەنگ، spacing، typography، motion) لە `theme/tokens.ts`.
- **AppShell**: چوارچێوەی سەرەکی ئەپلیکەیشن — Sidebar + Topbar + Outlet.
- **Sidebar**: ناوبردنی لاتەرەفی کۆڵاپسیبڵ بۆ هەموو بەشەکانی ERP.
- **Topbar**: باری سەرەوەی ئەپلیکەیشن — search، notifications، language switcher، theme toggle.
- **Language_Switcher**: کۆمپۆنێنتی گۆڕینی زمان (کوردی/ئینگلیزی/عەرەبی) لە هەموو شوێنێک.
- **Command_Palette**: ئامرازی گەڕانی گلۆباڵ (⌘K/Ctrl+K) بۆ لاپەڕەکان و actions.
- **React_Bits**: لایبرەری کۆمپۆنێنتی ئەنیمەیشن و ئەفێکتی بصری بۆ React.
- **Framer_Motion**: لایبرەری ئەنیمەیشنی React بۆ page transitions و micro-interactions.
- **Glass_Morphism**: ئەفێکتی شووشەی مۆدێرن — backdrop-filter blur + شەفافیت.
- **RTL**: ئاراستەی نووسین لە ڕاست بۆ چەپ (کوردی سۆرانی + عەرەبی).
- **LTR**: ئاراستەی نووسین لە چەپ بۆ ڕاست (ئینگلیزی).
- **Dark_Mode**: دیزاینی تاریک بۆ کەمکردنەوەی ستریسی چاو.
- **Light_Mode**: دیزاینی ڕووناک — دیزاینی بنەڕەتی.
- **Skeleton_Loader**: نمایشی بارکردنی داتا بەبێ spinner — شێوەی placeholder ئەنیمەیشن.
- **Page_Transition**: ئەنیمەیشنی گۆڕینی نێوان لاپەڕەکان.
- **Micro_Interaction**: ئەنیمەیشنی بچووکی hover، click، و focus لە buttons و cards.
- **KPI_Card**: کارتی نمایشی ئامارە گرنگەکان لە dashboard.
- **ProTable**: کۆمپۆنێنتی تەواوی table بە filter، sort، pagination، و bulk actions.
- **WCAG_AA**: ستانداردی دەستگەیشتنی وێب — کۆنتراست ≥ 4.5:1 بۆ تێکست.
- **IQD**: دینارە عێراقییەکە — دراوی سەرەکی سیستەم.

---

## Requirements

### Requirement 1: Design Tokens و Theme System

**User Story:** As a designer, I want a single source of truth for all colors, spacing, and typography, so that the design system is consistent and easy to update.

#### Acceptance Criteria

1. THE UI_System SHALL define all colors, spacing, typography, and motion values as Design_Tokens in `frontend/src/theme/tokens.ts`.
2. THE UI_System SHALL support two theme modes: Light_Mode (default) and Dark_Mode, with complete component switching.
3. WHEN a user toggles the theme, THE UI_System SHALL apply the transition in 200ms using `cubic-bezier(0.2, 0, 0, 1)` easing.
4. THE UI_System SHALL enforce no inline colors or spacing in code — a build-time ESLint rule SHALL flag any hardcoded hex/rgb values outside `tokens.ts`.
5. THE UI_System SHALL support three density modes with concrete base spacing: `compact` (base 4px grid, ERP default), `comfortable` (base 6px grid), and `spacious` (base 8px grid).
6. WHEN an RTL language is selected, THE UI_System SHALL apply `direction="rtl"` and `dir="rtl"` to all components within 250ms.
7. THE UI_System SHALL use `Vazirmatn` font for RTL (Kurdish/Arabic) and `Inter` for LTR (English).
8. IF no Design_Token exists for a value, THEN THE UI_System SHALL add a new token to `tokens.ts` before using any inline value.
9. THE UI_System SHALL persist theme and density preferences in localStorage under keys `ui.theme` and `ui.density`, restoring them on page reload.

---

### Requirement 2: React Bits و Animation Library

**User Story:** As a frontend designer, I want React Bits library to be used for advanced visual effects, so that the UI is distinctive and modern.

#### Acceptance Criteria

1. THE UI_System SHALL install `react-bits` at version `^1.0.0` (pinned major) in `package.json`.
2. THE UI_System SHALL support these effects: Typewriter text, Gradient text, Shimmer text, and Counter animation.
3. THE UI_System SHALL support Particle/background effects for the login page and dashboard.
4. THE UI_System SHALL implement Glass_Morphism effects for Topbar, Sidebar, and modal backgrounds.
5. WHEN a user has `prefers-reduced-motion` enabled, THE UI_System SHALL fully disable (غەیرچالاک) all animations — not merely reduce them.
6. THE UI_System SHALL complete all non-page-transition animations within 300ms; page transitions SHALL complete within 600ms maximum.
7. WHERE a React_Bits component exists in the installed package, THE UI_System SHALL use it instead of building a custom animation.

---

### Requirement 3: Global Language Switcher

**User Story:** As a Kurdish/Arabic/English user, I want to switch languages from anywhere, so that I can use the application in my own language.

#### Acceptance Criteria

1. THE Language_Switcher SHALL support three languages: Kurdish Sorani (`ku`), English (`en`), and Arabic (`ar`).
2. THE Language_Switcher SHALL be always rendered (not hidden) in the Topbar and accessible from every page.
3. THE Language_Switcher SHALL be displayed in the Sidebar footer with an icon and label.
4. WHEN a user changes the language, THE Language_Switcher SHALL switch RTL/LTR direction with a smooth animation in 250ms.
5. WHEN Kurdish or Arabic is selected, THE Language_Switcher SHALL set `dir="rtl"` on the `<html>` element.
6. WHEN English is selected, THE Language_Switcher SHALL set `dir="ltr"` on the `<html>` element.
7. THE Language_Switcher SHALL persist the language selection in localStorage under key `i18n.language`; IF localStorage is unavailable, it SHALL fall back to the in-memory session value.
8. IF the requested locale code is not one of `['ku', 'en', 'ar']`, THEN THE Language_Switcher SHALL fall back to Kurdish Sorani (`ku`) as the default.
9. THE Language_Switcher SHALL display a visible active-language indicator (e.g., highlighted option or checkmark) showing the currently selected language.

---

### Requirement 4: AppShell و Main Layout

**User Story:** As an ERP user, I want the application shell to load quickly and navigation to be easy, so that I can complete my tasks efficiently.

#### Acceptance Criteria

1. THE AppShell SHALL compose Sidebar + Topbar + Outlet into a single unified layout.
2. THE Sidebar SHALL be `240px` wide when expanded and `64px` wide when collapsed on desktop.
3. WHEN the Sidebar is collapsed, THE Sidebar SHALL display only icons with Tooltips for each item.
4. WHEN screen width is less than `768px`, THE Sidebar SHALL render as a Drawer overlay.
5. THE Topbar SHALL be `60px` tall and remain sticky at the top of the page.
6. THE AppShell SHALL apply Glass_Morphism to the Topbar — `backdrop-filter: blur(20px) saturate(160%)`.
7. THE AppShell SHALL persist Sidebar favorites (up to 10 items) and recents (up to 5 items) in localStorage.
8. WHEN a user visits a page, THE AppShell SHALL add that page to the recents list, removing the oldest entry if the list exceeds 5 items.
9. THE AppShell SHALL support OrgSwitcher and BranchSwitcher in the Topbar.
10. WHEN the AppShell first renders, THE AppShell SHALL restore collapsed/expanded state from localStorage key `ui.sidebarCollapsed`.

---

### Requirement 5: Sidebar Navigation

**User Story:** As an ERP user, I want Sidebar navigation to be easy and fast, so that I can reach any section in a few clicks.

#### Acceptance Criteria

1. THE Sidebar SHALL organize navigation into sections: Home, Sales, Purchases, Inventory, Banking, Accounting, CRM, POS, HR, Manufacturing, Projects, Reports, Iraq, Setup.
2. THE Sidebar SHALL support inline search — a user can type a section or page name to filter items.
3. WHEN a user searches in the Sidebar, THE Sidebar SHALL display matching sections within 200ms using debounced filtering.
4. THE Sidebar SHALL display the active item with primary color and an accent rail on the inline-start side.
5. THE Sidebar SHALL support hover-intent for opening sections — opening after `700ms` of continuous hover.
6. WHEN the Sidebar is collapsed, THE Sidebar SHALL display a flyout panel for each section on click.
7. THE Sidebar SHALL display a favorites section at the top and a recents section below it.
8. THE Sidebar SHALL support Language_Switcher in the footer section.
9. IF a user has not enabled a module in onboarding, THEN THE Sidebar SHALL not display that section.
10. WHEN a user pins an item to favorites, THE Sidebar SHALL immediately reflect the change without page reload.

---

### Requirement 6: Command Palette (⌘K)

**User Story:** As a power user, I want to find any page or action with ⌘K/Ctrl+K, so that I can work without a mouse.

#### Acceptance Criteria

1. THE Command_Palette SHALL open with `⌘K` (Mac) and `Ctrl+K` (Windows/Linux) from every page.
2. THE Command_Palette SHALL support fuzzy search across all pages, actions, and recent records.
3. WHEN a user searches in the Command_Palette, THE Command_Palette SHALL display results within 100ms.
4. THE Command_Palette SHALL support full keyboard navigation: ↑↓ to move, Enter to select, Escape to close.
5. WHEN a user selects an item, THE Command_Palette SHALL close and navigate to that page.
6. THE Command_Palette SHALL use Glass_Morphism background — `backdrop-filter: blur(24px)` with 15% opacity (Dark_Mode) or 70% opacity (Light_Mode).
7. THE Command_Palette SHALL work correctly in both RTL and LTR layouts.
8. WHEN the Command_Palette opens, THE Command_Palette SHALL trap focus within it until closed.

---

### Requirement 7: Text Animations و Visual Effects

**User Story:** As a user, I want the UI to be lively and modern with text animations and visual effects, so that the user experience is better.

#### Acceptance Criteria

1. THE UI_System SHALL support Typewriter animation for hero headings on login and dashboard — each character SHALL reveal at 40–60ms intervals, with total animation completing within 3 seconds.
2. THE UI_System SHALL support Gradient text animation for KPI values and important headings — the gradient cycle SHALL complete within 3 seconds.
3. THE UI_System SHALL implement Shimmer animation for Skeleton_Loader components — loop at `1.4s` cycle.
4. THE UI_System SHALL support Counter animation for KPI_Card numbers (count up from 0 to value) — animation SHALL complete within 800–1200ms.
5. THE UI_System SHALL support Particle/background effects for the login page and dashboard hero section.
6. WHEN a user has `prefers-reduced-motion: reduce` enabled, THE UI_System SHALL skip all CSS/JS-driven text animations and display the final state immediately.
7. THE UI_System SHALL complete all CSS/JS-driven text animations (excluding typewriter) within 300ms.

---

### Requirement 8: Micro-Interactions

**User Story:** As a user, I want all buttons, cards, and inputs to give visual feedback, so that I know my click was registered.

#### Acceptance Criteria

1. WHEN a user hovers over a button, THE UI_System SHALL elevate it visually (upward shift + increased shadow) within 150ms.
2. WHEN a user presses a button, THE UI_System SHALL show a pressed state (downward shift + reduced shadow) within 50ms.
3. THE UI_System SHALL display a focus ring on all interactive elements — `2px solid primary500` with `2px offset` — visible on keyboard focus.
4. WHEN a user hovers over a card, THE UI_System SHALL elevate it visually (upward shift + increased shadow) within 150ms.
5. WHEN a button enters a loading state, THE UI_System SHALL display a spinner and disable the button; WHEN loading completes, THE UI_System SHALL restore the button to its normal state.
6. WHEN a form input has a validation error, THE UI_System SHALL display a red border and error icon; WHEN valid, THE UI_System SHALL display a green border and success icon.
7. WHEN a user hovers over a navigation item, THE Sidebar SHALL change its background color within `120ms`.
8. THE UI_System SHALL complete all micro-interactions within a maximum of `150ms`.

---

### Requirement 9: Page Transitions

**User Story:** As a user, I want transitions between pages to be smooth and easy, so that the navigation experience is better.

#### Acceptance Criteria

1. WHEN a route change occurs, THE UI_System SHALL apply a Page_Transition of `fade + 8px slide` completing in `200ms`.
2. WHEN a page exits during navigation, THE UI_System SHALL play the exit animation before the new page enters, ensuring sequential (not simultaneous) transitions.
3. WHEN a new page loads and data fetch takes ≥300ms, THE UI_System SHALL display a Skeleton_Loader; IF data fetch takes ≥5000ms, THE UI_System SHALL display an error state with a retry option.
4. IF a page load completes in under 300ms, THEN THE UI_System SHALL display neither a spinner nor a Skeleton_Loader.
5. THE UI_System SHALL load each page within 3 seconds on first visit (measured as LCP on a Slow 4G profile: 1.6 Mbps / 150ms RTT).
6. WHEN a page fails to load, THE UI_System SHALL display a friendly error screen with a "Retry" button and a "Go to Dashboard" link.
7. WHEN a user has `prefers-reduced-motion` enabled, THE UI_System SHALL apply instant transitions with no animation or delay.

---

### Requirement 10: RTL-Perfect Support

**User Story:** As a Kurdish/Arabic user, I want all UI to display correctly from right to left, so that the user experience is natural.

#### Acceptance Criteria

1. THE UI_System SHALL use `inline-start/inline-end` (not `left/right`) for all margin, padding, and positioning in CSS.
2. THE UI_System SHALL mirror directional icons (chevrons, arrows) in RTL mode using a `flip-rtl` CSS class or `transform: scaleX(-1)`.
3. THE UI_System SHALL activate AntD `direction="rtl"` for all components in RTL mode.
4. THE UI_System SHALL format numbers using `Intl.NumberFormat('ar-IQ')` for IQD and `en-US` for USD.
5. THE UI_System SHALL use `dayjs` locale for Kurdish/Arabic/English date formatting.
6. THE UI_System SHALL wrap mixed-direction strings (numbers + Kurdish text) with `<bdi>` tags.
7. WHEN the language changes, THE UI_System SHALL animate Sidebar, Topbar, and all components to the new direction within 250ms.
8. THE UI_System SHALL display the scrollbar on the left side in RTL mode.
9. THE UI_System SHALL pass an automated RTL audit (no `left`/`right` CSS properties outside `tokens.ts`) as a CI check.

---

### Requirement 11: Advanced Skeleton Loading

**User Story:** As a user, I want the UI to remain continuous during data loading and show the shape of content, so that the loading experience is better.

#### Acceptance Criteria

1. THE UI_System SHALL support Skeleton_Loader variants: row skeleton, card skeleton, chart skeleton, and table skeleton — each matching the dimensions of its real content.
2. THE UI_System SHALL implement shimmer animation for all Skeleton_Loader components — a left-to-right (or right-to-left in RTL) gradient sweep at `1.4s` cycle.
3. WHEN data takes more than 300ms to load, THE UI_System SHALL display the appropriate Skeleton_Loader variant.
4. WHEN data is ready, THE UI_System SHALL dismiss the Skeleton_Loader with a fade-out animation in `200ms`.
5. THE UI_System SHALL render Skeleton_Loader shapes that match the real content layout (not generic bars).
6. THE UI_System SHALL support Dark_Mode and Light_Mode variants for all Skeleton_Loader components.
7. THE UI_System SHALL not display a spinner in place of a Skeleton_Loader for any data-loading state lasting ≥300ms.

---

### Requirement 12: Glass Morphism Effects

**User Story:** As a designer, I want Glass_Morphism effects on Topbar, modals, and cards, so that the design is modern and elegant.

#### Acceptance Criteria

1. THE Topbar SHALL apply `backdrop-filter: blur(20px) saturate(160%)` with `rgba(255,255,255,0.82)` background in Light_Mode and `rgba(17,26,46,0.86)` in Dark_Mode.
2. THE Command_Palette SHALL apply `backdrop-filter: blur(24px)` with 70% opacity background in Light_Mode and 15% opacity in Dark_Mode.
3. THE UI_System SHALL apply Glass_Morphism to modal and drawer backgrounds in both Light_Mode and Dark_Mode with mode-appropriate opacity values.
4. THE UI_System SHALL apply `backdrop-filter: blur(16px)` with 70% opacity (Light_Mode) or 15% opacity (Dark_Mode) to the login page card.
5. WHEN a browser does not support `backdrop-filter`, THE UI_System SHALL fall back to the solid `surface` Design_Token background.
6. THE UI_System SHALL apply a `1px solid rgba(255,255,255,0.12)` border to all Glass_Morphism surfaces in Dark_Mode and `1px solid rgba(15,23,42,0.08)` in Light_Mode.

---

### Requirement 13: Dashboard و KPI Cards

**User Story:** As a manager, I want my dashboard to display important metrics in a beautiful and easy-to-understand way, so that I can make important decisions.

#### Acceptance Criteria

1. THE UI_System SHALL display KPI_Card with: title, value (with Counter animation), delta %, sparkline, and icon.
2. THE UI_System SHALL organize the dashboard grid in a 12-column responsive layout.
3. THE UI_System SHALL support charts (recharts) for: Revenue trend, Top customers, Aging, and Cash flow.
4. WHEN a user clicks a KPI_Card, THE UI_System SHALL navigate to the filtered list page for that metric.
5. THE UI_System SHALL support Particle/background effect for the dashboard hero section.
6. THE UI_System SHALL support a filter bar for the dashboard (date range, branch, currency).
7. THE UI_System SHALL display Skeleton_Loader for all KPI_Card and chart components during loading.
8. WHEN the dashboard filter changes, THE UI_System SHALL refresh all KPI_Cards and charts within 500ms.

---

### Requirement 14: List Pages و ProTable

**User Story:** As an accountant, I want to find and filter invoice and data lists quickly, so that I can complete my tasks efficiently.

#### Acceptance Criteria

1. THE UI_System SHALL organize all list pages with this anatomy: PageHeader + FilterBar + BulkActions + DataTable + Pagination.
2. THE UI_System SHALL support ProTable with sticky header, sortable columns, and resizable columns.
3. THE UI_System SHALL display quick actions (view, edit, more) on row hover.
4. THE UI_System SHALL display a bulk actions toolbar when rows are selected.
5. THE UI_System SHALL use virtualization for ≥200 rows.
6. THE UI_System SHALL display an empty state with illustration + headline + CTA.
7. THE UI_System SHALL support export (CSV, Excel, PDF) for all list pages.
8. WHEN data is loading, THE UI_System SHALL display a table skeleton.
9. WHEN a user sorts a column, THE UI_System SHALL update the table within 200ms.

---

### Requirement 15: Form Pages و Auto-Save

**User Story:** As an accountant, I want my forms to save automatically, so that my data is not lost if the browser closes.

#### Acceptance Criteria

1. THE UI_System SHALL organize form pages in a two-column layout: main form + summary panel (sticky totals).
2. THE UI_System SHALL support line items with EditableTable + drag-reorder + keyboard navigation (Tab/Enter).
3. THE UI_System SHALL auto-save drafts every 30 seconds using Zustand + localStorage.
4. WHEN a user attempts to close a form without saving, THE UI_System SHALL display a confirmation dialog asking whether to save.
5. THE UI_System SHALL display inline validation + a summary banner at the top of the form.
6. THE UI_System SHALL support a "Save / Save & New / Save & Send" split button.
7. IF auto-save fails, THEN THE UI_System SHALL notify the user with a toast notification within 3 seconds.

---

### Requirement 16: Login Page Redesign

**User Story:** As a new user, I want the login page to be beautiful and professional, so that I have a good first impression of the system.

#### Acceptance Criteria

1. THE UI_System SHALL organize the login page in a 50/50 split-screen layout: branding/illustration on one side + form on the other; on screens < 768px, the branding side SHALL be hidden and the form SHALL take full width.
2. THE UI_System SHALL implement Particle/background effect on the branding side of the login page.
3. THE UI_System SHALL apply Glass_Morphism card (`backdrop-filter: blur(16px)`) to the login form.
4. THE Language_Switcher SHALL be rendered in the top corner of the login page, accessible before authentication.
5. THE UI_System SHALL support Dark_Mode and Light_Mode for the login page.
6. WHEN a user submits incorrect credentials, THE UI_System SHALL display an error message in the selected language; after 5 failed attempts, THE UI_System SHALL lock the form for 15 minutes and display a countdown timer.
7. THE UI_System SHALL support full keyboard navigation on the login form: Tab cycles through fields, Enter submits the form, and focus is visually indicated on all inputs.

---

### Requirement 17: Accessibility (WCAG AA)

**User Story:** As a user with special accessibility needs, I want to use all UI with keyboard and screen reader, so that the system is accessible to everyone.

#### Acceptance Criteria

1. THE UI_System SHALL provide `aria-label` or `aria-labelledby` on all interactive elements (buttons, links, inputs, selects) and `aria-live` regions for dynamic content updates.
2. THE UI_System SHALL support full keyboard navigation: Tab/Shift+Tab for focus movement, Enter/Space for activation, Escape for closing overlays, Arrow Keys for menus/listboxes/radio groups.
3. THE UI_System SHALL display a focus ring on all interactive elements — `2px solid primary500` with `2px offset` — visible on keyboard focus.
4. THE UI_System SHALL meet WCAG_AA color contrast: ≥ 4.5:1 for text, ≥ 3:1 for UI elements.
5. THE UI_System SHALL implement minimum touch targets of `44px × 44px` for mobile.
6. THE UI_System SHALL assign ARIA roles to all custom components: `dialog` for modals, `navigation` for nav, `list`/`listitem` for lists, `menu`/`menuitem` for dropdowns, `alert` for error messages.
7. WHEN a modal or overlay opens, THE UI_System SHALL move focus to the first interactive element inside it, trap focus within it while open, and return focus to the trigger element on close.
8. IF the Lighthouse accessibility score is below 95 in the CI/CD pipeline build step, THEN THE UI_System SHALL block deployment until the score reaches ≥95.

---

### Requirement 18: Performance و Bundle Size

**User Story:** As a user in Iraq with slow internet, I want the application to load quickly, so that I can complete my tasks without waiting.

#### Acceptance Criteria

1. THE UI_System SHALL keep the initial JS bundle below 300KB (gzipped).
2. THE UI_System SHALL code-split all feature routes using `React.lazy` and `Suspense`.
3. THE UI_System SHALL achieve a Lighthouse Performance score ≥ 90 (measured in mobile throttled mode).
4. THE UI_System SHALL apply `React.memo` and `useMemo` to components with render time ≥ 50ms.
5. THE UI_System SHALL use `rc-virtual-list` or equivalent for virtualization of ≥200 rows; for fewer than 200 rows, standard rendering SHALL be used.
6. THE UI_System SHALL load images via `OptimizedImage` component (lazy loading + WebP with JPEG/PNG fallback).
7. WHEN a user visits a page, THE UI_System SHALL achieve LCP ≤ 2 seconds on a Slow 4G profile (1.6 Mbps / 150ms RTT).

---

### Requirement 19: Print Templates

**User Story:** As an accountant, I want to print invoices and quotes professionally, so that I can hand them to customers.

#### Acceptance Criteria

1. THE UI_System SHALL support print templates for: Invoice, Quote, Bill, Purchase Order, and Receipt.
2. THE UI_System SHALL format print templates for A4 paper size.
3. THE UI_System SHALL support both RTL (Kurdish/Arabic) and LTR (English) print templates.
4. THE UI_System SHALL apply IQD and USD formatting to print templates.
5. WHEN a user prints, THE UI_System SHALL hide navigation and sidebar and display only the document content.
6. THE UI_System SHALL display company logo and info at the top of all print templates.
7. THE UI_System SHALL apply `@media print` CSS to ensure correct rendering across browsers.

---

### Requirement 20: i18n و Localization

**User Story:** As a Kurdish user, I want all messages and labels to be in Kurdish Sorani, so that the system is suitable for the Kurdistan market.

#### Acceptance Criteria

1. THE UI_System SHALL support these i18n namespaces: common, nav, auth, dashboard, sales, purchases, inventory, accounting, banking, crm, pos, hr, payroll, manufacturing, projects, reports, settings, errors, validation, iraq.
2. THE UI_System SHALL have no English-only error messages — all messages SHALL be in the selected language.
3. THE UI_System SHALL use Kurdish Sorani as the default language.
4. THE UI_System SHALL support ~700 i18n keys per language (total ~2100 keys for three languages).
5. WHEN an i18n key is not found, THE UI_System SHALL display the key itself as a fallback (not an empty string).
6. THE UI_System SHALL apply different number and currency formatting per language: `ar-IQ` for Kurdish/Arabic, `en-US` for English.
7. THE UI_System SHALL pass a locale-completeness test (all keys present in all three locale files) as a CI check.
