"""Global prefix search API (P3 spike)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import get_settings
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services.search_service import unified_search

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get("", dependencies=[Depends(require_perm("items.read"))])
def search(
    q: str = Query(..., min_length=2, max_length=100),
    types: str = Query("items,contacts", max_length=100),
    limit: int = Query(25, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """Prefix search across items and contacts (Firestore `>=` / `<=` range)."""
    if not get_settings().SEARCH_PREFIX_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Search is disabled. Set SEARCH_PREFIX_ENABLED=true to enable.",
        )
    type_list = [t.strip() for t in types.split(",") if t.strip()]
    return unified_search(user["org_id"], q, types=type_list, limit=limit)
