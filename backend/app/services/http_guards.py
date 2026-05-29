"""HTTP helpers for foundation waves (R, C)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException

from app.firestore.references import ReferenceConflict
from app.services.versioned_update import apply_versioned_update


def raise_reference_conflict(exc: ReferenceConflict) -> None:
    raise HTTPException(
        status_code=409,
        detail={
            "code": "reference_conflict",
            "target": exc.target,
            "doc_id": exc.doc_id,
            "referenced_by": exc.referenced_by,
        },
    ) from exc


def guarded_delete(repo: Any, doc_id: str, *, hard: bool = False) -> None:
    try:
        repo.delete(doc_id, hard=hard)
    except ReferenceConflict as exc:
        raise_reference_conflict(exc)


def guarded_soft_deactivate(
    repo: Any,
    doc_id: str,
    *,
    collection_for_check: str | None = None,
    extra_updates: dict | None = None,
) -> dict:
    """Soft-deactivate only when no restrict FK references exist."""
    from app.services.reference_guard import find_item_usage_blockers, find_soft_delete_blockers

    coll = collection_for_check or getattr(repo, "collection_name", "")
    if coll == "items":
        blockers = find_item_usage_blockers(repo.org_id, doc_id)
    else:
        blockers = find_soft_delete_blockers(repo.org_id, coll, doc_id)
    if blockers:
        raise_reference_conflict(ReferenceConflict(coll, doc_id, blockers))
    payload = {"is_active": False, "deleted_at": datetime.utcnow()}
    if extra_updates:
        payload.update(extra_updates)
    return repo.update(doc_id, payload)


def versioned_repo_update(
    repo: Any,
    doc_id: str,
    data: dict,
    *,
    if_match: Optional[str] = None,
) -> dict:
    return apply_versioned_update(repo, doc_id, data, if_match=if_match)
