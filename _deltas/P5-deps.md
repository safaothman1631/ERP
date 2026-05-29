# P5 — Deps & integration deltas

This file lists every change the P5 specialist intentionally did **not** make
because the constraints forbade touching `frontend/package.json`,
`frontend/src/App.tsx`, `frontend/src/pages/settings/sections/bodies.tsx`, or
`frontend/vite.config.ts`. A follow-up integration PR should apply each item.

## npm scripts (add to `frontend/package.json` → `"scripts"`)

```jsonc
{
  "scripts": {
    // existing scripts unchanged …
    "i18n:split":    "node ../scripts/i18n-split.mjs",
    "i18n:coverage": "node ../scripts/i18n-coverage.mjs",
    "i18n:coverage:strict": "node ../scripts/i18n-coverage.mjs --strict",
    "test:rtl":      "cross-env RUN_RTL_SNAPSHOTS=1 playwright test tests/e2e/rtl-snapshots.spec.ts"
  }
}
```

Notes:

- The repo root `scripts/` directory hosts the splitter + coverage script.
  If you prefer them under `frontend/scripts/`, just adjust the paths in the
  npm script entries — the scripts themselves resolve paths relative to their
  own location, so they keep working from either layout.
- `cross-env` is already a transitive dev dep in many Node toolchains; if not,
  `RUN_RTL_SNAPSHOTS=1 playwright test ...` also works in POSIX shells.

## npm dev-dependencies (add to `frontend/package.json` → `"devDependencies"`)

```jsonc
{
  "devDependencies": {
    "i18next-http-backend": "^2.6.1"
  }
}
```

`react-i18next` and `i18next` are already pinned. `@types/react-i18next` is
NOT needed — current `react-i18next` ships its own types.

`dayjs` is used by `general/CompanyInfo.tsx`; verify it is already in `dependencies`
(it is referenced by the existing `bodies.tsx` so it should be present).

## App.tsx — route wiring

```ts
// BEFORE
import SettingsShell from './settings/shell/SettingsShell';

// AFTER (Phase P5 — new shell)
import SettingsShell from './pages/settings/SettingsShell';
```

The old shell at `src/settings/shell/SettingsShell.tsx` should be kept until
all 56 sections have been migrated (see `docs/settings/migration-plan.md`),
so that the legacy route remains available for any direct-link fallback.

Optionally route both:
- `/settings`           → new shell (Phase P5)
- `/settings/legacy`    → existing `settings/shell/SettingsShell` (rollback path)

## i18n init — switching to namespaces

The new `src/i18n.config.ts` does NOT replace `src/i18n.ts` automatically. To
roll it in:

1. Run `npm run i18n:split` once to generate `frontend/public/locales/<lang>/<ns>.json`.
2. In `src/main.tsx`, replace
   ```ts
   import './i18n';
   ```
   with
   ```ts
   import { initI18n } from './i18n.config';
   await initI18n();
   ```
3. Delete `src/i18n.ts` and update the integration tests that import it
   (`src/i18n.integration.test.ts`, `src/i18n.lazy-load.test.ts`).

This roll-in MUST be done as a separate PR with full vitest + Playwright run
because it touches the bootstrap path.

## vite.config.ts — public dir

No change needed: Vite's default `publicDir = 'public'` already serves
`frontend/public/locales/<lang>/<ns>.json` at runtime as `/locales/<lang>/<ns>.json`,
which is what `i18next-http-backend` expects with `loadPath: '/locales/{{lng}}/{{ns}}.json'`.

If the project moves to a non-default public dir later, mirror the path in the
backend config.

## bodies.tsx — DO NOT TOUCH (this phase)

Migration is per-section, tracked in `docs/settings/migration-plan.md`. P5 did
**not** modify `frontend/src/settings/sections/bodies.tsx`.

## Outstanding follow-ups

1. **i18n parity gate** — once Arabic reaches 100%, flip `i18n:coverage` from
   advisory to required in CI by switching to `i18n:coverage:strict`.
2. **Snapshot baselines** — run `npm run test:rtl -- --update-snapshots` on a
   trusted machine (or CI worker) and commit the produced
   `tests/e2e/rtl-snapshots.spec.ts-snapshots/*.png` baselines.
3. **Help registry coverage** — when sections move, the `sectionId` strings
   used by `useHelp(...)` (see `frontend/scripts/i18n-coverage.mjs`) should be
   updated to the new keys (`account.profile`, `general.company`, etc.).
4. **monolith-budget CI rule** — R8.4 requires CI to fail if any settings
   file exceeds 400 LOC without an explicit exemption. Add this as a script
   in `frontend/scripts/monolith-budget.mjs` after the migration is ≥ 50%
   complete (so we don't trip the gate immediately).
