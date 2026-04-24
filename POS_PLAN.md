# 🛒 پلانی تەواوی مۆدیولی Point of Sale (POS)

> **ئامانج:** دروستکردنی مۆدیولێکی POS ی ١٠٠٪ هاوشێوەی Odoo 19 لەناو سیستەمی Zoho ERP.  
> **ستاک:** FastAPI + Firestore (BaseRepository, Python-side filtering) | React 19 + TS + Vite + AntD 6 (RTL)  
> **ئەیگێنت:** ERP POS

---

## 📋 بەشی ١: خولاسەی پڕۆژە

| خاڵ | وردەکاری |
|---|---|
| 📦 مۆدیول | Point of Sale (Sprint 6) |
| 🎯 ئامانج | فرۆشتنی ڕاستەوخۆ لە کاونتەر + چێشتخانە + self-order + online/offline |
| 🌍 بازاڕ | عێراق/کوردستان |
| 🗣️ زمان | کوردی (ckb) + ئینگلیزی (en) — RTL default |
| 💰 دراو | IQD (decimals=0) + USD (optional multi-currency) |
| 🧾 VAT | Iraq tax rules (0%, 15% if applicable) |
| 🖨️ چاپ | 80mm thermal receipt |
| 📶 ئۆفلاین | IndexedDB + sync queue |
| 🔌 Hardware | receipt printer, barcode scanner, cash drawer, customer display, scale, IoT box |
| 🧩 Integration | Accounting, Inventory, Contacts, HR, CRM Loyalty |

**کۆی گشتی پلانەکە:**  
- **Collections:** 22  
- **API Endpoints:** ~95  
- **Frontend Pages:** 18  
- **Components:** ~60  
- **Zustand Stores:** 5  
- **i18n Keys:** ~350  
- **Sub-Sprints:** 6 (هەر یەکە ٣-٥ ڕۆژ)

---

## ❓ بەشی ٢: پرسیارە کلیلیەکان (پێش دەستپێکردن)

تکایە ئەم پرسیارانە وەڵام بدەرەوە — نەخشەکە بەپێی وەڵامەکانت ڕێک دەخرێتەوە:

1. **جۆری بازرگانی:** Retail شۆپ؟ Restaurant؟ یان هەردوو (multi-mode)؟
2. **چەند branch/shop؟** یەک شوێن یان زۆر شوێن (multi-config)؟
3. **Self-order kiosk** پێویستە (کڕیار خۆی داوا بکات لە تابلێت/کیۆسک)؟
4. **Online food delivery** integration (Talabat, Careem, ...)؟
5. **IoT hardware** پێویستە (Odoo IoT Box یان WebUSB/WebSerial)؟
6. **Customer display** (دووەم سکرین)؟ Electronic shelf labels؟
7. **Loyalty program** چۆن بێت؟ Points / coupons / gift cards / membership؟
8. **Payment terminals** چی (Visa/Mastercard POS terminal، QR code، cash only)؟
9. **Preparation display (KDS)** بۆ چێشتخانە — چەند screen؟ (bar, kitchen, ...)
10. **Employee login** — هەر cashier یەک user، یان چەند cashier لەسەر یەک session (PIN login)؟
11. **Offline mode** تا چ ئاستێک پێویستە (هەموو session offline، یان تەنها order؟)
12. **Fiscal compliance** — receipt ژمارە ڕەسمی (Iraq e-invoice)؟ QR code لەسەر پسووڵە؟
13. **Tips** فۆرماتی چۆن (درەست، ڕێژە، round-up)؟
14. **Refund policy** — same-session only یان any-time؟ Manager approval؟

---

## 🗄️ بەشی ٣: Data Model — Firestore Collections (22)

### گرووپی ١: Configuration

#### `pos_configs` — ڕێکخستنی POS (هەر shop یەک config)
```
id: string
name: string
company_id: string (FK)
branch_id: string (FK)
mode: 'shop' | 'restaurant' | 'bar'
is_active: boolean
# Session
opening_cash: number
closing_control: boolean
# Products
available_category_ids: string[]
limit_categories: boolean
restrict_price_control: boolean
# Payment methods
payment_method_ids: string[] (FK pos_payment_methods)
# Receipt
receipt_header: string (ml: ckb/en)
receipt_footer: string
auto_print_receipt: boolean
# Restaurant
floor_ids: string[] (FK pos_floors)
is_tip_enabled: boolean
tip_product_id: string
# Self-order
self_order_enabled: boolean
self_order_pay_after: 'each' | 'meal'
# Preparation
preparation_display_ids: string[]
# Loyalty
loyalty_program_ids: string[]
# Pricelist
pricelist_id: string
available_pricelist_ids: string[]
# Fiscal
iraq_vat_enabled: boolean
invoice_journal_id: string
# Hardware
use_barcode: boolean
scale_product_id: string
iot_box_ip: string
customer_display_enabled: boolean
# Timestamps
created_at, updated_at, created_by, updated_by
```

