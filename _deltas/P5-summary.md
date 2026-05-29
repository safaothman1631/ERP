# P5 — Settings Decomposition + i18n Split + RTL Polish — Summary

Phase owner: Settings Architecture + i18n Specialist
Date: 2026-05-27

## What ships in this phase

**Scope**: framework + 3 sample sections + i18n split tooling + locale-aware
formatting helpers + RTL snapshot scaffold. Decomposing all 56 sections is
explicit follow-on work tracked in `docs/settings/migration-plan.md`.

## Files created

### Settings shell + registry (new path `frontend/src/pages/settings/`)
- `frontend/src/pages/settings/SettingsShell.tsx` — 116 LOC, lazy section host (R8.3)
- `frontend/src/pages/settings/sections.registry.ts` — 50+ entries, group order, gating hooks
- `frontend/src/pages/settings/sections/_template/SectionTemplate.tsx` — copy-paste starter
- `frontend/src/pages/settings/sections/_template/TodoPlaceholder.tsx` — placeholder for unmigrated sections

### Sample migrated sections
- `frontend/src/pages/settings/sections/general/CompanyInfo.tsx` — ≈ 240 LOC, real form, memo, useClassedQuery class C, optimistic save
- `frontend/src/pages/settings/sections/general/Localization.tsx` — ≈ 220 LOC, language/currency/RTL/format with live preview using the new format helpers
- `frontend/src/pages/settings/sections/general/Branding.tsx` — ≈ 220 LOC, logo upload, theme picker, dark mode preference

### i18n infrastructure
- `frontend/src/i18n.config.ts` — namespace-aware i18next + i18next-http-backend, loads `common` only on first paint (R9.2, R9.3). **Does not replace `src/i18n.ts`** — integration deferred (see deps).
- `scripts/i18n-split.mjs` — reads `frontend/src/locales/<lang>.json`, emits per-namespace JSON to `frontend/public/locales/<lang>/<ns>.json`. Idempotent, prints coverage matrix, reports missing namespaces.
- `scripts/i18n-coverage.mjs` — Arabic / English vs Kurdish baseline. Advisory by default, exits non-zero with `--strict`. Supports `--json`.

### Locale-aware formatting helpers
- `frontend/src/utils/formatCurrency.ts` + `.test.ts` — IQD override (no decimals, `د.ع` suffix), pluggable currency overrides table
- `frontend/src/utils/formatDate.ts` + `.test.ts` — Kurdish→ar-IQ normalization, Arabic-Indic digit toggle
- `frontend/src/utils/formatNumber.ts` + `.test.ts` — Arabic-Indic digit preference

### Tests / RTL
- `frontend/tests/e2e/rtl-snapshots.spec.ts` — 10 critical routes × 2 RTL locales (ku, ar) = 20 snapshot tests. Skipped unless `RUN_RTL_SNAPSHOTS=1`. Honors `--update-snapshots`.

### Documentation
- `docs/settings/migration-plan.md` — full inventory of 56 sections discovered in `bodies.tsx` with line numbers, approx LOC, target file path, suggested owner, status. Plus migration conventions and DoD.
- `_deltas/P5-deps.md` — every change blocked by the "do not touch" list

## Discovery findings

### bodies.tsx
- File length: **4,605 LOC** (matches spec § R8.1).
- Section components: **56** distinct `React.FC` declarations.
- Largest sections: `NotificationSettings` (≈536 LOC), `SecuritySettings` (≈344 LOC), `EInvoiceSettings` (≈166 LOC), `PermissionsSettings` (≈145 LOC). These are the highest-payoff PRs to land first.
- Smallest sections: ~20–30 LOC each — the ext-style summary panels at the end of the file. Batch 3–5 per PR.

### i18n state
- `frontend/src/locales/<lang>.json` exists today (5,548 ku keys, 5,514 en, 1,811 ar — Arabic at ≈ 33%, matches spec).
- A second per-namespace tree already exists under `frontend/src/locales/<lang>/<ns>.json` (20 namespaces). The new split script emits its output to `frontend/public/locales/<lang>/<ns>.json` (the location `i18next-http-backend` will actually fetch from). These two trees can co-exist; the in-`src/` one is currently unused by the live i18n.ts.

