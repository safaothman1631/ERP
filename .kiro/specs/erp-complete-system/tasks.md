# Implementation Plan: سیستەمی ERP تەواو

## Overview

ئەم پلانە جێبەجێکردنی تەواوی سیستەمی ERP دیاری دەکات لەسەر React 19/TypeScript + Python/FastAPI + Firebase/Firestore. هەر تاسک بنیاتی تاسکی پێشوو دەگرێتەوە و کۆتاییەکەی بە یەکخستنی تەواوی سیستەمەکە دەبێت.

---

## Tasks

- [x] 1. دامەزراندنی بنچینەی پرۆژە و سیستەمی دیزاین
  - [x] 1.1 دامەزراندنی ستراکچەری فایلی فرۆنتێند و پێکهاتەی بنچینەیی
    - دروستکردنی `frontend/src/design-system/` لەگەڵ کۆمپۆنێنتە بنچینەییەکان: `DataTable`، `PageHeader`، `KpiCard`، `FormLayout`، `EmptyState`، `LoadingSkeleton`، `StatusTag`
    - دامەزراندنی Ant Design 6، Framer Motion 12، React Router DOM 7، Zustand 5، TanStack React Query
    - دروستکردنی `frontend/src/layouts/` لەگەڵ `AppShell`، `SideNav`، `TopBar`، `Breadcrumb`، `CommandPalette`
    - دروستکردنی `frontend/src/App.routes.tsx` لەگەڵ هەموو ڕووتەکان بە `lazy()` wrapper
    - دروستکردنی `frontend/src/store.ts` (useAuthStore) و `frontend/src/store/settingsStore.ts` (useSettingsStore) و `uiStore`
    - _داواکاری: ٤.١، ٤.١١، ١٥.١، ١٥.٢_

  - [x] 1.2 دامەزراندنی ستراکچەری بەکێند و middleware stack
    - دروستکردنی `backend/app/main.py` لەگەڵ FastAPI app و ڕیزی middleware: CORS → Security Headers → Rate Limiter → Audit → Router
    - دروستکردنی `backend/app/config.py` بە Pydantic Settings بۆ environment variables
    - دروستکردنی `backend/app/firebase_client.py` بۆ Firebase Admin SDK initialization
    - دروستکردنی `backend/app/middleware/audit.py` و `backend/app/middleware/rate_limit.py`
    - دروستکردنی `backend/app/security/dependencies.py`، `permissions.py`، `roles.py`
    - دروستکردنی `backend/app/schemas/` بۆ هەموو Pydantic models
    - _داواکاری: ٦.١، ٦.٢، ٦.٤، ٧.١٢_

  - [x] 1.3 دامەزراندنی Vite config و code splitting
    - ڕێکخستنی `vite.config.ts` لەگەڵ `manualChunks`: `vendor-react`، `vendor-antd`، `vendor-charts`، `vendor-motion`
    - دامەزراندنی Vitest بۆ unit tests و fast-check بۆ property-based tests
    - دامەزراندنی Playwright بۆ E2E tests
    - دروستکردنی `frontend/lighthouserc.json` لەگەڵ FCP < 1500ms، LCP < 2500ms، CLS < 0.1
    - _داواکاری: ٥.٤، ٥.١٠، ١٦.١، ١٦.٣_

  - [x] 1.4 دامەزراندنی i18n و RTL
    - دامەزراندنی `i18next` و `react-i18next` لەگەڵ فایلەکانی وەرگێڕان بۆ کوردی (ku) و ئینگلیزی (en)
    - دروستکردنی `frontend/src/utils/formatters.ts` لەگەڵ `formatMoney()`، `formatDate()` بۆ هەر دوو زمان
    - ڕێکخستنی `ConfigProvider` ی Ant Design بۆ RTL/LTR بەپێی زمانی هەڵبژێردراو
    - دروستکردنی دوگمەی گۆڕینی زمان بەبێ reload
    - _داواکاری: ١٨.١، ١٨.٢، ١٨.٣، ١٨.٤، ١٨.٥، ١٨.٦_