#### `pos_payment_methods` — ڕێگەی پارەدان
```
id, name (ml), company_id
type: 'cash' | 'bank' | 'card' | 'qr' | 'customer_credit' | 'gift_card' | 'loyalty'
journal_id: string (FK accounting)
is_cash_count: boolean
use_payment_terminal: 'none' | 'adyen' | 'stripe' | 'custom'
qr_code_config: { bank_name, account, ... }
is_active: boolean
```

### گرووپی ٢: Sessions & Orders

#### `pos_sessions` — دانیشتنی کاری (هەر ڕۆژ یەک)
```
id, config_id, user_id (cashier), company_id
state: 'opening_control' | 'opened' | 'closing_control' | 'closed'
start_at: timestamp
stop_at: timestamp
# Cash
cash_register_balance_start: number
cash_register_balance_end_real: number
cash_register_total_entry_encoding: number
cash_register_difference: number
# Stats
order_count: number
total_sales: number
total_payments: number
total_tax: number
# Accounting
move_id: string (FK journal entry)
is_in_company_currency: boolean
note: string
closing_notes: string
```

#### `pos_orders` — داواکاری
```
id, session_id, config_id, name (POS/0001)
pos_reference: string
tracking_number: string (for receipt)
date_order: timestamp
state: 'draft' | 'paid' | 'invoiced' | 'done' | 'cancel' | 'refunded'
partner_id: string (FK contact, nullable)
employee_id: string (cashier)
# Amounts
amount_tax: number
amount_total: number
amount_paid: number
amount_return: number
amount_subtotal: number
# Restaurant
table_id: string (FK)
floor_id: string (FK)
customer_count: number
# Fiscal
is_invoiced: boolean
invoice_id: string
fiscal_position_id: string
# Shop
shipping_date: date (for "ship later")
picking_id: string (inventory)
# Loyalty
loyalty_points_earned: number
loyalty_points_used: number
coupon_codes: string[]
# Pricelist
pricelist_id: string
# Refund
refunded_order_id: string
refund_reason: string
# Preset
preset_id: string
# Meta
note: string
offline_ref: string (for sync)
created_at, updated_at
```

#### `pos_order_lines` — هێڵی داواکاری
```
id, order_id, product_id, variant_id
name: string, qty: number
price_unit: number
discount: number (%)
tax_ids: string[]
price_subtotal: number
price_subtotal_incl: number
# Combo
combo_parent_line_id: string
combo_item_ids: string[]
# Restaurant
preparation_state: 'pending' | 'preparing' | 'ready' | 'served'
preparation_display_id: string
course_id: string  # entrée, main, dessert
note: string (customer requests)
# Serial/lot
lot_ids: string[]
# Weight (scale)
is_weighted: boolean
# Refund
refunded_qty: number
refunded_orderline_id: string
# Customer note
customer_note: string
```

#### `pos_payments` — پارەدانی order
```
id, order_id, session_id
payment_method_id, amount
card_type, transaction_id
payment_date: timestamp
# Customer credit
partner_id
# QR
qr_reference
# Gift card
gift_card_id
```

### گرووپی ٣: Products & Pricing

#### `pos_categories` — پۆلی POS (hierarchical)
```
id, name (ml), parent_id, sequence
image_url: string
color: string (hex — بۆ UI)
company_id
pos_config_ids: string[] (کامە POS)
```

#### `pos_combos` — کۆمبۆ (Meal deal)
```
id, name (ml), base_price
combo_line_ids: [{ product_id, extra_price, qty }]
company_id
```

#### `pos_pricelists` — لیستی نرخ
```
id, name (ml), currency_id
item_ids: [{ product_id | category_id, min_qty, fixed_price, discount_percent, date_start, date_end }]
is_active, company_id
```

