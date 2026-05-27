"""Sprint 41b: Maintenance — equipment, work orders, MTBF/MTTR, preventive schedules.

FIX-1206..FIX-1230.
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/maintenance", tags=["Maintenance"])


class EquipmentRepo(BaseRepository):
    collection_name = "maint_equipment"


class EquipmentCategoryRepo(BaseRepository):
    collection_name = "maint_equipment_categories"


class MaintRequestRepo(BaseRepository):
    collection_name = "maint_requests"


class MaintScheduleRepo(BaseRepository):
    collection_name = "maint_schedules"


class MaintLogRepo(BaseRepository):
    collection_name = "maint_logs"


class EquipmentCreate(BaseModel):
    name: str
    serial_no: Optional[str] = None
    category_id: Optional[str] = None
    location: Optional[str] = None
    purchase_date: Optional[str] = None
    purchase_value: float = 0.0
    warranty_until: Optional[str] = None
    is_active: bool = True


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RequestCreate(BaseModel):
    equipment_id: str
    title: str
    description: Optional[str] = None
    type: str = Field("corrective", pattern=r"^(corrective|preventive|inspection)$")
    priority: str = Field("medium", pattern=r"^(low|medium|high|urgent)$")
    requested_by: Optional[str] = None
    assigned_to: Optional[str] = None
    scheduled_at: Optional[str] = None


class ScheduleCreate(BaseModel):
    equipment_id: str
    interval_days: int = Field(30, ge=1, le=3650)
    description: Optional[str] = None
    next_due_date: Optional[str] = None


class LogCreate(BaseModel):
    equipment_id: str
    action: str
    notes: Optional[str] = None
    duration_minutes: Optional[int] = None


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


_quick("/equipment", EquipmentRepo, EquipmentCreate)
_quick("/categories", EquipmentCategoryRepo, CategoryCreate)
_quick("/requests", MaintRequestRepo, RequestCreate)
_quick("/schedules", MaintScheduleRepo, ScheduleCreate)
_quick("/logs", MaintLogRepo, LogCreate)


@router.post("/requests/{rid}/start")
def start_req(rid: str, user: dict = Depends(get_current_user)):
    repo = MaintRequestRepo(user["org_id"])
    _own(repo, rid, user["org_id"])
    return repo.update(rid, {"status": "in_progress", "started_at": datetime.utcnow().isoformat()})


@router.post("/requests/{rid}/complete")
def complete_req(rid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = MaintRequestRepo(user["org_id"])
    req = _own(repo, rid, user["org_id"])
    now = datetime.utcnow()
    duration = None
    if req.get("started_at"):
        try:
            started = datetime.fromisoformat(req["started_at"])
            duration = round((now - started).total_seconds() / 60.0, 2)
        except Exception:
            pass
    return repo.update(rid, {
        "status": "done",
        "completed_at": now.isoformat(),
        "duration_minutes": duration,
        "resolution_notes": body.get("notes"),
    })


@router.get("/equipment/{eid}/mtbf")
def mtbf_metric(eid: str, user: dict = Depends(get_current_user)):
    """Mean Time Between Failures."""
    reqs, _ = MaintRequestRepo(user["org_id"]).list(
        filters=[
            {"field": "equipment_id", "op": "==", "value": eid},
            {"field": "type", "op": "==", "value": "corrective"},
        ], limit=10000,
    )
    if len(reqs) < 2:
        return {"mtbf_hours": None, "failures": len(reqs)}
    times = sorted(r.get("created_at") for r in reqs if r.get("created_at"))
    if len(times) < 2:
        return {"mtbf_hours": None, "failures": len(times)}
    deltas = []
    for i in range(1, len(times)):
        try:
            t1 = times[i] if isinstance(times[i], datetime) else datetime.fromisoformat(str(times[i]))
            t0 = times[i-1] if isinstance(times[i-1], datetime) else datetime.fromisoformat(str(times[i-1]))
            deltas.append((t1 - t0).total_seconds() / 3600.0)
        except Exception:
            pass
    return {
        "mtbf_hours": round(sum(deltas) / len(deltas), 2) if deltas else None,
        "failures": len(reqs),
    }


@router.get("/equipment/{eid}/mttr")
def mttr_metric(eid: str, user: dict = Depends(get_current_user)):
    """Mean Time To Repair."""
    reqs, _ = MaintRequestRepo(user["org_id"]).list(
        filters=[
            {"field": "equipment_id", "op": "==", "value": eid},
            {"field": "status", "op": "==", "value": "done"},
        ], limit=10000,
    )
    durations = [float(r["duration_minutes"]) for r in reqs if r.get("duration_minutes")]
    return {
        "mttr_minutes": round(sum(durations) / len(durations), 2) if durations else None,
        "completed": len(durations),
    }


@router.get("/dashboard")
def maint_dashboard(user: dict = Depends(get_current_user)):
    eq = collect_stream(EquipmentRepo(user["org_id"]), max_docs=10000)
    reqs = collect_stream(MaintRequestRepo(user["org_id"]), max_docs=10000)
    by_status: dict[str, int] = {}
    for r in reqs:
        by_status[r.get("status", "new")] = by_status.get(r.get("status", "new"), 0) + 1
    return {
        "equipment_count": len(eq),
        "active_equipment": sum(1 for e in eq if e.get("is_active")),
        "requests_total": len(reqs),
        "by_status": by_status,
    }
