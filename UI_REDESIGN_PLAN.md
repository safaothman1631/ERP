# 🎨 پلانی تەواوی UI/UX Redesign — Zoho ERP

> **شادۆ پلانساز** | وەرسیۆن ۱.۰ | ٢٢ ئەپریل ٢٠٢٦
> ئامانج: نوێکردنەوەی تەواوی فرۆنتئێند بە دیزاینێکی **مۆدێرن، نازدار، پرۆفیشناڵ** بێ دەستکاری Backend.

---

## بەشی ١ — خولاسەی پڕۆژە

```
📋 ناو: Zoho ERP — UI/UX Redesign v2
📝 وەسف: نوێکردنەوەی تەواوی Frontend (٧٠+ لاپەڕە) بە Design System ـی نوێ، بەبێ گۆڕینی Backend
🎯 ئامانج: ئەکاونتانت/بەڕێوەبەر/کاسیێر — ERP ـێکی جوان، خێرا، ئاسان
🌍 بازاڕ: عێراق + هەرێمی کوردستان (B2B)
🗣️ زمان: کوردی سۆرانی (سەرەکی، RTL) + ئینگلیزی (LTR) + عەرەبی (RTL، فەیز ٢)
💰 دراو: IQD سەرەکی + USD ثانوی + Multi-currency
⚙️ Stack (نا مەگۆڕە):
   - React 19 + TypeScript strict + Vite 8
   - Ant Design 6.3.5 + @ant-design/icons 6
   - Zustand 5 (state) + react-router-dom 7
   - i18next 26 + framer-motion 12 + recharts 3
   - Firebase (auth) + axios (api.ts → 580 endpoint)
🆕 زیادکراو (UI تەنها):
   - @ant-design/charts (dashboard charts)
   - @ant-design/pro-components (ProTable, ProForm, ProLayout)
   - react-hot-toast (toast سیستەم) — یان AntD message
   - cmdk (Command Palette ⌘K)
```

---

## بەشی ٢ — Design System (بنەماکانی نوێ)

### ٢.١ Color Tokens (Zoho-inspired + مۆدێرن)

```ts
// src/theme/tokens.ts — یەک سەرچاوەی ڕاستی
export const lightTokens = {
  colorPrimary: '#1F6FEB',        // ئاسمانی پڕۆفیشناڵ (نا violet)
  colorSuccess: '#16A34A',
  colorWarning: '#F59E0B',
  colorError:   '#DC2626',
  colorInfo:    '#0EA5E9',
  colorBgBase:  '#FFFFFF',
  colorBgLayout:'#F5F7FA',        // canvas نەرم
  colorBgContainer: '#FFFFFF',
  colorBgElevated:  '#FFFFFF',
  colorBorder:  '#E5E7EB',
  colorBorderSecondary: '#F1F3F5',
  colorTextBase:'#0F172A',
  colorTextSecondary: '#475569',
  colorTextTertiary:  '#94A3B8',
  borderRadius: 10,               // نەرم بەڵام نا فرە گرد
  borderRadiusLG: 14,
  borderRadiusSM: 6,
  fontFamily: '"Rabar 021", "Vazirmatn", "Inter", system-ui, -apple-system, sans-serif',
  fontSize: 14,
  controlHeight: 36,              // hairline تر
  controlHeightLG: 44,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
  boxShadowSecondary: '0 4px 12px rgba(15,23,42,0.08)',
};
export const darkTokens = { /* mirror — colorBgLayout: #0B1220, BgContainer: #111827 */ };
```

**فۆنتی کوردی:** `Rabar 021` + `Vazirmatn` (Google Fonts) — RTL-optimized, weights 300/400/500/600/700.

### ٢.٢ Spacing & Density
- Density modes: `compact` (default ERP) / `comfortable`.
- Grid scale: `4 8 12 16 24 32 48` (هیچ magic number).
- Page padding: `24px` desktop, `16px` mobile.

### ٢.٣ Typography Scale
```
display-1: 32/40 weight 600   — لاپەڕەی dashboard hero
h1: 24/32 weight 600
h2: 20/28 weight 600
h3: 16/24 weight 600
body: 14/22 weight 400
caption: 12/18 weight 400 colorTextSecondary
mono: "JetBrains Mono" — invoice numbers, codes
```

### ٢.٤ Iconography
- AntD Icons + ٢-٣ icon ـی custom (Iraq tax, ZATCA-style barcode).
- هەموو icon ـەکان `outlined` style بۆ یەکڕیزی.

