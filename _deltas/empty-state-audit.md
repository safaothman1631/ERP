# Empty-state + Quick-create migration audit

Generated: 2026-05-28T00:00:00.000Z (seed — refresh with `node scripts/audit-empty-states.mjs`)

This file is auto-overwritten on every audit script run. The numbers below
reflect a grep-based static survey across `frontend/src/**/*.tsx`. After EP-0
ships the AST primitives and the script can run against a healthy `node`
environment, this file will be regenerated with precise counts.

- Total .tsx files scanned: **(refresh)**
- Files with raw `<Select>`: **155**
- Files wrapped in `<SelectWithQuickCreate>`: **11**
- Files fully exempt: **0**
- Files pending migration: **144**
- Files importing Antd `Empty`: **44**
- Files using `<EmptyState>`: **(refresh)**

- Total raw `<Select>` occurrences: **373**
- Of which wrapped: **16**
- Migration percent (by occurrences): **4.3%**

## Pending files (top 30 by Select density)

| File | `<Select>` count | wrapped | exempt | status |
|------|------------------|---------|--------|--------|
| `frontend/src/settings/sections/bodies.tsx` | 35 | 0 | 0 | pending |
| `frontend/src/pages/assets/FixedAssets.tsx` | 8 | 0 | 0 | pending |
| `frontend/src/pages/banking/ImportStatement.tsx` | 6 | 0 | 0 | pending |
| `frontend/src/pages/multi-entity/IntercompanyTransactions.tsx` | 6 | 0 | 0 | pending |
| `frontend/src/pages/dms/DocumentVault.tsx` | 6 | 0 | 0 | pending |
| `frontend/src/pages/maintenance/MaintenanceRequests.tsx` | 6 | 0 | 0 | pending |
| `frontend/src/pages/pos/POSConfigs.tsx` | 6 | 0 | 0 | pending |
| `frontend/src/pages/reports/CustomReportBuilder.tsx` | 6 | 0 | 0 | pending |
| `frontend/src/pages/ProjectGantt.tsx` | 6 | 0 | 0 | pending |
| `frontend/src/pages/BankRules.tsx` | 5 | 0 | 0 | pending |
| `frontend/src/pages/approvals/ApprovalRules.tsx` | 5 | 0 | 0 | pending |
| `frontend/src/pages/plm/PLMEngineeringChanges.tsx` | 5 | 0 | 0 | pending |
| `frontend/src/pages/reports/ScheduledReports.tsx` | 5 | 0 | 0 | pending |
| `frontend/src/pages/StockLocations.tsx` | 5 | 0 | 0 | pending |
| `frontend/src/pages/AssetCategories.tsx` | 4 | 0 | 0 | pending |
| `frontend/src/pages/Assets.tsx` | 4 | 0 | 0 | pending |
| `frontend/src/pages/iot/AlertRules.tsx` | 4 | 0 | 0 | pending |
| `frontend/src/pages/MfgBOMs.tsx` | 4 | 0 | 0 | pending |
| `frontend/src/pages/dms/SignatureRequests.tsx` | 4 | 0 | 0 | pending |
| `frontend/src/pages/ExpenseForm.tsx` | 4 | 0 | 0 | pending |
| `frontend/src/pages/Users.tsx` | 4 | 0 | 0 | pending |
| `frontend/src/pages/real-estate/PropertiesAndLeases.tsx` | 4 | 0 | 0 | pending |
| `frontend/src/pages/SerialNumbers.tsx` | 4 | 0 | 0 | pending |
| `frontend/src/pages/field-service/ServiceOrders.tsx` | 4 | 0 | 0 | pending |
| `frontend/src/pages/pos/POSPricelists.tsx` | 4 | 0 | 0 | pending |
| `frontend/src/pages/pos/POSFloors.tsx` | 4 | 0 | 0 | pending |

(Run the audit script for the full list — only first 30 shown here.)

## Already migrated (partial — has at least one `<SelectWithQuickCreate>` wrap)

| File | `<SelectWithQuickCreate>` count | `<Select>` count | status |
|------|-----|-----|-----|
| `frontend/src/pages/ItemForm.tsx` | 3 | 1 | partial |
| `frontend/src/pages/InvoiceForm.tsx` | 2 | 0 | migrated |
| `frontend/src/pages/QuoteForm.tsx` | 2 | 0 | migrated |
| `frontend/src/pages/BillForm.tsx` | 1 | 2 | partial |
| `frontend/src/pages/BankReconciliation.tsx` | 1 | 0 | migrated |
| `frontend/src/pages/CycleCounts.tsx` | 1 | 2 | partial |
| `frontend/src/pages/multi-entity/CompaniesList.tsx` | 1 | 0 | migrated |
| `frontend/src/pages/maintenance/Equipment.tsx` | 1 | 3 | partial |
| `frontend/src/pages/PutawayRules.tsx` | 1 | 3 | partial |
| `frontend/src/pages/subscriptions/SubscriptionsList.tsx` | 2 | 2 | partial |
| `frontend/src/pages/helpdesk/TicketsList.tsx` | 1 | 2 | partial |
