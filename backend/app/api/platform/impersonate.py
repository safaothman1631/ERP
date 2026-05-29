"""Platform impersonation for support."""
from __future__ import annotations

import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import _issue_tokens
from app.firebase_client import get_db

from ._audit import audit_platform
from ._guards import require_super_admin

router = APIRouter()


class ImpersonatePayload(BaseModel):
    target_user_id: str = Field(..., min_length=8, max_length=64)


@router.post("/impersonate")
def start_impersonation(payload: ImpersonatePayload, user: dict = Depends(require_super_admin)):
    if os.environ.get("PLATFORM_IMPERSONATION_ENABLED", "true").lower() == "false":
        raise HTTPException(status_code=403, detail="Impersonation disabled")
    db = get_db()
    doc = db.collection("users").document(payload.target_user_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    target = {"id": doc.id, **doc.to_dict()}
    if not target.get("is_active", True):
        raise HTTPException(status_code=400, detail="User inactive")
    audit_platform(target.get("org_id", ""), user["id"], "platform.impersonation_start", {
        "target_user_id": payload.target_user_id,
    })
    db.collection("impersonation_sessions").add({
        "admin_id": user["id"],
        "target_user_id": payload.target_user_id,
        "started_at": datetime.utcnow().isoformat(),
    })
    target_for_token = {**target, "impersonating": True, "impersonated_by": user["id"]}
    tokens = _issue_tokens(target_for_token)
    return {
        "access_token": tokens.access_token,
        "token_type": tokens.token_type,
        "user_id": tokens.user_id,
        "org_id": tokens.org_id,
        "user_name": tokens.user_name,
        "role": tokens.role,
        "is_platform_admin": tokens.is_platform_admin,
        "impersonating": True,
        "admin_user_id": user["id"],
    }


@router.post("/impersonate/exit")
def exit_impersonation(user: dict = Depends(require_super_admin)):
    """No-op marker — client restores saved admin token."""
    audit_platform(user.get("org_id", ""), user["id"], "platform.impersonation_end", {})
    return {"ok": True}
