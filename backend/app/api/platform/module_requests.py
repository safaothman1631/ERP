"""Global module request queue for platform admins."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.firebase_client import get_db
from app.firestore.module_requests import ModuleAccessRequestRepository
from app.services.module_registry import ALWAYS_ON
from app.services.onboarding_prefs import merge_enabled_modules
from app.services.org_license import get_allowed_modules

from ._audit import audit_platform
from ._guards import require_platform_admin

router = APIRouter()


class ApprovePayload(BaseModel):
    approved_modules: Optional[List[str]] = None


class RejectPayload(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


@router.get("/module-requests")
def list_module_requests(
    user: dict = Depends(require_platform_admin),
    status: Optional[str] = Query(default="pending"),
    org_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    db = get_db()
    query = db.collection("module_access_requests")
    if status:
        query = query.where("status", "==", status)
    items = []
    for doc in query.limit(1000).stream():
        row = {"id": doc.id, **doc.to_dict()}
        if org_id and row.get("org_id") != org_id:
            continue
        oid = row.get("org_id")
        org_doc = db.collection("organizations").document(oid).get() if oid else None
        org_name = org_doc.to_dict().get("name") if org_doc and org_doc.exists else oid
        row["org_name"] = org_name
        items.append(row)
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"items": items[:limit], "total": len(items)}


@router.post("/module-requests/{request_id}/approve")
def approve_request(
    request_id: str,
    payload: ApprovePayload,
    user: dict = Depends(require_platform_admin),
):
    db = get_db()
    doc = db.collection("module_access_requests").document(request_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Request not found")
    req = {"id": doc.id, **doc.to_dict()}
    if req.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Request not pending")
    org_id = req["org_id"]
    pool = set(get_allowed_modules(org_id) or [])
    requested = set(req.get("requested_modules") or [])
    if payload.approved_modules:
        approved = [m for m in payload.approved_modules if m in requested and (not pool or m in pool)]
    else:
        approved = sorted(requested & pool) if pool else sorted(requested)

    if not approved:
        raise HTTPException(status_code=400, detail="No valid modules to approve")

    final = sorted(set(approved) | set(ALWAYS_ON))
    merge_enabled_modules(org_id, final, industry_id=req.get("industry_id"))
    status_val = "approved" if set(approved) == requested else "partially_approved"
    db.collection("module_access_requests").document(request_id).set({
        "status": status_val,
        "approved_modules": sorted(approved),
        "reviewed_by": user["id"],
        "reviewed_at": datetime.utcnow().isoformat(),
    }, merge=True)
    audit_platform(org_id, user["id"], "platform.module_request_approved", {"request_id": request_id, "modules": sorted(approved)})
    return {"ok": True, "approved_modules": sorted(approved), "status": status_val}


@router.post("/module-requests/{request_id}/reject")
def reject_request(
    request_id: str,
    payload: RejectPayload,
    user: dict = Depends(require_platform_admin),
):
    db = get_db()
    doc = db.collection("module_access_requests").document(request_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Request not found")
    req = doc.to_dict()
    if req.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Request not pending")
    db.collection("module_access_requests").document(request_id).set({
        "status": "rejected",
        "reason": payload.reason,
        "reviewed_by": user["id"],
        "reviewed_at": datetime.utcnow().isoformat(),
    }, merge=True)
    audit_platform(req.get("org_id", ""), user["id"], "platform.module_request_rejected", {"request_id": request_id})
    return {"ok": True}
