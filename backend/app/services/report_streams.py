"""Stream-based report iterators (avoid list(10000) full scans)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Iterator

from app.services.firestore_resilience import LIST_HARD_CAP


def _coerce(item_val: Any, filter_val: Any) -> Any:
    if isinstance(filter_val, datetime) and isinstance(item_val, str):
        try:
            s = item_val.replace(" ", "T").rstrip("Z")
            if len(s) == 10:
                s += "T00:00:00"
            return datetime.fromisoformat(s)
        except Exception:
            return item_val
    if isinstance(filter_val, datetime) and isinstance(item_val, date):
        return datetime(item_val.year, item_val.month, item_val.day)
    return item_val


def _matches_filters(doc: dict, filters: list[dict] | None) -> bool:
    for f in filters or []:
        op = f.get("op")
        field = f.get("field")
        val = f.get("value")
        if op == "==":
            if doc.get(field) != val:
                return False
        elif op == "in":
            if doc.get(field) not in val:
                return False
        elif op == "!=":
            if doc.get(field) == val:
                return False
        elif op == ">":
            item_val = doc.get(field)
            if item_val is None or _coerce(item_val, val) <= val:
                return False
        elif op == ">=":
            item_val = doc.get(field)
            if item_val is None or _coerce(item_val, val) < val:
                return False
        elif op == "<":
            item_val = doc.get(field)
            if item_val is None or _coerce(item_val, val) >= val:
                return False
        elif op == "<=":
            item_val = doc.get(field)
            if item_val is None or _coerce(item_val, val) > val:
                return False
    return True


def stream_org_filtered(
    repo: Any,
    *,
    filters: list[dict] | None = None,
    status_in: set[str] | None = None,
    max_docs: int = LIST_HARD_CAP,
) -> Iterator[dict]:
    """Iterate org docs with optional status set and filter list."""
    count = 0
    for doc in repo.stream_org_docs():
        if status_in is not None and doc.get("status") not in status_in:
            continue
        if not _matches_filters(doc, filters):
            continue
        yield doc
        count += 1
        if count >= max_docs:
            break


def collect_stream(
    repo: Any,
    *,
    filters: list[dict] | None = None,
    status_in: set[str] | None = None,
    max_docs: int = LIST_HARD_CAP,
) -> list[dict]:
    return list(
        stream_org_filtered(
            repo, filters=filters, status_in=status_in, max_docs=max_docs
        )
    )
