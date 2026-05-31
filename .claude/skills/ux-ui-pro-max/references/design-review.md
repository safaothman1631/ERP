# Design Review — audit checklist, rubric & worked example

Use this when auditing or critiquing a screen. Walk the checklist against the actual file(s),
in **light + dark**, in **RTL (`ku`/`ar`)**, at **compact** density. Then score and produce a
prioritized findings list (P0 → P2) per the workflow in SKILL.md. Map every fix to a real token
(`theme/tokens.ts`) or component (`design-system/`).

## Table of contents
1. Audit checklist (by pillar)
2. The state matrix (verify all five)
3. RTL checklist
4. Accessibility checklist
5. Density & responsive checklist
6. Scoring rubric
7. Worked example critique

---

## 1. Audit checklist (by pillar)

**Hierarchy**
- [ ] Clear primary focus on first glance; exactly one `type="primary"` action.
- [ ] Heading sizes follow the `typography` ramp; no random font sizes.
- [ ] Secondary/metadata visibly de-emphasized (`ink500`/`caption`), not competing.

**Spacing & layout**
- [ ] All gaps come from `spacing`/`space` (4px grid); consistent within groups.
- [ ] Proximity reflects relationship (related close, unrelated separated).
- [ ] Content width capped (`layout.contentMaxWidth`); forms not full-bleed.
- [ ] Optical alignment; label/value pairs aligned (`KeyValueGrid`); numbers right-aligned.

**Color**
- [ ] Neutral-dominant; `primary` reserved for the primary action/emphasis.
- [ ] Status via semantic `status` tokens / `StatusTag`, with icon+text (not color alone).
- [ ] Chart colors from `dataViz`, not ad-hoc hex.
- [ ] Zero inline hex/rgb in the code — all from tokens.

**State completeness** (see §2)
- [ ] Empty, loading (skeleton), error (retry), partial/offline, populated — all handled.

**Feedback & affordances**
- [ ] Hover / active / **focus-visible** / disabled on every interactive element.
- [ ] Action acknowledged <100ms (optimistic or button loading state).
- [ ] `toast` for transient; `ConfirmDialog` (specific message) for destructive.

**Motion**
- [ ] Shared variants; 150–250ms; ease-out on enter; no layout shift; input not blocked.
- [ ] `useReducedMotion` path present.

**Forms**
- [ ] Grouped into `FormSection`s; validate on blur; smart defaults; first field autofocused.
- [ ] No dead ends (`SelectWithQuickCreate`); unsaved-changes guard; required markers clear;
      error messages specific and kind.

**Depth/glass**
- [ ] `elevation` used consistently to encode depth; `getGlassStyle` only on true overlays,
      with readable contrast on top and a solid fallback.

**Microcopy/i18n**
- [ ] Every user-facing string via `t()` (correct namespace); terminology consistent across
      `ku`/`ar`/`en`; currency IQD; digit preference respected.

## 2. The state matrix (verify ALL five)
| State | Pro treatment | Component |
|---|---|---|
| Empty (first run) | Illustration + one-line value + CTA to create | `EmptyState` / `ListWithEmptyState` |
| Loading | Skeleton matching final layout | `LoadingSkeleton` / `LoadingState` |
| Error | Plain-language cause + retry | `PageErrorState` / `ErrorState` |
| Partial / offline / stale | Banner/indicator; don't pretend it's fresh | `ConnectionStatus` |
| Populated | The real layout | `StateSwitch` orchestrates the above |

If any of the first four is missing, that's at least a **P1** (empty/error missing on a
critical surface is **P0**).

## 3. RTL checklist
- [ ] Layout mirrors correctly; no physical `left`/`right`/`marginLeft`/`textAlign:'left'`.
- [ ] Directional icons (arrows, chevrons, back/next, send) flip; logos, clocks, media
      controls, brand marks do **not**.
- [ ] Numbers, currency, codes, and Latin tokens stay LTR inside RTL text (no reversed digits).
- [ ] Date ranges via `DateRangePickerRTL`; date/number formatting follows locale.
- [ ] Looks balanced and intentional in `ku`/`ar`, not just "not broken." `rtl:audit` clean.