- [x] 2. پەرەی سەرەتا (Landing Page) و ناسنامەی براند
  - [x] 2.1 دروستکردنی پەرەی سەرەتای گشتی
    - دروستکردنی `frontend/src/pages/LandingPage.tsx` لەگەڵ بەشەکان: Hero، Features، Plans، Testimonials، CTA
    - جێبەجێکردنی ئەنیمەیشنی داخڵبوون بە Framer Motion لەناو 1000ms بۆ Hero section
    - جێبەجێکردنی hover animations (scale + shadow) بۆ هەموو کارتەکان بە CSS transitions
    - جێبەجێکردنی custom cursor کۆمپۆنێنت بۆ دێسکتۆپ
    - دروستکردنی ڕووتی `/` بۆ redirect بۆ landing page بۆ بەکارهێنەری بەبێ لۆگئین
    - _داواکاری: ١.١، ١.٢، ١.٣، ١.٤، ١.٦_

  - [x] 2.2 جێبەجێکردنی ریسپانسیڤ و زمان
    - دروستکردنی responsive layout لە 320px تا 1920px+
    - زیادکردنی دوگمەی گۆڕینی زمان (کوردی/ئینگلیزی) بە پەرەی سەرەتا
    - دروستکردنی ئەنیمەیشنی سمۆث بۆ navigate کردن بۆ پەرەی تۆمارکردن لەکاتی کلیک لەسەر CTA
    - _داواکاری: ١.٥، ١.٧، ١.٨_

- [ ] 3. Auth Flow (تۆمارکردن، چوونەژوورەوە، MFA، SSO)
  - [x] 3.1 جێبەجێکردنی بەکێندی Auth
    - دروستکردنی `backend/app/api/auth.py` لەگەڵ endpoints: `POST /api/v1/auth/register`، `POST /api/v1/auth/login`، `POST /api/v1/auth/refresh`، `POST /api/v1/auth/logout`
    - جێبەجێکردنی Firebase Auth integration لەگەڵ `verify_id_token()`
    - دروستکردنی JWT access token (1 ساعەت) و refresh token (7 ڕۆژ) بە `python-jose`
    - جێبەجێکردنی account lockout پاش 5 هەوڵی شکستهێنان بۆ 15 خولەک
    - جێبەجێکردنی brute-force IP block بۆ 24 ساعەت
    - _داواکاری: ٢.٦، ٢.٨، ٢.١٠، ٦.١١_

  - [x] 3.2 جێبەجێکردنی MFA و SSO
    - جێبەجێکردنی TOTP MFA بە Google Authenticator (QR code generation + verification)
    - جێبەجێکردنی Google OAuth 2.0 SSO
    - دروستکردنی `backend/app/services/auth.py` لەگەڵ `verify_token()` function
    - _داواکاری: ٢.٧، ٢.٩_

  - [x] 3.3 دروستکردنی فرۆنتێندی Auth
    - دروستکردنی `frontend/src/pages/auth/RegisterPage.tsx` لەگەڵ validation ی ریەل-تایم (ناوی تەواو، ئیمەیڵ، پاسوۆرد، پشتراستکردنی پاسوۆرد، ناوی کۆمپانیا)
    - جێبەجێکردنی password strength validation: کەمترین 8 پیت، پیتی گەورە، ژمارە، نیشانەی تایبەت
    - دروستکردنی `frontend/src/pages/auth/LoginPage.tsx` لەگەڵ "بیرت نییە؟" و MFA flow
    - دروستکردنی `frontend/src/pages/auth/MFAPage.tsx` بۆ TOTP verification
    - جێبەجێکردنی JWT storage: access token لە memory، refresh token لە httpOnly cookie
    - _داواکاری: ٢.١، ٢.٢، ٢.٣، ٢.٤، ٢.٥_

  - [-] 3.4 نووسینی property test بۆ دروستی Token (P6)
    - **Property 6: دروستی Token Expiry**
    - **Validates: داواکاری ٢.٨، ٦.٣**
    - دروستکردنی `backend/tests/test_pbt_auth.py` بە Hypothesis
    - تێستکردنی `verify_token()` لەگەڵ exp_offset ی ئەتفاقی (positive = valid، negative = expired)

- [ ] 4. ئۆنبۆردینگ (Onboarding Flow)
  - [-] 4.1 دروستکردنی پرۆسەی ئۆنبۆردینگ
    - دروستکردنی `frontend/src/pages/onboarding/OnboardingPage.tsx` لەگەڵ 5 هەنگاو: زانیاری کۆمپانیا، پیشەسازی، مۆدیوڵەکان، بەکارهێنەرانی یەکەم، ڕێکخستنی دارایی
    - جێبەجێکردنی slide transition animation بە Framer Motion لە نێوان هەنگاوەکان
    - دروستکردنی progress bar کە ئاستی پێشکەوتن نیشان دەدات
    - جێبەجێکردنی auto-save بۆ هەر هەنگاوێک بەبێ دوگمەی "پاشەکەوت"
    - پشتگیری گەڕانەوە بۆ هەنگاوی پێشوو بەبێ لەدەستدانی داتا
    - جێبەجێکردنی skip option و تەواوکردنی دواتر لە Settings
    - _داواکاری: ٣.١، ٣.٢، ٣.٣، ٣.٤، ٣.٥، ٣.٦، ٣.٧_

