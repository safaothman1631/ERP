ئێستا زانیاریم تەواوە. وا نەخشەکە:

---

# 🏗️ نەخشەی تەواو — گۆڕانکاری Zoho Books بۆ Firebase + تایبەتمەندییەکانی نوێ

---

## 📋 خولاسەی پڕۆژە

```
📋 ناوی پڕۆژە: Zoho Books Kurdistan (Firebase Edition)
📝 وەسف: سیستەمی ئەکاونتینگی تەواو بۆ کوردستان — self-hosted backend لەگەڵ Firebase Firestore + Storage
🎯 ئامانج: کۆمپانیا بچووک/مامناوەندەکانی کوردستان — ژمێریاری و بەڕێوەبردنی دارایی
🌍 بازاڕ: کوردستانی عێراق (هەرێم + عێراقی فیدراڵی)
🗣️ زمانەکان: کوردی سۆرانی (RTL) + ئینگلیزی (LTR)
💰 دراو: IQD (بنەڕەت) + USD + multi-currency
⚙️ Stack: FastAPI + firebase-admin SDK + React 19 + Ant Design 6 + TypeScript + Vite
🔐 Auth: JWT لەسەر FastAPI (bcrypt) — Firebase Auth بەکارناهێنرێت
🗄️ DB: Firebase Firestore (Free Tier — Spark Plan)
📁 Storage: Firebase Storage (Free Tier — 5 GB)
```

---

# بەشی ١: ئارکیتێکچەری نوێ

## ١.١ — ئارکیتێکچەری گشتی

```
┌─────────────────────────────────────────────────────┐
│                   کاربەر (Browser)                    │
│              React 19 + Ant Design 6                 │
│              Zustand (state + cache)                 │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS (REST API)
                     ▼
┌─────────────────────────────────────────────────────┐
│              FastAPI Backend (Self-Hosted)            │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│   │ JWT Auth │  │ Services │  │ Firestore Client │  │
│   └──────────┘  └──────────┘  └────────┬─────────┘  │
│   ┌──────────┐  ┌──────────┐           │            │
│   │ PDF Gen  │  │ Email    │           │            │
│   └──────────┘  └──────────┘           │            │
│   ┌──────────┐                         │            │
│   │ Caching  │  ← Redis/In-Memory      │            │
│   └──────────┘                         │            │
└────────────────────────────────────────┼────────────┘
                                         │ gRPC (firebase-admin)
                     ┌───────────────────┼───────────────────┐
                     ▼                   ▼                   ▼
              ┌────────────┐    ┌──────────────┐    ┌────────────┐
              │  Firestore  │    │   Firebase    │    │  Firebase  │
              │  Database   │    │   Storage     │    │  (Auth ❌) │
              │  1GB free   │    │   5GB free    │    │ نابەکارهێ │
              └────────────┘    └──────────────┘    └────────────┘
```

## ١.٢ — چۆن Firestore بەکاردێ

**Firestore** document-based داتابەیسە، نەک relational. بۆیە:
- هەر **خشتە** = **collection**
- هەر **row** = **document** (بە auto-generated ID یان UUID)
- **line items** (invoice_lines, bill_lines, etc.) = **subcollection** لەناو documentی باوکدا
- **Joins نییە** — denormalization پێویستە (ناوی contact لەسەر invoice خۆی هەڵبگیرێت)
- **Complex queries سنووردارە** — composite indexes دروست بکرێن

### Firebase Admin SDK لە FastAPI:

```python
# backend/app/firebase_client.py
import firebase_admin
from firebase_admin import credentials, firestore, storage

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    "storageBucket": "your-project.appspot.com"
})

db = firestore.client()
bucket = storage.bucket()
```

### Config نوێ:

```python
# backend/app/config.py
class Settings(BaseSettings):
    # Firebase
    FIREBASE_CREDENTIALS_PATH: str = "serviceAccountKey.json"
    FIREBASE_STORAGE_BUCKET: str = ""
    
    # Caching
    CACHE_TTL_SECONDS: int = 300  # 5 دەقیقە
    CACHE_ENABLED: bool = True
    
    # ئەوانەی دەمێنن
    SECRET_KEY: str = "..."
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALGORITHM: str = "HS256"
    # ...باقی وەک پێشتر
```

## ١.٣ — چۆن Firebase Storage بەکاردێ

```
Firebase Storage Structure:
├── {org_id}/
│   ├── logos/
│   │   └── logo.png
│   ├── attachments/
│   │   ├── invoices/{invoice_id}/{filename}
│   │   ├── bills/{bill_id}/{filename}
│   │   ├── expenses/{expense_id}/{filename}
│   │   └── ...
│   ├── pdfs/
│   │   ├── invoices/{invoice_id}.pdf  (cached)
│   │   ├── quotes/{quote_id}.pdf
│   │   └── reports/{report_type}_{date}.pdf
│   ├── receipts/
│   │   └── {expense_id}/{filename}
│   └── imports/
│       └── bank_statements/{filename}
```

### Storage Rules (لە Firebase Console):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // تەنها backend (admin SDK) دەسترەسی هەیە
    // client-side access نییە — هەموو شت لە FastAPI تێپەڕ دەبێت
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

> **گرنگ:** کاربەر ڕاستەوخۆ Firebase Storage بەکارناهێنێت. FastAPI وەک proxy کاردەکات + auth check دەکات.

## ١.٤ — Auth چۆن ئەمێنێت

```
Auth Flow (هیچ گۆڕانکارییەک نابێت لە logicدا):

1. POST /api/auth/login {email, password}
2. FastAPI → Firestore users collection → bcrypt verify
3. ← JWT token (sub=user_id, org=org_id, role=role)
4. Frontend: localStorage.setItem("token", jwt)
5. هەر ریکوێستێک: Authorization: Bearer {jwt}
6. FastAPI middleware → jwt.decode → get user from Firestore (cached)
```

**گۆڕانکاری تەنها:**
- `db.query(User).filter(...)` → `db.collection("users").where("email", "==", email).get()`
- Password hash / verify → **هیچ ناگۆڕدرێت** (bcrypt لەسەر FastAPI ئەمێنێت)

---

# بەشی ٢: نەخشەی Firestore Collections

## ٢.١ — نەخشەی تەواوی Collections (٧٥+ collection)

### 🏢 Core Collections

```
🗄️ organizations
   doc ID: auto / UUID
   fields:
     - name: string
     - email: string
     - phone: string
     - website: string
     - tax_number: string
     - logo_url: string (Firebase Storage path)
     - address: map {line1, line2, city, state, country, postal_code}
     - settings: map {
         base_currency_code: "IQD",
         fiscal_year_start_month: 1,
         date_format: "YYYY-MM-DD",
         timezone: "Asia/Baghdad",
         language: "ku",
         industry: string,
         mileage_rate: 500,
         whatsapp_api_key: string
       }
     - smtp: map {host, port, user, password, email_from}
     - created_at: timestamp
     - updated_at: timestamp
   Indexes: نەخواستراو (تەنها بەپێی ID دەخوێندرێتەوە)

🗄️ users
   doc ID: auto / UUID
   fields:
     - org_id: string (ref → organizations)
     - name: string
     - email: string
     - password_hash: string
     - role: string (admin/accountant/viewer)
     - permissions: map {
         invoices: "full/view/none",
         bills: "full/view/none",
         banking: "full/view/none",
         reports: "full/view/none",
         settings: "full/none",
         ...
       }
     - is_active: boolean
     - last_login: timestamp
     - two_factor_enabled: boolean
     - two_factor_secret: string
     - created_at: timestamp
   Indexes:
     - (email ASC) — UNIQUE enforced in app code
     - (org_id ASC, is_active ASC)
```

### 👥 Contacts

```
🗄️ contacts
   doc ID: auto
   fields:
     - org_id: string
     - contact_type: string (customer/vendor/both)
     - company_name: string
     - display_name: string
     - first_name: string
     - last_name: string
     - email: string
     - phone: string
     - mobile: string
     - whatsapp_number: string          ← نوێ
     - website: string
     - tax_number: string
     - currency_code: string (default "IQD")
     - payment_terms_days: number
     - price_list_id: string
     - credit_limit: number              ← نوێ
     - outstanding_balance: number       ← denormalized
     - unused_credits: number            ← denormalized
     - notes: string
     - is_active: boolean
     - tags: array<string>               ← نوێ
     - custom_fields: map                ← نوێ
     - created_at: timestamp
     - updated_at: timestamp
   Indexes:
     - (org_id ASC, contact_type ASC, display_name ASC)
     - (org_id ASC, is_active ASC)
   
   Subcollections:
     📁 persons → {name, email, phone, mobile, is_primary, designation}
     📁 addresses → {type: billing/shipping, line1, line2, city, state, country, zip, is_primary}
```

### 🧾 Invoices & Sales

