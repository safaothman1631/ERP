# Design Document: World-Class Performance & Architecture

> **Spec ID:** `world-class-performance`
> **Companion to:** `requirements.md`
> **Status:** Draft v1.0
> **Owner:** Safa Othman

## Introduction

This document is the **technical blueprint** that satisfies the requirements. It is opinionated — every choice is named, justified, and tied to a requirement ID (e.g., `R1.1`). Where a trade-off exists, the alternative considered and rejected is documented inline so future readers know we did think about it.

The shape of the system after this spec lands:

```
   ┌────────────────────────────────────────────────────────────┐
   │  CDN Edge (Vercel / Cloud CDN — me-central1 + global PoPs) │
   │   • Static assets, immutable cache 1y                       │
   │   • Image optimization (AVIF/WebP, srcset, lazy)            │
   │   • Brotli/Gzip, HTTP/3                                     │
   └─────────────────────────────┬───────────────────────────────┘
                                 │
   ┌─────────────────────────────▼───────────────────────────────┐
   │  Browser / PWA                                              │
   │   ├─ Service Worker (Workbox)                               │
   │   │    • Precache shell  • Runtime cache by class           │
   │   │    • Background Sync for POS POSTs                      │
   │   ├─ React 19 app shell (≤350KB gz)                         │
   │   │    • Lazy route chunks (≤80KB each)                     │
   │   │    • React Query + persistent IndexedDB cache           │
   │   │    • Zustand for UI state                               │
   │   │    • i18next, language-split bundles                    │
   │   │    • web-vitals → /api/rum/vitals                       │
   │   └─ IndexedDB (idb wrapper) — POS cart, offline queue      │
   └─────────────────────────────┬───────────────────────────────┘
                                 │  HTTPS, HTTP/2, CSP, HSTS
   ┌─────────────────────────────▼───────────────────────────────┐
   │  Cloud Run — me-central1 (FastAPI, Python 3.11)             │
   │   ├─ Middleware: auth, tenant, rate-limit, OTel, audit      │
   │   ├─ 115 endpoint modules, all async                        │
   │   ├─ Redis cache + rate-limit store                         │
   │   ├─ APScheduler (cron, async jobs)                         │
   │   ├─ Sentry SDK (errors + tracing)                          │
   │   └─ OpenTelemetry SDK → Cloud Trace                        │
   └──────┬───────────────────────────┬──────────────────────────┘
          │                           │
   ┌──────▼──────────┐         ┌─────▼────────┐
   │ Firestore       │         │ Redis         │
   │ (multi-tenant)  │         │ (Memorystore  │
   │  + composite    │         │   or Upstash) │
   │  indexes        │         └───────────────┘
   └─────────────────┘
          │
   ┌──────▼──────────────┐
   │ GCS (backups,       │
   │   user uploads)     │
   └─────────────────────┘
```

---

## 1. Frontend Architecture

### 1.1 Application shell composition (R3.2)

The *always-loaded* code is exactly the union of:

| Module | Reason it must be in the shell |
|--------|-------------------------------|
| `React`, `ReactDOM` | Runtime |
| `react-router-dom` | Routing |
| `@tanstack/react-query` core + persister | Data layer present on every page |
| `zustand` | Auth, navigation, UI state |
| `i18next` + active-language bundle | Text rendering on first paint |
| `App.tsx`, `AppLayout`, `Sidebar`, `TopBar`, `CommandPalette` | Always visible |
| `Dashboard.tsx` (landing) | First route after login |
| `web-vitals` | RUM instrumentation |
| Theme tokens (CSS variables) | Skin |

Everything else — including **all 30+ ext modules, all settings sections, all charts, all PDF generation, all reactflow, all framer-motion-heavy pages** — is lazy.

**Budget guard:** A `scripts/check-shell-size.mjs` runs in CI. It dynamic-imports `App.tsx`, asks Vite/Rollup for the resulting graph, and asserts shell-only chunks total ≤ 350 KB gzipped (R1.5).