- [ ] 5. UI/UX و سیستەمی ئەنیمەیشن
  - [-] 5.1 جێبەجێکردنی ئەنیمەیشنەکانی Framer Motion
    - جێبەجێکردنی `PageTransition` component لەگەڵ `pageVariants` (fade+slide، 300ms) بۆ هەموو پەیجەکان
    - جێبەجێکردنی `modalVariants` (scale+fade، 200ms) بۆ هەموو مۆداڵەکان
    - جێبەجێکردنی `listVariants` لەگەڵ stagger animation (100ms بۆ هەر ئایتەمێک) بۆ هەموو لیستەکان
    - جێبەجێکردنی press animation (scale down) بۆ هەموو دوگمەکان
    - _داواکاری: ٤.١، ٤.٢، ٤.٣، ٤.٤، ٤.٥_

  - [-] 5.2 جێبەجێکردنی dark/light mode و تایبەتمەندییەکانی UI
    - جێبەجێکردنی dark mode و light mode لەگەڵ گۆڕینی سمۆث
    - دروستکردنی `design-system/ConnectionStatus.tsx` بۆ offline indicator
    - جێبەجێکردنی skeleton loading بۆ هەموو بەشەکانی داتا
    - جێبەجێکردنی toast notifications بۆ feedback ی کردارەکان
    - _داواکاری: ٤.٦، ٤.٨، ٤.٩، ٤.١٢_

- [ ] 6. پێرفۆرمانس و optimization
  - [-] 6.1 جێبەجێکردنی code splitting و virtual scrolling
    - دامەزراندنی `lazy()` wrapper بۆ هەموو پەیجەکان لە `App.routes.tsx`
    - جێبەجێکردنی `<Table virtual scroll={{ y: 600 }} />` بۆ هەموو لیستەکانی زیاتر لە 100 ئایتەم
    - ڕێکخستنی React Query لەگەڵ `staleTime: 5min`، `gcTime: 30min`، `stale-while-revalidate`
    - جێبەجێکردنی image optimization (WebP، lazy loading، responsive sizes)
    - _داواکاری: ٥.٤، ٥.٥، ٥.٦، ٥.٧، ٥.١٠_

  - [x] 6.2 جێبەجێکردنی Firestore indexes و query optimization
    - دروستکردنی `firestore.indexes.json` لەگەڵ هەموو composite indexes پێویست:
      - `invoices: [org_id ASC, status ASC, due_date DESC]`
      - `invoices: [org_id ASC, contact_id ASC, created_at DESC]`
      - `journal_entries: [org_id ASC, date DESC, status ASC]`
      - `stock_moves: [org_id ASC, product_id ASC, created_at DESC]`
      - `stock_moves: [org_id ASC, warehouse_id ASC, move_type ASC]`
      - `crm_leads: [org_id ASC, stage ASC, assigned_to ASC]`
      - `audit_logs: [org_id ASC, user_id ASC, created_at DESC]`
    - _داواکاری: ٥.٩، ٧.١_

- [ ] 7. سیکوریتی
  - [-] 7.1 جێبەجێکردنی Security Headers و OWASP
    - جێبەجێکردنی CSP headers لە middleware
    - جێبەجێکردنی CORS configuration (تەنها domain ی دیاریکراو)
    - جێبەجێکردنی HTTPS enforcement
    - جێبەجێکردنی rate limiting بە slowapi (100 داواکاری/خولەک/IP)
    - جێبەجێکردنی input sanitization بۆ پاراستن لە XSS و SQL Injection
    - _داواکاری: ٦.١، ٦.٢، ٦.٤، ٦.٧، ٦.١٢_

  - [-] 7.2 جێبەجێکردنی Firestore Security Rules و encryption
    - دروستکردنی `firestore.rules` لەگەڵ org_id isolation بۆ هەموو collections
    - جێبەجێکردنی AES-256 encryption بۆ داتای هەستیار لە Firestore
    - دروستکردنی `backend/app/security/dependencies.py` لەگەڵ `get_current_user()` و `require_permission()`
    - _داواکاری: ٦.٥، ٦.٨، ٦.١٠_

  - [-] 7.3 جێبەجێکردنی Audit Logging
    - دروستکردنی `backend/app/middleware/audit.py` کە هەموو POST/PUT/PATCH/DELETE تۆمار دەکات
    - دروستکردنی `audit_logs/{log_id}` collection لە Firestore لەگەڵ `user_id`، `action`، `timestamp`
    - _داواکاری: ٦.٦، ١٤.٨_

  - [~] 7.4 نووسینی property test بۆ دروستی Audit Trail (P5)
    - **Property 5: دروستی Audit Trail**
    - **Validates: داواکاری ٦.٦، ١٤.٨**
    - دروستکردنی `backend/tests/test_pbt_audit.py` بە Hypothesis
    - تێستکردنی کە هەموو کردارێک audit log entry ی هەبێت لەگەڵ `user_id`، `action`، `timestamp ≤ now()`

