# P3 — POS Refactor + PWA / Service Worker — Dependencies

Phase P3 introduces a Service Worker, IndexedDB wrapper, virtualized grid,
and barcode worker. The dependency list below is the set that needs to be
added to `frontend/package.json` by the package-owner phase (P1). P3 does
NOT modify `package.json` itself.

## Runtime (`dependencies`)

| Package | Version (suggested) | Used by | Notes |
|---|---|---|---|
| `idb` | `^8.0.0` | `stores/pos/db.ts`, `stores/pos/offline-queue.ts`, store migrations | Promise-based IDB wrapper. Tiny (~1KB gz). |
| `@tanstack/react-virtual` | `^3.10.0` | `components/pos/POSProductGrid.tsx` | 2D virtualization for the product grid. |
| `workbox-window` | `^7.1.0` | `pwa/register.ts` (optional helper) | Not strictly required; we register manually, but downstream may use it for update toasts. Safe to drop if a smaller footprint is desired. |
| `workbox-precaching` | `^7.1.0` | `pwa/sw.ts` | Precache + cleanup. |
| `workbox-routing` | `^7.1.0` | `pwa/sw.ts` | Route registration. |
| `workbox-strategies` | `^7.1.0` | `pwa/sw.ts` | `CacheFirst`, `StaleWhileRevalidate`, `NetworkOnly`. |
| `workbox-background-sync` | `^7.1.0` | `pwa/sw.ts` | Background Sync plugin for POS POSTs. |
| `workbox-expiration` | `^7.1.0` | `pwa/sw.ts` | TTL + entry caps on runtime caches. |
| `workbox-cacheable-response` | `^7.1.0` | `pwa/sw.ts` | Filter cacheable status codes. |
| `@zxing/library` | `^0.21.0` | `workers/barcode.worker.ts` (lazy `import()`) | Decode barcodes from camera frames. The worker degrades gracefully if missing. |

## Dev / build (`devDependencies`)

| Package | Version | Used by | Notes |
|---|---|---|---|
| `vite-plugin-pwa` | `^0.20.5` | `vite.config.ts` (added by P1) | Reads `pwa-config.ts` and emits the SW. `strategies: 'injectManifest'` configured. |
| `fast-check` | `^3.23.2` | `stores/pos/merge.test.ts` | Already in `devDependencies`. No bump needed. |

## Optional peer

| Package | Version | Used by | Notes |
|---|---|---|---|
| `@capacitor/core` | `^6.x` | `hooks/usePOSPrinter.ts` | Only needed for the native printer backend. Hook detects at runtime via `window.Capacitor`; web-only builds can skip the install. |

## Integration steps for P1 (Vite owner)

1. `npm install` the runtime + dev packages above in `frontend/`.
2. In `vite.config.ts`, import the config and register the plugin:
   ```ts
   import { VitePWA } from 'vite-plugin-pwa';
   import { PWA_CONFIG } from './src/pwa/pwa-config';
   // plugins: [react(), VitePWA(PWA_CONFIG)]
   ```
3. From the app boot (e.g. `main.tsx` or `App.tsx`), call:
   ```ts
   import { registerSW } from './pwa/register';
   void registerSW();
   ```
4. Place PWA icons under `frontend/public/icons/` (192/512/maskable variants).
   Placeholder paths are listed in `pwa-config.ts`.

## Bundle impact estimate (gzipped)

| Chunk | Added bytes | Where |
|---|---|---|
| `idb` | ~1.5 KB | App shell (imported by stores). |
| `@tanstack/react-virtual` | ~4 KB | POS route chunk only. |
| Workbox runtime | 0 KB in app | Bundled into `sw.js` separately. |
| `@zxing/library` | ~120 KB | Worker chunk only — never blocks the main thread. |
