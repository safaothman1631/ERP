/**
 * @file useClassedQuery.ts
 * @description Thin wrappers around `useQuery` and `useInfiniteQuery` that
 * force the caller to declare a {@link QueryClassName}.
 *
 * Every consumer should use these instead of TanStack's raw hooks; the
 * `local/require-query-class` ESLint rule (see `tools/eslint-rules/`) will
 * flag direct `useQuery` / `useInfiniteQuery` calls in CI.
 *
 * The class name is also stamped onto `query.meta` so the IDB persister
 * can apply the dehydration rule from design.md §1.4 ("Don't persist class A").
 *
 * @see queryClasses.ts
 * @see persister.ts
 */

import {
  useQuery,
  useInfiniteQuery,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  type InfiniteData,
} from '@tanstack/react-query';

import {
  QUERY_CLASSES,
  buildClassedMeta,
  type QueryClassName,
} from './queryClasses';

/* ------------------------------------------------------------------------- */
/* useClassedQuery                                                           */
/* ------------------------------------------------------------------------- */

/**
 * Run a classed `useQuery`. The class controls `staleTime`, `gcTime`,
 * `refetchInterval`, and `refetchOnWindowFocus` per the table in
 * `queryClasses.ts`. `extra` lets the caller override anything else
 * (e.g. `enabled`, `select`, `placeholderData`).
 *
 * @typeParam TData       Final shape returned from the query.
 * @typeParam TError      Error type (defaults to `Error`).
 * @typeParam TQueryKey   The query key tuple (defaults to `QueryKey`).
 *
 * @example
 * const invoices = useClassedQuery(
 *   ['invoices', { tenantId }],
 *   () => api.invoices.list(tenantId),
 *   'B',
 * );
 */
export function useClassedQuery<
  TData,
  TError = Error,
  TQueryKey extends QueryKey = QueryKey,
>(
  key: TQueryKey,
  fetchFn: () => Promise<TData>,
  queryClass: QueryClassName,
  extra: Partial<UseQueryOptions<TData, TError, TData, TQueryKey>> = {},
): UseQueryResult<TData, TError> {
  const classConfig = QUERY_CLASSES[queryClass];
  return useQuery<TData, TError, TData, TQueryKey>({
    queryKey: key,
    queryFn: fetchFn,
    staleTime: classConfig.staleTime,
    gcTime: classConfig.gcTime,
    refetchInterval: classConfig.refetchInterval,
    refetchOnWindowFocus: classConfig.refetchOnWindowFocus,
    ...extra,
    // meta is merged last so the queryClass tag is always present, even if
    // the caller passed their own meta.
    meta: buildClassedMeta(queryClass, extra.meta),
  });
}

/* ------------------------------------------------------------------------- */
/* useClassedInfiniteQuery                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Infinite-query analog of {@link useClassedQuery}. Pagination cursor type
 * defaults to `unknown`; tighten it for safer cursor handling.
 *
 * @example
 * const pages = useClassedInfiniteQuery(
 *   ['invoices', 'infinite'],
 *   ({ pageParam }) => api.invoices.page(pageParam as string | null),
 *   'B',
 *   {
 *     initialPageParam: null as string | null,
 *     getNextPageParam: (last) => last.nextCursor,
 *   },
 * );
 */
export function useClassedInfiniteQuery<
  TData,
  TError = Error,
  TPageParam = unknown,
  TQueryKey extends QueryKey = QueryKey,
>(
  key: TQueryKey,
  fetchFn: (ctx: { pageParam: TPageParam }) => Promise<TData>,
  queryClass: QueryClassName,
  extra: Omit<
    UseInfiniteQueryOptions<
      TData,
      TError,
      InfiniteData<TData, TPageParam>,
      TData,
      TQueryKey,
      TPageParam
    >,
    'queryKey' | 'queryFn'
  > & {
    initialPageParam: TPageParam;
    getNextPageParam: (
      lastPage: TData,
      allPages: TData[],
      lastPageParam: TPageParam,
      allPageParams: TPageParam[],
    ) => TPageParam | undefined | null;
  },
): UseInfiniteQueryResult<InfiniteData<TData, TPageParam>, TError> {
  const classConfig = QUERY_CLASSES[queryClass];
  return useInfiniteQuery<
    TData,
    TError,
    InfiniteData<TData, TPageParam>,
    TQueryKey,
    TPageParam
  >({
    queryKey: key,
    queryFn: fetchFn,
    staleTime: classConfig.staleTime,
    gcTime: classConfig.gcTime,
    refetchInterval: classConfig.refetchInterval,
    refetchOnWindowFocus: classConfig.refetchOnWindowFocus,
    ...extra,
    meta: buildClassedMeta(queryClass, extra.meta),
  });
}
