# 🏗️ MASTER PLAN — کلۆنی Zoho Books (باشترکردنەوەی تەواو)
> **ریسێرچ:** کۆکراوەتەوە لە zoho.com/books/features.html و ١٦ URL ی تر  
> **ئامانج:** سیستەمی ئەکاونتینگی تەواوتر و باشتر لە Zoho Books بۆ کوردستان

---

## 📊 وضعیتی ئێستا vs دوای پلان

| بابەت | ئێستا | دوای هەموو قۆناغ |
|--------|-------|-----------------|
| مۆدێلی DB | ٣٨ | ٧٥+ |
| API Endpoint | ~٩٧ | ~٢٢٥ |
| لاپەڕەی Frontend | ٢٣ | ٦٧+ |
| ڕاپۆرت | ١٢ | ٢٤+ |

---

## ✅ تەواوبوو — شتەکانی هەن

| بابەت | ستاتەس |
|--------|--------|
| Quotes / Invoices / Sales Orders | ✅ |
| Purchase Orders / Credit Notes / Vendor Credits | ✅ |
| Recurring Invoices | ✅ |
| Expenses / Banking / Inventory | ✅ |
| Projects + Tasks + Timesheets | ✅ |
| Chart of Accounts + Journal Entries | ✅ |
| Tax Rates + Tax Groups | ✅ |
| Fiscal Year + Budgets | ✅ |
| Dashboard + 12 Reports | ✅ |
| Multi-currency (model) | ✅ |

---

## 🔴 قۆناغی ١ — Critical Features (Models هەن، API نییە)
> **Effort:** XL — ٢ هەفتە | **ئەیگێنت:** زۆهۆ داتابەیس + زۆهۆ باکئێند + زۆهۆ فرۆنتئێند

### ١.١ — Bank Reconciliation UI
**وەسف:** ماتچکردنی مامەڵەکانی بانک لەگەڵ فاکتوور/خەرجییەکان

| API | Path |
|-----|------|
| GET | /api/banking/accounts/{id}/reconciliation-status |
| POST | /api/banking/accounts/{id}/reconcile |
| GET | /api/banking/accounts/{id}/unreconciled |
| POST | /api/banking/transactions/{id}/match |
| POST | /api/banking/transactions/{id}/unmatch |
| POST | /api/banking/accounts/{id}/auto-match |
| POST | /api/banking/accounts/{id}/reconcile/complete |

**DB Changes:**
- خشتەی نوێ: `bank_reconciliations` (id, org_id, bank_account_id, statement_date, opening_balance, closing_balance, system_balance, difference, status, completed_at)
- field نوێ لە `bank_transactions`: `reconciliation_id`, `is_reconciled BOOLEAN`

**Frontend:** `/banking/reconciliation/{id}` — دوو ستون + auto-match + فەرق نیشاندان
**Accounting:** فەرق → journal entry (Bank Charges / Interest)

---

### ١.٢ — Bank Rules
**وەسف:** ئۆتۆماتیکی ریزبەندکردنی مامەڵەی بانک

| API | Path |
|-----|------|
| GET/POST | /api/banking/rules |
| PUT/DELETE | /api/banking/rules/{id} |
| POST | /api/banking/rules/apply |

**DB Changes:**
- خشتەی نوێ: `bank_rules` (id, org_id, name, rule_order, conditions JSON, match_all, transaction_type, account_id, contact_id, notes_template)

**Frontend:** `/banking/rules` — فۆڕمی `if [field] [operator] [value] → assign to [account]`

---

### ١.٣ — CSV Import بۆ Bank Statements
| API | Path |
|-----|------|
| POST | /api/banking/accounts/{id}/import/csv |
| POST | /api/banking/accounts/{id}/import/confirm |
| GET | /api/banking/accounts/{id}/import/template |

**Logic:** pandas parse + column mapping UI + duplicate detection + auto-apply bank rules
**Frontend:** Upload + Column Mapper + Preview + Import summary

---