### ٢.٥ Motion (framer-motion)
- Page transition: `fade + 8px slide` لە ٢٠٠ms.
- Modal/Drawer: AntD default + spring ease.
- Skeleton shimmer: `1.4s` loop.
- ❌ هیچ animation زیاد لە ٣٠٠ms (ERP خێرا).

---

## بەشی ٣ — Information Architecture (نەخشەی ناوبردن)

### ٣.١ Sidebar (Sectioned Navigation — وەک Zoho)

```
┌─ 🏢 ORG SWITCHER (top, multi-company) ─┐
├─ 🔍 Quick Search (⌘K opens Command Palette)
│
├─ 📊 Home
│   ├─ Dashboard
│   ├─ Insights (KPI hub)
│   └─ Activity Feed
│
├─ 💼 Sales
│   ├─ Customers          (Contacts filter)
│   ├─ Quotes
│   ├─ Sales Orders
│   ├─ Invoices
│   ├─ Recurring Invoices
│   ├─ Credit Notes
│   ├─ Payment Links
│   └─ Sales Returns
│
├─ 🛒 Purchases
│   ├─ Vendors
│   ├─ Purchase Orders
│   ├─ Bills
│   ├─ Vendor Credits
│   ├─ Recurring Bills
│   └─ Purchase Returns
│
├─ 📦 Inventory
│   ├─ Items
│   ├─ Price Lists
│   ├─ Warehouses
│   ├─ Stock Adjustments
│   ├─ Shipments
│   └─ Delivery Challans
│
├─ 💳 Banking
│   ├─ Accounts
│   ├─ Reconciliation
│   ├─ Bank Rules
│   └─ Imports
│
├─ 📚 Accounting
│   ├─ Chart of Accounts
│   ├─ Manual Journals
│   ├─ Fiscal Year
│   ├─ Tax Settings
│   ├─ Tax Returns
│   ├─ Assets
│   └─ Reporting Tags
│
├─ 🤝 CRM
│   ├─ Leads
│   ├─ Pipeline (Kanban)
│   ├─ Activities
│   └─ Insights
│
├─ 🛍️ POS
│   ├─ Hub  ─ Terminal ─ Sessions ─ Orders
│   ├─ Configs ─ Categories ─ Products ─ Pricelists
│   ├─ Floors ─ Floor Plan ─ Kitchen
│   ├─ Employees ─ Loyalty ─ Gift Cards
│   ├─ Self Order ─ Customer Display
│   └─ Reports
│
├─ 👥 HR & Payroll
│   ├─ Dashboard
│   ├─ Employees ─ Contracts ─ Attendance ─ Time Off
│   └─ Payroll Rules ─ Payroll Runs ─ Expense Claims
│
├─ 🏭 Manufacturing
│   ├─ BOMs ─ Work Centers ─ Manufacturing Orders
│
├─ 📁 Projects
│
├─ 📈 Reports
│   ├─ Standard Reports
│   ├─ Advanced Reports
│   ├─ Consolidated (multi-company)
│   └─ Branches Comparison
│
├─ 🌍 Iraq
│   ├─ E-Invoice (IQ)
│   ├─ WhatsApp
│   └─ Iraq Localization
│
└─ ⚙️ Setup (collapse footer)
    ├─ Companies ─ Branches ─ Users ─ Roles (RBAC)
    ├─ Custom Fields ─ Approvals ─ Workflows
    ├─ OCR ─ Imports ─ Exports ─ Audit Log
    └─ Settings (Org, Email, Theme, i18n)
```

**جۆری Sidebar:**
- Desktop: collapsible `240px ↔ 64px` بە icon-only mode
- Mobile (< 768px): Drawer overlay
- Pinned favorites لە سەرەوە (Zustand persist)
- Recent (٥ی دواتر) لە ژێرەوە

### ٣.٢ Topbar
```
[☰ collapse] [🏢 OrgSwitcher ▼] [🌿 BranchSwitcher ▼] [🔍 ⌘K Search]
                                  ... spacer ...
[➕ New ▼] [🔔 Notifications] [🌐 ku/en] [🌗 theme] [👤 Profile]
```
- `➕ New` = global creator dropdown (Invoice/Bill/Customer/Item …)
- 🔔 Notifications = drawer (audit, approvals, mentions)
- ⌘K = Command Palette (هەموو لاپەڕە/action ـەکان search دەکرێت)

