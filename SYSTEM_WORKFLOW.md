# Zoho ERP — System Logic & Workflow Diagrams

> دیاگرامی تەواوی کارکردنی سیستەم — هەر بەشێک چۆن بە بەشەکانی تر دەبەستێتەوە.
> Generated: Apr 26, 2026

---

## 1. High-Level Architecture (Layered View)

```mermaid
flowchart TB
    subgraph CLIENT[" Client Layer "]
        BROWSER["Browser<br/>React 19 + Vite + AntD RTL"]
        MOBILE["Mobile PWA<br/>(planned)"]
    end

    subgraph FRONTEND[" Frontend Layer (React/TS) "]
        ROUTER["React Router<br/>App.tsx"]
        STORE["Zustand store<br/>(auth, ui, modules)"]
        I18N["i18next<br/>ku/en RTL"]
        PAGES["80+ Pages<br/>(Invoices, POS, HR, CRM...)"]
        APICLIENT["axios api.ts<br/>JWT interceptor"]
    end

    subgraph BACKEND[" Backend Layer (FastAPI) "]
        MIDDLEWARE["Middleware<br/>Auth + Audit + RateLimit + CORS"]
        ROUTERS["100+ API Routers"]
        SERVICES["Services<br/>auth · permissions · tax · email"]
        REPOS["Repositories<br/>BaseRepository org-scoped"]
    end

    subgraph DATA[" Data Layer "]
        FIRESTORE[("Firestore<br/>NoSQL collections")]
        STORAGE[("Firebase Storage<br/>attachments, PDFs")]
        CACHE[("In-memory cache")]
    end

    subgraph EXT[" External Services "]
        FIREBASEAUTH["Firebase Auth<br/>Google SSO"]
        SMTP["SMTP<br/>invite/reminders"]
        WHATSAPP["WhatsApp Business"]
        FIB["FIB / Zain Cash<br/>Iraq payments"]
        OCR["OCR engine"]
        EINV["Iraq E-Invoice Gateway"]
    end

    BROWSER --> ROUTER
    MOBILE --> ROUTER
    ROUTER --> PAGES
    PAGES --> STORE
    PAGES --> I18N
    PAGES --> APICLIENT
    APICLIENT -->|HTTPS + JWT| MIDDLEWARE
    MIDDLEWARE --> ROUTERS
    ROUTERS --> SERVICES
    SERVICES --> REPOS
    REPOS --> FIRESTORE
    REPOS --> CACHE
    SERVICES --> STORAGE
    SERVICES --> FIREBASEAUTH
    SERVICES --> SMTP
    SERVICES --> WHATSAPP
    SERVICES --> FIB
    SERVICES --> OCR
    SERVICES --> EINV
```

---

## 2. Authentication & Onboarding Flow

```mermaid
flowchart LR
    START([User opens app]) --> CHECK{Has JWT?}
    CHECK -->|No| LOGIN[/login page/]
    CHECK -->|Yes| DASH[Dashboard]

    LOGIN --> CHOICE{Action?}
    CHOICE -->|Sign Up| REG["/register<br/>create org + admin user<br/>seed CoA + taxes + sequences"]
    CHOICE -->|Login| AUTHN["POST /api/auth/login<br/>bcrypt verify + lockout check"]
    CHOICE -->|Google| GAUTH["Firebase Auth<br/>POST /api/auth/firebase-login"]
    CHOICE -->|Forgot| FP["/forgot-password<br/>email reset link"]
    CHOICE -->|Invited| INV["/accept-invite?token=xxx<br/>POST /api/users/accept-invite"]

    REG --> JWT
    AUTHN --> JWT
    GAUTH --> JWT
    INV --> JWT

    JWT[JWT issued<br/>last_login tracked] --> RBAC{Permission check<br/>require_perm}
    RBAC -->|Allowed| DASH
    RBAC -->|Denied| ERR403[403]

    DASH --> MODULES[Choose module]
```

---

## 3. Core Module Map (Domains)

