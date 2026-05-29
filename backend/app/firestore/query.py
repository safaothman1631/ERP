"""Server-side Firestore queries with cursor pagination."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from google.cloud import firestore as fs

from app.services.firestore_resilience import LIST_HARD_CAP, ListMeta, is_firestore_quota_error


@dataclass
class PageResult:
    items: list[dict]
    has_more: bool
    next_cursor: str | None
    meta: ListMeta


def _apply_python_filters(items: list[dict], filters: list[dict]) -> list[dict]:
    from app.firestore.base import _coerce

    for f in filters or []:
        op = f["op"]
        field = f["field"]
        val = f["value"]
        if op == "==":
            items = [i for i in items if i.get(field) == val]
        elif op == "!=":
            items = [i for i in items if i.get(field) != val]
        elif op == "in":
            items = [i for i in items if i.get(field) in val]
        elif op == ">":
            items = [i for i in items if i.get(field) is not None and _coerce(i.get(field), val) > val]
        elif op == ">=":
            items = [i for i in items if i.get(field) is not None and _coerce(i.get(field), val) >= val]
        elif op == "<":
            items = [i for i in items if i.get(field) is not None and _coerce(i.get(field), val) < val]
        elif op == "<=":
            items = [i for i in items if i.get(field) is not None and _coerce(i.get(field), val) <= val]
    return items


def list_page(
    repo: Any,
    *,
    filters: list[dict] | None = None,
    order_by: str = "created_at",
    order_dir: str = "DESCENDING",
    limit: int = 25,
    cursor_id: str | None = None,
    include_deleted: bool = False,
) -> PageResult:
    """Query Firestore with org_id + one extra equality filter max (index-friendly)."""
    import logging

    logger = logging.getLogger(__name__)
    collection = repo.collection
    org_id = repo.org_id
    meta = ListMeta(collection=repo.collection_name, org_id=org_id)

    firestore_filters = [f for f in (filters or []) if f.get("op") == "=="]
    python_filters = [f for f in (filters or []) if f.get("op") != "=="]

    try:
        direction = (
            fs.Query.DESCENDING if order_dir == "DESCENDING" else fs.Query.ASCENDING
        )
        q = collection.where("org_id", "==", org_id)
        for f in firestore_filters[:1]:
            q = q.where(f["field"], "==", f["value"])
        if order_by:
            q = q.order_by(order_by, direction=direction)
        if cursor_id:
            cursor_ref = collection.document(cursor_id)
            q = q.start_after(cursor_ref.get())
        docs = list(q.limit(min(limit + 1, LIST_HARD_CAP)).stream())
    except Exception as exc:
        if is_firestore_quota_error(exc):
            logger.warning(
                "Firestore quota on list_page collection=%s org_id=%s",
                repo.collection_name,
                org_id,
            )
            meta.degraded = True
            return PageResult([], False, None, meta)
        if _is_index_building_error(exc):
            logger.warning(
                "Firestore index not ready for list_page collection=%s org_id=%s: %s",
                repo.collection_name,
                org_id,
                exc,
            )
            return _list_page_fallback(
                repo,
                filters=filters,
                order_by=order_by,
                order_dir=order_dir,
                limit=limit,
                include_deleted=include_deleted,
                meta=meta,
            )
        raise

    items = [{"id": d.id, **d.to_dict()} for d in docs]
    meta.doc_count_fetched = len(items)
    if not include_deleted:
        items = [i for i in items if not i.get("deleted_at")]
    if python_filters:
        items = _apply_python_filters(items, python_filters)

    has_more = len(items) > limit
    if has_more:
        items = items[:limit]
    next_cursor = items[-1]["id"] if items and has_more else None
    for item in items:
        item["is_deleted"] = item.get("deleted_at") is not None

    repo.last_list_meta = meta
    return PageResult(items=items, has_more=has_more, next_cursor=next_cursor, meta=meta)


def _is_index_building_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return (
        "failed_precondition" in msg
        or "requires an index" in msg
        or "index is currently building" in msg
        or "the query requires an index" in msg
    )


def _list_page_fallback(
    repo: Any,
    *,
    filters: list[dict] | None,
    order_by: str,
    order_dir: str,
    limit: int,
    include_deleted: bool,
    meta: ListMeta,
) -> PageResult:
    """Client-side list when composite index is missing or still building."""
    meta.degraded = True
    items, _total = repo.list(
        filters=filters,
        order_by=order_by,
        order_dir=order_dir,
        limit=limit,
    )
    meta.doc_count_fetched = len(items)
    if not include_deleted:
        items = [i for i in items if not i.get("deleted_at")]
    repo.last_list_meta = meta
    return PageResult(items=items, has_more=False, next_cursor=None, meta=meta)
