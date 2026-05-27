/**
 * @file persister.ts
 * @description Wires the IDB persister into a `QueryClient` per design §1.4.
 *
 * Exposes a single `setupPersistence(queryClient)` function that the app
 * shell should call once at boot (before rendering). The persister stores
 * the cache in IndexedDB so cold loads on returning users paint from disk
 * within 100ms (requirement R2.5).
 *
 * Dehydration rule: class-A queries are never persisted, because real-time
 * data is meaningless once stale; replaying it would just confuse the user
 * before the live listener catches up.
 *
 * @see queryClasses.ts
 * @see idb-persister.ts
 */

import type { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';

import { createIDBPersister } from './idb-persister';
import { HR, QUERY_CLASS_META_KEY, type QueryClassName } from './queryClasses';

/* ------------------------------------------------------------------------- */
/* Configuration                                                             */
/* ------------------------------------------------------------------------- */

export interface SetupPersistenceOptions {
  /** Override the IDB database name (e.g. for tests). */
  dbName?: string;
  /** ms after which a persisted query is dropped; defaults to 24h. */
  maxAge?: number;
  /**
   * Bump this when the cache shape changes between releases — TanStack
   * Query will throw out any persisted snapshot whose `buster` doesn't
   * match the current value. Default ties it to the app version env var.
   */
  buster?: string;
}

/* ------------------------------------------------------------------------- */
/* setupPersistence                                                          */
/* ------------------------------------------------------------------------- */

/**
 * Attach the IDB persister to a `QueryClient`. Idempotent for the same
 * client instance: TanStack Query's `persistQueryClient` returns an
 * "unsubscribe" cleanup, which this function returns so callers can detach
 * on teardown (rarely needed outside tests).
 *
 * @returns A cleanup function that disables persistence.
 *
 * @example
 * // In src/main.tsx (or App.tsx boot):
 * import { queryClient } from './data/queryClient';
 * import { setupPersistence } from './data/persister';
 *
 * setupPersistence(queryClient);
 */
export function setupPersistence(
  queryClient: QueryClient,
  options: SetupPersistenceOptions = {},
): () => void {
  const {
    dbName = 'zoho-rq-cache',
    maxAge = 24 * HR,
    buster = readAppVersion(),
  } = options;

  const persister = createIDBPersister(dbName);

  const [unsubscribe] = persistQueryClient({
    queryClient,
    persister,
    maxAge,
    buster,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        // Only persist successful queries (failed ones have no useful data).
        if (query.state.status !== 'success') return false;

        // Class-A is real-time — persisting stale snapshots provides no value
        // and can mislead the user before the listener re-attaches.
        const meta = query.meta as
          | { [QUERY_CLASS_META_KEY]?: QueryClassName }
          | undefined;
        const queryClass = meta?.[QUERY_CLASS_META_KEY];
        if (queryClass === 'A') return false;

        return true;
      },
    },
  });

  return unsubscribe;
}

/* ------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Best-effort lookup of the build's version string so the cache is
 * invalidated automatically on deploys. Reads `import.meta.env.VITE_APP_VERSION`
 * with a `'dev'` fallback. Wrapped in a function so tests can stub `env`.
 */
function readAppVersion(): string {
  try {
    // `import.meta.env` is typed loosely; cast to a record for the lookup.
    const env = (import.meta as unknown as { env?: Record<string, string> })
      .env;
    return env?.VITE_APP_VERSION ?? 'dev';
  } catch {
    return 'dev';
  }
}
