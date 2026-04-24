"""Sprint 20: Odoo-style Automated Actions + Server Actions + Scheduled Jobs (FIX-281..295).

- Automated Actions: trigger-driven (e.g. on_create:invoice → call URL, send email, create activity)
- Scheduled Jobs: cron-style with last_run + next_run tracking
- Server Actions: manually invokable named operations
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.firestore.automation import (
    AutomatedActionRepository,
    ScheduledJobRepository,
    ServerActionRepository,
    AutomationLogRepository,
)
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/automation", tags=["Automation"])


# ──────────────────────────── Schemas ────────────────────────────

class AutomatedActionCreate(BaseModel):
    name: str
    entity_type: str  # invoice | lead | opportunity | bill | etc.
    trigger: str  # on_create | on_update | on_status_change | on_delete
    condition: Optional[str] = None  # python expr-like, e.g. "amount > 1000"
    action_type: str  # send_email | create_activity | webhook | log
    action_config: dict = Field(default_factory=dict)
    active: bool = True


class AutomatedActionUpdate(BaseModel):
    name: Optional[str] = None
    entity_type: Optional[str] = None
    trigger: Optional[str] = None
    condition: Optional[str] = None
    action_type: Optional[str] = None
    action_config: Optional[dict] = None
    active: Optional[bool] = None


class ScheduledJobCreate(BaseModel):
    name: str
    server_action_id: Optional[str] = None
    interval_minutes: int = 60
    active: bool = True
    description: Optional[str] = None


class ScheduledJobUpdate(BaseModel):
    name: Optional[str] = None
    server_action_id: Optional[str] = None
    interval_minutes: Optional[int] = None
    active: Optional[bool] = None
    description: Optional[str] = None


class ServerActionCreate(BaseModel):
    name: str
    code: str  # safe action identifier (mapped server-side, NOT eval'd)
    description: Optional[str] = None


# ──────────────────────────── Automated Actions ────────────────────────────

@router.get("/automated-actions", dependencies=[Depends(require_perm("settings.read"))])
def list_automated_actions(entity_type: Optional[str] = None,
                           active: Optional[bool] = None,
                           user: dict = Depends(get_current_user)):
    repo = AutomatedActionRepository(user["org_id"])
    filters = []
    if entity_type:
        filters.append({"field": "entity_type", "op": "==", "value": entity_type})
    if active is not None:
        filters.append({"field": "active", "op": "==", "value": active})
    items, total = repo.list(filters=filters or None, limit=500, order_by="name")
    return {"items": items, "total": total}


@router.post("/automated-actions", status_code=201,
             dependencies=[Depends(require_perm("settings.update"))])
def create_automated_action(data: AutomatedActionCreate, user: dict = Depends(get_current_user)):
    repo = AutomatedActionRepository(user["org_id"])
    return repo.create(data.model_dump())


@router.put("/automated-actions/{action_id}",
            dependencies=[Depends(require_perm("settings.update"))])
def update_automated_action(action_id: str, data: AutomatedActionUpdate,
                            user: dict = Depends(get_current_user)):
    repo = AutomatedActionRepository(user["org_id"])
    if not repo.get(action_id):
        raise HTTPException(404, "automated action not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return repo.update(action_id, payload)


@router.delete("/automated-actions/{action_id}",
               dependencies=[Depends(require_perm("settings.update"))])
def delete_automated_action(action_id: str, user: dict = Depends(get_current_user)):
    repo = AutomatedActionRepository(user["org_id"])
    if not repo.get(action_id):
        raise HTTPException(404, "automated action not found")
    repo.delete(action_id)
    return {"deleted": True}


# ──────────────────────────── Scheduled Jobs ────────────────────────────

@router.get("/scheduled-jobs", dependencies=[Depends(require_perm("settings.read"))])
def list_scheduled_jobs(active: Optional[bool] = None, user: dict = Depends(get_current_user)):
    repo = ScheduledJobRepository(user["org_id"])
    filters = []
    if active is not None:
        filters.append({"field": "active", "op": "==", "value": active})
    items, total = repo.list(filters=filters or None, limit=500, order_by="name")
    return {"items": items, "total": total}


@router.post("/scheduled-jobs", status_code=201,
             dependencies=[Depends(require_perm("settings.update"))])
def create_scheduled_job(data: ScheduledJobCreate, user: dict = Depends(get_current_user)):
    repo = ScheduledJobRepository(user["org_id"])
    payload = data.model_dump()
    payload["last_run_at"] = None
    payload["next_run_at"] = (datetime.utcnow() + timedelta(minutes=data.interval_minutes)).isoformat()
    payload["run_count"] = 0
    return repo.create(payload)


@router.put("/scheduled-jobs/{job_id}",
            dependencies=[Depends(require_perm("settings.update"))])
def update_scheduled_job(job_id: str, data: ScheduledJobUpdate,
                         user: dict = Depends(get_current_user)):
    repo = ScheduledJobRepository(user["org_id"])
    if not repo.get(job_id):
        raise HTTPException(404, "scheduled job not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    if "interval_minutes" in payload:
        payload["next_run_at"] = (datetime.utcnow() + timedelta(minutes=payload["interval_minutes"])).isoformat()
    return repo.update(job_id, payload)


@router.delete("/scheduled-jobs/{job_id}",
               dependencies=[Depends(require_perm("settings.update"))])
def delete_scheduled_job(job_id: str, user: dict = Depends(get_current_user)):
    repo = ScheduledJobRepository(user["org_id"])
    if not repo.get(job_id):
        raise HTTPException(404, "scheduled job not found")
    repo.delete(job_id)
    return {"deleted": True}


@router.post("/scheduled-jobs/{job_id}/run-now",
             dependencies=[Depends(require_perm("settings.update"))])
def run_job_now(job_id: str, user: dict = Depends(get_current_user)):
    """Manually trigger a scheduled job. Updates last_run + next_run + run_count."""
    repo = ScheduledJobRepository(user["org_id"])
    job = repo.get(job_id)
    if not job:
        raise HTTPException(404, "scheduled job not found")
    now = datetime.utcnow()
    interval = int(job.get("interval_minutes") or 60)
    AutomationLogRepository(user["org_id"]).create({
        "job_id": job_id,
        "job_name": job.get("name"),
        "ran_at": now.isoformat(),
        "ran_by_id": user["id"],
        "trigger": "manual",
        "result": "ok",
    })
    return repo.update(job_id, {
        "last_run_at": now.isoformat(),
        "next_run_at": (now + timedelta(minutes=interval)).isoformat(),
        "run_count": int(job.get("run_count") or 0) + 1,
    })


@router.get("/scheduled-jobs/due")
def list_due_jobs(user: dict = Depends(get_current_user)):
    """List jobs whose next_run_at has passed (cron-runner consumer)."""
    repo = ScheduledJobRepository(user["org_id"])
    items, _ = repo.list(filters=[{"field": "active", "op": "==", "value": True}], limit=500)
    now_iso = datetime.utcnow().isoformat()
    due = [j for j in items if j.get("next_run_at") and j["next_run_at"] <= now_iso]
    return {"items": due, "total": len(due)}


# ──────────────────────────── Server Actions ────────────────────────────

@router.get("/server-actions", dependencies=[Depends(require_perm("settings.read"))])
def list_server_actions(user: dict = Depends(get_current_user)):
    repo = ServerActionRepository(user["org_id"])
    items, total = repo.list(limit=500, order_by="name")
    return {"items": items, "total": total}


@router.post("/server-actions", status_code=201,
             dependencies=[Depends(require_perm("settings.update"))])
def create_server_action(data: ServerActionCreate, user: dict = Depends(get_current_user)):
    repo = ServerActionRepository(user["org_id"])
    return repo.create(data.model_dump())


@router.delete("/server-actions/{action_id}",
               dependencies=[Depends(require_perm("settings.update"))])
def delete_server_action(action_id: str, user: dict = Depends(get_current_user)):
    repo = ServerActionRepository(user["org_id"])
    if not repo.get(action_id):
        raise HTTPException(404, "server action not found")
    repo.delete(action_id)
    return {"deleted": True}


# ──────────────────────────── Logs ────────────────────────────

@router.get("/logs", dependencies=[Depends(require_perm("settings.read"))])
def list_automation_logs(limit: int = 200, user: dict = Depends(get_current_user)):
    repo = AutomationLogRepository(user["org_id"])
    items, total = repo.list(limit=limit, order_by="ran_at", order_dir="DESCENDING")
    return {"items": items, "total": total}