### 1.2 Lazy-loading with hardened retry (R3.4, R3.5)

```ts
// src/utils/lazyWithRetry.ts
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  chunkName: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    const delays = [500, 2000, 8000];
    let lastErr: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await importFn();
      } catch (err) {
        lastErr = err;
        if (attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
        }
      }
    }
    captureException(lastErr, { tags: { chunkName } });
    return { default: ChunkLoadErrorFallback as unknown as T };
  });
}
```

The fallback `ChunkLoadErrorFallback` is a tiny component (already in the shell) that shows a localized "Failed to load this page" with a Reload button.

### 1.3 React Query — class-based configuration (R2.x)

```ts
// src/data/queryClasses.ts
export const QUERY_CLASSES = {
  A: { staleTime: 0,             gcTime: 5 * MIN,  refetchInterval: 30 * SEC, refetchOnWindowFocus: true  },
  B: { staleTime: 30 * SEC,      gcTime: 10 * MIN, refetchInterval: false,    refetchOnWindowFocus: true  },
  C: { staleTime: 5 * MIN,       gcTime: 30 * MIN, refetchInterval: false,    refetchOnWindowFocus: false },
  D: { staleTime: 60 * MIN,      gcTime: 24 * HR,  refetchInterval: false,    refetchOnWindowFocus: false },
  E: { staleTime: Infinity,      gcTime: 24 * HR,  refetchInterval: false,    refetchOnWindowFocus: false },
} as const;

export function useClassedQuery<T>(
  key: QueryKey,
  fetchFn: () => Promise<T>,
  queryClass: keyof typeof QUERY_CLASSES,
  extra: Partial<UseQueryOptions<T>> = {},
) {
  return useQuery({ queryKey: key, queryFn: fetchFn, ...QUERY_CLASSES[queryClass], ...extra });
}
```

A custom ESLint rule (`require-query-class`) is added under `tools/eslint-rules/` that flags any `useQuery` or `useInfiniteQuery` call that does not go through `useClassedQuery` or `useCRUD({ queryClass: ... })`.

### 1.4 Persistent cache (R2.5)

```ts
// src/data/persister.ts
import { createIDBPersister } from './idb-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';

persistQueryClient({
  queryClient,
  persister: createIDBPersister('zoho-rq-cache'),
  maxAge: 24 * HR,
  dehydrateOptions: {
    shouldDehydrateQuery: (q) =>
      q.state.status === 'success' &&
      // Don't persist real-time class A — meaningless once stale
      (q.meta?.queryClass !== 'A'),
  },
});
```

This makes returning users feel instantaneous: the prior session's list pages, contact data, and item catalogs paint from IndexedDB while a quiet revalidation runs in the background.

### 1.5 Firestore live subscriptions — time-boxed (R2.6)

`useFirestoreLive` is rewritten to:

- Detach the listener after `IDLE_DETACH_MS = 30 * MIN` of no DOM interaction on the subscribing tree.
- Re-attach on the next mount or focus event.
- Expose `lastSnapshotAt` and `isStale` so callers can render a "data may be stale" hint.
- Track listener count via a global Map; emit a warning at > 25 live listeners (a real cap — Firestore charges per listener-second).

### 1.6 Bundle splitting — refined Vite manualChunks (R3.6)

```ts
// vite.config.ts (excerpt)
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('react/') || id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
    if (id.includes('@tanstack/react-query')) return 'vendor-query';
    if (id.includes('antd/es/icon') || id.includes('@ant-design/icons')) return 'vendor-antd-icons';
    if (id.includes('antd')) return 'vendor-antd-core';
    if (id.includes('recharts')) return 'vendor-charts';
    if (id.includes('framer-motion')) return 'vendor-motion';
    if (id.includes('@firebase/auth'))      return 'vendor-firebase-auth';
    if (id.includes('@firebase/firestore')) return 'vendor-firebase-firestore';
    if (id.includes('@firebase/messaging')) return 'vendor-firebase-messaging';
    if (id.includes('reactflow'))   return 'vendor-flow';
    if (id.includes('react-grid-layout')) return 'vendor-grid';
    if (id.includes('mammoth') || id.includes('xlsx') || id.includes('pdfjs')) return 'vendor-office';
    if (id.includes('i18next')) return 'vendor-i18n';
    return 'vendor';
  }
  if (id.includes('/src/pages/settings/')) return undefined;            // each section lazy
  if (id.includes('/src/pages/modules/moduleConfigs/sections/')) return undefined; // each ext module lazy
}
```

