# Requirements — Premium Glass RTL Experience

> **بەرنامە (Kurdish overview):** ئەم سپێکە سیستەمەکە دەبات بۆ ئەوپەڕی ئاستی ڕووکار: هەر ڕۆڵێک ڕووکاری جیاوازی خۆی هەبێت، هەموو ڕووکار گلاسمۆرفیزم بێت، هەموو شوێنێک مۆشن و ئەنیمەیشنی نەرم هەبێت، بە تەواوی مۆبایل ڕیسپۆنسیڤ بێت، و بە توندی پاکی زمان ڕابگیرێت — کاتێک کوردی هەڵبژێردراوە هیچ پیتێکی ئینگلیزی دەرناکەوێت، و پێچەوانەکەشی. **هیچ گۆڕانکارییەک لە باکئیند ناکرێت — تەنها frontend.**

## Introduction

The ERP already ships a mature, token-driven design system, a 12-role persona/theme engine
(`role-adaptive-glass-ux`, marked complete), glass tokens for 10 surfaces, and motion presets.
This spec is the **maximal elevation pass**: it raises every surface to a single, premium,
glassmorphic, role-distinct, motion-rich, fully responsive, language-pure standard — building on
the existing foundation rather than replacing it.

**Hard constraints (non-negotiable):**

- **Frontend only.** No file under `backend/` is created, edited, or deleted. No API contract,
  schema, route, or data shape changes. The UI consumes existing endpoints exactly as they are.
- **Token-only styling.** Every color/space/radius/shadow/motion value comes from
  `frontend/src/theme/tokens.ts`. No inline hex/px.
- **RTL-correct by construction.** Logical properties only; `ku`/`ar` render RTL.
- **Performance budget preserved.** App shell ≤ 8 KB gz (`audit:shell`); heavy chunks stay lazy.
- **Accessibility preserved.** 44px touch targets, visible focus, reduced-motion path, AA contrast.

---

## Requirement 1 — System-wide glassmorphism design language

**User story:** As any user, I want every surface (cards, tables, modals, drawers, popovers,
the topbar, the sidebar, dialogs, toasts, empty states) to share one cohesive, premium glass
aesthetic, so the product feels modern, expensive, and consistent on every screen.

### Acceptance criteria
1. WHEN any overlay surface renders (modal, drawer, popover, command palette, toast, dropdown),
   THE SYSTEM SHALL apply the matching `glass` token surface from `tokens.ts` (blur + saturate +
   translucent bg + hairline border) with a role-accent glow where appropriate.
2. WHEN `backdrop-filter` is unsupported, THE SYSTEM SHALL fall back to the solid `surface`/
   `darkSurface` token via `@supports`, with no loss of contrast or legibility.
3. WHEN dark mode is active, THE SYSTEM SHALL use the dark glass token variants and dark elevation.
4. THE SYSTEM SHALL expose reusable glass primitives (`GlassCard`, `GlassDialog`, `GlassDrawer`,
   `GlassPopover`, glass topbar/sidebar) so feature pages inherit the aesthetic without bespoke CSS.
5. THE SYSTEM SHALL keep content contrast on glass ≥ 4.5:1; glass is used on true overlays and
   container cards, NOT on dense data-table rows where it would harm scannability.
6. WHEN a surface uses glass, THE SYSTEM SHALL render a consistent hairline border + elevation
   shadow drawn from `glass[*].border` and `elevation`/`shadow` tokens.

## Requirement 2 — Role-distinct, tailored UX for every role

**User story:** As a specific role (owner, admin, manager, accountant, sales, purchaser,
inventory, cashier, HR, project manager, employee, viewer), I want a home, navigation, accent,
and quick-actions that fit my actual job, so the product feels built for me — not a generic shell.

### Acceptance criteria
1. THE SYSTEM SHALL resolve a distinct `RoleTheme` (accent, accent-muted, hero gradient, glass
   glow, nav profile, default route, quick actions) for each of the 12 role-theme ids.