```
🗄️ invoices
   doc ID: auto
   fields:
     - org_id: string
     - contact_id: string
     - contact_name: string              ← denormalized
     - invoice_number: string
     - reference: string
     - order_number: string
     - date: timestamp
     - due_date: timestamp
     - status: string (draft/sent/partially_paid/paid/overdue/void/pending_approval)
     - invoice_type: string (standard/progress/retainer)
     - subtotal: number
     - discount_amount: number
     - discount_type: string
     - tax_amount: number
     - shipping_charge: number
     - adjustment: number
     - total: number
     - balance_due: number
     - currency_code: string
     - exchange_rate: number
     - notes: string
     - terms: string
     - customer_notes: string
     - discount_days: number              ← early payment
     - discount_percent: number
     - quote_id: string
     - sales_order_id: string
     - recurring_invoice_id: string
     - journal_entry_id: string
     - last_reminder_sent_at: timestamp
     - reminder_count: number
     - branch_id: string                  ← نوێ
     - approval_status: string            ← نوێ
     - custom_fields: map                 ← نوێ
     - reporting_tags: array<string>      ← نوێ
     - created_at: timestamp
     - updated_at: timestamp
   Indexes:
     - (org_id ASC, status ASC, date DESC)
     - (org_id ASC, contact_id ASC, date DESC)
     - (org_id ASC, due_date ASC) — بۆ overdue
     - (org_id ASC, invoice_number ASC) — بۆ search
   
   Subcollections:
     📁 lines → {
       item_id, item_name, account_id, description,
       quantity, unit_price, discount_percent, discount_amount,
       tax_id, tax_amount, line_total, sort_order,
       quote_line_id, progress_percent,
       serial_numbers: array<string>,      ← نوێ
       batch_number: string,               ← نوێ
       warehouse_id: string                ← نوێ
     }

🗄️ quotes
   doc ID: auto
   fields: (وەک invoices — بەڵام بەبێ balance_due، لەگەڵ expiry_date)
     - org_id, contact_id, contact_name, quote_number, reference
     - date, expiry_date, status (draft/sent/accepted/declined/expired/invoiced)
     - subtotal, discount_amount, tax_amount, shipping_charge, adjustment, total
     - currency_code, exchange_rate, notes, terms, customer_notes
     - custom_fields, reporting_tags, branch_id
   Indexes:
     - (org_id ASC, status ASC, date DESC)
   Subcollections:
     📁 lines → (وەک invoice lines)

🗄️ sales_orders
   doc ID: auto
   fields: (وەک quotes — لەگەڵ shipment_date, delivery_method)
     - status: draft/confirmed/closed/void
   Subcollections:
     📁 lines → (وەک invoice lines)

🗄️ credit_notes
   doc ID: auto
   fields:
     - org_id, contact_id, contact_name, credit_note_number
     - date, status (draft/open/closed/void)
     - subtotal, tax_amount, total, balance_remaining, amount_applied
     - currency_code, exchange_rate, notes, reason
   Indexes:
     - (org_id ASC, contact_id ASC, status ASC)
   Subcollections:
     📁 lines → {item_id, description, quantity, unit_price, tax_id, tax_amount, line_total}
     📁 applications → {invoice_id, amount_applied, date}

🗄️ payments_received
   doc ID: auto
   fields:
     - org_id, contact_id, contact_name, payment_number
     - date, amount, currency_code, exchange_rate
     - payment_mode (cash/bank_transfer/cheque/card)
     - bank_account_id, reference, notes
     - early_discount_amount, early_discount_account_id
     - journal_entry_id
   Subcollections:
     📁 allocations → {invoice_id, amount_applied}

🗄️ recurring_invoices
   doc ID: auto
   fields:
     - org_id, contact_id, contact_name, profile_name
     - frequency (weekly/monthly/yearly/custom)
     - custom_interval, custom_unit
     - start_date, end_date, next_invoice_date
     - status (active/paused/expired)
     - template_data: map (invoice fields + lines)
```

### 🧾 Bills & Purchases

```
🗄️ bills
   doc ID: auto
   fields: (وەک invoices — بەڵام بۆ vendor)
     - org_id, contact_id, contact_name, bill_number
     - reference, date, due_date, status (draft/open/partially_paid/paid/overdue/void)
     - subtotal, discount_amount, tax_amount, shipping_charge, adjustment, total, balance_due
     - currency_code, exchange_rate, notes, terms
     - landed_costs: map {freight, duty, insurance, other}  ← نوێ
     - custom_fields, branch_id
   Subcollections:
     📁 lines → (وەک invoice lines)

🗄️ purchase_orders
   doc ID: auto
   fields: (وەک bills — لەگەڵ expected_delivery_date)
   Subcollections:
     📁 lines

🗄️ expenses
   doc ID: auto
   fields:
     - org_id, date, account_id, amount, tax_id, tax_amount
     - contact_id, contact_name, paid_through_id
     - reference, description, is_billable, invoice_id
     - project_id, currency_code, exchange_rate
     - receipt_url: string (Firebase Storage path)  ← نوێ
     - expense_claim_id: string                      ← نوێ
     - custom_fields, branch_id

🗄️ vendor_credits
   doc ID: auto
   fields: (وەک credit_notes — بەڵام بۆ vendor)
   Subcollections:
     📁 lines

🗄️ payments_made
   doc ID: auto
   fields: (وەک payments_received — بەڵام بۆ vendor)
   Subcollections:
     📁 allocations → {bill_id, amount_applied}

🗄️ recurring_bills                              ← نوێ
   doc ID: auto
   fields: (وەک recurring_invoices — بەڵام بۆ vendor)
```

### 📊 Accounting

```
🗄️ accounts
   doc ID: auto
   fields:
     - org_id: string
     - name: string
     - name_ku: string
     - account_type: string (asset/liability/equity/income/expense)
     - account_sub_type: string (cash/bank/accounts_receivable/...)
     - code: string
     - parent_id: string (ref → accounts — tree structure)
     - description: string
     - is_system: boolean
     - is_active: boolean
     - balance: number                   ← denormalized, updated on transaction
     - currency_code: string
     - depth: number                     ← بۆ tree rendering
   Indexes:
     - (org_id ASC, account_type ASC, code ASC)
     - (org_id ASC, parent_id ASC)

🗄️ journal_entries
   doc ID: auto
   fields:
     - org_id, entry_number, date, reference, notes
     - status (draft/posted/void)
     - entity_type, entity_id (invoice/bill/payment/...)
     - total_debit, total_credit
     - is_auto: boolean (system-generated)
   Subcollections:
     📁 lines → {account_id, account_name, debit, credit, description, contact_id}

🗄️ fiscal_years
   doc ID: auto
   fields: org_id, name, start_date, end_date, status (open/closed), is_current

🗄️ opening_balances
   doc ID: auto
   fields: org_id, fiscal_year_id, account_id, debit, credit, date

🗄️ budgets
   doc ID: auto
   fields: org_id, name, fiscal_year_id, status
   Subcollections:
     📁 lines → {account_id, period, amount}
```

### 🏦 Banking

```
🗄️ bank_accounts
   doc ID: auto
   fields:
     - org_id, account_id (ref → accounts), bank_name
     - account_number_last4, currency_code
     - current_balance, is_primary, is_active
     - branch_id                          ← نوێ

🗄️ bank_transactions
   doc ID: auto
   fields:
     - org_id, bank_account_id, date, description
     - amount, transaction_type (deposit/withdrawal)
     - reference, payee, category_account_id
     - is_matched, matched_entity_type, matched_entity_id
     - is_reconciled, reconciliation_id
     - imported_from: string (csv/manual)
   Indexes:
     - (org_id ASC, bank_account_id ASC, date DESC)
     - (org_id ASC, bank_account_id ASC, is_reconciled ASC)

🗄️ bank_rules
   doc ID: auto
   fields:
     - org_id, name, rule_order, match_all
     - conditions: array<map {field, operator, value}>
     - transaction_type, account_id, contact_id, notes_template

🗄️ bank_reconciliations
   doc ID: auto
   fields:
     - org_id, bank_account_id, statement_date
     - opening_balance, closing_balance, system_balance, difference
     - status (in_progress/completed), completed_at
```

### 📦 Inventory

```
🗄️ items
   doc ID: auto
   fields:
     - org_id, group_id, name, sku, item_type (goods/service)
     - unit, description, image_url (Storage path)
     - selling_price, cost_price
     - sales_account_id, purchase_account_id, inventory_account_id
     - tax_id, is_trackable, stock_on_hand, reorder_point
     - preferred_vendor_id
     - item_category: string (simple/composite)         ← نوێ
     - tracking_type: string (none/serial/batch)         ← نوێ
     - is_active, custom_fields
   Indexes:
     - (org_id ASC, name ASC)
     - (org_id ASC, sku ASC)
     - (org_id ASC, item_type ASC, is_active ASC)

🗄️ item_groups
   doc ID: auto
   fields: org_id, name, description, parent_id

🗄️ composite_components                             ← نوێ
   doc ID: auto
   fields:
     - parent_item_id: string
     - component_item_id: string
     - component_name: string (denormalized)
     - quantity: number
     - cost_ratio: number

🗄️ serial_numbers                                    ← نوێ
   doc ID: auto
   fields:
     - org_id, item_id, item_name
     - serial_no: string (unique per org)
     - batch_no: string
     - manufacturing_date: timestamp
     - expiry_date: timestamp
     - status: string (available/sold/returned/damaged)
     - warehouse_id: string
     - invoice_id: string (sold via)
     - bill_id: string (purchased via)
   Indexes:
     - (org_id ASC, serial_no ASC) — unique check
     - (org_id ASC, item_id ASC, status ASC)
     - (org_id ASC, batch_no ASC)
     - (org_id ASC, expiry_date ASC) — بۆ expiry alerts

🗄️ warehouses
   doc ID: auto
   fields: org_id, name, address, is_primary, is_active

🗄️ warehouse_stock
   doc ID: {warehouse_id}_{item_id}    ← composite key
   fields: org_id, warehouse_id, item_id, quantity

🗄️ stock_transfers
   doc ID: auto
   fields: org_id, transfer_number, from_warehouse_id, to_warehouse_id, date, status, notes
   Subcollections:
     📁 lines → {item_id, item_name, quantity, serial_numbers: array}

🗄️ inventory_adjustments
   doc ID: auto
   fields: org_id, adjustment_number, date, reason, adjustment_type, account_id, warehouse_id, journal_entry_id
   Subcollections:
     📁 lines → {item_id, item_name, quantity_adjusted, value_adjusted}

🗄️ price_lists
   doc ID: auto
   fields: org_id, name, description, price_type (sales/purchase), round_off_to, is_active
   Subcollections:
     📁 items → {item_id, item_name, custom_rate, discount_percent}
```

### 💰 Tax

```
🗄️ tax_rates
   doc ID: auto
   fields:
     - org_id, name, rate, tax_type (percentage/flat)
     - tax_category: string (vat/withholding/income/municipal)  ← نوێ
     - sales_account_id, purchase_account_id
     - is_active

🗄️ tax_groups
   doc ID: auto
   fields: org_id, name, tax_rate_ids: array

🗄️ tax_returns
   doc ID: auto
   fields:
     - org_id, period_from, period_to
     - total_output_tax, total_input_tax, net_tax_payable
     - status (draft/filed/paid), filed_at, notes
```

### 🏗️ Fixed Assets

```
🗄️ fixed_assets
   doc ID: auto
   fields:
     - org_id, name, asset_number, description
     - asset_account_id, depreciation_account_id
     - purchase_date, purchase_price, salvage_value
     - useful_life_months
     - depreciation_method (straight_line/declining_balance)
     - current_value, accumulated_depreciation
     - status (active/fully_depreciated/disposed)
     - disposal_date, disposal_price
   Subcollections:
     📁 depreciation_entries → {date, amount, journal_entry_id, running_value}
```

### 📁 Projects

```
🗄️ projects
   doc ID: auto
   fields: org_id, name, contact_id, contact_name, description, billing_method, budget_amount, status, start_date, end_date
   Subcollections:
     📁 tasks → {name, description, assignee_id, status, estimated_hours, logged_hours, due_date}
     📁 time_entries → {task_id, user_id, date, hours, description, is_billable, hourly_rate, invoice_id}
     📁 expenses → {expense_id, amount, description, date, is_billable, invoice_id}
```

