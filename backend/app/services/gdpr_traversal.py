"""GDPR traversal using FK catalogue (Wave E6)."""
from __future__ import annotations

import logging
from typing import Any

from app.firebase_client import get_db
from app.firestore.references import REFERENCES

logger = logging.getLogger(__name__)

_USER_POINTER_FIELDS = frozenset({"user_id", "created_by", "owner_id", "assigned_to"})


def find_documents_referencing_user(org_id: str, user_id: str, *, limit_per_collection: int = 50) -> list[dict]:
    """Return docs in org that reference ``user_id`` via known pointer fields."""
    db = get_db()
    hits: list[dict] = []
    for collection in REFERENCES:
        try:
            query = db.collection(collection).where("org_id", "==", org_id).limit(limit_per_collection)
            for doc in query.stream():
                data = doc.to_dict() or {}
                for field in _USER_POINTER_FIELDS:
                    if data.get(field) == user_id:
                        hits.append({
                            "collection": collection,
                            "id": doc.id,
                            "field": field,
                        })
                        break
        except Exception as exc:
            logger.debug("gdpr_scan_skip %s: %s", collection, exc)
    return hits


def anonymize_user_references(org_id: str, user_id: str) -> dict[str, Any]:
    """Anonymize pointer fields referencing a deleted user (best-effort)."""
    db = get_db()
    updated = 0
    for hit in find_documents_referencing_user(org_id, user_id):
        try:
            db.collection(hit["collection"]).document(hit["id"]).update({
                hit["field"]: None,
                "updated_at": __import__("datetime").datetime.utcnow(),
            })
            updated += 1
        except Exception as exc:
            logger.warning("gdpr_anonymize_failed %s/%s: %s", hit["collection"], hit["id"], exc)
    return {"org_id": org_id, "user_id": user_id, "references_cleared": updated}


CORE_COLLECTIONS = frozenset(
    set(REFERENCES.keys())
    | {
        "users",
        "contacts",
        "items",
        "invoices",
        "bills",
        "accounts",
        "journal_entries",
        "payments_received",
        "payments_made",
        "audit_logs",
    }
)


def build_org_data_manifest(org_id: str, *, limit_per_collection: int = 500) -> dict[str, Any]:
    from datetime import datetime

    db = get_db()
    manifest: dict[str, int] = {}
    for coll in sorted(CORE_COLLECTIONS):
        try:
            count = sum(
                1
                for _ in db.collection(coll).where("org_id", "==", org_id).limit(limit_per_collection).stream()
            )
            manifest[coll] = count
        except Exception as exc:
            logger.debug("gdpr_manifest_skip %s: %s", coll, exc)
            manifest[coll] = -1
    return {
        "org_id": org_id,
        "generated_at": datetime.utcnow().isoformat(),
        "collections": manifest,
        "total_docs": sum(c for c in manifest.values() if c >= 0),
    }


def process_org_user_erasure(org_id: str) -> dict[str, Any]:
    from app.firestore.users import UserRepository
    from app.services.gdpr_service import request_user_deletion

    repo = UserRepository(org_id)
    items, _ = repo.list(limit=500)
    processed = 0
    for u in items:
        uid = u.get("id")
        if not uid:
            continue
        try:
            request_user_deletion(org_id, uid, requested_by="org_erasure", reason="org_offboarding")
            anonymize_user_references(org_id, uid)
            processed += 1
        except Exception as exc:
            logger.warning("gdpr_org_user_skip %s: %s", uid, exc)
    return {"org_id": org_id, "users_processed": processed}
