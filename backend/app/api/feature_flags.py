"""
Feature Flags API — manage boolean feature flags per organisation.

Endpoints:
    GET    /api/feature-flags              — list all flags for current org
    GET    /api/feature-flags/{flag_key}   — get a single flag (+ evaluated value for current user)
    POST   /api/feature-flags/{flag_key}   — create or update a flag (admin/owner only)
    DELETE /api/feature-flags/{flag_key}   — delete a flag (admin/owner only)

Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.services.auth import get_current_user
from app.services import feature_flag_service as _ff

router = APIRouter(prefix="/api/feature-flags", tags=["Feature Flags"])

# ── Pydantic models ───────────────────────────────────────────────────────────


class FlagUpsertRequest(BaseModel):
    enabled: bool = True
    rollout_pct: int = Field(default=100, ge=0, le=100)
    description: str = ""

    @field_validator("rollout_pct")
    @classmethod
    def _validate_pct(cls, v: int) -> int:
        if not 0 <= v <= 100:
            raise ValueError("rollout_pct must be between 0 and 100")
        return v


class FlagResponse(BaseModel):
    key: str
    enabled: bool
    rollout_pct: int
    description: str
    org_id: str
    # Evaluated value for the requesting user (accounts for gradual rollout)
    is_active: bool = False


# ── Helpers ───────────────────────────────────────────────────────────────────

_ADMIN_ROLES = {"admin", "owner"}


def _require_admin(user: dict) -> None:
    """Raise 403 if the user is not an admin or owner."""
    if user.get("role") not in _ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="تەنها ئەدمین یان خاوەن دەتوانێت ئەم کارە ئەنجام بدات",
        )


def _build_response(flag: dict, user: dict) -> FlagResponse:
    """Build a FlagResponse, including the evaluated is_active for the user."""
    user_id = user.get("id") or user.get("uid") or ""
    org_id = user.get("org_id", "")
    return FlagResponse(
        key=flag.get("key", ""),
        enabled=bool(flag.get("enabled", False)),
        rollout_pct=int(flag.get("rollout_pct", 100)),
        description=flag.get("description", ""),
        org_id=flag.get("org_id", org_id),
        is_active=_ff.is_enabled(org_id, flag.get("key", ""), user_id),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("", summary="List all feature flags for the current organisation")
def list_feature_flags(user: dict = Depends(get_current_user)):
    """Return all feature flags scoped to the authenticated user's organisation.

    Each flag includes an `is_active` field that reflects whether the flag is
    currently active for the requesting user (taking gradual rollout into account).

    Requirements: 7.1, 7.2, 7.3, 7.4
    """
    org_id = user.get("org_id", "")
    flags = _ff.list_flags(org_id)
    return [_build_response(f, user) for f in flags]


@router.get("/{flag_key}", summary="Get a single feature flag")
def get_feature_flag(flag_key: str, user: dict = Depends(get_current_user)):
    """Return a single feature flag by key for the current organisation.

    Returns 404 if the flag does not exist.

    Requirements: 7.1, 7.3, 7.4, 7.5
    """
    org_id = user.get("org_id", "")
    flag = _ff.get_flag(org_id, flag_key)
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"فلاگی '{flag_key}' نەدۆزرایەوە",
        )
    return _build_response(flag, user)


@router.post("/{flag_key}", status_code=status.HTTP_200_OK, summary="Create or update a feature flag")
def upsert_feature_flag(
    flag_key: str,
    data: FlagUpsertRequest,
    user: dict = Depends(get_current_user),
):
    """Create or update a feature flag (admin/owner only).

    - `enabled`: master on/off switch for the flag.
    - `rollout_pct`: 0-100 percentage for gradual rollout.  100 means all users.
    - `description`: optional human-readable description.

    Requirements: 7.1, 7.2, 7.3, 7.6
    """
    _require_admin(user)
    org_id = user.get("org_id", "")
    flag = _ff.set_flag(
        org_id=org_id,
        flag_key=flag_key,
        enabled=data.enabled,
        rollout_pct=data.rollout_pct,
        description=data.description,
    )
    return _build_response(flag, user)


@router.delete("/{flag_key}", status_code=status.HTTP_200_OK, summary="Delete a feature flag")
def delete_feature_flag(flag_key: str, user: dict = Depends(get_current_user)):
    """Delete a feature flag (admin/owner only).

    Returns 404 if the flag does not exist.

    Requirements: 7.1, 7.2, 7.3
    """
    _require_admin(user)
    org_id = user.get("org_id", "")
    deleted = _ff.delete_flag(org_id, flag_key)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"فلاگی '{flag_key}' نەدۆزرایەوە",
        )
    return {"ok": True, "key": flag_key}
