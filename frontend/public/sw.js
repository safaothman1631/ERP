// Minimal app-shell service worker for offline support.
const CACHE = 'erp-v3';
const APP_SHELL = ['/favicon.svg', '/manifest.webmanifest'];
const STALE_CHUNK_RELOAD_KEY = 'zoho:stale-chunk-reload';

const isScriptAsset = (url) => url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js');

const offlineResponse = (message, contentType = 'text/plain') => new Response(message, {
  status: 503,
  statusText: 'Offline',
  headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
});

const staleChunkResponse = () => new Response(`
const key = '${STALE_CHUNK_RELOAD_KEY}';
try {
  const lastReload = Number(sessionStorage.getItem(key) || '0');
  if (Date.now() - lastReload > 30000) {
    sessionStorage.setItem(key, String(Date.now()));
    const reload = () => globalThis.location.reload();
    if ('caches' in globalThis) {
      caches.keys()
        .then((keys) => Promise.all(keys.filter((name) => name.startsWith('erp-')).map((name) => caches.delete(name))))
        .finally(reload);
    } else {
      reload();
    }
  }
} catch (_) {
  globalThis.location.reload();
}
export default function StaleChunkReload() { return null; }
`, {
  status: 200,
  headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' },
});

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Let the browser handle external assets (Google Fonts, Analytics, etc.).
  // If the service worker fetches them, CSP treats them as connect-src.
  if (url.origin !== self.location.origin) return;

  // Cache items catalog for POS offline product grid
  if (
    event.request.method === 'GET' &&
    url.pathname === '/api/items' &&
    (event.request.referrer || '').includes('/pos')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(event.request)) || offlineResponse('Offline'))
    );
    return;
  }

  // Bypass API and non-GET
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // Network-first for HTML; cache-first for immutable assets.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(async () => (await caches.match('/index.html')) || offlineResponse('Offline', 'text/html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.status === 404 && isScriptAsset(url)) {
          return staleChunkResponse();
        }
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      }).catch(async () => (await caches.match(event.request)) || (isScriptAsset(url) ? staleChunkResponse() : offlineResponse('Offline')));
    })
  );
});