### 🌐 System & New Collections

```
🗄️ currencies
   doc ID: currency code (IQD, USD, ...)
   fields: name, name_ku, symbol, decimal_places, format, is_active

🗄️ exchange_rates
   doc ID: auto
   fields: org_id, from_currency, to_currency, rate, date

🗄️ sequences
   doc ID: {org_id}_{entity_type}
   fields: prefix, next_number, padding

🗄️ attachments
   doc ID: auto
   fields:
     - org_id, entity_type, entity_id
     - file_name, storage_path (Firebase Storage path)
     - file_size, mime_type, uploaded_by
     - download_url: string (signed URL cached)
   Indexes:
     - (org_id ASC, entity_type ASC, entity_id ASC)

🗄️ activity_log
   doc ID: auto
   fields:
     - org_id, user_id, user_name
     - entity_type, entity_id, action
     - description, changes: map {field: {old, new}}
     - ip_address, created_at
   Indexes:
     - (org_id ASC, created_at DESC)
     - (org_id ASC, entity_type ASC, entity_id ASC)

🗄️ email_logs
   doc ID: auto
   fields: org_id, entity_type, entity_id, to_email, subject, status, error_message, sent_at

🗄️ settings
   doc ID: {org_id}_{category}_{key}
   fields: org_id, key, value, category

🗄️ reminder_settings
   doc ID: {org_id}
   fields: before_days_list, after_days_list, email_template, is_active

🗄️ invoice_templates
   doc ID: auto
   fields: org_id, name, layout, colors: map, show_logo, header_text, footer_text, is_default
```

### 🆕 Collections تازە (تایبەتمەندییەکانی نوێ)

```
🗄️ portal_tokens                                     ← نوێ
   doc ID: token (unique)
   fields:
     - org_id, contact_id, token_type (customer/vendor)
     - expires_at, is_active, created_at

🗄️ workflows                                         ← نوێ
   doc ID: auto
   fields:
     - org_id, name, entity_type
     - conditions: array<map {field, operator, value}>
     - approvers: array<string> (user IDs)
     - is_active

🗄️ approval_requests                                 ← نوێ
   doc ID: auto
   fields:
     - org_id, entity_type, entity_id
     - requested_by, approver_id
     - status (pending/approved/rejected)
     - notes, created_at, decided_at
   Indexes:
     - (org_id ASC, approver_id ASC, status ASC)

🗄️ recurring_bills                                   ← نوێ
   doc ID: auto
   fields: (وەک recurring_invoices — بەڵام بۆ vendor)

🗄️ expense_claims                                    ← نوێ
   doc ID: auto
   fields:
     - org_id, employee_id (user), claim_number
     - date, status (draft/submitted/approved/rejected/reimbursed)
     - total_amount, approved_amount
     - notes, approver_id, approved_at
   Subcollections:
     📁 items → {date, description, amount, account_id, receipt_url, expense_id}

🗄️ custom_field_definitions                          ← نوێ
   doc ID: auto
   fields:
     - org_id, entity_type (invoice/contact/item/...)
     - field_name, field_label, field_label_ku
     - field_type (text/number/date/dropdown/checkbox/url)
     - options: array<string> (for dropdown)
     - is_required, is_active, sort_order

🗄️ delivery_challans                                 ← نوێ
   doc ID: auto
   fields:
     - org_id, challan_number, date
     - contact_id, contact_name
     - sales_order_id, invoice_id
     - status (draft/delivered/invoiced)
     - shipping_address: map
     - tracking_number, carrier_name
   Subcollections:
     📁 lines → {item_id, item_name, quantity, serial_numbers: array}

🗄️ shipments                                         ← نوێ
   doc ID: auto
   fields:
     - org_id, shipment_number, date
     - entity_type (sales_order/invoice)
     - entity_id, contact_id, contact_name
     - carrier_name, tracking_number, tracking_url
     - status (packing/shipped/in_transit/delivered/returned)
     - shipped_date, delivered_date
     - shipping_address: map
   Subcollections:
     📁 packages → {package_number, weight, dimensions: map, items: array<map>}

🗄️ sales_returns                                     ← نوێ
   doc ID: auto
   fields:
     - org_id, return_number, date
     - contact_id, contact_name
     - invoice_id, reason, status (draft/received/credit_issued)
     - total_amount, credit_note_id
   Subcollections:
     📁 lines → {item_id, item_name, quantity, unit_price, serial_numbers: array, warehouse_id}

🗄️ purchase_returns                                  ← نوێ
   doc ID: auto
   fields:
     - org_id, return_number, date
     - contact_id, contact_name
     - bill_id, reason, status (draft/shipped/credit_received)
     - total_amount, vendor_credit_id
   Subcollections:
     📁 lines → {item_id, item_name, quantity, unit_price}

🗄️ branches                                          ← نوێ
   doc ID: auto
   fields:
     - org_id, name, address, city
     - manager_id (user), is_active

🗄️ reporting_tags                                    ← نوێ
   doc ID: auto
   fields: org_id, name, color

🗄️ reporting_tag_assignments                         ← نوێ
   doc ID: auto
   fields: tag_id, entity_type, entity_id, amount

🗄️ mileage_logs                                      ← نوێ
   doc ID: auto
   fields:
     - org_id, user_id, date
     - from_location, to_location, distance_km
     - rate_per_km, total_amount, purpose
     - expense_id, is_billable, project_id

🗄️ item_barcodes                                     ← نوێ
   doc ID: auto
   fields: org_id, item_id, barcode (unique per org), barcode_type (EAN13/QR/Code128)

🗄️ audit_logs                                        ← نوێ (وردتر لە activity_log)
   doc ID: auto
   fields:
     - org_id, user_id, user_name, user_email
     - entity_type, entity_id, entity_number
     - action (create/update/delete/void/send/approve/reject/login/export)
     - changes: map {field_name: {old_value, new_value}}
     - ip_address, user_agent, session_id
     - created_at
   Indexes:
     - (org_id ASC, created_at DESC)
     - (org_id ASC, user_id ASC, created_at DESC)
     - (org_id ASC, entity_type ASC, entity_id ASC, created_at DESC)

🗄️ payment_links                                     ← نوێ
   doc ID: auto
   fields:
     - org_id, invoice_id, invoice_number
     - contact_id, amount, currency_code
     - link_token (unique), expires_at
     - status (active/paid/expired)
     - payment_provider, payment_reference
     - created_at, paid_at
```

## ٢.٢ — Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // هیچ دەسترەسییەکی ڕاستەوخۆ نییە — هەموو شت لە Admin SDK تێدەپەڕێت
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> **بۆچی `if false`?** چونکە هەموو CRUD لە FastAPI (Admin SDK) دەکرێت. Admin SDK security rules بایپاس دەکات. ئەمەش ئەوە دەکات کە هیچ کاربەرێک ڕاستەوخۆ لە browser داتابەیسەکە نەبینێت.

## ٢.٣ — Composite Indexes (لە Firebase Console)

```
# بۆیە کە Firestore inequality filters تەنها لەسەر یەک field ئەبێت + ordering:

1. invoices: (org_id ASC, status ASC, date DESC)
2. invoices: (org_id ASC, contact_id ASC, date DESC)  
3. invoices: (org_id ASC, due_date ASC, status ASC)
4. bills: (org_id ASC, status ASC, date DESC)
5. bills: (org_id ASC, contact_id ASC, date DESC)
6. expenses: (org_id ASC, date DESC, account_id ASC)
7. bank_transactions: (org_id ASC, bank_account_id ASC, date DESC)
8. bank_transactions: (org_id ASC, bank_account_id ASC, is_reconciled ASC)
9. journal_entries: (org_id ASC, date DESC)
10. contacts: (org_id ASC, contact_type ASC, display_name ASC)
11. items: (org_id ASC, item_type ASC, is_active ASC)
12. serial_numbers: (org_id ASC, item_id ASC, status ASC)
13. serial_numbers: (org_id ASC, expiry_date ASC)
14. activity_log: (org_id ASC, created_at DESC)
15. audit_logs: (org_id ASC, entity_type ASC, entity_id ASC, created_at DESC)
16. approval_requests: (org_id ASC, approver_id ASC, status ASC)
17. attachments: (org_id ASC, entity_type ASC, entity_id ASC)
```

---

# بەشی ٣: نەخشەی گۆڕانی Backend

## ٣.١ — فایلەکانی دەگۆڕدرێن

```
backend/
├── app/
│   ├── config.py              ← گۆڕان: Firebase configs زیادکراو
│   ├── database.py            ← ❌ ئەوسرێتەوە → firebase_client.py
│   ├── firebase_client.py     ← 🆕 نوێ: Firestore + Storage init
│   ├── cache.py               ← 🆕 نوێ: in-memory cache layer
│   ├── main.py                ← گۆڕان: SQLAlchemy بردرایەوە، Firebase init
│   │
│   ├── models/                ← ❌ تەواو ئەوسرێتەوە
│   │   └── (هەموو فایل — ئەم folder ناپێویستە لە Firestore)
│   │
│   ├── firestore/             ← 🆕 نوێ: data access layer
│   │   ├── __init__.py
│   │   ├── base.py            ← BaseRepository (CRUD generic)
│   │   ├── organizations.py
│   │   ├── users.py
│   │   ├── contacts.py
│   │   ├── invoices.py
│   │   ├── quotes.py
│   │   ├── bills.py
│   │   ├── expenses.py
│   │   ├── payments.py
│   │   ├── accounts.py
│   │   ├── journals.py
│   │   ├── banking.py
│   │   ├── inventory.py
│   │   ├── taxes.py
│   │   ├── assets.py
│   │   ├── projects.py
│   │   ├── system.py
│   │   └── portals.py         ← نوێ
│   │
│   ├── api/                   ← گۆڕان: هەموو فایل — db:Session → firestore repo
│   │   ├── auth.py            ← گۆڕان
│   │   ├── invoices.py        ← گۆڕان
│   │   ├── contacts.py        ← گۆڕان
│   │   ├── ... (هەموو)
│   │   ├── portals.py         ← 🆕 نوێ
│   │   ├── approvals.py       ← 🆕 نوێ
│   │   ├── shipments.py       ← 🆕 نوێ
│   │   ├── returns.py         ← 🆕 نوێ
│   │   ├── custom_fields.py   ← 🆕 نوێ
│   │   ├── branches.py        ← 🆕 نوێ
│   │   └── expense_claims.py  ← 🆕 نوێ
│   │
│   ├── services/
│   │   ├── auth.py            ← گۆڕان: Firestore query
│   │   ├── accounting.py      ← گۆڕان: Firestore transactions
│   │   ├── pdf_generator.py   ← بەبێ گۆڕان (Storage upload زیادکراو)
│   │   ├── email_service.py   ← بەبێ گۆڕان
│   │   ├── storage_service.py ← 🆕 نوێ: Firebase Storage operations
│   │   ├── cache_service.py   ← 🆕 نوێ: read/write caching
│   │   ├── import_service.py  ← 🆕 نوێ: CSV/Excel import
│   │   └── scheduler.py       ← 🆕 نوێ: APScheduler for reminders
│   │
│   ├── schemas/               ← گۆڕان: Pydantic models (مەنێت، بەڵام update)
│   │
│   ├── seed/                  ← گۆڕان: Firestore seeding
│   │
│   └── utils/                 ← بەبێ گۆڕان
│
├── serviceAccountKey.json     ← 🆕 (لە .gitignore)
├── requirements.txt           ← گۆڕان: firebase-admin زیادکراو
├── alembic/                   ← ❌ ئەوسرێتەوە (Firestore migration نییە)
└── alembic.ini                ← ❌ ئەوسرێتەوە
```

