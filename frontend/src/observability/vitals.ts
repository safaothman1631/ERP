/**
 * Web Vitals + RUM Client (T-0.1)
 *
 * Spec: world-class-performance — R6.1, R1.1, R1.2, R1.3
 * Reports Core Web Vitals (LCP, INP, CLS, FCP, TTFB) to the backend RUM
 * ingest endpoint with batching, beacon-on-unload, and adaptive sampling.
 *
 * Sampling policy (R6.1):
 *  - 100% for the FIRST session per device (tracked via sessionStorage flag
 *    + localStorage device flag).
 *  - 10% thereafter.
 *
 * `web-vitals` is dynamically imported inside `initWebVitals()` so the
 * VitalBatcher and helpers can be unit-tested without the library being
 * resolvable.
 */

// Shape we depend on from `web-vitals` (LCP / INP / CLS / FCP / TTFB).
type Metric = {
  name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
};

// ---------- Schema (design.md §3.5) -------------------------------------

export type DeviceClass =
  | 'mobile-low'
  | 'mobile-mid'
  | 'mobile-high'
  | 'tablet'
  | 'desktop';

export type NetworkClass =
  | 'slow-2g'
  | '2g'
  | '3g'
  | '4g'
  | 'wifi'
  | 'unknown';

export type VitalName = 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';

export type VitalRating = 'good' | 'needs-improvement' | 'poor';

export interface VitalEvent {
  sessionId: string;
  appVersion: string;
  route: string;
  deviceClass: DeviceClass;
  network: NetworkClass;
  metric: VitalName;
  value: number;
  rating: VitalRating;
  /** Milliseconds since epoch when the event was captured. */
  ts: number;
}

// ---------- Sampling ---------------------------------------------------

const DEVICE_KEY = 'zoho.rum.deviceSeen';
const SESSION_KEY = 'zoho.rum.sessionSeen';
const SESSION_ID_KEY = 'zoho.rum.sessionId';
const POST_FIRST_SESSION_SAMPLE_RATE = 0.1;

function isFirstSessionForDevice(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      // Decision already made for this session — stick with it.
      return localStorage.getItem(DEVICE_KEY) !== '1';
    }
    sessionStorage.setItem(SESSION_KEY, '1');
    const seen = localStorage.getItem(DEVICE_KEY) === '1';
    if (!seen) {
      localStorage.setItem(DEVICE_KEY, '1');
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

function shouldSampleSession(): boolean {
  if (isFirstSessionForDevice()) return true;
  return Math.random() < POST_FIRST_SESSION_SAMPLE_RATE;
}

// ---------- Session id -------------------------------------------------

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const id = generateId();
    sessionStorage.setItem(SESSION_ID_KEY, id);
    return id;
  } catch {
    return generateId();
  }
}

function generateId(): string {
  // 13-char ms-epoch + 10 random base36 chars.
  const t = Date.now().toString(36);
  let r = '';
  for (let i = 0; i < 10; i++) r += Math.floor(Math.random() * 36).toString(36);
  return t + '-' + r;
}

// ---------- Device / network classification ----------------------------

function classifyDevice(): DeviceClass {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPod|Opera Mini|IEMobile/i.test(ua);
  const isTablet = /iPad|Tablet|Nexus 7|Nexus 10|SM-T/i.test(ua);
  if (isTablet) return 'tablet';
  if (!isMobile) return 'desktop';
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 0;
  const cores = navigator.hardwareConcurrency ?? 0;
  if (mem >= 6 || cores >= 8) return 'mobile-high';
  if (mem > 0 && mem <= 2) return 'mobile-low';
  if (cores > 0 && cores <= 2) return 'mobile-low';
  return 'mobile-mid';
}

function classifyNetwork(): NetworkClass {
  const conn = (navigator as {
    connection?: { effectiveType?: string; type?: string };
  }).connection;
  if (!conn) return 'unknown';
  const eff = conn.effectiveType;
  if (eff === 'slow-2g' || eff === '2g' || eff === '3g' || eff === '4g') {
    return eff;
  }
  if (conn.type === 'wifi') return 'wifi';
  return 'unknown';
}

// ---------- App version & route ----------------------------------------

function getAppVersion(): string {
  const env = (import.meta as unknown as {
    env?: { VITE_APP_VERSION?: string; PROD?: boolean };
  }).env;
  return env?.VITE_APP_VERSION || 'dev';
}

function getRoute(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

// ---------- Batcher ----------------------------------------------------

const BATCH_MAX = 20;
const BATCH_FLUSH_MS = 5_000;
const RUM_ENDPOINT = '/api/rum/vitals';

type Sender = (body: string) => void;

export class VitalBatcher {
  private queue: VitalEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly endpoint: string;
  private readonly send: Sender;

  constructor(endpoint: string = RUM_ENDPOINT, sender?: Sender) {
    this.endpoint = endpoint;
    this.send = sender ?? this.defaultSender;
  }

  push(event: VitalEvent): void {
    this.queue.push(event);
    if (this.queue.length >= BATCH_MAX) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), BATCH_FLUSH_MS);
    }
  }

  flush(useBeacon = false): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;
    const body = JSON.stringify({ events: this.queue });
    this.queue = [];
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(this.endpoint, blob);
        return;
      } catch {
        /* fall through */
      }
    }
    this.send(body);
  }

  private defaultSender: Sender = (body) => {
    try {
      void fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        /* swallow — RUM must never break the app */
      });
    } catch {
      /* noop */
    }
  };

  /** Test helper: peek at queued events without flushing. */
  peek(): readonly VitalEvent[] {
    return this.queue;
  }
}

// ---------- Public entry point -----------------------------------------

let _initialized = false;

/**
 * Register web-vitals listeners and start reporting to the RUM endpoint.
 * Safe to call multiple times.
 */
export async function initWebVitals(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  if (typeof window === 'undefined') return;
  if (!shouldSampleSession()) return;

  type WV = {
    onLCP: (cb: (m: Metric) => void) => void;
    onINP: (cb: (m: Metric) => void) => void;
    onCLS: (cb: (m: Metric) => void) => void;
    onFCP: (cb: (m: Metric) => void) => void;
    onTTFB: (cb: (m: Metric) => void) => void;
  };

  let wv: WV;
  try {
    wv = (await import(/* @vite-ignore */ 'web-vitals')) as unknown as WV;
  } catch {
    return;
  }

  const batcher = new VitalBatcher();
  const sessionId = getSessionId();
  const appVersion = getAppVersion();
  const deviceClass = classifyDevice();
  const network = classifyNetwork();

  const report = (m: Metric) => {
    const event: VitalEvent = {
      sessionId,
      appVersion,
      route: getRoute(),
      deviceClass,
      network,
      metric: m.name as VitalName,
      value: m.value,
      rating: m.rating,
      ts: Date.now(),
    };
    batcher.push(event);
  };

  wv.onLCP(report);
  wv.onINP(report);
  wv.onCLS(report);
  wv.onFCP(report);
  wv.onTTFB(report);

  const flushOnLeave = () => batcher.flush(true);
  window.addEventListener('pagehide', flushOnLeave);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnLeave();
  });
}

// ---------- Exports for tests ------------------------------------------

export const __test__ = {
  classifyDevice,
  classifyNetwork,
  isFirstSessionForDevice,
  shouldSampleSession,
  POST_FIRST_SESSION_SAMPLE_RATE,
  BATCH_MAX,
  BATCH_FLUSH_MS,
  RUM_ENDPOINT,
};
