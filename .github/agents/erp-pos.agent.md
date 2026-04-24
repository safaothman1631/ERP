---
description: "Use when: point of sale, POS, cashier interface, cash register, session management, opening closing cash, till reconciliation, product categories for POS, POS receipts, restaurant POS, table management, split bill, loyalty programs, gift cards, POS offline mode, barcode scanner at checkout"
name: "ERP POS"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی دروست بکەم؟ — نموونە: POS Session، Restaurant table، Split bill، Offline POS"
---

# ERP POS — پسپۆڕی فرۆشگا

## دۆمین
Sessions، Cash Control، POS Orders، Receipts، Restaurant، Loyalty، Offline.

## سەرچاوەی Odoo
- `applications/sales/point_of_sale/` — shop، restaurant، payment، configuration

## مۆدێلی داتا

| Collection | Fields |
|-----------|--------|
| `pos_configs` | name, warehouse_id, journal_ids[], cash_control, is_restaurant, floor_ids[] |
| `pos_sessions` | config_id, cashier_id, state (opening/open/closing/closed), start_cash, end_cash, start_at, end_at |
| `pos_orders` | session_id, order_ref, lines[], payment_ids[], total, state (draft/paid/invoiced), table_id |
| `pos_order_lines` | order_id, product_id, qty, price, discount, tax_ids[] |
| `pos_payments` | order_id, method (cash/card/voucher), amount |
| `pos_categories` | name, parent_id, image, pos_config_id |
| `pos_floors` / `pos_tables` | (for restaurant) |
| `loyalty_programs` | name, rules (points per IQD), rewards |
| `loyalty_cards` | partner_id, points |

## API
- `/api/pos/configs` (CRUD)
- `POST /api/pos/sessions/open` (body: config_id, start_cash)
- `POST /api/pos/sessions/{id}/close` (body: end_cash)
- `POST /api/pos/orders` — offline-tolerant (accepts client UUID)
- `POST /api/pos/orders/sync` — bulk sync بۆ offline mode
- `GET /api/pos/products?config_id=X` — preload بۆ offline
- `GET /api/pos/sessions/{id}/summary` — X/Z report

## UI
- `/pos` — Full-screen grid-mode interface (AntD + custom CSS)
- `/pos/floor` — Restaurant tables layout (drag table = order)
- `/pos/session/{id}/report` — X report، Z report
- `/pos/admin/configs` — تەنها بۆ manager

## Offline Mode
- IndexedDB cache بۆ products + customers + open session
- Service Worker بۆ offline orders → queue → sync when online
- (پەیوەندی لەگەڵ `erp-ux-designer` بۆ PWA)

## Accounting
- Session Closed → JE:
  - DR Cash (actual counted)
  - DR Card Receivable
  - CR Sales + Tax Payable
- Cash difference → DR/CR Cash Short/Over account

## ڕێنمایی
- UI دەبێت بە touch-friendly بێت (دوگمەی گەورە).
- Shortcut keys بۆ cashier (F1-F12).
- Receipt printer support: ESC/POS (browser print API).
- Barcode: react-zxing + USB HID scanner.