## ٣.٢ — Base Repository Pattern

```python
# backend/app/firestore/base.py
from google.cloud.firestore_v1 import DocumentReference, Query
from app.firebase_client import db
from app.cache import cache
from typing import Optional
import uuid

class BaseRepository:
    collection_name: str = ""
    
    def __init__(self, org_id: str):
        self.org_id = org_id
        self.collection = db.collection(self.collection_name)
    
    def get(self, doc_id: str) -> Optional[dict]:
        """Get document by ID with caching"""
        cache_key = f"{self.collection_name}:{doc_id}"
        cached = cache.get(cache_key)
        if cached:
            return cached
        doc = self.collection.document(doc_id).get()
        if doc.exists:
            data = {"id": doc.id, **doc.to_dict()}
            cache.set(cache_key, data)
            return data
        return None
    
    def list(self, filters: list = None, order_by: str = None, 
             order_dir: str = "DESCENDING", limit: int = 25,
             start_after: dict = None) -> list[dict]:
        """List with org_id filter + pagination"""
        query = self.collection.where("org_id", "==", self.org_id)
        for f in (filters or []):
            query = query.where(f["field"], f["op"], f["value"])
        if order_by:
            direction = Query.DESCENDING if order_dir == "DESCENDING" else Query.ASCENDING
            query = query.order_by(order_by, direction=direction)
        if start_after:
            query = query.start_after(start_after)
        query = query.limit(limit)
        return [{"id": doc.id, **doc.to_dict()} for doc in query.stream()]
    
    def create(self, data: dict) -> dict:
        """Create document"""
        doc_id = data.pop("id", str(uuid.uuid4()))
        data["org_id"] = self.org_id
        data["created_at"] = firestore.SERVER_TIMESTAMP
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        self.collection.document(doc_id).set(data)
        cache.delete(f"{self.collection_name}:{doc_id}")
        return {"id": doc_id, **data}
    
    def update(self, doc_id: str, data: dict) -> dict:
        """Update document"""
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        self.collection.document(doc_id).update(data)
        cache.delete(f"{self.collection_name}:{doc_id}")
        return self.get(doc_id)
    
    def delete(self, doc_id: str):
        """Delete document + subcollections"""
        self._delete_subcollections(doc_id)
        self.collection.document(doc_id).delete()
        cache.delete(f"{self.collection_name}:{doc_id}")
    
    def _delete_subcollections(self, doc_id: str):
        """Delete all subcollections of a document"""
        doc_ref = self.collection.document(doc_id)
        for subcol in doc_ref.collections():
            for subdoc in subcol.stream():
                subdoc.reference.delete()
    
    # --- Subcollection helpers ---
    def get_lines(self, doc_id: str, subcol: str = "lines") -> list[dict]:
        refs = self.collection.document(doc_id).collection(subcol).order_by("sort_order").stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in refs]
    
    def set_lines(self, doc_id: str, lines: list[dict], subcol: str = "lines"):
        """Replace all lines (batch write)"""
        batch = db.batch()
        # Delete existing
        for doc in self.collection.document(doc_id).collection(subcol).stream():
            batch.delete(doc.reference)
        # Create new
        for i, line in enumerate(lines):
            line_id = line.pop("id", str(uuid.uuid4()))
            line["sort_order"] = i
            ref = self.collection.document(doc_id).collection(subcol).document(line_id)
            batch.set(ref, line)
        batch.commit()  # ئەمە 1 write operation حساب دەکرێت بۆ batch
```

## ٣.٣ — Query Patterns گۆڕان

### پێشوو (SQLAlchemy):
```python
invoices = db.query(Invoice).filter(
    Invoice.org_id == org_id,
    Invoice.status.in_(["sent", "overdue"]),
    Invoice.date >= start_date
).order_by(Invoice.date.desc()).offset(skip).limit(limit).all()
```

### ئێستا (Firestore):
```python
# Firestore .in_() بۆ max 30 value
query = db.collection("invoices") \
    .where("org_id", "==", org_id) \
    .where("status", "in", ["sent", "overdue"]) \
    .where("date", ">=", start_date) \
    .order_by("date", direction=Query.DESCENDING) \
    .limit(limit)

if start_after_doc:
    query = query.start_after(start_after_doc)

results = [{"id": doc.id, **doc.to_dict()} for doc in query.stream()]
```

### گرنگ — سنوورەکانی Firestore Query:
```
❌ نابێت: .where("status", "!=", "void").where("date", ">=", x)
   → inequality لەسەر دوو field جیاواز نابێت (v1)
   → چارەسەر: composite index + status filter لە client

❌ نابێت: LIKE '%search%' 
   → چارەسەر: بۆ prefix search: where("name", ">=", q).where("name", "<=", q + "\uf8ff")
   → بۆ full-text: client-side filter یان Algolia/Typesense

❌ نابێت: JOIN
   → چارەسەر: denormalization (contact_name لەسەر invoice)

❌ نابێت: COUNT(*) بەبێ خوێندنەوەی هەموو docs
   → چارەسەر: counter document لە collection جودا
```

## ٣.٤ — Pagination گۆڕان

```
پێشوو: offset/limit (SQL)
ئێستا: cursor-based pagination (Firestore)

Frontend:
  Page 1: GET /api/invoices?limit=25
  Page 2: GET /api/invoices?limit=25&start_after={last_doc_id}

Backend:
  if start_after:
      last_doc = collection.document(start_after).get()
      query = query.start_after(last_doc)
```

## ٣.٥ — Firestore Transactions (بۆ accounting)

```python
# بۆیە کە accounting entries atomically بکرێن:
@firestore.transactional
def create_invoice_with_journal(transaction, invoice_data, lines, journal_data):
    # 1. Create invoice
    inv_ref = db.collection("invoices").document()
    transaction.set(inv_ref, invoice_data)
    
    # 2. Create lines
    for line in lines:
        line_ref = inv_ref.collection("lines").document()
        transaction.set(line_ref, line)
    
    # 3. Create journal entry
    je_ref = db.collection("journal_entries").document()
    transaction.set(je_ref, journal_data)
    
    # 4. Update account balances
    for je_line in journal_data["lines"]:
        acc_ref = db.collection("accounts").document(je_line["account_id"])
        transaction.update(acc_ref, {
            "balance": firestore.Increment(je_line["debit"] - je_line["credit"])
        })
    
    # 5. Update contact balance
    contact_ref = db.collection("contacts").document(invoice_data["contact_id"])
    transaction.update(contact_ref, {
        "outstanding_balance": firestore.Increment(invoice_data["total"])
    })
```

## ٣.٦ — requirements.txt نوێ

```
# Framework
fastapi==0.115.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9
pydantic-settings==2.3.0
python-jose[cryptography]==3.3.0
bcrypt==4.2.0
passlib==1.7.4

# Firebase (جێگای SQLAlchemy)
firebase-admin==6.5.0
google-cloud-firestore==2.16.0
google-cloud-storage==2.17.0

# PDF/Email
reportlab==4.2.0
Pillow==10.3.0
openpyxl==3.1.2

# Utilities
pandas==2.2.0
apscheduler==3.10.4
pyotp==2.9.0          # 2FA
qrcode==7.4.2
slowapi==0.1.9
cachetools==5.3.3     # in-memory caching

# Development
httpx==0.27.0
pytest==8.2.0
```

---

# بەشی ٤: تایبەتمەندییەکانی نوێ (٣٠ تایبەتمەندی)

## 🔵 تایبەتمەندی ١: Serial Number Tracking

```
📁 Collection: serial_numbers
🔌 APIs:
   POST   /api/items/{id}/serials              — زیادکردنی serial
   GET    /api/items/{id}/serials              — لیستی serialەکان
   GET    /api/inventory/serials/{serial}       — بەدواداچوون بەپێی serial
   GET    /api/inventory/serials/{serial}/history — مێژووی serial
   POST   /api/invoice-lines/{line_id}/assign-serials — دانانی serial لە فاکتوور
   POST   /api/bill-lines/{line_id}/assign-serials    — دانانی serial لە bill
📄 Frontend: /inventory/serial-numbers — لیست + search + filter by status
   /items/{id}/serials — tab لە item detail
Effort: M
```

## 🔵 تایبەتمەندی ٢: Batch/Lot Number Tracking

```
📁 Collection: serial_numbers (same collection, batch_no field)
🔌 APIs:
   POST   /api/items/{id}/batches             — زیادکردنی batch
   GET    /api/items/{id}/batches             — لیستی batchەکان
   GET    /api/inventory/batches/expiring      — batchە بەسەرچووەکان
   GET    /api/inventory/batches/{batch_no}    — وردەکاری batch
📄 Frontend: /inventory/batches — لیست + expiry alerts (سوور بۆ نزیک)
Effort: M
```

## 🔵 تایبەتمەندی ٣: Bill of Materials (BOM) / Composite Items

```
📁 Collection: composite_components
🔌 APIs:
   GET    /api/items/{id}/components           — لیستی components
   POST   /api/items/{id}/components           — زیادکردنی component
   PUT    /api/items/{id}/components/{comp_id} — گۆڕین
   DELETE /api/items/{id}/components/{comp_id}
   POST   /api/items/{id}/assemble             — assembly (stock کەمکردنەوەی components + زیادکردنی composite)
   POST   /api/items/{id}/disassemble          — لاچوونەوە
📄 Frontend: /items/{id}/bom — tab لە item detail — tree view
Effort: L
```