### ٣.٣ Breadcrumbs + PageHeader
- AntD `PageHeader` pattern (custom): title + subtitle + tags + actions + tabs.
- هەمیشە breadcrumb بۆ ≥ ٢ asta (Sales / Invoices / INV-00123).

---

## بەشی ٤ — UI Patterns (یەکسان لە هەموو ERP)

### ٤.١ List Pages (Index) — ٤٠+ لاپەڕە
هەموو list page ئەم anatomy ـیە:
```
┌─ PageHeader: title + count badge + [+ New] [Import] [Export ▼] [More ⋮]
├─ FilterBar: Search + Status chips + Date range + Saved Views (tabs)
├─ BulkActions toolbar (دەردەکەوێت کاتێک select کرا)
├─ DataTable (ProTable):
│    - Sticky header + sortable + resizable cols
│    - Row hover: quick actions (👁 view, ✏ edit, ⋮ more)
│    - Inline status tags (paid/unpaid/overdue)
│    - Row selection + virtualization (>200 rows)
├─ Pagination + page size (10/25/50/100)
└─ Empty State: illustration + CTA + import option
```

### ٤.٢ Detail Pages
```
┌─ Sticky header: [← back] Title + Status tag + [Edit] [Print] [Email] [⋮]
├─ Two-column layout (8/4 split):
│    ├─ Main: Tabs (Overview / Activity / Comments / Attachments / Audit)
│    └─ Side: Customer card + Totals + Linked docs + Timeline
└─ Sticky bottom action bar (mobile)
```

### ٤.٣ Form Pages (Invoice, Quote, Bill …)
- **Two-column ProForm:** main form + summary panel (sticky totals).
- Line items: `EditableTable` + drag-reorder + keyboard nav (Tab/Enter).
- Auto-save draft هەر ٣٠ چرکە (Zustand + localStorage).
- Validation inline + summary banner لە سەرەوە.
- "Save / Save & New / Save & Send" split button.

### ٤.٤ Dashboards
- Grid 12-col responsive.
- KPI cards (Statistic + sparkline + delta %).
- Charts (recharts/@ant-design/charts): Revenue trend, Top customers, Aging, Cash flow.
- Filter bar: date range, branch, currency.
- Drill-down: click → filtered list page.

### ٤.٥ Empty States, Errors, Loading
- **Skeletons** (نا spinner) بۆ هەر loading.
- Empty state: SVG illustration + headline + ١-٢ CTA.
- Error boundary: friendly screen + "Report" + "Retry".
- ٤٠٤/٥٠٠: redesigned, branded, با CTA بگەڕێتەوە بۆ Dashboard.

### ٤.٦ Modals vs Drawers vs Pages
- **Modal:** confirmations + ≤ ٣ field
- **Drawer (right):** quick edit + ≤ ١٠ field
- **Full Page:** complex forms (Invoice, Bill, BOM, Payroll)

### ٤.٧ Notifications
- AntD `notification` بۆ async results.
- AntD `message` بۆ inline feedback.
- Bell drawer = persistent inbox (Firestore-backed).

### ٤.٨ Command Palette (⌘K / Ctrl+K)
- `cmdk` library + fuzzy search.
- ناوەڕۆک: لاپەڕەکان + actions (New Invoice, New Customer …) + recent records.

---

## بەشی ٥ — RTL & i18n

- AntD `direction="rtl"` + `dir="rtl"` لە `<html>`.
- هەموو margin/padding با `inline-start / inline-end` بێت (نا left/right) لە CSS.
- Icons mirrored (chevrons, arrows) بە conditional `flip-rtl` class.
- Number formatting: `Intl.NumberFormat('ar-IQ')` بۆ IQD، `en-US` بۆ USD.
- Date: `dayjs` + locale ku/en/ar.
- Mixed-direction strings (number + Kurdish) با `bdi` tag.

**i18n Namespaces:**
```
common, nav, auth, dashboard, sales, purchases, inventory, accounting,
banking, crm, pos, hr, payroll, manufacturing, projects, reports,
settings, errors, validation, iraq
```

---

## بەشی ٦ — File/Folder Structure (نوێ)

