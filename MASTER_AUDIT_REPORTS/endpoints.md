# Endpoint Audit Report

Generated: 2026-04-22T20:39:42.928Z

- Backend routes registered: **600**
- Distinct frontend API calls: **363** (across 454 call sites)
- ✅ Healthy: **343**
- ⚠️  Method mismatch: **2**
- ❌ Endpoint not registered: **18**

## ❌ Missing endpoints (frontend calls a path that the backend does not expose)

| Method | Path | Hits | First call site |
|--------|------|------|-----------------|
| POST | `/api/credit-notes/{x}/{x}` | 1 | frontend\src\pages\CreditNotes.tsx:49 |
| GET | `/api/credit-notes/{x}/applications` | 3 | frontend\src\pages\CreditNotes.tsx:78 |
| DELETE | `/api/credit-notes/{x}/applications/{x}` | 1 | frontend\src\pages\CreditNotes.tsx:111 |
| GET | `/api/delivery-challans` | 1 | frontend\src\pages\DeliveryChallans.tsx:25 |
| POST | `/api/delivery-challans` | 1 | frontend\src\pages\DeliveryChallans.tsx:64 |
| PUT | `/api/delivery-challans/{x}` | 1 | frontend\src\pages\DeliveryChallans.tsx:61 |
| DELETE | `/api/delivery-challans/{x}` | 1 | frontend\src\pages\DeliveryChallans.tsx:81 |
| GET | `/api/fiscal/budgets` | 1 | frontend\src\pages\Settings.tsx:533 |
| POST | `/api/fiscal/budgets` | 1 | frontend\src\pages\Settings.tsx:546 |
| DELETE | `/api/fiscal/budgets/{x}` | 1 | frontend\src\pages\Settings.tsx:552 |
| POST | `/api/fiscal/years/{x}/close` | 1 | frontend\src\pages\Settings.tsx:492 |
| POST | `/api/invoices/{x}/apply-retainer` | 1 | frontend\src\pages\Invoices.tsx:108 |
| POST | `/api/purchase-orders/{x}/{x}` | 1 | frontend\src\pages\PurchaseOrders.tsx:43 |
| POST | `/api/quotes/{x}/{x}` | 1 | frontend\src\pages\Quotes.tsx:36 |
| POST | `/api/recurring-invoices/{x}/{x}` | 1 | frontend\src\pages\RecurringInvoices.tsx:53 |
| GET | `/api/reports/{x}/{x}` | 1 | frontend\src\pages\Reports.tsx:79 |
| POST | `/api/sales-orders/{x}/{x}` | 1 | frontend\src\pages\SalesOrders.tsx:43 |
| POST | `/api/vendor-credits/{x}/{x}` | 1 | frontend\src\pages\VendorCredits.tsx:43 |

## ⚠️  Method mismatch (path exists, but wrong HTTP verb)

| Called | Path | Allowed | Hits | First call site |
|--------|------|---------|------|-----------------|
| POST | `/api/fiscal/years` | GET | 1 | frontend\src\pages\Settings.tsx:484 |
| DELETE | `/api/recurring-invoices/{x}` | GET | 1 | frontend\src\pages\RecurringInvoices.tsx:57 |

## ✅ Healthy endpoints (sample, first 60)

| Method | Path | Hits |
|--------|------|------|
| GET | `/api/contacts` | 18 |
| GET | `/api/items` | 16 |
| GET | `/api/accounts` | 10 |
| GET | `/api/pos/configs` | 5 |
| PUT | `/api/expense-claims/{x}` | 4 |
| GET | `/api/hr/employees` | 4 |
| GET | `/api/invoices` | 4 |
| GET | `/api/banking/accounts` | 3 |
| GET | `/api/credit-notes/{x}/available-invoices` | 3 |
| GET | `/api/pos/categories` | 3 |
| PUT | `/api/pos/employees/{x}` | 3 |
| GET | `/api/pos/loyalty/cards` | 2 |
| GET | `/api/inventory/serials` | 2 |
| GET | `/api/bills` | 2 |
| PUT | `/api/branches/{x}` | 2 |
| GET | `/api/crm/stages` | 2 |
| GET | `/api/einvoice/report/monthly` | 2 |
| GET | `/api/einvoice/report/errors` | 2 |
| POST | `/api/einvoice/submit/{x}` | 2 |
| GET | `/api/einvoice/qr/{x}` | 2 |
| POST | `/api/invoices/{x}/send` | 2 |
| PUT | `/api/items/{x}` | 2 |
| GET | `/api/manufacturing/boms` | 2 |
| GET | `/api/manufacturing/work-centers` | 2 |
| GET | `/api/pos/pricelists` | 2 |
| GET | `/api/pos/payment-methods` | 2 |
| GET | `/api/pos/sessions` | 2 |
| GET | `/api/pos/floors` | 2 |
| GET | `/api/pos/floors/{x}/tables` | 2 |
| POST | `/api/pos/gift-cards` | 2 |
| GET | `/api/pos/sessions/{x}` | 2 |
| GET | `/api/pos/products/lookup` | 2 |
| POST | `/api/pos/orders` | 2 |
| GET | `/api/rbac/roles` | 2 |
| GET | `/api/fiscal/years` | 2 |
| GET | `/api/system/exchange-rates` | 2 |
| PUT | `/api/shipments/{x}` | 2 |
| GET | `/api/inventory/warehouses` | 2 |
| POST | `/api/pos/hardware/print-receipt` | 1 |
| POST | `/api/pos/hardware/open-cash-drawer` | 1 |
| POST | `/api/pos/hardware/scale-read` | 1 |
| GET | `/api/pos/hardware/customer-display/{x}` | 1 |
| POST | `/api/pos/hardware/customer-display/{x}/update` | 1 |
| POST | `/api/pos/hardware/iot/status` | 1 |
| GET | `/api/pos/reports/dashboard` | 1 |
| GET | `/api/pos/reports/sales-by-product` | 1 |
| GET | `/api/pos/reports/sales-by-category` | 1 |
| GET | `/api/pos/reports/sales-by-cashier` | 1 |
| GET | `/api/pos/reports/sessions-summary` | 1 |
| GET | `/api/pos/reports/hourly-heatmap` | 1 |
| POST | `/api/pos/hooks/iraq/einvoice` | 1 |
| POST | `/api/pos/hooks/accounting/post-session` | 1 |
| POST | `/api/pos/hooks/inventory/pick-order` | 1 |
| GET | `/api/pos/gift-cards` | 1 |
| POST | `/api/pos/employees/login` | 1 |
| GET | `/api/pos/gift-cards/{x}` | 1 |
| POST | `/api/pos/gift-cards/{x}/charge` | 1 |
| POST | `/api/pos/customers/quick-create` | 1 |
| POST | `/api/pos/orders/{x}/draft` | 1 |
| POST | `/api/pos/orders/{x}/ship-later` | 1 |