## 🔵 تایبەتمەندی ٤: Package/Shipment Tracking

```
📁 Collections: shipments, shipments/{id}/packages
🔌 APIs:
   POST   /api/shipments                       — دروستکردن
   GET    /api/shipments                       — لیست
   GET    /api/shipments/{id}                  — وردەکاری
   PUT    /api/shipments/{id}                  — نوێکردنەوە
   PUT    /api/shipments/{id}/status           — گۆڕینی status
   GET    /api/invoices/{id}/shipments         — shipmentەکانی فاکتوورێک
   GET    /api/sales-orders/{id}/shipments     — shipmentەکانی SO
📄 Frontend: /shipments — لیست + timeline + tracking link
   /shipments/new — فۆڕم (لە invoice/SO)
Effort: M
```

## 🔵 تایبەتمەندی ٥: Delivery Challans

```
📁 Collection: delivery_challans
🔌 APIs:
   POST   /api/delivery-challans               — دروستکردن
   GET    /api/delivery-challans               — لیست
   GET    /api/delivery-challans/{id}          — وردەکاری  
   PUT    /api/delivery-challans/{id}
   DELETE /api/delivery-challans/{id}
   POST   /api/delivery-challans/{id}/convert-to-invoice — گۆڕین بۆ فاکتوور
   GET    /api/delivery-challans/{id}/pdf      — PDF
📄 Frontend: /delivery-challans — لیست + فۆڕم
Effort: M
```

## 🔵 تایبەتمەندی ٦: Sales Return / Purchase Return

```
📁 Collections: sales_returns, purchase_returns
🔌 APIs:
   POST   /api/sales-returns                   — دروستکردنی گەڕاندنەوەی فرۆشتن
   GET    /api/sales-returns
   GET    /api/sales-returns/{id}
   POST   /api/sales-returns/{id}/receive      — وەرگرتن + stock update
   POST   /api/sales-returns/{id}/create-credit-note — CN دروستکردن
   POST   /api/purchase-returns                — دروستکردنی گەڕاندنەوەی کڕین
   GET    /api/purchase-returns
   GET    /api/purchase-returns/{id}
   POST   /api/purchase-returns/{id}/ship      — ناردن
   POST   /api/purchase-returns/{id}/create-vendor-credit — VC دروستکردن
📄 Frontend: /sales-returns, /purchase-returns — لیست + فۆڕم
Effort: L
```

## 🔵 تایبەتمەندی ٧: Customer Portal

```
📁 Collection: portal_tokens
🔌 APIs:
   POST   /api/portal/customer/generate        — لینکی دەرگا دروستکردن
   GET    /api/portal/c/{token}/dashboard       — داشبۆردی کارپاکەر
   GET    /api/portal/c/{token}/invoices        — فاکتوورەکان
   GET    /api/portal/c/{token}/invoices/{id}   — وردەکاری فاکتوور
   GET    /api/portal/c/{token}/invoices/{id}/pdf — PDF
   GET    /api/portal/c/{token}/quotes          — نرخەکان
   POST   /api/portal/c/{token}/quotes/{id}/accept — پەسەندکردن
   POST   /api/portal/c/{token}/quotes/{id}/decline
   GET    /api/portal/c/{token}/payments        — پارەدانەکان
   GET    /api/portal/c/{token}/statement       — بەیانی حساب
   GET    /api/portal/c/{token}/statement/pdf   — PDF بەیانی
📄 Frontend: /portal/customer/{token} — branded + public (بەبێ login)
   لاپەڕەکان: dashboard, invoices, quotes, payments, statement
Effort: L
```

## 🔵 تایبەتمەندی ٨: Vendor Portal

```
📁 Collection: portal_tokens (token_type=vendor)
🔌 APIs:
   POST   /api/portal/vendor/generate
   GET    /api/portal/v/{token}/dashboard
   GET    /api/portal/v/{token}/purchase-orders
   POST   /api/portal/v/{token}/purchase-orders/{id}/acknowledge
   GET    /api/portal/v/{token}/bills
   GET    /api/portal/v/{token}/payments
   GET    /api/portal/v/{token}/statement
📄 Frontend: /portal/vendor/{token}
Effort: M
```

## 🔵 تایبەتمەندی ٩: Multi-Currency Gain/Loss

```
📁 Collection: هەموو payment documents + journal_entries
🔌 APIs:
   GET    /api/reports/currency-gain-loss        — ڕاپۆرتی قازانج/زیان
   POST   /api/system/revalue-currencies         — دوایین نرخی دراو
   GET    /api/invoices/{id}/exchange-difference  — فەرقی ئاراستەکردن
🧮 Logic:
   پارەدان بە $100 لە invoice $100 → exchange_rate وەختی invoice ≠ وەختی payment
   فەرق = (payment_rate - invoice_rate) × amount
   DR/CR Exchange Gain/Loss account
📄 Frontend: /reports/currency-gain-loss
Effort: M
```

## 🔵 تایبەتمەندی ١٠: Expense Claims / Reimbursement

```
📁 Collection: expense_claims + subcollection items
🔌 APIs:
   POST   /api/expense-claims                    — دروستکردن
   GET    /api/expense-claims                    — لیست
   GET    /api/expense-claims/{id}               — وردەکاری
   PUT    /api/expense-claims/{id}
   POST   /api/expense-claims/{id}/submit        — ناردن بۆ پەسەندکردن
   POST   /api/expense-claims/{id}/approve       — پەسەندکردن
   POST   /api/expense-claims/{id}/reject        — ڕەتکردنەوە
   POST   /api/expense-claims/{id}/reimburse     — پارەگەڕاندنەوە
   POST   /api/expense-claims/{id}/items/{item_id}/upload-receipt — وێنەی پسووڵە
📄 Frontend: /expense-claims — لیست + فۆڕم + دکمەی submit/approve
Effort: L
```

## 🔵 تایبەتمەندی ١١: Approval Workflows

```
📁 Collections: workflows, approval_requests
🔌 APIs:
   POST   /api/workflows                         — دروستکردنی workflow
   GET    /api/workflows                         — لیست
   PUT    /api/workflows/{id}
   DELETE /api/workflows/{id}
   POST   /api/{entity_type}/{id}/submit-approval — ناردن بۆ پەسەند
   POST   /api/approvals/{id}/approve            — پەسەندکردن
   POST   /api/approvals/{id}/reject             — ڕەتکردنەوە
   GET    /api/approvals/pending                  — لیستی چاوەڕوان
   GET    /api/approvals/history                  — مێژوو
📄 Frontend:
   /settings/workflows — CRUD workflow + condition builder
   /approvals — لیستی pending + badge لە navbar
   modal لەسەر فاکتوور: "Submit for Approval"
Effort: L
```

## 🔵 تایبەتمەندی ١٢: Custom Fields

```
📁 Collections: custom_field_definitions (values لەناو هەر document خۆیدا بە map)
🔌 APIs:
   POST   /api/settings/custom-fields             — دروستکردنی field
   GET    /api/settings/custom-fields             — لیست
   GET    /api/settings/custom-fields?entity_type=invoice
   PUT    /api/settings/custom-fields/{id}
   DELETE /api/settings/custom-fields/{id}
📄 Frontend:
   /settings/custom-fields — UI بۆ CRUD
   هەر entity form: dynamic rendering بەپێی custom_field_definitions
   Ant Design Form.List + dynamic input types
Effort: L
```

## 🔵 تایبەتمەندی ١٣: Custom Reports

```
🔌 APIs:
   POST   /api/reports/custom                     — ڕاپۆرتی تایبەتی جێبەجێکردن
   POST   /api/reports/custom/save                — پاشەکەوتکردن
   GET    /api/reports/custom/saved               — لیستی ڕاپۆرتە پاشکەوتکراوەکان
   DELETE /api/reports/custom/saved/{id}
   📥 Input: {
     entity_type: "invoices",
     columns: ["invoice_number", "contact_name", "total", "status"],
     filters: [{field: "status", op: "==", value: "paid"}],
     group_by: "contact_name",
     date_range: {from, to},
     aggregations: ["sum:total", "count:*"]
   }
📄 Frontend: /reports/custom — report builder UI
   drag & drop columns + filter builder + preview
Effort: XL
```

## 🔵 تایبەتمەندی ١٤: Document Attachments (Cloud)

```
📁 Collection: attachments + Firebase Storage
🔌 APIs:
   POST   /api/{entity_type}/{id}/attachments     — upload فایل
   GET    /api/{entity_type}/{id}/attachments     — لیستی هاوپێچەکان
   GET    /api/attachments/{id}/download          — دابەزاندن (signed URL)
   DELETE /api/attachments/{id}                   — سڕینەوە (Storage + Firestore)
🛡️ Validation: max 10MB per file, allowed types: pdf/jpg/png/xlsx/docx
📁 Storage: /{org_id}/attachments/{entity_type}/{entity_id}/{filename}
📄 هەر entity detail page: Attachments tab
Effort: M
```

## 🔵 تایبەتمەندی ١٥: Landed Cost Allocation

```
🔌 APIs:
   POST   /api/bills/{id}/landed-costs            — دابەشکردنی تێچوو
   GET    /api/bills/{id}/landed-costs            — بینینی دابەشکردن
📥 Input: {
     costs: [
       {type: "freight", amount: 50000, allocation_method: "by_value"},
       {type: "duty", amount: 30000, allocation_method: "by_quantity"}
     ]
   }
🧮 Logic:
   by_value: cost × (line_total / bill_subtotal)
   by_quantity: cost × (line_qty / total_qty)
   → item cost_price نوێدەکرێتەوە
📄 Frontend: modal لەسەر bill detail → landed cost form
Effort: M
```

## 🔵 تایبەتمەندی ١٦: Inventory Aging Report

```
🔌 APIs:
   GET    /api/reports/inventory-aging            — ڕاپۆرتی تەمەنی ستۆک
   GET    /api/reports/inventory-aging/pdf
   GET    /api/reports/inventory-aging/excel
📥 Output: {
     items: [{
       item_name, sku, stock_on_hand,
       0_30_days: qty, 31_60_days: qty, 61_90_days: qty, over_90_days: qty,
       total_value
     }]
   }
📄 Frontend: /reports/inventory-aging — table + chart
Effort: M
```

## 🔵 تایبەتمەندی ١٧: Stock Summary Report

```
🔌 APIs:
   GET    /api/reports/stock-summary              — کورتی ستۆک
   GET    /api/reports/stock-summary/pdf
   GET    /api/reports/stock-summary/excel
📥 Output: بۆ هەر item: opening_stock, purchased, sold, adjusted, closing_stock, value
📄 Frontend: /reports/stock-summary
Effort: S
```

