---
description: "Use when: inventory management, stock moves, warehouses, lots and serial numbers, barcode scanning, putaway rules, removal strategies FIFO/LIFO/FEFO, bill of materials BOM, work orders, manufacturing orders, routings, work centers, MRP scheduler, kitting, byproducts, subcontracting, quality checks, repairs"
name: "ERP Inventory + MRP"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی دروست بکەم؟ — نموونە: BOM + Work Order، Lot tracking، Putaway rules"
---

# ERP Inventory + MRP — پسپۆڕی کۆگا و بەرهەمهێنان

## دۆمین
Warehouses، Stock Moves، Lots/Serials، Barcode، BOMs، Work Orders، Routings، Quality.

## سەرچاوەی Odoo
- `applications/inventory_and_mrp/inventory/` — warehouse، product_management، shipping
- `applications/inventory_and_mrp/manufacturing/` — BOMs، work_orders، subcontracting
- `applications/inventory_and_mrp/barcode/`
- `applications/inventory_and_mrp/quality/`

## مۆدێلی داتا (پێشنیار)

### Inventory
| Collection | Fields |
|-----------|--------|
| `warehouses` | code, name, address, manager_id, routes[] |
| `locations` | warehouse_id, name, type (stock/input/output/transit), parent_id |
| `stock_moves` | product_id, qty, from_location, to_location, state (draft/assigned/done), lot_ids[], date |
| `lots` | product_id, name, expiry_date, warehouse_id, qty |
| `putaway_rules` | product_category, warehouse_id, target_location |
| `routes` | name, rules[] (push/pull) |

### MRP
| Collection | Fields |
|-----------|--------|
| `boms` | product_id, code, qty, type (normal/kit/subcontract), components[], byproducts[], routing_id |
| `bom_components` | bom_id, component_product_id, qty, operation_id |
| `work_centers` | name, code, cost_per_hour, capacity |
| `routings` | name, operations[] |
| `operations` | routing_id, name, work_center_id, time_cycle_minutes |
| `manufacturing_orders` | product_id, bom_id, qty, state, scheduled_date, components_consumed[] |
| `work_orders` | mo_id, operation_id, work_center_id, state, duration |

### Quality
| Collection | Fields |
|-----------|--------|
| `quality_points` | name, picking_type, product_id, test_type |
| `quality_checks` | point_id, state (pass/fail), picking_id, note |

## API (پێشنیار)

### Inventory
- `/api/warehouses`, `/api/locations`
- `/api/stock-moves`, `POST /api/stock-moves/{id}/validate`
- `/api/lots`, `GET /api/lots/{id}/traceability`
- `POST /api/inventory/barcode/scan` (body: barcode)
- `/api/putaway-rules`

### MRP
- `/api/boms` (CRUD)
- `/api/manufacturing-orders` (CRUD)
- `POST /api/manufacturing-orders/{id}/confirm`
- `POST /api/manufacturing-orders/{id}/plan`
- `POST /api/manufacturing-orders/{id}/start`
- `POST /api/manufacturing-orders/{id}/done`
- `/api/work-orders`, `/api/work-centers`, `/api/routings`
- `POST /api/mrp/scheduler/run` — پلانی خۆکار

### Quality
- `/api/quality-points`, `/api/quality-checks`

## UI
- `/inventory/warehouses/{id}` — Stock grid
- `/inventory/barcode` — Mobile-friendly scanner page
- `/inventory/lots/{id}/trace` — Timeline
- `/mrp/boms/{id}` — tree editor
- `/mrp/manufacturing-orders/{id}` — Components، Work Orders، Consume دوگمە
- `/mrp/work-centers/{id}/kanban` — لیستی work orders

## Accounting Impact
- Stock Move (done): DR Stock Location-target / CR Stock Location-source (بۆ costing)
- Manufacturing done: DR Finished Goods / CR Raw Materials + Labor + Overhead
- Valuation methods: Standard / FIFO / Average Cost

## ڕێنمایی
- Real-time stock: `warehouse_stock` collection هەمیشە update بکە پاش هەر stock_move.
- Lot/Serial expiry alert (email یان dashboard badge).
- Barcode: پشتگیری EAN13، Code128، QR (react-zxing).
- Subcontracting: BOM type=subcontract → vendor PO ئۆتۆماتیکی.
