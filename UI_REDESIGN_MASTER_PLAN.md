# 🎨 پلانی ماستەری نوێکردنەوەی فرۆنت‌ئێند — Zoho ERP v2

> **شادۆ پلانساز** | وەرسیۆن ۲.۰ | ٢٤ ئەپریل ٢٠٢٦
> ئامانج: نوێکردنەوەی پڕۆفیشناڵ، مۆدێرن، production-ready ـی هەموو UI — **Linear + Notion + Stripe Dashboard** بە ستایلی ERP کوردی، RTL-first.
> جێگرەوە بۆ [UI_REDESIGN_PLAN.md](UI_REDESIGN_PLAN.md) v1.

---

## ١ — پێشەکی

پاش پشکنینی [frontend/src](frontend/src) بە تەواوی:

**چی هەیە:** Design System ـی ١٢ primitive، Theme tokens فراوان (palette/space/radius/motion/shadow/status/typography/dataViz)، AppShell با ١٠ layout-mode، SideNav بە zones+favorites+recents، TopBar با ⌘K، LayoutChrome (TopMegaMenu, BottomNav, AppsLauncher, CommandHero, SplitMasterPanel, DashboardKpiStrip, WorkspaceTabs, LayoutQuickDock)، CommandPalette، **٨٩ پەڕە**، ١٤ shared component، Onboarding Wizard، POS shell جیا، ٤ POS Zustand store، locales `ku.json`+`en.json`، global.css.

**کێشەکانی سەرەکی (gap):**
1. ❌ هیچ **Footer / StatusBar** نییە.
2. ⚠️ TopBar زۆر سادە — Bell تەنها Tooltip ـە، نا Drawer؛ هیچ Quick-Create، Org Switcher، Branch Switcher، Density toggle، یان Breadcrumb لە TopBar نییە.
3. ⚠️ DataTable v1 بێ column-visibility، saved-views، bulk-actions، export، virtualization، sticky footer totals.
4. ⚠️ FilterBar v1 بێ presets، advanced drawer، active chips، URL-sync.
5. ❌ هیچ DetailLayout یان FormLayout نییە — ٨٩ پەڕە بە دەست layout دروست دەکەن → inconsistency.
6. ⚠️ هیچ standardized Toast wrapper نییە.
7. ❌ هیچ High-Contrast، Print stylesheet، Skip-to-Content، یان Environment Badge.
8. ⚠️ سێ density spec کراون لە tokens، تەنها دوو لە UI چالاکن.
9. ❌ Stepper, Timeline, DateRangePickerRTL, AvatarGroup, FileUploader, PhoneInput, AddressInput, ContextMenu, InlineEdit, CopyButton — هیچیان نین.
10. ⚠️ [components/CommandPalette.tsx](frontend/src/components/CommandPalette.tsx) و [layouts/CommandPalette.tsx](frontend/src/layouts/CommandPalette.tsx) duplicate.
11. ⚠️ [layouts/LayoutChrome.tsx](frontend/src/layouts/LayoutChrome.tsx) لە چەند جێگادا mojibake encoding هەیە.

**رێبازی گشتی:** هیچ گۆڕانکاری Backend. backwards-compatible. feature-flag `ui.v2.enabled`.

---

## ٢ — ئینڤێنتۆری ئێستا

### ٢.١ Layouts (٨ فایل)
| فایل | دۆخ | یاداشت |
|---|---|---|
| [AppShell.tsx](frontend/src/layouts/AppShell.tsx) | ✅ | تەنها slot ـی Footer زیاد بکرێت |
| [TopBar.tsx](frontend/src/layouts/TopBar.tsx) | ⚠️ | ٧ feature gap |
| [SideNav.tsx](frontend/src/layouts/SideNav.tsx) | ✅ | polish + drag-reorder favorites + user mini-card |
| [LayoutChrome.tsx](frontend/src/layouts/LayoutChrome.tsx) | ⚠️ | mojibake پاک بکرێت |
| [CommandPalette.tsx](frontend/src/layouts/CommandPalette.tsx) | ✅ | duplicate لە components/ لاببرێت |
| [navigation.tsx](frontend/src/layouts/navigation.tsx) | ✅ | 4 zones × 12 sections × ~70 leaves |
| [moduleMap.ts](frontend/src/layouts/moduleMap.ts) | ✅ | onboarding gating |
| [README.md](frontend/src/layouts/README.md) | ⚠️ | یەک ڕستەیە، بنوێژێتەوە |

