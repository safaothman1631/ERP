"""Shared POS inventory deduction + stock validation."""
from __future__ import annotations

def line_quantity(line: dict) -> float:
    """POS lines use `qty`; legacy paths may use `quantity`."""
    for key in ("qty", "quantity"):
        if key in line and line[key] is not None and line[key] != "":
            return float(line[key] or 0)
    return 0.0


def validate_stock_for_lines(org_id: str, lines: list[dict]) -> dict | None:
    """Return error dict if any trackable item lacks stock; else None."""
    from app.firestore.inventory import ItemRepository

    item_repo = ItemRepository(org_id)
    for line in lines:
        item_id = line.get("item_id") or line.get("product_id")
        qty = line_quantity(line)
        if not item_id or qty <= 0:
            continue
        item = item_repo.get(item_id)
        if not item or not item.get("is_trackable", True):
            continue
        available = float(item.get("stock_on_hand", 0) or 0)
        if available + 1e-9 < qty:
            return {
                "code": "insufficient_stock",
                "item_id": item_id,
                "item_name": item.get("name", item_id),
                "requested": qty,
                "available": available,
            }
    return None


def deduct_inventory_for_order(org_id: str, order_id: str, user_id: str, lines: list[dict] | None = None) -> None:
    from app.services.pos_sync_inventory_atomic import deduct_inventory_for_order_atomic

    deduct_inventory_for_order_atomic(org_id, order_id, user_id, lines)
