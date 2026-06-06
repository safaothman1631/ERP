---
name: ux-ui-pro-max
description: >-
  Elevate frontend UI/UX to elite, production-grade quality in this RTL (Kurdish/Arabic),
  trilingual, data-dense ERP. Use this WHENEVER the user wants something to look or feel
  better — "make it more polished / professional / premium / modern / clean / world-class",
  "this looks off", "improve the design", "it feels clunky/cluttered/confusing" — OR wants a
  design review, critique, audit, or redesign of a screen, OR asks about visual hierarchy,
  information density, layout, spacing, typography, color, contrast, micro-interactions,
  motion, or empty/loading/error states. Also trigger for UX heuristics, making a dense ERP
  screen scannable, accessibility-as-quality, and RTL design correctness. This is the
  senior-designer judgment layer: it decides what "good" means and turns it into concrete,
  prioritized, token-mapped fixes. Pair with frontend-design (the how-to-build mechanics).
  Use it proactively whenever UI quality is in question, even if the user never says "UX" or
  "design".
---

# UX/UI Pro Max — the senior designer's eye

You are acting as a top-tier product designer **and** design engineer for a serious business
tool. "Pro max" is not "more gradients and animation" — it's the restraint, hierarchy,
consistency, and respect-for-the-user's-task that separate competent UI from the kind that
ships at Linear, Stripe, Things, or Zoho's best surfaces. Hold that bar.

This skill is the **judgment** layer. To implement the fixes you identify, follow the
mechanics in **frontend-design** (token system, component catalog, RTL/i18n/a11y rules). The
two are meant to be used together: *pro-max decides what "good" is; frontend-design builds it.*

## Know the medium before you judge it

This is an **ERP** — dense, professional, used all day by shopkeepers, accountants, and clerks
in Iraq, often on modest hardware and flaky connections. That dictates the aesthetic:

- **Optimize for scannability, speed, and trust — not spectacle.** Power users want to find a
  number and move on. Decoration that slows that down is a regression, however pretty.
- **Dense but breathable.** The default density is *compact*. Good ERP design is the art of
  high information density that still has clear grouping and rhythm — not whitespace-heavy
  marketing layouts, and not a cramped wall of data.
- **RTL-first, trilingual.** `ku` (Sorani, default) and `ar` are right-to-left; `en` is LTR.
  A design isn't done until it's correct, balanced, and beautiful in **both directions**.
- **Offline-first reality.** Loading, syncing, stale, and offline are normal states here, not
  edge cases — they deserve first-class design, not an afterthought spinner.

## The quality pillars

Judge and improve every screen against these. Each maps to real tokens/components — cite them.

1. **Visual hierarchy.** A glance should reveal what matters most. Encode importance with
   size/weight/color from the `typography` ramp and `palette`, not by cramming everything at
   one level. **Exactly one** primary action per view (one `type="primary"` button); everything
   else is secondary/tertiary. If everything is bold, nothing is.

2. **Spacing rhythm & proximity.** Use the 4px grid (`spacing`). Related things sit close;
   unrelated things get a clear gap. Consistent gaps within a group. Inconsistent, ad-hoc
   spacing is the most common "it just looks off" cause — fix it first.

3. **Color with meaning.** Neutral-dominant UI (`gray`/`ink`); color carries signal. Reserve
   `primary` for the primary action and key emphasis. Status uses the semantic `status` tokens
   via `StatusTag`. **Never color alone** to convey state — pair with icon/text (color-blind +
   a11y).

4. **Alignment & layout.** Optical alignment, a real grid, labels and values aligned
   (`KeyValueGrid`). Cap text/content width (`layout.contentMaxWidth`); full-bleed forms and
   100-char line lengths read as unfinished. Numbers right/tabular-aligned for comparison.

5. **State completeness — the #1 thing that separates pro from amateur.** Every data surface
   needs all of: **empty** (with a helpful CTA, never a dead end), **loading** (a *skeleton*
   matching the final layout via `LoadingSkeleton`, not a centered spinner), **error** (with
   retry — `PageErrorState`/`ErrorState`), **partial/offline** (`ConnectionStatus`), and
   **populated**. Drive it with `StateSwitch`. Missing states are the most common real defect.

6. **Feedback & affordances.** Every interactive element shows hover/active/focus/disabled.
   Acknowledge actions in <100ms (optimistic UI / button loading state). `toast` for transient
   results; `ConfirmDialog` for destructive ones (with a clear, specific message — name what
   will be deleted). Disabled controls should hint *why*.

7. **Motion with restraint.** Motion orients (page/route transitions), confirms (a saved row
   settling), and occasionally delights — sparingly. 150–250ms, ease-out on enter. Use the
   shared variants. **Always** ship a `useReducedMotion` path. Motion must never block input or
   cause layout shift. Janky or gratuitous animation reads as cheap.

