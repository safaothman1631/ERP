/**
 * offline-sync-heartbeat.ts
 * ---------------------------------------------------------------------------
 * Frontend reporter for V-PR.4 (Offline POS Sync Success Rate).
 *
 * Every 5 minutes while the tab is online, this module reads the POS offline
 * queue from IndexedDB and POSTs an aggregate snapshot to
 * `/api/health/offline-sync`. The backend stores the latest snapshot per
 * device — see `backend/app/api/offline_sync_health.py`.
 *
 * Reported fields (per the V-PR.4 contract):
 *   - device_id              ULID-ish stable per-browser id (localStorage)
 *   - queued_count           rows with status=pending
 *   - synced_count           rows with status != pending && != failed
 *                            (we no longer keep rows after sync — observed as 0)
 *   - failed_count           rows with status=failed
 *   - oldest_queued_age_sec  now - min(createdAt) over pending rows
 *   - app_version            from the Vite `__APP_VERSION__` define
 *
 * Lifecycle:
 *   - call `startOfflineSyncHeartbeat()` once from app boot
 *   - it returns a `stop()` function for tests / HMR cleanup
 *
 * Failure policy:
 *   - never throws; logs to console.warn
 *   - skips when offline (`navigator.onLine === false`)
 *   - skips when POS IDB is unavailable (e.g. server-rendered context)
 */
import { getPOSDB } from '../stores/pos/db';

const DEVICE_ID_KEY = 'observability:device-id';
const HEARTBEAT_INTERVAL_MS = 5 * 60_000;
const HEARTBEAT_ENDPOINT = '/api/health/offline-sync';

// `__APP_VERSION__` is injected by Vite at build time. We declare it
// permissively so dev / test environments where it's not set fall back
// to "dev".
declare const __APP_VERSION__: string | undefined;

interface HeartbeatSnapshot {
  device_id: string;
  queued_count: number;
  synced_count: number;
  failed_count: number;
  oldest_queued_age_sec: number;
  app_version: string;
}

// ── device id ─────────────────────────────────────────────────────────────

/** Generates a 26-char Crockford-base32 ULID-ish id, monotonic-enough for our purposes. */
function generateUlid(): string {
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const time = Date.now();
  let timeChars = '';
  let t = time;
  for (let i = 0; i < 10; i++) {
    timeChars = ALPHABET[t % 32] + timeChars;
    t = Math.floor(t / 32);
  }
  let randChars = '';
  const rand = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(rand);
  } else {
    for (let i = 0; i < 16; i++) rand[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 16; i++) randChars += ALPHABET[rand[i] % 32];
  return (timeChars + randChars).slice(0, 26);
}

/** Reads (or creates) the stable device id used in heartbeat reports. */
export function getHeartbeatDeviceId(): string {
  if (typeof localStorage === 'undefined') {
    return `ephemeral-${Math.random().toString(36).slice(2)}`;
  }
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const fresh = generateUlid();
  try {
    localStorage.setItem(DEVICE_ID_KEY, fresh);
  } catch {
    /* storage may be full / disabled — fall through with ephemeral id */
  }
  return fresh;
}

// ── snapshot collection ───────────────────────────────────────────────────

/** Reads the POS offline-queue and computes an aggregate snapshot. */
export async function collectOfflineSyncSnapshot(): Promise<HeartbeatSnapshot | null> {
  try {
    const db = await getPOSDB();
    const rows = await db.getAll('offline-queue');

    let queued = 0;
    let failed = 0;
    let synced = 0;
    let oldestPendingMs = Number.POSITIVE_INFINITY;
    const now = Date.now();

    for (const row of rows) {
      const status = (row as { status?: string }).status;
      const createdAt = Number((row as { createdAt?: number }).createdAt ?? now);
      if (status === 'pending' || status === 'syncing') {
        queued++;
        if (createdAt < oldestPendingMs) oldestPendingMs = createdAt;
      } else if (status === 'failed') {
        failed++;
      } else {
        synced++;
      }
    }

    const oldestQueuedAgeSec = queued === 0
      ? 0
      : Math.max(0, Math.floor((now - oldestPendingMs) / 1000));

    const version =
      typeof __APP_VERSION__ === 'string' && __APP_VERSION__
        ? __APP_VERSION__
        : 'dev';

    return {
      device_id: getHeartbeatDeviceId(),
      queued_count: queued,
      synced_count: synced,
      failed_count: failed,
      oldest_queued_age_sec: oldestQueuedAgeSec,
      app_version: version,
    };
  } catch (err) {
    // POS DB unavailable (SSR, private mode, etc.). No-op.
     
    console.warn('[offline-sync-heartbeat] snapshot skipped:', err);
    return null;
  }
}

// ── reporter ──────────────────────────────────────────────────────────────

function getAuthHeader(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  // The auth layer stores its token under a few possible keys depending on era.
  // Try them in order; absence is fine (the endpoint is auth-required but we
  // also want the heartbeat to silently no-op on logout).
  const token =
    localStorage.getItem('auth_token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function sendHeartbeat(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const snapshot = await collectOfflineSyncSnapshot();
  if (!snapshot) return;

  const auth = getAuthHeader();
  if (!auth.Authorization) return; // not logged in — don't spam 401s

  try {
    await fetch(HEARTBEAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth,
      },
      body: JSON.stringify(snapshot),
      keepalive: true,
    });
  } catch (err) {
     
    console.warn('[offline-sync-heartbeat] send failed:', err);
  }
}

/**
 * Starts the periodic heartbeat. Call once from app boot.
 * Returns a stop() function that cancels the timer (used by tests / HMR).
 */
export function startOfflineSyncHeartbeat(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  // Kick off a first heartbeat after a short delay so we don't compete with
  // boot-critical work.
  const bootTimer = setTimeout(() => {
    void sendHeartbeat();
  }, 30_000);

  const interval = setInterval(() => {
    void sendHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);

  // Also report when the browser regains connectivity — fresh data is more
  // useful than the next scheduled tick.
  const onOnline = () => { void sendHeartbeat(); };
  window.addEventListener('online', onOnline);

  return function stop() {
    clearTimeout(bootTimer);
    clearInterval(interval);
    window.removeEventListener('online', onOnline);
  };
}
