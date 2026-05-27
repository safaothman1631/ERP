"""Org policy helpers for mandatory 2FA on privileged roles."""
from __future__ import annotations

PRIVILEGED_2FA_ROLES = frozenset({
    "admin",
    "owner",
    "super_admin",
    "accountant",
    "accounting_manager",
})


def org_requires_2fa_for_privileged(org_id: str) -> bool:
    try:
        from app.services import settings_service
        sec = settings_service.get_bag(org_id, "security")
    except Exception:
        sec = {}
    return bool(sec.get("require_2fa_for_admin", True))


def user_requires_2fa_setup(user: dict) -> bool:
    """True when user must enable 2FA before using the app (not yet enabled)."""
    if bool(user.get("is_2fa_enabled")):
        return False
    role = (user.get("role") or "").lower()
    if role not in PRIVILEGED_2FA_ROLES:
        return False
    org_id = user.get("org_id")
    if not org_id:
        return False
    return org_requires_2fa_for_privileged(org_id)


def user_must_keep_2fa(user: dict) -> bool:
    """True when disabling 2FA is blocked by org policy."""
    if not bool(user.get("is_2fa_enabled")):
        return False
    role = (user.get("role") or "").lower()
    if role not in PRIVILEGED_2FA_ROLES:
        return False
    org_id = user.get("org_id")
    if not org_id:
        return False
    return org_requires_2fa_for_privileged(org_id)
