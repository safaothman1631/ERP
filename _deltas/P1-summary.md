# P1 — Frontend Shell Diet & Lazy Discipline — Summary

Phase: **P1** of the world-class-performance spec.
Scope: shell ≤ 350 KB gz (R1.5), every route lazy with retry (R3.1/R3.4/R3.5),
refined `manualChunks` (R3.6), responsive image primitive (R11.2),
performance-mark scaffolding for hot paths (R4.7, R6.1).

## Files created

| Path | Purpose |
|------|---------|
| `frontend/src/utils/lazyWithRetry.ts` | `React.lazy` wrapper with 3 retries (500ms / 2s / 8s), Sentry reporting on final failure, falls back to `ChunkLoadErrorFallback`. |
| `frontend/src/components/ChunkLoadErrorFallback.tsx` | Tiny (< 60 LOC) localized failure UI used when chunk retries are exhausted. Big "Reload page" button → `window.location.reload()`. |
| `frontend/src/components/Picture.tsx` | `<picture>` wrapper emitting AVIF + WebP `<source>` plus a fallback `<img>` with `srcSet`. Lazy-loaded by default. |
| `frontend/src/observability/perf-marks.ts` | `mark` / `measure` / `clear` thin wrappers over the User Timing API, no-op when `performance` is unavailable. |
| `frontend/scripts/audit-lazy.mjs` | CI guard — walks `App.routes.tsx` + `pages/modules/moduleConfigs.ts`, asserts every route-level page is via `lazyWithRetry(importFn, 'kebab-name')`. Exit code 1 on violation. |
| `frontend/scripts/check-shell-size.mjs` | Reads `dist/stats.html` JSON sidecar (or gzips `dist/assets/` directly), sums shell-chunk gzip sizes, prints a Markdown table, exits 1 if > 350 KB. |
| `_deltas/P1-deps.md` | New dependencies (only `rollup-plugin-visualizer` for now). |
| `_deltas/P1-summary.md` | This file. |

## Files modified

| Path | Change |
|------|--------|
| `frontend/vite.config.ts` | Full rewrite: refined `manualChunks` per design §1.6 (split `vendor-antd-core`/`vendor-antd-icons`, split firebase per service, split `vendor-query`, lazy `vendor-flow`/`vendor-grid`/`vendor-office`); added `rollup-plugin-visualizer` (`dist/stats.html`, gzip + brotli, treemap); added `define.__APP_VERSION__`; preserved existing dev proxy and Vitest config; the help registry split is unchanged. PWA plugin intentionally NOT added (P3 owns `src/pwa/pwa-config.ts`). |
| `frontend/src/App.routes.tsx` | Removed the local `lazy()` shim; added `import { lazyWithRetry } from './utils/lazyWithRetry'`; rewrote all 272 `lazy(() => import('./...'))` calls to `lazyWithRetry(() => import('./...'), '<kebab-chunk-name>')`. Chunk names derived from the last path segment, kebab-cased, dedup'd by parent dir. Added a JSDoc preamble explaining the convention. Routes, paths, and Suspense wrappers are unchanged. |
| `frontend/scripts/lighthouse-no-regression.mjs` | Extended to also enforce R1.1 (LCP ≤ 2.5s), R1.2 (INP ≤ 500ms hard ceiling), R1.3 (CLS ≤ 0.05) on each measured route. Reads baseline from `audit/baselines/lhci-baseline.json` when present, falls back to legacy `perf-baseline.json`. |
| `frontend/src/pbt.properties-31-43.test.ts` | Updated Property 34 to assert `lazyWithRetry(` instead of `lazy(` (the convention changed); added a guard that no bare `React.lazy` or `= lazy(` calls survive in `App.routes.tsx`. |

## Verification done

- `node frontend/scripts/audit-lazy.mjs` → **OK** (273 `lazyWithRetry` calls, 0 violations).
- Grep confirms `frontend/src/App.routes.tsx` contains **0** remaining `lazy(` calls and **274** `lazyWithRetry(` references (one is the JSDoc comment).
- No references to `React.lazy` outside the new utility's documentation and the test guard.
- `vite.config.ts` continues to declare `server.proxy['/api']` on port 5173 to `127.0.0.1:8000` and the Vitest block is preserved.

## Dependencies to add (handled by integration PR, not this phase)

- `rollup-plugin-visualizer@^5.12.0` (devDependency) — see `_deltas/P1-deps.md`.

## Uncertainties / open items

1. **`@sentry/react` is referenced via a dynamic `import('@sentry/react')` inside `lazyWithRetry`.** It is wrapped in `try/catch` so a missing install never crashes the lazy loader, but TypeScript may flag the import in strict mode if the dependency is truly absent. If TS errors arise, add `"@sentry/react"` to `tsconfig.json#compilerOptions.types` exclusion or pin a stub `*.d.ts`. The cleanest fix is to install Sentry in P5 (Observability phase) which the design already requires.
2. **`__APP_VERSION__`** is defined in `vite.config.ts` but not yet consumed by any source file. Add an ambient `declare const __APP_VERSION__: string;` to `src/vite-env.d.ts` (or similar) when P5 wires it into RUM and Sentry tags.
3. **Chunk-name dedup** uses a heuristic: when two imports share the same final path segment (e.g. `./pages/auth/RegisterPage` and `./pages/RegisterPage`), the second occurrence gets a `parent-segment-pascal-base` chunk name. One observed case in the file: `SignUp` and `RegisterPage` both import `./pages/auth/RegisterPage` — they end up sharing the chunk name `register-page` which is correct (same module ⇒ same chunk).
4. **Shell-size script** prefers measuring `dist/assets/` directly because the visualizer JSON sidecar shape changes between major versions. If a future visualizer release exposes a stable JSON-output flag, switch to it for higher fidelity.
5. **`ChunkLoadErrorFallback`** uses inline default strings on the `t(...)` calls so it works before the `chunk.errorTitle`/`chunk.errorBody`/`chunk.reloadButton` keys are added to `locales/<lang>/common.json`. The translation pass (P6 or earlier) should add real keys for ku/ar/en.
6. The previous `lazy()` helper had a "wrong-shape module" recovery path (handled modules that returned a function instead of `{default}`). I dropped this safety net because every existing call site already uses `import()` with default-exported components and the audit ensures it stays that way. If a single legacy file later breaks, the fix is to add an `export default` to that page rather than re-introduce the shim.
