# Requirements Document: World-Class Performance & Architecture

> **Spec ID:** `world-class-performance`
> **Status:** Draft v1.0
> **Owner:** Safa Othman
> **Target window:** 6+ months (Phases P0 → P6)
> **North-star goal:** Bring the Kurdish/Iraq ERP to **Zoho One / SAP B1 / Odoo Enterprise** performance and reliability tier — measured by Core Web Vitals, p95 API latency, offline POS resilience, and observability depth.

---

## Introduction

The platform today is feature-complete on paper: 276 frontend pages, 115 FastAPI endpoint modules, 30+ ext modules, full POS with IndexedDB persistence, 3-language i18n with RTL, Firestore + Redis + Cloud Run deploy, Vitest + Playwright + axe-core. The constraint is no longer breadth — it is **felt speed**, **offline credibility**, and **operational discipline** under real Iraqi-market conditions (intermittent 3G/4G, low-end Android, electricity drops, large customer datasets > 100k rows per tenant).

This spec defines the requirements that close the gap between *"works on a developer laptop"* and *"feels world-class on a 50 USD Android tablet behind a Karak shop counter."*

The audit surfaced ten footguns that this spec is written to eliminate:

1. A 4,605-line monolithic `settings/sections/bodies.tsx` with no memoization.
2. POS IndexedDB stores that re-open the database on every operation.
3. ResponsiveTable / ResponsiveChart / ResponsiveDialog without windowing for 1k+ rows.
4. No Service Worker — POS offline is queue-only, not network-intercepted.
5. Firestore `useFirestoreLive` subscriptions without time-boxing or back-pressure.
6. Help registry chunked but no graceful fallback on chunk-load failure.
7. Arabic i18n at 33% coverage (1,811 / 5,500 lines); RTL untested at scale.
8. POSTerminal at 799 lines mixing UI, validation, and state.
9. No web-vitals SDK, no RUM, no distributed tracing — Sentry env-gated only.
10. No virtualization anywhere; React Query default config not tuned per route class.

---

## Glossary

| Term | Definition |
|------|------------|
| **CWV** | Core Web Vitals — LCP, INP, CLS as defined by web.dev (2024 spec, INP replaces FID). |
| **p95 / p99** | 95th / 99th percentile latency over a 7-day rolling window. |
| **RUM** | Real User Monitoring — performance metrics collected from real client sessions, not synthetic. |
| **TTI** | Time To Interactive (Lighthouse metric). |
| **TBT** | Total Blocking Time (Lighthouse metric). |
| **SW** | Service Worker — browser-resident proxy script for network interception, caching, and offline UX. |
| **Workbox** | Google's library for Service Worker recipes (precache, runtime cache, Background Sync). |
| **BgSync** | Background Sync API — replays queued POST requests when connectivity returns. |
| **PWA** | Progressive Web App — installable, offline-capable web app meeting the PWA installability criteria. |
| **PoP** | Point of Presence — CDN edge location serving static assets. |
| **TTFB** | Time To First Byte from origin or edge. |
| **OTel** | OpenTelemetry — vendor-neutral tracing/metrics/logs SDK. |
| **APM** | Application Performance Monitoring. |
| **CRDT** | Conflict-free Replicated Data Type — used for multi-device POS cart merge without conflicts. |
| **SLO** | Service Level Objective — measurable performance target backed by error-budget policy. |
| **Hydration** | The process by which React attaches event handlers to server-rendered HTML. |
| **Edge function** | Code executed at CDN PoP (Vercel Edge, Cloudflare Workers) close to the user. |
| **Cold start** | First request after a Cloud Run instance is provisioned (no warm container). |
| **Soft delete** | Mark-as-deleted with `deleted_at` timestamp, retained for 30 days for audit. |
| **Tenant** | A single organization in the multi-tenant Firestore database. |

---

## Requirements

### Requirement 1 — Core Web Vitals SLOs (Frontend Felt Speed)

