# P1 — npm dependencies to add

These additions are needed for the Frontend Shell Diet & Lazy Discipline
phase (`P1`). **Per the phase brief, `frontend/package.json` is not modified
by this phase.** A follow-up integration PR will add them.

## Runtime (frontend `dependencies`)

None added by this phase. `@sentry/react` is referenced via a dynamic
`import()` inside `lazyWithRetry`, wrapped in `try/catch`, so the lazy
loader degrades gracefully when Sentry is not installed. A later phase
(P5 — Observability) will pin the Sentry SDK explicitly.

## Dev (frontend `devDependencies`)

| Package | Suggested version | Why |
|---------|-------------------|-----|
| `rollup-plugin-visualizer` | `^5.12.0` | Emits `dist/stats.html` (treemap, gzip + brotli sizes) for the bundle-size diff workflow (R3.7) and as the source of truth for `scripts/check-shell-size.mjs`. |

## Install command (for the integration PR)

From the repo root:

```bash
cd frontend
npm install -D rollup-plugin-visualizer@^5.12.0
```

## Compatibility notes

- `rollup-plugin-visualizer` is a Rollup plugin but works with Vite out of
  the box (Vite uses Rollup under the hood for production builds). The
  `template: 'treemap'` option is the default; we set it explicitly for
  forward compatibility.
- The plugin only runs during `vite build` — it adds no overhead to
  `vite dev`.
- `@sentry/react`, when added by P5, must export `captureException`
  (standard from v7+). The `lazyWithRetry` call passes
  `{ tags: { chunkName, kind: 'chunk-load-failure' } }` which is supported
  by every modern Sentry SDK.