```mermaid
mindmap
  root((Zoho ERP))
    Accounting
      Chart of Accounts
      Journal Entries
      Trial Balance
      Balance Sheet
      P&L
      Cash Flow
      Currency / FX
      Tax Rates
      Withholding (Iraq)
      Transaction Locking
      Fiscal Periods
    Sales
      Quotes
      Sales Orders
      Invoices
      Recurring Invoices
      Credit Notes
      Sales Returns
      Delivery Challans
      Payment Links
      Payments Received
    Purchase
      Purchase Orders
      Bills
      Vendor Credits
      Recurring Bills
      Purchase Returns
      Payments Made
      Expenses
      Expense Claims
      OCR Receipts
    Inventory
      Items / Products
      Price Lists
      Warehouses
      Stock Adjustments
      Shipments
      Serial Numbers / Lots
      Barcodes
    Manufacturing
      BOMs
      Work Centers
      Manufacturing Orders
      Quality Checks
    HR / Payroll
      Employees
      Contracts
      Attendance
      Time Off
      Payroll Rules
      Payroll Runs
      Payslips
    CRM
      Leads
      Pipeline
      Activities
      Insights
    POS
      Sessions
      Cashiers
      Receipts
      Loyalty
      Restaurant Tables
    Banking
      Bank Accounts
      Reconciliation
      Bank Rules
      Transactions
    Projects
      Tasks
      Timesheets
      Milestones
    System
      Users
      RBAC Roles
      Audit Log
      Custom Fields
      Companies / Branches
      Approvals
      Trash
      Settings
    Iraq Localization
      VAT
      Withholding 5%
      E-Invoice
      FIB Payments
      Hijri Calendar
    Integrations
      WhatsApp
      Email
      OCR
      Webhooks
      Imports / Exports
```

---

## 4. Sales-to-Cash Flow (Quote-to-Payment)

```mermaid
sequenceDiagram
    actor Sales as Sales Rep
    participant FE as Frontend
    participant API as FastAPI
    participant DB as Firestore
    participant Email as SMTP
    participant Acct as Accounting

    Sales->>FE: Create Quote
    FE->>API: POST /api/quotes
    API->>DB: Save quote (status=draft)
    Sales->>FE: Send to customer
    FE->>API: POST /api/quotes/{id}/send
    API->>Email: Send PDF
    Note over DB: status=sent
    Sales->>FE: Customer accepted
    FE->>API: POST /api/quotes/{id}/convert-to-so
    API->>DB: Create SalesOrder + link
    Sales->>FE: Convert SO to Invoice
    FE->>API: POST /api/sales-orders/{id}/convert-to-invoice
    API->>DB: Create Invoice (status=draft)
    API->>DB: Allocate sequence number
    Sales->>FE: Send Invoice
    FE->>API: POST /api/invoices/{id}/send
    API->>Email: PDF + reminder schedule
    Note over DB: status=sent · balance_due=total

    actor Cust as Customer
    Cust->>FE: Pay (online / cash)
    FE->>API: POST /api/payments-received
    API->>DB: Save payment + reduce balance_due
    API->>Acct: Journal entry (DR cash, CR AR)
    Note over DB: invoice.status=paid if balance=0

    Note over Sales,Acct: Audit log entry created<br/>(every mutation)
```

---

## 5. Procure-to-Pay Flow (PO → Bill → Payment)

```mermaid
sequenceDiagram
    actor Buyer as Purchasing
    participant FE as Frontend
    participant API as FastAPI
    participant Inv as Inventory
    participant Acct as Accounting

    Buyer->>FE: Create PO
    FE->>API: POST /api/purchase-orders
    API->>API: Allocate PO number
    Buyer->>FE: Send to vendor
    actor Vendor
    Vendor->>FE: Goods received
    FE->>API: POST /api/shipments (receipt)
    API->>Inv: Increase stock + lot/serial
    Vendor->>Buyer: Bill received
    Buyer->>FE: Convert PO to Bill
    FE->>API: POST /api/bills
    API->>Acct: Journal (DR expense/asset, CR AP)
    Note over API: Three-way match<br/>(PO + Receipt + Bill)
    Buyer->>FE: Pay vendor
    FE->>API: POST /api/payments-made
    API->>Acct: Journal (DR AP, CR cash)
    Note over Acct: bill.status=paid
```

