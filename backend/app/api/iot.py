"""Sprint 54: IoT Integration — devices, sensor readings, alerts.

FIX-1701..FIX-1725.
Wave V: Telemetry + Device Management UI backend.
"""
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
import uuid

router = APIRouter(prefix="/api/iot", tags=["IoT"])


class IoTDeviceRepo(BaseRepository):
    collection_name = "iot_devices"


class IoTTelemetryRepo(BaseRepository):
    collection_name = "iot_telemetry"


class IoTAlertRepo(BaseRepository):
    collection_name = "iot_alerts"


class IoTAlertRuleRepo(BaseRepository):
    collection_name = "iot_alert_rules"


class DeviceCreate(BaseModel):
    name: str
    device_type: str = Field("sensor", pattern=r"^(sensor|printer|camera|scanner|gateway|other)$")
    serial_number: Optional[str] = None
    location: Optional[str] = None
    metadata: Optional[dict] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    device_type: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    metadata: Optional[dict] = None
    status: Optional[str] = Field(None, pattern=r"^(active|inactive|error)$")


class TelemetryReading(BaseModel):
    metric: str
    value: float
    unit: Optional[str] = None
    timestamp: str


class TelemetryIngest(BaseModel):
    device_id: str
    api_key: str
    readings: List[TelemetryReading]


class AlertRuleCreate(BaseModel):
    device_id: str
    metric: str
    operator: str = Field(">", pattern=r"^(gt|lt|gte|lte|eq)$")
    threshold: float
    duration_sec: int = 0
    severity: str = Field("warn", pattern=r"^(info|warn|critical)$")
    action: str = Field("log", pattern=r"^(log|email|webhook)$")
    recipient: Optional[str] = None
    active: bool = True


def _own(repo, doc_id, org_id):
    item = repo.get(doc_id)
    if not item or item.get("org_id") != org_id:
        raise HTTPException(404, "نەدۆزرایەوە")
    return item


def _get_device_status(last_seen_at: Optional[str]) -> str:
    """Determine device online/offline/error based on last_seen_at"""
    if not last_seen_at:
        return "inactive"
    try:
        last_seen = datetime.fromisoformat(last_seen_at.replace("Z", "+00:00"))
        now = datetime.utcnow()
        if (now - last_seen) < timedelta(minutes=5):
            return "active"
        return "inactive"
    except:
        return "error"


# ============= DEVICES =============
@router.get("/devices")
def list_devices(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    location: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = 0
):
    repo = IoTDeviceRepo(user["org_id"])
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    if device_type:
        filters.append({"field": "device_type", "op": "==", "value": device_type})
    if location:
        filters.append({"field": "location", "op": "==", "value": location})
    
    items, total = repo.list(filters=filters, limit=limit, offset=offset)
    # Update online status dynamically
    for item in items:
        item["status"] = _get_device_status(item.get("last_seen_at"))
    return {"items": items, "total": total}


@router.post("/devices", status_code=201)
def create_device(body: DeviceCreate, user: dict = Depends(get_current_user)):
    repo = IoTDeviceRepo(user["org_id"])
    data = body.model_dump()
    data["api_key"] = uuid.uuid4().hex  # 32-char key
    data["status"] = "inactive"
    data["last_seen_at"] = None
    return repo.create(data)


@router.get("/devices/{did}")
def get_device(did: str, user: dict = Depends(get_current_user)):
    device = _own(IoTDeviceRepo(user["org_id"]), did, user["org_id"])
    device["status"] = _get_device_status(device.get("last_seen_at"))
    return device


