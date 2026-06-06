# Design — Premium Glass RTL Experience

> **پوختە:** بناغەکە (tokens، role engine، glass primitives، motion presets) پێشتر هەیە. ئەم
> دیزاینە دەیانبەرزدەکاتەوە بۆ یەک ستانداردی پریمیۆم کە بەناو هەموو سیستەمەکەدا بڵاودەبێتەوە لە
> ڕێی **چوار چینی میرات**: tokens → چینی گلاس/مۆشنی گشتی (global CSS) → primitive-ە گلاسەکان →
> کۆمپۆنێنتی design-system. هەر پەڕەیەک کە ئەم چینانە بەکاردەهێنێت، خۆکار جوانکارییەکە وەردەگرێت.

## 1. Architecture: the inheritance stack

```
┌─ tokens.ts ─────────────────────────────────────────────────────────────┐
│ palette · spacing · radius · typography · duration/easing · glass(10) ·  │
│ elevation · shadow · a11y · layout                                       │
└──────────────┬───────────────────────────────────────────────────────────┘
               ▼
┌─ Global CSS layer (global.css + theme/globalStyles.css) ─────────────────┐
│ .glass-card/.glass-* · antd modal/drawer/popover/dropdown glass ·        │
│ role-accent CSS vars · keyframes (shimmer, float, count, sheen) ·        │
│ reduced-motion gate · responsive breakpoints                            │
└──────────────┬───────────────────────────────────────────────────────────┘
               ▼
┌─ Glass primitives (components/glass/) ───────────────────────────────────┐
│ GlassCard · GlassDialog · GlassDrawer · GlassPopover · GlassConfirm ·    │
│ GlassSaveButton · (new) GlassSurface helper                             │
└──────────────┬───────────────────────────────────────────────────────────┘
               ▼
┌─ design-system/ (60+) ───────────────────────────────────────────────────┐
│ DataTable · PageHeader · KpiCard · SectionCard · EmptyState ·           │
│ LoadingSkeleton · ConfirmDialog · FilterBar · FormLayout · Toast …      │
└──────────────┬───────────────────────────────────────────────────────────┘
               ▼
┌─ Role engine (personas/ + theme/roleThemes + components/role/) ──────────┐
│ resolveRoleUx · RoleAccentProvider · DashboardRouter · 12 home layouts · │
│ RoleHomeHero · RoleIdentityChip · nav profiles                          │
└──────────────┬───────────────────────────────────────────────────────────┘
               ▼
        295 feature pages (inherit everything above for free)
```

**Design principle:** maximize leverage. We change the lowest shared layers (global CSS, glass
primitives, the most-used design-system components, the role engine) so the 295 pages improve
without touching each one. Per-page bespoke work is the long tail in `tasks.md`.

## 2. Glass system upgrade

Current state (verified): `tokens.ts` already defines `glass` for 10 surfaces (topbar, palette,
login, modal, sidebar, card, dialog, drawer, popover, toast) with light/dark + `getGlassStyle()`.
`global.css` has `.glass-card`, antd modal/drawer glass, and a `@supports` solid fallback.

**Changes:**
1. **`theme/glassStyles.ts`** — keep the runtime `getGlassStyle(surface, accent)` helper; ensure
   every primitive maps to the correct token surface (dialog→`glass.dialog`, drawer→`glass.drawer`,
   popover→`glass.popover`, toast→`glass.toast`). Add an optional `elevation` arg.
2. **`global.css`** — extend the antd theming so `.ant-popover`, `.ant-dropdown`,
   `.ant-select-dropdown`, `.ant-message-notice-content`, `.ant-notification-notice`,
   `.ant-tooltip-inner`, and `.ant-drawer-content` all receive the matching glass surface +
   `var(--role-glass-glow)` accent, all behind the existing `@supports`/reduced-motion gates.
3. **Role-accent cascade** — `RoleAccentProvider` already sets `--role-accent`,
   `--role-accent-muted`, `--role-glass-glow` on `.role-accent-root`. We extend global CSS so
   these vars drive: primary button gradient sheen, active nav indicator, focus ring tint, KPI
   accent, and glass border glow — one variable, whole-app effect.
4. **Contrast guard** — glass is applied to overlays and container cards only. Dense table rows,
   inputs, and long-form reading text stay on solid token surfaces (R1.5).

