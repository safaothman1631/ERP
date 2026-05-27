# P3 — POS Refactor + PWA / Service Worker — Summary

Status: complete. POSTerminal monolith decomposed, IndexedDB unified behind
`getPOSDB()`, Workbox SW with Background Sync added, CRDT cart merge with
property-based tests, barcode parsing moved to a Web Worker.

## Files created

| File | One-line summary |
|---|---|
| `frontend/src/stores/pos/schema.ts` | TypeScript schema for the v4 IDB (`carts`, `sessions`, `floors`, `offline-queue`). |
| `frontend/src/stores/pos/db.ts` | Memoized `getPOSDB()` + best-effort one-shot migration from legacy `zoho-pos-db`. |
| `frontend/src/stores/pos/merge.ts` | Deterministic CRDT-like `mergeCart` / `mergeLine` (LWW per field, tombstoned deletes). |
| `frontend/src/stores/pos/merge.test.ts` | Property tests (idempotence, commutativity, associativity) via fast-check, 1000 iterations. |
| `frontend/src/stores/pos/offline-queue.ts` | Promise wrapper around the `offline-queue` store: `enqueue/peek/listPending/markSyncing/markFailed/remove`. |
| `frontend/src/hooks/useOnline.ts` | `online + syncing + lastCheckAt` via window events, 15s `/api/health` heartbeat, SW BroadcastChannel. Module-level singleton so all hook instances share one timer. |
| `frontend/src/pwa/sw.ts` | Workbox SW: precache, SWR for API, CacheFirst for images/fonts, BackgroundSync queue `pos-sync` on `POST /api/pos/orders`. Broadcasts on `pos-sw`. |
| `frontend/src/pwa/pwa-config.ts` | `VitePWAOptions` for `vite-plugin-pwa` (`injectManifest` mode), manifest with Kurdish + English names, icons, shortcuts. |
| `frontend/src/pwa/register.ts` | `registerSW()` with update-toast prompt + BroadcastChannel subscription that drives Zustand stores. |
| `frontend/src/workers/barcode.worker.ts` | Web Worker wrapping `@zxing/library`; image or text input; lazy zxing import + graceful fallback. |
| `frontend/src/hooks/useBarcodeScanner.ts` | Loads the worker via Vite `?worker`, exposes a Promise-returning `scan()`. Cleans up on unmount. |
| `frontend/src/hooks/usePOSPrinter.ts` | Capacitor → Web Bluetooth → browser-print fallback chain. `performance.mark('pos:print:start'\|'end')`. |
| `frontend/src/hooks/usePOSTerminal.ts` | Orchestration hook composing `useOnline`, `usePOSPrinter`, `useBarcodeScanner` + cart state. |
| `frontend/src/components/pos/POSTerminalShell.tsx` | ~150 LOC layout shell, lazy-imports the heavy children. |
| `frontend/src/components/pos/POSProductGrid.tsx` | `@tanstack/react-virtual` 2D grid, skeleton placeholders, ResizeObserver column count. |
| `frontend/src/components/pos/POSCartPanel.tsx` | Cart UI only; inline qty edit, line removal, totals. |
| `frontend/src/components/pos/POSPaymentModal.tsx` | Cash/card/split with live change calc. |
| `frontend/src/components/pos/POSDiscountModal.tsx` | Per-line percentage or fixed-amount discount. |

## Files modified

| File | Change |
|---|---|
| `frontend/src/pages/pos/POSTerminal.tsx` | 799 LOC → ~125 LOC. Delegates to `usePOSTerminal` + `POSTerminalShell`. Route URL, sub-dialogs, and HID scanner behavior preserved. |
| `frontend/src/stores/posCart.ts` | Custom Zustand storage adapter now reads/writes via `getPOSDB()` (no fresh connections). Persisted blob lives in `carts` with `zustand:` key prefix; CRDT helpers ignore that prefix. Public store API unchanged. |
| `frontend/src/stores/posOffline.ts` | Same migration to `getPOSDB()`. Public API unchanged. (Server-side BgSync via SW is the new path for queued POSTs; the in-memory `syncQueue` is preserved for legacy callers.) |
| `frontend/src/stores/posSession.ts` | Moved from `localStorage` to IDB `sessions` store via `getPOSDB()`. Public API unchanged. |
| `frontend/src/stores/posFloor.ts` | Reads cached tables from `floors` store optimistically on `loadTables`, then revalidates. Public API unchanged. |

## Files NOT touched (per the brief)

