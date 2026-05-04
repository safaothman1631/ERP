"""API endpoints for background job monitoring and control (Wave L)."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from pydantic import BaseModel
from typing import Optional
from app.firestore.job_runs import JobRunRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


class JobTriggerRequest(BaseModel):
    """Request body for manual job trigger (currently empty, may add params later)."""
    pass


@router.get("/runs", dependencies=[Depends(require_perm("admin"))])
def list_job_runs(
    job_name: Optional[str] = Query(None, description="Filter by job name"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user)
):
    """List recent job runs with optional filters."""
    org_id = user.get("org_id")
    repo = JobRunRepository(org_id)
    
    filters = []
    if job_name:
        filters.append({"field": "job_name", "op": "==", "value": job_name})
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    
    items, total = repo.list(
        filters=filters,
        limit=limit,
        order_by="started_at",
        order_dir="DESCENDING"
    )
    
    return {"items": items, "total": total}


@router.get("/runs/{run_id}", dependencies=[Depends(require_perm("admin"))])
def get_job_run(
    run_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Get full details of a specific job run including errors."""
    org_id = user.get("org_id")
    repo = JobRunRepository(org_id)
    
    run = repo.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Job run not found")
    
    return run


@router.get("/status", dependencies=[Depends(require_perm("admin"))])
def get_jobs_status(user: dict = Depends(get_current_user)):
    """Get status of all registered jobs including next run times."""
    from app.services.scheduler import get_scheduler
    
    scheduler = get_scheduler()
    
    if scheduler is None:
        return {
            "scheduler_running": False,
            "jobs": [],
            "message": "Scheduler is not running (disabled or not started)"
        }
    
    jobs_info = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        jobs_info.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": next_run.isoformat() if next_run else None,
            "trigger": str(job.trigger),
        })
    
    # Get last run info for each job
    org_id = user.get("org_id")
    repo = JobRunRepository(org_id)
    
    for job_info in jobs_info:
        last_run = repo.get_last_run(job_info["id"])
        if last_run:
            job_info["last_run"] = {
                "started_at": last_run.get("started_at"),
                "status": last_run.get("status"),
                "items_processed": last_run.get("items_processed", 0),
                "items_failed": last_run.get("items_failed", 0),
                "duration_ms": last_run.get("duration_ms", 0),
            }
        else:
            job_info["last_run"] = None
    
    return {
        "scheduler_running": True,
        "jobs": jobs_info,
    }


@router.post("/{job_name}/trigger", dependencies=[Depends(require_perm("admin"))])
def trigger_job(
    job_name: str = Path(..., description="Job ID to trigger"),
    user: dict = Depends(get_current_user)
):
    """Manually trigger a job to run immediately."""
    from app.services.scheduler import get_scheduler
    
    scheduler = get_scheduler()
    
    if scheduler is None:
        raise HTTPException(
            status_code=503,
            detail="Scheduler is not running"
        )
    
    # Check if job exists
    job = scheduler.get_job(job_name)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job '{job_name}' not found"
        )
    
    # Trigger the job immediately (run once, doesn't affect schedule)
    job.modify(next_run_time=None)  # Clear next run time temporarily
    scheduler.add_job(
        job.func,
        trigger="date",  # One-time trigger
        id=f"{job_name}_manual_{int(__import__('time').time())}",
        name=f"Manual: {job.name}",
        replace_existing=False,
    )
    
    return {
        "message": f"Job '{job_name}' triggered successfully",
        "job_id": job_name,
    }
