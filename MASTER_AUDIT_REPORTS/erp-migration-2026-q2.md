# Migration Audit — 2026-Q2
**Agent:** ERP Migration | **Date:** 2026-04-24

## A. Coverage

**Import (4 entities):** contacts، items، accounts، bank_transactions. Preview (first 10 rows)، dry-run validation، CSV/Excel parsing (openpyxl). Endpoints: `/api/import/preview`، `/api/import/{entity_type}?dry_run=true/false`. NO UI wizard، NO templates، NO column mapping.

**Export (16 entities):** invoices، bills، journal-entries، trial-balance، customers، products، pos-sales، inventory، profit-loss، balance-sheet، cash-flow، aging-receivables، aging-payables، sales-by-customer، sales-by-item، tax-summary. Excel (RTL-aware) + CSV via `export_service.py`. All via `/api/export/{entity}?format=excel|csv&date_from=&date_to=`.

**Partial:** Opening balance field exists on bank_accounts + COA seed (no import wizard). Bank CSV import basic with duplicate detection (date+ref+amount).

## B. Top 10 Gaps

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| 1 | No opening balance (trial balance) import wizard | P0 — Day-One migration blocker | M |
| 2 | No column mapping UI | P0 — unusable for real imports | L |
| 3 | No migration from Odoo/QuickBooks/Zoho Books/SAP | P0 — competitor advantage | XL |
| 4 | No import templates download (sample xlsx/csv) | P1 — user confusion | S |
| 5 | No rollback capability | P1 — data safety risk | M |
| 6 | No import job tracking/polling (background jobs) | P1 — UX for large imports | M |
| 7 | No duplicate detection/merge UI (fuzzy match) | P1 — data quality issue | L |
| 8 | No invoice/bill import with lines (multi-row per doc) | P2 — limited migration scope | M |
| 9 | No import for: payments، employees، lots/serials، journals | P2 — incomplete toolkit | L |
| 10| No incremental import (update vs create-only) | P2 — re-import impossible | M |

## C. Quick Wins

- QW-1: Template download — `/api/imports/templates/{type}` returning sample xlsx — 1h
- QW-2: Column auto-detect — return `{detected: {col_a: 'name'}}` from preview — 2h
- QW-3: Duplicate merge UI — preview shows "(exists)" tag + skip/update — 3h
- QW-4: Opening balance import — entity `opening_balances` → single JE — 4h
- QW-5: Invoice/bill line import — parse sub-rows grouped by number — 4h
- QW-6: Rollback endpoint — tag with `import_job_id`، `/api/imports/{id}/rollback` — 3h
- QW-7: Import job tracking — `import_jobs` collection با state + error log — 3h
- QW-8: Payments import — basic payment record creation — 2h

## D. Big Rocks

- BR-1: Column mapping wizard (3-step UI: Upload → Map → Preview) — 2d
- BR-2: Odoo XML-RPC migration (pull partners/products/invoices/accounts با odoo_id tracking) — 3d
- BR-3: QuickBooks IIF import (legacy format → contacts/items/invoices) — 2d
- BR-4: Zoho Books API sync (OAuth + pull all entities) — 2d
- BR-5: Background job processor (APScheduler/Celery + SSE progress) — 2d
- BR-6: Fuzzy duplicate detection (phonetic + Levenshtein) — 1.5d
- BR-7: Incremental update mode (match by SKU/email/code) — 1d
- BR-8: SAP CSV standardization (predefined mappings) — 1.5d

## E. Sources Odoo Supports
1. Excel/CSV (universal)
2. Odoo 13-19 (XML-RPC)
3. QuickBooks IIF (legacy)
4. QuickBooks CSV
5. Zoho Books (OAuth API)
6. SAP Business One (CSV)
7. Xero CSV
8. FreshBooks CSV
9. Sage 50
10. Wave Accounting

## F. Zoho Migration Features
1. Import Wizard (drag-drop، auto-map، preview)
2. Opening Balances (validates debit==credit)
3. Duplicate Detection (fuzzy + merge/skip UI)
4. Rollback (24h undo)
5. Incremental Import (match by ID/SKU/email)
6. Multi-entity (invoice with lines)
7. Templates download
8. Validation Report
9. Background Processing (>5MB + email notification)
10. Native Zoho Books OAuth migration

## G. Counts
- Import endpoints: 2 | Export endpoints: 16 | Importable entities: 4 | Migration sources: 0 | Frontend wizards: 0
- P0: 3 | P1: 4 | P2: 3 | QW: 8 | BR: 8

## H. Lead + Skills

**Lead:** ERP Migration | **Skills:** backend/firestore-patterns، frontend/antd-rtl-patterns، meta/verification-loop
**Priority:** Opening balance wizard (Day-One) → Column mapping UI → Odoo/QB migration → Background jobs
**Success metric:** Migrate 1 real company from Excel in <30 min بێ هیچ manual SQL/Firestore edit
