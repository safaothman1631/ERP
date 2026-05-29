"""Platform dashboard stats."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends

from app.firebase_client import get_db
from app.services.onboarding_prefs import OnboardingPreferencesRepository, fetch_prefs
from app.services.org_license import get_license

from ._guards import require_platform_admin

router = APIRouter()


@router.get("/stats")
def platform_stats(user: dict = Depends(require_platform_admin)):
    db = get_db()
    orgs = list(db.collection("organizations").limit(5000).stream(timeout=30))
    active = suspended = deleted = 0
    expiring_licenses = 0
    cutoff = (datetime.utcnow() + timedelta(days=30)).isoformat()
    now = datetime.utcnow().isoformat()

    for doc in orgs:
        data = doc.to_dict() or {}
        if data.get("deleted_at"):
            deleted += 1
            continue
        if data.get("status") == "suspended" or data.get("suspended_at"):
            suspended += 1
        else:
            active += 1
        lic = get_license(doc.id)
        exp = lic.get("expires_at")
        if exp and exp <= cutoff and exp >= now:
            expiring_licenses += 1

    users = list(db.collection("users").where("is_active", "==", True).limit(10000).stream(timeout=30))
    locked = sum(1 for u in users if u.to_dict().get("locked_until"))

    pending_requests = list(
        db.collection("module_access_requests").where("status", "==", "pending").limit(1000).stream(timeout=30)
    )

    return {
        "organizations": {"active": active, "suspended": suspended, "deleted": deleted, "total": len(orgs)},
        "users": {"active": len(users), "locked": locked},
        "pending_module_requests": len(pending_requests),
        "expiring_licenses_30d": expiring_licenses,
    }
