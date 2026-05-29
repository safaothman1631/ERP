"""Org usage metrics for platform admins (Wave Q)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.platform._guards import require_platform_admin
from app.services.org_counters import get_counters

router = APIRouter(tags=["Platform Usage"])


@router.get("/orgs/{org_id}/usage")
def org_usage(
    org_id: str,
    period: Optional[str] = Query(None, description="YYYY-MM"),
    user: dict = Depends(require_platform_admin),
):
    counters = get_counters(org_id)
    return {
        "org_id": org_id,
        "period": period,
        "document_counts": {
            "invoices_open": counters.get("invoices_open_count", 0),
            "bills_open": counters.get("bills_open_count", 0),
        },
        "balances": {
            "invoices_open_balance": counters.get("invoices_open_balance", 0.0),
            "bills_open_balance": counters.get("bills_open_balance", 0.0),
        },
        "updated_at": counters.get("updated_at"),
    }