---

## 6. RBAC + Audit Logging

```mermaid
flowchart TB
    REQ[Incoming Request] --> AUTHMW{JWT valid?}
    AUTHMW -->|No| R401[401]
    AUTHMW -->|Yes| LOAD[Load user + org_id]
    LOAD --> PERM[get_user_permissions]
    PERM --> LEGACY[Legacy role mapping]
    PERM --> RBAC[user_roles → roles → permissions]
    PERM --> MERGE[Union of all permissions]
    MERGE --> CHECK{require_perm passes?}
    CHECK -->|No| R403[403]
    CHECK -->|Yes| HANDLER[Endpoint handler]
    HANDLER --> AUDIT{Mutation?<br/>POST/PUT/PATCH/DELETE}
    AUDIT -->|Yes| LOG[(audit_logs collection<br/>user · action · entity · diff)]
    AUDIT -->|No| RESP[Response]
    LOG --> RESP
```

---

## 7. POS Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Open: Cashier opens session<br/>POST /api/pos/sessions/open<br/>(opening_cash recorded)
    Open --> Selling: Customer arrives
    Selling --> Selling: Add items<br/>Apply discount<br/>Loyalty points
    Selling --> Payment: Checkout
    Payment --> Receipt: Process payment<br/>(cash/card/FIB)
    Receipt --> Selling: Next customer
    Receipt --> Refund: Refund requested
    Refund --> Selling
    Selling --> Closing: End of shift
    Closing --> Reconciled: Count cash<br/>POST /api/pos/sessions/close<br/>(variance computed)
    Reconciled --> [*]
    note right of Reconciled
        Z-report generated
        Journals posted
        Inventory deducted
    end note
```

---

## 8. Inventory & Stock Movement

```mermaid
flowchart LR
    PO[Purchase Order] -->|Receipt| IN((Stock IN))
    PROD[Manufacturing Order] -->|Finished good| IN
    RET_C[Customer Return] --> IN
    INV[Invoice / Shipment] -->|Delivery| OUT((Stock OUT))
    POS_SALE[POS Sale] --> OUT
    RET_V[Vendor Return] --> OUT
    ADJ[Stock Adjustment] -.-> IN
    ADJ -.-> OUT
    IN --> WH[(Warehouse Stock)]
    OUT --> WH
    WH --> SERIAL[Serial Numbers / Lots]
    WH --> VAL[Stock Valuation<br/>FIFO / LIFO / Avg]
    VAL --> ACCT[GL: Inventory Asset]
```

---

## 9. Iraq Localization — Withholding & E-Invoice

```mermaid
flowchart TB
    INV[Invoice created] --> CALC{Has withholding rule?}
    CALC -->|No| NORMAL[Standard total]
    CALC -->|Yes 5%| WH[Compute withholding<br/>line: WH receivable]
    WH --> JOURNAL[Journal:<br/>DR AR · CR Revenue · CR Tax · DR WH-Asset]
    JOURNAL --> EINV{E-Invoice required?}
    EINV -->|Yes| GATEWAY[POST to Iraq E-Invoice Gateway<br/>get UUID + QR]
    EINV -->|No| END
    GATEWAY --> SAVE[Save UUID + status on invoice]
    SAVE --> END([Customer copy with QR])
