# Tasks: World-Class Performance & Architecture

> **Spec ID:** `world-class-performance`
> **Companion to:** `requirements.md`, `design.md`
> **Status:** Draft v1.0
> **Owner:** Safa Othman
> **Sequencing principle:** *Measure → Optimize → Validate.* No phase begins without baseline metrics; no phase ends without a regression-proof SLO move.

---

## Phase overview

| Phase | Theme | Calendar | Headline outcome |
|-------|-------|----------|------------------|
| **P0** | Foundations & Measurement | Weeks 1–3 | RUM + OTel + bundle analyzer live; baseline dashboards green; SLO budgets agreed |
| **P1** | Frontend Shell Diet & Lazy Discipline | Weeks 4–7 | App shell ≤ 350KB gz; all 44 modules lazy; chunk-retry hardened |
| **P2** | Data-Fetching Class System | Weeks 8–10 | React Query class system live; persistent cache; Firestore listeners time-boxed |
| **P3** | POS Refactor + PWA / Service Worker | Weeks 11–15 | Workbox SW; POSTerminal decomposed; virtualized grid; Background Sync |
| **P4** | Backend Latency, Caching & Cloud Run hardening | Weeks 16–19 | Redis facade; OTel spans; min-instances; rate limit on Redis; p95 SLOs met |
| **P5** | Settings monolith + i18n completion + RTL polish | Weeks 20–23 | Settings sections all ≤ 400 LOC; Arabic 100%; namespace-split bundles |
| **P6** | DevOps, Security, Mobile, Load-test, DR drill | Weeks 24–28 | Blue/green deploy; CSP enforced; WIF; mobile wrapper; quarterly DR drill passed |

> **Note:** Phases overlap where dependencies allow (P0 measurement runs through every later phase). Calendar assumes 1 senior FE + 1 senior BE + part-time DevOps + part-time QA. Adjust if staffing changes.

---

## Phase P0 — Foundations & Measurement (Weeks 1–3)

> **Exit criteria:** Baselines for every SLO in `requirements.md` are recorded; CI gates exist but are advisory (not blocking) so they can be calibrated before they bite.

### T-0.1 — Install `web-vitals` and wire ingest *(R6.1, R6.2)*
- Add `web-vitals` to `frontend/package.json`.
- Create `src/observability/vitals.ts` that registers `onLCP`, `onINP`, `onCLS`, `onFCP`, `onTTFB` callbacks.
- POST batched events to `/api/rum/vitals` with the schema in design §3.5.
- Backend: implement `app/api/rum.py` and `app/services/rum_ingest.py` with BigQuery streaming insert (use existing `google-cloud-bigquery` if present; else add).
- **Acceptance:** A 24-hour soak shows ≥ 1000 vitals events landing in BigQuery, segmented correctly.
- **Effort:** 3 days. **Owner:** FE + BE.

### T-0.2 — OpenTelemetry tracing in backend *(R6.3)*
- Add `opentelemetry-instrumentation-fastapi`, `opentelemetry-exporter-gcp-trace` to `backend/requirements.txt`.
- Implement `app/observability/tracing.py` per design §3.4; call from `lifespan` in `main.py`.
- Add custom spans wrapping the Firestore client and the Redis cache facade with attributes (`firestore.collection`, `cache.hit`).
- **Acceptance:** A live request appears as a single trace in Cloud Trace with at least 3 child spans (route, firestore, cache).
- **Effort:** 2 days. **Owner:** BE.

### T-0.3 — Bundle analyzer + PR-diff bot *(R3.7)*
- Add `rollup-plugin-visualizer` to `vite.config.ts` (gzip + brotli enabled).
- New CI job `bundle-size`: runs `npm run build`, parses `dist/stats.html` JSON sidecar, compares against `main` artifact, posts sticky PR comment with table of changed chunks.
- Add a threshold: chunks growing > 10 KB gz without `[allow-bundle-growth]` in commit message → CI **advisory** in P0, **blocking** from P1 onward.
- **Acceptance:** PR comment appears on the next test PR with chunk sizes; threshold logic verified by a deliberate fat dependency import.
- **Effort:** 1.5 days. **Owner:** DevOps + FE.

### T-0.4 — LHCI tightening *(R1.6)*
- Update `lighthouserc.json` with assertions: `categories:performance` >= 0.90 mobile, >= 0.95 desktop; LCP/INP/CLS budget tied to R1.1–1.3.
- Run on 5 critical URLs (login, dashboard, /invoices, /pos/terminal, /settings).
- **Acceptance:** Three consecutive deploys' LHCI runs are within the same band (≤ 2-point variance) so the gate is calibratable.
- **Effort:** 1 day. **Owner:** DevOps.