- [ ] 8. داتابەیس و API بنچینەیی
  - [x] 8.1 دروستکردنی Firestore schema و seed data
    - دروستکردنی ستراکچەری `organizations/{org_id}/` لەگەڵ هەموو sub-collections
    - دروستکردنی `backend/app/seed/` لەگەڵ: `chart_of_accounts`، `currencies`، `tax_rates`
    - جێبەجێکردنی soft delete (`is_deleted` flag) بۆ هەموو collections
    - _داواکاری: ٧.١، ٧.٧_

  - [x] 8.2 جێبەجێکردنی API بنچینەیی و pagination
    - دروستکردنی `backend/app/api/` ستراکچەر لەگەڵ versioning `/api/v1/`
    - جێبەجێکردنی cursor-based pagination بۆ هەموو لیستەکان
    - جێبەجێکردنی filtering و sorting بۆ هەموو لیستەکان
    - جێبەجێکردنی RFC 7807 Problem Details بۆ هەموو error responses
    - جێبەجێکردنی Pydantic v2 validation بۆ هەموو request/response schemas
    - دروستکردنی OpenAPI 3.0 documentation ئۆتۆماتیکی
    - _داواکاری: ٧.٢، ٧.٣، ٧.٥، ٧.٦، ٧.٩، ٧.١٢_

  - [-] 8.3 جێبەجێکردنی real-time updates و optimistic UI
    - جێبەجێکردنی `useFirestoreLive` hook بە Firestore `onSnapshot` بۆ داتای گرینگ
    - جێبەجێکردنی optimistic updates لە React Query mutations
    - _داواکاری: ٧.٤، ٧.٨_

- [ ] 9. RBAC (کۆنترۆڵی دەستگەیشتن بەپێی رۆڵ)
  - [-] 9.1 جێبەجێکردنی بەکێندی RBAC
    - دروستکردنی `backend/app/security/roles.py` لەگەڵ رۆڵە پێشبینیکراوەکان: Super Admin، Admin، Manager، Accountant، Sales Rep، HR، Viewer
    - دروستکردنی `backend/app/security/permissions.py` لەگەڵ `checkPermission()` و `ROLE_PERMISSIONS` map
    - جێبەجێکردنی permission inheritance (رۆڵی کەستەم لە رۆڵی بنچینەوە وەرگرێت)
    - جێبەجێکردنی field-level permissions
    - دروستکردنی `backend/app/api/rbac.py` لەگەڵ endpoints بۆ role management
    - _داواکاری: ١٤.١، ١٤.٢، ١٤.٣، ١٤.٤، ١٤.٦، ١٤.٧_

  - [~] 9.2 جێبەجێکردنی فرۆنتێندی RBAC
    - دروستکردنی `usePermission` hook بۆ permission checking لە فرۆنتێند
    - دروستکردنی `ModuleGuard` component بۆ UI hiding
    - دروستکردنی `frontend/src/pages/AccessDenied.tsx` بۆ کاتی مۆڵەت نییە
    - _داواکاری: ١٤.٥_

  - [~] 9.3 نووسینی property test بۆ RBAC Invariants (P4)
    - **Property 4: RBAC Invariants**
    - **Validates: داواکاری ١٤.١، ١٤.٤، ١٤.٧**
    - دروستکردنی `backend/tests/test_pbt_rbac.py` بە Hypothesis و `frontend/src/utils/__tests__/rbac.pbt.test.ts` بە fast-check
    - تێستکردنی `checkPermission()` لەگەڵ roles، resources، و actions ی ئەتفاقی

- [~] 10. چەکپۆینت — دڵنیابوون لە بنچینەی سیستەم
  - دڵنیابوون لە هەموو تێستەکان دەگوزەرن، پرسیار لە بەکارهێنەر بکە ئەگەر پرسیارت هەیە.

