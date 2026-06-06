/// <reference lib="webworker" />
/**
 * Workbox-based Service Worker for the Zoho ERP PWA.
 *
 * Built and injected by `vite-plugin-pwa` with `strategies: 'injectManifest'`
 * (set in pwa-config.ts). The `self.__WB_MANIFEST` placeholder is replaced
 * at build time with the actual precache manifest by Vite.
 *
 * Runtime caching rules follow design.md §2.3:
 *
 *   - `\/api\/(items|categories|customers|tax|currencies)$`
 *       → StaleWhileRevalidate, 1-day TTL
 *   - `\/static\/.*\.(woff2|js|css)$`
 *       → CacheFirst, 1-year TTL
 *   - Images
 *       → CacheFirst, 30-day TTL, 200-entry cap
 *
 * Background Sync queue `pos-sync` is attached to `POST /api/pos/orders`.
 * When a sync event fires we broadcast `{ type: 'sync', status }` on the
 * BroadcastChannel `pos-sw` so the main thread can update the offline pill.
 *
 * Cache version constant is bumped manually when the runtime cache schema
 * changes — `activate` then wipes any cache whose name doesn't start with
 * `CACHE_PREFIX-<version>`.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import {
  CacheFirst,
  NetworkOnly,
  StaleWhileRevalidate,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ---------------------------------------------------------------------------
// Versioning — bump on any cache-schema change.
// ---------------------------------------------------------------------------
const CACHE_VERSION = 'v1';
const CACHE_PREFIX = 'zoho-pos';
const CACHE_NAMES = {
  api: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
  static: `${CACHE_PREFIX}-static-${CACHE_VERSION}`,
  images: `${CACHE_PREFIX}-images-${CACHE_VERSION}`,
};

// ---------------------------------------------------------------------------
// Precache app shell — manifest injected at build time by vite-plugin-pwa.
// ---------------------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// SPA navigation — serve the precached index.html shell for any in-app route
// so DIRECT loads, refreshes and bookmarks of client routes (e.g. /signup,
// /login, /forgot-password) resolve to the SPA instead of erroring.
//
// NavigationRoute's first argument must be a HANDLER that returns a Response —
// `createHandlerBoundToURL('index.html')` serves the precached shell. (The
// previous code passed a boolean-returning matcher as the handler, so every
// navigation that wasn't already precached — i.e. every route except `/` —
// failed to produce a Response and the browser showed an error page.)
//
// `denylist` keeps `/api/*` (and the SW/manifest itself) on the network rather
// than being rewritten to the SPA shell.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /^\/sw\.js$/, /^\/manifest\.webmanifest$/],
  }),
);

// ---------------------------------------------------------------------------
// API GET cache — Class C / D reference data.
// ---------------------------------------------------------------------------
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    /\/api\/(items|categories|customers|tax|currencies)(?:$|\?)/.test(url.pathname + url.search),
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.api,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60, // 1 day
        maxEntries: 200,
      }),
    ],
  }),
);

// ---------------------------------------------------------------------------
// Static assets — JS/CSS/font CacheFirst, 1 year.
// ---------------------------------------------------------------------------
registerRoute(
  ({ url, request }) =>
    request.destination === 'font' ||
    /\/static\/.*\.(?:woff2|js|css)$/.test(url.pathname) ||
    /\.(?:woff2|woff|ttf)$/.test(url.pathname),
  new CacheFirst({
    cacheName: CACHE_NAMES.static,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        maxEntries: 60,
      }),
    ],
  }),
);

// ---------------------------------------------------------------------------
// Images — CacheFirst, 30 days, 200 cap.
// ---------------------------------------------------------------------------
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: CACHE_NAMES.images,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        maxEntries: 200,
      }),
    ],
  }),
);

// ---------------------------------------------------------------------------
// Background Sync — POS order POSTs.
// ---------------------------------------------------------------------------
const posSyncPlugin = new BackgroundSyncPlugin('pos-sync', {
  maxRetentionTime: 24 * 60, // minutes — 24 hours
  onSync: async ({ queue }) => {
    broadcast({ type: 'sync-start' });
    let entry;
    let allOk = true;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch (err) {
        allOk = false;
        // Put back at the head and re-throw so Workbox keeps the
        // BgSync registered for the next event.
        await queue.unshiftRequest(entry);
        broadcast({ type: 'sync', status: 'fail' });
        throw err;
      }
    }
    broadcast({ type: 'sync', status: allOk ? 'success' : 'fail' });
  },
});

registerRoute(
  ({ url, request }) =>
    request.method === 'POST' && /\/api\/pos\/orders(?:$|\/)/.test(url.pathname),
  new NetworkOnly({ plugins: [posSyncPlugin] }),
  'POST',
);

// ---------------------------------------------------------------------------
// BroadcastChannel — keeps the main thread informed of SW lifecycle.
// ---------------------------------------------------------------------------
let channel: BroadcastChannel | null = null;
function broadcast(msg: unknown): void {
  if (typeof BroadcastChannel === 'undefined') return;
  if (!channel) {
    try {
      channel = new BroadcastChannel('pos-sw');
    } catch {
      return;
    }
  }
  try {
    channel.postMessage(msg);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Lifecycle — wipe stale caches on activate.
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const expected = new Set(Object.values(CACHE_NAMES));
    const allCaches = await caches.keys();
    await Promise.all(
      allCaches
        .filter((name) => name.startsWith(`${CACHE_PREFIX}-`) && !expected.has(name))
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
    broadcast({ type: 'sw-activated', version: CACHE_VERSION });
  })());
});

self.addEventListener('install', (event) => {
  // Apply updates immediately on the next refresh.
  event.waitUntil(self.skipWaiting());
});

// Allow the main thread to ask the SW to skipWaiting() — useful when a new
// version is detected and the user accepts the update prompt.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