**نییە:** Footer, Breadcrumb, NotificationsDrawer, QuickCreateMenu, OrgSwitcher, BranchSwitcher.

### ٢.٢ Design System (١٢ primitive)
PageHeader, KpiCard, StatusTag, EmptyState, MoneyInput, FilterBar, DataTable, ConfirmDialog, SectionCard, KeyValueGrid, KbdHint, LoadingSkeleton.
- **PageHeader:** ٧٩+ usage لە ~٥٠ پەڕە — بەرفراوان ✅
- **DataTable / FilterBar:** تەنها UIKit + ٢-٣ پەڕە ⚠️
- **KpiCard:** Dashboard تەنها ⚠️

### ٢.٣ Theme (٢ فایل)
- [tokens.ts](frontend/src/theme/tokens.ts) — تەواو، ratio system موجوود
- [AppConfigProvider.tsx](frontend/src/theme/AppConfigProvider.tsx) — تەنها سەرچاوەی AntD theme

### ٢.٤ Pages (٨٩ پەڕە)
- **Top-level (~٧٠):** Dashboard, Login, SignUp, ForgotPassword, ResetPassword, NotFound, ServerError, Accounts, AdvancedReports, Approvals, Assets, AuditLog, Banking, BankReconciliation, BankRules, Bills, Branches, BranchesComparison, Companies, ConsolidatedReports, Contacts, CreditNotes, CRMActivities, CRMInsights, CRMLeads, CRMPipeline, CustomFields, DeliveryChallans, DocsHub, EInvoiceDashboard, ExpenseClaims, Expenses, HRAttendance, HRContracts, HRDashboard, HREmployees, HRTimeOff, Inventory, InvoiceForm, Invoices, IraqLocalization, Items, Journals, MfgBOMs, MfgOrders, MfgWorkCenters, OCRReceipts, PaymentLinks, PayrollRules, PayrollRuns, PriceLists, Projects, PurchaseOrders, PurchaseReturns, QuoteForm, Quotes, RbacRoles, RecurringInvoices, Reports, SalesOrders, SalesReturns, SerialNumbers, Settings, Shipments, TaxReturns, TaxSettings, Trash, UIGallery, UIKit, UserRoles, VendorCredits, Warehouses, WhatsApp.
- **POS (١٨):** POSCategories, POSConfigs, POSCustomerDisplay, POSEmployees, POSFloorPlan, POSFloors, POSGiftCards, POSHub, POSKitchen, POSLoyalty, POSOrders, POSPricelists, POSProducts, POSReports, POSSelfOrder, POSSessionDetail, POSSessions, POSTerminal.
- **Modules (١):** ModuleHub.

**ئاست:** ~٥٠/٨٩ پەڕە DS بەکار دێنن، ٤٠ پەڕە ڕاستەوخۆ AntD → inconsistency.

### ٢.٥ Components (١٤)
AuthLayout, CommandPalette (duplicate!), ErrorBoundary, ExportButton, GoogleSignInButton, GuideDrawer, HelpButton, ModuleGuard, PageHelp, PageTransition, SectionDocsDrawer, SerialNumberPicker, SupportWidget, pos/.

### ٢.٦ Stores
- [store.ts](frontend/src/store.ts) → `useAuthStore` (token, user, org, theme, layoutMode ١٠)
- [stores/](frontend/src/stores/): posCart, posFloor, posOffline, posSession.
- ❌ هیچ `useUiStore` — density/sidebarCollapsed بە دەست لە localStorage.

### ٢.٧ Locales
[ku.json](frontend/src/locales/ku.json) + [en.json](frontend/src/locales/en.json). هیچ `ar.json`.

### ٢.٨ Global CSS
[global.css](frontend/src/global.css) — کۆمێنتەکان mojibake.

---

## ٣ — بینایی ئامانج (Vision)

> **"Linear meets Notion meets Stripe Dashboard — ساخته شده بۆ ئەکاونتانتی عێراقی کە RTL دەخوێنێتەوە."**

