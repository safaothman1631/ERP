/**
 * @file useOptimisticMutation.ts
 * @description Generic optimistic-mutation helper that wires up the
 * snapshot / apply / rollback / invalidate cycle documented in TanStack
 * Query's "Optimistic Updates" guide and requirement R2.4.
 *
 * The shape:
 *   1. `onMutate` cancels in-flight queries, snapshots the cache, and
 *      applies the optimistic update via `queryClient.setQueryData`.
 *   2. `onError` rolls back to the snapshot.
 *   3. `onSettled` invalidates the affected query so the server's truth
 *      eventually overwrites the optimistic value.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
 */

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

/* ------------------------------------------------------------------------- */
/* Context shape                                                             */
/* ------------------------------------------------------------------------- */

/**
 * What we hand from `onMutate` to `onError` / `onSettled`. The `previous`
 * snapshot is what we'll restore on failure; `userContext` is anything the
 * caller wants to pass through.
 */
export interface OptimisticMutationContext<TQueryData, TUserContext = void> {
  previous: TQueryData | undefined;
  userContext?: TUserContext;
}

/* ------------------------------------------------------------------------- */
/* Options                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Options accepted by {@link useOptimisticMutation}.
 *
 * `TData`       — value returned by `mutationFn`.
 * `TVariables`  — input to `mutationFn`.
 * `TQueryData`  — shape of the cached data under `queryKey`.
 * `TError`      — error type from `mutationFn`.
 */
export interface UseOptimisticMutationOptions<
  TData,
  TVariables,
  TQueryData,
  TError = Error,
> extends Omit<
    UseMutationOptions<
      TData,
      TError,
      TVariables,
      OptimisticMutationContext<TQueryData>
    >,
    'mutationFn' | 'onMutate' | 'onError' | 'onSettled'
  > {
  /** The async function that performs the mutation on the server. */
  mutationFn: (vars: TVariables) => Promise<TData>;

  /** The query key whose cache should be optimistically updated. */
  queryKey: QueryKey;

  /**
   * Pure function: given the variables and the current cached value, return
   * the new cached value. Called once on mutate.
   *
   * For a "create": prepend the new item to the list.
   * For an "edit":  map and replace by id.
   * For a "delete": filter out the id. (R2.4 forbids optimistic deletes —
   * but this helper does not enforce that; the caller's review does.)
   */
  applyOptimistic: (vars: TVariables, current: TQueryData | undefined) => TQueryData;

  /**
   * Extra query keys to invalidate after the mutation settles. The primary
   * `queryKey` is always invalidated; this is for related caches (e.g. a
   * dashboard tile that aggregates the list).
   */
  alsoInvalidate?: QueryKey[];

  /**
   * Optional `onSuccess` callback fired after the server returns. Provided
   * separately from the spread of UseMutationOptions to keep typing clean.
   */
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: OptimisticMutationContext<TQueryData>,
  ) => void | Promise<void>;

  /** Optional error toast / logging hook. */
  onErrorCallback?: (
    error: TError,
    variables: TVariables,
    context: OptimisticMutationContext<TQueryData> | undefined,
  ) => void;
}

/* ------------------------------------------------------------------------- */
/* The hook                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Optimistic mutation wrapper. Use for create / edit on class-A and class-B
 * lists per requirement 2.4.
 *
 * @example  // Creating an invoice optimistically
 * const createInvoice = useOptimisticMutation<Invoice, NewInvoice, Invoice[]>({
 *   mutationFn: (draft) => api.invoices.create(draft),
 *   queryKey: ['invoices', { tenantId }],
 *   applyOptimistic: (draft, current) => [
 *     { ...draft, id: `temp-${Date.now()}`, status: 'pending' } as Invoice,
 *     ...(current ?? []),
 *   ],
 *   onErrorCallback: (err) => toast.error(`Couldn't create invoice: ${err.message}`),
 * });
 *
 * // Later:
 * await createInvoice.mutateAsync(draft);
 */
export function useOptimisticMutation<
  TData,
  TVariables,
  TQueryData,
  TError = Error,
>(
  options: UseOptimisticMutationOptions<TData, TVariables, TQueryData, TError>,
): UseMutationResult<
  TData,
  TError,
  TVariables,
  OptimisticMutationContext<TQueryData>
> {
  const queryClient = useQueryClient();
  const {
    mutationFn,
    queryKey,
    applyOptimistic,
    alsoInvalidate = [],
    onSuccess,
    onErrorCallback,
    ...rest
  } = options;

  return useMutation<
    TData,
    TError,
    TVariables,
    OptimisticMutationContext<TQueryData>
  >({
    mutationFn,
    ...rest,
    onMutate: async (vars) => {
      // 1. Stop any in-flight refetches so they don't clobber our optimistic
      //    value while we're applying it.
      await queryClient.cancelQueries({ queryKey });

      // 2. Snapshot current state for rollback.
      const previous = queryClient.getQueryData<TQueryData>(queryKey);

      // 3. Apply the optimistic update.
      queryClient.setQueryData<TQueryData>(queryKey, (current) =>
        applyOptimistic(vars, current),
      );

      return { previous };
    },
    onError: (err, vars, context) => {
      // Roll back to the snapshot we took in onMutate.
      if (context) {
        queryClient.setQueryData<TQueryData | undefined>(
          queryKey,
          context.previous,
        );
      }
      onErrorCallback?.(err, vars, context);
    },
    onSettled: () => {
      // Re-fetch to reconcile with the server's truth.
      queryClient.invalidateQueries({ queryKey });
      for (const key of alsoInvalidate) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onSuccess,
  });
}