#### `pos_presets` — پرێسێتی پێشوەختە
```
id, name (ml)  # "Dine in", "Takeaway", "Delivery"
pricelist_id, fiscal_position_id
identification: 'none' | 'address' | 'name'
use_timing: boolean
default_slot_minutes: number
image_url
```

### گرووپی ٤: Restaurant

#### `pos_floors` — نهۆم
```
id, name (ml), background_image, background_color
config_id, sequence
```

#### `pos_tables` — مێز
```
id, floor_id, name (T1, T2, ...)
shape: 'square' | 'round' | 'rectangle'
position_h, position_v, width, height
seats: number
color: string
state: 'available' | 'occupied' | 'reserved' | 'cleaning'
active_order_id: string
```

#### `pos_preparation_displays` — سکرینی چێشتخانە
```
id, name (ml), config_id
category_ids: string[]  # کامە کاتەگۆری دەنێرێت
stage_ids: [{ name, color, sequence }]  # To do, Ready, ...
```

#### `pos_preparation_orders` — لاگی preparation
```
id, order_id, order_line_id
display_id, stage, started_at, completed_at
chef_user_id
```

### گرووپی ٥: Extra Features

#### `pos_employees` — کارمەندی POS (PIN login)
```
id, user_id | employee_id
pin_code: string (hashed)
barcode: string
config_ids: string[]
role: 'cashier' | 'manager' | 'waiter'
is_active
```

#### `pos_self_orders` — self-order (kiosk)
```
id, config_id, preset_id, table_id
state, order_id (after checkout)
customer_name, customer_phone
created_at
```

#### `pos_loyalty_programs` — loyalty
```
id, name (ml), program_type: 'loyalty' | 'coupons' | 'gift_card' | 'ewallet' | 'promotion'
point_ratio, min_amount
rule_ids: [{ product_ids, min_qty, points }]
reward_ids: [{ type: 'discount'|'product'|'free_shipping', discount_percent, product_id, points_cost }]
date_from, date_to
applies_on: 'current' | 'future' | 'both'
```

#### `pos_loyalty_cards` — کارتی loyalty
```
id, program_id, partner_id, code
points_balance, expiration_date
```

#### `pos_gift_cards` — کارتی دیاری
```
id, code, initial_value, current_value
partner_id, expiration_date, is_active
```

### گرووپی ٦: Hardware & Misc

#### `pos_receipts_log` — لاگی پسووڵە
```
id, order_id, printed_at, sent_email_to, printer_name
```

#### `pos_cash_moves` — جوڵاندنی پارە (cash in/out)
```
id, session_id, type: 'in' | 'out'
amount, reason, user_id, created_at
```

#### `pos_customer_displays` — customer display config
```
id, config_id, device_id, display_mode: 'order' | 'ad' | 'mixed'
ad_content_ids: string[]
```

#### `pos_electronic_labels` — ESL
```
id, product_id, label_device_id, last_synced_at
```

---

## 🔌 بەشی ٤: API Endpoints (~95 endpoint)

### Base path: `/api/pos`

### A. Configs (8 endpoints)
```
GET    /configs                    — لیست
POST   /configs                    — دروستکردن
GET    /configs/{id}               — وردەکاری
PUT    /configs/{id}               — نوێکردنەوە
DELETE /configs/{id}               — سڕینەوە
POST   /configs/{id}/clone         — کۆپی
POST   /configs/{id}/activate      — چالاککردن
GET    /configs/{id}/available     — ئامادە بوون بۆ session
```

### B. Sessions (10)
```
GET    /sessions
GET    /sessions/{id}
POST   /sessions/open              — { config_id, opening_cash }
POST   /sessions/{id}/close        — { closing_cash, notes }
POST   /sessions/{id}/cash-in      — { amount, reason }
POST   /sessions/{id}/cash-out
GET    /sessions/{id}/summary      — statement بۆ کۆتایی
GET    /sessions/{id}/orders
GET    /sessions/{id}/payments
POST   /sessions/{id}/force-close  — admin only
```

### C. Orders (14)
```
GET    /orders
GET    /orders/{id}
POST   /orders                     — دروستکردن (draft)
PUT    /orders/{id}                — نوێکردنەوە (lines, customer)
POST   /orders/{id}/pay            — { payments: [{method_id, amount}] }
POST   /orders/{id}/invoice        — دروستکردنی فاکتوور
POST   /orders/{id}/refund         — { lines, reason }
POST   /orders/{id}/cancel
POST   /orders/{id}/send-receipt   — { email | phone (WhatsApp) }
POST   /orders/{id}/print-receipt
POST   /orders/sync                — bulk offline sync
POST   /orders/draft               — save quotation
GET    /orders/search?q=           — barcode/name/phone
POST   /orders/{id}/ship-later     — { shipping_date, address }
```

