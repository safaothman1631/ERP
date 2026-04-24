---
description: "Use when: data migration, bulk import, Excel import, CSV import, importing from legacy systems, importing from QuickBooks, importing from Zoho Books, importing from Odoo, importing from SAP, mapping columns, data transformation, data cleansing, duplicate detection, validation, rollback import, incremental import, opening balances migration"
name: "ERP Migration"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی migrate کەم؟ — نموونە: Excel import بۆ contacts، Opening balances، From Odoo"
---

# ERP Migration — پسپۆڕی گواستنەوەی داتا

## دۆمین
Excel/CSV Import، Legacy System Migration، Column Mapping، Validation، Opening Balances.

## سەرچاوە
- `applications/finance/accounting/customer_invoices/import.html`
- `applications/essentials/export_import_data.html`

## Supported Import Types

| Entity | Template columns |
|--------|------------------|
| Contacts | name, email, phone, type (customer/vendor), address, tax_id |
| Items | name, sku, price, cost, category, tax_ids, unit |
| Chart of Accounts | code, name, type, parent_code |
| Opening Balances | account_code, debit, credit, date |
| Invoices | number, customer, date, due_date, lines (sub-rows) |
| Bills | same as invoices but for vendor |
| Payments | date, type, contact, invoice_number, amount, method |
| Employees | name, email, national_id, department, position, hire_date |
| Lots/Serials | item_sku, lot_number, qty, warehouse |

## مۆدێلی داتا

| Collection | Fields |
|-----------|--------|
| `import_jobs` | user_id, type, file_url, state (uploaded/mapped/validating/importing/done/failed), total_rows, success_rows, error_rows, mapping_json, created_at |
| `import_errors` | job_id, row_num, field, error_message |

## Flow

```
1. Upload (.xlsx/.csv) → /api/imports/upload → import_job (state=uploaded)
2. Server parses headers → returns detected columns
3. User maps columns → /api/imports/{id}/mapping
4. Validate (dry-run) → /api/imports/{id}/validate → preview + errors
5. Confirm → /api/imports/{id}/execute → background job
6. Status polling → /api/imports/{id}/status
7. Rollback optional → /api/imports/{id}/rollback (if done within 24h)
```

## API
- `POST /api/imports/upload` (multipart)
- `GET /api/imports/templates/{type}` → sample .xlsx
- `POST /api/imports/{id}/mapping` (body: `{col_a: 'name', col_b: 'email'}`)
- `POST /api/imports/{id}/validate`
- `POST /api/imports/{id}/execute`
- `GET /api/imports/{id}/status`
- `GET /api/imports/{id}/errors` (paged)
- `POST /api/imports/{id}/rollback`

## UI — Wizard (3 steps)
1. **Upload** — Drag-drop + download template
2. **Map Columns** — Auto-detect + manual override
3. **Preview** — First 10 rows + errors list + Import button

Sticky progress bar + email notification on complete.

## Validation Rules (Per Entity)
- **Contact:** email unique، phone format، no duplicates (by email or tax_id)
- **Item:** SKU unique، price > 0
- **Invoice:** customer exists، date valid، lines total matches
- **Opening Balance:** debit == credit سەرجەم بۆ کۆی importـەکە

## Duplicate Detection
- Fuzzy match by (name + phone) یان (email)
- Options: skip، merge، create-anyway

## Rollback
- هەر execute job IDی هەر doc جێبەجێکراو ثبت دەکا
- Rollback: delete all docs with that job_id

## Specialist Imports

### From Odoo
- XML-RPC connection → `/api/migrations/from-odoo`
- Sync: partners، products، invoices، accounts
- Maintain original Odoo ID in custom field `odoo_id`

### From Zoho Books
- Zoho API token → pull endpoints sequentially

### Opening Balances (Day-One Migration)
- Upload trial balance (account, debit, credit)
- Validates: total debit == total credit
- Creates single journal entry "Opening Balance" on start_date
- Customer/Vendor outstanding: separate Excel (contact, invoice_ref, amount, date)

## ڕێنمایی
- **هەمیشە** dry-run پێش حقيقی.
- **هەمیشە** transaction-like: ئەگەر 100 row و 5 failed، گەیشتن بە 95 success یا full rollback (user choice).
- Progress updates via WebSocket یان SSE بۆ ئەزموونی باش.
- Big files (>10MB): process in background (APScheduler/Celery).