### ١.٤ — Price Lists
| API | Path |
|-----|------|
| GET/POST | /api/inventory/price-lists |
| PUT/DELETE | /api/inventory/price-lists/{id} |
| GET/POST | /api/inventory/price-lists/{id}/items |
| PUT/DELETE | /api/inventory/price-lists/{id}/items/{item_id} |

**DB Changes:**
- خشتەی نوێ: `price_list_items` (id, price_list_id, item_id, custom_rate, discount_percent)
- field نوێ لە `contacts`: `price_list_id`

**Frontend:** `/settings/price-lists` + ئۆتۆماتیکی نرخ لە invoice form

---

### ١.٥ — Warehouses
| API | Path |
|-----|------|
| GET/POST/PUT/DELETE | /api/inventory/warehouses, /api/inventory/warehouses/{id} |
| GET | /api/inventory/warehouses/{id}/stock |
| GET/POST | /api/inventory/transfers |

**DB Changes:**
- خشتەی نوێ: `warehouse_stock` (warehouse_id, item_id, quantity)
- خشتەی نوێ: `stock_transfers` (from_warehouse_id, to_warehouse_id, date, status)
- خشتەی نوێ: `stock_transfer_lines` (transfer_id, item_id, quantity)

**Frontend:** `/inventory/warehouses` + `/inventory/transfers`

---

### ١.٦ — Progress Invoicing
| API | Path |
|-----|------|
| GET | /api/invoices/from-quote/{quote_id}/progress |
| POST | /api/invoices/from-quote/{quote_id}/progress |

**DB Changes:**
- field نوێ لە `invoices`: `invoice_type VARCHAR(20) DEFAULT 'standard'`
- field نوێ لە `invoice_lines`: `quote_line_id`, `progress_percent`
- خشتەی نوێ: `quote_progress` (quote_id, invoiced_amount, invoiced_percent)

**Accounting:** DR Accounts Receivable / CR Revenue (بەشی progress تەنها)

---

### ١.٧ — Retainer Invoices
| API | Path |
|-----|------|
| POST | /api/invoices/retainer |
| POST | /api/invoices/retainer/{id}/apply |
| GET | /api/contacts/{id}/retainer-credits |

**DB Changes:**
- خشتەی نوێ: `retainer_applications` (retainer_id, invoice_id, amount_applied)

**Accounting:**
- وەرگرتن: DR Cash / CR Customer Deposits (Liability 2300)
- جێبەجێکردن: DR Customer Deposits / CR Accounts Receivable

---

### ١.٨ — Credit Note → Apply to Invoice
| API | Path |
|-----|------|
| GET | /api/credit-notes/{id}/available-invoices |
| POST | /api/credit-notes/{id}/apply |
| DELETE | /api/credit-notes/applications/{id} |
| GET | /api/contacts/{id}/credit-balance |

**DB Changes:**
- خشتەی نوێ: `credit_note_applications` (credit_note_id, invoice_id, amount_applied)
- field نوێ لە `credit_notes`: `balance_remaining`, `amount_applied DEFAULT 0`

---

### ١.٩ — Early Payment Discount (Skonto)
| API | Path |
|-----|------|
| POST | /api/invoices/{id}/payment (field زیاد) |
| GET | /api/invoices/{id}/discount-amount |

**DB Changes:**
- field نوێ لە `invoices`: `discount_days`, `discount_percent`
- field نوێ لە `payments_received`: `early_discount_amount`, `early_discount_account_id`

**Accounting:** DR Cash + DR Discount Expense / CR Accounts Receivable

---

### ١.١٠ — Tax Returns
| API | Path |
|-----|------|
| GET/POST | /api/taxes/returns |
| GET | /api/taxes/returns/{id} |
| POST | /api/taxes/returns/{id}/file |
| GET | /api/taxes/returns/{id}/pdf |

**DB Changes:**
- خشتەی نوێ: `tax_returns` (org_id, period_from, period_to, total_output_tax, total_input_tax, net_tax_payable, status)

---

### ١.١١ — Fixed Asset Management
| API | Path |
|-----|------|
| GET/POST/PUT/DELETE | /api/assets |
| POST | /api/assets/{id}/depreciate |
| GET | /api/assets/{id}/depreciation-schedule |
| POST | /api/assets/{id}/dispose |

