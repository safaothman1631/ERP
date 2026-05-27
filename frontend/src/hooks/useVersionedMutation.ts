/**
 * Wave C7 — React Query helper for If-Match optimistic concurrency.
 */
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';

export type VersionedMutateFn<TData, TVariables> = (
  variables: TVariables,
  version: number | undefined,
) => Promise<TData>;

export function useVersionedMutation<TData, TVariables extends { _version?: number }>(
  mutateFn: VersionedMutateFn<TData, TVariables>,
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>,
) {
  return useMutation<TData, Error, TVariables>({
    ...options,
    mutationFn: async (variables) => {
      const version = variables._version;
      return mutateFn(variables, version);
    },
  });
}

export function versionedHeaders(version?: number): Record<string, string> {
  if (version == null) return {};
  return { 'If-Match': `W/"${version}"` };
}