2. WHEN a user lands post-login, THE SYSTEM SHALL route them to a role-specific dashboard home
   (`DashboardRouter` → one of 12 home layouts) whose KPIs, widgets, and quick actions match the
   role's `DashboardLayoutConfig`.
3. THE SYSTEM SHALL render a `RoleHomeHero` with role-specific copy, the role label chip, and the
   role's primary quick action styled in the role accent.
4. WHEN the role is `owner`/executive, THE SYSTEM SHALL use the distinct gold executive accent;
   WHEN `super_admin` (platform vendor), THE SYSTEM SHALL use platform indigo and the platform
   shell — never the tenant owner UI.
5. THE SYSTEM SHALL adapt the side navigation to the role's `NavProfile` (section order, optional
   sections, pinned routes, collapsed default) so each role sees a focused menu.
6. THE SYSTEM SHALL drive the role accent through a single CSS-variable provider
   (`--role-accent`, `--role-accent-muted`, `--role-glass-glow`) so accent cascades to glass
   borders, focus rings, primary actions, and active nav across the whole app.
7. THE SYSTEM SHALL keep all role copy in `t()` keys present in `ku` (source of truth) and `en`.

## Requirement 3 — Motion & micro-interactions on every surface

**User story:** As a user, I want smooth, purposeful motion — page transitions, list stagger,
dialog spring, button press, hover lift, KPI count-up — so the product feels alive and responsive,
never janky.

### Acceptance criteria
1. WHEN a route changes, THE SYSTEM SHALL play a page transition using the shared `pageVariants`
   (fade + small translate, 150–350ms, ease-out), via `AnimatePresence`.
2. WHEN a dialog/drawer opens or closes, THE SYSTEM SHALL animate it with the shared
   `dialogVariants` (scale + fade spring) and an animated scrim.
3. WHEN a list/table/grid of cards mounts, THE SYSTEM SHALL stagger item entrance (capped count)
   so long lists do not delay interaction.
4. WHEN an interactive control is hovered/pressed/focused, THE SYSTEM SHALL provide a visible
   micro-interaction (lift, accent ring, press scale) within 100ms.
5. WHEN `prefers-reduced-motion` is set, THE SYSTEM SHALL use the reduced variants (opacity-only,
   ≤ 100ms) for every animation — no exceptions.
6. THE SYSTEM SHALL never let motion block input, cause layout shift (CLS), or drop below 60fps on
   modest hardware; transforms/opacity only, no animating layout properties.

## Requirement 4 — Full mobile responsiveness

**User story:** As a user on a phone, I want every screen — shells, navigation, dashboards,
tables, forms, dialogs, the POS — to be fully usable and beautiful at narrow widths, so I can run
the business from my phone.

### Acceptance criteria
1. WHEN the viewport is < 768px, THE SYSTEM SHALL collapse the sidebar into a glass drawer/overlay
   and present a mobile-appropriate topbar with reachable controls.
2. WHEN a dialog/drawer renders on < 640px, THE SYSTEM SHALL present it as a full-width / bottom-
   sheet style surface with safe-area padding and a large close affordance.
3. WHEN a `DataTable` renders on mobile, THE SYSTEM SHALL keep it usable (horizontal scroll with
   sticky first column, or a stacked card view) without breaking layout.
4. THE SYSTEM SHALL keep all touch targets ≥ 44px on coarse pointers (`a11y.minTouchTarget`).
5. THE SYSTEM SHALL use `useMediaQuery` / CSS media queries for responsiveness — never UA sniffing
   (`lint:no-ua` must pass).
6. THE SYSTEM SHALL verify layouts at 360px, 414px, 768px, 1024px, and ≥1440px in both LTR and RTL.

## Requirement 5 — Language purity (ku ↔ en), zero foreign characters

**User story:** As a Kurdish user, I never want to see an English word in the UI; as an English
user, I never want to see a Kurdish word. The active language must be pure.

### Acceptance criteria
1. WHEN the active language is `ku`, THE SYSTEM SHALL render no Latin-script user-facing words in
   chrome, navigation, role surfaces, dialogs, buttons, placeholders, empty/loading/error states,
   or toasts (numbers, codes, brand marks, and units are exempt and stay LTR).
