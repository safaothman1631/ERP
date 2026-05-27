# Requirements Document: Phase 3 — Sales / Purchase / Inventory Depth

## Introduction

The order-to-cash and procure-to-pay flows currently work as isolated CRUD operations. To be production-ready they need state machines that prevent invalid transitions, server-validated 3-way matching for purchases, lot/serial tracking that propagates from receipt → stock move → invoice → POS, and landed-cost allocation. This phase delivers those.

---

## Glossary

- **State machine**: A finite-state controller for a document type with a fixed list of states and explicit allowed transitions.
- **3-way match**: Validation that a Bill's quantities and prices match the originating Purchase Order and the Goods Receipt within a configured tolerance.
- **Landed cost**: Additional charges (freight, customs, insurance) allocated to received items, increasing the inventory unit cost.
- **Lot tracking**: Tracking groups of identical items by lot/batch number with optional expiry.
- **Serial tracking**: Tracking individual items by unique serial number.
- **Putaway rule**: Configuration that determines the destination location for received goods (e.g., "fragile → small-bin", "perishable → cold-storage").
- **Picking strategy**: FIFO / FEFO / LIFO selection of which lot/serial to allocate when fulfilling a sale or transfer.

---

## Requirements

### Requirement 1: Sales Workflow State Machine

1. THE Sales State Machine SHALL define states `draft → sent → confirmed → invoiced → done` and `cancelled` for both Quotes and Sales Orders.
2. WHEN a Quote is `confirmed`, THE Sales Service SHALL atomically: copy lines into a new SO with state `confirmed`, link `quote.so_id`, set `quote.state="confirmed"`.
3. WHEN an SO is `invoiced`, THE Sales Service SHALL produce one or more Invoices; if delivery is partial, THE Sales Service SHALL allow `invoice_method` of `"order"` (full) or `"delivery"` (per receipt).
4. WHEN any document attempts an invalid transition (e.g., `done → draft`), THE Sales Service SHALL reject with HTTP 409.
5. THE state machine SHALL emit an audit-log entry per transition.

### Requirement 2: Purchase Workflow + 3-Way Match

1. THE Purchase State Machine SHALL define states `draft → sent → confirmed → received → billed → done` and `cancelled`.
2. WHEN a PO is `confirmed`, THE Purchase Service SHALL allocate a number, lock prices, and become read-only on lines (only quantities/dates editable).
3. WHEN a Goods Receipt is created against a PO line, THE Purchase Service SHALL track `qty_received` per line so partial receipts are supported.
4. WHEN a Bill is posted with reference to a PO, THE 3-Way Match Service SHALL compute, per matching line, `(po_qty, received_qty, billed_qty)` and `(po_price, billed_price)`.
5. WHEN `abs(billed_qty − min(po_qty, received_qty)) > qty_tolerance` OR `abs(billed_price − po_price) / po_price > price_tolerance`, THE Purchase Service SHALL reject the bill posting with HTTP 422 and a structured detail listing the mismatch.
6. THE tolerances SHALL be configurable per org under `settings/purchasing.qty_tolerance_pct` (default 0.05) and `price_tolerance_pct` (default 0.02).
7. WHEN a Bill is posted bypassing the match (admin override), THE Backend SHALL require `require_perm("bills.match_override")` AND log the override in audit.

### Requirement 3: Goods Receipt + Stock Moves

1. WHEN a Goods Receipt is posted, THE Inventory Service SHALL create stock moves from `Vendors` location to the receiving warehouse location.
2. THE stock move SHALL update item `on_hand` quantity per location atomically.
3. WHEN the received item is configured for lot/serial tracking, THE Goods Receipt SHALL require lot or serial entry per quantity received.
4. THE Goods Receipt SHALL produce an inventory JE (debit Inventory, credit GR/IR — Goods Received Not Invoiced) at receipt-time price.
5. WHEN the matching Bill is later posted, THE Bill SHALL clear the GR/IR by debiting it and crediting AP.

### Requirement 4: Lot & Serial Tracking End-to-End

1. THE Item master SHALL have `tracking ∈ {"none","lot","serial"}`.
2. WHEN tracking is `lot`, THE Backend SHALL store quantities per `(item_id, location_id, lot_id)` triple in `stock_quants` collection.
3. WHEN tracking is `serial`, THE Backend SHALL store each unit as a separate `stock_quant` with `quantity=1` and a unique `serial_id`.
4. THE Lot Repository SHALL support: create, list, update expiry, query-by-item, query-by-status (`available`, `quarantined`, `expired`).
5. WHEN a sale or transfer reserves stock, THE Backend SHALL pick lots using the configured picking strategy (FIFO/FEFO/LIFO).
6. THE POS SHALL display a lot/serial picker for tracked items.
7. THE expiry alert SHALL fire 30 days, 7 days, and 0 days before expiry via APScheduler `expiry_alerts` job.

### Requirement 5: Landed Cost Allocation

1. THE Backend SHALL expose `POST /api/landed-costs` linking a vendor bill (e.g., freight) to one or more Goods Receipts.
2. THE allocation method SHALL support `"by_quantity"`, `"by_value"`, `"by_weight"`.
3. WHEN a landed cost is applied, THE Backend SHALL post a JE that debits Inventory and credits the landed-cost expense, AND SHALL update each affected stock_quant's `unit_cost` accordingly.
4. THE landed cost SHALL be reversible: `DELETE /api/landed-costs/{id}` posts the reversing JE and reverts stock_quant unit costs.

### Requirement 6: Delivery Orders & Challans (Phase 1 link)

1. THE Sales Service SHALL produce a Delivery Order from a confirmed SO either manually or automatically based on `auto_create_delivery` setting.
2. THE Delivery Order SHALL trigger stock moves from warehouse to `Customers` location at confirmation.
3. THE Delivery Challan endpoint (Phase 1 implemented) SHALL be linked to the DO record.

### Requirement 7: Tests

1. New test files:
   - `tests/test_sales_state_machine.py`
   - `tests/test_purchase_3way_match.py`
   - `tests/test_lot_tracking.py`
   - `tests/test_landed_cost.py`
2. E2E Playwright spec: `frontend/e2e/quote_to_invoice.spec.ts` covering Quote → SO → Delivery → Invoice → Payment.

---

## Out of Scope

- Manufacturing scheduling / MRP run — defer
- WMS pick paths / barcode scanner driver — defer
- Returns RMA workflow — defer (basic returns module already exists)

## Definition of Done

- 3-way match rejects mismatched bills with structured error
- Lot tracking propagates from receipt to POS sale to JE
- Landed-cost JE balanced and reversible
- E2E spec passes