THE Frontend SHALL meet the following Core Web Vitals targets on the **75th percentile of real users** measured via RUM over a 28-day rolling window, segmented by device class and network:

1.1. **LCP (Largest Contentful Paint)** SHALL be ≤ **2.0s** on 4G mid-tier Android, ≤ **2.5s** on 3G, ≤ **1.5s** on desktop broadband. Threshold for "good" per Google's CWV is 2.5s; we exceed that on capable devices.

1.2. **INP (Interaction to Next Paint)** SHALL be ≤ **150ms** on all device classes. Hard ceiling: no interaction may exceed 500ms (long-task budget).

1.3. **CLS (Cumulative Layout Shift)** SHALL be ≤ **0.05** across all routes (CWV "good" is ≤ 0.1; we set a stricter internal bar).

1.4. **TTFB (Time To First Byte)** SHALL be ≤ **600ms** from Baghdad / Erbil / Sulaymaniyah, ≤ **1.0s** from Basra and rural governorates.

1.5. **JS bundle, first-load, gzipped** SHALL be ≤ **180 KB** for the public route shell (login / landing / onboarding), and ≤ **350 KB** for the authenticated app shell (sidebar, top bar, dashboard skeleton). Per-route chunks SHALL be ≤ **80 KB gzipped** each.

1.6. **First Lighthouse Performance score** on production builds SHALL be ≥ **90** on mobile and ≥ **95** on desktop, with no regression of more than 3 points between consecutive deploys (LHCI assertion).

1.7. WHEN a metric exceeds its threshold for 3 consecutive deploys, THE CI pipeline SHALL block the deploy and post a regression report to the team channel with attribution to the offending commit.

### Requirement 2 — Per-Route Class Caching & Data-Fetching Policy

THE Frontend SHALL classify every list and detail route into one of five **data freshness classes**, each with its own React Query configuration:

| Class | staleTime | gcTime | refetchOnFocus | Background refetch | Use cases |
|-------|-----------|--------|----------------|---------------------|-----------|
| **A — Real-time** | 0 | 5 min | yes | every 30s | POS open carts, Kitchen Display, live dashboards |
| **B — Hot transactional** | 30s | 10 min | yes | none | Invoices list, Bills list, Sales Orders, Payments |
| **C — Warm reference** | 5 min | 30 min | no | none | Contacts, Items, Accounts, Tax codes |
| **D — Cold reference** | 1 hour | 24 hours | no | none | Currencies, Countries, COA templates, system enums |
| **E — Static** | Infinity | 24 hours | no | none | Help registry, l10n templates, e-invoice schemas |

2.1. EACH React Query hook SHALL declare its class via a `queryClass: 'A' | 'B' | 'C' | 'D' | 'E'` option that maps to the table above. A lint rule SHALL fail CI if a query is missing the class.

2.2. THE useCRUD hook SHALL accept `queryClass` and apply the correct config automatically; callers SHALL NOT pass raw staleTime/gcTime.

2.3. EACH mutation SHALL invalidate the minimum precise key set; broad invalidation (e.g., invalidating the entire `['invoices']` tree) SHALL be flagged by a custom lint rule.

2.4. EACH Class-A and Class-B list SHALL support **optimistic updates** for create and edit operations (not delete). Failed mutations SHALL roll back via the React Query `onError` path with a toast that includes the original error code.

2.5. THE app SHALL ship a **persistent query cache** (React Query `persistQueryClient` with IndexedDB backend) so cold loads on returning users render from cache within 100ms while revalidation happens in background.

2.6. THE Firestore live subscriptions (`useFirestoreLive`) SHALL be **time-boxed** to 30 minutes of idle; after that they detach and fall back to React Query polling. Re-mounting the component re-subscribes. This prevents zombie listeners draining battery.

### Requirement 3 — Module Lazy-Loading at Production Scale