### T-0.5 — Monolith budget audit *(R8.4)*
- Add `scripts/audit-loc.mjs`: lists files in `frontend/src/` and `backend/app/` over 400 LOC; prints a table to CI logs.
- Track the top 30 in `docs/audit/monolith-watchlist.md` with an owner per file.
- Advisory in P0; from P1, file growth past 600 LOC fails CI unless an `// monolith-budget-exempt: <ADR>` comment is on line 1.
- **Acceptance:** Watchlist file exists with at least the 10 known offenders (settings/bodies.tsx, POSTerminal.tsx, ResponsiveTable.tsx, etc.).
- **Effort:** 0.5 days. **Owner:** FE.

### T-0.6 — Mandatory Sentry in prod *(R6.4)*
- Frontend: `@sentry/react` with sample rates per R6.4; integrated in `App.tsx` boot.
- Backend: Sentry SDK becomes a hard requirement (boot fails in prod env if `SENTRY_DSN` empty); already optional today, just flip the guard.
- Source maps uploaded to Sentry on every deploy via the GH Action.
- **Acceptance:** A deliberate `throw new Error('test-sentry-fe')` and `raise RuntimeError('test-sentry-be')` both land in the Sentry project with stack-trace symbols.
- **Effort:** 1.5 days. **Owner:** FE + BE.

### T-0.7 — Build the six baseline dashboards *(R6.6)*
- Six Cloud Monitoring dashboards per design §4.2.
- Linked from a new `docs/observability/README.md`.
- **Acceptance:** Each dashboard URL renders data from the previous 7 days.
- **Effort:** 2 days. **Owner:** DevOps.

### T-0.8 — Record baselines into a baseline doc *(meta)*
- Create `audit/baselines/2026-Q2-baseline.md` with screenshots/exports of:
  - LCP/INP/CLS p75 by device class for the last 14 days
  - Top-20 endpoint latency p50/p95/p99
  - Shell + per-route bundle size table
  - Top-30 file LOC table
  - LHCI score per critical URL
- **Acceptance:** Doc reviewed in a 30-min meeting; all numbers cross-checked against dashboards.
- **Effort:** 1 day. **Owner:** Tech lead.

---

## Phase P1 — Frontend shell diet & lazy discipline (Weeks 4–7)

> **Exit criteria:** App shell ≤ 350 KB gz. All 44 modules lazy. Chunk-retry handles flaky network. `vendor-*` chunks split per design §1.6.

### T-1.1 — `lazyWithRetry` utility + adoption *(R3.4, R3.5)*
- Implement `src/utils/lazyWithRetry.ts` per design §1.2 with Sentry tagging.
- Replace every `React.lazy(...)` in `App.routes.tsx` and `moduleConfigs.ts` with the new wrapper.
- Add `ChunkLoadErrorFallback.tsx` in the shell (localized error UI + Reload button).
- **Acceptance:** Simulate a chunk-load failure with a Vite mock; user sees 3 retry attempts then fallback; Sentry receives the event.
- **Effort:** 2 days. **Owner:** FE.

### T-1.2 — Audit and ratchet 100% lazy *(R3.1, R3.3)*
- `scripts/audit-lazy.mjs`: AST-walk `App.routes.tsx` + module configs; assert every route component is dynamically imported.
- Fix any direct imports found; sentinel module: `moduleConfigs.ts` — load section configs lazily (only the manifest stays in main).
- **Acceptance:** Script passes; bundle analyzer shows no module page in the main chunk.
- **Effort:** 3 days. **Owner:** FE.

### T-1.3 — Refine `vite.config.ts` manualChunks *(R3.6)*
- Implement the chunk plan in design §1.6.
- Verify with `npm run build && npm run analyze` that:
  - `vendor-antd-icons` is its own chunk and < 80 KB gz
  - `vendor-firebase-firestore` and `vendor-firebase-auth` are split
  - `vendor-flow`, `vendor-grid`, `vendor-office` are lazy (not in shell)
- **Acceptance:** Shell-chunk total drops measurably; recorded in baseline-update doc.
- **Effort:** 2 days. **Owner:** FE.

### T-1.4 — Shell-size CI gate goes blocking *(R1.5)*
- `scripts/check-shell-size.mjs`: traces the shell's import graph from `App.tsx`, sums sizes of always-loaded chunks, asserts ≤ 350 KB gz.
- Wire as a CI step after `bundle-size`.
- **Acceptance:** Test PR that imports a known-fat module into the shell fails CI with a clear message.
- **Effort:** 1.5 days. **Owner:** FE + DevOps.

