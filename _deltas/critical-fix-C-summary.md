# Critical Fix C — Data Safety + UX Integration

Owner: Data Safety + UX Integration Specialist
Scope: two known integration risks left open after the parallel build pass.

## Summary

Two deploy-blockers from the P3 (POS CRDT refactor) and P5 (Settings
decomposition) work were resolved without changing public APIs and
without touching any file owned by another agent.

1. **CRDT cart migration is now data-safe.** A legacy line with no
   `lineId` / `qtyUpdatedAt` is upgraded on the fly anywhere it enters
   the merge pipeline (db migration AND runtime merge).
2. **New SettingsShell is wired behind a feature flag and a parallel
   dogfood route.** The legacy shell remains the prod default; nothing
   changes for end users until `settings.new_shell` is flipped on.

## Cart safety guarantees

After this fix the following invariants hold:

- **No legacy line is dropped during the v3 → v4 IDB migration.**
  `db.ts` calls `upgradeLine()` on every persisted line and uses its
  synthesised `lineId` as the new map key.
- **`mergeLine()` / `mergeCart()` are safe to call on any persisted
  shape**, including cross-version sync payloads. A defensive
  `ensureUpgraded()` guard upgrades each side lazily — without this, a
  legacy line lacking `qtyUpdatedAt` would have broken LWW and a
  legacy line lacking `lineId` would have collapsed the merged-lines
  map under the `undefined` key.
- **Legacy line maps re-key by `lineId` automatically.** `mergeCart()`
  routes both sides through `normaliseLineMap()` so a side keyed by
  the snake_case `id` field still merges correctly with a side keyed
  by `lineId`.
- **`upgradeLine` is idempotent and preserves timestamps.** Running it
  on an already-upgraded line returns equal-by-value output without
  rewriting `qtyUpdatedAt` / `qtyUpdatedBy`.
- **Property test covers the merge guarantee.**
  `upgradeLine.test.ts` has a fast-check property: for an arbitrary
  mix of legacy + upgraded lines on either side, every `itemId` in
  either input appears in the merge output (200 iterations).

The existing `merge.test.ts` algebraic properties (idempotence,
commutativity, associativity, 1000 iterations each) continue to hold
because all of its arbitraries generate fully-upgraded lines.

## Route-flag wiring

| Route             | Element                                  | Notes                                                            |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `/settings`       | `<SettingsRouter />`                     | Reads `settings.new_shell` flag; renders legacy while loading.   |
| `/settings/next`  | `<SettingsShellNext />` (no flag)        | Always renders the new shell for opt-in dogfooding.              |

The flag defaults to OFF (per `useFeatureFlag`, an unknown / unreachable
key resolves to `is_active: false`). With the flag OFF and on cold
start, `SettingsRouter` renders the legacy `Settings` page — byte-
equivalent to the previous behaviour. Only after the flag resolves and
returns `is_active: true` does the user transition to the new shell.

## Files created

| File                                              | One-line summary                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `frontend/src/stores/pos/upgradeLine.ts`          | `upgradeLine()` + `needsUpgrade()` helpers. Tolerates snake_case legacy fields.        |
| `frontend/src/stores/pos/upgradeLine.test.ts`     | Unit + property tests for the upgrade helper and its interaction with `mergeCart`.     |
| `_deltas/critical-fix-C-summary.md`               | This document.                                                                         |

## Files modified

| File                                  | Change                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `frontend/src/stores/pos/db.ts`       | v3→v4 migration loop now calls `upgradeLine()` per line; legacy shape detection moved into the helper. |
| `frontend/src/stores/pos/merge.ts`    | Added `ensureUpgraded()` + `normaliseLineMap()` guards in front of `mergeLine` / `mergeCart`.          |
| `frontend/src/App.routes.tsx`         | Added `SettingsRouter` component, `useFeatureFlag` import, parallel `/settings/next` route.            |

## Files NOT touched (per the brief)

- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/src/main.tsx`
- `backend/**`

## Verification checklist

- [x] `upgradeLine.test.ts` covers: legacy upgrade, idempotence on
      upgraded lines, tombstone preservation, mixed-legacy merge
      property.
- [x] Existing `merge.test.ts` arbitraries already produce fully-shaped
      lines so the algebraic properties still hold.
- [x] `useFeatureFlag('settings.new_shell')` defaults to off (the
      hook's contract on 404 / network error).
- [x] `/settings/next` is reachable independent of the flag for QA.
- [x] No assertions in `tests/e2e/nav-sweep.spec.ts` need updating —
      the only `/settings` assertion is a navigation check that still
      resolves to the legacy shell with the flag off.

## Follow-ups (out of scope)

1. Backend seed for the `settings.new_shell` flag (currently the API
   will 404 until ops creates the row — that's harmless because the
   hook treats 404 as off).
2. The remaining 53/56 settings sections still live in the legacy
   shell. Migration plan in `docs/settings/migration-plan.md`.