### D. Payment Methods (5)
```
GET    /payment-methods
POST   /payment-methods
PUT    /payment-methods/{id}
DELETE /payment-methods/{id}
POST   /payment-methods/{id}/test-terminal
```

### E. Products & Categories (8)
```
GET    /categories
POST   /categories
PUT    /categories/{id}
DELETE /categories/{id}
GET    /products?config_id=&category_id=&q=
GET    /products/barcode/{code}
GET    /combos
POST   /combos
```

### F. Pricelists & Presets (8)
```
GET    /pricelists
POST   /pricelists
PUT    /pricelists/{id}
DELETE /pricelists/{id}
GET    /presets
POST   /presets
PUT    /presets/{id}
DELETE /presets/{id}
```

### G. Restaurant — Floors & Tables (10)
```
GET    /floors
POST   /floors
PUT    /floors/{id}
DELETE /floors/{id}
GET    /floors/{id}/tables
POST   /tables
PUT    /tables/{id}
DELETE /tables/{id}
POST   /tables/{id}/occupy         — { order_id }
POST   /tables/{id}/free
```

### H. Preparation Display (6)
```
GET    /preparation/displays
POST   /preparation/displays
PUT    /preparation/displays/{id}
GET    /preparation/displays/{id}/orders   — realtime queue
POST   /preparation/orders/{id}/stage      — { stage }
POST   /preparation/orders/{id}/complete
```

### I. Employees / PIN login (5)
```
GET    /employees
POST   /employees
PUT    /employees/{id}
POST   /employees/login            — { pin }
POST   /employees/logout
```

### J. Self-order (5)
```
POST   /self-order/start           — { config_id, preset_id, table_id? }
POST   /self-order/{id}/items
POST   /self-order/{id}/submit
POST   /self-order/{id}/pay
GET    /self-order/menu?config_id=
```

### K. Loyalty & Gift cards (10)
```
GET    /loyalty/programs
POST   /loyalty/programs
PUT    /loyalty/programs/{id}
GET    /loyalty/cards?partner_id=
POST   /loyalty/cards
POST   /loyalty/cards/{code}/redeem
GET    /gift-cards/{code}
POST   /gift-cards
POST   /gift-cards/{code}/activate
POST   /gift-cards/{code}/charge
```

### L. Hardware (6)
```
POST   /hardware/print-receipt
POST   /hardware/open-cash-drawer
POST   /hardware/scale-read
GET    /hardware/customer-display/{id}
POST   /hardware/customer-display/{id}/update
POST   /hardware/iot/status
```

### M. Reports (6)
```
GET    /reports/dashboard?date_from=&date_to=
GET    /reports/sales-by-product
GET    /reports/sales-by-category
GET    /reports/sales-by-cashier
GET    /reports/sessions-summary
GET    /reports/hourly-heatmap
```

### N. Integration hooks (internal)
```
POST   /hooks/accounting/post-session   — create journal entry
POST   /hooks/inventory/pick-order      — deduct stock
POST   /hooks/iraq/einvoice             — fiscal submission
```

---

## 📄 بەشی ٥: Frontend Pages (18 page)

### Route base: `/pos`

