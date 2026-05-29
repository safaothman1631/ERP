/**
 * W3C Trace Context propagation helper (T-SF.5.x — frontend distributed tracing)
 *
 * The backend server spans are created by OpenTelemetry's FastAPI
 * instrumentation, which extracts the inbound `traceparent` header. For traces
 * to start in the browser (so a user action links to its backend spans), the
 * frontend must SEND a `traceparent` on outbound API calls.
 *
 * This module is deliberately dependency-free — it does NOT pull in the
 * `@opentelemetry/*` web SDK (which is heavy and would bloat the bundle).
 * Instead it generates a spec-compliant W3C `traceparent` per request:
 *
 *     traceparent: 00-<32 hex trace-id>-<16 hex span-id>-01
 *
 * version=00, trace-flags=01 (sampled). Sampling is decided client-side via
 * `shouldSampleTrace()` so we don't tag 100% of requests (cost control); when
 * not sampled we still send trace-flags=00 so the backend keeps the trace id
 * for correlation but doesn't necessarily export it.
 *
 * Integration points:
 *   - axios:  register `axiosTraceparentInterceptor` on the shared instance.
 *   - fetch:  spread `traceparentHeaders()` into a request's `headers`.
 *
 * The exact one-line wiring for the app's axios client lives in sharedWiring.
 */

// ---- Sampling ----------------------------------------------------------

/** Fraction of browser-initiated traces marked "sampled" (trace-flags=01). */
export const TRACE_SAMPLE_RATE = 0.1;

let _forceSampleAll = false;

/** Test/diagnostic hook: force every trace to be sampled. */
export function setForceSampleAll(on: boolean): void {
  _forceSampleAll = on;
}

export function shouldSampleTrace(): boolean {
  if (_forceSampleAll) return true;
  return Math.random() < TRACE_SAMPLE_RATE;
}

// ---- ID generation -----------------------------------------------------

/** Cryptographically-strong random bytes, with a Math.random fallback. */
function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const g = (globalThis as { crypto?: Crypto }).crypto;
  if (g && typeof g.getRandomValues === 'function') {
    g.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

/** 16-byte (128-bit) trace id as 32 lowercase hex chars; never all-zero. */
export function generateTraceId(): string {
  let id = toHex(randomBytes(16));
  if (/^0+$/.test(id)) id = id.slice(0, 31) + '1';
  return id;
}

/** 8-byte (64-bit) span id as 16 lowercase hex chars; never all-zero. */
export function generateSpanId(): string {
  let id = toHex(randomBytes(8));
  if (/^0+$/.test(id)) id = id.slice(0, 15) + '1';
  return id;
}

// ---- traceparent -------------------------------------------------------

export interface TraceContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
}

/** Build a fresh root trace context for an outbound request. */
export function newTraceContext(sampled = shouldSampleTrace()): TraceContext {
  return { traceId: generateTraceId(), spanId: generateSpanId(), sampled };
}

/** Format a W3C `traceparent` header value from a context. */
export function formatTraceparent(ctx: TraceContext): string {
  const flags = ctx.sampled ? '01' : '00';
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

/**
 * Headers to merge into an outbound request. Returns a fresh root context per
 * call (one trace per request from the browser's perspective). Includes the
 * legacy single-word `tracestate` vendor segment so a future vendor can attach
 * state without us regenerating the format.
 */
export function traceparentHeaders(): Record<string, string> {
  const ctx = newTraceContext();
  return {
    traceparent: formatTraceparent(ctx),
    tracestate: `zoho=${ctx.sampled ? '1' : '0'}`,
  };
}

// ---- axios integration -------------------------------------------------
// Typed loosely so this module has zero compile-time dependency on axios.

interface MinimalAxiosConfig {
  headers?: Record<string, unknown> & {
    set?: (name: string, value: string) => void;
  };
}

/**
 * Axios request interceptor that stamps a `traceparent` on every request.
 * Supports both the legacy plain-object `config.headers` and the AxiosHeaders
 * instance (which exposes `.set`).
 *
 * Register on the shared client, e.g.:
 *
 *     import { axiosTraceparentInterceptor } from './observability/traceparent';
 *     api.interceptors.request.use(axiosTraceparentInterceptor);
 */
export function axiosTraceparentInterceptor<T extends MinimalAxiosConfig>(
  config: T,
): T {
  const headers = traceparentHeaders();
  const h = config.headers ?? (config.headers = {} as MinimalAxiosConfig['headers']);
  if (h && typeof h.set === 'function') {
    h.set('traceparent', headers.traceparent);
    h.set('tracestate', headers.tracestate);
  } else if (h) {
    (h as Record<string, unknown>).traceparent = headers.traceparent;
    (h as Record<string, unknown>).tracestate = headers.tracestate;
  }
  return config;
}

// ---- fetch integration -------------------------------------------------

/**
 * Wrap a `RequestInit` so a `fetch()` call carries a `traceparent`. Existing
 * headers are preserved.
 *
 *     await fetch(url, withTraceparent({ method: 'POST', body }));
 */
export function withTraceparent(init: RequestInit = {}): RequestInit {
  const merged = new Headers(init.headers || {});
  const tp = traceparentHeaders();
  merged.set('traceparent', tp.traceparent);
  merged.set('tracestate', tp.tracestate);
  return { ...init, headers: merged };
}