```
frontend/src/
├─ theme/
│  ├─ tokens.ts            ← color/spacing/typography
│  ├─ ConfigProvider.tsx   ← AntD wrapper
│  └─ globalStyles.css     ← reset + RTL fixes
├─ design-system/          ← reusable atoms/molecules
│  ├─ PageHeader.tsx
│  ├─ FilterBar.tsx
│  ├─ DataTable.tsx        ← ProTable wrapper
│  ├─ EditableLineItems.tsx
│  ├─ KpiCard.tsx
│  ├─ StatusTag.tsx
│  ├─ EmptyState.tsx
│  ├─ ConfirmDialog.tsx
│  ├─ MoneyInput.tsx       ← IQD/USD multi-currency
│  ├─ DateRangePicker.tsx
│  ├─ EntitySelect.tsx     ← async select (Customer/Item/Account)
│  ├─ AttachmentDrop.tsx
│  ├─ AuditTimeline.tsx
│  └─ index.ts
├─ layouts/
│  ├─ AppShell.tsx         ← Sidebar + Topbar + Outlet
│  ├─ Sidebar.tsx
│  ├─ Topbar.tsx
│  ├─ CommandPalette.tsx
│  ├─ NotificationsDrawer.tsx
│  └─ AuthLayout.tsx
├─ features/               ← feature-sliced (NEW)
│  ├─ sales/
│  │  ├─ invoices/
│  │  │  ├─ InvoicesList.tsx
│  │  │  ├─ InvoiceDetail.tsx
│  │  │  ├─ InvoiceForm.tsx
│  │  │  ├─ hooks.ts
│  │  │  └─ api.ts
│  │  ├─ quotes/  ...
│  │  └─ ...
│  ├─ purchases/ inventory/ accounting/ crm/ pos/ hr/ mfg/ projects/ reports/ iraq/ settings/
├─ pages/                  ← thin route components → re-export from features
├─ stores/
│  ├─ authStore.ts orgStore.ts uiStore.ts navStore.ts notificationsStore.ts
│  └─ posCart.ts posSession.ts posFloor.ts posOffline.ts (already exist)
├─ hooks/
│  ├─ useApi.ts useDebounce.ts useShortcuts.ts useMedia.ts usePersistent.ts
├─ utils/
│  ├─ format.ts (money/date/number) message.ts permissions.ts
└─ locales/
   ├─ ku/  (split per namespace)
   ├─ en/
   └─ ar/  (Phase 2)
```

> **Migration strategy:** old `pages/*.tsx` لە جێی خۆی بهێڵە، هەر فیچەرێک یەک بە یەک بنێرە بۆ `features/` بە "Strangler Fig" pattern.

---

## بەشی ٧ — Pages Map (٧٠+ لاپەڕە، redesigned)

> Effort: **S** = ١-٢ pomodoro · **M** = ٤-٨ hr · **L** = ١-٢ day · **XL** = ٣+ day

### Auth & Onboarding
| Path | Page | Effort |
|---|---|---|
| `/login` | Login (split-screen, branding left) | M |
| `/signup` | SignUp (multi-step: account → org → branch) | L |
| `/forgot-password` | Forgot password | S |
| `/reset-password` | Reset password | S |
| `/onboarding` | **NEW** — Setup wizard (org/branch/COA template/tax) | XL |

### Home
| Path | Page | Effort |
|---|---|---|
| `/` | Dashboard (KPIs + charts + activity) | XL |
| `/insights` | **NEW** — Cross-module insights hub | L |
| `/activity` | Activity feed | M |

### Sales (٨ لاپەڕە)
Customers (`/sales/customers` → Contacts filter), Quotes (list + form), Sales Orders, Invoices (list + detail + form), Recurring Invoices, Credit Notes, Payment Links, Sales Returns. هەموو **L** بۆ list+detail+form سێی پێکەوە.

### Purchases (٦)
Vendors, Purchase Orders, Bills (list+detail+form **L**), Vendor Credits, Recurring Bills, Purchase Returns.

### Inventory (٦)
Items (grid+list view, `XL`), Price Lists, Warehouses, Stock Adjustments, Shipments, Delivery Challans.

### Banking (٤)
Accounts (`L`), Reconciliation (`XL` — match interface), Bank Rules, Imports.

### Accounting (٧)
Chart of Accounts (tree view `L`), Manual Journals, Fiscal Year/Close (`L`), Tax Settings, Tax Returns, Assets, Reporting Tags.

### CRM (٤)
Leads (`L`), Pipeline (Kanban drag-drop `XL`), Activities (calendar+list), Insights.