| # | Route | ناو | جۆر | Effort | وەسف |
|---|---|---|---|---|---|
| 1 | `/pos` | POS Hub / Chooser | protected | S | هەڵبژاردنی config + cashier |
| 2 | `/pos/terminal/:sessionId` | **POS Terminal** | protected | XL | UI سەرەکی touch-friendly (split-screen: cart + products) |
| 3 | `/pos/configs` | Configs list | admin | M | CRUD |
| 4 | `/pos/configs/:id` | Config form | admin | L | tabs: general, products, payment, restaurant, hardware |
| 5 | `/pos/sessions` | Sessions list | protected | M | filter by config/state/date |
| 6 | `/pos/sessions/:id` | Session detail | protected | M | summary + cash count + close |
| 7 | `/pos/orders` | Orders history | protected | M | search, filter, refund |
| 8 | `/pos/orders/:id` | Order detail + receipt | protected | S | reprint, email, refund |
| 9 | `/pos/floors` | Floors & tables editor | admin | L | drag-drop designer |
| 10 | `/pos/floor-plan/:configId` | Live floor view | protected | L | realtime table state → tap to open order |
| 11 | `/pos/kitchen/:displayId` | Preparation Display (KDS) | protected | L | fullscreen, auto-refresh, color stages |
| 12 | `/pos/self-order/:configId` | Self-order Kiosk | public | XL | fullscreen tablet UI |
| 13 | `/pos/customer-display/:configId` | Customer Display (dual screen) | public | M | order mirror + ads |
| 14 | `/pos/products` | POS product catalog | admin | M | filter by POS category |
| 15 | `/pos/pricelists` | Pricelists | admin | M | CRUD + rules |
| 16 | `/pos/loyalty` | Loyalty programs | admin | M | CRUD |
| 17 | `/pos/gift-cards` | Gift cards | admin | M | generate batch, track |
| 18 | `/pos/reports` | Reports dashboard | protected | L | charts + export PDF/Excel |

---