## 🔵 تایبەتمەندی ١٨: Warehouse Transfer Report

```
🔌 APIs:
   GET    /api/reports/warehouse-transfers
   GET    /api/reports/warehouse-transfers/pdf
📥 Output: بۆ هەر warehouse: incoming_qty, outgoing_qty, net_change + per-item breakdown
📄 Frontend: /reports/warehouse-transfers
Effort: S
```

## 🔵 تایبەتمەندی ١٩: Payment Link Generation

```
📁 Collection: payment_links
🔌 APIs:
   POST   /api/invoices/{id}/payment-link         — دروستکردنی لینک
   GET    /api/pay/{link_token}                   — لاپەڕەی پارەدان (public)
   POST   /api/pay/{link_token}/confirm           — تەواوکردنی پارەدان
   GET    /api/invoices/{id}/payment-links        — لیستی لینکەکان
📄 Frontend:
   لە invoice detail: دکمەی "Payment Link" → کۆپی لینک / ناردن بە WhatsApp
   /pay/{token} — لاپەڕەی public بۆ کارپاکەر
Effort: M
```

## 🔵 تایبەتمەندی ٢٠: Auto-Reminder Scheduling

```
🔌 APIs:
   GET    /api/settings/reminders                 — ڕێکخستنی بیرکەوتنەوە
   PUT    /api/settings/reminders
   POST   /api/invoices/{id}/send-reminder        — بیرکەوتنەوەی دەستی
   GET    /api/invoices/overdue                   — لیستی بەسەرچووەکان
⏰ Scheduler (APScheduler):
   - هەر ڕۆژ لە 9:00 AM بەغدا → چێک بۆ فاکتوورە overdue
   - ئەگەر ژمارەی ڕۆژی بەسەرچوون match بە reminder_settings → email ناردن
   - invoice.reminder_count++ + last_reminder_sent_at update
📄 Frontend: /settings/reminders — فۆڕم: "X ڕۆژ پێش/دوای due date"
Effort: M
```

## 🔵 تایبەتمەندی ٢١: Recurring Bills

```
📁 Collection: recurring_bills
🔌 APIs:
   POST   /api/recurring-bills                    — دروستکردن
   GET    /api/recurring-bills                    — لیست
   GET    /api/recurring-bills/{id}
   PUT    /api/recurring-bills/{id}
   DELETE /api/recurring-bills/{id}
   POST   /api/recurring-bills/{id}/pause
   POST   /api/recurring-bills/{id}/resume
⏰ Scheduler: هەر ڕۆژ → چێک بۆ next_bill_date → auto-generate bill
📄 Frontend: /recurring-bills — وەک recurring invoices
Effort: M
```

## 🔵 تایبەتمەندی ٢٢: Opening Balance Import

```
🔌 APIs:
   GET    /api/fiscal/opening-balances/template/excel — داگرتنی template
   POST   /api/fiscal/opening-balances/import       — هاوردەکردن لە Excel
   POST   /api/fiscal/opening-balances/validate     — پشکنین پێش import
📄 Frontend: /settings/opening-balances/import — upload + preview + confirm
Effort: M
```

## 🔵 تایبەتمەندی ٢٣: Chart of Accounts Import/Export

```
🔌 APIs:
   GET    /api/accounts/export/excel               — هەناردەکردن
   GET    /api/accounts/export/template            — template بۆ هاوردە
   POST   /api/accounts/import                    — هاوردەکردن
   POST   /api/accounts/import/validate           — پشکنین
📄 Frontend: /settings/chart-of-accounts → دکمەی Import/Export
Effort: S
```

## 🔵 تایبەتمەندی ٢٤: Customer Statement

```
🔌 APIs:
   GET    /api/contacts/{id}/statement             — بەیانی حساب
   GET    /api/contacts/{id}/statement/pdf         — PDF
   POST   /api/contacts/{id}/statement/email       — ناردنی ئیمەیل
📥 Output: {
     contact, period,
     opening_balance,
     transactions: [{date, type, number, debit, credit, running_balance}],
     closing_balance
   }
📄 Frontend: /contacts/{id}/statement — table + PDF/Email دکمە
Effort: M
```

## 🔵 تایبەتمەندی ٢٥: Vendor Statement

```
🔌 APIs: (وەک customer statement بەڵام بۆ vendor)
   GET    /api/contacts/{id}/vendor-statement
   GET    /api/contacts/{id}/vendor-statement/pdf
   POST   /api/contacts/{id}/vendor-statement/email
📄 Frontend: /contacts/{id}/vendor-statement
Effort: S (code sharing لەگەڵ customer statement)
```

## 🔵 تایبەتمەندی ٢٦: Journal Import

```
🔌 APIs:
   GET    /api/journals/import/template            — template Excel
   POST   /api/journals/import                    — هاوردەکردن
   POST   /api/journals/import/validate           — پشکنین (debit == credit)
📄 Frontend: /journals/import — upload + preview + validation errors
Effort: M
```

## 🔵 تایبەتمەندی ٢٧: Detailed Audit Trail

```
📁 Collection: audit_logs
🔌 APIs:
   GET    /api/audit-trail                        — لیستی گشتی
   GET    /api/audit-trail?entity_type=invoice&entity_id=X — بۆ entity تایبەت
   GET    /api/audit-trail?user_id=X              — بۆ user تایبەت
   GET    /api/audit-trail/export/excel
⚙️ Middleware: FastAPI middleware → هەر POST/PUT/DELETE → auto-log
   changes: diff بەرامبەر بە old values
📄 Frontend:
   /audit-trail — لیست + filter by type/user/date
   هەر entity detail page: Activity tab → timeline view
Effort: L
```

## 🔵 تایبەتمەندی ٢٨: Granular Role-based Permissions

```
📁 لەناو users document → permissions map
🔌 APIs:
   GET    /api/users/{id}/permissions              — بینینی ڕۆڵ
   PUT    /api/users/{id}/permissions              — گۆڕینی ڕۆڵ
   GET    /api/settings/roles                      — ڕۆڵە ئاسایییەکان
📥 Permissions Model:
   {
     invoices: "full",    // full/create/view/none
     bills: "view",
     expenses: "full",
     banking: "none",
     reports: "view",
     contacts: "full",
     items: "view",
     settings: "none",
     approvals: "approve",
     admin: false
   }
⚙️ FastAPI: dependency → check_permission(user, "invoices", "create")
📄 Frontend: /settings/users/{id}/permissions — checkbox matrix
Effort: M
```

## 🔵 تایبەتمەندی ٢٩: Two-Factor Authentication (2FA)

```
📁 لەناو users document: two_factor_enabled, two_factor_secret
🔌 APIs:
   POST   /api/auth/2fa/enable                    — چالاککردن (QR code بگەڕێنەوە)
   POST   /api/auth/2fa/verify                    — پشکنینی کۆد
   POST   /api/auth/2fa/disable                   — ناچالاککردن
   POST   /api/auth/login                         → ئەگەر 2FA چالاکە: requires_2fa: true بگەڕێنەوە
   POST   /api/auth/login/2fa                     — هەنگاوی دووەم
⚙️ Dependencies: pyotp + qrcode
📄 Frontend:
   /settings/security — Enable 2FA → QR code نیشاندان → verify code
   /login → ئەگەر 2FA: فۆڕمی ٦ ژمارە
Effort: M
```

## 🔵 تایبەتمەندی ٣٠: Multi-Branch Support

```
📁 Collection: branches
🔌 APIs:
   POST   /api/branches                           — دروستکردن
   GET    /api/branches                           — لیست
   PUT    /api/branches/{id}
   DELETE /api/branches/{id}
   GET    /api/reports/branch-comparison           — بەراوردکردنی لقەکان
⚙️ Logic:
   - هەر document (invoice, expense, bank_account, ...) → branch_id optional
   - ڕاپۆرتەکان → filter by branch
   - header dropdown بۆ هەڵبژاردنی branch
📄 Frontend:
   /settings/branches — CRUD
   header: branch selector dropdown
   هەر فۆڕم: branch field
   /reports/branch-comparison — بەراوردکاری
Effort: L
```

---

# بەشی ٥: نەقشەی جێبەجێکردن (Execution Roadmap)

## قۆناغ ٠ — بنەما: گۆڕانی داتابەیس (Firebase Migration)
> **Effort:** XL | **ئەیگێنت:** باکئێند

### پێشینە: هیچ
### ئەرکەکان:

```
٠.١ — Firebase Project Setup                              [S]
   • Firebase Console → New Project
   • Enable Firestore (production mode)
   • Enable Storage
   • Download serviceAccountKey.json
   • .gitignore: serviceAccountKey.json

٠.٢ — Firebase Client Module                              [S]
   • firebase_client.py → init firebase-admin
   • cache.py → in-memory TTL cache (cachetools)
   • config.py → Firebase settings

٠.٣ — Base Repository + Firestore Layer                   [L]
   • firestore/base.py → BaseRepository
   • firestore/organizations.py
   • firestore/users.py
   • Remove SQLAlchemy dependency from main.py

٠.٤ — Auth Migration                                      [M]
   • services/auth.py → Firestore queries
   • api/auth.py → remove db: Session dependency

٠.٥ — Core Entity Migration (Contacts, Items, Accounts)   [L]
   • firestore/contacts.py + api/contacts.py update
   • firestore/items.py + api/items.py update  
   • firestore/accounts.py + api/accounts.py update

٠.٦ — Transaction Entities (Invoices, Bills, etc.)         [XL]
   • firestore/invoices.py (+ subcollection lines)
   • firestore/quotes.py
   • firestore/bills.py
   • firestore/expenses.py
   • firestore/payments.py
   • api/* update for all

٠.٧ — Banking + Journal + Tax + Projects                  [L]
   • firestore/banking.py, journals.py, taxes.py, projects.py
   • api/* update

٠.٨ — Accounting Service Migration                        [L]
   • services/accounting.py → Firestore transactions
   • Atomic journal entry creation
   • Balance updates with firestore.Increment

٠.٩ — Storage Service                                     [M]
   • services/storage_service.py → upload/download/delete
   • api/system.py → attachment endpoints update

٠.١٠ — Data Migration Script                              [M]
   • scripts/migrate_sqlite_to_firestore.py
   • Read all SQLite data → batch write to Firestore
   • Verify counts + checksums

٠.١١ — Seed Data Migration                                [S]
   • seed/ → Firestore seeding (currencies, chart of accounts, tax rates)

٠.١٢ — Remove SQLAlchemy + Alembic                        [S]
   • requirements.txt cleanup
   • Delete models/, alembic/, alembic.ini
   • Delete database.py
```

