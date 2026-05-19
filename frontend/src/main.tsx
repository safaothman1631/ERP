import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './i18n'
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
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let refreshing = false
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update().catch(() => { /* ignore */ }))
      .catch(() => { /* ignore */ })
  })
}
