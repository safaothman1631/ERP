"""Platform license provisioning."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.firestore.organizations import OrganizationRepository
from app.services.org_license import BUNDLES, get_license, set_org_license

from ._audit import audit_platform
from ._guards import require_platform_admin

router = APIRouter()


class LicenseUpdatePayload(BaseModel):
    bundle_id: Optional[str] = Field(default=None, max_length=32)
    allowed_modules: Optional[List[str]] = None
    tier: Optional[str] = Field(default=None, max_length=32)
    expires_at: Optional[str] = None
    max_users: Optional[int] = None


@router.get("/bundles")
def list_bundles(user: dict = Depends(require_platform_admin)):
    return {"bundles": {k: v for k, v in BUNDLES.items()}}


@router.get("/orgs/{org_id}/license")
def get_org_license(org_id: str, user: dict = Depends(require_platform_admin)):
    repo = OrganizationRepository()
    org = repo.get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"org_id": org_id, "license": get_license(org_id)}


@router.put("/orgs/{org_id}/license")
def update_org_license(
    org_id: str,
    payload: LicenseUpdatePayload,
    user: dict = Depends(require_platform_admin),
):
    repo = OrganizationRepository()
    if not repo.get(org_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    if payload.bundle_id and payload.bundle_id not in BUNDLES:
        raise HTTPException(status_code=400, detail=f"Unknown bundle: {payload.bundle_id}")
    body = payload.model_dump(exclude_none=True)
    license_body = set_org_license(org_id, body)
    audit_platform(org_id, user["id"], "platform.license_updated", license_body)
    return {"org_id": org_id, "license": license_body}
