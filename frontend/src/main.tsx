import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// i18n bootstrap (P5):
//
//   • Prefer the namespaced lazy config (`i18n.config`) — only the active
//     locale's `common` bundle is loaded on first paint; other namespaces
//     fetch on demand via HTTP backend from `/locales/<lng>/<ns>.json`.
//   • Fall back to the legacy monolithic `./i18n` import if the split JSON
//     files have not been generated yet (e.g. on a fresh dev machine that
//     hasn't run `npm run i18n:split`).
//
// We fire-and-forget so first paint is not blocked; React Suspense is
// disabled in the config, and components display the key until the
// translation lands a frame or two later.
import { initI18n } from './i18n.config'
initI18n().catch((err) => {
  // eslint-disable-next-line no-console
  console.warn('[zoho] lazy i18n init failed, falling back to legacy bundle:', err)
  return import('./i18n')
})
import './global.css'
import './polish.css'
import './print.css'
import './a11y.css'
import './reduced-motion.css'
// Safe-area-inset shell utility — applied via .responsive-shell class on
// AppShell, AuthLayout, and full-screen Dialogs. Imported globally so the
// class is available app-wide. Touch-target utility (clickable.css) is
// imported per-component, not globally (Requirements 2.5, 2.7, 5.1, 5.2).
import './components/responsive/safeArea.css'

// World-class performance spec (.kiro/specs/world-class-performance):
//   • P0 — Sentry mandatory in production (R6.4) + web-vitals telemetry (R6.1)
//   • P3 — Workbox service-worker for PWA/Offline POS (R4.4–4.5)
// Each block is independently guarded so a missing env var or unbuilt SW
// does not break the boot path in development.
import { initSentry } from './observability/sentry'
import { initWebVitals } from './observability/vitals'

try {
  initSentry()
} catch (err) {
  if (import.meta.env.PROD) throw err
  // eslint-disable-next-line no-console
  console.warn('[zoho] Sentry not initialized (dev fallback):', err)
}

try {
  initWebVitals()
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('[zoho] web-vitals init failed:', err)
}

// Validation framework — offline-sync heartbeat (V-PR.4).
// Every 5 minutes when online, the POS app reports its offline-queue depth
// so the team can spot tenants/devices where sync is failing silently.
import('./observability/offline-sync-heartbeat')
  .then(({ startOfflineSyncHeartbeat }) => {
    try {
      startOfflineSyncHeartbeat()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[zoho] offline-sync heartbeat failed to start:', err)
    }
  })
  .catch(() => {
    /* Module missing in legacy builds — fine. */
  })

const STALE_CHUNK_RELOAD_KEY = 'zoho:stale-chunk-reload'

const isStaleChunkError = (reason: unknown): boolean => {
  const message = reason instanceof Error ? reason.message : String(reason || '')
  return message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module')
}

const recoverFromStaleChunk = async () => {
  const lastReload = Number(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) || '0')
  if (Date.now() - lastReload < 30000) return
  sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(Date.now()))

  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.filter((name) => name.startsWith('erp-')).map((name) => caches.delete(name)))
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.update()))
  }

  window.location.reload()
}

window.addEventListener('unhandledrejection', (event) => {
  if (!isStaleChunkError(event.reason)) return
  event.preventDefault()
  recoverFromStaleChunk().catch(() => window.location.reload())
})

window.addEventListener('error', (event) => {
  if (!isStaleChunkError(event.error) && !isStaleChunkError(event.message)) return
  event.preventDefault()
  recoverFromStaleChunk().catch(() => window.location.reload())
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for PWA / offline support
// Phase P3 — Workbox-built SW (vite-plugin-pwa) replaces the legacy
// `/sw.js`. The new SW handles precache, runtime cache by query class,
// and Background Sync for offline POS POSTs (R4.4–4.5).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let refreshing = false
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }

  window.addEventListener('load', async () => {
    try {
      // Dynamic import so dev builds (where the SW hasn't been emitted)
      // don't fail on missing modules.
      const { registerSW } = await import('./pwa/register')
      await registerSW()
    } catch (err) {
      // Fallback: legacy registration so we never lose offline coverage.
      // eslint-disable-next-line no-console
      console.warn('[zoho] Workbox SW unavailable, using legacy fallback:', err)
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => registration.update().catch(() => { /* ignore */ }))
        .catch(() => { /* ignore */ })
    }
  })
}