### POS (١٨)
هەموو ١٨ لاپەڕە retheme. Terminal و Customer Display و Self Order و Kitchen پێویستیان بە special touch-friendly designs (`XL` هەرکامێک). بەشی ئاسایی `M-L`.

### HR & Payroll (٧)
HR Dashboard, Employees, Contracts, Attendance, Time Off, Payroll Rules, Payroll Runs, Expense Claims.

### Manufacturing (٣)
BOMs (tree builder `L`), Work Centers, MO (status flow).

### Projects (١) — `L`
Kanban tasks + timesheet + budget vs actual.

### Reports (٤)
Standard, Advanced (drag-drop builder `XL`), Consolidated, Branches Comparison.

### Iraq (٣)
E-Invoice Dashboard, WhatsApp (chat UI `L`), Iraq Localization.

### Setup (١٠)
Companies, Branches, Users, RBAC Roles, User Roles, Custom Fields (drag builder `L`), Approvals, OCR Receipts, Audit Log, Settings (tabs).

### Error
NotFound (`/404`), ServerError (`/500`).

**کۆ: ~٧٥ لاپەڕە (٦٧ ئێستا + ٥-٨ نوێ)**

---

## بەشی ٨ — Components بنەڕەتی (Design System)

| Component | جۆر | Props گرنگ | Effort |
|---|---|---|---|
| `AppShell` | layout | children | M |
| `Sidebar` | layout | collapsed, items, favorites | L |
| `Topbar` | layout | onSearch, notifications | M |
| `CommandPalette` | overlay | items, shortcuts | L |
| `OrgSwitcher` | molecule | orgs, current, onChange | S |
| `BranchSwitcher` | molecule | similar | S |
| `PageHeader` | molecule | title, subtitle, tags, actions, tabs | S |
| `FilterBar` | molecule | filters[], savedViews, onChange | M |
| `DataTable` (ProTable wrapper) | organism | columns, fetch, bulkActions, exports | L |
| `EditableLineItems` | organism | items, onChange, columns | L |
| `KpiCard` | atom | title, value, delta, sparkline, icon | S |
| `StatusTag` | atom | status enum (paid/draft/...) | S |
| `MoneyInput` | atom | value, currency, onChange | S |
| `MoneyDisplay` | atom | amount, currency, signed | S |
| `EntitySelect` | atom | entity (customer/item/account), async | M |
| `DateRangePicker` | atom | presets (Today/MTD/QTD/YTD/Custom) | S |
| `AttachmentDrop` | molecule | onUpload, accept, max | M |
| `AuditTimeline` | molecule | events[] | M |
| `EmptyState` | atom | illustration, title, action | S |
| `ConfirmDialog` | atom | danger, title, onOk | S |
| `Skeletons` | atom | row/card/chart variants | S |
| `PrintableDocument` | template | invoice/quote/bill print views | L |
| `ChartCard` | molecule | type, data, loading | S |
| `KanbanBoard` | organism | columns, cards, onMove | L |
| `Stepper` | molecule | steps, current | S |
| `ApprovalBanner` | molecule | status, approvers, actions | S |

---

## بەشی ٩ — Zustand Stores (نوێکراوە)

```ts
useAuthStore         { user, token, isAuthenticated, theme, login, logout, setTheme }
useOrgStore          { currentOrg, orgs, currentBranch, branches, switch... }     persist ✓
useUiStore           { sidebarCollapsed, density, language, toggleSidebar }       persist ✓
useNavStore          { favorites[], recent[], pin, unpin }                         persist ✓
useNotificationsStore{ items[], unread, markRead, markAllRead, fetch }
useCommandStore      { open, query, openPalette, closePalette }
useDraftsStore       { drafts: Record<entity, Record<id, payload>>, save, clear }  persist ✓
// existing POS stores stay
usePosCart, usePosFloor, usePosOffline, usePosSession
```

---

## بەشی ١٠ — i18n Keys (نموونە)

