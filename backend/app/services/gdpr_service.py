"""GDPR data-subject deletion (Article 17) with 30-day grace period."""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional

from app.firebase_client import get_db
from app.firestore.users import UserRepository

logger = logging.getLogger(__name__)

GRACE_DAYS = 30


def _anon_label(user_id: str) -> str:
    h = hashlib.sha256(user_id.encode()).hexdigest()[:8].upper()
    return f"Deleted User {h}"


def request_user_deletion(
    org_id: str,
    user_id: str,
    *,
    requested_by: str,
    reason: Optional[str] = None,
) -> dict:
    """Mark user for deletion after grace period; anonymize PII immediately."""
    repo = UserRepository(org_id)
    target = repo.get(user_id)
    if not target or target.get("org_id") != org_id:
        raise ValueError("user not found")
    if target.get("deletion_status") == "pending":
        return target

    now = datetime.utcnow()
    scheduled = now + timedelta(days=GRACE_DAYS)
    label = _anon_label(user_id)
    return repo.update(user_id, {
        "name": label,
        "display_name": label,
        "email": None,
        "phone": None,
        "mobile": None,
        "totp_secret": None,
        "active": False,
        "deleted_at": now.isoformat(),
        "deletion_requested_at": now.isoformat(),
        "deletion_scheduled_at": scheduled.isoformat(),
        "deletion_status": "pending",
        "deletion_requested_by": requested_by,
        "deletion_reason": reason,
    })


def hard_delete_due_users() -> dict:
    """Process users whose grace period has elapsed."""
    db = get_db()
    now = datetime.utcnow().isoformat()
    processed = 0
    errors: list[dict] = []

    try:
        docs = db.collection("users").where("deletion_status", "==", "pending").limit(500).stream()
        for doc in docs:
            data = doc.to_dict()
            user_id = doc.id
            org_id = data.get("org_id")
            scheduled = data.get("deletion_scheduled_at") or ""
            if scheduled and scheduled > now:
                continue
            try:
                _finalize_user_deletion(org_id, user_id, data)
                processed += 1
            except Exception as exc:
                errors.append({"user_id": user_id, "error": str(exc)})
                logger.error("GDPR hard delete failed for %s: %s", user_id, exc)
    except Exception as exc:
        errors.append({"error": str(exc)})

    return {"processed": processed, "errors": errors}


def _finalize_user_deletion(org_id: str, user_id: str, data: dict) -> None:
    db = get_db()
    label = _anon_label(user_id)

    # Anonymize audit log entries referencing this user
    try:
        logs = db.collection("audit_logs").where("user_id", "==", user_id).limit(500).stream()
        for log in logs:
            log.reference.update({
                "user_email": None,
                "user_name": "(deleted)",
            })
    except Exception as exc:
        logger.warning("Could not anonymize audit logs for %s: %s", user_id, exc)

    try:
        from app.services.gdpr_traversal import anonymize_user_references

        anonymize_user_references(org_id, user_id)
    except Exception as exc:
        logger.warning("GDPR FK traversal failed for %s: %s", user_id, exc)

    UserRepository(org_id).update(user_id, {
        "deletion_status": "completed",
        "hard_deleted_at": datetime.utcnow().isoformat(),
        "name": label,
        "display_name": label,
        "email": None,
    })