- [ ] 11. مۆدیوڵی فرۆشتن (Sales)
  - [~] 11.1 دروستکردنی بەکێندی Sales
    - دروستکردنی `backend/app/services/sales.py` لەگەڵ workflow: Quote → Sales Order → Invoice → Payment
    - دروستکردنی `backend/app/api/quotes.py`، `sales_orders.py`، `invoices.py` لەگەڵ CRUD + workflow endpoints
    - جێبەجێکردنی `computeInvoiceTotal()` لە `backend/app/services/sales.py` و `frontend/src/utils/formatters.ts`
    - جێبەجێکردنی price lists (کەستەمەر-تایبەت، دەورە-تایبەت)
    - جێبەجێکردنی discount management (بڕ و ڕێژە)
    - جێبەجێکردنی multi-currency (IQD، USD، EUR) لەگەڵ exchange rates
    - جێبەجێکردنی Pydantic validator بۆ `total = subtotal + tax_amount - discount_amount`
    - _داواکاری: ٨.١، ٨.٢، ٨.٣، ٨.٤، ٨.٩_

  - [~] 11.2 نووسینی property test بۆ دروستی Invoice Total (P1)
    - **Property 1: دروستی Invoice Total**
    - **Validates: داواکاری ٨.١، ٨.٢، ٨.٤**
    - دروستکردنی `frontend/src/utils/__tests__/invoice.pbt.test.ts` بە fast-check
    - تێستکردنی `computeInvoiceTotal()` لەگەڵ lines، tax_rate، و discount_amount ی ئەتفاقی

  - [~] 11.3 جێبەجێکردنی تایبەتمەندییە پێشکەوتووەکانی Sales
    - جێبەجێکردنی recurring invoices (ئایانە، مانگانە، ساڵانە)
    - جێبەجێکردنی credit notes و refunds
    - جێبەجێکردنی overdue invoice notifications
    - جێبەجێکردنی e-invoice بۆ داواکارییەکانی عێراق
    - _داواکاری: ٨.٥، ٨.٦، ٨.٨، ٨.١٠_

  - [~] 11.4 دروستکردنی فرۆنتێندی Sales
    - دروستکردنی `frontend/src/pages/sales/` لەگەڵ: `QuotesPage`، `SalesOrdersPage`، `InvoicesPage`، `PaymentsPage`
    - جێبەجێکردنی sales reports (بە کەستەمەر، بە کاڵا، بە دەورە)
    - _داواکاری: ٨.٧_

- [ ] 12. مۆدیوڵی کڕین (Purchasing)
  - [~] 12.1 دروستکردنی بەکێندی Purchasing
    - دروستکردنی `backend/app/services/purchasing.py` لەگەڵ workflow: PO → Receive → Bill → Payment
    - دروستکردنی `backend/app/api/purchase_orders.py`، `bills.py` لەگەڵ CRUD + workflow endpoints
    - جێبەجێکردنی vendor management لەگەڵ ئەرشیفی کڕین
    - جێبەجێکردنی 3-way matching (PO + Receipt + Bill)
    - جێبەجێکردنی vendor credits و returns
    - جێبەجێکردنی approval workflow بۆ PO ی گەورە
    - _داواکاری: ٩.١، ٩.٢، ٩.٣، ٩.٤، ٩.٦_

  - [~] 12.2 دروستکردنی فرۆنتێندی Purchasing
    - دروستکردنی `frontend/src/pages/purchasing/` لەگەڵ: `PurchaseOrdersPage`، `ReceivingPage`، `BillsPage`
    - جێبەجێکردنی purchase reports (بە فرۆشیار، بە کاڵا، بە دەورە)
    - _داواکاری: ٩.٥_

