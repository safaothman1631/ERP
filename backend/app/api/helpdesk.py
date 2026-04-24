"""Sprint 36: Helpdesk + Support — tickets, SLA, escalation, CSAT, KB-link.

FIX-1000..FIX-1040 — initial CRUD + workflow endpoints.
"""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/helpdesk", tags=["Helpdesk"])


# ─────────── Repositories ───────────
class HelpdeskTeamRepo(BaseRepository):
    collection_name = "helpdesk_teams"


class HelpdeskCategoryRepo(BaseRepository):
    collection_name = "helpdesk_categories"


class HelpdeskTagRepo(BaseRepository):
    collection_name = "helpdesk_tags"


class HelpdeskSLAPolicyRepo(BaseRepository):
    collection_name = "helpdesk_sla_policies"


class HelpdeskTicketRepo(BaseRepository):
    collection_name = "helpdesk_tickets"


class HelpdeskTicketReplyRepo(BaseRepository):
    collection_name = "helpdesk_ticket_replies"


class HelpdeskCSATRepo(BaseRepository):
    collection_name = "helpdesk_csat"


class HelpdeskCannedResponseRepo(BaseRepository):
    collection_name = "helpdesk_canned_responses"


# ─────────── Schemas ───────────
class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    members: list[str] = Field(default_factory=list)


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    members: Optional[list[str]] = None


class CategoryCreate(BaseModel):
    name: str
    color: str = "#1890ff"


class TagCreate(BaseModel):
    name: str
    color: str = "#52c41a"


class SLAPolicyCreate(BaseModel):
    name: str
    priority: str = Field("medium", pattern=r"^(low|medium|high|urgent)$")
    response_minutes: int = Field(60, ge=1, le=10080)
    resolution_minutes: int = Field(1440, ge=1, le=43200)
    business_hours_only: bool = True


class TicketCreate(BaseModel):
    subject: str
    description: Optional[str] = None
    contact_id: Optional[str] = None
    contact_email: Optional[str] = None
    team_id: Optional[str] = None
    category_id: Optional[str] = None
    priority: str = Field("medium", pattern=r"^(low|medium|high|urgent)$")
    assigned_to: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    sla_policy_id: Optional[str] = None


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    team_id: Optional[str] = None
    category_id: Optional[str] = None
    priority: Optional[str] = Field(None, pattern=r"^(low|medium|high|urgent)$")
    assigned_to: Optional[str] = None
    tags: Optional[list[str]] = None
    status: Optional[str] = Field(None, pattern=r"^(new|open|pending|resolved|closed)$")


class ReplyCreate(BaseModel):
    ticket_id: str
    body: str
    is_internal: bool = False


class CSATCreate(BaseModel):
    ticket_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class CannedCreate(BaseModel):
    title: str
    body: str
    shortcut: Optional[str] = None


# ─────────── Helpers ───────────
def _own(repo, doc_id, org_id):
    item = repo.get(doc_id)
    if not item or item.get("org_id") != org_id:
        raise HTTPException(404, "نەدۆزرایەوە")
    return item


# ─────────── Teams ───────────
@router.get("/teams")
def list_teams(user: dict = Depends(get_current_user), limit: int = Query(50, ge=1, le=500), offset: int = 0):
    items, total = HelpdeskTeamRepo(user["org_id"]).list(limit=limit, offset=offset)
    return {"items": items, "total": total}


@router.post("/teams", status_code=201)
def create_team(body: TeamCreate, user: dict = Depends(get_current_user)):
    return HelpdeskTeamRepo(user["org_id"]).create(body.model_dump())


@router.get("/teams/{tid}")
def get_team(tid: str, user: dict = Depends(get_current_user)):
    return _own(HelpdeskTeamRepo(user["org_id"]), tid, user["org_id"])


@router.patch("/teams/{tid}")
def update_team(tid: str, body: TeamUpdate, user: dict = Depends(get_current_user)):
    repo = HelpdeskTeamRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    return repo.update(tid, {k: v for k, v in body.model_dump().items() if v is not None})


@router.delete("/teams/{tid}", status_code=204)
def delete_team(tid: str, user: dict = Depends(get_current_user)):
    repo = HelpdeskTeamRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    repo.delete(tid)


# ─────────── Categories ───────────
@router.get("/categories")
def list_cats(user: dict = Depends(get_current_user)):
    items, total = HelpdeskCategoryRepo(user["org_id"]).list(limit=200)
    return {"items": items, "total": total}


@router.post("/categories", status_code=201)
def create_cat(body: CategoryCreate, user: dict = Depends(get_current_user)):
    return HelpdeskCategoryRepo(user["org_id"]).create(body.model_dump())


