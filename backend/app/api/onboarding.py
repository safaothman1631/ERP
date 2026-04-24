"""
Onboarding preferences — org-scoped module activation + chosen industry preset.
Used by the OnboardingWizard. Admin-set; visible to all org members.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])


class OnboardingPreferencesRepository(BaseRepository):
    collection_name = "onboarding_preferences"


# Single org-level document keyed by org_id (one row per org).
SINGLETON_DOC_FIELD = "org_id"


class OnboardingPreferencesPayload(BaseModel):
    industry_id: Optional[str] = Field(default=None, max_length=64)
    enabled_modules: List[str] = Field(default_factory=list)
    completed: bool = False


def _empty() -> dict:
    return {
        "industry_id": None,
        "enabled_modules": [],
        "completed": False,
    }


def _fetch_doc(repo: OnboardingPreferencesRepository, org_id: str) -> Optional[dict]:
    filters = [{"field": SINGLETON_DOC_FIELD, "op": "==", "value": org_id}]
    items, _ = repo.list(filters=filters, limit=1)
    return items[0] if items else None


@router.get("/preferences")
def get_preferences(user: dict = Depends(get_current_user)):
    """Return the org's onboarding preferences (or default empty payload)."""
    repo = OnboardingPreferencesRepository(user["org_id"])
    doc = _fetch_doc(repo, user["org_id"])
    if not doc:
        return {**_empty(), "org_id": user["org_id"]}
    # Strip noisy bookkeeping; keep semantic shape stable for the frontend.
    return {
        "id": doc.get("id"),
        "org_id": doc.get("org_id"),
        "industry_id": doc.get("industry_id"),
        "enabled_modules": doc.get("enabled_modules") or [],
        "completed": bool(doc.get("completed")),
        "updated_by": doc.get("updated_by"),
        "updated_at": doc.get("updated_at"),
    }


@router.put("/preferences")
def upsert_preferences(
    payload: OnboardingPreferencesPayload,
    user: dict = Depends(get_current_user),
):
    """Create or update the org's onboarding preferences."""
    if len(payload.enabled_modules) > 200:
        raise HTTPException(status_code=400, detail="Too many modules")
    # De-duplicate while preserving order.
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

    repo = OnboardingPreferencesRepository(user["org_id"])
    existing = _fetch_doc(repo, user["org_id"])
    body = {
        "org_id": user["org_id"],
        "industry_id": payload.industry_id,
        "enabled_modules": cleaned,
        "completed": payload.completed,
        "updated_by": user["id"],
    }
    if existing:
        return repo.update(existing["id"], body)
    return repo.create(body)


@router.delete("/preferences")
def reset_preferences(user: dict = Depends(get_current_user)):
    """Clear the org's onboarding preferences (will re-trigger the wizard)."""
    repo = OnboardingPreferencesRepository(user["org_id"])
    existing = _fetch_doc(repo, user["org_id"])
    if existing:
        repo.delete(existing["id"])
    return {"ok": True}