- [ ] 13. مۆدیوڵی ئەکاونتینگ (Accounting)
  - [~] 13.1 دروستکردنی بەکێندی Accounting
    - دروستکردنی `backend/app/services/accounting.py` لەگەڵ double-entry bookkeeping
    - جێبەجێکردنی `validateJournalBalance()` کە دڵنیا دەبێت `sum(debits) = sum(credits)`
    - دروستکردنی `backend/app/api/accounts.py`، `journals.py` لەگەڵ CRUD endpoints
    - جێبەجێکردنی chart of accounts لەگەڵ ئاستی چەندین
    - جێبەجێکردنی journal entries (manual و automatic)
    - جێبەجێکردنی bank reconciliation
    - جێبەجێکردنی fiscal year management
    - جێبەجێکردنی tax management (VAT، withholding tax)
    - جێبەجێکردنی multi-currency revaluation
    - جێبەجێکردنی analytic accounts بۆ cost center tracking
    - جێبەجێکردنی budget management لەگەڵ variance analysis
    - _داواکاری: ١٠.١، ١٠.٢، ١٠.٣، ١٠.٤، ١٠.٦، ١٠.٧، ١٠.٨، ١٠.٩، ١٠.١٠_

  - [~] 13.2 نووسینی property test بۆ هاوسەنگی Journal Entry (P2)
    - **Property 2: هاوسەنگی Journal Entry**
    - **Validates: داواکاری ١٠.١، ١٠.٣**
    - دروستکردنی `backend/tests/test_pbt_accounting.py` بە Hypothesis و `frontend/src/utils/__tests__/journal.pbt.test.ts` بە fast-check
    - تێستکردنی `validateJournalBalance()` لەگەڵ lines ی ئەتفاقی

  - [~] 13.3 دروستکردنی ڕاپۆرتەکانی دارایی
    - جێبەجێکردنی ڕاپۆرتەکان: Balance Sheet، P&L، Cash Flow، Trial Balance
    - دروستکردنی `frontend/src/pages/accounting/` لەگەڵ هەموو پەیجەکانی ئەکاونتینگ
    - _داواکاری: ١٠.٥_

- [ ] 14. مۆدیوڵی ئینڤێنتۆری (Inventory)
  - [~] 14.1 دروستکردنی بەکێندی Inventory
    - دروستکردنی `backend/app/services/inventory.py` لەگەڵ `computeStockBalance()` function
    - جێبەجێکردنی `stock_balance = initial + sum(in_moves) - sum(out_moves)` invariant
    - دروستکردنی `backend/app/api/inventory.py`، `warehouses.py` لەگەڵ CRUD endpoints
    - جێبەجێکردنی multi-warehouse management
    - جێبەجێکردنی stock locations (bin/shelf)
    - جێبەجێکردنی serial numbers و lot tracking
    - جێبەجێکردنی cycle counts و physical inventory
    - جێبەجێکردنی reorder rules (min/max) لەگەڵ ئاگادارکردنەوە
    - جێبەجێکردنی putaway rules
    - جێبەجێکردنی inventory valuation (FIFO، Average Cost)
    - جێبەجێکردنی shipments و delivery challans
    - _داواکاری: ١١.١، ١١.٢، ١١.٣، ١١.٤، ١١.٥، ١١.٦، ١١.٧، ١١.٨، ١١.١٠_

  - [~] 14.2 نووسینی property test بۆ دروستی Stock Balance (P3)
    - **Property 3: دروستی Stock Balance**
    - **Validates: داواکاری ١١.١، ١١.٧**
    - دروستکردنی `backend/tests/test_pbt_inventory.py` بە Hypothesis و `frontend/src/utils/__tests__/inventory.pbt.test.ts` بە fast-check
    - تێستکردنی `computeStockBalance()` لەگەڵ initial stock و movements ی ئەتفاقی

  - [~] 14.3 دروستکردنی فرۆنتێندی Inventory
    - دروستکردنی `frontend/src/pages/inventory/` لەگەڵ هەموو پەیجەکان
    - جێبەجێکردنی inventory reports (stock aging، movement، valuation)
    - _داواکاری: ١١.٩_

- [~] 15. چەکپۆینت — دڵنیابوون لە مۆدیوڵەکانی بازرگانی
  - دڵنیابوون لە هەموو تێستەکان دەگوزەرن، پرسیار لە بەکارهێنەر بکە ئەگەر پرسیارت هەیە.

