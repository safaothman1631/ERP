from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.firestore.system import AuditLogRepository
from app.firestore.users import UserRepository
from app.services.auth import get_current_user
from app.services.permissions import user_has_perm
from app.services import settings_service
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/audit", tags=["Audit"])


def _enrich_with_users(items, org_id):
    """Attach user_email / user_name fields by looking up user_id."""
    if not items:
        return items
    user_ids = {i.get("user_id") for i in items if i.get("user_id")}
    if not user_ids:
        return items
    u_repo = UserRepository(org_id)
    user_map = {}
    for uid in user_ids:
        u = u_repo.get(uid)
        if u:
            user_map[uid] = {"email": u.get("email"), "name": u.get("full_name") or u.get("name")}
    for it in items:
        uid = it.get("user_id")
        if uid and uid in user_map:
            it["user_email"] = user_map[uid]["email"]
            it["user_name"] = user_map[uid]["name"]
    return items


@router.get("")
def list_audit_logs(
    page: int = Query(1),
    page_size: int = Query(50, le=500),
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    method: Optional[str] = None,
    user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    mine_only: bool = False,
    user: dict = Depends(get_current_user),
):
    repo = AuditLogRepository(user["org_id"])
    filters = []

    # Permission: non-admin can only see their own logs unless they have audit.view_all
    if mine_only or not user_has_perm(user, "audit.view_all"):
        filters.append({"field": "user_id", "op": "==", "value": user["id"]})
    elif user_id:
        filters.append({"field": "user_id", "op": "==", "value": user_id})

    if entity_type:
        filters.append({"field": "entity_type", "op": "==", "value": entity_type})
    if action:
        filters.append({"field": "action", "op": "==", "value": action})
    if method:
        filters.append({"field": "method", "op": "==", "value": method.upper()})

    items, total = repo.list(
        filters=filters,
        order_by="created_at",
        limit=page_size,
        offset=(page - 1) * page_size,
    )

    # Apply retention policy filter
    try:
        cfg = settings_service.get_bag(user["org_id"], "audit")
    except Exception:
        cfg = {}
    retention_days = cfg.get("retention_days", 365)
    from datetime import datetime as dt, timedelta

    def _epoch(value):
        """Coerce created_at (Firestore Timestamp / datetime / ISO str / None)
        to an epoch float so the retention compare never mixes str and datetime."""
        if value is None:
            return 0.0
        if hasattr(value, "timestamp"):  # datetime / Firestore Timestamp
            try:
                return float(value.timestamp())
            except Exception:
                return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return dt.fromisoformat(value.replace("Z", "+00:00")).timestamp()
            except Exception:
                return 0.0
        return 0.0

    cutoff_epoch = (dt.utcnow() - timedelta(days=retention_days)).timestamp()
    items = [i for i in items if _epoch(i.get("created_at")) >= cutoff_epoch]

    # Date range filter in Python
    if date_from or date_to:
        def _d(x):
            return str(x)[:10] if x else ""
        if date_from:
            items = [i for i in items if _d(i.get("created_at")) >= date_from]
        if date_to:
            items = [i for i in items if _d(i.get("created_at")) <= date_to]

    items = _enrich_with_users(items, user["org_id"])
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/stats")
def audit_stats(user: dict = Depends(get_current_user)):
    """Summary stats for the audit log (last 30 days)."""
    from datetime import datetime, timedelta
    repo = AuditLogRepository(user["org_id"])
    filters = []
    if not user_has_perm(user, "audit.view_all"):
        filters.append({"field": "user_id", "op": "==", "value": user["id"]})
    items = collect_stream(repo, max_docs=10000)
    for f in filters:
        if f.get("op") == "==" and f.get("field"):
            items = [i for i in items if i.get(f["field"]) == f.get("value")]

    cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()
    recent = [i for i in items if str(i.get("created_at", "")) >= cutoff]

    by_action: dict = {}
    by_entity: dict = {}
    by_user: dict = {}
    for it in recent:
        a = it.get("action") or "unknown"
        e = it.get("entity_type") or "unknown"
        u = it.get("user_id") or "unknown"
        by_action[a] = by_action.get(a, 0) + 1
        by_entity[e] = by_entity.get(e, 0) + 1
        by_user[u] = by_user.get(u, 0) + 1

    return {
        "total_last_30_days": len(recent),
        "total_all_time": len(items),
        "by_action": [{"action": k, "count": v} for k, v in sorted(by_action.items(), key=lambda x: -x[1])],
        "by_entity": [{"entity_type": k, "count": v} for k, v in sorted(by_entity.items(), key=lambda x: -x[1])[:10]],
        "unique_users": len(by_user),
    }


@router.get("/{entity_type}/{entity_id}")
def entity_audit_log(entity_type: str, entity_id: str, user: dict = Depends(get_current_user)):
    repo = AuditLogRepository(user["org_id"])
    items, _ = repo.list(
        filters=[
            {"field": "entity_type", "op": "==", "value": entity_type},
            {"field": "entity_id", "op": "==", "value": entity_id},
        ],
        order_by="created_at", limit=100,
    )
    return _enrich_with_users(items, user["org_id"])
