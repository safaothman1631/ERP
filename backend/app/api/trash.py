"""Trash / Recycle Bin API.

Soft-deleted records (with `deleted_at` set) are listed here. Users can:
- Browse deleted items per collection
- Restore (clear `deleted_at`)
- Permanently delete (hard remove)

Records older than `TRASH_RETENTION_DAYS` are auto-purged by `purge_expired()`.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.auth import get_current_user
from app.firebase_client import get_db
from app.firestore.base import BaseRepository

router = APIRouter(prefix="/api/trash", tags=["trash"])

TRASH_RETENTION_DAYS = 30

# Whitelist of collections that participate in soft-delete / Trash UI.
# Each entry: (collection_name, ku_label_key, en_label_key).
TRASHABLE_COLLECTIONS: list[tuple[str, str, str]] = [
    ("contacts", "contacts", "Contacts"),
    ("items", "items", "Items"),
    ("invoices", "invoices", "Invoices"),
    ("quotes", "quotes", "Quotes"),
    ("sales_orders", "sales_orders", "Sales Orders"),
    ("purchase_orders", "purchase_orders", "Purchase Orders"),
    ("bills", "bills", "Bills"),
    ("expenses", "expenses", "Expenses"),
    ("credit_notes", "credit_notes", "Credit Notes"),
    ("vendor_credits", "vendor_credits", "Vendor Credits"),
    ("projects", "projects", "Projects"),
    ("assets", "assets", "Assets"),
]

_COLLECTION_NAMES = {c[0] for c in TRASHABLE_COLLECTIONS}


def _repo_for(collection: str, org_id: str) -> BaseRepository:
    if collection not in _COLLECTION_NAMES:
        raise HTTPException(status_code=400, detail=f"Collection not trashable: {collection}")
    repo = BaseRepository(org_id)
    repo.collection_name = collection
    repo.collection = repo.db.collection(collection)
    return repo


@router.get("")
def list_trash(
    collection: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """List soft-deleted items. If `collection` is omitted, returns items across all
    whitelisted collections (capped). Includes a `_collection` field on each item.
    """
    org_id = user["org_id"]
    targets = [collection] if collection else [c[0] for c in TRASHABLE_COLLECTIONS]
    rows: list[dict] = []
    for col in targets:
        if col not in _COLLECTION_NAMES:
            continue
        repo = _repo_for(col, org_id)
        items, _total = repo.list(include_deleted=True, limit=500)
        for item in items:
            if item.get("deleted_at"):
                rows.append({**item, "_collection": col})

    # Sort by deleted_at desc
    def _key(x):
        v = x.get("deleted_at")
        return v if isinstance(v, datetime) else datetime.min

    rows.sort(key=_key, reverse=True)
    total = len(rows)
    start = (page - 1) * page_size
    return {
        "items": rows[start : start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "retention_days": TRASH_RETENTION_DAYS,
    }


@router.get("/stats")
def trash_stats(user: dict = Depends(get_current_user)):
    """Return count of trashed items per collection."""
    org_id = user["org_id"]
    out: list[dict] = []
    for col, ku_key, en_label in TRASHABLE_COLLECTIONS:
        repo = _repo_for(col, org_id)
        items, _ = repo.list(include_deleted=True, limit=1000)
        count = sum(1 for i in items if i.get("deleted_at"))
        out.append({"collection": col, "key": ku_key, "label": en_label, "count": count})
    return {"stats": out, "retention_days": TRASH_RETENTION_DAYS}


@router.post("/restore/{collection}/{doc_id}")
def restore(collection: str, doc_id: str, user: dict = Depends(get_current_user)):
    """Restore a soft-deleted document."""
    repo = _repo_for(collection, user["org_id"])
    existing = repo.get(doc_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    if existing.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return repo.restore(doc_id)


@router.delete("/permanent/{collection}/{doc_id}")
def permanent_delete(collection: str, doc_id: str, user: dict = Depends(get_current_user)):
    """Permanently delete a soft-deleted document (irreversible)."""
    repo = _repo_for(collection, user["org_id"])
    existing = repo.get(doc_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    if existing.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not existing.get("deleted_at"):
        raise HTTPException(status_code=400, detail="Document is not in trash")
    repo.delete(doc_id, hard=True)
    return {"ok": True}


@router.post("/purge-expired")
def purge_expired(user: dict = Depends(get_current_user)):
    """Permanently delete every trashed item older than TRASH_RETENTION_DAYS.

    Intended for scheduled invocation (cron). Returns count purged per collection.
    """
    org_id = user["org_id"]
    cutoff = datetime.utcnow() - timedelta(days=TRASH_RETENTION_DAYS)
    purged: dict[str, int] = {}
    for col, _ku, _en in TRASHABLE_COLLECTIONS:
        repo = _repo_for(col, org_id)
        items, _ = repo.list(include_deleted=True, limit=1000)
        n = 0
        for item in items:
            d = item.get("deleted_at")
            if isinstance(d, datetime) and d < cutoff:
                repo.delete(item["id"], hard=True)
                n += 1
        if n:
            purged[col] = n
    return {"purged": purged, "cutoff": cutoff.isoformat()}