## 🖥️ بەشی ٦: POS Terminal Wireframe (بەشی گرنگترین)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Burger] Session #42 | Cashier: Ahmed | 🕐 14:32 | 🌙 | EN/KU | [x]  │
├──────────────────────────────┬───────────────────────────────────────┤
│   CART (left, 40%)           │   PRODUCTS GRID (right, 60%)          │
│  ┌────────────────────────┐  │  ┌─────────────────────────────────┐  │
│  │ Order #POS/0043        │  │  │ [🔍 Search / Barcode]  [Scan] │  │
│  │ Table: T5 | 4 guests   │  │  ├─────────────────────────────────┤  │
│  │ Customer: [+Add]       │  │  │ Categories: ┃All┃Food┃Drink┃..│  │
│  ├────────────────────────┤  │  ├─────────────────────────────────┤  │
│  │ 2x Burger      10,000  │  │  │ [🍔]    [🍕]    [🥤]    [🍰] │  │
│  │   └ no onion           │  │  │ Burger  Pizza   Cola    Cake  │  │
│  │ 1x Cola         2,000  │  │  │ 5,000   8,000   2,000   3,000 │  │
│  │ 1x Cake         3,000  │  │  │                               │  │
│  ├────────────────────────┤  │  │ [🍟]    [☕]    [🥗]   [+more]│  │
│  │ Subtotal     15,000    │  │  │ Fries   Coffee  Salad         │  │
│  │ Tax (0%)         0    │  │  └─────────────────────────────────┘  │
│  │ Discount         0    │  │                                       │
│  │ TOTAL        15,000   │  │  ┌─ Numeric Keypad ─────────────────┐ │
│  └────────────────────────┘  │  │ [Qty] [Disc] [Price] [Note]     │ │
│                              │  │  7  8  9   [Customer]            │ │
│  Actions:                    │  │  4  5  6   [Pricelist]           │ │
│  [🎁 Reward] [🧾 Invoice]    │  │  1  2  3   [Refund]              │ │
│  [💾 Save] [🔄 Refund]       │  │  0  .  ⌫   [Preset]              │ │
│  [✂ Split]  [🍽 Course]      │  └──────────────────────────────────┘ │
│                              │                                       │
│  ┌────────────────────────┐  │  🟢 Online | 📴 IndexedDB: 0 queued  │
│  │    💳 PAYMENT          │  │                                       │
│  └────────────────────────┘  │                                       │
└──────────────────────────────┴───────────────────────────────────────┘
```

**Payment modal:**
```
┌─ Payment — Total: 15,000 IQD ─────────────┐
│  [💵 Cash]  [💳 Card]  [📱 QR]  [🎁 Gift] │
│  ┌──────────────────────────────────────┐  │
│  │ Cash: 20,000                         │  │
│  │ Change: 5,000                        │  │
│  └──────────────────────────────────────┘  │
│  Tip: [___] [10%] [15%] [20%]              │
│  Customer email / phone: [_______]         │
│                                             │
│  [Cancel]         [✓ Validate & Print]      │
└─────────────────────────────────────────────┘
```

---

## 🧩 بەشی ٧: کۆمپۆنێنتەکان (~60)

### Terminal (سەرەکی)
`<POSTerminal>`, `<POSCart>`, `<POSCartLine>`, `<POSProductsGrid>`, `<POSProductCard>`, `<POSCategoryTabs>`, `<POSSearchBar>`, `<POSNumpad>`, `<POSActionBar>`, `<POSPaymentModal>`, `<POSPaymentMethodButton>`, `<POSReceiptPreview>`, `<POSCustomerSelector>`, `<POSPricelistSelector>`, `<POSPresetSelector>`, `<POSTipSelector>`, `<POSSplitBillModal>`, `<POSCourseSelector>`, `<POSComboSelector>`, `<POSLotSerialModal>`, `<POSDiscountModal>`, `<POSOfflineIndicator>`, `<POSSyncQueueBadge>`

### Session
`<SessionOpenModal>`, `<SessionCloseModal>`, `<CashCountSheet>`, `<CashMoveModal>`, `<SessionSummaryCard>`

### Restaurant
`<FloorPlanEditor>` (drag-drop), `<FloorPlanView>`, `<TableShape>`, `<TableStateIndicator>`, `<PreparationDisplay>`, `<PreparationOrderCard>`, `<PreparationStageColumn>`

### Self-order
`<KioskLanding>`, `<KioskMenu>`, `<KioskCart>`, `<KioskCheckout>`, `<KioskLanguageSwitch>`, `<KioskIdleScreen>`

### Customer display
`<CustomerDisplayOrder>`, `<CustomerDisplayAd>`

### Admin
`<POSConfigForm>` (tabs), `<PaymentMethodForm>`, `<PricelistForm>`, `<LoyaltyProgramForm>`, `<GiftCardBatchForm>`, `<PresetForm>`, `<CategoryTreeEditor>`

### Reports
`<POSDashboard>`, `<SalesChart>`, `<TopProductsTable>`, `<HourlyHeatmap>`, `<CashierPerformance>`

### Shared
`<ReceiptTemplate80mm>`, `<BarcodeScanner>` (HID keyboard + WebUSB), `<PINPad>`, `<TouchNumericInput>`, `<VirtualKeyboard>`

---

## 🏪 بەشی ٨: Zustand Stores (5)

### `usePOSSessionStore` (persist: بەڵێ)
- state: `currentSession`, `currentConfig`, `cashier`, `isOpen`
- actions: `openSession`, `closeSession`, `switchCashier`

### `usePOSCartStore` (persist: بەڵێ — IndexedDB)
- state: `currentOrder`, `lines[]`, `customer`, `table`, `preset`, `pricelist`, `discount`, `selectedLineId`
- actions: `addLine`, `updateLine`, `removeLine`, `setQty`, `setDiscount`, `setCustomer`, `setTable`, `clearCart`, `applyPricelist`

### `usePOSOfflineStore` (persist: بەڵێ)
- state: `syncQueue[]`, `isOnline`, `lastSyncAt`, `cachedProducts`, `cachedCustomers`
- actions: `enqueueOrder`, `syncAll`, `refreshCache`

### `usePOSFloorStore`
- state: `floors`, `tables`, `activeFloorId`, `tableStates`
- actions: `loadFloors`, `updateTableState` (realtime subscribe)

### `usePOSHardwareStore`
- state: `printer`, `scanner`, `scale`, `drawer`, `customerDisplay`
- actions: `connectPrinter`, `print`, `openDrawer`, `readScale`

---

## 🌐 بەشی ٩: i18n Keys (~350 — namespace: `pos`)

گرووپەکان:
- `pos.terminal.*` (40) — cart, payment, numpad, actions
- `pos.session.*` (25) — open/close/cash
- `pos.order.*` (30) — states, refund, invoice
- `pos.config.*` (40) — tabs, fields
- `pos.product.*` (15)
- `pos.payment.*` (25) — methods, terminal, QR
- `pos.restaurant.*` (35) — floors, tables, courses, tips
- `pos.preparation.*` (20) — KDS stages
- `pos.self_order.*` (25) — kiosk
- `pos.loyalty.*` (20)
- `pos.reports.*` (25)
- `pos.receipt.*` (20) — header, footer, items
- `pos.hardware.*` (15)
- `pos.errors.*` (15)

---

## 🔗 بەشی ١٠: پەیوەندی لەگەڵ مۆدیولەکانی تر

| مۆدیول | پەیوەندی |
|---|---|
| **Accounting** | لە کاتی `close session` → auto-create journal entry (sales, tax, cash, card clearing). Invoice creation لە `pos_orders.invoice`. |
| **Inventory** | لە `pay order` → create `stock.picking` (outgoing) → کەمکردنی qty. Lot/serial tracking لە `pos_order_lines.lot_ids`. |
| **Contacts** | `partner_id` لە order. Auto-create لە self-order (name/phone). Loyalty card linked to partner. |
| **HR** | `employee_id` = cashier/waiter. PIN login لە `pos_employees`. Shift hours = session duration. |
| **CRM / Loyalty** | `pos_loyalty_programs` shared with e-commerce. Points earned/redeemed sync to customer profile. |
| **Iraq Localization** | IQD currency (decimals=0), VAT computation, Arabic/Kurdish receipt, e-invoice QR code. |
| **Sales** | POS invoice convertible to regular SO. Quotation from POS → Sale order (ship later). |
| **Purchase** | کۆگا کەمبوو → auto-suggest reorder (via Inventory). |
| **Reports (BI)** | POS KPIs feed into main ERP dashboard. |
| **Notifications** | SMS/WhatsApp receipt send. Low-stock alerts. Session close alert to manager. |
| **RBAC** | Roles: `pos_user`, `pos_manager`, `pos_admin`. Permissions: refund (manager), discount > 10% (manager), force-close (admin). |
| **Audit** | هەموو action ی POS لاگ دەکرێت (open/close, refund, discount, price override). |

---

## 🚀 بەشی ١١: Sprint Breakdown (6 sub-sprints)

### 🏁 Sprint 6.1 — Core POS (٥ ڕۆژ) — **XL**
**ئامانج:** فرۆشتنی سادە لە کاونتەر کار بکات.
- Collections: `pos_configs`, `pos_payment_methods`, `pos_sessions`, `pos_orders`, `pos_order_lines`, `pos_payments`, `pos_cash_moves`
- Endpoints: Configs (8) + Sessions (10) + Orders core (10) + Payment methods (5) = **33**
- Pages: `/pos`, `/pos/terminal`, `/pos/sessions`, `/pos/sessions/:id`, `/pos/orders`, `/pos/configs` (basic) = **6 pages**
- Stores: `usePOSSessionStore`, `usePOSCartStore`
- Receipt: `<ReceiptTemplate80mm>` + browser print
- Integration: Accounting journal entry on close, Inventory picking on pay
- ✅ چەکلیست: auth, RBAC, offline cart (IndexedDB persist), Kurdish RTL

### 🛍️ Sprint 6.2 — Products, Pricing, Pricelists (٣ ڕۆژ) — **L**
- Collections: `pos_categories`, `pos_combos`, `pos_pricelists`, `pos_presets`
- Endpoints: Products/categories (8) + Pricelists/presets (8) = **16**
- Pages: `/pos/products`, `/pos/pricelists`, `/pos/configs/:id` (full tabs)
- Components: `<CategoryTreeEditor>`, `<POSComboSelector>`, `<POSPresetSelector>`
- Discount rules + pricelist resolver (Python-side)

### 🏷️ Sprint 6.3 — Shop features (٣ ڕۆژ) — **M**
- Barcode scanning (HID keyboard emulation + WebUSB fallback)
- Quotations from POS (draft orders)
- "Ship later" → integrate with Sales/Inventory
- Customer search + quick create
- Endpoints: ~6 additional (draft, search, ship-later, barcode)
- Components: `<BarcodeScanner>`, `<POSCustomerSelector>` (quick create)

### 🍽️ Sprint 6.4 — Restaurant (٤ ڕۆژ) — **XL**
- Collections: `pos_floors`, `pos_tables`, `pos_preparation_displays`, `pos_preparation_orders`
- Endpoints: Floors/tables (10) + Preparation (6) = **16**
- Pages: `/pos/floors`, `/pos/floor-plan/:id`, `/pos/kitchen/:id`
- Features: split bill, course management, tips, customer count, table transfer
- Realtime: Firestore onSnapshot for table state + KDS
- Stores: `usePOSFloorStore`

### 🎁 Sprint 6.5 — Extra (employee login, self-order, loyalty) (٤ ڕۆژ) — **XL**
- Collections: `pos_employees`, `pos_self_orders`, `pos_loyalty_programs`, `pos_loyalty_cards`, `pos_gift_cards`
- Endpoints: Employees (5) + Self-order (5) + Loyalty/gift (10) = **20**
- Pages: `/pos/self-order/:configId`, `/pos/loyalty`, `/pos/gift-cards`
- PIN login, kiosk mode (fullscreen, idle timeout), gift card QR

### 🖨️ Sprint 6.6 — Hardware + Reports + Iraq fiscal (٣ ڕۆژ) — **L**
- Endpoints: Hardware (6) + Reports (6) + Hooks (3) = **15**
- Pages: `/pos/customer-display/:id`, `/pos/reports`
- Hardware: WebUSB printer, WebSerial scale, cash drawer pulse, IoT box bridge
- Customer display (dual monitor API / secondary window)
- Electronic labels sync
- Reports: daily dashboard, top products, hourly heatmap, cashier performance
- Iraq e-invoice QR code on receipt, VAT summary
- Export: PDF/Excel reports

---

## ✅ بەشی ١٢: چەکلیستی کۆتایی

```
□ Auth + RBAC (pos_user/manager/admin)
□ Admin panel: configs, pricelists, loyalty, payment methods
□ Error pages (404/500) ✓ (موجوود)
□ Loading skeletons بۆ product grid + order list
□ Empty states (no sessions, no products, no orders, empty cart)
□ Search + Filters + Pagination لە orders/sessions
□ Dark mode ✓ (Sprint 1)
□ Touch-friendly (buttons ≥ 48px, gestures)
□ RTL (Kurdish/Arabic) ✓
□ SEO — internal app, nofollow
□ Toast (success pay, error sync, warning low stock)
□ Confirmation dialogs (delete config, refund, force close, void order)
□ Email/WhatsApp receipt
□ Environment vars: IOT_BOX_URL, ADYEN_KEY, STRIPE_KEY, IRAQ_EINVOICE_URL
□ Offline mode (IndexedDB + sync queue + conflict resolution)
□ Realtime (Firestore onSnapshot for tables, KDS)
□ Audit trail (هەموو refund/discount/price override)
□ Backup receipt (email fallback if printer fails)
□ Session force-close protection (admin only)
□ Kiosk idle timeout + reset
□ Customer display secondary screen API
□ Barcode duplicate scan debounce
□ PIN brute-force protection (5 attempts lockout)
□ Gift card code uniqueness + QR
□ Iraq VAT + e-invoice QR
□ IQD rounding (decimals=0)
□ Multi-currency display (IQD primary, USD secondary)
□ Privacy policy link لە self-order
```

---

## 📊 بەشی ١٣: ئاماری کۆتایی

```
╔════════════════════════════════════════════════════╗
║  POINT OF SALE — FINAL STATS                       ║
╠════════════════════════════════════════════════════╣
║  Collections:        22                             ║
║  API Endpoints:      95                             ║
║  Frontend Pages:     18                             ║
║  Components:         ~60                            ║
║  Zustand Stores:     5                              ║
║  i18n Keys:          ~350 (ckb + en)                ║
║  Sub-Sprints:        6 (22 ڕۆژ کاری بە کۆ)         ║
║  Effort:             XL (2 XL + 2 L + 1 M + 1 L)    ║
║  Module Dependencies: 10+                           ║
╚════════════════════════════════════════════════════╝
```

---

## 🎯 ترتیبی جێبەجێکردن (بۆ ERP POS ئەیگێنت)

1. **ئەوەڵ** → پرسیارەکانی بەشی ٢ وەڵام بدە (user input)
2. **دووەم** → Sprint 6.1 (Core) — پێویستە پێش هەموو شتێک
3. **سێیەم** → Sprint 6.2 (Products) — بنەمای فرۆشتن
4. **چوارەم** → هەڵبژاردنی لقی Retail یان Restaurant:
   - Retail → Sprint 6.3 → 6.5 → 6.6
   - Restaurant → Sprint 6.4 → 6.5 → 6.6
   - هەردووک → 6.3 + 6.4 parallel، پاشان 6.5 و 6.6
5. **کۆتایی** → integration testing + Iraq fiscal compliance + hardware pairing

---

> ✍️ ئەم پلانە ئامادەیە بۆ شادۆ مێشک (ERP POS agent). هەر sub-sprint دەتوانرێت سەربەخۆ بنێردرێت بە ئاگاداری لە dependency ـەکان.  
> 📌 **هەنگاوی دواتر:** تکایە ١٤ پرسیاری بەشی ٢ وەڵام بدە تا پلانەکە بۆ بازرگانی تایبەتی تۆ fine-tune بکرێت.