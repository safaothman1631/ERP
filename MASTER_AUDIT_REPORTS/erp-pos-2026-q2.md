# POS Audit — 2026-Q2
**Agent:** ERP POS | **Date:** 2026-04-24

## A. Coverage Snapshot

| Reference | Coverage % | Notes |
|-----------|-----------|-------|
| Odoo 19 POS | ~70% | 114 endpoints + 18 pages + restaurant mode + loyalty + gift cards. Variants/booking/tickets/hardware integration nontrivial gaps. |

### Backend Counts
- **Total: 114 endpoints** (Configs 8، Sessions 10، Orders 15، Payment methods 5، Categories 4، Products 3، Combos 2، Pricelists 4، Presets 4، Floors/Tables 9، Kitchen 5، Employees 4، Self-order 4، Loyalty 6، Gift cards 5، Hardware 6، Reports 6، Hooks 3)

### Frontend Pages (18)
POSHub، POSConfigs، POSSessions، POSSessionDetail، POSTerminal، POSOrders، POSReports، POSProducts، POSCategories، POSPricelists، POSFloors، POSFloorPlan، POSKitchen، POSEmployees، POSSelfOrder، POSLoyalty، POSGiftCards، POSCustomerDisplay

### Testing
- `_pos_qa.py` covers full E2E: config → session → order → pay → close + 25+ list endpoints

## B. Top P0/P1 Gaps (max 10)

| ID | Severity | Title | File(s) | Odoo ref | Effort |
|----|----------|-------|---------|----------|--------|
| G-1 | P0 | Product variants (no multi-variant) | backend/app/api/pos.py:L1663، POSTerminal.tsx | products.rst#variants | M (3d) |
| G-2 | P0 | Fiscal positions (tax mapping) — no endpoint | new + schema | shop.rst#fiscal | M (2d) |
| G-3 | P0 | Payment terminals (Stripe/Worldline) — none | new services/pos_terminal.py | payment_methods/terminals/*.rst | L (8d) |
| G-4 | P0 | Combo pricing — data exists، no price logic in order | services/pos_pricing.py | products.rst#combos | M (2d) |
| G-5 | P0 | Offline sync — browser-only، no IndexedDB queue | POSTerminal.tsx | shop.rst#offline | M (3d) |
| G-6 | P1 | Booking system — table reservations missing | new + collection pos_bookings | restaurant.rst#booking | L (5d) |
| G-7 | P1 | Ticket parking — save-for-later orders | new + collection pos_tickets | use.rst#tickets | M (3d) |
| G-8 | P1 | IoT Box integration (stub only) | pos.py:L3930 | hardware_network/pos_iot.rst | L (5d) |
| G-9 | P1 | Bill splitting incomplete | pos.py:L2666 | restaurant.rst#bills | M (2d) |
| G-10| P1 | Stock reservation on payment missing | pos.py:L1062 + new services/pos_inventory.py | shop.rst#inventory | M (3d) |

## C. Quick Wins

- QW-1: Tips field on payment + UI input — pos.py + POSTerminal.tsx — 1d
- QW-2: Pricelist enforcement in order create — pos.py:L942 — 1d
- QW-3: Multi-session prevention per config — pos.py:L414 — 1d
- QW-4: Discount restriction enforcement (max_discount_percent) — pos.py:L942 — 0.5d
- QW-5: Cash short/over JE on session close — pos.py:L465-L543 — 1d
- QW-6: Loyalty redemption integration in payment flow — pos.py — 1d
- QW-7: Quotation import UI in POSTerminal — POSQuotationDialog component — 2d
- QW-8: Restrict categories enforcement — pos.py — 1d

## D. Big Rocks

- BR-1: Product variants (selector + auto-SKU + price matrix) — 3d
- BR-2: Payment terminal integration (Stripe SDK، transaction polling، receipt) — 8d
- BR-3: Booking system (UI overlay on POSFloorPlan + reservation logic) — 5d
- BR-4: IoT Box full integration (device registry، websocket، print queue) — 5d
- BR-5: Electronic shelf labels (Pricer API) — 5d
- BR-6: Online food delivery (UrbanPiper webhook) — 5d
- BR-7: Offline sync with IndexedDB queue + replay — 3d
- BR-8: Stock reservation + ship-later → delivery order creation — 6d

## E. Odoo Features Missing

### Configuration (shop.rst, use.rst)
- shop.rst#fiscal — fiscal position mapping
- products.rst#variants — variant handling
- products.rst#combos — combo pricing logic (data exists)
- shop.rst#so — quotation import full UI
- shop.rst#ship — ship-later inventory link
- restaurant.rst#booking — table reservations
- use.rst#tickets — ticket parking

### Operations (restaurant.rst)
- restaurant.rst#bills — complete bill splitting
- restaurant.rst#courses — course routing to printers
- restaurant.rst#tips — tip handling
- restaurant.rst#tables — table merge
- restaurant.rst#printing — printer routing per category
- restaurant/online_food_delivery.rst — UrbanPiper integration

### Hardware (hardware_network.rst)
- hardware_network/receipt_printers.rst — ESC/POS proper integration
- hardware_network/pos_iot.rst — IoT Box
- payment_methods/terminals/*.rst — payment terminals
- hardware_network/scale.rst — proper scale integration
- hardware_network/customer_display.rst — real-time sync
- hardware_network/electronic_labels.rst — Pricer integration
- hardware_network.rst — cash drawer

### Loyalty
- Coupons/vouchers
- Automatic discounts

### Reporting
- reporting.rst#analytics — Z-report formatting
- reporting.rst#analytics — X-report (mid-session)

### Integration
- CRM leads from orders
- Website online ordering

## F. Schema Extensions Needed

| Collection | Missing Fields |
|------------|----------------|
| pos_configs | iface_start_categ_id، iface_print_auto، iface_print_via_proxy، fiscal_position_ids[] |
| pos_sessions | cash_register_balance_start، cash_register_balance_end_real، cash_register_difference، rescue |
| pos_orders | fiscal_position_id، margin، pricelist_id، ticket_code، booking_id، to_invoice، to_ship |
| pos_order_lines | full_product_name، combo_parent_id، combo_line_ids[]، pack_lot_ids[] |
| pos_payments | payment_terminal_id، transaction_id، is_tip |
| pos_tables | booking_ids[] |

### New Collections
- pos_tickets، pos_bookings، pos_iot_boxes، pos_fiscal_positions، pos_printer_jobs

## G. Counts
- P0: 5 | P1: 5 | P2: ~10 | QW: 8 | BR: 8
- Total effort: ~80d for full Odoo parity

## H. Recommended Lead + Skills

**Lead:** ERP POS | **Support:** ERP Inventory + MRP (stock reservation)، زۆهۆ ئەکاونتینگ (cash JE)

**Skills:**
- backend/firestore-patterns
- backend/api-design-fastapi
- frontend/react19-patterns (POSTerminal complex state)
- frontend/antd-rtl-patterns
- testing/e2e-playwright (offline sync E2E)

**Sprint Plan:**
- Sprint A (2 weeks): Production-Critical — variants + fiscal + combo pricing + pricelist + multi-session + tips + QA
- Sprint B (2 weeks): Hardware + Inventory — payment terminal Stripe + stock reservation + IoT
- Sprint C (1.5 weeks): Restaurant Polish — bookings + tickets + bill split + table merge + printer routing
- Sprint D: Long tail — coupons + ESL + online delivery + offline IndexedDB

**Critical Path:** Variants → Fiscal positions → Payment terminal (production blocker for retail customers)