3.1. ALL 44 module folders under `frontend/src/pages/` SHALL be lazy-loaded via `React.lazy()` with no exception. The current state is mostly lazy; this requirement ratchets it to 100% with a CI check.

3.2. THE app shell (the always-loaded code) SHALL contain **only**: router, theme provider, i18n provider, auth context, sidebar, top bar, notification host, command palette, and the dashboard landing page. Everything else SHALL be a separate chunk.

3.3. EACH ext module (`/ext/<slug>` — 22 modules across waves B/C/D) SHALL be a **separate route-level chunk** with its own `moduleConfig` loaded only when the route is visited. The `moduleConfigs.ts` registry SHALL ship a *manifest* (slug → import function) in the main bundle, not the full config object graph.

3.4. THE lazy-loader wrapper SHALL implement **chunk-load retry** (3 attempts with exponential backoff: 500ms, 2s, 8s) before showing the error fallback, because Iraqi mobile networks frequently drop the chunk request mid-flight.

3.5. WHEN a chunk fails to load after 3 retries, THE error fallback SHALL: (a) log to Sentry with the chunk name and HTTP error, (b) render a localized error UI with a "Reload page" CTA, (c) NOT crash the surrounding route shell.

3.6. THE Vite `manualChunks` strategy SHALL be reviewed and split further:
- `vendor-react` → kept (React, React-DOM, React-Router only)
- `vendor-query` → new (TanStack React Query split out from vendor-react)
- `vendor-antd-core` and `vendor-antd-icons` → split (icons can be deferred)
- `vendor-charts` → only loaded on routes that import Recharts (no global chunk)
- `vendor-firebase-auth`, `vendor-firebase-firestore`, `vendor-firebase-messaging` → split per service
- `vendor-pdf` (reportlab via WASM if used) → lazy
- `vendor-flow` (reactflow) → lazy, only on routes that use diagrams

3.7. THE bundle analyzer (`rollup-plugin-visualizer` or `vite-bundle-analyzer`) SHALL run on every PR and post the diff vs main to the PR. A chunk growing by > 10 KB gzipped without justification SHALL be flagged.

### Requirement 4 — POS Performance, Offline & Resilience

THE POS subsystem SHALL meet the demands of a real Iraqi retail counter: tap-to-print receipts in under 200ms, sustained 60fps grid scrolling, full transactions while offline for up to 24 hours, multi-device sync with conflict resolution.

4.1. **POSTerminal.tsx (currently 799 LOC) SHALL be decomposed** into:
- `POSTerminalShell.tsx` (layout + slots, < 150 LOC)
- `POSProductGrid.tsx` (virtualized grid, separate)
- `POSCartPanel.tsx` (cart UI only)
- `POSPaymentModal.tsx` (payment flow)
- `POSDiscountModal.tsx`, `POSCustomerPanel.tsx`, etc.
- A `usePOSTerminal()` hook for orchestration, with internal sub-hooks per concern.

4.2. THE POS product grid SHALL use **virtualization** (`@tanstack/react-virtual`) for catalogs > 200 items. Render budget: ≤ 16ms per scroll frame.

4.3. THE IndexedDB layer SHALL be replaced by a **single shared wrapper** (`pos/db.ts`) that opens the database once on app boot and exposes typed CRUD methods. No call site SHALL open a new connection. The wrapper SHALL use **`idb`** library for promise-based API.

4.4. THE app SHALL register a **Service Worker** (via `vite-plugin-pwa` with Workbox) that:
- Precaches the app shell (HTML, CSS, JS for /, /pos, /pos/terminal)
- Runtime-caches API GET responses with `StaleWhileRevalidate` for Class-C and Class-D
- Runtime-caches images with `CacheFirst` + 30-day expiry
- Implements **Background Sync** for POS POST requests when offline

4.5. WHEN the POS is offline, THE app SHALL: (a) show a clear "Offline" pill in the top bar, (b) keep accepting transactions (queued via BgSync), (c) keep printing receipts via local Bluetooth/USB printer, (d) sync the queue automatically when online — **no manual sync button required**.