**DB Changes:**
- خشتەی نوێ: `fixed_assets` (name, asset_account_id, dep_account_id, purchase_price, salvage_value, useful_life_months, depreciation_method: straight_line/declining_balance, current_value, status)
- خشتەی نوێ: `asset_depreciation_entries` (asset_id, date, amount, journal_entry_id)

**Accounting (Straight Line):**
$$\text{مانگانە} = \frac{\text{purchase\_price} - \text{salvage\_value}}{\text{useful\_life\_months}}$$
Journal: `DR Depreciation Expense / CR Accumulated Depreciation`

**Frontend:** `/assets` — لیست + جەدوەلی کاتبەدواکەوتن + "Run Monthly Depreciation"

---

## 📄 قۆناغی ٢ — PDF + Email + Reports
> **Effort:** L — ١ هەفتە

### ٢.١ — PDF Generation
**Dependencies:** `reportlab==4.2.0`, `Pillow==10.3.0`
**Service نوێ:** `backend/app/services/pdf_generator.py`

| API | Path |
|-----|------|
| GET | /api/invoices/{id}/pdf |
| GET | /api/quotes/{id}/pdf |
| GET | /api/purchase-orders/{id}/pdf |
| GET | /api/reports/{type}/pdf |

**تایبەتمەندی:** RTL Layout + Kurdish/Arabic font + IQD Format (١,٢٥٠,٠٠٠ د.ع) + لۆگۆ + QR Code

---

### ٢.٢ — Email Send
**Dependencies:** `fastapi-mail` یان `smtplib`
**Service نوێ:** `backend/app/services/email_service.py`

| API | Path |
|-----|------|
| POST | /api/invoices/{id}/send-email |
| POST | /api/quotes/{id}/send-email |
| POST | /api/purchase-orders/{id}/send-email |

**DB Changes:**
- خشتەی نوێ: `email_logs` (entity_type, entity_id, to_email, subject, status)
- field نوێ لە `organizations`: smtp_host, smtp_port, smtp_user, smtp_password, email_from

---

### ٢.٣ — Payment Reminders (Auto)
**Dependencies:** `apscheduler==3.10.4`

| API | Path |
|-----|------|
| GET | /api/invoices/overdue |
| POST | /api/invoices/{id}/send-reminder |
| GET/PUT | /api/settings/reminders |

**DB Changes:**
- خشتەی نوێ: `reminder_settings` (before_days JSON, after_days JSON, email_template)
- field نوێ لە `invoices`: `last_reminder_sent_at`, `reminder_count`

---

### ٢.٤ — Account Transactions Report
```
GET  /api/reports/account-transactions?account_id=X&from=Y&to=Z
```
Output: هەموو مامەڵهەکانی هەژمار + running balance

### ٢.٥ — Budget vs Actual Report
```
GET  /api/reports/budget-vs-actual?budget_id=X&period=Y
```
Output: بودجە / ڕاستەقینە / فەرق / % جێبەجێکردن بۆ هەر account

### ٢.٦ — Project Profitability Report
```
GET  /api/reports/project-profitability
GET  /api/reports/project-profitability/{project_id}
```
Output: تێچوو (کات + خەرجی) / داهات (فاکتوور) / قازانج / % بۆ هەر پڕۆژە

---

## 🌐 قۆناغی ٣ — Customer + Vendor Portal
> **Effort:** L — ١ هەفتە | **Security:** token-based، بەبێ auth ئاسایی

### ٣.١ — Customer Portal

| API | Path |
|-----|------|
| POST | /api/portal/customer/access |
| GET | /api/portal/customer/{token}/invoices |
| GET | /api/portal/customer/{token}/invoices/{id}/pdf |
| POST | /api/portal/customer/{token}/invoices/{id}/pay |
| GET | /api/portal/customer/{token}/quotes/{id}/accept |
| GET | /api/portal/customer/{token}/statements |

**DB Changes:**
- خشتەی نوێ: `portal_tokens` (contact_id, token UNIQUE, token_type: customer/vendor, expires_at, is_active)