## 3. Motion system upgrade

Current: `theme/motionPresets.ts` (page + dialog variants, each with a reduced variant) and
`hooks/useGlassMotion.ts`. Existing `components/`: `AnimatedList`, `MotionButton`, `MotionCard`,
`MotionModal`, `PageTransition`.

**Changes:**
1. Expand `motionPresets.ts` with shared, reduced-aware variants: `listContainer`/`listItem`
   (stagger, capped), `kpiCountUp`, `heroReveal`, `sheen` (button highlight), `fadeUp`. All read
   `duration`/`easing` tokens; all have a reduced counterpart.
2. `useGlassMotion()` returns the new variants too, gated by `useReducedMotion()`.
3. Apply via existing wrappers (`AnimatedList`, `MotionCard`, `PageTransition`) so pages opt in
   with one component, not bespoke `motion.div` trees.
4. **Rules:** transform/opacity only; 150–350ms; ease-out on enter; never animate layout; honor
   reduced-motion globally (the `@media (prefers-reduced-motion: reduce)` block in `global.css`
   already force-disables animation as a backstop).

## 4. Role-distinct UX

Current: 12 `ROLE_THEMES`, `DashboardRouter` → 12 home components, `RoleHomeHero`,
`DASHBOARD_LAYOUTS`, nav profiles. This is functional but accents/gradients are flat.

**Changes (polish, not rebuild):**
1. **Accent depth** — give each role theme a richer hero gradient (two-stop, role-tinted) and a
   distinct glass glow. Keep owner=gold executive, sales=blue, finance=green, pos=red,
   inventory=cyan, purchase=violet, hr=purple, manager=teal, etc. (already mapped).
2. **Hero** — `RoleHomeHero` gets a subtle animated accent sheen + role icon, count-up KPIs,
   and the single role-accent primary action. Copy stays in `t()`.
3. **Dashboards** — each of the 12 homes renders through the shared upgraded `KpiCard`/`ChartCard`/
   `SectionCard` so they all get glass + motion; per-role widget mix stays as configured.
4. **Identity** — `RoleIdentityChip` always visible in the topbar with the correct localized label.
5. **Nav** — `applyNavProfile` already focuses the menu per role; ensure the active item uses the
   role accent indicator.

## 5. Responsive strategy

Breakpoints (match existing `global.css` media queries): ≤640 (phone), ≤768 (small tablet),
768–991 (tablet), ≥992 (desktop), ≥1440 (max content width cap from `layout.contentMaxWidth`).

**Changes:**
1. **Shell** — `AppShell`/`SideNav`/`TopBar`: < 768 collapses the sidebar to an off-canvas glass
   drawer with a hamburger; topbar condenses (icon-only actions, role chip stays).
2. **Dialogs/drawers** — `GlassDialog`/`GlassDrawer`/`ConfirmDialog`/`ResponsiveDialog`: < 640
   become bottom-sheet / full-width with safe-area inset and a 44px close.
3. **DataTable** — keep horizontal scroll with a sticky leading column on mobile; ensure
   `FilterBar`/`BulkActionBar` wrap, not overflow.
4. **Touch** — `a11y.minTouchTarget` (44) enforced on coarse pointers; `lint:no-ua` keeps us on
   media/`useMediaQuery`, never UA strings.

## 6. Language-purity guard (ku ↔ en)

**Problem (measured):** 2,417 `t('key','English fallback')` calls (English leaks into `ku` when a
key is missing from `ku.json`) and ~114 source files containing Arabic-script literals (Kurdish can
leak into `en` if a literal is rendered instead of a `t()` value). Kurdish comments and the second
`t()` fallback arg are NOT leaks; rendered JSX text/attributes are.

**Tool:** `frontend/scripts/i18n-purity.mjs` (new, frontend-only, Node, no deps).

It performs three checks and prints a grouped report with file:line:
- **A. Missing-ku-keys:** scan `src/**/*.{ts,tsx}` for `t('key', ...)` / `i18n.t(...)`; collect
  keys; for each, verify the key exists in the merged `public/locales/ku/*.json` (namespace-aware:
  `ns:key` and `key` within a `useTranslation('ns')` scope). Report keys present in `en` but
  missing in `ku` → these surface English in the Kurdish UI.