**Bundle analyzer:** `rollup-plugin-visualizer` writes `dist/stats.html` on every build. A GitHub Action compares main-vs-PR sizes (`dawidd6/action-download-artifact` + a 30-line diff script) and posts a sticky PR comment.

### 1.7 Image and font strategy (R11.2, R11.3)

- `vite-imagetools` (or `@vercel/og` for OG images) emits AVIF + WebP + JPG at build, with `srcset` baked into the component via a `<Picture>` wrapper.
- Fonts: only Noto Sans Kurdish + Noto Sans Arabic subsets (Unicode ranges per the kerned glyph audit). One file per weight × language. Preloaded for primary weight.
- All images below the fold get `loading="lazy" decoding="async"`. Above-fold hero images use `fetchpriority="high"`.

### 1.8 i18n bundling strategy (R9.2, R9.3)

Today: i18next-http-backend loads the whole language JSON. The change:

- Translation files are **split per module** at build time by a `scripts/i18n-split.mjs` script that reads `frontend/src/locales/<lang>.json` and outputs `public/locales/<lang>/<namespace>.json`.
- i18next is configured with namespaces; each lazy route declares its `ns` and triggers the namespace fetch.
- The shell ships only the `common` namespace (~ 200 keys) in the active language.

### 1.9 Settings monolith decomposition (R8.x)

```
frontend/src/pages/settings/
├── SettingsShell.tsx           (<150 LOC — layout, lazy section host)
├── sections/
│   ├── general/
│   │   ├── index.tsx           (~300 LOC max)
│   │   ├── CompanyInfo.tsx
│   │   ├── Branding.tsx
│   │   └── Localization.tsx
│   ├── accounts/
│   ├── taxes/
│   ├── users/
│   ├── permissions/
│   ├── integrations/
│   ├── notifications/
│   ├── billing/
│   ├── advanced/
│   └── ...30+ sections
└── sections.registry.ts        (sectionKey → lazy importer)
```

Migration done **section by section** in tasks T-8.1 through T-8.32 — never as one big-bang rewrite (see tasks.md).

---

## 2. POS Subsystem Design

### 2.1 Decomposition map (R4.1)

| New file | Approx LOC | Responsibility |
|----------|-----------|----------------|
| `POSTerminalShell.tsx` | 120 | Layout, slots, route boundary |
| `POSProductGrid.tsx` | 180 | Virtualized grid (TanStack Virtual) |
| `POSCartPanel.tsx` | 200 | Cart UI, line edit |
| `POSPaymentModal.tsx` | 220 | Payment selection, split, change |
| `POSDiscountModal.tsx` | 90 | Discount entry |
| `POSCustomerPanel.tsx` | 140 | Quick customer attach |
| `POSReceiptPreview.tsx` | 110 | Inline preview |
| `usePOSTerminal.ts` | 180 | Orchestration hook |
| `usePOSPrinter.ts` | 120 | Bluetooth / ESC-POS / Web Bluetooth wrapper |

### 2.2 IndexedDB layer (R4.3)

Single module:

```ts
// src/stores/pos/db.ts
import { openDB, IDBPDatabase } from 'idb';
import type { ZohoPOSSchema } from './schema';

let dbPromise: Promise<IDBPDatabase<ZohoPOSSchema>> | null = null;

export function getPOSDB() {
  if (!dbPromise) {
    dbPromise = openDB<ZohoPOSSchema>('zoho-pos', 4, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) db.createObjectStore('carts',    { keyPath: 'cartId' });
        if (oldVersion < 2) db.createObjectStore('sessions', { keyPath: 'sessionId' });
        if (oldVersion < 3) db.createObjectStore('floors',   { keyPath: 'floorId' });
        if (oldVersion < 4) db.createObjectStore('offline-queue', { keyPath: 'id', autoIncrement: true })
                              .createIndex('by-status', 'status');
      },
    });
  }
  return dbPromise;
}
```

Stores import this once, no manual transactions sprinkled around.

### 2.3 Service Worker + offline POS (R4.4, R4.5)

`vite-plugin-pwa` (Workbox under the hood). `sw.ts` registers:

- **Precache** the shell (index.html, vendor-react.js, vendor-query.js, app-shell.css, the POS route chunk).
- **Runtime cache rules**:
  - `\/api\/(items|categories|customers|tax|currencies)$` → `StaleWhileRevalidate`, 1-day TTL (Class C/D).
  - `\/static\/.*\.(woff2|js|css)$` → `CacheFirst`, 1-year TTL.
  - Images → `CacheFirst`, 30-day TTL, max 200 entries.
- **Background Sync**: queue name `pos-sync`. Plugin attached to a `NetworkOnly` rule on `POST /api/pos/orders` so failed posts auto-replay when online.

The UI consumes a `useOnline()` hook (combination of `navigator.onLine` + heartbeat to `/api/health` every 15s). Top-bar pill renders Online / Offline / Syncing.

### 2.4 Multi-device cart merge (R4.6)

Treat each cart line as a row with:

```ts
type CartLine = {
  lineId: string;             // ULID, client-generated
  itemId: string;
  qty: number;
  qtyUpdatedAt: number;       // ms epoch
  qtyUpdatedBy: string;       // deviceId
  deletedAt?: number;
};
```

Merge function (deterministic):

1. Union all `lineId`s from both devices.
2. For each `lineId`: pick the line with the latest `qtyUpdatedAt`; ties broken by lexicographic `deviceId`.
3. If `deletedAt` is set on either side, the line is deleted unless a `qty` edit has a strictly newer `qtyUpdatedAt` (a quantity edit can resurrect a delete only if explicit).

Documented as **CRDT-like** (LWW-element-set + per-field LWW). No Firestore transactions on the hot path; sync is fire-and-eventually-consistent.

### 2.5 Receipt printing (R4.7)

Two backends, decided at runtime:

- **Native print** (Capacitor plugin): preferred — direct ESC/POS over Bluetooth to common receipt printers (Epson TM-T20, Xprinter, Bixolon).
- **Web Bluetooth** fallback for Chrome on Android.

`usePOSPrinter` exposes:

```ts
const { print, isReady, isPrinting, deviceLabel } = usePOSPrinter();
await print(receiptCommands); // returns when buffer flushed
```

Latency budget enforced via `performance.mark('pos:print:start')` and `performance.mark('pos:print:end')`; reported to RUM with the device class.

### 2.6 Barcode worker (R4.9)

A Web Worker wraps `@zxing/library`. The main thread sends image data (from the camera frame or a typed string from a wedge scanner) to the worker and receives parsed barcode + format. No main-thread blocking.

### 2.7 KDS update path (R4.8)

Two-stage:

1. **Primary**: Firestore real-time subscription on `orders/{orderId}/lines`.
2. **Fallback**: if Firestore p50 > 1s for 30s, the KDS opens a WebSocket to a local relay (Bun + Hono on a Raspberry Pi behind the counter) that mirrors order events on the LAN. Configuration is a single env: `POS_LOCAL_RELAY_URL`.

---

## 3. Backend Architecture

### 3.1 Module layout (FastAPI)