4.6. WHEN two devices edit the same open cart concurrently, THE merge strategy SHALL be deterministic and lossless: line additions are union, quantity edits last-write-wins by client timestamp + device-id tiebreak, line deletions are tombstoned. Documented as a CRDT-style merge.

4.7. THE receipt print path (`ReceiptTemplate80mm.tsx` → print) SHALL execute in **≤ 200ms** from tap to printer-buffer-write on a 4-year-old Android tablet. Measurement instrumented via `performance.mark` pairs.

4.8. THE POS Kitchen Display (KDS) SHALL update within **2 seconds** of order submission across the local network even on flaky WiFi, using a local WebSocket relay if Firestore latency exceeds 1 second.

4.9. THE PIN-pad and barcode scanner SHALL never block the main thread; barcode decoding SHALL run in a Web Worker.

### Requirement 5 — Backend Latency & Throughput SLOs

THE Backend SHALL meet the following SLOs measured over a 7-day rolling window per endpoint class:

| Endpoint class | p50 | p95 | p99 | Error rate |
|----------------|-----|-----|-----|------------|
| **Read, single document** | 50ms | 150ms | 400ms | < 0.1% |
| **Read, paginated list (≤ 50 rows)** | 100ms | 300ms | 800ms | < 0.1% |
| **Write, single document** | 100ms | 350ms | 1000ms | < 0.2% |
| **Bulk write (≤ 500 docs)** | 500ms | 2000ms | 5000ms | < 0.5% |
| **Report query (aggregates)** | 300ms | 1500ms | 4000ms | < 0.5% |
| **POS checkout (end-to-end)** | 150ms | 400ms | 1000ms | < 0.05% |

5.1. THE 20 highest-traffic endpoints (identified by `_ROUTE_STATS` and re-validated quarterly) SHALL have **Redis-backed response caching** for GETs with cache-control headers respected, TTLs aligned to Section 2's class table.

5.2. THE Firestore composite indexes SHALL be audited quarterly; any query taking > 200ms on a 100k-doc tenant SHALL be either backed by an index or rewritten. Index manifest tracked in `firestore.indexes.json` and deployed via `deploy-firestore.yml`.

5.3. THE Pydantic models SHALL use `model_config = ConfigDict(extra='ignore', validate_assignment=False)` on hot paths to skip redundant validation. Response models SHALL be flat where possible to avoid deep traversal.

5.4. THE FastAPI app SHALL replace synchronous Firestore SDK calls on async routes with the official async client OR with `run_in_threadpool` — no blocking calls SHALL run on the event-loop thread. A lint rule (`asyncio-safe`) SHALL enforce this.

5.5. THE rate limiter (slowapi) SHALL be backed by **Redis** in production with key partitioning per tenant. In-memory fallback only in dev. Per-tenant defaults: 600 req/min for authenticated traffic, 60 req/min for unauthenticated.

5.6. THE Cloud Run service SHALL be configured with **min-instances=1** in production to eliminate cold starts on the user-facing tier, and **max-instances=20** with concurrency=80. Cold start budget: p95 cold start ≤ 2s including app boot.

5.7. THE Cloud Run revisions SHALL run on **CPU always allocated** (not request-based) for the user-facing tier, so background tasks (APScheduler) execute reliably.

5.8. THE 99th-percentile Firestore read SHALL stay below **400ms**; reads exceeding 1s SHALL be logged with `slow_read=true` and trigger an investigation ticket.

5.9. THE backup job (Firestore export to GCS) SHALL run nightly and complete in < 30 minutes for tenants up to 500k docs. Backup integrity is verified by the `backup-verify.yml` workflow.

### Requirement 6 — Observability, Tracing, and RUM