- **B. Hardcoded Arabic-script in render positions:** flag Arabic-script (`؀-ۿ`,
  `ݐ-ݿ`) appearing in JSX **text nodes** and in user-facing attributes
  (`placeholder`, `title`, `aria-label`, `label`, `okText`, `cancelText`, `tooltip`,
  `message`/`description` for toasts) — excluding: comments, the 2nd arg of `t()`,
  `fallbackLabel`/`fallbackTitle` fields, `*.test.*`/`*.spec.*`, `locales/`, `i18n/`.
- **C. Stray Latin words in ku.json values:** scan `public/locales/ku/*.json` values for Latin
  words (≥3 letters) that aren't in an allow-list (brand names, units like `KB`, `IQD`, `VAT`,
  `URL`, `PDF`, `ID`, `CSV`, `SMS`, etc.) → these surface English in the Kurdish UI even when the
  key exists.

**Scope flag:** `--scope=foundation` limits A/B to the surfaces elevated this session (role/
dashboard/shell/design-system/nav/common namespaces) and exits non-zero on those; full-repo run is
report-only this session (the long tail is tracked in `tasks.md`). `--strict` fails on any.

**Fix strategy:** for in-scope violations — move the literal to a `t()` key, add the key to `ku`
(source of truth) and `en`. Where an English fallback's key is missing from `ku`, add the Kurdish
value to the namespace JSON. We do NOT auto-translate; Kurdish strings are authored.

## 7. Component upgrade inventory (this session)

| Layer | Files | Change |
|---|---|---|
| Global CSS | `global.css`, `theme/globalStyles.css` | glass for popover/dropdown/select/toast/tooltip/notification; role-accent cascade; new keyframes; responsive shell rules |
| Tokens/motion | `theme/motionPresets.ts`, `theme/glassStyles.ts`, `hooks/useGlassMotion.ts` | new reduced-aware variants; surface→token mapping; elevation arg |
| Glass primitives | `components/glass/*` | ensure correct surface mapping, responsive bottom-sheet, accent glow |
| design-system | `KpiCard`, `SectionCard`, `PageHeader`, `EmptyState`, `LoadingSkeleton`, `ConfirmDialog`, `DataTable` (responsive only) | glass + motion + responsive, reduced-aware, token-only |
| Role engine | `roleThemes.ts`, `RoleHomeHero.tsx`, `RoleAccentProvider.tsx`, 12 `homes/*` (via shared components) | richer accents/gradients, animated hero, count-up KPIs |
| Shell | `AppShell.tsx`, `TopBar.tsx`, `SideNav.tsx`, `CommandPalette.tsx` | mobile drawer nav, glass topbar/sidebar, accent active state |
| i18n | `scripts/i18n-purity.mjs` (new), `public/locales/{ku,en}/*.json` | guard + author missing Kurdish keys in scope |

## 8. Testing strategy

1. **Static:** `tsc --noEmit`, `npm run lint` (token/query/no-ua), `npm run build`.
2. **i18n:** `i18n:coverage` + `--strict`, `locale-completeness` vitest, new `i18n-purity.mjs`.
3. **RTL/glass:** `rtl:audit`, `audit:glass-modals`.
4. **Unit:** `vitest --run` (token tests, role-theme tests, persona tests stay green).
5. **Manual/visual (if dev server available):** spot-check 3–4 role dashboards in light+dark, RTL
   (`ku`) + LTR (`en`), at 360px and ≥1440px, with keyboard focus.
6. **Regression guard:** no `backend/` file touched (verified by `git status` path check).

## 9. Risks & mitigations

- **Over-blur / low contrast** → restrict glass to overlays/cards; keep table rows solid; verify
  AA contrast. (R1.5)
- **Bundle/shell bloat** → no new heavy deps; motion via existing framer-motion; lazy heavy
  surfaces; re-run `audit:shell`.
- **Breaking RTL** → logical properties only; `rtl:audit` gate.
- **Language guard false positives** → allow-list + position-aware scan (only render positions),
  excludes comments and `t()` fallbacks.
- **Accidental backend edit** → all writes constrained to `frontend/` + `.kiro/` + `_deltas/` +
  `CLAUDE.md`; `git status` checked before done.
