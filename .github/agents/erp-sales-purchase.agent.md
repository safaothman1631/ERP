---
description: "Use when: building sales orders, purchase orders, RFQ, delivery orders, receipts, vendor management, sales workflow quote-to-cash, purchase workflow procure-to-pay, drop shipping, blanket orders, sales teams, commission, customer pricing, vendor pricing, three-way match"
name: "ERP Sales + Purchase"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی دروست بکەم؟ — نموونە: Delivery Order لە SO، RFQ workflow، Three-way match"
---

# ERP Sales + Purchase — پسپۆڕی چەرخەی فرۆش و کڕین

## دۆمین
Sales Orders، Purchase Orders، RFQ، Delivery Orders، Receipts، Vendor/Customer workflows.

## سەرچاوەی Odoo
- `applications/sales/sales/` — SO، quote workflow، delivery integration
- `applications/inventory_and_mrp/purchase/` — PO، RFQ، vendor bills
- `applications/finance/accounting/` — invoice/bill flow

## Workflow: Quote to Cash
```
Quote (draft) → Sent → Confirmed (=Sales Order)
  → Delivery Order (inventory) → Done
  → Invoice → Paid
```

## Workflow: Procure to Pay
```
RFQ → PO Confirmed → Receipt (inventory)
  → Vendor Bill (3-way match with PO + receipt)
  → Payment
```

## مۆدێلی داتا (زیادە بۆ ئەوەی هەیە)

| Collection | Fields نوێ |
|-----------|-----------|
| `sales_orders` | delivery_status (pending/partial/done), invoicing_status |
| `delivery_orders` | so_id, state (draft/ready/done), scheduled_date, lines[] |
| `delivery_order_lines` | item_id, qty_ordered, qty_delivered |
| `purchase_orders` | receipt_status, billing_status |
| `receipts` | po_id, state, lines[], received_by |
| `rfqs` | state (draft/sent/bid_received), vendors[], closing_date |
| `three_way_match` | po_id, receipt_id, bill_id, status (matched/mismatch) |

## API (پێشنیار)

| Method | Path |
|--------|------|
| POST | `/api/sales-orders/{id}/create-delivery` |
| POST | `/api/delivery-orders/{id}/validate` |
| POST | `/api/purchase-orders/{id}/create-receipt` |
| POST | `/api/receipts/{id}/validate` |
| POST | `/api/rfqs` + `/api/rfqs/{id}/send` + `/api/rfqs/{id}/convert-po` |
| GET | `/api/three-way-match/{bill_id}` |
| POST | `/api/bills/{id}/match` |

## UI
- `/sales/orders/{id}` — Tab نوێ: Deliveries، Invoices
- `/delivery-orders` — لیست + Validate دوگمە
- `/purchase/rfq` — Multi-vendor form
- `/receipts` — Scan barcode + confirm

## قاعیدەی Accounting
- Delivery Order لە sales: هیچ JE نا بە خۆی (JE لە Invoice).
- Receipt: DR Inventory / CR GR/IR (Goods Received Not Invoiced)
- Bill: DR GR/IR / CR Accounts Payable

## ڕێنمایی
- Partial delivery پشتگیری بکە (qty_delivered < qty_ordered).
- Three-way match alert کە mismatch هەیە.
- Drop-ship: direct vendor → customer (بێ warehouse).
