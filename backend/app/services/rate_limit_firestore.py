"""Optional Firestore-backed rate limit buckets (Wave T/Q)."""
from __future__ import annotations

from datetime import datetime

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.ttl_fields import expires_at_from_hours


def record_hit(org_id: str, path: str) -> None:
    """Best-effort counter doc with TTL (hot-path observability)."""
    try:
        safe = path.replace("/", "_")[:80]
        doc_id = f"{org_id}_{safe}"
        get_db().collection("rate_limit_buckets").document(doc_id).set(
            {
                "org_id": org_id,
                "path": path,
                "hits": fs.Increment(1),
                "updated_at": datetime.utcnow(),
                "expires_at": expires_at_from_hours(2),
            },
            merge=True,
        )
    except Exception:
        pass