```
backend/app/
├── main.py                # FastAPI app, lifespan, middleware wiring
├── config.py
├── deps.py                # auth dep, tenant dep, permission dep, db dep
├── middleware/
│   ├── tenant.py
│   ├── rate_limit.py      # slowapi + Redis store
│   ├── audit.py
│   ├── otel.py            # OpenTelemetry instrumentation
│   └── request_id.py
├── api/                   # 115+ routers
│   ├── invoices.py
│   ├── pos.py
│   └── ...
├── services/              # business logic
│   ├── invoices_service.py
│   ├── pos_service.py
│   ├── cache.py           # Redis facade
│   ├── scheduler.py
│   └── rum_ingest.py      # /api/rum/vitals handler
├── schemas/               # Pydantic models, separated request/response
├── firestore/
│   ├── client.py          # async client (or threadpool wrapper)
│   ├── tx.py              # transaction helpers
│   ├── indexes.json
│   ├── migrations/
│   └── rules.firestore
├── observability/
│   ├── tracing.py
│   ├── logging.py         # python-json-logger formatter
│   └── metrics.py
└── tests/
```

### 3.2 Caching facade (R5.1)

```py
# services/cache.py
from typing import Awaitable, Callable, TypeVar
import json, redis.asyncio as redis

R = TypeVar('R')

class Cache:
    def __init__(self, client: redis.Redis): self.client = client
    async def get_or_set(
        self, key: str, ttl_s: int, fetch: Callable[[], Awaitable[R]],
    ) -> R:
        cached = await self.client.get(key)
        if cached is not None:
            return json.loads(cached)
        value = await fetch()
        await self.client.set(key, json.dumps(value, default=str), ex=ttl_s)
        return value
```

Cache key convention: `{tenant_id}:{resource}:{params_hash}:{schema_version}`. Bumping `schema_version` (constant per resource) invalidates all keys for that resource without TOUCH/SCAN.

### 3.3 Async-safety enforcement (R5.4)

A custom `ruff` rule (or a small `ast`-based pre-commit hook) scans `app/api/` for any call to known-sync Firestore methods inside `async def`. Failure mode: lint error pointing at the line with a suggested `await run_in_threadpool(...)` wrapping.

### 3.4 OpenTelemetry wiring (R6.3)

```py
# observability/tracing.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

def init_tracing(app):
    provider = TracerProvider()
    provider.add_span_processor(BatchSpanProcessor(CloudTraceSpanExporter()))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
```

Custom spans wrap Firestore calls and Redis lookups with attribute hints (`firestore.collection`, `cache.hit`).

### 3.5 RUM ingest (R6.1, R6.2)

`POST /api/rum/vitals` accepts:

```ts
{
  sessionId: string;
  appVersion: string;
  route: string;
  deviceClass: 'mobile-low' | 'mobile-mid' | 'mobile-high' | 'tablet' | 'desktop';
  network: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi';
  metric: 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}
```

Validated via Pydantic, batched via a small in-memory queue, flushed every 5s or 100 events to **BigQuery** (`vitals_raw` table) via the streaming insert API. Materialized view rolls up p50/p75/p95 per (route, device_class, day).

### 3.6 Cloud Run configuration (R5.6, R5.7)

`deploy-cloudrun.yml` produces a service with:

```yaml
cpu: 2
memory: 1Gi
concurrency: 80
min-instances: 1
max-instances: 20
execution-environment: gen2
cpu-throttling: false        # CPU always allocated
ingress: all
session-affinity: false
revisions:
  - traffic: 0
    name: candidate
    soak-minutes: 5
```

Blue/green: `gcloud run services update-traffic` shifts 1% to candidate, watches Cloud Monitoring 5xx for 5 minutes, then 100%. Automatic rollback if 5xx > 0.5% (alert policy + GitHub-issued revert via API).

### 3.7 Firestore indexes & query discipline (R5.2)

Every `where(...).orderBy(...)` combination is mirrored in `firestore.indexes.json`. A quarterly job (`scripts/audit-firestore-queries.py`) reads the code, parses query builders, and asserts that each combination has an index. Missing index → CI fail. Unused indexes pruned.

