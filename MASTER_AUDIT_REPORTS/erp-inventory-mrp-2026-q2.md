# Inventory + MRP Audit — 2026-Q2
**Agent:** ERP Inventory + MRP | **Date:** 2026-04-24

## A. Coverage Snapshot

| Reference | Coverage % | Notes |
|-----------|-----------|-------|
| Odoo 19   | ~45%      | Core stock/transfers/MO هەیە، Routes/Putaway/Quality/Subcontracting/MPS/Unbuild نییە |
| Zoho Inventory | ~55% | Items/warehouses/transfers ئامادە، Variants/Composite-SO-integration/Price-list-assignment ناتەواو |

| Domain | Backend | Frontend | Coverage |
|--------|---------|----------|----------|
| Items | CRUD | ✅ Items.tsx | 70% |
| Warehouses | API | ✅ | 50% |
| Stock Moves | GET only | ❌ | 30% |
| Adjustments | API | ✅ | 60% |
| Transfers | API | ✅ partial | 55% |
| Lots/Serials | API | ❌ | 25% |
| BOM | API | ❌ | 60% |
| Work Centers | API | ❌ | 50% |
| MO | API | ❌ | 65% |
| Work Orders | API | ❌ | 50% |
| Shipments | API | ❌ | 40% |
| Returns | API | ❌ | 45% |
| Quality | ❌ | ❌ | 0% |
| Barcode | lookup only | ❌ | 10% |

## B. Top P0/P1 Gaps (max 10)

| ID | Severity | Title | File(s) | Odoo ref | Zoho ref | Effort |
|----|----------|-------|---------|----------|----------|--------|
| G-1 | P0 | No Manufacturing UI pages | frontend/src/pages | — | — | L |
| G-2 | P0 | No Stock Valuation Accounting (auto JE on moves) | backend/app/api/inventory.py:L231 | (mode instructions) DR Stock-target / CR Stock-source | — | L |
| G-3 | P0 | No Picking Flow (draft→ready→done states) | backend/app/api/shipments.py | applications/inventory_and_mrp/inventory/warehouses_storage/reporting/moves_history.rst:L86 | Picklist | L |
| G-4 | P1 | No MRP Scheduler (auto-reorder، demand calc) | new | applications/inventory_and_mrp/manufacturing/workflows/use_mps.rst:L52 | — | L |
| G-5 | P1 | No Barcode App (operations، not just lookup) | backend + new mobile UI | applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/use_locations.rst:L60 | Mobile App | L |
| G-6 | P1 | No Quality module (points + checks) | new | (mode instructions) quality_points، quality_checks | — | L |
| G-7 | P1 | No Routes / Push-Pull rules | new | applications/inventory_and_mrp/inventory/warehouses_storage/replenishment/resupply_warehouses.rst:L71 | — | L |
| G-8 | P1 | No Locations (sub-warehouse shelf/bin) | backend/app/firestore/inventory.py:L25 | warehouses_storage/inventory_management/use_locations.rst | — | M |
| G-9 | P1 | No Putaway/Removal strategies (FIFO/LIFO/FEFO) | new | inventory_valuation/cheat_sheet.rst:L144 | — | M |
| G-10| P1 | No Inventory Count workflow (scheduled cycle counts) | inventory.py:L141 | warehouses_storage/inventory_management/count_products.rst:L15 | Inventory Count | M |

## C. Quick Wins

- QW-1: By-products on BOM — manufacturing.py:L26 BOMCreate.byproducts list — 1d
- QW-2: Transfer Orders approval status — inventory.py:L298 — 1d
- QW-3: Item images URL field — schemas.py ItemCreate.image_url — 1d
- QW-4: MO Backorders (partial production) — manufacturing.py:L223 done_order — 2d
- QW-5: Stock Moves POST + validate (not just GET) — inventory.py:L231 — 2d
- QW-6: Operation Types (Receipt/Delivery/Internal) — new — 2d
- QW-7: Packages CRUD — system.py:ShipmentRepository normalize — 2d
- QW-8: Lot traceability endpoint — inventory.py:L240 GET /lots/{id}/traceability — 2d
- QW-9: Landed Costs API (repo exists) — backend/app/api/inventory.py — 2d
- QW-10: Scrap endpoint — inventory.py — 2d
- QW-11: MO Scrap — manufacturing.py — 2d
- QW-12: MO Split/Merge — manufacturing.py — 2d
- QW-13: Routings normalization — manufacturing.py:L34 — 2d
- QW-14: Composite item SO auto-consume — backend/app/services + sales_orders.py — 2d
- QW-15: Price list assignment to contacts/dates — firestore/inventory.py:L59 — 2d

