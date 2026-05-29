/**
 * Sentry initialization (T-0.6, R6.4).
 *
 * Production-mandatory: throws if `VITE_SENTRY_DSN` is missing in a
 * production build. In dev, missing DSN silently disables Sentry.
 *
 * Sample rates per R6.4:
 *   - 100% errors
 *   - 10%  performance traces
 *
 * `@sentry/react` is dynamically imported so this module can be loaded in
 * builds where the package is not yet installed (see _deltas/P0-deps.md).
 */

export interface SentryInitOptions {
  /** Override the DSN read from env. Useful for tests. */
  dsn?: string;
  /** Override the environment label. Defaults to PROD ? 'production' : 'development'. */
  environment?: string;
  /** Override the release identifier. Defaults to VITE_APP_VERSION. */
  release?: string;
}

type ViteEnv = {
  PROD?: boolean;
  VITE_SENTRY_DSN?: string;
  VITE_APP_VERSION?: string;
};

const VITE_ENV: ViteEnv =
  ((import.meta as unknown as { env?: ViteEnv }).env ?? {}) as ViteEnv;

function isProd(): boolean {
  return Boolean(VITE_ENV.PROD);
}

type SentryModule = {
  init: (cfg: Record<string, unknown>) => void;
  captureException: (
    err: unknown,
    context?: { tags?: Record<string, string> },
  ) => void;
  browserTracingIntegration: () => unknown;
};

let _sentry: SentryModule | null = null;

/**
 * Initialize Sentry. Call once during app bootstrap.
 *
 * @throws Error in production if VITE_SENTRY_DSN is unset (R6.4).
 */
export async function initSentry(
  opts: SentryInitOptions = {},
): Promise<void> {
  const dsn = opts.dsn ?? VITE_ENV.VITE_SENTRY_DSN;
  const prod = isProd();

  if (!dsn) {
    if (prod) {
      // Sentry is recommended but not mandatory: warn and continue so the app
      // still boots when error tracking is intentionally deferred.
      console.warn(
        '[observability] VITE_SENTRY_DSN is unset — Sentry disabled (R6.4)',
      );
    }
    return;
  }

  let mod: SentryModule;
  try {
    // @ts-expect-error — `@sentry/react` is an optional runtime dep (see _deltas/P0-deps.md).
    const imported = await import(/* @vite-ignore */ '@sentry/react');
    mod = imported as unknown as SentryModule;
  } catch (e) {
    if (prod) {
      throw new Error(
        '[observability] @sentry/react failed to load in production: ' + String(e),
      );
    }
    return;
  }
  _sentry = mod;

  mod.init({
    dsn,
    environment: opts.environment ?? (prod ? 'production' : 'development'),
    release: opts.release ?? VITE_ENV.VITE_APP_VERSION,
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
    integrations: [mod.browserTracingIntegration()],
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications.',
      'Non-Error promise rejection captured',
    ],
  });
}

/**
 * Capture an exception with optional tag context. Safe to call before init —
 * Sentry silently no-ops if not configured.
 */
export function captureException(
  err: unknown,
  context?: { tags?: Record<string, string> },
): void {
  try {
    _sentry?.captureException(err, context);
  } catch {
    /* swallow */
  }
}
