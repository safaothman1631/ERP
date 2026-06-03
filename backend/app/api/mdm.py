"""Master Data Management (MDM) API (Pool 3.6).

Thin REST surface over the validated pure engine ``app.services.mdm_golden``:
deduplicate a master-data collection, merge a duplicate set into one golden
record, and list previously-merged golden records.

Endpoints:
    POST /api/mdm/dedup            group duplicate master records
    POST /api/mdm/merge           merge records into a golden record (persisted)
    GET  /api/mdm/golden-records  list merged golden records
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.firestore.mdm import GoldenRecordRepository
from app.services.auth import get_current_user
from app.services.mdm_golden import find_duplicate_groups, merge_golden

router = APIRouter(prefix="/api/mdm", tags=["MDM"])

# Master-data entities that can be deduplicated.
_SUPPORTED_ENTITIES = ("contacts", "items")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _source_repo(entity: str, org_id: str):
    """Return the repository for a supported master-data entity."""
    if entity == "contacts":
        from app.firestore.contacts import ContactRepository

        return ContactRepository(org_id)
    if entity == "items":
        from app.firestore.items import ItemRepository

        return ItemRepository(org_id)
    raise HTTPException(400, f"unsupported entity '{entity}' (use one of {list(_SUPPORTED_ENTITIES)})")


@router.post("/dedup")
def dedup(data: dict, user: dict = Depends(get_current_user)):
    """Find duplicate groups in a master-data collection.

    Body: {entity: "contacts"|"items", keys: [...], threshold?: float}
    Streams that org collection, runs the pure ``find_duplicate_groups`` engine
    and returns only the groups with more than one member (i.e. real duplicates).
    """
    entity = (data.get("entity") or "").strip()
    if entity not in _SUPPORTED_ENTITIES:
        raise HTTPException(400, f"entity must be one of {list(_SUPPORTED_ENTITIES)}")
    keys = data.get("keys") or []
    if not isinstance(keys, list) or not keys:
        raise HTTPException(400, "keys (non-empty list) required")
    threshold = float(data.get("threshold", 1.0))

    repo = _source_repo(entity, user["org_id"])
    records = list(repo.stream_org_docs())

    groups = find_duplicate_groups(records, keys, threshold=threshold)
    dup_groups = [g for g in groups if len(g) > 1]

    return {
        "entity": entity,
        "keys": keys,
        "threshold": threshold,
        "record_count": len(records),
        "duplicate_group_count": len(dup_groups),
        "groups": [
            {"size": len(g), "ids": [r.get("id") for r in g], "records": g}
            for g in dup_groups
        ],
    }


@router.post("/merge", status_code=201)
def merge(data: dict, user: dict = Depends(get_current_user)):
    """Merge a duplicate set into a single golden record and persist it.

    Body: {records: [...], entity?: str, recency_field?: str}
    Uses the pure ``merge_golden`` engine (most-recent non-empty value wins),
    then stores the result in ``mdm_golden_records``.
    """
    records = data.get("records") or []
    if not isinstance(records, list) or len(records) < 2:
        raise HTTPException(400, "records (list of >= 2) required to merge")
    recency_field = data.get("recency_field") or "updated_at"

    golden = merge_golden(records, recency_field=recency_field)
    if not golden:
        raise HTTPException(400, "merge produced an empty record")

    # The merged golden record carries source fields (incl. id/org_id); strip the
    # identity ones so the repository assigns a fresh golden id + the caller's org.
    golden.pop("id", None)
    golden.pop("org_id", None)

    repo = GoldenRecordRepository(user["org_id"])
    payload = {
        "id": str(uuid.uuid4()),
        "entity": data.get("entity") or "",
        "source_ids": golden.get("_merged_from", []),
        "golden": golden,
        "merged_at": _now_iso(),
        "merged_by": user.get("id") or user.get("uid") or user.get("email"),
    }
    return repo.create(payload)


@router.get("/golden-records")
def list_golden_records(user: dict = Depends(get_current_user)):
    """List previously-merged golden master records (most recent first)."""
    repo = GoldenRecordRepository(user["org_id"])
    items, _ = repo.list(order_by="merged_at", order_dir="DESCENDING", limit=200)
    return items
