"""Platform announcements shown to tenants."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.firebase_client import get_db, safe_query

from ._audit import audit_platform
from ._guards import require_platform_admin, require_super_admin

router = APIRouter()


class AnnouncementPayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=2000)
    severity: str = Field(default="info", pattern="^(info|warning|critical)$")
    start_at: Optional[str] = None
    end_at: Optional[str] = None


@router.get("/announcements")
def list_announcements(user: dict = Depends(require_platform_admin)):
    db = get_db()
    items = [{"id": d.id, **d.to_dict()} for d in safe_query(db.collection("platform_announcements").limit(200))]
    items.sort(key=lambda x: x.get("start_at") or "", reverse=True)
    return {"items": items}


@router.post("/announcements")
def create_announcement(payload: AnnouncementPayload, user: dict = Depends(require_super_admin)):
    db = get_db()
    aid = str(uuid.uuid4())
    body = {
        "id": aid,
        **payload.model_dump(),
        "created_at": datetime.utcnow().isoformat(),
        "created_by": user["id"],
    }
    db.collection("platform_announcements").document(aid).set(body)
    audit_platform("", user["id"], "platform.announcement_created", {"id": aid})
    return body


@router.get("/announcements/active")
def active_announcements():
    """Public for tenant AppShell banner — no auth required."""
    db = get_db()
    now = datetime.utcnow().isoformat()
    items = []
    try:
        for doc in safe_query(db.collection("platform_announcements").limit(50)):
            row = doc.to_dict()
            start = row.get("start_at") or ""
            end = row.get("end_at") or "9999"
            if start <= now <= end:
                items.append({"id": doc.id, **row})
    except Exception as exc:
        from app.services.firestore_resilience import is_firestore_quota_error
        if is_firestore_quota_error(exc):
            return {"items": []}
        raise
    return {"items": items}
