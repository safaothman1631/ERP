/**
 * useOnline — combined connectivity hook.
 *
 *   1. Listens to the standard `online` / `offline` window events.
 *   2. Polls `/api/health` every 15s with a short timeout (network can lie
 *      about connectivity on captive portals and flaky 3G).
 *   3. Subscribes to the Service Worker `BroadcastChannel('pos-sw')` for sync
 *      progress events and surfaces a `syncing` flag.
 *
 * Returns `{ online, syncing, lastCheckAt }`.
 *
 * The hook is intentionally light: a single shared interval would be a small
 * win but at mount cost it adds complexity we don't need yet.
 */
import { useEffect, useRef, useState } from 'react';

const HEARTBEAT_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 4_000;
const HEALTH_URL = '/api/health';
const SW_CHANNEL = 'pos-sw';

export interface OnlineState {
  online: boolean;
  syncing: boolean;
  lastCheckAt: number;
}

/** Module-internal singleton so all hook instances share one heartbeat. */
interface Singleton {
  state: OnlineState;
  listeners: Set<(s: OnlineState) => void>;
  timer: ReturnType<typeof setInterval> | null;
  channel: BroadcastChannel | null;
}

let singleton: Singleton | null = null;

function getSingleton(): Singleton {
  if (singleton) return singleton;
  singleton = {
    state: {
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      syncing: false,
      lastCheckAt: 0,
    },
    listeners: new Set(),
    timer: null,
    channel: null,
  };
  return singleton;
}

function notify(s: Singleton): void {
  for (const fn of s.listeners) fn(s.state);
}

function setState(patch: Partial<OnlineState>): void {
  const s = getSingleton();
  s.state = { ...s.state, ...patch };
  notify(s);
}

async function probeHealth(): Promise<boolean> {
  if (typeof fetch === 'undefined') return true;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS)
    : null;
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller?.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function startSingletonLoop(): void {
  const s = getSingleton();
  if (s.timer) return;

  const onOnline = () => setState({ online: true });
  const onOffline = () => setState({ online: false });
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      s.channel = new BroadcastChannel(SW_CHANNEL);
      s.channel.onmessage = (ev: MessageEvent) => {
        const data = ev.data as { type?: string; status?: 'success' | 'fail' };
        if (data?.type === 'sync-start') setState({ syncing: true });
        else if (data?.type === 'sync')
          setState({ syncing: false, online: data.status === 'success' });
      };
    } catch {
      /* BroadcastChannel may be blocked in some embeds; ignore */
    }
  }

  const tick = async () => {
    const ok = await probeHealth();
    setState({ online: ok && (typeof navigator === 'undefined' || navigator.onLine), lastCheckAt: Date.now() });
  };
  // Fire immediately so first render gets a fresh value within a few seconds
  void tick();
  s.timer = setInterval(() => void tick(), HEARTBEAT_MS);
}

/** React hook — subscribe to connectivity state. */
export function useOnline(): OnlineState {
  const s = getSingleton();
  const [state, setLocalState] = useState<OnlineState>(s.state);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    startSingletonLoop();
    const listener = (next: OnlineState) => {
      if (mounted.current) setLocalState(next);
    };
    s.listeners.add(listener);
    // Push the latest known state immediately in case the loop already ran.
    listener(s.state);
    return () => {
      mounted.current = false;
      s.listeners.delete(listener);
    };
    // s is module-stable; we intentionally don't depend on it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

/** Test helper. */
export function _resetOnlineSingleton(): void {
  if (singleton?.timer) clearInterval(singleton.timer);
  if (singleton?.channel) singleton.channel.close();
  singleton = null;
}
