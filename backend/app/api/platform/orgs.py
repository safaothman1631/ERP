"""Platform organization management."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.firebase_client import get_db, safe_query
from app.firestore.organizations import OrganizationRepository
from app.services.org_license import get_license, set_org_license

from ._audit import audit_platform
from ._guards import require_platform_admin, require_super_admin

router = APIRouter()


class OrgCreatePayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    owner_email: Optional[str] = Field(default=None, max_length=254)
    bundle_id: Optional[str] = Field(default="full_core", max_length=32)


class OrgPatchPayload(BaseModel):
    name: Optional[str] = Field(default=None, max_length=128)
    status: Optional[str] = Field(default=None, pattern="^(active|suspended)$")


def _user_count(db, org_id: str) -> int:
    return len(safe_query(db.collection("users").where("org_id", "==", org_id).limit(500)))


@router.get("/orgs")
def list_orgs(
    user: dict = Depends(require_platform_admin),
    q: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    db = get_db()
    items = []
    for doc in safe_query(db.collection("organizations").limit(5000)):
        data = {"id": doc.id, **(doc.to_dict() or {})}
        if data.get("deleted_at"):
            continue
        st = "suspended" if data.get("status") == "suspended" or data.get("suspended_at") else "active"
        if status and st != status:
            continue
        name = (data.get("name") or data.get("display_name") or doc.id).lower()
        if q and q.lower() not in name and q.lower() not in doc.id.lower():
            continue
        lic = get_license(doc.id)
        items.append({
            "id": doc.id,
            "name": data.get("name") or data.get("display_name") or doc.id,
            "status": st,
            "platform_tier": data.get("platform_tier"),
            "is_platform_org": bool(data.get("is_platform_org")),
            "created_at": data.get("created_at"),
            "user_count": _user_count(db, doc.id),
            "license": lic,
        })
    items.sort(key=lambda x: x.get("name") or "")
    total = len(items)
    return {"items": items[offset: offset + limit], "total": total}


@router.get("/orgs/{org_id}")
def get_org(org_id: str, user: dict = Depends(require_platform_admin)):
    repo = OrganizationRepository()
    org = repo.get(org_id)
    if not org or org.get("deleted_at"):
        raise HTTPException(status_code=404, detail="Organization not found")
    db = get_db()
    st = "suspended" if org.get("status") == "suspended" or org.get("suspended_at") else "active"
    return {
        "id": org_id,
        "name": org.get("name") or org.get("display_name") or org_id,
        "status": st,
        "platform_tier": org.get("platform_tier"),
        "is_platform_org": bool(org.get("is_platform_org")),
        "created_at": org.get("created_at"),
        "user_count": _user_count(db, org_id),
        "license": get_license(org_id),
    }


@router.post("/orgs")
def create_org(payload: OrgCreatePayload, user: dict = Depends(require_super_admin)):
    db = get_db()
    org_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db.collection("organizations").document(org_id).set({
        "id": org_id,
        "name": payload.name.strip(),
        "status": "active",
        "created_at": now,
        "created_by": user["id"],
    })
    lic_body = {"bundle_id": payload.bundle_id or "full_core"}
    set_org_license(org_id, lic_body)
    audit_platform(org_id, user["id"], "platform.org_created", {"name": payload.name, "owner_email": payload.owner_email})
    return {"id": org_id, "name": payload.name}


@router.patch("/orgs/{org_id}")
def patch_org(org_id: str, payload: OrgPatchPayload, user: dict = Depends(require_super_admin)):
    repo = OrganizationRepository()
    org = repo.get(org_id)
    if not org or org.get("deleted_at"):
        raise HTTPException(status_code=404, detail="Organization not found")
    db = get_db()
    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.status == "suspended":
        updates["status"] = "suspended"
        updates["suspended_at"] = datetime.utcnow().isoformat()
    elif payload.status == "active":
        updates["status"] = "active"
        updates["suspended_at"] = None
    if updates:
        db.collection("organizations").document(org_id).set(updates, merge=True)
        audit_platform(org_id, user["id"], f"platform.org_{payload.status or 'updated'}", updates)
    return get_org(org_id, user)


@router.get("/orgs/{org_id}/export")
def export_org(
    org_id: str,
    signed_url: bool = Query(default=False),
    user: dict = Depends(require_platform_admin),
):
    """Per-org data export manifest (Wave B4)."""
    repo = OrganizationRepository()
    org = repo.get(org_id)
    if not org or org.get("deleted_at"):
        raise HTTPException(status_code=404, detail="Organization not found")
    import asyncio

    from app.services.backup_service import BackupService

    record = asyncio.run(BackupService(org_id).run_backup())
    payload = {
        "org_id": org_id,
        "export_id": getattr(record, "id", None) or getattr(record, "backup_id", None),
        "status": getattr(record, "status", "completed"),
        "collections": BackupService.COLLECTIONS,
        "created_at": datetime.utcnow().isoformat(),
    }
    url = getattr(record, "download_url", None) or getattr(record, "gcs_path", None)
    if signed_url and url:
        payload["signed_url"] = url
    audit_platform(org_id, user["id"], "platform.org_export", {"signed_url": signed_url})
    return payload


@router.delete("/orgs/{org_id}")
def delete_org(org_id: str, user: dict = Depends(require_super_admin)):
    repo = OrganizationRepository()
    org = repo.get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    db = get_db()
    db.collection("organizations").document(org_id).set({
        "deleted_at": datetime.utcnow().isoformat(),
        "status": "deleted",
    }, merge=True)
    audit_platform(org_id, user["id"], "platform.org_deleted", {})
    return {"ok": True, "org_id": org_id}