@router.delete("/categories/{cid}", status_code=204)
def delete_cat(cid: str, user: dict = Depends(get_current_user)):
    repo = HelpdeskCategoryRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    repo.delete(cid)


# ─────────── Tags ───────────
@router.get("/tags")
def list_tags(user: dict = Depends(get_current_user)):
    items, total = HelpdeskTagRepo(user["org_id"]).list(limit=200)
    return {"items": items, "total": total}


@router.post("/tags", status_code=201)
def create_tag(body: TagCreate, user: dict = Depends(get_current_user)):
    return HelpdeskTagRepo(user["org_id"]).create(body.model_dump())


@router.delete("/tags/{tid}", status_code=204)
def delete_tag(tid: str, user: dict = Depends(get_current_user)):
    repo = HelpdeskTagRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    repo.delete(tid)


# ─────────── SLA Policies ───────────
@router.get("/sla-policies")
def list_sla(user: dict = Depends(get_current_user)):
    items, total = HelpdeskSLAPolicyRepo(user["org_id"]).list(limit=200)
    return {"items": items, "total": total}


@router.post("/sla-policies", status_code=201)
def create_sla(body: SLAPolicyCreate, user: dict = Depends(get_current_user)):
    return HelpdeskSLAPolicyRepo(user["org_id"]).create(body.model_dump())


@router.get("/sla-policies/{pid}")
def get_sla(pid: str, user: dict = Depends(get_current_user)):
    return _own(HelpdeskSLAPolicyRepo(user["org_id"]), pid, user["org_id"])


@router.patch("/sla-policies/{pid}")
def update_sla(pid: str, body: SLAPolicyCreate, user: dict = Depends(get_current_user)):
    repo = HelpdeskSLAPolicyRepo(user["org_id"])
    _own(repo, pid, user["org_id"])
    return repo.update(pid, body.model_dump())


@router.delete("/sla-policies/{pid}", status_code=204)
def delete_sla(pid: str, user: dict = Depends(get_current_user)):
    repo = HelpdeskSLAPolicyRepo(user["org_id"])
    _own(repo, pid, user["org_id"])
    repo.delete(pid)


# ─────────── Tickets ───────────
@router.get("/tickets")
def list_tickets(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[str] = None,
    team_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = 0,
):
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    if priority:
        filters.append({"field": "priority", "op": "==", "value": priority})
    if assigned_to:
        filters.append({"field": "assigned_to", "op": "==", "value": assigned_to})
    if team_id:
        filters.append({"field": "team_id", "op": "==", "value": team_id})
    items, total = HelpdeskTicketRepo(user["org_id"]).list(
        filters=filters, limit=limit, offset=offset, order_by="created_at"
    )
    return {"items": items, "total": total}


@router.post("/tickets", status_code=201)
def create_ticket(body: TicketCreate, user: dict = Depends(get_current_user)):
    repo = HelpdeskTicketRepo(user["org_id"])
    data = body.model_dump()
    data["status"] = "new"
    data["created_by"] = user.get("id") or user.get("email")
    # SLA deadlines
    if data.get("sla_policy_id"):
        sla = HelpdeskSLAPolicyRepo(user["org_id"]).get(data["sla_policy_id"])
        if sla:
            now = datetime.utcnow()
            data["sla_response_due"] = (now + timedelta(minutes=sla["response_minutes"])).isoformat()
            data["sla_resolution_due"] = (now + timedelta(minutes=sla["resolution_minutes"])).isoformat()
    return repo.create(data)


@router.get("/tickets/{tid}")
def get_ticket(tid: str, user: dict = Depends(get_current_user)):
    return _own(HelpdeskTicketRepo(user["org_id"]), tid, user["org_id"])


@router.patch("/tickets/{tid}")
def update_ticket(tid: str, body: TicketUpdate, user: dict = Depends(get_current_user)):
    repo = HelpdeskTicketRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    return repo.update(tid, {k: v for k, v in body.model_dump().items() if v is not None})


@router.delete("/tickets/{tid}", status_code=204)
def delete_ticket(tid: str, user: dict = Depends(get_current_user)):
    repo = HelpdeskTicketRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    repo.delete(tid)