- **خێرا:** Lighthouse ≥ 90 لە هەموو route، animation < 300ms.
- **ئاسایی:** WCAG 2.1 AA، 100% keyboard، ٣ density.
- **یەکڕیز:** هەر ٨٩ پەڕە یەک PageHeader، یەک FilterBar، یەک DataTable، یەک Toast.
- **پرۆفیشناڵ:** Linear-grade chrome، fluid motion، adaptive density.

---

## ٤ — لیستی شادۆ دیزاینەر (A–G)

### A. Top-Level Chrome
| پێکهاتە | دۆخ | چی پێویستە |
|---|---|---|
| **TopBar v2** | ⚠️ | logo + breadcrumb + ⌘K + ＋Quick-Create + 🔔Bell(badge) + ?Help + 🌐Lang + 🌓Theme + ↕Density + 🏢Org + 👤Avatar(role) |
| **NotificationsDrawer** | ❌ | Drawer 420px، tabs Today/Earlier/Read، group by module، mark-all-read، deep-link |
| **QuickCreateMenu** | ❌ | Popover: Invoice/Bill/Customer/Vendor/Item/Quote/Manual Journal — `c i`, `c b`, `c c` |
| **OrgSwitcher / BranchSwitcher** | ❌ | dropdown با recent + search + add-new |
| **Sidebar v2** | ✅⚠️ | + collapse polish + drag-reorder favorites + pinned modules + user mini-card |
| **Footer / StatusBar** | ❌ | sticky 32px: connection + fiscal-year + org·user + version + env-badge + last-sync + links |
| **Breadcrumb (global)** | ⚠️ | لە PageHeader هەیە — TopBar auto-breadcrumb لە route |
| **Skip-to-Content** | ❌ | بۆ a11y |

### B. Page-Level
| Primitive | دۆخ | v2 |
|---|---|---|
| **PageHeader v2** | ✅ | + status-slot + tabs-slot + sticky-on-scroll + KbdHint |
| **DataTable v2** | ⚠️ | + ColumnVisibility + SavedViews + BulkActionBar + ExportMenu + RowExpand + StickyHeader/FooterTotals + virtualization (≥500) |
| **FilterBar v2** | ⚠️ | + presets + AdvancedFilterDrawer + FilterChipTray + URL-sync + reset |
| **DetailLayout** | ❌ | 70/30 split، sticky toolbar، tabs، related/activity/attachments/comments slots |
| **FormLayout** | ❌ | section dividers، sticky save bar، unsaved-guard، autosave indicator، required summary |
| **EmptyState v2** | ⚠️ | + illustration slot + "Learn more" + sample-data CTA |
| **Skeletons (variants)** | ⚠️ | `table`/`card`/`kpi`/`form`/`detail` |
| **SectionCard / KeyValueGrid / KpiCard** | ✅ | polish |

### C. Micro-Components
Toast wrapper (Undo, action button), Chip (removable), Pill (count), Stepper, Timeline, DateRangePickerRTL (Hijri/Gregorian), AvatarGroup, UserSelect, CurrencyInput v2 (multi-currency dropdown), PhoneInput (+964), AddressInput (IQ governorates), FileUploader (drag/drop), ImageGallery, BulkActionBar, InlineEdit, CopyButton, ContextMenu, MiniSparkline, TrendChart, ShortcutCheatsheet (`?` open), EnvironmentBadge, ConnectionStatus.

### D. Theme & Tokens
- Light ✅، Dark ✅، **High-Contrast ❌** (mode سێیەم)
- Density ٣ mode active — TopBar density picker
- Brand customization (per-org logo + primary color)
- Print stylesheet `@media print` (hide chrome، A4 RTL)
- Reduced-motion ✅

### E. UX Flows
- Onboarding tour ✅
- Empty → first-record (sample-data CTA)
- Keyboard shortcuts + ShortcutCheatsheet (`?`)
- Search ⌘K ✅
- Right-click ContextMenu ❌
- Multi-select + BulkActionBar ❌
- Undo toast (5s) ❌
- Optimistic UI standardize hook

