# Full-text search evaluation (P3) — implemented spike

## Production default

- `SEARCH_PREFIX_ENABLED=false` — `/api/search` returns 503 until ops enable in staging.
- Enable after deploying composite indexes (`items` name/sku, `contacts` name/email).

## Implemented (J3 spike)

| Piece | Path |
|-------|------|
| Prefix query helper | `backend/app/services/search_service.py` |
| API | `GET /api/search?q=term&types=items,contacts` |
| Indexes | `firestore.indexes.json` (org_id + name/sku/email) |

Firestore pattern: `org_id == X` AND `field >= term` AND `field <= term + \uf8ff`.

### Limitations

- Prefix only (not fuzzy, not substring in middle of word).
- Case-sensitive on stored field values — normalize data or add lowercase copy fields for production.
- Max 25 results per type per request.

## External index (future)

For SKU/name search across 50k+ items per org, evaluate:

- **Typesense** or **Algolia** tenant-scoped index
- Sync on item/contact create/update via `webhook_dispatcher`

Not required for shopkeeper v1 launch.

## Enable in staging

```bash
SEARCH_PREFIX_ENABLED=true
firebase deploy --only firestore:indexes --project zoho-83cda
```