**کۆی قۆناغ ٠: ~١٢ ئەرک | Effort: XL**

---

## قۆناغ ١ — Critical Features (ئەوانەی ئێستا لە MASTER_PLAN هەن)
> **Effort:** XL | **ئەیگێنت:** باکئێند + فرۆنتئێند
> **پێشینە:** قۆناغ ٠ تەواوببێت

```
١.١  Bank Reconciliation UI                               [L]
١.٢  Bank Rules                                           [M]
١.٣  CSV Import for Bank Statements                       [M]
١.٤  Price Lists                                          [M]
١.٥  Warehouses + Stock Transfers                         [M]
١.٦  Progress Invoicing                                   [M]
١.٧  Retainer Invoices                                    [M]
١.٨  Credit Note → Apply to Invoice                       [M]
١.٩  Early Payment Discount (Skonto)                      [S]
١.١٠ Tax Returns                                          [M]
١.١١ Fixed Asset Management                               [L]
```

**ترتیب:**
```
پاراللەل گرووپ A: ١.٢ + ١.٤ + ١.٩ + ١.١٠ (سەربەخۆن)
پاراللەل گرووپ B: ١.٥ + ١.٨ + ١.١١ (سەربەخۆن)
دواتر: ١.٣ (دوای ١.٢) → ١.١ (دوای ١.٢+١.٣) → ١.٦ → ١.٧ (دوای ١.٦)
```

---

## قۆناغ ٢ — PDF + Email + Reports
> **Effort:** L | **پێشینە:** قۆناغ ٠

```
٢.١  PDF Generation (لەگەڵ Firebase Storage upload)       [M]
٢.٢  Email Service                                        [M]
٢.٣  Auto-Reminder Scheduling (تایبەتمەندی ٢٠)           [M]
٢.٤  Account Transactions Report                          [S]
٢.٥  Budget vs Actual Report                              [S]
٢.٦  Project Profitability Report                         [S]
٢.٧  Customer Statement (تایبەتمەندی ٢٤)                 [M]
٢.٨  Vendor Statement (تایبەتمەندی ٢٥)                   [S]
٢.٩  Excel/PDF Export بۆ هەموو ڕاپۆرت                     [M]
```

---

## قۆناغ ٣ — Portals + Security
> **Effort:** L | **پێشینە:** قۆناغ ٢ (PDF پێویستە)

```
٣.١  Customer Portal (تایبەتمەندی ٧)                      [L]
٣.٢  Vendor Portal (تایبەتمەندی ٨)                        [M]
٣.٣  Payment Link Generation (تایبەتمەندی ١٩)             [M]
٣.٤  Two-Factor Authentication (تایبەتمەندی ٢٩)           [M]
٣.٥  Granular Permissions (تایبەتمەندی ٢٨)                [M]
```

---

## قۆناغ ٤ — Automation
> **Effort:** L | **پێشینە:** قۆناغ ٠

```
٤.١  Approval Workflows (تایبەتمەندی ١١)                  [L]
٤.٢  Recurring Bills (تایبەتمەندی ٢١)                     [M]
٤.٣  Expense Claims (تایبەتمەندی ١٠)                      [L]
٤.٤  Detailed Audit Trail (تایبەتمەندی ٢٧)                [L]
```

---

## قۆناغ ٥ — Advanced Inventory
> **Effort:** XL | **پێشینە:** قۆناغ ١ (warehouses پێویستە)

```
٥.١  Custom Fields (تایبەتمەندی ١٢)                       [L]
٥.٢  Composite Items / BOM (تایبەتمەندی ٣)                [L]
٥.٣  Serial Number Tracking (تایبەتمەندی ١)               [M]
٥.٤  Batch/Lot Tracking (تایبەتمەندی ٢)                   [M]
٥.٥  Delivery Challans (تایبەتمەندی ٥)                    [M]
٥.٦  Shipment Tracking (تایبەتمەندی ٤)                    [M]
٥.٧  Sales/Purchase Returns (تایبەتمەندی ٦)               [L]
٥.٨  Landed Cost Allocation (تایبەتمەندی ١٥)              [M]
```

---

## قۆناغ ٦ — Reports + Import/Export
> **Effort:** L | **پێشینە:** قۆناغ ٥

```
٦.١  Inventory Aging Report (تایبەتمەندی ١٦)              [M]
٦.٢  Stock Summary Report (تایبەتمەندی ١٧)                [S]
٦.٣  Warehouse Transfer Report (تایبەتمەندی ١٨)           [S]
٦.٤  Custom Reports (تایبەتمەندی ١٣)                      [XL]
٦.٥  Chart of Accounts Import/Export (تایبەتمەندی ٢٣)     [S]
٦.٦  Opening Balance Import (تایبەتمەندی ٢٢)              [M]
٦.٧  Journal Import (تایبەتمەندی ٢٦)                      [M]
٦.٨  Multi-Currency Gain/Loss (تایبەتمەندی ٩)             [M]
```

---

## قۆناغ ٧ — Innovation + UX
> **Effort:** XL | **پێشینە:** هەموو قۆناغ

```
٧.١  Multi-Branch Support (تایبەتمەندی ٣٠)                [L]
٧.٢  Document Attachments Cloud (تایبەتمەندی ١٤)          [M]
٧.٣  Kurdish Tax Compliance                               [M]
٧.٤  WhatsApp Invoice Sending                             [M]
٧.٥  Barcode Scanning                                     [M]
٧.٦  Global Search (Ctrl+K)                               [M]
٧.٧  Advanced Dashboard Widgets                           [L]
٧.٨  Custom Invoice Templates                             [M]
٧.٩  PWA + Offline Mode                                   [L]
```

---

## خاریتەی پێشینەکان (Dependency Graph)

```
قۆناغ ٠ ──────────────────────────────────────────┐
    │                                               │
    ├──→ قۆناغ ١ (Critical Features)                │
    │         │                                     │
    │         └──→ قۆناغ ٥ (Advanced Inventory)     │
    │                   │                           │
    │                   └──→ قۆناغ ٦ (Reports)      │
    │                                               │
    ├──→ قۆناغ ٢ (PDF + Email) ──→ قۆناغ ٣ (Portals)│
    │                                               │
    ├──→ قۆناغ ٤ (Automation) ← سەربەخۆ            │
    │                                               │
    └──→ قۆناغ ٧ (Innovation) ← دوای هەموو ─────────┘
```

**پاراللەل ئەتوانرێت:**
- قۆناغ ١ + قۆناغ ٢ + قۆناغ ٤ → هەرسێ بە یەکەوە (سەربەخۆن)
- قۆناغ ٣ → دوای ٢
- قۆناغ ٥ → دوای ١
- قۆناغ ٦ → دوای ٥
- قۆناغ ٧ → دوای هەموو

---

# بەشی ٦: ئۆپتیمایزکردن بۆ Free Tier

## ٦.١ — سنوورەکان و ئەوەی ئەتوانین بیکەین

```
┌──────────────┬──────────────┬──────────────────────────────────┐
│ سنوور        │ ژمارە        │ بۆ سیستەمی ئەکاونتینگ          │
├──────────────┼──────────────┼──────────────────────────────────┤
│ Reads/day    │ 50,000       │ ~2,000 read per user/day باسە    │
│ Writes/day   │ 20,000       │ ~100 invoice/day + journal باسە  │
│ Deletes/day  │ 20,000       │ بەندرت ئەسرێتەوە               │
│ Storage      │ 1 GB         │ ~50,000 invoice doc باسە         │
│ File Storage │ 5 GB         │ ~10,000 PDF باسە                │
│ Download     │ 1 GB/day     │ ~200 PDF download/day باسە       │
└──────────────┴──────────────┴──────────────────────────────────┘
```

## ٦.٢ — Caching Strategy (کەمکردنەوەی Reads)

```python
# backend/app/cache.py
from cachetools import TTLCache
import threading

class AppCache:
    def __init__(self):
        self._lock = threading.Lock()
        # 1000 item, 5 min TTL
        self._cache = TTLCache(maxsize=1000, ttl=300)
        # Long-lived cache for rarely changing data
        self._static_cache = TTLCache(maxsize=500, ttl=3600)  # 1 hour
    
    def get(self, key: str):
        with self._lock:
            return self._cache.get(key)
    
    def set(self, key: str, value, ttl_override: int = None):
        with self._lock:
            self._cache[key] = value
    
    def delete(self, key: str):
        with self._lock:
            self._cache.pop(key, None)
    
    def get_static(self, key: str):
        """بۆ currencies, accounts, tax_rates — نرخی خوێندنەوە ١ جار لە کاتژمێر"""
        with self._lock:
            return self._static_cache.get(key)
    
    def set_static(self, key: str, value):
        with self._lock:
            self._static_cache[key] = value
    
    def invalidate_pattern(self, pattern: str):
        """سڕینەوەی هەموو cache بەپێی pattern"""
        with self._lock:
            keys_to_delete = [k for k in self._cache if pattern in k]
            for k in keys_to_delete:
                del self._cache[k]

cache = AppCache()
```

### Caching Rules:

```
Static Data (1 ساعەت cache):
  ├── currencies           → نرخی خوێندن: ~0
  ├── chart of accounts    → نرخی خوێندن: ~0
  ├── tax_rates            → نرخی خوێندن: ~0
  ├── settings             → نرخی خوێندن: ~0
  ├── custom_field_defs    → نرخی خوێندن: ~0
  └── invoice_templates    → نرخی خوێندن: ~0

Session Data (5 دەقیقە cache):
  ├── user profile         → 1 read per 5 min (نەک per request)
  ├── organization         → 1 read per 5 min
  └── dashboard stats      → 1 read per 5 min

Entity Data (invalidate on write):
  ├── invoice detail       → cache until update
  ├── contact detail       → cache until update
  └── item detail          → cache until update

List Data (2 دەقیقە cache):
  ├── invoice list (page 1) → most visited, cache short
  └── recent activity       → cache 2 min
```

### تەنانەت: User Auth Caching

```python
# services/auth.py
def get_current_user(token: str) -> User:
    payload = jwt.decode(token, ...)
    user_id = payload.get("sub")
    
    # Cache user for 5 minutes → saves 1 read per API call!
    cache_key = f"user:{user_id}"
    cached_user = cache.get(cache_key)
    if cached_user:
        return cached_user
    
    user_doc = db.collection("users").document(user_id).get()
    if user_doc.exists:
        user = user_doc.to_dict()
        user["id"] = user_doc.id
        cache.set(cache_key, user, ttl_override=300)
        return user
    raise HTTPException(401)
```

