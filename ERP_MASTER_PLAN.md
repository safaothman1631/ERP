# 🏛️ ERP MASTER PLAN — گواستنەوەی Zoho Books بۆ ERP کامل

> **سەرچاوە:** [odoo-19-MASTER.md](odoo-docs-19/_merged/odoo-19-MASTER.md) (١,١٢٠ فایل، ٩.٦٨ MB)
> **ئامانج:** پرۆژەی ئێستا (٢٨١ endpoint، ٤١ لاپەڕە) بکەینە ERP یەکگرتووی کامڵ وەک Odoo
> **شێواز:** ١٥ ئەیگێنتی پسپۆڕ + ئۆرکیستراتۆر لە ژێر `erp-brain`

---

## 📊 وضعیتی ئێستا — پرۆژەکەت

| بابەت | وشیاری |
|--------|--------|
| Backend | 281 route (FastAPI + Firestore) |
| Frontend | 41 page (React 19 + AntD 6 + RTL) |
| Module | Accounting, Invoicing, Banking, Inventory, Projects, Taxes |
| زمان | کوردی RTL + English LTR |
| کەم | CRM, Manufacturing, HR/Payroll, POS, E-commerce, Marketing, Fleet, Appraisals |

---

## 🎯 نەخشەی ERP — ١٢ مۆدولی نوێ

| # | مۆدول | ئەیگێنتی بەرپرس | سەرچاوەی Odoo |
|---|-------|----------------|---------------|
| 1 | **CRM** (Leads → Opportunities → Pipeline) | `erp-crm` | `applications/sales/crm` |
| 2 | **Sales + Purchase** (SO, PO, Delivery, RFQ) | `erp-sales-purchase` | `applications/sales/sales` + `inventory_and_mrp/purchase` |
| 3 | **Inventory + MRP** (BOM, Work Orders, Lots, Barcode) | `erp-inventory-mrp` | `inventory_and_mrp/inventory` + `manufacturing` |
| 4 | **HR + Payroll** (Employees, Attendance, Time-off, Payslips) | `erp-hr-payroll` | `applications/hr/*` |
| 5 | **Project + Timesheet** (Tasks, Planning, Profitability) | `erp-project-timesheet` | `applications/services/project` + `timesheets` |
| 6 | **POS** (Sessions, Cash Control, Restaurant) | `erp-pos` | `applications/sales/point_of_sale` |
| 7 | **E-commerce + Website** (Online Store, CMS) | `erp-ecommerce-website` | `applications/websites/*` |
| 8 | **Marketing** (Email, SMS, Automation, Events) | `erp-marketing` | `applications/marketing/*` |
| 9 | **Localization Iraq** (Kurdish tax, IQD, compliance) | `erp-localization-iraq` | `applications/finance/fiscal_localizations` |
| 10 | **Security + Audit** (Roles, Access Rights, Audit Log) | `erp-security-audit` | `applications/general/users` + developer/security |
| 11 | **Integration** (Webhooks, OCR, WhatsApp, API) | `erp-integration` | `developer/reference/external_api` |
| 12 | **Migration** (Data import from legacy) | `erp-migration` | `applications/finance/accounting/customer_invoices/import` |

### پشتیوانی

| ئەیگێنت | کار |
|---------|-----|
| `erp-brain` | ئۆرکیستراتۆری گشتی — ئەرکەکان دابەش دەکات و چاودێریان دەکات |
| `erp-odoo-researcher` | دۆکیومێنتی Odoo دەخوێنێتەوە و spec دەردەکات |
| `erp-devops` | دیپلۆی، monitoring، backup، CI/CD |
| `erp-ux-designer` | Dark mode، PWA، Ctrl+K، Templates، Dashboard |

### ئەیگێنتە پێشوەختەکان (بەردەوام بەکاردێن)

| ئەیگێنت | کار |
|---------|-----|
| `زۆهۆ داتابەیس` | Firestore schema، repositories |
| `زۆهۆ ئەکاونتینگ` | Journal entries، double-entry |
| `زۆهۆ باکئێند` | FastAPI endpoints |
| `زۆهۆ فرۆنتئێند` | React pages، AntD components |
| `زۆهۆ تێستەر` | QA، تاقیکردنەوە |

---

## 🗺 قۆناغەکان — ٨ Sprint

### Sprint 1 — بنەما (٢ هەفتە)
- `erp-security-audit`: ڕۆڵ و دەسەڵاتی پێشکەوتوو (RBAC + Groups)
- `erp-localization-iraq`: مالیاتی کوردستان (Withholding 3-5%، VAT، Corporate 15%)
- `erp-ux-designer`: Dark Mode + Dashboard Widgets + Ctrl+K

