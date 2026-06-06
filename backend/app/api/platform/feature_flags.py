"""Platform feature flags."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.firebase_client import get_db, safe_query

from ._audit import audit_platform
from ._guards import require_platform_admin, require_super_admin

router = APIRouter()


class FlagPayload(BaseModel):
    key: str = Field(..., min_length=1, max_length=64)
    enabled: bool = False
    rollout_percent: Optional[int] = Field(default=100, ge=0, le=100)
    org_allowlist: Optional[List[str]] = None


@router.get("/feature-flags")
def list_flags(user: dict = Depends(require_platform_admin)):
    db = get_db()
    items = [{"id": d.id, **d.to_dict()} for d in safe_query(db.collection("feature_flags").limit(500))]
    return {"items": items}


@router.put("/feature-flags/{key}")
def upsert_flag(key: str, payload: FlagPayload, user: dict = Depends(require_super_admin)):
    db = get_db()
    body = {
        "key": key,
        "enabled": payload.enabled,
        "rollout_percent": payload.rollout_percent,
        "org_allowlist": payload.org_allowlist or [],
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": user["id"],
    }
    db.collection("feature_flags").document(key).set(body, merge=True)
    audit_platform("", user["id"], "platform.feature_flag_updated", body)
    return body