### F. Accessibility (WCAG 2.1 AA)
ARIA labels لە هەموو icon-only، Focus trap لە Modal/Drawer، Keyboard nav لە DataTable/Sidebar/TopBar، `aria-live` بۆ Toast، contrast ≥ 4.5:1 (axe)، Skip-to-content، `aria-expanded`، touch ≥ 44px (Compact 32px تەنها desktop).

### G. Responsive
xs<576 mobile (BottomNav + Drawer)، sm 576-768، md 768-992 tablet (Collapsed sidebar default)، lg 992-1200 desktop، xl≥1200 wide (DetailLayout 70/30).

---

## ٥ — Information Architecture

Sidebar IA لە [navigation.tsx](frontend/src/layouts/navigation.tsx) تەواوە. v2 گۆڕانکاری:

**Zone re-grouping:**
- **Core Commerce:** Overview, Sales, Purchases
- **Operations:** Inventory, Manufacturing, POS, Projects
- **People:** CRM, HR
- **Finance & Control:** Banking, Accounting, Reports, Iraq Localization, Setup

**TopBar order (LTR / RTL mirror):**
`[☰] [Logo] [Breadcrumb] ←—→ [⌘K] [＋] [🔔] [?] [🌐] [🌓] [↕] [🏢] [👤]`

**Footer order:**
`[● Online] [FY 2026] [acme.org · admin] ←—→ [v1.4.2] [prod] [Sync 2m ago] [Help · API · Privacy · Terms]`

**Pinned favorites default:** Dashboard, Invoices, Bills, Contacts, Items.

---

## ٦ — Design System Roadmap

**Token ـی نوێ (Sprint 1):** `elevation` (raised/floating/overlay/popover)، `transitions` (micro/base/emph)، `layout` (topbarHeight/footerHeight/sidebarWidths/pagePadding)، `a11y` (minTouchTarget/focusRing)، `hcLight`/`hcDark`.

**Primitive ـی نوێ (٣٠ دانە):** Footer, TopBarV2, NotificationsDrawer, QuickCreateMenu, OrgSwitcher, BranchSwitcher, Breadcrumb, DetailLayout, FormLayout, BulkActionBar, ColumnVisibility, SavedViewsPicker, ExportMenu, AdvancedFilterDrawer, FilterChipTray, Stepper, TimelineCard, DateRangePickerRTL, AvatarGroup, UserSelect, PhoneInput, AddressInput, FileUploader, MiniSparkline, TrendChart, ContextMenu, InlineEdit, CopyButton, ShortcutCheatsheet, EnvironmentBadge.

**Refactor (٦):** PageHeader, DataTable, FilterBar, EmptyState, LoadingSkeleton, MoneyInput.

**Store ـی نوێ:** `stores/uiStore.ts` (density, sidebarCollapsed, notificationsOpen, quickCreateOpen, highContrast, pinnedFavorites)؛ `stores/notificationsStore.ts` (items, unreadCount, fetch, markRead).

---

## ٧ — Sprint Plan (١٠ سپرینت)

