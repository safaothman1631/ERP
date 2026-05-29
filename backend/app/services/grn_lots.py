"""Create/update inventory lots when goods are received on a PO."""
from __future__ import annotations

import uuid
from datetime import datetime

from app.firestore.inventory import BatchRepository, ItemRepository


def receive_lots_for_grn(org_id: str, warehouse_id: str | None, grn_lines: list[dict], user_id: str) -> list[dict]:
    """Create or increment batch records for lot-tracked items on a GRN."""
    batch_repo = BatchRepository(org_id)
    item_repo = ItemRepository(org_id)
    created: list[dict] = []
    now = datetime.utcnow().isoformat()

    for ln in grn_lines:
        item_id = ln.get("item_id")
        qty = float(ln.get("qty_received") or ln.get("qty") or 0)
        if not item_id or qty <= 0:
            continue
        item = item_repo.get(item_id)
        if not item:
            continue
        tracking = item.get("tracking") or ("lot" if item.get("is_trackable") else "none")
        if tracking not in ("lot", "serial"):
            continue

        lot_number = ln.get("lot_no") or ln.get("lot_number") or f"GRN-{item_id[:8]}-{now[:10]}"
        if tracking == "serial":
            qty = 1.0

        existing, _ = batch_repo.list(
            filters=[
                {"field": "item_id", "op": "==", "value": item_id},
                {"field": "batch_number", "op": "==", "value": lot_number},
            ],
            limit=1,
        )
        if existing:
            batch = existing[0]
            new_qty = float(batch.get("qty_on_hand") or batch.get("quantity") or 0) + qty
            batch_repo.update(batch["id"], {
                "qty_on_hand": new_qty,
                "quantity": new_qty,
                "updated_at": now,
            })
            created.append({**batch, "qty_on_hand": new_qty})
        else:
            batch = batch_repo.create({
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "item_id": item_id,
                "warehouse_id": warehouse_id,
                "batch_number": lot_number,
                "lot_number": lot_number,
                "received_date": now,
                "qty_received": qty,
                "qty_on_hand": qty,
                "quantity": qty,
                "status": "active",
                "created_at": now,
                "updated_at": now,
                "created_by_id": user_id,
            })
            created.append(batch)

        # Keep aggregate stock in sync
        current = float(item.get("stock_on_hand", 0) or 0)
        item_repo.update(item_id, {"stock_on_hand": current + qty})

    return created