### Sprint 2 — CRM + Sales Lifecycle (٢ هەفتە)
- `erp-crm`: Lead → Opportunity → Pipeline (Kanban)
- `erp-sales-purchase`: SO → Delivery Order، PO → Receipt، RFQ workflow

### Sprint 3 — Inventory + MRP (٣ هەفتە)
- `erp-inventory-mrp`:
  - Stock Moves، Lots/Serials، Putaway Rules
  - BOM (Bill of Materials)، Work Orders، Routing
  - Barcode scanning + Mobile

### Sprint 4 — HR + Payroll (٢ هەفتە)
- `erp-hr-payroll`:
  - Employees + Contracts
  - Attendance (Face/PIN/Manual)
  - Time-off (Allocation + Approval)
  - Payroll (Salary Rules بۆ عێراق: Tax + Social Security)

### Sprint 5 — Project + Timesheet (١ هەفتە)
- `erp-project-timesheet`:
  - پێشکەوتنی ئێستا + Gantt + Planning + Profitability

### Sprint 6 — POS (٢ هەفتە)
- `erp-pos`:
  - Session management + Cash Control
  - Product variants + Barcode
  - Offline mode (IndexedDB sync)

### Sprint 7 — E-commerce + Marketing (٢ هەفتە)
- `erp-ecommerce-website`: Online Store + Product catalog + Checkout
- `erp-marketing`: Email Campaigns + SMS + Automation

### Sprint 8 — Integration + Migration + Polish (٢ هەفتە)
- `erp-integration`: WhatsApp، OCR، Webhooks، External API
- `erp-migration`: Excel/CSV bulk import
- `erp-devops`: Production deploy، Backups، Monitoring

---

## 📁 ڕێکخستنی فایلی پرۆژە

```
zoho/
├── ERP_MASTER_PLAN.md          ← ئەم فایلە
├── .github/agents/
│   ├── erp-brain.agent.md       ← ئۆرکیستراتۆر
│   ├── erp-odoo-researcher.agent.md
│   ├── erp-crm.agent.md
│   ├── erp-sales-purchase.agent.md
│   ├── erp-inventory-mrp.agent.md
│   ├── erp-hr-payroll.agent.md
│   ├── erp-project-timesheet.agent.md
│   ├── erp-pos.agent.md
│   ├── erp-ecommerce-website.agent.md
│   ├── erp-marketing.agent.md
│   ├── erp-localization-iraq.agent.md
│   ├── erp-security-audit.agent.md
│   ├── erp-integration.agent.md
│   ├── erp-devops.agent.md
│   ├── erp-ux-designer.agent.md
│   └── erp-migration.agent.md
├── backend/app/api/              ← مۆدولەکانی نوێ لێرە زیاد دەبن
│   ├── crm.py, leads.py
│   ├── hr/employees.py, attendance.py, timeoff.py, payroll.py
│   ├── mrp/boms.py, work_orders.py
│   ├── pos/sessions.py, orders.py
│   └── ...
└── frontend/src/pages/           ← لاپەڕە نوێیەکان
    ├── CRM/Pipeline.tsx, Leads.tsx
    ├── HR/Employees.tsx, Attendance.tsx, Payslips.tsx
    └── ...
```

---

## 🚀 شێوازی کارکردن لەگەڵ ئەیگێنتەکان

```
کاربەر → erp-brain
         ↓
    پلان دادەنرێت (بەپێی Sprint)
         ↓
    ┌────┴────┬────────┬─────────┐
    ↓         ↓        ↓         ↓
erp-odoo   زۆهۆ      erp-<      زۆهۆ
researcher داتابەیس  module>    تێستەر
(spec)    (schema)   (logic)    (QA)
         ↓
    Integration → erp-localization-iraq (tax/currency)
         ↓
    UI → زۆهۆ فرۆنتئێند + erp-ux-designer
         ↓
    Deploy → erp-devops
```

---

## 🎯 ئامانجی کۆتایی

| پێوانە | ئێستا | ERP کامل |
|--------|-------|----------|
| مۆدول | 6 | **18+** |
| API endpoint | 281 | **800+** |
| لاپەڕە | 41 | **150+** |
| ئەیگێنت | 7 | **22** |
| زمان | 2 | 4 (کوردی، عەرەبی، ئینگلیزی، تورکی) |
| مۆبایل | - | PWA + Native-feel |
| Offline | - | POS + Inventory |

> **ئاکام:** سیستەمێکی ERP یەکگرتوو کە لە Odoo لایەنی پڕۆ بێت، بەڵام بۆ کوردستان تایلۆر کراوە.