```

---

## 10. Frontend Page Tree (Top Routes)

```mermaid
flowchart LR
    APP[App.tsx] --> PUB[Public Routes]
    APP --> PROT[Protected /]
    PUB --> LOGIN[/login]
    PUB --> SIGN[/signup]
    PUB --> FORG[/forgot-password]
    PUB --> RES[/reset-password]
    PUB --> INV[/accept-invite]
    PROT --> AppLayout
    AppLayout --> SIDEBAR[Sidebar nav<br/>navigation.tsx]
    AppLayout --> TOPBAR[Topbar + Search]
    AppLayout --> OUTLET[Outlet]
    OUTLET --> DASH[Dashboard]
    OUTLET --> SALES_G[Sales group<br/>Quotes/SO/Invoices/Recurring/Credits]
    OUTLET --> PURCH_G[Purchase group<br/>PO/Bills/VC/Expenses]
    OUTLET --> ITEMS_G[Items + Price Lists + Inventory + Warehouses]
    OUTLET --> BANK_G[Banking + Reconciliation + Rules]
    OUTLET --> ACCT_G[Accounts + Journals + Taxes]
    OUTLET --> REP_G[Reports + Advanced + Consolidated]
    OUTLET --> POS_G[POS Sessions + POS Sale]
    OUTLET --> HR_G[HR Dashboard + Employees + Attendance + Payroll]
    OUTLET --> CRM_G[Pipeline + Leads + Activities + Insights]
    OUTLET --> MFG_G[BOMs + Orders + Work Centers]
    OUTLET --> SETUP_G[Users + Roles + Branches + CustomFields + Settings]
    OUTLET --> IRAQ[Iraq Localization + E-Invoice + Tax Returns]
```

---

## 11. Data Model Relationships (Top Entities)

```mermaid
erDiagram
    ORG ||--o{ USER : has
    ORG ||--o{ CONTACT : has
    ORG ||--o{ ITEM : has
    ORG ||--o{ INVOICE : has
    ORG ||--o{ ACCOUNT : has
    USER ||--o{ USER_ROLE : assigned
    ROLE ||--o{ USER_ROLE : grants
    ROLE ||--o{ PERMISSION : contains
    CONTACT ||--o{ INVOICE : billed_to
    CONTACT ||--o{ QUOTE : sent_to
    CONTACT ||--o{ SALES_ORDER : ordered
    INVOICE ||--o{ INVOICE_LINE : has
    INVOICE_LINE }o--|| ITEM : references
    INVOICE ||--o{ PAYMENT_RECEIVED : paid_by
    INVOICE ||--o{ CREDIT_NOTE : refunded
    INVOICE ||--|| JOURNAL_ENTRY : posts
    JOURNAL_ENTRY ||--o{ JOURNAL_LINE : has
    JOURNAL_LINE }o--|| ACCOUNT : debits_credits
    PURCHASE_ORDER ||--o{ BILL : converts
    BILL ||--o{ PAYMENT_MADE : paid_by
    ITEM ||--o{ STOCK_MOVE : moves
    WAREHOUSE ||--o{ STOCK_MOVE : at
    POS_SESSION ||--o{ POS_RECEIPT : contains
    POS_RECEIPT ||--o{ INVOICE : posts
    EMPLOYEE ||--o{ PAYSLIP : paid
    EMPLOYEE ||--o{ ATTENDANCE : logs
```

---

## 12. End-to-End Lifecycle (One-page summary)

```mermaid
flowchart TB
    A1[Customer enquires] --> A2[Lead in CRM]
    A2 --> A3[Convert to Quote]
    A3 --> A4[Quote accepted → Sales Order]
    A4 --> A5{Stock available?}
    A5 -->|Yes| A6[Create Shipment + Invoice]
    A5 -->|No| A7[Manufacturing Order or PO]
    A7 --> A8[Receive goods → stock IN]
    A8 --> A6
    A6 --> A9[Send invoice<br/>+ E-Invoice if Iraq]
    A9 --> A10[Customer pays]
    A10 --> A11[Payment Received<br/>Journal: DR cash CR AR]
    A11 --> A12[Bank reconciliation]
    A12 --> A13[Reports: P&L · Balance Sheet · VAT Return]
    A13 --> A14[Audit log + locked period]
```

---

## Notes
- هەموو endpoint ـەکان ـ`org_id`-scoped لەسەر JWT.
- BaseRepository pattern لە Python filtering دەکات (نا composite indexes).
- Audit middleware خۆکار log دەکات بۆ هەموو POST/PUT/PATCH/DELETE.
- RBAC: `user_roles → roles → permissions` + legacy `user.role` fallback.
- بۆ پلانی فراوانتر، بڕوانە `MASTER_PLAN.md` و `ERP_MASTER_PLAN.md`.
