# Feature flag retirement plan — `ui.empty_state_v2`

> Spec: `.kiro/specs/empty-state-quick-create/requirements.md` §15.
> Phase entry: EP-6 task T-E.6.3.
> Owner: FE tech lead (Safa Othman).

The migration shipped behind two layers of flags:

1. **Global kill-switch** — `ui.empty_state_v2` (default OFF during EP-0/1, default ON from EP-4 onward).
2. **Per-entity overrides** — `ui.empty_state_v2.<entity>=false` to disable a single entity if its quick-create regresses.

This document is the schedule for flipping each entity to default-on and the procedure for removing the legacy code paths after.

---

## 1. Flip schedule

The cutover from `false` → `true` for each entity is gated on a single criterion:

> The entity's `quick_create.succeeded / quick_create.opened` ratio is **≥ 80% over a rolling 14-day window** in the production-tenant cohort, with no P0/P1 escalations against the surface.

The schedule below is target dates assuming the metric holds; if any entity misses, that entity slips a week and the rest continue.

| Entity | Class | Flag flip target | Owner | Status |
|--------|-------|------------------|-------|--------|
| `customer` | A | EP-1 + 14d | FE | ☐ |
| `vendor` | A | EP-1 + 14d | FE | ☐ |
| `tax_rate` | A | EP-1 + 14d | FE | ☐ |
| `expense_category` | A | EP-2 + 14d | FE | ☐ |
| `item` | B | EP-1 + 21d | FE | ☐ |
| `account` | B | EP-2 + 21d | FE | ☐ |
| `team` | B | EP-3 + 21d | FE | ☐ |
| `bank_account` | B | EP-2 + 21d | FE | ☐ |
| `subscription_plan` | B | EP-3 + 21d | FE | ☐ |
| `location` | B | EP-3 + 21d | FE | ☐ |
| `equipment_category` | A | EP-2 + 14d | FE | ☐ |
| `currency` | A | EP-2 + 14d | FE | ☐ |
| `tag` | A | EP-2 + 14d | FE | ☐ |
| `payment_method` | A | EP-2 + 14d | FE | ☐ |
| `employee` | C | EP-5 + 28d | FE + HR product | ☐ |

The Class C entity (`employee`) gets a longer cooling-off window — its navigation-with-return-token flow has the most ways to silently fail (sessionStorage expiry, browser back-button, multi-tab).

---

## 2. Global cutover

The global `ui.empty_state_v2` flag flips to **default ON in all environments** when:

- Every entity in §1 has been flipped on for ≥ 14 days without incident.
- The dashboard at `docs/observability/empty-state-funnel-dashboard.md` shows **≥ 80% success rate for every entity** for the most recent rolling week.
- `scripts/audit-empty-states.mjs` reports `pendingFiles === 0` (or the residual files are all `exempt`).

After the global flip, the flag itself stays in `featureFlags.ts` for one additional sprint as a kill-switch, then is deleted.

---

## 3. Legacy code removal — per-surface PR plan

After an entity's flag has been ON for 14 days, the legacy fallback code is removed file-by-file:

1. **One PR per migrated file.**
2. PR title: `chore(empty-state): retire ui.empty_state_v2 fallback in <File>`.
3. PR body links the entity's dashboard row showing > 80% success.
4. Diff scope:
   - Delete the `if (!flag) return <legacy />` branch.
   - Delete imports that are now unused (the old `<Select>` options-fetching hook).
   - Update the file's Playwright snapshot (the test should now have only the new-path assertion).
5. Reviewer checklist:
   - [ ] Bundle-size delta is non-positive.
   - [ ] No `useFeatureFlag('ui.empty_state_v2')` references remain in the file.
   - [ ] Telemetry events still fire (verify in dev with DevTools Network).

A tracking issue stays open until *every* migrated surface has had its legacy branch removed. The issue title: `Retire ui.empty_state_v2 fallback (per-surface cleanup)`.

---

## 4. After the legacy code is gone

Final cleanup PR:

1. Delete the flag entry from `frontend/src/api/featureFlags.ts`.
2. Delete any helper that read the flag (e.g. `useEmptyStateV2Flag`).
3. Update `frontend/src/i18n.config.ts` to remove the deprecated legacy strings if any.
4. Update `_deltas/empty-state-audit.md` baseline to reflect the new 100%.
5. Add an entry to `_deltas/EP-6-summary.md` confirming retirement.
6. Update this document — change every status to ✔ — and add a Final Cutover date stamp.

---

## 5. Rollback procedure

If a regression appears between flip and final cutover:

1. Flip the entity's per-entity flag back to `false` (`ui.empty_state_v2.<entity>=false`).
   - This is instant (no deploy).
2. The legacy branch reactivates because the cleanup PR for that file is still pending.
3. File a P1 ticket against the entity. The entity returns to the back of the schedule with a fresh 14-day cooling window after fix.

If a regression appears **after** legacy cleanup PRs land (legacy code is gone):

1. Revert the cleanup PR(s) for the affected file(s).
2. Re-flip the per-entity flag.
3. Same P1 process.

The legacy code stays available in git for 90 days after final cutover (standard branch retention); after that, revival requires manual restoration from history.

---

## 6. Communication

| Audience | When | Channel |
|----------|------|---------|
| FE team | At each entity flip | Slack `#frontend` |
| Product | At each Class-flip (A→B→C) | Notion EP-6 page |
| All engineering | At global cutover | All-hands or written async note |
| Support team | 24h before global cutover | Internal docs update |

---

## 7. Schedule summary (target dates if EP-6 starts on 2026-06-01)

| Date | Event |
|------|-------|
| 2026-06-15 | Class A entities flipped on |
| 2026-06-22 | Class B entities flipped on |
| 2026-06-29 | Class C entity (`employee`) flipped on |
| 2026-07-13 | Per-entity legacy cleanup begins |
| 2026-07-27 | Global `ui.empty_state_v2` flipped to default ON |
| 2026-08-03 | Global flag removed from `featureFlags.ts` (final cleanup PR) |

If any entity misses its window, the dependent dates slip by the same number of days. The dashboard at `docs/observability/empty-state-funnel-dashboard.md` is the source of truth for go/no-go.
