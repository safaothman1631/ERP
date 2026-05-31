# تۆماری تەواوی فرۆنتئیند — Zoho-Kurdish ERP / Complete Front-End Inventory

> **مەبەست / Purpose.** ئەم دۆکیومێنتە تۆمارێکی تەواوی هەموو ڕووکاری فرۆنتئیندە (هەموو بەش، ناڤبار، درۆپداون، ڕێکخستن، دیالۆگ، بەتن، فۆرم و فیلد) بۆ ئەوەی بدرێت بە ئامرازی دیزاین تاکو جوانترین دیزاینی نوێ دروست بکات. This is an exhaustive structural map of the entire front-end (every module, nav item, dropdown, settings section, dialog, button, form and field), bilingual (Kurdish + English), meant to be fed into a UI design tool to regenerate the most beautiful possible UI.
>
> **چۆن بەکاری بهێنیت / How to read it.** هەر `route`ـێک = یەک شاشە. لەیبڵەکان دوو زمانین (ئینگلیزی + کوردی). ئەپەکە **RTL** ـە و زمانی بنەڕەت کوردیی سۆرانییە. Each `route` is one screen; labels are bilingual; the app is **RTL**, Kurdish-Sorani-first.

---

## پێرست / Contents

1. پوختە و تەکنەلۆژیا — **Overview & Tech Stack**
2. پێکهاتەی سەرەکی و کرۆم — **App Shell & Chrome** (TopBar · Quick Create · switchers)
3. بناغەی دیزاین — **Design Tokens · Role Themes · Dashboard**
4. ناڤبار — **Sidebar Navigation IA** (4 zones · 25 sections · 120+ links)
5. مۆدیوولی زیادکراو — **Extended-Module Registry** (32 `/ext/*` modules)
6. سیستەمی ڕێکخستن — **Settings IA** (12 groups · 59 sections)
7. فرۆشتن/کڕین/بانک — **Sales · Purchases · Banking · Contacts · Items**
8. ژمێریاری/ڕاپۆرت/عێراق — **Accounting · Reports · Multi-Entity · Iraq**
9. کۆگا/بەرهەمهێنان/POS — **Inventory · Manufacturing · POS · Quality · Maintenance · Repairs · Rental**
10. خەڵک و پەیوەندی — **HR · Payroll · Projects · CRM · Marketing · Helpdesk · KB · Subscriptions · DMS · Field Service**
11. پیشەسازی تایبەت و پلاتفۆرم — **Verticals · AI · IoT · Studio · Portals · Module Hub · Dashboards**
12. ڕێکخستن (وردەکاری) — **Settings / Admin / Auth / Onboarding detail**
13. سیستەمی دیزاین — **Design System · Shared Components · Chrome dropdowns**
14. زیادە — **Appendix** (stats · known gaps · design guidance)

---

## ١. پوختە و تەکنەلۆژیا / Overview & Tech Stack

سیستەمێکی **ERP/بازرگانی تەواوە وەک Zoho One**، بەڵام بە زمانی کوردیی سۆرانی و بۆ بازاڕی عێراق (باج، e-Fakhata، IQD، مانگی هیجری، ژمارەی عەرەبی-هیندی). A full Zoho-One-class ERP localized for Kurdish/Iraq.

| | |
|---|---|
| **Framework** | React 19 + TypeScript + Vite |
| **UI kit** | Ant Design (antd) v6 — themed globally via design tokens |
| **State** | Zustand (auth, ui, nav, POS cart/floor/session/offline) |
| **Routing** | react-router — ~2,330 routes |
| **i18n** | i18next, namespaced lazy-loading — 3 languages: **کوردی `ku` (default)**, English `en`, العربية `ar` |
| **Charts** | Recharts (+ a `dataViz` palette) |
| **Direction** | **RTL-first** (logical CSS properties throughout) |
| **Fonts** | RTL: `Vazirmatn` → `Noto Sans Arabic`; LTR: `Inter` |
| **Offline/PWA** | POS is offline-first on IndexedDB; service worker precache |
| **Look & feel** | **Glass-morphism** surfaces + role-adaptive accent theming + motion |

**قەبارە / Scale:** ‏808 فایلی TS/TSX · 25 بەشی ناڤبار لە 4 زۆن · 120+ بەستەری ناڤبار · 32 مۆدیوولی زیادکراو (`/ext/*`) · 59 بەشی ڕێکخستن لە 12 گرووپ · 12 ڕووماڵی ڕۆڵ (role theme) · سەدان دیالۆگ/فۆرم.

---

## ٢. پێکهاتەی سەرەکی و کرۆم / App Shell & Chrome

ڕووکاری گشتی: **TopBar** (بەرزی 60px، چەسپاو، شووشەیی/glass) + **SideNav** ی داخستەبار (320px ← 72px) + ناوەڕۆک (max 1440px) + **Footer** (32px). لە مۆبایل: TopBar ی 56px + ناڤباری drawer + مۆداڵەکان وەک *bottom-sheet*.

**TopBar (لە چەپ بۆ ڕاست لە LTR / پێچەوانە لە RTL):**

1. دوگمەی کۆکردنەوەی مێنیو (collapse) — `MenuFold/Unfold`
2. **Breadcrumb** — ڕێڕەوی ئێستا
3. **Command Search pill** — `⌘K` / Ctrl-K (دەکاتەوە Command Palette)
4. **Role quick-actions** — ≤2 دوگمەی خێرا بەپێی ڕۆڵ (بۆ نموونە "نرخنامەی نوێ")
5. **Quick Create `+`** — دوگمەی سەرەکی (gradient)، دەکاتەوە مێنیوی دروستکردنی خێرا
6. **OrgSwitcher** — گۆڕینی ڕێکخراو
7. **BranchSwitcher** — گۆڕینی لق
8. **EntitySwitcher** — کۆنتێکستی فرە-کۆمپانیا (multi-entity)
9. **Notifications** 🔔 — لەگەڵ badge ی ژمارەی نەخوێندراو (دەکاتەوە NotificationsDrawer)
10. **Help `?`** — دەکاتەوە ShortcutCheatsheet
11. **Density switcher** — Compact / Comfortable / Spacious (چڕی)
12. **Theme toggle** — ڕووناک/تاریک (Sun/Moon)
13. **LanguageSwitcher** — ku / en / ar
14. **RoleIdentityChip + User menu** — ناسنامەی ڕۆڵ + مێنیوی بەکارهێنەر (Settings، Logout)

**Quick Create menu (٧ بڕگە، گەڕان + کلیلی `c`+پیت):**

| Item (EN) | کوردی | Shortcut | Route |
|---|---|---|---|
| Invoice | پسووڵە | `c` then `I` | `/invoices/new` |
| Bill | خەرجی فرۆشیار | `c B` | `/bills` |
| Customer | کڕیار | `c C` | `/contacts` |
| Vendor | فرۆشیار | `c V` | `/contacts` |
| Item | کاڵا | `c P` | `/items` |
| Quote | نرخ | `c Q` | `/quotes` |
| Manual Journal | تۆمارکردنی دەستکار | `c J` | `/journals` |

**کرۆمی تر / Other chrome:** Command Palette (گەڕانی fuzzy بەسەر هەموو بەستەرەکان + فەرمانەکانی ڕێکخستن)، NotificationsDrawer، ShortcutCheatsheet، Breadcrumb، و لە مۆبایل دوگمەی Favorite/Pin (ئەستێرە). وردەکاریی ناوەڕۆکی هەر درۆپداونێک لە **بەشی ١١ (Design-System & Chrome)** هەیە.

---

## ٣.٠ بناغەی دیزاین / Design Tokens

هەموو ڕەنگ/بۆشایی/فۆنت/جووڵە لە یەک سەرچاوەوەن (`theme/tokens.ts`) — هیچ ڕەنگ/بۆشاییەکی inline نییە. The single source of truth for the visual language:

**ڕەنگی براند / Brand & semantic colors** (هەریەکە سکالای 50–900ی هەیە):

| Role | Base | Light bg |
|---|---|---|
| Primary (براند) | `#1F6FEB` (Zoho-blue) | `#EBF2FF` |
| Success | `#16A34A` | `#DCFCE7` |
| Warning | `#F59E0B` | `#FEF3C7` |
| Danger/Error | `#DC2626` | `#FEE2E2` |
| Info | `#0EA5E9` | `#E0F2FE` |
| Neutrals (ink/gray) | `#0F172A`→`#F8FAFC` | surface `#FFFFFF`, bg `#F8FAFC`, border `#E5E7EB` |
| Dark mode | bg `#0B1220`, surface `#111A2E`, elevated `#172238`, ink `#E2E8F0` | |

**Data-viz categorical:** `#1F6FEB, #16A34A, #F59E0B, #DC2626, #0EA5E9, #8B5CF6, #EC4899, #14B8A6`.

**بۆشایی / Spacing** — 4pt grid: `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48`.
**Radius:** `xs 4 · sm 6 · md 10 (controls) · lg 14 (cards/modals) · xl 18 · pill 999`.
**Typography ramp:** display 36/700 · h1 28/700 · h2 22/600 · h3 18/600 · bodyLg 15 · body 14 · bodySm 13 · caption 12/500 · overline 11/600 (uppercase). Weights 300–800.
**Motion:** durations fast 150 / normal 250 / slow 400 ms; easing standard `cubic-bezier(.2,0,0,1)`, emphasized `cubic-bezier(.3,0,0,1)`.
**Elevation/Shadow:** flat → raised → floating → overlay → popover (light + dark variants).
**Z-index:** dropdown 1000 · sticky 1100 · drawer 1200 · modal 1300 · popover 1400 · toast 1500 · tooltip 1600.
**Layout dims:** topbar 60px (compact 52) · footer 32px · sidebar 320px (compact 272 / collapsed 72) · page padding 24 · content max 1440 · detail split 260–520 (default 320).
**A11y:** min touch target 44px (WCAG AA), focus ring 2px @ `#1F6FEB`; high-contrast palettes provided.
**Density:** Compact (32px controls / 16 pad) · Comfortable (36 / 20) · Spacious (44 / 24).

**شووشە / Glass-morphism tokens** — per-surface `bg` + `backdrop-filter` blur + border, in light & dark, for: `topbar, sidebar, palette (command), login, modal, dialog, drawer, card, popover, toast`. مۆنە `blur(16–28px) saturate(150–180%)` و پاشکەوتی `@supports not (backdrop-filter)` بۆ سەرفەیسی ڕەق.

## ٣.١ ڕووماڵی ڕۆڵ / Role-Adaptive Themes (12)

ئەپەکە بۆ هەر ڕۆڵێک ڕەنگی accent، ڕووتی بنەڕەت و دوگمە خێراکانی جیاوازی هەیە (`theme/roleThemes.ts`). هیرۆی داشبۆرد بە gradient ـی ئەم accent ـە دەکرێت. Each role gets a distinct accent, default landing route, and quick actions:

| Role theme | Accent | Default route | Quick actions |
|---|---|---|---|
| `executive` (owner) | `#D97706` amber | `/dashboard` | Settings · Module requests · Users |
| `administrator` (admin) | `#1F6FEB` blue | `/dashboard` | Users · Settings · Module requests |
| `manager` | `#0D9488` teal | `/dashboard` | New invoice · Purchase orders |
| `finance` (accountant) | `#15803D` green | `/dashboard` | Journals · New invoice |
| `sales` | `#1F6FEB` blue | `/crm/leads` | New quote · CRM |
| `purchase` | `#7C3AED` violet | `/purchase-orders` | Purchase orders |
| `inventory` | `#0891B2` cyan | `/inventory` | Inventory |
| `pos` (cashier) | `#DC2626` red | `/pos` | Open POS |
| `hr` | `#8B5CF6` purple | `/hr` | HR |
| `projects` | `#6366F1` indigo | `/projects` | Projects |
| `personal` | `#64748B` slate | `/dashboard` | — |
| `readonly` (viewer) | `#94A3B8` gray | `/dashboard` | — |

## ٣.٢ داشبۆردی ڕۆڵ-گونجاو / Role-Adaptive Dashboard

`/` و `/dashboard` ڕووماڵێکی گونجاو نیشان دەدەن. The home renders KPIs + chart + recent activity, filtered per role layout (`dashboard/dashboardLayouts.ts`):

- **KPI cards:** Total receivable (کۆی وەرگیراو), Total payable (کۆی پارەدان), Income this month (داهاتی ئەم مانگە), Expenses this month (خەرجی ئەم مانگە), Total contacts (کۆی پەیوەندیەکان), Overdue invoices (پسووڵە دواکەوتووەکان) — each clickable, `tone` colored (success/danger/primary/warning/info).
- **Quick actions card:** New invoice · Expenses · Payments · Reports.
- **Chart:** Income vs Expenses bar chart (recharts, responsive, RTL).
- **Recent invoices** table (با EmptyState).
- **My Activities** widget.
- **DashboardHero** greeting banner (role accent gradient); 12 thin role-home wrappers (`executive/administrator/manager/finance/sales/purchase/inventory/pos/hr/projects/personal/readonly`) reuse this with different KPI/section visibility.

---

## ٤. ناڤبار / Sidebar Navigation — Information Architecture

سایدبار ٤ زۆن و ٢٥ بەش و ١٢٠+ بەستەری دەرئەنجامی هەیە. هەر زۆنێک چەند بەشێکی تێدایە. (The sidebar groups 25 sections into 4 zones.)


### زۆن / Zone: Core Commerce — بازرگانی سەرەکی


#### Overview / گشتی  `section:overview`

| Route | English | کوردی |
|---|---|---|
| `/` | Dashboard | داشبۆرد |
| `/contacts` | Contacts | پەیوەندیەکان |
| `/items` | Items | کاڵاکان |


#### Sales / فرۆشتن  `section:sales`

| Route | English | کوردی |
|---|---|---|
| `/invoices` | Invoices | وەسڵەکان |
| `/quotes` | Quotes | کۆتاکان |
| `/sales-orders` | Sales Orders | فرۆشتنی دیاریکراو |
| `/credit-notes` | Credit Notes | نۆتەکانی قەرز |
| `/shipments` | Shipments | ناردنەکان |
| `/delivery-challans` | Delivery Challans | Delivery Challans |
| `/sales-returns` | Sales Returns | گەڕانەوەی فرۆشتن |
| `/returns/sales` | Sales Returns | گەڕانەوەی فرۆشتن |
| `/payment-links` | Payment Links | لینکەکانی پارەدان |
| `/recurring-invoices` | Recurring Invoices | وەسڵی دووبارەبوونەوە |


#### Purchases / کڕین  `section:purchases`

| Route | English | کوردی |
|---|---|---|
| `/bills` | Bills | پسووڵەکان |
| `/purchase-orders` | Purchase Orders | داواکاری کڕین |
| `/vendor-credits` | Vendor Credits | قەرزی فرۆشیار |
| `/purchase-returns` | Purchase Returns | گەڕانەوەی کڕین |
| `/returns/vendor` | Vendor returns | گەڕاندنەوە بۆ دابینکەر |
| `/expenses` | Expenses | خەرجیەکان |
| `/expense-claims` | Expense Claims | Expense Claims |


### زۆن / Zone: Operations — کارمەندایەتی/کارگێڕی


#### Inventory / کۆگا  `section:inventory`

| Route | English | کوردی |
|---|---|---|
| `/inventory` | Inventory Overview | Inventory Overview |
| `/inventory/warehouses` | Warehouses | کۆگاکان |
| `/inventory/locations` | Stock locations | شوێنەکانی کۆگا |
| `/inventory/putaway-rules` | Putaway rules | ڕێسای دانان |
| `/inventory/cycle-counts` | Cycle counts | ژمارکردنی خولی |
| `/inventory/price-lists` | Price Lists | Price Lists |
| `/inventory/serials` | Serial Numbers | ژمارەکانی سیریاڵ |


#### Manufacturing / بەرهەمهێنان  `section:manufacturing`

| Route | English | کوردی |
|---|---|---|
| `/manufacturing/boms` | Boms | Boms |
| `/manufacturing/orders` | Manufacturing Orders | Manufacturing Orders |
| `/manufacturing/work-centers` | Work Centers | ناوەندەکانی کار |


#### Point of Sale / خاڵی فرۆشتن  `section:pos`

| Route | English | کوردی |
|---|---|---|
| `/pos` | Terminal | تێرمیناڵ |
| `/pos/sessions` | Sessions | دانیشتنەکان |
| `/pos/orders` | Orders | فرۆشتنەکان |
| `/pos/configs` | Configs | کۆنفیگەکان |
| `/pos/categories` | Categories | پۆلەکان |
| `/pos/products` | Products | Products |
| `/pos/pricelists` | Price Lists | لیستەکانی نرخ |
| `/pos/employees` | Employees | کارمەندەکان |
| `/pos/loyalty` | Loyalty | Loyalty |
| `/pos/gift-cards` | Gift cards | کارتی دیاری |
| `/pos/floors` | Floors & Tables | Floors |
| `/pos/reports` | POS Reports | Pos Reports |


#### Hotel / Hotel  `section:hotel`

| Route | English | کوردی |
|---|---|---|
| `/hotel` | Dashboard | داشبۆرد |
| `/hotel/rooms` | Rooms Bookings | Rooms Bookings |


#### Restaurant / Restaurant  `section:restaurant`

| Route | English | کوردی |
|---|---|---|
| `/restaurant/tables` | Tables | مێزەکان |
| `/restaurant/kds` | Kitchen Display | نیشاندانی چێشتخانە |
| `/restaurant/menu` | Menu Manager | Menu Manager |


#### Iraq / عێراق  `section:field-service`

| Route | English | کوردی |
|---|---|---|
| `/field-service` | Dashboard | داشبۆرد |
| `/field-service/orders` | Service Orders | Service Orders |
| `/field-service/technicians` | Technicians | Technicians |
| `/field-service/dispatch` | Dispatch Board | Dispatch Board |


#### Extended Operations / کارگێڕی دەرەکی  `section:ext-ops`

| Route | English | کوردی |
|---|---|---|
| `/quality` | Quality | کوالیتی |
| `/quality/plans` | Qc Plans | Qc Plans |
| `/quality/checks` | Qc Checks | Qc Checks |
| `/quality/ncr` | Non Conformances | Non Conformances |
| `/quality/capa` | Capa | Capa |
| `/wave-a/quality` | Quality | کوالیتی |
| `/maintenance` | Maintenance | چاکردنەوە |
| `/maintenance/equipment` | Equipment | Equipment |
| `/maintenance/requests` | Requests | Requests |
| `/maintenance/schedules` | Schedules | Schedules |
| `/maintenance/categories` | Categories | Equipment Categories |
| `/wave-a/plm` | Product Lifecycle Management | بەڕێوەبردنی چەرخی ژیانی بەرهەم |


#### Rental / Rental  `section:rental`

| Route | English | کوردی |
|---|---|---|
| `/rental/products` | Rental Products | Rental Products |
| `/rental/contracts` | Rental Contracts | Rental Contracts |


#### Repairs / چاکردنەوەکان  `section:repairs`

| Route | English | کوردی |
|---|---|---|
| `/repairs/orders` | Repair Orders | Repair Orders |
| `/repairs/warranty-check` | Warranty Check | Warranty Check |


#### Vertical Markets / بازاڕی تایبەت  `section:ext-vertical`

| Route | English | کوردی |
|---|---|---|
| `/healthcare` | Healthcare | Clinic Dashboard |
| `/healthcare/patients` | Patients | Patients |
| `/healthcare/appointments` | Appointments | Appointments |
| `/hospital/wards` | Hospital Wards | Wards Admissions |
| `/pharmacy/dispense` | Pharmacy | Dispense |
| `/ext/construction` | Construction | بیناسازی |
| `/ext/real-estate` | Real Estate | خانووبەرە |
| `/ext/education` | Education | پەروەردە |
| `/ext/logistics` | Logistics | لۆجستیک |
| `/ext/agriculture` | Agriculture | کشتوکاڵ |
| `/ext/ngo` | NGO | ڕێکخراوی نادەوڵەتی |
| `/ext/government` | Government | حکومەت |


### زۆن / Zone: People — خەڵک


#### CRM / بەڕێوەبردنی پەیوەندی کڕیار  `section:crm`

| Route | English | کوردی |
|---|---|---|
| `/crm/leads` | Leads | لیدەکان |
| `/crm/pipeline` | Pipeline | پایپلاین |
| `/crm/activities` | Activities | چالاکیەکان |
| `/crm/insights` | Insights | Insights |


#### Marketing / بازاڕگەری  `section:marketing`

| Route | English | کوردی |
|---|---|---|
| `/marketing` | Marketing dashboard | داشبۆردی بازاڕگەری |
| `/marketing/campaigns/email` | Email campaigns | هەڵمەتی ئیمەیڵ |
| `/marketing/campaigns/sms` | SMS campaigns | هەڵمەتی کورتەنامە |
| `/marketing/segments` | Segments | بەشەکانی کڕیار |
| `/marketing/automations` | Automations | ئۆتۆماتیکردنەکان |


#### Human Resources / سەرچاوەی مرۆڤی  `section:hr`

| Route | English | کوردی |
|---|---|---|
| `/hr` | Hr Dashboard | Hr Dashboard |
| `/hr/employees` | Employees | کارمەندەکان |
| `/hr/contracts` | Contracts | Contracts |
| `/hr/attendance` | Attendance | ئامادەبوون |
| `/hr/time-off` | Time Off | Time Off |
| `/payroll/rules` | Salary Rules | یاساکانی مووچە |
| `/payroll/runs` | Payroll Runs | جێبەجێکردنی مووچە |
| `/mileage` | Mileage Log | Mileage Log |
| `/mileage/rates` | Rates Title | Rates Title |


#### Projects / پرۆژەکان  `section:projects`

| Route | English | کوردی |
|---|---|---|
| `/projects` | Projects | پرۆژەکان |
| `/assets` | Fixed Assets | سامانە جێگیرەکان |


#### Engagement & Service / Ext Engagement  `section:ext-engagement`

| Route | English | کوردی |
|---|---|---|
| `/activities/my` | My Activities | My Activities |
| `/activities` | Dashboard | داشبۆرد |
| `/helpdesk` | Dashboard | داشبۆرد |
| `/helpdesk/tickets` | Tickets | Tickets |
| `/helpdesk/settings` | Settings | ڕێکخستنەکان |
| `/kb` | Knowledge Base | Knowledge Base |
| `/subscriptions` | Subscriptions | بەشداریکردنەکان |
| `/subscriptions/plans` | Subscription Plans | پلانەکانی بەشداری |
| `/subscriptions/dunning` | Dunning Queue | ڕیزی داواکردنی پارە |
| `/subscriptions/reports` | MRR Reports | ڕاپۆرتی داهاتی مانگانە |
| `/wave-a/documents` | External Documents | بەڵگەنامەی دەرەکی |
| `/dms` | Document Vault | Vault |
| `/dms/signatures` | Signatures | Signatures |
| `/wave-a/knowledge` | External Knowledge Base | بنکەی زانیاری دەرەکی |
| `/ext/livechat` | Live Chat | Mod Livechat |
| `/ext/social` | Social | Mod Social |
| `/ext/comms` | SMS & VoIP | Mod Comms |
| `/ext/engagement` | Events & Surveys | Mod Engagement |
| `/ext/elearning` | eLearning | Mod Elearning |
| `/wave-a/hr-extended` | External HR | سەرچاوەی مرۆڤی دەرەکی |


### زۆن / Zone: Finance & Control — دارایی و کۆنترۆڵ


#### Banking / بانکداری  `section:banking`

| Route | English | کوردی |
|---|---|---|
| `/banking` | Accounts | ژمارەکان |
| `/banking/rules` | Bank Rules | Bank Rules |
| `/banking/reconciliation` | Reconciliation | لەکاتەوەکردن |


#### Accounting / ژمێریاری  `section:accounting`

| Route | English | کوردی |
|---|---|---|
| `/accounts` | Accounts | ژمارەکان |
| `/journals` | Journals | ژوورناڵەکان |
| `/reports` | Reports | ڕاپۆرتەکان |
| `/reports/advanced` | Advanced Reports | Advanced Reports |
| `/reports/scheduled` | Iraq | عێراق |
| `/reports/custom-list` | Custom Reports | List Title |
| `/tax-settings` | Tax Settings | ڕێکخستنی باج |
| `/tax-returns` | Tax Returns | گەڕانەوەی باج |


#### Management / Management  `section:reports-mgt`

| Route | English | کوردی |
|---|---|---|
| `/companies` | Companies | کۆمپانیاکان |
| `/branches` | Branches | لقەکان |
| `/reports/branches` | Branch Comparison | Branch Comparison |
| `/reports/consolidated` | Consolidated Reports | Consolidated Reports |
| `/approvals` | Approvals | پەسەندکردنەکان |
| `/audit-log` | Audit Log | تۆماری چاودێری |


#### Multi-Entity / Multi Entity  `section:multi-entity`

| Route | English | کوردی |
|---|---|---|
| `/multi-entity/companies` | Companies | Companies |
| `/multi-entity/intercompany` | Ic Transactions | Ic Transactions |
| `/multi-entity/consolidated-pl` | Consolidated Pl | Consolidated Pl |
| `/multi-entity/consolidated-bs` | Consolidated Bs | Consolidated Bs |
| `/multi-entity/eliminations` | Eliminations Workbench | Eliminations Workbench |


#### Iraq Localization / Iraq Localization  `section:iraq-int`

| Route | English | کوردی |
|---|---|---|
| `/l10n-iq` | Iraq Localization | Iraq Localization |
| `/einvoice/dashboard` | Einvoice Dashboard | Einvoice Dashboard |
| `/whatsapp` | Whatsapp | Whatsapp |
| `/ocr/receipts` | Ocr Receipts | Ocr Receipts |


#### Extended Platform / پلاتفۆرمی دەرەکی  `section:ext-platform`

| Route | English | کوردی |
|---|---|---|
| `/ext/studio` | Studio | ستودیۆ |
| `/ext/rental` | Rental | کرێ |
| `/ai` | Dashboard Title | Dashboard Title |
| `/ai/anomalies` | Anomalies Title | Anomalies Title |
| `/ai/suggestions` | Suggestions Title | Suggestions Title |
| `/ai/ocr` | Ocr Advanced Title | Ocr Advanced Title |
| `/ai/predictions` | Predictions Title | Predictions Title |
| `/ext/mobile` | Mobile | مۆبایل |
| `/ext/iot` | Internet of Things | ئینتەرنێتی شتەکان |


#### Setup / دامەزراندن  `section:setup`

| Route | English | کوردی |
|---|---|---|
| `/custom-fields` | Custom Fields | خانە تایبەتەکان |
| `/users` | Users | بەکارهێنەران |
| `/rbac-roles` | Roles Permissions | Roles Permissions |
| `/user-roles` | User Roles | User Roles |
| `/settings` | Settings | ڕێکخستنەکان |
| `/settings/numbering` | Numbering sequences | زنجیرەی ژمارەدانان |
| `/automation-rules` | Automation | ئۆتۆماتیکردن |
| `/audit-log-viewer` | Audit Log | تۆماری چاودێری |
| `/admin/job-runs` | Job Scheduler | خشتەی کارەکان |
| `/studio` | Iraq | عێراق |
| `/onboarding` | Wizard Title | Wizard Title |
| `/docs` | Docs Hub | سەنتەری بەڵگەنامەکان |
| `/ui-gallery` | UI Gallery | گاڵەری ڕووکار |
| `/trash` | Trash | Trash |

## ٥. تۆمارخانەی مۆدیوولی ext / Extended-Module Registry (`/ext/<slug>`)

٣٢ مۆدیوولی زیادکراو لە `pages/modules/moduleConfigs.ts` تۆمارکراون. هەر مۆدیوولێک چەند ڕیسۆرسێکی (تاب) هەیە و هەر ڕیسۆرسێک فۆڕمی Add-ی خۆی. هەموویان لە ڕێگەی یەک Hub-ی گشتیەوە ڕێندەر دەکرێن. (32 config-driven modules; each tab = a resource with its own Add form.)

| Slug | Group | کوردی Title | API base | Resources (tabs) |
|---|---|---|---|---|
| `livechat` | engagement | گفتوگۆی زیندوو | `/api/livechat` | کەناڵەکان (channels), گفتوگۆکان (conversations), بۆتەکان (bots), فلۆکان (flows), وەڵامە ئامادەکان (canned) |
| `social` | engagement | سۆشیال میدیا | `/api/social` | هەژمارەکان (accounts), پۆستەکان (posts), بەشداربوون (engagements), ناولێبردنەکان (mentions) |
| `comms` | engagement | SMS و VoIP | `/api/comms` | تێمپلەیتی SMS (sms-templates), SMSـەکان (sms), کامپەینەکان (sms-campaigns), پەیوەندیەکان (calls), ڕیزەکان (queues) |
| `engagement` | engagement | بۆنە و راپرسی و ژوانەکان | `/api/engagement` | بۆنەکان (events), تۆمارکردن (registrations), پشتیوانان (sponsors), گفتوگۆکان (sessions), راپرسیەکان (surveys), پرسیارەکان (questions), ڕۆژژمێرەکان (calendars), کاتە بەردەستەکان (slots), ژوانەکان (bookings) |
| `elearning` | engagement | فێرکاری ئۆنلاین | `/api/elearning` | کۆرسەکان (courses), وانەکان (lessons), تاقیکردنەوە (quizzes), تۆمارکردن (enrollments), بڕوانامە (certificates) |
| `rental` | platform | کرێ و ئاژاوە | `/api/rental` | بەرهەمەکان (products), گرێبەستەکان (contracts), وەرگرتنەکان (pickups), گەڕاندنەوە (returns), زیانەکان (damages) |
| `ai` | platform | تایبەتمەندی AI | `/api/ai` | مۆدێلەکان (models), پێشبینی (forecasts), نائاسایی (anomalies), پێشنیارەکان (recommendations), OCR (ocr) |
| `mobile` | platform | مۆبایل API | `/api/mobile` | تۆکنەکان (tokens), سێشنەکان (sessions), ئاگاداری (push) |
| `iot` | platform | IoT | `/api/iot` | ئامێرەکان (devices), خوێندنەوە (readings), ئاگادارکردنەوە (alerts), ڕێسەکان (rules) |
| `healthcare` | vertical | تەندروستی | `/api/healthcare` | نەخۆشەکان (patients), ژوانەکان (appointments), ڕەچەتەکان (prescriptions), تۆمارەکان (records), بیمەکان (insurances), ئەنجامی تاقیگە (lab-results), سەڕووکارەکان (vitals) |
| `hospital` | vertical | نەخۆشخانە | `/api/hospital` | بەشەکان (wards), جێگاکان (beds), پزیشکەکان (doctors), وەرگرتن (admissions), فەرمانی تاقیگە (lab-orders), فەرمانی تیشک (radiology-orders), نەشتەرگەری (surgeries) |
| `pharmacy` | vertical | دەرمانخانە | `/api/pharmacy` | دەرمانەکان (drugs), بەستەکان (batches), دابەشکردن (dispenses), کارلێک (interactions) |
| `hotel` | vertical | هۆتێل | `/api/hotel` | جۆری ژوور (room-types), ژوورەکان (rooms), میوانەکان (guests), حیجزکردن (reservations), خاوێنکردنەوە (housekeeping), فۆلیۆ (folios) |
| `restaurant` | vertical | چێشتخانە | `/api/restaurant` | مێنیوەکان (menus), بڕگەکان (menu-items), مێزەکان (tables), داواکارییەکان (orders), KDS (kds), گەیاندن (delivery-orders) |
| `construction` | vertical | بنیاتنان | `/api/construction` | پڕۆژەکان (projects), شوێنەکان (sites), WBS (wbs), فاکتوری پێشکەوتن (progress-billings), تێچوو (job-costs), ئامێرەکان (equipment), سەرپەرشتیار (subcontractors) |
| `real-estate` | vertical | موڵک | `/api/real-estate` | موڵکەکان (properties), یەکەکان (units), کرێچی (tenants), گرێبەستی کرێ (leases), فاکتوری کرێ (rent-invoices), داواکاری چاکسازی (maint-requests) |
| `education` | vertical | پەروەردە | `/api/education` | قوتابیەکان (students), مامۆستاکان (teachers), کۆرسەکان (courses), پۆلەکان (classes), تۆمار (enrollments), ئامادەبوون (attendance), نمرەکان (grades), کرێکان (fees), پارەدان (fee-payments) |
| `logistics` | vertical | لۆجستی | `/api/logistics` | گەیاندنەکان (shipments), ڕێگاکان (routes), شۆفێرەکان (drivers), ئۆتۆمبیلەکان (vehicles), GPS (gps), نرخی بار (freight-rates) |
| `agriculture` | vertical | کشتوکاڵ | `/api/agriculture` | کێڵگەکان (fields), بەرهەمە کشتوکاڵیەکان (crops), چاندن (plantings), دروێنە (harvests), ئاژەڵ (livestock), ئاودان (irrigation), پەینکردن (fertilization) |
| `ngo` | vertical | ڕێکخراو ناحکومی | `/api/ngo` | بەخشەرەکان (donors), بەخشینەکان (donations), کامپەینەکان (campaigns), گرانتەکان (grants), سندوقەکان (funds), سوودمەندەکان (beneficiaries), خۆبەخشەکان (volunteers) |
| `government` | vertical | حکومی | `/api/government` | هاوڵاتیان (citizens), خزمەتگوزاریەکان (services), داواکاریەکان (service-requests), مۆڵەتەکان (permits), سەنجەی باج (tax-assessments), مەزایدەکان (tenders), پێشنیارەکان (tender-bids) |
| `helpdesk` | engagement | یارمەتیدان (Helpdesk) | `/api/helpdesk` | تیمەکان (teams), پۆلەکان (categories), تاگەکان (tags), سیاسەتی SLA (sla-policies), بلیتەکان (tickets), وەڵامە ئامادەکان (canned) |
| `field-service` | engagement | خزمەتگوزاری مەیدانی | `/api/field-service` | کرێکاران (workers), جۆری خزمەت (service-types), داواکاریەکان (orders), ناردنەکان (dispatches), ڕێگاکان (routes), پارچەکان (parts), واژۆکان (signatures) |
| `subscriptions` | engagement | بەشدارییەکان | `/api/subscriptions` | پلانەکان (plans), زیادکراوەکان (addons), کۆپۆنەکان (coupons), فاکتورەکان (invoices) |
| `documents` | engagement | دۆکیومێنتەکان | `/api/documents` | بوخچەکان (folders), فایلەکان (files), هاوبەشکردنەکان (shares), داواکاری واژۆ (sign-requests), فلۆکان (workflows) |
| `knowledge` | engagement | زانیاری (Wiki) | `/api/knowledge` | پۆلەکان (categories), وتارەکان (articles), کۆمێنتەکان (comments) |
| `quality` | vertical | کوالێتی | `/api/quality` | تیمەکان (teams), خاڵە چاودێریەکان (points), هۆکارەکان (reasons), چاودێریەکان (checks), ئاگاداریەکان (alerts), نا-ڕێکوپێکی (non-conformities), CAPA (capa) |
| `maintenance` | vertical | چاککردنەوە | `/api/maintenance` | پۆلەکان (categories), ئامێرەکان (equipment), داواکاریەکان (requests), پلانەکان (schedules), تۆمارەکان (logs) |
| `plm` | vertical | PLM | `/api/plm` | وەرسیۆنەکان (versions), ECOـەکان (ecos), قۆناغەکان (stages), BOMـەکان (boms), هاوپێچەکان (attachments) |
| `repairs` | vertical | چاککردنەوەکان | `/api/repairs` | داواکاریەکان (orders), پارچەکان (parts), گەرەنتیەکان (warranties) |
| `hr-extended` | engagement | HR زیادکراو (دامەزراندن + هەڵسەنگاندن) | `/api/hr-extended` | پێشنیارکراوان (candidates), داواکاریەکان (applications), وتووێژەکان (interviews), سووڕەکان (cycles), هەڵسەنگاندنەکان (appraisals), ئامانجەکان (goals), فیدباک (feedbacks), شارەزاییەکان (employee-skills) |
| `studio` | platform | ستۆدیۆ (No-code) | `/api/studio` | مۆدێلەکان (models), فیلدەکان (fields), ڕوانگەکان (views), مێنوەکان (menus), فلۆکان (workflows), تۆمارەکان (records), ڕاپۆرتەکان (reports) |

## ٦. سیستەمی ڕێکخستن / Settings — Information Architecture

ڕێکخستنەکان لە ١٢ گرووپدا ڕێکخراون و ٥٩ بەشیان تێدایە. هەر بەشێک تیرێکی دەسەڵاتی هەیە (personal=کەسی، org_read=خوێندنەوەی ڕێکخراو، org_write=نووسینی ڕێکخراو، platform_only=تەنها پلاتفۆرم) و هەندێکیان بە مۆدیوول گەیتکراون (moduleGate). (Settings: 12 groups, 59 sections, gated by role tier + enabled module.)


### Account (Personal) / هەژمار (کەسی)  `group:account`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `profile` | Profile | پرۆفایل | personal | — | `-` |
| `security` | Security Settings | ڕێکخستنی ئەمنیەت | personal | — | `-` |
| `notifications` | Notifications | Notification Preferences | personal | — | `-` |
| `preferences` | Preferences | Settings Pref | personal | — | `-` |


### General / گشتی  `group:general_app`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `general` | General | گشتی | org_write | — | `settings.update` |
| `appearance` | Appearance | ڕووکار | org_write | — | `settings.update` |


### Organization / ڕێکخراو  `group:organization`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `organization` | Organization | Organization Settings | org_write | — | `org.manage` |
| `branches` | Branches | لقەکان | org_write | — | `settings.update` |
| `branding` | Branding | Branding | org_write | — | `settings.update` |
| `working_hours` | Working Hours | کاتژمێرەکانی کار | org_write | — | `settings.update` |
| `holidays` | Holidays | پیرۆزگاکان | org_write | — | `settings.update` |


### Users & Access / بەکارهێنەر و دەستڕاگەیشتن  `group:users`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `users` | Users | بەکارهێنەران | org_write | — | `rbac.manage` |
| `roles` | Roles | ڕۆڵەکان | org_write | — | `rbac.manage` |
| `permissions` | Permissions | دەسەڵاتەکان | org_write | — | `rbac.manage` |
| `sso` | SSO | SSO | org_write | — | `settings.update` |
| `portals` | Portals | پۆرتاڵەکان | org_write | — | `settings.update` |


### Localization / ناوخۆیی کردن  `group:localization`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `localization` | Iraq Localization | ناوچەگەریی عێراق | org_write | — | `settings.update` |
| `currencies` | Currencies | دراوەکان | org_write | accounting | `settings.update` |
| `languages` | Languages | Languages | org_write | — | `settings.update` |
| `formats` | Date & number formats | Formats | org_write | — | `settings.update` |


### Finance & Compliance / دارایی و پابەندبوون  `group:finance`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `fiscal` | Fiscal Years | ساڵانی دارایی | org_write | accounting | `settings.fiscal` |
| `budgets` | Budgets | بودجەکان | org_write | accounting | `accounts.budget` |
| `taxes` | Taxes | باجەکان | org_write | accounting | `taxes.update` |
| `banking` | Banking Settings | ڕێکخستنی بانکداری | org_write | banking | `bank.write` |
| `payment_methods` | Payment Methods | ڕێگاکانی پارەدان | org_write | sales,pos | `settings.update` |
| `einvoice` | E-invoice settings | ڕێکخستنی فاکتوری ئەلیکترۆنی | org_write | einvoice | `settings.update` |
| `templates` | Invoice templates | Invoice Templates | org_write | sales | `settings.update` |
| `reminders` | Reminder settings | Reminder Settings | org_write | sales | `settings.update` |


### Commerce / بازرگانی  `group:commerce`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `sales` | Sales Settings | ڕێکخستنی فرۆشتن | org_write | sales | `settings.update` |
| `crm` | CRM Settings | ڕێکخستنی CRM | org_write | crm | `settings.update` |
| `purchases` | Purchases Settings | ڕێکخستنی کڕین | org_write | purchase | `settings.update` |
| `inventory` | Inventory Settings | ڕێکخستنی کۆگا | org_write | inventory | `settings.update` |
| `mrp` | Manufacturing | Mrp Settings | org_write | manufacturing | `settings.update` |
| `pos` | POS Settings | ڕێکخستنی POS | org_write | pos | `settings.update` |
| `ecommerce` | E-commerce | Ecommerce Settings | org_write | ext.subscriptions | `settings.update` |
| `helpdesk` | Helpdesk | Helpdesk Settings | org_write | ext.helpdesk | `settings.update` |


### Operations / کارگێڕی  `group:operations`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `hr` | HR Settings | ڕێکخستنی سەرچاوەی مرۆڤی | org_write | hr | `settings.update` |
| `payroll` | Payroll Settings | ڕێکخستنی مووچە | org_write | hr | `settings.update` |
| `projects` | Projects Settings | ڕێکخستنی پرۆژەکان | org_write | projects | `settings.update` |
| `marketing` | Marketing | Marketing Settings | org_write | crm,sales | `settings.update` |


### Automation & Integrations / ئۆتۆماتیک و یەکخستن  `group:automation`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `workflows` | Workflows | بەڕێوەبردنی کار | org_write | sales,crm,purchase,inventory,manufacturing,pos,hr,projects | `settings.update` |
| `approvals` | Approvals | پەسەندکردنەکان | org_write | sales,purchase,hr | `settings.update` |
| `integrations` | Integrations | یەکگرتنەوەکان | org_write | — | `settings.update` |
| `webhooks` | Webhooks | وێبهووکەکان | org_write | — | `settings.update` |
| `api_tokens` | API Tokens | تۆکەنەکانی API | org_write | — | `settings.update` |


### Content & Messaging / ناوەڕۆک و پەیام  `group:content`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `documents` | Documents | بەڵگەنامەکان | org_write | ext.documents | `settings.update` |
| `numbering` | Numbering | Numbering Sequences | org_write | sales,purchase,inventory,hr | `settings.numbering` |
| `email` | Email | Email Settings | org_write | — | `settings.update` |
| `sms_whatsapp` | SMS & WhatsApp | Sms Whatsapp | org_write | whatsapp,ext.comms | `settings.update` |


### System / سیستەم  `group:system`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `integrations_health` | Integration health | تەندروستی یەکگرتنەوەکان | org_read | — | `settings.read` |
| `modules` | Modules | Modules | personal | — | `-` |
| `module_requests` | Module requests | Modreq Page Title | org_write | — | `settings.update` |
| `backup` | Backup | Backup Settings | org_write | — | `settings.update` |
| `activity` | System Log | تۆمارنامەی سیستەم | org_read | — | `settings.read` |
| `audit` | Audit & compliance | Audit Compliance | org_write | — | `settings.update` |
| `gdpr` | Data privacy | Gdpr | org_write | — | `settings.update` |
| `mobile` | Mobile app | Mobile App | org_write | ext.mobile | `settings.update` |
| `system` | System Info | زانیاری سیستەم | personal | — | `-` |


### Platform-only / تەنها پلاتفۆرم  `group:platform`

| Section key | English | کوردی | Tier | Module gate | Permission |
|---|---|---|---|---|---|
| `feature_flags` | Feature flags | فلاگەکانی فیچەر | platform_only | — | `platform.admin` |


---

## بەشی وردەکاریی پەڕەکان / Page-by-page detail (Parts 7–13)

هەر پەڕەیەک بە: جۆر، تاب، KPI، فلتەر، ستوونی خشتە، دوگمەکان، دیالۆگ/درۆوەر، و فۆرم/فیلدەکانی. Each page below lists its type, tabs, KPIs, filters, table columns, buttons, dialogs/drawers, and form fields.


## ٧. فرۆشتن · کڕین · بانک · پەیوەندی · کاڵا / Sales · Purchases · Banking · Contacts · Items


Structural inventory of 33 frontend pages for a Kurdish (Sorani) ERP (Zoho-One-style, RTL, antd v6 + React 19). Base path: `frontend/src/pages/`.

Cross-cutting notes:
- Most list pages share `ResponsiveTableAdapter` (or `ResponsiveTable`), `ExportMenu` (CSV), `ColumnVisibility` (with per-page `localStorage` persistence of hidden columns), and `FormDialog` for create/edit modals. Currency commonly hardcoded to `IQD`/`د.ع`.
- Several list pages wire `useAddGate(...)` (Selective Add) which controls an `EmptyState` CTA + mandatory mode.
- Bilingual labels: where `t('key','English')` has a 2nd arg, both key and English fallback are recorded. Where only `t('key')` exists, the i18n key is recorded (no inline English in source).

---

### `/invoices` — Invoices / فاکتور (`t('invoices')`)
- **File**: `pages/Invoices.tsx`
- **Type**: list
- **Purpose**: Track invoices, balances, and customer payments; e-invoice + retainer actions.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Status `Select` (`t('status')`) — options: Draft (`draft`), Sent (`sent`), Paid (`paid`), Overdue (`overdue`)
- **Table columns**: `#` (invoice_number); Date (`date`); Due date (`due_date`); Total (`total`); Balance due (`balance_due`); Status (`status`, StatusTag + optional purple `retainerInvoice` / cyan `progressInvoice` tags); Actions (`actions`, fixed right)
- **Header / primary actions (buttons)**: ExportButton (endpoint `/api/export/invoices`); Retainer invoice (`t('retainerInvoice')`, DollarOutlined); New invoice (`t('new_invoice')`, primary, PlusOutlined → `/invoices/new`)
- **Bulk / row actions**: Row toolbar: Send (`t('send')`, SendOutlined, draft only). "More" Dropdown (MoreOutlined, `t('more','More')`) menu items: Apply to invoice (`applyToInvoice`, WalletOutlined — non-retainer & not paid/void); E-invoice submit (`einvoice_submit`, CloudUploadOutlined); E-invoice status (`einvoice_status`, InfoCircleOutlined); QR code (`qr_code`, QrcodeOutlined); PDF (FilePdfOutlined); Send email (`send_email`, MailOutlined); Send reminder (`send_reminder`, BellOutlined, danger, overdue only). Row click opens Chatter drawer.
- **Dialogs / Modals / Drawers**:
  - Retainer invoice (FormDialog; trigger = "Retainer invoice" button) — fields: Amount (`amount`, InputNumber, required); Customer (`contact_id`, Select, required). Buttons Save/Cancel.
  - Apply retainer (FormDialog; trigger = row "Apply to invoice") — fields: Retainer invoice (`retainer_invoice_id`, Select, required); Amount (`amount`, InputNumber, required). Buttons Confirm/Cancel.
  - Send email (FormDialog; trigger = row "Send email") — fields: To email (`to_email`,'To email', Input, required+email); Subject (`subject`,'Subject', Input); Message (`message`,'Message', TextArea). Buttons Send/Cancel.
  - E-invoice result (FormDialog; trigger = submit/status/qr actions) — read-only: optional QR `<img>`, Fiscal ID (`fiscal_id`), Status, Provider UUID (`provider_uuid`), Error (`error_message`), Payload (`einvoice_payload`).
  - Chatter (FormDialog; trigger = row click) — renders `<ChatterPanel entityType="invoice">`.
- **Standalone forms & fields**: none (create lives in InvoiceForm route)
- **Empty / loading / error states**: Table loading flag; EmptyState via AddGate (`addGate.section.invoices.title/description/cta`, InboxOutlined, mandatory-aware, CTA → `/invoices/new`).
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, StatusTag, ColumnVisibility, ExportMenu, ExportButton, ChatterPanel, EmptyState, useAddGate, Dropdown.

---

### `/invoices/new` — Invoice Form / فۆرمی فاکتور
- **File**: `pages/InvoiceForm.tsx`
- **Type**: form
- **Purpose**: Create an invoice with line items.
- **Tabs / segments**: FormLayout sections — Customer (`customer`); Items (`items`); Notes (`notes`); Chatter (`chatter.activities`, only when editing `id` present)
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: line-item editor (per-line): Items (`SelectWithQuickCreate entity="item"`); Description (Input); Quantity (InputNumber); Unit price (`unit_price`, InputNumber); Discount % (`discount`, InputNumber); Total (computed); delete button. Live total shown.
- **Header / primary actions (buttons)**: FormLayout footer Save / Cancel (→ `/invoices`); Add line (`add_line`, dashed, PlusOutlined)
- **Bulk / row actions**: per-line delete (DeleteOutlined, danger)
- **Dialogs / Modals / Drawers**: none (quick-create via SelectWithQuickCreate)
- **Standalone forms & fields**:
  - Customer (`contact_id`, SelectWithQuickCreate entity="customer", required)
  - Date (`date`, DatePicker, required)
  - Due date (`due_date`, DatePicker, required)
  - Reference (`reference`, Input)
  - Notes (`notes`, TextArea)
  - Line items as above
- **Empty / loading / error states**: saving/saved/isDirty states via FormLayout.
- **Notable components used**: FormLayout, ResponsiveForm.LineItem, SelectWithQuickCreate, ChatterWidget.

---

### `/recurring-invoices` — Recurring Invoices / فاکتوری دووبارەبووەوە (`t('new_recurring_invoice')`)
- **File**: `pages/RecurringInvoices.tsx`
- **Type**: list (+ create modal)
- **Purpose**: Manage recurring invoice schedules.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Customer (`customer`, contact_id mapped to name); Frequency (`frequency`, translated); Next date (`next_date`/next_invoice_date); Total (`total`); Status (`status`, Tag: active=green/paused=orange/expired=grey); Actions (`actions`)
- **Header / primary actions (buttons)**: ExportMenu (CSV); ColumnVisibility; New recurring invoice (`t('new_recurring_invoice')`, primary, PlusOutlined)
- **Bulk / row actions**: Dropdown (MoreOutlined): Pause (`pause`, active); Generate invoice (`generate_invoice`, active); Resume (`resume`, paused); Delete (`delete`, danger)
- **Dialogs / Modals / Drawers**:
  - New recurring invoice (FormDialog, hideFooter) — fields: Customer (`contact_id`, SelectWithQuickCreate customer, required); Frequency (`frequency`, Select: daily/weekly/monthly/quarterly/yearly, required); Start date (`start_date`, DatePicker, required); End date (`end_date`, DatePicker); Payment terms days (`payment_terms_days`, InputNumber); line items table (Items SelectWithQuickCreate, Description, Quantity, Unit price, Discount %, Total, delete); Notes (`notes`, TextArea). Buttons Save/Cancel. Add line (`add_line`).
- **Standalone forms & fields**: none beyond modal
- **Empty / loading / error states**: table loading.
- **Notable components used**: ResponsiveTableAdapter, FormDialog, SelectWithQuickCreate, ColumnVisibility, ExportMenu, Dropdown, raw HTML `<table>` for line items.

---

### `/quotes` — Quotes / نرخنامە (`t('quotes')`)
- **File**: `pages/Quotes.tsx`
- **Type**: list
- **Purpose**: Quotes for customers.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Status `Select` (`t('status')`) — options: draft, sent, accepted, declined, invoiced
- **Table columns**: `#` (quote_number); Date (`date`); Expiry date (`expiry_date`); Total (`total`); Status (`status`, StatusTag); Actions (`actions`)
- **Header / primary actions (buttons)**: New quote (`t('new_quote')`, primary large, PlusOutlined → `/quotes/new`); ExportMenu (CSV); ColumnVisibility
- **Bulk / row actions**: Dropdown (MoreOutlined, small): Send (`send`, draft); Accept (`accept`, sent); Decline (`decline`, sent); Convert to invoice (`convert_to_invoice`, draft/sent/accepted); Convert to sales order (`convert_to_sales_order`); PDF (FilePdfOutlined)
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none (create in QuoteForm)
- **Empty / loading / error states**: table loading; AddGate wired (`sales.quotes`) though no explicit EmptyState locale here.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, StatusTag, ColumnVisibility, ExportMenu, useAddGate, Dropdown.

---

### `/quotes/new` — Quote Form / فۆرمی نرخنامە
- **File**: `pages/QuoteForm.tsx`
- **Type**: form
- **Purpose**: Create a quote with line items.
- **Tabs / segments**: FormLayout sections — Customer; Items; Notes; Chatter (when editing)
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: line-item editor: Items (SelectWithQuickCreate item); Description (Input); Quantity; Unit price; Discount %; Total (computed); delete. Live total.
- **Header / primary actions (buttons)**: FormLayout Save/Cancel (→ `/quotes`); Add line (`add_line`, dashed)
- **Bulk / row actions**: per-line delete (danger)
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**:
  - Customer (`contact_id`, SelectWithQuickCreate customer, required)
  - Date (`date`, DatePicker, required)
  - Expiry date (`expiry_date`, DatePicker, required)
  - Reference (`reference`, Input)
  - Notes (`notes`, TextArea)
- **Empty / loading / error states**: FormLayout saving/saved/dirty.
- **Notable components used**: FormLayout, ResponsiveForm.LineItem, SelectWithQuickCreate, ChatterWidget.

---

### `/sales-orders` — Sales Orders / داواکاری فرۆشتن (`t('new_sales_order')`)
- **File**: `pages/SalesOrders.tsx`
- **Type**: list (+ create modal + view modal)
- **Purpose**: Manage sales orders; convert to invoice.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: `#` (order_number); Date (`date`); Total (`total`); Status (`status`, Tag: draft/confirmed=blue/invoiced=purple/void=red); Actions (`actions`)
- **Header / primary actions (buttons)**: ExportMenu (CSV); ColumnVisibility; New sales order (`t('new_sales_order')`, primary, PlusOutlined)
- **Bulk / row actions**: Dropdown (MoreOutlined): View (`view`); Confirm (`confirm`, draft); Convert to invoice (`convert_to_invoice`, draft/confirmed); Void (`void`, not void)
- **Dialogs / Modals / Drawers**:
  - New sales order (FormDialog, hideFooter) — fields: Customer (`contact_id`, SelectWithQuickCreate customer, required); Date (required); Expected shipment (`expected_shipment_date`, DatePicker); Reference (Input); line items table (Items, Description, Quantity, Unit price, Discount %, Total, delete); Notes (TextArea). Save/Cancel. Add line.
  - View order (FormDialog, hideFooter; trigger = "View") — Descriptions: Date, Status (Tag), Total; plus `<ChatterWidget entityType="sales_order">`.
- **Standalone forms & fields**: none beyond modals
- **Empty / loading / error states**: table loading; AddGate (`sales.sales_orders`).
- **Notable components used**: ResponsiveTableAdapter, FormDialog, Descriptions, ChatterWidget, SelectWithQuickCreate, ColumnVisibility, ExportMenu, useAddGate, raw `<table>`.

---

### `/credit-notes` — Credit Notes / یاداشتی قەرز (`t('new_credit_note')`)
- **File**: `pages/CreditNotes.tsx`
- **Type**: list (+ create modal + apply modal w/ tabs)
- **Purpose**: Customer credit notes; apply to invoices.
- **Tabs / segments**: Apply modal has Tabs — Apply to invoice (`applyToInvoice`); Applied invoices (`applied_invoices`)
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: `#` (credit_note_number); Date (`date`); Total (`total`); Credit balance (`creditBalance`/balance); Status (`status`, Tag: draft/approved=green/void=red); Actions (`actions`)
- **Header / primary actions (buttons)**: ExportMenu (CSV); ColumnVisibility; New credit note (`t('new_credit_note')`, primary, PlusOutlined)
- **Bulk / row actions**: Dropdown (MoreOutlined): Approve (`approve`, draft); Apply to invoice (`applyToInvoice`, approved); Void (`void`, not void); PDF (FilePdfOutlined)
- **Dialogs / Modals / Drawers**:
  - New credit note (FormDialog, hideFooter) — fields: Customer (SelectWithQuickCreate customer, required); Date (required); Reference; line items table (Items/Description/Quantity/Unit price/Discount %/Total/delete); Notes. Save/Cancel. Add line.
  - Apply to invoice (FormDialog, hideFooter, Tabs):
    - Tab "Apply": Invoice (`invoice_id`, Select of available invoices showing balance_due, required); Amount (`amount`, InputNumber, required). Confirm/Cancel.
    - Tab "Applied invoices": table — `#` (invoice_number), Amount, Date, Actions (delete application, danger).
- **Standalone forms & fields**: none beyond modals
- **Empty / loading / error states**: table loading.
- **Notable components used**: ResponsiveTableAdapter, FormDialog, Tabs, Select, SelectWithQuickCreate, ColumnVisibility, ExportMenu, Dropdown, raw `<table>`.
- **Note**: a couple currency suffixes appear as garbled `?.?` placeholder (likely lost RTL `د.ع`).

---

### `/shipments` — Shipments / گەیاندنەکان (`t('shipments')`)
- **File**: `pages/Shipments.tsx`
- **Type**: list (+ add/edit modal)
- **Purpose**: Track shipments (section `inventory.shipments`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Shipment number (`shipment_number`); Contact (`contact`, mapped from contact_id); Status (`status`, Tag: pending=blue/shipped=orange/delivered=green); Ship date (`ship_date`); Carrier (`carrier`); Tracking (`tracking`/tracking_number); Actions (`actions`)
- **Header / primary actions (buttons)**: Add (`t('add')`, primary, PlusOutlined); ExportMenu (CSV); ColumnVisibility
- **Bulk / row actions**: Mark delivered (`mark_delivered`, CheckOutlined, when not delivered); Edit (EditOutlined); Delete (DeleteOutlined, danger)
- **Dialogs / Modals / Drawers**:
  - Add/Edit (FormDialog, title `add`/`edit`, onOk submit) — fields: Invoice (`invoice_id`, Select of invoices); Contact (`contact_id`, Select, required); Ship date (`ship_date`, DatePicker, required); Carrier (Input); Tracking number (`tracking_number`, Input); Status (Select: pending/shipped/delivered, default pending); Notes (TextArea).
- **Standalone forms & fields**: none beyond modal
- **Empty / loading / error states**: table loading; delete uses `Modal.confirm` (`confirmDelete`).
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Select, ColumnVisibility, ExportMenu.

---

### `/delivery-challans` — Delivery Challans / بەڵگەنامەی گەیاندن (`t('delivery_challans')`)
- **File**: `pages/DeliveryChallans.tsx`
- **Type**: list (+ add/edit modal w/ line items)
- **Purpose**: Delivery documents (section `sales.delivery_challans`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Challan number (`challan_number`); Contact (`contact`); Date (`date`); Status (`status`); Actions (`actions`)
- **Header / primary actions (buttons)**: Add (`t('add')`, primary, PlusOutlined); ExportMenu (CSV); ColumnVisibility
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined, danger)
- **Dialogs / Modals / Drawers**:
  - Add/Edit (FormDialog, onOk submit) — fields: Contact (`contact_id`, Select, required); Date (DatePicker, required); Reference (Input); Notes (TextArea); `Form.List` line_items — per row: Item (`item_id`, Select, required) + Quantity (`quantity`, InputNumber, required) + Remove button; Add item (`add_item`, dashed, block).
- **Standalone forms & fields**: none beyond modal
- **Empty / loading / error states**: table loading; delete `Modal.confirm`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Form.List, Select, ColumnVisibility, ExportMenu.

---

### `/sales-returns` (root) — Sales Returns / گەڕاندنەوەی فرۆشتن (`t('sales_returns')`)
- **File**: `pages/SalesReturns.tsx`
- **Type**: list (+ add/edit modal)
- **Purpose**: Sales returns (section `sales.returns`). NOTE: distinct from `pages/returns/SalesReturns.tsx` (refund-focused) below.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Status `Select` (`filter_status`) — Draft/Open/Closed (in header extra)
- **Table columns**: Return number (`return_number`); Contact (`contact`); Invoice (`invoice`, mapped); Date (`date`); Status (`status`, Tag: draft/open=blue/closed=green); Total (`total`); Actions (`actions`)
- **Header / primary actions (buttons)**: Status filter Select; Add (`t('add')`, primary, PlusOutlined); ExportMenu (CSV); ColumnVisibility
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined, danger)
- **Dialogs / Modals / Drawers**:
  - Add/Edit (FormDialog, onOk submit) — fields: Contact (`contact_id`, Select, required); Invoice (`invoice_id`, Select); Date (DatePicker, required); Reason (`reason`, TextArea); Notes (TextArea).
- **Standalone forms & fields**: none beyond modal
- **Empty / loading / error states**: table loading; delete `Modal.confirm`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Select, ColumnVisibility, ExportMenu.

---

### `/payment-links` — Payment Links / بەستەرەکانی پارەدان (`t('payment_links')`)
- **File**: `pages/PaymentLinks.tsx`
- **Type**: list (+ create modal)
- **Purpose**: Generate shareable payment links.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Description (`description`); Amount (`amount`); Status (`status`, Tag: active=green/expired=red/used=blue); Created (`created`/created_at); Expires (`expires`/expires_at); Actions (`actions`)
- **Header / primary actions (buttons)**: Add (`t('add')`, primary, PlusOutlined); ExportMenu (CSV); ColumnVisibility
- **Bulk / row actions**: Copy link (`copy_link`, CopyOutlined — copies `link_url` or `/pay/{id}`); Delete (DeleteOutlined, danger)
- **Dialogs / Modals / Drawers**:
  - Create payment link (FormDialog `create_payment_link`, onOk submit) — fields: Description (Input, required); Amount (`amount`, InputNumber, required); Expiry days (`expiry_days`, InputNumber 1–365, default 7); Notes (TextArea).
- **Standalone forms & fields**: none beyond modal
- **Empty / loading / error states**: table loading; delete `Modal.confirm`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, ColumnVisibility, ExportMenu.

---

### `/customer-statements` — Customer Statement / کشف حسابی کڕیار (`t('customer_statement')`)
- **File**: `pages/CustomerStatements.tsx`
- **Type**: detail / report
- **Purpose**: Per-customer ledger statement (reads `contact_id` from query string).
- **Tabs / segments**: none
- **KPI / stat cards**: Card with Opening balance (`opening_balance`) and Closing balance (`closing_balance`)
- **Filters / search**: Date `RangePicker` (filters date_from/date_to)
- **Table columns**: Date (`date`); Type (`type`); Reference (`reference`); Description (`description`); Debit (`debit`); Credit (`credit`); Balance (`balance`)
- **Header / primary actions (buttons)**: RangePicker; Send email (`send_email`, MailOutlined); Download PDF (`download_pdf`, FilePdfOutlined)
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; subtitle shows contact_name fallback.
- **Notable components used**: PageHeader, Card, RangePicker, ResponsiveTableAdapter.

---

### `/bills` — Bills / پسووڵە (`t('bills')`)
- **File**: `pages/Bills.tsx`
- **Type**: list (+ create modal)
- **Purpose**: Vendor bills (section `purchases.bills`). Uses `ResponsiveTable` (not Adapter).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Status `Select` (`t('status')`) — Draft/Open/Paid/Overdue
- **Table columns**: (ResponsiveColumn) Bill number (`bill_number`, high); Date (`date`, medium); Due date (`due_date`, medium); Total (`total`, high, align end); Balance due (`balance_due`, high, align end); Status (`status`, StatusTag). (A parallel legacy `columns[]` for CSV/visibility incl. Actions.)
- **Header / primary actions (buttons)**: ExportButton (`/api/export/bills`); New bill (`t('new_bill')`, primary, PlusOutlined); ExportMenu (CSV); ColumnVisibility
- **Bulk / row actions**: RowAction Approve (`approve`, draft only)
- **Dialogs / Modals / Drawers**:
  - New bill (FormDialog `new_bill`, onOk submit) — fields (grid): Vendor (`contact_id`, SelectWithQuickCreate vendor, required); Date (DatePicker, required); Due date (DatePicker); Account (`account_id`, SelectWithQuickCreate account); Notes (TextArea); antd `Table` line items — Description (Input), Quantity (InputNumber), Rate (`rate`, InputNumber), Amount (computed), delete; footer Add line (`add_line`).
- **Standalone forms & fields**: none beyond modal (also has BillForm route)
- **Empty / loading / error states**: table loading; AddGate (`purchases.bills`).
- **Notable components used**: PageHeader, ResponsiveTable (RowAction), FormDialog, antd Table, SelectWithQuickCreate, StatusTag, ColumnVisibility, ExportMenu, ExportButton, useAddGate.

---

### `/bills/new` — Bill Form / فۆرمی پسووڵە
- **File**: `pages/BillForm.tsx`
- **Type**: form
- **Purpose**: Create a vendor bill with account/tax line items.
- **Tabs / segments**: FormLayout sections — Vendor; Items; Notes; Chatter (when editing)
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: line-item editor (per-line): Description (Input); Account (`account_id`, Select of accounts `code - name`); Quantity; Rate (`rate`); Amount (computed); Tax (`tax_id`, Select of taxes); delete (disabled if only 1). Live total.
- **Header / primary actions (buttons)**: FormLayout Save/Cancel (→ `/bills`); Add line (`add_line`, dashed)
- **Bulk / row actions**: per-line delete (danger, disabled when single)
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**:
  - Vendor (`contact_id`, SelectWithQuickCreate vendor, required)
  - Date (`date`, DatePicker, required)
  - Due date (`due_date`, DatePicker)
  - Reference (`reference`, Input)
  - Notes (`notes`, TextArea)
- **Empty / loading / error states**: FormLayout saving/saved/dirty.
- **Notable components used**: FormLayout, ResponsiveForm.LineItem, SelectWithQuickCreate, Select, ChatterWidget.

---

### `/purchase-orders` — Purchase Orders / داواکاری کڕین (`t('new_purchase_order')`)
- **File**: `pages/PurchaseOrders.tsx`
- **Type**: list (+ create modal)
- **Purpose**: Manage purchase orders; convert to bill (section `purchases.purchase_orders`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: `#` (order_number); Date (`date`); Total (`total`); Status (`status`, Tag: draft/issued=blue/received=green/billed=purple/cancelled=red); Actions (`actions`)
- **Header / primary actions (buttons)**: ExportMenu (CSV); ColumnVisibility; New purchase order (`t('new_purchase_order')`, primary, PlusOutlined)
- **Bulk / row actions**: Dropdown (MoreOutlined): Issue (`issue`, draft); Convert to bill (`convert_to_bill`, draft/issued); Cancel (`cancel`, not cancelled/billed); PDF (FilePdfOutlined)
- **Dialogs / Modals / Drawers**:
  - New purchase order (FormDialog, hideFooter) — fields: Vendor (`contact_id`, SelectWithQuickCreate vendor, required); Date (required); Expected delivery (`expected_delivery_date`, DatePicker); Reference; line items table (Items/Description/Quantity/Unit price/Discount %/Total/delete; uses cost_price for autofill); Notes. Save/Cancel. Add line.
- **Standalone forms & fields**: none beyond modal
- **Empty / loading / error states**: table loading; AddGate (`purchases.purchase_orders`).
- **Notable components used**: ResponsiveTableAdapter, FormDialog, SelectWithQuickCreate, ColumnVisibility, ExportMenu, Dropdown, raw `<table>`.

---

### `/vendor-credits` — Vendor Credits / قەرزی دابینکار (`t('new_vendor_credit')`)
- **File**: `pages/VendorCredits.tsx`
- **Type**: list (+ create modal)
- **Purpose**: Vendor credits (section `purchases.vendor_credits`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: `#` (vendor_credit_number); Date (`date`); Total (`total`); Status (`status`, Tag: draft/approved=green/void=red); Actions (`actions`)
- **Header / primary actions (buttons)**: ExportMenu (CSV); ColumnVisibility; New vendor credit (`t('new_vendor_credit')`, primary, PlusOutlined)
- **Bulk / row actions**: Dropdown (MoreOutlined): Approve (`approve`, draft only) — dropdown hidden if no actions
- **Dialogs / Modals / Drawers**:
  - New vendor credit (FormDialog, hideFooter) — fields: Vendor (SelectWithQuickCreate vendor, required); Date (required); Reference; line items table (Items/Description/Quantity/Unit price/Discount %/Total/delete; cost_price autofill); Notes. Save/Cancel. Add line.
- **Standalone forms & fields**: none beyond modal
- **Empty / loading / error states**: table loading; AddGate (`purchases.vendor_credits`).
- **Notable components used**: ResponsiveTableAdapter, FormDialog, SelectWithQuickCreate, ColumnVisibility, ExportMenu, Dropdown, raw `<table>`.

---

### `/purchase-returns` — Purchase Returns / گەڕاندنەوەی کڕین (`t('purchase_returns')`)
- **File**: `pages/PurchaseReturns.tsx`
- **Type**: list (+ add/edit modal)
- **Purpose**: Purchase returns to vendors (section `purchases.returns`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Status `Select` (`filter_status`) — Draft/Open/Closed (header extra)
- **Table columns**: Return number (`return_number`); Vendor (`vendor`, mapped); Bill (`bill`, mapped); Date (`date`); Status (`status`, Tag: draft/open=blue/closed=green); Total (`total`); Actions (`actions`)
- **Header / primary actions (buttons)**: Status filter Select; Add (`t('add')`, primary, PlusOutlined); ExportMenu (CSV); ColumnVisibility
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined, danger)
- **Dialogs / Modals / Drawers**:
  - Add/Edit (FormDialog, onOk submit) — fields: Vendor (`contact_id`, Select vendor, required); Bill (`bill_id`, Select); Date (DatePicker, required); Reason (`reason`, TextArea); Notes (TextArea).
- **Standalone forms & fields**: none beyond modal
- **Empty / loading / error states**: table loading; delete `Modal.confirm`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Select, ColumnVisibility, ExportMenu.

---

### `/expenses` — Expenses / خەرجی (`t('expenses')`)
- **File**: `pages/Expenses.tsx`
- **Type**: list (+ create modal)
- **Purpose**: Record expenses (section `purchases.expenses`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: `#` (expense_number); Date (`date`); Description (`description`); Amount (`amount`); Status (`status`, translated)
- **Header / primary actions (buttons)**: New expense (`t('new_expense')`, primary, PlusOutlined); ExportMenu (CSV); ColumnVisibility
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**:
  - New expense (FormDialog `new_expense`, onOk submit) — fields: Date (DatePicker, required); Amount (`amount`, InputNumber, required); Account (`account_id`, SelectWithQuickCreate account, required); Description (TextArea); hidden currency_code + exchange_rate.
- **Standalone forms & fields**: none beyond modal (also ExpenseForm route)
- **Empty / loading / error states**: table loading; AddGate (`purchases.expenses`).
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, SelectWithQuickCreate, ColumnVisibility, ExportMenu, useAddGate.

---

### `/expenses/new` — Expense Form / فۆرمی خەرجی
- **File**: `pages/ExpenseForm.tsx`
- **Type**: form
- **Purpose**: Create an expense with related vendor/project/tax.
- **Tabs / segments**: FormLayout sections — Expense Details (`expense_details`,'Expense Details'); Related (`related`,'Related'); Notes (`notes`)
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none
- **Header / primary actions (buttons)**: FormLayout Save/Cancel (→ `/expenses`)
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**:
  - Date (`date`, DatePicker, required)
  - Amount (`amount`, InputNumber, required)
  - Account (`account_id`, Select of accounts `code - name`, required)
  - Reference (`reference`, Input)
  - Vendor (`contact_id`, SelectWithQuickCreate vendor)
  - Project (`project`,'Project', `project_id`, Select)
  - Tax (`tax`,'Tax', `tax_id`, Select)
  - Description (`description`, TextArea)
- **Empty / loading / error states**: FormLayout saving/saved/dirty.
- **Notable components used**: FormLayout, SelectWithQuickCreate, Select.

---

### `/expense-claims` — Expense Claims / داواکاری خەرجی (`t('expense_claims')`)
- **File**: `pages/ExpenseClaims.tsx`
- **Type**: list (+ add/edit modal + reject-reason modal)
- **Purpose**: Employee expense claims with approval workflow (section `purchases.expense_claims`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Claim number (`claim_number`); Employee (`employee`); Date (`date`); Total (`total`); Status (`status`, Tag: draft/submitted=blue/approved=green/rejected=red); Actions (`actions`)
- **Header / primary actions (buttons)**: Add (`t('add')`, primary, PlusOutlined); ExportMenu (CSV); ColumnVisibility
- **Bulk / row actions**: Edit (EditOutlined, draft); Submit (`submit`, SendOutlined, primary, draft); Approve (`approve`, CheckOutlined, primary, submitted); Reject (`reject`, CloseOutlined, danger, submitted → opens reason modal); Delete (DeleteOutlined, danger, draft)
- **Dialogs / Modals / Drawers**:
  - Add/Edit (FormDialog, onOk submit) — fields: Employee (`employee`, Input, required); Date (DatePicker, required); Description (TextArea); `Form.List` line_items — per row: Description (Input, required) + Amount (`amount`, InputNumber, required) + Remove; Add item (`add_item`, dashed, block).
  - Reject reason (FormDialog `reject_reason`, onOk submit) — field: Reason (`reason`, TextArea, required).
- **Standalone forms & fields**: none beyond modals
- **Empty / loading / error states**: table loading; delete `Modal.confirm`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog (×2), Form.List, ColumnVisibility, ExportMenu.

---

### `/banking` — Banking / بانکداری (`t('banking')`)
- **File**: `pages/Banking.tsx`
- **Type**: dashboard / tabbed hub
- **Purpose**: Manage bank accounts and CSV import (section `banking`). Two inner sub-components.
- **Tabs / segments**: Tabs (defaultActiveKey `accounts`) — Accounts (`accounts`); Import CSV (`importCSV`)
- **KPI / stat cards**: none
- **Filters / search**: Import tab: Account `Select` (`account`)
- **Table columns**:
  - Accounts tab: Name (`name`/account_name); Banking (`banking`/bank_name); `#` (account_number); Status (`status`/account_type, Tag bank=blue/cash=green/other=orange); Currency (`currency`/currency_code); Balance due (`balance_due`/balance)
  - Import preview: dynamic columns from CSV headers
- **Header / primary actions (buttons)**: Accounts tab: Reconciliation (`reconciliation`, LinkOutlined → `/banking/reconciliation`); Bank rules (`bankRules`, SettingOutlined → `/banking/rules`). Import tab: Import CSV upload (`importCSV`, UploadOutlined); Confirm (`confirm`, primary)
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none (inline column-mapping Card)
- **Standalone forms & fields**: Import CSV: Account Select; Upload (`.csv`); column mapping Card (`column_mapping`) — per system field (date/description/amount/reference) a Select bound to CSV columns.
- **Empty / loading / error states**: table loading; query error → message.error.
- **Notable components used**: PageHeader, Tabs, ResponsiveTableAdapter, Upload, Select, Card, useListQuery.

---

### `/banking/rules` — Bank Rules / یاساکانی بانک (`t('bankRules')`)
- **File**: `pages/BankRules.tsx`
- **Type**: list (+ create/edit modal)
- **Purpose**: Automatic bank categorization rules (section `banking.bank_rules`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Name (`name`); Condition (`condition`, computed `apply_to condition_type "value"`); Account (`account`/target_account_name); Type (`type`/rule_type, Tag deposit=green/withdrawal=red); Status (`status`/is_active, Tag active/inactive); Actions (`actions`)
- **Header / primary actions (buttons)**: Apply all rules (`apply_all_rules`, ThunderboltOutlined); Create (`create`, primary, PlusOutlined)
- **Bulk / row actions**: Edit (`edit`); Delete (Popconfirm `are_you_sure`, DeleteOutlined, danger)
- **Dialogs / Modals / Drawers**:
  - Create/Edit rule (FormDialog, hideFooter; title `bankRules`/`edit`) — fields: Name (Input, required); Field (`apply_to`, Select: Description/Payee/Reference, required); Operator (`condition_type`, Select: Contains/Equals/Starts with, required); Value (`condition_value`, Input, required); Account (`target_account_id`, SelectWithQuickCreate account, required); Contact (`target_contact_id`, SelectWithQuickCreate customer); Type (`rule_type`, Select: Deposit (income)/Withdrawal (expense), required). Save/Cancel.
- **Standalone forms & fields**: none beyond modal
- **Empty / loading / error states**: custom `Empty` (InboxOutlined) with `no_bank_rules_yet` + `no_bank_rules_hint` + "New rule" (`new_rule`) CTA.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, SelectWithQuickCreate, Select, Popconfirm, Empty, ColumnVisibility, ExportMenu.

---

### `/banking/reconciliation` — Reconciliation / لێکدانەوەی بانک (`t('reconciliation')`)
- **File**: `pages/BankReconciliation.tsx`
- **Type**: dashboard / detail
- **Purpose**: Reconcile bank statement vs system transactions; auto/manual match.
- **Tabs / segments**: none
- **KPI / stat cards**: 3 stat Cards — Closing balance (`closing_balance`, gradient blue, BankOutlined); System balance (`system_balance`, gradient green, DollarOutlined); Difference (`difference`, gradient green if 0 else red, CheckCircle/Warning icon). Values suffixed `د.ع`.
- **Filters / search**: Account selector (`SelectWithQuickCreate entity="bank_account"`, `account`)
- **Table columns**:
  - Bank statement (`bank_statement`): checkbox select; Date; Description; Amount (colored)
  - System transactions (`system_transactions`): checkbox select; Date; Description; Amount (colored); Type (Tag)
- **Header / primary actions (buttons)**: (when account selected) Import statement (`import_statement`, CloudUploadOutlined → `/banking/{id}/import`); Smart match (`smart_match`, ThunderboltOutlined → `/banking/{id}/match`). Toolbar: Auto match (`autoMatch`, SyncOutlined); Match (`match`, LinkOutlined, enabled when both sides selected); Complete reconciliation (`completeReconciliation`, primary, CheckCircleOutlined)
- **Bulk / row actions**: per-row checkboxes feed manual match
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: account Select only
- **Empty / loading / error states**: each card-table has `Empty` — hardcoded Kurdish: bank side `هیچ مامەڵەیەکی بانکی نییە`, system side `هیچ مامەڵەیەکی سیستەمی نییە`. Table loading; matching/completing loaders.
- **Notable components used**: PageHeader, Row/Col, Card, Statistic, Checkbox, ResponsiveTableAdapter, SelectWithQuickCreate, Empty. Hardcoded hex colors (#2563eb/#16a34a/#dc2626) and gradient-card classNames.

---

### `/contacts` — Contacts / پەیوەندیەکان (`t('contacts')`)
- **File**: `pages/Contacts.tsx`
- **Type**: list (+ create/edit modal)
- **Purpose**: Customers and vendors (section `contacts.list`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Search Input (`search`, SearchOutlined prefix, allowClear)
- **Table columns**: Display name (`display_name`); Contact type (`contact_type`, Tag customer=blue/vendor=orange); Email (`email`); Phone (`phone`); Company name (`company_name`); Actions (`actions`)
- **Header / primary actions (buttons)**: ExportButton (`/api/export/customers`); New contact (`t('new_contact')`, primary, PlusOutlined); ExportMenu (CSV); ColumnVisibility
- **Bulk / row actions**: Row: Edit (EditOutlined → modal); Delete (DeleteOutlined, danger, `Modal.confirm`). BulkActionBar: Delete (`delete`, DeleteOutlined, danger, bulk; confirm `data_table_v2.delete_n_confirm`). Row selection via rowSelection.
- **Dialogs / Modals / Drawers**:
  - New/Edit contact (FormDialog, title `new_contact`/`edit`, onOk submit) — fields: Contact type (`contact_type`, Select: Customer/Vendor, required); Display name (Input, required); Company name (Input); Email (Input, email rule); Phone (Input). When editing existing id, embeds `<ChatterWidget entityType="contact">`.
- **Standalone forms & fields**: none beyond modal (also ContactForm route)
- **Empty / loading / error states**: backend-unavailable EmptyState (`backend_unavailable_title`/`backend_unavailable_description`, WarningOutlined, Retry `retry`). Table loading. Force-retry logic.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, BulkActionBar, EmptyState, ChatterWidget, ColumnVisibility, ExportMenu, ExportButton, useAddGate.

---

### `/contacts/new` (+ `/contacts/:id`) — Contact Form / فۆرمی پەیوەندی
- **File**: `pages/ContactForm.tsx`
- **Type**: form
- **Purpose**: Full create/edit contact (richer than the modal).
- **Tabs / segments**: FormLayout sections — Basic Info (`basic_info`,'Basic Info'); Contact Details (`contact_details`,'Contact Details'); Address (`address`,'Address'); Tax Information (`tax_info`,'Tax Information'); Notes (`notes`)
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none
- **Header / primary actions (buttons)**: FormLayout Save/Cancel (→ `/contacts`)
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**:
  - Contact type (`contact_type`, Select Customer/Vendor, required)
  - Display name (`display_name`, Input, required)
  - Company name (`company_name`, Input)
  - Email (`email`, Input, email rule)
  - Phone (`phone`, Input)
  - Mobile (`mobile`,'Mobile', Input)
  - Website (`website`,'Website', Input, placeholder `https://`)
  - Billing address (`billing_address`,'Billing Address', TextArea)
  - Shipping address (`shipping_address`,'Shipping Address', TextArea)
  - Tax ID (`tax_id`,'Tax ID', Input)
  - Currency (`currency_code`,'Currency', Select IQD/USD/EUR, default IQD)
  - Notes (`notes`, TextArea)
- **Empty / loading / error states**: FormLayout saving/saved/dirty; loads existing on `:id`.
- **Notable components used**: FormLayout, Select.

---

### `/items` — Items / کاڵاکان (`t('items')`)
- **File**: `pages/Items.tsx`
- **Type**: list (+ quick create/edit modal)
- **Purpose**: Items and services (section `inventory.items`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Search Input (`search`, SearchOutlined, allowClear)
- **Table columns**: Name (`name`); SKU (`sku`); Selling price (`selling_price`); Cost price (`cost_price`); Stock (`stock`/stock_on_hand); Actions (`actions`)
- **Header / primary actions (buttons)**: ExportButton (`/api/export/products`); New item (`t('new_item')`, primary, PlusOutlined → `/items/new`); ExportMenu (CSV); ColumnVisibility
- **Bulk / row actions**: Row: Edit (EditOutlined → modal); Delete (DeleteOutlined, danger, `Modal.confirm`). BulkActionBar: Delete (`delete`, danger, bulk, confirm `data_table_v2.delete_n_confirm`). rowSelection.
- **Dialogs / Modals / Drawers**:
  - New/Edit item (FormDialog, title `new_item`/`edit`, onOk submit) — fields: Name (Input, required); SKU (Input); Description (TextArea); Selling price (`selling_price`, InputNumber); Cost price (`cost_price`, InputNumber). When editing id, embeds `<ChatterWidget entityType="item">`.
- **Standalone forms & fields**: none beyond modal (also ItemForm route)
- **Empty / loading / error states**: backend-unavailable EmptyState (WarningOutlined, Retry). Table loading. Force-retry logic.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, BulkActionBar, EmptyState, ChatterWidget, ColumnVisibility, ExportMenu, ExportButton, useAddGate.

---

### `/items/new` (+ `/items/:id`) — Item Form / فۆرمی کاڵا
- **File**: `pages/ItemForm.tsx`
- **Type**: form
- **Purpose**: Full create/edit item incl. accounting + inventory.
- **Tabs / segments**: FormLayout sections — Basic Info (`basic_info`,'Basic Info'); Pricing (`pricing`,'Pricing'); Accounting (`accounting`,'Accounting'); Inventory (`inventory`,'Inventory')
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none
- **Header / primary actions (buttons)**: FormLayout Save/Cancel (→ `/items`)
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**:
  - Name (`name`, Input, required)
  - SKU (`sku`, Input)
  - Item Type (`item_type`,'Item Type', Select Goods/Service)
  - Unit (`unit`,'Unit', Input, placeholder `pcs`)
  - Description (`description`, TextArea)
  - Selling price (`selling_price`, InputNumber)
  - Cost price (`cost_price`, InputNumber)
  - Tax (`tax`,'Tax', `tax_id`, SelectWithQuickCreate tax_rate)
  - Income Account (`income_account`,'Income Account', `income_account_id`, SelectWithQuickCreate account)
  - Expense Account (`expense_account`,'Expense Account', `expense_account_id`, SelectWithQuickCreate account)
  - Track Inventory (`track_inventory`,'Track Inventory', Switch)
  - Opening Stock (`opening_stock`,'Opening Stock', InputNumber)
  - Reorder Level (`reorder_level`,'Reorder Level', InputNumber)
- **Empty / loading / error states**: FormLayout saving/saved/dirty; loads existing on `:id`.
- **Notable components used**: FormLayout, SelectWithQuickCreate, Select, Switch.

---

### `/price-lists` — Price Lists / لیستی نرخەکان (`t('priceLists')`)
- **File**: `pages/PriceLists.tsx`
- **Type**: list (+ create/edit modal, expandable rows)
- **Purpose**: Custom price lists per item.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Name (`name`); Type (`type`, Tag markdown=orange/fixed=blue); Currency (`currency`/currency_code); Default (`default`/is_default, green Tag if default); Actions (`actions`). Expandable nested table: Items (`items`/item_name); Custom rate (`custom_rate`, formatted IQD).
- **Header / primary actions (buttons)**: ExportMenu (CSV); ColumnVisibility; Create (`create`, primary, PlusOutlined)
- **Bulk / row actions**: Edit (`edit`); Delete (Popconfirm `are_you_sure`, DeleteOutlined, danger)
- **Dialogs / Modals / Drawers**:
  - Create/Edit price list (FormDialog, hideFooter; title `priceLists`/`edit`) — fields: Name (Input, required); Type (Select Fixed/Markdown, required); Currency (`currency_code`, Input); item-rate table — per row: Item (Select of items, showSearch) + Custom rate (`custom_rate`, InputNumber) + delete; Add line (`add_line`, dashed). Save/Cancel.
- **Standalone forms & fields**: none beyond modal
- **Empty / loading / error states**: table loading.
- **Notable components used**: ResponsiveTableAdapter (with expandable), FormDialog, Select, Popconfirm, ColumnVisibility, ExportMenu, raw `<table>`.

---

### `pages/returns/SalesReturns.tsx` — Sales Returns (refunds) / گەڕاندنەوەی فرۆشتن (`t('returns.sales_returns')`)
- **File**: `pages/returns/SalesReturns.tsx`
- **Type**: list (+ refund detail drawer)
- **Purpose**: Sales returns with refund processing (credit note / cash / wallet). NOTE: separate from root `pages/SalesReturns.tsx`; this one is refund-centric. API base `/returns/sales`.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Invoice/return number (`numbering.invoice`/return_number); Date (`date`); Status (`status`, Tag pending=orange/approved=green, label `returns.{status}`); Refund status (`returns.refund_status`/refund_status, Tag or `not_refunded`); Total (`total`, formatCurrency); Actions (`actions`)
- **Header / primary actions (buttons)**: Refresh (`refresh`, primary)
- **Bulk / row actions**: Approve (`returns.approve`, CheckOutlined, pending); Refund (`refund`, DollarOutlined, primary, approved & no refund); Refund details (`returns.refund_details`, ReloadOutlined, when refunded) — all open drawer
- **Dialogs / Modals / Drawers**:
  - Refund details (FormDialog `returns.refund_details`) — Descriptions: Invoice number, Total, Status. If approved & unrefunded, "Create refund" (`returns.create_refund`) sub-form: Refund method (`returns.refund_method`, Select: credit note/cash/wallet); Refund amount (`returns.refund_amount`, InputNumber, max=total); Create refund button (block). Existing refunds list (`returns.refund_list`): Method/Amount/Status.
  - Also `Modal.info` on success showing credit note ID.
- **Standalone forms & fields**: refund sub-form (above)
- **Empty / loading / error states**: table loading; error via message (`errors.fetch_failed`/`errors.operation_failed`).
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Descriptions, Select, InputNumber, Modal.info, formatCurrency.

---

### `pages/returns/VendorReturns.tsx` — Vendor Returns / گەڕاندنەوەی دابینکار (`t('returns.vendor_returns')`)
- **File**: `pages/returns/VendorReturns.tsx`
- **Type**: list (+ refund detail drawer)
- **Purpose**: Vendor returns with refund processing (vendor credit / cash). API base `/returns/vendor`.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Vendor return number (`returns.vendor_return_number`/return_number); Date (`date`); Status (`status`, Tag pending=orange/approved=green); Refund status (`returns.refund_status`, Tag or `not_refunded`); Total (`total`, formatCurrency); Actions (`actions`)
- **Header / primary actions (buttons)**: Refresh (`refresh`, primary)
- **Bulk / row actions**: Approve (`returns.approve`, CheckOutlined, pending); Refund (`refund`, DollarOutlined, primary, approved & no refund); Refund details (`returns.refund_details`, ReloadOutlined, refunded) — open drawer
- **Dialogs / Modals / Drawers**:
  - Refund details (FormDialog `returns.refund_details`) — Descriptions: Vendor return number, Total, Status. If approved & unrefunded, "Create refund" sub-form: Refund method (Select: vendor credit (`returns.vendor_credit`)/cash); Refund amount (InputNumber, max=total); Create refund (block). Existing refunds list: Method/Amount/Status.
- **Standalone forms & fields**: refund sub-form (above)
- **Empty / loading / error states**: table loading; error via message.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Descriptions, Select, InputNumber, formatCurrency.

---

### `pages/banking/BankImportHistory.tsx` — Import History / مێژووی هاوردن (`t('import_history')`)
- **File**: `pages/banking/BankImportHistory.tsx`
- **Type**: list (placeholder — currently empty)
- **Purpose**: View past statement imports for an account (route uses `:accountId`). Backend endpoint not yet present; always renders empty state.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Date (`date`); Format (`format`, Tag uppercase); Imported (`imported`/imported_count, green); Skipped (`skipped`/skipped_count); Created by (`created_by`)
- **Header / primary actions (buttons)**: Back (`back`, ArrowLeftOutlined → `/banking/{id}/reconciliation`); Import new (`import_new`, primary, CloudUploadOutlined → `/banking/{id}/import`)
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `Empty` (InboxOutlined) with `no_import_history` + `no_import_history_hint` + "Import first statement" (`import_first_statement`) CTA. Table loading.
- **Notable components used**: PageHeader, Card, ResponsiveTableAdapter, Empty.

---

### `pages/banking/ImportStatement.tsx` — Import Statement / هاوردنی کشف حساب (`t('import_statement')`)
- **File**: `pages/banking/ImportStatement.tsx`
- **Type**: wizard (4-step Steps)
- **Purpose**: Upload + map + preview + import a bank statement (CSV/OFX/QFX/STA/MT940) for `:accountId`.
- **Tabs / segments**: Steps — Select file (`select_file`, InboxOutlined); Mapping (`mapping`, CloudUploadOutlined); Preview (`preview`, CheckCircleOutlined); Import (`import`, CheckCircleOutlined)
- **KPI / stat cards**: Preview step shows an Alert summary: Format (Tag); Total parsed (`total_parsed`); Unique transactions (`unique_transactions`, green); Duplicates skipped (`duplicates_skipped`, red)
- **Filters / search**: none
- **Table columns**: Preview table — Date (`date`); Description (`description`); Amount (`amount`, colored); Type (`type`/debit_or_credit, Tag credit=green/debit=red). Step-1 CSV preview rendered as raw `<table>` of first rows.
- **Header / primary actions (buttons)**: Back to reconciliation (`back_to_reconciliation`, ArrowLeftOutlined). Step nav: Back (`back`); Next (`next`, primary, mapping); Confirm import (`confirm_import`, primary, preview). Final: Back to reconciliation; Smart match (`smart_match`, primary).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields** (Mapping step, CSV only — within `ResponsiveForm layout="single"`):
  - Date column (`date_column`, Select of CSV headers)
  - Amount column (`amount_column`, Select)
  - Description column (`description_column`, Select)
  - Reference column (`reference_column`, Select, allowClear, `optional`)
  - Sign column (`sign_column`, Select, allowClear, `optional`)
  - Credit label (`credit_label`, Select: CR/Credit/C)
- **Empty / loading / error states**: step-3 success screen (`import_complete`, `import_complete_message`, CheckCircleOutlined). Loading on preview/import. `unsupported_format` error on bad file.
- **Notable components used**: PageHeader, Steps, Card, Upload.Dragger, Select, Row/Col, Alert, ResponsiveForm, ResponsiveTableAdapter, raw `<table>`.

---

### `pages/banking/SmartMatch.tsx` — Smart Match / گونجاندنی زیرەک (`t('smart_match')`)
- **File**: `pages/banking/SmartMatch.tsx`
- **Type**: dashboard / detail (two-panel)
- **Purpose**: Intelligent matching of unmatched bank transactions to invoices/bills/rules for `:accountId`.
- **Tabs / segments**: none
- **KPI / stat cards**: Auto-match result Alert (closable): Matched (`matched`, green); Ambiguous (`ambiguous`, amber); No match (`no_match`, red); Total (`total`)
- **Filters / search**: Threshold `Slider` (`auto_match_threshold`, 50–100 step 5, marks 50/70/90/100)
- **Table columns**:
  - Unmatched transactions (`unmatched_transactions`): Date; Description (ellipsis); Amount (colored); Select/Selected button col
  - Match candidates (`match_candidates`): Type (Tag invoice=blue/bill=orange/other=green); Target (invoice_number/bill_number/rule_name + contact/vendor/account); Score (`score`, Tag ≥90 green/≥70 orange); Reason (`reason`, ellipsis); Match action col
- **Header / primary actions (buttons)**: Back (`back`, ArrowLeftOutlined → reconciliation); Auto match all (`auto_match_all`, primary large, ThunderboltOutlined)
- **Bulk / row actions**: Transaction row: Select/Selected (loads candidates). Candidate row: Match (`match`, primary small, LinkOutlined → posts match)
- **Dialogs / Modals / Drawers**: none (selected-txn Descriptions panel inline: Date/Description/Amount/Reference)
- **Standalone forms & fields**: threshold Slider only
- **Empty / loading / error states**: unmatched empty → `Empty` (`all_matched`); candidate panel before selection → `Empty` (`select_transaction_first`); no candidates → `Empty` (`no_candidates`, CloseOutlined). Loading flags on both tables. `match_success` toast.
- **Notable components used**: PageHeader, Card, Row/Col, Slider, Alert, Descriptions, ResponsiveTableAdapter, Empty, Tag.


## ٨. ژمێریاری · ڕاپۆرت · فرە-کۆمپانیا · عێراق / Accounting · Reports · Multi-Entity · Iraq


> Structural UI inventory for the Kurdish (Sorani) ERP frontend (`frontend/src/pages/`). RTL, antd v6 + React 19. 39 pages documented.
> Shared components recurring throughout: `PageHeader` (title/subtitle/helpKey/sectionId/extra), `ResponsiveTableAdapter` (table that collapses to cards on mobile), `FormDialog` (drawer/modal hybrid with `onOk`/`onClose`/`hideFooter`/`footer`), `ResponsiveForm`, `ResponsiveChart` (recharts wrapper with `legendItems`), `ColumnVisibility` + `ExportMenu` (CSV via `downloadCsv`), `ListWithEmptyState` + `SelectWithQuickCreate` (design-system/empty), `LoadingSkeleton`, `HelpIcon`/`useLoadingState`.

---

### ACCOUNTING

### `/accounts` — Chart of Accounts / پێڕستی هەژمارەکان
- **File**: frontend/src/pages/Accounts.tsx
- **Type**: list
- **Purpose**: Read-only chart of accounts table.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Account/code (`t('account')`), Name (`t('name')`), Type — hardcoded `'Type'` (rendered as colored Tag by account_type; colors: asset=blue, liability=red, equity=purple, income=green, expense=orange, cost_of_goods_sold=volcano, other_asset=cyan, fixed_asset=geekblue, other_liability=magenta), Balance (`t('balance_due')`, `.toLocaleString()`)
- **Header / primary actions (buttons)**: none (PageHeader only — title `t('chart_of_accounts', t('accounts'))`, subtitle `t('coa_subtitle','Chart of accounts')`, helpKey="reports", sectionId="accounting.accounts")
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: loading spinner via table `loading`; error → `message.error(t('error'))`; no pagination
- **Notable components used**: PageHeader, ResponsiveTableAdapter, Tag

### `/analytic-accounts` — Analytic Accounts / هەژمارە شیکارییەکان
- **File**: frontend/src/pages/AnalyticAccounts.tsx
- **Type**: list + inline CRUD
- **Purpose**: Manage analytic (cost-analysis) accounts.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Code (`t('code')`), Name (`t('name')`), Active (`t('active')` → `t('yes')`/`t('no')`), Actions (`t('actions')`)
- **Header / primary actions (buttons)**: New (`t('new')`, PlusOutlined; title `t('analytic_accounts')`, subtitle `t('analytic_accounts_subtitle','Analytic accounts for cost analysis')`, helpKey="analytic")
- **Bulk / row actions**: Edit (EditOutlined icon-only), Delete (DeleteOutlined, danger → `Modal.confirm` `t('are_you_sure')`)
- **Dialogs / Modals / Drawers**: FormDialog (title `t('edit')`/`t('new')`, trigger New button or row Edit). Fields: code (Input, required), name (Input, required), active (Switch, default true)
- **Standalone forms & fields**: as above (in FormDialog)
- **Empty / loading / error states**: table loading; error → `message.error(t('error'))`; success → `message.success(t('success'))`
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Form, Input, Switch, Modal.confirm

### `/journals` — Journals / ژووناڵەکان
- **File**: frontend/src/pages/Journals.tsx
- **Type**: list
- **Purpose**: Accounting journal entries with paginated, column-customizable, exportable table.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none (server pagination only)
- **Table columns**: # (`entry_number`, pinned), Date (`t('date')`, substring 10), Description (`t('description')`), Debit (`t('debit')`, toLocaleString), Credit (`t('credit')`, toLocaleString), Status (`t('status')` → StatusTag), source_type (blank title, Tag shown only if != 'manual')
- **Header / primary actions (buttons)**: ExportMenu (CSV), ColumnVisibility toggle (title `t('journals')`, subtitle `t('journals_subtitle','Accounting journals')`, sectionId="accounting.journals")
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; error → `message.error(t('error'))`; hidden-cols persisted to localStorage (`journals.hiddenCols`); pagination 20/page
- **Notable components used**: PageHeader, ResponsiveTableAdapter, StatusTag, ColumnVisibility, ExportMenu, downloadCsv, Tag

---

### REPORTS (financial reports hub)

### `/reports` — Reports / ڕاپۆرتەکان
- **File**: frontend/src/pages/Reports.tsx
- **Type**: dashboard (report-generator cards + result panels)
- **Purpose**: Generate 4 core financial reports (P&L, Balance Sheet, Trial Balance, Account Transactions) with PDF/Excel export.
- **Tabs / segments**: none (4 generator cards in a Row)
- **KPI / stat cards (in result panels)**:
  - P&L: Income (`t('income')`, green, suffix IQD), Expenses (`t('expenses')`, red), Net Profit (`t('net_profit')`, color by sign)
  - Balance Sheet: Assets (hardcoded `'Assets'`), Liabilities (`'Liabilities'`), Equity (`'Equity'`) — all suffix IQD
  - Trial Balance: Debit (`t('debit')`), Credit (`t('credit')`)
- **Filters / search**: per-card date controls (see forms below)
- **Table columns**:
  - P&L revenue/expenses tables: Account (`t('account')`), Name (`t('name')`), Amount (`t('amount')`)
  - Trial Balance: Account, Name, Debit, Credit
  - Account Transactions: Date, # (entry_number), Description, Debit, Credit, Running Balance (`t('running_balance')||'باڵانس'`) + Summary row Closing Balance (`t('closing_balance')||'کۆتایی'`)
- **Header / primary actions (buttons)**: result-panel exports — PDF (FilePdfOutlined), Excel (FileExcelOutlined) on each result Card. PageHeader title `t('reports')`, subtitle `t('reports_subtitle','Financial reports')`, helpKey="reports", sectionId="reports"
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields** (4 generator cards):
  - **Profit & Loss** (`t('profit_loss')`): From date (`t('from_date')`, DatePicker), To date (`t('to_date')`, DatePicker), Generate button (`t('generate')`)
  - **Balance Sheet** (`t('balance_sheet')`): Date (`t('date')`, DatePicker), Generate
  - **Trial Balance** (`t('trial_balance')`): Date (DatePicker), Generate
  - **Account Transactions** (`t('account_transactions')||'مامەڵەکانی هەژمار'`): Account (Select w/ search, options from `/api/accounts` as "code - name", required), From date (required), To date (required), Generate
- **Empty / loading / error states**: result panels only render when data present; error → `message.error(t('error'))`
- **Notable components used**: Card, Form, DatePicker, Select, Statistic, Row/Col, Divider, Table.Summary, ResponsiveTableAdapter, ResponsiveForm, PageHeader

### `/advanced-reports` — Advanced Reports / ڕاپۆرتە پێشکەوتووەکان
- **File**: frontend/src/pages/AdvancedReports.tsx
- **Type**: dashboard (tabbed)
- **Purpose**: Cash flow, aging (AR/AP), sales analytics, and tax summary with date-range filters + export.
- **Tabs / segments**: Cash Flow (`t('cash_flow')`, key cash-flow), Aging Report (`t('aging_report')`, key aging), Sales Analytics (`t('sales_analytics')`, key sales-analytics), Tax Summary (`t('tax_summary')`, key tax-summary)
- **KPI / stat cards**:
  - Cash Flow: Inflows (`t('inflows')`, green), Outflows (`t('outflows')`, red), Net Cash Flow (`t('net_cash_flow')`)
  - Aging: per-bucket Statistics (dynamic keys from `buckets`) for both Receivable and Payable
  - Tax Summary: Output Tax (`t('output_tax')`, green), Input Tax (`t('input_tax')`, red), Net Tax (`t('net_tax')`)
- **Filters / search**: `DateRangeForm` (inline RangePicker + Generate `t('generate')`) on Cash Flow, Sales Analytics, Tax Summary tabs; Aging uses Generate buttons only
- **Table columns**:
  - Cash Flow periods: Month, Inflows, Outflows, Net (all hardcoded EN headers, right-aligned)
  - Aging (AR/AP): # (invoice_number/bill_number), Party (contact_name/vendor_name), Due Date, Days Overdue, Bucket, Balance — all hardcoded EN
  - Sales by Customer: Customer, Invoices, Total, Paid, Outstanding (hardcoded EN)
  - Sales by Item: Product, Qty, Revenue (hardcoded EN)
- **Header / primary actions (buttons)**: per-card `ExportButton` (component) — endpoints `/api/export/{cash-flow|aging-receivables|aging-payables|sales-by-customer|sales-by-item|tax-summary}`; Generate buttons; loadArAging/loadApAging buttons
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: DateRangeForm — `range` (RangePicker, required) + Generate button (default range = month-start → today)
- **Empty / loading / error states**: each tab shows antd `<Empty />` until data loaded; error → `message.error(t('error'))`; top headers `t('top_customers')`, `t('top_products')`
- **Notable components used**: Tabs, Card, Form (inline), RangePicker, Statistic, Row/Col, Empty, ExportButton, ResponsiveTableAdapter

### `/analytic-report` — Analytic Report / ڕاپۆرتی شیکاری
- **File**: frontend/src/pages/AnalyticReport.tsx
- **Type**: dashboard
- **Purpose**: Drill into one analytic account's lines for a date range.
- **Tabs / segments**: none
- **KPI / stat cards**: Total Amount (`t('total_amount')`, precision 2), Line Count (`t('line_count')`)
- **Filters / search**: Account Select (`t('select_account')`, width 300, showSearch, options "code - name" from `/api/analytic/accounts`), RangePicker (auto-fetches on change)
- **Table columns**: Date (`t('date')`), Description (`t('description')`), Amount (`t('amount')`, toLocaleString), Reference (`t('reference')`, ref_doc)
- **Header / primary actions (buttons)**: none (PageHeader: title `t('analytic_report')`, subtitle `t('analytic_report_subtitle','Analytic report')`, helpKey="analytic")
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: filter controls only (Select + RangePicker, both inline in a Card)
- **Empty / loading / error states**: summary section only renders when account selected and data present; error → `message.error(t('error'))`; table pagination 20
- **Notable components used**: PageHeader, Card, Select, RangePicker, Statistic, Row/Col, Space, ResponsiveTableAdapter

### `/consolidated-reports` — Consolidated Reports / ڕاپۆرتە یەکخراوەکان
- **File**: frontend/src/pages/ConsolidatedReports.tsx
- **Type**: dashboard (tabbed, multi-company)
- **Purpose**: Group-level consolidated P&L + Balance Sheet across companies with a bar chart.
- **Tabs / segments**: P&L (`t('profit_loss')||'P&L'`, key pl), Balance Sheet (`t('balance_sheet')||'Balance Sheet'`, key bs)
- **KPI / stat cards**: P&L totals — Revenue, Expenses, Profit (`t('revenue')`/`t('expenses')`/`t('profit')` with EN fallbacks); BS totals — Assets, Liabilities, Equity
- **Filters / search**: `DatePicker.RangePicker` in card `extra` (default year-start → year-end)
- **Table columns**:
  - P&L: Company (`t('company')`), Revenue, Expenses, Profit (all toLocaleString)
  - BS: Company, Assets, Liabilities, Equity
- **Header / primary actions (buttons)**: Refresh link (`t('refresh')||'Refresh'`, shows '...' while loading) in card extra. Card title `t('consolidated_reports')||'Consolidated Reports'`
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none (RangePicker only)
- **Empty / loading / error states**: data defaults to empty arrays / 0; error → `message.error(t('error'))`; bar chart (ResponsiveChart) for P&L: revenue (green), expenses (red), profit (blue)
- **Notable components used**: Card, Tabs, DatePicker.RangePicker, Statistic, Row/Col, recharts BarChart, ResponsiveChart, ResponsiveTableAdapter

---

### BUDGETS & CASHFLOW

### `/budgets` — Budgets / بودجەکان
- **File**: frontend/src/pages/Budgets.tsx
- **Type**: list + inline CRUD
- **Purpose**: Manage budgets, with link to variance view.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Name (`t('name')`), Fiscal Year (`t('fiscal_year')`), Status (`t('status')`), Actions (`t('actions')`)
- **Header / primary actions (buttons)**: New (`t('new')`, PlusOutlined; title `t('budgets')`, subtitle `t('budgets_subtitle','Budgets and plans')`, helpKey="budgets", sectionId="accounting.budgets")
- **Bulk / row actions**: View Variance (`t('view_variance')` → navigates `/budget-variance?id=...`), Edit (EditOutlined), Delete (DeleteOutlined danger → Modal.confirm `t('are_you_sure')`)
- **Dialogs / Modals / Drawers**: FormDialog (title `t('edit')`/`t('new')`). Fields: name (Input, required), fiscal_year (InputNumber, required), status (Select: draft `t('draft')` / active `t('active')` / closed `t('closed')`, default draft)
- **Standalone forms & fields**: as above (FormDialog)
- **Empty / loading / error states**: table loading; error → `message.error(t('error'))`; success → `message.success(t('success'))`
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Form, Input, InputNumber, Select, Modal.confirm

### `/budget-variance` — Budget Variance / جیاوازی بودجە
- **File**: frontend/src/pages/BudgetVariance.tsx
- **Type**: detail/report (reads `?id=` query param)
- **Purpose**: Budget vs actual variance per account & period.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none (driven by URL `id` searchParam)
- **Table columns**: Account (`t('account')`, account_id), Period (`t('period')`, formatted `YYYY-MM`), Budgeted (`t('budgeted')`), Actual (`t('actual')`), Variance (`t('variance')`), Variance % (`t('variance_percent')` → colored Tag: green if >0, red if <0)
- **Header / primary actions (buttons)**: none (PageHeader: title `t('budget_variance')`, subtitle = `data?.budget_name` || `t('budget_variance_subtitle','Budget vs actual variance')`, helpKey="budgets")
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; nothing fetched if no `budgetId`; error → `message.error(t('error'))`; pagination 50
- **Notable components used**: PageHeader, Card, Tag, ResponsiveTableAdapter, useSearchParams

### `/cashflow-forecast` — Cashflow Forecast / پێشبینی هاتووچۆی پارە
- **File**: frontend/src/pages/CashflowForecast.tsx
- **Type**: dashboard
- **Purpose**: Forecast cash flow over 30/60/90 days with a line chart.
- **Tabs / segments**: none
- **KPI / stat cards**: Starting Cash (`t('starting_cash')`, green), Projected Inflow (`t('projected_inflow')`, blue), Projected Outflow (`t('projected_outflow')`, red), Ending Cash (`t('ending_cash')`, color by comparison)
- **Filters / search**: period Select in header — 30 days (`t('30_days','30 days')`), 60 days (`t('60_days')`), 90 days (`t('90_days')`)
- **Table columns**: none (chart only)
- **Header / primary actions (buttons)**: period Select (PageHeader extra). Title `t('cashflow_forecast')`, subtitle `t('cashflow_forecast_subtitle','Forecast cash flow')`, helpKey="cashflow"
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: period Select only
- **Empty / loading / error states**: data defaults to 0; error → `message.error(t('error'))`; chart card title `t('daily_breakdown')`; LineChart lines: balance, inflow, outflow
- **Notable components used**: PageHeader, Card, Statistic, Row/Col, Select, recharts LineChart, ResponsiveChart

---

### TAX

### `/tax-settings` — Tax Settings / ڕێکخستنی باج
- **File**: frontend/src/pages/TaxSettings.tsx
- **Type**: dashboard (tabbed list+CRUD); composed of two sub-components TaxRates + TaxGroups
- **Purpose**: Manage tax rates and tax groups.
- **Tabs / segments**: Tax Rates (`t('tax_rates')`, key rates), Tax Groups (`t('tax_groups')`, key groups)
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**:
  - Tax Rates: Name (`t('name')`), % (rate, suffix `%`), Type (`t('type')`, tax_type), Actions (`t('actions')` → delete Popconfirm)
  - Tax Groups: Name (`t('name')`), Description (`t('description')`)
- **Header / primary actions (buttons)**: New Tax Rate (`t('new_tax_rate')`, PlusOutlined, on Rates tab), New Tax Group (`t('new_tax_group')`, PlusOutlined, on Groups tab)
- **Bulk / row actions**: Tax Rates → Delete (DeleteOutlined danger, Popconfirm `t('are_you_sure')`)
- **Dialogs / Modals / Drawers**:
  - **New Tax Rate** FormDialog (hideFooter, inline Save/Cancel): name (Input, required `t('required_name')`, placeholder `t('placeholder_name')`), rate (`t('rate')+' %'` InputNumber 0-100, required), tax_type (`t('type')` Input, default 'percentage'), description (`t('description')` TextArea rows 2). Buttons: Save (`t('save')`), Cancel (`t('cancel')`)
  - **New Tax Group** FormDialog (hideFooter): name (Input, required), tax_rate_ids (`t('tax_rate_ids')` Input, placeholder "id1, id2, ..." — comma-split). Buttons: Save, Cancel
- **Standalone forms & fields**: as above
- **Empty / loading / error states**: table loading; error/success via message
- **Notable components used**: Tabs, ResponsiveTableAdapter, FormDialog, Form, Input, InputNumber, Popconfirm, Space

### `/tax-returns` — Tax Returns / دانەوەی باج (FormDialog title `t('taxReturns')`)
- **File**: frontend/src/pages/TaxReturns.tsx
- **Type**: list + create + file action
- **Purpose**: VAT-style tax returns; create a return period and file it.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: From date (`t('from_date')`, period_start), To date (`t('to_date')`, period_end), Total Output (`t('total_output')`, tax_collected → IQD), Total Input (`t('total_input')`, tax_paid → IQD), Net Payable (`t('net_payable')`, net_tax → IQD), Status (`t('status')` → Tag colors draft=default/filed=blue/paid=green), Actions (`t('actions')`)
- **Header / primary actions (buttons)**: Create (`t('create')`, PlusOutlined, top-right)
- **Bulk / row actions**: File (`t('file')`, SendOutlined — only when status='draft' → POST `/api/taxes/returns/{id}/file`)
- **Dialogs / Modals / Drawers**: Create-return FormDialog (hideFooter, inline Save/Cancel): name (Input, required `t('required_name')`), period_start (`t('from_date')` DatePicker, required), period_end (`t('to_date')` DatePicker, required), notes (`t('notes')` TextArea rows 2). Buttons: Save (`t('save')`), Cancel (`t('cancel')`)
- **Standalone forms & fields**: as above
- **Empty / loading / error states**: table loading; error/success via message; IQD formatted via Intl.NumberFormat
- **Notable components used**: ResponsiveTableAdapter, FormDialog, Form, DatePicker, Input, Tag, Space

---

### MULTI-ENTITY (standalone files)

### `/companies` — Companies / کۆمپانیاکان
- **File**: frontend/src/pages/Companies.tsx
- **Type**: list + inline CRUD + switch
- **Purpose**: Manage multiple companies/legal entities; switch active company.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none (ColumnVisibility + ExportMenu only)
- **Table columns**: Name (`t('name')`, BankOutlined icon + Primary Tag `t('primary')||'Primary'` if is_primary; pinned), Code (`t('code')`), Currency (`t('currency')`), Tax ID (`t('tax_id')||'Tax ID'`), Phone (`t('phone')`), Active (`t('active')` → green/red Tag yes/no), Actions (`t('actions')||'Actions'`, pinned)
- **Header / primary actions (buttons)**: New Company (`t('new_company')||'New Company'`, PlusOutlined). ExportMenu (CSV), ColumnVisibility. Subtitle `t('companies_subtitle','Manage multiple companies')`
- **Bulk / row actions**: Switch (SwapOutlined, Tooltip `t('switch')` → POST `/api/companies/{id}/switch` + sets localStorage active_company_id); Edit (EditOutlined, hidden if is_primary); Delete/Archive (DeleteOutlined danger, hidden if is_primary → Modal.confirm `t('confirmDelete')`; warns `t('cannot_archive_primary')` if primary)
- **Dialogs / Modals / Drawers**: FormDialog (title edit→`t('edit')+' '+t('company')` else `t('new_company')`). Fields: name (Input, required), code (Input), currency (Input, default IQD), tax_id (Input), phone (Input), email (Input type email), address (TextArea rows 2), is_active (Switch, only shown when editing)
- **Standalone forms & fields**: as above
- **Empty / loading / error states**: table loading; messages: `t('updated')`/`t('created')`/`t('deleted')`/`t('switched')`/error; hidden-cols localStorage (`companies.hiddenCols`); pagination 20
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, ColumnVisibility, ExportMenu, downloadCsv, Tag, Tooltip, Modal.confirm

### `/branches` — Branches / لقەکان
- **File**: frontend/src/pages/Branches.tsx
- **Type**: list + inline CRUD
- **Purpose**: Manage company branches; toggle active.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none (ColumnVisibility + ExportMenu only)
- **Table columns**: Name (`t('name')`, pinned), Code (`t('code')`), Address (`t('address')`), Phone (`t('phone')`), Head Office (`t('head_office')` → blue/default Tag yes/no), Status (`t('status')` → Switch active/inactive `t('active')`/`t('inactive')`), Actions (`t('actions')`, pinned)
- **Header / primary actions (buttons)**: Add (`t('add')`, PlusOutlined). ExportMenu (CSV), ColumnVisibility. Subtitle `t('branches_subtitle','Manage branches')`
- **Bulk / row actions**: in-row Status Switch toggles active; Edit (EditOutlined), Delete (DeleteOutlined danger → Modal.confirm `t('confirmDelete')`)
- **Dialogs / Modals / Drawers**: FormDialog (title `t('edit')`/`t('add')`). Fields: name (Input, required), code (Input, required), address (TextArea rows 2), phone (Input), is_head_office (Switch yes/no, default false)
- **Standalone forms & fields**: as above
- **Empty / loading / error states**: table loading; messages updated/created/deleted/error; hidden-cols localStorage (`branches.hiddenCols`); pagination 20
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, ColumnVisibility, ExportMenu, Switch, Tag, Modal.confirm

### `/branches-comparison` — Branch Comparison / بەراوردی لقەکان
- **File**: frontend/src/pages/BranchesComparison.tsx
- **Type**: dashboard (chart + table)
- **Purpose**: Compare revenue/expenses/profit across branches for a date range.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: `DatePicker.RangePicker` in card extra (default month-start → month-end)
- **Table columns**: Branch (`t('branch')||'Branch'`), Revenue (`t('revenue')`), Expenses (`t('expenses')`), Profit (`t('profit')`) — all toLocaleString
- **Header / primary actions (buttons)**: Refresh (`t('refresh')||'Refresh'`, ReloadOutlined) in card extra. Card title `t('branch_comparison')||'Branch Comparison'`
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: RangePicker only
- **Empty / loading / error states**: error → `message.error(t('error'))`; bar chart (ResponsiveChart) revenue (green)/expenses (red)/profit (blue)
- **Notable components used**: Card, DatePicker.RangePicker, recharts BarChart, ResponsiveChart, ResponsiveTableAdapter, Button

---

### MULTI-ENTITY (pages/multi-entity/ directory)

### `pages/multi-entity/CompaniesList.tsx` — Companies (multi-entity) / کۆمپانیاکان
- **File**: frontend/src/pages/multi-entity/CompaniesList.tsx
- **Type**: list + CRUD (FormDialog as drawer)
- **Purpose**: Multi-entity companies list with empty-state and quick-create currency.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Company Name (`t('multi_entity.company_name')` + Base Entity Tag `t('multi_entity.base_entity')` if is_primary), Code (`t('multi_entity.code')`), Currency (`t('multi_entity.currency')`), Tax ID (`t('multi_entity.tax_id')`), Status (`t('multi_entity.status')` → green/red Tag active/inactive), Actions (`t('actions')`)
- **Header / primary actions (buttons)**: Add Company (`t('multi_entity.add_company')`, PlusOutlined). Subtitle `t('multi_entity.companies_subtitle')`
- **Bulk / row actions**: Switch (`t('multi_entity.switch')`, SwapOutlined link, disabled if primary), Edit (EditOutlined link, disabled if primary), Delete (DeleteOutlined danger link, hidden if primary → Popconfirm `t('multi_entity.confirm_delete_company')`)
- **Dialogs / Modals / Drawers**: FormDialog (title add/edit; footer = Cancel + Save). Fields: name (Input, required `t('multi_entity.name_required')`), code (Input, required), currency (**SelectWithQuickCreate entity="currency"**, required), tax_id (Input), address (TextArea rows 3), phone (Input), email (Input)
- **Standalone forms & fields**: as above
- **Empty / loading / error states**: wrapped in `ListWithEmptyState` (entity="company", onCreate, onRetry); per-action messages (`company_updated`/`created`/`deleted`/`switched` + error_* keys)
- **Notable components used**: PageHeader, Card, ListWithEmptyState, ResponsiveTableAdapter, FormDialog, SelectWithQuickCreate, Form, Tag, Popconfirm, ColumnsType

### `pages/multi-entity/ConsolidatedPL.tsx` — Consolidated P&L / قازانج و زیانی یەکخراو
- **File**: frontend/src/pages/multi-entity/ConsolidatedPL.tsx
- **Type**: dashboard (filter form + KPI + table)
- **Purpose**: Consolidated income statement across selected companies for a date range.
- **Tabs / segments**: none
- **KPI / stat cards**: Total Revenue (`t('multi_entity.total_revenue')`, LineChartOutlined, green), Total Expenses (`t('multi_entity.total_expenses')`, DollarOutlined, red), Total Profit (`t('multi_entity.total_profit')`, FileTextOutlined, color by sign)
- **Filters / search**: company multi-Select (`t('multi_entity.select_companies')`, all selected by default), Date From (`t('multi_entity.date_from')`, DatePicker), Date To (`t('multi_entity.date_to')`, DatePicker), Generate button (`t('multi_entity.generate')`)
- **Table columns**: Company (`t('multi_entity.company')`), Revenue, Expenses, Profit (`multi_entity.*`, right-aligned, profit colored by sign)
- **Header / primary actions (buttons)**: Generate (filter card); Export PDF (`t('multi_entity.export_pdf')`) in breakdown card extra (stub → info toast `t('multi_entity.export_pdf_stub')`). Subtitle `t('multi_entity.consolidated_pl_subtitle')`
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: filter form (Select + 2 DatePickers + Generate)
- **Empty / loading / error states**: data block hidden until Generate; error → `message.error(t('multi_entity.error_loading_companies'/'error_generating_pl'))`
- **Notable components used**: PageHeader, Card, Select (multiple), DatePicker, Statistic, Row/Col, ResponsiveTableAdapter, ColumnsType

### `pages/multi-entity/ConsolidatedBS.tsx` — Consolidated Balance Sheet / تەرازووی یەکخراو
- **File**: frontend/src/pages/multi-entity/ConsolidatedBS.tsx
- **Type**: dashboard (filter form + KPI + table)
- **Purpose**: Consolidated balance sheet across selected companies as of a date.
- **Tabs / segments**: none
- **KPI / stat cards**: Total Assets (`t('multi_entity.total_assets')`, BankOutlined, blue), Total Liabilities (`t('multi_entity.total_liabilities')`, AccountBookOutlined, red), Total Equity (`t('multi_entity.total_equity')`, WalletOutlined, green)
- **Filters / search**: company multi-Select (`t('multi_entity.select_companies')`, all by default), As-of Date (`t('multi_entity.as_of_date')`, DatePicker), Generate (`t('multi_entity.generate')`)
- **Table columns**: Company, Assets, Liabilities, Equity (`multi_entity.*`, right-aligned)
- **Header / primary actions (buttons)**: Generate; Export PDF (`t('multi_entity.export_pdf')`, stub). Subtitle `t('multi_entity.consolidated_bs_subtitle')`
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: filter form (Select + DatePicker + Generate)
- **Empty / loading / error states**: data hidden until Generate; footer note `t('multi_entity.accounting_equation')` (Assets = Liabilities + Equity); errors via message
- **Notable components used**: PageHeader, Card, Select (multiple), DatePicker, Statistic, Row/Col, Divider, ResponsiveTableAdapter

### `pages/multi-entity/IntercompanyTransactions.tsx` — Intercompany Transactions / مامەڵەی نێوان کۆمپانیاکان
- **File**: frontend/src/pages/multi-entity/IntercompanyTransactions.tsx
- **Type**: list + CRUD + collapsible filter
- **Purpose**: Record and list transactions between companies.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: collapsible filter Card (toggled by Filter button) — From Company (Select), To Company (Select), Eliminated (Select yes/no)
- **Table columns**: Date (`t('multi_entity.date')`, formatted), From Company (`t('multi_entity.from_company')` → resolved name), To Company (`t('multi_entity.to_company')`), Amount (`t('multi_entity.amount')` + currency), Description (`t('multi_entity.description')`), Reference (`t('multi_entity.reference')`), Eliminated (`t('multi_entity.eliminated')` → green/orange Tag yes/no)
- **Header / primary actions (buttons)**: Filter (`t('filter')`, FilterOutlined, toggles filter card), Add IC Transaction (`t('multi_entity.add_ic_transaction')`, PlusOutlined). Subtitle `t('multi_entity.ic_transactions_subtitle')`
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: Add-transaction FormDialog (footer Cancel+Save). Fields: from_company_id (Select showSearch, required), to_company_id (Select showSearch, required), amount (Input type number, required), currency (Select IQD/USD/EUR, required), date (DatePicker), description (TextArea rows 3), reference (Input)
- **Standalone forms & fields**: as above; plus the inline filter form
- **Empty / loading / error states**: table loading; errors via message (`error_loading_ic_transactions`, `error_creating_ic_transaction`); success `ic_transaction_created`
- **Notable components used**: PageHeader, Card, ResponsiveTableAdapter, FormDialog, Form (vertical + inline), Select, DatePicker, Input, Tag

### `pages/multi-entity/EliminationsWorkbench.tsx` — Eliminations Workbench / مێزی لابردنی مامەڵە
- **File**: frontend/src/pages/multi-entity/EliminationsWorkbench.tsx
- **Type**: board/workbench (paired-transaction list)
- **Purpose**: Auto-pair reverse intercompany transactions and eliminate matched pairs.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Date (`t('multi_entity.date')`), Transaction Pair (`t('multi_entity.transaction_pair')` → Outgoing/Incoming tags + company arrows), Amount (`t('multi_entity.amount')` + currency), Description (`t('multi_entity.description')`), Matched (`t('multi_entity.matched')` → green/orange Tag with check/close icon, matched_yes/matched_no), Eliminated (`t('multi_entity.eliminated')` → eliminated_yes/no Tag), Actions (`t('actions')`)
- **Header / primary actions (buttons)**: none (PageHeader title `t('multi_entity.eliminations_workbench')`, subtitle `t('multi_entity.eliminations_workbench_subtitle')`)
- **Bulk / row actions**: Eliminate (`t('multi_entity.eliminate')`, primary, only when canEliminate → Popconfirm `t('multi_entity.confirm_eliminate')`); shows "eliminated" or "no match" tag otherwise
- **Dialogs / Modals / Drawers**: none (Popconfirm only)
- **Standalone forms & fields**: none
- **Empty / loading / error states**: top Alert (info) `t('multi_entity.eliminations_note')` + description; table loading; errors via message; pagination 20
- **Notable components used**: PageHeader, Card, Alert, ResponsiveTableAdapter, Popconfirm, Tag, Space, ColumnsType

---

### FX (pages/fx/ directory)

### `pages/fx/CurrencyRates.tsx` — Currency Rates / نرخی دراوەکان
- **File**: frontend/src/pages/fx/CurrencyRates.tsx
- **Type**: list + create + optional chart
- **Purpose**: Manage FX rates per currency, with a rate-history line chart.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: currency Select in header (`['USD','EUR','GBP','TRY','SAR','AED','KWD','JOD']`, default USD)
- **Table columns**: Currency (`t('fx.currency')`), Rate (`t('fx.rate')`, toFixed 4), Effective Date (`t('fx.effectiveDate')`), Source (`t('fx.source')`), Notes (`t('fx.notes')`, ellipsis), Actions (`t('common.actions')` → delete icon)
- **Header / primary actions (buttons)**: currency Select; Show/Hide Chart toggle (`t('fx.showChart')`/`t('fx.hideChart')`, LineChartOutlined); Add Rate (`t('fx.addRate')`, PlusOutlined). Card title `t('fx.currencyRates')`
- **Bulk / row actions**: Delete (DeleteOutlined danger text button → DELETE `/api/currency-rates/{id}`)
- **Dialogs / Modals / Drawers**: Add-rate FormDialog. Fields: currency (Select, required `t('fx.currencyRequired')`), rate (InputNumber min 0.0001 step 0.0001 precision 4, required, placeholder "1500.0000"), effective_date (DatePicker, required, default today), source (Select: manual `t('fx.sourceManual')`/cbi `t('fx.sourceCBI')`/imported `t('fx.sourceImported')`, default manual), notes (TextArea rows 3)
- **Standalone forms & fields**: as above
- **Empty / loading / error states**: table loading; chart only renders when showChart && chartData (last 30 reversed); errors via `error.response.data.detail || t('fx.fetchError'/'createError'/'deleteError')`; success `fx.rateCreated`/`rateDeleted`; pagination 20
- **Notable components used**: Card, Select, recharts LineChart, ResponsiveChart, ResponsiveTableAdapter, FormDialog, Form, InputNumber, DatePicker, Input.TextArea

### `pages/fx/FXExposure.tsx` — FX Exposure / مەترسی دراو
- **File**: frontend/src/pages/fx/FXExposure.tsx
- **Type**: dashboard (KPI + expandable table)
- **Purpose**: Show unrealized FX gain/loss exposure by currency as of a date.
- **Tabs / segments**: none
- **KPI / stat cards**: Total Unrealized Gain/Loss (`t('fx.totalUnrealizedGainLoss')`, DollarOutlined, suffix IQD, color by sign), Currencies Exposed (`t('fx.currenciesExposed')`), Evaluation Date (`t('fx.evaluationDate')`)
- **Filters / search**: As-of DatePicker in header (`t('fx.asOf')`, default today, no clear)
- **Table columns**: Currency (`t('fx.currency')` → blue Tag), Foreign Balance (`t('fx.foreignBalance')` + currency), Book Value (`t('fx.bookValue')`, IQD), Current Value (`t('fx.currentValue')`, IQD), Unrealized Gain/Loss (`t('fx.unrealizedGainLoss')` → strong success/danger w/ Rise/Fall icon, IQD)
  - **Expanded row**: per-account sub-table — Account Name (`t('fx.accountName')`), Balance (`t('fx.balance')`), Gain/Loss (`t('fx.gainLoss')`, +/- colored)
- **Header / primary actions (buttons)**: As-of DatePicker only. Card title `t('fx.fxExposure')`
- **Bulk / row actions**: row expand (when accounts present)
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: DatePicker only
- **Empty / loading / error states**: table loading; error → `error.response.data.detail || t('fx.fetchExposureError')`; no pagination
- **Notable components used**: Card, DatePicker, Statistic, Row/Col, Tag, Typography.Text, expandable ResponsiveTableAdapter, Rise/Fall/Dollar icons

### `pages/fx/RevaluationRuns.tsx` — Revaluation Runs / جارەکانی نرخاندنەوە
- **File**: frontend/src/pages/fx/RevaluationRuns.tsx
- **Type**: list + multi-step create (preview→post) + detail modal + reverse
- **Purpose**: Run FX revaluations (preview gain/loss, post to GL, reverse).
- **Tabs / segments**: none
- **KPI / stat cards**: (in preview & detail) Total Gain (`t('fx.totalGain')`, green, IQD), Total Loss (`t('fx.totalLoss')`, red), Net Impact (`t('fx.netImpact')`, color by sign)
- **Filters / search**: none
- **Table columns (runs)**: Period End (`t('fx.periodEnd')`), Status (`t('fx.status')` → Tag posted=green/else blue w/ check/clock icon, label `t('fx.status_{status}')`), Total Gain (`t('fx.totalGain')`, +green), Total Loss (`t('fx.totalLoss')`, -red), Net Impact (`t('fx.netImpact')`, signed), Created At (`t('fx.createdAt')`), Actions (`t('common.actions')`)
  - **Preview/detail line columns**: Account (`t('fx.account')`), Currency, Foreign Balance, Rate (`t('fx.rate')`, toFixed 4), Book Value (`t('fx.bookValue')`), Revalued Value (`t('fx.revaluedValue')`), Gain/Loss (signed)
- **Header / primary actions (buttons)**: New Revaluation (`t('fx.newRevaluation')`, PlusOutlined). Card title `t('fx.revaluations')`
- **Bulk / row actions**: View (`t('common.view')`, EyeOutlined → detail modal); Reverse (`t('fx.reverse')`, RollbackOutlined danger, only when posted && !reversed → Modal.confirm `t('fx.confirmReverse')`/content, ok `t('common.yes')`/cancel `t('common.no')`)
- **Dialogs / Modals / Drawers**:
  - **New Revaluation** FormDialog — Step 1 form: period_end (DatePicker, required, default month-end) + Generate Preview button (`t('fx.generatePreview')`). Step 2 (after preview): KPI cards + preview line table + post form (gain_account_id Select required `t('fx.gainAccount')`, loss_account_id Select required `t('fx.lossAccount')`, notes TextArea), footer Back (`t('common.back')`) + Post Revaluation (`t('fx.postRevaluation')`)
  - **Revaluation Detail** FormDialog (hideFooter): Descriptions (Period End, Status Tag, Total Gain, Total Loss, Net Impact, Journal Entry id) + line table
- **Standalone forms & fields**: as above (in dialogs)
- **Empty / loading / error states**: table loading; errors via `error.response.data.detail || t('fx.*')` (fetchRunsError/previewError/postError/reverseError/fetchDetailError); success previewGenerated/revaluationPosted/reversedSuccessfully; account options fetched from `/api/accounts` ("code - name"); pagination 20
- **Notable components used**: Card, FormDialog, Form, DatePicker, Select (showSearch), Statistic, Row/Col, Descriptions, Tag, Modal.confirm, Input.TextArea, ResponsiveTableAdapter

---

### REPORTS (pages/reports/ directory)

### `pages/reports/ScheduledReports.tsx` — Scheduled Reports / ڕاپۆرتە خشتەکراوەکان
- **File**: frontend/src/pages/reports/ScheduledReports.tsx
- **Type**: list + CRUD + actions
- **Purpose**: Schedule recurring report emails (daily/weekly/monthly).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Name (`t('scheduled_reports.name')`), Type (`t('scheduled_reports.type')` → mapped label), Frequency (`t('scheduled_reports.frequency')` → humanized daily/weekly_on/monthly_on_day), Recipients (`t('scheduled_reports.recipients')` → Tooltip + count Tag `persons`), Next Run (`t('scheduled_reports.next_run')`), Status (`t('scheduled_reports.status')` → Switch toggles active), Actions (`t('scheduled_reports.actions')`)
- **Header / primary actions (buttons)**: New Report (`t('scheduled_reports.new_report')`, PlusOutlined). Page title `t('scheduled_reports.title')` w/ CalendarOutlined
- **Bulk / row actions**: Run Now (`t('scheduled_reports.run_now')`, PlayCircleOutlined → POST `/run-now`), Edit (`t('scheduled_reports.edit')`, EditOutlined), Delete (`t('scheduled_reports.delete')`, DeleteOutlined danger → Popconfirm `confirm_delete`); in-row Status Switch (→ POST `/toggle`)
- **Dialogs / Modals / Drawers**: FormDialog (title new/edit, confirmLoading). Fields: name (Input, required `enter_name`), report_type (Select: sales_summary/aging/pl/balance_sheet/inventory_summary/custom, required), frequency (Select daily/weekly/monthly, required), day_of_week (Select Mon–Sun, only if weekly), day_of_month (InputNumber 1-28, only if monthly), hour (TimePicker HH:mm, required), recipients (Select mode tags), format (Select PDF/CSV/Excel, required), active (Switch)
- **Standalone forms & fields**: as above
- **Empty / loading / error states**: table loading; errors via message (`scheduled_reports.error*`); successes saved/updated/deleted/change_saved/report_executed; pagination 20
- **Notable components used**: Card, ResponsiveTableAdapter, FormDialog, Form (+ Form.useWatch frequency), Input, Select, Switch, TimePicker, InputNumber, Tooltip, Tag, Popconfirm

### `pages/reports/CustomReportsList.tsx` — Custom Reports List / لیستی ڕاپۆرتە تایبەتەکان
- **File**: frontend/src/pages/reports/CustomReportsList.tsx
- **Type**: list + run-result modal
- **Purpose**: List saved custom reports; run, view (→ builder), delete.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Name (`t('custom_reports.name')`), Source (`t('custom_reports.source')` → mapped label invoices/bills/sales_orders/contacts/items/journals), Columns (`t('custom_reports.columns')` → count Tag), Filters (`t('custom_reports.filters')` → count Tag), Created At (`t('custom_reports.created_at')`, locale 'ckb'), Actions (`t('custom_reports.actions')`)
- **Header / primary actions (buttons)**: New Report (`t('custom_reports.new_report')`, PlusOutlined → `/reports/custom`). List title `t('custom_reports.list_title')`
- **Bulk / row actions**: Execute (`t('custom_reports.execute')`, PlayCircleOutlined → POST `/run`, shows result modal), View (`t('custom_reports.view')`, EyeOutlined → `/reports/custom?id=`), Delete (DeleteOutlined danger → Popconfirm)
- **Dialogs / Modals / Drawers**: Run-result FormDialog (hideFooter, title = report name) — renders result ResponsiveTableAdapter (dynamic columns from report.columns) with horizontal scroll, pagination 10
- **Standalone forms & fields**: none
- **Empty / loading / error states**: wrapped in `ListWithEmptyState` (entity="report", onCreate, onRetry); errors via message; success `rows_found` count; pagination 20
- **Notable components used**: Card, ListWithEmptyState, ResponsiveTableAdapter, FormDialog, Popconfirm, Tag, Space

### `pages/reports/CustomReportBuilder.tsx` — Custom Report Builder / دروستکەری ڕاپۆرت
- **File**: frontend/src/pages/reports/CustomReportBuilder.tsx
- **Type**: builder (config panel + live results) + save modal
- **Purpose**: Build a custom report (source → columns → filters → sort), run it (creates temp report then deletes), or save it.
- **Tabs / segments**: none (two-column layout: Configuration | Results)
- **KPI / stat cards**: summary Tags above results — Total Rows (`t('custom_reports.total_rows')`) + dynamic numeric summary key Tags
- **Filters / search**: dynamic filter builder (add rows) — each row: field Select, operator Select (eq/gt/lt/contains/between → `equals`/`greater_than`/`less_than`/`contains`/`between`), value Input, delete button
- **Table columns (results)**: dynamic from selectedColumns (numbers toLocaleString, null → '-')
- **Header / primary actions (buttons)**: Run (`t('custom_reports.run')`, PlayCircleOutlined, disabled until source+columns), Save (`t('custom_reports.save')`, SaveOutlined → opens save modal). Card title `t('custom_reports.builder_title')`
- **Bulk / row actions**: New Filter (`t('custom_reports.new_filter')`, dashed PlusOutlined); per-filter Delete (DeleteOutlined danger)
- **Dialogs / Modals / Drawers**: Save-report FormDialog (title `t('custom_reports.save_report')`). Field: name (Input, required `enter_name`, → navigates `/reports/custom-list`)
- **Standalone forms & fields (Configuration panel)**: source (Select: invoices/bills/sales_orders/contacts/items/journals), columns (multi-Select, populated from `/api/custom-reports/sources/{source}/fields`), filters (dynamic), sort_by (Select field, allowClear), sort_dir (Select DESC `descending`/ASC `ascending`)
- **Empty / loading / error states**: warns `select_source_and_columns` if incomplete; errors via message; success `report_saved`/`rows_found`; results table horizontal scroll, pagination 20
- **Notable components used**: Card, Row/Col, Form (+ Form.useWatch source), Select, Input, Button, Divider, Tag, FormDialog, ResponsiveTableAdapter

### `pages/reports/EmbeddedAnalyticsDashboard.tsx` — Analytics Dashboard / داشبۆردی شیکاری
- **File**: frontend/src/pages/reports/EmbeddedAnalyticsDashboard.tsx
- **Type**: dashboard (saved-report list)
- **Purpose**: Landing list of saved custom reports with link into the builder.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none (antd `List`, not table) — each item shows title (report.name) + description (`source · columns_count · createdDate`)
- **Header / primary actions (buttons)**: New Report (`t('custom_reports.new_report')`, PlusOutlined → `/reports/custom`). Title `t('custom_reports.analytics_title','Analytics Dashboard')`, subtitle `t('custom_reports.analytics_subtitle',...)`
- **Bulk / row actions**: per-item Open Builder (`t('custom_reports.open_builder','Open builder')`, BuildOutlined → `/reports/custom?id=`)
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: List `loading`; empty text `t('custom_reports.no_reports','No saved reports yet.')`; error → `message.error(t('custom_reports.error_loading'))`
- **Notable components used**: Card, List, Space, Typography, Button, useNavigate

---

### APPROVALS (standalone + pages/approvals/ directory)

### `/approvals` — Approvals (redirect stub) / ڕەزامەندیەکان
- **File**: frontend/src/pages/Approvals.tsx
- **Type**: other (redirect landing)
- **Purpose**: Auto-redirect to `/my-approvals` after 2s; offers manual links.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none
- **Header / primary actions (buttons)**: My Approvals (`t('approvals.my_approvals')`, CheckOutlined primary → `/my-approvals`), Rules (`t('approvals.rules')`, SettingOutlined → `/approval-rules`). Card title `t('approvals.title')`
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: info Alert `t('approvals.redirecting')` + description `t('approvals.redirect_message')`
- **Notable components used**: Card, Alert, Space, Button, useNavigate

### `/my-approvals` — My Approvals / ڕەزامەندیەکانی من
- **File**: frontend/src/pages/approvals/MyApprovals.tsx
- **Type**: list (tabbed inbox/submitted) + action modal
- **Purpose**: Approve/reject/delegate pending requests; view submitted requests.
- **Tabs / segments**: My Inbox (`t('approvals.my_inbox')` + count, key inbox), I Submitted (`t('approvals.i_submitted')` + count, key submitted) — uses `Tabs.TabPane`
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns (inbox)**: Doc Type (`t('approvals.doc_type')` → `doc_type_{type}`), Document Number (`t('approvals.document_number')`), Amount (`t('approvals.amount')` + currency), Contact (`t('approvals.contact')`), Step (`t('approvals.step_label')`, `current/total`), Created At (`t('approvals.created_at')`), Actions
  - **Submitted columns**: Doc Type, Document Number, Amount, Status (`t('status')` → colored Tag `status_{status}`), Step, Created At, Actions
- **Header / primary actions (buttons)**: none (Card title `t('approvals.my_approvals')`)
- **Bulk / row actions (inbox)**: Approve (`t('approvals.approve')`, CheckOutlined primary), Reject (`t('approvals.reject')`, CloseOutlined danger), Delegate (`t('approvals.delegate')`, SwapOutlined), View (`t('view')`, EyeOutlined → `/approvals/{id}`); submitted rows → View only
- **Dialogs / Modals / Drawers**: Action FormDialog (title `t('approvals.{action}_title')`). Fields: delegate_to (Select users, only when action=delegate, required), comments (TextArea rows 4, required only when action=reject). Approve→POST `/approve`, Reject→`/reject`, Delegate→`/delegate`
- **Standalone forms & fields**: action form as above
- **Empty / loading / error states**: table loading; errors via message; successes `approvals.approved`/`rejected`/`delegated`
- **Notable components used**: Card, Tabs (TabPane), ResponsiveTableAdapter, FormDialog, Form, Select, Input.TextArea, Tag, Space, useNavigate

### `/approvals/:id` — Approval Detail / وردەکاری ڕەزامەندی
- **File**: frontend/src/pages/approvals/ApprovalDetail.tsx
- **Type**: detail (descriptions + Steps + Timeline)
- **Purpose**: Show one approval request: details, step flow, full timeline.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none (driven by `:id` param)
- **Table columns**: none
- **Header / primary actions (buttons)**: Back (`t('back')` → `/my-approvals`). Card title `t('approvals.request_detail')`
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Descriptions fields**: Doc Type (`doc_type_{type}`), Document Number, Amount (+currency), Contact, Status (colored Tag), Current Step (`current/total`), Requested By (resolved user), Created At, Completed At (if present)
- **Sections**: Approval Flow (`t('approvals.approval_flow')` → vertical Steps per step w/ approver + status + comments), Timeline (`t('approvals.timeline')` → Timeline items: created, each acted step w/ check/close dot, pending marker, completion)
- **Empty / loading / error states**: `LoadingSkeleton` (variant card) via useLoadingState; not-found → `t('approvals.not_found')`; error → `message.error(t('error'))`
- **Notable components used**: Card, Descriptions, Steps (vertical), Timeline, Tag, Button, LoadingSkeleton, useLoadingState, useParams

### `/approval-rules` — Approval Rules / یاساکانی ڕەزامەندی
- **File**: frontend/src/pages/approvals/ApprovalRules.tsx
- **Type**: list + CRUD (with nested step builder)
- **Purpose**: Define approval rules per doc type, with conditions and multi-step approver chains.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Name (`t('approvals.name')`), Doc Type (`t('approvals.doc_type')` → `doc_type_{type}`), Condition (`t('approvals.condition')` → "always" or "field operator value"), Steps (`t('approvals.steps')` → count), Priority (`t('approvals.priority')`, sortable), Active (`t('approvals.active')` → Switch), Actions
- **Header / primary actions (buttons)**: New Rule (`t('approvals.new_rule')`, PlusOutlined). Card title `t('approvals.rules')`
- **Bulk / row actions**: Edit (EditOutlined), Delete (DeleteOutlined danger → Popconfirm `confirm_delete`); in-row Active Switch (→ POST `/toggle`)
- **Dialogs / Modals / Drawers**: Rule FormDialog (title new/edit). Fields:
  - name (Input, required)
  - doc_type (Select: purchase_order/expense_claim/sales_order/bill/invoice — labels `doc_type_*`, required)
  - **Condition card** (`t('approvals.condition_label')`): field (Select: total "Total Amount" / currency_code "Currency" / branch_id "Branch", allowClear placeholder `always`); when field set → operator (Select gt/gte/lt/lte/eq shown as `>`,`>=`,`<`,`<=`,`=`) + value (InputNumber)
  - **Steps** (`Form.List name="steps"`): per step Card `t('approvals.step') {n}` — step (hidden), approver_type (Select user `approver_type_user`/role `approver_type_role`/manager_of_creator `approver_type_manager`); when user → approver Select (users); can_delegate (Switch). Remove button (`t('remove')`, when >1). Add Step button (`t('approvals.add_step')`, dashed)
  - priority (InputNumber), active (Switch)
- **Standalone forms & fields**: as above (dynamic Form.List)
- **Empty / loading / error states**: table loading; errors via message; successes created/updated/deleted; pagination 20
- **Notable components used**: Card, ResponsiveTableAdapter, FormDialog, Form (+ Form.List + shouldUpdate render-props), Select, Input, InputNumber, Switch, Popconfirm, Space

---

### IRAQ LOCALIZATION / E-INVOICE / E-FAKHATA / WHATSAPP / OCR

### `/audit-log` — Audit Log / تۆماری چاودێری
- **File**: frontend/src/pages/AuditLog.tsx
- **Type**: list (with stat KPIs + filters)
- **Purpose**: System-wide audit trail with rich filtering, stats, CSV export.
- **Tabs / segments**: none
- **KPI / stat cards**: Last 30 days (`t('last_30_days')`), Total all time (`t('total_all_time')`), Unique users (`t('unique_users')`, UserOutlined), Top action (`t('top_action')` → Tag with action+count) — shown only when stats loaded
- **Filters / search**: Entity type Select (`t('filter_entity_type')`, options invoices/quotes/contacts/items/expenses/bills/sales_orders/purchase_orders/rbac/l10n), Action Select (`t('action')`, create/update/delete), Method Select (hardcoded "Method", POST/PUT/PATCH/DELETE), RangePicker, "Mine only" toggle button (`t('mine_only')`, UserOutlined, Tooltip `mine_only_tip`), Refresh, ExportMenu (CSV), ColumnVisibility
- **Table columns**: Timestamp (`t('timestamp')`, created_at handling _seconds, pinned, w170), User (`t('user')`, email/name/id-slice, w200), Action (`t('action')` → Tag colors create=green/update=blue/delete=red/view=default, w90), Method (hardcoded "Method" → Tag colors POST=green/PUT=blue/PATCH=cyan/DELETE=red, w80), Entity Type (`t('entity_type')`, w140), Path (`t('path')||'Path'`, code, ellipsis), Status (hardcoded "Status" → colored Tag by status_code, w80), ms (hardcoded "ms", duration_ms, w60)
- **Header / primary actions (buttons)**: Mine only, Refresh (`t('refresh')`, ReloadOutlined), ExportMenu, ColumnVisibility. Plain `<h2>` title `t('audit_log')`
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: filter controls only
- **Empty / loading / error states**: table loading; error → `message.error(t('error'))`, stats fetch silent; hidden-cols localStorage (`auditLog.hiddenCols`); pagination 50, scroll x:1200
- **Notable components used**: Select, Tag, Card, Row/Col, Statistic, DatePicker (RangePicker), Button, Tooltip, ColumnVisibility, ExportMenu, ResponsiveTableAdapter

### `/audit-log-viewer` (AuditLogViewer) — Audit Log Viewer / بینەری تۆماری چاودێری
- **File**: frontend/src/pages/AuditLogViewer.tsx
- **Type**: list (with filters)
- **Purpose**: Alternate audit-log viewer with i18n-namespaced labels (`audit_log.*`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Entity type Select (`t('audit_log.entity_type')`: invoice/bill/contact/item/project), Action Select (`t('audit_log.action')`: create/update/delete via `action_create`/`action_update`/`action_delete`), User ID Input (`t('audit_log.user_id')`, SearchOutlined prefix), RangePicker (YYYY-MM-DD), Reset button (`t('reset')`)
- **Table columns**: Timestamp (`t('audit_log.timestamp')`, w180, formatted), User (`t('audit_log.user')`, email/name/id), Action (`t('audit_log.action')` → Tag colored, uppercased), Entity (`t('audit_log.entity')`, type + `#id8`), Summary (`t('audit_log.summary')`), IP (`t('audit_log.ip')`)
- **Header / primary actions (buttons)**: Refresh (`t('refresh')`, ReloadOutlined). PageHeader title `t('audit_log.title')`, subtitle `t('audit_log.subtitle')`
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: filter controls only
- **Empty / loading / error states**: table loading; error → `message.error(t('error'))`; pagination 50 with showTotal `audit_log.total_logs`
- **Notable components used**: PageHeader, Card, Select, Input, DatePicker (RangePicker), Tag, Button, ResponsiveTableAdapter

### `/einvoice` (EInvoiceDashboard) — E-Invoice Dashboard / داشبۆردی فاتورەی ئەلیکترۆنی
- **File**: frontend/src/pages/EInvoiceDashboard.tsx
- **Type**: dashboard (KPI + tabbed tables + QR modal)
- **Purpose**: Monthly e-invoice submission monitoring (submit/retry/cancel/QR) for Iraqi fiscalization.
- **Tabs / segments**: All Submissions (`t('all_submissions')`, key all), Errors (`t('errors')` + count, key errors)
- **KPI / stat cards**: Total (`t('total')`), Accepted (`t('accepted')`, green), Submitted (`t('submitted')`, blue), Rejected (`t('rejected')`, red = rejected+failed), Cancelled (`t('cancelled')`, orange), Acceptance Rate (`t('acceptance_rate')`, suffix %)
- **Filters / search**: RangePicker (default month start/end)
- **Table columns (all)**: Invoice (`t('invoice')`, invoice_number), Fiscal ID (`t('fiscal_id')`), Status (`t('status')` → Tag, STATUS_COLORS generated/signed=cyan/submitted=blue/accepted=green/rejected=red/failed=volcano/cancelled=orange), Submitted At (`t('submitted_at')`), Actions
  - **Errors columns**: Invoice, Status, Error (`t('error')`, error_message), Actions (Retry)
- **Header / primary actions (buttons)**: Refresh (`t('refresh')`, ReloadOutlined), ExportButton (`/api/export/invoices`). `<h2>` title `t('einvoice_dashboard')` + HelpIcon (sectionId einvoice.dashboard)
- **Bulk / row actions**: QR (QrcodeOutlined → fetch `/api/einvoice/qr/{id}` → image modal), Submit (SendOutlined, disabled if accepted/submitted → POST `/submit/{id}`), Retry (RetweetOutlined, disabled unless rejected/failed → POST `/retry/{id}`), Cancel (CloseCircleOutlined danger, disabled if cancelled/rejected → POST `/cancel/{id}` with reason); errors tab → Retry (`t('retry')`)
- **Dialogs / Modals / Drawers**: QR FormDialog (title `t('qr_code')`, hideFooter) — shows base64 QR Image or LoadingSkeleton
- **Standalone forms & fields**: none (RangePicker only)
- **Empty / loading / error states**: LoadingSkeleton (variant card) when loading && no report (via useLoadingState); errors → `message.error(t('error'))`; successes `t('saved')`
- **Notable components used**: Card, Row/Col, Statistic, Tabs, DatePicker (RangePicker), Tag, Image, HelpIcon, ExportButton, FormDialog, LoadingSkeleton, useLoadingState, ResponsiveTableAdapter

### `/l10n-iq` (IraqLocalization) — Iraq Localization / ناوچەگەریکردنی عێراق
- **File**: frontend/src/pages/IraqLocalization.tsx
- **Type**: dashboard (setup + reference tables + compliance reports)
- **Purpose**: Iraq tax/currency setup, tax categories, withholding rules, VAT/WHT compliance reports.
- **Hardcoded title**: `🇮🇶 Iraq Localization — ناوچەگەریکردنی عێراق` (Typography Title level 3)
- **Tabs / segments**: none (stacked Cards)
- **KPI / stat cards**:
  - Quick Setup card (when currency loaded): Base Currency, Symbol, Decimals, Format (all hardcoded EN labels)
  - VAT Return (when loaded): Taxable Sales, Output VAT (green), Input VAT (red), Net Payable (all hardcoded EN)
  - Withholding Tax Summary (when loaded): Total Withheld, Transactions, Vendors (hardcoded EN)
- **Filters / search**: Compliance Reports card → RangePicker (default month) + Generate button (hardcoded "Generate")
- **Table columns**:
  - Tax Categories (hardcoded "Tax Categories"): Code (blue Tag), Name (EN), `ناو (کوردی)` (name_ku), Default Rate %
  - Withholding Tax Rules (hardcoded): Applies To, Rate % (orange Tag), Description
- **Header / primary actions (buttons)**: Apply Iraq Defaults (hardcoded "Apply Iraq Defaults", CheckCircleOutlined, in Quick Setup extra → POST `/api/l10n/iq/setup`); Generate (Compliance Reports extra)
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: RangePicker only (no antd Form)
- **Empty / loading / error states**: sections render conditionally on loaded data; error → `message.error(t('error'))`; setup success `${t('saved')} (+N taxes)` / error from `e.response.data.detail`
- **Notable components used**: Card, Row/Col, Statistic, Button, DatePicker (RangePicker), Tag, Typography, Divider, ResponsiveTableAdapter. NOTE: this page uses mostly hardcoded English/Kurdish labels (not `t()`), a documentation outlier.

### `pages/efakhata/EFakhataDashboard.tsx` — e-Fakhata Submissions / ناردنەکانی e-Fakhata
- **File**: frontend/src/pages/efakhata/EFakhataDashboard.tsx
- **Type**: list (dashboard) — uses `useTranslation('efakhata')` namespace
- **Purpose**: List Iraq Ministry of Finance (MoF) e-invoice submissions with status filtering.
- **Tabs / segments**: none
- **KPI / stat cards**: none (uses status-count Tag chips instead, dynamic per status)
- **Filters / search**: Status Select (`t('filter_status','Status')`, options pending/submitting/submitted/acknowledged/rejected/failed/cancelled), DatePicker.RangePicker, Refresh button (`t('refresh','Refresh')`)
- **Table columns**: Invoice (`t('col_invoice','Invoice')`, invoice_id → Link `/invoices/{id}` as code), Status (`t('col_status','Status')` → Tag, STATUS_COLOR pending=default/submitting=processing/submitted=blue/acknowledged=green/rejected=red/failed=orange/cancelled=default), Attempts (`t('col_attempts','Attempts')`, w100), MoF Ack (`t('col_ack','MoF Ack')`, code or —), Last error (`t('col_error','Last error')`, danger text + error_code), Actions (`t('col_actions','Actions')` → Link `/efakhata/submissions/{id}` "View →")
- **Header / primary actions (buttons)**: Refresh. Title `t('title','e-Fakhata submissions')`
- **Bulk / row actions**: View → (row link to detail)
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: filter controls only
- **Empty / loading / error states**: top info Alert `t('mof_disclaimer', '...wire format pending final MoF spec (R7.X).')`; table loading; error → `message.error(t('list_load_failed','Failed to load submissions'))`; status-count Tag chips; pagination 25
- **Notable components used**: Alert, Card, DatePicker.RangePicker, Select, Tag, Typography, antd Table (raw, not ResponsiveTableAdapter), Link, ColumnsType

### `pages/efakhata/SubmissionDetail.tsx` — e-Fakhata Submission Detail / وردەکاری ناردن
- **File**: frontend/src/pages/efakhata/SubmissionDetail.tsx
- **Type**: detail (Descriptions + Steps + timeline) — `useTranslation('efakhata')`, reads `:sid` param
- **Purpose**: Full state-transition timeline of one MoF submission; admin cancel.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none
- **Header / primary actions (buttons)**: Back link (`t('back','Back to dashboard')` → `/efakhata`). Title `t('detail_title','Submission') {id8}`
- **Bulk / row actions**: none
- **Descriptions fields**: Invoice (`t('invoice')` → Link), Status (`t('status')` → Tag), Attempts (`t('attempts')`), MoF Ack number (`t('mof_ack')`, code or —), Created (`t('created_at')`), Next retry (`t('next_attempt')`)
- **Sections**: status Steps (STATUS_ORDER pending→submitting→submitted→acknowledged, shown only if not errored); error Alert (when error_message, w/ error_code); Timeline card (`t('timeline','Timeline')` → list of history entries w/ status Tag + actor); admin Cancel card
- **Dialogs / Modals / Drawers**: none (Popconfirm only)
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `<Spin>` while loading/no record; error → `message.error(t('not_found','Submission not found'))`; no-history → `t('no_history','No history yet')`; Cancel via Popconfirm `t('cancel_confirm',...)` → button `t('cancel_button','Cancel submission (admin only)')` (only if status not acknowledged/cancelled/rejected); success `t('cancelled_ok')`
- **Notable components used**: Alert, Card, Descriptions, Popconfirm, Spin, Steps, Tag, Typography, Link, useParams

### `/whatsapp` (WhatsApp) — WhatsApp / واتساپ
- **File**: frontend/src/pages/WhatsApp.tsx
- **Type**: dashboard (KPI + tabbed config/templates/log) + 2 modals
- **Purpose**: WhatsApp Business messaging — config, templates, message log, send.
- **Tabs / segments**: Configuration (`t('configuration')`, key config), Templates (`t('templates')`, key templates), Message Log (`t('message_log')`, key messages)
- **KPI / stat cards**: Total (`t('total')`), Sent (`t('sent')`, blue), Delivered (`t('delivered')`, cyan), Read (`t('read')`, purple), Failed (`t('failed')`, red), Previewed (`t('previewed')`)
- **Filters / search**: none
- **Table columns**:
  - Templates: Name (`t('name')`), Summary (`t('summary')`, body slice 80), Locale (`t('locale')`), Actions
  - Message Log: To (`t('to')`), Summary (body slice 60), Status (`t('status')` → Tag, STATUS_COLORS queued/sending=cyan/sent=blue/delivered=cyan/read=geekblue/failed=red/skipped=orange/previewed=purple), Queued At (`t('queued_at')`), Error (`t('error')`)
- **Header / primary actions (buttons)**: Refresh (`t('refresh')`, ReloadOutlined), Send Message (`t('send_message')`, SendOutlined primary). Subtitle `t('whatsapp_subtitle','WhatsApp messaging for customers')`. Templates tab: New Template (`t('new_template')`, PlusOutlined)
- **Bulk / row actions**: Templates → Edit (`t('edit')`), Delete (`t('delete')` danger → Popconfirm `t('confirm_archive')`)
- **Dialogs / Modals / Drawers**:
  - **Template** FormDialog (title edit→`t('edit_template')` else `t('new_template')`): name (Input, required), locale (`t('locale')` Input, default ku), body (`t('body')` TextArea rows 5, required, placeholder with `{{name}}/{{number}}/{{amount}}`), description (`t('description')` Input)
  - **Send** FormDialog (title `t('send_message')`): to (`t('to')` Input, required, placeholder "07501234567 or 9647501234567"), body (`t('body')` TextArea rows 4, required)
- **Standalone forms & fields (Config tab — inline Form, not dialog)**: enabled (`t('enabled')` Switch), preview_mode (`t('preview_mode')` Switch), api_base ("API Base" Input), phone_number_id ("Phone Number ID" Input), business_account_id ("Business Account ID" Input), default_country_code (`t('country_code')` Input maxLength 4), api_token ("API Token" Input.Password), auto_send_invoice (`t('auto_send_invoice')` Switch), auto_send_payment_receipt (`t('auto_send_payment_receipt')` Switch), Save button (`t('save')`)
- **Empty / loading / error states**: card/table loading; errors via message; successes `t('saved')`
- **Notable components used**: PageHeader, Card, Tabs, Row/Col, Statistic, Form, Input/Input.Password/TextArea, Switch, Tag, Popconfirm, Divider, FormDialog, ResponsiveTableAdapter

### `/ocr` (OCRReceipts) — OCR Receipts / وەسڵی OCR
- **File**: frontend/src/pages/OCRReceipts.tsx
- **Type**: dashboard (upload + extract form + history)
- **Purpose**: OCR-scan receipt images, edit extracted data, confirm → create bill.
- **Tabs / segments**: none (two-column: Upload | Extracted Data + history below)
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**:
  - Scan history: Filename (`t('filename')`), Vendor (`t('vendor')`, parsed.vendor), Amount (`t('amount')`, parsed.total, right), Status (`t('status')` → Tag confirmed=green/unconfigured=orange/else blue), Scanned At (`t('scanned_at')`), Actions
  - Line items (parsed, when present): Description (`t('description')`), Amount (`t('amount')`, right)
- **Header / primary actions (buttons)**: Refresh (`t('refresh')`, ReloadOutlined). `<h2>` title `t('ocr_receipts')`. Extracted-Data card extra → Confirm & Create Bill (`t('confirm_create_bill')`, CheckOutlined, when scan.id present)
- **Bulk / row actions (history)**: View (`t('view')` → loads scan into form), Delete (DeleteOutlined danger → Popconfirm `t('confirm_archive')`)
- **Dialogs / Modals / Drawers**: none (uses Dragger upload + inline form)
- **Standalone forms & fields (Extracted Data, antd Form + ResponsiveForm)**: vendor (`t('vendor')` Input), date (`t('date')` Input, placeholder YYYY-MM-DD), subtotal (`t('subtotal')` InputNumber), tax (`t('tax')` InputNumber), total (`t('total')` InputNumber), currency (`t('currency')` Input). Upload via Dragger (`t('upload_receipt')`, accept image/*, drag text `t('drag_drop_receipt')`, hint "JPG, PNG, max 10MB")
- **Empty / loading / error states**: warning Alert when scan.status='unconfigured' (`t('ocr_engine_not_configured')` + message); image preview when image_base64; raw_text in `<details>` (`t('raw_text')`); errors via message; success `t('saved')`; history pagination 10
- **Notable components used**: Card, Upload (Dragger), Form, ResponsiveForm, Input/InputNumber, Image, Alert, Popconfirm, Tag, Row/Col, ResponsiveTableAdapter


## ٩. کۆگا · بەرهەمهێنان · POS · جۆرایەتی · چاککردنەوە · کرێ / Inventory · Manufacturing · POS · Quality · Maintenance · PLM · Repairs · Rental


> Structural UI inventory. Bilingual labels recorded as `t('key', 'English fallback')` where present; bare `t('key')` keys also recorded. All pages are RTL antd v6 + React 19. Shared table component is `ResponsiveTableAdapter`; shared modal/drawer is `FormDialog` (a responsive wrapper that renders a Modal on desktop / bottom-sheet/Drawer on mobile). Many forms use `SelectWithQuickCreate` (entity selector with inline create).

---

### INVENTORY (top-level pages)

### `/inventory` — Inventory / ئەنبار
- **File**: pages/Inventory.tsx
- **Type**: dashboard (tabbed container with sub-lists)
- **Purpose**: Inventory overview, low-stock alerts, stock adjustments, item groups.
- **Tabs / segments**:
  - Overview — `t('inventory_overview')`
  - Low Stock Alerts — `t('low_stock_alerts')`
  - Adjustments — `t('adjustments')`
  - Item Groups — `t('item_groups')`
- **KPI / stat cards** (Overview tab, antd `Statistic`):
  - Total Items — `t('total_items')`
  - Total Stock Value — `t('total_stock_value')` (suffix "IQD")
  - Low Stock Count — `t('low_stock_count')` (red value)
- **Filters / search**: none
- **Table columns**:
  - Overview: Name `t('name')`, Stock `t('stock')`, Cost Price `t('cost_price')`, Total `t('total')`
  - Low Stock: Name `t('name')`, SKU `t('sku')`, Stock `t('stock')` (red Tag + WarningOutlined), Reorder Point `t('reorder_point')`
  - Adjustments: Date `t('date')`, Quantity `t('quantity')` (green/red +/- Tag), Description `t('description')`, Status `t('status')` (Tag)
  - Item Groups: Name `t('name')`, Description `t('description')`
- **Header / primary actions (buttons)**:
  - Adjustments tab: ExportButton (endpoint `/api/export/inventory`); New Adjustment — `t('new_adjustment')` (+PlusOutlined)
  - Item Groups tab: New Group — `t('new_group')` (+PlusOutlined)
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers** (all `FormDialog`):
  - New Adjustment — trigger "New Adjustment" button. Fields: Items `t('items')` (SelectWithQuickCreate entity=item, required), Account `t('account')` (SelectWithQuickCreate entity=account, required), Quantity `t('quantity')` (InputNumber, required), Description `t('description')` (TextArea). Save/Cancel.
  - New Group — trigger "New Group". Fields: Name `t('name')` (Input, required), Description `t('description')` (TextArea). Save/Cancel.
- **Standalone forms & fields**: see modals above.
- **Empty / loading / error states**: table `loading` spinners; `.catch(()=>{})` silent on overview/low-stock.
- **Notable components used**: Tabs, Card+Statistic, Row/Col, ResponsiveTableAdapter, FormDialog, SelectWithQuickCreate, ExportButton, Tag.

### `/warehouses` — Warehouses / کۆگاکان
- **File**: pages/Warehouses.tsx
- **Type**: dashboard (tabbed: Warehouses list + Stock Transfers list)
- **Purpose**: Manage warehouses (with expandable per-warehouse stock) and inter-warehouse stock transfers.
- **Tabs / segments**:
  - Warehouses — `t('warehouses')`
  - Stock Transfer — `t('stockTransfer')`
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**:
  - Warehouses: Name `t('name')`, Address `t('address')`, Primary `t('primary')` (green Tag), Actions `t('actions')`. Expandable row → stock items table: Items `t('items')`, Quantity `t('quantity')`.
  - Transfers: # `transfer_number`, From `t('from')`, To `t('to')`, Date `t('date')`, Status `t('status')` (colored Tag: draft/in_transit/completed/cancelled).
- **Header / primary actions (buttons)**:
  - Warehouses: Create — `t('create')` (+PlusOutlined) — has `data-add-action="inventory.warehouses"` (AddGate wired via `useAddGate`)
  - Transfers: Create — `t('create')` (+PlusOutlined)
- **Bulk / row actions**: Warehouses row: Edit `t('edit')`, Delete (DeleteOutlined + Popconfirm `t('are_you_sure')`).
- **Dialogs / Modals / Drawers** (FormDialog):
  - Warehouse form — trigger Create/Edit. Fields: Name `t('name')` (Input, required), Address `t('address')` (TextArea), Primary `t('primary')` (Switch). Save/Cancel.
  - Stock Transfer form — trigger Create. Fields: From `t('from')` (SelectWithQuickCreate entity=location, required), To `t('to')` (SelectWithQuickCreate entity=location, required), Date `t('date')` (DatePicker, required). Line-item table (manually built `<table>`): Items (Select, searchable) + Quantity (InputNumber min 1) + delete button per row; "Add line" `t('add_line')` (dashed). Save/Cancel.
- **Empty / loading / error states**: Custom `Empty` (InboxOutlined) for both lists — "No warehouses yet" `t('no_warehouses_yet')` + hint `t('no_warehouses_hint')` + New Warehouse `t('new_warehouse')`; "No transfers yet" `t('no_transfers_yet')` + hint `t('no_transfers_hint')` + New Transfer `t('new_transfer')`. Table loading.
- **Notable components used**: Tabs, ResponsiveTableAdapter (expandable), FormDialog, SelectWithQuickCreate, useAddGate (Selective Add gating, `data-addgate-section`), DatePicker, Empty, Tag, Popconfirm.

### `/stock-locations` — Stock Locations / شوێنەکانی کۆگا
- **File**: pages/StockLocations.tsx
- **Type**: other (tree explorer + form)
- **Purpose**: Hierarchical bin/zone/aisle/staging locations per warehouse, shown as a Tree.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Warehouse selector (Select, `t('select_warehouse')`) at top — drives the tree.
- **Table columns**: N/A (renders antd `Tree` with `showLine`). Each node title: code (strong) + name + `(location_type)` + inline Edit (EditOutlined) + Delete (DeleteOutlined + Popconfirm).
- **Header / primary actions (buttons)**: New Location — `t('new_location')` (+PlusOutlined).
- **Bulk / row actions**: per-tree-node Edit / Delete.
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit Location — title `t('new_location')`/`t('edit_location')`. Fields: Warehouse `t('warehouse')` (Select, required, disabled on edit), Code `t('code')` (Input, required), Name `t('name')` (Input, required), Location Type `t('location_type')` (Select: zone/aisle/bin/staging, required), Parent Location `t('parent_location')` (Select allowClear), Barcode `t('barcode')` (Input), Active `t('active')` (Select active/inactive). Save/Cancel.
- **Empty / loading / error states**: Card `loading`; Empty (InboxOutlined) "No locations" `t('no_locations')` + hint `t('no_locations_hint')` + New Location button.
- **Notable components used**: Tree (antd, DataNode), Card, FormDialog, Select, Empty, Popconfirm.

### `/putaway-rules` — Putaway Rules / یاساکانی دانان
- **File**: pages/PutawayRules.tsx
- **Type**: list
- **Purpose**: Rules routing incoming items to target locations by warehouse/item/category with priority.
- **Tabs / segments**: none
- **Filters / search**: none (warehouse picked inside form)
- **Table columns**: Warehouse `t('warehouse')`, Items `t('items')` (fallback "any" `t('any')`), Target Location `t('target_location')`, Priority `t('priority')`, Status `t('active')`/`t('inactive')`, Actions `t('actions')`.
- **Header / primary actions (buttons)**: New Putaway Rule — `t('new_putaway_rule')` (+PlusOutlined).
- **Bulk / row actions**: Edit `t('edit')`, Delete (DeleteOutlined + Popconfirm).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit Putaway Rule. Fields: Warehouse `t('warehouse')` (Select, required), Items `t('items')` (Select allowClear, extra hint `t('putaway_rule_item_hint')`), Target Location `t('target_location')` (SelectWithQuickCreate entity=location, required, disabled until warehouse chosen), Priority `t('priority')` (InputNumber min 1, required, extra `t('priority_hint')`), Active `t('active')` (Select active/inactive). Save/Cancel.
- **Empty / loading / error states**: Empty (InboxOutlined) "No putaway rules" `t('no_putaway_rules')` + hint `t('no_putaway_rules_hint')` + button. Table loading.
- **Notable components used**: ResponsiveTableAdapter, FormDialog, SelectWithQuickCreate, Select, Popconfirm, Empty.

### `/cycle-counts` — Cycle Counts / ژماردنی دەوری
- **File**: pages/CycleCounts.tsx
- **Type**: list + detail-drawer
- **Purpose**: Schedule and execute warehouse stock cycle counts with per-line expected/counted/variance.
- **Tabs / segments**: none (detail drawer has internal sections)
- **Filters / search**: none
- **Table columns**: Warehouse `t('warehouse')`, Scheduled Date `t('scheduled_date')`, Status `t('status')` (Tag: draft/in_progress/completed/cancelled), Actions `t('actions')`.
- **Header / primary actions (buttons)**: New Cycle Count — `t('new_cycle_count')` (+PlusOutlined).
- **Bulk / row actions**: View `t('view')` (EyeOutlined); Start `t('start')` (PlayCircleOutlined, draft only).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New Cycle Count — Fields: Warehouse `t('warehouse')` (Select, required), Location `t('location')` (SelectWithQuickCreate entity=location, extra `t('cycle_count_location_hint')`, disabled until warehouse), Scheduled Date `t('scheduled_date')` (DatePicker, required). Save/Cancel.
  - Cycle Count Detail (FormDialog) — `t('cycle_count_detail')`. Header extra: Complete Count `t('complete_count')` (CheckCircleOutlined, in_progress only). Shows Status, Scheduled Date, Completed At. Lines table: Items `t('items')`, Expected Qty `t('expected_qty')`, Counted Qty `t('counted_qty')`, Variance `t('variance')` (Tag), Notes `t('notes')`. Inline "Add line" form (`layout="inline"`): Item (Select, required), Expected Qty (InputNumber, required), Counted Qty (InputNumber), Notes (Input), Add `t('add')`.
- **Empty / loading / error states**: Empty (InboxOutlined) "No cycle counts" `t('no_cycle_counts')` + hint. Toasts: `t('cycle_count_started')`, `t('cycle_count_completed')`, `t('line_added')`.
- **Notable components used**: ResponsiveTableAdapter, FormDialog (used both as modal & detail drawer), SelectWithQuickCreate, DatePicker, Tag, Empty.

### `/serial-numbers` — Serial Numbers / ژمارە زنجیرەییەکان
- **File**: pages/SerialNumbers.tsx
- **Type**: list
- **Purpose**: Track product serial/batch numbers with status, expiry, purchase date.
- **Tabs / segments**: none
- **Filters / search**: Filter by Item (Select, searchable, `t('filter_by_item')`); Filter by Status (Select, `t('filter_by_status')`, options from STATUS_COLORS: in_stock/sold/reserved/damaged/returned). Plus ExportMenu (csv) and ColumnVisibility.
- **Table columns**: Serial Number `t('serial_number')`, Item `t('item')`, Status `t('status')` (colored Tag), Batch Number `t('batch_number')`, Expiry Date `t('expiry_date')`, Actions `t('actions')`.
- **Header / primary actions (buttons)**: New Serial — `t('new_serial')` (+PlusOutlined) in PageHeader extra.
- **Bulk / row actions**: Edit `t('edit')` (EditOutlined).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit Serial — `t('new_serial')`/`t('edit_serial')`. Fields: Item `t('item')` (Select searchable, required, disabled on edit), Serial Number `t('serial_number')` (Input, required, disabled on edit, placeholder SN-0001), Status `t('status')` (Select, edit-only), Batch Number `t('batch_number')` (Input), Purchase Date `t('purchase_date')` (DatePicker), Expiry Date `t('expiry_date')` (DatePicker), Notes `t('notes')` (TextArea). Save/Cancel.
- **Empty / loading / error states**: table loading; error toast `t('error')`.
- **Notable components used**: PageHeader (helpKey, sectionId="inventory.serial_numbers"), ColumnVisibility (localStorage `serialNumbers.hiddenCols`), ExportMenu, ResponsiveTableAdapter, FormDialog, Tag.

---

### MANUFACTURING (top-level pages)

### `/manufacturing` (BOMs) — Bills of Materials / لیستی پێکهاتەکان
- **File**: pages/MfgBOMs.tsx
- **Type**: list
- **Purpose**: Define BOMs: product + components (item/qty/unit) + routing through work centers.
- **Tabs / segments**: none
- **Filters / search**: none
- **Table columns**: Product `t('product')`, Code `t('code')`, Quantity `t('quantity')`, Components `t('components')` (count), Status `t('status')`, Actions `t('actions')`.
- **Header / primary actions (buttons)**: heading `t('boms')` + HelpIcon (sectionId="manufacturing.boms"); Refresh `t('refresh')` (ReloadOutlined); New BOM `t('new_bom')` (+PlusOutlined). Page wrapper `data-section-id="manufacturing.boms"`.
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined + Popconfirm `t('confirm_archive')`).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit BOM — `t('new_bom')`/`t('edit_bom')`. Fields: Product `t('product')` (SelectWithQuickCreate entity=item, required), Code `t('code')` (Input), Quantity `t('quantity')` (InputNumber, default 1). Components (Form.List): per row Item (Select searchable, required) + Quantity (InputNumber, required) + Unit `t('unit')` (Input) + delete; "Add component" `t('add_component')` (dashed block). Routing `t('routing')` (Select multiple of work centers). Status `t('status')` (Select active/archived, default active).
- **Empty / loading / error states**: table default; save toast `t('saved')`, error `t('error')`.
- **Notable components used**: Card, ResponsiveTableAdapter, FormDialog, SelectWithQuickCreate, Form.List, HelpIcon.

### `/manufacturing/orders` (MOs) — Manufacturing Orders / داواکاریەکانی بەرهەمهێنان
- **File**: pages/MfgOrders.tsx
- **Type**: list + detail-drawer
- **Purpose**: Create manufacturing orders from BOMs; confirm/done; manage child work orders.
- **Tabs / segments**: none
- **Filters / search**: none
- **Table columns**: # `number`, Product `t('product')`, Quantity `t('quantity')`, Produced `t('produced')`, Scheduled Date `t('scheduled_date')`, Status `t('status')` (Tag green/blue/orange for done/confirmed/else), Actions `t('actions')`.
- **Header / primary actions (buttons)**: heading `t('manufacturing_orders')` + HelpIcon (manufacturing.orders); Refresh `t('refresh')`; New MO `t('new_mo')` (+PlusOutlined).
- **Bulk / row actions**: View `t('view')`; Confirm (CheckOutlined, draft); Done `t('done')` (confirmed); Delete (DeleteOutlined, non-done).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New MO — Fields: BOM `t('bom')` (Select of BOMs by product_name, required), Quantity `t('quantity')` (InputNumber default 1), Scheduled Date `t('scheduled_date')` (DatePicker), Notes `t('notes')` (TextArea).
  - MO Detail drawer (FormDialog titled with MO number) — Descriptions: Product, Quantity, Status, Produced. Components table: Item `t('item')`, Required Qty `t('required_qty')`. Work Orders table: # `sequence`, Work Center `t('work_center')`, Status (Tag), Duration `t('duration_min')`, Actions: Start `t('start')` (PlayCircleOutlined, pending) / Finish `t('finish')` (CheckOutlined, in_progress).
- **Empty / loading / error states**: error toasts only.
- **Notable components used**: Card, Descriptions, ResponsiveTableAdapter, FormDialog (modal + detail), HelpIcon, Tag.

### `/manufacturing/work-centers` — Work Centers / ناوەندەکانی کار
- **File**: pages/MfgWorkCenters.tsx
- **Type**: list
- **Purpose**: Define work centers with capacity/cost per hour.
- **Tabs / segments**: none
- **Filters / search**: none
- **Table columns**: Name `t('name')`, Code `t('code')`, Capacity/hour `t('capacity_per_hour')`, Cost/hour `t('cost_per_hour')`, Active `t('active')` (✓/—), Actions `t('actions')`.
- **Header / primary actions (buttons)**: heading `t('work_centers')`; Refresh `t('refresh')`; New Work Center `t('new_work_center')` (+PlusOutlined).
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined + Popconfirm `t('confirm_archive')`).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit Work Center — `t('new_work_center')`/`t('edit')`. Fields: Name `t('name')` (Input, required), Code `t('code')` (Input), Capacity/hour (InputNumber, default 0), Cost/hour (InputNumber, default 0), Active `t('active')` (Switch, default true).
- **Empty / loading / error states**: save/error toasts.
- **Notable components used**: Card, ResponsiveTableAdapter, FormDialog, Switch.

---

### POS (pages/pos/) — Point of Sale

### `/pos` (Hub) — Select POS Config / هەڵبژاردنی فرۆشگا
- **File**: pages/pos/POSHub.tsx
- **Type**: dashboard (config card grid → launch terminal)
- **Purpose**: Pick a POS config and open/resume a session; entry point to terminal.
- **Tabs / segments**: none
- **KPI / stat cards**: none (each config is a Card with tags)
- **Filters / search**: none
- **Table columns**: N/A — Row/Col of Cards. Each card: title (name_ku||name) + secondary name + Tags: Restaurant `t('pos.restaurant')` (orange), Cash Control `t('pos.cash_control')` (green), iface type `t('pos.shop')`/`t('pos.restaurant')` (blue/purple). Card action: Open Session `t('pos.open_session')` (PlayCircleOutlined, loading per-card).
- **Header / primary actions (buttons)**: title `t('pos.select_config')` (ShopOutlined); Settings `t('settings')` (SettingOutlined → /pos/configs).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none (opening session navigates to `/pos/terminal/:sessionId`; warns if can't open).
- **Empty / loading / error states**: LoadingSkeleton (variant card); InlineError with retry; Empty "no configs" `t('pos.no_configs')` + Create Config `t('pos.create_config')` (PlusOutlined). Toast `t('pos.session_opened')`.
- **Notable components used**: Card (hoverable, actions), Row/Col, Tag, LoadingSkeleton, InlineError, useLoadingState.

### `/pos/terminal/:sessionId` (Terminal) — POS Terminal / فرۆشگای فرۆشتن
- **File**: pages/pos/POSTerminal.tsx (slim shell) → renders `components/pos/POSTerminalShell.tsx` + sub-dialogs
- **Type**: terminal
- **Purpose**: Full POS checkout — product grid, cart, payment, customer selection, quotation, ship-later; offline-capable; HID barcode scanner.
- **Tabs / segments**: none. Three-pane layout (top bar + left cart Sider 40% + right product Content).
- **TOP BAR** (POSTerminalShell): config title (name_ku||name); cashier Tag (blue); printer Tag (green/orange, label from `terminal.printerLabel`); Online/Offline button + Badge (WifiOutlined, `t('online')`/`t('offline')`); Sync button `t('pos.sync')` (SyncOutlined, Badge count of syncQueue, spins while syncing); Close `t('close')` (CloseOutlined, danger → /pos).
- **PRODUCT PANEL** (right): Search `t('pos.search_products')` (BarcodeOutlined prefix) + `POSProductGrid` (virtualized, `@tanstack/react-virtual`). Each product Card: name_ku||name, sku, price Tag (formatCurrency). Empty → antd `Empty`. Skeleton cards for loading slots.
- **CART PANEL** (`components/pos/POSCartPanel.tsx`, left Sider):
  - Customer card: UserOutlined + display_name/company_name or Walk-in `t('pos.walk_in_customer')`; button Change/Select `t('change')`/`t('select')`.
  - Cart lines: per line — item_name (strong), sku, delete (DeleteOutlined danger); qty stepper (Minus/InputNumber/Plus), line total (formatCurrency); discount InputNumber (`%` formatter, `t('pos.discount')`) + `@ unit_price`.
  - Totals card: Subtotal `t('subtotal')`, Tax `t('tax')`, Total `t('total')` (Divider between).
  - Action buttons: Payment `t('pos.payment')` (DollarOutlined, primary, disabled empty); Save Draft `t('pos.save_draft')` (SaveOutlined); Discount `t('pos.discount')` (PercentageOutlined); Quotation `t('pos.quotation')` (FileTextOutlined, disabled no order); Ship Later `t('pos.ship_later')` (TruckOutlined, disabled no order); Clear Cart `t('pos.clear_cart')` (danger block).
  - Empty cart: `Empty` `t('pos.cart_empty')`.
- **Dialogs / Modals / Drawers**:
  - **Payment Modal** (`components/pos/POSPaymentModal.tsx`, antd Modal, `t('pos.payment')`): amount banner (total, `t('pos.amount_to_pay')`), live Tags Paid `t('pos.paid')`/Remaining `t('pos.remaining')`/Change `t('pos.change')`; "Select payment method" `t('pos.select_payment_method')` — grid of payment-method buttons (DollarOutlined if cash else CreditCardOutlined, label name_ku||name); selected payments list (per row: method name + amount InputNumber + delete); Validate Payment `t('pos.validate_payment')` (CheckOutlined, disabled until paid≥total). Section header `t('pos.payments')`.
  - **Discount Modal** (`components/pos/POSDiscountModal.tsx`, antd Modal, `t('pos.discount')`): Line select `t('pos.line')` (options per cart line), Radio.Group percent `%` / fixed `t('amount')`, value InputNumber, applied-percent preview `t('pos.applied_percent')`. OK `t('apply')`.
  - **Customer Selector** (`components/pos/POSCustomerSelector.tsx`, FormDialog, `t('pos.select_customer')`): Search `t('pos.search_customer')` (SearchOutlined enterButton); "Quick create customer" `t('pos.quick_create_customer')` (UserAddOutlined dashed) → inline form Name `t('name')` (required) + Phone `t('phone')` + Email `t('email')`, Create/Cancel; customer result cards (display_name/company_name + 📞 phone + ✉️ email, keyboard-accessible). Empty `t('pos.no_customers_found')`; Spin while loading. Toast `t('pos.customer_created')`.
  - **Quotation Dialog** (`components/pos/POSQuotationDialog.tsx`, FormDialog, `t('pos.save_as_quotation')`): Quotation Name `t('pos.quotation_name')` (Input, required, default "Quote #YYYYMMDD-rand"), Valid Until `t('pos.valid_until')` (DatePicker, default +7d), Customer Phone `t('pos.customer_phone')` (Input). Save (block). Toast `t('pos.quotation_saved')`.
  - **Ship Later Dialog** (`components/pos/POSShipLaterDialog.tsx`, FormDialog, TruckOutlined + `t('pos.ship_later')`): Shipping Date `t('pos.shipping_date')` (DatePicker, required, default +1d), section `t('pos.shipping_address')` — Street `t('street')`, City `t('city')`, State `t('state')`, Zip `t('zip')`, Country `t('country')` (default Iraq), Notes `t('notes')` (TextArea `t('pos.shipping_notes')`). Create Sales Order `t('pos.create_sales_order')` (block). Toast `t('pos.ship_later_created')`.
- **Empty / loading / error states**: LoadingSkeleton (card) while terminal loads; redirect to /pos if no sessionId; offline fallback + sync queue. Toasts: `t('pos.item_added')`, `t('pos.customer_selected')`, `t('pos.sales_order_created')`.
- **Notable components used**: Layout/Sider/Content, lazy-loaded panels (POSProductGrid/CartPanel/PaymentModal/DiscountModal via Suspense), usePOSTerminal hook (state+actions), useBarcodeScanner (HID), Badge, Tag, formatCurrency.

### `/pos/configs` — POS Configs / ڕێکخستنەکانی فرۆشگا
- **File**: pages/pos/POSConfigs.tsx
- **Type**: list (+ tabbed config form + hardware wizard modal)
- **Purpose**: Manage POS terminal configurations (general, products, payment, restaurant, hardware) + ESC/POS hardware pairing.
- **Tabs / segments** (inside the config FormDialog, antd Tabs):
  - General — `t('pos.general')`
  - Products — `t('pos.products')`
  - Payment — `t('pos.payment')`
  - Restaurant — `t('pos.restaurant')`
  - Hardware — `t('pos.hardware')`
- **Filters / search**: ExportMenu (csv), ColumnVisibility.
- **Table columns**: Name `t('name')`, Name (KU) `t('name_ku')`, Interface Type `t('pos.iface_type')` (Tag shop/restaurant), Status `t('status')` (active/inactive Tag), Actions `t('actions')`.
- **Header / primary actions (buttons)**: heading `t('pos.configs')`; ExportMenu; ColumnVisibility; Pair Hardware `t('pos.pair_hardware','Pair hardware')` (ApiOutlined); New Config `t('pos.new_config')` (+PlusOutlined).
- **Bulk / row actions**: Edit (EditOutlined); Clone (CopyOutlined → `/clone`); Activate/Deactivate `t('activate')`/`t('deactivate')` (CheckCircleOutlined); Delete (DeleteOutlined + Modal.confirm `t('confirm_delete')`).
- **Dialogs / Modals / Drawers**:
  - **Config Form** (FormDialog, tabbed). Fields by tab:
    - General: Name `t('name')` (required), Name KU `t('name_ku')`, Interface Type `t('pos.iface_type')` (Select shop/restaurant, required), Active `t('active')` (Switch), Cash Control `t('pos.cash_control')` (Switch), Opening Cash Default `t('pos.opening_cash_default')` (InputNumber), Allow Discount `t('pos.allow_discount')` (Switch), Max Discount % `t('pos.max_discount_percent')` (InputNumber 0–100), Receipt Header `t('pos.receipt_header')` (TextArea), Receipt Footer `t('pos.receipt_footer')` (TextArea), Auto Invoice `t('pos.auto_invoice')` (Switch).
    - Products: Default Pricelist `t('pos.default_pricelist')` (Select), Available Pricelists `t('pos.available_pricelists')` (Select multiple), Available Categories `t('pos.available_categories')` (Select multiple).
    - Payment: Payment Methods `t('pos.payment_methods')` (Select multiple), Cash Journal `t('pos.cash_journal_id')` (Input), Card Journal `t('pos.card_journal_id')` (Input).
    - Restaurant: Restaurant Mode `t('pos.restaurant_mode')` (Switch), Floors `t('pos.floors')` (Select multiple, `t('pos.floors_hint')`).
    - Hardware: Barcode Scanner `t('pos.barcode_scanner')`, Customer Display `t('pos.customer_display')`, Print via Proxy `t('pos.iface_print_via_proxy')`, Cash Drawer `t('pos.iface_cashdrawer')`, Scan via Proxy `t('pos.iface_scan_via_proxy')`, Customer-Facing Display `t('pos.iface_customer_facing_display')` (all Switches).
    - Footer buttons: Cancel `t('cancel')`, Create/Update `t('create')`/`t('update')`.
  - **Hardware Pairing Wizard Modal** (antd Modal width 760, `t('pos.pair_hardware')`) → renders `HardwarePairingWizard` (7-step ESC/POS pairing: device→connection→discover→confirm→dialect→test print+cut→drawer+save).
- **Empty / loading / error states**: table loading; toasts success/error.
- **Notable components used**: Tabs, ResponsiveTableAdapter, FormDialog, ColumnVisibility (localStorage `posConfigs.hiddenCols`), ExportMenu, Modal, HardwarePairingWizard, Tag, Switch.

### `/pos/categories` — POS Categories / پۆلەکانی فرۆشگا
- **File**: pages/pos/POSCategories.tsx
- **Type**: other (tree + form)
- **Purpose**: Hierarchical POS product categories with color, image, sequence.
- **Tabs / segments**: none
- **Table columns**: N/A — antd `Tree`. Node title: color dot + name + (name_ku) + inline Edit (EditOutlined), Add subcategory (PlusOutlined, `t('pos.add_subcategory')`), Delete (DeleteOutlined danger).
- **Header / primary actions (buttons)**: Card title `t('pos.categories')`; Add `t('add')` (+PlusOutlined).
- **Bulk / row actions**: per node Edit / Add sub / Delete (Modal.confirm `t('confirm_delete')`).
- **Dialogs / Modals / Drawers** (FormDialog):
  - Add/Edit category. Fields: Name `t('name')` (required), Name KU `t('name_ku')`, Sequence `t('sequence')` (InputNumber), Color `t('pos.color')` (ColorPicker showText), Image URL `t('pos.image_url')` (Input), Parent Category `t('pos.parent_category')` (Input, disabled if adding subcategory).
- **Empty / loading / error states**: error toast.
- **Notable components used**: Tree, Card, FormDialog, ColorPicker, Modal.confirm.

### `/pos/products` — POS Products / بەرهەمەکانی فرۆشگا
- **File**: pages/pos/POSProducts.tsx
- **Type**: list (with bulk "pull from inventory" + inline create)
- **Purpose**: Manage POS-visible product catalog; pull inventory items into POS; create new items; edit POS metadata.
- **Tabs / segments**: none
- **Filters / search**: Search `t('search')` (SearchOutlined, on-enter), Category Select (`t('pos.category')`, flattened tree options + "all" `t('all')`), Search button. ExportMenu (csv), ColumnVisibility.
- **Table columns**: Image `t('pos.image')` (antd Image or —), Name `t('name')`, Name KU `t('name_ku')`, SKU `t('sku')`, Barcode `t('barcode')`, Price `t('price')` (IQD), Category `t('pos.category')` (name lookup), Qty Available `t('qty_available')` (green/red Tag), Actions `t('actions')`.
- **Header / primary actions (buttons)**: Card title `t('pos.products')`; Add from inventory `t('pos.add_existing_items','Add from inventory')` (ImportOutlined primary, testid pos-products-pull-cta); Create new item `t('pos.create_new_item','Create new item')` (PlusOutlined, testid pos-products-create-cta).
- **Bulk / row actions**: row Edit `t('edit')` (EditOutlined).
- **Dialogs / Modals / Drawers** (all FormDialog):
  - **Edit Product** (`t('pos.edit_product')`): Category `t('pos.category')` (Select), Image URL `t('pos.image_url')` (Input), Available in POS `t('pos.available_in_pos')` (Switch).
  - **Pull-from-inventory** (`t('pos.add_existing_items')`): help text `t('pos.pull_help')`; Search `t('pos.pull_search_placeholder')`; Default POS category Select `t('pos.pick_default_category')`; checkbox list of pullable inventory items (name + SKU + price); selected count `t('pos.pull_selected_count')`. Empties: `t('pos.pull_no_results')` / `t('pos.pull_no_pullable')`. Toasts `t('pos.pull_success')`/`t('pos.pull_partial_success')`/warn `t('pos.pull_select_at_least_one')`.
  - **Create new POS item** (`t('pos.create_new_item')`): Name `t('name')` (required), Name KU `t('name_ku')`, SKU `t('sku')`, Barcode `t('barcode')`, Selling Price `t('selling_price')` (InputNumber addonAfter IQD, required), Cost Price `t('cost_price')` (InputNumber IQD), Type `t('item_type')` (Select goods/service `t('enums.item_type.goods')`/`.service`), Unit `t('unit')` (Input), POS Category `t('pos.category')` (Select searchable), Image URL `t('pos.image_url')`, Description `t('description')` (TextArea).
- **Empty / loading / error states**: dedicated empty state (AppstoreAddOutlined) "No POS products yet" `t('pos.no_products_yet')` + help `t('pos.no_products_help')` + Add-from-inventory + Create buttons. Pull list loading text `t('loading')`. Table loading.
- **Notable components used**: Card, ResponsiveTableAdapter, FormDialog ×3, Image, Empty, ColumnVisibility (localStorage `posProducts.hiddenCols`), ExportMenu, Switch, custom checkbox label list.

### `/pos/pricelists` — POS Pricelists / لیستی نرخەکان
- **File**: pages/pos/POSPricelists.tsx
- **Type**: list (+ nested rule builder)
- **Purpose**: Currency-scoped pricelists with multiple pricing rules (fixed/discount/formula, by product/category/all, date-bound).
- **Tabs / segments**: none
- **Filters / search**: none
- **Table columns**: Name `t('name')`, Name KU `t('name_ku')`, Currency `t('pos.currency')` (Tag), Rules Count `t('pos.rules_count')` (Tag), Status `t('status')` (active/inactive), Actions `t('actions')`.
- **Header / primary actions (buttons)**: Card title `t('pos.pricelists')`; Add `t('add')` (+PlusOutlined).
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined + Modal.confirm `t('confirm_delete')`).
- **Dialogs / Modals / Drawers** (FormDialog):
  - Add/Edit Pricelist. Fields: Name `t('name')` (required), Name KU `t('name_ku')`, Currency `t('pos.currency')` (Select IQD/USD), Discount Policy `t('pos.discount_policy')` (Select with_discount/without_discount). Rules `t('pos.pricelist_rules')` (Form.List of Cards "Rule N" `t('pos.rule')`): Applies On `t('pos.applies_on')` (Select all/category/product, required), Product ID `t('pos.product_id')`, Category ID `t('pos.category_id')`, Min Qty `t('pos.min_qty')` (InputNumber), Compute `t('pos.compute')` (Select fixed/discount/formula), Fixed Price `t('pos.fixed_price')` (InputNumber), Discount % `t('pos.discount_percent')` (InputNumber), Date From `t('pos.date_from')` (DatePicker), Date To `t('pos.date_to')` (DatePicker), per-rule remove. "Add rule" `t('pos.add_rule')` (dashed block).
- **Empty / loading / error states**: table loading.
- **Notable components used**: Card, ResponsiveTableAdapter, FormDialog, Form.List (nested rule Cards), DatePicker, Tag, Modal.confirm.

### `/pos/floors` — POS Floors & Tables / نهۆمەکان و مێزەکان
- **File**: pages/pos/POSFloors.tsx
- **Type**: list (floors) + nested editor drawer (tables)
- **Purpose**: Manage restaurant floors per config and their tables (shape/seats/position).
- **Tabs / segments**: none
- **Filters / search**: Config selector (Select, `t('pos.select_config')`) in Card extra.
- **Table columns**:
  - Floors: Name `t('pos.name')`, Name KU `t('pos.name_ku')`, Sequence `t('pos.sequence')`, Status `t('pos.status')` (Tag), Actions `t('actions')`.
  - Tables (in editor drawer): Table Name `t('pos.table_name')`, Seats `t('pos.seats')`, Shape `t('pos.shape')`, State `t('pos.state')` (Tag available/occupied/reserved/paying), Actions.
- **Header / primary actions (buttons)**: Card title `t('pos.floors')`; Config Select; New Floor `t('pos.new_floor')` (+PlusOutlined).
- **Bulk / row actions**: Floors: Edit Floor Plan `t('pos.edit_floor_plan')` (SettingOutlined → opens editor drawer), Edit (EditOutlined), Delete (DeleteOutlined + Modal.confirm `t('pos.delete_floor_confirm')`). Tables: Edit, Delete (Modal.confirm `t('pos.delete_table_confirm')`).
- **Dialogs / Modals / Drawers** (FormDialog):
  - **Floor Form** (`t('pos.new_floor')`/`t('pos.edit_floor')`): Name `t('pos.name')` (required), Name KU `t('pos.name_ku')`, Config `t('pos.config')` (Select, required, disabled on edit), Sequence `t('pos.sequence')` (InputNumber), Background Image URL `t('pos.background_image_url')` (Input), is_active (Select active/inactive).
  - **Floor Plan Editor** (FormDialog `t('pos.floor_plan_editor')`): Add Table `t('pos.add_table')` (+PlusOutlined) + tables table.
  - **Table Form** (`t('pos.add_table')`/`t('pos.edit_table')`): Table Name `t('pos.table_name')` (required, "T1"), Seats `t('pos.seats')` (InputNumber, required), Shape `t('pos.shape')` (Select square/round/rectangle `t('pos.square')`/`.round`/`.rectangle`, required), Width `t('pos.width')` (InputNumber 50–500), Height `t('pos.height')` (50–500), Position X `t('pos.position_x')` (0–1200), Position Y `t('pos.position_y')` (0–800), Color `t('pos.color')` (Input type=color), hidden floor_id/config_id/is_active.
- **Empty / loading / error states**: table loading; success/error toasts.
- **Notable components used**: Card, Row/Col, ResponsiveTableAdapter ×2, FormDialog ×3, Select, InputNumber, Tag, Modal.confirm.

### `/pos/floor-plan/:configId` (Floor Plan view) — POS Floor Plan / نەخشەی نهۆم
- **File**: pages/pos/POSFloorPlan.tsx
- **Type**: board (interactive table map)
- **Purpose**: Live restaurant floor map; click free table to start order, occupied to view/free.
- **Tabs / segments**: antd Tabs per floor (from `usePOSFloorStore`); each tab renders a 1200×800 canvas with absolutely-positioned `TableShape` divs (color by state: available green / occupied red / reserved amber / paying blue; round/rect/square shapes; 👥 guest count on occupied). Note: coordinates `left`/`top` intentionally `rtl-ignore`.
- **KPI / stat cards**: none (table detail drawer has Statistics)
- **Filters / search**: none
- **Header / primary actions (buttons)**: Card title `t('pos.floor_plan')`; Refresh `t('refresh')` (ReloadOutlined); Fullscreen `t('pos.fullscreen')` (FullscreenOutlined).
- **Bulk / row actions**: click table → conditional flow.
- **Dialogs / Modals / Drawers** (FormDialog):
  - **Table Details** (`t('pos.table_details')`): Statistics Table `t('pos.table')` + Guests `t('pos.guests')`; State `t('pos.state')` Tag (`pos.table_state_*`); Order ID `t('pos.order_id')`; buttons View Order `t('pos.view_order')` (→ /pos/orders), Free Table `t('pos.free_table')`.
  - **Enter Guests** (`t('pos.enter_guests')`): prompt `t('pos.how_many_guests')` + InputNumber (1–20); OK → navigate terminal with table_id & guests.
- **Empty / loading / error states**: auto-refresh every 5s; toast `t('pos.no_open_session')`, `t('pos.table_freed')`.
- **Notable components used**: usePOSFloorStore (Zustand), Tabs, Card, custom TableShape, FormDialog, Statistic, Tag, InputNumber.

### `/pos/orders` — POS Orders / داواکاریەکانی فرۆشگا
- **File**: pages/pos/POSOrders.tsx
- **Type**: list (+ detail drawer)
- **Purpose**: Browse POS orders/quotations; view detail; print; refund; convert quotation→order.
- **Tabs / segments**: none
- **Filters / search**: Status Select (`t('status')`, draft/paid/invoiced/cancelled, disabled when quotations-only); "Show quotations only" `t('pos.show_quotations_only')` (Switch). ExportMenu (csv), ColumnVisibility.
- **Table columns**: Order Number `t('pos.order_number')` (link-blue strong), Date `t('date')`, Customer `t('customer')` (or Walk-in), Cashier `t('pos.cashier')`, Total `t('total')`, Status `t('status')` (Tag `pos.order_*` + Refund/quotation_name Tags), Actions `t('actions')`.
- **Header / primary actions (buttons)**: Title `t('pos.orders')`.
- **Bulk / row actions**: View `t('view')` (EyeOutlined); Print `t('print')` (PrinterOutlined → toast `t('pos.printing')`); Convert to Order `t('pos.convert_to_order')` (ShoppingCartOutlined, quotation/draft); Refund `t('pos.refund')` (RollbackOutlined danger, paid non-refund).
- **Dialogs / Modals / Drawers** (FormDialog):
  - **Order Detail** (titled with order_number): Descriptions Date/Customer/Cashier/Status; Order Lines `t('pos.order_lines')` table (Item `t('item')`, Qty `t('qty')`, Price `t('price')`, Total `t('total')`); totals Descriptions Subtotal/Tax/Discount/Total; Payments `t('pos.payments')` table (Payment Method `t('pos.payment_method')`, Amount `t('amount')`) if any.
- **Empty / loading / error states**: react-query loading; toasts `t('pos.refund_feature')`, `t('pos.convert_to_order_info')`.
- **Notable components used**: useListQuery (react-query, listQueryKeys.posOrders), ResponsiveTableAdapter, FormDialog, Descriptions, ColumnVisibility (localStorage `posOrders.hiddenCols`), ExportMenu, Tag, Switch.

### `/pos/sessions` — POS Sessions / سێشنەکانی فرۆشگا
- **File**: pages/pos/POSSessions.tsx
- **Type**: list
- **Purpose**: List register sessions; view detail or resume open session.
- **Tabs / segments**: none
- **Filters / search**: Config Select (`t('pos.config')`); Status Select (`t('status')` opened/closed). ExportMenu (csv), ColumnVisibility.
- **Table columns**: Config `t('pos.config')`, Cashier `t('pos.cashier')`, Opened At `t('pos.opened_at')`, Closed At `t('pos.closed_at')`, Total Sales `t('pos.total_sales')`, Orders `t('pos.orders')`, Status `t('status')` (Tag `pos.state_*`), Actions `t('actions')`.
- **Header / primary actions (buttons)**: Title `t('pos.sessions')`.
- **Bulk / row actions**: View `t('view')` (EyeOutlined → /pos/sessions/:id); Resume `t('pos.resume')` (PlayCircleOutlined, opened only → /pos/terminal/:id).
- **Dialogs / Modals / Drawers**: none
- **Empty / loading / error states**: table loading; error toast.
- **Notable components used**: ResponsiveTableAdapter, ColumnVisibility (localStorage `posSessions.hiddenCols`), ExportMenu, Select, Tag.

### `/pos/sessions/:sessionId` (Session Detail) — POS Session Detail / وردەکاری سێشن
- **File**: pages/pos/POSSessionDetail.tsx
- **Type**: detail (+ cash modals + tabbed sub-tables)
- **Purpose**: Single session: summary KPIs, details, orders/payments/summary tabs, close session, cash in/out, Z-report.
- **Tabs / segments**:
  - Orders — `t('pos.orders')` (count)
  - Payments — `t('pos.payments')` (count)
  - Summary — `t('pos.summary')`
- **KPI / stat cards** (Statistic): Opening Cash `t('pos.opening_cash')`, Total Sales `t('pos.total_sales')`, Total Orders `t('pos.total_orders')`, Cash Difference/Expected Cash `t('pos.cash_difference')`/`t('pos.expected_cash')` (green/red).
- **Filters / search**: none
- **Table columns**:
  - Orders tab: Order Number `t('pos.order_number')`, Date `t('date')`, Customer `t('customer')`, Total `t('total')`, Status `t('status')` (Tag).
  - Payments tab: Payment Method `t('pos.payment_method')`, Amount `t('amount')`, Date `t('date')`.
  - Summary tab: payment-method breakdown `t('pos.payment_methods_breakdown')` + Descriptions Total Tax `t('pos.total_tax')`, Total Discount `t('pos.total_discount')`.
- **Header / primary actions (buttons)**: Back `t('back')` (ArrowLeftOutlined); config name title + state Tag; (opened) Cash In `t('pos.cash_in')` (PlusOutlined), Cash Out `t('pos.cash_out')` (MinusOutlined), Close Session `t('pos.close_session')` (CloseCircleOutlined danger); (closed) Print Z Report `t('pos.print_z_report')` (PrinterOutlined).
- **Details (Descriptions)**: Cashier `t('pos.cashier')`, Opened At `t('pos.opened_at')`, Closed At `t('pos.closed_at')`, Closing Cash Counted/Expected (closed).
- **Dialogs / Modals / Drawers** (FormDialog):
  - **Close Session** (`t('pos.close_session')`): Closing Cash Counted `t('pos.closing_cash_counted')` (InputNumber currency, required), Notes `t('notes')` (TextArea). Submit block.
  - **Cash In** (`t('pos.cash_in')`): Amount `t('amount')` (InputNumber, required), Reason `t('reason')` (Input, required). Add `t('add')`.
  - **Cash Out** (`t('pos.cash_out')`): same fields as Cash In.
- **Empty / loading / error states**: LoadingSkeleton (card); toasts `t('pos.session_closed')`, `t('pos.cash_in_added')`, `t('pos.cash_out_added')`.
- **Notable components used**: Descriptions, Tabs, Statistic, Row/Col, FormDialog ×3, ResponsiveTableAdapter, LoadingSkeleton, Tag.

### `/pos/employees` — POS Employees / کارمەندانی فرۆشگا
- **File**: pages/pos/POSEmployees.tsx
- **Type**: list
- **Purpose**: Manage POS staff (cashier/manager/waiter) with PIN, barcode badge, config access, lockout.
- **Tabs / segments**: none
- **Filters / search**: ExportMenu (csv), ColumnVisibility.
- **Table columns**: Name `t('name')` (+ name_ku subtitle), Role `t('role')` (Tag `pos_role_*`), Configs `t('configs')` (count Tag), Barcode `t('barcode')` (BarcodeOutlined Tag), Status `t('status')` (Locked `t('locked')`/Active/Inactive Tag), Active `t('active')` (Switch toggle), Actions `t('actions')`.
- **Header / primary actions (buttons)**: heading `t('pos_employees')`; ExportMenu; ColumnVisibility; Add Employee `t('add_employee')` (+PlusOutlined).
- **Bulk / row actions**: Edit `t('edit')` (EditOutlined); Reset PIN `t('reset_pin')` (UnlockOutlined → Modal.confirm + prompt for new pin). Inline Active Switch toggles status.
- **Dialogs / Modals / Drawers** (FormDialog):
  - Add/Edit Employee (`t('add_employee')`/`t('edit_employee')`): Name `t('name')` (required), Name KU `t('name_ku')`, PIN `t('pin')` (Input.Password, add-only, 4–6 digits `t('pin_must_be_4_digits')`), Role `t('role')` (Select cashier/manager/waiter `t('pos_role_cashier')` etc, required), Configs `t('configs')` (Select multiple `t('select_configs')`), Barcode `t('barcode')` (Input `t('optional')`), Active `t('active')` (Switch).
- **Empty / loading / error states**: table loading; toasts `t('created_successfully')`/`t('updated_successfully')`/`t('error_saving')`/`t('pin_reset_success')`.
- **Notable components used**: App.useApp message, ResponsiveTableAdapter, FormDialog, ColumnVisibility (localStorage `posEmployees.hiddenCols`), ExportMenu, Switch, Tag, Modal.confirm + native prompt.

### `/pos/loyalty` — Loyalty Programs / بەرنامەکانی دڵسۆزی
- **File**: pages/pos/POSLoyalty.tsx
- **Type**: dashboard (tabbed: Programs + Cards)
- **Purpose**: Manage loyalty/coupon/gift-card/ewallet/promotion programs and issued loyalty cards.
- **Tabs / segments**:
  - Programs — `t('programs')`
  - Loyalty Cards — `t('loyalty_cards')`
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**:
  - Programs: Name `t('name')` (+name_ku), Type `t('type')` (Tag `loyalty_type_*`), Point Ratio `t('point_ratio')` ("N pts / 1000 IQD"), Min Amount `t('min_amount')`, Valid Period `t('valid_period')`, Status `t('status')`, Actions `t('actions')`.
  - Cards: Code `t('code')` (code), Program `t('program')`, Partner `t('partner')`, Points Balance `t('points_balance')` (Tag), Status `t('status')`, Created At `t('created_at')`.
- **Header / primary actions (buttons)**: heading `t('loyalty_programs')`; Add Program `t('add_program')` (+PlusOutlined). Cards tab: Issue Card `t('issue_card')` (GiftOutlined).
- **Bulk / row actions** (Programs): Edit `t('edit')` (EditOutlined); Delete `t('delete')` (DeleteOutlined + Modal.confirm `t('confirm_delete_program')`).
- **Dialogs / Modals / Drawers** (FormDialog):
  - **Add/Edit Program** (`t('add_program')`/`t('edit_program')`): Name `t('name')` (required), Name KU `t('name_ku')`, Type `t('type')` (Select loyalty/coupons/gift_card/ewallet/promotion, required), Point Ratio `t('point_ratio')` (InputNumber addonAfter "pts / 1000 IQD", required), Min Amount `t('min_amount')` (InputNumber), Valid From `t('valid_from')` (DatePicker), Valid To `t('valid_to')` (DatePicker), Applies On `t('applies_on')` (Select current/future/both `t('current_order')`/`t('future_orders')`/`t('both')`, required), Active `t('active')` (Switch).
  - **Issue Loyalty Card** (`t('issue_loyalty_card')`): placeholder — body `t('issue_card_description')`, OK → toast `t('feature_coming_soon')`.
- **Empty / loading / error states**: table loading; toasts created/updated/deleted/error.
- **Notable components used**: App.useApp message, Tabs (Tabs.TabPane), ResponsiveTableAdapter ×2, FormDialog ×2, Switch, DatePicker, Tag, Modal.confirm.

### `/pos/gift-cards` — Gift Cards / کارتی دیاری
- **File**: pages/pos/POSGiftCards.tsx
- **Type**: list (issue single/batch + detail drawer)
- **Purpose**: Issue and manage gift cards (single or batch), activate, view balance/details.
- **Tabs / segments**: none
- **Filters / search**: ExportMenu (csv), ColumnVisibility.
- **Table columns**: Code `t('code')` (BarcodeOutlined + code), Initial Value `t('initial_value')` (IQD), Current Balance `t('current_balance')` (Tag), Status `t('status')` (Not Activated `t('not_activated')`/Expired `t('expired')`/Active Tag), Batch `t('batch')` (Tag), Expiration `t('expiration')` (date or `t('no_expiration')`), Actions `t('actions')`.
- **Header / primary actions (buttons)**: heading `t('gift_cards')`; Issue Single Card `t('issue_single_card')` (PlusOutlined); Issue Batch `t('issue_batch')` (GiftOutlined primary); ExportMenu; ColumnVisibility.
- **Bulk / row actions**: Activate `t('activate')` (not-active only → Modal.confirm `t('activate_gift_card_confirm')`); View `t('view')`.
- **Dialogs / Modals / Drawers** (FormDialog):
  - **Issue Single** (`t('issue_single_gift_card')`): Value `t('value')` (InputNumber 1000–10M step 1000, comma formatter, required), Partner ID `t('partner_id')` (Input `t('optional')`), Expiration Date `t('expiration_date')` (DatePicker).
  - **Issue Batch** (`t('issue_batch_gift_cards')`): Quantity `t('quantity')` (InputNumber 1–1000, required), Value per Card `t('value_per_card')` (InputNumber, required), Expiration Date `t('expiration_date')` (DatePicker).
  - **Gift Card Details** (`t('gift_card_details')`): read-only Code, Initial Value, Current Balance, Status, Activated At, Expires, Created At.
- **Empty / loading / error states**: list loads with placeholder endpoint (`/gift-cards/PLACEHOLDER`) → defaults empty (notes a missing list endpoint). Toasts `t('gift_card_created')`/`t('gift_cards_created')`/`t('gift_card_activated')`/`t('error_saving')`/`t('error_activating')`.
- **Notable components used**: App.useApp message, ResponsiveTableAdapter, FormDialog ×3, ColumnVisibility (localStorage `posGiftCards.hiddenCols`), ExportMenu, DatePicker, Tag, Modal.confirm.

### `/pos/reports` — POS Reports / ڕاپۆرتەکانی فرۆشگا
- **File**: pages/pos/POSReports.tsx
- **Type**: dashboard
- **Purpose**: Sales analytics — KPIs, top products, payment-method split, sales-by-product/cashier tables, hourly heatmap (coming soon).
- **Tabs / segments**: none
- **KPI / stat cards** (Statistic): Total Sales `t('total_sales')` (DollarOutlined, +/- vs previous), Total Orders `t('total_orders')` (ShoppingCartOutlined, +/-), Average Basket `t('average_basket')` (BarChartOutlined), Total Tax `t('total_tax')` (FileTextOutlined).
- **Filters / search**: RangePicker (date range, default last 30d); Refresh `t('refresh')` (ReloadOutlined); Export PDF `t('export_pdf')` (DownloadOutlined).
- **Table columns**:
  - Sales by Product `t('sales_by_product')`: Product `t('product')`, Qty Sold `t('qty_sold')`, Revenue `t('revenue')`, Avg Price `t('avg_price')`, Share `t('share')` (Progress bar).
  - Sales by Cashier `t('sales_by_cashier')`: Cashier `t('cashier')`, Sales `t('sales')` (sortable), Orders `t('orders')` (sortable), Avg Basket `t('avg_basket')` (sortable).
- **Charts**: Top Products `t('top_products')` (Progress list); Sales by Payment Method `t('sales_by_payment_method')` (Progress list).
- **Empty / loading / error states**: "no data" `t('no_data')` per chart; ComingSoon for Hourly Sales Heatmap `t('hourly_sales_heatmap')`.
- **Notable components used**: posApi.reports, Card/Statistic, Row/Col, Progress, RangePicker, ResponsiveTableAdapter, ComingSoon.

### `/pos/customer-display/:configId` — POS Customer Display / نمایشی کڕیار
- **File**: pages/pos/POSCustomerDisplay.tsx
- **Type**: other (full-screen customer-facing display)
- **Purpose**: Customer-facing screen showing current order lines/totals or ads; polls every 2s; auto-fullscreen; RTL (`dir="rtl"`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: N/A — large-font order lines (product_name + qty × + price) and totals: Subtotal `t('subtotal')`, Tax `t('tax')`, Total `t('total')` (IQD). Modes: order / ad / mixed. Ad screen: Welcome `t('welcome')` + 🛒 + `t('pos_system')`.
- **Header / primary actions (buttons)**: none (kiosk display).
- **Dialogs / Modals / Drawers**: none
- **Empty / loading / error states**: LoadingSkeleton (dark) on load; gradient background; `t('welcome')`/`t('your_order')`/`t('iqd')`.
- **Notable components used**: posApi.hardware.getCustomerDisplay, Card, Row/Col, Typography, LoadingSkeleton, polling interval, requestFullscreen.

### `/pos/kitchen/:displayId` — POS Kitchen Display / نمایشی چێشتخانە
- **File**: pages/pos/POSKitchen.tsx
- **Type**: board (KDS kanban by prep stage)
- **Purpose**: Kitchen Display System — preparation orders grouped by stage columns (received/preparing/ready/served); audio chime on new orders; auto-refresh 5s; dark UI.
- **Tabs / segments**: stage columns (default: Received/Preparing/Ready/Served; or `display.stages`).
- **KPI / stat cards**: per-column header shows count.
- **Filters / search**: none
- **Cards**: `PreparationOrderCard` — table_name/order # + elapsed time Tag; line items (qty × item_name + 📝 note + course Tag); advance button "→ <nextStage>" or Complete `t('pos.complete')` (CheckOutlined green) on last stage.
- **Header / primary actions (buttons)**: display name/`t('pos.kitchen_display')` + clock; Refresh `t('refresh')` (ReloadOutlined); Fullscreen `t('pos.fullscreen')` (FullscreenOutlined).
- **Dialogs / Modals / Drawers**: none
- **Empty / loading / error states**: auto-refresh; toast `t('pos.order_completed')`; Web Audio chime on new orders.
- **Notable components used**: Row/Col columns, Card, Tag, Web AudioContext, polling.

### `/pos/self-order/:configId` — POS Self-Order Kiosk / کیۆسکی داواکاری خۆکار
- **File**: pages/pos/POSSelfOrder.tsx
- **Type**: wizard (5-step self-service kiosk)
- **Purpose**: Customer self-ordering kiosk: welcome → menu → review → checkout → confirm; 60s idle reset; language toggle.
- **Tabs / segments / steps**:
  - Step 1 Welcome — `t('welcome')` + `t('touch_to_start_order')` + Start Order `t('start_order')` (ShoppingCartOutlined large).
  - Step 2 Menu — 3 columns: Categories `t('categories')` (All `t('all')` + per-cat buttons), Menu `t('menu')` (product cards, tap to add) + Review Cart `t('review_cart')` (count) extra, Cart `t('cart')` (line cards with qty steppers, Total).
  - Step 3 Review — `t('review_your_order')` (line list + Total) + Back to Menu `t('back_to_menu')` (ArrowLeftOutlined) + Proceed to Checkout `t('proceed_to_checkout')`.
  - Step 4 Checkout — `t('checkout')` form Name `t('name')` + Phone `t('phone')` + Confirm Order `t('confirm_order')`.
  - Step 5 Confirm — ✓ Order Confirmed `t('order_confirmed')` + `t('take_number_to_counter')` + Start New Order `t('start_new_order')`.
- **Header / primary actions (buttons)**: title `t('self_order_kiosk')`; language buttons English / کوردی.
- **Standalone forms & fields**: Checkout — customer_name `t('name')` (Input), customer_phone `t('phone')` (Input) (both optional). Submit Confirm Order.
- **Empty / loading / error states**: cart empty `t('cart_is_empty')`; warns `t('session_timeout')` (idle), `t('cart_is_empty')`; toasts `t('error_loading')`/`t('error_saving')`/`t('error_submitting_order')`.
- **Notable components used**: ResponsiveForm, Card grid, Row/Col, InputNumber steppers, idle-timeout, i18n.changeLanguage.

---

### QUALITY (pages/quality/)

### `/quality` (Dashboard) — Quality Dashboard / داشبۆردی کوالیتی
- **File**: pages/quality/QualityDashboard.tsx
- **Type**: dashboard
- **Purpose**: QC KPIs, recent failed checks, pass/fail trend chart.
- **Tabs / segments**: none
- **KPI / stat cards** (KpiCard): Open Checks `t('quality.open_checks')`, Pass Rate `t('quality.pass_rate')` (%), Open NCR `t('quality.open_ncr')`, Open CAPA `t('quality.open_capa')`.
- **Filters / search**: none
- **Table columns**: Recent Failures `t('quality.recent_failures')`: Product `t('quality.product')`, Notes `t('quality.notes')`, Date `t('quality.date')`.
- **Charts**: Trend `t('quality.trend_chart')` — LineChart pass/fail (`quality.passed`/`quality.failed`, mock 8-week data) via ResponsiveChart.
- **Header / primary actions (buttons)**: PageHeader title `t('quality.dashboard')` + subtitle `t('quality.dashboard_subtitle')`.
- **Empty / loading / error states**: LoadingSkeleton (card); InlineError with retry.
- **Notable components used**: PageHeader, KpiCard, Row/Col (space tokens), ResponsiveTableAdapter, ResponsiveChart (recharts LineChart), InlineError, LoadingSkeleton.

### `/quality/qc-plans` — QC Plans / پلانەکانی کوالیتی
- **File**: pages/quality/QCPlans.tsx
- **Type**: list
- **Purpose**: Quality control points/plans by operation & test type.
- **Tabs / segments**: none
- **Filters / search**: none
- **Table columns**: Plan Name `t('quality.plan_name')`, Operation `t('quality.operation')` (`quality.operation_*`), Test Type `t('quality.test_type')` (`quality.test_*`), Criteria `t('quality.criteria')`, Status `t('status')` (active/inactive), Actions `t('actions')`.
- **Header / primary actions (buttons)**: PageHeader `t('quality.qc_plans')` + subtitle; New Plan `t('quality.new_plan')` (+PlusOutlined).
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined + Popconfirm `t('confirm_delete')`).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit Plan (`t('quality.new_plan')`/`t('quality.edit_plan')`): Plan Name `t('quality.plan_name')` (required), Operation `t('quality.operation')` (Select manufacturing/receiving/delivery/stock_move, required), Test Type `t('quality.test_type')` (Select pass_fail/measure/instructions, required), Product `t('quality.product')` (Input `t('optional')`), Criteria `t('quality.criteria')` (TextArea), Active `t('active')` (Switch). Save/Cancel.
- **Empty / loading / error states**: table loading; toast `t('quality.plan_created')`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Select, Switch, Popconfirm.

### `/quality/qc-checks` — QC Checks / پشکنینەکانی کوالیتی
- **File**: pages/quality/QCChecks.tsx
- **Type**: list
- **Purpose**: Record/execute QC checks with pass/fail and measurement bounds.
- **Tabs / segments**: none
- **Filters / search**: Status Select (`t('quality.filter_by_status')`: pending/pass/fail).
- **Table columns**: Product `t('quality.product')`, Notes `t('quality.notes')`, Measure `t('quality.measure')` (value + min–max range), Status `t('status')` (Tag passed/failed/pending), Date `t('quality.date')`, Actions `t('actions')`.
- **Header / primary actions (buttons)**: PageHeader `t('quality.qc_checks')` + subtitle; New Check `t('quality.new_check')` (+PlusOutlined).
- **Bulk / row actions**: Pass `t('quality.pass')` (CheckOutlined + Popconfirm `t('quality.confirm_pass')`); Fail `t('quality.fail')` (CloseOutlined danger + Popconfirm `t('quality.confirm_fail')`) — only for pending.
- **Dialogs / Modals / Drawers** (FormDialog):
  - New Check (`t('quality.new_check')`): Plan `t('quality.plan')` (Input `t('optional')`), Product `t('quality.product')` (Input), Reference ID `t('quality.reference_id')` (Input `t('optional')`), Reference Type `t('quality.reference_type')` (Input), Measure `t('quality.measure')` (InputNumber), Measure Min `t('quality.measure_min')` (InputNumber), Measure Max `t('quality.measure_max')` (InputNumber), Notes `t('quality.notes')` (TextArea). Save/Cancel.
- **Empty / loading / error states**: table loading; toasts `t('quality.check_created')`/`t('quality.check_passed')`/`t('quality.check_failed')`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Select, Tag, Popconfirm, InputNumber.

### `/quality/non-conformances` — Non-Conformances (NCR) / ناکۆکیەکان
- **File**: pages/quality/NonConformances.tsx
- **Type**: list
- **Purpose**: Track non-conformance reports with severity and optional CAPA link.
- **Tabs / segments**: none
- **Filters / search**: none
- **Table columns**: Title `t('quality.title')`, Severity `t('quality.severity')` (Tag low/medium/high/critical), Product `t('quality.product')`, Detected In `t('quality.detected_in')`, Quantity Affected `t('quality.quantity_affected')`, CAPA Linked `t('quality.capa_linked')` (Tag yes/—), Actions `t('actions')`.
- **Header / primary actions (buttons)**: PageHeader `t('quality.non_conformances')` + subtitle `t('quality.ncr_subtitle')`; New NCR `t('quality.new_ncr')` (+PlusOutlined).
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined + Popconfirm).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit NCR (`t('quality.new_ncr')`/`t('quality.edit_ncr')`): Title `t('quality.title')` (required), Description `t('quality.description')` (TextArea, required), Severity `t('quality.severity')` (Select low/medium/high/critical, required), Product `t('quality.product')` (Input `t('optional')`), Detected In `t('quality.detected_in')` (Input), Quantity Affected `t('quality.quantity_affected')` (Input number). Save/Cancel.
- **Empty / loading / error states**: table loading; toast `t('quality.ncr_created')`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Select, Tag (LinkOutlined for CAPA), Popconfirm.

### `/quality/capa` — CAPA / چارەسەری ڕیشەیی
- **File**: pages/quality/CAPAList.tsx
- **Type**: list
- **Purpose**: Corrective/Preventive Actions with root cause, owner, due date; close action.
- **Tabs / segments**: none
- **Filters / search**: none
- **Table columns**: Title `t('quality.title')`, Root Cause `t('quality.root_cause')`, Assigned To `t('quality.assigned_to')`, Due Date `t('quality.due_date')`, Status `t('status')` (Tag open/closed), Actions `t('actions')`.
- **Header / primary actions (buttons)**: PageHeader `t('quality.capa')` + subtitle; New CAPA `t('quality.new_capa')` (+PlusOutlined).
- **Bulk / row actions**: Edit (EditOutlined); Close `t('quality.close')` (CheckCircleOutlined + Popconfirm `t('quality.confirm_close')`, open only); Delete (DeleteOutlined + Popconfirm).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit CAPA (`t('quality.new_capa')`/`t('quality.edit_capa')`): Title `t('quality.title')` (required), NCR ID `t('quality.ncr_id')` (Input `t('optional')`), Root Cause `t('quality.root_cause')` (TextArea), Corrective Action `t('quality.corrective_action')` (TextArea), Preventive Action `t('quality.preventive_action')` (TextArea), Assigned To `t('quality.assigned_to')` (Input), Due Date `t('quality.due_date')` (DatePicker). Save/Cancel.
- **Empty / loading / error states**: wrapped in `ListWithEmptyState` (entity="capa", onCreate, onRetry) — shows empty-state + retry; table loading. Toasts `t('quality.capa_created')`/`t('quality.capa_closed')`.
- **Notable components used**: PageHeader, ListWithEmptyState (design-system/empty), ResponsiveTableAdapter, FormDialog, DatePicker, Tag, Popconfirm.

---

### MAINTENANCE (pages/maintenance/)

### `/maintenance` (Dashboard) — Maintenance Dashboard / داشبۆردی چاککردنەوە
- **File**: pages/maintenance/MaintenanceDashboard.tsx
- **Type**: dashboard
- **Purpose**: Equipment/maintenance KPIs, request-type & MTBF/MTTR charts, recent requests + overdue schedules, nav shortcuts.
- **Tabs / segments**: none
- **KPI / stat cards** (Statistic): Total Equipment `t('maintenance.total_equipment')` (ToolOutlined), Active Equipment `t('maintenance.active_equipment')` (CheckCircleOutlined green), In Maintenance `t('maintenance.in_maintenance')` (WarningOutlined amber), Broken Equipment `t('maintenance.broken_equipment')` (CloseCircleOutlined red), Open Requests `t('maintenance.open_requests')` (FileTextOutlined), Overdue Schedules `t('maintenance.overdue_schedules')` (ClockCircleOutlined red).
- **Filters / search**: none
- **Table columns**: Recent Requests `t('maintenance.recent_requests')`: Title `t('maintenance.title')`, Status `t('maintenance.status')` (Tag). Overdue Schedules `t('maintenance.overdue_schedules')`: Equipment `t('maintenance.equipment')`, Next Due Date `t('maintenance.next_due_date')` (red).
- **Charts**: Requests by Type `t('maintenance.requests_by_type')` (BarChart, mock); MTBF/MTTR Trend `t('maintenance.mtbf_mttr_trend')` (LineChart, mock) via ResponsiveChart.
- **Header / primary actions (buttons)**: PageHeader title + subtitle; section "view all" `t('view_all')` links; bottom Space: Manage Equipment `t('maintenance.manage_equipment')`, Manage Requests `t('maintenance.manage_requests')`, Manage Schedules `t('maintenance.manage_schedules')`, Manage Categories `t('maintenance.manage_categories')`.
- **Empty / loading / error states**: statistics loading; error toast.
- **Notable components used**: PageHeader, Card/Statistic, Row/Col, ResponsiveChart (recharts Bar+Line), ResponsiveTableAdapter, useNavigate.

### `/maintenance/equipment` — Equipment / ئامێرەکان
- **File**: pages/maintenance/Equipment.tsx
- **Type**: list
- **Purpose**: Manage equipment assets (status, category, location, purchase, warranty).
- **Tabs / segments**: none
- **Filters / search**: Status Select (`t('maintenance.filter_status')`: idle/in_use/maintenance/broken); Category Select (`t('maintenance.filter_category')`).
- **Table columns**: Equipment Name `t('maintenance.equipment_name')`, Serial No `t('maintenance.serial_no')`, Category `t('maintenance.category')`, Location `t('maintenance.location')`, Status `t('maintenance.status')` (Tag idle/in_use/maintenance/broken), Purchase Value `t('maintenance.purchase_value')`, Warranty Until `t('maintenance.warranty_until')`, Actions `t('actions')` (fixed right).
- **Header / primary actions (buttons)**: PageHeader title + subtitle; New Equipment `t('maintenance.new_equipment')` (+PlusOutlined).
- **Bulk / row actions**: View `t('view')` (EyeOutlined → /maintenance/equipment/:id); Edit (EditOutlined); Delete (DeleteOutlined + Popconfirm `t('are_you_sure')`).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit Equipment (`t('maintenance.new_equipment')`/`t('maintenance.edit_equipment')`): Equipment Name `t('maintenance.equipment_name')` (required), Serial No `t('maintenance.serial_no')` (Input), Category `t('maintenance.category')` (SelectWithQuickCreate entity=equipment_category), Location `t('maintenance.location')` (Input), Purchase Date `t('maintenance.purchase_date')` (DatePicker), Purchase Value `t('maintenance.purchase_value')` (InputNumber), Warranty Until `t('maintenance.warranty_until')` (DatePicker), Is Active `t('maintenance.is_active')` (Select active/inactive).
- **Empty / loading / error states**: table loading + horizontal scroll.
- **Notable components used**: PageHeader, ResponsiveTableAdapter (scroll x:1200, fixed actions), FormDialog, SelectWithQuickCreate, DatePicker, Tag, Popconfirm.

### `/maintenance/equipment/:id` (Detail) — Equipment Detail / وردەکاری ئامێر
- **File**: pages/maintenance/EquipmentDetail.tsx
- **Type**: detail (tabbed related data)
- **Purpose**: Single equipment with requests/schedules/logs tabs and log entry.
- **Tabs / segments**:
  - Requests — `t('maintenance.requests')`
  - Schedules — `t('maintenance.schedules')`
  - Logs — `t('maintenance.logs')`
- **KPI / stat cards**: none (Descriptions block)
- **Details (Descriptions)**: Serial No, Category, Location, Purchase Date, Purchase Value, Warranty Until, Status (active/inactive). Header status Tag.
- **Table columns**:
  - Requests: Title `t('maintenance.title')`, Type `t('maintenance.type')` (`maintenance.type_*`), Status `t('maintenance.status')` (Tag).
  - Schedules: Interval Days `t('maintenance.interval_days')`, Description `t('description')`, Next Due Date `t('maintenance.next_due_date')`.
  - Logs: Action `t('maintenance.action')`, Notes `t('maintenance.notes')`, Duration `t('maintenance.duration_minutes')`, Date `t('date')`.
- **Header / primary actions (buttons)**: Back `t('back')` (ArrowLeftOutlined); (Logs tab) New Log `t('maintenance.new_log')` (+PlusOutlined).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New Log (`t('maintenance.new_log')`): Action `t('maintenance.action')` (required), Notes `t('maintenance.notes')` (TextArea), Duration Minutes `t('maintenance.duration_minutes')` (InputNumber).
- **Empty / loading / error states**: each tab wrapped in `RelatedDataPanel` with empty title/description keys (e.g. `maintenance.no_requests_title`/`_description`, `no_schedules_*`, `no_logs_*`). Returns null until equipment loaded.
- **Notable components used**: PageHeader, Descriptions, Tabs, RelatedDataPanel (design-system/empty), ResponsiveTableAdapter, FormDialog, Tag.

### `/maintenance/categories` — Equipment Categories / پۆلەکانی ئامێر
- **File**: pages/maintenance/EquipmentCategories.tsx
- **Type**: list
- **Purpose**: Manage equipment category lookups.
- **Tabs / segments**: none
- **Filters / search**: none
- **Table columns**: Name `t('name')`, Description `t('description')`, Actions `t('actions')` (fixed right).
- **Header / primary actions (buttons)**: PageHeader `t('maintenance.equipment_categories')` + subtitle; New Category `t('maintenance.new_category')` (+PlusOutlined).
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined + Popconfirm).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit Category (`t('maintenance.new_category')`/`t('maintenance.edit_category')`): Name `t('name')` (required), Description `t('description')` (TextArea).
- **Empty / loading / error states**: table loading.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Popconfirm.

### `/maintenance/requests` — Maintenance Requests / داواکاریەکانی چاککردنەوە
- **File**: pages/maintenance/MaintenanceRequests.tsx
- **Type**: list
- **Purpose**: Work requests against equipment with type/priority/status workflow (start/complete/cancel).
- **Tabs / segments**: none
- **Filters / search**: Status Select (`t('maintenance.filter_status')`: new/in_progress/done/cancelled); Type Select (`t('maintenance.filter_type')`: corrective/preventive/inspection); Priority Select (`t('maintenance.filter_priority')`: low/medium/high/urgent).
- **Table columns**: Equipment `t('maintenance.equipment')`, Title `t('maintenance.title')`, Type `t('maintenance.type')`, Priority `t('maintenance.priority')` (Tag), Status `t('maintenance.status')` (Tag), Requested By `t('maintenance.requested_by')`, Assigned To `t('maintenance.assigned_to')`, Scheduled At `t('maintenance.scheduled_at')`, Actions `t('actions')` (fixed right).
- **Header / primary actions (buttons)**: PageHeader title + subtitle; New Request `t('maintenance.new_request')` (+PlusOutlined).
- **Bulk / row actions**: Start `t('maintenance.start')` (PlayCircleOutlined, new); Complete `t('maintenance.complete')` (CheckCircleOutlined, in_progress); Cancel `t('cancel')` (StopOutlined danger, non-terminal); Delete (DeleteOutlined + Popconfirm).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit Request (`t('maintenance.new_request')`/`t('maintenance.edit_request')`): Equipment `t('maintenance.equipment')` (Select `t('maintenance.select_equipment')`, required), Title `t('maintenance.title')` (required), Description `t('description')` (TextArea), Type `t('maintenance.type')` (Select corrective/preventive/inspection, required), Priority `t('maintenance.priority')` (Select low/medium/high/urgent, required), Assigned To `t('maintenance.assigned_to')` (Input), Scheduled At `t('maintenance.scheduled_at')` (DatePicker showTime).
- **Empty / loading / error states**: table loading + scroll x:1500; toasts `t('maintenance.request_started')`/`_completed`/`_cancelled`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Select, DatePicker, Tag, Popconfirm, Row/Col filters.

### `/maintenance/schedules` — Maintenance Schedules / خشتەکانی چاککردنەوە
- **File**: pages/maintenance/MaintenanceSchedules.tsx
- **Type**: list
- **Purpose**: Preventive maintenance schedules (interval + next due) with overdue alert and one-click request generation.
- **Tabs / segments**: none
- **Filters / search**: none
- **Table columns**: Equipment `t('maintenance.equipment')`, Interval Days `t('maintenance.interval_days')` (`N days`), Description `t('description')`, Next Due Date `t('maintenance.next_due_date')` (red+⚠️ if overdue), Actions `t('actions')` (fixed right).
- **Header / primary actions (buttons)**: PageHeader title + subtitle; New Schedule `t('maintenance.new_schedule')` (+PlusOutlined). Overdue `Alert` (warning, `t('maintenance.overdue_warning')` + `t('maintenance.overdue_description')`) when overdue>0.
- **Bulk / row actions**: Generate Request `t('maintenance.generate_request')` (ThunderboltOutlined primary → creates preventive request); Edit (EditOutlined); Delete (DeleteOutlined + Popconfirm).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit Schedule (`t('maintenance.new_schedule')`/`t('maintenance.edit_schedule')`): Equipment `t('maintenance.equipment')` (Select, required), Interval Days `t('maintenance.interval_days')` (InputNumber 1–3650, required), Description `t('description')` (TextArea), Next Due Date `t('maintenance.next_due_date')` (DatePicker).
- **Empty / loading / error states**: Alert for overdue; table loading + scroll x:1100; toast `t('maintenance.request_created')`.
- **Notable components used**: PageHeader, Alert, ResponsiveTableAdapter, FormDialog, Select, DatePicker, InputNumber, Popconfirm.

---

### PLM (pages/plm/)

### `/plm` (Engineering Changes) — Engineering Change Notices (ECN) / گۆڕانکاری ئەندازیاری
- **File**: pages/plm/PLMEngineeringChanges.tsx
- **Type**: list
- **Purpose**: Manage ECNs/ECOs (change/new_part/obsolete/deviation) with priority, status, affected BOMs.
- **Tabs / segments**: none
- **Filters / search**: Search `t('search')` (SearchOutlined, by title); Status Select (`t('plm.filter_status')`: draft/review/approved/implemented/rejected).
- **Table columns**: ECN Number `t('plm.ecn_number')` ("ECN-<id8>"), Title `t('plm.title')`, Product `t('plm.product')`, Change Type `t('plm.change_type')` (Tag `plm.type_*`), Priority `t('plm.priority')` (Tag low/medium/high/urgent), Status `t('plm.status')` (StatusTag), Affected BOMs `t('plm.affected_boms')`, Assigned To `t('plm.assigned_to')`, Actions `t('actions')`.
- **Header / primary actions (buttons)**: PageHeader `t('plm.ecn_title')` + subtitle + breadcrumb (`plm.title` › `plm.ecn_title`); Create ECN `t('plm.create_ecn')` (+PlusOutlined).
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined + Popconfirm `t('confirm_delete')`).
- **Dialogs / Modals / Drawers** (FormDialog):
  - Create/Edit ECN (`t('plm.create_ecn')`/`t('plm.edit_ecn')`): Title `t('plm.title')` (required), Product `t('plm.product')` (Select searchable, required), Change Type `t('plm.change_type')` (Select change/new_part/obsolete/deviation, required), Priority `t('plm.priority')` (Select, default medium), Status `t('plm.status')` (Select, default draft), Reason `t('plm.reason')` (TextArea), Proposed Changes `t('plm.proposed_changes')` (TextArea), Assigned To `t('plm.assigned_to')` (Input), Affected BOMs `t('plm.affected_boms')` (InputNumber, default 0). Save/Cancel.
- **Empty / loading / error states**: table loading + scroll x:1400; toasts `t('plm.ecn_created')`/`_updated`/`_deleted`.
- **Notable components used**: PageHeader (breadcrumb), StatusTag (design-system), ResponsiveTableAdapter, FormDialog, Select, Tag, Popconfirm, Input/SearchOutlined.

---

### REPAIRS (pages/repairs/)

### `/repairs/orders` — Repair Orders / داواکاری چاککردنەوە
- **File**: pages/repairs/RepairOrders.tsx
- **Type**: list
- **Purpose**: Track customer repair orders with status workflow and warranty flag.
- **Tabs / segments**: none
- **Filters / search**: Search `t('search')` (SearchOutlined, by customer/serial); Status Select (`t('repairs.filter_by_status')`: received/diagnosed/in_repair/done/delivered).
- **Table columns**: Customer Name `t('repairs.customer_name')`, Product `t('repairs.product')`, Serial No `t('repairs.serial_no')`, Issue `t('repairs.issue')` (ellipsis), Status `t('repairs.status')` (Tag `repairs.status_*`), Received At `t('repairs.received_at')`, Warranty `t('repairs.warranty')` (yes/no), Actions `t('actions')`.
- **Header / primary actions (buttons)**: PageHeader `t('repairs.repair_orders')` + subtitle; New Order `t('repairs.new_order')` (+PlusOutlined).
- **Bulk / row actions**: View `t('view')` (EyeOutlined → /repairs/orders/:id).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New Order (`t('repairs.new_order')`): Customer Name `t('repairs.customer_name')` (Input, required), Product `t('repairs.product')` (Input), Serial No `t('repairs.serial_no')` (Input), Issue Description `t('repairs.issue_description')` (TextArea, required), Estimated Cost `t('repairs.estimated_cost')` (InputNumber), Under Warranty `t('repairs.under_warranty')` (Switch). Create/Cancel.
- **Empty / loading / error states**: table loading.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Select, Switch, Tag, Input/SearchOutlined.

### `/repairs/orders/:id` (Detail) — Repair Order Detail / وردەکاری چاککردنەوە
- **File**: pages/repairs/RepairOrderDetail.tsx
- **Type**: detail (Steps workflow + Modal.confirm actions)
- **Purpose**: Single repair order with stage progress (Steps) and diagnose→repair→complete→deliver transitions.
- **Tabs / segments**: none. Steps `t('repairs.step_received')`/`step_diagnosed`/`step_repairing`/`step_completed`/`step_delivered`.
- **KPI / stat cards**: none
- **Details (Descriptions)**: Customer Name, Status (Tag), Product, Serial No, Issue Description (span 2), Received At, Estimated Cost, Under Warranty, Assigned To. Plus conditional Diagnosis Notes `t('repairs.diagnosis_notes')` and Completion Notes `t('repairs.completion_notes')` + Final Cost `t('repairs.final_cost')` cards.
- **Header / primary actions (buttons)**: Back `t('back')` (ArrowLeftOutlined); Diagnose `t('repairs.diagnose')` (SearchOutlined, received); Start Repair `t('repairs.start_repair')` (ToolOutlined, diagnosed); Complete `t('repairs.complete')` (CheckCircleOutlined, in_repair); Deliver `t('repairs.deliver')` (SendOutlined, done).
- **Dialogs / Modals / Drawers** (antd Modal.confirm — not FormDialog):
  - Diagnose (`t('repairs.diagnose_title')`): notes TextArea (`t('repairs.diagnose_notes')`, id=diagnose-notes).
  - Start Repair (`t('repairs.confirm_start_repair')`): confirm only.
  - Complete (`t('repairs.complete_title')`): Final Cost Input number (`t('repairs.final_cost_label')`, id=final-cost).
  - Deliver (`t('repairs.confirm_deliver')`): confirm only.
- **Empty / loading / error states**: Card loading; renders order block only when loaded.
- **Notable components used**: PageHeader, Steps, Card, Descriptions, Modal.confirm with imperative DOM-read inputs, Tag.

### `/repairs/warranty-check` — Warranty Check / پشکنینی گەرەنتی
- **File**: pages/repairs/WarrantyCheck.tsx
- **Type**: other (single-field lookup tool)
- **Purpose**: Look up warranty status by serial number; show valid/expired/not-found.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Serial input (`t('repairs.serial_no_placeholder')`, SearchOutlined, Space.Compact with Search button `t('search')`).
- **Table columns**: N/A — result `Descriptions`: Serial No `t('repairs.serial_no')`, Warranty Start `t('repairs.warranty_start')`, Warranty End `t('repairs.warranty_end')`, Coverage Notes `t('repairs.coverage_notes')`. Big CheckCircle/CloseCircle icon + Tag valid `t('repairs.warranty_valid')`/expired `t('repairs.warranty_expired')`.
- **Header / primary actions (buttons)**: PageHeader `t('repairs.warranty_check')` + subtitle; Search button.
- **Dialogs / Modals / Drawers**: none
- **Empty / loading / error states**: not-found Empty (CloseCircleOutlined) + Tag `t('repairs.warranty_not_found')` + `t('repairs.no_warranty_message')`; warn `t('repairs.serial_required')`. Only shows result after search.
- **Notable components used**: PageHeader, Card, Space.Compact, Input/Button, Descriptions, Empty, Tag.

---

### RENTAL (pages/rental/)

### `/rental/products` — Rental Products / بەرهەمەکانی کرێ
- **File**: pages/rental/RentalProducts.tsx
- **Type**: list (with bulk delete)
- **Purpose**: Manage rentable products with daily/weekly/monthly rates, deposit, quantity, availability.
- **Tabs / segments**: none
- **Filters / search**: Search `t('search')` (SearchOutlined, client-side by name). ExportMenu (csv), ColumnVisibility.
- **Table columns**: Product Name `t('rental.product_name')`, Daily Rate `t('rental.daily_rate')`, Weekly Rate `t('rental.weekly_rate')`, Monthly Rate `t('rental.monthly_rate')`, Deposit `t('rental.deposit')`, Quantity `t('rental.quantity')`, Available `t('rental.available')` (yes/no), Actions `t('actions')`. Row selection enabled.
- **Header / primary actions (buttons)**: PageHeader `t('rental.rental_products')` + subtitle; New Product `t('rental.new_product')` (+PlusOutlined); ExportMenu; ColumnVisibility.
- **Bulk / row actions**: row Edit (EditOutlined), Delete (DeleteOutlined danger + Modal.confirm `t('are_you_sure')`). **BulkActionBar**: Delete `t('delete')` (DeleteOutlined danger → `t('data_table_v2.delete_n_confirm')`).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New/Edit Product (`t('rental.new_product')`/`t('edit')`): Product Name `t('rental.product_name')` (Input, required), Daily Rate `t('rental.daily_rate')` (InputNumber), Weekly Rate `t('rental.weekly_rate')` (InputNumber), Monthly Rate `t('rental.monthly_rate')` (InputNumber), Deposit `t('rental.deposit')` (InputNumber), Quantity `t('rental.quantity')` (InputNumber), Available `t('rental.available')` (Switch).
- **Empty / loading / error states**: table loading; toasts success/error.
- **Notable components used**: PageHeader, ResponsiveTableAdapter (rowSelection), FormDialog, BulkActionBar (design-system), ColumnVisibility, ExportMenu, Switch, Modal.confirm.

### `/rental/contracts` — Rental Contracts / گرێبەستەکانی کرێ
- **File**: pages/rental/RentalContracts.tsx
- **Type**: list
- **Purpose**: Manage rental contracts (customer + product + dates + deposit + status).
- **Tabs / segments**: none
- **Filters / search**: Search `t('search')` (SearchOutlined, by customer); Status Select (`t('rental.filter_by_status')`: draft/active/closed).
- **Table columns**: Customer Name `t('rental.customer_name')`, Product `t('rental.product')`, Quantity `t('rental.quantity')`, Start Date `t('rental.start_date')`, End Date `t('rental.end_date')`, Deposit `t('rental.deposit')`, Status `t('rental.status')` (Tag draft/active/closed), Actions `t('actions')`.
- **Header / primary actions (buttons)**: PageHeader `t('rental.rental_contracts')` + subtitle; New Contract `t('rental.new_contract')` (+PlusOutlined).
- **Bulk / row actions**: View `t('view')` (EyeOutlined → /rental/contracts/:id).
- **Dialogs / Modals / Drawers** (FormDialog):
  - New Contract (`t('rental.new_contract')`): Customer Name `t('rental.customer_name')` (Input, required), Product `t('rental.product')` (Select searchable, required), Quantity `t('rental.quantity')` (InputNumber), Start Date `t('rental.start_date')` (DatePicker, required), End Date `t('rental.end_date')` (DatePicker, required), Deposit `t('rental.deposit')` (InputNumber). Create/Cancel.
- **Empty / loading / error states**: table loading.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Select, DatePicker, Tag, Input/SearchOutlined.

### `/rental/contracts/:id` (Detail) — Rental Contract Detail / وردەکاری گرێبەست
- **File**: pages/rental/RentalContractDetail.tsx
- **Type**: detail (Modal.confirm actions)
- **Purpose**: Single rental contract with start/close transitions; shows contract info + product rate card.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Details (Descriptions)**:
  - Contract Info `t('rental.contract_info')`: Customer Name, Status (Tag), Product, Quantity, Start Date, End Date, Period Duration `t('rental.period_duration')` (`t('rental.days_count')`), Deposit, Daily Rate (conditional).
  - Product Rates `t('rental.product_rates')` (if product loaded): Daily/Weekly/Monthly Rate + Deposit.
- **Header / primary actions (buttons)**: Back `t('back')` (ArrowLeftOutlined); Start Contract `t('rental.start_contract')` (PlayCircleOutlined, draft); Close Contract `t('rental.close_contract')` (CloseCircleOutlined danger, active).
- **Dialogs / Modals / Drawers** (antd Modal.confirm):
  - Start (`t('rental.confirm_start')`); Close (`t('rental.confirm_close')`).
- **Empty / loading / error states**: Card loading; renders only when contract loaded.
- **Notable components used**: PageHeader, Card, Descriptions, Modal.confirm, Tag, dayjs duration calc.

---

### CROSS-CUTTING NOTES
- **Shared table**: `ResponsiveTableAdapter` (components/responsive/) — wraps antd Table; desktop table / mobile card list; supports rowSelection, expandable, scroll, pagination.
- **Shared modal/drawer**: `FormDialog` (components/responsive/) — Modal on desktop, bottom-sheet/Drawer on mobile. Props: `open`, `onClose`, `onOk`, `title`, `hideFooter`, `confirmLoading`, `extra`.
- **Quick-create selectors**: `SelectWithQuickCreate` (design-system/empty/) with `entity` = item, account, location, equipment_category, etc.
- **Empty-state wrappers**: `ListWithEmptyState`, `RelatedDataPanel` (design-system/empty/) used in CAPAList and EquipmentDetail.
- **Column visibility / export**: `ColumnVisibility` + `ExportMenu` + `downloadCsv` used across POS list pages (Configs, Employees, GiftCards, Orders, Sessions, Products) and SerialNumbers, RentalProducts. Hidden columns persisted to localStorage (`<page>.hiddenCols`).
- **Charts**: `ResponsiveChart` (recharts wrapper with legendItems) on QualityDashboard and MaintenanceDashboard.
- **Headers**: `PageHeader` (design-system) — title/subtitle/extra/breadcrumb/helpKey/sectionId. Some pages use plain `<h1>/<h2>` + HelpIcon instead (MfgBOMs, MfgOrders, POS list pages).
- **Status tags**: `StatusTag` (design-system) on PLM; most pages use raw antd `Tag` with color maps.
- **POS stores**: `usePOSTerminal` (hook, terminal state+actions), `usePOSFloorStore` (Zustand, floor map). Offline queue (`pos/posOfflineQueue`), HID barcode scanner hook.
- **Currency**: `formatCurrency`/`formatDate` (utils/formatters); many places hardcode IQD via `toLocaleString()`.
- **Messages**: `message` from utils/message (or `App.useApp().message` in POS Employees/GiftCards/Loyalty/SelfOrder).


## ١٠. خەڵک و پەیوەندی / HR · Payroll · Projects · CRM · Marketing · Helpdesk · KB · Subscriptions · DMS · Field Service · Mileage


Scope: HR, Payroll, Projects, Assets, CRM, Activities, Marketing, Helpdesk, KB, Subscriptions, DMS, Field Service, Billing, Mileage.
All paths relative to `frontend/src/`. UI is RTL, antd v6 + React 19. Most labels resolve via `t('key')` where the i18n key IS the label arg (no English fallback unless a 2nd arg is shown). Shared components noted per page: `ResponsiveTableAdapter` (responsive antd Table), `FormDialog` (responsive Modal/Drawer; props `open`/`onOk`/`onClose`/`title`/`hideFooter`/`extra`), `PageHeader`, `KpiCard`, `StatusTag`, `LoadingSkeleton`, `InlineError`, `SelectWithQuickCreate`, `ListWithEmptyState`, `RelatedDataPanel`, `ResponsiveChart`, `ColumnVisibility`, `ExportMenu`, `BulkActionBar`, `FilterBar`, `HelpIcon`, `ChatterWidget`, `ComingSoon`.

---

### HR

### `/hr` (HRDashboard) — HR Dashboard / `hr_dashboard`
- **File**: `pages/HRDashboard.tsx`
- **Type**: dashboard
- **Purpose**: Top-level HR metrics; each KPI card is clickable and navigates to a sub-page.
- **Tabs / segments**: none
- **KPI / stat cards** (antd `Statistic` in clickable `Card`, with colored icon prefix):
  - Total employees — `employees_total` (TeamOutlined, #1677ff → `/hr/employees`)
  - Active employees — `employees_active` (UserOutlined, #16a34a → `/hr/employees?status=active`)
  - Active contracts — `active_contracts` (FileProtectOutlined, #8b5cf6 → `/hr/contracts`)
  - Pending time off — `pending_time_off` (CalendarOutlined, #f59e0b → `/hr/time-off`)
  - Checked-in today — `checked_in_today` (CheckCircleOutlined, #16a34a → `/hr/attendance`)
- **Filters / search**: none
- **Table columns**: none
- **Header / primary actions**: none (page title `h2` = `hr_dashboard`)
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `InlineError` (with onRetry) on error; `LoadingSkeleton variant="card"` while loading (via `useLoadingState`).
- **Notable components used**: Row/Col grid, Statistic, useLoadingState, InlineError, LoadingSkeleton.

### `/hr/employees` (HREmployees) — Employees / `employees`
- **File**: `pages/HREmployees.tsx`
- **Type**: list (+ create/edit form dialog)
- **Purpose**: CRUD list of employees; supports Class-C return-token round-trip (auto-open create on `?returnTo=…&autoOpen=1`, bounce back with `newEmployeeId`).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none (return-context info Alert may appear: `hr.return_hint` "After saving, you'll be sent back to where you came from.")
- **Table columns**: Name (`name`), Email (`email`), Phone (`phone`), Job title (`job_title`), Department (`department` — resolved name or "—"), Hire date (`hire_date`), Status (`status` — Tag green if active else default, label `t(status)`), Actions (`actions`).
- **Header / primary actions**: `h2` = Employees (`employees`); HelpIcon (sectionId hr.employees); Refresh (`refresh`, ReloadOutlined); New employee (`new_employee`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Edit (EditOutlined); Delete (DeleteOutlined danger, Popconfirm title `confirm_archive`).
- **Dialogs / Modals / Drawers**:
  - **Employee form** (FormDialog; title `new_employee`/`edit_employee`): Name (`name`, Input, required) · Email (`email`, Input) · Phone (`phone`, Input) · Department (`department`, Select allowClear, options from departments) · Hire date (`hire_date`, DatePicker) · Status (`status`, Select initial "active": Active/On leave/Terminated — `active`/`on_leave`/`terminated`). When editing, embeds `ChatterWidget` (entityType="employee").
- **Standalone forms & fields**: (form is in dialog above)
- **Empty / loading / error states**: table `loading` from query; info Alert for return context (data-testid `return-context-hint`).
- **Notable components used**: ResponsiveTableAdapter, FormDialog, ChatterWidget, HelpIcon, useListQuery, returnContext utils, Alert.

### `/hr/contracts` (HRContracts) — Contracts / `contracts`
- **File**: `pages/HRContracts.tsx`
- **Type**: list (+ create form dialog)
- **Purpose**: Employment contracts list with create + delete.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Employee (`employee` — resolved name), Type (`type`, Tag), Wage (`wage`, right-aligned, `{value} {currency|IQD}`), Start date (`start_date`), End date (`end_date` or "—"), Status (`status`, Tag green if active), Actions (`actions`).
- **Header / primary actions**: `h2` = Contracts (`contracts`); Refresh (`refresh`, ReloadOutlined); New contract (`new_contract`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Delete (DeleteOutlined danger, Popconfirm `confirm_archive`).
- **Dialogs / Modals / Drawers**:
  - **New contract** (FormDialog; title `new_contract`): Employee (`employee`, Select showSearch, required) · Type (`type`, Select initial "permanent": Permanent/Temporary/Internship — `permanent`/`temporary`/`internship`) · Wage (`wage`, InputNumber, initial 0) · Currency (`currency`, Input, initial "IQD") · Start date (`start_date`, DatePicker, required, initial today) · End date (`end_date`, DatePicker) · Payment frequency (`payment_frequency`, Select initial "monthly": Monthly/Weekly/Daily — `monthly`/`weekly`/`daily`).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: message.error(`error`) on failures.
- **Notable components used**: ResponsiveTableAdapter, FormDialog.

### `/hr/attendance` (HRAttendance) — Attendance / `attendance`
- **File**: `pages/HRAttendance.tsx`
- **Type**: list (check-in/out workflow)
- **Purpose**: Attendance log with check-in / check-out per employee and date-range filter.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Employee Select (placeholder `employee`, allowClear); DatePicker.RangePicker (defaults month-start→today); Refresh button.
- **Table columns**: Employee (`employee` — resolved name), Check-in (`check_in`, formatted datetime or "—"), Check-out (`check_out`, datetime or Tag "open"=`open`), Hours (`hours`, right, `duration_hours` toFixed(2)), Actions (`actions` — Check-out button if open).
- **Header / primary actions**: `h2` = Attendance (`attendance`); HelpIcon (hr.attendance); Refresh (`refresh`); Check in (`check_in`, primary, LoginOutlined, disabled if no employee).
- **Bulk / row actions**: per row — Check out (`check_out`, LogoutOutlined, only if no check_out).
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: inline filter controls only (Select employee + RangePicker).
- **Empty / loading / error states**: message.warning(`select_employee`) if checking in without selection; message.error(`error`).
- **Notable components used**: ResponsiveTableAdapter, HelpIcon, Select, DatePicker.RangePicker, dayjs.

### `/hr/time-off` (HRTimeOff) — Time Off / `time_off`
- **File**: `pages/HRTimeOff.tsx`
- **Type**: list with tabs (+ two form dialogs)
- **Purpose**: Leave requests + leave types management; approve/reject requests.
- **Tabs / segments**: Requests (`requests`); Leave types (`leave_types`).
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns (Requests)**: Employee (`employee`), Leave type (`leave_type`), Start date (`start_date`), End date (`end_date`), Days (`days`), Status (`status` Tag: approved=green/rejected=red/else orange), Actions (`actions` — Approve/Reject when pending).
- **Table columns (Leave types)**: Name (`name`), Days per year (`days_per_year`), Paid (`paid`, Tag yes/no).
- **Header / primary actions**: `h2` = Time off (`time_off`) + HelpIcon (hr.time_off). Per tab: Refresh (`refresh`); New request (`new_request`, primary, PlusOutlined) / New leave type (`new_leave_type`, primary, PlusOutlined).
- **Bulk / row actions**: per request row — Approve (`approve`, primary, CheckOutlined); Reject (`reject`, danger, CloseOutlined).
- **Dialogs / Modals / Drawers**:
  - **New request** (FormDialog; `new_request`): Employee (`employee`, Select showSearch, required) · Leave type (`leave_type`, Select, required) · Date range (`date_range`, RangePicker, required) · Reason (`reason`, TextArea).
  - **New leave type** (FormDialog; `new_leave_type`): Name (`name`, Input, required) · Days per year (`days_per_year`, number Input, initial 0) · Paid (`paid`, Select yes/no, initial true).
- **Standalone forms & fields**: (in dialogs)
- **Empty / loading / error states**: message.error(`error`).
- **Notable components used**: Tabs, ResponsiveTableAdapter, FormDialog, HelpIcon, RangePicker.

---

### Payroll

### `/payroll/rules` (PayrollRules) — Salary Rules / `salary_rules`
- **File**: `pages/PayrollRules.tsx`
- **Type**: list (+ create/edit dialog)
- **Purpose**: Payroll salary-rule definitions (allowances/deductions/tax/social security).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Code (`code`), Name (`name`), Type (`type`, Tag), Amount type (`amount_type`), Amount (`amount`, right — `n%` if percent else number), Active (`active`, Tag yes/no), Actions (`actions`).
- **Header / primary actions**: `h2` = Salary rules (`salary_rules`); Refresh (`refresh`); New rule (`new_rule`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Edit (EditOutlined); Delete (DeleteOutlined danger, Popconfirm `confirm_archive`).
- **Dialogs / Modals / Drawers**:
  - **Rule form** (FormDialog; `new_rule`/`edit_rule`): Code (`code`, Input, required) · Name (`name`, Input, required) · Type (`type`, Select initial "allowance": Allowance/Deduction/Tax/Social security — `allowance`/`deduction`/`tax`/`social_security`) · Amount type (`amount_type`, Select initial "fixed": Fixed/Percent — `fixed`/`percent`) · Amount (`amount`, InputNumber, initial 0) · Active (`active`, Switch, initial true).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: message.error(`error`). Table pagination disabled.
- **Notable components used**: ResponsiveTableAdapter, FormDialog, Switch.

### `/payroll/runs` (PayrollRuns) — Payroll Runs / `payroll_runs`
- **File**: `pages/PayrollRuns.tsx`
- **Type**: list (+ create dialog + run-detail drawer + payslip-detail drawer)
- **Purpose**: Create payroll runs, view payslips, confirm runs, mark payslips paid.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns (Runs)**: Name (`name`), Period (`period` — `start → end`), Employees (`employees`/`employee_count`), Total gross (`total_gross`, right), Total net (`total_net`, right), Status (`status`, Tag confirmed=green else orange), Actions (`actions` — View; Delete danger if not confirmed).
- **Table columns (Payslips, in run drawer)**: Employee (`employee`/`employee_name`), Basic (`basic`, right), Allowances (`allowances`, right), Deductions (`deductions`, right), Net (`net`, right, bold), Status (`status`, Tag paid=green/confirmed=blue/else orange), Actions (`actions` — View; Mark paid if not paid).
- **Table columns (Payslip lines, detail drawer)**: Code (`code`), Name (`name`), Type (`type`), Amount (`amount`, right, red if negative); summary row: Net (`net`) total.
- **Header / primary actions**: `h2` = Payroll runs (`payroll_runs`); HelpIcon (hr.payroll_runs); Refresh (`refresh`); New run (`new_run`, primary, PlusOutlined).
- **Bulk / row actions**: View (`view`), Remove run (DeleteOutlined danger), Confirm run (`confirm_run`, in drawer), Mark paid (`mark_paid`).
- **Dialogs / Modals / Drawers**:
  - **New run** (FormDialog; `new_run`): Name (`name`, Input, required, initial "Payroll YYYY-MM") · Period (`period`, RangePicker, required, initial month).
  - **Run detail** (FormDialog; title=run.name): Confirm run button (`confirm_run`, CheckOutlined if not confirmed); Descriptions (Period, Status, Employees, Total net); payslip table.
  - **Payslip detail** (FormDialog hideFooter; title=employee_name): payslip lines table with Net summary.
- **Standalone forms & fields**: (in dialogs)
- **Empty / loading / error states**: message.success(`confirmed`/`saved`); message.error(`error`).
- **Notable components used**: ResponsiveTableAdapter, FormDialog, Descriptions, Table.Summary, HelpIcon, useListQuery.

---

### Projects

### `/projects` (Projects) — Projects / `projects`
- **File**: `pages/Projects.tsx`
- **Type**: list (+ create dialog)
- **Purpose**: Projects list (subtitle "Projects and timesheets" / `projects_subtitle`); navigates to Gantt per row.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none (server pagination, page_size 20)
- **Table columns**: Name (`name`), Status (`status` — StatusTag, label `t(status)`), Description (`description`), Actions (`actions` — Gantt link).
- **Header / primary actions**: PageHeader title `projects`, helpKey "projects", sectionId projects.list; New project (`new_project`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Gantt (`gantt`, link, BarChartOutlined → `/projects/{id}/gantt`).
- **Dialogs / Modals / Drawers**:
  - **New project** (FormDialog; `new_project`; initial status="active", billing_method="fixed_cost"): Name (`name`, Input, required) · Description (`description`, TextArea) · Customer (`customer`, `SelectWithQuickCreate entity="customer"`, showSearch allowClear).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: message.error(`error`)/success(`success`); table `loading`.
- **Notable components used**: PageHeader, StatusTag, SelectWithQuickCreate, ResponsiveTableAdapter, FormDialog.

### `/projects/:projectId/gantt` (ProjectGantt) — Gantt / `gantt`
- **File**: `pages/ProjectGantt.tsx`
- **Type**: board/timeline (custom CSS Gantt) + 3 form dialogs
- **Purpose**: Per-project Gantt with tasks, dependencies, milestones.
- **Tabs / segments**: none (sections via Divider: Milestones, Dependencies)
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none — custom render: task rows with name + progress bar (billable=green #52c41a, else blue #1890ff, showing `{progress}%`); date-range header (`{min} → {max} ({totalDays} days)`); milestones as Tag (green if done) + due date + "Mark complete" link (`mark_complete`); dependency rows `pred → succ (type)`.
- **Header / primary actions**: PageHeader title=project_name (fallback `gantt`); Back (`back`, ArrowLeftOutlined → /projects); Add task (`add_task`, primary, PlusOutlined); Add dependency (`add_dependency`, PlusOutlined); Add milestone (`add_milestone`, PlusOutlined).
- **Bulk / row actions**: task bar/name click → open task drawer (edit); Mark complete (`mark_complete`) per milestone.
- **Dialogs / Modals / Drawers**:
  - **Task drawer** (FormDialog; `add_task`/`edit_task`; extra=Save button `save`): Name (`name`, Input, required) · Start date (`start_date`, DatePicker) · End date (`end_date`, DatePicker) · Progress (`progress`, InputNumber 0–100, addonAfter "%") · Billable (`billable`, Select: Billable/Non-billable — `billable`/`non_billable`) · Status (`status`, Select: Open/In progress/Completed — `open`/`in_progress`/`completed`).
  - **Dependency modal** (FormDialog; `add_dependency`): Predecessor (`predecessor`, Select tasks, required) · Successor (`successor`, Select tasks, required) · Type (`type`, Select initial finish_to_start: Finish to Start / Start to Start / Finish to Finish — hardcoded labels).
  - **Milestone modal** (FormDialog; `add_milestone`): Name (`name`, Input, required) · Due date (`due_date`, DatePicker, required) · Tasks (`tasks`, Select multiple).
- **Standalone forms & fields**: (in dialogs)
- **Empty / loading / error states**: `no_tasks_gantt` empty message; `no_dependencies`; Card `loading`; message.error(`error`).
- **Notable components used**: PageHeader, FormDialog, Divider, custom CSS bars, dayjs, theme `space` tokens.

---

### Assets

### `/assets` (Assets) — Fixed Assets / `assets` ("Fixed Assets")
- **File**: `pages/Assets.tsx`
- **Type**: list with status tabs + stat cards (+ create/edit dialog + dispose dialog)
- **Purpose**: Fixed assets register with depreciation; depreciate-all, dispose, expandable depreciation schedule, CSV export, column visibility.
- **Tabs / segments**: status filter Tabs — All (`all`), Active (`active`), Fully depreciated (`fully_depreciated`), Disposed (`disposed`).
- **KPI / stat cards** (gradient stat cards):
  - Purchase price total — `purchasePrice` (DollarOutlined, blue #2563eb)
  - Current value total — `currentValue` (FallOutlined, orange #ea580c)
  - Fully depreciated count — `fully_depreciated` (CheckCircleOutlined, green #16a34a, suffix `/ total`)
- **Filters / search**: status Tabs (above); ExportMenu (csv); ColumnVisibility (persisted `assets.hiddenCols`).
- **Table columns**: Name (`name`, bold), `#` (asset_number), Date (`date`/purchase_date), Purchase price (`purchasePrice`, bold IQD), Current value (`currentValue` — IQD + Progress depreciation % + caption), Status (`status` — Tag w/ icon: active=CheckCircle/fully_depreciated=Clock/disposed=Delete), Actions (`actions`). Expandable row → depreciation entries table: Date, Amount, Depreciation (`depreciation`/accumulated), Current value (`currentValue`/book_value).
- **Header / primary actions**: PageHeader title `assets` ("Fixed Assets"), subtitle `assets_subtitle`, sectionId accounting.assets; Depreciate all (`depreciateAll`, ToolOutlined, loading); Create (`create`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Edit (`edit`); Dispose (`dispose`, if active); Delete (DeleteOutlined danger, Popconfirm `are_you_sure`).
- **Dialogs / Modals / Drawers**:
  - **Asset form** (FormDialog hideFooter; `create`/`edit`): Name (`name`, Input, required) · Asset number (`asset_number`, Input) · Description (`description`, TextArea) · Account (`account`, SelectWithQuickCreate entity="account", required) · Depreciation account (`depreciation`+`account`, SelectWithQuickCreate account, required) · Accumulated depreciation account (`accumulated_depreciation_account`, SelectWithQuickCreate account) · Date (`date`/purchase_date, DatePicker, required) · Purchase price (`purchasePrice`, InputNumber, required) · Salvage value (`salvageValue`, InputNumber) · Useful life (`usefulLife`, InputNumber, addonAfter `monthly`, required) · Depreciation method (`depreciation_method`, Select initial straight_line: Straight Line / Declining Balance — hardcoded). Footer buttons Save (`save`)/Cancel (`cancel`).
  - **Dispose** (FormDialog hideFooter; `dispose`; initial disposal_date=today): Amount (`amount`/disposal_amount, InputNumber, required) · Date (`date`/disposal_date, DatePicker, required). Buttons Confirm (`confirm`)/Cancel (`cancel`).
- **Standalone forms & fields**: (in dialogs)
- **Empty / loading / error states**: custom `Empty` (InboxOutlined) with `no_assets_yet` + `no_assets_hint` + New asset CTA (`new_asset`); table `loading`; message.error(`error`).
- **Notable components used**: Tabs, Row/Col Statistic cards, Progress, ColumnVisibility, ExportMenu, SelectWithQuickCreate, ResponsiveTableAdapter (expandable), FormDialog, downloadCsv.

---

### CRM

### `/crm/leads` (CRMLeads) — Leads / `leads`
- **File**: `pages/CRMLeads.tsx`
- **Type**: list (+ create dialog + convert dialog + view drawer)
- **Purpose**: Lead list with create, convert-to-opportunity, archive, export, column visibility.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: ExportMenu (csv); ColumnVisibility (persisted `crmLeads.hiddenCols`).
- **Table columns**: Name (`name`), Company (`company`), Email (`email`), Phone (`phone`), Source (`source`), Stage (`stage` — resolved stage name), Expected revenue (`expected_revenue`, right), Status (`status` — Tag converted=green/archived=default/else blue), Actions (`actions`).
- **Header / primary actions**: PageHeader title `leads`, subtitle "Sales pipeline leads" / `leads_subtitle`, sectionId crm.leads; Refresh (`refresh`, ReloadOutlined); ExportButton (endpoint /api/export/customers); New lead (`new_lead`, primary, PlusOutlined).
- **Bulk / row actions**: per row — View (`view`); Convert (`convert`, SwapOutlined, disabled if converted); Archive (`archive`, danger, Popconfirm `confirm_archive`).
- **Dialogs / Modals / Drawers**:
  - **View lead** (FormDialog hideFooter; title=lead.name): `ChatterWidget` entityType="lead".
  - **New lead** (FormDialog; `new_lead`): Name (`name`, Input, required) · Company (`company`) · Email (`email`) · Phone (`phone`) · Source (`source`, Select: website/referral/event/cold_call/import/whatsapp/other) · Stage (`stage`, Select) · Expected revenue (`expected_revenue`, InputNumber min 0) · Probability (`probability`, InputNumber 0–100).
  - **Convert to opportunity** (FormDialog; `convert_to_opportunity`; initial amount=0, probability=50): Amount (`amount`, InputNumber) · Probability (`probability`, InputNumber 0–100) · Close date (`close_date`, Input "YYYY-MM-DD") · Stage (`stage`, Select).
- **Standalone forms & fields**: (in dialogs)
- **Empty / loading / error states**: message.success(`saved`/`converted`); message.error(`error`); table `loading`.
- **Notable components used**: PageHeader, ColumnVisibility, ExportMenu, ExportButton, ChatterWidget, ResponsiveTableAdapter, FormDialog, useListQuery.

### `/crm/pipeline` (CRMPipeline) — Pipeline / `pipeline`
- **File**: `pages/CRMPipeline.tsx`
- **Type**: board (kanban, drag-and-drop) + create dialog
- **Purpose**: Opportunities kanban by stage; drag cards to change stage; create opportunity.
- **Tabs / segments**: none (columns = stages)
- **KPI / stat cards**: per-column header Tag shows `{count} · {sum amount}`.
- **Filters / search**: none
- **Table columns**: none — kanban columns per stage (top border = stage.color); draggable opportunity cards show name, `{amount} · {probability}%`, close_date; empty column message `drop_here`.
- **Header / primary actions**: `h2` = Pipeline (`pipeline`); HelpIcon (crm.pipeline); Refresh (`refresh`); New opportunity (`new_opportunity`, primary, PlusOutlined).
- **Bulk / row actions**: drag card → onDrop updates stage (optimistic).
- **Dialogs / Modals / Drawers**:
  - **New opportunity** (FormDialog; `new_opportunity`; initial amount=0, probability=50): Name (`name`, Input, required) · Stage (`stage`, Select, required) · Amount (`amount`, InputNumber) · Probability (`probability`, InputNumber 0–100) · Close date (`close_date`, Input "YYYY-MM-DD") · Notes (`notes`, TextArea).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: `LoadingSkeleton variant="card"`; antd `Empty` if no stages; message.error(`error`).
- **Notable components used**: HTML5 drag-and-drop, Card, Tag, FormDialog, HelpIcon, LoadingSkeleton, useLoadingState.

### `/crm/activities` (CRMActivities) — Activities / `activities`
- **File**: `pages/CRMActivities.tsx`
- **Type**: list with stat cards (+ create dialog)
- **Purpose**: CRM activities (calls/emails/meetings/tasks) with done/cancel, status filter, export, column visibility.
- **Tabs / segments**: none
- **KPI / stat cards** (3 plain Cards): Total (`total`), Pending (`pending`, blue), Done (`done`, green).
- **Filters / search**: Status Select (All/Pending/Done — `all`/`pending`/`done`, default pending); ExportMenu (csv); ColumnVisibility (persisted `crmActivities.hiddenCols`).
- **Table columns**: Type (`type` — icon by type: PhoneOutlined/MailOutlined/CalendarOutlined/FileTextOutlined + value), Summary (`summary`), Due date (`due_date`), Status (`status` — Tag done=green/else blue), Actions (`actions`).
- **Header / primary actions**: `h2` = Activities (`activities`); status Select; Refresh (`refresh`); ExportMenu; ColumnVisibility; New activity (`new_activity`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Mark done (`mark_done`, CheckOutlined, disabled if done); Cancel (`cancel`, danger, Popconfirm `confirm_archive`).
- **Dialogs / Modals / Drawers**:
  - **New activity** (FormDialog; `new_activity`; initial type="call"): Type (`type`, Select: call/email/meeting/task, required) · Summary (`summary`, TextArea, required) · Due date (`due_date`, Input "YYYY-MM-DD") · Lead ID (`lead_id`, Input) · Opportunity ID (`opportunity_id`, Input).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: message.error(`error`); table `loading`.
- **Notable components used**: Row/Col stat cards, ColumnVisibility, ExportMenu, ResponsiveTableAdapter, FormDialog.

### `/crm/insights` (CRMInsights) — CRM Insights (Forecast/Reports)
- **File**: `pages/CRMInsights.tsx`
- **Type**: dashboard (KPIs + report tables)
- **Purpose**: Sales forecast, pipeline, won/lost, leaderboard reports.
- **Tabs / segments**: none
- **KPI / stat cards** (4 Statistic cards): Forecasted revenue (`forecasted_revenue`), Open pipeline (`open_pipeline`), Win rate (`win_rate`, suffix %), Average deal size (`average_deal_size`).
- **Filters / search**: none
- **Table columns**:
  - Forecast by month (`forecast_by_month`; ExportButton /api/export/sales-by-customer): Month (`month`), Weighted value (`weighted_value`, right).
  - Pipeline by stage (`pipeline_by_stage`): Stage (`stage` — Tag colored), Count (`count`, right), Value (`value`, right).
  - Top owners (`top_owners`): Owner (`owner`/owner_id), Deals (`deals`, right), Value (`value`, right).
- **Header / primary actions**: none (cards only). Won/lost summary card (`won_lost_summary`): Won (`won`, green) / Lost (`lost`, red) Statistics.
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `LoadingSkeleton variant="card"` (until forecast loads); message.error(`error`).
- **Notable components used**: Row/Col Statistic, ResponsiveTableAdapter (size small), ExportButton, LoadingSkeleton, useLoadingState.

---

### Activities (`pages/activities/`)

### `/activities` (ActivitiesDashboard) — Activities Dashboard / `activities.dashboard`
- **File**: `pages/activities/ActivitiesDashboard.tsx`
- **Type**: dashboard (KPIs + table + pie chart)
- **Purpose**: Org-wide activity overview (uses `/api/chatter/activities/my-due` as data source).
- **Tabs / segments**: none
- **KPI / stat cards** (KpiCard ×4): Total activities (`activities.total_activities`), Pending (`activities.pending`), Done (`activities.done`), Overdue (`activities.overdue`).
- **Filters / search**: none
- **Table columns** (By user, `activities.by_user`): User (`activities.user`/userName), Pending (`activities.pending`, Tag blue), Done (`activities.done`, Tag green), Total (`activities.total`).
- **Header / primary actions**: PageHeader title `activities.dashboard`, subtitle `activities.dashboard_subtitle`; Refresh (`refresh`, ReloadOutlined, loading).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `activities.no_data` for empty pie; message.error(`error`).
- **Notable components used**: KpiCard, ResponsiveTableAdapter, ResponsiveChart + recharts PieChart. Hardcoded Kurdish activity-type labels: مەرام (todo), پەیوەندی (call), کۆبوونەوە (meeting), ئیمەیڵ (email), بارکردن (upload).

### `/activities/my` (MyActivities) — My Activities / `activities.my_activities`
- **File**: `pages/activities/MyActivities.tsx`
- **Type**: board (4 column buckets of cards)
- **Purpose**: Personal activities grouped by Overdue / Today / Upcoming / No due date.
- **Tabs / segments**: 4 column Cards — Overdue (`activities.overdue`, red, count), Today (`activities.today`, amber, count), Upcoming (`activities.upcoming`, blue, count), No due date (`activities.no_due_date`, count).
- **KPI / stat cards**: counts in each column header.
- **Filters / search**: none
- **Table columns**: none — activity cards: type Tag (color by type), summary (bold), notes, due date (`activities.due`), related-to (`activities.related_to`).
- **Header / primary actions**: PageHeader title `activities.my_activities`, subtitle `activities.my_activities_subtitle`; Refresh (`refresh`, ReloadOutlined, loading).
- **Bulk / row actions**: per card — Done (`done`, CheckOutlined); Delete (DeleteOutlined danger, Popconfirm `confirm_delete`).
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: per-column Empty (`activities.no_overdue`, `activities.no_today`, `activities.no_upcoming`, `activities.none`); message.success(`activities.marked_done`/`deleted`); message.error(`error`).
- **Notable components used**: Row/Col Cards, Tag, Popconfirm. Same hardcoded Kurdish type labels + color map (todo=blue, call=green, meeting=purple, email=orange, upload=cyan).

---

### Marketing (`pages/marketing/`)

### `/marketing` (MarketingDashboard) — Marketing Dashboard / `marketing.dashboard`
- **File**: `pages/marketing/MarketingDashboard.tsx`
- **Type**: dashboard (KPIs + line chart + recent table)
- **Purpose**: Marketing overview (campaigns + automations), sends-per-day chart (stubbed), recent campaigns.
- **Tabs / segments**: none
- **KPI / stat cards** (Statistic ×4): Campaigns sent this month (`marketing.campaigns_sent_this_month`, MailOutlined), Total reach (`marketing.total_reach`, SendOutlined), Avg open rate (`marketing.avg_open_rate`, suffix %, EyeOutlined), Active automations (`marketing.active_automations`, ThunderboltOutlined).
- **Filters / search**: none
- **Table columns** (Recent campaigns, `marketing.recent_campaigns`): Name (`marketing.name`), Subject (`marketing.subject`), Status (`marketing.status`), Sent at (`marketing.sent_at`, formatDate), Recipients (`marketing.recipients`). Row click → `/marketing/campaigns/email`.
- **Header / primary actions**: PageHeader title `marketing.dashboard`, subtitle `marketing.dashboard_subtitle`. Chart card `marketing.sends_per_day`.
- **Bulk / row actions**: row click navigation only.
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `InlineError` on error; `LoadingSkeleton variant="card"`; `Empty` (`no_data`) for empty chart.
- **Notable components used**: PageHeader, Statistic, ResponsiveChart + recharts LineChart, ResponsiveTableAdapter, InlineError, LoadingSkeleton.

### `/marketing/campaigns/email` (EmailCampaigns) — Email Campaigns / `marketing.email_campaigns`
- **File**: `pages/marketing/EmailCampaigns.tsx`
- **Type**: list (+ create dialog + stats dialog)
- **Purpose**: Email campaign CRUD, send, clone, delete, view stats.
- **Tabs / segments**: none
- **KPI / stat cards**: (in stats dialog) Sent/Delivered/Opened/Clicked/Bounced/Unsubscribed Statistics.
- **Filters / search**: none
- **Table columns**: Name (`marketing.name`), Subject (`marketing.subject`), Status (`marketing.status`), Sent at (`marketing.sent_at`), Recipients (`marketing.recipients`), Actions (`actions`).
- **Header / primary actions**: PageHeader title `marketing.email_campaigns`, subtitle `marketing.email_campaigns_subtitle`; Create (`create`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Send now (`marketing.send_now`, primary, SendOutlined, if draft); Stats (`marketing.stats`, EyeOutlined); Clone (CopyOutlined → creates "(نووسخە)" copy); Delete (DeleteOutlined danger, Popconfirm `confirm_delete`).
- **Dialogs / Modals / Drawers**:
  - **Create campaign** (FormDialog hideFooter; `marketing.create_campaign`): Name (`marketing.name`, Input, required) · Subject (`marketing.subject`, Input, required) · Body (`marketing.body`, TextArea rows 6) · Audience (`marketing.audience`, Select from audiences). Buttons Create (`create`)/Cancel (`cancel`).
  - **Campaign stats** (FormDialog; `marketing.campaign_stats`): 6 Statistic cards (sent/delivered/opened/clicked/bounced/unsubscribed).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: `loading` text in stats; message.success(`marketing.campaign_sent`/`marketing.campaign_cloned`/`deleted`); message.error(`error`).
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Statistic, formatDate.

### `/marketing/campaigns/sms` (SmsCampaigns) — SMS Campaigns / `marketing.sms_campaigns`
- **File**: `pages/marketing/SmsCampaigns.tsx`
- **Type**: list (+ create dialog)
- **Purpose**: SMS campaign CRUD + send (160-char limit enforced).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Name (`marketing.name`), Body (`marketing.body`, truncated 50 chars), Status (`marketing.status`), Sent at (`marketing.sent_at`), Recipients (`marketing.recipients`), Actions (`actions`).
- **Header / primary actions**: PageHeader title `marketing.sms_campaigns`, subtitle `marketing.sms_campaigns_subtitle`; Create (`create`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Send now (`marketing.send_now`, primary, if draft); Delete (DeleteOutlined danger, Popconfirm `confirm_delete`).
- **Dialogs / Modals / Drawers**:
  - **Create SMS campaign** (FormDialog hideFooter; `marketing.create_sms_campaign`): Name (`marketing.name`, Input, required) · Body (`marketing.body`, TextArea maxLength 160 showCount, required) · Audience (`marketing.audience`, Select). Buttons Create/Cancel.
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: error `marketing.sms_too_long` if >160; message.success(`marketing.sms_sent`/`deleted`); message.error(`error`).
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog.

### `/marketing/segments` (Segments) — Segments / `marketing.segments`
- **File**: `pages/marketing/Segments.tsx`
- **Type**: list (+ create dialog + preview dialog)
- **Purpose**: Marketing audiences/segments; create + preview members + delete.
- **Tabs / segments**: none
- **KPI / stat cards**: none (preview shows total members count `marketing.total_members`)
- **Filters / search**: none
- **Table columns**: Name (`marketing.name`), Source (`marketing.source`, Tag), Actions (`actions`). Preview columns: Name (`marketing.name`), Email (`marketing.email`).
- **Header / primary actions**: PageHeader title `marketing.segments`, subtitle `marketing.segments_subtitle`; Create (`create`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Preview (`marketing.preview`, EyeOutlined); Delete (DeleteOutlined danger, Popconfirm `confirm_delete`).
- **Dialogs / Modals / Drawers**:
  - **Create segment** (FormDialog hideFooter; `marketing.create_segment`): Name (`marketing.name`, Input, required) · Source (`marketing.source`, Select initial "contacts": Contacts/Leads/Manual — `contacts`/`leads`/`marketing.manual`). Buttons Create/Cancel.
  - **Segment preview** (FormDialog hideFooter; `marketing.segment_preview`): Card with member count + members table.
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: message.success(`success`/`deleted`); message.error(`error`); Card `loading` in preview.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Tag.

### `/marketing/automations` (Automations) — Automations / `marketing.automations`
- **File**: `pages/marketing/Automations.tsx`
- **Type**: list + 3-step wizard (in dialog)
- **Purpose**: Marketing automations (trigger → steps); toggle active, delete.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Name (`marketing.name`), Trigger (`marketing.trigger` — event), Steps count (`marketing.steps_count`), Active (`marketing.active`, Switch toggles activate), Actions (`actions`).
- **Header / primary actions**: PageHeader title `marketing.automations`, subtitle `marketing.automations_subtitle`; Create (`create`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Active toggle (Switch → activate endpoint); Delete (DeleteOutlined danger, Popconfirm `confirm_delete`).
- **Dialogs / Modals / Drawers**:
  - **Create automation** (FormDialog hideFooter; `marketing.create_automation`) — Steps component (`marketing.step_1_basic`/`step_2_steps`/`step_3_review`):
    - Step 0: Name (`marketing.name`, Input, required) · Trigger event (`marketing.trigger_event`, Select: Contact created/Invoice paid/Lead qualified — `marketing.trigger_contact_created`/`trigger_invoice_paid`/`trigger_lead_qualified`, required); Next button.
    - Step 1: Add-step buttons — Email (`marketing.step_email`), SMS (`marketing.step_sms`), Wait (`marketing.step_wait`), Tag (`marketing.step_tag`); List of steps with Up/Down (UpOutlined/DownOutlined) + Delete (`delete`); Back/Next.
    - Step 2: Review summary (`marketing.review_automation` + name/trigger/steps_count); Back; Activate (`marketing.activate`, ThunderboltOutlined).
- **Standalone forms & fields**: (in wizard)
- **Empty / loading / error states**: message.success(`success`/`deleted`); message.error(`error`).
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Steps, List, Switch, Tag.

---

### Helpdesk (`pages/helpdesk/`)

### `/helpdesk` (HelpdeskDashboard) — Helpdesk Dashboard / `helpdesk.dashboard`
- **File**: `pages/helpdesk/HelpdeskDashboard.tsx`
- **Type**: dashboard (KPIs + recent table + pie)
- **Purpose**: Ticket stats overview.
- **Tabs / segments**: none
- **KPI / stat cards** (KpiCard ×4): Open tickets (`helpdesk.open_tickets`), SLA breached (`helpdesk.sla_breached`), Avg resolution time (`helpdesk.avg_resolution_time`, placeholder "—"), Total tickets (`helpdesk.total_tickets`).
- **Filters / search**: none
- **Table columns** (Recent tickets, `helpdesk.recent_tickets`): Subject (`helpdesk.subject`, link → ticket), Status (`helpdesk.status` — StatusTag mapped to kind, label `helpdesk.status_{status}`), Priority (`helpdesk.priority` — `helpdesk.priority_{priority}`), Created at (`created_at`).
- **Header / primary actions**: PageHeader title `helpdesk.dashboard`, subtitle `helpdesk.dashboard_subtitle`. By-status pie card `helpdesk.by_status`.
- **Bulk / row actions**: subject link → `/helpdesk/tickets/{id}`.
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `InlineError` on error; `LoadingSkeleton variant="card"`; `Empty` (`no_data`) for empty table/pie.
- **Notable components used**: PageHeader, KpiCard, StatusTag, ResponsiveTableAdapter, ResponsiveChart + recharts PieChart, InlineError, LoadingSkeleton.

### `/helpdesk/tickets` (TicketsList) — Tickets / `helpdesk.tickets`
- **File**: `pages/helpdesk/TicketsList.tsx`
- **Type**: list (+ create dialog) with saved filters + bulk bar + empty-state wrapper
- **Purpose**: Ticket list, bulk close, create.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: `SavedFiltersBar` (pageKey helpdesk_tickets); `BulkActionBar` when rows selected.
- **Table columns**: Subject (`helpdesk.subject`, link → ticket), Status (`helpdesk.status` — StatusTag), Priority (`helpdesk.priority`, Tag — `helpdesk.priority_{priority}`), Created at (`created_at`).
- **Header / primary actions**: PageHeader title `helpdesk.tickets`, subtitle `helpdesk.tickets_subtitle`; Refresh (`refresh`); New ticket (`helpdesk.new_ticket`, primary, PlusOutlined).
- **Bulk / row actions**: rowSelection; bulk action Close (`helpdesk.bulk_close` → Modal.confirm `helpdesk.confirm_bulk_close` → bulk close each).
- **Dialogs / Modals / Drawers**:
  - **New ticket** (FormDialog; `helpdesk.new_ticket`): Subject (`helpdesk.subject`, Input, required) · Description (`description`, TextArea rows 4) · Priority (`helpdesk.priority`, Select initial "medium": low/medium/high/urgent — `helpdesk.priority_*`) · Team (`helpdesk.team`, `SelectWithQuickCreate entity="team"`, options from teams, allowClear — drawer-with-Steps quick-create).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: `ListWithEmptyState entity="ticket"` (onCreate/onRetry); message.success(`saved`/`helpdesk.bulk_closed`); message.error(`error`).
- **Notable components used**: PageHeader, BulkActionBar, StatusTag, SavedFiltersBar, ListWithEmptyState, SelectWithQuickCreate, ResponsiveTableAdapter, FormDialog.

### `/helpdesk/tickets/:id` (TicketDetail) — Ticket Detail
- **File**: `pages/helpdesk/TicketDetail.tsx`
- **Type**: detail (with tabs + reply dialog + assign dialog)
- **Purpose**: Single ticket: resolve/close/reopen/escalate/assign; replies; assign with quick-create employee round-trip.
- **Tabs / segments**: Conversation (`helpdesk.conversation`); Time logs (`helpdesk.time_logs` — empty `helpdesk.no_time_logs`); History (`helpdesk.history` — empty `helpdesk.no_history`).
- **KPI / stat cards**: none (detail Card: Status/Priority/SLA due/Description).
- **Filters / search**: none
- **Table columns**: none (replies List: author + internal Tag + body + timestamp).
- **Header / primary actions**: PageHeader title=subject, subtitle=`#{id8}`; Back (`back`, ArrowLeftOutlined → /helpdesk/tickets); Assign (`helpdesk.assign`); Resolve (`helpdesk.resolve`, CheckOutlined, if not resolved); Reopen (`helpdesk.reopen`, ReloadOutlined, if resolved); Close (`helpdesk.close`, CloseOutlined, if not closed); Escalate (`helpdesk.escalate`, WarningOutlined, danger).
- **Bulk / row actions**: Add reply (`helpdesk.add_reply`, primary).
- **Dialogs / Modals / Drawers**:
  - **Add reply** (FormDialog; `helpdesk.add_reply`): Reply body (`helpdesk.reply_body`, TextArea, required) · Internal note (`is_internal`, native checkbox + `helpdesk.internal_note`).
  - **Assign** (FormDialog; `helpdesk.assign`): Assign to (`helpdesk.assign_to`/user_id, Select showSearch w/ server-search, required; notFoundContent has Empty + "Add new employee" CTA `helpdesk.add_employee` UserAddOutlined; dropdown footer also has add-employee link PlusOutlined). Quick-add navigates to `/hr/employees?returnTo=…&autoOpen=1` and round-trips.
- **Standalone forms & fields**: (in dialogs)
- **Empty / loading / error states**: `LoadingSkeleton variant="card"` while loading/no ticket; replies empty `helpdesk.no_replies`; `no_description`; messages for resolve/close/reopen/escalate/reply/assign.
- **Notable components used**: PageHeader, StatusTag, Tabs, List, FormDialog, LoadingSkeleton, returnContext (save/clear), Empty.

### `/helpdesk/settings` (HelpdeskSettings) — Helpdesk Settings / `helpdesk.settings`
- **File**: `pages/helpdesk/HelpdeskSettings.tsx`
- **Type**: settings list with tabs (+ shared create/edit dialog)
- **Purpose**: Manage Teams, Categories, Tags, SLA policies.
- **Tabs / segments**: Teams (`helpdesk.teams`); Categories (`helpdesk.categories`); Tags (`helpdesk.tags`); SLA policies (`helpdesk.sla_policies`).
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**:
  - Teams: Name (`name`), Description (`description`), Actions (Edit/Delete).
  - Categories: Name (`name`), Color (`color` — swatch), Actions (Delete).
  - Tags: Name (`name`), Color (`color` — swatch), Actions (Delete).
  - SLA policies: Name (`name`), Priority (`helpdesk.priority`), Response minutes (`helpdesk.response_minutes`), Resolution minutes (`helpdesk.resolution_minutes`), Actions (Edit/Delete).
- **Header / primary actions**: PageHeader title `helpdesk.settings`, subtitle `helpdesk.settings_subtitle`. Per tab: Add team (`helpdesk.add_team`) / Add category (`helpdesk.add_category`) / Add tag (`helpdesk.add_tag`) / Add SLA policy (`helpdesk.add_sla_policy`), each primary + PlusOutlined.
- **Bulk / row actions**: per row — Edit (EditOutlined) [teams, SLA]; Delete (DeleteOutlined danger, Popconfirm `confirm_delete`).
- **Dialogs / Modals / Drawers**:
  - **Create/Edit** (FormDialog; `create`/`edit`) — fields depend on active entity:
    - teams: Name (`name`, required) · Description (`description`, TextArea).
    - categories: Name (`name`, required) · Color (`color`, Input type=color, initial #1890ff).
    - tags: Name (`name`, required) · Color (`color`, Input type=color, initial #52c41a).
    - sla-policies: Name (`name`, required) · Priority (`helpdesk.priority`, Select low/medium/high/urgent, initial medium) · Response minutes (`helpdesk.response_minutes`, InputNumber, initial 60) · Resolution minutes (`helpdesk.resolution_minutes`, InputNumber, initial 1440) · Business hours only (`business_hours_only`, Switch, initial true).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: message.success(`created`/`updated`/`deleted`); message.error(`error`).
- **Notable components used**: PageHeader, Tabs, ResponsiveTableAdapter, FormDialog, Switch, Input type=color.

---

### Knowledge Base (`pages/kb/`)

### `/kb` (KnowledgeBase) — Knowledge Base / `kb.knowledge_base`
- **File**: `pages/kb/KnowledgeBase.tsx`
- **Type**: browse/list (category tree + search + article grid + popular list)
- **Purpose**: Browse published KB articles.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: search Input (`kb.search_articles`, SearchOutlined, large); category Tree (`kb.categories`, FolderOutlined) filters by selected category.
- **Table columns**: none — article cards (List grid) show title + views (`kb.views`) + tags; popular list shows title + view count.
- **Header / primary actions**: PageHeader title `kb.knowledge_base`, subtitle `kb.browse_articles`. Cards: `kb.categories`, `kb.articles`, `kb.popular_articles`.
- **Bulk / row actions**: article card/popular link click → `/kb/articles/{id}`.
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: search Input only.
- **Empty / loading / error states**: `InlineError` on error; `LoadingSkeleton variant="row" rows={8}`; `Empty` (`kb.no_articles`) for empty grid/popular.
- **Notable components used**: PageHeader, Tree, List grid, Card.Meta, Input search, InlineError, LoadingSkeleton.

### `/kb/articles/:id` (ArticleView) — Article View
- **File**: `pages/kb/ArticleView.tsx`
- **Type**: detail (article reader + voting + comments)
- **Purpose**: Read article, vote helpful/unhelpful, comment.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none (comments List)
- **Header / primary actions**: PageHeader title=article.title, subtitle=`{kb.views}: {count}`; Edit (`edit`, EditOutlined → `/kb/articles/{id}/edit`).
- **Bulk / row actions**: Helpful (`kb.helpful` + count, LikeOutlined → vote true); Not helpful (`kb.not_helpful` + count, DislikeOutlined → vote false); Add comment (`kb.add_comment`, primary).
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: comment composer — Input (`kb.add_comment_placeholder`) + Add comment button (Space.Compact).
- **Empty / loading / error states**: `LoadingSkeleton variant="card"` while loading/no article; comments empty `kb.no_comments`; message.success(`kb.vote_recorded`/`kb.comment_added`); message.error(`error`).
- **Notable components used**: PageHeader, Card, Tag, List, Divider, Space.Compact, LoadingSkeleton.

### `/kb/articles/:id/edit` (ArticleEditor) — Article Editor / `kb.edit_article` | `kb.new_article`
- **File**: `pages/kb/ArticleEditor.tsx`
- **Type**: form (+ version history dialog)
- **Purpose**: Create/edit article; publish toggle; version history.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none (versions List)
- **Header / primary actions**: PageHeader title `kb.new_article`/`kb.edit_article`; Version history (`kb.version_history`, HistoryOutlined, if id); View (`kb.view`, EyeOutlined, if id → article); Save (`save`, primary, SaveOutlined).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**:
  - **Version history** (FormDialog; `kb.version_history`): List of versions `v{n} — {title}`, edited by (`kb.edited_by`), date; empty `kb.no_versions`.
- **Standalone forms & fields** (main Card form): Title (`kb.title`, Input, required) · Category (`kb.category`, Select allowClear) · Body (`kb.body`, TextArea rows 15, required) · Tags (`kb.tags`, Select mode tags) · Published (`kb.published`, Switch — toggles publish/unpublish endpoint) · Public article (`kb.public_article`, Switch).
- **Empty / loading / error states**: `LoadingSkeleton variant="card"`; message.success(`created`/`updated`/`kb.published`/`kb.unpublished`); message.error(`error`).
- **Notable components used**: PageHeader, Card, Form, Switch, Select tags, List, FormDialog, LoadingSkeleton.

---

### Subscriptions (`pages/subscriptions/`)

### `/subscriptions` (SubscriptionsList) — Subscriptions / `subscription.subscriptions`
- **File**: `pages/subscriptions/SubscriptionsList.tsx`
- **Type**: list (+ create dialog) with filters + AddGate + empty-state wrapper
- **Purpose**: Subscriptions list; pause/resume/cancel/generate-invoice; create.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Status Select (`subscription.filter_status`: trial/active/past_due/paused/cancelled — `subscription.status_*`); Plan Select (`subscription.filter_plan`).
- **Table columns**: Subscription ID (`subscription.subscription_id`, first 8), Contact (`subscription.contact`, first 8), Plan (`subscription.plan` — resolved name), Status (`subscription.status` — Tag colored, `subscription.status_{status}`), Next invoice (`subscription.next_invoice`/next_invoice_date), Actions (`actions`).
- **Header / primary actions**: PageHeader title `subscription.subscriptions`, subtitle `subscription.subscriptions_subtitle`; New subscription (`subscription.new_subscription`, primary, PlusOutlined, data-add-action).
- **Bulk / row actions**: per row (icon buttons) — View (EyeOutlined → detail); if active: Generate invoice (FileTextOutlined), Pause (PauseOutlined), Cancel (StopOutlined danger → Modal.confirm `subscription.confirm_cancel`/`cancel_warning`); if paused: Resume (PlayCircleOutlined).
- **Dialogs / Modals / Drawers**:
  - **New subscription** (FormDialog; `subscription.new_subscription`): Contact (`subscription.contact`, `SelectWithQuickCreate entity="customer"`, required) · Plan (`subscription.plan`, `SelectWithQuickCreate entity="subscription_plan"`, required) · Start date (`subscription.start_date`, DatePicker) · Trial days override (`subscription.trial_days_override`, InputNumber 0–365) · Payment method (`subscription.payment_method`, Input) · Notes (`notes`, TextArea).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: `ListWithEmptyState entity="subscription"`; messages for paused/resumed/cancel_scheduled/invoice_generated; message.error(`error`).
- **Notable components used**: PageHeader, useAddGate, SelectWithQuickCreate, ListWithEmptyState, ResponsiveTableAdapter, FormDialog, Modal.confirm.

### `/subscriptions/:id` (SubscriptionDetail) — Subscription Detail / `subscription.subscription_detail`
- **File**: `pages/subscriptions/SubscriptionDetail.tsx`
- **Type**: detail (+ upgrade dialog)
- **Purpose**: Single subscription: overview + actions + dunning history.
- **Tabs / segments**: none
- **KPI / stat cards**: none (Descriptions overview)
- **Filters / search**: none
- **Table columns** (Dunning history, `subscription.dunning_history`): Attempt number (`subscription.attempt_number`), Action (`subscription.action`), Sent at (`subscription.sent_at`, datetime), Status (`status`, Tag).
- **Header / primary actions**: PageHeader title `subscription.subscription_detail`, subtitle=id; Back (`back`, ArrowLeftOutlined → /subscriptions). Overview card extra (if active): Generate invoice (`subscription.generate_invoice`, FileTextOutlined), Upgrade (`subscription.upgrade`, UploadOutlined), Pause (`subscription.pause`, PauseOutlined), Cancel (`subscription.cancel`, StopOutlined danger); if paused: Resume (`subscription.resume`, PlayCircleOutlined).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**:
  - **Upgrade** (FormDialog; `subscription.upgrade`): Select new plan (`subscription.select_new_plan`, Select of other active plans showing name + price).
  - **Cancel** confirm (Modal.confirm `subscription.confirm_cancel`/`cancel_warning`).
- **Standalone forms & fields**: Descriptions (Status/Plan/Contact/Start date/Current period start+end/Next invoice/Trial end/Cancel at/Cancelled at/Cancel reason — `subscription.*`).
- **Empty / loading / error states**: `loading` text until subscription loads; `RelatedDataPanel entity="billing_event"` empty (`subscription.no_dunning_title`/`subscription.no_dunning_description`); messages for actions.
- **Notable components used**: PageHeader, Descriptions, RelatedDataPanel, ResponsiveTableAdapter, FormDialog, Modal.confirm.

### `/subscriptions/plans` (SubscriptionPlans) — Plans / `subscription.plans`
- **File**: `pages/subscriptions/SubscriptionPlans.tsx`
- **Type**: list (+ create/edit dialog)
- **Purpose**: Subscription plan CRUD.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Code (`subscription.code`), Plan name (`subscription.plan_name`), Price (`subscription.price` — `{price} {currency}`), Billing cycle (`subscription.billing_cycle` — `subscription.cycle_{cycle}`), Trial days (`subscription.trial_days`), Setup fee (`subscription.setup_fee`), Status (`active`/`inactive` Tag), Actions (`actions`).
- **Header / primary actions**: PageHeader title `subscription.plans`, subtitle `subscription.plans_subtitle`; New plan (`subscription.new_plan`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Edit (EditOutlined); Delete (DeleteOutlined danger → Modal.confirm `are_you_sure`).
- **Dialogs / Modals / Drawers**:
  - **Plan form** (FormDialog; `subscription.new_plan`/`subscription.edit_plan`): Code (`subscription.code`, Input maxLength 50, required) · Plan name (`subscription.plan_name`, Input, required) · Price (`subscription.price`, InputNumber, required) · Currency (`currency`, Select IQD/USD, required) · Billing cycle (`subscription.billing_cycle`, Select monthly/quarterly/yearly, required) · Billing interval (`subscription.billing_interval`, InputNumber 1–12, required) · Trial days (`subscription.trial_days`, InputNumber 0–365) · Setup fee (`subscription.setup_fee`, InputNumber) · Description (`description`, TextArea) · Active (`active`, Switch).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: message.success(`success`); message.error(`error`); table `loading`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Switch, Modal.confirm.

### `/subscriptions/dunning` (SubscriptionDunning) — Dunning Queue / `subscription.dunning_queue`
- **File**: `pages/subscriptions/SubscriptionDunning.tsx`
- **Type**: list (past-due queue)
- **Purpose**: Past-due subscriptions; run dunning per row.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Subscription ID (`subscription.subscription_id`, link → detail), Contact (`subscription.contact`, first 8), Status (`subscription.status` — Tag orange), Period end (`subscription.period_end`/current_period_end), Days overdue (`subscription.days_overdue` — Tag red if >7), Actions (`actions` — Run dunning).
- **Header / primary actions**: PageHeader title `subscription.dunning_queue`, subtitle `subscription.dunning_subtitle`; Refresh (`refresh`, ReloadOutlined).
- **Bulk / row actions**: per row — Run dunning (`subscription.run_dunning`, primary, PlayCircleOutlined).
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: empty `subscription.no_past_due`; message.success(`subscription.dunning_sent`); error from response detail or `error`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, Tag, Button.

### `/subscriptions/reports` (SubscriptionReports) — Reports / `subscription.reports`
- **File**: `pages/subscriptions/SubscriptionReports.tsx`
- **Type**: dashboard (KPIs + MRR chart + plan table + churn details)
- **Purpose**: MRR/ARR/active/churn metrics + MRR trend + MRR-by-plan + churn breakdown.
- **Tabs / segments**: none
- **KPI / stat cards** (Statistic ×4): MRR (`subscription.mrr`, DollarOutlined, IQD, colored by growth), ARR (`subscription.arr`, DollarOutlined, IQD), Active subscriptions (`subscription.active_subscriptions`, TeamOutlined), Churn rate (`subscription.churn_rate`, suffix %, colored). MRR card shows growth ±% vs last month (`subscription.vs_last_month`); churn card shows `subscription.last_30_days`.
- **Filters / search**: none
- **Table columns** (MRR by plan, `subscription.mrr_by_plan`): Plan (`subscription.plan`), MRR (`subscription.mrr` — `{mrr} IQD`), Subscriber count (`subscription.subscriber_count`, Tag).
- **Header / primary actions**: PageHeader title `subscription.reports`, subtitle `subscription.reports_subtitle`. Cards: `subscription.mrr_trend`, `subscription.mrr_by_plan`, `subscription.churn_details`.
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none. Churn details: Active at period start (`subscription.active_at_period_start`), Cancelled in period (`subscription.cancelled_in_period`, red), Remaining active (`subscription.remaining_active`, green).
- **Empty / loading / error states**: silent-fail (no error toast); Cards `loading`.
- **Notable components used**: PageHeader, Statistic, ResponsiveChart + recharts LineChart, ResponsiveTableAdapter.

---

### DMS — Document Management (`pages/dms/`)

### `/dms` (DocumentVault) — Document Vault / `dms.vault`
- **File**: `pages/dms/DocumentVault.tsx`
- **Type**: list/grid hybrid (folder tree + filters + bulk) (+ upload dialog + new-folder dialog + bulk dialog)
- **Purpose**: File vault with folder tree, search/filter, list/grid view, bulk delete/tag, upload (placeholder), folders.
- **Tabs / segments**: none (list/grid toggle)
- **KPI / stat cards**: none
- **Filters / search**: search Input (`dms.search`, SearchOutlined, allowClear); Type Select (`dms.type`: PDF/Image/Document/Spreadsheet); Tag Select (`dms.tag`, dynamic); RangePicker (date created); view toggle Button.Group (List/Grid — UnorderedListOutlined/AppstoreOutlined).
- **Table columns (list)**: Document (`dms.document` — file icon + link), Type (`dms.type`/mime_type), Size (`dms.size` — KB), Tags (`dms.tags` — Tags w/ +N), Uploaded by (`dms.uploaded_by`), Modified (`dms.modified`), Actions (`actions`).
- **Header / primary actions**: PageHeader title `dms.vault`, subtitle `dms.vault_subtitle`; Upload (`dms.upload`, UploadOutlined); New folder (`dms.new_folder`, FolderAddOutlined); Bulk actions (`dms.bulk_actions` w/ count, primary, if rows selected).
- **Bulk / row actions**: row icon buttons (Tooltip) — Preview (`dms.preview`, FileOutlined → detail), Download (`dms.download`, DownloadOutlined → open url), Share (`dms.share`, ShareAltOutlined → info toast), Versions (`dms.versions`, HistoryOutlined → detail), Delete (`delete`, DeleteOutlined danger → Modal.confirm). Bulk: Delete (`dms.bulk_delete` → confirm `dms.bulk_delete_confirm`), Add tag to selected.
- **Dialogs / Modals / Drawers**:
  - **Upload** (FormDialog; `dms.upload`): Document name (`dms.document_name`, Input, required) · Folder (`dms.folder`, Select w/ folder icons) · Tags (`dms.tags`, Select mode tags) · URL or file (`dms.url_or_file`, Input "https://...").
  - **New folder** (FormDialog; `dms.new_folder`): Folder name (`dms.folder_name`, Input, required) · Parent folder (`dms.parent_folder`, Select, placeholder `dms.root`) · Description (`description`, TextArea).
  - **Bulk actions** (FormDialog; `dms.bulk_actions`): Bulk delete button (`dms.bulk_delete`, danger); Add tag to selected (`dms.add_tag_to_selected` → Select `dms.select_tag`).
- **Standalone forms & fields**: (in dialogs)
- **Empty / loading / error states**: grid view renders cards (cover icon + actions Download/Share/Delete); message.success/info; message.error(`error`).
- **Notable components used**: PageHeader, Tree, ResponsiveTableAdapter (rowSelection), Card grid, FormDialog, Modal.confirm, RangePicker, Button.Group, file-type icon helper.

### `/dms/:docId` (DocumentDetail) — Document Detail
- **File**: `pages/dms/DocumentDetail.tsx`
- **Type**: detail (preview + metadata + tabs) (+ share dialog + version dialog)
- **Purpose**: View document, preview, metadata, versions/comments/activity/sharing tabs; share, upload version.
- **Tabs / segments**: Versions (`dms.versions`); Comments (`dms.comments` — placeholder "coming soon"); Activity (`dms.activity`); Sharing (`dms.sharing`).
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**:
  - Versions: Version (`dms.version`), Uploaded by (`dms.uploaded_by`), Uploaded at (`dms.uploaded_at`), Notes (`dms.notes`), Actions (Download/Restore — RollbackOutlined).
  - Shares (Sharing tab): Shared with (`dms.shared_with` — public-link Tag or user), Permission (`dms.permission`, Tag), Expires at (`dms.expires_at`), Actions (Revoke `dms.revoke`).
- **Header / primary actions**: PageHeader title=doc.name; Download (`dms.download`, DownloadOutlined); Share (`dms.share`, ShareAltOutlined); Delete (`delete`, DeleteOutlined danger → Modal.confirm).
- **Bulk / row actions**: Upload new version (`dms.upload_new_version`, UploadOutlined); Post comment (`dms.post`, SendOutlined); Generate share link (`dms.generate_share_link`, LinkOutlined).
- **Dialogs / Modals / Drawers**:
  - **Share document** (FormDialog; `dms.share_document`): User email (`dms.user_email`, Input placeholder `dms.email_optional`) · Generate public link (`public_link`, checkbox + `dms.generate_public_link`) · Permission (`dms.permission`, Select view/comment/edit, initial view) · Expiry (`dms.expiry`, DatePicker).
  - **Upload new version** (FormDialog; `dms.upload_new_version`): File URL (`dms.file_url`, Input, required) · Version notes (`dms.version_notes`, TextArea, placeholder `dms.what_changed`).
- **Standalone forms & fields**: comment composer (TextArea `dms.add_comment` + Post). Metadata: Descriptions (name/type/size/uploaded_by/uploaded_at/version/tags).
- **Empty / loading / error states**: `loading` text until doc loads; preview fallback `dms.preview_not_available`; comments empty `dms.no_comments`; activity empty `dms.no_activity`; many placeholder toasts (`dms.comments_coming_soon`, `dms.share_coming_soon`, `dms.restore_coming_soon`).
- **Notable components used**: PageHeader, Descriptions, Tabs, iframe/img preview, List, Avatar, FormDialog, Modal.confirm, ResponsiveTableAdapter.

### `/dms/signatures` (SignatureRequests) — Signature Requests / `dms.signatures`
- **File**: `pages/dms/SignatureRequests.tsx`
- **Type**: list with tabs + 3-step wizard drawer + sign drawer
- **Purpose**: E-signature requests (sent/received); create multi-signer request, sign documents.
- **Tabs / segments**: Sent (`dms.sent`); Received (`dms.received`); Templates (`dms.templates` — `ComingSoon`).
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns (Sent)**: Document (`dms.document` — file icon + name), Signers (`dms.signers` — Avatar.Group), Status (`status` — colored Tag via statusMap), Sent at (`dms.sent_at`), Actions (View/Reminder/Cancel).
- **Table columns (Received)**: Document (`dms.document`), Requested by (`dms.requested_by`), Status (`status`), Received at (`dms.received_at`), Actions (Sign now / View).
- **Header / primary actions**: PageHeader title `dms.signatures`, subtitle `dms.signatures_subtitle`; New request (`dms.new_request`, primary, PlusOutlined).
- **Bulk / row actions**: Sent — View (`dms.view`, EyeOutlined), Send reminder (`dms.send_reminder`, BellOutlined, if pending → info toast), Cancel (`dms.cancel`, CloseCircleOutlined danger, if pending → Modal.confirm). Received — Sign now (`dms.sign_now`, CheckCircleOutlined, if pending), View.
- **Dialogs / Modals / Drawers**:
  - **New signature request** (FormDialog drawer; `dms.new_signature_request`; extra=Send `dms.send`) — Steps (`dms.select_document`/`dms.add_signers`/`dms.configure`):
    - Step 0: Document (`dms.document`/file_id, Select showSearch, required).
    - Step 1: Signers (`dms.signers`, Select mode tags, placeholder `dms.enter_emails`, required); per-signer Role (`dms.role`, Select signer/approver/witness, initial signer).
    - Step 2: Sequential (`sequential`, Checkbox `dms.sequential`) · Message (`dms.message`, TextArea, placeholder `dms.optional_message`) · Due date (`expires_in_days`/`dms.due_date`, Select 7/14/30 `dms.days`, initial 14). Back/Next nav.
  - **Sign document** (FormDialog drawer; `dms.sign_document`): document name + message + preview placeholder (`dms.pdf_preview_here`); if pending: I agree (`dms.i_agree`, Checkbox) + Sign (`dms.sign`, primary, CheckCircleOutlined); else "already signed" Tag (`dms.already_signed`).
- **Standalone forms & fields**: (in wizard/drawer)
- **Empty / loading / error states**: `ComingSoon` for Templates tab; placeholder toasts (`dms.reminder_coming_soon`); message.success(`dms.signature_request_sent`/`dms.document_signed`/`dms.request_cancelled`); message.error(`error`).
- **Notable components used**: PageHeader, Tabs, Steps, Avatar.Group, FormDialog (drawer), Checkbox, ComingSoon, ResponsiveTableAdapter, Modal.confirm.

---

### Field Service (`pages/field-service/`)

### `/field-service` (FieldServiceDashboard) — Field Service Dashboard / `field_service.dashboard`
- **File**: `pages/field-service/FieldServiceDashboard.tsx`
- **Type**: dashboard (KPIs + today's schedule table + bar chart)
- **Purpose**: Field-service overview + today's technician schedule + completion chart (chart data is hardcoded sample).
- **Tabs / segments**: none
- **KPI / stat cards** (Statistic ×4): Open orders (`field_service.open_orders`, FileTextOutlined, blue), Scheduled today (`field_service.scheduled_today`, ClockCircleOutlined, amber), In progress (`field_service.in_progress`, SyncOutlined spin, green), Completed week (`field_service.completed_week`, CheckCircleOutlined, green).
- **Filters / search**: none
- **Table columns** (Today's schedule, `field_service.todays_schedule`): Technician (`field_service.technician`), Today's schedule count (`field_service.todays_schedule`/orders_count, Tag blue), Order details (`field_service.order_details` — list of order links + status Tag).
- **Header / primary actions**: PageHeader title `field_service.dashboard`, subtitle `field_service.title`, breadcrumb (Dashboard/Field Service). Completion-rate card (`field_service.completion_rate`).
- **Bulk / row actions**: order link → `/field-service/orders/{id}`.
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: Card `loading`; message.error(`error`).
- **Notable components used**: PageHeader, Statistic, ResponsiveTableAdapter, ResponsiveChart + recharts BarChart (completed vs total).

### `/field-service/orders` (ServiceOrders) — Service Orders / `field_service.service_orders`
- **File**: `pages/field-service/ServiceOrders.tsx`
- **Type**: list (+ create dialog) with filters + bulk dispatch
- **Purpose**: Service orders list; filter, bulk-dispatch (set scheduled), create.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Status Select (`field_service.filter_status`: draft/scheduled/in_progress/done/cancelled — `field_service.status_*`); Technician Select (`field_service.filter_technician`, showSearch); RangePicker (scheduled date); Bulk dispatch button.
- **Table columns**: Order number (`field_service.order_number`, link), Customer name (`field_service.customer_name`), Address (`field_service.address`, ellipsis), Scheduled at (`field_service.scheduled_at`, datetime), Technician (`field_service.technician`/assigned_worker_name), Status (`field_service.status` — Tag colored, `field_service.status_*`), Priority (`field_service.priority` — Tag colored, `field_service.priority_*`).
- **Header / primary actions**: PageHeader title `field_service.service_orders`, subtitle `field_service.title`, breadcrumb; New order (`field_service.new_order`, primary, PlusOutlined).
- **Bulk / row actions**: rowSelection; Bulk dispatch (`field_service.bulk_dispatch`, SendOutlined → Modal.confirm `confirm` → set status scheduled).
- **Dialogs / Modals / Drawers**:
  - **New order** (FormDialog; `field_service.new_order`): Customer name (`field_service.customer_name`, Input, required) · Address (`field_service.address`, TextArea) · Description (`field_service.description`, TextArea) · Scheduled at (`field_service.scheduled_at`, DatePicker showTime) · Technician (`field_service.technician`, Select active workers, showSearch) · Priority (`field_service.priority`, Select low/normal/high/urgent, initial normal) · Latitude (`field_service.latitude`, InputNumber) · Longitude (`field_service.longitude`, InputNumber).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: message.warning(`select_items`); message.success(`field_service.order_created`/`success`); message.error(`error`); table `loading`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter (rowSelection), FormDialog, RangePicker, Modal.confirm, status/priority color maps.

### `/field-service/orders/:id` (ServiceOrderDetail) — Service Order Detail
- **File**: `pages/field-service/ServiceOrderDetail.tsx`
- **Type**: detail (tabs) (+ complete dialog + cancel dialog)
- **Purpose**: Single order: start/complete/cancel; details + placeholder tabs.
- **Tabs / segments**: Order details (`field_service.order_details`); Time log (`field_service.time_log` — ComingSoon); Parts used (`field_service.parts_used` — ComingSoon); Customer signature (`field_service.customer_signature` — ComingSoon).
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none (Descriptions for details).
- **Header / primary actions**: PageHeader title=`{field_service.order_number}: {num}`, subtitle=customer, breadcrumb; Start order (`field_service.start_order`, primary, PlayCircleOutlined, if scheduled); Complete order (`field_service.complete_order`, primary, CheckCircleOutlined, if in_progress); Cancel order (`field_service.cancel_order`, danger, CloseCircleOutlined, if not done/cancelled).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**:
  - **Complete order** (FormDialog; `field_service.complete_order`): Completion notes (`field_service.completion_notes`, TextArea).
  - **Cancel order** (FormDialog; `field_service.cancel_order`): Cancel reason (`field_service.cancel_reason`, TextArea, required).
- **Standalone forms & fields**: Descriptions (order_number/status/customer_name/priority/address/scheduled_at/technician/description/lat/long/started_at/completed_at/completion_notes/cancel_reason — `field_service.*`).
- **Empty / loading / error states**: `LoadingSkeleton variant="card"` while loading/no order; `ComingSoon` for 3 tabs; messages for start/complete/cancel.
- **Notable components used**: PageHeader, Descriptions, Tabs, FormDialog, LoadingSkeleton, ComingSoon, status/priority color maps.

### `/field-service/technicians` (Technicians) — Technicians / `field_service.technicians`
- **File**: `pages/field-service/Technicians.tsx`
- **Type**: list (+ create/edit dialog)
- **Purpose**: Technician (worker) CRUD.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Technician name (`field_service.technician_name`), Phone (`field_service.technician_phone`), Email (`email`), Skills (`field_service.technician_skills` — Tags), Current load (`field_service.current_load`), Status (`is_active` — Tag `field_service.active`/`inactive`), Actions (`actions`).
- **Header / primary actions**: PageHeader title `field_service.technicians`, subtitle `field_service.title`, breadcrumb; New technician (`field_service.new_technician`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Edit (`edit`, EditOutlined); Delete (`delete`, DeleteOutlined danger → Modal.confirm `confirm_delete`/`delete_warning`).
- **Dialogs / Modals / Drawers**:
  - **Technician form** (FormDialog; `field_service.new_technician`/`field_service.edit_technician`): Name (`field_service.technician_name`, Input, required) · Phone (`field_service.technician_phone`, Input) · Email (`email`, Input type email) · Skills (`field_service.technician_skills`, Input comma-separated, extra `comma_separated`, placeholder "HVAC, Plumbing, Electrical") · Active (`field_service.active`, Switch).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: message.success(`field_service.technician_created`/`_updated`/`_deleted`); message.error(`error`); table `loading`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog, Switch, Modal.confirm.

### `/field-service/dispatch` (DispatchBoard) — Dispatch Board / `field_service.dispatch_board`
- **File**: `pages/field-service/DispatchBoard.tsx`
- **Type**: board (per-technician schedule grid) + unassigned-orders drawer
- **Purpose**: Daily dispatch — technician rows with order cards; assign unassigned orders.
- **Tabs / segments**: none
- **KPI / stat cards**: none (header button shows unassigned count)
- **Filters / search**: DatePicker (selectedDate) in header.
- **Table columns**: Technician (`field_service.technician`, fixed left), Today's schedule (`field_service.todays_schedule (date)` — order cards colored by status, or "No orders" Tag — hardcoded).
- **Header / primary actions**: PageHeader title `field_service.dispatch_board`, subtitle `field_service.title`, breadcrumb; DatePicker; Unassigned orders (`field_service.unassigned_orders` w/ count, primary, PlusOutlined → opens drawer).
- **Bulk / row actions**: assign per unassigned order.
- **Dialogs / Modals / Drawers**:
  - **Unassigned orders** (FormDialog; `field_service.unassigned_orders`): List of orders — each row "Assign order" (`field_service.assign_order`) → inline Select technician (`field_service.select_technician`, showSearch) + Assign (`assign`) + Cancel (`cancel`); empty `no_data`.
- **Standalone forms & fields**: inline assign Select.
- **Empty / loading / error states**: message.warning(`field_service.select_technician`); message.success(`field_service.order_updated`); message.error(`error`); table `loading`; "No orders"/`no_data`.
- **Notable components used**: PageHeader, ResponsiveTableAdapter (fixed col, scroll x), List, Select, FormDialog, DatePicker, dayjs.

---

### Billing — SaaS Tenant Billing (`pages/billing/`)

### `/billing` (TenantBilling) — Subscription & Billing / `billing.title`
- **File**: `pages/billing/TenantBilling.tsx`
- **Type**: dashboard/detail (in-app SaaS billing) (+ PlanPicker modal + cancel modal)
- **Purpose**: Current tenant's plan, trial/past-due/suspended banners, usage bars, invoice history, change/cancel plan. (Spec launch-readiness §R5.6.)
- **Tabs / segments**: none
- **KPI / stat cards**: Current plan card — plan name (name_ku/name_en/slug), status Tag (colored by STATUS_COLOR, label `billing.status.{status}`), price Statistic (`formatMoney` + `/ {billing.cycle.{cycle}}`). Usage card with bars.
- **Filters / search**: none
- **Table columns** (Invoice history, `billing.invoices`): Number (`billing.invoice.number`), Amount (`billing.invoice.amount` — formatMoney), Status (`billing.invoice.status`, Tag), Date (`billing.invoice.date`/issued_at), View link (`billing.invoice.view`, if hosted_url).
- **Header / primary actions**: Title `billing.title` ("Subscription & Billing"). Banners: trial (`billing.trial.banner` + Upgrade now `billing.upgrade_now`), past_due (`billing.past_due.banner`), suspended (`billing.suspended.banner` + Restart `billing.restart`). Current-plan actions: Change plan (`billing.change_plan`, primary → PlanPicker); Cancel subscription (`billing.cancel`, danger, if active & not cancelling); Undo cancellation (`billing.undo_cancel`, if cancel_at_period_end).
- **Bulk / row actions**: invoice View link → hosted_url.
- **Dialogs / Modals / Drawers**:
  - **PlanPicker** (see below).
  - **Cancel** (antd Modal; `billing.cancel.title`; okText `billing.cancel.confirm` "Yes, cancel", danger): body `billing.cancel.body` + reason TextArea (`billing.cancel.reason_placeholder`).
- **Standalone forms & fields**: cancel reason TextArea. Usage bars (UsageBar): Users (`billing.usage.users`), Invoices/month (`billing.usage.invoices`), POS terminals (`billing.usage.pos_terminals`), Storage GB (`billing.usage.storage`) — Progress; "∞" if unlimited.
- **Empty / loading / error states**: full-page Spin while loading/no state; invoices empty `billing.no_invoices`; toasts `billing.errors.load_failed`/`cancel_failed`/`restart_failed`, success `billing.cancelled`/`restarted`.
- **Notable components used**: Alert banners, Card, Statistic, Progress (UsageBar), antd Table, Modal, Typography, PlanPicker. (Hardcoded currency: IQD shows "د.ع", USD `$x.xx`.)

### PlanPicker (modal component, used by TenantBilling) — Choose a plan / `billing.picker.title`
- **File**: `pages/billing/PlanPicker.tsx`
- **Type**: wizard/modal (plan selection + proration preview)
- **Purpose**: Choose/switch SaaS plan with currency + cycle toggles and proration preview→confirm flow.
- **Tabs / segments**: none (3 plan cards: Starter/Growth/Pro from API)
- **KPI / stat cards**: per-plan card — name_ku/name_en, monthly-equivalent price (Title), `/ month` (`billing.picker.per_month`), annual note (`billing.picker.billed_annually`), feature list.
- **Filters / search**: Currency Segmented (`billing.picker.currency` — IQD/USD); Billing cycle Segmented (`billing.picker.cycle` — Monthly `billing.cycle.monthly` / Annual `billing.cycle.annual` w/ "-17%" Tag).
- **Table columns**: none
- **Header / primary actions**: Modal title `billing.picker.title`. Footer: Cancel (`common.cancel`); Preview change (`billing.picker.preview_button`, primary) then Confirm change (`billing.picker.confirm`, primary) after preview.
- **Bulk / row actions**: plan card click selects (CheckCircleFilled marker; "Current plan" Tag `billing.picker.current` if matches).
- **Dialogs / Modals / Drawers**: this IS the modal. Proration preview Alert (`billing.picker.preview.title`) shows Due now (`billing.picker.preview.due_now`).
- **Standalone forms & fields**: Segmented toggles only. Plan feature bullets: users (`billing.picker.users`), invoices/month (`billing.picker.invoices_per_month` or `unlimited_invoices`), POS terminals (`billing.picker.pos_terminals` or `unlimited_pos`), API access (`billing.features.api`), Priority support (`billing.features.priority`), SSO (`billing.features.sso`).
- **Empty / loading / error states**: Spin while loading plans; toasts `billing.errors.plans_load_failed`/`preview_failed`/`apply_failed`, success `billing.plan_changed`.
- **Notable components used**: Modal, Segmented, Card grid, Alert, Tag, Typography, CheckCircleFilled.

---

### Mileage (`pages/mileage/`)

### `/mileage` (MileageLog) — Mileage Log / `mileage.mileage_log`
- **File**: `pages/mileage/MileageLog.tsx`
- **Type**: list (+ create/edit dialog) with FilterBar + BulkActionBar
- **Purpose**: Mileage logs; create/edit, submit (draft→submitted), bulk submit/delete.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: `FilterBar` — Status (`status`: All/Draft/Submitted/Approved/Rejected — `all`/`draft`/`submitted`/`approved`/`rejected`).
- **Table columns**: Date (`date`), Route (`mileage.route` — `{from} → {to}`), Distance km (`mileage.distance_km`, right), Rate per km (`mileage.rate_per_km`, right), Amount (`amount`/total_amount, right, 2-dp), Purpose (`mileage.purpose`, ellipsis), Vehicle (`mileage.vehicle`), Status (`status` — StatusTag, label `t(status)`), Actions (`actions`).
- **Header / primary actions**: PageHeader title `mileage.mileage_log`, subtitle `mileage.log_subtitle`; New log (`mileage.new_log`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Edit (EditOutlined); Submit (`submit`, primary, SendOutlined, if draft); Delete (DeleteOutlined danger, Popconfirm `confirm_delete`). Bulk (BulkActionBar): Submit (`submit`, CheckOutlined), Delete (`delete`, danger).
- **Dialogs / Modals / Drawers**:
  - **Mileage log form** (FormDialog; `mileage.new_log`/`mileage.edit_log`): Date (`date`, DatePicker, required) · From location (`mileage.from_location`, Input, required) · To location (`mileage.to_location`, Input, required) · Distance km (`mileage.distance_km`, InputNumber, required) · Rate per km (`mileage.rate_per_km`, InputNumber step 0.1, required) · Purpose (`mileage.purpose`, TextArea, required) · Vehicle (`mileage.vehicle`, Input) · Notes (`notes`, TextArea) · Status (`status`, Select draft/submitted, initial draft).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: message.success(`saved`/`updated`/`deleted`/`mileage.submitted`/`mileage.bulk_submitted`); message.error(`error`); table `loading`.
- **Notable components used**: PageHeader, StatusTag, FilterBar, BulkActionBar, ResponsiveTableAdapter (rowSelection), FormDialog, dayjs.

### `/mileage/rates` (MileageRates) — Mileage Rates / `mileage.rates_title`
- **File**: `pages/mileage/MileageRates.tsx`
- **Type**: list (+ create/edit dialog)
- **Purpose**: Mileage rate-per-km by vehicle type (with static fallback if API empty).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Vehicle type (`mileage.vehicle_type`), Rate per km (`mileage.rate_per_km`, right, 2-dp), Description (`description`, ellipsis), Actions (`actions`).
- **Header / primary actions**: PageHeader title `mileage.rates_title`, subtitle `mileage.rates_subtitle`; New rate (`mileage.new_rate`, primary, PlusOutlined).
- **Bulk / row actions**: per row — Edit (EditOutlined); Delete (DeleteOutlined danger, Popconfirm `confirm_delete`).
- **Dialogs / Modals / Drawers**:
  - **Rate form** (FormDialog; `mileage.new_rate`/`mileage.edit_rate`): Vehicle type (`mileage.vehicle_type`, Input, required, placeholder `mileage.vehicle_type_placeholder`) · Rate per km (`mileage.rate_per_km`, InputNumber step 0.1, required) · Description (`description`, TextArea).
- **Standalone forms & fields**: (in dialog)
- **Empty / loading / error states**: static fallback rows (Car/Motorbike/Truck) on fetch error; message.success(`saved`/`updated`/`deleted`); message.error(`error`); pagination disabled.
- **Notable components used**: PageHeader, ResponsiveTableAdapter, FormDialog.


## ١١. پیشەسازی تایبەت و پلاتفۆرم / Verticals · AI · IoT · Studio · Storefront · Portals · Module Hub · Dashboards


Structural inventory of `frontend/src/pages/` for the assigned set. RTL Kurdish-Sorani ERP, antd v6 + React 19.

Shared conventions observed across this set:
- Most pages use `PageHeader` (from `design-system`) with `title` + `subtitle` + `extra` (action buttons). `extra` is the primary header action slot.
- Tables are rendered via `ResponsiveTableAdapter` (wraps antd Table, mobile-card fallback). Forms/detail modals use `FormDialog` (from `components/responsive/FormDialog`) which behaves as a Modal on desktop and bottom-sheet/drawer on mobile — props seen: `open`, `onOk`/`onClose`/`onCancel`, `footer`, `confirmLoading`, `extra`.
- Empty/loading/error: `ListWithEmptyState`, `EmptyState`, `RelatedDataPanel`, `LoadingSkeleton` (`variant="card"`), `InlineError` (with `onRetry`), `useLoadingState(loading)` → `showSkeleton`. antd `Empty`, `Spin`, `Result` also used.
- i18n via `t('key','English fallback')`. Many vertical/AI/storefront/portal pages use **bare keys without a fallback** (the EN string lives in locale JSON, not in source). IoT pages consistently include EN fallbacks inline. Verticals (construction, real-estate, agriculture) and the Module Hub use the shared `utils/message` wrapper instead of antd `message` directly.
- KPI/stat cards: `KpiCard` (design-system, props `title`/`value`/`icon`/`tone`/`suffix`/`trend`/`onClick`) on some pages; raw antd `Statistic` inside `Card` on others (AI dashboard, IoT, portals).

---

### HEALTHCARE (`/healthcare/*`)

### `/healthcare/patients` — Patients List / نەخۆشەکان (`healthcare.patients`)
- **File**: pages/healthcare/PatientsList.tsx
- **Type**: list
- **Purpose**: CRUD list of clinic patients.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Search `Input` (prefix SearchOutlined, placeholder `healthcare.search_patient`) — client-side filter on name/phone.
- **Table columns**: Name (`healthcare.name`, sortable), Phone (`healthcare.phone`), DOB (`healthcare.dob`), Gender (`healthcare.gender`, rendered via `healthcare.gender_<value>`), Blood Type (`healthcare.blood_type`), Allergies (`healthcare.allergies`, Tag list), Last Visit (`healthcare.last_visit`), actions (blank header).
- **Header / primary actions (buttons)**: "New Patient" (`healthcare.new_patient`, type primary, PlusOutlined).
- **Bulk / row actions**: Edit (EditOutlined icon button); Delete (DeleteOutlined danger + `Popconfirm` title `confirm_delete`).
- **Dialogs / Modals / Drawers**:
  - New/Edit Patient `FormDialog` (title `healthcare.new_patient` / `healthcare.edit_patient`; trigger = New Patient button / row Edit). Fields: Name (`healthcare.name`, Input, required), Phone (`healthcare.phone`, Input), DOB (`healthcare.dob`, Input type=date), Gender (`healthcare.gender`, Input, initial "unknown"), Blood Type (`healthcare.blood_type`, Input, placeholder "A+, B-, O+, AB+"), Allergies (`healthcare.allergies`, Input, placeholder `healthcare.allergies_hint`).
- **Standalone forms & fields**: none (modal only)
- **Empty / loading / error states**: `ListWithEmptyState` (entity="patient", onCreate, onRetry, onClearSearch); table `loading`; error via `message.error(t('error'))`.
- **Notable components used**: PageHeader, ListWithEmptyState, ResponsiveTableAdapter, FormDialog, Tag, Popconfirm.

### `/healthcare/appointments` — Appointments Calendar / ڕۆژژمێری ژوانەکان (`healthcare.appointments_calendar`)
- **File**: pages/healthcare/AppointmentsCalendar.tsx
- **Type**: other (calendar + day list)
- **Purpose**: Monthly calendar of appointments with per-day list and status workflow.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none (date selection via Calendar)
- **Table columns**: none (uses antd `Calendar` with `dateCellRender` showing Badge per appointment time; below it a Card list of the selected day's appointments)
- **Header / primary actions (buttons)**: "New Appointment" (`healthcare.new_appointment`, primary, PlusOutlined).
- **Bulk / row actions** (per appointment card): Edit (`edit`); "Check In" (`healthcare.check_in`, when status=scheduled → in_progress); "Complete" (`healthcare.complete`, when status=in_progress → completed); Delete (`delete`, danger + Popconfirm `confirm_delete`). Status rendered with `StatusTag` (`healthcare.status_<status>`).
- **Dialogs / Modals / Drawers**:
  - New/Edit Appointment `FormDialog` (title `healthcare.new_appointment`/`healthcare.edit_appointment`; footer extra = Save button `save`). Fields: Patient (`healthcare.patient`, Select showSearch, required, placeholder `healthcare.select_patient`), Date (`date`, DatePicker, required), Time (`healthcare.time`, TimePicker HH:mm, required), Duration minutes (`healthcare.duration_minutes`, Input number, initial 30), Reason (`healthcare.reason`, TextArea rows 3), Status (`status`, Select: scheduled/in_progress/completed/cancelled, initial scheduled).
- **Standalone forms & fields**: none
- **Empty / loading / error states**: "No appointments" text (`healthcare.no_appointments`) when day empty; loading state internal; error via message.
- **Notable components used**: antd Calendar, Badge, Card, StatusTag, FormDialog, Select/DatePicker/TimePicker.

### `/healthcare` (dashboard) — Clinic Dashboard / داشبۆردی نەخۆشخانە (`healthcare.clinic_dashboard`)
- **File**: pages/healthcare/ClinicDashboard.tsx
- **Type**: dashboard
- **Purpose**: Today's clinic overview (appointments/waiting/completed/revenue) + recent appointments table.
- **Tabs / segments**: none
- **KPI / stat cards**: Appointments Today (`healthcare.appointments_today`, CalendarOutlined, tone primary, clickable→/healthcare/appointments); Waiting Patients (`healthcare.waiting_patients`, ClockCircleOutlined, warning); Completed Today (`healthcare.completed_today`, CheckCircleOutlined, success); Revenue Today (`healthcare.revenue_today`, DollarOutlined, info, suffix " IQD" — placeholder 0).
- **Filters / search**: none
- **Table columns** (Recent Appointments card `healthcare.recent_appointments`): Patient (`healthcare.patient`), Time (`healthcare.time`), Reason (`healthcare.reason`, ellipsis), Status (`status`, StatusTag), actions (View → /healthcare/appointments).
- **Header / primary actions (buttons)**: "New Appointment" (`healthcare.new_appointment`, primary, CalendarOutlined → appointments); "Patients" (`healthcare.patients`, UserOutlined → /healthcare/patients).
- **Bulk / row actions**: View (small button, navigates).
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `InlineError` (onRetry) on failure; `LoadingSkeleton variant="card"` while loading (`useLoadingState`).
- **Notable components used**: KpiCard, ResponsiveTableAdapter, StatusTag, InlineError, LoadingSkeleton, useLoadingState.

---

### HOSPITAL (`/hospital/*`)

### `/hospital/wards` — Wards & Admissions / بەش و وەرگرتنەکان (`hospital.wards_admissions`)
- **File**: pages/hospital/WardsAdmissions.tsx
- **Type**: list (tabbed: wards + admissions) with KPI band
- **Purpose**: Manage hospital wards (capacity/beds) and patient admissions (admit/discharge).
- **Tabs / segments**: Wards (`hospital.wards`); Admissions (`hospital.admissions`).
- **KPI / stat cards**: Total Beds (`hospital.total_beds`, HomeOutlined, primary); Occupied Beds (`hospital.occupied_beds`, HomeOutlined, warning); Active Admissions (`hospital.active_admissions`, UserOutlined, success).
- **Filters / search**: none
- **Table columns**:
  - Wards: Ward Name (`hospital.ward_name`), Floor (`hospital.floor`), Beds (`hospital.beds`, "occupied / capacity"), actions (Delete).
  - Admissions: Patient (`hospital.patient`), Ward (`hospital.ward`), Bed (`hospital.bed`), Admitted At (`hospital.admitted_at`), Status (`status`, StatusTag `hospital.status_<status>`), actions (Discharge if active).
- **Header / primary actions (buttons)**: per-tab — "New Ward" (`hospital.new_ward`, primary, Plus); "New Admission" (`hospital.new_admission`, primary, Plus).
- **Bulk / row actions**: Wards → Delete (`delete`, danger + Popconfirm `confirm_delete`). Admissions → "Discharge" (`hospital.discharge`, primary + Popconfirm `hospital.confirm_discharge`).
- **Dialogs / Modals / Drawers**:
  - Ward/Admission `FormDialog` (title switches by modalType+editing: `hospital.new_ward`/`hospital.edit_ward` or `hospital.new_admission`/`hospital.edit_admission`; onOk save).
    - Ward fields: Ward Name (`hospital.ward_name`, Input, required), Floor (`hospital.floor`, Input), Capacity (`hospital.capacity`, Input number, initial 10).
    - Admission fields: Patient (`hospital.patient`, Select showSearch, required), Bed (`hospital.bed`, Select showSearch of unoccupied beds w/ ward name), Reason (`hospital.reason`, TextArea rows 3).
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table `loading`; errors via message.
- **Notable components used**: Tabs, KpiCard, StatusTag, FormDialog, Popconfirm, Select.

---

### PHARMACY (`/pharmacy/*`)

### `/pharmacy/dispense` — Pharmacy Dispense / دابەشکردنی دەرمان (`pharmacy.dispense`)
- **File**: pages/pharmacy/PharmacyDispense.tsx
- **Type**: other (search + two tables + confirm modal)
- **Purpose**: Find a prescription, dispense its drug items, and show recent dispenses.
- **Tabs / segments**: none (two stacked Cards)
- **KPI / stat cards**: none
- **Filters / search**: Search `Input` (prefix SearchOutlined, placeholder `pharmacy.search_patient_or_rx`) inside "Search Prescription" card (`pharmacy.search_prescription`); client filter on patient name / Rx id.
- **Table columns**:
  - Prescriptions: Rx Number (`pharmacy.rx_number`, first 8 chars), Patient (`pharmacy.patient`), Items (`pharmacy.items`, Tag per "drug × qty"), Issued At (`pharmacy.issued_at`), actions (Dispense button).
  - Recent Dispenses card (`pharmacy.recent_dispenses`): Drug (`pharmacy.drug`), Quantity (`pharmacy.quantity`), Dispensed At (`pharmacy.dispensed_at`).
- **Header / primary actions (buttons)**: none in PageHeader (title + subtitle only).
- **Bulk / row actions**: "Dispense" (`pharmacy.dispense`, primary, CheckCircleOutlined) → opens confirm modal.
- **Dialogs / Modals / Drawers**:
  - Dispense Prescription `FormDialog` (title `pharmacy.dispense_prescription`; onOk = dispense each item). Body is read-only summary: Patient, Rx Number, Items list (drug — qty), warning text (`pharmacy.dispense_warning`, red). No editable inputs.
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; success `pharmacy.dispensed_success`; error via message.
- **Notable components used**: Card, ResponsiveTableAdapter, FormDialog, Tag.

---

### HOTEL (`/hotel/*`)

### `/hotel` (dashboard) — Hotel Dashboard / داشبۆردی هۆتێل (`hotel.dashboard`)
- **File**: pages/hotel/HotelDashboard.tsx
- **Type**: dashboard
- **Purpose**: Occupancy, today's check-ins/outs, revenue, and 7-day occupancy trend.
- **Tabs / segments**: none
- **KPI / stat cards**: Occupancy Rate (`hotel.occupancy_rate`, BankOutlined, primary, suffix %); Today Check-ins (`hotel.today_checkins`, LoginOutlined, success); Today Check-outs (`hotel.today_checkouts`, LogoutOutlined, warning); Revenue Today (`hotel.revenue_today`, DollarOutlined, success, suffix " IQD").
- **Filters / search**: none
- **Table columns**: none (recharts LineChart in "Daily Occupancy Trend" card `hotel.daily_occupancy_trend`, custom tooltip, `ResponsiveChart`, legend `hotel.occupancy`).
- **Header / primary actions (buttons)**: "New Reservation" (`hotel.new_reservation`, primary, Plus → /hotel/rooms).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `InlineError` onRetry; `LoadingSkeleton variant="card"`; `no_data` text when no trend.
- **Notable components used**: KpiCard, ResponsiveChart (recharts LineChart), InlineError, LoadingSkeleton, tokens (space/radius).

### `/hotel/rooms` — Rooms & Bookings / ژوور و حیجزکردنەکان (`hotel.rooms_bookings`)
- **File**: pages/hotel/RoomsBookings.tsx
- **Type**: list (tabbed: rooms + bookings)
- **Purpose**: Room inventory CRUD and reservation check-in/out.
- **Tabs / segments**: Rooms (`hotel.rooms`); Bookings (`hotel.bookings`).
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**:
  - Rooms: Room Number (`hotel.room_number`), Floor (`hotel.floor`), Room Type (`hotel.room_type`, resolved from roomTypes), Status (`status`, StatusTag `hotel.status_<status>`), Actions.
  - Bookings: Guest (`hotel.guest`), Room (`hotel.room`), Check In (`hotel.check_in`), Check Out (`hotel.check_out`), Adults (`hotel.adults`), Status (`status`, Tag colored), Actions.
- **Header / primary actions (buttons)**: per Rooms tab — "Add Room" (`hotel.add_room`, primary, Plus). (Header `extra` shows add room overall.)
- **Bulk / row actions**: Rooms → Edit (EditOutlined), Delete (DeleteOutlined danger + Popconfirm `confirm_delete`). Bookings → "Check in" (`hotel.checkin`, LoginOutlined, when status=confirmed), "Check out" (`hotel.checkout`, LogoutOutlined, when checked_in).
- **Dialogs / Modals / Drawers**:
  - Room `FormDialog` (title `hotel.add_room`/`hotel.edit_room`; onOk/onCancel). Fields: Room Type (`hotel.room_type`, Select of roomTypes, required), Room Number (`hotel.room_number`, Input, required), Floor (`hotel.floor`, Input), Status (`status`, Select: available/occupied/cleaning/maintenance/out_of_order, required).
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; errors via message; room_required guard on check-in.
- **Notable components used**: Tabs, StatusTag, FormDialog, Popconfirm, Tag, Select.

---

### RESTAURANT (`/restaurant/*`)

### `/restaurant/kds` — Kitchen Display (KDS) / نمایشی چێشتخانە (`restaurant.kitchen_display`)
- **File**: pages/restaurant/KitchenDisplay.tsx
- **Type**: board (ticket cards, auto-polling every 10s)
- **Purpose**: Kitchen ticket queue; start cooking / mark ready.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none (grid of `Card` tickets w/ `Badge.Ribbon` per station `restaurant.station_<station>`; color by status pending/preparing/ready).
- **Header / primary actions (buttons)**: "Refresh" (`refresh`, loading-aware).
- **Bulk / row actions** (per ticket): "Start cooking" (`restaurant.start_cooking`, primary, FireOutlined, when pending); "Mark ready" (`restaurant.mark_ready`, green, CheckOutlined, when preparing). Shows order id (first 8), elapsed minutes, item list (qty× name + notes).
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: "No pending orders" Card (`restaurant.no_pending_orders`) when empty & not loading.
- **Notable components used**: Card, Badge.Ribbon, antd Space/Typography, tokens, setInterval polling.

### `/restaurant/menu` — Menu Manager / بەڕێوەبردنی مێنیو (`restaurant.menu_manager`)
- **File**: pages/restaurant/MenuManager.tsx
- **Type**: list
- **Purpose**: CRUD menu items (price, category, prep time, availability).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Item Name (`restaurant.item_name`), Price (`restaurant.price`, formatted IQD), Category (`restaurant.category`), Prep Time (`restaurant.prep_time`, "<n> minutes"), Availability (`restaurant.availability`, StatusTag active/inactive → `available`/`unavailable`), Actions.
- **Header / primary actions (buttons)**: "Add Item" (`restaurant.add_item`, primary, Plus).
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined danger + Popconfirm `confirm_delete`).
- **Dialogs / Modals / Drawers**:
  - Menu Item `FormDialog` (title `restaurant.add_item`/`restaurant.edit_item`; onOk/onCancel). Fields: Menu (`restaurant.menu`, Select, required), Item Name (`restaurant.item_name`, Input, required), Price (`restaurant.price`, InputNumber addonAfter IQD, required), Category (`restaurant.category`, Input), Description (`description`, TextArea rows 3), Prep Time minutes (`restaurant.prep_time`, InputNumber addonAfter minutes, required), Availability (`restaurant.availability`, Select true/false → available/unavailable).
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; errors via message.
- **Notable components used**: StatusTag, FormDialog, InputNumber, Select, Popconfirm.

### `/restaurant/tables` — Tables View / مێزەکان (`restaurant.tables`)
- **File**: pages/restaurant/TablesView.tsx
- **Type**: board (floor grid) + drawer
- **Purpose**: Visual table floor; click a table to view/open its order.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none (grid of colored `Card` tiles per table; color by status free/occupied/reserved/cleaning; Badge count when occupied; shows table number + "<seats> seats").
- **Header / primary actions (buttons)**: "Add Table" (`restaurant.add_table`, primary, Plus → shows info hint `restaurant.add_table_hint`, no real form).
- **Bulk / row actions**: tile click opens drawer.
- **Dialogs / Modals / Drawers**:
  - Table detail `FormDialog` (title "Table <number>"; onClose). Body: Status (`restaurant.status_<status>`), Seats, Section (if set); if a current order exists → "Current Order" card (order id, items count); else "Open Order" button (`restaurant.open_order`, primary, Plus → POST new dine_in order).
- **Standalone forms & fields**: none
- **Empty / loading / error states**: implicit (no tables → empty grid); success `restaurant.order_opened`.
- **Notable components used**: Card grid, Badge, FormDialog, tokens.

---

### CONSTRUCTION (`/construction/*`)

### `/construction` (projects) — Construction Projects / بنیاتنان (`construction.title`)
- **File**: pages/construction/ConstructionProjects.tsx
- **Type**: list + detail drawer
- **Purpose**: Project list with cost-summary detail.
- **Tabs / segments**: none
- **KPI / stat cards**: in detail drawer only — Total Budget (`construction.total_budget`, KpiCard) and Total Actual (`construction.total_actual`, KpiCard with trend vs budget `construction.vs_budget`); plus antd Statistic for labor/material/equipment/subcontract/overhead costs.
- **Filters / search**: Search `Input` (prefix SearchOutlined, placeholder `search`, allowClear) — filter name/client.
- **Table columns**: Project Name (`construction.project_name`), Client (`construction.client`), Start Date (`construction.start_date`), End Date (`construction.end_date`), Budget (`construction.budget`, right-aligned, contract_value), Status (`construction.status`, StatusTag mapping planning/in_progress/on_hold/completed/cancelled), Actions ("View Detail" `construction.view_detail`, link, EyeOutlined).
- **Header / primary actions (buttons)**: "Add Project" (`construction.add_project`, primary, Plus). Breadcrumb [construction.title].
- **Bulk / row actions**: View Detail (opens detail drawer + fetches cost-summary).
- **Dialogs / Modals / Drawers**:
  - Add Project `FormDialog` (title `construction.add_project`). Fields: Project Name (`construction.project_name`, Input, required), Client (`construction.client`, Input), Budget (`construction.budget`, InputNumber, initial 0), Start Date (`construction.start_date`, Input date), End Date (`construction.end_date`, Input date), Status (`construction.status`, Select planning/in_progress/on_hold/completed/cancelled, initial planning). Footer: Cancel (`cancel`) + Save (`save`, submit).
  - Detail `FormDialog` (title = project name). Read-only: Project Info card (`construction.project_info`: client/status/start/end Statistics) + Cost Summary card (`construction.cost_summary`, loading-aware) with the KPI/Statistic set above.
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; cost summary loading + `construction.cost_summary_error`.
- **Notable components used**: ResponsiveTableAdapter, FormDialog, KpiCard, antd Statistic, StatusTag, utils/message.

### `/construction/boq` — BOQ Editor / دەستکاری BOQ (`construction.boq_title`)
- **File**: pages/construction/BOQEditor.tsx
- **Type**: other (project picker + editable BOQ table + totals card)
- **Purpose**: Bill-of-quantities line editing with inline completion % and live totals.
- **Tabs / segments**: none
- **KPI / stat cards**: Totals Card — Total BOQ (`construction.total_boq`), Total Completed (`construction.total_completed`, success), Completion % (`construction.completion_pct`).
- **Filters / search**: Project `Select` (placeholder `construction.select_project`, showSearch) — selecting loads BOQ items.
- **Table columns**: Item Code (`construction.item_code`), Description (`construction.description`), Unit (`construction.unit`), Quantity (`construction.quantity`, right), Rate (`construction.rate`, right), Amount (`construction.amount`, right), Completed % (`construction.completed_pct`, inline `InputNumber` 0–100 + Save icon link → PATCH), Actions (Delete, danger + Popconfirm `confirm_delete`).
- **Header / primary actions (buttons)**: "Add BOQ Item" (`construction.add_boq_item`, primary, Plus, disabled until a project is selected). Breadcrumb [title, boq_title].
- **Bulk / row actions**: inline completion % update; Delete row.
- **Dialogs / Modals / Drawers**:
  - Add BOQ Item `FormDialog` (title `construction.add_boq_item`). Fields: Item Code (`construction.item_code`, Input, required), Description (`construction.description`, TextArea rows 2, required), Unit (`construction.unit`, Input placeholder "m², m³, pcs, kg…", required), Quantity (`construction.quantity`, InputNumber, required), Rate (`construction.rate`, InputNumber, required), Completed % (`construction.completed_pct`, InputNumber 0–100, initial 0). Footer Cancel + Save.
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; `construction.select_project_first` guard; deletion `construction.boq_item_deleted`.
- **Notable components used**: Select, ResponsiveTableAdapter (inline editors), Card totals, FormDialog, Popconfirm.

---

### REAL-ESTATE (`/real-estate/*`)

### `/real-estate` — Properties & Leases / موڵک (`real_estate.title`)
- **File**: pages/real-estate/PropertiesAndLeases.tsx
- **Type**: list (tabbed: properties + leases)
- **Purpose**: Manage properties and leases; generate rent invoices.
- **Tabs / segments**: Properties (`real_estate.properties`, key "1"); Leases (`real_estate.leases`, key "2"). (Uses `Tabs.TabPane`.)
- **KPI / stat cards**: none
- **Filters / search**: Search `Input` (prefix SearchOutlined, placeholder `search`, allowClear) — filters properties by name/address, leases by tenant name.
- **Table columns**:
  - Properties: Property Name (`real_estate.property_name`), Address (`real_estate.address`), Type (`real_estate.type`, Tag `real_estate.type_<v>`), Units (`real_estate.units`, center), Purchase Price (`real_estate.purchase_price`, right), Actions (Delete + Popconfirm).
  - Leases: Tenant (`real_estate.tenant`, resolved name), Property (`real_estate.property`, resolved via unit→property), Start Date (`real_estate.start_date`), End Date (`real_estate.end_date`), Rent (`real_estate.rent`, right monthly_rent), Status (`real_estate.status`, StatusTag active/expired/warning), Actions ("Generate Invoice" `real_estate.generate_invoice` primary FileText + Delete + Popconfirm).
- **Header / primary actions (buttons)**: context-sensitive — "Add Property" (`real_estate.add_property`) on tab 1 / "Add Lease" (`real_estate.add_lease`) on tab 2 (primary, Plus). Breadcrumb [title].
- **Bulk / row actions**: Delete (both tabs); Generate Invoice (leases → POST /rent-invoices for current month, `real_estate.invoice_generated`).
- **Dialogs / Modals / Drawers**:
  - Add `FormDialog` (title switches `real_estate.add_property` / `real_estate.add_lease`; onFinish branches).
    - Property fields: Property Name (Input, required), Address (Input, required), Type (Select residential/commercial/industrial/land/mixed, required), Units (`real_estate.units`, InputNumber, initial 1), Purchase Price (InputNumber, initial 0).
    - Lease fields: Unit (`real_estate.unit`, Select showSearch of property+unit_number, required), Tenant (Select showSearch, required), Start Date (Input date, required), End Date (Input date, required), Monthly Rent (`real_estate.rent`, InputNumber, required), Deposit (`real_estate.deposit`, InputNumber, initial 0), Status (Select active/expired/terminated/pending, initial active). Footer Cancel + Save.
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; `real_estate.deleted`.
- **Notable components used**: Tabs.TabPane, ResponsiveTableAdapter, FormDialog, StatusTag, Tag, Popconfirm, dayjs.

---

### AGRICULTURE (`/agriculture/*`)

### `/agriculture` — Fields & Yield / کشتوکاڵ (`agriculture.title`)
- **File**: pages/agriculture/FieldsAndYield.tsx
- **Type**: list (tabbed: fields + yield chart)
- **Purpose**: Field registry and harvest-yield line chart per field.
- **Tabs / segments**: Fields (`agriculture.fields`, key "1"); Yield Tracking (`agriculture.yield_tracking`, key "2"). (`Tabs.TabPane`.)
- **KPI / stat cards**: none
- **Filters / search**: Fields tab — Search `Input` (SearchOutlined, placeholder `search`, allowClear) on name/location. Yield tab — Field `Select` (placeholder `agriculture.select_field`, showSearch).
- **Table columns** (Fields): Field Name (`agriculture.field_name`), Location (`agriculture.location`), Area Dunum (`agriculture.area_dunum`, right), Soil Type (`agriculture.soil_type`), Actions (Delete + Popconfirm `confirm_delete`).
- **Header / primary actions (buttons)**: "Add Field" (`agriculture.add_field`, primary, Plus) — only on tab 1. Breadcrumb [title].
- **Bulk / row actions**: Delete field (`agriculture.field_deleted`).
- **Dialogs / Modals / Drawers**:
  - Add Field `FormDialog` (title `agriculture.add_field`). Fields: Field Name (Input, required), Location (`agriculture.location`, Input), Area Dunum (`agriculture.area_dunum`, InputNumber, required), Soil Type (`agriculture.soil_type`, Input placeholder `agriculture.soil_type_placeholder`). Footer Cancel + Save.
- **Standalone forms & fields**: none
- **Empty / loading / error states**: Yield card (`agriculture.harvest_history`) loading-aware; "No yield data" (`agriculture.no_yield_data`) empty; recharts LineChart with custom tooltip when data present; `agriculture.yield_error`.
- **Notable components used**: Tabs.TabPane, ResponsiveTableAdapter, FormDialog, ResponsiveChart (recharts LineChart), Select, Popconfirm.

---

### AI (`/ai/*`)

### `/ai` (dashboard) — AI Assist Dashboard / داشبۆردی AI (`ai.dashboard_title`)
- **File**: pages/ai/AIAssistDashboard.tsx
- **Type**: dashboard
- **Purpose**: Counts of anomalies/suggestions/OCR/predictions + anomaly score trend.
- **Tabs / segments**: none
- **KPI / stat cards** (clickable antd `Statistic` Cards): Open Anomalies (`ai.open_anomalies`, AlertOutlined, red → /ai/anomalies); Pending Suggestions (`ai.pending_suggestions`, BulbOutlined, amber → /ai/suggestions); OCR In Progress (`ai.ocr_in_progress`, ScanOutlined, blue → /ai/ocr; also shows Completed count `ai.completed`); Recent Predictions (`ai.recent_predictions`, LineChartOutlined, green → /ai/predictions).
- **Filters / search**: none
- **Table columns**: none (recharts LineChart "Anomaly Score Trend" `ai.anomaly_score_trend`, legend `ai.anomaly_score`, custom tooltip).
- **Header / primary actions (buttons)**: "Refresh" (`refresh`, ReloadOutlined).
- **Bulk / row actions**: none (cards navigate).
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `Spin` (large) while loading; empty trend → ExperimentOutlined + `ai.no_trend_data`.
- **Notable components used**: antd Statistic/Card, ResponsiveChart (recharts), Spin.

### `/ai/anomalies` — Anomalies List / لیستی نائاسایی (`ai.anomalies_title`)
- **File**: pages/ai/AnomaliesList.tsx
- **Type**: list
- **Purpose**: Review/dismiss detected anomalies; deep-link to source entity.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Search `Input` (SearchOutlined, placeholder `search`, allowClear); Entity Type `Select` (`ai.entity_type`: invoice/bill/payment/expense, allowClear); Status `Select` (`status`: new/reviewed/dismissed via `ai.status_*`, allowClear). Also in-column antd `filters` for entity_type and status.
- **Table columns**: Entity Type (`ai.entity_type`, Tag), Entity ID (`ai.entity_id`, link → routes by type to /invoices,/bills,/banking,/expenses), Anomaly Score (`ai.anomaly_score`, Tag colored by threshold, sortable), Reason (`ai.reason`, ellipsis), Detected At (`ai.detected_at`, sortable), Status (`status`, Tag new/reviewed/dismissed), Actions.
- **Header / primary actions (buttons)**: "Refresh" (`refresh`, ReloadOutlined).
- **Bulk / row actions**: "Acknowledge" (`ai.acknowledge`, CheckOutlined → status reviewed, when not reviewed); "Dismiss" (`ai.dismiss`, danger CloseOutlined → status dismissed, when not dismissed).
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `ListWithEmptyState` (entity="anomaly", onClearSearch, onRetry); messages on ack/dismiss.
- **Notable components used**: ListWithEmptyState, ResponsiveTableAdapter, Tag, Select, useNavigate.

### `/ai/suggestions` — Suggestions Inbox / سندوقی پێشنیارەکان (`ai.suggestions_title`)
- **File**: pages/ai/SuggestionsInbox.tsx
- **Type**: other (grouped List by entity)
- **Purpose**: Accept/reject AI recommendations grouped by entity type.
- **Tabs / segments**: none (grouped Cards per entity, each containing a `List`)
- **KPI / stat cards**: none
- **Filters / search**: Type `Select` (`ai.filter_by_type`: expense/payment/invoice/bill via `ai.type_*`, allowClear).
- **Table columns**: none (List.Item.Meta: BulbOutlined avatar, action Tags, rationale `ai.no_rationale`, per-item confidence `ai.confidence`, created_at).
- **Header / primary actions (buttons)**: Type Select + "Refresh" (`refresh`, ReloadOutlined).
- **Bulk / row actions** (per suggestion): "Accept" (`ai.accept`, primary, CheckOutlined → status accepted); "Reject" (`ai.reject`, danger, CloseOutlined → status rejected).
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `Spin` while loading; antd `Empty` (BulbOutlined icon, `ai.no_suggestions`) when none; messages on accept/reject.
- **Notable components used**: antd List, Card, Tag, Empty, Spin, Select.

### `/ai/predictions` — Predictions Explorer / پێشبینیەکان (`ai.predictions_title`)
- **File**: pages/ai/PredictionsExplorer.tsx
- **Type**: list + detail drawer
- **Purpose**: Browse forecast records; drill into points/explanation.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Entity (`ai.entity`, Tag purple), Horizon Days (`ai.horizon_days`, "<n> days"), Predicted Value (`ai.predicted_value`, last point), Confidence (`ai.confidence`, Progress bar colored, sortable), Created At (`ai.created_at`, sortable), Actions (View).
- **Header / primary actions (buttons)**: "Refresh" (`refresh`, ReloadOutlined).
- **Bulk / row actions**: "View" (`view`, EyeOutlined) → detail drawer.
- **Dialogs / Modals / Drawers**:
  - Prediction Details `FormDialog` (title `ai.prediction_details` + LineChartOutlined; onClose). Read-only: summary Card (entity, horizon_days, confidence Progress, created_at); Explanation card (`ai.explanation`) if present; Forecast Points card (`ai.forecast_points`) — nested table columns: Date (`date`), Predicted Value (`ai.predicted_value`), Upper Bound (`ai.upper_bound`), Lower Bound (`ai.lower_bound`).
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; message on error.
- **Notable components used**: ResponsiveTableAdapter, FormDialog, Progress, Tag, nested table.

### `/ai/ocr` — OCR Receipts (Advanced) / OCR ـی پێشکەوتوو (`ai.ocr_advanced_title`)
- **File**: pages/ai/OCRReceiptsAdvanced.tsx
- **Type**: other (upload + jobs table + detail drawer)
- **Purpose**: Upload receipt images, run OCR jobs, view extracted fields, create expense from result.
- **Tabs / segments**: none (2-col: upload card + jobs card)
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns** (`ai.ocr_jobs`): Document Type (`ai.document_type`, Tag), Vendor (`ai.vendor`, from extracted_fields), Total (`ai.total`, formatted + currency), Status (`status`, Tag in-progress/completed/failed), Created At (`ai.created_at`), Actions.
- **Header / primary actions (buttons)**: "Refresh" (`refresh`, ReloadOutlined).
- **Bulk / row actions**: "View" (`view`, EyeOutlined → drawer); "Create Expense" (`ai.create_expense`, primary Plus, when completed → navigates /expenses with prefilled query params vendor/date/amount).
- **Dialogs / Modals / Drawers**:
  - Upload area: antd `Dragger` (`ai.upload_receipts` card, accept image/*, multiple, custom request posts /api/ai/ocr then simulates completion). Text `ai.drag_drop_receipt`, hint `ai.upload_hint`.
  - OCR Job Details `FormDialog` (title `ai.ocr_job_details`; onClose). Read-only Descriptions (document_type, status, created_at, completed_at); Extracted Fields card (`ai.extracted_fields`, with "Create Expense" button) → vendor/date/total(strong)/tax/subtotal + items list; Raw Text card (`ai.raw_text`, `<pre>`).
- **Standalone forms & fields**: none (upload only)
- **Empty / loading / error states**: table loading; success `ai.ocr_upload_success`/`ai.ocr_completed`; `ai.no_extracted_fields` warning.
- **Notable components used**: antd Upload.Dragger, FormDialog, Descriptions, Tag, ResponsiveTableAdapter.

---

### IOT (`/iot/*`)

> IoT pages are plain `<h1>` headers (not PageHeader) with a flex header row; consistently provide EN fallbacks in `t(key,'EN')`.

### `/iot` (dashboard) — IoT Dashboard / IoT Dashboard (`iot.dashboard`)
- **File**: pages/iot/IoTDashboard.tsx
- **Type**: dashboard
- **Purpose**: Device fleet status + recent alerts + recent device cards.
- **Tabs / segments**: none
- **KPI / stat cards** (antd `Statistic`): Total Devices (`iot.total_devices`, HddOutlined); Online (`iot.online`, CheckCircle green); Offline (`iot.offline`, CloseCircle); Active Alerts (`iot.active_alerts`, BellOutlined red).
- **Filters / search**: none
- **Table columns** (Recent Alerts `iot.recent_alerts`): Triggered (`iot.triggered_at`, relative time), Device (`iot.device`, resolved name), Severity (`iot.severity`, Tag info/warn/critical), Action (Acknowledge button).
- **Header / primary actions (buttons)**: "View All" on Recent Alerts + Recent Devices cards (`common.view_all` → /iot/alerts, /iot/devices). Footer: "Manage Devices" (`iot.manage_devices`, primary → /iot/devices); "Alert Rules" (`iot.alert_rules` → /iot/alert-rules).
- **Bulk / row actions**: Acknowledge alert (`iot.ack` → POST /ack). Recent device Cards are clickable → /iot/devices/:id.
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: Statistics/table `loading` prop; console error on failure.
- **Notable components used**: antd Statistic/Card, ResponsiveTableAdapter, Tag, dayjs relativeTime.

### `/iot/devices` — IoT Devices / IoT Devices (`iot.devices`)
- **File**: pages/iot/IoTDevices.tsx
- **Type**: list
- **Purpose**: Register/edit/delete devices; manage API keys.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Status `Select` (`iot.filter_status`: active/inactive/error); Type `Select` (`iot.filter_type`: sensor/printer/camera/scanner/gateway/other). Server-side pagination.
- **Table columns**: Name (`iot.name`, with status Badge), Type (`iot.device_type`, `iot.device_type_<v>`), Location (`iot.location`), Serial (`iot.serial_number`), Status (`iot.status`, Tag), Last Seen (`iot.last_seen`, relative / `common.never`), Actions.
- **Header / primary actions (buttons)**: Refresh (ReloadOutlined icon); "Register Device" (`iot.register_device`, primary, Plus).
- **Bulk / row actions**: View (`common.view`, EyeOutlined → /iot/devices/:id); Edit (EditOutlined); Regenerate Key (KeyOutlined + Popconfirm `iot.regenerate_key_confirm`); Delete (DeleteOutlined danger + Popconfirm `common.delete_confirm`).
- **Dialogs / Modals / Drawers**:
  - Register/Edit Device `FormDialog` (title `iot.register_device`/`iot.edit_device`; onOk submit). Fields: Name (`iot.name`, Input, required), Type (`iot.device_type`, Select sensor/printer/camera/scanner/gateway/other, required), Serial Number (`iot.serial_number`, Input), Location (`iot.location`, Input).
  - API Key `FormDialog` (title `iot.api_key`; custom footer Copy/Close). Shows warning `iot.api_key_warning` + read-only TextArea with new key; Copy (`common.copy`).
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; messages on CRUD; `common.load_failed`.
- **Notable components used**: FormDialog, Badge, Tag, Select, Popconfirm, navigator.clipboard.

### `/iot/devices/:id` — Device Detail / Device Information (`iot.device_info`)
- **File**: pages/iot/DeviceDetail.tsx
- **Type**: detail
- **Purpose**: Single device info, API key reveal, latest readings, telemetry charts.
- **Tabs / segments**: none
- **KPI / stat cards**: Latest readings rendered as small Cards (value+unit, metric, relative time) inside RelatedDataPanel.
- **Filters / search**: Telemetry `RangePicker` (showTime) with presets Last Hour/Last 24h/Last 7d/Last 30d (`iot.last_hour`/`last_24h`/`last_7d`/`last_30d`).
- **Table columns**: none (telemetry rendered as per-metric recharts LineChart).
- **Header / primary actions (buttons)**: Edit (`common.edit`, EditOutlined); Refresh (`common.refresh`, ReloadOutlined). Title shows device name + status Tag.
- **Bulk / row actions**: API key show/hide toggle (Eye/EyeInvisible); Copy key (CopyOutlined, when revealed).
- **Dialogs / Modals / Drawers**:
  - Device Info Card (`iot.device_info`, Descriptions): Type, Location, Serial, API Key (masked + reveal + copy), Last Seen, Registered (`iot.registered_at`).
  - Latest Readings Card (`iot.latest_readings`) inside `RelatedDataPanel` (empty: `iot.no_readings_title`/`iot.no_readings_description`).
  - Telemetry Card (`iot.telemetry`) — per-metric `ResponsiveChart` LineCharts; empty `iot.no_telemetry`.
  - Edit Device `FormDialog` (title `iot.edit_device`; onOk). Fields identical to Devices register form: Name (required), Type (Select, required), Serial Number, Location.
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `LoadingSkeleton variant="card"` while loading/no device; RelatedDataPanel empty; telemetry empty text.
- **Notable components used**: Descriptions, RelatedDataPanel, ResponsiveChart, RangePicker presets, FormDialog, LoadingSkeleton.

### `/iot/alert-rules` — Alert Rules / Alert Rules (`iot.alert_rules`)
- **File**: pages/iot/AlertRules.tsx
- **Type**: list
- **Purpose**: CRUD threshold alert rules per device/metric.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none (server pagination)
- **Table columns**: Device (`iot.device`, resolved), Metric (`iot.metric`), Condition (`iot.condition`, operator symbol + threshold), Duration (`iot.duration`, seconds), Severity (`iot.severity`, Tag), Action (`iot.action`, `iot.action_<v>`), Active (`iot.active`, disabled Switch), Actions.
- **Header / primary actions (buttons)**: Refresh (ReloadOutlined icon); "New Rule" (`iot.new_rule`, primary, Plus).
- **Bulk / row actions**: Edit (EditOutlined); Delete (DeleteOutlined danger + Popconfirm `common.delete_confirm`).
- **Dialogs / Modals / Drawers**:
  - New/Edit Rule `FormDialog` (title `iot.new_rule`/`iot.edit_rule`; onOk). Fields: Device (`iot.device`, Select showSearch, required), Metric (`iot.metric`, Input placeholder `iot.metric_placeholder`, required), Operator (`iot.operator`, Select >/</≥/≤/=, required), Threshold (`iot.threshold`, InputNumber, required), Duration sec (`iot.duration_sec`, InputNumber, tooltip `iot.duration_tooltip`), Severity (`iot.severity`, Select info/warn/critical, required), Action (`iot.action`, Select log/email/webhook, required), Recipient (conditional: Email or Webhook URL — `iot.email`/`iot.webhook_url`, required when action email/webhook), Active (`iot.active`, Switch).
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; CRUD messages.
- **Notable components used**: FormDialog, Select, Switch, InputNumber, conditional Form.Item (shouldUpdate), Popconfirm.

### `/iot/alerts` — Alert History / Alert History (`iot.alert_history`)
- **File**: pages/iot/AlertHistory.tsx
- **Type**: list (auto-refresh every 30s)
- **Purpose**: Browse + acknowledge triggered alerts.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Severity `Select` (`iot.filter_severity`: info/warn/critical); Device `Select` (`iot.filter_device`, showSearch); Status `Select` (`iot.filter_status`: Pending=false / Acknowledged=true). Server pagination.
- **Table columns**: Triggered (`iot.triggered_at`, datetime + relative), Device (`iot.device`, resolved), Metric (`iot.metric`), Value (`iot.value`, value + threshold or message), Severity (`iot.severity`, Tag), Status (`iot.status`, Tag acknowledged/pending + acknowledged_by), Actions.
- **Header / primary actions (buttons)**: Refresh (ReloadOutlined; label shows "(auto)" `iot.auto_refresh` when autoRefresh on).
- **Bulk / row actions**: "Acknowledge" (`iot.ack`, primary small, when not acked) / "Acked" (`iot.acked`, CheckOutlined text, when acked).
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; `iot.acknowledged` success; `common.operation_failed`.
- **Notable components used**: Select filters, Tag, dayjs relativeTime, setInterval auto-refresh.

---

### STUDIO (No-Code) (`/studio/*`)

### `/studio` — Studio Home / Studio (No-Code) (`studio.title`)
- **File**: pages/studio/StudioHome.tsx
- **Type**: hub (entity card grid)
- **Purpose**: Entry hub listing 12 base entities; click → customize fields.
- **Tabs / segments**: none
- **KPI / stat cards**: none (entity Cards show custom-field count Tag + "Customized" Badge)
- **Filters / search**: none
- **Table columns**: none (Card grid: invoice, quote, contact, item, sales_order, purchase_order, bill, lead, project, pos_order, journal, inventory — each w/ icon, color, `studio.custom_fields_count`).
- **Header / primary actions (buttons)**: none in header (breadcrumb [home, studio.title]).
- **Bulk / row actions**: entity Card click → /studio/:entity/fields.
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: Cards `loading` while fetching counts; info Card "What can you do in Studio?" (`studio.what_can_you_do`) with Custom Fields / View Layout / Automation blurbs.
- **Notable components used**: Card grid, Badge, Tag, tokens, navigate.

### `/studio/:entity/fields` — Custom Fields Builder / Custom Fields Builder (`studio.custom_fields_builder`)
- **File**: pages/studio/CustomFieldsBuilder.tsx
- **Type**: list (per-entity custom fields) + form drawer
- **Purpose**: Add/edit/reorder/delete custom fields on an entity.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Field Name (`studio.field_name`, monospace), Label EN (`studio.field_label`), Label KU (`studio.field_label_ku`), Type (`studio.field_type`, Tag), Required (`required`, Tag yes/no), Order (`studio.order`, up/down arrow buttons), Actions (Edit, Delete + Popconfirm `are_you_sure`).
- **Header / primary actions (buttons)**: "View Layout" (`studio.view_layout` → /studio/:entity/layout); "Automation" (`studio.automation` → /studio/:entity/automation); "Add Field" (`studio.add_field`, primary, Plus). Breadcrumb [home, studio, entity].
- **Bulk / row actions**: reorder up/down (PATCH sort_order); Edit; Delete.
- **Dialogs / Modals / Drawers**:
  - Add/Edit Field `FormDialog` (title `studio.add_field`/`studio.edit_field`; onFinish). Fields: Field Name (`studio.field_name`, Input, required, disabled on edit, extra `studio.field_name_hint`), Label EN (`studio.field_label`, Input, required), Label KU (`studio.field_label_ku`, Input), Field Type (`studio.field_type`, Select: text/number/date/select/multi_select/boolean/currency/reference, required), Options (`studio.options`, TextArea comma-separated — only when type select/multi_select, extra `studio.options_hint`), Required (`required`, Switch). Footer: Create/Update + Cancel.
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `EmptyState` (`studio.no_custom_fields` + `studio.no_custom_fields_desc` + action `studio.add_first_field`) when empty.
- **Notable components used**: EmptyState, ResponsiveTableAdapter, FormDialog, Select, Switch, Popconfirm, useParams.

### `/studio/:entity/layout` — View Layout Editor / View Layout Editor (`studio.view_layout_editor`)
- **File**: pages/studio/ViewLayoutEditor.tsx
- **Type**: other (field visibility editor)
- **Purpose**: Toggle per-field visibility across Form/List/Print views and reorder.
- **Tabs / segments**: `Segmented` control — Form View (`studio.form_view`), List View (`studio.list_view`), Print View (`studio.print_view`) (each w/ EyeOutlined). Also a visible-count Tag (`studio.visible_count`).
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Field (`studio.field_name`, monospace + System Tag `studio.system`), Label (`studio.field_label`), Visible (`studio.visible`, Switch bound to active view), Order (`studio.order`, up/down arrows).
- **Header / primary actions (buttons)**: "Back to Fields" (`studio.back_to_fields` → /studio/:entity/fields); "Save" (`save`, primary, shown only when hasChanges). Breadcrumb [home, studio, entity, layout].
- **Bulk / row actions**: toggle visibility per view; reorder.
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; unsaved-changes banner (`studio.unsaved_changes`).
- **Notable components used**: Segmented, Switch, Tag, ResponsiveTableAdapter; merges system fields (id/date/reference/status/total) with custom fields.

### `/studio/:entity/automation` — Automation From Studio / Automation (`studio.automation`)
- **File**: pages/studio/AutomationFromStudio.tsx
- **Type**: other (launcher/CTA page)
- **Purpose**: Explainer + launch the workflow builder for the entity.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none
- **Header / primary actions (buttons)**: "Back to Fields" (`studio.back_to_fields`). Breadcrumb [home, studio, entity, automation].
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none — CTA Card: ThunderboltOutlined, "Create Workflows" (`studio.create_workflows`) + desc; "Launch Workflow Builder" (`studio.launch_workflow_builder`, primary, RocketOutlined → /automation/workflows/new?entity=); bullet list of automatable actions (`studio.auto_email`/`auto_status`/`auto_notification`/`auto_webhook`/`auto_schedule`); "Existing Workflows" card with link to /automation/workflows.
- **Empty / loading / error states**: n/a (static)
- **Notable components used**: Card, antd Space, tokens, navigate.

---

### STOREFRONT (public e-commerce, `/store/*`)

> Public, full-bleed pages (`#f5f5f5` bg, min-height 100vh). No PageHeader; uses Typography Title. Cart/session in localStorage.

### `/store` — Store Home / Storefront (`storefront.title`)
- **File**: pages/storefront/StoreHome.tsx
- **Type**: list (product catalog)
- **Purpose**: Browse products with category + search.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Category sidebar (`storefront.categories`) — `Tag.CheckableTag` per category + "All Products" (`storefront.all_products`); Search card (`storefront.search`) — antd `Search` (placeholder `storefront.search_placeholder`, enterButton, allowClear).
- **Table columns**: none (product `Card` grid w/ cover image / `storefront.no_image`, title, category Tag, price + `currency`).
- **Header / primary actions (buttons)**: "Cart" (`storefront.cart`, ShoppingCartOutlined → /store/cart).
- **Bulk / row actions**: product Card click → /store/product/:id.
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: search input only.
- **Empty / loading / error states**: `LoadingSkeleton variant="card"` (useLoadingState); antd `Empty` (`storefront.no_products`).
- **Notable components used**: Card cover, Tag.CheckableTag, Input.Search, LoadingSkeleton, Empty.

### `/store/product/:id` — Store Product / (product name) 
- **File**: pages/storefront/StoreProduct.tsx
- **Type**: detail
- **Purpose**: Product detail + add-to-cart.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none
- **Header / primary actions (buttons)**: "Back to Store" (`storefront.back_to_store`, LeftOutlined → /store).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: Quantity (`storefront.quantity`, InputNumber min 1); "Add to Cart" (`storefront.add_to_cart`, primary large, ShoppingCartOutlined → creates session+cart, navigates /store/cart). Shows name, category Tag, SKU (`storefront.sku`), price + currency, description.
- **Empty / loading / error states**: `LoadingSkeleton variant="card"`; `storefront.product_not_found` (→ back to /store); `storefront.added_to_cart`/`storefront.add_to_cart_failed`.
- **Notable components used**: InputNumber, Divider, Tag, LoadingSkeleton, crypto-secure session id.

### `/store/cart` — Store Cart / Shopping Cart (`storefront.shopping_cart`)
- **File**: pages/storefront/StoreCart.tsx
- **Type**: other (cart line table)
- **Purpose**: Review/update cart lines and subtotal; go to checkout.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Product (`storefront.product`, strong), Price (`storefront.price`, + currency), Quantity (`storefront.quantity`, inline InputNumber min 1), Total (`storefront.total`, line total), actions (Delete row).
- **Header / primary actions (buttons)**: "Back to Store" (`storefront.back_to_store`, LeftOutlined).
- **Bulk / row actions**: change qty (PUT cart); Delete line (DeleteOutlined danger → qty 0).
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: Subtotal card (`storefront.subtotal`) + "Proceed to Checkout" (`storefront.proceed_to_checkout`, primary block → /store/checkout).
- **Empty / loading / error states**: loading text (`loading`); antd `Empty` (`storefront.cart_empty`) with "Continue Shopping" (`storefront.continue_shopping`); `storefront.cart_updated`/`update_failed`.
- **Notable components used**: ResponsiveTableAdapter, InputNumber, Empty, antd Row/Col.

### `/store/checkout` — Store Checkout / Checkout (`storefront.checkout`)
- **File**: pages/storefront/StoreCheckout.tsx
- **Type**: wizard (2-step)
- **Purpose**: Collect customer info + review, place order (cash).
- **Tabs / segments**: antd `Steps` — Customer Info (`storefront.customer_info`); Review Order (`storefront.review_order`).
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none
- **Header / primary actions (buttons)**: "Back to Cart" (`storefront.back_to_cart`, LeftOutlined).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields** (`Form`):
  - Step 0: Full Name (`storefront.full_name`, Input large, required `storefront.name_required`), Email (`storefront.email`, Input, required + type email `storefront.email_invalid`), Phone (`storefront.phone`, Input), Address (`storefront.address`, TextArea rows 3). Button "Continue" (`storefront.continue`, validates → step 1).
  - Step 1: Order Summary card (`storefront.order_summary`, total + currency); "Back" (`storefront.back` → step 0); "Place Order" (`storefront.place_order`, primary, CheckCircleOutlined, submit → POST checkout, payment_method cash → /store/order/:id).
- **Empty / loading / error states**: `storefront.cart_empty` warning (redirect /store/cart) if no cart; `storefront.order_placed`/`storefront.checkout_failed`.
- **Notable components used**: Steps, Form (single layout), TextArea.

### `/store/order/:orderId` — Store Order Confirm / Order Confirmed (`storefront.order_confirmed`)
- **File**: pages/storefront/StoreOrderConfirm.tsx
- **Type**: other (success result)
- **Purpose**: Order confirmation with details (looked up by orderId + email query).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none (reads `email` from query param)
- **Table columns**: none (antd `Descriptions`: Order ID `storefront.order_id`, Customer `storefront.customer`, Order Date `storefront.order_date`, Status `storefront.status`, Total `storefront.total`).
- **Header / primary actions (buttons)**: "Continue Shopping" (`storefront.continue_shopping`, primary, ShoppingOutlined → /store).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: loading text; redirects to /store if no email.
- **Notable components used**: antd `Result` (status success), Descriptions, Card.

---

### CUSTOMER PORTAL (`/portal/*`)

> Public, full-bleed, magic-link auth. JWT in sessionStorage; pages redirect to /portal/login if missing.

### `/portal/login` — Portal Login / (`portal.title`)
- **File**: pages/portal/PortalLogin.tsx
- **Type**: wizard (2-step magic link)
- **Purpose**: Email → magic link → verify token → portal.
- **Tabs / segments**: antd `Steps` — Enter Email (`portal.enter_email`); Verify (`portal.verify`).
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none
- **Header / primary actions (buttons)**: none (centered Card).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**:
  - Step 0 (`Form` in `ResponsiveForm` single): Email (`portal.email`, Input large, MailOutlined prefix, placeholder `portal.email_placeholder`, required + email type). "Send Magic Link" (`portal.send_magic_link`, primary block, submit → request-link).
  - Step 1: `Result` (info, `portal.check_email` + `portal.magic_link_instruction`); demo token display (`portal.demo_token`, Text code); "Verify & Login" (`portal.verify_and_login`, primary, LoginOutlined → verify-link); "Back to Email" (`portal.back_to_email`, link).
- **Empty / loading / error states**: `portal.magic_link_sent`/`portal.email_not_found`/`portal.request_failed`/`portal.token_invalid`/`portal.verify_failed`/`portal.login_success`.
- **Notable components used**: Steps, ResponsiveForm, Result.

### `/portal` — Portal Dashboard / (`portal.dashboard`)
- **File**: pages/portal/PortalDashboard.tsx
- **Type**: dashboard
- **Purpose**: Customer's outstanding balance, counts, recent invoices.
- **Tabs / segments**: none
- **KPI / stat cards** (antd `Statistic`): Total Due (`portal.total_due`, DollarOutlined, blue, suffix currency); Overdue (`portal.overdue`, DollarOutlined, red); Invoices (`portal.invoices`, FileTextOutlined, + "View all" link → /portal/invoices); Orders (`portal.orders`, ShoppingOutlined, + "View all" → /portal/orders).
- **Filters / search**: none
- **Table columns**: none (Recent Invoices `portal.recent_invoices` rendered as antd `List`: invoice number, date, balance + currency, status).
- **Header / primary actions (buttons)**: shows portal_email; "Logout" (`portal.logout`, LogoutOutlined → clears session).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: card `loading`; empty list (`portal.no_invoices`); `portal.session_expired`/`portal.load_failed`.
- **Notable components used**: antd Statistic, List, Card.

### `/portal/invoices` — Portal Invoices / My Invoices (`portal.my_invoices`)
- **File**: pages/portal/PortalInvoices.tsx
- **Type**: list (read-only)
- **Purpose**: Customer's invoices table.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Invoice Number (`portal.invoice_number`, FileText icon), Date (`portal.date`), Due Date (`portal.due_date`), Amount (`portal.amount`, total + currency), Balance (`portal.balance`, strong), Status (`portal.status`, Tag draft/sent/paid/partial/overdue).
- **Header / primary actions (buttons)**: "Back to Dashboard" (`portal.back_to_dashboard`, LeftOutlined → /portal).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; empty `portal.no_invoices`.
- **Notable components used**: ResponsiveTableAdapter, Tag.

### `/portal/orders` — Portal Orders / My Orders (`portal.my_orders`)
- **File**: pages/portal/PortalOrders.tsx
- **Type**: list (read-only)
- **Purpose**: Customer's orders table.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Order ID (`portal.order_id`, ShoppingOutlined, truncated 8 chars), Order Date (`portal.order_date`), Source (`portal.source`, Tag), Total (`portal.total`, strong + currency), Status (`portal.status`, Tag draft/confirmed/processing/shipped/delivered/cancelled).
- **Header / primary actions (buttons)**: "Back to Dashboard" (`portal.back_to_dashboard`).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; empty `portal.no_orders`.
- **Notable components used**: ResponsiveTableAdapter, Tag.

### `/portal/statements` — Portal Statements / Account Statement (`portal.account_statement`)
- **File**: pages/portal/PortalStatements.tsx
- **Type**: detail (statement summary)
- **Purpose**: Customer outstanding/overdue summary + payment instructions.
- **Tabs / segments**: none
- **KPI / stat cards**: Total Outstanding (`portal.total_outstanding`, DollarOutlined, blue, large); Overdue Amount (`portal.overdue_amount`, FileTextOutlined, red, large).
- **Filters / search**: none
- **Table columns**: none (Payment Summary card `portal.payment_summary`: Current Balance `portal.current_balance`, Overdue `portal.overdue`).
- **Header / primary actions (buttons)**: "Back to Dashboard" (`portal.back_to_dashboard`).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: card loading; Payment Options card (`portal.payment_options` + `portal.payment_instructions`).
- **Notable components used**: antd Statistic, Card, Divider.

---

### VENDOR PORTAL (`/vendor-portal/*`)

> Public, magic-link auth; uses dedicated `api/vendorPortal` client (vendor_jwt in localStorage).

### `/vendor-portal/login` — Vendor Portal Login / (`vendor_portal.login`)
- **File**: pages/vendor-portal/VendorPortalLogin.tsx
- **Type**: wizard (2-step magic link, gradient bg)
- **Purpose**: Vendor email → magic link → auto/manual verify.
- **Tabs / segments**: antd `Steps` — Email (`vendor_portal.email_label`, MailOutlined); Verify Token (`vendor_portal.verify_token`, LoginOutlined).
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: none
- **Header / primary actions (buttons)**: none (centered Card, "welcome" `vendor_portal.welcome`).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**:
  - Step 0 (`Form`): Email (`vendor_portal.email_label`, Input large, MailOutlined, placeholder "vendor@example.com", required + email). "Request Link" (`vendor_portal.request_link`, primary block, submit).
  - Step 1: `Result` success (`vendor_portal.magic_link_sent` + `vendor_portal.verify_token`); auto-verifies; manual "Retry" (`retry`) button if not loading.
- **Empty / loading / error states**: `vendor_portal.email_not_found`/`not_vendor` (403)/`request_failed`/`token_invalid`/`login_success`.
- **Notable components used**: Steps, Form, Result; gradient background.

### `/vendor-portal` — Vendor Portal Dashboard / (`vendor_portal.dashboard`)
- **File**: pages/vendor-portal/VendorPortalDashboard.tsx
- **Type**: dashboard
- **Purpose**: Vendor PO/bill/payment KPIs + recent POs and bills.
- **Tabs / segments**: none
- **KPI / stat cards** (antd `Statistic`): Open POs Count (`vendor_portal.open_pos_count`, ShoppingOutlined, green); Open POs Value (`vendor_portal.open_pos_value`, DollarOutlined, blue, precision 2); Pending Bills (`vendor_portal.pending_bills`, FileTextOutlined, amber); Payments 30d (`vendor_portal.payments_30d`, DollarOutlined, green, precision 2); Outstanding Balance (`vendor_portal.outstanding_balance`, WarningOutlined, red, precision 2).
- **Filters / search**: none
- **Table columns**:
  - My POs card (`vendor_portal.my_pos`): PO Number (`vendor_portal.po_number`), PO Date (`vendor_portal.po_date`), PO Total (`vendor_portal.po_total`), actions (View PO `vendor_portal.view_po` → /vendor-portal/purchase-orders).
  - My Bills card (`vendor_portal.my_bills`): Bill Number (`vendor_portal.bill_number`), Bill Date (`vendor_portal.bill_date`), Status (`vendor_portal.bill_status`, `vendor_portal.<status>`).
- **Header / primary actions (buttons)**: "Logout" (`vendor_portal.logout`, LogoutOutlined); "View all" (`view_all`) on each card.
- **Bulk / row actions**: View PO link.
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `InlineError` onRetry; `LoadingSkeleton variant="card"`; antd `Empty` (`vendor_portal.no_pos`/`no_bills`); 401 → logout.
- **Notable components used**: antd Statistic, ResponsiveTableAdapter, Empty, InlineError, LoadingSkeleton.

### `/vendor-portal/purchase-orders` — Vendor Portal POs / My POs (`vendor_portal.my_pos`)
- **File**: pages/vendor-portal/VendorPortalPOs.tsx
- **Type**: list + detail drawer
- **Purpose**: List POs (by status), view PO detail, start a bill from a PO.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Status `Select` (Open `vendor_portal.open` / Received `vendor_portal.received` / All `vendor_portal.all`).
- **Table columns**: PO Number (`vendor_portal.po_number`), PO Date (`vendor_portal.po_date`), PO Status (`vendor_portal.po_status`, Tag draft/approved/open/received/cancelled), PO Total (`vendor_portal.po_total`), Actions.
- **Header / primary actions (buttons)**: "Back" (`back` → /vendor-portal).
- **Bulk / row actions**: "View" (`view`, EyeOutlined → detail drawer); "Submit Bill" (`vendor_portal.submit_bill`, primary, FileAddOutlined → /vendor-portal/submit-bill?po_id=).
- **Dialogs / Modals / Drawers**:
  - PO Detail `FormDialog` (title `vendor_portal.po_detail`; onClose). Descriptions (po_number, po_date, po_status Tag, po_total); Line Items table (`items.line_items`): Description (`items.description`), Quantity (`items.quantity`), Unit Price (`items.unit_price`), Amount (`items.amount`); "Submit Bill" button (block).
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; antd `Empty` (`vendor_portal.no_pos`); 401 → login.
- **Notable components used**: Select, ResponsiveTableAdapter, FormDialog, Descriptions, Tag.

### `/vendor-portal/submit-bill` — Vendor Portal Submit Bill / Submit Bill (`vendor_portal.submit_bill`)
- **File**: pages/vendor-portal/VendorPortalSubmitBill.tsx
- **Type**: form (editable line-item bill)
- **Purpose**: Submit a vendor bill (optionally pre-filled from a PO via po_id query).
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns** (editable lines): Description (`items.description`, Input), Quantity (`items.quantity`, InputNumber), Unit Price (`items.unit_price`, InputNumber prec 2), Tax Rate % (`items.tax_rate` + "(%)", InputNumber 0–100), Amount (`items.amount`, computed), Actions (Delete row, `common.actions`).
- **Header / primary actions (buttons)**: "Back" (`back` → /vendor-portal/purchase-orders).
- **Bulk / row actions**: "Add Line" (`items.add_line`, dashed Plus block); remove line.
- **Dialogs / Modals / Drawers**: none (shows PO banner `vendor_portal.bill_against_po` if from PO).
- **Standalone forms & fields** (`Form`): Bill Number (`vendor_portal.bill_number`, Input "BILL-001", required), Bill Date (`vendor_portal.bill_date`, DatePicker, required, default today), Due Date (`vendor_portal.due_date`, DatePicker, required, default +30d), line-item table, Notes (`notes`, TextArea placeholder `optional`). Totals: Subtotal (`invoices.subtotal`), Tax (`invoices.tax`), Total (`invoices.total`). Submit: "Submit Bill" (`vendor_portal.submit_bill`, primary block, SaveOutlined).
- **Empty / loading / error states**: `at_least_one_line` guard; `vendor_portal.bill_submitted`/`submit_failed`; 401 → login; `portal.load_failed` on PO fetch.
- **Notable components used**: Form, DatePicker, ResponsiveTableAdapter (inline editors), InputNumber, TextArea, dayjs.

### `/vendor-portal/bills` — Vendor Portal Bills / My Bills (`vendor_portal.my_bills`)
- **File**: pages/vendor-portal/VendorPortalBills.tsx
- **Type**: list (read-only)
- **Purpose**: Vendor's bills with status filter.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: Status `Select` (allowClear, placeholder `filter_by_status`: pending_review/approved/paid/all via `vendor_portal.*`).
- **Table columns**: Bill Number (`vendor_portal.bill_number`), Bill Date (`vendor_portal.bill_date`), Due Date (`vendor_portal.due_date`), Status (`vendor_portal.bill_status`, Tag pending_review/draft/approved/open/paid/partially_paid/void), Total (`invoices.total`), Balance (`invoices.balance`, balance_due), PO Number (`vendor_portal.po_number`, po_id).
- **Header / primary actions (buttons)**: "Submit Bill" (`vendor_portal.submit_bill` → /vendor-portal/submit-bill); "Back" (`back` → /vendor-portal).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; antd `Empty` (`vendor_portal.no_bills`); 401 → login.
- **Notable components used**: Select, ResponsiveTableAdapter, Tag.

### `/vendor-portal/payments` — Vendor Portal Payments / My Payments (`vendor_portal.my_payments`)
- **File**: pages/vendor-portal/VendorPortalPayments.tsx
- **Type**: list (read-only)
- **Purpose**: Vendor's received payments.
- **Tabs / segments**: none
- **KPI / stat cards**: none
- **Filters / search**: none
- **Table columns**: Payment Date (`vendor_portal.payment_date`), Reference (`vendor_portal.payment_reference`), Method (`vendor_portal.payment_method`), Amount (`vendor_portal.payment_amount`), Status (`status`, Tag completed/pending/failed).
- **Header / primary actions (buttons)**: "Back" (`back` → /vendor-portal).
- **Bulk / row actions**: none
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: table loading; antd `Empty` (`vendor_portal.no_payments`); 401 → login.
- **Notable components used**: ResponsiveTableAdapter, Tag.

---

### GENERIC MODULE HUB (`/ext/<slug>`)

### `/ext/:slug` — Module Hub (generic, config-driven) / (per-module title)
- **File**: pages/modules/ModuleHub.tsx (config: pages/modules/moduleConfigs.ts)
- **Type**: hub (config-driven tabbed CRUD)
- **Purpose**: Single generic component that renders ANY of the 32 configured `/ext/<slug>` modules. Looks up the module via `getModuleBySlug(slug)`; renders a `Card` titled by the module (i18n key `mod_<slug_with_underscores>`, fallback config.title) with a `Tag` showing the module `basePath`. Inside, one antd `Tabs` item **per resource** in the config; each tab body is a `<ResourceTab>` (a full CRUD list bound to `<basePath>/<resource.key>`).
- **Tabs / segments**: one tab **per resource** (label = resource.label, Kurdish). See full per-module resource list below.
- **KPI / stat cards**: none
- **Filters / search (per ResourceTab)**: free-text Search `Input` (prefix SearchOutlined, placeholder `hub_search`) — client-side filter across all row values; a count `Tag` (`hub_total`: N).
- **Table columns (per ResourceTab, generic)**: first up to 6 config fields (title = field.label, rendered by type: boolean→Tag ✓/×, date→YYYY-MM-DD, datetime→YYYY-MM-DD HH:mm, object→`[object]`, long text truncated) + a hardcoded **"حاڵەت" (status)** column (Tag) + an actions column (Edit, Delete + Popconfirm `hub_confirm_delete`). Double-click a row opens Edit.
- **Header / primary actions (buttons, per ResourceTab)**: "Add New" (`hub_add_new`, primary, Plus, disabled when endpoint missing); "Refresh" (`hub_refresh`, ReloadOutlined, loading-aware).
- **Bulk / row actions**: Edit (text EditOutlined); Delete (text danger DeleteOutlined + Popconfirm `hub_confirm_delete`); row double-click → edit.
- **Dialogs / Modals / Drawers**:
  - Add/Edit `FormDialog` (title `${hub_add_new|hub_edit} — <resource.label>`; onOk submit, confirmLoading). Renders ALL resource fields dynamically via `renderField`: type `number`→InputNumber, `date`→DatePicker, `datetime`→DatePicker showTime, `select`→Select(options), `textarea`→TextArea(rows 3), default→Input. Required driven by field.required (`hub_required`).
- **Standalone forms & fields**: per-resource — defined in moduleConfigs.ts (see schema: `ResourceField{name,label,type?,options?,required?}`). Field count varies by resource.
- **Empty / loading / error states**: `hub_module_not_found` (antd Empty) if slug unknown; per-tab antd `Empty` (`hub_empty`); on 404/405 from API → `Alert` warning (`hub_endpoint_missing` + the URL) and Add disabled; other errors → message (`hub_load_error`/`hub_save_error`/`hub_delete_error`); success `hub_saved`/`hub_deleted`.
- **Notable components used**: Tabs, ResponsiveTableAdapter, FormDialog, Input/InputNumber/Select/DatePicker/TextArea, Popconfirm, Alert, Empty, getModuleBySlug, utils/message.

#### Module Hub — config inventory (32 modules; slug → title / group; resources = tabs)
*Each resource = one tab; tab label shown in Kurdish. group ∈ engagement | platform | vertical.*

- **livechat** — گفتوگۆی زیندوو (engagement) · base `/api/livechat`: channels(کەناڵەکان), conversations(گفتوگۆکان), bots(بۆتەکان), flows(فلۆکان), canned(وەڵامە ئامادەکان)
- **social** — سۆشیال میدیا (engagement) · `/api/social`: accounts(هەژمارەکان), posts(پۆستەکان), engagements(بەشداربوون), mentions(ناولێبردنەکان)
- **comms** — SMS و VoIP (engagement) · `/api/comms`: sms-templates(تێمپلەیتی SMS), sms(SMSـەکان), sms-campaigns(کامپەینەکان), calls(پەیوەندیەکان), queues(ڕیزەکان)
- **engagement** — بۆنە و راپرسی و ژوانەکان (engagement) · `/api/engagement`: events(بۆنەکان), registrations(تۆمارکردن), sponsors(پشتیوانان), sessions(گفتوگۆکان), surveys(راپرسیەکان), questions(پرسیارەکان), calendars(ڕۆژژمێرەکان), slots(کاتە بەردەستەکان), bookings(ژوانەکان)
- **elearning** — فێرکاری ئۆنلاین (engagement) · `/api/elearning`: courses(کۆرسەکان), lessons(وانەکان), quizzes(تاقیکردنەوە), enrollments(تۆمارکردن), certificates(بڕوانامە)
- **rental** — کرێ و ئاژاوە (platform) · `/api/rental`: products(بەرهەمەکان), contracts(گرێبەستەکان), pickups(وەرگرتنەکان), returns(گەڕاندنەوە), damages(زیانەکان)
- **ai** — تایبەتمەندی AI (platform) · `/api/ai`: models(مۆدێلەکان), forecasts(پێشبینی), anomalies(نائاسایی), recommendations(پێشنیارەکان), ocr(OCR)
- **mobile** — مۆبایل API (platform) · `/api/mobile`: tokens(تۆکنەکان), sessions(سێشنەکان), push(ئاگاداری)
- **iot** — IoT (platform) · `/api/iot`: devices(ئامێرەکان), readings(خوێندنەوە), alerts(ئاگادارکردنەوە), rules(ڕێسەکان)
- **healthcare** — تەندروستی (vertical) · `/api/healthcare`: patients(نەخۆشەکان), appointments(ژوانەکان), prescriptions(ڕەچەتەکان), records(تۆمارەکان), insurances(بیمەکان), lab-results(ئەنجامی تاقیگە), vitals(سەڕووکارەکان)
- **hospital** — نەخۆشخانە (vertical) · `/api/hospital`: wards(بەشەکان), beds(جێگاکان), doctors(پزیشکەکان), admissions(وەرگرتن), lab-orders(فەرمانی تاقیگە), radiology-orders(فەرمانی تیشک), surgeries(نەشتەرگەری)
- **pharmacy** — دەرمانخانە (vertical) · `/api/pharmacy`: drugs(دەرمانەکان), batches(بەستەکان), dispenses(دابەشکردن), interactions(کارلێک)
- **hotel** — هۆتێل (vertical) · `/api/hotel`: room-types(جۆری ژوور), rooms(ژوورەکان), guests(میوانەکان), reservations(حیجزکردن), housekeeping(خاوێنکردنەوە), folios(فۆلیۆ)
- **restaurant** — چێشتخانە (vertical) · `/api/restaurant`: menus(مێنیوەکان), menu-items(بڕگەکان), tables(مێزەکان), orders(داواکارییەکان), kds(KDS), delivery-orders(گەیاندن)
- **construction** — بنیاتنان (vertical) · `/api/construction`: projects(پڕۆژەکان), sites(شوێنەکان), wbs(WBS), progress-billings(فاکتوری پێشکەوتن), job-costs(تێچوو), equipment(ئامێرەکان), subcontractors(سەرپەرشتیار)
- **real-estate** — موڵک (vertical) · `/api/real-estate`: properties(موڵکەکان), units(یەکەکان), tenants(کرێچی), leases(گرێبەستی کرێ), rent-invoices(فاکتوری کرێ), maint-requests(داواکاری چاکسازی)
- **education** — پەروەردە (vertical) · `/api/education`: students(قوتابیەکان), teachers(مامۆستاکان), courses(کۆرسەکان), classes(پۆلەکان), enrollments(تۆمار), attendance(ئامادەبوون), grades(نمرەکان), fees(کرێکان), fee-payments(پارەدان)
- **logistics** — لۆجستی (vertical) · `/api/logistics`: shipments(گەیاندنەکان), routes(ڕێگاکان), drivers(شۆفێرەکان), vehicles(ئۆتۆمبیلەکان), gps(GPS), freight-rates(نرخی بار)
- **agriculture** — کشتوکاڵ (vertical) · `/api/agriculture`: fields(کێڵگەکان), crops(بەرهەمە کشتوکاڵیەکان), plantings(چاندن), harvests(دروێنە), livestock(ئاژەڵ), irrigation(ئاودان), fertilization(پەینکردن)
- **ngo** — ڕێکخراو ناحکومی (vertical) · `/api/ngo`: donors(بەخشەرەکان), donations(بەخشینەکان), campaigns(کامپەینەکان), grants(گرانتەکان), funds(سندوقەکان), beneficiaries(سوودمەندەکان), volunteers(خۆبەخشەکان)
- **government** — حکومی (vertical) · `/api/government`: citizens(هاوڵاتیان), services(خزمەتگوزاریەکان), service-requests(داواکاریەکان), permits(مۆڵەتەکان), tax-assessments(سەنجەی باج), tenders(مەزایدەکان), tender-bids(پێشنیارەکان)
- **helpdesk** — یارمەتیدان (Helpdesk) (engagement) · `/api/helpdesk`: teams(تیمەکان), categories(پۆلەکان), tags(تاگەکان), sla-policies(سیاسەتی SLA), tickets(بلیتەکان), canned(وەڵامە ئامادەکان)
- **field-service** — خزمەتگوزاری مەیدانی (engagement) · `/api/field-service`: workers(کرێکاران), service-types(جۆری خزمەت), orders(داواکاریەکان), dispatches(ناردنەکان), routes(ڕێگاکان), parts(پارچەکان), signatures(واژۆکان)
- **subscriptions** — بەشدارییەکان (engagement) · `/api/subscriptions`: plans(پلانەکان), addons(زیادکراوەکان), coupons(کۆپۆنەکان), invoices(فاکتورەکان)
- **documents** — دۆکیومێنتەکان (engagement) · `/api/documents`: folders(بوخچەکان), files(فایلەکان), shares(هاوبەشکردنەکان), sign-requests(داواکاری واژۆ), workflows(فلۆکان)
- **knowledge** — زانیاری (Wiki) (engagement) · `/api/knowledge`: categories(پۆلەکان), articles(وتارەکان), comments(کۆمێنتەکان)
- **quality** — کوالێتی (vertical) · `/api/quality`: teams(تیمەکان), points(خاڵە چاودێریەکان), reasons(هۆکارەکان), checks(چاودێریەکان), alerts(ئاگاداریەکان), non-conformities(نا-ڕێکوپێکی), capa(CAPA)
- **maintenance** — چاککردنەوە (vertical) · `/api/maintenance`: categories(پۆلەکان), equipment(ئامێرەکان), requests(داواکاریەکان), schedules(پلانەکان), logs(تۆمارەکان)
- **plm** — PLM (vertical) · `/api/plm`: versions(وەرسیۆنەکان), ecos(ECOـەکان), stages(قۆناغەکان), boms(BOMـەکان), attachments(هاوپێچەکان)
- **repairs** — چاککردنەوەکان (vertical) · `/api/repairs`: orders(داواکاریەکان), parts(پارچەکان), warranties(گەرەنتیەکان)
- **hr-extended** — HR زیادکراو (دامەزراندن + هەڵسەنگاندن) (engagement) · `/api/hr-extended`: candidates(پێشنیارکراوان), applications(داواکاریەکان), interviews(وتووێژەکان), cycles(سووڕەکان), appraisals(هەڵسەنگاندنەکان), goals(ئامانجەکان), feedbacks(فیدباک), employee-skills(شارەزاییەکان)
- **studio** — ستۆدیۆ (No-code) (platform) · `/api/studio`: models(مۆدێلەکان), fields(فیلدەکان), views(ڕوانگەکان), menus(مێنوەکان), workflows(فلۆکان), records(تۆمارەکان), reports(ڕاپۆرتەکان)

> NOTE: The hub uses `/ext/<slug>` routing per project map. Several of these slugs (healthcare, hospital, pharmacy, hotel, restaurant, construction, real-estate, agriculture, ai, iot) ALSO have bespoke top-level pages documented above; the hub config is the fallback/admin CRUD surface for every module's raw resources.

---

### ROLE DASHBOARD HOME (`/` — role-routed)

### `/` (DashboardRouter) — Role-routed Dashboard Home
- **File**: pages/dashboard/DashboardRouter.tsx
- **Type**: other (router/switch)
- **Purpose**: Picks the role-specific home component by `useRoleUx().theme.id` and renders it with a Framer Motion page transition (`useGlassMotion`).
- **Tabs / segments**: none
- **KPI / stat cards**: none directly (delegates).
- **Filters / search**: none
- **Header / primary actions**: none directly.
- **Notable**: HOME_BY_THEME maps 12 RoleThemeIds → home components: executive→OwnerExecutiveHome, administrator→AdminOpsHome, manager→ManagerHome, finance→FinanceHome, sales→SalesHome, purchase→PurchaseHome, inventory→InventoryHome, pos→PosStaffHome, hr→HrHome, projects→ProjectsHome, personal→PersonalEmployeeHome, readonly→ViewerHome. Falls back to OwnerExecutiveHome.

### Role home components (12) — thin wrappers
- **Files**: pages/dashboard/homes/{OwnerExecutiveHome, AdminOpsHome, ManagerHome, FinanceHome, SalesHome, PurchaseHome, InventoryHome, PosStaffHome, HrHome, ProjectsHome, PersonalEmployeeHome, ViewerHome}.tsx
- **Type**: other (wrappers)
- **Purpose**: Each is a one-line `export default createRoleHome('<themeId>')`. No unique UI of their own.
- **Generated via**: pages/dashboard/homes/createRoleHome.tsx → renders `<RoleHomeHero/>` (component `components/role/RoleHomeHero`, OUT OF SET) + `<Dashboard embedded hideHero layoutId={themeId} hideExecutiveInvoiceCta={!layout.showQuickActions}/>` (component `pages/Dashboard.tsx`, OUT OF SET). The visible KPIs/chart/recent-invoices/activity are controlled by `dashboardLayouts.ts`.

### `dashboardLayouts.ts` — per-role layout config (data)
- **File**: pages/dashboard/dashboardLayouts.ts
- **Type**: other (config)
- **Purpose**: `DASHBOARD_LAYOUTS: Record<RoleThemeId, DashboardLayoutConfig>` toggling which KPIs/sections the shared Dashboard shows per role.
- **Config shape**: `DashboardLayoutConfig{ primaryKpis: DashboardKpiId[]; secondaryKpis: DashboardKpiId[]; showQuickActions; showChart; showRecentInvoices; showActivity; suppressCreateInEmpty }`. `DashboardKpiId` ∈ receivable | payable | income | expenses | contacts | overdue.
- **Per role (primary / secondary KPIs · flags)**:
  - executive & administrator: FULL — primary [receivable,payable,income,expenses], secondary [contacts,overdue], quickActions+chart+recentInvoices+activity all on, suppressCreate off.
  - manager: FULL (activity on).
  - finance: primary [receivable,payable,income,expenses], secondary [overdue]; chart+recentInvoices on; quickActions+activity off.
  - sales: primary [receivable,income], secondary [contacts,overdue]; chart+recentInvoices on; quickActions+activity off.
  - purchase: primary [payable,expenses], secondary [overdue]; all sections off.
  - inventory: primary [payable], secondary [contacts]; all off.
  - pos: primary [income,receivable], secondary []; all off; suppressCreate ON.
  - hr: primary [], secondary [contacts]; all off; suppressCreate ON.
  - projects: primary [], secondary [contacts]; all off; suppressCreate ON.
  - personal: primary [income,expenses], secondary [contacts]; all off; suppressCreate ON.
  - readonly: primary [receivable,payable,income,expenses], secondary [contacts,overdue]; chart+recentInvoices+activity on; quickActions off; suppressCreate ON.
- **Notable**: `getDashboardLayout(themeId)` → config (fallback FULL).

---

### CUSTOM DASHBOARDS (drag-and-drop builder, `/dashboards/*`)

### `/dashboards` — My Dashboards / My Dashboards (`my_dashboards`)
- **File**: pages/dashboards/MyDashboards.tsx
- **Type**: list (card grid of dashboards)
- **Purpose**: List user's + shared dashboards; create/clone/delete/set-default.
- **Tabs / segments**: none
- **KPI / stat cards**: none (dashboard Cards show widget count + ownership Badge `mine`/`shared_with_me`).
- **Filters / search**: none
- **Table columns**: none (Card grid: name w/ DashboardOutlined, widgets count `widgets`, last modified `last_modified`).
- **Header / primary actions (buttons)**: "New Dashboard" (`new_dashboard`, primary, Plus → opens create modal).
- **Bulk / row actions** (Card actions + Dropdown): Edit (EditOutlined → /dashboards/:id/edit), Clone (CopyOutlined `dashboard_cloned`), and `...` Dropdown menu: Set as default (`set_as_default`, StarOutlined), Share (`share`, ShareAltOutlined, disabled if not owner), Delete (`delete`, danger + Modal.confirm `delete_dashboard_confirm`, disabled if not owner). Card click → /dashboards/:id (view).
- **Dialogs / Modals / Drawers**:
  - New Dashboard `FormDialog` (title `new_dashboard`; onOk create). Field: raw `<input>` (placeholder `dashboard_name`, Enter submits) — NOT an antd Form.
  - Delete confirm via `Modal.confirm` (`confirm_delete` / `delete_dashboard_confirm`).
- **Standalone forms & fields**: name input (modal).
- **Empty / loading / error states**: loading state (no explicit empty grid); messages `load_error`/`name_required`/`dashboard_created`/`create_error`/`delete_error`/`clone_error`/`set_as_default_success`.
- **Notable components used**: Card actions, Dropdown menu, Badge, FormDialog, Modal.confirm.

### `/dashboards/:id/edit` — Dashboard Editor / Dashboard Editor (`dashboard_editor`)
- **File**: pages/dashboards/DashboardEditor.tsx
- **Type**: other (drag-and-drop widget grid builder)
- **Purpose**: Add/configure/arrange widgets on a grid; save layout.
- **Tabs / segments**: none
- **KPI / stat cards**: none (widget placeholders show type Tag + data source).
- **Filters / search**: none
- **Table columns**: none (react-grid-layout `ResponsiveGridLayout`, draggable + resizable; each widget = Card placeholder with Settings + Delete).
- **Header / primary actions (buttons)**: title is an editable `Input` (dashboard name, placeholder `dashboard_name`); "Add Widget" (`add_widget`, Plus); "Cancel" (`cancel`, CloseOutlined → confirm if unsaved); "Save" (`save`, primary, SaveOutlined).
- **Bulk / row actions** (per widget placeholder): Settings (SettingOutlined → config drawer), Delete (danger + Modal.confirm `delete_widget_confirm`); drag/resize updates layout.
- **Dialogs / Modals / Drawers**:
  - Add Widget `FormDialog` (title `add_widget`; onClose). Grid of catalog template Cards (type Tag, label, description) — click adds a widget. Catalog from `/api/dashboards/widget-catalog`.
  - Widget Settings `FormDialog` (title `widget_settings`; custom footer Cancel/Save → handleConfigSave). Form (no Form.Item names; controlled): Title (`title`, Input), Data Source (`data_source`, Select of template's available_data_sources for the widget type), Refresh Interval (`refresh_interval`, InputNumber sec, help `refresh_interval_help`, placeholder `manual_only`), Color (`color`, Select blue/green/red/orange/purple/cyan/magenta), Unit (`unit`, Input, only for type=kpi, placeholder "IQD").
  - Unsaved-changes confirm via `Modal.confirm` (`unsaved_changes`/`unsaved_changes_message`, leave/stay).
- **Standalone forms & fields**: name Input + widget config form.
- **Empty / loading / error states**: loading text; empty grid message (`no_widgets_message` + "Add first widget" `add_first_widget`); `load_error`/`save_error`/`name_required`/`saved`.
- **Notable components used**: react-grid-layout (Responsive+WidthProvider), FormDialog, Modal.confirm, Select/InputNumber/Input, widget catalog API.

### `/dashboards/:id` — Dashboard View / Dashboard View (`dashboard_view`)
- **File**: pages/dashboards/DashboardView.tsx
- **Type**: dashboard (read-only rendered widgets)
- **Purpose**: Render a saved dashboard's widgets with live data + date range.
- **Tabs / segments**: none
- **KPI / stat cards**: KPI widgets render antd `Statistic` (value, prefix DollarOutlined if config.icon, suffix config.unit, colored).
- **Filters / search**: `RangePicker` (date range, default month-to-date → re-fetches all widget data).
- **Table columns**: table-type widgets auto-derive columns from data keys (dynamic).
- **Header / primary actions (buttons)**: RangePicker; "Refresh" (`refresh`, ReloadOutlined → refreshAllWidgets); "Edit" (`edit`, primary, EditOutlined → /dashboards/:id/edit).
- **Bulk / row actions**: none (static grid, not draggable).
- **Widget renderers**: kpi (Statistic); bar/line/pie (recharts via ResponsiveChart); table (ResponsiveTableAdapter); progress (text "Progress: N%"); iframe (embedded `<iframe src=config.url>`); fallback "Unknown widget type". Pie uses COLORS palette.
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: `LoadingSkeleton variant="card"`; `InlineError` (messageKey `error_loading_dashboard`, onRetry=reload) when dashboard missing; `load_error` message.
- **Notable components used**: react-grid-layout (static), recharts (Bar/Line/Pie), ResponsiveChart, ResponsiveTableAdapter, Statistic, RangePicker, LoadingSkeleton, InlineError.

### `/dashboards/shared` — Shared Dashboards / Shared With Me (`shared_with_me`)
- **File**: pages/dashboards/SharedDashboards.tsx
- **Type**: list (card grid)
- **Purpose**: Dashboards shared with the user (not owned); view or clone.
- **Tabs / segments**: none
- **KPI / stat cards**: none (Cards show widget count + `shared` Badge).
- **Filters / search**: none (filters list client-side to `!is_owner`).
- **Table columns**: none (Card grid: name DashboardOutlined, widgets count, last modified).
- **Header / primary actions (buttons)**: none (title + subtitle `dashboards_shared_subtitle`).
- **Bulk / row actions** (Card actions): View (EyeOutlined → /dashboards/:id), Clone (CopyOutlined → clone then /dashboards/:clonedId/edit). Card click → view.
- **Dialogs / Modals / Drawers**: none
- **Standalone forms & fields**: none
- **Empty / loading / error states**: empty Card (`no_shared_dashboards`) when none & not loading; `load_error`/`dashboard_cloned`/`clone_error`.
- **Notable components used**: Card actions, Badge, PageHeader.

---

### Coverage summary
Pages/components documented: **56 files** across healthcare(3), hospital(1), pharmacy(1), hotel(2), restaurant(3), construction(2), real-estate(1), agriculture(1), ai(5), iot(5), studio(4), storefront(5), portal(5), vendor-portal(6), modules(2: ModuleHub + moduleConfigs covering 32 ext modules), dashboard(14: router + layouts config + createRoleHome + 12 role wrappers), dashboards(4).


## ١٢. ڕێکخستن · بەڕێوەبردن · چوونەژوورەوە (وردەکاریی فیلد) / Settings · Admin · Auth · Onboarding (field-level)


> Kurdish (Sorani) ERP — RTL, antd v6 + React 19 + Zustand. This fragment is a COMPLETE structural inventory of the entire Settings system plus admin/auth/onboarding/platform/pricing/setup pages.

### Architecture overview

- **Two Settings shells coexist:**
  1. **Legacy/live shell** — `frontend/src/pages/Settings.tsx` re-exports `frontend/src/settings/shell/SettingsShell.tsx`. This is the one actually wired to `/settings`. URL param `?s=<sectionKey>`. Renders 57 panel bodies from `settings/sections/bodies.tsx` via `settings/sections/SettingsSectionPanel.tsx`. Sidebar = `settings/shell/SettingsNav.tsx`, grouped by 11 groups (`account, general_app, organization, users, localization, finance, commerce, operations, automation, content, system`).
  2. **New decomposition shell** — `frontend/src/pages/settings/SettingsShell.tsx` (Phase P5). URL param `?section=<group.key>`. Reads `pages/settings/sections.registry.ts`. Only 4 sections migrated to real files (CompanyInfo, Localization, Branding, DataRights); all others render `TodoPlaceholder`. Antd `<Layout><Sider><Menu>`. 11 groups (`account, general, organization, users, localization, finance, commerce, operations, automation, content, system`).
- Panel container: each body uses `SectionCard` (icon, title, description, accent, actions, footer, loading, noPadding) + `SettingsRow` (label, description, divider) + `SaveBar` (sticky glass save bar, appears only when dirty AND `useSettingsEdit()` is true).
- Config-only panels use a shared `useSettingsBag<T>(category, defaults)` hook that loads/saves a single JSON blob row via `GET/POST /api/system/settings`. CRUD panels call dedicated REST endpoints.
- Access control: `useSettingsAccess(sectionKey)` returns `{canView, canEdit, denyReason}`. Deny reasons: `unauthenticated, unknown_section, platform_only, module_disabled, permission_denied, view_only`. `SettingsGateBanner` shows a "View only" alert when `denyReason==='view_only'`. Edit-gating flows through `SettingsEditContext`.
- Common shared widgets: `SectionHelpPopover` (what/why/3 steps), `PremiumModal`, `ResponsiveForm layout="single"`, `ResponsiveTableAdapter`, `GlassSaveButton`, `buildEffectiveOptions`/`handleAddOptionChange` (inline "+ create new" option in selects that navigate to the create page).

---

### SETTINGS PANELS (legacy shell — `settings/sections/bodies.tsx`)

All bodies live in `frontend/src/settings/sections/bodies.tsx` (~4655 lines). Each is wrapped in `<Space direction="vertical" size="large">`. Buttons: standard `{t('save')}` primary unless noted. Save toast: `message.success(t('success'))` / error `message.error(t('error'))`.

### `general` — General / گشتی
- **File**: frontend/src/settings/sections/bodies.tsx (GeneralSettings)
- **Type**: settings-panel · **Group**: general_app
- **Purpose**: App name, default language, timezone.
- **Fields**: `app_name` (text, prefix SettingOutlined, required, min2/max100) `t('app_name','Application name')`; `language` (select: ku/ar/en, required) `t('default_language','Default language')`; `timezone` (select showSearch, 12 zones Asia/Baghdad…UTC…America, required) `t('timezone','Timezone')`.
- **Buttons**: Save (primary). On save: PUT `/api/system/settings/general`; changing language calls `i18n.changeLanguage`, sets `document.dir` rtl for ku/ar, persists `settingsStore`.
- **Notable**: SectionCard icon SettingOutlined; loads org name from `/api/system/organization`.

### `appearance` — Appearance / ڕووکار
- **File**: bodies.tsx (AppearanceSettings) · **Type**: settings-panel · **Group**: general_app
- **Purpose**: Theme, layout mode, density.
- **Fields**: `theme` (select Light/Dark, required) `t('pref_theme')`; `layout` (select 10 layout modes: classic-sidebar, top-megamenu, dual-rail, icon-rail, dashboard-first, command-centric, workspace-tabs, apps-launcher, split-master-detail, mobile-bottom-nav) `t('layout_mode')`; `density` (select compact/default/comfort) `t('pref_density')`.
- **Buttons**: Save (primary) — applies theme/layout immediately via authStore, PUT `/api/system/settings/appearance`.
- **Notable**: BgColorsOutlined icon.

### `feature_flags` — Feature flags / فلاگی فیچەر
- **File**: bodies.tsx (FeatureFlagsSettings) · **Type**: settings-panel · **Group**: general_app
- **Purpose**: Enable/disable org features with rollout %.
- **Controls (per flag, SettingsRow)**: Switch (enabled) + InputNumber 0–100 `%` (rollout_pct, shown when enabled, tooltip). 8 default flags: `ai_assist, ocr_receipts, advanced_reports, pos_module, ecommerce, iot_telemetry, multi_entity, whatsapp_integration` (each label+desc i18n `ff_*`).
- **Loading/error**: `loading` on card; merges `/api/feature-flags` with defaults. Save POST `/api/feature-flags/{key}` (upsert only). Rollout validation 0–100.
- **Notable**: ExperimentOutlined icon. (NOTE: this body exists but is NOT mounted in SettingsSectionPanel — `feature_flags` is not in the switch; the live `modules` panel mounts `FeatureFlagMirror` instead.)

### `profile` — Profile / پرۆفایل
- **File**: bodies.tsx (ProfileSettings) · **Type**: settings-panel/form · **Group**: account
- **Purpose**: Personal account + password change.
- **Card 1 (UserOutlined, "profile_settings")**: `email` (text, disabled, MailOutlined prefix); `display_name` (text, required, UserOutlined); `phone` (text). Save→PUT `/api/system/profile`. Help popover (what/why/3 steps).
- **Card 2 (KeyOutlined, "change_password", accent warning)**: `current_password` (password, required); `new_password` (password, required, min8); `confirm_password` (password, required). Save→PUT `/api/system/profile/password`; checks match.
- **Loading**: card loading from `/api/system/profile`.

### `organization` — Organization / ڕێکخراو
- **File**: bodies.tsx (OrganizationSettings) · **Type**: settings-panel/form · **Group**: organization
- **Purpose**: Company identity, address, tax.
- **Fields (sub-grouped with dividers)**: Identity: `name` (required), `phone`, `email`, `country`. Address: `city`, `address_line1`, `address_line2`. Tax & Registration: `tax_number`, `registration_number`. All text inputs.
- **Buttons**: Save (primary)→PUT `/api/system/organization`. Help popover (company.what/why/steps). BankOutlined icon. Loads from `/api/system/organization`.

### `security` — Security / ئاسایش (2FA)
- **File**: bodies.tsx (SecuritySettings) · **Type**: settings-panel · **Group**: account
- **Purpose**: Two-factor auth + session management.
- **Alert**: when `mandatory && !enabled` — "2FA setup required" (warning).
- **Card 1 (SafetyOutlined, "two_factor_auth", accent success/warning, Tag Enabled/Disabled)**: SettingsRow "enable_2fa" with Switch (disabled when enabled+mustKeep). Help popover.
- **Card 2 (GlobalOutlined, "session_management")**: SettingsRow "active_sessions" (shows signed-in user) + Button "logout_all" (disabled, ThunderboltOutlined).
- **Modals (PremiumModal)**: (a) **2FA Setup** — QR image (from `/api/auth/2fa/setup`), secret string (monospace, LTR), 6-digit `code` Input; OK="Verify"→POST `/api/auth/2fa/verify`. (b) **2FA Disable** — 6-digit `password` Input; OK="Disable" (danger)→POST `/api/auth/2fa/disable`.
- **API**: `/api/auth/me` (reads is_2fa_enabled, requires_2fa_setup, must_keep_2fa). Auto-opens setup if mandatory.

### `notifications` — Notifications / ئاگادارکردنەوە (Enterprise matrix)
- **File**: bodies.tsx (NotificationSettings) · **Type**: settings-panel · **Group**: account
- **Purpose**: Channel × Event matrix + digest/quiet hours.
- **Tabs**: `events` (BellOutlined "Events"), `channels` (ApiOutlined "Channels"), `schedule` (ClockCircleOutlined "Schedule & quiet hours").
- **Events tab**: Input.Search (search_events) + count; category filter via Segmented (desktop) or Select (mobile): All + 8 categories (sales/purchases/inventory/accounting/hr/crm/projects/system). Matrix: desktop = sticky-header table (rows=33 events, columns=6 channels + "All"); mobile = card list. Each cell = small Switch. Channels: `in_app, email, push` (available), `sms, whatsapp, slack` (unavailable, disabled). Critical events lock in_app on. Column header click toggles whole column. "All" column toggles whole row. Info Alert about legacy 4-bool compatibility.
  - 33 events grouped: Sales (invoice_created, invoice_overdue★, payment_received, quote_accepted, quote_expired, sales_order_confirmed, refund_processed); Purchases (po_approved, bill_received, bill_overdue★, vendor_credit_received); Inventory (stock_low, stock_out★, transfer_received, lot_expiring); Accounting (journal_posted, period_closing, expense_approved, budget_threshold); HR (leave_requested, leave_approved, payslip_ready, anniversary_today); CRM (lead_assigned, opportunity_won, opportunity_lost); Projects (task_assigned, task_due_soon, milestone_reached, timesheet_reminder); System (backup_complete, login_new_device★, password_changed★, integration_failed). ★=critical.
- **Channels tab**: grid of channel cards (icon, status Tag Enabled/Coming soon). email→`reply_to_address` input; sms→`mobile_number`; whatsapp→`whatsapp_number`; slack→`slack_workspace`; push→registered devices count; in_app→info text. Each card has "Send test" button (ThunderboltOutlined)→POST `/api/system/notification-preferences/test`.
- **Schedule tab**: `digest` Select (instant/hourly/daily/weekly); `quiet_hours_enabled` Switch; when on → two TimePickers (start/end HH:mm); `weekend_mute` Switch.
- **Buttons**: Save in card actions (mirrors matrix→4 legacy bools, PUT `/api/system/notification-preferences`). Help popover.
- **API**: GET/PUT `/api/system/notification-preferences`.

### `modules` — Active modules / مۆدیوولە چالاکەکان
- **File**: bodies.tsx (ModulesSettings) · **Type**: settings-panel/dashboard · **Group**: system
- **Purpose**: View enabled modules, re-run onboarding, license pool.
- **Header actions**: Help popover; "Re-run onboarding" (RocketOutlined, primary, fires `open-onboarding` event); "Reset" (danger, Popconfirm).
- **Body**: SettingsRow Industry (Tag with icon/title, or "Start onboarding" button if not done); License pool grid of `ModuleSettingsCard` (read-only, bundle Tag) shown if `license.allowedModules`; "Module requests" link button (admin/owner, with pending count); empty-state `SettingsModulesEmptyState` if no modules; "Enabled modules" grid of `ModuleSettingsCard`; `FeatureFlagMirror` (admin/owner) appended.
- **Notable**: AppstoreOutlined; reads onboardingStore (enabledModules, industryId, license, pendingAdminCount).

### `fiscal` — Fiscal years / ساڵی دارایی
- **File**: bodies.tsx (FiscalYears) · **Type**: list · **Group**: finance
- **Table columns**: name, start_date, end_date, status (Tag green/red), actions (Close year button when status=open).
- **Action button**: "new_fiscal_year" (PlusOutlined primary). Help popover. CalendarOutlined.
- **Modal (PremiumModal "new_fiscal_year")**: `name` (text, required), `start_date` (DatePicker, required), `end_date` (DatePicker, required). Save→POST `/api/fiscal/years`. Close→POST `/api/fiscal/years/{id}/close`.
- **API**: GET `/api/fiscal/years`.

### `budgets` — Budgets / بودجە
- **File**: bodies.tsx (Budgets) · **Type**: list · **Group**: finance
- **Table columns**: name, actions (delete Popconfirm).
- **Action button**: "new_budget" (PlusOutlined primary). Help popover. FundOutlined.
- **Modal**: `name` (text, required); `fiscal_year_id` (Select with buildEffectiveOptions→ inline create to `/settings?s=fiscal`, required). Save→POST `/api/fiscal/budgets` (lines:[]).
- **API**: GET `/api/fiscal/budgets`; opens loads `/api/fiscal/years`.

### `currencies` — Currencies / دراوەکان
- **File**: bodies.tsx (Currencies) · **Type**: list (2 tables) · **Group**: localization
- **Card 1 (Currencies, DollarOutlined, help popover)**: read-only table — code, name, symbol. GET `/api/system/currencies`.
- **Card 2 (Exchange rates)**: table — from, to, rate, date. Action "new_rate" (PlusOutlined primary).
- **Modal "new_rate"**: `from_currency` (Select buildEffectiveOptions→ create currency), `to_currency` (same), `rate` (InputNumber, required), `date` (DatePicker, required, default today). Save→POST `/api/system/exchange-rates`.
- **API**: GET `/api/system/exchange-rates`.

### `templates` — Invoice templates / قاڵبی فاکتور
- **File**: bodies.tsx (InvoiceTemplates) · **Type**: list · **Group**: finance
- **Table columns**: name, layout, status (default Tag), actions (Set default button when not default).
- **Action**: "create" (PlusOutlined primary). Help popover. FileTextOutlined.
- **Modal**: `name` (required); `layout` (Select classic/modern/minimal/rtl); `colors` (text "#1677ff"); `show_logo` (Switch); `footer_text` (TextArea rows2). Save→POST `/api/system/invoice-templates`. Set default→POST `.../{id}/set-default`.
- **API**: GET `/api/system/invoice-templates`.

### `reminders` — Reminder settings / بیرخستنەوەکان
- **File**: bodies.tsx (ReminderSettings) · **Type**: settings-panel/form · **Group**: finance
- **Fields**: `before_due_days` (text "3,7,14"); `after_due_days` (text "1,3,7"); `email_subject_template` (text); `email_body_template` (TextArea rows4); `is_active` (Switch).
- **Footer**: Save (primary). Help popover. ClockCircleOutlined. GET/PUT `/api/system/reminder-settings`.

### `einvoice` — E-invoice (Iraq) / فاکتوری ئەلیکترۆنی
- **File**: bodies.tsx (EInvoiceSettings) · **Type**: settings-panel + dashboard + list · **Group**: finance
- **Card 1 config (FileProtectOutlined, "Refresh" + help, footer Save)**: switches `enabled`, `preview_mode`, `auto_submit_on_send`; text `portal_url`, `status_url_template`, `cancel_url`, `seller_tax_id`, `branch_code`; password `api_key`, `auth_token`, `private_key_password`; TextArea `private_key_pem` (rows5). PUT `/api/einvoice/config`.
- **Card 2 (FundOutlined, "Compliance overview")**: 6 stat tiles — generated, signed, submitted, accepted(green), rejected(red if >0), cancelled. GET `/api/einvoice/report/monthly`.
- **Card 3 (HistoryOutlined, "errors", accent danger)**: table — invoice#, fiscal_id, status Tag, error_message, submitted_at. GET `/api/einvoice/report/errors`.

### `email` — Email (SMTP) / ئیمەیڵ
- **File**: bodies.tsx (EmailSettings) · **Type**: settings-panel/form · **Group**: content
- **Fields**: `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password` (password), `email_from`. Footer Save. Help popover. MailOutlined.
- **API**: GET `/api/system/settings`; save iterates POST `/api/system/settings` {key,value,category:'email'}.

### `backup` — Backup & restore / پاڵپشت
- **File**: bodies.tsx (BackupRestore) · **Type**: list · **Group**: system
- **Table columns**: filename, created_at, size (KB), status, download (Button, disabled if failed).
- **Action**: "create_backup" (CloudOutlined primary)→POST `/api/system/backup/run`. Help popover. DatabaseOutlined.
- **Download**: GET `/api/system/backup/{id}/download` (blob). GET `/api/system/backup/list`.

### `activity` — Activity log / تۆماری چالاکی
- **File**: bodies.tsx (ActivityLog) · **Type**: list · **Group**: system
- **Filters**: action Select (create/update/delete/approve); entity Select (invoice/expense/contact/item/payment/journal); RangePicker.
- **Table columns**: created_at, action (Tag), entity_type, description, user_name. Pagination (20/page). HistoryOutlined.
- **API**: GET `/api/system/activity-log` (params page, page_size, action, entity, from_date, to_date).

### `system` — System info / زانیاری سیستەم
- **File**: bodies.tsx (SystemInfo) · **Type**: dashboard · **Group**: system
- **Card 1 grid tiles**: app_version (1.0.0), language (Tag), theme (Tag), current_time (live clock), timezone, viewport, connectivity (online/offline Tag, live navigator.onLine).
- **Card 2 (accent info)**: user agent code block (truncated 80 chars).
- **Notable**: InfoCircleOutlined; live updates via interval + online/offline listeners.

### `preferences` — Preferences / هەڵبژاردنە کەسیەکان
- **File**: bodies.tsx (PreferencesSettings, useSettingsBag 'preferences') · **Type**: settings-panel · **Group**: account
- **Rows**: `theme` Select (system/light/dark — applies via toggleTheme); `density` Segmented (compact/default/comfort); `landing_page` Select (6 routes: dashboard/invoices/contacts/items/reports/pos); `first_day_of_week` Segmented (sat/sun/mon); `keyboard_shortcuts` Switch; `high_contrast` Switch; `large_text` Switch; `calendar_provider` Select (none/google/outlook).
- **SaveBar** (sticky). BgColorsOutlined. Help popover (appearance.what/why).

### `branches` — Branches & locations / لقەکان
- **File**: bodies.tsx (BranchesSettings) · **Type**: list (CRUD) · **Group**: organization
- **Table columns**: name, code, city, country, status (Tag Active/Archived), actions (Edit + Delete Popconfirm).
- **Action**: "new_branch" (PlusOutlined primary). Help popover. ApartmentOutlined.
- **Modal (PremiumModal)**: `name` (required), `code`, `phone`, `city`, `country`, `is_active` (Switch).
- **API**: GET/POST/PUT/DELETE `/api/branches`.

### `branding` — Branding & theme / برێندینگ
- **File**: bodies.tsx (BrandingSettings, useSettingsBag 'branding') · **Type**: settings-panel · **Group**: organization
- **Rows (Inputs)**: `logo_url`, `logo_dark_url`, `favicon_url` (URL text); `primary_color`, `accent_color` (Input type=color); `font_family` Select (Inter/Cairo/Noto Sans Arabic/system-ui); `document_theme` Segmented (classic/modern/minimal); `email_theme` Segmented (same); `login_bg_url` (URL text).
- **SaveBar**. BgColorsOutlined.

### `working_hours` — Working hours / کاتژمێری کار
- **File**: bodies.tsx (WorkingHoursSettings, useSettingsBag 'working_hours') · **Type**: settings-panel · **Group**: organization
- **Rows**: `work_days` Select multiple (sat–fri); `start_time`/`end_time` TimePicker pair; `break_start`/`break_end` TimePicker pair; `timezone` Select (Baghdad/Dubai/Riyadh/Istanbul/UTC); `honor_holidays` Switch; `sla_business_hours_only` Switch.
- **SaveBar**. FieldTimeOutlined.

### `holidays` — Public holidays / پشووە فەرمیەکان
- **File**: bodies.tsx (HolidaysSettings, useSettingsBag 'holidays') · **Type**: settings-panel + editable table · **Group**: organization
- **Rows**: `country_preset` Select (IQ/KRG/AE/SA/TR/NONE); `honor_regional` Switch; `carry_next_year` Switch.
- **Custom holidays table** (Divider): columns date (DatePicker), name (Input), paid (Switch), delete button. Footer "add_holiday" button.
- **SaveBar**. GiftOutlined.

### `users` — Users & licenses / بەکارهێنەران
- **File**: bodies.tsx (UsersSettings) · **Type**: list (CRUD) · **Group**: users · **permission**: settings.users.manage
- **Table columns**: name (or email), email, role (Tag), status (Active/Suspended Tag), actions (Activate/Suspend toggle + Delete Popconfirm).
- **Action**: "invite_user" (PlusOutlined primary). Help popover. TeamOutlined.
- **Modal (Invite)**: `email` (required, email), `display_name`, `role` Select (admin/manager/user/accountant, default user).
- **API**: GET `/api/users`; POST `/api/users/invite`; POST `/api/users/{id}/suspend|activate`; DELETE `/api/users/{id}`.

### `roles` — Roles / ڕۆڵەکان
- **File**: bodies.tsx (RolesSettings) · **Type**: list (CRUD) · **Group**: users
- **Table columns**: name (+ System Tag), description (ellipsis), permissions (count Tag), actions (Edit/Delete — disabled for system roles).
- **Action**: "new_role" (PlusOutlined). Help popover. IdcardOutlined.
- **Modal**: `name` (required), `description` (TextArea), info Alert pointing to Permissions section.
- **API**: GET/POST/PUT/DELETE `/api/rbac/roles`.

### `permissions` — Permissions matrix / مۆڵەتەکان
- **File**: bodies.tsx (PermissionsSettings) · **Type**: settings-panel (matrix) · **Group**: users
- **Body**: Roles × permissions matrix. Permissions grouped by prefix (split on `.`). Desktop = sticky table (rows=permissions grouped, columns=roles); mobile = accordion of groups with per-role Switch chips. Each cell = small Switch (disabled for system roles).
- **SaveBar** (saves each non-system role via PUT `/api/rbac/roles/{id}` permissions). SafetyCertificateOutlined.
- **API**: GET `/api/rbac/permissions`, `/api/rbac/roles`.

### `sso` — Single sign-on / SSO (badge beta)
- **File**: bodies.tsx (SsoSettings, useSettingsBag 'sso') · **Type**: settings-panel · **Group**: users
- **Rows**: `provider` Select (none/saml/oidc/google/microsoft). When ≠none: `metadata_url` (URL), `client_id`, `client_secret` (password), `attribute_email`, `attribute_name`, `jit_provisioning` Switch, `enforce_domain` (text).
- **SaveBar**. KeyOutlined.

### `portals` — Customer & vendor portals / پۆرتاڵەکان
- **File**: bodies.tsx (PortalsSettings, useSettingsBag 'portals') · **Type**: settings-panel · **Group**: users
- **Rows**: `customer_portal_enabled` Switch; `vendor_portal_enabled` Switch; `subdomain` (text). Capabilities (Divider): `allow_invoice_download`, `allow_quote_acceptance`, `allow_document_share`, `require_terms_acceptance` (Switches); when terms on → `terms_url` (URL).
- **SaveBar**. UsergroupAddOutlined.

### `localization` — Localization package / ناوخۆیی‌کردن
- **File**: bodies.tsx (LocalizationSettings, useSettingsBag 'localization') · **Type**: settings-panel · **Group**: localization
- **Rows**: `country_pack` Select (IQ/KRG/AE/SA/TR/GENERIC); `coa_template` Select (iraq_standard/gcc_standard/ifrs/custom); `address_format` (TextArea rows3); `phone_format` (text); `postal_code_format` (text); `iban_validation` Switch.
- **SaveBar**. GlobalOutlined. Help popover.

### `languages` — Languages / زمانەکان
- **File**: bodies.tsx (LanguagesSettings, useSettingsBag 'languages') · **Type**: settings-panel · **Group**: localization
- **Rows**: `active` Select multiple (ku/ar/en/tr/fa); `default_lang` Select (filtered to active, calls i18n.changeLanguage); `document_lang` Select; `rtl` Switch.
- **SaveBar**. TranslationOutlined.

### `formats` — Date/time/number formats / فۆڕماتەکان
- **File**: bodies.tsx (FormatsSettings, useSettingsBag 'formats') · **Type**: settings-panel · **Group**: localization
- **Rows**: `date_format` Select (4 patterns); `time_format` Segmented (12h/24h); `thousand_sep` Segmented (`,`/`.`/space/`٬` Arabic); `decimal_sep` Segmented (`.`/`,`); `first_day_of_week` Segmented (sat/sun/mon); `units` Segmented (metric/imperial); `paper_size` Segmented (A4/Letter).
- **SaveBar**. ClockCircleOutlined.

### `taxes` — Taxes / باجەکان
- **File**: bodies.tsx (TaxesSettings) · **Type**: list (CRUD) · **Group**: finance
- **Table columns**: name, rate (`%`), type (Tag), inclusive (Yes Tag), actions (Edit/Delete).
- **Action**: "new_tax" (PlusOutlined). Help popover. PercentageOutlined.
- **Modal**: `name` (required); `rate` (InputNumber 0–100 step0.01, required); `tax_type` Select (vat/sales/withholding/service); `is_inclusive` Switch.
- **API**: GET/POST/PUT/DELETE `/api/taxes/rates`.

### `banking` — Banking / بانکداری
- **File**: bodies.tsx (BankingSettings) · **Type**: list (CRUD) · **Group**: finance
- **Table columns**: name, bank_name, iban (ellipsis), currency (Tag), actions (Edit/Delete).
- **Action**: "new_bank_account" (PlusOutlined). Help popover. BankOutlined.
- **Modal**: `name` (required); `bank_name`; `currency` (Select buildEffectiveOptions→create currency); `account_number`; `swift`; `iban`; `opening_balance` (InputNumber); `is_active` Switch.
- **API**: GET/POST/PUT/DELETE `/api/banking/accounts`; loads `/api/system/currencies`.

### `payment_methods` — Payment methods / شێوازی پارەدان
- **File**: bodies.tsx (PaymentMethodsSettings, useSettingsBag 'payment_methods') · **Type**: settings-panel · **Group**: finance
- **Rows (Switches)**: Offline (Divider): cash, bank_transfer, cheque. Online (Divider): card_visa_mc, FIB, zaincash, asiahawala, stripe, paypal, qr, installments. Default (Divider): `default_method` Select (cash/bank_transfer/cheque/card/fib/zaincash).
- **SaveBar**. CreditCardOutlined. Help popover.

### `sales` — Sales / فرۆشتن
- **File**: bodies.tsx (SalesSettings, useSettingsBag 'sales') · **Type**: settings-panel · **Group**: commerce
- **Rows**: `quote_expiry_days` (InputNumber 1–365); `auto_followup_quote` Switch; `default_payment_terms_days` (0–180); `default_discount_pct` (0–100); `require_discount_approval` Switch; `commission_pct` (0–100); `pipeline_stages` (text, comma list).
- **SaveBar**. ShoppingCartOutlined.

### `crm` — CRM / CRM
- **File**: bodies.tsx (CrmSettings, useSettingsBag 'crm') · **Type**: settings-panel · **Group**: commerce
- **Rows**: `pipelines` (text); `lead_sources` (text); `lost_reasons` (text); `scoring_high` (InputNumber 0–100); `scoring_medium` (0–100); `round_robin` Switch; `duplicate_detection` Switch.
- **SaveBar**. ContactsOutlined.

### `purchases` — Purchases / کڕینەکان
- **File**: bodies.tsx (PurchasesSettings, useSettingsBag 'purchases') · **Type**: settings-panel · **Group**: commerce
- **Rows**: `rfq_required` Switch; `three_way_match` Switch; `approval_threshold` (InputNumber); `default_lead_time_days` (0–365); `default_payment_terms_days` (0–180); `allow_dropship` Switch; `over_receipt_pct` (0–100).
- **SaveBar**. ShopOutlined.

### `inventory` — Inventory / ئەنبار
- **File**: bodies.tsx (InventorySettings, useSettingsBag 'inventory') · **Type**: settings-panel · **Group**: commerce
- **Rows**: `default_warehouse` (text); `removal_strategy` Segmented (fifo/lifo/fefo); `allow_negative_stock` Switch; `lot_tracking` Switch; `serial_tracking` Switch; `barcode_required` Switch; `reorder_enabled` Switch; `reorder_lead_days` (0–365).
- **SaveBar**. InboxOutlined.

### `mrp` — Manufacturing (MRP) / بەرهەمهێنان
- **File**: bodies.tsx (MrpSettings, useSettingsBag 'mrp') · **Type**: settings-panel · **Group**: commerce
- **Rows**: `quality_checks_required` Switch; `auto_create_work_orders` Switch; `allow_subcontracting` Switch; `allow_byproducts` Switch; `bom_default_qty` (InputNumber); `default_workcenter_capacity_hours` (1–24).
- **SaveBar**. BuildOutlined.

### `pos` — Point of Sale / فرۆشگا
- **File**: bodies.tsx (PosSettings, useSettingsBag 'pos') · **Type**: settings-panel · **Group**: commerce
- **Rows**: `receipt_printer_url` (text ESC/POS); `cash_drawer_enabled` Switch; `barcode_scanner_enabled` Switch; `card_terminal_enabled` Switch; `tip_default_pct` (0–50); `service_charge_pct` (0–50); `offline_mode` Switch; `restaurant_mode` Switch; `require_cashier_pin` Switch.
- **SaveBar**. DesktopOutlined.

### `ecommerce` — E-commerce & website / فرۆشگای ئۆنلاین
- **File**: bodies.tsx (EcommerceSettings, useSettingsBag 'ecommerce') · **Type**: settings-panel · **Group**: commerce
- **Rows**: `storefront_theme` Select (classic/modern/minimal/elegant); `checkout_steps` Segmented (1/2/3); `abandoned_cart_recovery` Switch; when on → `abandoned_cart_hours` (1–168); `reviews_enabled` Switch; `wishlist_enabled` Switch; `seo_default_title` (text); `seo_default_description` (TextArea).
- **SaveBar**. RocketOutlined.

### `helpdesk` — Helpdesk / یارمەتیدان
- **File**: bodies.tsx (HelpdeskSettings, useSettingsBag 'helpdesk') · **Type**: settings-panel · **Group**: commerce
- **Rows**: `default_pipeline` (text); `sla_first_response_hours` (1–168); `sla_resolve_hours` (1–720); `auto_assign` Segmented (manual/round_robin/load_balance); `csat_enabled` Switch; `kb_enabled` Switch; `email_alias` (text).
- **SaveBar**. CustomerServiceOutlined.

### `hr` — Human resources / سەرچاوەی مرۆیی
- **File**: bodies.tsx (HrSettings, useSettingsBag 'hr') · **Type**: settings-panel · **Group**: operations
- **Rows**: `default_contract_type` Select (full_time/part_time/contractor/intern); `probation_days` (0–365); `annual_leave_days` (0–60); `sick_leave_days` (0–60); `weekly_off_days` (0–3); `max_overtime_hours` (0–200); `require_check_in` Switch; `geofence_enabled` Switch.
- **SaveBar**. TeamOutlined.

### `payroll` — Payroll / مووچە
- **File**: bodies.tsx (PayrollSettings, useSettingsBag 'payroll') · **Type**: settings-panel · **Group**: operations
- **Rows**: `pay_period` Segmented (weekly/biweekly/monthly); `pay_day` (1–31); `tax_withholding_pct` (0–50); `social_security_pct` (0–50); `overtime_multiplier` (1–3); `allowance_default` (InputNumber); `deduction_default` (InputNumber); `payslip_email_enabled` Switch.
- **SaveBar**. WalletOutlined.

### `projects` — Projects & timesheets / پڕۆژەکان
- **File**: bodies.tsx (ProjectsSettings, useSettingsBag 'projects') · **Type**: settings-panel · **Group**: operations
- **Rows**: `default_billing` Segmented (fixed/time_material/milestone); `require_timesheet_approval` Switch; `default_hourly_rate` (InputNumber); `budget_alert_pct` (1–100); `gantt_enabled` Switch; `kanban_enabled` Switch.
- **SaveBar**. ProjectOutlined.

### `marketing` — Marketing / بازاڕگەری
- **File**: bodies.tsx (MarketingSettings, useSettingsBag 'marketing') · **Type**: settings-panel · **Group**: operations
- **Rows**: `default_sender_name` (text); `default_sender_email` (text); `double_opt_in` Switch; `unsubscribe_footer` (TextArea); `track_opens` Switch; `track_clicks` Switch; `max_emails_per_day` (InputNumber); `ab_testing_enabled` Switch.
- **SaveBar**. SoundOutlined.

### `workflows` — Workflows / ئۆتۆماتیک
- **File**: bodies.tsx (WorkflowsSettings) · **Type**: list · **Group**: automation
- **Table columns**: name, trigger (Tag), status (Active/Paused Tag), actions (Pause/Activate toggle + Delete Popconfirm).
- **Action**: "Open builder" (PlusOutlined primary, navigates `/automation/workflows`). PartitionOutlined.
- **Error state**: Alert (warning, "Retry" button) on load error (429 → quota message).
- **API**: GET `/api/automation/workflows`; POST `.../{id}/toggle`; DELETE.

### `approvals` — Approvals / پەسەندکردنەکان
- **File**: bodies.tsx (ApprovalsSettings) · **Type**: list · **Group**: automation
- **Table columns**: name, entity (Tag), threshold (number), status (Active/Paused Tag), actions (Pause/Activate + Delete).
- **Action**: "Open approvals" (PlusOutlined primary→`/approvals`). CheckCircleOutlined. Error Alert + Retry.
- **API**: GET `/api/approvals/approval-rules`; POST `.../{id}/toggle`; DELETE.

### `integrations` — Integrations / یەکخستنەکان
- **File**: bodies.tsx (IntegrationsSettings, useSettingsBag 'integrations') · **Type**: settings-panel · **Group**: automation
- **Rows**: `whatsapp_enabled` Switch (→`whatsapp_phone_id` text when on); `google_calendar` Switch; `google_drive` Switch; `dropbox` Switch; `slack_webhook` (URL); `teams_webhook` (URL); `stripe_enabled` Switch; `shopify_enabled` Switch; `openai_enabled` Switch; `ocr_enabled` Switch.
- **SaveBar**. ClusterOutlined. Help popover.

### `integrations_health` — Integration health / تەندروستی یەکخستن
- **File**: frontend/src/settings/sections/IntegrationHealthSection.tsx · **Type**: list · **Group**: automation (mounted via SettingsSectionPanel `integrations_health`)
- **Table columns**: label (Integration), status (Tag green ok/orange preview/red missing), message (Detail), action (Configure link button).
- **Buttons**: Refresh. ClusterOutlined. GET `/api/settings/integration-health`.

### `webhooks` — Webhooks / ویبهوک
- **File**: bodies.tsx (WebhooksSettings, useSettingsBag 'webhooks') · **Type**: settings-panel · **Group**: automation
- **Rows**: `endpoints` (TextArea, one URL per line); `signing_secret` (password); `events` Select multiple (13 events: invoice.*, order.*, customer.*, payment.*, inventory.*); `retry_attempts` (0–10); `retry_backoff_seconds` (1–3600); `timeout_seconds` (1–300).
- **SaveBar**. BranchesOutlined.

### `api_tokens` — API tokens & OAuth / تۆکنی API
- **File**: bodies.tsx (ApiTokensSettings, useSettingsBag 'api_tokens') · **Type**: settings-panel · **Group**: automation
- **Rows**: `rate_limit_per_min` (InputNumber); `default_token_ttl_days` (1–3650); `require_ip_whitelist` Switch; when on → `ip_whitelist` (TextArea CIDRs); `require_2fa_for_token_creation` Switch.
- **SaveBar**. ApiOutlined.

### `documents` — Documents (DMS) / دۆکیومێنتەکان
- **File**: bodies.tsx (DocumentsSettings, useSettingsBag 'documents') · **Type**: settings-panel · **Group**: content
- **Rows**: `storage_backend` Segmented (local/s3/gcs); `max_file_size_mb` (1–1024); `ocr_enabled` Switch; `share_link_expiry_days` (1–365); `require_signin_for_share` Switch; `allowed_extensions` (text).
- **Header action**: "Open documents" (→`/dms`). SaveBar. FolderOpenOutlined.

### `sms_whatsapp` — SMS & WhatsApp / SMS و واتساپ
- **File**: bodies.tsx (SmsWhatsappSettings, useSettingsBag 'sms_whatsapp') · **Type**: settings-panel · **Group**: content
- **Rows**: `provider` Select (local/twilio/vonage/meta_wa); `sender_id` (text); `account_sid` (text); `auth_token` (password); `wa_phone_number_id` (text); `otp_template` (TextArea); `daily_quota` (InputNumber).
- **SaveBar**. MessageOutlined. Help popover.

### `audit` — Audit & compliance / تۆمار و پابەندبوون
- **File**: bodies.tsx (AuditSettings, useSettingsBag 'audit', accent warning) · **Type**: settings-panel · **Group**: system
- **Rows**: `retention_days` (30–3650); `export_format` Segmented (csv/json/both); `anomaly_alerts` Switch; when on → `alert_email` (text); `immutable_log` Switch.
- **Header action**: "Open audit log" (→`/audit-log-viewer`). SaveBar. AuditOutlined. Help popover.

### `gdpr` — Data privacy (GDPR/CCPA) / تایبەتمەندی داتا
- **File**: bodies.tsx (GdprSettings, useSettingsBag 'gdpr', accent danger) · **Type**: settings-panel · **Group**: system
- **Rows**: `consent_required` Switch; `dsr_email` (text); `default_retention_days` (30–3650); `allow_self_export` Switch; `allow_self_delete` Switch; `breach_notify_within_hours` (1–168); `breach_notify_email` (text).
- **SaveBar**. EyeInvisibleOutlined.
- **NOTE**: this is the legacy `gdpr` body. The NEW shell registry `system.gdpr` instead loads the functional `DataRights.tsx` (export/erase) — documented below.

### `mobile` — Mobile app / ئەپی مۆبایل
- **File**: bodies.tsx (MobileSettings, useSettingsBag 'mobile') · **Type**: settings-panel · **Group**: system
- **Rows**: `push_enabled` Switch; `biometric_required` Switch; `force_min_version` (text); `deep_link_scheme` (text); `offline_sync_enabled` Switch; `camera_barcode_enabled` Switch.
- **SaveBar**. MobileOutlined.

---

### SETTINGS — supporting components (legacy shell)

### `FeatureFlagMirror` — Feature flags (read-only)
- **File**: frontend/src/settings/sections/system/FeatureFlagMirror.tsx · **Type**: settings-panel (read-only, embedded in Modules panel)
- **Purpose**: Read-only mirror of org feature flags (vendor-managed). Visible only to `isTenantOrgAdmin`.
- **Body**: Info Alert ("Contact vendor"); Table columns: key (Flag), enabled (Yes/No Tag), rollout_percent (%). GET `/feature-flags`.

### `SettingsModulesEmptyState`
- **File**: frontend/src/settings/components/SettingsModulesEmptyState.tsx · **Type**: empty-state
- Antd `Empty` with title/desc; buttons: "Start onboarding" (RocketOutlined, fires `open-onboarding`) + "Module requests" link.

### `ModuleSettingsCard`
- **File**: frontend/src/settings/components/ModuleSettingsCard.tsx · **Type**: card
- Module tile (icon, title, description) + conditional button: "Open settings" (if enabled+primary section) / "Request access" (if in pool not enabled) / "Not included in license" text.

### `SettingsGateBanner`
- **File**: frontend/src/settings/components/SettingsGateBanner.tsx · Info Alert "View only" shown when denyReason==='view_only'.

---

### NEW SETTINGS SHELL (Phase P5) — migrated section files

### `general.company` — Company / کۆمپانیا
- **File**: frontend/src/pages/settings/sections/general/CompanyInfo.tsx · **Type**: settings-panel/form · **Group**: general
- **Fields**: `name` (text, required max200) `settings:company.name`; `legal_name`; `registration_number`; `tax_id`; `commercial_registration_no` (text, Iraqi, pattern `^(?:[A-Za-z]{2}-)?\d{6,15}$`, tooltip, placeholder BG-123456); `fiscal_year_start` (DatePicker); `timezone` (Select showSearch 6 zones, required); `email` (email type); `phone`.
- **Buttons**: Save (primary, optimistic via React Query), Reset. Spin/Alert load+error states.
- **API**: GET/PUT `/api/system/organization` (useClassedQuery class C).

### `general.localization` — Localization / ناوخۆیی‌کردن
- **File**: frontend/src/pages/settings/sections/general/Localization.tsx · **Type**: settings-panel/form · **Group**: general
- **Fields**: `language` Select (ku/ar/en, required); `currency` Select (IQD/USD/EUR/SAR/AED, required); `date_format` Select (3 patterns); `number_format` Select (western / arabic-indic); `rtl_override` Switch.
- **Live preview Card** (inner): formatted currency / number / date using selected locale.
- **Buttons**: Save (applies i18n.changeLanguage), Reset. GET/PUT `/api/system/settings/localization`.

### `general.branding` — Branding / برێندینگ
- **File**: frontend/src/pages/settings/sections/general/Branding.tsx · **Type**: settings-panel/form · **Group**: general
- **Fields**: `logo_url` (text + Upload button → POST `/api/files/upload`); `logo_dark_url`; `favicon_url`; `primary_color` (color, required); `accent_color` (color, required); `theme_mode` Segmented (light/dark/system).
- **Buttons**: Save, Reset. GET/PUT `/api/system/settings/branding`.

### `system.gdpr` — Data rights (GDPR/PDPL) / مافی داتا
- **File**: frontend/src/pages/settings/sections/system/DataRights.tsx · **Type**: settings-panel · **Group**: system
- **Purpose**: Tenant-admin self-service export + erasure. Perms: `privacy.export`, `privacy.erasure` (403 Result if neither).
- **Card 1 Export (CloudDownloadOutlined)**: "Request export" button (POST `/api/data-rights/export`) + "Refresh status" button. Descriptions: status Tag (ready/pending/failed), documents, archive size, requested_at, download (signed_url link), collections Tags.
- **Card 2 Erasure (DeleteOutlined)**: warning Alert; "Request erasure" (danger) button → opens confirm modal. Descriptions: status Tag (awaiting_confirmation/scheduled/completed/cancelled), grace period, scheduled deletion, confirm token (copyable code).
- **Erasure confirm Modal**: typed-confirmation `Input` (must type "ERASE"), reason `TextArea` (optional, max2000); OK="Request erasure" (danger, disabled until armed) → POST `/api/data-rights/erasure`.

### `TodoPlaceholder` / `SectionTemplate`
- **Files**: frontend/src/pages/settings/sections/_template/{TodoPlaceholder,SectionTemplate}.tsx
- TodoPlaceholder: info Alert "Section pending migration" (renders for all not-yet-migrated registry entries). SectionTemplate: documented copy-template (single field example) — not user-facing.

### `pages/settings/sections.registry.ts`
- **File**: frontend/src/pages/settings/sections.registry.ts · **Type**: registry (no UI)
- Defines `SECTIONS` map of ~50 keys across 11 groups with titleKey/fallbackTitle/subtitleKey/group/loader/badge. Badges: `users.sso` = beta. `DEFAULT_SECTION_KEY='general.company'`.

---

### STANDALONE SETTINGS PAGES (pages/settings/)

### `/settings/numbering` (route) — Numbering sequences / ژمارەکردن
- **File**: frontend/src/pages/settings/NumberingSequences.tsx · **Type**: list (CRUD)
- **Back link**: "Settings — Numbering" (→`/settings?s=numbering`).
- **Table columns**: branch (resolved name), doc_type (i18n), prefix (Tag), format_template (code), next_value (Tag blue), example (Tag green, live preview), actions (Edit/Delete Popconfirm).
- **Action**: "Create sequence" (PlusOutlined primary).
- **Modal (FormDialog)**: `branch_id` Select (disabled on edit, required); `doc_type` Select (invoice/sales_order/purchase_order/credit_note/bill/receipt, disabled on edit); `prefix` (text, required); `padding` (InputNumber 1–10, required); `format` (text `{prefix}-{branch_code}-{year}-{seq}`, required, hint); `next_value` (InputNumber, required); live preview box.
- **API**: GET/POST/PUT/DELETE `/numbering/sequences`; GET `/api/branches`.

### `/settings/module-requests` — Module requests / داواکاری مۆدیوول
- **File**: frontend/src/pages/settings/ModuleRequestsPage.tsx · **Type**: list (approval queue) — admin/owner only (else access-denied Alert).
- **PremiumPageHeader** + SectionCard "Pending queue".
- **Table columns**: user (name + email), requested_modules (Tags), note, actions (Approve primary CheckOutlined + Reject danger CloseOutlined).
- **Modals**: (a) Approve — Checkbox.Group of modules → POST `.../{id}/approve`. (b) Reject — reason textarea → POST `.../{id}/reject`.
- **API**: GET `/api/onboarding/module-requests?status=pending`.

### `/settings/system-health` — System health / تەندروستی سیستەم
- **File**: frontend/src/pages/settings/SystemHealthPage.tsx · **Type**: dashboard — admin/owner/super-admin only (redirects others to /dashboard).
- **Header**: title + LastCheckedTimestamp + Refresh button (force bypass cache).
- **Body**: OverallStatusBanner (Alert success/warning/error/"unavailable"); ComponentCard grid (per-component: Badge + name + status Tag + response_time_ms + message); RecommendationsPanel (List); BackupHistoryTable.
- **BackupHistoryTable**: columns date/time, status (Badge+Tag, tooltip error/checksum), integrity (Verified/Failed/Pending Tag), total docs, file size, storage path (tooltip), download (button, disabled if failed). Action "Run Backup Now" (PlayCircleOutlined primary). Failed rows red bg.
- **States**: Skeleton (loading), error Alert + Retry, empty backup text. Auto-refresh 60s.
- **API**: GET `/api/system/health/full` (force param), `/api/system/backup/list`, POST `/api/system/backup/run`, GET `.../{id}/download`. (Uses `useClassedQuery` class B.)

### TenantSystemHealthRedirect
- **File**: frontend/src/pages/settings/TenantSystemHealthRedirect.tsx · **Type**: other (redirect)
- Super-admin → `/platform/health`; others → `/settings?s=system`. Spin + info Alert "Platform feature".

### `pages/settings/SettingsShell.tsx` (P5 shell) — documented in Architecture above.

### `/settings/payments/providers` — Payment Providers / دابینکەرانی پارەدان
- **File**: frontend/src/pages/settings/payments/Providers.tsx · **Type**: list of provider cards
- **PageHeader** "Payment Providers". One `ProviderCard` per provider (cash, cod, stripe, fastpay, qi, zain, asia_pay).
- **ProviderCard**: title (display_name + Tags: sandbox/credentials pending/configured) + Switch (enabled, disabled if credentials_pending & not configured). Info Alert when credentials_pending. Config Form: per provider config_fields (text or secret Input.Password) + Save button. "No configuration required" for cash/cod.
- **API**: GET `/api/payments/providers`; PUT `/api/payments/providers/{slug}/config`.

### `/settings/payments/reconciliation` — Reconciliation Queue / ڕیزی ڕێکخستن
- **File**: frontend/src/pages/settings/payments/Reconciliation.tsx · **Type**: list
- **Filters Card**: provider Select (cash/cod/stripe/fastpay/qi/zain) + RangePicker.
- **Table columns**: provider (Tag), kind (Tag — unmatched_inbound orange / unmatched_outbound red / amount_mismatch gold), description, settlement_date, expected, actual, actions (Match / Investigate / Ignore-danger).
- **Resolve Modal**: description text + resolution Select (match/investigate/ignore) + audit reason TextArea (required); OK="Confirm" → POST `.../{id}/resolve`.
- **Empty**: "No open issues". GET `/api/payments/reconciliation`.

### `/settings/efakhata/cert` — e-Fakhata signing certificate
- **File**: frontend/src/pages/settings/efakhata/CertManagement.tsx · **Type**: form + list (i18n ns 'efakhata')
- Warning Alert (PKCS#12 encrypted at rest). **Upload Card**: Upload `.p12/.pfx` (Select file button) + `password` (Input.Password, required) + Upload button → POST `/api/tenants/{tid}/efakhata/cert` (multipart). **Version history Card**: table Version/Uploaded/Fingerprint(code)/Status(active/revoked Tag) + "Revoke active" (danger Popconfirm) → DELETE `.../cert`.
- Resolves tenantId from localStorage org store. GET `/api/tenants/{tid}/efakhata/cert`.

### `/settings/efakhata/export` — Tax auditor export
- **File**: frontend/src/pages/settings/efakhata/AuditorExport.tsx · **Type**: form + list (i18n ns 'efakhata')
- Info Alert (ZIP with signed XML+PDF+manifest, 7-day link). **Request Card**: inline Form — `range` RangePicker (required) + "Request export" button → POST `/api/efakhata/auditor-export`. **Past exports Card**: table range/invoices/status(Tag pending/ready/failed)/requested_by/created/download(link when ready). Polls every 15s while pending.

---

### TOP-LEVEL ADMIN / RBAC PAGES

### `/settings` → Settings.tsx
- **File**: frontend/src/pages/Settings.tsx · One-line re-export of `../settings/shell/SettingsShell`.

### `/rbac-roles` (or similar) — RBAC Roles & Permissions
- **File**: frontend/src/pages/RbacRoles.tsx · **Type**: list (CRUD) — hardcoded English title "RBAC — Roles & Permissions" (SafetyOutlined).
- **Top Card**: "My permissions" — Superuser(*) Tag or count.
- **Roles Card**: table columns code (Tag + System Tag), name, ناو (name_ku, hardcoded Kurdish header), permissions (ALL(*) red or count), edit/delete (disabled for system). Action "New Role".
- **Modal (FormDialog)**: `code` (required, "sales_viewer"); `name` (EN, required); `name_ku` ("ناو (کوردی)"); `permissions` Select multiple searchable (required, maxTagCount 10).
- **API**: GET `/api/rbac/roles|permissions|me/permissions`; POST/PUT/DELETE `/api/rbac/roles`.

### `/user-roles` — Users & Role Assignment
- **File**: frontend/src/pages/UserRoles.tsx · **Type**: list — title `t('user_roles')` (SafetyOutlined).
- **Card**: search Input (by email/full_name). Table columns: user (Avatar+name+email), legacy_role (Tag), assigned_roles (green Tags, deduped), status (Active/Inactive Tag), "Assign Roles" link.
- **Modal (FormDialog)**: multi-select roles (label `name (code)`) → PUT `/api/rbac/users/{id}/roles`.
- **API**: GET `/api/rbac/users|roles`.

### `/users` — User Management
- **File**: frontend/src/pages/Users.tsx · **Type**: list (CRUD + lifecycle) — `t('users')` (TeamOutlined) + HelpIcon. AddGate-wired (`users.list`).
- **Filters**: search Input; status Select (active/invited/suspended/archived); role Select; "Show archived" toggle button; Refresh; "Invite" (MailOutlined); "Add user" (PlusOutlined primary).
- **Table columns**: user (Avatar+name+email), status (Tag colored), assigned_roles (Tags), last_login, actions (Dropdown: Edit / Resend-invite or Reset-password / Suspend or Activate / divider / Archive-danger).
- **Modal 1 (create|edit|invite)**: `name` (required min2 max80); `email` (required email, disabled on edit); `password` (create only — min8, must have uppercase+digit); `status` Select (edit only); `role_ids` multi-select.
- **Modal 2 Reset password**: `new_password` (required min8).
- **Modal 3 Invite result**: read-only invite URL TextArea + Copy button + expiry text.
- **API**: GET `/api/users`, `/api/rbac/roles`; POST `/api/users`, `/api/users/invite`, `.../suspend|activate`, `.../invite/{id}/resend`, `.../reset-password`; PUT `/api/users/{id}`; DELETE.

### `/custom-fields` — Custom fields / خانە تایبەتەکان
- **File**: frontend/src/pages/CustomFields.tsx · **Type**: list (CRUD)
- **PageHeader** "custom_fields" + "Add" button. ExportMenu (csv) + ColumnVisibility.
- **Table columns**: field_name, entity_type (i18n), field_type (Tag), required (Yes red/No Tag), actions (Edit/Delete Modal.confirm).
- **Modal (FormDialog)**: `entity_type` Select (invoice/quote/contact/item/expense/bill/sales_order/purchase_order, required); `field_name` (required); `field_type` Select (text/number/date/select/boolean, required); `options` (text, comma-separated — only when type=select); `is_required` Switch.
- **API**: GET/POST/PUT/DELETE `/api/custom-fields`.

### `/automation-rules` — Automation rules / یاساکانی ئۆتۆماتیک
- **File**: frontend/src/pages/AutomationRules.tsx · **Type**: list (CRUD)
- **PageHeader** `automation.title` + "New rule". Info Alert linking to visual builder (`/automation/workflows`).
- **Table columns**: name, entity_type (Tag blue), trigger (Tag purple), action_type (Tag green), active (Tag), actions (Pause/Play toggle + Run-now PlayCircle + Edit + Delete).
- **Modal (FormDialog)**: `name` (required); `entity_type` Select (invoice/bill/lead/opportunity/contact, required); `trigger` Select (on_create/on_update/on_delete, required); `condition` (TextArea "amount > 1000"); `action_type` Select (send_email/create_activity/webhook/log, required); `action_config` (TextArea JSON); `active` Switch.
- **API**: GET/POST/PATCH/DELETE `/api/automation/automated-actions`; POST `.../{id}/run`.

### `/email-templates` — Email templates / قاڵبی ئیمەیڵ
- **File**: frontend/src/pages/EmailTemplates.tsx · **Type**: list (CRUD + preview)
- **PageHeader** "email_templates" + "New". Table columns: name, doc_type, subject (ellipsis), is_default (Yes/No), actions (Preview eye / Edit / Delete).
- **Modal (FormDialog edit/new)**: `name` (required); `doc_type` Select (invoice/quote/bill/po/so/statement, required); `subject` (required); `body_html` (TextArea rows10, required); `is_default` Switch; variables hint box (`{{contact_name}}` etc).
- **Preview Modal**: subject + sanitized HTML render (POST `.../{id}/preview` with sample Kurdish data). hideFooter.
- **API**: GET/POST/PUT/DELETE `/api/email-templates`.

### `/trash` — Trash / تەنەکەی خۆڵ
- **File**: frontend/src/pages/Trash.tsx · **Type**: list (restore/purge) — title `t('trash')` (DeleteOutlined) + Refresh + HelpButton.
- **Stats row**: "Total in trash" Statistic + retention notice Card.
- **Card "deleted_items"**: collection filter Select (with counts). Table columns: _collection (Tag), name, deleted_at, actions (Restore primary UndoOutlined + Delete-forever danger Popconfirm "action_irreversible").
- **Empty**: "trash_empty".
- **API**: GET `/api/trash` (params collection), `/api/trash/stats`; POST `/api/trash/restore/{col}/{id}`; DELETE `/api/trash/permanent/{col}/{id}`.

### `/docs` — Help Center / ناوەندی یارمەتی
- **File**: frontend/src/pages/DocsHub.tsx · **Type**: list/search (docs hub) — title `t('docs_hub','Help Center')` (BookOutlined) + HelpButton.
- **Search Card**: large Input.Search. Results: grid of clickable help cards (title, key Tag, purpose) OR section-grouped Collapse (14 sections: getting-started, sales, purchases, banking, inventory, accounting, reports, pos, crm, hr, projects, setup, system, other) with count Badges.
- **PageHelp drawer** opens on card click. Empty: "No results found". Sources from `data/page-help`.

---

### AUTH PAGES (two parallel sets)

> All auth pages use `AuthLayout` (RTL, `direction:rtl`), `ResponsiveForm layout="single"`, error `Alert` (closable, RTL). Inputs `className="auth-input"` h46 radius10; buttons `className="auth-btn"`.

### `/login` — Login / چوونەژوورەوە (legacy)
- **File**: frontend/src/pages/Login.tsx · **Type**: form
- **Fields**: `email` (required, email type, MailOutlined); `password` (Input.Password, required, LockOutlined). "Forgot password?" link.
- **Buttons**: Login (primary block) → POST `/api/auth/login`; Divider "or"; GoogleSignInButton → POST `/api/auth/firebase-login`. Footer link to /signup.
- **Errors**: maps Kurdish backend "use Google" message; 404 → not-registered; Google error codes (unauthorized-domain/popup-blocked/network).

### `/login` — LoginPage (v1 secure, MFA-aware)
- **File**: frontend/src/pages/auth/LoginPage.tsx · **Type**: form
- Same fields as above (with autoComplete). POST `/api/v1/auth/login`; on `mfa_required` → stores mfa_session_token in sessionStorage, navigate `/mfa`. Uses `loginSecure` + `getPostLoginPath(role, perms)`. 423 → account-locked message. Google → `/api/v1/auth/firebase-login`.

### `/mfa` — MFA / پشتڕاستکردنی دووەم
- **File**: frontend/src/pages/auth/MFAPage.tsx · **Type**: form (OTP) — SafetyCertificateOutlined icon, Framer Motion entrance.
- **Control**: custom `OtpInput` (6 individual digit boxes, LTR, auto-advance, paste support, auto-submit on 6 digits) → POST `/api/v1/auth/mfa/verify`. "Verify" button (disabled until 6 digits). "Back to login" link (clears session). Help text.
- **Errors**: 401/422 → invalid code; 429 → too many attempts. Redirects to /login if no session token.

### `/signup` — SignUp / تۆمارکردن (legacy)
- **File**: frontend/src/pages/SignUp.tsx · **Type**: form
- **Fields**: `org_name` (required, BankOutlined); `user_name` (required, UserOutlined); `email` (required, email); `password` (required, min6); `confirm_password` (required). Checks password match.
- **Buttons**: Signup (primary block) → POST `/api/auth/register` + markFreshSignup; Divider; GoogleSignInButton → opens org-name FormDialog → POST `/api/auth/firebase-register`. Footer link to /login.
- **Org Modal (FormDialog)**: `org_name` Input (BankOutlined).

### `/signup` or `/register` — RegisterPage (v1 secure, strength meter)
- **File**: frontend/src/pages/auth/RegisterPage.tsx · **Type**: form — ConfigProvider dir, isRTL-aware.
- **Fields**: `org_name` (required); `user_name` (required min2); `email` (required email, LTR); `password` (validator: min8 + uppercase + number + special) with live `PasswordStrengthIndicator` (Progress bar + 4 rule checks, weak/fair/good/strong); `confirm_password` (validator matches).
- **Buttons**: Signup (primary) → POST `/api/v1/auth/register` → navigate `/onboarding`; Google → org-name FormDialog → POST `/api/v1/auth/firebase-register`. Footer link to /login.

### `/forgot-password` — Forgot password / لەبیرچوونی وشەی نهێنی
- **File**: frontend/src/pages/ForgotPassword.tsx · **Type**: form
- **Field**: `email` (required, email, MailOutlined). Button "Reset password" → POST `/api/auth/forgot-password`. On success → Result (success, "Back to login" button). Footer link to /login.

### `/reset-password` — Reset password / گۆڕینی وشەی نهێنی
- **File**: frontend/src/pages/ResetPassword.tsx · **Type**: form — reads `?token=`.
- **Fields**: `new_password` (required min6, LockOutlined); `confirm_password` (required). Button "Reset password" → POST `/api/auth/reset-password`. Success → Result + "Login" button. Missing/expired token → warning Alert. Footer link to /login.

### `/accept-invite` — Accept invitation / پەسەندکردنی بانگهێشت
- **File**: frontend/src/pages/AcceptInvite.tsx · **Type**: form — reads `?token=`, public.
- **States**: verifying (Spin); invalid/expired (Result error + "Go to login"); valid (Card).
- **Card**: shows org_name + invited name/email. **Fields**: `password` (required min8 + uppercase + digit validators); `confirm` (matches). Button "Activate account" (block) → POST `/api/users/accept-invite`, auto-login (localStorage), navigate `/`.
- **API**: GET `/api/users/invite/verify?token=`.

---

### ADMIN / PLATFORM PAGES

### `/admin/impersonate` — Impersonate tenant / خۆ-وەک-تینانت
- **File**: frontend/src/pages/admin/ImpersonateTenant.tsx · **Type**: form (super-admin) — Card, hardcoded-default English i18n labels.
- Intro Paragraph + warning Alert (audited, 30-min, read-only, 18-month retention).
- **Fields**: `tenant_id` (required min1 max128); `target_user_id` (optional, tooltip); `reason` (TextArea, required min10 max500, visible to auditors).
- **Button**: "Start impersonation" (primary danger) → confirm Modal (shows tenant + reason) → POST `/api/admin/impersonate/start`, stores token, redirects `/`.

### `/admin/jobs` — Scheduler / Job runs / ژوبەکان
- **File**: frontend/src/pages/admin/JobRunsLog.tsx · **Type**: dashboard + 2 lists
- **Card 1 "scheduler_title"** (ClockCircleOutlined, scheduler running/stopped Tag, Refresh): Statistics (total jobs / recently run green / failed red). **Registered jobs table**: name, next_run (+relative), last_status (Tag + relative), last_run_stats (processed/failed/duration), actions ("Trigger now" PlayCircle Popconfirm).
- **Card 2 "execution_history"**: filters — job Select + status Select (success/partial/failed). Table: started_at, job_name, status (Tag), processed, failed (red), duration. Rows clickable → details FormDialog (job, status, started/finished, duration, processed/failed, errors list in red card).
- **API**: GET `/api/jobs/status`, `/api/jobs/runs`, `/api/jobs/runs/{id}`; POST `/api/jobs/{name}/trigger`. Auto-refresh 60s.

### `/admin/saas-billing` — SaaS Billing (Admin) / بیلینگی SaaS
- **File**: frontend/src/pages/admin/SaasBillingDashboard.tsx · **Type**: dashboard (super-admin; 403 Alert otherwise)
- **Stat rows**: MRR(IQD د.ع), MRR(USD $), ARR(IQD), Monthly churn(%); Active(green), Trialing(blue), Past due(orange), Suspended(red).
- **Tenants Table**: tenant_id, plan_slug, status (Tag colored), billing_cycle, MRR (sortable), trial_ends_at, last_payment_at. Pagination 25.
- **API**: GET `/api/saas-billing/admin/dashboard`, `/api/saas-billing/admin/tenants?page_size=200`.

### `/platform/org-license` — Organization licenses / مۆڵەتی ڕێکخراوەکان
- **File**: frontend/src/pages/platform/OrgLicenseEditor.tsx · **Type**: form (vendor/platform.manage)
- PremiumPageHeader + info Alert (requires platform.manage + allowlist).
- **Fields**: `orgId` Select (searchable, from `/api/companies`, with manual-entry dropdown input + Load button); `bundleId` Select (BUNDLES, onChange sets modules); `modules` Select multiple (only when bundle=custom; from MODULES with icons); module preview Tags (non-custom); `expiresAt` DatePicker (optional).
- **Button**: "Save license" (primary) → PUT `/api/platform/orgs/{id}/license`. Load → GET `.../license`.

### `/pricing` — Pricing / نرخەکان
- **File**: frontend/src/pages/pricing/Pricing.tsx · **Type**: dashboard/marketing (public, sets SEO/OG meta)
- **Header**: headline + subhead (trial days). Toggles: currency Segmented (IQD/USD); cycle Segmented (Monthly / Annual -17% Tag).
- **Plan cards** (3, from `/api/saas-billing/plans`, accent per starter/growth/pro): name_ku + name_en, price (monthly derived), billed-annually note. FeatureLine list: users, invoices/month (or unlimited), POS terminals (or unlimited), multi_currency, api_access, priority_support, sso (CheckOutlined green/grey strikethrough). CTA "Start free trial" → `/signup?plan=&cycle=&currency=`.
- **FAQ**: Collapse of 4 Q/A (i18n keys). Loading Spin.

---

### ONBOARDING

### `/onboarding` — OnboardingWizard (industry/module picker, legacy)
- **File**: frontend/src/pages/onboarding/OnboardingWizard.tsx · **Type**: wizard (5 steps) — wrapped in AddGateProvider; redirects to checklist if completed.
- **Steps (FlowProgressIndicator)**: 1 Company, 2 Currency & Tax, 3 COA, 4 Modules, 5 Sample Data.
  - **Step 1**: `companyName` Input (required); `companyCountry` Select (IQ/US/GB/AE).
  - **Step 2**: `currencyCode` Radio.Group (IQD/USD/EUR/GBP); `taxPreset` Select (iraq 15% / vat20 / vat10 / none).
  - **Step 3**: `industryId` Radio.Group (retail/manufacturing/services/wholesale/restaurant/construction).
  - **Step 4**: module Checkboxes (10: inventory, manufacturing, pos, crm, hr, projects, field_service, subscriptions, quality, maintenance).
  - **Step 5**: Result success + FlowFinalSummary (unsatisfied sections) + `loadSampleData` Checkbox.
- **Footer**: Back / Skip(→dashboard) / Next-or-Finish (primary). AddGate blocks advance on empty required section.
- **Finish**: PUT `/api/organizations/current`; POST `/api/accounts/setup-preset`; POST `/api/tax-settings`; PUT `/api/onboarding/preferences`; optional POST `/api/onboarding/load-sample-data` → navigate `/onboarding/checklist`.

### `/onboarding/checklist` — Onboarding checklist / لیستی دەستپێک
- **File**: frontend/src/pages/onboarding/OnboardingChecklist.tsx · **Type**: dashboard (checklist) — AddGate-wrapped.
- **Progress Card**: Progress bar (`completed/total`), help text. **List**: 6 items (add_bank, add_contact, add_item, first_invoice, invite_user, setup_tax) — each with completed Tag or "required incomplete" Tag + action link button.
- **Footer**: "Go to dashboard" + "View docs" (when <100%). GET `/api/onboarding/checklist` (static fallback).

---

### GET-STARTED WIZARD (`src/onboarding/` — 5-step launch-readiness, route `/get-started`)

> State machine `frontend/src/onboarding/state.ts` (Zustand `useOnboardingWizardStore`): steps 1–5, `stepStatus` (pending/in_progress/completed/skipped), auto-skip POS step for service/ngo, `normalizeIraqPhone()` E.164, persists to GET/PUT `/api/onboarding/state`. Telemetry in `telemetry.ts`.

### OnboardingShell (wizard container)
- **File**: frontend/src/onboarding/OnboardingShell.tsx · **Type**: wizard shell (i18n ns 'onboarding', Framer Motion RTL-aware)
- **Header**: RocketOutlined + title + progress label (current/5) + Progress bar + numbered step nav (✓ done / n.).
- **Main**: animated step slot (slide/crossfade for reduced-motion) + step title/description.
- **Footer**: Back (when step>1) / Skip (text) / Next (primary, disabled unless canProceed, RTL arrow) or Finish (RocketOutlined, step 5).
- **CompletionScreen**: 🎉 + title + message + "Go to dashboard" button + CSS-only ConfettiBurst.

### Step 1 — `StepCompanyInfo` / زانیاری کۆمپانیا
- **File**: frontend/src/onboarding/steps/StepCompanyInfo.tsx · **Type**: wizard-step (form)
- **Fields**: `company_name` (required min2 max120); `legal_name` (tooltip); `governorate_code` Select (18 Iraq regions, searchable); `city`; `district`; `address_line`; `phone` (E.164 validator, live-normalized hint); `email` (email); `tax_id` (Iraqi commercial reg, tooltip); `vat_status` Radio.Group (registered/not_registered/pending, required); `business_type` Select (retail/restaurant/pharmacy/services/manufacturing/wholesale/ngo, required); `intended_use` Checkbox.Group (same 7). Privacy-notice info Alert. Writes live to store.

### Step 2 — `StepIraqRegion` / ناوچەی عێراق
- **File**: frontend/src/onboarding/steps/StepIraqRegion.tsx · **Type**: wizard-step (map + list)
- **Toggle**: Switch "list view" (vs SVG map). **Map**: 18 governorate tiles (clickable + keyboard, KRG green), stylized 6×5 grid SVG. **List**: Radio.Group of 18 regions (KRG Tag).
- **Side Card**: capital, currency, timezone, KRG Tag, tax rates list (rate% + applies_to Tags), withholding rates (services/rent/materials), placeholder notice Tag. From `data/iraqRegionPresets`.

### Step 3 — `StepChartOfAccounts` / هەژمارەکان
- **File**: frontend/src/onboarding/steps/StepChartOfAccounts.tsx · **Type**: wizard-step (template picker)
- **Template cards** (5, selectable, keyboard): small_general_trade (40 acct), medium_general_trade (80), restaurant_cafe (60), pharmacy (70), construction_contractor (120) — each icon + name + description + accounts-count Tag + recommended-for Tags.
- **Preview Tree**: top-level account structure of picked template. **Apply button** (primary, loading) → POST `/api/onboarding/coa/apply`. Success Alert with accounts_created count.

### Step 4 — `StepPOSHardware` / هاردوێری POS
- **File**: frontend/src/onboarding/steps/StepPOSHardware.tsx · **Type**: wizard-step (Web Bluetooth)
- Intro Alert (with "Skip for now" button). Warning Alert when Web Bluetooth unavailable.
- **Printer Card**: "Pair printer" button (ApiOutlined → `navigator.bluetooth.requestDevice` ESC/POS UUID) → paired success Alert + Unpair. `paper_width` Radio (58/80mm). `fallback_browser_print` Switch. "Test print" button (when paired or fallback) + tested-ok Tag.
- **Cash drawer Card**: `cash_drawer_enabled` Switch; when on → `cash_drawer_pin` Radio (pin2/pin5).

### Step 5 — `StepFirstSale` / یەکەم فرۆشتن
- **File**: frontend/src/onboarding/steps/StepFirstSale.tsx · **Type**: wizard-step (4 sub-steps via Steps)
- **Sub-steps (Steps)**: 0 product, 1 customer, 2 sale, 3 receipt.
  - **0 Product Card**: Form `name` (required) + `unit_price` (InputNumber IQD, default 1000) → "Add product" + Skip → POST `/api/items`.
  - **1 Customer Card**: Form `name` (required) + `phone` → "Add customer" + Skip → POST `/api/contacts`.
  - **2 Sale Card**: shows product/customer/total(1000 IQD) Tags → "Charge" (disabled until both) + Skip → POST `/api/invoices` (paid, cash).
  - **3 Receipt Card**: "Print receipt" (printer service or `window.print()`) + "Skip print"; success Alert when printed.

---

### NOTES / GAPS
- All 57 legacy panel bodies are exported from `bodies.tsx` and mounted via `SettingsSectionPanel.tsx`. The `feature_flags` body exists but is NOT in the panel switch (the live Modules panel embeds the read-only `FeatureFlagMirror` instead). The legacy `gdpr` body is mounted in the legacy shell; the NEW shell's `system.gdpr` maps to the functional `DataRights.tsx`.
- Two coexisting Settings shells and two coexisting onboarding wizards (legacy industry/module picker vs new 5-step get-started). Both onboarding stores (`onboarding/store.ts` legacy vs `onboarding/state.ts` new) are independent.
- Legacy `frontend/src/onboarding/OnboardingWizard.tsx` (823 lines, industry/bundle picker for the old `useOnboardingStore`) exists but was outside the strict "state.ts + steps/*" assignment; the live get-started flow documented above is the `OnboardingShell` + `state.ts` + `steps/*` set.
- Bilingual: most labels are `t('key','English fallback')`; Kurdish appears in i18n JSON (not inline). Hardcoded Kurdish verbatim found in: RbacRoles ("ناو", "ناو (کوردی)"), EmailTemplates preview sample ('کڕیار نموونە', 'کۆمپانیا نموونە'), and several auth error-detail string comparisons (e.g. 'ئەم ئیمەیڵە پێشتر تۆمار کراوە', 'تکایە بە Google بچۆرە ژوورەوە', 'لینکی گۆڕینەوە بەسەرچووە').


## ١٣. سیستەمی دیزاین · کۆمپۆنێنتە هاوبەشەکان · درۆپداونی کرۆم / Design System · Shared Components · Chrome dropdowns


Inventory of REUSABLE UI primitives for the Kurdish (Sorani) ERP frontend (antd v6 + React 19, RTL, Zustand, Framer Motion). Scope: `src/design-system/`, `src/components/`, `src/layouts/` chrome. Pages excluded.

Conventions:
- i18n labels recorded as `key` → "English fallback" (2nd arg of `t('key','English')`). Some use `{ defaultValue }`. Hardcoded Kurdish recorded verbatim.
- Most components are token-driven (`theme/tokens.ts` palette/space/radius/shadow), RTL-aware via logical CSS, and respect `prefers-reduced-motion`.

---

### SECTION 1 — design-system/

### DataTable
- **File**: src/design-system/DataTable.tsx
- **Kind**: table
- **Purpose**: ProTable-style wrapper around AntD Table with selection, virtualization, quick actions, export.
- **Key props / variants**: `columns: ColumnDef<T>[]` (extends AntD col + `resizable`), `dataSource`, `loading`, `rowSelection` (bool), `bulkActions`, `exportConfig`, `virtualize` (auto ≥200 rows), `stickyHeader` (default true), `quickActions`, `showDefaultQuickActions`, `onView/onEdit/onMore`, `density: 'compact'|'default'|'comfort'` (→ AntD small/middle/large), `isDark`, `pagination`, `virtualScrollHeight`.
- **Visible labels / text**: default quick action labels "View", "Edit", "More" (hardcoded EN); empty state via `emptyTitle/emptyDescription/emptyActionLabel`; aria-live "{n} rows selected" / "Data table".
- **Actions / buttons it renders**: per-row hover quick-action MotionButtons (view/edit/more), BulkActionBar when rows selected, resize drag handle per resizable column.
- **Sub-parts / slots**: sticky header; fixed-right `__actions` column; integrated `<BulkActionBar>`, `<EmptyState>` (locale.emptyText), `<LoadingSkeleton variant="table">`.
- **States**: loading → table skeleton (8 rows); empty → EmptyState; selection → bulk bar.
- **Notes**: Auto-virtualize threshold = 200 rows (scroll y=600). Row hover reveals actions via CSS opacity. Entry motion fade+y. `react-grid` role, aria-live region.

### FilterBar
- **File**: src/design-system/FilterBar.tsx
- **Kind**: other (toolbar) / form-control
- **Purpose**: Standard search + filter selects + reset/refresh row above list pages.
- **Key props / variants**: `searchPlaceholder/searchValue/onSearchChange`, `filters: FilterDef[]` (key,label,options,multiple), `values`, `onChange`, `extra`, `onReset`, `onRefresh`.
- **Visible labels / text**: `search`→"Search", `reset`→"Reset", `refresh`→"Refresh" (tooltip).
- **Actions / buttons it renders**: search Input (allowClear, search prefix), filter Selects (multiple/responsive tags, FilterOutlined suffix), Reset MotionButton, Refresh MotionButton (ReloadOutlined), `extra` slot.
- **States**: —
- **Notes**: `React.memo`. Flex-wrap, RTL via logical layout.

### FilterChipTray
- **File**: src/design-system/FilterChipTray.tsx
- **Kind**: other (active-filter chips)
- **Purpose**: Removable chips showing active filters above a list.
- **Key props / variants**: `chips: FilterChip[]` (key,label,value,onRemove), `onClearAll`, `isDark`.
- **Visible labels / text**: `filter_bar_v2.active_filters`→"Active filters", `filter_bar_v2.clear_all`→"Clear all".
- **Actions / buttons it renders**: closable Tag per chip (CloseOutlined), "Clear all" link (shown when >1 chip).
- **Notes**: `React.memo`. Returns null when no chips.

### PageHeader
- **File**: src/design-system/PageHeader.tsx
- **Kind**: layout (header)
- **Purpose**: Title + breadcrumb + actions row standard for every page.
- **Key props / variants**: `title`, `subtitle`, `breadcrumb[]` (label,to), `extra`, `tag`, `helpKey`, `sectionId`.
- **Visible labels / text**: —(content-driven).
- **Actions / buttons it renders**: AntD Breadcrumb (Links), Title (level 3), optional `<HelpIcon sectionId>` or `<HelpButton pageKey>`, `extra` action slot, `tag` slot.
- **Notes**: `React.memo`, motion fade+y down (reduced-motion aware).

### KpiCard
- **File**: src/design-system/KpiCard.tsx
- **Kind**: card
- **Purpose**: Animated metric card for dashboards (value + delta + sparkline).
- **Key props / variants**: `title`, `value` (number→CountUp animated / string), `delta` (legacy `trend`/`trendLabel`), `sparklineData[]`, `icon`, `currency: 'IQD'|'USD'`, `prefix/suffix`, `loading`, `onClick` (navigates), `tone: 'primary'|'success'|'warning'|'danger'|'info'`, `hint` (tooltip).
- **Visible labels / text**: —; aria-label "`{title}: {value}{currency}`".
- **Actions / buttons it renders**: whole card clickable (role=button, Enter/Space) when `onClick`.
- **Sub-parts / slots**: header (title + tone icon chip), animated value (CountUp via MotionGate), delta (Arrow up/down + %), recharts AreaChart sparkline.
- **States**: loading → `LoadingSkeleton variant="card"`.
- **Notes**: `React.memo`, class `premium-card`, hover lift (cardVariants), reduced-motion aware.

### ChartCard
- **File**: src/design-system/ChartCard.tsx
- **Kind**: card
- **Purpose**: Recharts wrapper card with skeleton + error + retry + hover lift.
- **Key props / variants**: `title`, `subtitle`, `extra`, `children`, `loading`, `error`, `onRetry`, `isDark`, `height` (default 280), `animated`.
- **Visible labels / text**: `retry`→"Retry".
- **Actions / buttons it renders**: title/subtitle header, `extra` slot, error Alert with Retry button.
- **States**: loading → `LoadingSkeleton variant="chart"`; error → Alert + Retry; else children.
- **Notes**: `React.memo`, class `premium-card`, hover lift.

### SectionCard
- **File**: src/design-system/SectionCard.tsx
- **Kind**: card / layout
- **Purpose**: Consistent section container for forms/settings/details.
- **Key props / variants**: `title`, `subtitle`, `extra`, `bordered`, `padded`, `elevation: 0|1|2`, `style/bodyStyle`.
- **Visible labels / text**: —.
- **Sub-parts / slots**: header (title + subtitle + extra), body.
- **Notes**: `React.memo`, class `premium-card`, dark-aware via authStore theme.

### ConfirmDialog
- **File**: src/design-system/ConfirmDialog.tsx
- **Kind**: dialog
- **Purpose**: Danger/neutral confirmation modal (built on responsive FormDialog).
- **Key props / variants**: `open`, `title`, `description`, `okText` (def "OK"), `cancelText` (def "Cancel"), `danger` (red OK + suppresses swipe-dismiss), `loading`, `onOk`, `onCancel`, `ariaLabel`.
- **Visible labels / text**: "OK", "Cancel" (defaults).
- **Actions / buttons it renders**: OK (danger variant when destructive) + Cancel via FormDialog footer.
- **Notes**: `React.memo`. Danger icon ExclamationCircleFilled (red) / neutral InfoCircleFilled (warning). `role="alert"` aria-live assertive when danger.

### EmptyState (DS)
- **File**: src/design-system/EmptyState.tsx
- **Kind**: feedback (empty)
- **Purpose**: Token-styled empty state with icon + CTA (vs plain AntD Empty).
- **Key props / variants**: `icon`, `title`, `description`, `actionLabel`, `onAction`, `secondary`, `ariaLabel`.
- **Actions / buttons it renders**: primary MotionButton CTA (when actionLabel+onAction); `secondary` slot.
- **States**: this IS the empty state.
- **Notes**: `React.memo`, motion fade+scale, falls back to AntD `Empty.PRESENTED_IMAGE_SIMPLE` if no icon. `role="region"`.

### LoadingSkeleton
- **File**: src/design-system/LoadingSkeleton.tsx
- **Kind**: feedback (skeleton)
- **Purpose**: Shimmer skeleton system matching content shapes.
- **Key props / variants**: `variant: 'row'|'card'|'chart'|'table'`, `rows` (def 5), `isDark`.
- **Notes**: `React.memo`. Shimmer via `.skeleton` CSS. `role="status"` aria-busy. table = header + N body rows; card mirrors KpiCard; chart = title+body+axis.

### PageErrorState
- **File**: src/design-system/PageErrorState.tsx
- **Kind**: feedback (error)
- **Purpose**: Full-page error result with Retry + Go to Dashboard.
- **Key props / variants**: `onRetry`, `title`, `subtitle`, `isTimeout`.
- **Visible labels / text**: `errors:pageLoadFailed`→"Page failed to load", `errors:pageLoadTimeout`→"The page took too long to load. Please try again.", `errors:pageLoadFailedDesc`→"Something went wrong while loading this page.", `common:retry`→"Retry", `common:goToDashboard`→"Go to Dashboard".
- **Actions / buttons it renders**: AntD `Result status="error"` with Retry (primary, ReloadOutlined) + Go to Dashboard (HomeOutlined → `/`).

### FormLayout
- **File**: src/design-system/FormLayout.tsx
- **Kind**: layout (form)
- **Purpose**: Two-column form (8+4) with sticky summary panel, validation banner, sticky save bar, unsaved-changes guard.
- **Key props / variants**: `sections: FormSection[]`, `summaryPanel`, `saving/saved/isDirty`, `validationErrors[]`, `requiredCount`, `onSave/onSaveAndNew/onSaveAndSend/onCancel`, `extraActions`, `useSplitSave`, `isDark`.
- **Visible labels / text**: `form_layout.save`→"Save", `form_layout.save_and_new`→"Save & New", `form_layout.save_and_send`→"Save & Send", `form_layout.cancel`→"Cancel", `form_layout.saving`→"Saving…", `form_layout.saved`→"Saved", `form_layout.unsaved_changes`→"Unsaved changes", `form_layout.required_fields`→"{{n}} required fields", `form_layout.validation_errors_title`→"{{n}} validation error(s) — please fix before saving", `form_layout.unsaved_title`→"Unsaved Changes", `form_layout.leave_anyway`→"Leave anyway", `form_layout.stay`→"Stay".
- **Actions / buttons it renders**: Cancel MotionButton, Save / `<SaveSplitButton>`, status Tags (required/unsaved/saving/saved), unsaved-changes `<ConfirmDialog>`.
- **Sub-parts / slots**: left sections (each wrapped in ResponsiveForm two-column), sticky `<Affix>` summary panel (mobile: below), sticky save bar Affix.
- **States**: validation error banner; saving/saved/dirty indicators.
- **Notes**: `beforeunload` guard + manual blocker dialog. Also exports `useUnsavedChangesGuard(isDirty)`.

### DetailLayout
- **File**: src/design-system/DetailLayout.tsx
- **Kind**: layout (detail)
- **Purpose**: 70/30 split for record detail pages with sticky toolbar + tabs + side column.
- **Key props / variants**: `header`, `toolbar` (overrides header actions), `tabs: DetailLayoutTab[]`, `defaultTabKey`, `children`, `side`, `hideSideOnNarrow`, `isDark`, `isRTL`.
- **Sub-parts / slots**: sticky Affix header+toolbar; main column (Tabs or children); sticky aside `side` (collapses <992px).
- **Notes**: Grid `minmax(0,1fr) {detailSplitDefault}px`, direction by isRTL.

### EditableLineItems
- **File**: src/design-system/EditableLineItems.tsx
- **Kind**: table (editable)
- **Purpose**: Drag-reorder editable line-item table for forms.
- **Key props / variants**: `value: T[]`, `onChange`, `columns: LineItemColumn[]` (type `text|number|money|select`, options, min, precision, readOnly, custom render), `newRow`, `addLabel`, `readOnly`, `showDragHandle`, `showDelete`, `isDark`, `maxRows`.
- **Visible labels / text**: `line_items.table_label`→"Line items", `line_items.empty`→"No items yet. Click \"Add row\" to begin.", `line_items.add_row`→"Add row"; "Drag to reorder", "Remove row" aria.
- **Actions / buttons it renders**: drag handle (HolderOutlined), per-row delete (DeleteOutlined danger), "Add row" dashed button (PlusOutlined).
- **States**: empty message; disabled when readOnly/maxRows.
- **Notes**: @dnd-kit sortable, keyboard nav (Enter → next cell), RTL handle, `role="grid"`.

### BulkActionBar
- **File**: src/design-system/BulkActionBar.tsx
- **Kind**: other (action toolbar)
- **Purpose**: Floating bar shown when DataTable rows are selected.
- **Key props / variants**: `selectedCount`, `onClear`, `actions: BulkAction[]` (key,label,icon,danger,disabled,onClick), `isDark`, `floating` (def true, fixed bottom-center).
- **Visible labels / text**: `data_table_v2.selected_n`→"{{n}} selected", `data_table_v2.bulk_actions`→"Bulk actions", `data_table_v2.clear_selection`→"Clear selection".
- **Actions / buttons it renders**: count label, action MotionButtons, divider, Clear selection (CloseOutlined).
- **Notes**: `React.memo`, `role="toolbar"`. Returns null when count ≤ 0.

### ExportMenu
- **File**: src/design-system/ExportMenu.tsx
- **Kind**: menu/dropdown (button)
- **Purpose**: "Export ▾" dropdown — PDF/Excel/CSV/Copy/Print.
- **Key props / variants**: `onExport(format)`, `onPrint`, `disabled`, `size`, `formats?` (restrict shown).
- **Visible labels / text**: `export.button`→"Export", `export.csv`→"CSV", `export.xlsx`→"Excel", `export.pdf`→"PDF", `export.copy`→"Copy to Clipboard", `export.print`→"Print", `export.copied`→"Copied to clipboard", `export.error`→"Export failed".
- **Actions / buttons it renders**: Dropdown trigger button (DownloadOutlined, loading), items PDF/Excel/CSV/Copy + optional Print (each with file icon).
- **Notes**: `React.memo`. Toast success on copy.

### ExportButton (DS alt — components/)
> See components/ExportButton below; ExportMenu is the DS variant.

### AdvancedFilterDrawer
- **File**: src/design-system/AdvancedFilterDrawer.tsx
- **Kind**: drawer
- **Purpose**: Slide-in (responsive) drawer for complex filter forms.
- **Key props / variants**: `open`, `onClose`, `onApply`, `onReset`, `children`, `width`.
- **Visible labels / text**: `advanced_filters`→"Advanced filters", `apply`→"Apply", `reset`→"Reset".
- **Actions / buttons it renders**: Apply (FormDialog OK), Reset button.
- **Notes**: Built on responsive `FormDialog` (bottom-sheet on mobile).

### SavedViewsPicker
- **File**: src/design-system/SavedViewsPicker.tsx
- **Kind**: menu/dropdown + dialog
- **Purpose**: localStorage-backed saved filter/column views selector.
- **Key props / variants**: `storageKey`, `currentState`, `onApply`.
- **Visible labels / text**: `saved_views`→"Saved views", `save_view`→"Save view", `confirm_delete`→"Delete?", `name`→"Name".
- **Actions / buttons it renders**: Select (views), Save button (SaveOutlined), Delete (Popconfirm, DeleteOutlined danger), Save dialog with name Input.
- **Notes**: Space.Compact group; persists to `views.{storageKey}`.

### Stepper
- **File**: src/design-system/Stepper.tsx
- **Kind**: other (steps)
- **Purpose**: Pass-through wrapper around AntD Steps.
- **Key props / variants**: all `StepsProps`.
- **Notes**: `React.memo`.

### Timeline
- **File**: src/design-system/Timeline.tsx
- **Kind**: other
- **Purpose**: Pass-through wrapper around AntD Timeline.
- **Notes**: `React.memo`.

### Toast (toast bridge)
- **File**: src/design-system/Toast.tsx
- **Kind**: feedback (toast)
- **Purpose**: Single API around AntD message + notification with optional Undo and aria-live.
- **Key props / variants**: `toast.success/info/warning/error(text, opts)`; opts: `description`, `duration`, `onUndo`, `undoLabel`, `key`. Helpers `toast.saved(t)`, `toast.deleted(t,onUndo)`.
- **Visible labels / text**: default "Undo"; `toast.saved`→"Saved", `toast.deleted`→"Deleted", `toast.undo`→"Undo".
- **Actions / buttons it renders**: Undo button (primary) in notification when `onUndo`.
- **Notes**: Mount `useToastBridge()` at root; aria-live `#toast-announcer`.

### StatusTag
- **File**: src/design-system/StatusTag.tsx
- **Kind**: other (tag/badge)
- **Purpose**: Token-driven status Tag with semantic color map.
- **Key props / variants**: `status` (StatusKind: draft, pending, approved, rejected, paid, partial, unpaid, overdue, sent, viewed, open, closed, cancelled, void, posted, active, inactive, archived, success, warning, error, info, default), `label`, `icon`, `ariaLabel`.
- **Notes**: `React.memo`, `role="status"`, filled variant, color/bg from palette per kind.

### MoneyInput
- **File**: src/design-system/MoneyInput.tsx
- **Kind**: form-control
- **Purpose**: IQD/USD currency InputNumber with locale-aware formatting + currency selector.
- **Key props / variants**: `value`, `onChange`, `currency: 'IQD'|'USD'`, `onCurrencyChange`, `showCurrencySelector` (def true), `showCurrencyLabel`, `min/step/precision/controls`, `ariaLabel`. + InputNumber props.
- **Visible labels / text**: `money_input.currency_label`→"Currency", `money_input.amount_label`→"Amount".
- **Sub-parts / slots**: InputNumber + currency Select (IQD/USD) or static label.
- **Notes**: `React.memo`, IQD+ku/ar → ar-IQ locale; Space.Compact.

### MoneyDisplay
- **File**: src/design-system/MoneyDisplay.tsx
- **Kind**: other (display)
- **Purpose**: Formatted money wrapped in `<bdi>` for mixed-direction isolation.
- **Key props / variants**: `amount`, `currency` (def IQD), `lang: 'ku'|'en'|'ar'`, `className/style`.
- **Notes**: `React.memo`, uses `formatMoney`. IQD/ar-IQ vs USD/en-US.

### PhoneInput
- **File**: src/design-system/PhoneInput.tsx
- **Kind**: form-control
- **Purpose**: Phone field with +964 (Iraq) addon prefix.
- **Key props / variants**: `countryCode` (def "+964"), + InputProps. Placeholder "7XX XXX XXXX", type tel.
- **Notes**: `React.memo`.

### AddressInput
- **File**: src/design-system/AddressInput.tsx
- **Kind**: form-control (composite)
- **Purpose**: Iraq address — street/city/governorate/postal/country.
- **Key props / variants**: `value: AddressValue`, `onChange`. Exports `IRAQ_GOVERNORATES` (18: Baghdad, Basra, Erbil, Sulaymaniyah, Duhok, Halabja, Kirkuk, Mosul, Najaf, Karbala, Babil, Wasit, Maysan, Diyala, Anbar, Salah ad-Din, Dhi Qar, Muthanna, Qadisiyyah).
- **Visible labels / text**: `street`→"Street", `city`→"City", `governorate`→"Governorate", `postal_code`→"Postal code", `country`→"Country" (default value "Iraq").
- **Sub-parts / slots**: Inputs + governorate searchable Select.

### DateRangePickerRTL
- **File**: src/design-system/DateRangePickerRTL.tsx
- **Kind**: form-control
- **Purpose**: RTL-friendly AntD RangePicker wrapper.
- **Key props / variants**: `value`, `onChange`, `size`, `placeholder: [string,string]`.
- **Notes**: `React.memo`, full-width.

### InlineEdit
- **File**: src/design-system/InlineEdit.tsx
- **Kind**: form-control (inline)
- **Purpose**: Click-to-edit text field.
- **Key props / variants**: `value`, `onSave`, `placeholder` (def "—"), `disabled`.
- **Actions / buttons it renders**: Edit pencil (EditOutlined) → Input + confirm (CheckOutlined primary, loading) + cancel (CloseOutlined).
- **States**: editing/busy.

### KeyValueGrid
- **File**: src/design-system/KeyValueGrid.tsx
- **Kind**: other (display grid)
- **Purpose**: Label/value pairs grid for detail pages, with copyable values.
- **Key props / variants**: `items: KeyValueItem[]` (label,value,copyable,span 1-3), `columns: 1|2|3` (def 2), `rowGap`.
- **Visible labels / text**: `copied`→"Copied".
- **Actions / buttons it renders**: CopyOutlined click-to-copy per copyable item.
- **Notes**: dark-aware (authStore), ellipsis values, null → "—".

### ColumnVisibility
- **File**: src/design-system/ColumnVisibility.tsx
- **Kind**: menu/dropdown
- **Purpose**: Dropdown checklist to show/hide table columns.
- **Key props / variants**: `columns: ColumnVisibilityItem[]` (key,label,pinned), `hidden: string[]`, `onChange`, `isDark`.
- **Visible labels / text**: `data_table_v2.columns`→"Columns", `data_table_v2.pinned`→"pinned", `data_table_v2.show_all`→"Show all", `data_table_v2.hide_all`→"Hide all".
- **Actions / buttons it renders**: trigger button (SettingOutlined), per-column Checkbox (pinned disabled), Show all / Hide all text buttons.

### ContextMenu
- **File**: src/design-system/ContextMenu.tsx
- **Kind**: menu/dropdown
- **Purpose**: Right-click menu wrapper around any element (AntD Dropdown contextMenu).
- **Key props / variants**: `items: ContextMenuItem[]` (key,label,icon,danger,disabled,divider,onSelect), `children`, `disabled`.
- **Notes**: divider items supported.

### CopyButton
- **File**: src/design-system/CopyButton.tsx
- **Kind**: button
- **Purpose**: Copy text to clipboard with success feedback (icon morphs to check).
- **Key props / variants**: `text`, `size`, `tooltip`.
- **Visible labels / text**: `copy`→"Copy", `copied`→"Copied", `copy_failed`→"Copy failed".
- **Actions / buttons it renders**: text Button (CopyOutlined → CheckOutlined green for 1.5s).

### SaveSplitButton
- **File**: src/design-system/SaveSplitButton.tsx
- **Kind**: button (split)
- **Purpose**: "Save / Save & New / Save & Send" primary + dropdown arrow.
- **Key props / variants**: `actions: SaveAction[]` (first = primary), `loading`, `disabled`, `size`.
- **Visible labels / text**: `save_split_button.more_options`→"More save options"; action labels passed in.
- **Actions / buttons it renders**: primary Button + DownOutlined Dropdown of secondary actions (single button if no secondary).

### QuickSearch
- **File**: src/design-system/QuickSearch.tsx
- **Kind**: dialog (search overlay)
- **Purpose**: Lightweight Ctrl+/ navigation overlay (top ~50 routes), simpler than CommandPalette.
- **Key props / variants**: `triggerKey` (def "/").
- **Visible labels / text**: `quick_search.placeholder`→"Search pages... (Ctrl+/)", `quick_search.hint`→"Press Enter to navigate, Esc to close", `quick_search.no_results`→"No pages found". Route labels via `nav.*` keys (Dashboard, Invoices, Bills, Contacts, Items, Quotes, Sales Orders, Purchase Orders, Expenses, Chart of Accounts, Journals, Banking, Reports, Inventory, Projects, CRM Leads/Pipeline, POS + Sessions/Orders, Custom Dashboards, Credit Notes, Vendor Credits, Recurring Invoices, Tax Returns, Warehouses, Fixed Assets, Manufacturing Orders, BOMs, Employees, Attendance, Payroll Runs, Approvals, My Approvals, Audit Log, Users, Settings, Companies, Branches, Custom Fields, Email Templates, Tax Settings, Budgets, Analytic Accounts, Currency Rates, Subscriptions, Workflows, Helpdesk, Field Service, Quality).
- **Actions / buttons it renders**: search Input, List of routes (Enter → first), right/left chevron (RTL aware).
- **Notes**: Ctrl+/ toggle, Esc close. Built on FormDialog (hideFooter).

### FileUploader
- **File**: src/design-system/FileUploader.tsx
- **Kind**: form-control (upload)
- **Purpose**: Drag/drop wrapper around AntD Upload.Dragger.
- **Key props / variants**: `hint`, + UploadProps, `children`.
- **Visible labels / text**: `upload_drag_text`→"Click or drag a file to upload".

### EntitySelect
- **File**: src/design-system/EntitySelect.tsx
- **Kind**: form-control (async select)
- **Purpose**: Debounced async entity search Select with optional "Create new".
- **Key props / variants**: `loadOptions(query)`, `placeholder`, `ariaLabel`, `onCreateNew`, `createNewLabel`, `debounceMs` (def 300), `minChars` (def 1).
- **Visible labels / text**: `entity_select.placeholder`→"Search…", `entity_select.create_new`→"Create new", `entity_select.no_results`→"No results found", `entity_select.type_to_search`→"Type to search…".
- **Actions / buttons it renders**: combobox; "+ Create new {query}" inline option/CTA.
- **States**: loading spinner; no-results; type-to-search.
- **Notes**: `role="combobox"`, RTL direction.

### UserSelect
- **File**: src/design-system/UserSelect.tsx
- **Kind**: form-control
- **Purpose**: Searchable user picker with avatar + email.
- **Key props / variants**: `users: UserOption[]`, `multiple`, + SelectProps.
- **Sub-parts / slots**: optionRender = Avatar + name + email.

### AvatarGroup
- **File**: src/design-system/AvatarGroup.tsx
- **Kind**: other (display)
- **Purpose**: Overlapping avatars with overflow count.
- **Key props / variants**: `users: AvatarItem[]` (name,src,color), `max` (def 4), `size` (def 28).
- **Notes**: `React.memo`, tooltips, +N overflow.

### MiniSparkline
- **File**: src/design-system/MiniSparkline.tsx
- **Kind**: other (chart)
- **Purpose**: Tiny inline SVG polyline sparkline (no dep).
- **Key props / variants**: `data: number[]`, `width` (80), `height` (24), `color`.
- **Notes**: `React.memo`.

### TrendChart
- **File**: src/design-system/TrendChart.tsx
- **Kind**: other (chart)
- **Purpose**: Minimal inline SVG line+area chart (no dep).
- **Key props / variants**: `data: {label,value}[]`, `width` (240), `height` (80), `color`.
- **Notes**: `React.memo`, `role="img"`.

### ConnectionStatus
- **File**: src/design-system/ConnectionStatus.tsx
- **Kind**: feedback (status)
- **Purpose**: Online/offline indicator — compact tag (TopBar) or full-width banner (AppShell).
- **Key props / variants**: `variant: 'tag'|'banner'`.
- **Visible labels / text**: `online`→"Online", `offline`→"Offline", `offline_title`→"Offline — no internet connection", `offline_description`→ (Kurdish: "پەیوەندی ئینتەرنێتت بڕاوە. هەندێک تایبەتمەندی کار ناکەن تا پەیوەندی دووبارە بکرێتەوە."), `offline_banner_label`→"Offline".
- **States**: online (green Wifi) / offline (red Disconnect). Banner animates in/out (AnimatePresence).
- **Notes**: `role="status"` aria-live polite.

### EnvironmentBadge (DS)
- **File**: src/design-system/EnvironmentBadge.tsx
- **Kind**: other (tag)
- **Purpose**: Visible env tag (auto from import.meta.env.MODE), hidden in production.
- **Key props / variants**: `env: 'production'|'staging'|'development'|'test'`. Colors green/orange/blue/purple.

### KbdHint
- **File**: src/design-system/KbdHint.tsx
- **Kind**: other (display)
- **Purpose**: Keyboard shortcut chip group.
- **Key props / variants**: `keys: string[]`, `size: 'sm'|'md'`. Exports `cmdKey` (⌘/Ctrl).
- **Notes**: dark-aware, monospace kbd chips.

### SkipToContent
- **File**: src/design-system/SkipToContent.tsx
- **Kind**: nav-chrome (a11y)
- **Purpose**: Visually hidden "Skip to main content" link (visible on focus).
- **Key props / variants**: `targetId` (def "main-content").
- **Visible labels / text**: `a11y.skipToContent`→"Skip to main content".

### OptimizedImage
- **File**: src/design-system/OptimizedImage.tsx
- **Kind**: other (media)
- **Purpose**: Lazy/responsive `<img>` with WebP fallback + CLS-safe dimensions.
- **Key props / variants**: `src`, `fallbackSrc`, `alt`, `sizes`, `srcSet`, `width/height`, `loading: 'lazy'|'eager'`, `wrapperClassName/Style`, `onLoad/onError`.
- **Notes**: `React.memo`, decoding async, fetchpriority hint.

### PrintView + usePrint
- **File**: src/design-system/PrintView.tsx
- **Kind**: layout (print)
- **Purpose**: A4 print-friendly wrapper (hides nav, @page A4, RTL/LTR). `usePrint()` hook triggers `window.print()`.
- **Key props / variants**: `title`, `subtitle`, `orgName`, `dir: 'rtl'|'ltr'`, `children`.
- **Visible labels / text**: `print.printed_on`→"Printed on".

### ConnectionStatus / others note
> Test files (`*.test.tsx`) and print-template files under design-system/print/ (InvoicePrintTemplate, QuotePrintTemplate, BillPrintTemplate, PurchaseOrderPrintTemplate, ReceiptPrintTemplate, BasePrintTemplate) are document-specific print templates (not generic UI primitives) — noted but not detailed.

---

### SECTION 1b — design-system/empty/ (Empty-State + Quick-Create system)

### EmptyState (empty/)
- **File**: src/design-system/empty/EmptyState.tsx
- **Kind**: feedback (empty)
- **Purpose**: The single sanctioned empty UI; illustration + title + description + CTAs; permission-aware; telemetry on mount/click. Must render inside `<StateSwitch>`.
- **Key props / variants**: `variant: 'list'|'selector'|'drawer'|'subform'|'search'`, `illustration: IllustrationKey`, `titleKey/descriptionKey` (or `title/description`), `primaryAction`, `secondaryAction`, `permissionGate`, `context`, `entity`, `ariaLabel`.
- **Visible labels / text**: i18n-key driven; `empty.request_access` (locked-permission fallback link). Illustration size 96 (list) / 64 / 48 (subform).
- **Actions / buttons it renders**: primary CTA Button (or "Request access" link when permission denied), secondary link.
- **Notes**: `role="status"` aria-live, spring fade+scale-up.

### EmptyStateIllustration
- **File**: src/design-system/empty/EmptyStateIllustration.tsx
- **Kind**: other (SVG)
- **Purpose**: 8 inline 2-color SVG illustrations (theme/dark via CSS vars).
- **Key props / variants**: `name: 'customers'|'items'|'documents'|'money'|'inbox'|'chart'|'box'|'lock'`, `size` (def 64).
- **Notes**: `React.memo`, aria-hidden (decorative).

### StateSwitch
- **File**: src/design-system/empty/StateSwitch.tsx
- **Kind**: other (state machine)
- **Purpose**: Deterministic render of exactly one of loading→error→empty→populated.
- **Key props / variants**: `loading`, `error`, `empty`, `populated`, `loadingState`, `errorState`, `emptyState`.
- **Notes**: `memo`; lint rule `local/state-switch-required` forces EmptyState only inside this.

### LoadingState (empty/)
- **File**: src/design-system/empty/LoadingState.tsx
- **Kind**: feedback (skeleton)
- **Purpose**: AntD Skeleton loading for collection surfaces.
- **Key props / variants**: `rows` (def 5), `variant` (`selector`/`search` → tight 2-line), `className`.
- **Notes**: aria-busy/aria-live.

### ErrorState (empty/)
- **File**: src/design-system/empty/ErrorState.tsx
- **Kind**: feedback (error)
- **Purpose**: Error variant of empty shell (lock illustration) + Retry; never shows stack trace.
- **Key props / variants**: `error`, `onRetry`, `variant`, `ariaLabel`.
- **Visible labels / text**: `error.title`→"Something went wrong", `error.generic_message`→"Please try again in a moment.", `common.retry`→"Retry".
- **Notes**: `role="alert"` aria-live assertive.

### SelectWithQuickCreate
- **File**: src/design-system/empty/SelectWithQuickCreate.tsx
- **Kind**: form-control (async select + quick-create)
- **Purpose**: Universal `<Select>` replacement (58+ selectors) with persistent "+ Add <entity>" footer CTA, debounced search, optimistic merge + highlight pulse, lazy modal/drawer.
- **Key props / variants**: `entity: EntitySlug`, `value`, `onChange`, `loadOptions`, `options` (static), `prefillFromSearch`, `placeholder`, `disabled`, `ctaOverride`, `allowClear`.
- **Visible labels / text**: `entity_select.placeholder`→"Search…"; CTA `qc.{entity}.cta`; body via EmptyState/StateSwitch keys (`empty.search_no_results`, `empty.search_clear`).
- **Actions / buttons it renders**: combobox; persistent footer "+ Add" button (popupRender); opens QuickCreateModal (Class A) / QuickCreateDrawer (Class B) / navigates (Class C).
- **States**: loading/error/empty/search-empty bodies via StateSwitch; footer hidden when disabled / no create permission / unregistered entity.
- **Notes**: Registry from `data/quickCreateRegistry.ts`. usePermission gate. Highlight pulse on new option (reduced-motion aware).

### QuickCreateModal
- **File**: src/design-system/empty/QuickCreateModal.tsx
- **Kind**: dialog
- **Purpose**: Class A quick-create modal (≤5 required fields), lazy-loaded.
- **Key props / variants**: `entity`, `open`, `onClose`, `onSuccess`, `prefill`, `context`. Width 420.
- **Visible labels / text**: title `config.titleKey`; via ModalActions: `qc.action.create_and_select`, `qc.action.cancel`, `qc.action.full_form`; `qc.confirm_discard`→"Discard your changes?", `qc.success.created`→"Created successfully", `qc.errors.permission`→"You don't have permission to create this record", `qc.errors.validation`→"Please review the highlighted fields".
- **Actions / buttons it renders**: DynamicForm + ModalActions (Create & Select / Cancel / Full form link).
- **States**: submitting; dirty-cancel confirm; inline field errors pinned.
- **Notes**: focus trap (AntD), autofocus first field, abortable.

### QuickCreateDrawer
- **File**: src/design-system/empty/QuickCreateDrawer.tsx
- **Kind**: drawer
- **Purpose**: Class B quick-create drawer (5–15 fields, file upload, "Save & Add another").
- **Key props / variants**: `entity`, `open`, `onClose`, `onSuccess`, `prefill`, `context`. Width 480, placement right.
- **Visible labels / text**: same qc.* keys + `qc.action.save_and_add_another`, `qc.steps.basic_info`→"Basic info".
- **Actions / buttons it renders**: DynamicForm + footer ModalActions (Create & Select / Save & Add another / Cancel / Full form). Optional vertical Steps (>8 fields).

### QuickCreateDrawerWithSteps
- **File**: src/design-system/empty/QuickCreateDrawerWithSteps.tsx
- **Kind**: drawer (multi-step)
- **Purpose**: Class B drawer with vertical Steps for entities with `sections` and >8 fields; per-section validation. Falls back to basic drawer otherwise. Width 680.
- **Visible labels / text**: `common.cancel`→"Cancel", `common.previous`→"Previous", `common.next`→"Next", `qc.action.save_and_add_another`→"Save & Add another", `qc.action.create_and_select`→"Create", `saved`→"Saved".
- **Actions / buttons it renders**: vertical Steps nav (clickable), Previous/Next, Save & Add another, Create.

### DynamicForm
- **File**: src/design-system/empty/DynamicForm.tsx
- **Kind**: form (schema-driven)
- **Purpose**: Renders quick-create inputs from `FieldDef[]` (text/tel/email/number/select/textarea/file). Exports `buildInitialValues`, `validate`.
- **Key props / variants**: `fields`, `values`, `errors`, `onChange`, `onSubmit` (Enter submits), `disabled`, `ariaLabelledBy`.
- **Visible labels / text**: `common.upload_hint`→"Click or drag a file here"; field labels/placeholders via keys.
- **Notes**: `memo`, required `*` marker, aria-required/invalid.

### ModalActions
- **File**: src/design-system/empty/ModalActions.tsx
- **Kind**: other (footer actions)
- **Purpose**: Shared footer for QuickCreateModal/Drawer.
- **Key props / variants**: `primary`, `secondary`, `saveAndAddAnother` (drawer), `link` (Full form).
- **Actions / buttons it renders**: Full-form link (start), Save&Add, Cancel, primary Create (end).
- **Notes**: `memo`.

### ListWithEmptyState
- **File**: src/design-system/empty/ListWithEmptyState.tsx
- **Kind**: other (list wrapper)
- **Purpose**: Wraps list tables with StateSwitch + list-variant empty state (96px illustration) + quick-create wiring.
- **Key props / variants**: `entity`, `data`, `loading`, `error`, `render(rows)`, `onRetry`, `ctaOverride`, `onCreate` (legacy), `searchQuery`, `onClearSearch`, `titleKey/descriptionKey`, `illustration`, `context`.
- **States**: loading (LoadingState list rows=6) / error (ErrorState) / search-empty / empty / populated.
- **Notes**: Opens registry modal/drawer (Class A/B) or navigates (C).

### SubformWithEmptyState
- **File**: src/design-system/empty/SubformWithEmptyState.tsx (also re-exported at components/empty/)
- **Kind**: other (subform empty)
- **Purpose**: Inline compact empty state for repeating subform sections (line items / schedules / members).
- **Key props / variants**: `entity`, `empty`/`items`, `onAdd`/`onAddFirst`, `titleKey/descriptionKey/ctaKey`, `illustration` (def 'box'), legacy EP-5 shim props.
- **Actions / buttons it renders**: "+ add" primary CTA (PlusOutlined).
- **Notes**: `memo`.

### RelatedDataPanel
- **File**: src/design-system/empty/RelatedDataPanel.tsx (also components/empty/)
- **Kind**: other (panel empty)
- **Purpose**: Empty state for drawer/side-panel collections (activity logs, payment history). No primary CTA by default.
- **Key props / variants**: `entity`, `titleKey/title`, `empty`/`data`, `loading`, `illustration` (def 'inbox'), `emptyDescriptionKey`, `secondaryAction`, legacy EP-5 shim (`emptyTitleKey`, `emptyCtaKey`, `onEmptyCta`...).
- **Visible labels / text**: `empty.no_related_data`, `empty.no_related_data_description`.
- **States**: loading → Skeleton; empty → EmptyState (drawer variant); else children.

### FileUploadField (empty/)
- **File**: src/design-system/empty/FileUploadField.tsx
- **Kind**: form-control (upload)
- **Purpose**: File-upload field for quick-create forms; Firebase Storage or base64 fallback.
- **Key props / variants**: `value: FileUploadFieldValue`, `onChange`, `entity`, `tempId`, `accept`, `maxSizeMB` (def 10), `disabled`.
- **Visible labels / text**: `uploader.select_file`→"Select file", `uploader.remove`→"Remove", `uploader.too_large`, `uploader.failed`→"Upload failed".
- **Actions / buttons it renders**: Select file button (UploadOutlined, loading) / Remove (danger).

### ImageUploadField (empty/)
- **File**: src/design-system/empty/ImageUploadField.tsx
- **Kind**: form-control (image upload)
- **Purpose**: Image-only upload with picture-card thumbnail preview; Firebase/base64.
- **Key props / variants**: `value`, `onChange`, `entity`, `tempId`, `maxDimension` (2048), `maxSizeMB` (def 5), `disabled`.
- **Visible labels / text**: `uploader.image`→"Upload image", `uploader.remove`→"Remove image", `uploader.not_image`→"Please choose an image file", `uploader.too_large`, `uploader.failed`.
- **Actions / buttons it renders**: picture-card Upload (Plus/Loading), Remove button.

---

### SECTION 2 — components/ (shared dialogs / drawers / buttons / widgets)

### MotionModal / MotionModalContent
- **File**: src/components/MotionModal.tsx
- **Kind**: other (animation wrapper)
- **Purpose**: AnimatePresence scale+fade wrapper for modals (200ms). `MotionModalContent` for AntD `modalRender`.
- **Key props / variants**: `open`, `children`, `className/style`. Reduced-motion → reduced variants.

### MotionButton
- **File**: src/components/MotionButton.tsx
- **Kind**: button
- **Purpose**: AntD Button with rest/hover(-2y)/pressed(+1y) micro-interactions. The standard button across the DS.
- **Key props / variants**: all `ButtonProps` + `animated` (def true). Animation disabled when loading/disabled/reduced-motion.

### MotionCard
- **File**: src/components/MotionCard.tsx
- **Kind**: card
- **Purpose**: AntD Card with hover lift (-4y, shadow.lg, 150ms).
- **Key props / variants**: all `CardProps` + `animated`.

### MotionGate / MotionGateChildren
- **File**: src/components/MotionGate.tsx
- **Kind**: other (a11y gate)
- **Purpose**: Renders final static `fallback` when prefers-reduced-motion; otherwise the animated Component/children.
- **Key props / variants**: HOC: `Component`, `fallback`, ...props. Children variant: `children`, `fallback`.

### ConfirmDialog (DS — see above)
> The shared ConfirmDialog lives in design-system/. components/ has no duplicate.

### NotificationsDrawer (chrome — see Section 3)
### GuideDrawer
- **File**: src/components/GuideDrawer.tsx
- **Kind**: drawer (help)
- **Purpose**: Full how-to guide: sidebar Menu (8 sections) + Collapse of topics. Built on FormDialog.
- **Key props / variants**: `open`, `onClose`.
- **Visible labels / text**: `guide_title`, `guide_intro`; sections `guide_sales/purchases/banking/accounting/inventory/projects/assets/settings` (+ `_intro`) and per-topic `*_steps` keys.
- **Sub-parts / slots**: left Menu (Sales/Purchases/Banking/Accounting/Inventory/Projects/Assets/Settings), right Collapse accordion of topic steps.

### SectionDocsDrawer
- **File**: src/components/SectionDocsDrawer.tsx
- **Kind**: drawer (docs)
- **Purpose**: Per-section documentation drawer (purpose, who-uses, sub-areas, data-flow mermaid, KPIs, tips, related).
- **Key props / variants**: `sectionKey`, `onClose`, `isDark`, `isRTL`. Pulls `SECTION_DOCS[key]`.
- **Visible labels / text**: `docs.who_uses`→"Who uses this", `docs.sub_areas`→"Sub-areas", `docs.data_flow`→"Data flow", `docs.data_store`→"Data store", `docs.related`→"Related", `docs.kpis`→"Key KPIs", `docs.tips`→"Tips".
- **Sub-parts / slots**: divider section headers; SubAreaCard; MermaidDiagram; tag rows.

### Attachments
- **File**: src/components/Attachments.tsx
- **Kind**: card (file list)
- **Purpose**: Entity attachments card — list + upload + download + delete.
- **Key props / variants**: `entityType`, `entityId`.
- **Visible labels / text**: `attachments.title`, `attachments.upload`, `attachments.empty`, `attachments.uploaded`, `are_you_sure`.
- **Actions / buttons it renders**: Upload button (UploadOutlined), per-item Download/Delete (danger), Modal.confirm on delete.
- **States**: loading list; empty.

### ChatterPanel
- **File**: src/components/ChatterPanel.tsx
- **Kind**: other (tabs + dialogs)
- **Purpose**: Odoo-style activity/follower/note panel for any entity.
- **Key props / variants**: `entityType`, `entityId`.
- **Visible labels / text**: `chatter.activities/followers/log_note`, `chatter.add_activity/add_follower`, `chatter.no_activities/no_followers`, `chatter.summary/notes/due_date/assignee/activity_type/user`, `chatter.post_note/note_placeholder/note_logged`, `done`, `confirm_delete`. Activity type labels hardcoded Kurdish: مەرام (todo), پەیوەندی (call), کۆبوونەوە (meeting), ئیمەیڵ (email), بارکردن (upload).
- **Sub-parts / slots**: Tabs (Activities Timeline / Followers list / Log note); add-activity + add-follower FormDialogs (UserSelect).
- **Actions / buttons it renders**: Add activity (PlusOutlined), Mark done (CheckOutlined), Delete (Popconfirm), Add follower (UserAddOutlined), Remove follower, Post note.

### chatter/ChatterWidget
- **File**: src/components/chatter/ChatterWidget.tsx
- **Kind**: other — (chatter widget variant; not detailed)

### SupportWidget
- **File**: src/components/SupportWidget.tsx
- **Kind**: other (floating + dialog)
- **Purpose**: Floating "?" launcher + auto-nudge after ≥3 errors/60s + help dialog with recent errors.
- **Visible labels / text**: `need_help`, `need_help_q`, `repeated_errors_hint`, `open_help`, `quick_actions`, `docs_hub`, `contact_support`, `recent_errors`, `errors_in_last_minute`, `clear`.
- **Actions / buttons it renders**: floating circle FAB (QuestionCircleOutlined, fixed bottom-end), nudge card (Open help/dismiss), dialog: Docs hub / Contact support (mailto) / recent-errors list / Clear.

### NPSSurvey
- **File**: src/components/NPSSurvey.tsx
- **Kind**: dialog (survey)
- **Purpose**: Slide-up NPS 0–10 survey, gated on `/api/nps/should-show`.
- **Visible labels / text**: `nps.title`→"Quick question", `nps.question`→"How likely are you to recommend Zoho Kurdish to a colleague? (0 = not likely, 10 = extremely likely)", `nps.comment`→"Optional — anything you want to share?", `nps.submit`→"Submit", `nps.notNow`→"Not now", `nps.thanks`→"Thanks for the feedback!", `nps.failed`→"Could not save".
- **Actions / buttons it renders**: Radio.Group 0–10, comment TextArea, Submit (disabled until score), Not now.

### LanguageSwitcher
- **File**: src/components/LanguageSwitcher.tsx
- **Kind**: menu/dropdown
- **Purpose**: ku/en/ar language selector; sets i18n + document dir/lang + persists localStorage.
- **Key props / variants**: `size`, `showLabel`, `type`, `dropdownZIndex`.
- **Visible labels / text**: `tooltip_language_switch`→"Switch Language", `language_active`→"Active language". Languages: کوردی سۆرانی (ku, short کو), English (en, EN), العربية (ar, short ع).
- **Actions / buttons it renders**: trigger Button (GlobalOutlined + short label), dropdown items with checkmark on active.

### ExportButton (components/)
- **File**: src/components/ExportButton.tsx
- **Kind**: menu/dropdown (button)
- **Purpose**: Backend-endpoint export (Excel/CSV) → triggers file download.
- **Key props / variants**: `endpoint`, `filename`, `params`, `disabled`, `size`.
- **Visible labels / text**: `export`→(button), `export_success`, `export_failed`. Items "Excel (.xlsx)" (FileExcelOutlined), "CSV (.csv)" (FileTextOutlined).
- **Actions / buttons it renders**: Dropdown (DownloadOutlined) → Excel / CSV.

### SavedFiltersBar
- **File**: src/components/SavedFiltersBar.tsx
- **Kind**: other (toolbar + dialog)
- **Purpose**: Backend-backed saved filters per page (default + CRUD).
- **Key props / variants**: `pageKey`, `currentFilters`, `currentColumns`, `onLoad`.
- **Visible labels / text**: `saved_filters.saved_filter/save_new/save_changes/set_default/delete`, `saved_filters.saved/updated/deleted/set_as_default/error`, `saved_filters.name/enter_name/filter_name/confirm_delete/save_new_filter`.
- **Actions / buttons it renders**: Select (StarOutlined on default), Save new (PlusOutlined), Save changes (SaveOutlined), Set default (StarOutlined), Delete (Popconfirm danger), save-name FormDialog.

### ImpersonationBanner
- **File**: src/components/ImpersonationBanner.tsx
- **Kind**: feedback (banner)
- **Purpose**: Fixed red top banner during tenant impersonation with countdown + End session.
- **Visible labels / text**: `impersonation.banner`→"VIEWING AS {{tenant}} — READ-ONLY", `impersonation.expired`→"expired", `impersonation.expiresIn`→"{{time}} remaining", `impersonation.endSession`→"End session".
- **Actions / buttons it renders**: End session (danger, LogoutOutlined). `role="alert"` aria-live assertive. Returns null when not impersonating.

### CalendarToggle
- **File**: src/components/CalendarToggle.tsx
- **Kind**: form-control (settings)
- **Purpose**: Gregorian / Hijri / Both calendar preference radio + preview.
- **Visible labels / text**: `settings:calendar.title`→"Calendar", `.gregorian`→"Gregorian", `.hijri`→"Hijri", `.both`→"Both", `.preview`→"Preview".
- **Actions / buttons it renders**: Radio.Group (button style).

### settings/DigitPreferenceToggle
- **File**: src/components/settings/DigitPreferenceToggle.tsx
- **Kind**: form-control (settings)
- **Purpose**: Latin vs Arabic-Indic digits preference radio + preview.
- **Visible labels / text**: `settings:digits.title`→"Number digits", `.auto`→"Auto (by language)", `.latin`→"Latin (0–9)", `.indic`→"Arabic-Indic (٠–٩)", `.preview`→"Preview".

### CurrencyConverter
- **File**: src/components/CurrencyConverter.tsx
- **Kind**: card (tool)
- **Purpose**: CBI-rate-backed IQD↔USD converter with rate-source tag.
- **Visible labels / text**: `common:currency_converter`→"Currency converter (CBI)", `rate_fresh`→"Fresh CBI rate", `rate_fallback`, `rate_hardcoded`→"Hardcoded fallback", `rate_date`→"Rate date", `rate_value`→"Rate", `loading`→"Loading…".
- **Sub-parts / slots**: amount InputNumber + from/to Selects (IQD/USD) + result + source Tag.

### tax/WHTBreakdown
- **File**: src/components/tax/WHTBreakdown.tsx
- **Kind**: card (invoice sidebar)
- **Purpose**: Withholding-tax gross/rate/withheld/net breakdown card.
- **Key props / variants**: `grossAmount`, `whtType: 'services'|'rent'|'materials'|'other'`, `customerType: 'b2b'|'b2c'|'b2g'`, `rateOverridePercent`, `currency`, `placeholderRate` (def true).
- **Visible labels / text**: `invoices:wht.title`→"Withholding tax (WHT)", `.placeholder`→"Placeholder rate · R7.1", `.gross`→"Gross amount", `.rate`→"Rate", `.withheld`→"WHT withheld", `.net_payable`→"Net payable", `.b2c_exempt`→"B2C — not applicable", `.zero`→"0% — none".
- **Notes**: `React.memo`, Descriptions; default rates services 3% / rent 5% / materials 2%.

### SerialNumberPicker
- **File**: src/components/SerialNumberPicker.tsx
- **Kind**: form-control (async multi-select)
- **Purpose**: Pick N available serial numbers for an item (SO/PO/Transfer/POS).
- **Key props / variants**: `itemId`, `value`, `onChange`, `max` (0=unrestricted), `statuses` (def ['in_stock']), `disabled`, `placeholder`.
- **Visible labels / text**: `serial_pick_placeholder`, `no_serials_available`.
- **States**: loading spinner; selected count Tag `{n}/{max}` (green when full).

### AnimatedList / AnimatedListItem
- **File**: src/components/AnimatedList.tsx
- **Kind**: other (animation wrapper)
- **Purpose**: Stagger list animation (100ms per item).
- **Key props / variants**: List: `as` (div/ul/ol/section/article), `withExitAnimation`. Item: `as`, `layoutId`. Reduced-motion → no stagger.

### PageHelp
- **File**: src/components/PageHelp.tsx
- **Kind**: drawer (help)
- **Purpose**: Centralized per-page help drawer (purpose, fields, workflow, tips, warnings, shortcuts, related).
- **Key props / variants**: `open`, `onClose`, `content: PageHelpContent`.
- **Visible labels / text**: `help_purpose`, `help_fields`, `help_workflow`, `help_tips`, `help_shortcuts`→"Keyboard shortcuts", `help_related`→"Related pages", `required`.
- **Sub-parts / slots**: purpose, field list (required tag), numbered workflow, tips, warning Alerts, shortcut rows, related tags.

### HelpButton
- **File**: src/components/HelpButton.tsx
- **Kind**: button (help trigger)
- **Purpose**: Self-contained help trigger → opens PageHelp drawer.
- **Key props / variants**: `pageKey`, `size`.
- **Visible labels / text**: `help`→(tooltip/aria). QuestionCircleOutlined (indigo).

### help/HelpWidget
- **File**: src/components/help/HelpWidget.tsx
- **Kind**: other (floating + drawer)
- **Purpose**: Floating "?" FloatButton (bottom-end) → lazy `HelpPanel`.
- **Key props / variants**: `route`, `onlyOn[]`.
- **Visible labels / text**: `help.openHelp`→"Help & support".

### help/HelpPanel
- **File**: src/components/help/HelpPanel.tsx
- **Kind**: drawer (help center)
- **Purpose**: Help drawer with search, contextual suggestions, category browse, article view; trilingual; WhatsApp/support contact.
- **Key props / variants**: `open`, `route`, `onClose`. Width 420, placement by RTL.
- **Visible labels / text**: `help.title`→"Help & support", `help.back`→"Back", `help.searchPlaceholder`→"Search help articles…", `help.searchResults`→"Results", `help.noResults`→"No articles found", `help.contextual`→"Suggested for this screen", `help.categories`→"Browse by topic", `help.articlesCount`→"articles", `help.contactSupport`→"Contact support", `help.whatsappUs`→"WhatsApp us".
- **Sub-parts / slots**: search Input, contextual ArticleList, category List, ContactRow (Crisp chat + WhatsApp), HelpArticle view.

### help/HelpArticle
- **File**: src/components/help/HelpArticle.tsx
- **Kind**: other — (article renderer; not detailed)

### feedback/ComingSoon
- **File**: src/components/feedback/ComingSoon.tsx
- **Kind**: feedback (placeholder)
- **Purpose**: "Coming soon" placeholder for feature-flagged sections.
- **Key props / variants**: `featureNameKey`, `descriptionKey`, `icon` (def RocketOutlined).
- **Visible labels / text**: `coming_soon`→"Coming soon", `comingSoon.description`→"This feature is under development and will be available soon.".
- **Notes**: `React.memo`, motion fade+y.

### feedback/DelayedSkeleton
- **File**: src/components/feedback/DelayedSkeleton.tsx
- **Kind**: feedback (skeleton)
- **Purpose**: Skeleton that only appears after 300ms delay (prevents flash); wraps content.
- **Key props / variants**: `variant`, `rows`, `delay` (def 300), `loading`, `children`.
- **Notes**: `React.memo`, renders nothing during delay window.

### feedback/InlineError
- **File**: src/components/feedback/InlineError.tsx
- **Kind**: feedback (error)
- **Purpose**: Inline error box with localized message + Retry (replaces silent empty).
- **Key props / variants**: `messageKey` (def 'error_loading'), `message`, `onRetry`, `compact`.
- **Visible labels / text**: `error_loading`→"Error loading data", `retry`→"Retry".
- **Notes**: `React.memo`, `role="alert"` aria-live assertive, error50 bg.

---

### SECTION 2b — components/glass/ (Glassmorphism primitives, role-accent aware)

### glass/GlassCard
- **File**: src/components/glass/GlassCard.tsx
- **Kind**: card
- **Purpose**: Glass surface card (backdrop-blur, role accent) with optional click + hover lift.
- **Key props / variants**: `accent`, `onClick`, `style/className`. `@supports` fallback to solid bg.

### glass/GlassDialog
- **File**: src/components/glass/GlassDialog.tsx
- **Kind**: dialog
- **Purpose**: Glassmorphism AntD Modal with role-accent + sized variants + glass footer.
- **Key props / variants**: `open`, `onClose`, `title`, `footer`/`footerProps`, `size: 'sm'(420)|'md'(560)|'lg'(720)|'full'(92vw)`, `roleAccent`, `stackDepth`, `destroyOnClose`, `maskClosable`, `zIndexOverride`.
- **Sub-parts / slots**: glass header/body/footer; modalRender glass wrapper.

### glass/GlassDrawer
- **File**: src/components/glass/GlassDrawer.tsx
- **Kind**: drawer
- **Purpose**: Glass AntD Drawer; mobile→bottom sheet (drag pill), desktop→right.
- **Key props / variants**: `open`, `onClose`, `title`, `footer`, `placement: 'bottom'|'right'|'left'` (auto by viewport), `height` (def 85vh), `roleAccent`.
- **Notes**: Framer motion entrance via useGlassMotion; bottom-sheet grabber pill.

### glass/GlassConfirm
- **File**: src/components/glass/GlassConfirm.tsx
- **Kind**: dialog (confirm)
- **Purpose**: Glass confirmation modal (icon + title + description + GlassDialogFooter).
- **Key props / variants**: `open`, `title`, `description`, `okText`, `cancelText`, `danger`, `loading`, `onConfirm`, `onCancel`. Width 420.
- **Visible labels / text**: `confirm`→"Confirm", `cancel`.

### glass/GlassDialogFooter
- **File**: src/components/glass/GlassDialogFooter.tsx
- **Kind**: other (footer)
- **Purpose**: Standard glass dialog footer (primary role-accent + secondary).
- **Key props / variants**: `primaryLabel`, `secondaryLabel`, `onPrimary`, `onSecondary`, `primaryLoading`, `primaryDanger`, `hideSecondary`.
- **Visible labels / text**: defaults `save`, `cancel`.

### glass/GlassPopover
- **File**: src/components/glass/GlassPopover.tsx
- **Kind**: menu/dropdown (popover)
- **Purpose**: AntD Popover with glass inner style.
- **Key props / variants**: `roleAccent` + all PopoverProps.

### glass/GlassSaveButton
- **File**: src/components/glass/GlassSaveButton.tsx
- **Kind**: button
- **Purpose**: Save button that morphs to green "Saved" (CheckOutlined) for 1.8s after save.
- **Key props / variants**: `loading`, `onClick`, `label`.
- **Visible labels / text**: `saved`→"Saved", `save_changes`→"Save changes".

---

### SECTION 2c — components/ui/ (Premium polished primitives)

### ui/PremiumModal
- **File**: src/components/ui/PremiumModal.tsx
- **Kind**: dialog
- **Purpose**: Polished modal (gradient header + icon + subtitle + footer) on FormDialog.
- **Key props / variants**: `open`, `icon`, `title`, `subtitle`, `okText` (def "Save"), `cancelText` (def "Cancel"), `onOk`, `onCancel`, `okDanger`, `okLoading`, `hideFooter`, `customFooter`.
- **Actions / buttons it renders**: close ✕, Cancel, primary OK (role-accent or danger).

### ui/PremiumPageHeader
- **File**: src/components/ui/PremiumPageHeader.tsx
- **Kind**: layout (header)
- **Purpose**: Premium page header with eyebrow, icon, title (+HelpIcon), subtitle, meta, actions, gradient underline.
- **Key props / variants**: `eyebrow`, `title`, `subtitle`, `icon`, `actions`, `meta`, `sectionId`.

### ui/SectionCard
- **File**: src/components/ui/SectionCard.tsx
- **Kind**: card
- **Purpose**: Premium section card with accent rail, icon header, footer (Linear/Stripe style).
- **Key props / variants**: `icon`, `title`, `description`, `actions`, `footer`, `loading`, `noPadding`, `accent: 'default'|'success'|'warning'|'danger'|'info'`, `sectionId`.
- **Sub-parts / slots**: accent rail, header (icon+title+desc+actions+HelpIcon), body, footer.

### ui/SettingsRow
- **File**: src/components/ui/SettingsRow.tsx
- **Kind**: layout (settings row)
- **Purpose**: Linear/Stripe settings row — label+description / control.
- **Key props / variants**: `label`, `description`, `htmlFor`, `divider`, `align`, `controlWidth`, `inline` (label+control side-by-side e.g. Switch).

### ui/SectionHelpPopover
- **File**: src/components/ui/SectionHelpPopover.tsx
- **Kind**: menu/dropdown (help popover)
- **Purpose**: ⓘ help trigger for settings section headers (what/why/steps).
- **Key props / variants**: `what`, `why`, `steps[]`.
- **Visible labels / text**: `help` (aria). InfoCircleOutlined trigger.

---

### SECTION 2d — components/role/ (Role-distinct UX)

### role/RoleIdentityChip
- **File**: src/components/role/RoleIdentityChip.tsx
- **Kind**: nav-chrome (chip + dropdowns)
- **Purpose**: Top-bar role chip (avatar + role label + name) opening capability panel; plus a `•••` user menu.
- **Key props / variants**: `isDark`, `onLogout`.
- **Visible labels / text**: `role.chip_aria`→"{{role}} — {{name}}", `role.impersonating`→"Viewing as org", `role.chip_hint`→"Your role and capabilities", `user_menu`→"User menu". User menu items: `profile`→"Profile", `settings`→"Settings", `logout`→"Logout" (danger).
- **Sub-parts / slots**: capability Dropdown → `<RoleCapabilityPanel>`; user-menu Dropdown (Profile/Settings/divider/Logout).
- **Notes**: warning border + "Viewing as org" when impersonating. User menu hidden for super_admin (unless impersonating).

### role/RoleCapabilityPanel
- **File**: src/components/role/RoleCapabilityPanel.tsx
- **Kind**: other (panel)
- **Purpose**: Glass panel listing role's "You can" / "You cannot" + open profile link.
- **Key props / variants**: `persona`, `roleLabel`. Width 320.
- **Visible labels / text**: `persona.you_can`→"You can", `persona.you_cannot`→"You cannot", `persona.open_profile_settings`→"Open profile settings →".

### role/RoleWelcomeSheet
- **File**: src/components/role/RoleWelcomeSheet.tsx
- **Kind**: drawer (onboarding)
- **Purpose**: One-time role welcome drawer (per role, localStorage-gated) with capabilities + quick action.
- **Visible labels / text**: `role.welcome.title`→"Welcome — {{role}}", `role.welcome.skip`→"Got it", `persona.you_can`→"You can", `role.welcome.hint`→"Use the role chip in the top bar anytime to review your capabilities.".
- **Actions / buttons it renders**: Got it (dismiss), primary quick-action (role accent).
- **Notes**: GlassDrawer + GlassCard. Hidden for super_admin / unset role.

### role/RoleHomeHero
- **File**: src/components/role/RoleHomeHero.tsx
- **Kind**: card (hero)
- **Purpose**: Role-specific dashboard hero (gradient by role) with welcome + role title/sub + quick actions.
- **Visible labels / text**: `role.home.welcome`→"Welcome back, {{name}}"; per-role title/sub keys (executive/administrator/manager/finance/sales/purchase/inventory/pos/hr/projects/personal/readonly), e.g. `role.home.executive_title`→"Organization overview".
- **Actions / buttons it renders**: role quick-action buttons (first = primary, role accent).

### role/RoleAccentProvider, RolePersonaGallery
- **Files**: src/components/role/RoleAccentProvider.tsx, RolePersonaGallery.tsx
- **Kind**: other / layout — (role accent CSS var provider; persona gallery; not detailed)

---

### SECTION 2e — components/react-bits/ (Animation text primitives)

### react-bits/CountUp
- **File**: src/components/react-bits/CountUp.tsx
- **Kind**: other (animation)
- **Purpose**: Animated number counter (0→end, 800–1200ms, easeOutCubic).
- **Key props / variants**: `end`, `start`, `duration`, `decimals`, `prefix`, `suffix`, `separator` (def ','), `onComplete`.
- **Notes**: aria-live polite. Used by KpiCard via MotionGate.

### react-bits/Typewriter
- **File**: src/components/react-bits/Typewriter.tsx
- **Kind**: other (animation)
- **Purpose**: Character-by-character text reveal (40–60ms/char).
- **Key props / variants**: `text`, `speed` (def 50), `onComplete`. aria-label = full text.

### react-bits/GradientText
- **File**: src/components/react-bits/GradientText.tsx
- **Kind**: other (animation)
- **Purpose**: Animated gradient sweep across text (3s).
- **Key props / variants**: `children`, `colors[]`, `duration` (def 3000).

### react-bits/ShimmerText
- **File**: src/components/react-bits/ShimmerText.tsx
- **Kind**: other (animation)
- **Purpose**: Metallic sheen sweep across text (loading labels).
- **Key props / variants**: `children`, `shimmerColor`, `baseColor`, `duration` (def 1400).

### react-bits/Particles
- **File**: src/components/react-bits/Particles.tsx
- **Kind**: other — (decorative particle field; not detailed)

---

### SECTION 2f — components/responsive/ (Mobile-first adapters)

### responsive/ResponsiveDialog
- **File**: src/components/responsive/ResponsiveDialog.tsx
- **Kind**: dialog / drawer
- **Purpose**: Drawer-instead-of-modal: bottom-sheet (drag handle + swipe-to-dismiss + thumb-zone footer) on mobile ≤640px; centered glass Modal (max 560px) on desktop. The base of FormDialog/ConfirmDialog/AdvancedFilterDrawer/QuickSearch.
- **Key props / variants**: `open`, `onClose`, `title` (TranslationKey), `primaryAction` (labelKey,onClick,danger), `secondaryAction`, `suppressSwipeDismiss`.
- **Visible labels / text**: `close` (aria + drag handle); action labels via keys.
- **Sub-parts / slots**: sticky DialogHeader (title + close), scroll body, sticky DialogFooter (secondary + primary, 44px min), mobile DragHandle.
- **States**: drag offset / swipe-dismiss (>30% height). Focus trap + scroll lock by AntD.
- **Notes**: glass modalRender on desktop; logical CSS; safe-area thumb zone.

### responsive/FormDialog
- **File**: src/components/responsive/FormDialog.tsx
- **Kind**: dialog
- **Purpose**: Common "form modal with OK/Cancel" → maps to ResponsiveDialog + wraps children in ResponsiveForm. The most-used dialog wrapper app-wide.
- **Key props / variants**: `open`, `onClose`, `title`, `onOk`, `okText` (def 'save'), `cancelText` (def 'cancel'), `danger`, `suppressSwipeDismiss`, `hideFooter`, `width`.
- **Notes**: Note callers also pass extra AntD-Drawer-ish props (placement/styles/centered/footer/confirmLoading) loosely.

### responsive/ResponsiveForm (+ LineItem)
- **File**: src/components/responsive/ResponsiveForm.tsx
- **Kind**: layout (form grid)
- **Purpose**: Single-column-on-mobile form grid; ≥44px touch targets; ≥8px gaps. `ResponsiveForm.LineItem` = expandable `<details>` card on mobile.
- **Key props / variants**: `layout: 'single'|'two-column'` (ignored on mobile → single). LineItem: `summary`, `children`, `toggleLabelKey` (def `responsiveForm.lineItem.editDetails`), `defaultOpen`.

### responsive/ResponsiveTable
- **File**: src/components/responsive/ResponsiveTable.tsx
- **Kind**: table
- **Purpose**: Table → stacked cards on mobile (swipe-to-reveal actions + tap overflow); AntD Table on desktop with sticky header + tablet column-trim (>5 cols → priority high + expandable rows).
- **Key props / variants**: `columns: ResponsiveColumn<T>[]` (id, headerKey, priority 'high'|'medium'|'low', render, align 'start'|'center'|'end', sorter, width), `data`, `rowActions(row)→RowAction[]`, `loading`, `emptyState`, `getRowKey`, `pagination`, `testId`.
- **Visible labels / text**: `actions`, `more`, `less`, `loading`, `no_data`, `close`.
- **Sub-parts / slots**: MobileCard (label/value dl, action panel, Show more), desktop RowActionMenu (MoreOutlined dropdown), expandable hidden columns.
- **States**: loading spinner; empty (AntD Empty / custom).

### responsive/ResponsiveTableAdapter
- **File**: src/components/responsive/ResponsiveTableAdapter.tsx
- **Kind**: table (migration adapter)
- **Purpose**: AntD `<Table>`-compatible props → ResponsiveTable; auto-infers column priority from key/dataIndex.
- **Key props / variants**: AntD-style `columns`, `dataSource`, `rowKey`, `loading`, `pagination`, `locale`, `onRow`, etc. Priority inferred (high: name/title/amount/total/status…; medium: date/type/email…; low: notes/id/actions…).

### responsive/ResponsiveChart
- **File**: src/components/responsive/ResponsiveChart.tsx
- **Kind**: other (chart wrapper)
- **Purpose**: recharts ResponsiveContainer wrapper; 240px min height on mobile; legend reflows below chart and wraps when intrinsic width > container (ResizeObserver measured).
- **Key props / variants**: `legendItems: {id,labelKey,color}[]`, `minMobileBlockSize` (def 240), `children` (chart, no own Legend), `aspect` (def 16/9), `testId`.
- **Sub-parts / slots**: chart surface; visible legend (below); hidden ghost legend (measurement).

---

### SECTION 2g — components/pos/ (POS pickers & dialogs)

### pos/POSPaymentMethodPicker
- **File**: src/components/pos/POSPaymentMethodPicker.tsx
- **Kind**: other (tile grid + dialogs)
- **Purpose**: Tile grid of enabled payment providers with per-provider flow modals.
- **Key props / variants**: `total`, `currency`, `isOnline`, `providers: PaymentProviderOption[]` (slug,display_name,enabled,configured,online_only), `onSelect(slug,payload)`, `onClose`.
- **Visible labels / text**: `pos.payment.pickerTitle`→"Choose Payment Method", `.total`→"Total", `.offline`→"Offline — only Cash and COD are available.", `.notConfigured`→"Not configured", `.onlineRequired`→"Online required", `.cashTitle`/`.collect`/`.tendered`/`.change`, `.codTitle`/`.markCOD`/`.codConfirm`, `.stripeTitle`/`.tapToCharge`/`.stripeDescription`, `.scanQR`/`.markPaid`/`.qrPlaceholder`, `.zainTitle`/`.confirmOTP`/`.zainDescription`.
- **Sub-parts / slots**: provider tiles (cash/cod/stripe/fastpay/qi/zain/asia_pay icons); flow modals: CashFlow (tendered/change), CODFlow, StripeFlow, QRFlow (QRCode), OTPFlow (Zain OTP).
- **States**: disabled tile when not configured / online-only offline; offline warning Alert.

### pos/POSCustomerSelector
- **File**: src/components/pos/POSCustomerSelector.tsx
- **Kind**: dialog (customer picker)
- **Purpose**: POS customer search + quick-create.
- **Key props / variants**: `visible`, `onClose`, `onSelect(customer)`.
- **Visible labels / text**: `pos.select_customer`, `pos.search_customer`, `pos.quick_create_customer`, `pos.customer_created`, `pos.no_customers_found`, `name`, `phone`, `email`, `customer_name`, `create`, `cancel`.
- **Actions / buttons it renders**: Search, "Quick create customer" dashed button, inline create Form (name/phone/email), customer result cards.

### pos/PINPad
- **File**: src/components/pos/PINPad.tsx
- **Kind**: dialog (numpad)
- **Purpose**: PIN entry numpad (auto-submit at maxLength).
- **Key props / variants**: `onComplete(pin)`, `onCancel`, `visible`, `title` (def "Enter PIN"), `maxLength` (def 6).
- **Actions / buttons it renders**: digits 0–9, Clear (DeleteOutlined danger), OK (primary, disabled <4). PIN dots display.

### pos/QuickCashTender
- **File**: src/components/pos/QuickCashTender.tsx
- **Kind**: other (quick buttons)
- **Purpose**: One-tap suggested IQD cash tender amounts (round notes).
- **Key props / variants**: `amountDue`, `onTender(amount)`, `count` (def 4).
- **Visible labels / text**: `pos:tender.title`→"Quick cash".
- **Notes**: `React.memo`, exact-amount button = primary; Arabic-Indic digits via DigitPreference.

### pos/POSDiscountModal
- **File**: src/components/pos/POSDiscountModal.tsx
- **Kind**: dialog
- **Purpose**: Line-level discount (percent or fixed → converts to %).
- **Key props / variants**: `open`, `onClose`, `cart`, `onApply(itemId, discountPercent)`. Width 480.
- **Visible labels / text**: `pos.discount`, `apply`, `pos.line`→"Line", `pos.select`→"Select", `amount`→"Amount", `pos.applied_percent`→"Applied".
- **Sub-parts / slots**: line Select, percent/fixed Radio, value InputNumber, applied-% preview.

> Other pos/ components (POSCartPanel, POSProductGrid(+Skeleton), POSEmptyCart, POSTerminalShell, POSPaymentModal, POSQuotationDialog, POSShipLaterDialog, BarcodeScanner, EmployeePINLogin, GiftCardChargeDialog, LoyaltyCardLookup, CashDrawerBreakdown, ReceiptTemplate80mm, HardwarePairingWizard, TestPrintPreview, HardwareDeviceCard) are POS-screen-specific; noted but not detailed (HardwarePairingWizard = 7-step pairing wizard; HardwareDeviceCard = device card + RSSI).

### Other misc components (noted, not detailed)
- `DashboardHero` — dashboard greeting hero card (time-aware greeting `greeting_morning/afternoon/evening/night`, quick chips New invoice/Expenses/Payments/Reports, primary New invoice CTA, gradient + glow).
- `GoogleSignInButton` — Google OAuth popup sign-in Button (GoogleOutlined; default text Kurdish "چوونەژوورەوە بە Google").
- `EnvironmentBadge` (components/) duplicate of DS badge.
- `ErrorBoundary`, `ChunkLoadErrorFallback`, `ModuleGuard`, `MotionGate`, `PageTransition`, `Picture`, `SkipToContent`(re-export), `AuthLayout`, `TwoFactorSetupGuard`, `HelpButton`, `PageHelp` — infra/guards.
- `AddGate/*` (AddGateProvider, AddGateSection, EmptySelectState, EmptyState, FlowFinalSummary, FlowProgressIndicator) — add-flow gating system.
- `activities/MyActivitiesWidget`, `billing/TrialBanner` (trial banner — `billing.trial.banner`→"{{days}} days left in your trial — upgrade to keep your data", `billing.upgrade`→"Upgrade"; severity info/amber≤14d/red≤3d).

---

### SECTION 3 — layouts/ (Chrome dropdowns / drawers / nav)

### OrgSwitcher
- **File**: src/layouts/OrgSwitcher.tsx
- **Kind**: nav-chrome (dropdown)
- **Purpose**: Multi-organization switcher (lazy-loads `/api/system/organizations`).
- **Key props / variants**: `isRTL`.
- **Visible labels / text**: `topbar.org_switcher`→"Organization", `org_switcher.your_organizations`→"Your organizations", `org_switcher.current`→"Current", `org_switcher.manage`→"Manage organization", `org_switcher.switched`→"Organization switched", `org_switcher.switch_failed`→"Failed to switch organization".
- **Actions / buttons it renders**: trigger circle button (BankOutlined); dropdown header + org rows (check on current) + divider + "Manage organization".

### BranchSwitcher
- **File**: src/layouts/BranchSwitcher.tsx
- **Kind**: nav-chrome (dropdown)
- **Purpose**: Branch selector within current org (orgStore).
- **Key props / variants**: `isRTL`.
- **Visible labels / text**: `topbar.branch_switcher`→"Branch", `branch_switcher.branches`→"Branches", `branch_switcher.current`→"Current", `branch_switcher.main_branch`→"Main branch", `branch_switcher.no_branches`→"No branches", `branch_switcher.select`→"Branch".
- **Actions / buttons it renders**: trigger button (ApartmentOutlined + branch name); dropdown header + branch rows (check + "Current" tag).

### EntitySwitcher
- **File**: src/layouts/EntitySwitcher.tsx
- **Kind**: nav-chrome (dropdown)
- **Purpose**: Legal-entity (company) switcher (`/api/companies`, switch via POST).
- **Key props / variants**: `isRTL`.
- **Visible labels / text**: `entity_switcher.companies`→"Companies", `entity_switcher.current`→"Current", `entity_switcher.no_companies`→"No companies", `entity_switcher.select`→"Company".
- **Actions / buttons it renders**: trigger button (BankOutlined + company name); dropdown header + company rows (check + code + "Current" tag).

### NotificationsDrawer
- **File**: src/layouts/NotificationsDrawer.tsx
- **Kind**: drawer (notifications)
- **Purpose**: Notifications drawer with Today/Earlier/Read tabs (mock data + `/api/notifications` placeholder).
- **Key props / variants**: `isDark`, `isRTL`. Exports `useUnreadCount()`.
- **Visible labels / text**: `notifications_v2.title`→"Notifications", `notifications_v2.empty`→"No notifications", `notifications_v2.mark_all_read`→"Mark all as read", `notifications_v2.tab_today`→"Today", `notifications_v2.tab_earlier`→"Earlier", `notifications_v2.tab_read`→"Read", `notifications_v2.unread_count`→"{{n}} unread notifications", `footer.just_now`→"just now", `footer.minutes_ago`→"{{n}}m ago". (Mock items have hardcoded Kurdish titles.)
- **Sub-parts / slots**: Mark-all-read link (CheckOutlined), Tabs with Badge counts, per-item button (module avatar/icon, title, relative time, unread dot). Modules: invoice/bill/banking/inventory/crm/system.
- **Notes**: Built on FormDialog; aria-live unread count.

### CommandPalette
- **File**: src/layouts/CommandPalette.tsx
- **Kind**: dialog (command palette)
- **Purpose**: ⌘K/Ctrl+K glass overlay; fuzzy search across pages + quick actions + recents + settings; full keyboard nav.
- **Key props / variants**: `open`, `onClose`.
- **Visible labels / text**: `command_palette.title`→"Command Palette", `command_palette.placeholder`→"Search pages, actions, recents…", `command_palette.results`→"Search results", `command_palette.no_results`→"No results found". Category labels: Recent/دواین, Actions/کردار, Pages/لاپەڕە. Footer hints "↑↓ navigate / Enter open / Esc close" (Kurdish ناوبردن/کردن/داخستن). Quick actions: `nav.new_invoice`→"New Invoice" (C I), `nav.new_bill`→"New Bill" (C B), `nav.new_customer`→"New Customer" (C C), `nav.new_item`→"New Item" (C P), `nav.new_quote`→"New Quote" (C Q), `nav.settings`→"Settings", `nav.dashboard`→"Dashboard".
- **Sub-parts / slots**: search input (combobox), grouped/flat result list (CommandItemRow: icon + label + page-path + shortcut kbd + Enter hint), footer (result count aria-live + key hints).
- **States**: empty → AntD Empty. Active row highlight + accent rail.
- **Notes**: Glass morphism (backdrop blur), focus trap, role=dialog/listbox/option, aria-activedescendant. Items from navDestinations + role quick actions + settings command items.

### ShortcutCheatsheet
- **File**: src/layouts/ShortcutCheatsheet.tsx
- **Kind**: dialog (shortcuts)
- **Purpose**: Global `?` opens keyboard-shortcut cheatsheet.
- **Key props / variants**: `isDark` (open state via uiStore).
- **Visible labels / text**: `shortcuts.title`→"Keyboard shortcuts", `shortcuts.close`→"Close", `search_or_jump`→"Search or jump to…", `topbar.quick_create`→"Quick create", quick-create labels (`quick_create.invoice/bill/customer/vendor/item/quote/manual_journal`). Groups: Keyboard shortcuts (Ctrl K, ?, Esc), Quick create (c i/c b/c c/c v/c p/c q/c j), Workspace tabs (Ctrl 1..9, Ctrl W).
- **Sub-parts / slots**: grouped rows label + `<KbdHint>`.
- **Notes**: Built on FormDialog. `?` keydown listener (ignores inputs).

### QuickCreateMenu
- **File**: src/layouts/QuickCreateMenu.tsx
- **Kind**: dialog (quick-create launcher)
- **Purpose**: Searchable quick-create launcher (`c <key>` sequences). Exports `useQuickCreateKeyboard()`.
- **Visible labels / text**: `quick_create.title`→"Quick create"; items `quick_create.invoice` (Kurdish پسووڵە, c I), `.bill` (خەرجی فرۆشیار, c B), `.customer` (کڕیار, c C), `.vendor` (فرۆشیار, c V), `.item` (کاڵا, c P), `.quote` (نرخ, c Q), `.manual_journal` (تۆمارکردنی دەستکار, c J).
- **Actions / buttons it renders**: search Input, item rows (icon + label + `c X` kbd).
- **Notes**: Built on FormDialog (centered). Global `c`-then-key (800ms) navigation.

### Breadcrumb
- **File**: src/layouts/Breadcrumb.tsx
- **Kind**: nav-chrome (breadcrumb)
- **Purpose**: Auto-derived breadcrumb from current route + nav sections.
- **Key props / variants**: `isDark`, `isRTL`.
- **Visible labels / text**: `topbar.breadcrumb`→"Breadcrumb" (aria). Home icon → "/". Separator RightOutlined/LeftOutlined (RTL).
- **Notes**: Returns null at root.

### SideNav
- **File**: src/layouts/SideNav.tsx
- **Kind**: nav-chrome (sidebar)
- **Purpose**: Collapsible sectioned navigation (240px / 64px collapsed; Drawer <768px) with favorites, recents, search, hover-intent open, collapsed flyout, active rail, module-gating, role nav profile.
- **Key props / variants**: `collapsed`, `width`, `collapsedWidth`, `isRTL`, `isDark`, `density: 'comfortable'|'compact'`, `onOpenPalette`, `onOpenSectionDocs`.
- **Visible labels / text**: `app_name`, `app_subtitle`, `search_or_jump`→"Search or jump to…", `nav.search_label`→"Search navigation", `nav.search_results_count`→"{{n}} results found", `favorites`→"Favorites", `recent`→"Recent", `no_results`→"No results", `nav_search_no_results`→"Try another keyword or open the command palette", `add_favorite`/`remove_favorite`, `language`, `nav.sidebar`→"Navigation".
- **Sub-parts / slots**: brand row; search input; Favorites section; Recent section (top 3); zones → collapsible sections → leaves (active rail, maturity badge Tag, favorite star); collapsed icon rail + flyout panel; footer (LanguageSwitcher + version).
- **Favorites/pin behavior**: per-leaf star toggles navStore pin/unpin (favoriteEligible items); favorites render in top "Favorites" section; recents auto-tracked via navStore.addRecent on route change.
- **States**: search filters sections/items; empty "No results"; hover-open after 700ms; auto-expand active section.
- **Notes**: Active item gradient + spring `layoutId` rail; module visibility from onboarding store; role navProfile (applyNavProfile, POS minimal default-collapsed).

### Footer
- **File**: src/layouts/Footer.tsx
- **Kind**: nav-chrome (status bar)
- **Purpose**: Premium chip-based status bar (online, fiscal year, user/org, last sync, version, env, help/API links). Glass surface.
- **Key props / variants**: `isDark`, `isRTL`. Hidden on mobile; tablet shows only online + version.
- **Visible labels / text**: `footer.label`→"Status bar", `footer.online`→"Online", `footer.offline`→"Offline", `footer.fiscal_year`→"FY", `footer.synced`→"Synced", `footer.just_now`→"just now", `footer.minutes_ago`→ (Kurdish "{{n}} خولەک پێشتر"), `footer.help`→"Help". Links: Help (→/docs), API (→localhost:8000/docs). Env badge prod/staging/dev.
- **Sub-parts / slots**: status Chips, env badge, Help/API links.
- **Notes**: online pulse animation; backdrop blur. (Footer's own `useEffect`/hooks before the mobile early-return per rules-of-hooks.)

> Other layouts/ files: `AppShell.tsx` (root authenticated layout — wires banners/widgets/SideNav Drawer), `TopBar.tsx` (top bar host — search/org/branch/entity/notifications/role chip/quick-create triggers), `LayoutChrome.tsx`, `AuthLayout.tsx`, `QuickCreateMenu` (above), `navigation.tsx`/`navDestinations.ts`/`moduleMap.ts` (nav data). These are composition/host layers rather than standalone reusable primitives.

---

### Chrome dropdown contents (exact menu items / actions)

**OrgSwitcher** (trigger: BankOutlined circle button)
- Header: "Your organizations" (`org_switcher.your_organizations`)
- One row per org: name + role; check icon on current ("· Current")
- divider
- "Manage organization" (`org_switcher.manage`) → `/settings`
- (loading → spinner row)

**BranchSwitcher** (trigger: ApartmentOutlined + branch name)
- Header: "Branches" (`branch_switcher.branches`)
- One row per branch: name + address; check icon + "Current" tag on current
- Empty → "No branches"; loading → spinner
- (fallback single "Main branch" when API unavailable)

**EntitySwitcher** (trigger: BankOutlined + company name)
- Header: "Companies" (`entity_switcher.companies`)
- One row per company: name + code; check icon + "Current" tag on current
- Empty → "No companies"; loading → spinner

**NotificationsDrawer** (opened via uiStore)
- "Mark all as read" link (when unread > 0)
- Tabs: "Today" (badge count) / "Earlier" (badge count) / "Read"
- Each item: module avatar icon + title + relative time + unread dot; click → mark read + navigate to module link
- Empty per tab → "No notifications"

**CommandPalette (⌘K / Ctrl+K)** — grouped (no query) or flat (query):
- **Recent** (دواین): recent routes (ClockCircleOutlined)
- **Actions** (کردار): role quick actions (ThunderboltOutlined, role accent) + global quick actions: New Invoice (C I), New Bill (C B), New Customer (C C), New Item (C P), New Quote (C Q), Settings, Dashboard; + settings command items
- **Pages** (لاپەڕە): all nav destinations (with page path subtitle)
- Footer: result count + "↑↓ navigate · Enter open · Esc close"
- Empty → "No results found"

**RoleIdentityChip (user menu)** — two adjacent dropdowns:
- Capability dropdown (click chip) → `<RoleCapabilityPanel>`: role label, persona description, "You can" list, "You cannot" list, "Open profile settings →"
- `•••` user menu: "Profile" (UserOutlined → /settings?s=profile), "Settings" (SettingOutlined → /settings), divider, "Logout" (LogoutOutlined, danger) [hidden for super_admin unless impersonating]

**ShortcutCheatsheet (global `?`)** — groups:
- Keyboard shortcuts: Ctrl+K "Search or jump to…", `?` "Keyboard shortcuts", Esc "Close"
- Quick create: c i Invoice, c b Bill, c c Customer, c v Vendor, c p Item, c q Quote, c j Manual journal
- Workspace tabs: Ctrl+1..9 "Jump to tab N", Ctrl+W "Close current tab"

---

### Summary of cross-cutting design tokens / conventions
- Tokens: `theme/tokens.ts` (palette, space, radius, shadow, fontSize, fontWeight, zIndex, layout, a11y.minTouchTarget=44, motion durations). Glass via `theme/glassStyles.getGlassStyle(kind, roleAccent)`; role accent CSS var `--role-accent` (default #1F6FEB).
- Animation: Framer Motion variants in `utils/animations.ts` (buttonVariants, cardVariants, modalVariants, listVariants/itemVariants) + `theme/motionPresets.ts`; all gated by `useReducedMotion`.
- Premium glass: `theme/premium.css` adds glass to all overlays + `.premium-card` hover lift.
- i18n: `react-i18next` `t('key','English')`; many controls also use `{ defaultValue }`. RTL via logical CSS (insetInline*, paddingBlock*) and `direction` by `['ku','ar']`.
- Dark mode: via `useAuthStore(s=>s.theme)==='dark'` or `isDark` prop.
- The canonical dialog base is `components/responsive/ResponsiveDialog` (bottom-sheet on mobile); most modals route through `FormDialog`.

---

## ١٤. زیادە — ئامار، کەلێن و ڕێنمایی دیزاین / Appendix — Stats, Gaps & Design Notes

### ئامار / Inventory totals

- ‏**808** فایلی TS/TSX؛ ‏**~2,330** ڕووت.
- ناڤبار: **4 زۆن**، **25 بەش**، **120+** بەستەری دەرئەنجام (side-nav leaf).
- مۆدیوولی زیادکراو: **32** (`/ext/<slug>`)، هەریەکە 3–9 ڕیسۆرس/تاب.
- ڕێکخستن: **12 گرووپ**، **59 بەش**.
- ڕووماڵی ڕۆڵ: **12**.
- پەڕەکانی تۆمارکراو لەم دۆکیومێنتە: **~280** (بەش‌ A–G) لەگەڵ سەدان دیالۆگ/فۆرم/دوگمە.

### کەلێنە ناسراوەکان / Known gaps (honest notes for the designer)

1. **دوو شێڵی ڕێکخستن / Two Settings shells coexist** — یەکی زیندوو (`/settings?s=…`، مۆنۆلیتی 59 بەش لە `bodies.tsx`) و یەکی نیوە-گواستراو (`?section=…`، تەنها 4 بەشی ڕاستەقینە + placeholderی TODO).
2. **دوو ویزاردی onboarding** — کۆن (هەڵبژاردنی پیشە/مۆدیوول) و نوێ (5 هەنگاوی «یەکەم 60 چرکە» لە `/get-started`)، دوو storeی جیاواز.
3. `feature_flags` body هەیە بەڵام لە switchـی پانێڵدا mount نەکراوە؛ `gdpr`ـی کۆن جیاوازە لە کۆمپۆنێنتی کارای `DataRights`.
4. **وەرگێڕانی کوردی ناتەواو** — لەو خانانەی ستوونی «کوردی» وەک ئینگلیزی وایە، ئەپەکە ئێستا fallbackـی ئۆتۆماتیک/ئینگلیزی پیشان دەدات (قەرزی i18n). دیزاینەر دەتوانێت ئەمانە وەک شوێنی پێویست بە وەرگێڕان نیشانە بکات.
5. هەندێ لیست endpointـی placeholderیان هەیە (نموونە: POS gift cards).

### ڕێنمایی بۆ ئامرازی دیزاین / Guidance for the design tool

- **RTL + کوردی-یەکەم**: هەموو ڕووکار بەرەو ڕاست ئاراستە بکە؛ logical properties.
- **توکنەکان بەکاربهێنە**: پالێتی ڕەنگ + accentـی ڕۆڵ؛ glass-morphism لەسەر overlayـەکان؛ بۆشایی 4pt؛ radius `md/lg`؛ ماوەکانی جووڵە.
- **ئارکیتایپی پەڕەکان / Page archetypes:**
  - **List**: `PageHeader` + `FilterBar`/`AdvancedFilterDrawer` + `DataTable` + `ExportMenu` + `ColumnVisibility` + `BulkActionBar` + `EmptyState` + `FormDialog` (create/edit).
  - **Form**: `FormLayout` (بەشە‌بەش) + `EditableLineItems` + `SelectWithQuickCreate` + `Save/SaveSplitButton`.
  - **Detail**: `DetailLayout` + `KeyValueGrid` + `Timeline`/`ChatterPanel` + `Attachments`.
  - **Dashboard**: گرید‌ی `KpiCard` + `ChartCard`/`TrendChart` + `MiniSparkline`.
  - **Wizard**: `Stepper` (onboarding، reconciliation…).
  - **Board / Floor**: kanban (CRM pipeline) و نەخشەی نهۆمی POS/چێشتخانە.
  - **POS terminal**: تۆڕی بەرهەم + سەبەتە + مۆداڵی پارەدان + نمایشی کڕیار.
- **حاڵەتەکان هەمووی دیزاین بکە**: loading (skeleton)، empty، error/retry، disabled — هەروەها dark mode و سێ ئاستی چڕی (density).
- **a11y**: ئامانجی دەستلێدان ≥ 44px، فۆکەس ڕینگ، `prefers-reduced-motion`.

> ئەم دۆکیومێنتە لە کۆدی ڕاستەقینەی `frontend/src` دروستکراوە (ناڤبار، ڕێکخستن، مۆدیوول، توکن، و تەواوی پەڕەکان). This document is generated from the live `frontend/src` source — navigation, settings, module registry, tokens, and every page.