The current state — Sentry optional, in-memory route stats — is insufficient. We need RUM for the client, OpenTelemetry tracing across services, and SLO-aligned dashboards.

6.1. THE Frontend SHALL ship **`web-vitals`** library and report LCP, INP, CLS, TTFB, FCP to a backend ingest endpoint (`POST /api/rum/vitals`) with sampling: 100% for first session per device, 10% thereafter.

6.2. THE RUM ingest SHALL store metrics in BigQuery (or Firestore aggregation) keyed by (tenant_id, route, device_class, network, app_version, timestamp). Retention: 90 days raw, rolled into daily aggregates after 30 days.

6.3. THE Backend SHALL emit **OpenTelemetry** spans for every HTTP request and Firestore call with attributes: `tenant_id`, `user_id`, `org_id`, `route`, `firestore.collection`, `firestore.operation`, `cache.hit`. Spans exported to Google Cloud Trace.

6.4. THE Sentry SDK SHALL be **mandatory** in production (build fails if `SENTRY_DSN` missing in production env), with frontend + backend wired. Frontend sample rate: 100% errors, 10% performance traces.

6.5. THE structured logs SHALL emit JSON with fixed fields: `timestamp, severity, request_id, tenant_id, user_id, route, latency_ms, status_code, message`. Logs ingested into Cloud Logging; alerts wired to Slack/email.

6.6. THE Grafana / Cloud Monitoring dashboards SHALL exist for: API latency by endpoint class, Firestore read/write rate, Redis hit ratio, queue depth, Service Worker registration rate, RUM CWV percentiles by region. One dashboard per concern, linked from the README.

6.7. THE error budget policy SHALL be: 99.5% availability per month (= 3.6h downtime budget). Burn-rate alerts at 2x and 10x the budget. Incident postmortem required on any SEV1.

### Requirement 7 — Security, Multi-Tenancy & Data Integrity

7.1. EVERY Firestore query SHALL include a tenant filter; rules SHALL deny any read/write missing `tenant_id == request.auth.token.tenant_id`. Audited via `firestore.rules` tests in CI.

7.2. EVERY API endpoint SHALL require an authenticated user (except `/api/health`, `/api/version`, `/api/auth/*`); enforced by middleware, not per-route.

7.3. EVERY API endpoint SHALL check role-based permission (RBAC) before performing the action. Permissions stored on the user document; checked via `usePermission` on the frontend (UI gating) and a backend dependency (`require_permission(...)`) for enforcement.

7.4. THE app SHALL implement **Content Security Policy (CSP)** with no `unsafe-inline` or `unsafe-eval`; styles use nonces or hashes; CSP report-only mode enabled first, enforced after 14 days clean.

7.5. THE Cloud Run service SHALL enforce HTTPS-only, HSTS with `max-age=31536000; includeSubDomains; preload`. Reaffirmed at the CDN edge.

7.6. THE secrets SHALL live in Google Secret Manager — no API keys in env vars, no service-account JSON in repo. Loaded at boot via the `secretmanager` client.

7.7. THE PII export and deletion SHALL be implemented for GDPR-equivalent compliance (Iraqi PDPL where applicable): tenant admins can export all user data and request hard delete; data anonymized after 30-day grace.

### Requirement 8 — Settings Page & High-Risk Monoliths Refactor

8.1. THE `settings/sections/bodies.tsx` file (currently 4,605 LOC) SHALL be decomposed into one file per settings section, with a registry that maps `sectionKey → lazy import`. Target: no file in the settings tree exceeds **400 LOC**.

8.2. EACH settings section SHALL be wrapped in `React.memo` and use stable callback references; no inline-defined handlers in props.

8.3. THE settings shell SHALL lazy-load each section on demand. Visiting `/settings` SHALL load only the shell + the default section.

8.4. THE 10 next-largest files (identified via `wc -l` audit in CI) SHALL be tracked in a "monolith budget" — no file may grow > 600 LOC; CI fails if exceeded without an explicit `// monolith-budget-exempt` comment + ADR link.