### 3.8 Rate limiter (R5.5)

```py
# middleware/rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address
import os, redis.asyncio as redis

if os.getenv('REDIS_URL'):
    storage = f"async+{os.getenv('REDIS_URL')}"
else:
    storage = 'memory://'

limiter = Limiter(key_func=lambda r: f"{r.state.tenant_id}:{get_remote_address(r)}", storage_uri=storage)
```

Per-route overrides via decorator: `@limiter.limit("60/minute")` on POST endpoints, `@limiter.limit("600/minute")` on GETs.

---

## 4. Observability & SLOs

### 4.1 Metrics surface

| Metric | Source | Aggregation |
|--------|--------|-------------|
| `http_requests_total{route,status}` | OTel middleware | counter |
| `http_request_duration_ms{route}` | OTel middleware | histogram |
| `firestore_operations_total{collection,op}` | wrapper | counter |
| `firestore_op_duration_ms{collection,op}` | wrapper | histogram |
| `redis_cache_hits_total / misses_total` | cache facade | counter |
| `pos_orders_offline_queued` | client-reported | gauge |
| `pos_orders_synced` | server-side | counter |
| `cwv_lcp_ms{device_class,network}` | RUM ingest | histogram |
| `cwv_inp_ms{device_class,network}` | RUM ingest | histogram |
| `chunk_load_failures_total{chunk}` | Sentry → BigQuery | counter |

### 4.2 Dashboards (R6.6)

One dashboard per concern, each linked from `docs/observability/README.md`:

1. **API SLOs** — p50/p95/p99 per route class, error rate, request rate.
2. **Firestore** — read/write rate, p95 latency, hot collections, listener count.
3. **Cache** — hit ratio per resource, evictions, memory.
4. **POS Ops** — sales/min, offline-queue depth, sync lag, receipt-print latency.
5. **RUM CWV** — LCP/INP/CLS at p50/p75/p95 by region and device class.
6. **Deploys** — deploy events overlaid on the API dashboard for change attribution.

### 4.3 Alerts (R6.7)

| Alert | Trigger | Severity |
|-------|---------|----------|
| API 5xx burn rate 10x budget | 5xx rate > 5% for 5 min | SEV1 — page |
| API p95 > SLO | p95 > 2x target for 15 min | SEV2 — email |
| Firestore quota approaching | > 80% of daily writes | SEV2 |
| Backup not run in 24h | no `backup.success` event | SEV1 |
| Chunk load failure spike | > 10/min for 5 min | SEV3 — Slack |
| LCP p75 regression | > 3.0s for 24h on mobile | SEV3 |

---

## 5. Security & Compliance Design

### 5.1 CSP plan (R7.4)

Stage 1 — Report-only header for 14 days, collecting violations at `/api/csp-report`. Stage 2 — Enforce. Final policy:

```
default-src 'self';
script-src 'self' 'nonce-{N}' https://www.googletagmanager.com;
style-src  'self' 'nonce-{N}';
img-src    'self' data: https://*.gstatic.com https://firebasestorage.googleapis.com;
font-src   'self';
connect-src 'self' https://*.firebaseio.com https://firestore.googleapis.com wss://*;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
report-uri /api/csp-report;
```

### 5.2 Tenant isolation (R7.1)

- Frontend never trusts client-side filters. Every API call has `tenant_id` injected from the auth token (not from a query param).
- Backend's `tenant_dep` reads JWT claim `tenant_id`, sets `request.state.tenant_id`, every Firestore query helper takes it as the first positional arg.
- Firestore rules:
  ```
  match /tenants/{tenantId}/{document=**} {
    allow read, write: if request.auth.token.tenant_id == tenantId;
  }
  ```

### 5.3 Secrets management (R7.6)

