/**
 * lazyWithRetry
 * -------------
 * Hardened wrapper around `React.lazy` that retries failed dynamic chunk
 * imports with exponential backoff before surfacing the user-facing error
 * fallback. Iraqi mobile networks routinely drop the chunk request mid-flight
 * — silently retrying recovers the page on the second or third attempt in the
 * common case (R3.4).
 *
 * Behavior:
 *   1. Up to 4 attempts total (1 initial + 3 retries) with delays 500ms,
 *      2000ms, 8000ms between them.
 *   2. On final failure, dynamically imports `@sentry/react` (wrapped in
 *      try/catch so a missing Sentry install never crashes the app) and
 *      forwards the original exception with `tags.chunkName` so deploy-time
 *      chunk-hash mismatches can be traced back to a specific route (R3.5).
 *   3. Resolves with the `ChunkLoadErrorFallback` component as the lazy
 *      default — the surrounding `<Suspense>` boundary unblocks and the user
 *      sees a localized "Reload page" UI instead of a blank screen.
 *
 * @example
 *   const Invoices = lazyWithRetry(
 *     () => import('./pages/Invoices'),
 *     'invoices',
 *   );
 *
 *   // ...later in the route tree
 *   { path: 'invoices', element: <Suspense fallback={<Skeleton/>}><Invoices/></Suspense> }
 *
 * @template T - The React component type exported as the module's default.
 * @param importFn  - The dynamic `import()` callback returning a module with a
 *                    default-exported component.
 * @param chunkName - A short kebab-case identifier (e.g. `'invoices'`) used as
 *                    a Sentry tag and in console diagnostics. SHOULD be unique
 *                    across the codebase.
 * @returns A `LazyExoticComponent<T>` safe to render inside a `<Suspense>`.
 *
 * Spec: world-class-performance — R3.4, R3.5, design §1.2.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import ChunkLoadErrorFallback from '../components/ChunkLoadErrorFallback';

/** Backoff schedule between retries, in milliseconds. */
const RETRY_DELAYS_MS: readonly number[] = [500, 2000, 8000];

export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  chunkName: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;

    // Attempt 0 = initial try; attempts 1..3 = retries spaced per RETRY_DELAYS_MS.
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await importFn();
      } catch (err) {
        lastError = err;
        if (attempt < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[attempt];
          // eslint-disable-next-line no-console
          console.warn(
            `[lazyWithRetry] chunk "${chunkName}" failed (attempt ${attempt + 1}). ` +
              `Retrying in ${delay}ms.`,
            err,
          );
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted — report to Sentry if available, then fall back to
    // a localized error UI so the surrounding route shell stays mounted.
    try {
      // Dynamic, optional dependency: production builds include Sentry; tests
      // and dev runs typically do not. Wrapping in try/catch keeps the lazy
      // loader robust against the package being absent altogether.
      const sentry = await import(/* @vite-ignore */ '@sentry/react').catch(
        () => null,
      );
      if (sentry && typeof sentry.captureException === 'function') {
        sentry.captureException(lastError, {
          tags: { chunkName, kind: 'chunk-load-failure' },
        });
      }
    } catch {
      // Sentry import or capture failed — never let observability break UX.
    }

    // eslint-disable-next-line no-console
    console.error(
      `[lazyWithRetry] chunk "${chunkName}" exhausted all retries.`,
      lastError,
    );

    return { default: ChunkLoadErrorFallback as unknown as T };
  });
}

export default lazyWithRetry;