### Requirement 9 — i18n Completeness, RTL Polish & Locale Bundling

9.1. THE Arabic translation SHALL reach **100% key coverage** vs the Kurdish/English baseline (currently ~33%). Owned by a translation pass + automated coverage gate.

9.2. THE i18n loader SHALL ship **only the active language's bundle** on first paint, with the other languages fetched on language switch — no triple-loading.

9.3. THE translation bundles SHALL be split per major module (auth, sales, purchases, inventory, pos, hr, payroll, settings, reports) so each lazy-loaded route fetches only its slice.

9.4. THE RTL layout SHALL be visually verified via Playwright + screenshot diff on the top 30 routes for Arabic and Kurdish.

9.5. THE numeric formatting SHALL respect locale: Iraqi Dinar formatting (no decimals, `د.ع` suffix), Arabic-Indic digits optional via user preference.

### Requirement 10 — DevOps, CI Gates & Deploy Hygiene

10.1. THE CI pipeline SHALL run on every PR: lint, typecheck, vitest (parallel sharded), Playwright smoke (10 critical paths), bundle-size diff, LHCI (with budget assertions), a11y axe scan, security audit (`npm audit --omit=dev` + `pip-audit`), and CodeQL.

10.2. THE deploy workflow SHALL be **gated** by green CI; no `workflow_dispatch` shortcut to prod without an approval.

10.3. THE production deploy SHALL use **blue/green** via Cloud Run revisions with 5-minute soak on the new revision (1% traffic) before full cutover. Automatic rollback if 5xx rate > 0.5% during soak.

10.4. THE feature flags (`@app/api/featureFlags.ts`) SHALL gate every new user-facing feature. Default off in prod; ramp via admin console.

10.5. THE Cloud Run region SHALL be **`me-central1`** (Doha — closest to Iraq) for both Firestore and Run. Asia-southeast or europe-west fallback only if me-central1 unavailable.

10.6. THE disaster-recovery runbook (`DISASTER_RECOVERY.md`) SHALL be tested **quarterly** via a tabletop exercise; results filed in `audit/dr/`.

10.7. THE secrets rotation policy SHALL be: SECRET_KEY every 180 days, third-party API keys every 365 days, service-account keys avoided in favor of Workload Identity Federation.

### Requirement 11 — Edge Caching, Image Optimization & Network Strategy

11.1. THE static assets (JS, CSS, fonts) SHALL be served from a CDN (Vercel Edge Network or Cloud CDN in front of Cloud Run static bucket) with `Cache-Control: public, max-age=31536000, immutable` and content-hashed filenames.

11.2. THE images SHALL be served as **AVIF with WebP fallback**, generated at build time (or on the fly via Vercel Image Optimization), with `srcset` for 1x/2x/3x densities, lazy-loaded below the fold, `loading="lazy"` + `decoding="async"`.

11.3. THE fonts SHALL be self-hosted, subset to the Kurdish/Arabic glyph ranges actually used, `font-display: swap`, preloaded for the primary weight.

11.4. THE API responses SHALL be **gzip + brotli** compressed by Cloud Run / load balancer; `Vary: Accept-Encoding` set correctly.

11.5. THE HTTP/2 (or HTTP/3 where supported) SHALL be enforced end-to-end; verified via `curl -I --http3`.

### Requirement 12 — Mobile Native Bridge & Offline-First Mobile

12.1. THE `mobile/` folder SHALL deliver a Capacitor or Expo wrapper that reuses the web build with native plugins for: printer (ESC/POS Bluetooth), barcode scanner (camera + hardware), NFC (for loyalty cards), local notifications.

12.2. THE mobile app SHALL ship the same Service Worker logic as PWA but supplemented by SQLite (via Capacitor SQLite) for larger-than-IndexedDB datasets (> 100MB product catalogs).

