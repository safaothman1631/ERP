"""Shared onboarding preferences helpers (used by API + module gate)."""
from __future__ import annotations

from typing import List, Optional

from app.firestore.base import BaseRepository

SINGLETON_DOC_FIELD = "org_id"


class OnboardingPreferencesRepository(BaseRepository):
    collection_name = "onboarding_preferences"


def empty_prefs() -> dict:
    return {
        "industry_id": None,
        "enabled_modules": [],
        "completed": False,
        "require_module_approval": True,
    }


def fetch_prefs(repo: OnboardingPreferencesRepository, org_id: str) -> Optional[dict]:
    filters = [{"field": SINGLETON_DOC_FIELD, "op": "==", "value": org_id}]
    items, _ = repo.list(filters=filters, limit=1)
    return items[0] if items else None


def require_module_approval_for_org(org_id: str) -> bool:
    repo = OnboardingPreferencesRepository(org_id)
    doc = fetch_prefs(repo, org_id)
    if not doc:
        return True
    if "require_module_approval" in doc:
        return bool(doc.get("require_module_approval"))
    completed = bool(doc.get("completed"))
    if completed:
        return False
    return True


def merge_enabled_modules(org_id: str, modules: List[str], industry_id: Optional[str] = None) -> dict:
    from app.services.module_gate import invalidate_enabled_cache
    from app.services.module_registry import ALWAYS_ON

    repo = OnboardingPreferencesRepository(org_id)
    existing = fetch_prefs(repo, org_id)
    merged = sorted(set(modules) | set(ALWAYS_ON))
    body = {
        "org_id": org_id,
        "industry_id": industry_id or (existing or {}).get("industry_id"),
        "enabled_modules": merged,
        "completed": True,
        "require_module_approval": (existing or {}).get("require_module_approval", True),
    }
    if existing:
        result = repo.update(existing["id"], body)
    else:
        result = repo.create(body)
    invalidate_enabled_cache(org_id)
    return result
