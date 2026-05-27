# Design: Phase 5 — Platform UX + DevOps

## ChatterWidget

```tsx
// frontend/src/components/chatter/ChatterWidget.tsx
interface Props {
  entityType: 'invoice' | 'bill' | 'quote' | 'so' | 'po' | 'contact' | 'crm_lead' | 'hr_employee';
  entityId: string;
  showFollowers?: boolean;
  showActivities?: boolean;
}
```

Uses React Query keys `['chatter', entityType, entityId]`. Posts to `POST /api/chatter/{type}/{id}/messages`.

Embedded in:
- `pages/Invoices.tsx` detail view
- `pages/Bills.tsx`
- `features/sales/quotes/QuoteForm.tsx`
- `features/sales/sales-orders/SalesOrderForm.tsx`
- `features/purchases/purchase-orders/POForm.tsx`
- `pages/Contacts.tsx`
- `pages/CRMLeads.tsx`
- `pages/HREmployees.tsx`

## React Query Migration Pattern

```tsx
// frontend/src/api/queries/invoices.ts
export const invoicesKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoicesKeys.all, 'list'] as const,
  list: (filters: Filters) => [...invoicesKeys.lists(), filters] as const,
  details: () => [...invoicesKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoicesKeys.details(), id] as const,
};
export function useInvoicesList(filters: Filters) {
  return useQuery({ queryKey: invoicesKeys.list(filters), queryFn: () => api.get('/invoices', { params: filters }).then(r => r.data) });
}
```

Pages migrate from `useState`/`useEffect`/`api.get` to `useInvoicesList(filters)`. Mutations use `useMutation` + `queryClient.invalidateQueries`.

## DevOps Changes

`Dockerfile`:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/api/health || exit 1
```

`backend/app/main.py`:
```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
if settings.SENTRY_DSN:
    sentry_sdk.init(dsn=settings.SENTRY_DSN, integrations=[FastApiIntegration()], ...)
```

`backend/app/logging_config.py`:
```python
from pythonjsonlogger import jsonlogger
handler = logging.StreamHandler()
handler.setFormatter(jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(name)s %(request_id)s %(user_id)s %(org_id)s %(message)s'))
```

`.github/workflows/deploy-cloudrun.yml`:
```yaml
needs: [ci, quality]
env:
  ...full env list...
  REGION: me-central1
```

`.github/workflows/deploy-firestore.yml` (new): triggered on path changes; runs `firebase deploy --only firestore:rules,firestore:indexes`.

`backend/app/middleware/rate_limit.py` — extend to support `RedisStorage` from slowapi when `REDIS_URL` set.

`DISASTER_RECOVERY.md` — sections: Restore from backup, Roll back Cloud Run, Rotate secrets, Re-run audit scripts.

## Performance Caching

`backend/app/services/reports_cache.py` (new) — `get_or_compute(key, compute_fn, ttl=300)` writing to `reports_cache` collection.

`backend/app/api/metrics.py` — Prometheus exposition format using `prometheus_client`.
