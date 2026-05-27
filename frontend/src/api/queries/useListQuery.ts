import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';

type ListShape<TItem> = {
  items?: TItem[];
  total?: number;
};

export interface ListQueryData<TItem, TRaw> {
  items: TItem[];
  total: number;
  raw: TRaw;
}

interface UseListQueryOptions<TItem, TRaw, TError = Error>
  extends Omit<
    UseQueryOptions<ListQueryData<TItem, TRaw>, TError>,
    'queryKey' | 'queryFn' | 'staleTime'
  > {
  queryKey: QueryKey;
  queryFn: () => Promise<TRaw | AxiosResponse<TRaw>>;
  selectList?: (raw: TRaw) => { items: TItem[]; total: number };
}

const STALE_TIME_MS = 30_000;

function unwrapAxiosData<T>(value: T | AxiosResponse<T>): T {
  if (
    value &&
    typeof value === 'object' &&
    'data' in value &&
    'status' in value &&
    'headers' in value
  ) {
    return (value as AxiosResponse<T>).data;
  }
  return value as T;
}

function normalizeListPayload<TItem>(payload: unknown): { items: TItem[]; total: number } {
  if (Array.isArray(payload)) {
    return { items: payload as TItem[], total: payload.length };
  }

  const maybeList = payload as ListShape<TItem> | undefined;
  const items = Array.isArray(maybeList?.items) ? maybeList.items : [];
  const total = typeof maybeList?.total === 'number' ? maybeList.total : items.length;

  return { items, total };
}

export function useListQuery<TItem, TRaw = ListShape<TItem>, TError = Error>({
  queryKey,
  queryFn,
  selectList,
  ...options
}: UseListQueryOptions<TItem, TRaw, TError>) {
  return useQuery<ListQueryData<TItem, TRaw>, TError>({
    queryKey,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      const response = await queryFn();
      const raw = unwrapAxiosData(response);
      const normalized = selectList ? selectList(raw) : normalizeListPayload<TItem>(raw);
      return {
        items: normalized.items,
        total: normalized.total,
        raw,
      };
    },
    ...options,
  });
}