```json
// ku/nav.json
{
  "home": "ماڵەوە",
  "dashboard": "داشبۆرد",
  "sales": "فرۆشتن",
  "invoices": "پسوولەکانی فرۆش",
  "purchases": "کڕین",
  "inventory": "کۆگا",
  "banking": "بانکداری",
  "accounting": "ژمێریاری",
  "crm": "بەڕێوەبردنی پەیوەندی",
  "pos": "پۆینت ئۆف سەیڵ",
  "hr": "سەرچاوە مرۆییەکان",
  "manufacturing": "بەرهەمهێنان",
  "projects": "پڕۆژەکان",
  "reports": "ڕاپۆرتەکان",
  "iraq": "عێراق",
  "setup": "ڕێکخستن"
}
// ku/common.json: actions (new/edit/delete/save/cancel/...), states, units, currencies
// per-feature: sales.json purchases.json ... (~٦٠٠-٨٠٠ key کۆ)
```

---

## بەشی ١١ — Performance & Quality

- **Code-splitting:** هەر feature route lazy + `Suspense` بە skeleton.
- **Virtualization:** `rc-virtual-list` بۆ ≥٢٠٠ row.
- **Memoization:** `React.memo` + `useMemo` بۆ table cells.
- **Bundle:** target < 300KB initial JS (gzipped).
- **Lighthouse target:** Performance ≥ 90, Accessibility ≥ 95.
- **Accessibility:** هەموو button aria-label + keyboard nav + focus ring + WCAG AA contrast.
- **Print stylesheets:** بۆ Invoice/Quote/Bill (A4, RTL).
- **PWA:** `public/sw.js` ئێستاش هەیە — refresh + offline shell + POS offline mode.

---

## بەشی ١٢ — Testing Strategy

- **Vitest** + **React Testing Library** بۆ هەموو design-system components.
- **Playwright** smoke flows: login → create invoice → mark paid → print.
- Visual regression (optional): Chromatic/Loki بۆ Storybook.
- **Storybook 8** بۆ design-system (هەموو atom/molecule/organism).

---

## بەشی ١٣ — رۆڵ‌ـی ئەیگێنتەکان (بۆ شادۆ مێشک)

| ئەیگێنت | بەرپرسیار |
|---|---|
| **شادۆ دیزاینەر** | tokens, illustrations, empty-state SVG, print templates |
| **شادۆ فرۆنتئێند** | design-system + layouts + features migration |
| **شادۆ UX (ERP UX)** | IA, flows, command palette, onboarding wizard |
| **شادۆ تێستەر** | Vitest + Playwright + a11y audits |
| **شادۆ ئەدا** | bundle, lazy-loading, virtualization, Lighthouse |
| **شادۆ ئاژێنت‌شیلد** | XSS/CSRF در forms, secure file upload |
| **ERP Localization Iraq** | IQD format, Kurdish content review, RTL fixes |
| **شادۆ دۆکیومێنتەر** | Storybook docs + component README |

---

## بەشی ١٤ — Roadmap (٨ فەیز، ترتیب)

### Phase 0 — Foundation (پێش هەموو شت)
- [ ] Setup `theme/tokens.ts` + light/dark
- [ ] Install: pro-components, charts, cmdk, fonts
- [ ] `ConfigProvider` نوێ + RTL test
- [ ] Storybook 8 + Vitest config
- [ ] Folder restructure: create `design-system/`, `layouts/`, `features/`
- **Effort:** L

### Phase 1 — Design System Atoms/Molecules
- [ ] هەموو ٢٤ component لە بەشی ٨
- [ ] Storybook بۆ هەموو
- [ ] Unit tests
- **Effort:** XL

### Phase 2 — Shell (Layout + Nav)
- [ ] AppShell + Sidebar (sectioned + favorites + recent)
- [ ] Topbar + OrgSwitcher + BranchSwitcher
- [ ] CommandPalette ⌘K
- [ ] NotificationsDrawer
- [ ] Mobile responsive
- **Effort:** XL

### Phase 3 — Auth + Onboarding
- [ ] Login redesign (split-screen)
- [ ] SignUp wizard
- [ ] Onboarding setup wizard
- [ ] 404 / 500 / ErrorBoundary
- **Effort:** L

### Phase 4 — Core ERP (سەرەکی)
ترتیب: Dashboard → Contacts → Items → **Invoices** → Quotes → Sales Orders → Bills → PO → Banking → Accounts → Journals → Reports.
- **Effort:** XL × ٣ بلۆک

### Phase 5 — POS Retheme
هەموو ١٨ لاپەڕە. Terminal + Customer Display = touch-first redesign.
- **Effort:** XL

### Phase 6 — HR + Payroll + Mfg + Projects + CRM
- **Effort:** XL