### Existing `SettingsShell`
- A separate `frontend/src/settings/shell/SettingsShell.tsx` (legacy) already exists (260 LOC) — it is NOT replaced by P5. The new shell lives at `frontend/src/pages/settings/SettingsShell.tsx` per the task's specified path. Switching the route is a deliberate, separate integration step (see deps).

## Deps to add (deferred per constraints)

See `_deltas/P5-deps.md` for the full list, but the headlines:

1. `frontend/package.json` — add three npm scripts (`i18n:split`, `i18n:coverage`, `test:rtl`).
2. `frontend/package.json` — add `i18next-http-backend` dev-dep (only needed once we cut over to `i18n.config.ts`).
3. `frontend/src/main.tsx` — eventually swap `import './i18n'` for `import { initI18n } from './i18n.config'; await initI18n();`. Not done now to avoid touching the bootstrap path mid-phase.
4. `frontend/src/App.tsx` — eventually swap the `/settings` route import from `settings/shell/SettingsShell` to `pages/settings/SettingsShell`.

## Integration notes

- The new shell + registry are **importable but not yet routed**. Verifying it locally requires either temporarily editing `App.tsx` or rendering it inside a Storybook/scratch route.
- The i18n splitter does not modify `frontend/src/locales/*.json` — it only **reads** them. Re-running the split is safe.
- `formatCurrency('IQD', …)` deliberately diverges from the browser's default Intl output (which shows `IQD 1,234.000` with three decimals in many runtimes). Spec R9.5 explicitly wants no decimals.

## Counts

| Metric | Value |
|---|--:|
| New files created | 14 |
| Settings sections discovered in `bodies.tsx` | **56** |
| Sample sections migrated this phase | 3 |
| Registry entries seeded (incl. TODO placeholders) | 50 |
| Languages covered by the snapshot suite | 2 (ku, ar) |
| Routes baselined per language | 10 |
| Total RTL snapshot tests | 20 |
| Tests added (vitest) | 3 test files / ≈ 24 cases |

## Self-check vs task brief

- [x] `SettingsShell.tsx` < 150 LOC, lazy load via Suspense, URL `?section=` controls active panel, Antd-styled
- [x] `sections.registry.ts` has `SectionDef` interface, ≥ 20 entries, `enabled?` gating support, ordered groups
- [x] Three sample sections (`CompanyInfo`, `Localization`, `Branding`) with memo + useClassedQuery class C + real form + save + optimistic update + i18n
- [x] `_template/SectionTemplate.tsx` documents the pattern
- [x] `scripts/i18n-split.mjs` reads single big JSON → emits per-namespace files → idempotent → reports missing namespaces
- [x] `i18n.config.ts` configures namespaces, ships only `common` on first paint, http-backend for `/locales/{{lng}}/{{ns}}.json`
- [x] `formatCurrency.ts` covers IQD/USD/EUR with pluggable overrides + test file with edge cases
- [x] `formatDate.ts` and `formatNumber.ts` with Arabic-Indic digit option + test files
- [x] `rtl-snapshots.spec.ts` — 10 routes × 2 RTL locales, gated on `RUN_RTL_SNAPSHOTS=1`, `--update-snapshots` aware
- [x] `i18n-coverage.mjs` exits non-zero with `--strict` if Arabic < 100%
- [x] `docs/settings/migration-plan.md` lists all 56 sections with target paths, owners, LOC estimates
- [x] `_deltas/P5-deps.md` enumerates package.json + App.tsx + bootstrap changes deferred per constraints
- [x] Did NOT modify: `frontend/package.json`, `frontend/src/App.tsx`, `frontend/src/pages/settings/sections/bodies.tsx` (does not exist at that path — the real one is at `frontend/src/settings/sections/bodies.tsx`, also untouched), `frontend/vite.config.ts`
- [x] Did NOT modify existing `frontend/src/locales/*.json` (read only)
