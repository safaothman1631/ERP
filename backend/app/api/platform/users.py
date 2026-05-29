"""Cross-org user management for platform admins."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.firebase_client import get_db

from ._audit import audit_platform
from ._guards import require_platform_admin, require_super_admin

router = APIRouter()


@router.get("/users")
def search_users(
    user: dict = Depends(require_platform_admin),
    q: Optional[str] = Query(default=None),
    org_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    db = get_db()
    stream = db.collection("users").limit(5000).stream(timeout=30)
    items = []
    ql = (q or "").lower()
    for doc in stream:
        data = {"id": doc.id, **doc.to_dict()}
        if org_id and data.get("org_id") != org_id:
            continue
        email = (data.get("email") or "").lower()
        name = (data.get("display_name") or data.get("name") or "").lower()
        if ql and ql not in email and ql not in name and ql not in doc.id.lower():
            continue
        items.append({
            "id": doc.id,
            "email": data.get("email"),
            "display_name": data.get("display_name") or data.get("name"),
            "org_id": data.get("org_id"),
            "role": data.get("role"),
            "is_active": data.get("is_active", True),
            "locked_until": data.get("locked_until"),
            "last_login_at": data.get("last_login_at"),
        })
    items.sort(key=lambda x: x.get("email") or "")
    return {"items": items[:limit], "total": len(items)}


@router.get("/users/{user_id}")
def get_user(user_id: str, user: dict = Depends(require_platform_admin)):
    db = get_db()
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    data = {"id": doc.id, **doc.to_dict()}
    data.pop("password_hash", None)
    return data


@router.post("/users/{user_id}/unlock")
def unlock_user(user_id: str, user: dict = Depends(require_super_admin)):
    db = get_db()
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    db.collection("users").document(user_id).set({
        "locked_until": None,
        "failed_login_attempts": 0,
    }, merge=True)
    u = doc.to_dict()
    audit_platform(u.get("org_id", ""), user["id"], "platform.user_unlocked", {"target_user_id": user_id})
    return {"ok": True}


@router.post("/users/{user_id}/deactivate")
def deactivate_user(user_id: str, user: dict = Depends(require_super_admin)):
    db = get_db()
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    db.collection("users").document(user_id).set({"is_active": False}, merge=True)
    u = doc.to_dict()
    audit_platform(u.get("org_id", ""), user["id"], "platform.user_deactivated", {"target_user_id": user_id})
    return {"ok": True}
