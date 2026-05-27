# Firestore client paths (root vs nested)

## Production backend (Admin SDK)

All `BaseRepository` writes use **root collections** with `org_id` on every document:

```
invoices/{id}
bills/{id}
items/{id}
payments_received/{id}
```

## Security rules

Two rule trees are active:

1. `organizations/{orgId}/...` — legacy nested layout
2. Root collections — `tenantDocRead()` / `tenantDocCreate()` matching JWT `org_id`

Client SDK reads/writes MUST use the same path as the backend for realtime features.

## Do not

- Read another org's `org_id` via document id guess (API enforces `get()` guard)
- Expect SQL-style joins; use denormalized fields on headers