@router.put("/devices/{did}")
def update_device(did: str, body: DeviceUpdate, user: dict = Depends(get_current_user)):
    repo = IoTDeviceRepo(user["org_id"])
    _own(repo, did, user["org_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return repo.update(did, updates)


@router.delete("/devices/{did}", status_code=204)
def delete_device(did: str, user: dict = Depends(get_current_user)):
    repo = IoTDeviceRepo(user["org_id"])
    _own(repo, did, user["org_id"])
    repo.delete(did)


@router.post("/devices/{did}/regenerate-key")
def regenerate_api_key(did: str, user: dict = Depends(get_current_user)):
    repo = IoTDeviceRepo(user["org_id"])
    _own(repo, did, user["org_id"])
    new_key = uuid.uuid4().hex
    return repo.update(did, {"api_key": new_key})


# ============= TELEMETRY =============
@router.post("/telemetry", status_code=201)
def ingest_telemetry(body: TelemetryIngest):
    """Public endpoint — auth via api_key in body (no JWT required)"""
    # Find device by api_key across all orgs
    db = IoTDeviceRepo("").db  # Get raw db
    devices = db.collection("iot_devices").where("api_key", "==", body.api_key).limit(1).stream()
    device = None
    for doc in devices:
        device = {"id": doc.id, **doc.to_dict()}
        break
    
    if not device or device["id"] != body.device_id:
        raise HTTPException(401, "Invalid api_key or device_id")
    
    org_id = device["org_id"]
    telemetry_repo = IoTTelemetryRepo(org_id)
    device_repo = IoTDeviceRepo(org_id)
    
    # Store readings
    for reading in body.readings:
        telemetry_repo.create({
            "device_id": body.device_id,
            "metric": reading.metric,
            "value": reading.value,
            "unit": reading.unit,
            "timestamp": reading.timestamp,
        })
    
    # Update device last_seen
    device_repo.update(body.device_id, {"last_seen_at": datetime.utcnow().isoformat()})
    
    # Cap telemetry per device (simple: if > 100k, delete oldest 1k)
    filters = [{"field": "device_id", "op": "==", "value": body.device_id}]
    items, total = telemetry_repo.list(filters=filters, limit=1)
    if total > 100000:
        oldest, _ = telemetry_repo.list(filters=filters, order_by="timestamp", order_dir="ASCENDING", limit=1000)
        for old in oldest:
            telemetry_repo.delete(old["id"])
    
    return {"status": "ok", "readings_count": len(body.readings)}


@router.get("/devices/{did}/telemetry")
def get_device_telemetry(
    did: str,
    user: dict = Depends(get_current_user),
    metric: Optional[str] = None,
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    limit: int = Query(1000, ge=1, le=10000)
):
    _own(IoTDeviceRepo(user["org_id"]), did, user["org_id"])
    repo = IoTTelemetryRepo(user["org_id"])
    
    filters = [{"field": "device_id", "op": "==", "value": did}]
    if metric:
        filters.append({"field": "metric", "op": "==", "value": metric})
    if from_time:
        filters.append({"field": "timestamp", "op": ">=", "value": from_time})
    if to_time:
        filters.append({"field": "timestamp", "op": "<=", "value": to_time})
    
    items, total = repo.list(filters=filters, order_by="timestamp", order_dir="DESCENDING", limit=limit)
    return {"items": items, "total": total}


@router.get("/devices/{did}/latest")
def get_device_latest(did: str, user: dict = Depends(get_current_user)):
    _own(IoTDeviceRepo(user["org_id"]), did, user["org_id"])
    repo = IoTTelemetryRepo(user["org_id"])
    
    filters = [{"field": "device_id", "op": "==", "value": did}]
    items, _ = repo.list(filters=filters, order_by="timestamp", order_dir="DESCENDING", limit=100)
    
    # Group by metric, take first (latest) of each
    latest_by_metric = {}
    for item in items:
        metric = item["metric"]
        if metric not in latest_by_metric:
            latest_by_metric[metric] = item
    
    return {"readings": list(latest_by_metric.values())}


# ============= ALERT RULES =============
@router.get("/alert-rules")
def list_alert_rules(
    user: dict = Depends(get_current_user),
    device_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = 0
):
    filters = []
    if device_id:
        filters.append({"field": "device_id", "op": "==", "value": device_id})
    items, total = IoTAlertRuleRepo(user["org_id"]).list(filters=filters, limit=limit, offset=offset)
    return {"items": items, "total": total}


@router.post("/alert-rules", status_code=201)
def create_alert_rule(body: AlertRuleCreate, user: dict = Depends(get_current_user)):
    _own(IoTDeviceRepo(user["org_id"]), body.device_id, user["org_id"])
    return IoTAlertRuleRepo(user["org_id"]).create(body.model_dump())


@router.put("/alert-rules/{rid}")
def update_alert_rule(rid: str, body: AlertRuleCreate, user: dict = Depends(get_current_user)):
    repo = IoTAlertRuleRepo(user["org_id"])
    _own(repo, rid, user["org_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return repo.update(rid, updates)


@router.delete("/alert-rules/{rid}", status_code=204)
def delete_alert_rule(rid: str, user: dict = Depends(get_current_user)):
    repo = IoTAlertRuleRepo(user["org_id"])
    _own(repo, rid, user["org_id"])
    repo.delete(rid)


# ============= ALERTS =============
@router.get("/alerts")
def list_alerts(
    user: dict = Depends(get_current_user),
    severity: Optional[str] = None,
    device_id: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = 0
):
    filters = []
    if severity:
        filters.append({"field": "severity", "op": "==", "value": severity})
    if device_id:
        filters.append({"field": "device_id", "op": "==", "value": device_id})
    if acknowledged is not None:
        filters.append({"field": "acknowledged", "op": "==", "value": acknowledged})
    
    items, total = IoTAlertRepo(user["org_id"]).list(
        filters=filters, order_by="triggered_at", order_dir="DESCENDING", limit=limit, offset=offset
    )
    return {"items": items, "total": total}


@router.post("/alerts/{aid}/ack")
def acknowledge_alert(aid: str, user: dict = Depends(get_current_user)):
    repo = IoTAlertRepo(user["org_id"])
    _own(repo, aid, user["org_id"])
    return repo.update(aid, {
        "acknowledged": True,
        "acknowledged_at": datetime.utcnow().isoformat(),
        "acknowledged_by": user.get("email")
    })