- Boot loads from Google Secret Manager via the official client, cached in memory for the process lifetime.
- `.env` only used in dev with placeholder values; CI checks reject any commit containing a high-entropy string in `.env.example`.
- Service accounts replaced by **Workload Identity Federation** (GitHub OIDC → GCP) — no JSON keys in repo or in GH Actions secrets.

### 5.4 PII export & deletion (R7.7)

`/api/admin/export?tenant_id=` produces a zip with all per-tenant docs as JSON. `/api/admin/delete?tenant_id=` schedules a soft-delete (`deleted_at`) on every doc; hard delete after 30 days via a scheduled job. Audit log every call.

---

## 6. Edge & Network Architecture

### 6.1 Vercel + Cloud Run split (R11)

- **Vercel**: hosts the built `frontend/dist`, image optimization, edge functions for `/api/rum/vitals` ingest preprocessing (light validation only, then forwards to Cloud Run).
- **Cloud Run**: hosts the FastAPI backend in `me-central1`.
- Vercel rewrites `/api/*` to the Cloud Run service URL.
- Alternative considered: Cloudflare Pages + Workers. Rejected because Vercel's image optimization and zero-config Brotli are stronger for this app; Workers would force porting RUM ingest to JS.

### 6.2 HTTP/3 (R11.5)

Vercel enables HTTP/3 by default at the edge. Cloud Run terminates at HTTP/2 but the slow path (only API calls) is already small. Documented in `docs/architecture/network.md`.

---

## 7. Mobile Architecture

Capacitor (preferred over Expo because we already have a web build that should be reused 1:1; React Native would mean rewriting Ant Design UI — unacceptable).

```
mobile/
├── capacitor.config.ts
├── ios/
├── android/
├── src/
│   ├── bridge/
│   │   ├── printer.ts        // ESC/POS over BT
│   │   ├── scanner.ts        // ML Kit barcode
│   │   ├── nfc.ts
│   │   └── filesystem.ts
│   └── native-only/
└── package.json              // links to ../frontend as a workspace
```

**Decision: monorepo workspaces** (npm workspaces) — `frontend/`, `mobile/`, `backend/` live as siblings; `mobile/src` re-uses `frontend/src` components.

---

## 8. Testing Architecture

### 8.1 Unit + integration (Vitest)

- Coverage gate: c8 with thresholds (frontend 70%, backend 80%) in CI.
- Tests collocated with code (`Foo.tsx` + `Foo.test.tsx`).
- Worker pool of 4; shard CI matrix into 4 jobs (`--shard=$i/4`).

### 8.2 E2E (Playwright)

- 50 critical journeys (see requirements.md §13.2).
- 3 browsers × 2 viewports = 6 configs; sharded across 3 CI jobs.
- A snapshot diff job runs against the top 30 RTL routes.

### 8.3 Load test (k6)

```js
// load/pos-checkout.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // ramp
    { duration: '10m', target: 50 },  // sustained
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'],
    http_req_failed:   ['rate<0.001'],
  },
};
```

Nightly run against staging; results posted to a `#perf` channel and stored in BigQuery (`load_runs` table) for trend analysis.

---

## 9. Data Model — additions in this spec

### 9.1 RUM raw (BigQuery)

```sql
CREATE TABLE vitals_raw (
  session_id   STRING,
  tenant_id    STRING,
  app_version  STRING,
  route        STRING,
  device_class STRING,
  network      STRING,
  metric       STRING,
  value        FLOAT64,
  rating       STRING,
  ts           TIMESTAMP,
) PARTITION BY DATE(ts);
```

### 9.2 Audit log (Firestore)

`tenants/{tid}/audit_log/{eventId}`:

```ts
{
  ts: Timestamp;
  actorId: string;
  action: string;             // 'invoice.create' | 'user.delete' | ...
  resourceType: string;
  resourceId: string;
  diff?: { before, after };   // for updates
  requestId: string;
  ipHash: string;             // hashed not raw
}
```

### 9.3 Offline queue (IndexedDB, client-side)

