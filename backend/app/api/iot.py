"""Sprint 54: IoT Integration — devices, sensor readings, alerts.

FIX-1701..FIX-1725.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/iot", tags=["IoT"])


class IoTDeviceRepo(BaseRepository):
    collection_name = "iot_devices"


class IoTReadingRepo(BaseRepository):
    collection_name = "iot_readings"


class IoTAlertRepo(BaseRepository):
    collection_name = "iot_alerts"


class IoTRuleRepo(BaseRepository):
    collection_name = "iot_rules"


class DeviceCreate(BaseModel):
    name: str
    type: str = Field("sensor", pattern=r"^(sensor|printer|camera|scanner|gateway)$")
    serial_no: Optional[str] = None
    location: Optional[str] = None
    is_online: bool = False


class ReadingCreate(BaseModel):
    device_id: str
    metric: str
    value: float
    unit: Optional[str] = None
    timestamp: Optional[str] = None


class AlertCreate(BaseModel):
    device_id: str
    severity: str = Field("warning", pattern=r"^(info|warning|error|critical)$")
    message: str


class RuleCreate(BaseModel):
    device_id: Optional[str] = None
    metric: str
    operator: str = Field(">", pattern=r"^(>|<|>=|<=|==|!=)$")
    threshold: float
    action: str = "alert"
    is_active: bool = True


def _own(repo, doc_id, org_id):
    item = repo.get(doc_id)
    if not item or item.get("org_id") != org_id:
        raise HTTPException(404, "نەدۆزرایەوە")
    return item


def _quick(prefix, repo_cls, model):
    @router.get(prefix)
    def _ls(user: dict = Depends(get_current_user), limit: int = Query(50, ge=1, le=500), offset: int = 0):
        items, total = repo_cls(user["org_id"]).list(limit=limit, offset=offset)
        return {"items": items, "total": total}

    @router.post(prefix, status_code=201)
    def _cr(body: model, user: dict = Depends(get_current_user)):
        return repo_cls(user["org_id"]).create(body.model_dump())

    @router.get(prefix + "/{rid}")
    def _gt(rid: str, user: dict = Depends(get_current_user)):
        return _own(repo_cls(user["org_id"]), rid, user["org_id"])

    @router.patch(prefix + "/{rid}")
    def _up(rid: str, body: model, user: dict = Depends(get_current_user)):
        repo = repo_cls(user["org_id"])
        _own(repo, rid, user["org_id"])
        return repo.update(rid, {k: v for k, v in body.model_dump().items() if v is not None})

    @router.delete(prefix + "/{rid}", status_code=204)
    def _dl(rid: str, user: dict = Depends(get_current_user)):
        repo = repo_cls(user["org_id"])
        _own(repo, rid, user["org_id"])
        repo.delete(rid)


_quick("/devices", IoTDeviceRepo, DeviceCreate)
_quick("/readings", IoTReadingRepo, ReadingCreate)
_quick("/alerts", IoTAlertRepo, AlertCreate)
_quick("/rules", IoTRuleRepo, RuleCreate)


@router.get("/devices/{did}/readings")
def device_readings(did: str, user: dict = Depends(get_current_user), limit: int = Query(100, ge=1, le=1000)):
    items, total = IoTReadingRepo(user["org_id"]).list(
        filters=[{"field": "device_id", "op": "==", "value": did}],
        order_by="created_at", order_dir="DESCENDING", limit=limit,
    )
    return {"items": items, "total": total}


@router.post("/alerts/{aid}/acknowledge")
def ack_alert(aid: str, user: dict = Depends(get_current_user)):
    repo = IoTAlertRepo(user["org_id"])
    _own(repo, aid, user["org_id"])
    return repo.update(aid, {"acknowledged": True, "acknowledged_at": datetime.utcnow().isoformat()})