| # | ئامانج | Deliverables (سەرەکی) | ئەیگێنت | Dependency |
|---|---|---|---|---|
| **1** | Foundation: Tokens v2 + UiStore + Footer | tokens extend (elevation/transitions/layout/a11y/hc)، `stores/uiStore.ts`، `layouts/Footer.tsx`، AppShell slot، `SkipToContent`، 30+ i18n key | شادۆ دیزاینەر + زۆهۆ فرۆنتئێند | — |
| **2** | TopBar v2 + Breadcrumb auto | TopBar rewrite (Logo/Breadcrumb/⌘K/＋/Bell/Help/Lang/Theme/Density/Org/Avatar)، `layouts/Breadcrumb.tsx`، avatar dropdown، 3-density picker | زۆهۆ فرۆنتئێند | Sprint 1 |
| **3** | NotificationsDrawer + QuickCreate + OrgSwitcher | Drawer 420px tabs Today/Earlier/Read، `notificationsStore`، QuickCreateMenu (7 entity + keyboard)، Org/BranchSwitcher | زۆهۆ فرۆنتئێند + باکئێند (`/api/notifications` mock-first) | Sprint 2 |
| **4** | Sidebar v2 polish + favorites reorder | dnd-kit drag-reorder، collapse animation refine، user mini-card، pinned modules، LayoutChrome mojibake fix، duplicate CommandPalette لاببرێت | زۆهۆ فرۆنتئێند | Sprint 1 |
| **5** | DataTable v2 + FilterBar v2 | ColumnVisibility, SavedViews, BulkActionBar, ExportMenu, virtualization، AdvancedFilterDrawer, FilterChipTray, URL-sync hook، UIKit نوێ | زۆهۆ فرۆنتئێند + تێستەر (1000-row perf) | Sprint 1 |
| **6** | DetailLayout + FormLayout + Toast | DetailLayout (70/30 + slots)، FormLayout (sticky save + unsaved-guard + autosave)، `Toast` wrapper (Undo)، `useUnsavedChangesGuard`، `useToast` | زۆهۆ فرۆنتئێند | Sprint 1 |
| **7** | Migration Wave 1 — Sales + Purchases (١٧ پەڕە) | Invoices, InvoiceForm, Quotes, QuoteForm, SalesOrders, CreditNotes, Shipments, DeliveryChallans, SalesReturns, RecurringInvoices, PaymentLinks, Bills, PurchaseOrders, VendorCredits, PurchaseReturns, Expenses, ExpenseClaims | زۆهۆ فرۆنتئێند + زۆهۆ ئەکاونتینگ | Sprint 5, 6 |
| **8** | Migration Wave 2 — Banking + Accounting + Inventory (١٦ پەڕە) | Banking, BankReconciliation, BankRules, Accounts, Journals, TaxSettings, TaxReturns, Assets, Inventory, Items, Warehouses, PriceLists, SerialNumbers, MfgBOMs, MfgOrders, MfgWorkCenters | زۆهۆ فرۆنتئێند + باکئێند audit | Sprint 7 |
| **9** | Migration Wave 3 — HR + CRM + POS polish + Reports + Settings (٢٩ پەڕە) | HR (5)، Payroll (2)، CRM (4)، Projects، Reports (4)، Settings + RBAC + AuditLog + Localization + EInvoice + OCR + WhatsApp + POS visual polish | زۆهۆ فرۆنتئێند + شادۆ POS | Sprint 8 |
| **10** | Polish: Micro + A11y + Print + High-Contrast + QA | Stepper, Timeline, DateRangePickerRTL, AvatarGroup, UserSelect, PhoneInput, AddressInput, FileUploader, MiniSparkline, ContextMenu, InlineEdit, CopyButton, ShortcutCheatsheet، axe-core، print stylesheet، HC mode toggle، Lighthouse ≥ 90، Playwright E2E (5 flow) | زۆهۆ فرۆنتئێند + شادۆ ئاژێنت‌شیلد + شادۆ تێستەر | All prior |

**Verification per sprint:** `npm run build` clean + Lighthouse smoke + axe-core + RTL/LTR mirror + keyboard-only walkthrough.

---

## ٨ — Risk Matrix

| Risk | کاریگەری | Mitigation |
|---|---|---|
| AntD 6.3.5 deprecations (Drawer width, message context) | M | Sprint 1 audit + AntD `App` component for context |
| DataTable v2 backwards-compat (٧٩+ usage) | **H** | feature-flag `dataTableV2` + props نوێ بەبێ گۆڕینی API ـی موجوود |
| Bundle size زیاد دەبێت (cmdk, dnd-kit, react-virtual, charts) | M | code-splitting لە route + dynamic import |
| RTL bugs لە primitive ـی نوێ | **H** | RTL test لە هەر PR + visual regression optional |
| ٨٩-page migration scope | **H** | wave-based (Sprint 7/8/9) + snapshot v1↔v2 |
| Vazirmatn font slow load | L | preconnect + `font-display: swap` |
| localStorage quota (saved views/favorites) | L | payload size watch |
| POS shell نا standard | M | Sprint 9 polish تەنها — full refactor v3 |
| `/api/notifications` نییە | M | mock-first Sprint 3، Backend Sprint جیا |
| Onboarding gating بە refactor دەشکێت | M | regression test Sprint 4 |

**Rollout:** feature flag `ui.v2.enabled` لە `useUiStore` → A/B 10% → 50% → 100% → rollback ئاسانە.

---

## ٩ — Subagent Matrix