### T-1.5 — Image and font pipeline *(R11.2, R11.3)*
- Add `vite-imagetools` + a `<Picture>` wrapper component.
- Subset Noto Sans Kurdish + Arabic to the actual glyphs (use `glyphhanger` over a build of the i18n bundles).
- Preload primary weight via `<link rel="preload">` in `index.html`.
- **Acceptance:** Hero image on `/` ships as AVIF; total font payload ≤ 200 KB across all weights.
- **Effort:** 2 days. **Owner:** FE.

### T-1.6 — Vercel deploy with edge image optimization *(R11.1, R11.4, R11.5)*
- Wire `vercel.json`: rewrites `/api/*` → Cloud Run; image optimization enabled; Brotli on.
- Switch DNS for staging first; monitor 7 days; then prod.
- **Acceptance:** `curl -I` shows Brotli + HTTP/3; images return AVIF for capable clients.
- **Effort:** 2 days. **Owner:** DevOps.

### T-1.7 — Validate against baseline
- Re-run the baselines in T-0.8; expect LCP to drop measurably on `/` and `/dashboard`; LHCI score improvement.
- Document delta in `audit/baselines/P1-exit.md`.
- **Acceptance:** Tech lead signs off on the numbers vs Section 1 SLO targets.
- **Effort:** 0.5 days. **Owner:** Tech lead.

---

## Phase P2 — Data-fetching class system (Weeks 8–10)

> **Exit criteria:** Every `useQuery`-flavored hook declares a `queryClass`. Persistent cache live. `useFirestoreLive` time-boxed.

### T-2.1 — `useClassedQuery` + `useCRUD` upgrade *(R2.1, R2.2)*
- Implement `src/data/queryClasses.ts` and `useClassedQuery` per design §1.3.
- Upgrade `useCRUD` to accept `queryClass`.
- **Acceptance:** Unit tests cover all 5 class configs.
- **Effort:** 1.5 days. **Owner:** FE.

### T-2.2 — Custom ESLint rule `require-query-class` *(R2.1)*
- New rule under `tools/eslint-rules/require-query-class.js`.
- Wire to `.eslintrc` for `frontend/src/**`.
- **Acceptance:** A test file with a raw `useQuery` fails lint with the right diagnostic.
- **Effort:** 1.5 days. **Owner:** FE.

### T-2.3 — Migrate 20 hottest queries to classed *(R2.1)*
- Identify top 20 from `_ROUTE_STATS` and frontend call sites.
- Migrate each, with PR-per-domain (Invoices, Bills, etc.) to keep diffs reviewable.
- **Acceptance:** All 20 use `useClassedQuery`; lint passes everywhere.
- **Effort:** 4 days. **Owner:** FE.

### T-2.4 — Persistent React Query cache *(R2.5)*
- Implement `src/data/idb-persister.ts` and wire `persistQueryClient`.
- Add a `queryClass: 'A'` exclusion to `shouldDehydrateQuery`.
- **Acceptance:** Returning user's `/invoices` list renders < 100ms cold, revalidation in background; verified via Lighthouse trace.
- **Effort:** 1.5 days. **Owner:** FE.

### T-2.5 — Optimistic updates for Class A/B *(R2.4)*
- Add a generic optimistic mutation helper `useOptimisticMutation` that wraps `useMutation` with proper `onMutate` snapshot + `onError` rollback + `onSettled` invalidation.
- Adopt on the top 10 mutation hooks (invoice create/edit, payment, cart line edit, etc.).
- **Acceptance:** A simulated 500-response triggers a clean rollback; the optimistic UI never gets stuck.
- **Effort:** 3 days. **Owner:** FE.

### T-2.6 — `useFirestoreLive` v2 — time-boxed *(R2.6)*
- Rewrite per design §1.5: idle detach at 30 min, lastSnapshotAt, isStale, listener-count warning.
- Add listener-count metric to observability dashboard (R6.6).
- **Acceptance:** A 31-minute idle test shows the listener detached; navigating back re-attaches.
- **Effort:** 2.5 days. **Owner:** FE.

### T-2.7 — Class-based invalidation discipline + lint *(R2.3)*
- Add `tools/eslint-rules/precise-invalidation.js` flagging `invalidateQueries({ queryKey: [resource] })` without a more specific key.
- Refactor 10 worst offenders.
- **Acceptance:** Lint passes; refactor PR shows lower refetch counts in DevTools profiler.
- **Effort:** 2 days. **Owner:** FE.

