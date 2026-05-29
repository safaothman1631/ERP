# P0 — Dependency deltas

> **Spec:** `world-class-performance` Phase 0 (Foundations & Measurement).
> Per the phase contract, this document lists every new dependency the P0
> code requires. The user will add these to `package.json` / `requirements.txt`
> separately — P0 does not edit those files.

---

## Frontend dependencies (`frontend/package.json`)

### `dependencies`
| Package | Version range | Used by | Why |
|---|---|---|---|
| `web-vitals` | `^4.2.0` | `src/observability/vitals.ts` | Official Chrome team library for LCP / INP / CLS / FCP / TTFB callbacks. R6.1 / T-0.1. |
| `@sentry/react` | `^8.55.0` | `src/observability/sentry.ts` | Frontend error + tracing client. R6.4 / T-0.6. |

### `devDependencies`
| Package | Version range | Used by | Why |
|---|---|---|---|
| `rollup-plugin-visualizer` | `^5.12.0` | `vite.config.ts` (to be wired in P1) and `frontend/scripts/audit-bundle-size.mjs` | Emits `dist/stats.html` + `dist/stats.json` so the bundle audit script can compute per-chunk sizes. R3.7 / T-0.3. Configure with `{ filename: 'dist/stats.html', json: true, gzipSize: true, brotliSize: false }`. |

> The bundle-audit script has a graceful fallback that scans `dist/assets/*.js` directly when `stats.json` is missing — so the script still works today (it will just lack the per-chunk source-attribution breakdown until the visualizer is wired). The fallback is exercised in `bundle-diff.yml`.

---

## Backend dependencies (`backend/requirements.txt`)

| Package | Version range | Used by | Why |
|---|---|---|---|
| `python-json-logger` | `>=2.0.7,<3.0.0` | `app/observability/logging.py` | Structured JSON logger compatible with Cloud Logging severity mapping. R6.5 / T-0.2. |
| `opentelemetry-api` | `>=1.27.0` | `app/observability/tracing.py` | OTel SDK core. R6.3 / T-0.2. |
| `opentelemetry-sdk` | `>=1.27.0` | `app/observability/tracing.py` | OTel SDK provider + batch processor. |
| `opentelemetry-instrumentation-fastapi` | `>=0.48b0` | `app/observability/tracing.py` | Auto-instruments FastAPI request handlers as spans. |
| `opentelemetry-exporter-gcp-trace` | `>=1.7.0` | `app/observability/tracing.py` | Exports spans to Google Cloud Trace. Falls back to ConsoleSpanExporter if unavailable (dev). |
| `sentry-sdk[fastapi]` | `>=2.20.0` | `app/observability/sentry.py` | Backend error + perf tracing. R6.4 / T-0.6. Includes the FastAPI integration. |
| `google-cloud-bigquery` | `>=3.27.0` | `app/services/rum_ingest.py` | Optional. Only loaded when `RUM_BIGQUERY_DATASET` is set. R6.2 / T-0.1. Falls back to log-only emission if absent. |

> Every backend dependency listed has a **lazy import** in code, so missing
> the library does not break local boot — it only disables the feature.
> Production will fail closed via `app/observability/sentry.py` (which
> raises if `SENTRY_DSN` is unset while `ENVIRONMENT=production`).

---

## GitHub Actions dependencies (`.github/workflows/bundle-diff.yml`)

| Action | Version | Why |
|---|---|---|
| `actions/checkout@v4` | v4 | Standard checkout. |
| `actions/setup-node@v4` | v4 | Node 20 + npm cache. |
| `marocchino/sticky-pull-request-comment@v2` | v2 | Posts (and idempotently updates) a single bundle-diff comment per PR. R3.7. |

---

## Integration steps (deferred — user to wire when ready)

These are the **wiring tasks** that depend on the new files. P0 intentionally
did not touch the listed files; the task IDs are the integration points.

1. **Frontend bootstrap wiring** (in `frontend/src/main.tsx`):
   ```ts
   import { initSentry } from './observability/sentry';
   import { initWebVitals } from './observability/vitals';
   initSentry();
   initWebVitals();
   ```
   Call **before** `ReactDOM.createRoot`. Sentry first so RUM errors are captured.

2. **Backend lifespan wiring** (in `backend/app/main.py`):
   ```py
   from app.observability import init_observability
   from app.middleware.request_id import RequestIDMiddleware
   from app.api import rum as rum_router

   # in lifespan / app setup:
   init_observability(app)
   app.add_middleware(RequestIDMiddleware)
   app.include_router(rum_router.router)
   ```
   Order matters: `RequestIDMiddleware` should be added BEFORE auth /
   tenant / audit middleware so the id is available for all downstream logs.

3. **Vite config** (in `frontend/vite.config.ts`):
   ```ts
   import { visualizer } from 'rollup-plugin-visualizer';
   // …inside plugins:
   visualizer({
     filename: 'dist/stats.html',
     gzipSize: true,
     template: 'treemap',
     emitFile: false,
     // Emit the JSON sidecar that audit-bundle-size.mjs reads.
     // (Newer versions support `json: true`; if your version does not,
     // a custom post-build script can extract from stats.html.)
   });
   ```

4. **CI** — add a step that runs `node scripts/audit-loc.mjs --check` on every PR. Failure means a file crossed 600 LOC without the exempt marker.

5. **LHCI** — the existing `npm run lhci` script reads `lighthouserc.json`; no other change needed. The updated file ratchets the assertions to the spec targets (LCP ≤ 2500, INP ≤ 200, CLS ≤ 0.05, perf ≥ 0.9).

---

## Environment variables (new)

| Name | Where | Required? | Default | Description |
|---|---|---|---|---|
| `VITE_SENTRY_DSN` | Frontend build env | **Yes in production** (throws if missing). | unset | Sentry DSN for the frontend project. |
| `VITE_APP_VERSION` | Frontend build env | No | `'dev'` | Surfaces in vitals events and Sentry release tag. |
| `SENTRY_DSN` | Backend runtime env | **Yes in production**. | unset | Sentry DSN for the backend project. |
| `ENVIRONMENT` | Backend runtime env | No | `development` | Used by `init_sentry` to decide whether DSN is mandatory. |
| `APP_VERSION` | Backend runtime env | No | unset | Used as Sentry release tag. |
| `OTEL_SERVICE_NAME` | Backend runtime env | No | `zoho-backend` | Resource tag on exported spans. |
| `RUM_BIGQUERY_DATASET` | Backend runtime env | No | unset | When set, RUM ingest streams to BigQuery; otherwise logs locally. |
| `LOG_LEVEL` | Backend runtime env | No | `INFO` | Root logger level. |
| `RUM_FLUSH_INTERVAL_S` | Backend runtime env | No | `5` | RUM batch flush interval seconds. |
| `RUM_HIGH_WATERMARK` | Backend runtime env | No | `100` | Trigger early flush when queue size exceeds this. |
| `RUM_QUEUE_MAX` | Backend runtime env | No | `10000` | Hard cap on the in-process queue. |
