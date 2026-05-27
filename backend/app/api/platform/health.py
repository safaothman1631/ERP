"""Platform health + per-org data integrity reconcile."""
from __future__ import annotations

import dataclasses

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.platform._guards import require_platform_admin
from app.services.health_checker import HealthChecker
from app.services.reconciliation import run_reconcile_for_org

router = APIRouter(tags=["Platform Health"])


@router.get("/health")
async def platform_health(user: dict = Depends(require_platform_admin)):
    """Infra health checks + platform viewer context."""
    checker = HealthChecker()
    report = await checker.run_full_check()
    payload = dataclasses.asdict(report)
    payload["platform"] = {
        "viewer_user_id": user.get("id"),
        "viewer_org_id": user.get("org_id"),
    }
    return payload


@router.get("/health/reconcile")
def platform_reconcile_preview(
    org_id: str = Query(..., description="Tenant org_id to scan"),
    reconciled_only: bool = Query(False),
    user: dict = Depends(require_platform_admin),
):
    """Dry-run denormalized field drift for one org (no writes)."""
    del user  # audit hook may use later
    try:
        return run_reconcile_for_org(org_id, fix=False, reconciled_only=reconciled_only)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/health/reconcile")
def platform_reconcile_apply(
    org_id: str = Query(..., description="Tenant org_id"),
    fix: bool = Query(False, description="Write computed values to stored fields"),
    reconciled_only: bool = Query(False),
    user: dict = Depends(require_platform_admin),
):
    """Run reconcile; with fix=true updates denormalized fields only."""
    del user
    try:
        return run_reconcile_for_org(org_id, fix=fix, reconciled_only=reconciled_only)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