2. WHEN the active language is `en`, THE SYSTEM SHALL render no Arabic-script (Kurdish) characters
   in any user-facing string.
3. THE SYSTEM SHALL guarantee that every `t(key, fallback)` key used in code is present in
   `ku.json` (or its namespace), so the English fallback can never surface in the Kurdish UI.
4. THE SYSTEM SHALL provide a repeatable **language-purity guard** script that detects: (a)
   hardcoded Arabic-script literals in JSX text/attributes (would leak into `en`), and (b) keys
   referenced with an English fallback that are missing from `ku`, and exits non-zero on
   violations in the audited scope.
5. THE SYSTEM SHALL route every user-facing string through `t()` with the correct namespace;
   placeholders, `aria-label`s, tooltips, and toast messages included.
6. WHEN a new key is added, THE SYSTEM SHALL require it in both `ku` and `en` (the existing
   `locale-completeness` test and `i18n:coverage` gate stay green).

## Requirement 6 — Complete component & state coverage

**User story:** As a user, I want every component — buttons, inputs, selects, placeholders,
dialogs, confirmations, empty/loading/error states, toasts — to be polished, consistent, and
never a dead end.

### Acceptance criteria
1. THE SYSTEM SHALL render every data surface through the full state matrix: empty (with a CTA),
   loading (skeleton matching final layout, not a bare spinner), error (with retry),
   partial/offline (`ConnectionStatus`), and populated.
2. THE SYSTEM SHALL use `ConfirmDialog`/`GlassConfirm` for destructive actions with a specific
   message naming what will be affected, and `toast` for transient feedback.
3. THE SYSTEM SHALL show exactly one primary action per view; all else secondary/tertiary.
4. THE SYSTEM SHALL give every form field a translated label + placeholder, validate on blur, and
   guard unsaved changes; selectors for entities use `SelectWithQuickCreate`/`EntitySelect`.
5. THE SYSTEM SHALL ensure every interactive element has hover/active/focus/disabled states and a
   visible focus ring from `a11y.focusRingColor`.

## Requirement 7 — Preserve performance, a11y, and existing behavior

**User story:** As the product owner, I want all this polish to ship without regressing speed,
accessibility, RTL, or any existing functionality.

### Acceptance criteria
1. THE SYSTEM SHALL keep the app-shell gzip budget (`audit:shell` ≤ 8 KB) and lazy-load heavy
   surfaces (modals, drawers, charts, quick-create forms).
2. THE SYSTEM SHALL keep `DataTable` virtualization at ≥ 200 rows.
3. THE SYSTEM SHALL pass `npm run lint` (token, query-class, precise-invalidation, no-ua rules),
   `tsc --noEmit`, `npm run build`, `rtl:audit`, and `audit:glass-modals`.
4. THE SYSTEM SHALL keep all existing routes, permissions gating, feature flags, and data flows
   intact — this is a presentation-layer elevation, not a behavior change.

## Requirement 8 — Verification

**User story:** As the product owner, I want proof that everything works after the changes.

### Acceptance criteria
1. THE SYSTEM SHALL run, and report results for: `tsc --noEmit`, `npm run build`, `npm run lint`,
   `i18n:coverage` (+ strict), `rtl:audit`, `audit:glass-modals`, `vitest`, and the new
   language-purity guard.
2. WHEN a check fails due to a change in this spec, THE SYSTEM SHALL fix it before reporting done.
3. THE SYSTEM SHALL record every changed file in `CLAUDE.md` changelog and a `_deltas/` summary.
4. THE SYSTEM SHALL NOT mark a task complete while any in-scope check is red.

---

## Out of scope (this session)

- Backend changes of any kind.
- Bespoke per-page redesign of all 295 pages (the long tail is captured as follow-up tasks in
  `tasks.md`; this session lands the system-wide foundation + the 12 role surfaces + shared
  design-system components that all pages inherit).
- Arabic (`ar`) language-purity hardening (user elected ku/en focus; `ar` left as-is, kept working).