---

## Phase P3 — POS refactor + PWA / Service Worker (Weeks 11–15)

> **Exit criteria:** PWA installable. Workbox SW shipping. POSTerminal decomposed. Background Sync proven over a 24-hour offline drill.

### T-3.1 — Install `vite-plugin-pwa` + draft `sw.ts` *(R4.4)*
- Add plugin to `vite.config.ts`; generate manifest (`manifest.webmanifest`) with icons (192, 512), name in Kurdish + English.
- Initial SW: precache shell, runtime cache for static assets, no API caching yet.
- **Acceptance:** Chrome DevTools shows the app installable; Lighthouse PWA section turns green for installability.
- **Effort:** 2 days. **Owner:** FE.

### T-3.2 — Runtime cache rules per class *(R4.4)*
- Implement runtime cache rules per design §2.3 for Class C/D GETs (items, customers, tax, currencies).
- **Acceptance:** Offline test: load app online, go offline, navigate to `/items` — list renders from SW cache.
- **Effort:** 2 days. **Owner:** FE.

### T-3.3 — Background Sync for POS POSTs *(R4.5)*
- Implement `bgSyncPlugin` (Workbox) on `POST /api/pos/orders`.
- Frontend `useOnline` hook with heartbeat to `/api/health`.
- Top-bar pill renders Online / Offline / Syncing states.
- **Acceptance:** 1-hour offline test: 10 orders queued; come back online; all 10 sync within 90s; receipts already printed during offline period.
- **Effort:** 3 days. **Owner:** FE.

### T-3.4 — POSTerminal decomposition *(R4.1)*
- Refactor per design §2.1 into the 8 new files and `usePOSTerminal` hook.
- Land in 4 PRs (shell + grid; cart + payment; discount + customer; orchestration + cleanup) so review is humane.
- **Acceptance:** All POS Playwright tests still pass; no file > 220 LOC; render profile shows no regression.
- **Effort:** 5 days. **Owner:** FE.

### T-3.5 — Virtualized product grid *(R4.2)*
- Add `@tanstack/react-virtual`; build `POSProductGrid` with windowing.
- Benchmark with a 5000-item catalog: scroll 60fps target.
- **Acceptance:** DevTools Performance recording shows ≤ 16ms scroll frames on a mid-Android emulator profile.
- **Effort:** 2.5 days. **Owner:** FE.

### T-3.6 — Single IndexedDB wrapper *(R4.3)*
- Implement `src/stores/pos/db.ts` per design §2.2 (idb library).
- Migrate `posCart`, `posOffline`, `posSession`, `posFloor` to use the shared wrapper.
- Write a migration that copies data from the old `zoho-pos-db` schema to v4.
- **Acceptance:** Existing carts survive the migration on the dev tablet; perf-trace shows IDB open() called once per app boot.
- **Effort:** 3 days. **Owner:** FE.

### T-3.7 — Receipt-print latency budget *(R4.7)*
- Add `performance.mark('pos:print:start')` and `'pos:print:end'`; ship measure to RUM.
- Profile on a real 4-year-old Android tablet; identify and fix any synchronous JSON.stringify of the entire cart or font-load on print path.
- **Acceptance:** RUM p95 receipt-print latency ≤ 200ms over 100 prints in a soak test.
- **Effort:** 2 days. **Owner:** FE.

### T-3.8 — Barcode in a Web Worker *(R4.9)*
- Wrap `@zxing/library` in `src/workers/barcode.worker.ts`.
- `useBarcodeScanner` posts messages, awaits response.
- **Acceptance:** Long-task profiler shows no main-thread block > 50ms during scanning.
- **Effort:** 1.5 days. **Owner:** FE.

### T-3.9 — Multi-device cart merge *(R4.6)*
- Implement merge function in `src/stores/pos/merge.ts` per design §2.4.
- Property-based tests via `fast-check`: union, LWW, tombstone, resurrection.
- **Acceptance:** 1000 random merge scenarios converge identically regardless of merge order.
- **Effort:** 3 days. **Owner:** FE.

### T-3.10 — KDS fallback relay *(R4.8)* — *optional, gate via OQ-1*
- If green: build a small Bun + Hono WebSocket relay (`tools/kds-relay/`) packaged as a Pi-deployable Docker image.
- Frontend detects Firestore latency > 1s for 30s and falls back to `POS_LOCAL_RELAY_URL`.
- **Acceptance:** With Firestore artificially slowed, KDS still updates within 2s via the relay.
- **Effort:** 4 days. **Owner:** FE + DevOps. **Gate:** OQ-1.