### Phase 7 — Iraq + WhatsApp + E-Invoice + Reports v2
- Advanced report builder (drag-drop)
- WhatsApp chat UI
- E-Invoice dashboard polish
- **Effort:** XL

### Phase 8 — Polish & Launch
- [ ] Accessibility audit (axe-core)
- [ ] Performance audit (Lighthouse)
- [ ] i18n review (کوردی full)
- [ ] Print templates QA
- [ ] PWA + offline mode QA
- [ ] Visual regression
- [ ] Documentation
- **Effort:** L

---

## بەشی ١٥ — چەکلیستی Pre-Launch

```
□ هەموو ٧٥ لاپەڕە redesigned + tested
□ Sidebar navigation (sectioned + favorites + recent)
□ Command Palette (⌘K) کاردەکات
□ هەموو list page: filter + search + sort + pagination + bulk actions + export
□ هەموو form: validation + auto-save draft + keyboard nav
□ هەموو detail: tabs + activity + comments + attachments + audit
□ Empty / Loading / Error states لە هەموو شوێن
□ Skeletons (نا spinners)
□ Dark mode تەواو (هیچ contrast bug)
□ RTL ٪١٠٠ (icons, scrollbars, tables)
□ کوردی translation review (نا machine)
□ Mobile responsive (≥ 360px)
□ Tablet view (768-1024)
□ Print templates (Invoice/Quote/Bill/PO/Receipt)
□ PWA + offline POS
□ Accessibility WCAG AA (axe-core 0 critical)
□ Lighthouse ≥ 90 performance
□ Bundle < 300KB initial
□ Storybook بۆ هەموو design-system
□ Vitest coverage ≥ 70%
□ Playwright smoke (login → invoice → paid)
□ Multi-company / multi-branch context safe
□ هەموو 580 endpoint integrated بێ regression
□ Confirm dialogs بۆ delete/cancel/post
□ Notifications drawer + persistence
□ Setup wizard onboarding
□ Privacy + Terms pages (static)
□ Audit log UI
□ Backup/Export org data
```

---

## بەشی ١٦ — قەدەغەکان (NEVER)

- ❌ Backend API نا گۆڕە — تەنها UI consumer.
- ❌ هیچ inline color/spacing — تەنها tokens.
- ❌ هیچ `any` لە TypeScript.
- ❌ هیچ left/right لە CSS — `inline-start/end`.
- ❌ هیچ English-only error message.
- ❌ هیچ spinner لە جیاتی skeleton (مەگەر < 300ms).
- ❌ هیچ `&&` لە PowerShell scripts.
- ❌ هیچ over-engineering — تەنها ئەو component کە ≥ ٢ جار بەکار دێت دەچێتە design-system.
- ❌ هیچ regression لە POS offline mode.

---

## بەشی ١٧ — ئاماری کۆتایی

```
📊 کۆ:
   لاپەڕە: ~٧٥ (٦٧ retheme + ٥-٨ نوێ)
   Design-system components: ٢٤
   Layout components: ٦
   Stores: ٧ (٣ نوێ + ٤ یاسایی POS)
   Hooks: ~١٠
   i18n keys: ~٧٠٠ (٣ زمان = ~٢١٠٠)
   Routes: ~٨٥
   Print templates: ٥
   Storybook stories: ~٦٠
   Vitest tests: ~١٢٠
   Playwright flows: ~١٠

⏱️ Effort total: 8 phases · ~70-90 working days (single dev)
                              ~30-40 days (3-dev squad)
```

---

## یەکەم هەنگاوی پێشنیاری بۆ شادۆ مێشک

١. **Phase 0 spawn:** شادۆ فرۆنتئێند → setup `theme/tokens.ts` + ConfigProvider + Storybook + folder restructure.
٢. **پاڵەڵ:** شادۆ دیزاینەر → tokens + illustrations + print A4 RTL templates.
٣. **پاڵەڵ:** شادۆ UX → wireframes بۆ Sidebar + Command Palette + Onboarding wizard.
٤. **پاش Phase 0:** Phase 1 (design-system) + Phase 2 (shell) بە موازی.
٥. هەر بلۆکی Phase 4-7 پێش destructure با feature folder دروست بێت + api hooks layer.

> پلانەکە ئامادەیە. ئەگەر دەتەوێت **شادۆ مێشک** ئێستا Phase 0 دەست پێ بکات، تەنها بڵێ: **"دەست پێ بکە بە Phase 0"**.