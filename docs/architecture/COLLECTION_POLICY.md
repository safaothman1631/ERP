# Firestore collection policy

**Project:** `zoho-83cda` · **Spec:** database-foundation-excellence (Wave D)

## Principles

1. **Tenant isolation:** Every business document includes `org_id` and is queried with `org_id == <tenant>`.
2. **Soft delete:** Prefer `deleted_at` over hard delete; hard delete runs FK checks via `references.py`.
3. **Versioning:** Hot collections carry `_version` (optimistic lock) and `schema_version` (migrations).
4. **Size limits:** Parent docs warn at 600 KiB, fail at 950 KiB (`BaseRepository._check_doc_size`).
5. **Sub-collections:** Line items, chatter, and audit overflow use sub-collections — never unbounded arrays on parents.

## Layout (core accounting)

| Collection | Parent fields | Sub-collections / notes |
|------------|---------------|------------------------|
| `contacts` | PII encrypted fields; `schema_version` 2 | — |
| `invoices` | Header totals; `lines` in sub-collection `lines` when migrated | Max ~50 lines per invoice in parent until split |
| `bills` | Same as invoices | `lines` sub-collection |
| `items` | SKU, qty_on_hand | `warehouse_stock` for multi-warehouse |
| `journal_entries` | Header + balanced flag | `lines` sub-collection |
| `audit_logs` | Hash chain; payload ≤ 100 KiB | Large bodies → GCS pointer (future) |
| `idempotency_keys` | TTL on `expires_at` | 24h default |
| `outbox_events` | `status`, `event_type`, `payload` | Dispatcher at 60s interval |
| `gl_account_balances` | Materialised when `GL_MATERIALISATION_ENABLED` | Key: `{org}_{period}_{account}` |

## TTL collections

Configured in `firestore.indexes.json` `fieldOverrides` on `expires_at`:

- `idempotency_keys`, `sessions`, `rate_limit_buckets`, `ocr_cache`, `webhook_inbox`

Writers must set `expires_at` as a Firestore `Timestamp` at create time.

## Naming

- Collection names: `snake_case`, plural (`invoices`, not `invoice`)
- FK fields: `{entity}_id` (`contact_id`, `account_id`)
- Audit fields: `created_at`, `updated_at`, `deleted_at`, `org_id`

Run `python backend/tools/lint_naming.py` in CI.
