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
    WorkflowRepository,
    WorkflowRunRepository,
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


# ──────────────────────────── Visual Workflow Builder (Wave T) ────────────────────────────

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger: dict  # {event: str, filter: dict, cron_expr?: str}
    nodes: list[dict] = Field(default_factory=list)  # [{id, type, config, position:{x,y}}]
    edges: list[dict] = Field(default_factory=list)  # [{from_node_id, to_node_id, condition?}]
    active: bool = True


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger: Optional[dict] = None
    nodes: Optional[list[dict]] = None
    edges: Optional[list[dict]] = None
    active: Optional[bool] = None


@router.get("/workflows", dependencies=[Depends(require_perm("settings.read"))])
def list_workflows(active: Optional[bool] = None, user: dict = Depends(get_current_user)):
    repo = WorkflowRepository(user["org_id"])
    filters = []
    if active is not None:
        filters.append({"field": "active", "op": "==", "value": active})
    items, total = repo.list(filters=filters or None, limit=500, order_by="name")
    return {"items": items, "total": total}


@router.post("/workflows", status_code=201, dependencies=[Depends(require_perm("settings.update"))])
def create_workflow(data: WorkflowCreate, user: dict = Depends(get_current_user)):
    repo = WorkflowRepository(user["org_id"])
    payload = data.model_dump()
    payload["run_count"] = 0
    payload["last_run_at"] = None
    payload["created_at"] = datetime.utcnow().isoformat()
    payload["created_by_id"] = user["id"]
    return repo.create(payload)


@router.get("/workflows/{wid}", dependencies=[Depends(require_perm("settings.read"))])
def get_workflow(wid: str, user: dict = Depends(get_current_user)):
    repo = WorkflowRepository(user["org_id"])
    workflow = repo.get(wid)
    if not workflow:
        raise HTTPException(404, "workflow not found")
    return workflow


