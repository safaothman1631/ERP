/**
 * Service worker registration + update prompt.
 *
 * Called from app boot exactly once. The SW file path matches the output
 * filename produced by `vite-plugin-pwa` (`/sw.js` at the site root). If
 * the plugin is not installed yet, this no-ops gracefully.
 *
 * Update flow:
 *   1. SW file is rebuilt on every deploy.
 *   2. Browser detects new SW, fires `updatefound` on the registration.
 *   3. The new SW enters `installed` state — we show a localized toast.
 *   4. User clicks the toast → we postMessage `{ type: 'SKIP_WAITING' }` and
 *      reload the page to pick up the new shell.
 *
 * Also subscribes to the `pos-sw` BroadcastChannel so the offline store and
 * the offline pill can react to sync events from the SW. The `useOnline`
 * hook reads from this channel too — these subscriptions are complementary
 * (the channel is multi-listener).
 */
import { message } from '../utils/message';
import i18n from '../i18n';

const SW_URL = '/sw.js';
const SW_CHANNEL = 'pos-sw';

let registered: ServiceWorkerRegistration | null = null;

export interface RegisterOptions {
  /** When true, force-update on every load. Useful during development. */
  immediate?: boolean;
}

/** Register the service worker. Safe to call multiple times — no-ops after the first success. */
export async function registerSW(opts: RegisterOptions = {}): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  // PWA SW must be served over HTTPS, except on localhost.
  if (
    typeof location !== 'undefined' &&
    location.protocol !== 'https:' &&
    location.hostname !== 'localhost' &&
    location.hostname !== '127.0.0.1'
  ) {
    return null;
  }

  if (registered) {
    if (opts.immediate) {
      try {
        await registered.update();
      } catch {
        /* noop */
      }
    }
    return registered;
  }

  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
    registered = reg;
    wireUpdatePrompt(reg);
    subscribeToSWChannel();
    return reg;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[pwa] service worker registration failed', err);
    return null;
  }
}

function wireUpdatePrompt(reg: ServiceWorkerRegistration): void {
  // Worker already waiting at boot time
  if (reg.waiting) showUpdateToast(reg);

  reg.addEventListener('updatefound', () => {
    const next = reg.installing;
    if (!next) return;
    next.addEventListener('statechange', () => {
      if (next.state === 'installed' && navigator.serviceWorker.controller) {
        // A previous SW is controlling — this `installed` state means there's an
        // update ready to take over.
        showUpdateToast(reg);
      }
    });
  });

  // Reload the page once the new SW takes control.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}

function showUpdateToast(reg: ServiceWorkerRegistration): void {
  const t = (key: string, fallback: string): string => {
    try {
      const v = i18n.t(key);
      return typeof v === 'string' && v !== key ? v : fallback;
    } catch {
      return fallback;
    }
  };

  // Use the existing message utility — it supports `description` + button-style updates
  // via the standard antd notification API consumed by our wrapper.
  try {
    message.info(t('pwa.update_available', 'Update available — click to reload'));
  } catch {
    /* swallow — toast is non-critical */
  }

  // Heuristic UX: post a one-shot click handler on the document so the next click
  // anywhere triggers the update. Imperfect, but avoids a custom UI surface.
  const accept = () => {
    document.removeEventListener('click', accept);
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  };
  document.addEventListener('click', accept, { once: true });
}

// ---------------------------------------------------------------------------
// BroadcastChannel — surface SW sync events to Zustand stores.
// ---------------------------------------------------------------------------

let channel: BroadcastChannel | null = null;
type SWMessage =
  | { type: 'sync-start' }
  | { type: 'sync'; status: 'success' | 'fail' }
  | { type: 'sw-activated'; version: string };

const listeners = new Set<(msg: SWMessage) => void>();

function subscribeToSWChannel(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  if (channel) return;
  try {
    channel = new BroadcastChannel(SW_CHANNEL);
    channel.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as SWMessage;
      for (const fn of listeners) {
        try {
          fn(msg);
        } catch {
          /* listener errors must not break the channel */
        }
      }
      // Side-effects baked in for known stores. We import lazily to avoid
      // circular imports during boot.
      if (msg?.type === 'sync') {
        void import('../stores/posOffline').then((mod) => {
          try {
            mod.usePOSOfflineStore.getState().setOnline(msg.status === 'success');
          } catch {
            /* store may not be initialised yet — fine */
          }
        });
      }
    };
  } catch {
    /* ignore — older browsers */
  }
}

/** Subscribe to broadcast SW events. Returns an unsubscribe. */
export function onSWMessage(fn: (msg: SWMessage) => void): () => void {
  subscribeToSWChannel();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Test helper — disconnect everything. */
export function _resetSWForTests(): void {
  if (channel) {
    channel.close();
    channel = null;
  }
  listeners.clear();
  registered = null;
}