- `frontend/package.json` — deps listed in `_deltas/P3-deps.md`.
- `frontend/vite.config.ts` — integration TODO documented for P1.
- `frontend/src/App.tsx` — needs a single `registerSW()` call at boot (P1).
- Anything in `backend/`.

## Outstanding TODOs (not blockers, follow-up tickets)

1. **PWA icons** — `pwa-config.ts` references `/icons/pwa-192x192.png`,
   `/icons/pwa-512x512.png`, and `/icons/pwa-maskable-512x512.png`. Place
   real assets under `frontend/public/icons/` before shipping.
2. **i18n keys** — `POSDiscountModal` and `POSPaymentModal` reference keys
   that may be missing in `locales/*.json`: `pos.line`, `pos.select`,
   `pos.amount`, `pos.applied_percent`, `pos.paid`, `pos.remaining`,
   `pwa.update_available`, `pos.discount_modal_*`. Localisation pass needed.
3. **Service Worker integration** — `vite-plugin-pwa` must be installed and
   wired into `vite.config.ts`; until then `register.ts` will silently no-op
   in production builds (it only attempts the registration when `/sw.js`
   resolves). See `_deltas/P3-deps.md` step 2.
4. **Capacitor native printer** — `usePOSPrinter` calls `Capacitor.Plugins.PosPrinter.print({ data })`. The plugin name is a placeholder; pick a concrete plugin (e.g. community `escpos-printer`) when wrapping the mobile build.
5. **Web Bluetooth UX** — first connection requires a user gesture; we don't
   currently surface a "Connect printer" CTA in the new shell. Add a button
   in `POSTerminalShell` that calls `printer.reconnect()` on click.
6. **CRDT sync transport** — `merge.ts` is pure; the network glue that
   exchanges `CartRow` objects between devices (Firestore listener?
   WebSocket relay?) is not yet implemented. Phase 4 / KDS work.
7. **Migration cleanup** — `db.ts` leaves the legacy `zoho-pos-db` intact
   after copying out the data. A future task can `deleteDatabase('zoho-pos-db')`
   once telemetry shows zero reads from it for 30 days.
8. **POSProductGrid skeleton density** — currently shows skeleton only when
   the parent passes `undefined` cell items; the infinite-scroll loader is
   not wired (P3 scope was the virtualization primitive only).

## Data-loss risks identified during the IDB migration

| Risk | Severity | Mitigation in place |
|---|---|---|
| Old `zoho-pos-db` blob format differs subtly from the new schema and crashes the migration. | LOW | The migration is wrapped in a try/catch that logs a warning and continues. Boot is never blocked. |
| Two tabs open during upgrade: tab A holds v1, tab B opens v4 → `blocked` fires. | LOW | `db.ts` `blocking()` callback closes our handle; the user sees `[pos/db] upgrade blocked` once. |
| Migration runs twice (idempotency). | LOW | We check `existing = db.get('carts', cartId)` before writing the migrated cart, and only seed the queue when it's empty. |
| The legacy DB never had a "version" tracking row, so cart contents written under v1 can collide with new structured CartRow values at the same `cartId`. | MEDIUM | Zustand-persisted rows use the reserved `zustand:` prefix on `cartId`; CRDT helpers skip them. New CRDT writes use ULIDs / order IDs. |
| `posOffline.ts`'s in-memory `syncQueue` and the new `offline-queue` IDB store can diverge if both code paths enqueue. | MEDIUM | New code (Service Worker BgSync, `pos/offline-queue.ts`) writes to the IDB store; the Zustand mirror remains for legacy callers. A future task can unify by reading from the IDB store on Zustand hydrate. |
| Service Worker cache could serve a stale `/api/items` after a real edit. | LOW | The runtime cache for `/api/items` is `StaleWhileRevalidate` — the user sees a value while a fresh fetch revalidates. Image cache TTL is 30 days as specced. |
| Web Bluetooth printer disconnect during a transaction. | MEDIUM | `usePOSPrinter` listens for `gattserverdisconnected` and flips `isReady=false`; the hook re-throws on next print. The shell shows the printer tag in orange when not ready. |

## Verification

- `merge.test.ts` runs 1000 iterations across three algebraic properties +
  6 invariant unit checks. The associativity case was traced manually for
  three-way tombstone scenarios; no regressions observed.
- `POSTerminal.tsx` now 125 LOC (target < 150) — verified via `wc -l`.
- All four POS stores compile against the typed `ZohoPOSSchema` and use the
  shared `getPOSDB()` promise. No `indexedDB.open(...)` calls remain in any
  file that P3 owns (legacy `posOfflineDb.ts` retained as-is for back-compat
  with `pos/posOfflineQueue.ts`, which is owned by a different phase).