@router.put("/workflows/{wid}", dependencies=[Depends(require_perm("settings.update"))])
def update_workflow(wid: str, data: WorkflowUpdate, user: dict = Depends(get_current_user)):
    repo = WorkflowRepository(user["org_id"])
    if not repo.get(wid):
        raise HTTPException(404, "workflow not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    payload["updated_at"] = datetime.utcnow().isoformat()
    payload["updated_by_id"] = user["id"]
    return repo.update(wid, payload)


@router.delete("/workflows/{wid}", dependencies=[Depends(require_perm("settings.update"))])
def delete_workflow(wid: str, user: dict = Depends(get_current_user)):
    repo = WorkflowRepository(user["org_id"])
    if not repo.get(wid):
        raise HTTPException(404, "workflow not found")
    repo.delete(wid)
    return {"deleted": True}


@router.post("/workflows/{wid}/toggle", dependencies=[Depends(require_perm("settings.update"))])
def toggle_workflow(wid: str, user: dict = Depends(get_current_user)):
    """Flip active state."""
    repo = WorkflowRepository(user["org_id"])
    wf = repo.get(wid)
    if not wf:
        raise HTTPException(404, "workflow not found")
    new_state = not wf.get("active", True)
    repo.update(wid, {"active": new_state})
    return {"active": new_state}


@router.post("/workflows/{wid}/test-run", dependencies=[Depends(require_perm("settings.update"))])
def test_run_workflow(wid: str, sample_data: Optional[dict] = None, user: dict = Depends(get_current_user)):
    """Simulate execution without side effects. Returns step trace."""
    repo = WorkflowRepository(user["org_id"])
    wf = repo.get(wid)
    if not wf:
        raise HTTPException(404, "workflow not found")
    
    # Simple execution simulator
    trace = []
    nodes = wf.get("nodes", [])
    edges = wf.get("edges", [])
    trigger = wf.get("trigger", {})
    
    # Start with trigger data
    context = sample_data or {"test": True, "timestamp": datetime.utcnow().isoformat()}
    
    # Build execution graph
    node_map = {n["id"]: n for n in nodes}
    
    # Execute nodes in topological order (simplified: just iterate)
    for node in nodes:
        node_id = node["id"]
        node_type = node.get("type", "action")
        config = node.get("config", {})
        
        trace_entry = {
            "node_id": node_id,
            "type": node_type,
            "input": context.copy(),
            "status": "ok",
            "output": {},
        }
        
        try:
            if node_type == "condition":
                # Evaluate condition (mock)
                result = True  # In real impl: eval condition expr
                trace_entry["output"] = {"result": result, "branch": "true" if result else "false"}
            elif node_type == "action":
                action_type = config.get("action_type", "log")
                # Simulate action
                if action_type == "send_email":
                    trace_entry["output"] = {"mock": f"Would send email to {config.get('to', 'N/A')}"}
                elif action_type == "send_sms":
                    trace_entry["output"] = {"mock": f"Would send SMS to {config.get('phone', 'N/A')}"}
                elif action_type == "http_webhook":
                    trace_entry["output"] = {"mock": f"Would POST to {config.get('url', 'N/A')}"}
                else:
                    trace_entry["output"] = {"mock": f"Action {action_type} would execute"}
            elif node_type == "delay":
                delay_ms = config.get("delay_ms", 1000)
                trace_entry["output"] = {"mock": f"Would delay {delay_ms}ms"}
        except Exception as e:
            trace_entry["status"] = "error"
            trace_entry["error"] = str(e)
        
        trace.append(trace_entry)
    
    return {"trace": trace, "context": context}


@router.get("/workflows/{wid}/run-history", dependencies=[Depends(require_perm("settings.read"))])
def get_workflow_run_history(wid: str, limit: int = 50, user: dict = Depends(get_current_user)):
    """Get last N runs of this workflow."""
    repo = WorkflowRunRepository(user["org_id"])
    items, total = repo.list(
        filters=[{"field": "workflow_id", "op": "==", "value": wid}],
        limit=limit,
        order_by="ran_at",
        order_dir="DESCENDING",
    )
    return {"items": items, "total": total}


@router.get("/automation/triggers", dependencies=[Depends(require_perm("settings.read"))])
def list_available_triggers(user: dict = Depends(get_current_user)):
    """Static list of trigger events with sample data schemas."""
    triggers = [
        {
            "event": "invoice.created",
            "label": "Invoice Created",
            "sample_data": {"id": "INV-001", "customer": "Test Co", "amount": 1000, "currency": "IQD"},
        },
        {
            "event": "invoice.paid",
            "label": "Invoice Paid",
            "sample_data": {"id": "INV-001", "paid_amount": 1000, "paid_at": "2026-05-01T12:00:00Z"},
        },
        {
            "event": "bill.created",
            "label": "Bill Created",
            "sample_data": {"id": "BILL-001", "vendor": "Vendor Inc", "amount": 500},
        },
        {
            "event": "pos.sale",
            "label": "POS Sale Completed",
            "sample_data": {"session_id": "S001", "order_id": "O123", "total": 250},
        },
        {
            "event": "lead.created",
            "label": "CRM Lead Created",
            "sample_data": {"id": "L001", "name": "John Doe", "email": "john@example.com"},
        },
        {
            "event": "opportunity.won",
            "label": "Opportunity Won",
            "sample_data": {"id": "OPP-001", "value": 5000, "probability": 100},
        },
        {
            "event": "time.cron",
            "label": "Scheduled (Cron)",
            "sample_data": {"cron_expr": "0 9 * * *", "next_run": "2026-05-05T09:00:00Z"},
        },
        {
            "event": "webhook.received",
            "label": "Webhook Received",
            "sample_data": {"source": "external", "payload": {}},
        },
    ]
    return {"items": triggers, "total": len(triggers)}


@router.get("/automation/actions", dependencies=[Depends(require_perm("settings.read"))])
def list_available_actions(user: dict = Depends(get_current_user)):
    """Static list of action node types with config schema."""
    actions = [
        {
            "type": "send_email",
            "label": "Send Email",
            "config_fields": [
                {"name": "to", "type": "text", "required": True},
                {"name": "subject", "type": "text", "required": True},
                {"name": "body", "type": "textarea", "required": True},
            ],
        },
        {
            "type": "send_sms",
            "label": "Send SMS",
            "config_fields": [
                {"name": "phone", "type": "text", "required": True},
                {"name": "message", "type": "textarea", "required": True},
            ],
        },
        {
            "type": "send_whatsapp",
            "label": "Send WhatsApp",
            "config_fields": [
                {"name": "phone", "type": "text", "required": True},
                {"name": "message", "type": "textarea", "required": True},
            ],
        },
        {
            "type": "create_task",
            "label": "Create Task",
            "config_fields": [
                {"name": "title", "type": "text", "required": True},
                {"name": "assigned_to", "type": "text"},
                {"name": "due_date", "type": "date"},
            ],
        },
        {
            "type": "create_invoice",
            "label": "Create Invoice",
            "config_fields": [
                {"name": "customer_id", "type": "text", "required": True},
                {"name": "amount", "type": "number", "required": True},
            ],
        },
        {
            "type": "update_field",
            "label": "Update Field",
            "config_fields": [
                {"name": "entity", "type": "text", "required": True},
                {"name": "entity_id", "type": "text", "required": True},
                {"name": "field", "type": "text", "required": True},
                {"name": "value", "type": "text", "required": True},
            ],
        },
        {
            "type": "http_webhook",
            "label": "HTTP Webhook",
            "config_fields": [
                {"name": "url", "type": "text", "required": True},
                {"name": "method", "type": "select", "options": ["GET", "POST", "PUT"], "default": "POST"},
                {"name": "headers", "type": "textarea"},
                {"name": "body", "type": "textarea"},
            ],
        },
    ]
    return {"items": actions, "total": len(actions)}