### T-3.11 — 24-hour offline drill *(R4.5 acceptance)*
- On a clean test tenant: take the device offline at 09:00; run a normal day of sales for 24 hours; bring online; verify zero data loss, zero duplicate orders, all stock movements reconcile.
- Write the drill SOP into `docs/runbooks/pos-offline-drill.md`.
- **Acceptance:** Drill passes; SOP filed.
- **Effort:** 2 days (incl. setup + tear-down). **Owner:** FE + QA.

---

## Phase P4 — Backend latency, caching & Cloud Run hardening (Weeks 16–19)

> **Exit criteria:** API SLOs in §5 of requirements green at p95. Redis cache hit ratio ≥ 60% on Class C/D. min-instances=1 in prod. Async-safety lint enforced.

### T-4.1 — Redis cache facade adoption *(R5.1)*
- Implement `app/services/cache.py` per design §3.2.
- Adopt on the 20 highest-traffic GETs identified in T-0.7's dashboard.
- **Acceptance:** Cache-hit metric exceeds 60% in steady state; p95 latency drops on those routes (numbers in `audit/baselines/P4-exit.md`).
- **Effort:** 5 days (route-by-route). **Owner:** BE.

### T-4.2 — Async-safety lint *(R5.4)*
- Write a small `ast`-based pre-commit hook `tools/lint/async_safety.py` that scans `app/api/` for sync Firestore calls inside `async def`.
- Wire to `pre-commit` and CI.
- **Acceptance:** Hook fails on a contrived `async def` containing `firestore.client().collection(...).get()` without await/threadpool.
- **Effort:** 2 days. **Owner:** BE.

### T-4.3 — Firestore client → async + threadpool fallback *(R5.4)*
- Audit existing Firestore call sites; convert sync calls to `await run_in_threadpool(...)` or migrate to the native async client where available.
- **Acceptance:** Async-safety lint passes; event-loop blocking metric (collected via OTel) shows < 5ms per request p95.
- **Effort:** 5 days. **Owner:** BE.

### T-4.4 — Redis-backed rate limiter *(R5.5)*
- Implement `app/middleware/rate_limit.py` per design §3.8.
- Per-route decorators on the 30 highest-traffic endpoints.
- **Acceptance:** Verified by k6 burst test against `/api/items` returning 429 after 600/min per tenant.
- **Effort:** 2 days. **Owner:** BE.

### T-4.5 — Cloud Run hardening *(R5.6, R5.7)*
- Update `deploy-cloudrun.yml` to set min-instances=1, max=20, CPU always allocated, gen2 execution env.
- Switch region to `me-central1` (confirm in tandem with phase-5-platform-devops spec already in flight).
- **Acceptance:** Cold-start p95 ≤ 2s confirmed via a synthetic probe; min-instances=1 confirmed in `gcloud run services describe`.
- **Effort:** 1.5 days. **Owner:** DevOps.

### T-4.6 — Firestore index audit *(R5.2)*
- Write `scripts/audit-firestore-queries.py` that parses query builders.
- Cross-reference against `firestore.indexes.json`; report misses.
- Add the missing indexes; deploy via `deploy-firestore.yml`.
- **Acceptance:** No query in code lacks a matching index; CI script passes.
- **Effort:** 3 days. **Owner:** BE.

### T-4.7 — Blue/green deploy *(R10.3)*
- Implement traffic-shift script in `scripts/deploy-bluegreen.sh`.
- Wire into `deploy-cloudrun.yml`: deploy candidate at 0% → 1% for 5 minutes → 100% if 5xx < 0.5% else automatic rollback.
- **Acceptance:** A deliberately-broken canary triggers rollback within 6 minutes; alerts fire.
- **Effort:** 3 days. **Owner:** DevOps.

### T-4.8 — Backend SLO dashboards finalized *(R5, R6.6)*
- Cross-check Dashboard 1 (API SLOs) against the post-P4 traffic; if any class is yellow/red, file a follow-up ticket.
- **Acceptance:** All 5 endpoint classes green at p95 over 7-day window.
- **Effort:** 1 day. **Owner:** DevOps + BE.

---

## Phase P5 — Settings monolith + i18n completion + RTL polish (Weeks 20–23)

> **Exit criteria:** No file > 600 LOC. Arabic at 100% key coverage. Per-namespace i18n bundles. Top-30 RTL routes pass screenshot diff.

