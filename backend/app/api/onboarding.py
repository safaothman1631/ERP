"""
Onboarding preferences — org-scoped module activation + chosen industry preset.
Used by the OnboardingWizard. Admin-set; visible to all org members.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.firestore.module_requests import ModuleAccessRequestRepository
from app.firebase_client import get_db
from app.services.auth import get_current_user
from app.services.module_gate import invalidate_enabled_cache, get_enabled_modules
from app.services.module_registry import ALWAYS_ON
from app.services.onboarding_prefs import (
    OnboardingPreferencesRepository,
    empty_prefs,
    fetch_prefs,
    merge_enabled_modules,
    require_module_approval_for_org,
)
from app.services.org_license import assert_modules_allowed, get_allowed_modules, get_license
from app.services.permissions import require_perm, user_has_perm
from app.services.settings_category_gate import (
    CATEGORY_MODULE,
    has_settings_read_access,
    has_settings_write_access,
    modules_for_category,
    require_module_for_category,
    seed_default_bags_for_modules,
)

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])


class OnboardingPreferencesPayload(BaseModel):
    industry_id: Optional[str] = Field(default=None, max_length=64)
    enabled_modules: List[str] = Field(default_factory=list)
    completed: bool = False


class ModuleRequestCreate(BaseModel):
    requested_modules: List[str] = Field(default_factory=list)
    note: Optional[str] = Field(default=None, max_length=500)
    industry_id: Optional[str] = Field(default=None, max_length=64)


class ModuleRequestApprove(BaseModel):
    approved_modules: Optional[List[str]] = None


class ModuleRequestReject(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


def _audit_module_action(org_id: str, user_id: str, action: str, meta: dict) -> None:
    try:
        entry_id = str(uuid.uuid4())
        db = get_db()
        db.collection("audit_logs").document(entry_id).set({
            "id": entry_id,
            "org_id": org_id,
            "user_id": user_id,
            "action": action,
            "entity_type": "module_access_request",
            "entity_id": meta.get("request_id"),
            "metadata": meta,
            "created_at": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass


def _open_pending_for_user(org_id: str, user_id: str) -> Optional[dict]:
    repo = ModuleAccessRequestRepository(org_id)
    items, _ = repo.list(
        filters=[
            {"field": "user_id", "op": "==", "value": user_id},
            {"field": "status", "op": "==", "value": "pending"},
        ],
        limit=1,
    )
    return items[0] if items else None


@router.get("/preferences")
def get_preferences(user: dict = Depends(get_current_user)):
    from app.firebase_client import get_db

    repo = OnboardingPreferencesRepository(user["org_id"])
    doc = fetch_prefs(repo, user["org_id"])
    is_demo_org = False
    try:
        org_doc = get_db().collection("organizations").document(user["org_id"]).get()
        org_data = org_doc.to_dict() if org_doc.exists else {}
        is_demo_org = bool(org_data.get("is_demo_org"))
    except Exception as exc:
        from app.services.firestore_resilience import is_firestore_quota_error
        if not is_firestore_quota_error(exc):
            raise
    if not doc:
        return {**empty_prefs(), "org_id": user["org_id"], "is_demo_org": is_demo_org}
    return {
        "id": doc.get("id"),
        "org_id": doc.get("org_id"),
        "industry_id": doc.get("industry_id"),
        "enabled_modules": doc.get("enabled_modules") or [],
        "completed": bool(doc.get("completed")),
        "require_module_approval": require_module_approval_for_org(user["org_id"]),
        "is_demo_org": is_demo_org,
        "updated_by": doc.get("updated_by"),
        "updated_at": doc.get("updated_at"),
    }


@router.get("/license")
def get_org_license(user: dict = Depends(get_current_user)):
    org_id = user["org_id"]
    lic = get_license(org_id)
    allowed = get_allowed_modules(org_id)
    return {
        "allowed_modules": allowed,
        "bundle_id": lic.get("bundle_id"),
        "tier": lic.get("tier"),
        "expires_at": lic.get("expires_at"),
        "require_module_approval": require_module_approval_for_org(org_id),
        "enabled_modules": get_enabled_modules(org_id),
    }


@router.get("/settings-sections")
def list_settings_sections(user: dict = Depends(get_current_user)):
    """Optional helper endpoint for frontend section filtering."""
    org_id = user["org_id"]
    sections: list[dict] = []
    for category in sorted(CATEGORY_MODULE.keys()):
        enabled = True
        try:
            require_module_for_category(org_id, category)
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            code = detail.get("code")
            if code in {"module_disabled", "license_expired"}:
                enabled = False
            else:
                raise

        module_gate = modules_for_category(category)
        sections.append({
            "key": category,
            "module": list(module_gate) if len(module_gate) > 1 else (module_gate[0] if module_gate else None),
            "can_view": enabled and has_settings_read_access(user, category),
            "can_edit": enabled and has_settings_write_access(user, category),
        })
    return {"sections": sections}


@router.put("/preferences")
def upsert_preferences(
    payload: OnboardingPreferencesPayload,
    user: dict = Depends(get_current_user),
):
    org_id = user["org_id"]
    if require_module_approval_for_org(org_id) and not user_has_perm(user, "modules.approve"):
        raise HTTPException(
            status_code=403,
            detail={"code": "module_approval_required", "message": "Direct module changes require admin approval"},
        )

    if len(payload.enabled_modules) > 200:
        raise HTTPException(status_code=400, detail="Too many modules")

    seen = set()
    cleaned: List[str] = []
    for m in payload.enabled_modules:
        if not isinstance(m, str) or not m.strip():
            continue
        key = m.strip()[:64]
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(key)

    try:
        assert_modules_allowed(org_id, cleaned)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    repo = OnboardingPreferencesRepository(org_id)
    existing = fetch_prefs(repo, org_id)
    body = {
        "org_id": org_id,
        "industry_id": payload.industry_id,
        "enabled_modules": cleaned,
        "completed": payload.completed,
        "require_module_approval": (existing or {}).get("require_module_approval", True),
        "updated_by": user["id"],
    }
    invalidate_enabled_cache(org_id)
    if existing:
        return repo.update(existing["id"], body)
    return repo.create(body)


@router.delete("/preferences")
def reset_preferences(user: dict = Depends(get_current_user)):
    if not user_has_perm(user, "modules.approve") and user.get("role") not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Admin only")
    repo = OnboardingPreferencesRepository(user["org_id"])
    existing = fetch_prefs(repo, user["org_id"])
    if existing:
        repo.delete(existing["id"])
    invalidate_enabled_cache(user["org_id"])
    return {"ok": True}


@router.post("/module-requests")
def create_module_request(
    payload: ModuleRequestCreate,
    user: dict = Depends(get_current_user),
):
    org_id = user["org_id"]
    if _open_pending_for_user(org_id, user["id"]):
        raise HTTPException(status_code=409, detail="You already have a pending module request")

    seen = set()
    requested: List[str] = []
    for m in payload.requested_modules:
        if not isinstance(m, str) or not m.strip():
            continue
        key = m.strip()[:64]
        if key in seen or key in ALWAYS_ON:
            continue
        seen.add(key)
        requested.append(key)

    if not requested:
        raise HTTPException(status_code=400, detail="No modules requested")

    try:
        assert_modules_allowed(org_id, requested)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    repo = ModuleAccessRequestRepository(org_id)
    doc = repo.create({
        "org_id": org_id,
        "user_id": user["id"],
        "user_email": user.get("email"),
        "user_name": user.get("display_name") or user.get("name"),
        "industry_id": payload.industry_id,
        "requested_modules": requested,
        "approved_modules": [],
        "status": "pending",
        "note": payload.note,
    })
    return doc


@router.get("/module-requests/mine")
def my_module_requests(user: dict = Depends(get_current_user)):
    repo = ModuleAccessRequestRepository(user["org_id"])
    items, _ = repo.list(
        filters=[{"field": "user_id", "op": "==", "value": user["id"]}],
        limit=50,
    )
    items.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return {"items": items}


@router.get("/module-requests")
def list_module_requests(
    status: Optional[str] = Query(default="pending"),
    user: dict = Depends(require_perm("modules.approve")),
):
    repo = ModuleAccessRequestRepository(user["org_id"])
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters, limit=100)
    items.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return {"items": items, "total": total}


@router.post("/module-requests/{request_id}/approve")
def approve_module_request(
    request_id: str,
    payload: ModuleRequestApprove,
    user: dict = Depends(require_perm("modules.approve")),
):
    org_id = user["org_id"]
    repo = ModuleAccessRequestRepository(org_id)
    req = repo.get(request_id)
    if not req or req.get("org_id") != org_id:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    pool = set(get_allowed_modules(org_id) or [])
    requested = set(req.get("requested_modules") or [])
    if payload.approved_modules:
        approved = [m for m in payload.approved_modules if m in requested and (not pool or m in pool)]
    else:
        approved = list(requested & pool) if pool else list(requested)

    if not approved:
        raise HTTPException(status_code=400, detail="No valid modules to approve")

    final = sorted(set(approved) | set(ALWAYS_ON))
    merge_enabled_modules(org_id, final, industry_id=req.get("industry_id"))
    try:
        seed_default_bags_for_modules(org_id, final)
    except Exception:
        # Seeding is best-effort and must not block module approval.
        pass

    status_val = "approved" if set(approved) == requested else "partially_approved"
    updated = repo.update(request_id, {
        "status": status_val,
        "approved_modules": final,
        "reviewed_by": user["id"],
        "reviewed_at": datetime.utcnow().isoformat(),
    })
    _audit_module_action(org_id, user["id"], "modules.approved", {
        "request_id": request_id,
        "approved_modules": final,
        "status": status_val,
    })
    return updated


@router.post("/module-requests/{request_id}/reject")
def reject_module_request(
    request_id: str,
    payload: ModuleRequestReject,
    user: dict = Depends(require_perm("modules.approve")),
):
    org_id = user["org_id"]
    repo = ModuleAccessRequestRepository(org_id)
    req = repo.get(request_id)
    if not req or req.get("org_id") != org_id:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    updated = repo.update(request_id, {
        "status": "rejected",
        "reason": payload.reason,
        "reviewed_by": user["id"],
        "reviewed_at": datetime.utcnow().isoformat(),
    })
    _audit_module_action(org_id, user["id"], "modules.rejected", {
        "request_id": request_id,
        "reason": payload.reason,
    })
    return updated
