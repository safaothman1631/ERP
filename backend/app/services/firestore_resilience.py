"""Helpers for graceful degradation when Firestore throttles requests."""
from __future__ import annotations

from dataclasses import dataclass, field

try:
    from google.api_core.exceptions import ResourceExhausted
except ImportError:  # pragma: no cover
    ResourceExhausted = ()  # type: ignore[misc, assignment]


LIST_HARD_CAP = 10_000


@dataclass
class ListMeta:
    truncated: bool = False
    degraded: bool = False
    doc_count_fetched: int = 0
    collection: str = ""
    org_id: str = ""

    def to_dict(self) -> dict:
        return {
            "truncated": self.truncated,
            "degraded": self.degraded,
            "doc_count_fetched": self.doc_count_fetched,
        }


def is_firestore_quota_error(exc: BaseException) -> bool:
    """True when Firestore/GCP rejected the call due to quota limits."""
    if ResourceExhausted and isinstance(exc, ResourceExhausted):
        return True
    msg = str(exc).lower()
    return "quota exceeded" in msg or "resource_exhausted" in msg


def empty_list_meta(collection: str, org_id: str, *, degraded: bool = False) -> ListMeta:
    return ListMeta(
        truncated=False,
        degraded=degraded,
        doc_count_fetched=0,
        collection=collection,
        org_id=org_id,
    )
