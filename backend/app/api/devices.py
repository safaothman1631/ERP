"""Device registration endpoints for mobile push notifications.

Spec refs: growth-to-100 requirements.md §R5.9, design.md §5.4, tasks.md
T-G.5.10–T-G.5.12.

Endpoints:
  POST   /api/devices/register   — register a (user, tenant, fcm_token) tuple
  GET    /api/devices             — list current user's registered devices
  DELETE /api/devices/{id}         — unregister (called on logout / app uninstall)

Idempotency: re-registering with the same ``fcm_token`` updates the existing
record's ``last_seen_at`` rather than creating a duplicate row. Older devices
that haven't reported in 60 days are pruned by a scheduled job (see
``app/services/scheduler.py``).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.services.auth import get_current_user
from app.firestore.mobile_devices import MobileDeviceRepository
from app.schemas.mobile_devices import DeviceRegisterRequest, DeviceResponse


router = APIRouter(prefix="/api/devices", tags=["devices"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/register", status_code=201, response_model=DeviceResponse)
def register_device(
    data: DeviceRegisterRequest,
    response: Response,
    user: dict = Depends(get_current_user),
):
    """Register or refresh an FCM token for the current user.

    Idempotent: a re-register with the same ``fcm_token`` returns ``200`` and
    bumps ``last_seen_at``; a brand new token returns ``201`` with a
    ``Location`` header.
    """
    repo = MobileDeviceRepository(user["org_id"])
    existing = repo.find_by_token(data.fcm_token)
    now = _now_iso()
    if existing:
        # Update in place — token already known.
        updated = repo.update(
            existing["id"],
            {
                "app_version": data.app_version,
                "device_model": data.device_model,
                "user_id": user["uid"],
                "platform": data.platform,
                "last_seen_at": now,
            },
        )
        response.status_code = 200
        response.headers["Location"] = f"/api/devices/{existing['id']}"
        return DeviceResponse(
            id=updated["id"],
            fcm_token=updated.get("fcm_token", data.fcm_token),
            platform=updated.get("platform", data.platform),
            app_version=updated.get("app_version", data.app_version),
            device_model=updated.get("device_model", data.device_model),
            user_id=updated.get("user_id", user["uid"]),
            tenant_id=user["org_id"],
            created_at=updated.get("created_at", now),
            last_seen_at=updated.get("last_seen_at", now),
        )

    device_id = str(uuid.uuid4())
    payload = {
        "id": device_id,
        "fcm_token": data.fcm_token,
        "platform": data.platform,
        "app_version": data.app_version,
        "device_model": data.device_model,
        "user_id": user["uid"],
        "tenant_id": user["org_id"],
        "created_at": now,
        "last_seen_at": now,
    }
    repo.create(payload)
    response.headers["Location"] = f"/api/devices/{device_id}"
    return DeviceResponse(**payload)


@router.get("")
def list_devices(user: dict = Depends(get_current_user)):
    repo = MobileDeviceRepository(user["org_id"])
    rows = repo.list_for_user(user["uid"])
    return {"items": rows, "total": len(rows)}


@router.delete("/{device_id}", status_code=204)
def unregister_device(
    device_id: str,
    user: dict = Depends(get_current_user),
):
    repo = MobileDeviceRepository(user["org_id"])
    existing = repo.get(device_id)
    if not existing:
        # Idempotent delete — pretend it succeeded.
        return Response(status_code=204)
    if existing.get("user_id") != user["uid"]:
        # Don't allow unregistering someone else's device.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not your device")
    repo.delete(device_id)
    return Response(status_code=204)
