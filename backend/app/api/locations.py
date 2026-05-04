import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.firestore.locations import (
    LocationRepository,
    PutawayRuleRepository,
    CycleCountRepository,
    CycleCountLineRepository,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/locations", tags=["Stock Locations"])


# ── Schemas ──

class LocationCreate(BaseModel):
    warehouse_id: str
    code: str
    name: str
    parent_id: Optional[str] = None
    location_type: str = Field(..., pattern="^(zone|aisle|bin|staging)$")
    barcode: Optional[str] = None
    active: bool = True


class LocationUpdate(BaseModel):
    warehouse_id: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None
    parent_id: Optional[str] = None
    location_type: Optional[str] = Field(None, pattern="^(zone|aisle|bin|staging)$")
    barcode: Optional[str] = None
    active: Optional[bool] = None


class PutawayRuleCreate(BaseModel):
    warehouse_id: str
    item_id: Optional[str] = None
    category_id: Optional[str] = None
    target_location_id: str
    priority: int = 10
    active: bool = True


class PutawayRuleUpdate(BaseModel):
    warehouse_id: Optional[str] = None
    item_id: Optional[str] = None
    category_id: Optional[str] = None
    target_location_id: Optional[str] = None
    priority: Optional[int] = None
    active: Optional[bool] = None


class PutawaySuggest(BaseModel):
    item_id: str
    warehouse_id: str
    category_id: Optional[str] = None


class CycleCountCreate(BaseModel):
    warehouse_id: str
    location_id: Optional[str] = None
    scheduled_date: str
    status: str = Field("draft", pattern="^(draft|in_progress|completed|cancelled)$")


class CycleCountUpdate(BaseModel):
    warehouse_id: Optional[str] = None
    location_id: Optional[str] = None
    scheduled_date: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(draft|in_progress|completed|cancelled)$")


class CycleCountLineCreate(BaseModel):
    item_id: str
    lot_id: Optional[str] = None
    expected_qty: float
    counted_qty: Optional[float] = None
    notes: Optional[str] = None


# ── Stock Locations ──

@router.get("/stock-locations")
def list_locations(
    warehouse_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """List all locations, optionally filtered by warehouse"""
    repo = LocationRepository(user["org_id"])
    if warehouse_id:
        items = repo.get_by_warehouse(warehouse_id)
        return {"items": items, "total": len(items)}
    items, total = repo.list(limit=1000)
    return {"items": items, "total": total}


@router.post("/stock-locations", status_code=201)
def create_location(data: LocationCreate, user: dict = Depends(get_current_user)):
    """Create a new stock location"""
    repo = LocationRepository(user["org_id"])
    doc_id = str(uuid.uuid4())
    payload = {
        "id": doc_id,
        "org_id": user["org_id"],
        "created_at": datetime.utcnow().isoformat(),
        **data.model_dump()
    }
    repo.create(doc_id, payload)
    return {"id": doc_id, **payload}


@router.get("/stock-locations/{location_id}")
def get_location(location_id: str, user: dict = Depends(get_current_user)):
    """Get single location by ID"""
    repo = LocationRepository(user["org_id"])
    loc = repo.get(location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc


@router.put("/stock-locations/{location_id}")
def update_location(
    location_id: str,
    data: LocationUpdate,
    user: dict = Depends(get_current_user)
):
    """Update a location"""
    repo = LocationRepository(user["org_id"])
    loc = repo.get(location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    repo.update(location_id, updates)
    return {**loc, **updates}


@router.delete("/stock-locations/{location_id}")
def delete_location(location_id: str, user: dict = Depends(get_current_user)):
    """Delete a location"""
    repo = LocationRepository(user["org_id"])
    loc = repo.get(location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    repo.delete(location_id)
    return {"message": "Location deleted"}


@router.get("/stock-locations/tree/{warehouse_id}")
def get_location_tree(warehouse_id: str, user: dict = Depends(get_current_user)):
    """Get locations as a tree structure for a warehouse"""
    repo = LocationRepository(user["org_id"])
    items = repo.get_by_warehouse(warehouse_id)
    
    # Build tree: find roots (no parent_id) and recursively attach children
    def build_tree(parent_id: Optional[str] = None) -> list:
        nodes = [item for item in items if item.get("parent_id") == parent_id]
        for node in nodes:
            children = build_tree(node["id"])
            if children:
                node["children"] = children
        return nodes
    
    tree = build_tree(None)
    return {"tree": tree, "total": len(items)}


# ── Putaway Rules ──

@router.get("/putaway-rules")
def list_putaway_rules(
    warehouse_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """List putaway rules"""
    repo = PutawayRuleRepository(user["org_id"])
    filters = []
    if warehouse_id:
        filters.append({"field": "warehouse_id", "op": "==", "value": warehouse_id})
    items, total = repo.list(filters=filters, limit=500)
    return {"items": items, "total": total}


@router.post("/putaway-rules", status_code=201)
def create_putaway_rule(data: PutawayRuleCreate, user: dict = Depends(get_current_user)):
    """Create a putaway rule"""
    repo = PutawayRuleRepository(user["org_id"])
    doc_id = str(uuid.uuid4())
    payload = {
        "id": doc_id,
        "org_id": user["org_id"],
        "created_at": datetime.utcnow().isoformat(),
        **data.model_dump()
    }
    repo.create(doc_id, payload)
    return {"id": doc_id, **payload}


@router.put("/putaway-rules/{rule_id}")
def update_putaway_rule(
    rule_id: str,
    data: PutawayRuleUpdate,
    user: dict = Depends(get_current_user)
):
    """Update a putaway rule"""
    repo = PutawayRuleRepository(user["org_id"])
    rule = repo.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    repo.update(rule_id, updates)
    return {**rule, **updates}


@router.delete("/putaway-rules/{rule_id}")
def delete_putaway_rule(rule_id: str, user: dict = Depends(get_current_user)):
    """Delete a putaway rule"""
    repo = PutawayRuleRepository(user["org_id"])
    rule = repo.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    repo.delete(rule_id)
    return {"message": "Rule deleted"}


@router.post("/putaway/suggest")
def suggest_putaway_location(data: PutawaySuggest, user: dict = Depends(get_current_user)):
    """Suggest best location for an item in a warehouse based on putaway rules"""
    repo = PutawayRuleRepository(user["org_id"])
    rule = repo.find_best_location(data.item_id, data.warehouse_id, data.category_id)
    if not rule:
        return {"suggested_location_id": None, "message": "No matching rule found"}
    
    return {
        "suggested_location_id": rule.get("target_location_id"),
        "rule_id": rule.get("id"),
        "priority": rule.get("priority"),
    }


# ── Cycle Counts ──

@router.get("/cycle-counts")
def list_cycle_counts(
    warehouse_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """List cycle counts"""
    repo = CycleCountRepository(user["org_id"])
    filters = []
    if warehouse_id:
        filters.append({"field": "warehouse_id", "op": "==", "value": warehouse_id})
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters, limit=500)
    return {"items": items, "total": total}


@router.post("/cycle-counts", status_code=201)
def create_cycle_count(data: CycleCountCreate, user: dict = Depends(get_current_user)):
    """Create a new cycle count"""
    repo = CycleCountRepository(user["org_id"])
    doc_id = str(uuid.uuid4())
    payload = {
        "id": doc_id,
        "org_id": user["org_id"],
        "created_at": datetime.utcnow().isoformat(),
        **data.model_dump()
    }
    repo.create(doc_id, payload)
    return {"id": doc_id, **payload}


@router.get("/cycle-counts/{count_id}")
def get_cycle_count(count_id: str, user: dict = Depends(get_current_user)):
    """Get cycle count with lines"""
    repo = CycleCountRepository(user["org_id"])
    cc = repo.get_with_lines(count_id)
    if not cc:
        raise HTTPException(status_code=404, detail="Cycle count not found")
    return cc


@router.put("/cycle-counts/{count_id}")
def update_cycle_count(
    count_id: str,
    data: CycleCountUpdate,
    user: dict = Depends(get_current_user)
):
    """Update cycle count"""
    repo = CycleCountRepository(user["org_id"])
    cc = repo.get(count_id)
    if not cc:
        raise HTTPException(status_code=404, detail="Cycle count not found")
    
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    repo.update(count_id, updates)
    return {**cc, **updates}


@router.post("/cycle-counts/{count_id}/start")
def start_cycle_count(count_id: str, user: dict = Depends(get_current_user)):
    """Start a cycle count (change status to in_progress)"""
    repo = CycleCountRepository(user["org_id"])
    cc = repo.get(count_id)
    if not cc:
        raise HTTPException(status_code=404, detail="Cycle count not found")
    if cc.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Can only start draft counts")
    
    repo.update(count_id, {"status": "in_progress"})
    return {"message": "Cycle count started", "status": "in_progress"}


@router.post("/cycle-counts/{count_id}/complete")
def complete_cycle_count(count_id: str, user: dict = Depends(get_current_user)):
    """Complete a cycle count (change status to completed)"""
    repo = CycleCountRepository(user["org_id"])
    cc = repo.get(count_id)
    if not cc:
        raise HTTPException(status_code=404, detail="Cycle count not found")
    if cc.get("status") not in ["in_progress", "draft"]:
        raise HTTPException(status_code=400, detail="Can only complete in_progress or draft counts")
    
    repo.update(count_id, {
        "status": "completed",
        "completed_at": datetime.utcnow().isoformat()
    })
    return {"message": "Cycle count completed", "status": "completed"}


@router.post("/cycle-counts/{count_id}/lines")
def add_cycle_count_lines(
    count_id: str,
    lines: list[CycleCountLineCreate],
    user: dict = Depends(get_current_user)
):
    """Bulk add/update cycle count lines"""
    repo = CycleCountRepository(user["org_id"])
    cc = repo.get(count_id)
    if not cc:
        raise HTTPException(status_code=404, detail="Cycle count not found")
    
    lines_repo = CycleCountLineRepository(user["org_id"])
    created = []
    for line_data in lines:
        line_id = str(uuid.uuid4())
        payload = {
            "id": line_id,
            "count_id": count_id,
            "org_id": user["org_id"],
            "created_at": datetime.utcnow().isoformat(),
            **line_data.model_dump()
        }
        # Calculate variance if counted_qty is provided
        if payload.get("counted_qty") is not None:
            payload["variance"] = payload["counted_qty"] - payload["expected_qty"]
        
        lines_repo.create(line_id, payload)
        created.append(payload)
    
    return {"message": f"{len(created)} lines added", "lines": created}
