# Design: Phase 3 — Sales / Purchase / Inventory Depth

## State Machine Library

```python
# backend/app/services/state_machine.py
class StateMachine:
    def __init__(self, transitions: dict[str, set[str]]): ...
    def can_transition(self, src: str, dst: str) -> bool: ...
    def transition(self, doc: dict, dst: str, user_id: str) -> dict:
        # validate transition, set state, append history, audit log
```

Sales SM: `{"draft":{"sent","cancelled"}, "sent":{"confirmed","cancelled"}, "confirmed":{"invoiced","cancelled"}, "invoiced":{"done"}, "done":set(), "cancelled":set()}`

Purchase SM: `{"draft":{"sent","cancelled"}, "sent":{"confirmed","cancelled"}, "confirmed":{"received","cancelled"}, "received":{"billed"}, "billed":{"done"}, "done":set(), "cancelled":set()}`

## 3-Way Match

`backend/app/services/three_way_match.py` — exists; refactor to:

```python
def match_bill_to_po(bill: dict, po: dict, receipts: list[dict], settings: dict) -> MatchResult:
    """Returns MatchResult(passed, mismatches, line_results) — pure function."""
```

Called from `expenses.py` (bills) post hook. Mismatch raises HTTP 422.

## Stock Quants Model

```
organizations/{org}/stock_quants/{quant_id}
  - item_id
  - location_id
  - lot_id (nullable)
  - serial_id (nullable)
  - quantity (Decimal)
  - unit_cost (Decimal)
  - reserved_quantity (Decimal)
  - status ("available"|"quarantined"|"expired")
  - expiry_date (nullable)
  - last_move_id
```

Per-location aggregations cached in `item.on_hand` for fast list views.

## Picking Strategy Service

```python
def pick_quants(item_id, location_id, qty, strategy: Literal["FIFO","FEFO","LIFO"]) -> list[QuantAllocation]:
    """Allocate qty across available quants by strategy; return [(quant_id, qty)]."""
```

## Landed Cost Service

```python
def apply_landed_cost(landed_bill_id, allocation_method, target_receipts: list[str]) -> dict:
    """Compute per-receipt allocation, update stock_quants unit_cost, post JE."""
```

## API Routers

- `pos`/sales: `state_machine.transition` injected as helper
- `purchases.py`: 3-way-match middleware on bill post
- `inventory.py`: stock-quant query endpoints, lot CRUD
- `landed_costs.py`: new router

## Frontend

- Quote/SO/PO pages: state badge with allowed actions
- Receipt page: lot/serial entry grid
- POS: lot picker modal for tracked items
- Landed Cost page: new under purchases