- [ ] 16. مۆدیوڵی HR و پارەدانی کارمەندان (HR & Payroll)
  - [~] 16.1 دروستکردنی بەکێندی HR
    - دروستکردنی `backend/app/services/hr.py` لەگەڵ employee management
    - دروستکردنی `backend/app/api/hr/employees.py`، `contracts.py`، `attendance.py`، `leaves.py`
    - جێبەجێکردنی employee profiles لەگەڵ هەموو زانیاریەکان
    - جێبەجێکردنی contracts management
    - جێبەجێکردنی attendance tracking (check-in/out)
    - جێبەجێکردنی leave management (مۆڵەت، نەخۆشی، etc.)
    - _داواکاری: ١٢.١، ١٢.٢، ١٢.٣، ١٢.٤_

  - [~] 16.2 دروستکردنی بەکێندی Payroll
    - دروستکردنی `backend/app/services/payroll.py` لەگەڵ payroll run flow
    - جێبەجێکردنی payroll rules (بنچینە، زیادەکاری، کەمکردنەوە)
    - جێبەجێکردنی Iraq tax calculation (income tax + social security)
    - جێبەجێکردنی payroll runs لەگەڵ payslips
    - جێبەجێکردنی ئۆتۆماتیکی journal entry دروستکردن لەکاتی payroll run
    - _داواکاری: ١٢.٥، ١٢.٦، ١٢.٨_

  - [~] 16.3 دروستکردنی فرۆنتێندی HR و Payroll
    - دروستکردنی `frontend/src/pages/hr/` و `frontend/src/pages/payroll/` لەگەڵ هەموو پەیجەکان
    - جێبەجێکردنی HR reports (headcount، turnover، cost)
    - _داواکاری: ١٢.٧_

- [ ] 17. مۆدیوڵی CRM
  - [~] 17.1 دروستکردنی بەکێندی CRM
    - دروستکردنی `backend/app/services/crm.py` لەگەڵ lead management
    - دروستکردنی `backend/app/api/crm/leads.py`، `pipeline.py` لەگەڵ CRUD endpoints
    - جێبەجێکردنی lead management (capture، qualify، convert)
    - جێبەجێکردنی activity tracking (calls، emails، meetings)
    - جێبەجێکردنی lead scoring
    - جێبەجێکردنی email integration
    - _داواکاری: ١٣.١، ١٣.٣، ١٣.٥، ١٣.٦_

  - [~] 17.2 دروستکردنی فرۆنتێندی CRM
    - دروستکردنی `frontend/src/pages/crm/` لەگەڵ pipeline Kanban view
    - جێبەجێکردنی CRM reports و insights
    - _داواکاری: ١٣.٢، ١٣.٤_

- [ ] 18. ناڤبار و ڕووتینگ
  - [~] 18.1 تەواوکردنی هەموو ڕووتەکان و ناڤبار
    - دڵنیابوون لە هەموو لینکەکانی ناڤبار map کراون بۆ ڕووتی دیاریکراو لە `App.routes.tsx`
    - دروستکردنی placeholder pages بۆ هەر ڕووتێک کە هێشتا جێبەجێ نەکراوە
    - جێبەجێکردنی `/settings?s=workflows` و `/settings?s=numbering` بە تەواوی
    - دروستکردنی `frontend/src/pages/NotFound.tsx` لەگەڵ لینکی گەڕانەوە بۆ داشبۆرد
    - _داواکاری: ١٥.١، ١٥.٢، ١٥.٣، ١٥.٤، ١٥.٧_

  - [~] 18.2 جێبەجێکردنی breadcrumb، command palette، و تایبەتمەندییەکانی ناڤبار
    - جێبەجێکردنی `Breadcrumb` component بۆ هەموو پەیجەکان
    - جێبەجێکردنی `CommandPalette` (Ctrl+K) بۆ خێرا گەڕان
    - جێبەجێکردنی deep linking (URL share کردن)
    - جێبەجێکردنی collapse/expand بۆ sidebar
    - جێبەجێکردنی favorites/bookmarks بۆ پەرەکانی زۆر بەکارهاتوو
    - _داواکاری: ١٥.٥، ١٥.٦، ١٥.٨، ١٥.٩، ١٥.١٠_

- [ ] 19. تێستینگ تەواو
  - [~] 19.1 نووسینی unit tests بۆ utility functions و services
    - نووسینی unit tests بۆ هەموو functions لە `frontend/src/utils/`
    - نووسینی unit tests بۆ هەموو custom hooks لە `frontend/src/hooks/`
    - نووسینی unit tests بۆ هەموو Zustand stores
    - نووسینی unit tests بۆ هەموو Python services لە `backend/app/services/`
    - دڵنیابوون لە کەمترین 80% coverage
    - _داواکاری: ١٦.١_

  - [~] 19.2 نووسینی integration tests بۆ API endpoints
    - نووسینی integration tests بۆ هەموو API endpoints بە pytest + httpx TestClient
    - بەکارهێنانی Firestore emulator بۆ tests
    - نووسینی frontend integration tests بە Vitest + Testing Library + MSW mocking
    - _داواکاری: ١٦.٢_

  - [~] 19.3 نووسینی E2E tests بە Playwright
    - دروستکردنی `frontend/tests/e2e/critical-paths.spec.ts` لەگەڵ:
      - Sales: Quote → Invoice → Payment
      - Purchasing: PO → Receive → Bill → Pay
      - Accounting: Journal Entry balanced
      - Inventory: Stock movement updates balance
      - Auth: Login → MFA → Dashboard
      - RBAC: Viewer cannot create invoice
      - Navigation: All nav links resolve (no 404)
    - _داواکاری: ١٦.٣_

  - [~] 19.4 نووسینی visual regression tests
    - دروستکردنی visual regression tests بۆ کۆمپۆنێنتە گرینگەکان
    - _داواکاری: ١٦.٨_

