# P2 — Data-Fetching Class System — Summary

Implements requirements §2 and §6 of `world-class-performance` and the
design in §1.3 – §1.5.

## Files created

### Frontend data layer (`frontend/src/data/`)

| Path | Purpose |
|------|---------|
| `frontend/src/data/queryClasses.ts` | Defines the five freshness classes (A real-time, B hot, C warm, D cold, E static), time constants `SEC`/`MIN`/`HR`, the `QueryClassName` type, and a `buildClassedMeta` helper that stamps the class onto `query.meta`. |
| `frontend/src/data/useClassedQuery.ts` | `useClassedQuery` and `useClassedInfiniteQuery` wrappers around TanStack's hooks. Forces the caller to pass a `QueryClassName`; auto-applies the right `staleTime`/`gcTime`/refetch options; stamps `meta.queryClass` so the persister can decide what to dehydrate. |
| `frontend/src/data/idb-persister.ts` | `createIDBPersister(dbName)` returns a TanStack `Persister` backed by IndexedDB via the `idb` library. Object store `cache`, key `react-query-cache`, JSON-serialized, version-bumpable. |
| `frontend/src/data/persister.ts` | `setupPersistence(queryClient, options?)` wires the IDB persister into `persistQueryClient`. The exclusion rule drops class-A queries from dehydration per design §1.4. Reads `VITE_APP_VERSION` for the cache buster. |
| `frontend/src/data/useOptimisticMutation.ts` | Generic optimistic-mutation helper (`onMutate` snapshot → `setQueryData` → rollback on error → invalidate on settle). Fully generic over `TData`/`TVariables`/`TQueryData`/`TError`; docstring example for invoice creation. |
| `frontend/src/data/queryClient.ts` | Centralized `QueryClient` instance with sensible global defaults (5-min staleTime / 30-min gcTime / 2 retries with exp-backoff). Exports both `buildQueryClient()` and a singleton `queryClient`. |
| `frontend/src/data/migrate-useCRUD.md` | Migration guide: how to convert existing `useQuery`/`useCRUD` call sites; codemod recipe (using the lint autofix); top-20 hottest queries with the recommended class for each. |

### Hooks (`frontend/src/hooks/`)

| Path | Purpose |
|------|---------|
| `frontend/src/hooks/useFirestoreLive.v2.ts` | Time-boxed Firestore subscription. Detaches after `idleDetachMs` (default 30 min); re-attaches on next user activity or `visibilitychange`. Returns `{ data, isLoading, error, lastSnapshotAt, isStale, listenerCount }`. Module-level Map tracks the global listener count; emits a `console.warn` at > 25 active listeners. The old `useFirestoreLive.ts` is untouched. |
| `frontend/src/hooks/useFirestoreLive.v2.test.ts` | Vitest coverage: initial subscribe, soft-delete filtering, document vs. collection routing, idle-detach, re-attach on visibilitychange, listener-count tracking, threshold warning, error handling, `enabled: false`. |

### ESLint rules (`tools/eslint-rules/`)

| Path | Purpose |
|------|---------|
| `tools/eslint-rules/require-query-class.js` | Flags every direct `useQuery` / `useInfiniteQuery` call. Autofix rewrites to `useClassedQuery(/* TODO: pick a queryClass A|B|C|D|E */ 'B', ...args)`. |
| `tools/eslint-rules/require-query-class.test.js` | RuleTester coverage — valid `useClassedQuery` / `useCRUD({ queryClass })` cases and invalid raw `useQuery` cases including the expected fix output. |
| `tools/eslint-rules/precise-invalidation.js` | Flags `queryClient.invalidateQueries(...)` whose `queryKey` is a 1-element array. Supplies a *suggestion* (not auto-applied) to add a second segment with a TODO. |
| `tools/eslint-rules/precise-invalidation.test.js` | RuleTester coverage for both the object-form and direct-array invalidation shapes. |
| `tools/eslint-rules/index.js` | Plugin entry; exports `local/require-query-class` and `local/precise-invalidation`, plus a `recommended` config preset. |

### Deltas / docs

| Path | Purpose |
|------|---------|
| `_deltas/P2-deps.md` | Lists the two npm deps the integration PR must add: `idb` and `@tanstack/react-query-persist-client`. No devDependencies needed. |
| `_deltas/P2-summary.md` | This file. |

## Required new dependencies

See `_deltas/P2-deps.md`. Short version:

```bash
cd frontend
npm install idb@^8.0.0 @tanstack/react-query-persist-client@^5.100.0
```

## Integration notes

When the integration PR lands, the following one-line wiring is needed
in the app shell. **None of these touch files we owned in P2; they are
edits handed off to the next phase.**

1. **`frontend/src/App.tsx`** — replace the inline `const queryClient = new QueryClient(...)` block with an import of the centralized client and call `setupPersistence` once at boot:

   ```ts
   import { queryClient } from './data/queryClient';
   import { setupPersistence } from './data/persister';

   // At module scope, before render:
   setupPersistence(queryClient);
   ```

   The existing `<QueryClientProvider client={queryClient}>` JSX stays.

2. **`frontend/eslint.config.js`** — register the local plugin and turn the rules on:

   ```ts
   import localPlugin from '../tools/eslint-rules/index.js';

   export default [
     // ...existing configs
     {
       plugins: { local: localPlugin },
       rules: {
         'local/require-query-class': 'error',
         'local/precise-invalidation': 'warn',
       },
     },
   ];
   ```

3. **`frontend/package.json`** — add the two runtime deps from `_deltas/P2-deps.md`.

4. **Migration sweep** — run `npx eslint --fix 'src/**/*.{ts,tsx}'`, then resolve each `TODO: pick a queryClass` marker using the table in `frontend/src/data/migrate-useCRUD.md`.

## Constraints honored

- Did not modify `frontend/package.json`, `frontend/src/App.tsx`, `frontend/src/hooks/useCRUD.ts`, or the existing `frontend/src/hooks/useFirestoreLive.ts`.
- All public APIs fully typed with generics; uses TanStack Query's `QueryKey`, `UseQueryOptions`, `UseMutationOptions`, `Persister`, `PersistedClient`.
- New tests written with Vitest for the v2 Firestore hook and with ESLint's `RuleTester` for both lint rules.

## Acceptance criteria coverage

| Requirement | Where implemented |
|-------------|-------------------|
| R2.1 — every hook declares a class; lint enforces it | `useClassedQuery.ts`, `tools/eslint-rules/require-query-class.js` |
| R2.3 — no broad invalidations | `tools/eslint-rules/precise-invalidation.js` |
| R2.4 — optimistic create/edit with rollback | `useOptimisticMutation.ts` |
| R2.5 — persistent IDB query cache | `idb-persister.ts`, `persister.ts` |
| R2.6 — Firestore listeners time-boxed to 30 min idle | `useFirestoreLive.v2.ts` |
