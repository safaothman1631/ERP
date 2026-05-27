# Critical Fix A — Frontend Build & Integration

**Date:** 2026-05-27
**Outcome:** Wirings applied (Steps 2, 3, 4). Build (Step 1) BLOCKED on
sandbox limitations — must be re-run on the developer's Windows host.

---

## 1. Files Edited

| File | Change |
|------|--------|
| `frontend/package.json` | Re-materialized truncated file; bumped `vite-plugin-pwa: ^0.20.5 → ^1.3.0` (vite v8 compatibility). |
| `frontend/vite.config.ts` | Added `VitePWA` plugin wiring with `PWA_CONFIG` from `src/pwa/pwa-config`. |
| `frontend/eslint.config.js` | Registered `local` plugin from `../tools/eslint-rules/index.js`; enabled `local/require-query-class: 'warn'` + `local/precise-invalidation: 'warn'`. |
| `frontend/src/main.tsx` | Switched `import './i18n'` → `initI18n()` from `./i18n.config` with a `catch` fallback to the legacy monolithic bundle. |

No backend / no protected files were touched.

---

## 2. Errors Encountered + Fixes

### 2.1 `EJSONPARSE` on first `npm install`
- **Symptom:** npm refused to parse `package.json`; bash mount showed it
  as a 3041-byte truncated file ending mid-key `"workbox-strategies"`.
- **Root cause:** Stale virtiofs mount — the Windows-side file was
  complete; the Linux mount had a torn view.
- **Fix:** Wrote the full JSON via the Windows file tool, then appended
  the missing tail via Python through the bash mount per the workspace
  note. `python3 -m json.tool` validated the result.

### 2.2 `ERESOLVE` — vite-plugin-pwa@0.20.5 peer mismatch
- **Symptom:** `Could not resolve dependency: peer vite@"^3 || ^4 || ^5"
  from vite-plugin-pwa@0.20.5` (project uses vite v8).
- **Fix:** Bumped to `vite-plugin-pwa@^1.3.0` (verified peer-deps via
  `npm view vite-plugin-pwa@1.3.0 peerDependencies` → supports vite
  v3–v8).

### 2.3 `Cannot find native binding @rolldown/binding-linux-x64-gnu`
- **Symptom:** `npm run build` failed inside the Linux sandbox.
- **Root cause:** Existing `node_modules` was populated on a Windows
  host; only the `win32-x64-msvc` rolldown binding is present.
- **Fix needed (deferred):** `npm install` on a host whose OS matches
  the build target, OR `npm install @rolldown/binding-linux-x64-gnu`
  inside the sandbox if running build there. Could not complete in
  this session — see §3.

### 2.4 Build / install simply did not complete
- **Symptom:** Every `npm install` invocation timed out at the 45-second
  workspace bash cap; backgrounded `nohup` processes were killed when
  the bash invocation returned, leaving `vite-plugin-pwa` and friends
  unwritten to disk.
- **Symptom (late in the task):** workspace bash sandbox lost virtiofs
  mounts with `chown EIO`; every subsequent invocation failed.
- **Outcome:** Could not produce `dist/sw.js`; could not capture bundle
  sizes; could not run `npm run lint` / `npm run audit:lazy` /
  `npm run i18n:split`. All deferred to user execution on their
  Windows host (or any environment with normal network + process budget).

---

## 3. Wiring Verifications (file-tool only)

### PWA (Step 2)
`vite.config.ts` now imports:
```ts
import { VitePWA } from 'vite-plugin-pwa';
import { PWA_CONFIG } from './src/pwa/pwa-config';
```
and registers the plugin after `react()`:
```ts
VitePWA(PWA_CONFIG as unknown as Parameters<typeof VitePWA>[0]),
```
The local `VitePWAOptions` type in `pwa-config.ts` is a structural
subset of the upstream type — the cast bridges the two without
introducing a hard dependency on the upstream `.d.ts` from this file.

After `npm install` + `npm run build`, the build should emit:
- `dist/sw.js` (from the `injectManifest` strategy, source =
  `src/pwa/sw.ts`)
- `dist/manifest.webmanifest`
- `dist/workbox-*.js`

### ESLint (Step 3)
`eslint.config.js` now imports the local rules via the existing
`createRequire(import.meta.url)` shim:
```js
const localQueryRules = require('../tools/eslint-rules/index.js')
```
and registers under `local`:
```js
plugins: {
  ...
  local: localQueryRules,
},
rules: {
  ...
  'local/require-query-class': 'warn',
  'local/precise-invalidation': 'warn',
},
```
Both rules are advisory (`warn`) per the task brief.

### i18n (Step 4)
`main.tsx` now boots i18n via the namespaced lazy config with a runtime
fallback:
```ts
import { initI18n } from './i18n.config'
initI18n().catch((err) => {
  console.warn('[zoho] lazy i18n init failed, falling back to legacy bundle:', err)
  return import('./i18n')
})
```
Fire-and-forget (no top-level `await`), so first paint is not blocked.
React Suspense is disabled in `i18n.config.ts`, so components render
the key string until the translation arrives — same behavior as the
legacy bundle.

---

## 4. Tasks NOT Run (require user execution)

| Step | Command | Why blocked |
|------|---------|-------------|
| 1.   | `npm install --no-audit --no-fund --prefer-offline` | 45 s bash cap + cold registry cache |
| 1.   | `npm run build` | needs install + correct rolldown binding for host OS |
| 4.   | `npm run i18n:split` | needs install (script runs on existing node, but bash sandbox died) |
| 5.   | `npm run audit:loc`, `npm run audit:lazy` | same |
| 6.   | `du -sh dist/assets/*.js \| sort -h \| tail -20` | needs successful build |

After the user runs `npm install` (Windows host with full network),
`npm run build` should succeed end-to-end with the wirings above. If
the build does fail, the most likely fault is the i18n fallback path
(if both `i18n.config` and `i18n` fail somehow) or a typecheck on the
`VitePWAOptions` cast — both are isolated to a single line and easy to
adjust.

---

## 5. Remaining TODOs for Human Attention

1. **Run `npm install --legacy-peer-deps` on Windows** to pull in
   `vite-plugin-pwa@^1.3.0`, `workbox-build`, and `workbox-window`.
2. **Run `npm run build`** and confirm `dist/sw.js` exists. If
   `vite-plugin-pwa` complains about the manifest type, replace the
   `as unknown as` cast in `vite.config.ts` with a direct import of
   `VitePWAOptions` from `'vite-plugin-pwa'`.
3. **Run `npm run i18n:split`** so `frontend/public/locales/<lng>/<ns>.json`
   files exist; otherwise the new boot path silently falls back to
   legacy `./i18n` on every load (works, but loses the lazy benefit).
4. **Run `npm run lint`** and triage the new `local/*` warnings; bump
   them to `error` once the migration sweep lands per the rule's own
   recommended config.
5. **Optional:** add `@vite-pwa/assets-generator` if the PWA icons in
   `public/icons/` are not yet present — the manifest references
   `/icons/pwa-192x192.png` etc.

---

## 6. Evidence Files Written

- `_deltas/build-evidence-frontend.txt` — full transcript of attempts,
  errors, and mitigation.
- `_deltas/bundle-sizes-after-build.txt` — explanation of why sizes
  could not be captured + the exact commands to run.
- `_deltas/critical-fix-A-summary.md` — this file.