**ئەنجام:** لەوەی ١ read/request → ١ read/5min بۆ auth = **~٩٥% کەمتر read بۆ auth**

## ٦.٣ — Batch Operations (کەمکردنەوەی Writes)

```python
# Firestore batch write: هەر batch = 500 operation max
# ئەمە ١ write حساب دەکرێت نەک ٥٠٠

def batch_create_journal_and_update(invoice_data, journal_data, lines):
    batch = db.batch()
    
    # 1 invoice doc
    inv_ref = db.collection("invoices").document()
    batch.set(inv_ref, invoice_data)
    
    # N invoice lines
    for line in lines:
        ref = inv_ref.collection("lines").document()
        batch.set(ref, line)
    
    # 1 journal entry
    je_ref = db.collection("journal_entries").document()
    batch.set(je_ref, journal_data)
    
    # Update balances
    for acc_update in balance_updates:
        ref = db.collection("accounts").document(acc_update["id"])
        batch.update(ref, {"balance": firestore.Increment(acc_update["amount"])})
    
    batch.commit()  # هەمووی وەک ١ network call
```

### Write Budget بۆ ڕۆژانە:

```
ئەگەر کۆمپانییەک لە ڕۆژێکدا:
  - 20 invoice دروست بکات    = 20 write (+ 20×5 lines = 100)
  - 20 journal entry          = 20 write (+ 20×2 lines = 40)
  - 50 account balance update = 50 write
  - 10 payment                = 10 write
  - 5 expense                 = 5 write
  - miscellaneous             = 50 write
  ─────────────────────────────
  Total: ~295 write/day
  
  Free tier: 20,000 write/day → %1.5 بەکارهاتوو ✅
  (تەنانەت ١٠ بەکارهێنەر بە یەکەوە باسە)
```

## ٦.٤ — Denormalization Strategy (کەمکردنەوەی reads + بەبێ joins)

```
# لە Firestore join نییە — بۆیە:

Invoice document هەروەها دەگرێتەوە:
  contact_name: "ئاکۆ محمد"      ← نەک تەنها contact_id
  
Contact document هەروەها:  
  outstanding_balance: 5000000    ← نەک query لەسەر invoices
  unused_credits: 250000          ← نەک query لەسەر credit_notes

Account document:
  balance: 15000000              ← نەک SUM() لەسەر journal lines

Item document:
  stock_on_hand: 150             ← نەک query لەسەر warehouse_stock

Dashboard:
  org_level_counter document لە "counters" collection:
    total_receivable: number
    total_payable: number
    monthly_revenue: number
    invoice_count_by_status: map
```

### نوێکردنەوەی Denormalized Fields:

```python
# هەر کات contact_name بگۆڕدرێت:
def update_contact_name(contact_id: str, new_name: str):
    # 1. Update contact
    db.collection("contacts").document(contact_id).update({"display_name": new_name})
    
    # 2. Background task: update all invoices with this contact
    # (ئەمە دەتوانرێت async بکرێت — consistency eventual باسە)
    invoices = db.collection("invoices") \
        .where("contact_id", "==", contact_id).stream()
    
    batch = db.batch()
    count = 0
    for inv in invoices:
        batch.update(inv.reference, {"contact_name": new_name})
        count += 1
        if count >= 499:
            batch.commit()
            batch = db.batch()
            count = 0
    if count > 0:
        batch.commit()
```

## ٦.٥ — Counter Documents (بەجای COUNT queries)

```python
# بەجای: db.collection("invoices").where(...).count()
# بەکار بهێنە: counter document

# counters/{org_id}
{
    "invoices_draft": 5,
    "invoices_sent": 12,
    "invoices_overdue": 3,
    "invoices_paid": 150,
    "total_receivable": 25000000,
    "total_payable": 8000000,
    "items_count": 324,
    "contacts_count": 89
}

# هەر کات invoice دروست دەبێت:
db.collection("counters").document(org_id).update({
    "invoices_draft": firestore.Increment(1)
})

# هەر کات status دەگۆڕدرێت:
db.collection("counters").document(org_id).update({
    f"invoices_{old_status}": firestore.Increment(-1),
    f"invoices_{new_status}": firestore.Increment(1),
})

# Dashboard: 1 read بۆ هەموو stats ← بەجای 10+ queries
```

## ٦.٦ — Frontend Optimization (کەمکردنەوەی API calls)

```typescript
// store.ts — Zustand لەگەڵ caching

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // ms
}

const isStale = (entry: CacheEntry<any>) => 
  Date.now() - entry.timestamp > entry.ttl;

// Dashboard: 5 min cache
// Lists: 2 min cache
// Details: cache until navigate away
// Static: 1 hour (currencies, accounts, taxes)

// ئەگەر data لە cache هەیە و stale نییە → API نەنێرە → 0 reads
```

### Pagination Best Practices:

```
# Frontend: page size = 25 (نەک 100)
# هەر page = 25 read
# ئەگەر 10 page load بکەیت = 250 read
# 50,000 read/day = 200 page load → ~20 page load per user per day بۆ 10 user باسە
```

## ٦.٧ — Storage Optimization

```
PDF Caching:
  - PDF دروستکراو → Firebase Storage upload
  - دوای ئەوە: download لە Storage (نەک regenerate)
  - ئەگەر invoice update بکرێت → PDF invalidate

Image Optimization:
  - لۆگۆ: max 500KB, resize لە backend
  - وێنەی receipt: max 2MB, compress

Storage Budget:
  PDFs: ~50KB × 10,000 = 500 MB
  Logos: ~200KB × 10 = 2 MB
  Attachments: ~2MB × 1000 = 2 GB
  Receipts: ~1MB × 500 = 500 MB
  ────────────────────────
  Total: ~3 GB (لە 5 GB free)
```

## ٦.٨ — ئۆپتیمایزکردنی Search (بەبێ Full-Text Search)

```python
# Firestore full-text search نییە
# چارەسەرەکان:

# 1. Prefix search (بۆ autocomplete):
query.where("display_name", ">=", search_term) \
     .where("display_name", "<=", search_term + "\uf8ff")

# 2. Search keywords field (بۆ بەهێزتر):
# لە کاتی create/update: keywords array دروستبکە
def generate_keywords(text: str) -> list:
    words = text.lower().split()
    keywords = set()
    for word in words:
        for i in range(1, len(word) + 1):
            keywords.add(word[:i])  # prefix substrings
    return list(keywords)

# Document:
{
    "display_name": "ئاکۆ محمد",
    "search_keywords": ["ئ", "ئا", "ئاک", "ئاکۆ", "م", "مح", "محم", "محمد"]
}

# Query:
query.where("search_keywords", "array_contains", search_term.lower())
# ئەمە 1 read هەیە نەک full scan

# 3. Global Search (Ctrl+K):
# Parallel queries لەسەر invoices + contacts + items
# هەر یەکە 1 read = 3 reads total
```

---

# 📊 ئاماری کۆتایی

```
┌───────────────────────────┬──────────┬──────────┐
│ بابەت                     │ ئێستا    │ دوای پلان │
├───────────────────────────┼──────────┼──────────┤
│ Firestore Collections     │ 0        │ 55+      │
│ Composite Indexes         │ 0        │ 17       │
│ API Endpoints             │ ~97      │ ~320     │
│ Frontend Pages            │ 23       │ 80+      │
│ Reports                   │ 12       │ 30+      │
│ Backend Files (new/changed)│ 0       │ 50+      │
│ i18n Keys (estimated)     │ ~300     │ ~900     │
│ Zustand Stores            │ 1        │ 5+       │
├───────────────────────────┼──────────┼──────────┤
│ تایبەتمەندی نوێ          │ 0        │ 30       │
│ قۆناغ                     │ -        │ 8 (0-7)  │
└───────────────────────────┴──────────┴──────────┘
```

## ✅ چەکلیست — ئایا هەمووت لەبیر بوو?

```
☑ Auth system (JWT — ئەمێنێت + 2FA نوێ)
☑ Admin panel (permissions granular)
☑ Error pages (404, 500 — هەیە)
☑ Loading states (skeletons — هەیە)
☑ Empty states (no items — هەیە)
☑ Search + Filters + Sorting + Pagination (cursor-based)
☑ Dark mode (هەیە)
☑ Responsive / mobile-first (هەیە)
☑ RTL support (Kurdish — هەیە)
☑ SEO metadata (نەک SPA concern — بەڵام OG tags)
☑ Toast / feedback system (Ant Design message — هەیە)
☑ Navbar + Footer (هەیە)
☑ Environment variables documented
☑ Middleware (auth + permission + audit)
☑ Confirmation dialogs (delete, cancel — هەیە)
☑ Email notifications (SMTP — هەیە)
☑ Firestore security rules (if false — admin SDK only)
☑ Storage security (server-side only)
☑ Caching strategy (in-memory TTL)
☑ Free tier budget management
☑ Data migration script (SQLite → Firestore)
☑ Denormalization strategy
☑ Counter documents for dashboard
☑ Batch operations for writes
```

---

## ⚡ ئۆردەری جێبەجێکردن — خاریتەی تەواو

```
هەفتە ١-٣:   قۆناغ ٠ (Firebase Migration) ← ئەمە یەکەم — هیچ شتێک بەبێ ئەمە نابێت
هەفتە ٢-٤:   قۆناغ ١ (Critical Features) ← پاراللەل لەگەڵ قوناغ ٠ لە هەفتە ٢
هەفتە ٣-٤:   قۆناغ ٢ (PDF + Email + Reports) ← پاراللەل لەگەڵ قۆناغ ١
هەفتە ٤-٥:   قۆناغ ٤ (Automation) ← پاراللەل
هەفتە ٥-٦:   قۆناغ ٣ (Portals + Security) ← دوای قۆناغ ٢
هەفتە ٦-٨:   قۆناغ ٥ (Advanced Inventory) ← دوای قۆناغ ١
هەفتە ٨-٩:   قۆناغ ٦ (Reports + Import) ← دوای قۆناغ ٥
هەفتە ٩-١٢:  قۆناغ ٧ (Innovation + UX) ← دوای هەموو
```

---

ئەم نەخشەیە ئەوەندە تەواوە کە **شادۆ مێشک** ئەتوانێت ڕاستەوخۆ ئەیگێنتەکان بەپێی بنێرێت — هیچ فیچەرێک لەقەڵەم نەچووە، هیچ dependency ـێک وەبیرنەچووە، و free tier budget بە وردی حسابکراوە.