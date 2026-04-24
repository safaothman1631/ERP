"""Sprint 15: Universal Chatter — followers + activities for ANY entity.

Endpoints follow REST under /api/chatter/{entity_type}/{entity_id}/...
where entity_type is e.g. 'invoice', 'lead', 'opportunity', 'employee', etc.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.firestore.chatter import FollowerRepository, UniversalActivityRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/chatter", tags=["Chatter"])


# ──────────────────────────── Followers ────────────────────────────

class FollowerCreate(BaseModel):
    user_id: str
    user_name: Optional[str] = None
    notify_on: list[str] = Field(default_factory=lambda: ["update", "comment"])


@router.get("/{entity_type}/{entity_id}/followers")
def list_followers(entity_type: str, entity_id: str, user: dict = Depends(get_current_user)):
    repo = FollowerRepository(user["org_id"])
    items, total = repo.list(filters=[
        {"field": "entity_type", "op": "==", "value": entity_type},
        {"field": "entity_id", "op": "==", "value": entity_id},
    ], limit=200)
    return {"items": items, "total": total}


@router.post("/{entity_type}/{entity_id}/followers", status_code=201)
def add_follower(entity_type: str, entity_id: str, data: FollowerCreate,
                 user: dict = Depends(get_current_user)):
    repo = FollowerRepository(user["org_id"])
    # Idempotent: skip if already a follower
    existing, _ = repo.list(filters=[
        {"field": "entity_type", "op": "==", "value": entity_type},
        {"field": "entity_id", "op": "==", "value": entity_id},
        {"field": "user_id", "op": "==", "value": data.user_id},
    ], limit=1)
    if existing:
        return existing[0]
    return repo.create({
        "entity_type": entity_type,
        "entity_id": entity_id,
        "user_id": data.user_id,
        "user_name": data.user_name,
        "notify_on": data.notify_on,
        "added_by_id": user["id"],
        "added_by_name": user.get("name") or user.get("email", ""),
    })


@router.delete("/{entity_type}/{entity_id}/followers/{user_id}")
def remove_follower(entity_type: str, entity_id: str, user_id: str,
                    user: dict = Depends(get_current_user)):
    repo = FollowerRepository(user["org_id"])
    existing, _ = repo.list(filters=[
        {"field": "entity_type", "op": "==", "value": entity_type},
        {"field": "entity_id", "op": "==", "value": entity_id},
        {"field": "user_id", "op": "==", "value": user_id},
    ], limit=1)
    if not existing:
        raise HTTPException(404, "follower not found")
    repo.delete(existing[0]["id"])
    return {"deleted": True}


# ──────────────────────────── Activities ────────────────────────────

class ActivityCreate(BaseModel):
    activity_type: str = "todo"  # todo | call | meeting | email | upload
    summary: str
    notes: Optional[str] = None
    due_date: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None


class ActivityUpdate(BaseModel):
    activity_type: Optional[str] = None
    summary: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    status: Optional[str] = None


@router.get("/{entity_type}/{entity_id}/activities")
def list_activities(entity_type: str, entity_id: str,
                    status: Optional[str] = None,
                    user: dict = Depends(get_current_user)):
    repo = UniversalActivityRepository(user["org_id"])
    filters = [
        {"field": "entity_type", "op": "==", "value": entity_type},
        {"field": "entity_id", "op": "==", "value": entity_id},
    ]
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters, order_by="due_date", limit=500)
    return {"items": items, "total": total}


@router.post("/{entity_type}/{entity_id}/activities", status_code=201)
def create_activity(entity_type: str, entity_id: str, data: ActivityCreate,
                    user: dict = Depends(get_current_user)):
    repo = UniversalActivityRepository(user["org_id"])
    return repo.create({
        "entity_type": entity_type,
        "entity_id": entity_id,
        "activity_type": data.activity_type,
        "summary": data.summary,
        "notes": data.notes,
        "due_date": data.due_date,
        "assignee_id": data.assignee_id,
        "assignee_name": data.assignee_name,
        "status": "pending",
        "created_by_id": user["id"],
        "created_by_name": user.get("name") or user.get("email", ""),
    })


@router.put("/activities/{activity_id}")
def update_activity(activity_id: str, data: ActivityUpdate,
                    user: dict = Depends(get_current_user)):
    repo = UniversalActivityRepository(user["org_id"])
    item = repo.get(activity_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "activity not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return repo.update(activity_id, payload)


@router.post("/activities/{activity_id}/done")
def done_activity(activity_id: str, user: dict = Depends(get_current_user)):
    repo = UniversalActivityRepository(user["org_id"])
    item = repo.get(activity_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "activity not found")
    return repo.update(activity_id, {
        "status": "done",
        "done_at": datetime.utcnow().isoformat(),
        "done_by_id": user["id"],
        "done_by_name": user.get("name") or user.get("email", ""),
    })


@router.delete("/activities/{activity_id}")
def delete_activity(activity_id: str, user: dict = Depends(get_current_user)):
    repo = UniversalActivityRepository(user["org_id"])
    item = repo.get(activity_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "activity not found")
    repo.delete(activity_id)
    return {"deleted": True}


@router.get("/activities/my-due")
def my_due_activities(user: dict = Depends(get_current_user)):
    """My pending activities (assigned to current user) ordered by due date."""
    repo = UniversalActivityRepository(user["org_id"])
    items, _ = repo.list(filters=[
        {"field": "assignee_id", "op": "==", "value": user["id"]},
        {"field": "status", "op": "==", "value": "pending"},
    ], limit=200, order_by="due_date")
    return {"items": items, "total": len(items)}