@router.post("/tickets/{tid}/assign")
def assign_ticket(tid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = HelpdeskTicketRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    return repo.update(tid, {"assigned_to": body.get("user_id"), "status": "open"})


@router.post("/tickets/{tid}/resolve")
def resolve_ticket(tid: str, user: dict = Depends(get_current_user)):
    repo = HelpdeskTicketRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    return repo.update(tid, {"status": "resolved", "resolved_at": datetime.utcnow().isoformat()})


@router.post("/tickets/{tid}/close")
def close_ticket(tid: str, user: dict = Depends(get_current_user)):
    repo = HelpdeskTicketRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    return repo.update(tid, {"status": "closed", "closed_at": datetime.utcnow().isoformat()})


@router.post("/tickets/{tid}/reopen")
def reopen_ticket(tid: str, user: dict = Depends(get_current_user)):
    repo = HelpdeskTicketRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    return repo.update(tid, {"status": "open", "reopened_at": datetime.utcnow().isoformat()})


@router.post("/tickets/{tid}/escalate")
def escalate_ticket(tid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = HelpdeskTicketRepo(user["org_id"])
    item = _own(repo, tid, user["org_id"])
    return repo.update(tid, {
        "priority": body.get("priority", "high"),
        "escalated": True,
        "escalated_at": datetime.utcnow().isoformat(),
        "escalation_reason": body.get("reason"),
    })


# ─────────── Replies ───────────
@router.get("/tickets/{tid}/replies")
def list_replies(tid: str, user: dict = Depends(get_current_user)):
    items, total = HelpdeskTicketReplyRepo(user["org_id"]).list(
        filters=[{"field": "ticket_id", "op": "==", "value": tid}],
        order_by="created_at", order_dir="ASCENDING", limit=500,
    )
    return {"items": items, "total": total}


@router.post("/tickets/{tid}/replies", status_code=201)
def create_reply(tid: str, body: ReplyCreate, user: dict = Depends(get_current_user)):
    data = body.model_dump()
    data["ticket_id"] = tid
    data["author_id"] = user.get("id") or user.get("email")
    rep = HelpdeskTicketReplyRepo(user["org_id"]).create(data)
    # Mark first response time
    tk_repo = HelpdeskTicketRepo(user["org_id"])
    tk = tk_repo.get(tid)
    if tk and not tk.get("first_response_at") and not body.is_internal:
        tk_repo.update(tid, {"first_response_at": datetime.utcnow().isoformat(), "status": "pending"})
    return rep


# ─────────── CSAT ───────────
@router.post("/csat", status_code=201)
def create_csat(body: CSATCreate, user: dict = Depends(get_current_user)):
    return HelpdeskCSATRepo(user["org_id"]).create(body.model_dump())


@router.get("/csat")
def list_csat(user: dict = Depends(get_current_user), limit: int = 100):
    items, total = HelpdeskCSATRepo(user["org_id"]).list(limit=limit)
    return {"items": items, "total": total}


@router.get("/csat/summary")
def csat_summary(user: dict = Depends(get_current_user)):
    items, _ = HelpdeskCSATRepo(user["org_id"]).list(limit=10000)
    if not items:
        return {"count": 0, "avg_rating": 0.0, "satisfied_pct": 0.0}
    total = sum(i.get("rating", 0) for i in items)
    satisfied = sum(1 for i in items if i.get("rating", 0) >= 4)
    return {
        "count": len(items),
        "avg_rating": round(total / len(items), 2),
        "satisfied_pct": round(satisfied * 100 / len(items), 1),
    }


# ─────────── Canned Responses ───────────
@router.get("/canned")
def list_canned(user: dict = Depends(get_current_user)):
    items, total = HelpdeskCannedResponseRepo(user["org_id"]).list(limit=200)
    return {"items": items, "total": total}


@router.post("/canned", status_code=201)
def create_canned(body: CannedCreate, user: dict = Depends(get_current_user)):
    return HelpdeskCannedResponseRepo(user["org_id"]).create(body.model_dump())


@router.delete("/canned/{cid}", status_code=204)
def delete_canned(cid: str, user: dict = Depends(get_current_user)):
    repo = HelpdeskCannedResponseRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    repo.delete(cid)


# ─────────── Stats ───────────
@router.get("/stats")
def helpdesk_stats(user: dict = Depends(get_current_user)):
    repo = HelpdeskTicketRepo(user["org_id"])
    items, _ = repo.list(limit=10000)
    by_status: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    sla_breach = 0
    now = datetime.utcnow()
    for t in items:
        by_status[t.get("status", "new")] = by_status.get(t.get("status", "new"), 0) + 1
        by_priority[t.get("priority", "medium")] = by_priority.get(t.get("priority", "medium"), 0) + 1
        due = t.get("sla_resolution_due")
        if due and t.get("status") not in ("resolved", "closed"):
            try:
                if datetime.fromisoformat(due) < now:
                    sla_breach += 1
            except Exception:
                pass
    return {
        "total": len(items),
        "by_status": by_status,
        "by_priority": by_priority,
        "sla_breach": sla_breach,
    }