12.3. THE mobile app SHALL pass **Google Play Pre-Launch Report** with zero crashes on the top 12 device classes (Samsung A-series, Xiaomi Redmi, Huawei older models).

### Requirement 13 — Testing Discipline at Scale

13.1. THE unit + integration test coverage SHALL reach **≥ 70%** on `frontend/src/` (currently estimated at < 30% by file ratio) and **≥ 80%** on `backend/app/`. Coverage gate in CI.

13.2. THE Playwright E2E SHALL cover the top **50 critical user journeys** including: full POS sale (cash + card + split + refund), invoice → payment → reconciliation, purchase order → bill → payment, payroll run, inventory stock-take.

13.3. THE Playwright SHALL run on three browsers (Chromium, Firefox, WebKit) and two viewports (390px mobile, 1280px desktop) for each journey.

13.4. THE load test (k6 or Locust) SHALL exercise the top 20 endpoints to validate SLOs from Requirement 5. Run nightly against a staging tenant with 100k seeded docs.

13.5. THE accessibility scan (axe-core) SHALL find **zero serious or critical** violations on the top 30 routes; warnings tracked in an a11y backlog.

### Requirement 14 — Documentation, Runbooks & Developer Velocity

14.1. EACH module SHALL have a `docs/sections/<module>.md` describing data model, API surface, key flows, and known limits. Today's `docs/sections/` SHALL be audited for completeness.

14.2. THE root README SHALL render a status badge grid: CI, deploy, LHCI score, test coverage, last backup verified.

14.3. THE onboarding-a-new-developer time (clone → run dev → first PR merged) SHALL be ≤ **1 working day**; verified via a real onboarding session each quarter.

14.4. EACH runbook SHALL live under `docs/runbooks/` and include: trigger conditions, escalation path, exact commands, rollback steps.

14.5. THE Architecture Decision Records (ADRs) SHALL be added under `docs/adr/`, one per significant decision (e.g., "ADR-001: Firestore over Postgres", "ADR-002: Service Worker via Workbox", etc.). Required for any change altering this spec.

---

## Non-Functional Requirements Summary (the contract)

| Dimension | Target |
|-----------|--------|
| LCP (p75, 4G Android) | ≤ 2.0s |
| INP (p75) | ≤ 150ms |
| CLS | ≤ 0.05 |
| First-load JS, app shell | ≤ 350 KB gzipped |
| Per-route JS chunk | ≤ 80 KB gzipped |
| API p95, read list | ≤ 300ms |
| API p95, POS checkout | ≤ 400ms |
| POS receipt print latency | ≤ 200ms |
| Availability (monthly) | ≥ 99.5% |
| Cold start (p95) | ≤ 2s |
| Test coverage (FE / BE) | 70% / 80% |
| Bundle regression budget | +10 KB gzipped per PR (else flagged) |
| Largest single file (LOC) | ≤ 600 (else flagged) |

---

## Out of Scope (for this spec, not forever)

- Native iOS app (Capacitor is the bridge — native Swift is a separate spec)
- White-label theming per tenant (separate spec)
- Marketplace for third-party plugins (separate spec)
- AI features beyond the existing `/ext/ai` module (separate spec)
- Database migration off Firestore (decisively kept; see ADR-001 to be written)

---

## Acceptance: How we know we are done

This spec is "done" when, on production traffic over a clean 28-day window:

1. CWV thresholds in §1 are green at p75 across all device/network classes.
2. API SLOs in §5 are green at p95 for all endpoint classes.
3. POS offline can complete a 24-hour disconnected day with full sync recovery, verified in a controlled drill.
4. Settings monolith is decomposed; no file > 600 LOC.
5. RUM dashboard exists and is checked weekly by the team.
6. CI gates fail on any regression past the thresholds in this document.
7. Arabic i18n is at 100% coverage.
8. Quarterly DR drill passes with no manual intervention beyond the runbook.

Until then, this spec drives every prioritization conversation.
