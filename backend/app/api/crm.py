"""CRM API: leads, opportunities, pipeline stages, activities + reports."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.firestore.crm import (
    CRMLeadRepository,
    CRMOpportunityRepository,
    CRMStageRepository,
    CRMActivityRepository,
    CRMLostReasonRepository,
    CRMSalesTeamRepository,
)
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services import settings_service

router = APIRouter(prefix="/api/crm", tags=["CRM"])


# ──────────────────────────── Schemas ────────────────────────────

class StageCreate(BaseModel):
    name: str
    sequence: int = 0
    is_won: bool = False
    is_lost: bool = False
    color: str = "#1890ff"


class StageUpdate(BaseModel):
    name: Optional[str] = None
    sequence: Optional[int] = None
    is_won: Optional[bool] = None
    is_lost: Optional[bool] = None
    color: Optional[str] = None


class LeadCreate(BaseModel):
    name: str
    contact_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    stage_id: Optional[str] = None
    owner_id: Optional[str] = None
    expected_revenue: float = Field(default=0.0, ge=0, le=999999999)
    probability: float = Field(default=0.0, ge=0, le=100)
    notes: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    contact_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    stage_id: Optional[str] = None
    owner_id: Optional[str] = None
    expected_revenue: Optional[float] = Field(default=None, ge=0, le=999999999)
    probability: Optional[float] = Field(default=None, ge=0, le=100)
    notes: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[list[str]] = None


class LeadConvert(BaseModel):
    amount: float = Field(default=0.0, ge=0, le=999999999)
    probability: float = Field(default=50.0, ge=0, le=100)
    close_date: Optional[str] = None
    stage_id: Optional[str] = None


class OpportunityCreate(BaseModel):
    name: str
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    stage_id: Optional[str] = None
    amount: float = Field(default=0.0, ge=0, le=999999999)
    probability: float = Field(default=50.0, ge=0, le=100)
    close_date: Optional[str] = None
    owner_id: Optional[str] = None
    notes: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class OpportunityUpdate(BaseModel):
    name: Optional[str] = None
    contact_id: Optional[str] = None
    stage_id: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0, le=999999999)
    probability: Optional[float] = Field(default=None, ge=0, le=100)
    close_date: Optional[str] = None
    owner_id: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    lost_reason: Optional[str] = Field(default=None, max_length=200)
    tags: Optional[list[str]] = None


class ActivityCreate(BaseModel):
    type: str = Field(..., description="call | email | meeting | task")
    summary: str
    due_date: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    owner_id: Optional[str] = None
    duration_minutes: Optional[int] = None


# Default stages auto-seeded once per org so the pipeline is never empty.
_DEFAULT_STAGES = [
    {"name": "New", "sequence": 1, "is_won": False, "is_lost": False, "color": "#1890ff"},
    {"name": "Qualified", "sequence": 2, "is_won": False, "is_lost": False, "color": "#13c2c2"},
    {"name": "Proposal", "sequence": 3, "is_won": False, "is_lost": False, "color": "#faad14"},
    {"name": "Negotiation", "sequence": 4, "is_won": False, "is_lost": False, "color": "#fa8c16"},
    {"name": "Won", "sequence": 5, "is_won": True, "is_lost": False, "color": "#52c41a"},
    {"name": "Lost", "sequence": 6, "is_won": False, "is_lost": True, "color": "#f5222d"},
]


def _ensure_default_stages(repo: CRMStageRepository) -> list[dict]:
    stages, _ = repo.list(order_by="sequence", order_dir="ASCENDING", limit=200)
    if stages:
        return stages
    created = []
    for stage in _DEFAULT_STAGES:
        created.append(repo.create({**stage, "is_active": True}))
    return created


# ──────────────────────────── Stages ────────────────────────────

@router.get("/stages")
def list_stages(user: dict = Depends(get_current_user)):
    repo = CRMStageRepository(user["org_id"])
    stages = _ensure_default_stages(repo)
    return {"items": stages, "total": len(stages)}


@router.post("/stages", status_code=201, dependencies=[Depends(require_perm("crm.create"))])
def create_stage(data: StageCreate, user: dict = Depends(get_current_user)):
    repo = CRMStageRepository(user["org_id"])
    return repo.create(data.model_dump())


@router.put("/stages/{stage_id}", dependencies=[Depends(require_perm("crm.update"))])
def update_stage(stage_id: str, data: StageUpdate, user: dict = Depends(get_current_user)):
    repo = CRMStageRepository(user["org_id"])
    if not repo.get(stage_id):
        raise HTTPException(404, "stage not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return repo.update(stage_id, payload)


@router.delete("/stages/{stage_id}", dependencies=[Depends(require_perm("crm.delete"))])
def delete_stage(stage_id: str, user: dict = Depends(get_current_user)):
    repo = CRMStageRepository(user["org_id"])
    if not repo.get(stage_id):
        raise HTTPException(404, "stage not found")
    repo.delete(stage_id)
    return {"success": True}


# ──────────────────────────── Leads ────────────────────────────

@router.get("/leads")
def list_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    stage_id: str = Query("", max_length=64),
    owner_id: str = Query("", max_length=64),
    source: str = Query("", max_length=64),
    user: dict = Depends(get_current_user),
):
    repo = CRMLeadRepository(user["org_id"])
    filters = []
    if stage_id:
        filters.append({"field": "stage_id", "op": "==", "value": stage_id})
    if owner_id:
        filters.append({"field": "owner_id", "op": "==", "value": owner_id})
    if source:
        filters.append({"field": "source", "op": "==", "value": source})

    items, total = repo.list(
        filters=filters,
        order_by="created_at",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size,
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("/leads", status_code=201, dependencies=[Depends(require_perm("crm.leads.create"))])
def create_lead(data: LeadCreate, user: dict = Depends(get_current_user)):
    # Apply CRM config defaults
    try:
        cfg = settings_service.get_bag(user["org_id"], "crm")
    except Exception:
        cfg = {}
    
    repo = CRMLeadRepository(user["org_id"])
    payload = data.model_dump()
    payload.setdefault("status", "open")
    
    # Apply pipeline default
    if not payload.get("pipeline"):
        payload["pipeline"] = cfg.get("default_pipeline", "default")
    
    # Require lead source if configured
    if cfg.get("require_lead_source", False) and not payload.get("source"):
        raise HTTPException(400, "Lead source required")
    
    # Apply round-robin owner assignment if no owner specified
    if not payload.get("owner_id"):
        rr_users = cfg.get("round_robin_users", [])
        if rr_users:
            import random
            payload["owner_id"] = random.choice(rr_users)
    
    return repo.create(payload)


@router.get("/leads/{lead_id}")
def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    repo = CRMLeadRepository(user["org_id"])
    lead = repo.get(lead_id)
    if not lead or lead.get("org_id") != user["org_id"]:
        raise HTTPException(404, "lead not found")
    return lead


@router.put("/leads/{lead_id}", dependencies=[Depends(require_perm("crm.leads.update"))])
def update_lead(lead_id: str, data: LeadUpdate, user: dict = Depends(get_current_user)):
    repo = CRMLeadRepository(user["org_id"])
    lead = repo.get(lead_id)
    if not lead or lead.get("org_id") != user["org_id"]:
        raise HTTPException(404, "lead not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return repo.update(lead_id, payload)


@router.delete("/leads/{lead_id}", dependencies=[Depends(require_perm("crm.leads.delete"))])
def delete_lead(lead_id: str, user: dict = Depends(get_current_user)):
    repo = CRMLeadRepository(user["org_id"])
    lead = repo.get(lead_id)
    if not lead or lead.get("org_id") != user["org_id"]:
        raise HTTPException(404, "lead not found")
    repo.update(lead_id, {"status": "archived", "is_active": False})
    return {"success": True}


@router.post("/leads/{lead_id}/convert", dependencies=[Depends(require_perm("crm.leads.update"))])
def convert_lead(lead_id: str, data: LeadConvert, user: dict = Depends(get_current_user)):
    lead_repo = CRMLeadRepository(user["org_id"])
    opp_repo = CRMOpportunityRepository(user["org_id"])
    stage_repo = CRMStageRepository(user["org_id"])

    lead = lead_repo.get(lead_id)
    if not lead or lead.get("org_id") != user["org_id"]:
        raise HTTPException(404, "lead not found")

    # Pick stage: explicit -> first non-terminal -> first stage
    target_stage = data.stage_id
    if not target_stage:
        stages = _ensure_default_stages(stage_repo)
        non_terminal = [s for s in stages if not s.get("is_won") and not s.get("is_lost")]
        target_stage = (non_terminal[0] if non_terminal else stages[0])["id"]

    opp_payload = {
        "name": lead.get("name", ""),
        "lead_id": lead_id,
        "contact_id": lead.get("contact_id"),
        "stage_id": target_stage,
        "amount": float(data.amount or lead.get("expected_revenue") or 0),
        "probability": float(data.probability),
        "close_date": data.close_date,
        "owner_id": lead.get("owner_id"),
        "status": "open",
        "notes": lead.get("notes"),
    }
    opportunity = opp_repo.create(opp_payload)
    lead_repo.update(lead_id, {"status": "converted", "converted_opportunity_id": opportunity["id"]})
    return {"lead": lead_repo.get(lead_id), "opportunity": opportunity}


# ──────────────────────────── Opportunities ────────────────────────────

@router.get("/opportunities")
def list_opportunities(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    stage_id: str = Query("", max_length=64),
    owner_id: str = Query("", max_length=64),
    status: str = Query("", max_length=32),
    user: dict = Depends(get_current_user),
):
    repo = CRMOpportunityRepository(user["org_id"])
    filters = []
    if stage_id:
        filters.append({"field": "stage_id", "op": "==", "value": stage_id})
    if owner_id:
        filters.append({"field": "owner_id", "op": "==", "value": owner_id})
    if status:
        filters.append({"field": "status", "op": "==", "value": status})

    items, total = repo.list(
        filters=filters,
        order_by="created_at",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size,
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("/opportunities", status_code=201, dependencies=[Depends(require_perm("crm.create"))])
def create_opportunity(data: OpportunityCreate, user: dict = Depends(get_current_user)):
    repo = CRMOpportunityRepository(user["org_id"])
    payload = data.model_dump()
    payload.setdefault("status", "open")
    return repo.create(payload)


@router.get("/opportunities/{opp_id}")
def get_opportunity(opp_id: str, user: dict = Depends(get_current_user)):
    repo = CRMOpportunityRepository(user["org_id"])
    opp = repo.get(opp_id)
    if not opp or opp.get("org_id") != user["org_id"]:
        raise HTTPException(404, "opportunity not found")
    return opp


@router.put("/opportunities/{opp_id}", dependencies=[Depends(require_perm("crm.update"))])
def update_opportunity(opp_id: str, data: OpportunityUpdate, user: dict = Depends(get_current_user)):
    repo = CRMOpportunityRepository(user["org_id"])
    opp = repo.get(opp_id)
    if not opp or opp.get("org_id") != user["org_id"]:
        raise HTTPException(404, "opportunity not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}

    # If moving to a Lost stage, ensure lost_reason is captured
    new_stage_id = payload.get("stage_id")
    if new_stage_id and new_stage_id != opp.get("stage_id"):
        stage_repo = CRMStageRepository(user["org_id"])
        new_stage = stage_repo.get(new_stage_id)
        if new_stage and new_stage.get("is_lost") and not (payload.get("lost_reason") or opp.get("lost_reason")):
            raise HTTPException(400, "lost_reason پێویستە کاتێک دەرفەت دەخرێتە قۆناغی Lost")
        if new_stage and new_stage.get("is_won"):
            payload.setdefault("won_at", datetime.utcnow().isoformat())

    return repo.update(opp_id, payload)


@router.delete("/opportunities/{opp_id}", dependencies=[Depends(require_perm("crm.delete"))])
def delete_opportunity(opp_id: str, user: dict = Depends(get_current_user)):
    repo = CRMOpportunityRepository(user["org_id"])
    opp = repo.get(opp_id)
    if not opp or opp.get("org_id") != user["org_id"]:
        raise HTTPException(404, "opportunity not found")
    repo.update(opp_id, {"status": "archived", "is_active": False})
    return {"success": True}


# ──────────────────────────── Activities ────────────────────────────

@router.get("/activities")
def list_activities(
    lead_id: str = Query("", max_length=64),
    opportunity_id: str = Query("", max_length=64),
    owner_id: str = Query("", max_length=64),
    status: str = Query("", max_length=32),
    user: dict = Depends(get_current_user),
):
    repo = CRMActivityRepository(user["org_id"])
    filters = []
    if lead_id:
        filters.append({"field": "lead_id", "op": "==", "value": lead_id})
    if opportunity_id:
        filters.append({"field": "opportunity_id", "op": "==", "value": opportunity_id})
    if owner_id:
        filters.append({"field": "owner_id", "op": "==", "value": owner_id})
    if status:
        filters.append({"field": "status", "op": "==", "value": status})

    items, total = repo.list(
        filters=filters,
        order_by="due_date",
        order_dir="ASCENDING",
        limit=500,
    )
    return {"items": items, "total": total}


@router.post("/activities", status_code=201, dependencies=[Depends(require_perm("crm.create"))])
def create_activity(data: ActivityCreate, user: dict = Depends(get_current_user)):
    repo = CRMActivityRepository(user["org_id"])
    payload = data.model_dump()
    payload["status"] = "pending"
    payload.setdefault("owner_id", user.get("id") or user.get("uid"))
    return repo.create(payload)


@router.put("/activities/{activity_id}/done", dependencies=[Depends(require_perm("crm.update"))])
def complete_activity(activity_id: str, user: dict = Depends(get_current_user)):
    repo = CRMActivityRepository(user["org_id"])
    activity = repo.get(activity_id)
    if not activity or activity.get("org_id") != user["org_id"]:
        raise HTTPException(404, "activity not found")
    return repo.update(activity_id, {
        "status": "done",
        "completed_at": datetime.utcnow().isoformat(),
    })


@router.delete("/activities/{activity_id}", dependencies=[Depends(require_perm("crm.delete"))])
def cancel_activity(activity_id: str, user: dict = Depends(get_current_user)):
    repo = CRMActivityRepository(user["org_id"])
    activity = repo.get(activity_id)
    if not activity or activity.get("org_id") != user["org_id"]:
        raise HTTPException(404, "activity not found")
    repo.delete(activity_id)
    return {"success": True}


# ──────────────────────────── Activity Reminders (FIX-61) ────────────────────────────

@router.get("/activities/due-soon", dependencies=[Depends(require_perm("crm.read"))])
def get_due_activities(
    days: int = Query(default=1, ge=0, le=7, description="Look ahead N days"),
    user: dict = Depends(get_current_user),
):
    """Retrieve pending activities due within N days (for reminder notifications)."""
    from datetime import timedelta
    
    repo = CRMActivityRepository(user["org_id"])
    all_activities, _ = repo.list(limit=5000)
    
    today = datetime.utcnow().date()
    cutoff = today + timedelta(days=days)
    
    due = []
    for act in all_activities:
        if act.get("status") != "pending":
            continue
        due_date_str = act.get("due_date")
        if not due_date_str:
            continue
        try:
            due_date = datetime.fromisoformat(due_date_str).date() if isinstance(due_date_str, str) else due_date_str
        except Exception:
            continue
        if today <= due_date <= cutoff:
            due.append({
                "id": act["id"],
                "type": act.get("type"),
                "summary": act.get("summary"),
                "due_date": str(due_date),
                "days_until": (due_date - today).days,
                "owner_id": act.get("owner_id"),
                "lead_id": act.get("lead_id"),
                "opportunity_id": act.get("opportunity_id"),
            })
    
    due.sort(key=lambda a: (a["days_until"], a["due_date"]))
    return {"activities": due, "count": len(due)}



# ──────────────────────────── Reports ────────────────────────────

@router.get("/forecast")
def forecast(user: dict = Depends(get_current_user)):
    """Monthly forecast based on amount × probability for open opportunities."""
    repo = CRMOpportunityRepository(user["org_id"])
    opps, _ = repo.list(filters=[{"field": "status", "op": "==", "value": "open"}], limit=10000)
    monthly: dict[str, float] = defaultdict(float)
    for o in opps:
        cd = o.get("close_date")
        month = "unscheduled"
        if isinstance(cd, str) and len(cd) >= 7:
            candidate = cd[:7]
            # Validate YYYY-MM shape (digits + dash + digits)
            if len(candidate) == 7 and candidate[4] == "-" and candidate[:4].isdigit() and candidate[5:].isdigit():
                month = candidate
        amount = max(float(o.get("amount") or 0), 0.0)
        prob = min(max(float(o.get("probability") or 0), 0.0), 100.0) / 100.0
        monthly[month] += amount * prob
    months = sorted(monthly.keys())
    return {
        "months": [{"month": m, "weighted_value": round(monthly[m], 2)} for m in months],
        "total": round(sum(monthly.values()), 2),
    }


@router.get("/reports/pipeline")
def pipeline_report(user: dict = Depends(get_current_user)):
    """Aggregate open opportunity value and count by stage."""
    opp_repo = CRMOpportunityRepository(user["org_id"])
    stage_repo = CRMStageRepository(user["org_id"])
    stages = _ensure_default_stages(stage_repo)
    stage_by_id = {s["id"]: s for s in stages}

    opps, _ = opp_repo.list(filters=[{"field": "status", "op": "==", "value": "open"}], limit=10000)
    agg: dict[str, dict] = {s["id"]: {"stage_id": s["id"], "stage_name": s.get("name"),
                                       "color": s.get("color"), "sequence": s.get("sequence", 0),
                                       "count": 0, "value": 0.0} for s in stages}
    for o in opps:
        sid = o.get("stage_id")
        if sid not in agg:
            continue
        agg[sid]["count"] += 1
        agg[sid]["value"] += float(o.get("amount") or 0)
    rows = sorted(agg.values(), key=lambda x: x.get("sequence", 0))
    for r in rows:
        r["value"] = round(r["value"], 2)
    return {"stages": rows, "total_value": round(sum(r["value"] for r in rows), 2)}


@router.get("/reports/won-lost")
def won_lost_report(user: dict = Depends(get_current_user)):
    """Win rate + average deal size."""
    opp_repo = CRMOpportunityRepository(user["org_id"])
    stage_repo = CRMStageRepository(user["org_id"])
    stages = _ensure_default_stages(stage_repo)
    won_ids = {s["id"] for s in stages if s.get("is_won")}
    lost_ids = {s["id"] for s in stages if s.get("is_lost")}

    opps, _ = opp_repo.list(limit=10000)
    won = [o for o in opps if o.get("stage_id") in won_ids]
    lost = [o for o in opps if o.get("stage_id") in lost_ids]
    won_value = sum(float(o.get("amount") or 0) for o in won)
    lost_value = sum(float(o.get("amount") or 0) for o in lost)
    closed = len(won) + len(lost)
    win_rate = (len(won) / closed * 100) if closed else 0
    avg_deal = (won_value / len(won)) if won else 0
    return {
        "won_count": len(won),
        "lost_count": len(lost),
        "won_value": round(won_value, 2),
        "lost_value": round(lost_value, 2),
        "win_rate": round(win_rate, 2),
        "average_deal_size": round(avg_deal, 2),
    }


@router.get("/reports/leaderboard")
def leaderboard(user: dict = Depends(get_current_user)):
    """Top owners by closed-won value."""
    opp_repo = CRMOpportunityRepository(user["org_id"])
    stage_repo = CRMStageRepository(user["org_id"])
    stages = _ensure_default_stages(stage_repo)
    won_ids = {s["id"] for s in stages if s.get("is_won")}

    opps, _ = opp_repo.list(filters=[{"field": "stage_id", "op": "in", "value": list(won_ids) or [""]}],
                             limit=10000)
    by_owner: dict[str, dict] = defaultdict(lambda: {"owner_id": "", "deals": 0, "value": 0.0})
    for o in opps:
        owner = o.get("owner_id") or "unassigned"
        by_owner[owner]["owner_id"] = owner
        by_owner[owner]["deals"] += 1
        by_owner[owner]["value"] += float(o.get("amount") or 0)
    rows = sorted(by_owner.values(), key=lambda x: x["value"], reverse=True)
    for r in rows:
        r["value"] = round(r["value"], 2)
    return {"items": rows}


# ──────────────────────────── Lost Reasons (FIX-56) ────────────────────────────

class LostReasonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    active: bool = True


class LostReasonUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    active: Optional[bool] = None


@router.get("/lost-reasons")
def list_lost_reasons(user: dict = Depends(get_current_user)):
    repo = CRMLostReasonRepository(user["org_id"])
    items, _ = repo.list(limit=200)
    items.sort(key=lambda r: (not r.get("active", True), r.get("name", "")))
    return {"items": items}


@router.post("/lost-reasons", status_code=201, dependencies=[Depends(require_perm("crm.create"))])
def create_lost_reason(data: LostReasonCreate, user: dict = Depends(get_current_user)):
    repo = CRMLostReasonRepository(user["org_id"])
    return repo.create({"name": data.name.strip(), "active": data.active})


@router.put("/lost-reasons/{reason_id}", dependencies=[Depends(require_perm("crm.update"))])
def update_lost_reason(reason_id: str, data: LostReasonUpdate, user: dict = Depends(get_current_user)):
    repo = CRMLostReasonRepository(user["org_id"])
    if not repo.get(reason_id):
        raise HTTPException(status_code=404, detail="هۆکاری دۆڕاندن نەدۆزرایەوە")
    payload = {k: v for k, v in data.dict(exclude_unset=True).items() if v is not None}
    if "name" in payload:
        payload["name"] = payload["name"].strip()
    return repo.update(reason_id, payload)


@router.delete("/lost-reasons/{reason_id}", dependencies=[Depends(require_perm("crm.delete"))])
def delete_lost_reason(reason_id: str, user: dict = Depends(get_current_user)):
    repo = CRMLostReasonRepository(user["org_id"])
    if not repo.get(reason_id):
        raise HTTPException(status_code=404, detail="هۆکاری دۆڕاندن نەدۆزرایەوە")
    repo.delete(reason_id)
    return {"deleted": True}


# ──────────────────────────── Merge duplicates (FIX-57) ────────────────────────────

class MergeRequest(BaseModel):
    primary_id: str = Field(..., description="Record to keep")
    duplicate_ids: list[str] = Field(..., min_items=1, max_items=10)


def _merge_records(primary: dict, duplicates: list[dict]) -> dict:
    """Combine non-empty fields, summing numeric amounts."""
    merged = dict(primary)
    notes_parts = [primary.get("notes") or ""]
    for d in duplicates:
        for k, v in d.items():
            if k in {"id", "org_id", "created_at", "updated_at"}:
                continue
            if k == "notes":
                if v:
                    notes_parts.append(str(v))
                continue
            if k in {"amount", "expected_revenue"}:
                try:
                    merged[k] = float(merged.get(k) or 0) + float(v or 0)
                except Exception:
                    pass
                continue
            if k == "tags" and isinstance(v, list):
                cur = list(merged.get("tags") or [])
                for t in v:
                    if t and t not in cur:
                        cur.append(t)
                merged["tags"] = cur
                continue
            # fill empty fields from duplicates
            if not merged.get(k) and v:
                merged[k] = v
    notes = "\n---\n".join([n for n in notes_parts if n])
    if notes:
        merged["notes"] = notes
    return merged


@router.post("/leads/merge", dependencies=[Depends(require_perm("crm.leads.update"))])
def merge_leads(req: MergeRequest, user: dict = Depends(get_current_user)):
    repo = CRMLeadRepository(user["org_id"])
    primary = repo.get(req.primary_id)
    if not primary:
        raise HTTPException(status_code=404, detail="ڕیکۆردی سەرەکی نەدۆزرایەوە")
    if req.primary_id in req.duplicate_ids:
        raise HTTPException(status_code=400, detail="ڕیکۆردی سەرەکی ناتوانێت لە لیستی دووبارەکاندا بێت")
    dups = []
    for did in req.duplicate_ids:
        d = repo.get(did)
        if not d:
            raise HTTPException(status_code=404, detail=f"ڕیکۆردی دووبارە نەدۆزرایەوە: {did}")
        dups.append(d)
    merged = _merge_records(primary, dups)
    merged.pop("id", None); merged.pop("org_id", None); merged.pop("created_at", None); merged.pop("updated_at", None)
    repo.update(req.primary_id, merged)
    for d in dups:
        repo.delete(d["id"])
    return {"merged_into": req.primary_id, "removed": [d["id"] for d in dups]}


@router.post("/opportunities/merge", dependencies=[Depends(require_perm("crm.update"))])
def merge_opportunities(req: MergeRequest, user: dict = Depends(get_current_user)):
    repo = CRMOpportunityRepository(user["org_id"])
    primary = repo.get(req.primary_id)
    if not primary:
        raise HTTPException(status_code=404, detail="ڕیکۆردی سەرەکی نەدۆزرایەوە")
    if req.primary_id in req.duplicate_ids:
        raise HTTPException(status_code=400, detail="ڕیکۆردی سەرەکی ناتوانێت لە لیستی دووبارەکاندا بێت")
    dups = []
    for did in req.duplicate_ids:
        d = repo.get(did)
        if not d:
            raise HTTPException(status_code=404, detail=f"ڕیکۆردی دووبارە نەدۆزرایەوە: {did}")
        dups.append(d)
    merged = _merge_records(primary, dups)
    merged.pop("id", None); merged.pop("org_id", None); merged.pop("created_at", None); merged.pop("updated_at", None)
    repo.update(req.primary_id, merged)
    for d in dups:
        repo.delete(d["id"])
    return {"merged_into": req.primary_id, "removed": [d["id"] for d in dups]}


# ──────────────────────────── Bulk Actions (FIX-60) ────────────────────────────

class BulkActionRequest(BaseModel):
    record_ids: list[str] = Field(..., min_items=1, max_items=1000)
    action: str = Field(..., description="archive | unarchive | assign")
    owner_id: Optional[str] = None  # for assign action


@router.post("/leads/bulk-action", dependencies=[Depends(require_perm("crm.leads.update"))])
def bulk_action_leads(req: BulkActionRequest, user: dict = Depends(get_current_user)):
    """Bulk archive/unarchive/assign leads."""
    repo = CRMLeadRepository(user["org_id"])
    updated = 0
    for rid in req.record_ids:
        if not repo.get(rid):
            continue
        payload = {}
        if req.action == "archive":
            payload["archived"] = True
        elif req.action == "unarchive":
            payload["archived"] = False
        elif req.action == "assign" and req.owner_id:
            payload["owner_id"] = req.owner_id
        if payload:
            repo.update(rid, payload)
            updated += 1
    return {"action": req.action, "updated": updated}


@router.post("/opportunities/bulk-action", dependencies=[Depends(require_perm("crm.update"))])
def bulk_action_opportunities(req: BulkActionRequest, user: dict = Depends(get_current_user)):
    """Bulk archive/unarchive/assign opportunities."""
    repo = CRMOpportunityRepository(user["org_id"])
    updated = 0
    for rid in req.record_ids:
        if not repo.get(rid):
            continue
        payload = {}
        if req.action == "archive":
            payload["archived"] = True
        elif req.action == "unarchive":
            payload["archived"] = False
        elif req.action == "assign" and req.owner_id:
            payload["owner_id"] = req.owner_id
        if payload:
            repo.update(rid, payload)
            updated += 1
    return {"action": req.action, "updated": updated}



# ------------------------ Sprint 12: Sales Teams (FIX-131..134) ------------------------

class SalesTeamCreate(BaseModel):
    name: str
    code: Optional[str] = None
    manager_id: Optional[str] = None
    member_ids: list[str] = Field(default_factory=list)
    target_amount: float = 0
    active: bool = True
    notes: Optional[str] = None


class SalesTeamUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    manager_id: Optional[str] = None
    member_ids: Optional[list[str]] = None
    target_amount: Optional[float] = None
    active: Optional[bool] = None
    notes: Optional[str] = None


@router.get("/sales-teams")
def list_sales_teams(active: Optional[bool] = None, user: dict = Depends(get_current_user)):
    repo = CRMSalesTeamRepository(user["org_id"])
    filters = []
    if active is not None:
        filters.append({"field": "active", "op": "==", "value": active})
    items, total = repo.list(filters=filters or None, limit=500, order_by="name")
    return {"items": items, "total": total}


@router.post("/sales-teams", status_code=201, dependencies=[Depends(require_perm("crm.create"))])
def create_sales_team(data: SalesTeamCreate, user: dict = Depends(get_current_user)):
    repo = CRMSalesTeamRepository(user["org_id"])
    return repo.create(data.model_dump())


@router.get("/sales-teams/{team_id}")
def get_sales_team(team_id: str, user: dict = Depends(get_current_user)):
    repo = CRMSalesTeamRepository(user["org_id"])
    item = repo.get(team_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "sales team not found")
    return item


@router.put("/sales-teams/{team_id}", dependencies=[Depends(require_perm("crm.update"))])
def update_sales_team(team_id: str, data: SalesTeamUpdate, user: dict = Depends(get_current_user)):
    repo = CRMSalesTeamRepository(user["org_id"])
    if not repo.get(team_id):
        raise HTTPException(404, "sales team not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return repo.update(team_id, payload)


@router.delete("/sales-teams/{team_id}", dependencies=[Depends(require_perm("crm.delete"))])
def delete_sales_team(team_id: str, user: dict = Depends(get_current_user)):
    repo = CRMSalesTeamRepository(user["org_id"])
    if not repo.get(team_id):
        raise HTTPException(404, "sales team not found")
    repo.delete(team_id)
    return {"deleted": True}


@router.get("/sales-teams/{team_id}/performance")
def sales_team_performance(team_id: str, user: dict = Depends(get_current_user)):
    """FIX-135: Aggregated KPIs for a sales team based on opportunities owned by its members."""
    org = user["org_id"]
    team = CRMSalesTeamRepository(org).get(team_id)
    if not team or team.get("org_id") != org:
        raise HTTPException(404, "sales team not found")
    member_ids = set([team.get("manager_id")] + (team.get("member_ids") or []))
    member_ids.discard(None)
    opps, _ = CRMOpportunityRepository(org).list(limit=2000)
    own = [o for o in opps if o.get("owner_id") in member_ids]
    won_amount = sum(float(o.get("expected_revenue") or 0) for o in own if o.get("status") == "won")
    open_amount = sum(float(o.get("expected_revenue") or 0) for o in own if o.get("status") not in ("won", "lost"))
    target = float(team.get("target_amount") or 0)
    return {
        "team_id": team_id,
        "team_name": team.get("name"),
        "members": list(member_ids),
        "opportunities": len(own),
        "won_count": sum(1 for o in own if o.get("status") == "won"),
        "lost_count": sum(1 for o in own if o.get("status") == "lost"),
        "open_amount": round(open_amount, 2),
        "won_amount": round(won_amount, 2),
        "target_amount": target,
        "target_attainment_pct": round((won_amount / target * 100.0) if target else 0.0, 2),
    }


# ------------------------ Sprint 21: Activity Types + Lead Assignment Rules (FIX-301..310) ------------------------

from app.firestore.crm import CRMSalesTeamRepository as _STR  # noqa


@router.get("/activity-types")
def list_activity_types(user: dict = Depends(get_current_user)):
    from app.firestore.base import BaseRepository
    class _ATR(BaseRepository):
        collection_name = "crm_activity_types"
    items, total = _ATR(user["org_id"]).list(limit=200, order_by="name")
    return {"items": items, "total": total}


@router.post("/activity-types", status_code=201, dependencies=[Depends(require_perm("crm.create"))])
def create_activity_type(data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.base import BaseRepository
    class _ATR(BaseRepository):
        collection_name = "crm_activity_types"
    return _ATR(user["org_id"]).create({
        "name": data.get("name"),
        "icon": data.get("icon", "user"),
        "default_summary": data.get("default_summary", ""),
        "default_duration_minutes": int(data.get("default_duration_minutes") or 0),
        "color": data.get("color", "#1890ff"),
    })


@router.delete("/activity-types/{type_id}", dependencies=[Depends(require_perm("crm.delete"))])
def delete_activity_type(type_id: str, user: dict = Depends(get_current_user)):
    from app.firestore.base import BaseRepository
    class _ATR(BaseRepository):
        collection_name = "crm_activity_types"
    repo = _ATR(user["org_id"])
    if not repo.get(type_id):
        raise HTTPException(404, "activity type not found")
    repo.delete(type_id)
    return {"deleted": True}


@router.post("/leads/{lead_id}/auto-assign", dependencies=[Depends(require_perm("crm.update"))])
def auto_assign_lead(lead_id: str, user: dict = Depends(get_current_user)):
    """FIX-303: Round-robin assign lead to a sales team member based on least open opps."""
    org = user["org_id"]
    lead_repo = CRMLeadRepository(org)
    lead = lead_repo.get(lead_id)
    if not lead or lead.get("org_id") != org:
        raise HTTPException(404, "lead not found")
    team_id = lead.get("sales_team_id")
    if not team_id:
        raise HTTPException(400, "lead has no sales_team_id")
    team = CRMSalesTeamRepository(org).get(team_id)
    if not team:
        raise HTTPException(404, "sales team not found")
    member_ids = list(set([team.get("manager_id")] + (team.get("member_ids") or [])))
    member_ids = [m for m in member_ids if m]
    if not member_ids:
        raise HTTPException(400, "team has no members")
    # Pick member with fewest open opportunities
    opps, _ = CRMOpportunityRepository(org).list(limit=2000)
    open_counts = {m: 0 for m in member_ids}
    for o in opps:
        owner = o.get("owner_id")
        if owner in open_counts and o.get("status") not in ("won", "lost"):
            open_counts[owner] += 1
    chosen = min(open_counts, key=open_counts.get)
    return lead_repo.update(lead_id, {
        "owner_id": chosen,
        "auto_assigned_at": datetime.utcnow().isoformat(),
        "auto_assignment_method": "round_robin_least_open",
    })


@router.post("/sales-teams/{team_id}/distribute-leads", dependencies=[Depends(require_perm("crm.update"))])
def distribute_team_leads(team_id: str, user: dict = Depends(get_current_user)):
    """FIX-304: Bulk-assign all unassigned leads of a team using auto-assign rule."""
    org = user["org_id"]
    team = CRMSalesTeamRepository(org).get(team_id)
    if not team or team.get("org_id") != org:
        raise HTTPException(404, "sales team not found")
    leads, _ = CRMLeadRepository(org).list(filters=[
        {"field": "sales_team_id", "op": "==", "value": team_id},
    ], limit=2000)
    member_ids = [m for m in [team.get("manager_id")] + (team.get("member_ids") or []) if m]
    if not member_ids:
        raise HTTPException(400, "team has no members")
    opps, _ = CRMOpportunityRepository(org).list(limit=2000)
    counts = {m: 0 for m in member_ids}
    for o in opps:
        if o.get("owner_id") in counts and o.get("status") not in ("won", "lost"):
            counts[o.get("owner_id")] += 1
    assigned = 0
    for ld in leads:
        if ld.get("owner_id"):
            continue
        chosen = min(counts, key=counts.get)
        CRMLeadRepository(org).update(ld["id"], {
            "owner_id": chosen,
            "auto_assigned_at": datetime.utcnow().isoformat(),
            "auto_assignment_method": "round_robin_least_open",
        })
        counts[chosen] += 1
        assigned += 1
    return {"team_id": team_id, "assigned": assigned, "skipped": len(leads) - assigned, "total_leads": len(leads)}
