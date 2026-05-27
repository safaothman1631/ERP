# ADR 0002 — Workbox via `vite-plugin-pwa` (do not hand-roll the Service Worker)

| | |
|---|---|
| **Date** | 2026-05-27 |
| **Authors** | Safa Othman |
| **Reviewers** | FE lead |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | design.md §11 (D-002), §2.3 (SW + offline POS); requirements.md §4.4, §4.5 |

## 1. Context

The audit found that the POS subsystem implements offline persistence
via a hand-rolled IndexedDB queue (`stores/posOffline.ts`), but the
app has **no Service Worker (SW)**. Without an SW:

* Network requests are not intercepted; failed POSTs surface as toast
  errors instead of being queued.
* The app shell is not precached; a navigation while offline returns
  the browser's "you are offline" screen.
* Background Sync is unavailable; the queue can only drain while the
  PWA tab is open and the user has the app focused.

The `world-class-performance` spec (R4.4, R4.5) calls for:

* Network interception so any write fails to a queue rather than to the user.
* Precaching of the app shell.
* Background Sync — the queue keeps draining even after the user closes the tab.

The choice is between **Workbox** (Google's SW recipes library,
integrated via the well-maintained `vite-plugin-pwa`) and a
**hand-rolled SW** (~ 200 lines of `caches.put`, `caches.match`,
custom strategies).

## 2. Decision

**We adopt `vite-plugin-pwa` with the Workbox runtime in
`generateSW` mode.** The SW source is generated at build time from a
config in `frontend/vite.config.ts`. Custom logic (the POST
queue/replay) is layered on top via Workbox's `BackgroundSyncPlugin`.

Concrete deliverables:

* `frontend/vite.config.ts` ships a `VitePWA` plugin block.
* Workbox strategy:
  * `NetworkOnly` with `BackgroundSyncPlugin` for `POST /api/pos/*`.
  * `StaleWhileRevalidate` for `/assets/*`, fonts.
  * `NetworkFirst` (5s timeout) for `/api/*` GETs.
  * `CacheFirst` with `expiration` for image URLs.
* App shell precached automatically via the build manifest.
* The SW lives at `/sw.js`. Cache-control headers in `vercel.json`
  force `max-age=0, must-revalidate` on the SW file (so a deploy lands
  on the next user visit, not 30 minutes later).

## 3. Consequences

### Positive

* Battle-tested code: Workbox is shipped on web.dev itself and powers a huge slice of installable PWAs in production.
* Background Sync gets us the §4.5 acceptance: 24-hour offline drill survives a closed tab.
* We don't write `caches.put` / `caches.match` glue ourselves.
* `vite-plugin-pwa` emits the `manifest.webmanifest` for installability (lifecycle hook into Lighthouse PWA assertions).
* Easy to update strategies: change one recipe in `vite.config.ts`, rebuild.

### Negative

* `vite-plugin-pwa` adds ~ 90 KB to the bundle (Workbox runtime).
* The generated SW is opaque to read; debugging requires the Workbox DevTools.
* Workbox has a learning curve when crafting custom routes (the `BackgroundSyncPlugin` invocation, plugin ordering, expiration setup).
* When Workbox releases a breaking change, the upgrade path can be sharp (rare; the lib is stable).

### Neutral / known unknowns

* The `generateSW` mode vs `injectManifest` mode tradeoff. We start with `generateSW` for simplicity; if we need a complex routing trick (e.g. peer-to-peer KDS relay registration inside the SW), we can flip to `injectManifest` later. The seam is the `vite.config.ts` block — no app-code change required.
* iOS Safari's still-limited Background Sync support means iOS POS users may have a *worse* offline experience than Android. We mitigate by keeping the IndexedDB queue (so re-opening the tab drains the queue manually).

## 4. Alternatives considered

### Alternative A — Hand-rolled SW

* **Pros:** Full control; smaller bundle; no third-party dep to update.
* **Cons:** Time-cost (1-2 weeks) to write something Workbox already gives us; high risk of subtle bugs in cache-busting logic; we'd be on the hook for browser-side compat (Chrome vs Safari vs Firefox).
* **Why rejected:** The audit explicitly lists "we're not in the offline-rendering business" — we should buy this with a battle-tested lib.

### Alternative B — Workbox CLI (no `vite-plugin-pwa`)

* **Pros:** One fewer Vite plugin; we can run Workbox CLI as a post-build step.
* **Cons:** Loses the manifest-injection magic; we'd write 30 lines of glue.
* **Why rejected:** Marginal benefit; `vite-plugin-pwa` is the canonical path for Vite.

### Alternative C — No SW; rely on the IndexedDB queue alone

* **Pros:** Zero new dep; what we have today.
* **Cons:** Fails R4.4 (network interception) and R4.5 (24h offline). Closing the tab loses the queue's ability to retry.
* **Why rejected:** Misses two acceptance criteria.

## 5. Validation

* P3 exit: SW registered on every page load; precache size < 500 KB.
* P3 exit: 24-hour offline drill (T-3.11) passes; queue depth drains to zero after reconnect.
* Lighthouse PWA category green on the production build.
* No regression on bundle size SLO (R3.1) — Workbox runtime is excluded from the initial route budget because it lives in `sw.js`, not the first paint.

## 6. Notes

* References:
  * `vite-plugin-pwa` docs — https://vite-pwa-org.netlify.app/
  * Workbox modules — https://developer.chrome.com/docs/workbox/modules/
  * `BackgroundSyncPlugin` — https://developer.chrome.com/docs/workbox/modules/workbox-background-sync/
* Related runbook: `docs/runbooks/chunk-load-failure.md` covers the "SW stuck on old shell" failure mode that comes with adopting an SW.

---

*Last reviewed: 2026-05-27 by Safa Othman. Next review: 2026-11-27.*
