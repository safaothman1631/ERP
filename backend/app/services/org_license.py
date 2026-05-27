"""Organization license pool — vendor-controlled module caps."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from app.cache import cache
from app.firestore.organizations import OrganizationRepository
from app.services.module_registry import ALWAYS_ON

# Non-ext production_core modules (mirrors frontend industries.ts core keys)
PRODUCTION_CORE_MODULES: list[str] = [
    "sales",
    "purchase",
    "inventory",
    "manufacturing",
    "projects",
    "assets",
    "pos",
    "banking",
    "accounting",
    "crm",
    "hr",
    "einvoice",
    "whatsapp",
    "ocr",
    "l10n_iq",
]

BUNDLES: dict[str, list[str]] = {
    "pos_only": sorted(set(ALWAYS_ON) | {"sales", "inventory", "pos"}),
    "trading": sorted(set(ALWAYS_ON) | {"sales", "purchase", "inventory", "crm"}),
    "full_core": sorted(set(PRODUCTION_CORE_MODULES)),
    "custom": [],
}

_LICENSE_CACHE_TTL = 60


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            s = value.replace("Z", "+00:00").replace(" ", "T")
            return datetime.fromisoformat(s)
        except ValueError:
            return None
    return None


def get_license(org_id: str) -> dict:
    """Return normalized license dict for an org (empty = no vendor cap / legacy)."""
    cache_key = f"org_license:{org_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    repo = OrganizationRepository()
    org = repo.get(org_id) or {}
    raw = org.get("license") or {}
    bundle_id = raw.get("bundle_id")
    allowed = raw.get("allowed_modules")
    if bundle_id and bundle_id in BUNDLES and bundle_id != "custom":
        allowed = list(BUNDLES[bundle_id])
    elif allowed:
        allowed = list(allowed)
    else:
        allowed = []

    license_data = {
        "tier": raw.get("tier") or "standard",
        "bundle_id": bundle_id,
        "allowed_modules": allowed,
        "expires_at": raw.get("expires_at"),
        "max_users": raw.get("max_users"),
    }
    cache.set(cache_key, license_data)
    return license_data


def invalidate_license_cache(org_id: str) -> None:
    cache.delete(f"org_license:{org_id}")
    cache.delete(f"org:{org_id}")


def get_allowed_modules(org_id: str) -> Optional[list[str]]:
    """Return allowed module pool, or None when no vendor cap (legacy unlimited)."""
    lic = get_license(org_id)
    allowed = lic.get("allowed_modules") or []
    if not allowed:
        return None
    merged = sorted(set(allowed) | set(ALWAYS_ON))
    return merged


def is_license_valid(org_id: str) -> bool:
    lic = get_license(org_id)
    expires = _parse_dt(lic.get("expires_at"))
    if expires is None:
        return True
    now = datetime.utcnow()
    if expires.tzinfo:
        from datetime import timezone
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expires = expires.replace(tzinfo=None)
    return expires > now


def assert_modules_allowed(org_id: str, requested: list[str]) -> None:
    """Raise ValueError if any requested module is outside the license pool."""
    pool = get_allowed_modules(org_id)
    if pool is None:
        return
    pool_set = set(pool)
    bad = [m for m in requested if m not in pool_set and m not in ALWAYS_ON]
    if bad:
        raise ValueError(f"Modules not in license pool: {', '.join(bad)}")


def set_org_license(org_id: str, payload: dict) -> dict:
    """Persist license on organization document."""
    repo = OrganizationRepository()
    org = repo.get(org_id)
    if not org:
        raise LookupError(f"Organization {org_id} not found")

    bundle_id = payload.get("bundle_id")
    allowed = payload.get("allowed_modules")
    if bundle_id and bundle_id in BUNDLES and bundle_id != "custom":
        allowed = list(BUNDLES[bundle_id])
    elif allowed is not None:
        allowed = list(allowed)
    else:
        allowed = get_license(org_id).get("allowed_modules") or []

    license_body = {
        "tier": payload.get("tier") or "standard",
        "bundle_id": bundle_id,
        "allowed_modules": allowed,
        "expires_at": payload.get("expires_at"),
        "max_users": payload.get("max_users"),
    }
    repo.collection.document(org_id).set({"license": license_body}, merge=True)
    invalidate_license_cache(org_id)
    return license_body
