/**
 * @file queryClasses.ts
 * @description Five-class React Query freshness configuration system.
 *
 * Implements the data-freshness classes defined in
 * `.kiro/specs/world-class-performance/requirements.md` §2 and
 * `design.md` §1.3. Every list/detail query in the app must declare
 * one of these classes via {@link useClassedQuery} or `useCRUD`.
 *
 * ## The five classes
 *
 * | Class | staleTime | gcTime | refetchOnFocus | Background refetch | Use cases |
 * |-------|-----------|--------|----------------|---------------------|-----------|
 * | **A — Real-time**       | 0         | 5 min  | yes | every 30s | POS open carts, Kitchen Display, live dashboards |
 * | **B — Hot transactional** | 30s     | 10 min | yes | none      | Invoices list, Bills, Sales Orders, Payments     |
 * | **C — Warm reference**  | 5 min     | 30 min | no  | none      | Contacts, Items, Accounts, Tax codes             |
 * | **D — Cold reference**  | 1 hour    | 24 hr  | no  | none      | Currencies, Countries, COA templates, enums      |
 * | **E — Static**          | Infinity  | 24 hr  | no  | none      | Help registry, l10n templates, e-invoice schemas |
 *
 * @see requirements.md §2 (Per-Route Class Caching & Data-Fetching Policy)
 * @see design.md §1.3 (React Query — class-based configuration)
 */

import type { UseQueryOptions } from '@tanstack/react-query';

/* ------------------------------------------------------------------------- */
/* Time constants (milliseconds)                                             */
/* ------------------------------------------------------------------------- */

/** One second in milliseconds. */
export const SEC = 1_000;
/** One minute in milliseconds. */
export const MIN = 60 * SEC;
/** One hour in milliseconds. */
export const HR = 60 * MIN;

/* ------------------------------------------------------------------------- */
/* Class configuration                                                       */
/* ------------------------------------------------------------------------- */

/**
 * Shape of a single query-class config. Designed to spread directly into
 * `useQuery({ ...config })`.
 */
export interface QueryClassConfig {
  /** ms until the data is considered stale and a refetch may be triggered. */
  staleTime: number;
  /** ms an inactive query is kept in memory before garbage collection. */
  gcTime: number;
  /** Polling interval. `false` disables background refetch. */
  refetchInterval: number | false;
  /** Whether to refetch when the window regains focus. */
  refetchOnWindowFocus: boolean;
}

/**
 * The five query classes. Reach for these via {@link useClassedQuery} —
 * raw `useQuery` calls without a class are rejected by the
 * `local/require-query-class` ESLint rule (see `tools/eslint-rules/`).
 *
 * ### When to pick each class
 *
 * - **A — Real-time.** Pick this only for surfaces where seeing 10-second-old
 *   data would surprise the user: an open POS cart on a second device, the
 *   Kitchen Display, the "today's sales" live tile. Costs Firestore reads,
 *   so use sparingly.
 * - **B — Hot transactional.** Lists the user manipulates often: Invoices,
 *   Bills, Sales Orders, Payments, Quotes. The 30-second staleTime makes
 *   the list feel live without polling.
 * - **C — Warm reference.** Lookup data the user edits occasionally:
 *   Contacts, Items (products), Chart of Accounts, Tax codes, Warehouses.
 * - **D — Cold reference.** System-managed lists that change once a month
 *   at most: Currencies, Countries, COA templates, enumerations.
 * - **E — Static.** Effectively constant for the app lifetime: bundled
 *   help registry, l10n templates, e-invoice XSD schemas. Never refetched
 *   automatically — invalidate manually on app version change.
 */
export const QUERY_CLASSES = {
  /** Real-time data: stale immediately, polls every 30s, refetches on focus. */
  A: {
    staleTime: 0,
    gcTime: 5 * MIN,
    refetchInterval: 30 * SEC,
    refetchOnWindowFocus: true,
  },
  /** Hot transactional lists: short staleTime, refetch on focus, no polling. */
  B: {
    staleTime: 30 * SEC,
    gcTime: 10 * MIN,
    refetchInterval: false,
    refetchOnWindowFocus: true,
  },
  /** Warm reference: 5-minute staleTime, no automatic refetch. */
  C: {
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  },
  /** Cold reference: 1-hour staleTime, kept a full day in cache. */
  D: {
    staleTime: 60 * MIN,
    gcTime: 24 * HR,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  },
  /** Static: never auto-refetches; survives a full day in memory. */
  E: {
    staleTime: Infinity,
    gcTime: 24 * HR,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  },
} as const satisfies Record<string, QueryClassConfig>;

/**
 * The literal-union type of the class names. Use anywhere a class is passed
 * as an argument so the compiler enforces a valid value.
 *
 * @example
 * function useInvoices(): UseQueryResult<Invoice[]> {
 *   return useClassedQuery(['invoices'], fetchInvoices, 'B' satisfies QueryClassName);
 * }
 */
export type QueryClassName = keyof typeof QUERY_CLASSES;

/**
 * Look up a class config by name. Equivalent to indexing `QUERY_CLASSES`
 * directly but useful when the class name lives in a variable.
 */
export function getQueryClassConfig(name: QueryClassName): QueryClassConfig {
  return QUERY_CLASSES[name];
}

/**
 * The metadata key under which we stash the chosen class on a query. The
 * IDB persister reads `query.meta?.queryClass` to decide whether to
 * dehydrate it (see `persister.ts`).
 *
 * Use {@link buildClassedMeta} to populate it.
 */
export const QUERY_CLASS_META_KEY = 'queryClass' as const;

/**
 * Build the `meta` object for a classed query. Always use this rather than
 * writing the key by hand — it keeps the literal in one place.
 */
export function buildClassedMeta(
  queryClass: QueryClassName,
  extraMeta?: NonNullable<UseQueryOptions['meta']>,
): NonNullable<UseQueryOptions['meta']> {
  return { ...extraMeta, [QUERY_CLASS_META_KEY]: queryClass };
}