- [ ] 20. پرۆدەکشن و دیپلۆی
  - [~] 20.1 دروستکردنی Docker و health endpoints
    - دروستکردنی `backend/Dockerfile` بە Python 3.13-slim
    - دروستکردنی health endpoints: `/api/health`، `/api/ready`، `/api/metrics`، `/api/version`
    - جێبەجێکردنی structured logging (JSON format)
    - جێبەجێکردنی Sentry error monitoring
    - _داواکاری: ١٧.٢، ١٧.٤، ١٧.٥، ١٧.٦_

  - [~] 20.2 دروستکردنی CI/CD Pipeline
    - دروستکردنی/نوێکردنی `.github/workflows/ci.yml` لەگەڵ ڕیز: Lint → Unit Tests → Integration Tests → Build → E2E → Lighthouse CI → Deploy → Smoke Tests
    - جێبەجێکردنی OWASP ZAP scan لە CI pipeline
    - جێبەجێکردنی Dependabot بۆ dependency scanning
    - جێبەجێکردنی test coverage report لە هەموو CI run
    - دڵنیابوون لە deploy ڕەتکردنەوە کاتی شکستهێنانی تێست
    - _داواکاری: ١٧.١، ١٦.٧، ١٦.٩، ١٦.١٠، ٦.٩_

  - [~] 20.3 جێبەجێکردنی zero-downtime deployment و rollback
    - ڕێکخستنی Cloud Run traffic splitting (10% → 50% → 100%)
    - جێبەجێکردنی rollback mechanism بە `gcloud run services update-traffic`
    - جێبەجێکردنی ئۆتۆماتیکی database backups (ڕۆژانە)
    - جێبەجێکردنی uptime monitoring
    - _داواکاری: ١٧.٧، ١٧.٨، ١٧.٩، ١٧.١٠_

- [~] 21. چەکپۆینت کۆتایی — دڵنیابوون لە هەموو تێستەکان
  - دڵنیابوون لە هەموو تێستەکان دەگوزەرن، Lighthouse CI metrics پێوانەکان دەگرن، و سیستەم ئامادەی پرۆدەکشنە. پرسیار لە بەکارهێنەر بکە ئەگەر پرسیارت هەیە.

---

## Notes

- تاسکەکانی نیشانکراو بە `*` ئارەزوومەندانەن و دەتوانرێن بۆ MVP ی خێراتر بگوزەرێن
- هەر تاسک ئاماژەی بۆ داواکارییە تایبەتەکان دەکات بۆ ئەوەی بتوانرێت شوێنی بگیرێت
- چەکپۆینتەکان دڵنیابوونی زیادەکاری دەدەن
- تێستەکانی property-based تایبەتمەندییەکانی دروستی گشتی پشتراست دەکەن (P1-P6)
- تێستەکانی unit تایبەتمەندییەکانی تایبەت و حاڵەتە سنووریەکان پشتراست دەکەن
- زمانی جێبەجێکردن: TypeScript (فرۆنتێند) + Python (بەکێند)

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "3.1", "8.1"] },
    { "id": 3, "tasks": ["2.2", "3.2", "3.3", "8.2", "6.2"] },
    { "id": 4, "tasks": ["3.4", "4.1", "5.1", "5.2", "6.1", "7.1", "7.2", "7.3", "8.3", "9.1"] },
    { "id": 5, "tasks": ["7.4", "9.2", "9.3", "11.1", "12.1", "13.1", "14.1", "16.1", "17.1"] },
    { "id": 6, "tasks": ["11.2", "11.3", "11.4", "12.2", "13.2", "13.3", "14.2", "14.3", "16.2", "17.2"] },
    { "id": 7, "tasks": ["16.3", "18.1"] },
    { "id": 8, "tasks": ["18.2", "19.1"] },
    { "id": 9, "tasks": ["19.2", "19.3", "19.4", "20.1"] },
    { "id": 10, "tasks": ["20.2", "20.3"] }
  ]
}
```