## D. Big Rocks

- BR-1: Manufacturing UI (BOM، MO، WO، Work Centers pages) — 5d
- BR-2: Stock Valuation Service (auto JE، FIFO/Average) — services/inventory_valuation.py:new — 4d
- BR-3: Picking Flow (state machine، validate، backorder) — 4d
- BR-4: MRP Scheduler — services/mrp_scheduler.py:new — 5d
- BR-5: Barcode App suite (mobile UI، scan flow، operations) — 5d
- BR-6: Quality module (points + checks + block shipment) — 5d
- BR-7: Routes/Push-Pull rules + scheduler — 5d
- BR-8: Subcontracting (BOM type=subcontract → vendor PO) — 4d
- BR-9: Item Variants (attributes، auto-SKU matrix) — 4d
- BR-10: Locations (sub-warehouse) + Putaway/Removal — 6d

## E. Odoo Features Missing (with section paths)

### Inventory
- warehouses_storage/inventory_management/use_locations.rst — multi-level locations
- shipping_receiving/reservation_methods.rst — operation types
- warehouses_storage/replenishment/resupply_warehouses.rst — routes/rules
- warehouses_storage/inventory_management/count_products.rst — cycle counts
- inventory_valuation/landed_costs.rst — landed costs allocation
- inventory_valuation/scrapped_inventory_valuation.rst — scrap with accounting

### Manufacturing
- workflows/byproducts.rst — co-products
- workflows/manufacturing_backorders.rst — partial production
- workflows/scrap_manufacturing.rst — scrap during MO
- workflows/unbuild_orders.rst — disassembly
- workflows/split_merge.rst — MO split/merge
- workflows/work_center_time_off.rst — calendar + downtime
- workflows/use_mps.rst — Master Production Schedule
- subcontracting/ — outsourcing operations
- basic_setup/mo_costs.rst — labor + overhead in MO cost
- shop_floor/ — tablet view for operators

## F. Zoho Inventory Features Missing

- Composite items auto-decrement on SO (API exists، logic missing)
- Transfer orders pending approval workflow
- Item images
- Item variants (size/color → auto-SKU)
- Customer-specific price lists
- Date-range price lists
- Picklist generation per shipment
- Multi-package shipments
- LTL/FTL shipping management

## G. Counts
- P0: 3 | P1: 7 | P2: ~10 | QW: 15 | BR: 10
- Total effort: ~110d (22 weeks @ 1 dev for 100% Odoo + Zoho parity)

## H. Recommended Lead + Skills

**Lead:** ERP Inventory + MRP | **Support:** زۆهۆ ئەکاونتینگ (valuation JE)، زۆهۆ فرۆنتئێند

**Skills:**
- backend/firestore-patterns
- backend/api-design-fastapi
- backend/python-patterns (state machines)
- frontend/react19-patterns
- frontend/antd-rtl-patterns

**Sprint Plan:**
- Sprint A (P0): Manufacturing UI + Stock Valuation Accounting + Picking Flow — 13d
- Sprint B (P1): MRP Scheduler + Barcode App + Quality + Routes — 20d
- Sprint C (P2): Subcontracting + Variants + Locations + MO Costs + Unbuild — 21d
- Sprint D (P3+): Long tail — 56d

**Critical Path:** Stock Valuation Accounting (BR-2) → Manufacturing Accounting (BR-2 ext) → MRP Scheduler (BR-4)
**Quick wins for sprint gaps:** By-products، Transfer Approval، Item Images (1d each)
**Architecture note:** Add services/inventory_valuation.py + services/mrp_scheduler.py — currently no inventory* in services/
