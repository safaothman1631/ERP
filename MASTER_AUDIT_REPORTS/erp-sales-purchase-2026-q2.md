# Sales + Purchase Audit — 2026-Q2
**Agent:** ERP Sales + Purchase | **Date:** 2026-04-24

## A. Coverage Snapshot

| Reference | Coverage % | Notes |
|-----------|-----------|-------|
| Odoo 19   | ~50%      | CRUD ئامادە، workflows (RFQ، Receipts، 3-way match، Delivery Orders، Drop-ship) نییە |
| Zoho Books/Inventory | ~55% | quote-to-cash basic، Blanket Orders + Vendor pricelist + Commissions نییە |

### Backend Endpoint Counts
| File | Endpoints | Status |
|------|-----------|--------|
| sales_orders.py | 3 | ✅ basic CRUD |
| quotes.py | 3 | ✅ CRUD + PDF |
| purchase_orders.py | 4 | ✅ CRUD + PDF |
| vendor_credits.py | 3 | ✅ basic CRUD |
| recurring_invoices.py | 3 | ⚠️ basic only |
| recurring_bills.py | 7 | ⚠️ better |
| shipments.py | 11 | ⚠️ NOT Delivery Orders |

### Frontend Pages
SalesOrders، Quotes، PurchaseOrders، VendorCredits، SalesReturns، PurchaseReturns — هەموویان بنەڕەتین.

## B. Top P0/P1 Gaps (max 10)

| ID | Severity | Title | File(s) | Odoo ref | Zoho ref | Effort |
|----|----------|-------|---------|----------|----------|--------|
| G-1 | P0 | RFQ (Request for Quotation) — multi-vendor compare نییە | new module | applications/inventory_and_mrp/purchase/manage_deals/rfq.rst | RFQs | L (12h) |
| G-2 | P0 | Receipts (Goods Received) repo + workflow نییە | new | Odoo PO→Receipt→Bill | Receipts | L (14h) |
| G-3 | P0 | 3-way matching (PO + Receipt + Bill) نییە | backend/app/api/bills (new endpoint) | applications/inventory_and_mrp/purchase/manage_deals/control_bills.rst | Bill matching | M (8h) |
| G-4 | P0 | Delivery Orders integration (state machine، SO-linked، inventory-validated) نییە | backend/app/api/shipments.py rename/refactor | Odoo SO→Delivery→Validated→Done | Delivery Orders | L (16h) |
| G-5 | P0 | Quote → SO/Invoice conversion endpoint نییە | backend/app/api/quotes.py:L30 | Odoo quote→SO workflow | Estimate convert | S (3h) |
| G-6 | P0 | SO state transitions (confirm، void، convert-to-invoice) نییە | backend/app/api/sales_orders.py:L30 | Odoo SO states | SO actions | S (3h) |
| G-7 | P0 | PO state transitions (issue، cancel، convert-to-bill) نییە | backend/app/api/purchase_orders.py:L35 | Odoo PO states | PO actions | S (3h) |
| G-8 | P1 | Drop shipping (vendor → customer direct) نییە | new workflow | Odoo drop-ship | Drop-ship orders | L (10h) |
| G-9 | P1 | Blanket Orders (Purchase Agreements) نییە | new | applications/inventory_and_mrp/purchase/manage_deals/blanket_orders.rst | Recurring POs | L (10h) |
| G-10| P1 | Sales commissions (no calculation هیچ شوێن) | new | external Odoo module | Commissions | L (12h) |

## C. Quick Wins

- QW-1: Quote send/accept/decline endpoints — quotes.py:L30 — 2h
- QW-2: Quote → SO conversion — quotes.py:L30 — 3h
- QW-3: Quote → Invoice conversion — quotes.py:L30 — 2h
- QW-4: SO confirm/void/convert — sales_orders.py:L30 — 3h
- QW-5: PO issue/cancel/convert — purchase_orders.py:L35 — 3h
- QW-6: Quote expiry cron — services/recurring + quotes.py — 2h
- QW-7: Bill control policy field (on_ordered vs on_received) — schema + tax_calc — 3h
- QW-8: Vendor pricelist tab — Items.tsx + ItemRepository — 4h
- QW-9: Delivery status column لە SalesOrders.tsx — 1h
- QW-10: Receipt status column لە PurchaseOrders.tsx — 1h
- QW-11: 3-way match alert UI — Bills.tsx — 2h
- QW-12: Partial delivery split modal — 3h

## D. Big Rocks

- BR-1: RFQ module (multi-vendor، comparison table، select winner) — 12h
- BR-2: Receipts API + repo + inventory integration — 14h
- BR-3: Receipts UI page — 6h
- BR-4: Delivery Orders refactor (rename shipments.py + state machine + SO link) — 22h
- BR-5: Drop shipping workflow (routing logic، vendor direct ship) — 10h
- BR-6: Blanket Orders + UI — 14h
- BR-7: Sales commissions (rules engine + reports) — 12h
- BR-8: 3-way match logic + UI — 10h

## E. Odoo Features Missing

- sales/sales_quotations — quote workflow (send، accept، decline)
- sales/invoicing/invoicing_policy.rst — invoice_what_is_ordered vs invoice_what_is_delivered
- inventory_and_mrp/purchase/manage_deals/rfq.rst — RFQ multi-vendor
- inventory_and_mrp/purchase/manage_deals/blanket_orders.rst — recurring vendor agreements
- inventory_and_mrp/purchase/manage_deals/control_bills.rst — 3-way matching
- inventory_and_mrp/purchase/advanced/analyze.rst — procurement analytics
- Odoo SO/PO state machines (draft→confirmed→done with smart buttons)
- Odoo drop-ship route
- Odoo delivery workflow (smart button، backorders)

## F. Zoho Features Missing

- Quote-to-SO direct convert button
- SO delivery tracking smart button
- PO receipt tracking smart button
- Vendor portal (vendors view/respond to RFQs)
- Customer portal (customers view/accept quotes)
- Recurring bill template scheduling UI
- Vendor performance scorecards
- Procurement analytics dashboard

## G. Counts
- P0: 7 | P1: 3 | P2: ~5 | QW: 12 | BR: 8
- Total effort: ~174h (~22 days) for 35 gaps

## H. Recommended Lead + Skills

**Lead:** ERP Sales + Purchase | **Support:** ERP Inventory + MRP (delivery/receipts)، زۆهۆ ئەکاونتینگ (3-way match JE)

**Skills:**
- backend/api-design-fastapi (state machines)
- backend/firestore-patterns (RFQ multi-vendor schema)
- backend/python-patterns
- frontend/react19-patterns
- frontend/antd-rtl-patterns

**Sprint Priority:**
- Sprint A (5d): Workflow Foundation — Quote/SO/PO state transitions + frontend wiring + quote expiry
- Sprint B (7d): Procurement Core — RFQ + Receipts + Receipts UI
- Sprint C (6d): Delivery + Match — Delivery Orders + 3-way match
- Sprint D (4d): Advanced — Blanket Orders + Vendor pricelist

**Critical Path:** State transitions → Receipts → Delivery Orders → 3-way match
**Key risk:** Inventory integration for Delivery Orders + Receipts requires coordination with Inventory team