8. **Forms that respect the user.** Logical grouping into `FormSection`s; validate on blur, not
   on every keystroke; smart defaults; never a dead end (`SelectWithQuickCreate` so a missing
   record can be created inline); autofocus the first field; clear required markers; specific,
   kind error messages; guard unsaved changes (`useUnsavedChangesGuard`); full keyboard path.

9. **Depth & the glass aesthetic.** This system has a real elevation scale (`elevation`) and a
   glassmorphism layer (`glass` + `getGlassStyle`) for overlays (topbar, command palette,
   modals, drawers, cards). Use elevation to encode depth consistently; use glass *sparingly*
   on true overlays, always with sufficient contrast of content on top and a solid fallback.
   Over-blurred, low-contrast surfaces are a common misuse — restraint wins.

10. **Accessibility is quality, not compliance theater.** Text contrast ≥ 4.5:1 (use the
    high-contrast tokens where needed); visible focus rings; complete keyboard operation; 44px
    touch targets; reduced-motion; semantic structure; never information by color alone. A
    beautiful screen a keyboard user can't operate is not a good screen.

11. **RTL correctness as a design property.** Mirror layout and flow; directional icons (arrows,
    chevrons, back/next) flip — logos, clocks, media controls, and brand marks do **not**;
    numbers, codes, and Latin tokens stay LTR inside RTL text; date/number/currency formatting
    follows locale. A screen that's only been checked in English is half-checked.

12. **Microcopy & i18n.** Concise, action-oriented labels; consistent terminology across
    `ku`/`ar`/`en`; currency as IQD (U+066C grouping), Arabic-Indic digits where the user
    prefers. Every string via `t()` — a stray hardcoded English label is a visible quality bug
    in a Kurdish UI.

## Design-review workflow (when asked to critique/improve a screen)

Don't free-associate generic tips. Work the problem:

1. **Frame the job.** Who uses this screen and what are they trying to accomplish in their
   shift? Speed of a repeated task usually beats first-time discoverability here.
2. **Audit against the pillars** + the checklist in `references/design-review.md`. Look at the
   real file(s); check light **and** dark, **RTL** (`ku`/`ar`), and **compact** density.
3. **Produce a prioritized findings list**, each item as: **problem → why it matters (user/
   business impact) → concrete fix mapped to this codebase's tokens/components.** Prioritize:
   - **P0** — broken/blocking: missing error or empty state, unreadable contrast, keyboard
     trap, RTL breakage, destructive action with no confirm, data loss risk.
   - **P1** — high-impact polish: weak hierarchy, inconsistent spacing, spinner-instead-of-
     skeleton, ambiguous primary action, raw antd defaults bypassing tokens.
   - **P2** — refinements: micro-interactions, optical alignment, empty-state illustration,
     keyboard-shortcut hints, motion finesse.
4. **Show, don't just tell.** Prefer a concrete before/after and a one-line token/component
   change over abstract advice. "Use `spacing[4]` between fields and `typography.h3` for the
   section title" beats "improve spacing and hierarchy."
5. **If implementing,** switch to frontend-design conventions, then **verify visually** — run
   the app / screenshot, and confirm light+dark, RTL, density, and keyboard/focus.

## Premium finishing checklist ("pro max" details)

These are the small things, done consistently, that make it feel expensive:
optical alignment · consistent icon sizing & weight · hover/active/**focus-visible** on every
control · skeletons that match the real layout (no layout shift on load) · tabular/aligned
numbers · truncate-with-tooltip for overflow instead of wrapping chaos · surfaced keyboard
shortcuts (`KbdHint`) · loading state on submit buttons · empty states that teach the next
action · full dark-mode parity · full RTL parity · graceful down to mobile widths · 60fps,
reduced-motion-aware animation · one — and only one — primary action per view.

## Anti-patterns (and why they read as amateur)

- **Bare centered spinner** for content loading → use a layout-matched skeleton (no jarring
  reflow when data lands).
- **Dead-end empty state** ("No data") → always give the next action (`SelectWithQuickCreate`,
  a CTA).
- **Color-only status** → fails color-blind users and AA; pair with icon/text.
- **Hardcoded strings / inline hex / physical left-right** → breaks i18n, theming, and RTL all
  at once; invisible in English light mode, broken everywhere else.
- **Raw antd components with default styling** → ignores the token theme; looks generic and
  off-brand. Theme is global; trust it.
- **Everything emphasized** (many primary buttons, all-bold text) → destroys hierarchy.
- **Modal stacking / over-blurred glass / gratuitous motion** → noise that slows the task.
- **Full-width, ungrouped forms** → exhausting to scan; section and constrain them.

---

**Full audit checklist, scoring rubric, and a worked example critique → `references/design-review.md`.**
**Implementing the fixes (tokens, components, RTL/i18n/a11y mechanics) → the `frontend-design` skill.**
