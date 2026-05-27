"""Hard-delete soft-deleted documents past retention (stream_org_docs)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from app.firebase_client import get_db, init_firebase
from app.firestore.base import BaseRepository

logger = logging.getLogger(__name__)

COLLECTIONS = (
    "invoices",
    "bills",
    "contacts",
    "items",
    "purchase_orders",
    "quotes",
)


class _Repo(BaseRepository):
    collection_name = ""


def purge_org(org_id: str, *, days: int = 90, apply: bool = True) -> int:
    init_firebase()
    cutoff = datetime.utcnow() - timedelta(days=days)
    removed = 0
    db = get_db()
    for name in COLLECTIONS:
        repo = _Repo(org_id)
        repo.collection_name = name
        repo.collection = db.collection(name)
        for doc in repo.stream_org_docs(include_deleted=True):
            deleted_at = doc.get("deleted_at")
            if not deleted_at:
                continue
            if isinstance(deleted_at, str):
                try:
                    s = deleted_at.replace(" ", "T").rstrip("Z")
                    deleted_at = datetime.fromisoformat(s)
                except Exception:
                    continue
            if deleted_at > cutoff:
                continue
            removed += 1
            if apply:
                repo.delete(doc["id"], hard=True)
    return removed


def run_scheduled_purge(*, days: int | None = None) -> int:
    """Purge soft-deleted docs for all orgs (scheduler entry)."""
    import os

    init_firebase()
    retention = days or int(os.getenv("SOFT_DELETE_RETENTION_DAYS", "90"))
    total = 0
    org_ids = [doc.id for doc in get_db().collection("organizations").stream()]
    for org_id in org_ids:
        if not org_id:
            continue
        try:
            n = purge_org(org_id, days=retention, apply=True)
            total += n
            if n:
                logger.info("purge_soft_deleted org=%s removed=%s", org_id, n)
        except Exception as exc:
            logger.warning("purge_soft_deleted failed org=%s: %s", org_id, exc)
    return total