| Sprint | شادۆ دیزاینەر | زۆهۆ فرۆنتئێند | باکئێند | تێستەر | ئاژێنت‌شیلد |
|---|---|---|---|---|---|
| 1 Foundation | ✅ tokens | ✅ Footer + UiStore | — | smoke | — |
| 2 TopBar v2 | ✅ visual | ✅ build | — | a11y | — |
| 3 Notifications + QuickCreate + Org | ✅ Drawer | ✅ build | ⚠️ /api/notifications | smoke | — |
| 4 Sidebar polish | ✅ visual | ✅ dnd-kit | — | RTL | — |
| 5 DataTable + FilterBar v2 | ✅ patterns | ✅ build | — | perf 1000 rows | — |
| 6 Detail/Form/Toast | ✅ patterns | ✅ build | — | unsaved guard | — |
| 7 Wave 1 | — | ✅ migrate | ⚠️ audit | snapshot | — |
| 8 Wave 2 | — | ✅ migrate | ⚠️ audit | snapshot | — |
| 9 Wave 3 | — | ✅ migrate | — | snapshot | — |
| 10 Polish + QA | ✅ micro | ✅ build | — | E2E | ✅ axe |

---

## ١٠ — Success Metrics

| Metric | Baseline | Target | پێوانە |
|---|---|---|---|
| Lighthouse Performance | ~75 | ≥ 90 | `lighthouse-ci` |
| Lighthouse Accessibility | ~85 | ≥ 95 | ↑ |
| axe-core violations | unknown | 0 critical/serious | `@axe-core/playwright` CI |
| WCAG 2.1 AA | partial | full | manual + axe |
| Bundle size (initial gzip) | TBD | ≤ 320 KB | `vite-bundle-visualizer` |
| TTI (3G) | unknown | < 2.5s | Lighthouse |
| Page consistency (DS used) | 50/89 | 89/89 | grep PageHeader/DataTable |
| Keyboard-only walkthrough | partial | 100% | manual checklist |
| RTL parity (LTR == RTL) | partial | 100% | visual diff |
| `npm run build` clean | ✅ | ✅ stays | CI |
| TypeScript strict (0 `any`) | ✅ | ✅ stays | tsc + eslint |
| Sentry error rate | baseline | ≤ baseline | dashboard |
| User NPS (post-launch) | n/a | ≥ 60 | in-app survey |

---

## 📊 ئاماری کۆتایی

```
🗂️ Sprint کۆ:        ١٠
🧩 Primitive نوێ:    ٣٠
♻️ Primitive refactor: ٦
📄 Page migration:   ٨٩ (٣ wave: ١٧+١٦+٢٩+٢٧)
🆕 Layout component: ٧ (Footer, TopBarV2, NotificationsDrawer, QuickCreate, OrgSwitcher, BranchSwitcher, Breadcrumb)
🌐 i18n keys نوێ:    ~١٢٠
🤖 Subagent role:    ٥
🎯 KPI:              ١٣
⚠️ High risk:        ٣ (DataTable backcompat، 89-page scope، RTL parity)
```

---

## 🚀 ڕۆژی یەکەم

1. ئەم پلانە review بکە، گرۆڕانکاری بنوێژەوە.
2. Sprint 1 دەست پێ بکە: `theme/tokens.ts` extend → `stores/uiStore.ts` → `layouts/Footer.tsx` → `components/SkipToContent.tsx` → ٣٠ i18n key.
3. لە کۆتای: `npm run build` + Footer لە دیار بێت لە ٩ layout-mode (نا POS).

---

## خۆلاسە

- **١٠ سپرینت** — Foundation → TopBar v2 → Notifications/QuickCreate → Sidebar polish → DataTable+FilterBar v2 → DetailLayout+FormLayout+Toast → ٣ wave migration → Polish+A11y+QA.
- **٣٠ primitive ـی نوێ** + **٦ refactor** + **٨٩ پەڕە migration** + **٧ layout component نوێ**.
- ٣ risk بەرز identify کرا، هەر سێ بە feature-flag + wave-rollout + RTL-test mitigate کراوە.
- **یاداشت:** فایل دروستکردن disabled بوو، پلانەکە لە چات وەرگرە و کۆپی بکە بۆ `c:\Users\SAFA\zoho\UI_REDESIGN_MASTER_PLAN.md`.