### T-5.1 — Settings shell + section registry *(R8.1, R8.3)*
- Build `SettingsShell.tsx` + `sections.registry.ts` per design §1.9.
- Empty registry initially — sections still render from `bodies.tsx`.
- **Acceptance:** `/settings` route renders unchanged; registry mechanism unit-tested.
- **Effort:** 2 days. **Owner:** FE.

### T-5.2 — Decompose `bodies.tsx` section by section *(R8.1)*
- 32 sections × ~1 day each = 32 days of work. Parallelize where possible.
- Each section PR: extract files; wire to registry; delete old code from `bodies.tsx`; add a `React.memo` wrapper and stable callbacks.
- **Acceptance:** Each section PR passes regression tests for that section.
- **Effort:** 32 days (parallel-friendly). **Owner:** FE.

### T-5.3 — `bodies.tsx` deletion + LOC gate *(R8.1, R8.4)*
- Once all sections extracted, delete the file.
- Turn on `scripts/audit-loc.mjs` gate (600 LOC blocking).
- **Acceptance:** File gone; gate green; the next-largest file is known and tracked.
- **Effort:** 0.5 days. **Owner:** FE.

### T-5.4 — i18n split per namespace *(R9.2, R9.3)*
- Write `scripts/i18n-split.mjs`: ingests `frontend/src/locales/<lang>.json` and emits `public/locales/<lang>/<ns>.json`.
- Reorganize keys into namespaces: `common`, `auth`, `sales`, `purchases`, `inventory`, `pos`, `hr`, `payroll`, `settings`, `reports`, `ext-*`.
- Configure i18next to load only `common` at boot; per-route `useTranslation(ns)` triggers namespace fetch.
- **Acceptance:** Shell bundle drops by the Kurdish JSON size minus the `common` slice (typically 70%+ reduction in i18n payload on first paint).
- **Effort:** 4 days. **Owner:** FE.

### T-5.5 — Arabic translation to 100% *(R9.1)*
- Decide via OQ-5: in-house / contractor / LLM-assisted with human review.
- Run `i18n:coverage` after each batch; target 100% by phase end.
- **Acceptance:** Coverage script reports 100%; spot-check by an Arabic-native speaker.
- **Effort:** 8 days (variable by sourcing). **Owner:** Translator + FE for plumbing.

### T-5.6 — RTL screenshot-diff Playwright suite *(R9.4)*
- Playwright spec `e2e/rtl-snapshots.spec.ts` covering top 30 routes in Arabic and Kurdish.
- Baselines committed; diff threshold tuned per route.
- **Acceptance:** Suite runs in CI; baselines updated through a `pnpm playwright test --update-snapshots` step in a manual workflow.
- **Effort:** 3 days. **Owner:** QA + FE.

### T-5.7 — Locale-aware number/currency formatting *(R9.5)*
- New `formatCurrency(value, currency, locale)` helper with rules: IQD → no decimals + Arabic suffix; USD → 2 decimals + `$`; pluggable for new currencies.
- Replace ad-hoc formatting across the app (estimated 80 call sites).
- **Acceptance:** Unit tests pass; visual review on `/invoices` and `/pos` for IQD shows correct format.
- **Effort:** 2 days. **Owner:** FE.

---

## Phase P6 — DevOps, security, mobile, load-test, DR drill (Weeks 24–28)

> **Exit criteria:** CSP enforced. WIF replaces JSON keys. Mobile wrapper installs on Android + iOS. k6 load passes SLOs. DR drill executes cleanly.

### T-6.1 — CSP report-only → enforced *(R7.4)*
- Add CSP header at the Vercel edge (or via meta tag fallback) per design §5.1.
- Report-only first; collect violations at `/api/csp-report` for 14 days.
- Fix violations (most likely: inline styles in Ant Design — solved by nonce-based dynamic loader).
- Switch to `Content-Security-Policy` (enforcing) header.
- **Acceptance:** Zero CSP violations in production for 7 days post-enforcement.
- **Effort:** 4 days. **Owner:** FE + DevOps.

### T-6.2 — Workload Identity Federation *(R7.6)*
- Configure GH-OIDC provider in GCP IAM.
- Replace every GH Actions JSON-key secret with the OIDC `google-github-actions/auth@v2` token exchange.
- Rotate and remove any existing service-account JSON keys from the repo and from GH secrets.
- **Acceptance:** No JSON key in repo; deploys succeed via WIF; audit log shows token exchange.
- **Effort:** 3 days. **Owner:** DevOps.