**Frontend:** `/portal/customer/{token}` — برانددار بەپێی org، بەبێ login

---

### ٣.٢ — Vendor Portal

| API | Path |
|-----|------|
| POST | /api/portal/vendor/access |
| GET | /api/portal/vendor/{token}/bills |
| GET | /api/portal/vendor/{token}/purchase-orders |
| GET | /api/portal/vendor/{token}/purchase-orders/{id}/acknowledge |
| GET | /api/portal/vendor/{token}/payments |

---

## ⚙️ قۆناغی ٤ — Automation
> **Effort:** L — ١ هەفتە

### ٤.١ — Approval Workflows

| API | Path |
|-----|------|
| GET/POST/PUT/DELETE | /api/workflows |
| POST | /api/invoices/{id}/submit-approval |
| POST | /api/invoices/{id}/approve |
| POST | /api/invoices/{id}/reject |
| GET | /api/approvals/pending |

**DB Changes:**
- خشتەی نوێ: `workflows` (entity_type, conditions JSON, approvers JSON, is_active)
- خشتەی نوێ: `approval_requests` (entity_type, entity_id, approver_id, status: pending/approved/rejected)
- ستاتەسی نوێ لە invoices: `pending_approval`

**Frontend:** `/approvals` لیستی pending + badge لە navbar

---

### ٤.٢ — Recurring Bills

| API | Path |
|-----|------|
| GET/POST/PUT/DELETE | /api/recurring-bills |
| POST | /api/recurring-bills/{id}/pause |
| POST | /api/recurring-bills/{id}/resume |

**DB Changes:**
- خشتەی نوێ: `recurring_bills` (vendor_id, template_data JSON, frequency, start/end_date, next_bill_date, status)

---

### ٤.٣ — Mileage Tracking

| API | Path |
|-----|------|
| GET/POST/PUT/DELETE | /api/mileage |
| POST | /api/mileage/{id}/convert-expense |

**DB Changes:**
- خشتەی نوێ: `mileage_logs` (user_id, date, from_location, to_location, distance_km, rate_per_km, total_amount, purpose, expense_id)
- field نوێ لە `organizations`: `mileage_rate DEFAULT 500` (IQD/km)

---

## 📦 قۆناغی ٥ — Advanced Inventory
> **Effort:** XL — ٢ هەفتە

### ٥.١ — Custom Fields

| API | Path |
|-----|------|
| GET/POST/PUT/DELETE | /api/settings/custom-fields |

**DB Changes:**
- خشتەی نوێ: `custom_field_definitions` (entity_type, field_name, field_type: text/number/date/dropdown/checkbox, options JSON)
- خشتەی نوێ: `custom_field_values` (field_def_id, entity_id, value_text, value_date, value_number)

---

### ٥.٢ — Composite Items

| API | Path |
|-----|------|
| GET/POST/PUT | /api/items/{id}/components |
| POST | /api/items/{id}/assemble |

**DB Changes:**
- field نوێ لە `items`: `item_category VARCHAR(20) DEFAULT 'simple'`
- خشتەی نوێ: `composite_components` (parent_item_id, component_item_id, quantity, cost_ratio)

---

### ٥.٣ — Serial Number / Batch Tracking

| API | Path |
|-----|------|
| GET/POST | /api/items/{id}/serials |
| GET | /api/inventory/serials/{serial}/history |
| POST | /api/invoice-lines/{id}/assign-serials |

**DB Changes:**
- field نوێ لە `items`: `tracking_type VARCHAR(20) DEFAULT 'none'`
- خشتەی نوێ: `serial_numbers` (item_id, serial_no UNIQUE, batch_no, expiry_date, status: available/sold/returned, warehouse_id)

---

### ٥.٤ — Barcode Scanning

| API | Path |
|-----|------|
| GET | /api/items/barcode/{barcode} |
| POST | /api/items/{id}/barcodes |
| GET | /api/items/{id}/barcode/image |

**DB Changes:**
- خشتەی نوێ: `item_barcodes` (item_id, barcode UNIQUE, barcode_type: EAN13/QR/Code128)

**Frontend:** `npm install react-zxing` — scan لە مۆبایل لا فۆڕمی invoice

