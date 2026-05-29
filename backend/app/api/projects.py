import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.projects import ProjectRepository, ProjectTaskRepository as TaskRepository
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services import settings_service

router = APIRouter(prefix="/api/projects", tags=["Projects"])

@router.get("", dependencies=[Depends(require_perm("projects.read"))])
def list_projects(page: int = Query(1), page_size: int = Query(20, le=500), user: dict = Depends(get_current_user)):
    repo = ProjectRepository(user["org_id"])
    items, total = repo.list(order_by="name", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("", status_code=201, dependencies=[Depends(require_perm("projects.write"))])
def create_project(data: dict, user: dict = Depends(get_current_user)):
    # Apply projects config defaults
    try:
        cfg = settings_service.get_bag(user["org_id"], "projects")
    except Exception:
        cfg = {}
    
    data.setdefault("default_billable_rate", cfg.get("default_billable_rate", 0))
    data.setdefault("timesheet_required", cfg.get("timesheet_required", False))
    
    repo = ProjectRepository(user["org_id"])
    project = repo.create({"id": str(uuid.uuid4()), **data})
    return project

@router.get("/{project_id}", dependencies=[Depends(require_perm("projects.read"))])
def get_project(project_id: str, user: dict = Depends(get_current_user)):
    """Get single project"""
    repo = ProjectRepository(user["org_id"])
    project = repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/{project_id}", dependencies=[Depends(require_perm("projects.write"))])
def update_project(project_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Update project"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    updated = repo.update(project_id, data)
    return updated

@router.delete("/{project_id}", dependencies=[Depends(require_perm("projects.delete"))])
def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    """Delete project"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    repo.delete(project_id)
    return {"message": "Project deleted"}

# ===================== TASKS =====================

@router.get("/{project_id}/tasks", dependencies=[Depends(require_perm("projects.read"))])
def list_tasks(project_id: str, user: dict = Depends(get_current_user)):
    """List project tasks"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = repo.get_lines(project_id, "tasks")
    return {"items": tasks}

@router.post("/{project_id}/tasks", status_code=201, dependencies=[Depends(require_perm("tasks.create"))])
def create_task(project_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Create project task"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    
    task_id = str(uuid.uuid4())
    task_data = {"id": task_id, **data}
    
    # Add to subcollection
    from app.firebase_client import get_db
    db = get_db()
    db.collection("projects").document(project_id).collection("tasks").document(task_id).set(task_data)
    
    return task_data

@router.put("/{project_id}/tasks/{task_id}", dependencies=[Depends(require_perm("tasks.update"))])
def update_task(project_id: str, task_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Update project task"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.firebase_client import get_db
    db = get_db()
    task_ref = db.collection("projects").document(project_id).collection("tasks").document(task_id)
    
    if not task_ref.get().exists:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task_ref.update(data)
    return {"id": task_id, **data}

@router.delete("/{project_id}/tasks/{task_id}", dependencies=[Depends(require_perm("tasks.delete"))])
def delete_task(project_id: str, task_id: str, user: dict = Depends(get_current_user)):
    """Delete project task"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.firebase_client import get_db
    db = get_db()
    db.collection("projects").document(project_id).collection("tasks").document(task_id).delete()
    
    return {"message": "Task deleted"}

# ===================== TIME ENTRIES =====================

@router.get("/{project_id}/time-entries", dependencies=[Depends(require_perm("projects.read"))])
def list_time_entries(project_id: str, user: dict = Depends(get_current_user)):
    """List project time entries"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    entries = repo.get_lines(project_id, "time_entries")
    return {"items": entries}

@router.post("/{project_id}/time-entries", status_code=201, dependencies=[Depends(require_perm("timesheets.create"))])
def create_time_entry(project_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Create time entry"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    
    entry_id = str(uuid.uuid4())
    entry_data = {"id": entry_id, "status": "pending", **data}
    
    from app.firebase_client import get_db
    db = get_db()
    db.collection("projects").document(project_id).collection("time_entries").document(entry_id).set(entry_data)
    
    return entry_data

@router.put("/{project_id}/time-entries/{entry_id}", dependencies=[Depends(require_perm("timesheets.update"))])
def update_time_entry(project_id: str, entry_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Update time entry"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.firebase_client import get_db
    db = get_db()
    entry_ref = db.collection("projects").document(project_id).collection("time_entries").document(entry_id)
    
    if not entry_ref.get().exists:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    entry_ref.update(data)
    return {"id": entry_id, **data}

@router.post("/{project_id}/time-entries/{entry_id}/approve", dependencies=[Depends(require_perm("timesheets.update"))])
def approve_time_entry(project_id: str, entry_id: str, user: dict = Depends(get_current_user)):
    """Approve timesheet entry"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.firebase_client import get_db
    from datetime import datetime
    db = get_db()
    entry_ref = db.collection("projects").document(project_id).collection("time_entries").document(entry_id)
    
    if not entry_ref.get().exists:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    entry_ref.update({
        "status": "approved",
        "approved_at": datetime.utcnow(),
        "approved_by": user["id"]
    })
    return {"message": "Time entry approved"}

# ===================== PROJECT BUDGET =====================

@router.get("/{project_id}/budget", dependencies=[Depends(require_perm("projects.read"))])
def get_project_budget(project_id: str, user: dict = Depends(get_current_user)):
    """Get project budget"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    
    class ProjectBudgetRepository(BaseRepository):
        collection_name = "project_budgets"
    
    budget_repo = ProjectBudgetRepository(user["org_id"])
    budgets, _ = budget_repo.list(
        filters=[{"field": "project_id", "op": "==", "value": project_id}],
        limit=1
    )
    
    if budgets:
        return budgets[0]
    return {"project_id": project_id, "budget": 0}

@router.post("/{project_id}/budget", dependencies=[Depends(require_perm("projects.write"))])
def set_project_budget(project_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Set/update project budget"""
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    
    class ProjectBudgetRepository(BaseRepository):
        collection_name = "project_budgets"
    
    budget_repo = ProjectBudgetRepository(user["org_id"])
    
    # Check if budget exists
    existing, _ = budget_repo.list(
        filters=[{"field": "project_id", "op": "==", "value": project_id}],
        limit=1
    )
    
    if existing:
        # Update existing
        budget = budget_repo.update(existing[0]["id"], data)
    else:
        # Create new
        budget = budget_repo.create({
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            **data
        })
    
    return budget


# ---------------- Sprint 25: Project KPIs + Weekly Timesheet Aggregation (FIX-381..390) ----------------

@router.get("/{project_id}/kpis", dependencies=[Depends(require_perm("projects.read"))])
def project_kpis(project_id: str, user: dict = Depends(get_current_user)):
    """Aggregate project KPIs: tasks open/done, total hours, billable hours, budget burn."""
    repo = ProjectRepository(user["org_id"])
    project = repo.get(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    tasks = repo.get_lines(project_id, "tasks")
    entries = repo.get_lines(project_id, "time_entries")
    open_tasks = sum(1 for t in tasks if t.get("status") not in ("done", "completed", "closed"))
    done_tasks = len(tasks) - open_tasks
    total_hours = sum(float(e.get("hours") or 0) for e in entries)
    approved_hours = sum(float(e.get("hours") or 0) for e in entries if e.get("status") == "approved")
    billable_hours = sum(float(e.get("hours") or 0) for e in entries if e.get("billable"))
    rate = float(project.get("hourly_rate") or 0)
    revenue = billable_hours * rate
    return {
        "project_id": project_id,
        "task_count": len(tasks),
        "open_tasks": open_tasks,
        "done_tasks": done_tasks,
        "total_hours": total_hours,
        "approved_hours": approved_hours,
        "billable_hours": billable_hours,
        "estimated_revenue": revenue,
    }


@router.get("/timesheets/weekly", dependencies=[Depends(require_perm("projects.read"))])
def weekly_timesheet(week_start: str, user_id: str = None,
                      user: dict = Depends(get_current_user)):
    """Aggregate one user's time entries for a week (Mon-Sun) across all projects."""
    from datetime import datetime as _dt, timedelta as _td
    try:
        ws = _dt.fromisoformat(week_start).date()
    except ValueError:
        raise HTTPException(400, "week_start must be YYYY-MM-DD")
    we = ws + _td(days=6)
    target_user = user_id or user["id"]
    proj_repo = ProjectRepository(user["org_id"])
    projects, _ = proj_repo.list(limit=500)
    rows: list = []
    total = 0.0
    for p in projects:
        entries = proj_repo.get_lines(p["id"], "time_entries")
        for e in entries:
            if e.get("user_id") != target_user:
                continue
            d = e.get("date") or e.get("entry_date")
            if not d:
                continue
            try:
                ed = _dt.fromisoformat(str(d)[:10]).date()
            except ValueError:
                continue
            if ws <= ed <= we:
                hrs = float(e.get("hours") or 0)
                rows.append({
                    "project_id": p["id"], "project_name": p.get("name"),
                    "date": ed.isoformat(), "hours": hrs,
                    "status": e.get("status"), "billable": bool(e.get("billable")),
                    "description": e.get("description"),
                })
                total += hrs
    return {
        "user_id": target_user, "week_start": ws.isoformat(), "week_end": we.isoformat(),
        "rows": rows, "total_hours": total,
    }


@router.post("/{project_id}/time-entries/{entry_id}/reject",
             dependencies=[Depends(require_perm("timesheets.update"))])
def reject_time_entry(project_id: str, entry_id: str, data: dict = None,
                      user: dict = Depends(get_current_user)):
    """Reject a pending timesheet entry with optional reason."""
    from datetime import datetime as _dt
    from app.firebase_client import get_db
    db = get_db()
    entry_ref = db.collection("projects").document(project_id).collection("time_entries").document(entry_id)
    snap = entry_ref.get()
    if not snap.exists:
        raise HTTPException(404, "Time entry not found")
    entry_ref.update({
        "status": "rejected",
        "rejected_at": _dt.utcnow(),
        "rejected_by": user["id"],
        "reject_reason": (data or {}).get("reason", ""),
    })
    return {"message": "Time entry rejected"}


@router.post("/{project_id}/invoice-billable",
             dependencies=[Depends(require_perm("invoices.create"))])
def invoice_billable(project_id: str, user: dict = Depends(get_current_user)):
    """Convert all approved+billable time entries into a draft Invoice line group."""
    from app.firestore.invoices import InvoiceRepository
    repo = ProjectRepository(user["org_id"])
    project = repo.get(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if not project.get("customer_id"):
        raise HTTPException(400, "Project missing customer_id")
    entries = repo.get_lines(project_id, "time_entries")
    rate = float(project.get("hourly_rate") or 0)
    lines = []
    invoiced_ids = []
    for e in entries:
        if e.get("status") == "approved" and e.get("billable") and not e.get("invoiced"):
            hrs = float(e.get("hours") or 0)
            lines.append({
                "description": e.get("description") or f"Time entry {e.get('id')}",
                "quantity": hrs, "unit_price": rate, "amount": hrs * rate,
            })
            invoiced_ids.append(e["id"])
    if not lines:
        raise HTTPException(400, "no billable approved entries to invoice")
    total = sum(l["amount"] for l in lines)
    inv = InvoiceRepository(user["org_id"]).create({
        "customer_id": project["customer_id"], "project_id": project_id,
        "status": "draft", "lines": lines, "subtotal": total, "total": total,
        "source": "project_billable",
    })
    # Mark entries invoiced
    from app.firebase_client import get_db
    db = get_db()
    for eid in invoiced_ids:
        db.collection("projects").document(project_id).collection("time_entries").document(eid).update(
            {"invoiced": True, "invoice_id": inv["id"]}
        )
    return {"invoice_id": inv["id"], "lines": len(lines), "total": total, "entries_invoiced": invoiced_ids}


# ===================== DEPENDENCIES (Wave C-1) =====================

@router.post("/{project_id}/dependencies", status_code=201, 
             dependencies=[Depends(require_perm("projects.write"))])
def create_dependency(project_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Create task dependency. Body: {predecessor_task_id, successor_task_id, type='finish_to_start'}"""
    from app.firestore.task_dependencies import TaskDependencyRepository
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(404, "Project not found")
    dep_repo = TaskDependencyRepository(user["org_id"])
    dep_id = str(uuid.uuid4())
    dep_data = {
        "id": dep_id,
        "project_id": project_id,
        "predecessor_task_id": data.get("predecessor_task_id"),
        "successor_task_id": data.get("successor_task_id"),
        "type": data.get("type", "finish_to_start"),
    }
    dep = dep_repo.create(dep_data)
    return dep


@router.get("/{project_id}/dependencies", dependencies=[Depends(require_perm("projects.read"))])
def list_dependencies(project_id: str, user: dict = Depends(get_current_user)):
    """List all task dependencies for a project"""
    from app.firestore.task_dependencies import TaskDependencyRepository
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(404, "Project not found")
    dep_repo = TaskDependencyRepository(user["org_id"])
    deps, total = dep_repo.list(
        filters=[{"field": "project_id", "op": "==", "value": project_id}],
        limit=500
    )
    return {"items": deps, "total": total}


@router.delete("/dependencies/{dep_id}", dependencies=[Depends(require_perm("projects.write"))])
def delete_dependency(dep_id: str, user: dict = Depends(get_current_user)):
    """Delete a task dependency"""
    from app.firestore.task_dependencies import TaskDependencyRepository
    dep_repo = TaskDependencyRepository(user["org_id"])
    dep = dep_repo.get(dep_id)
    if not dep:
        raise HTTPException(404, "Dependency not found")
    dep_repo.delete(dep_id)
    return {"message": "Dependency deleted"}


# ===================== MILESTONES (Wave C-1) =====================

@router.post("/{project_id}/milestones", status_code=201,
             dependencies=[Depends(require_perm("projects.write"))])
def create_milestone(project_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Create milestone. Body: {name, due_date, task_ids:[]}"""
    from app.firestore.project_milestones import ProjectMilestoneRepository
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(404, "Project not found")
    ms_repo = ProjectMilestoneRepository(user["org_id"])
    ms_id = str(uuid.uuid4())
    ms_data = {
        "id": ms_id,
        "project_id": project_id,
        "name": data.get("name"),
        "due_date": data.get("due_date"),
        "task_ids": data.get("task_ids", []),
        "done": False,
    }
    ms = ms_repo.create(ms_data)
    return ms


@router.get("/{project_id}/milestones", dependencies=[Depends(require_perm("projects.read"))])
def list_milestones(project_id: str, user: dict = Depends(get_current_user)):
    """List all milestones for a project"""
    from app.firestore.project_milestones import ProjectMilestoneRepository
    repo = ProjectRepository(user["org_id"])
    if not repo.get(project_id):
        raise HTTPException(404, "Project not found")
    ms_repo = ProjectMilestoneRepository(user["org_id"])
    milestones, total = ms_repo.list(
        filters=[{"field": "project_id", "op": "==", "value": project_id}],
        order_by="due_date",
        limit=500
    )
    return {"items": milestones, "total": total}


@router.put("/milestones/{milestone_id}/complete",
            dependencies=[Depends(require_perm("projects.write"))])
def complete_milestone(milestone_id: str, user: dict = Depends(get_current_user)):
    """Mark milestone as done"""
    from app.firestore.project_milestones import ProjectMilestoneRepository
    from datetime import datetime
    ms_repo = ProjectMilestoneRepository(user["org_id"])
    ms = ms_repo.get(milestone_id)
    if not ms:
        raise HTTPException(404, "Milestone not found")
    ms_repo.update(milestone_id, {"done": True, "completed_at": datetime.utcnow()})
    return {"message": "Milestone marked complete"}


# ===================== GANTT DATA (Wave C-1) =====================

@router.get("/{project_id}/gantt", dependencies=[Depends(require_perm("projects.read"))])
def get_gantt_data(project_id: str, user: dict = Depends(get_current_user)):
    """Get Gantt chart data: tasks + dependencies + milestones"""
    from app.firestore.task_dependencies import TaskDependencyRepository
    from app.firestore.project_milestones import ProjectMilestoneRepository
    from datetime import datetime, timedelta
    
    repo = ProjectRepository(user["org_id"])
    project = repo.get(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    
    # Get tasks
    tasks = repo.get_lines(project_id, "tasks")
    
    # Transform tasks for Gantt
    gantt_tasks = []
    for t in tasks:
        start = t.get("start_date") or t.get("created_at")
        if isinstance(start, str):
            start = start[:10]
        end = t.get("end_date") or t.get("due_date")
        if not end and start:
            # Default to 3 days duration if no end date
            try:
                end_dt = datetime.fromisoformat(str(start)[:10]) + timedelta(days=3)
                end = end_dt.strftime("%Y-%m-%d")
            except:
                end = start
        if isinstance(end, str):
            end = end[:10]
        
        gantt_tasks.append({
            "id": t.get("id"),
            "name": t.get("name") or t.get("title") or "Unnamed Task",
            "start": start,
            "end": end,
            "progress": t.get("progress") or t.get("progress_percent") or 0,
            "billable": t.get("billable", False),
            "status": t.get("status", "open"),
        })
    
    # Get dependencies
    dep_repo = TaskDependencyRepository(user["org_id"])
    deps, _ = dep_repo.list(
        filters=[{"field": "project_id", "op": "==", "value": project_id}],
        limit=500
    )
    
    # Get milestones
    ms_repo = ProjectMilestoneRepository(user["org_id"])
    milestones, _ = ms_repo.list(
        filters=[{"field": "project_id", "op": "==", "value": project_id}],
        order_by="due_date",
        limit=500
    )
    
    return {
        "project_id": project_id,
        "project_name": project.get("name"),
        "tasks": gantt_tasks,
        "dependencies": deps,
        "milestones": milestones,
    }
