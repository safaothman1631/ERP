# Tasks — Premium Glass RTL Experience

> یاسا: **هیچ گۆڕانکارییەک لە `backend/` ناکرێت.** هەموو نووسین لە `frontend/` + `.kiro/` +
> `_deltas/` + `CLAUDE.md` دەبێت. هەر ئەرکێک کە تەواو بوو، دەبێت چێکەکانی پەیوەندیدار سەوز بن.

## Phase 0 — Spec (this session)
- [x] 0.1 `requirements.md` (R1–R8 + constraints)
- [x] 0.2 `design.md` (inheritance stack, glass, motion, role, responsive, purity guard)
- [x] 0.3 `tasks.md` (this file)

## Phase A — Global glass + motion foundation (this session)
- [ ] A.1 Expand `theme/motionPresets.ts`: add `listContainer`/`listItem`, `fadeUp`, `kpiCountUp`,
      `heroReveal`, `sheen`; each with a reduced variant. Token-driven durations/easing.
- [ ] A.2 `hooks/useGlassMotion.ts`: surface the new variants, reduced-aware.
- [ ] A.3 `theme/glassStyles.ts`: ensure surface→token mapping for dialog/drawer/popover/toast;
      optional elevation arg; keep `@supports` solid fallback.
- [ ] A.4 `global.css`: glass for `.ant-popover`, `.ant-dropdown`, `.ant-select-dropdown`,
      `.ant-message-notice-content`, `.ant-notification-notice`, `.ant-tooltip-inner`,
      `.ant-drawer-content`; role-accent cascade (button sheen, active nav, focus tint); new
      keyframes; all behind `@supports` + reduced-motion gates.

## Phase B — design-system component elevation (this session)
- [ ] B.1 `KpiCard` — glass surface, count-up number (reduced-aware), accent trim, hover lift.
- [ ] B.2 `SectionCard` / `PageHeader` — glass container option, motion reveal, responsive padding.
- [ ] B.3 `EmptyState` — premium illustration treatment, CTA-first, glass card, motion.
- [ ] B.4 `LoadingSkeleton` — shimmer keyframe, layout-matched (no CLS).
- [ ] B.5 `ConfirmDialog` — route through glass + dialog motion; specific destructive copy.
- [ ] B.6 `DataTable` — mobile responsiveness only (sticky lead col / horizontal scroll); keep
      virtualization ≥200; no behavior change.

## Phase C — Role-distinct UX (this session)
- [ ] C.1 `theme/roleThemes.ts` — richer two-stop hero gradients + distinct glass glow per role.
- [ ] C.2 `RoleHomeHero.tsx` — animated accent sheen, role icon, count-up, single accent primary.
- [ ] C.3 12 `pages/dashboard/homes/*` — confirm they render via upgraded KpiCard/SectionCard so
      every role inherits glass + motion; per-role widget mix unchanged.
- [ ] C.4 `RoleIdentityChip` — always-visible localized role label in topbar.

## Phase D — Mobile responsiveness (this session)
- [ ] D.1 `AppShell` / `SideNav` — off-canvas glass drawer < 768; hamburger; safe-area.
- [ ] D.2 `TopBar` — condensed mobile layout, icon actions, role chip preserved.
- [ ] D.3 Glass dialogs/drawers — bottom-sheet / full-width < 640 with 44px close.
- [ ] D.4 Verify 360 / 414 / 768 / 1024 / ≥1440 in LTR + RTL.

## Phase E — Language purity ku ↔ en (this session, foundation scope)
- [ ] E.1 Build `frontend/scripts/i18n-purity.mjs` (checks A/B/C, `--scope`, `--strict`, `--json`).
- [ ] E.2 Run full-repo report; run `--scope=foundation`.
- [ ] E.3 Fix in-scope violations: move literals to `t()`, author missing Kurdish keys in
      `public/locales/ku/*.json`, mirror to `en`. No auto-translation.
- [ ] E.4 Wire an npm script `i18n:purity` (frontend `package.json`).

## Phase F — Verification (this session)
- [ ] F.1 `tsc --noEmit` green.
- [ ] F.2 `npm run build` green; re-check `audit:shell` budget.
- [ ] F.3 `npm run lint` green (token/query/no-ua).
- [ ] F.4 `i18n:coverage` (+ strict) and `locale-completeness` vitest green.
- [ ] F.5 `rtl:audit` + `audit:glass-modals` green.
- [ ] F.6 `vitest --run` green (token/role/persona suites).
- [ ] F.7 `i18n:purity --scope=foundation` green.
- [ ] F.8 `git status` shows zero `backend/` changes.

## Phase G — Record (this session)
- [ ] G.1 Append changelog entry to `CLAUDE.md`.
- [ ] G.2 Write `_deltas/premium-glass-rtl-summary.md`.

---

## Long tail (follow-up sessions — NOT this session)
- [ ] L.1 Per-module bespoke polish for all 295 pages (Wave A→D modules, ext/* verticals) using the
      elevated primitives.
- [ ] L.2 Full-repo language-purity to zero (resolve all ~2,417 fallback keys + remaining literals).
- [ ] L.3 Arabic (`ar`) purity hardening (deferred by user choice).
- [ ] L.4 Playwright visual baselines per role at mobile + desktop, LTR + RTL.
- [ ] L.5 POS terminal + hardware screens bespoke glass pass.

## Definition of Done (this session)
- [ ] Spec complete (Phase 0).
- [ ] Foundation glass + motion live and inherited system-wide (Phases A–B).
- [ ] 12 roles visibly distinct with animated glass homes (Phase C).
- [ ] Shells + dialogs fully mobile responsive (Phase D).
- [ ] Language-purity guard exists; foundation scope is clean ku↔en (Phase E).
- [ ] All in-scope checks green; zero backend changes (Phase F).
- [ ] Changes recorded (Phase G).