---

## 🚀 قۆناغی ٦ — Innovation (تایبەتمەندییە نوێیەکان — باشتر لە Zoho Books)
> **Effort:** XL — ٣ هەفتە

### ٦.١ — Multi-Branch Support

| API | Path |
|-----|------|
| GET/POST/PUT/DELETE | /api/branches |
| GET | /api/reports/branch-comparison |

**DB Changes:**
- خشتەی نوێ: `branches` (org_id, name, address, city, manager_id)
- field نوێ لە `invoices`, `expenses`, `bank_accounts`, `users`: `branch_id`

---

### ٦.٢ — Kurdish Tax Compliance (مالیاتی عێراق)

| API | Path |
|-----|------|
| GET | /api/taxes/iraq-compliance |
| GET | /api/reports/withholding-tax |
| GET | /api/reports/sales-tax-iraq |

**تایبەتمەندی:**
- Withholding Tax (3-5%) — ئۆتۆماتیکی کتابەری لە پارەدانەکان
- Corporate Income Tax: 15% کۆمپانیا، 35% بانک
- Sales Tax (مبیعات) — بەپێی ناوچەی کوردستان

**DB Changes:**
- field نوێ لە `tax_rates`: `tax_category VARCHAR(20)` (vat/withholding/income/municipal)
- field نوێ لە `payments_received`, `payments_made`: `withholding_amount`

---

### ٦.٣ — WhatsApp Invoice Sending

| API | Path |
|-----|------|
| POST | /api/invoices/{id}/send-whatsapp |
| POST | /api/quotes/{id}/send-whatsapp |

**DB Changes:**
- field نوێ لە `contacts`: `whatsapp_number`
- field نوێ لە `organizations`: `whatsapp_api_key`

---

### ٦.٤ — AI Invoice OCR

| API | Path |
|-----|------|
| POST | /api/expenses/scan-receipt |
| POST | /api/bills/scan-invoice |

**Dependencies:** `pytesseract`, `easyocr` (کوردی/عەرەبی)
**Logic:** وێنە upload → OCR → auto-fill فۆڕم → کاربەر confirm

---

### ٦.٥ — PWA + Offline Mode

**Dependencies:** `npm install vite-plugin-pwa`
**Files نوێ:** `frontend/public/manifest.json` + service worker لە `vite.config.ts`
**تایبەتمەندی:** Cache API responses + offline viewing + background sync

---

### ٦.٦ — Activity Log / Audit Trail

| API | Path |
|-----|------|
| GET | /api/audit-log?entity_type=X&entity_id=Y |
| GET | /api/audit-log/user/{user_id} |

**DB Changes:**
- خشتەی نوێ: `audit_logs` (user_id, entity_type, entity_id, action: create/update/delete/send/approve, changes JSON, ip_address)

**Implementation:** FastAPI middleware ئۆتۆماتیکی هەموو POST/PUT/DELETE ثبت دەکات

---

### ٦.٧ — Reporting Tags (Divisional Accounting)

| API | Path |
|-----|------|
| GET/POST/PUT/DELETE | /api/reporting-tags |
| GET | /api/reports/by-tag/{tag_id} |

**DB Changes:**
- خشتەی نوێ: `reporting_tags` (name, color)
- خشتەی نوێ: `reporting_tag_assignments` (tag_id, entity_type, entity_id, amount)

---

## 🎨 قۆناغی ٧ — UX Excellence
> **Effort:** L — ١ هەفتە

### ٧.١ — Dark Mode
```typescript
// store.ts: theme: 'light' | 'dark'
// App.tsx: ConfigProvider darkAlgorithm
// localStorage persistence
```

### ٧.٢ — Custom Invoice Templates

| API | Path |
|-----|------|
| GET/POST/PUT | /api/settings/invoice-templates |
| POST | /api/settings/invoice-templates/{id}/set-default |

**DB Changes:**
- خشتەی نوێ: `invoice_templates` (layout: classic/modern/minimal/rtl, colors JSON, show_logo, footer_text, is_default)

**Frontend:** `/settings/invoice-templates` — ٤ قاڵبی ئامادە + live preview

