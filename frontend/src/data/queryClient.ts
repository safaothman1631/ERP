/**
 * @file queryClient.ts
 * @description Centralized `QueryClient` instance with global defaults aligned
 * to the world-class-performance spec.
 *
 * Lives outside `App.tsx` (per design §1.3) so non-React modules — boot
 * scripts, the IDB persister, the offline queue replayer — can read or
 * mutate the cache without re-mounting React.
 *
 * The defaults here are intentionally conservative. Per-query tuning is
 * the job of {@link useClassedQuery} (see `useClassedQuery.ts`).
 *
 * @see queryClasses.ts
 */

import { QueryClient } from '@tanstack/react-query';

import { MIN } from './queryClasses';

/* ------------------------------------------------------------------------- */
/* Construction                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Build a `QueryClient` with the app's global defaults. Exported as a
 * function so tests can build a clean client per case; the module also
 * exports a singleton {@link queryClient} for the running app.
 */
export function buildQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Sensible "no class declared" fallback — treat like class C. The
        // ESLint rule `local/require-query-class` should prevent this path
        // from ever being exercised in practice.
        staleTime: 5 * MIN,
        gcTime: 30 * MIN,
        refetchOnWindowFocus: false,
        retry: 2,
        // 1s, 2s, 4s ... capped at 30s.
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 30_000),
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/**
 * The single application-wide `QueryClient`. Imported by `App.tsx` and by
 * the persister at boot.
 */
export const queryClient: QueryClient = buildQueryClient();
