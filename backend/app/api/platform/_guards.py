"""Platform admin guards."""
from __future__ import annotations

import os

from fastapi import Depends, HTTPException

from app.services.auth import get_current_user
from app.services.permissions import user_has_perm


def _platform_admin_ids() -> set[str]:
    raw = os.environ.get("PLATFORM_ADMIN_USER_IDS", "")
    return {x.strip() for x in raw.split(",") if x.strip()}


def require_platform_admin(user: dict = Depends(get_current_user)):
    if not user_has_perm(user, "platform.manage"):
        raise HTTPException(status_code=403, detail="platform.manage required")
    allowed = _platform_admin_ids()
    if allowed and user.get("id") not in allowed and not user.get("is_platform_admin"):
        raise HTTPException(status_code=403, detail="Not a platform administrator")
    return user


def require_super_admin(user: dict = Depends(require_platform_admin)):
    role = user.get("role", "")
    if role != "super_admin" and not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="super_admin required")
    return user
