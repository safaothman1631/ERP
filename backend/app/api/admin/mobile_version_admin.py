"""Super-admin endpoint to manage the mobile version-check policy.

Spec refs: growth-to-100 requirements.md §R5.8, design.md §5.7, tasks.md
T-G.5.14 (mobile_versions admin UI).

Endpoints:
  GET    /api/admin/mobile/version-config             — list both platforms
  GET    /api/admin/mobile/version-config/{platform}  — read one
  PUT    /api/admin/mobile/version-config             — upsert by platform

Only ``super_admin`` / ``platform_admin`` may write. Every write is mirrored
to ``audit_logs`` so we have a paper trail of force-update toggles.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.security.dependencies import get_current_user
from app.firestore.mobile_devices import MobileVersionConfigRepository
from app.schemas.mobile_devices import VersionConfigUpdate, VersionConfigResponse

log = logging.getLogger("api.admin.mobile_version")

router = APIRouter(prefix="/api/admin/mobile", tags=["Admin / Mobile Version"])


def _require_super_admin(user: dict) -> None:
    role = (user.get("role") or "").lower()
    if role in ("super_admin", "platform_admin") or user.get("is_platform_admin"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="super_admin role required for mobile version config",
    )


def _audit(action: str, platform: str, user: dict, payload: dict) -> None:
    try:
        from app.firebase_client import get_db

        get_db().collection("audit_logs").document(uuid.uuid4().hex).set(
            {
                "type": f"mobile_version.{action}",
                "platform": platform,
                "actor_id": user.get("id") or user.get("uid"),
                "actor_email": user.get("email"),
                "payload": payload,
                "ts": datetime.now(timezone.utc),
            }
        )
    except Exception as e:  # noqa: BLE001
        log.warning("audit write failed (mobile_version.%s): %s", action, e)


def _doc_to_response(doc: dict) -> VersionConfigResponse:
    return VersionConfigResponse(
        platform=doc.get("id") or doc.get("platform", ""),
        min_version=doc.get("min_version", "0.0.0"),
        latest_version=doc.get("latest_version", "0.0.0"),
        force_update=bool(doc.get("force_update", False)),
        update_url=doc.get(
            "update_url",
            doc.get(f"update_url_{doc.get('id', '')}", ""),
        ),
        update_message={
            "ku": doc.get("update_message_ku", ""),
            "ar": doc.get("update_message_ar", ""),
            "en": doc.get("update_message_en", ""),
        },
        updated_at=doc.get("updated_at", ""),
        updated_by=doc.get("updated_by"),
    )


@router.get("/version-config")
def list_version_config(user: dict = Depends(get_current_user)):
    _require_super_admin(user)
    repo = MobileVersionConfigRepository()
    items = []
    for platform in ("ios", "android"):
        doc = repo.get_for_platform(platform)
        if doc:
            items.append(_doc_to_response(doc))
    return {"items": items, "total": len(items)}


@router.get("/version-config/{platform}", response_model=VersionConfigResponse)
def read_version_config(
    platform: str = Path(..., pattern="^(ios|android)$"),
    user: dict = Depends(get_current_user),
):
    _require_super_admin(user)
    repo = MobileVersionConfigRepository()
    doc = repo.get_for_platform(platform)
    if not doc:
        raise HTTPException(status_code=404, detail="no config for platform")
    return _doc_to_response(doc)


@router.put("/version-config", response_model=VersionConfigResponse)
def upsert_version_config(
    data: VersionConfigUpdate,
    user: dict = Depends(get_current_user),
):
    _require_super_admin(user)
    repo = MobileVersionConfigRepository()
    now = datetime.now(timezone.utc).isoformat()
    actor = user.get("email") or user.get("uid") or "unknown"

    doc = {
        "id": data.platform,
        "platform": data.platform,
        "min_version": data.min_version,
        "latest_version": data.latest_version,
        "force_update": data.force_update,
        "update_url": data.update_url or "",
        "update_message_ku": data.update_message_ku or "",
        "update_message_ar": data.update_message_ar or "",
        "update_message_en": data.update_message_en or "",
        "updated_at": now,
        "updated_by": actor,
    }

    existing = repo.get_for_platform(data.platform)
    if existing:
        repo.update(data.platform, doc)
        _audit("update", data.platform, user, doc)
    else:
        repo.create(doc)
        _audit("create", data.platform, user, doc)

    return _doc_to_response(doc)