## 4. Accessibility checklist
- [ ] Text contrast ≥ 4.5:1 (≥ 3:1 large); high-contrast tokens available where needed.
- [ ] Full keyboard operation; logical tab order; no traps; visible focus ring (token).
- [ ] Touch targets ≥ 44px (`a11y.minTouchTarget`); 32px only on dense desktop.
- [ ] Meaningful alt/aria; semantic roles; form labels tied to inputs.
- [ ] No information by color alone; reduced-motion respected. (axe Playwright passes.)

## 5. Density & responsive checklist
- [ ] Verified at **compact** (ERP default) — the density where overflow/cramping appears.
- [ ] No fixed heights that clip translated (often longer) `ku`/`ar` strings.
- [ ] Degrades gracefully to tablet/mobile; tables become usable (scroll/stack), not crushed.
- [ ] `useMediaQuery` for breakpoints — never UA sniffing (`lint:no-ua`).

## 6. Scoring rubric (quick 1–5 per axis, note the gaps)
| Axis | 1 (poor) | 3 (acceptable) | 5 (pro max) |
|---|---|---|---|
| Hierarchy | flat, no focus | a primary exists | instant glance-readability, one clear primary |
| Spacing | ad-hoc | mostly on grid | precise 4px rhythm, proximity-grouped |
| Color | random hex | tokens used | neutral-dominant, signal-only color, AA |
| States | only populated | empty+loading | full matrix, skeletons, retry, offline |
| Feedback | none | hover only | full interactive states, <100ms, optimistic |
| Motion | none/janky | basic | purposeful, 60fps, reduced-motion |
| A11y | fails AA | keyboard works | AA+, focus, 44px, color-safe |
| RTL | broken | mirrors | balanced & beautiful both directions |
| Consistency | bespoke | uses some DS | all DS components + tokens, no reinvention |

Anything scoring 1–2 on States, A11y, or RTL is a release blocker, not a nitpick.

## 7. Worked example critique

**Screen:** a custom invoices list someone built with a raw `antd` `<Table>`, hardcoded
column colors, an English "Loading..." text, and nothing shown when there are no invoices.

> **P0 — No empty state (dead end).** A new shop opens Invoices and sees a blank table with no
> guidance. *Fix:* render through `StateSwitch`; empty → `ListWithEmptyState` with an
> illustration and a "Create invoice" CTA gated by `usePermission('invoices.create')`.
>
> **P0 — No error state.** A failed fetch shows an empty table that looks like "no data,"
> hiding the failure. *Fix:* `PageErrorState` with retry.
>
> **P0 — Hardcoded English "Loading..." in a Kurdish RTL app.** Visible quality/i18n bug.
> *Fix:* `LoadingSkeleton variant="table"` (no text needed); any copy via `t()`.
>
> **P1 — Raw antd Table bypasses the system.** No sticky header, no bulk actions, no
> virtualization, inline hex on columns (breaks dark mode + RTL). *Fix:* replace with
> `DataTable` — sticky header, `rowSelection`→`BulkActionBar`, `exportConfig`, auto-virtualize
> ≥200 rows, themed via tokens, for free.
>
> **P1 — Status shown as a colored dot only.** Fails color-blind users and AA. *Fix:* `StatusTag`
> (icon + text + `status` token).
>
> **P1 — Amounts left-aligned as text.** Hard to compare down a column. *Fix:* `MoneyDisplay`,
> right/tabular-aligned, IQD formatting.
>
> **P2 — No row hover affordance / quick actions.** *Fix:* `DataTable` hover quick-actions
> (view/edit/more) — already built in.
>
> **P2 — Abrupt list render.** *Fix:* `AnimatedList` stagger (reduced-motion aware).

Net: most findings collapse into "use `DataTable` + `StateSwitch` + `StatusTag` + `MoneyDisplay`
and route copy through `t()`" — i.e. stop reinventing, adopt the system. That's the typical
shape of a pro-max review in this codebase: the elite move is usually *consistency*, not novelty.
