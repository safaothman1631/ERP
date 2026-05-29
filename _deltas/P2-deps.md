# P2 — npm dependencies to add

These additions are needed for the Data-Fetching Class System (`P2`).
**Per the phase brief, `frontend/package.json` is not modified by this
phase.** A follow-up integration PR will add them.

## Runtime (frontend `dependencies`)

| Package | Suggested version | Why |
|---------|-------------------|-----|
| `idb` | `^8.0.0` | Promise-based wrapper around IndexedDB; used by `frontend/src/data/idb-persister.ts` and (later) by the unified POS DB wrapper from `design.md` §2.2. |
| `@tanstack/react-query-persist-client` | `^5.100.0` (track react-query) | Provides the `persistQueryClient` function and the `Persister` / `PersistedClient` types consumed by `frontend/src/data/persister.ts`. |

## Dev (frontend `devDependencies`)

None added by this phase. The ESLint rules in `tools/eslint-rules/` use
only ESLint's built-in API (`RuleTester` for tests) which is already
available via the existing `eslint` install.

## Install command (for the integration PR)

From the repo root:

```bash
cd frontend
npm install idb@^8.0.0 @tanstack/react-query-persist-client@^5.100.0
```

## Compatibility notes

- `idb@^8` is the current major as of 2025 and is published as ESM; Vite
  handles ESM-native packages natively, no extra config required.
- `@tanstack/react-query-persist-client` must be on the **same major
  version** as `@tanstack/react-query` (currently `^5.100.10`). When
  bumping React Query, bump the persist-client at the same time.