```ts
{
  id: number;             // autoIncrement
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: unknown;          // JSON-serializable
  headers: Record<string, string>;
  attempts: number;
  status: 'pending' | 'syncing' | 'failed';
  createdAt: number;
  lastTriedAt?: number;
  lastError?: string;
}
```

---

## 10. Migration Strategy

We do not big-bang. Every change in this design lands behind a feature flag OR as an isolated refactor that ships value on day one (e.g., decomposing a settings section ships a smaller chunk regardless of what else is done).

**Sequencing principle:** *Measure first, optimize second, validate third.* In every phase:

1. **Measure** — add instrumentation, confirm baseline.
2. **Optimize** — implement the change.
3. **Validate** — confirm the SLO moved; if not, revert.

The detailed phase plan lives in `tasks.md`.

---

## 11. Decisions & Trade-offs (mini-ADRs)

| ID | Decision | Rejected alternative | Reason |
|----|----------|---------------------|--------|
| D-001 | Stay on Firestore | Migrate to Postgres + Hasura | Migration cost > 6 months, no clear performance win at our shape, real-time listeners are first-class in Firestore. |
| D-002 | Workbox SW (vite-plugin-pwa) | Hand-rolled SW | Workbox precache/runtime cache battle-tested; we're not in the offline-rendering business. |
| D-003 | TanStack Virtual | react-window | Modern, headless, better TS, works with horizontal grids (POS). |
| D-004 | OpenTelemetry → Cloud Trace | Datadog | Cost; we're already on GCP; CT meets our SLO observability needs. |
| D-005 | Capacitor for mobile | React Native | Reuses 100% of web UI; native plugins available for printer/scanner/NFC. |
| D-006 | Vercel for frontend hosting | Cloud Storage + Cloud CDN | Image optimization + edge functions + DX; cost is acceptable at our scale. |
| D-007 | Persistent React Query cache via IndexedDB | localStorage | localStorage is sync and small; IDB is the right shape. |
| D-008 | min-instances=1 for backend | Scale-to-zero | Cold starts kill p95; the cost ($30-50/mo) is negligible vs UX impact. |
| D-009 | BigQuery for RUM | Firestore aggregation | Analytics queries; cheap streaming insert; we can roll up to Firestore for the UI. |
| D-010 | npm workspaces for monorepo | Nx / Turborepo | Simpler; we have only 3 packages; build caching not yet a pain. |

---

## 12. Open Questions (to resolve before each phase begins)

1. Should the WebSocket KDS relay (R4.8) be officially supported, or only "best effort"? Affects packaging.
2. CSP nonce strategy: server-injected at HTML render, or middleware-rewritten? FastAPI doesn't render HTML in prod (Vercel does) — needs an edge function.
3. Workload Identity Federation requires reorganizing GH Actions secrets — schedule a maintenance window.
4. PWA installability: do we want install prompts on `pos.zoho.local`? Or off by default and admin-toggled?
5. Translation pipeline for Arabic completion: in-house, contractor, or LLM-assisted with human review?

These are tracked as `OQ-1..5` in `tasks.md` as decision tasks gating subsequent work.

---

## 13. References

- Web Vitals: https://web.dev/vitals/
- Workbox: https://developer.chrome.com/docs/workbox/
- TanStack Query persistence: https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
- FastAPI async: https://fastapi.tiangolo.com/async/
- Firestore performance: https://firebase.google.com/docs/firestore/best-practices
- Cloud Run cold starts: https://cloud.google.com/run/docs/configuring/cpu-allocation
- OpenTelemetry on GCP: https://cloud.google.com/trace/docs/setup/python-ot
- CRDT primer: https://crdt.tech/

---

## 14. Out of Design (deferred to follow-on specs)

- Server-side rendering / streaming (current SPA is fine for an authenticated business app).
- GraphQL gateway (REST + React Query meets the need).
- Edge-rendered marketing site (separate landing-auth-vercel-redesign spec already covers it).
- Event-driven architecture / Pub/Sub-backed CQRS (overkill at our scale today).