### T-6.3 — Secret rotation policy and tooling *(R10.7)*
- Document the policy in `docs/security/secret-rotation.md`.
- Implement `scripts/rotate-secret.sh` that rotates `SECRET_KEY` via Secret Manager versioning.
- **Acceptance:** Dry-run rotation succeeds in staging; calendar reminder scheduled.
- **Effort:** 1.5 days. **Owner:** DevOps.

### T-6.4 — PII export + delete *(R7.7)*
- `/api/admin/export?tenant_id=` and `/api/admin/delete?tenant_id=` per design §5.4.
- Backed by an APScheduler job for the 30-day grace.
- **Acceptance:** Export download works for a test tenant; delete soft-marks then a 30-day-shifted clock test confirms hard delete.
- **Effort:** 3 days. **Owner:** BE.

### T-6.5 — Capacitor wrapper for mobile *(R12)*
- Initialize `mobile/` workspace; configure Capacitor with iOS + Android targets.
- Bridge plugins: BT printer, scanner, NFC, filesystem.
- Reuse `frontend/` build directly.
- **Acceptance:** Debug builds install and open on a Pixel 6 (Android) and an iPhone 12 (iOS); login + POS sale completes.
- **Effort:** 6 days. **Owner:** FE + 1 mobile contributor.

### T-6.6 — Google Play pre-launch *(R12.3)*
- Submit Android internal track build to Play Console.
- Address pre-launch report findings (typically: deprecated APIs, missing target SDK, a11y labels).
- **Acceptance:** Zero crashes across the top 12 device classes in the pre-launch report.
- **Effort:** 4 days. **Owner:** Mobile contributor.

### T-6.7 — k6 load test of top 20 endpoints *(R13.4)*
- Build `load/k6-suite/` with one script per critical endpoint family.
- Schedule a nightly run via GH Actions targeting staging.
- Results land in BigQuery `load_runs`; weekly trend report in `#perf`.
- **Acceptance:** Suite passes thresholds matching R5 for 7 consecutive nights.
- **Effort:** 4 days. **Owner:** BE + DevOps.

### T-6.8 — Disaster-recovery quarterly drill *(R10.6)*
- Update `DISASTER_RECOVERY.md` with current procedures (Firestore restore, Cloud Run rollback, secret rotation, DNS failover).
- Execute the drill on a staging clone; time each step; identify gaps.
- **Acceptance:** Drill completes within the documented RTO (target: 1 hour for full service); learnings filed in `audit/dr/2026-Q3-drill.md`.
- **Effort:** 2 days (drill day) + 1 day prep. **Owner:** Tech lead + DevOps.

### T-6.9 — Test coverage gates flipped on *(R13.1)*
- Configure c8 thresholds (FE 70%, BE 80%) in CI.
- Write tests where missing (~ 6 weeks of work historically, but with prior phases already lifting coverage incidentally).
- **Acceptance:** CI green at the threshold; coverage badge on README updated.
- **Effort:** estimated 10 days additional. **Owner:** All engineers (rotating).

---

## Cross-cutting tasks (run continuously across phases)

### T-X.1 — Architecture Decision Records *(R14.5)*
- Each major decision lands as an ADR under `docs/adr/` (template in `docs/adr/0000-template.md`).
- Minimum: ADR-001 Firestore, ADR-002 Workbox SW, ADR-003 Capacitor, ADR-004 Vercel edge, ADR-005 OTel, ADR-006 Min-instances=1, ADR-007 Persistent RQ cache, ADR-008 CRDT-like POS merge, ADR-009 BigQuery RUM, ADR-010 npm workspaces.
- **Owner:** Tech lead.

### T-X.2 — Runbooks *(R14.4)*
- Each new operational concern gets a runbook under `docs/runbooks/`.
- Mandatory ones: `pos-offline-drill.md`, `chunk-load-failure.md`, `slow-firestore-read.md`, `redis-down.md`, `cold-start-spike.md`, `cwv-regression.md`.
- **Owner:** Whoever lands the feature writes the runbook.

### T-X.3 — Onboarding doc *(R14.3)*
- Maintain `docs/onboarding/new-developer.md` such that a new joiner reaches "first PR merged" in ≤ 1 day.
- Quarterly: ask the most-recent joiner to redo the doc against reality.
- **Owner:** Tech lead.

### T-X.4 — Weekly review of dashboards
- Every Monday: 30-minute team review of the 6 baseline dashboards.
- Anything regressing → opens a follow-up ticket.
- **Owner:** Rotating.

---

## Decision tasks (Open Questions in design §12)

