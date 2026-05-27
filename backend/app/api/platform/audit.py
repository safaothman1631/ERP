"""Platform audit log viewer."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Response

from app.firebase_client import get_db

from ._guards import require_platform_admin

router = APIRouter()


@router.get("/audit")
def list_audit(
    user: dict = Depends(require_platform_admin),
    org_id: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    db = get_db()
    query = db.collection("audit_logs")
    if org_id:
        query = query.where("org_id", "==", org_id)
    items = []
    for doc in query.limit(1000).stream():
        row = {"id": doc.id, **doc.to_dict()}
        if action and not str(row.get("action", "")).startswith(action):
            continue
        items.append(row)
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"items": items[:limit], "total": len(items)}


@router.get("/audit/export")
def export_audit_csv(
    user: dict = Depends(require_platform_admin),
    org_id: Optional[str] = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=10000),
):
    data = list_audit(user=user, org_id=org_id, limit=limit)
    lines = ["id,org_id,user_id,action,created_at"]
    for row in data["items"]:
        lines.append(",".join([
            str(row.get("id", "")),
            str(row.get("org_id", "")),
            str(row.get("user_id", "")),
            str(row.get("action", "")).replace(",", ";"),
            str(row.get("created_at", "")),
        ]))
    body = "\n".join(lines)
    return Response(content=body, media_type="text/csv", headers={
        "Content-Disposition": "attachment; filename=platform_audit.csv",
    })
