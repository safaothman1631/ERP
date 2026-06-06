"""WMS — Warehouse bin management (Pool 3.5 buildout).

Thin persistence + REST layer on top of the validated pure engine in
``app.services.wms_allocation`` (putaway + pick). Nothing here re-implements
allocation logic; the endpoints load org-scoped state from Firestore, delegate
to the engine, and return its result.

Endpoints (prefix ``/api/wms``):
    GET    /api/wms/bins                 list bins
    POST   /api/wms/bins                 create a bin
    GET    /api/wms/bins/{bin_id}        bin detail
    PUT    /api/wms/bins/{bin_id}        update a bin
    DELETE /api/wms/bins/{bin_id}        delete a bin
    POST   /api/wms/putaway              allocate incoming qty into bins
    POST   /api/wms/pick                 allocate qty of an item out of bin stock
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.firestore.wms import BinRepository, BinStockRepository
from app.services.auth import get_current_user
from app.services import wms_allocation

router = APIRouter(prefix="/api/wms", tags=["WMS"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────── Bins CRUD ────────────────────────────

@router.get("/bins")
def list_bins(user: dict = Depends(get_current_user)):
    """List all warehouse bins for the org."""
    repo = BinRepository(user["org_id"])
    items, _ = repo.list(order_by="bin_id", order_dir="ASCENDING", limit=500)
    return items


@router.post("/bins", status_code=201)
def create_bin(data: dict, user: dict = Depends(get_current_user)):
    """Create a storage bin/location."""
    if not data.get("bin_id"):
        raise HTTPException(400, "bin_id required")
    repo = BinRepository(user["org_id"])
    payload = {
        "id": str(uuid.uuid4()),
        "bin_id": str(data["bin_id"]),
        "zone": data.get("zone", ""),
        "capacity": float(data.get("capacity") or 0),
        "load": float(data.get("load") or 0),
        "item_id": data.get("item_id"),
        "created_at": _now_iso(),
    }
    return repo.create(payload)


@router.post("/putaway")
def putaway(data: dict, user: dict = Depends(get_current_user)):
    """Allocate an incoming ``qty`` into bins with free capacity.

    Body: ``{item_id, qty, zone?, strategy?}`` (strategy: consolidate|spread).
    Loads the org's bins and delegates to ``wms_allocation.putaway``; returns the
    engine's allocations plus any leftover that did not fit.
    """
    qty = float(data.get("qty") or 0)
    if qty <= 0:
        raise HTTPException(400, "qty must be > 0")
    strategy = data.get("strategy") or "consolidate"
    item_id: Optional[str] = data.get("item_id")
    zone: Optional[str] = data.get("zone")

    repo = BinRepository(user["org_id"])
    bins, _ = repo.list(limit=1000)
    allocations, leftover = wms_allocation.putaway(
        bins, qty, item_id=item_id, zone=zone, strategy=strategy
    )
    return {
        "item_id": item_id,
        "qty": qty,
        "strategy": strategy,
        "zone": zone,
        "allocations": allocations,
        "leftover": leftover,
    }


@router.post("/pick")
def pick(data: dict, user: dict = Depends(get_current_user)):
    """Allocate ``qty`` of an item out of bin stock.

    Body: ``{item_id, qty, strategy?}`` (strategy: fifo|nearest). Loads the org's
    bin-stock lots and delegates to ``wms_allocation.pick``; returns the engine's
    allocations plus any shortfall.
    """
    item_id = data.get("item_id")
    if not item_id:
        raise HTTPException(400, "item_id required")
    qty = float(data.get("qty") or 0)
    if qty <= 0:
        raise HTTPException(400, "qty must be > 0")
    strategy = data.get("strategy") or "fifo"

    repo = BinStockRepository(user["org_id"])
    stock, _ = repo.list(limit=2000)
    allocations, short = wms_allocation.pick(stock, item_id, qty, strategy=strategy)
    return {
        "item_id": item_id,
        "qty": qty,
        "strategy": strategy,
        "allocations": allocations,
        "short": short,
    }


# ── Item-scoped routes (must come after literal paths) ──

@router.get("/bins/{bin_id}")
def get_bin(bin_id: str, user: dict = Depends(get_current_user)):
    """Bin detail by document id."""
    repo = BinRepository(user["org_id"])
    item = repo.get(bin_id)
    if not item:
        raise HTTPException(404, "Bin not found")
    return item


@router.put("/bins/{bin_id}")
def update_bin(bin_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Update a bin's fields."""
    repo = BinRepository(user["org_id"])
    if not repo.get(bin_id):
        raise HTTPException(404, "Bin not found")
    data.pop("id", None)
    data.pop("org_id", None)
    data["updated_at"] = _now_iso()
    return repo.update(bin_id, data)


@router.delete("/bins/{bin_id}")
def delete_bin(bin_id: str, user: dict = Depends(get_current_user)):
    """Delete a bin."""
    repo = BinRepository(user["org_id"])
    if not repo.get(bin_id):
        raise HTTPException(404, "Bin not found")
    repo.delete(bin_id)
    return {"success": True}