| OQ | Question | Decision needed by | Owner |
|----|----------|---------------------|-------|
| OQ-1 | KDS local relay: officially supported or best-effort? | Start of P3 | Tech lead |
| OQ-2 | CSP nonce: server vs edge vs build-time inline? | Start of P6 | FE + DevOps |
| OQ-3 | WIF maintenance window for cutover | Mid-P6 | DevOps |
| OQ-4 | PWA install prompts: enabled by default or admin toggle? | Start of P3 | Tech lead + Product |
| OQ-5 | Arabic translation source (in-house / contractor / LLM-assisted) | Start of P5 | Tech lead + Product |

Each OQ has a 1-week resolution SLA; if unanswered, the more conservative default ships and a follow-up ticket is opened.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Settings decomposition (T-5.2) introduces regressions in obscure sections | Medium | Medium | Section-by-section PRs, feature flag rollback per section, screenshot diff for each. |
| Capacitor printer plugin support varies across printer brands | High | High | Test matrix early in P6; vendor Bluetooth fallback per brand; documented compatibility table in `docs/pos/printers.md`. |
| Firestore index audit (T-4.6) reveals expensive missing indexes that take hours to backfill on production | Medium | High | Schedule index deploys outside business hours; document the procedure; communicate with affected tenants. |
| RUM data volume exceeds BigQuery free tier | Medium | Low | Sampling rules per R6.1; quota alert; downsample to daily aggregates after 30 days. |
| 24-hour offline drill (T-3.11) surfaces data-integrity bugs late | Low | High | Property-based tests for cart merge run earlier in T-3.9; smaller drills (1h, 8h) before the 24h one. |
| min-instances=1 cost surprises | Low | Low | Set a billing alert at $200/mo; cost is modeled at $30-50/mo. |
| Arabic translator capacity (T-5.5) | Medium | Medium | Pre-arrange sourcing in P4; LLM-assist as a backstop. |
| Workbox + Ant Design CSS specificity conflicts during SW shell precache | Medium | Low | Verify in dev with SW enabled from week 11; document any quirks. |
| Blue/green soak (T-4.7) traffic split causes session-affinity oddities | Low | Medium | Cloud Run is stateless; verify; document. |
| CSP enforcement breaks third-party widgets (Firebase Auth UI, GTM) | High | Medium | Report-only window catches this; explicit allowlist + nonce strategy. |

---

## Success metrics — the contract restated

At end of P6, the following must be true on production traffic over a 28-day rolling window:

| Metric | Target | Status |
|--------|--------|--------|
| LCP p75 (mobile 4G) | ≤ 2.0s | ☐ |
| INP p75 | ≤ 150ms | ☐ |
| CLS p75 | ≤ 0.05 | ☐ |
| App shell bundle, gz | ≤ 350 KB | ☐ |
| API p95, list reads | ≤ 300ms | ☐ |
| API p95, POS checkout | ≤ 400ms | ☐ |
| POS receipt print p95 | ≤ 200ms | ☐ |
| Availability | ≥ 99.5% | ☐ |
| Test coverage, FE | ≥ 70% | ☐ |
| Test coverage, BE | ≥ 80% | ☐ |
| Largest single file | ≤ 600 LOC | ☐ |
| Arabic i18n coverage | 100% | ☐ |
| LHCI Performance, mobile | ≥ 90 | ☐ |
| Cold-start p95 | ≤ 2s | ☐ |
| Quarterly DR drill | Pass | ☐ |
| CSP violations / week | 0 | ☐ |

Tick boxes get filled in at exit reviews. Anything not ticked at P6 exit becomes the first task of the follow-on spec.

---

## How to use this document

1. **At sprint planning:** Pick 1–3 tasks from the current phase. Each task is sized to fit in 1–5 working days for one engineer.
2. **At PR review:** Cite the task ID in the PR description. Reviewer verifies acceptance criteria.
3. **At phase exit:** Tech lead runs the exit-criteria check, updates `audit/baselines/Px-exit.md`, opens follow-ups for anything missed.
4. **When a new requirement appears:** Add it to `requirements.md` first, then update `design.md` and `tasks.md` together. Never let one drift from the others.

---

## Companion documents

- `requirements.md` — the *what* and the *why*.
- `design.md` — the *how* (architecture).
- This file (`tasks.md`) — the *when* and the *who*.
- `audit/baselines/` — measured state at each phase boundary.
- `docs/adr/` — decisions, with their rejected alternatives.
- `docs/runbooks/` — operational playbooks.

When in doubt, re-read `requirements.md`. Every task here exists to satisfy a requirement there.
