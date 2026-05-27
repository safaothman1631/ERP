# P0 — Foundations & Measurement — Summary

> **Spec:** `world-class-performance` Phase 0
> **Status:** Implemented. Wiring (calling `init_observability(app)` from
> `main.py`, mounting the middleware/router, calling `initSentry()` /
> `initWebVitals()` from `main.tsx`) is deferred per the phase constraint.
> See `_deltas/P0-deps.md` for the exact integration steps.

---

## Files created

### Frontend — observability

| Path | Lines | Purpose |
|---|---|---|
| `frontend/src/observability/vitals.ts` | 299 | T-0.1: web-vitals subscriber + RUM batcher + sendBeacon-on-unload + first-session-per-device sampling. |
| `frontend/src/observability/vitals.test.ts` | 90 | Vitest unit tests for `VitalBatcher` queueing, threshold flush, and beacon path. |
| `frontend/src/observability/sentry.ts` | 111 | T-0.6: production-mandatory Sentry init (100% errors / 10% perf). Throws if `VITE_SENTRY_DSN` missing in prod. |

### Frontend — build tooling

| Path | Lines | Purpose |
|---|---|---|
| `frontend/scripts/audit-bundle-size.mjs` | 135 | T-0.3: post-`vite build` reader that emits `{ chunks: [{ name, size, gzipSize, delta }] }` JSON. Reads `dist/stats.json` (rollup-plugin-visualizer) with a `dist/assets/*` gzip-scan fallback. |
| `frontend/scripts/post-bundle-diff.mjs` | 151 | T-0.3: compares two JSON outputs and renders a markdown table for the PR comment. Flags chunks > 10 KB gzipped regression (R3.7). |
| `frontend/lighthouserc.json` | 75 | T-0.4: updated assertions to LCP ≤ 2500ms, INP ≤ 200ms, CLS ≤ 0.05, perf ≥ 0.9 (R1.1–1.3, R1.6). URLs: /, /login, /dashboard, /invoices, /pos/terminal. 3 runs, median-run aggregation. |

### Backend — RUM ingest

| Path | Lines | Purpose |
|---|---|---|
| `backend/app/api/rum.py` | 91 | T-0.1: FastAPI router `POST /api/rum/vitals` with Pydantic schemas matching design §3.5. Returns 202. |
| `backend/app/services/rum_ingest.py` | 261 | T-0.1: asyncio.Queue-backed batcher; flushes every 5s or 100 events; BigQuery streaming insert when `RUM_BIGQUERY_DATASET` set, otherwise logs locally. Process-singleton accessor. |
| `backend/app/services/rum_ingest_test.py` | 84 | Pytest-asyncio tests for enqueue, periodic flush, watermark-triggered flush, drop-on-full, and graceful stop. |

### Backend — observability

| Path | Lines | Purpose |
|---|---|---|
| `backend/app/observability/__init__.py` | 60 | T-0.2 / T-0.6: `init_observability(app)` orchestrator. Wires logging, Sentry, and OTel in one call from the future `lifespan`. Does NOT edit `main.py`. |
| `backend/app/observability/tracing.py` | 160 | T-0.2: OTel SDK init with FastAPIInstrumentor + CloudTraceSpanExporter (ConsoleSpanExporter fallback). Exposes `traced_firestore_op(collection, op)` and `traced_cache_op(key)` context managers (R6.3). |
| `backend/app/observability/logging.py` | 130 | T-0.2: python-json-logger-based formatter emitting the fixed fields from design §6.5 (timestamp, severity, request_id, tenant_id, user_id, route, latency_ms, status_code, message). `configure_logging()` is idempotent. |
| `backend/app/observability/sentry.py` | 75 | T-0.6: backend Sentry init. Raises `SentryConfigurationError` in `ENVIRONMENT=production` when `SENTRY_DSN` is unset (R6.4). |
| `backend/app/middleware/request_id.py` | 61 | T-0.2: Starlette `BaseHTTPMiddleware` that reads/generates `X-Request-Id`, sanitizes inbound values, stores on `request.state.request_id`, echoes on response. |

### Repo-level

