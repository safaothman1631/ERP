"""Standard paginated API envelopes with Firestore list meta."""
from __future__ import annotations

from typing import Any


def paginated_response(
    items: list,
    total: int,
    page: int,
    page_size: int,
    repo: Any = None,
    **extra: Any,
) -> dict:
    meta = getattr(repo, "last_list_meta", None)
    meta_dict = meta.to_dict() if meta is not None and hasattr(meta, "to_dict") else (meta or {})
    total_pages = (total + page_size - 1) // page_size if page_size else 0
    body = {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "meta": meta_dict,
        **extra,
    }
    if "next_cursor" in extra and extra["next_cursor"]:
        body["next_cursor"] = extra["next_cursor"]
    return body
