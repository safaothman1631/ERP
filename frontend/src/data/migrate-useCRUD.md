# Migrating to the classed data-fetching system

This guide walks an existing `useCRUD` / `useQuery` call site through the
P2 data-layer migration. After P2, every list/detail query in the app
must declare one of five freshness classes (`A` … `E`) via
`useClassedQuery` (or `useCRUD({ queryClass })` once that hook is extended).

See `frontend/src/data/queryClasses.ts` for the canonical class table.

## Why this matters

Before P2, every query used the global default (5-minute staleTime, 30-minute
gcTime, focus-refetch on). That was wrong in both directions:

- **Too eager** for cold reference data (Currencies, Countries) — refetched
  needlessly on every focus.
- **Too lazy** for hot transactional data (open POS carts) — could be
  10 minutes stale before the user noticed.

The class system makes the right behaviour the default by binding it to the
*kind* of data, not the page.

## Migration recipe — `useQuery` → `useClassedQuery`

### Before

```ts
import { useQuery } from '@tanstack/react-query';

const invoices = useQuery({
  queryKey: ['invoices', tenantId],
  queryFn: () => api.invoices.list(tenantId),
});
```

### After

```ts
import { useClassedQuery } from '@/data/useClassedQuery';

const invoices = useClassedQuery(
  ['invoices', tenantId],
  () => api.invoices.list(tenantId),
  'B', // Hot transactional — see queryClasses.ts
);
```

The shapes are identical (`isLoading`, `data`, `error`, etc.). No call site
needs to change beyond the import and the one extra argument.

## Migration recipe — `useCRUD` style page

Existing pages use the local `useCRUD` hook (in `frontend/src/hooks/useCRUD.ts`)
which manages a separate `useState`. The data-layer rewrite plans to move
those onto React Query proper. Until then, the *list fetch* call inside the
page should be migrated independently:

### Before

```ts
const [data, setData] = useState<Invoice[]>([]);
const [total, setTotal] = useState(0);

const fetchData = async (silent?: boolean) => {
  if (!silent) setLoading(true);
  const res = await api.invoices.list(tenantId);
  setData(res.items);
  setTotal(res.total);
  setLoading(false);
};

const rt = useCRUD(setData, setTotal, fetchData);
```

### After

```ts
import { useClassedQuery } from '@/data/useClassedQuery';
import { useOptimisticMutation } from '@/data/useOptimisticMutation';

const invoicesQuery = useClassedQuery(
  ['invoices', tenantId],
  () => api.invoices.list(tenantId),
  'B',
);

const createInvoice = useOptimisticMutation<Invoice, NewInvoice, Invoice[]>({
  mutationFn: (draft) => api.invoices.create(draft),
  queryKey: ['invoices', tenantId],
  applyOptimistic: (draft, current) => [
    { ...draft, id: `temp-${Date.now()}` } as Invoice,
    ...(current ?? []),
  ],
});
```

`useCRUD`'s `sync` and `remove` go away — the optimistic mutation hook does
the same job through React Query's cache.

## Codemod sketch

For a mechanical sweep across the ~250 call sites, the lint rule
`local/require-query-class` does most of the work via its autofix
(`eslint --fix`). It rewrites `useQuery(...)` to
`useClassedQuery(/* TODO: pick a queryClass A|B|C|D|E */ 'B', ...)`,
leaving an explicit `TODO` for the reviewer to choose the right class.

```bash
# Run from frontend/
npx eslint --fix 'src/**/*.{ts,tsx}'

# Then sweep for outstanding TODOs:
git grep -n "TODO: pick a queryClass"
```

A reviewer picks the class for each match using the table below.

## Top-20 hottest queries — recommended class

These come from the audit feeding requirement R2. Use this list as the
default mapping when a `TODO` marker fires.

| # | Query (queryKey root)   | Class | Reason |
|---|--------------------------|-------|--------|
| 1 | `pos-carts` (open)       | **A** | Multi-device live edit, must be real-time. |
| 2 | `kitchen-orders`         | **A** | KDS — sub-2s update SLO (R4.8). |
| 3 | `live-dashboard-tiles`   | **A** | "Sales today" tile, live counters. |
| 4 | `invoices`               | **B** | Hot transactional list, user manipulates often. |
| 5 | `bills`                  | **B** | Same as invoices. |
| 6 | `sales-orders`           | **B** | Same. |
| 7 | `purchase-orders`        | **B** | Same. |
| 8 | `quotes`                 | **B** | Same. |
| 9 | `payments`               | **B** | Same. |
| 10 | `expenses`               | **B** | Same. |
| 11 | `journal-entries`        | **B** | Edited regularly during close. |
| 12 | `contacts`               | **C** | Reference, edited occasionally. |
| 13 | `items` (products)       | **C** | Same. |
| 14 | `accounts` (CoA)         | **C** | Edited at setup, occasionally after. |
| 15 | `tax-codes`              | **C** | Stable but tenant-editable. |
| 16 | `warehouses`             | **C** | Same. |
| 17 | `currencies`             | **D** | System-managed, rarely changes. |
| 18 | `countries`              | **D** | Static for the year. |
| 19 | `coa-templates`          | **D** | System-distributed. |
| 20 | `help-registry`          | **E** | Bundled with the app; only changes on deploy. |

### Notes

- **Class A** is expensive (Firestore charges per listener-second and per
  read). Audit any new class-A query in code review.
- **Class B** is the default if you're unsure — short staleTime, no polling,
  refetch on focus.
- **Class E** is for things that change only with a new app version. If
  the value is *literally* static (no chance it can ever change without a
  deploy), prefer importing it directly rather than fetching at all.

## Avoiding broad invalidations

The `local/precise-invalidation` lint rule will flag any
`queryClient.invalidateQueries({ queryKey: [SOMETHING] })` where the
queryKey has one element — that blows away the entire resource tree.

Always add a second segment (tenant id, entity id, or a filter hash):

```ts
// Bad — invalidates every invoice query in the app
queryClient.invalidateQueries({ queryKey: ['invoices'] });

// Good — invalidates only the current tenant's invoice list
queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });

// Good — invalidates only this specific invoice's detail view
queryClient.invalidateQueries({ queryKey: ['invoices', tenantId, id] });
```

## Persistent cache implications

P2 ships a persistent IDB-backed cache (see `idb-persister.ts` and
`persister.ts`). Two consequences for migration:

1. **Class A queries are never persisted.** On cold boot a class-A query
   starts empty and the live listener fills it.
2. **Class B/C/D/E queries paint instantly** on a returning user — the
   cached list from the last session shows up on first frame and a quiet
   revalidation runs in the background.

This is invisible to the call site, but it means `isLoading: true` on a
returning user becomes rare — design empty states accordingly.

## Checklist for the reviewer

When a PR migrates a page to `useClassedQuery`:

- [ ] The class letter is the right one per the table above.
- [ ] No raw `useQuery` / `useInfiniteQuery` call remains in the file.
- [ ] Any `queryClient.invalidateQueries` call has a precise (≥ 2-element) key.
- [ ] Optimistic mutations use `useOptimisticMutation` (no hand-rolled
      onMutate / onError / onSettled trios).
- [ ] No `staleTime` / `gcTime` is passed manually — the class controls them.