| Path | Lines | Purpose |
|---|---|---|
| `scripts/audit-loc.mjs` | 224 | T-0.5: walks `frontend/src/` and `backend/app/`, lists files > 400 LOC, writes `docs/audit/monolith-watchlist.json`, exits 1 on `--check` if any file > 600 LOC without the `// monolith-budget-exempt:` marker on line 1 (R8.4). `--markdown` flag prints a top-30 table. |
| `.github/workflows/bundle-diff.yml` | 88 | T-0.3: PR workflow that builds main and head, audits each bundle, runs `post-bundle-diff.mjs`, and posts a sticky comment via `marocchino/sticky-pull-request-comment@v2`. |
| `docs/observability/README.md` | 132 | T-0.7: index of the 6 Cloud Monitoring dashboards (API SLOs, Firestore, Cache, POS Ops, RUM CWV, Deploys) with widgets, owners, and provisioning notes. Terraform deferred. |
| `docs/audit/monolith-watchlist.md` | 36 | Initial human-readable table of the top 30 files > 400 LOC, with owners (@frontend, @backend, @pos). Regenerable via `node scripts/audit-loc.mjs --markdown`. |
| `docs/audit/monolith-watchlist.json` | 448 | Machine-readable artifact written by `audit-loc.mjs`. |
| `audit/baselines/2026-Q2-baseline.md` | 196 | T-0.8: baseline template with all metric names and assertion tables. Every value is `TBD — capture after T-0.7 dashboards live`. |
| `_deltas/P0-deps.md` | 119 | Required new dependencies (frontend deps, backend deps, GitHub actions deps), env vars, and integration step list. |
| `_deltas/P0-summary.md` | this file | Summary of what shipped in P0. |

---

## Files NOT touched (per phase constraint)

- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `backend/app/main.py`
- `backend/requirements.txt`

All wiring for these is documented in `_deltas/P0-deps.md` under "Integration steps".

---

## Verified

- All Python files parse via `ast.parse` (8/8).
- All `.mjs` scripts pass `node --check` (3/3).
- `scripts/audit-loc.mjs` runs successfully: identifies 67 files > 400 LOC, 22 files > 600 LOC (will fail CI on `--check`). Generated `docs/audit/monolith-watchlist.{md,json}`.
- `frontend/src/observability/{vitals,sentry}.ts` compile cleanly under `tsc --strict` (with `--skipLibCheck`).
- `frontend/lighthouserc.json` and `docs/audit/monolith-watchlist.json` parse as valid JSON.
- `.github/workflows/bundle-diff.yml` parses as valid YAML.

---

## Blockers / follow-ups

1. **Dependencies must be installed** (per `_deltas/P0-deps.md`) before any
   wiring PR can land. Both Sentry SDKs are gated on this; web-vitals is
   gated on this; the OTel exporter is gated on this. The code degrades
   gracefully (dynamic imports, optional emitter paths) but won't actually
   ship telemetry until the libs are present.
2. **`@sentry/react` types** — the dynamic import line in `sentry.ts` uses
   `// @ts-expect-error` to compile without the package installed. Once the
   package is added, **remove that pragma** or it will flip to a compile
   error (TS unused-expect-error).
3. **Bundle-diff base build** — the workflow uses `continue-on-error: true`
   for the base-branch build so the diff still posts when the base build
   breaks. Tighten once main is green.
4. **22 files violate the LOC hard limit** today. They are listed in
   `docs/audit/monolith-watchlist.md`. P1 (settings monolith) and P4 (POS
   decomposition) handle the worst offenders. Until then, CI **should**
   wire `node scripts/audit-loc.mjs --check` as a non-blocking warning to
   avoid breaking unrelated PRs, then flip to blocking after the top
   offenders ship exempt markers or decompositions.
5. **BigQuery dataset provisioning** — `vitals_raw` table schema is in
   design §9.1. Terraform / `bq mk` step to be added in a follow-up; until
   then RUM ingest logs locally and the data is visible in Cloud Logging
   under the `rum.vital` label.
6. **Open Questions** — OQ-1 through OQ-5 from `design.md` §12 are still
   open. None block P0 but they shape P1+ scope (e.g., WebSocket KDS relay
   support level, CSP nonce strategy).

---

## How to verify locally (when deps installed)

```bash
# Frontend
cd frontend
npm test -- src/observability/vitals.test.ts
npm run build && node scripts/audit-bundle-size.mjs

# Backend
cd backend
pytest app/services/rum_ingest_test.py -v

# Repo
node scripts/audit-loc.mjs            # prints table, exit 0
node scripts/audit-loc.mjs --check    # exits 1 if any file > 600 LOC
node scripts/audit-loc.mjs --markdown > docs/audit/monolith-watchlist.md
```