---

### ٧.٣ — Advanced Dashboard Widgets

| Widget | جۆر |
|--------|-----|
| Revenue vs Expenses | Bar Chart مانگانە |
| Cash Flow | Area Chart ٦ مانگ |
| Overdue Invoices Alert | Card سوور |
| Top 5 Customers | Table |
| Top 5 Items | Table |
| Recent Activity Feed | Timeline |
| Quick Actions | Button Group |
| Project Profitability | Mini Chart |

---

### ٧.٤ — Excel/PDF Export بۆ هەموو ڕاپۆرت
**Dependencies:** `openpyxl==3.1.2`
```
GET  /api/reports/{type}/excel
GET  /api/reports/{type}/pdf
```

### ٧.٥ — Global Search (Ctrl+K)
```
GET  /api/search?q={query}&types=invoice,contact,item
```
**Frontend:** Command Palette Style — `Ctrl+K` + نتیجەی پەتاکراو بەجۆر

---

## 📈 کۆی گشتی پلان

| قۆناغ | ناو | Effort | API نوێ | لاپەڕە نوێ | DB |
|--------|-----|--------|---------|------------|-----|
| ١ | Critical Features | XL (٢هەفتە) | ٤٥ | ١٢ | ١٥ |
| ٢ | PDF + Email + Reports | L (١هەفتە) | ١٥ | ٥ | ٣ |
| ٣ | Portals | L (١هەفتە) | ١٢ | ٤ | ١ |
| ٤ | Automation | L (١هەفتە) | ١٠ | ٤ | ٣ |
| ٥ | Advanced Inventory | XL (٢هەفتە) | ١٦ | ٦ | ٦ |
| ٦ | Innovation | XL (٣هەفتە) | ١٨ | ٦ | ٥ |
| ٧ | UX Excellence | L (١هەفتە) | ١٢ | ٧ | ٤ |
| **کۆ** | | **~١٣ هەفتە** | **~١٢٨** | **~٤٤** | **~٣٧** |

---

## ⚡ ترتیبی پێشنیاری دەستپێکردن

```
قۆناغی ١ (سەربەخۆن — هەر کامیان پێش دەستبکە):
  ١.٢ Bank Rules      ← (ئەسان)
  ١.٣ CSV Import      ← (ئەسان)
  ١.٤ Price Lists     ← (ئەسان)
  ١.٥ Warehouses      ← (ئەسان)
  ١.١ Bank Reconciliation ← (دوای ١.٢+١.٣)
  ١.٦ Progress Invoice ← (Quotes هەیە ✅)
  ١.٧ Retainer        ← (دوای ١.٦)
  ١.٨ Credit Note Apply ← (Credit Notes هەیە ✅)
  ١.٩ Early Discount   ← (Payments هەیە ✅)
  ١.١٠ Tax Returns     ← (سەربەخۆ)
  ١.١١ Fixed Assets    ← (سەربەخۆ)

قۆناغی ٢:
  ٢.١ PDF ← بنەمای هەموو (پێشتر دەستپێبکە)
  ٢.٢ Email ← دوای ٢.١
  ٢.٣ Reminders ← دوای ٢.٢

قۆناغی ٣ → دوای ٢.١
قۆناغی ٤ → سەربەخۆ
قۆناغی ٥ → Custom Fields پێشتر، دواتر Composite+Serial
قۆناغی ٦ → سەربەخۆ
قۆناغی ٧ → دوای هەموو قۆناغ
```

---

## 🎯 ئامانج

**سیستەمی ئەکاونتینگی کامڵ بۆ کوردستان — باشتر لە Zoho Books Ultimate**

| بابەت | پێش | دوا |
|--------|-----|-----|
| API Endpoint | ~٩٧ | ~٢٢٥ |
| لاپەڕەی Frontend | ٢٣ | ٦٧ |
| ڕاپۆرت | ١٢ | ٢٤ |
| مۆدێلی DB | ٣٨ | ٧٥ |
| تایبەتمەندی نوێ | - | WhatsApp، AI OCR، PWA، Kurdish Tax، Multi-Branch |
