"""Universal Activities API — org-wide follow-ups on any entity (Phase 4 G-02)."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.firestore.activities import ActivityRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/activities", tags=["Activities"])


class ActivityCreate(BaseModel):
    entity_type: str
    entity_id: str
    title: str
    due_at: Optional[str] = None
    assignee_id: Optional[str] = None


class ActivityPatch(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    due_at: Optional[str] = None
    assignee_id: Optional[str] = None


@router.get("")
def list_activities(
    assignee: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """List activities for the org, optionally filtered by assignee and status."""
    repo = ActivityRepository(user["org_id"])
    filters = []
    if assignee == "me":
        filters.append({"field": "assignee_id", "op": "==", "value": user["id"]})
    elif assignee:
        filters.append({"field": "assignee_id", "op": "==", "value": assignee})
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters, order_by="due_at", limit=500)
    return {"items": items, "total": total}


@router.post("", status_code=201)
def create_activity(data: ActivityCreate, user: dict = Depends(get_current_user)):
    """Create an activity on any entity."""
    repo = ActivityRepository(user["org_id"])
    return repo.create({
        "entity_type": data.entity_type,
        "entity_id": data.entity_id,
        "title": data.title,
        "due_at": data.due_at,
        "assignee_id": data.assignee_id or user["id"],
        "status": "open",
        "created_by_id": user["id"],
        "created_by_name": user.get("name") or user.get("email", ""),
    })


@router.patch("/{activity_id}")
def update_activity(
    activity_id: str,
    data: ActivityPatch,
    user: dict = Depends(get_current_user),
):
    """Update an activity (e.g. mark done)."""
    repo = ActivityRepository(user["org_id"])
    item = repo.get(activity_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="activity not found")

    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    if payload.get("status") == "done":
        payload.setdefault("done_at", datetime.utcnow().isoformat())
        payload["done_by_id"] = user["id"]
        payload["done_by_name"] = user.get("name") or user.get("email", "")
    if not payload:
        return item
    return repo.update(activity_id, payload)
