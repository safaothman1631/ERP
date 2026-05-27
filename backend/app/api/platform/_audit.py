"""Platform audit helpers."""
from __future__ import annotations

import uuid
from datetime import datetime

from app.firebase_client import get_db


def audit_platform(org_id: str, user_id: str, action: str, meta: dict | None = None) -> None:
    try:
        db = get_db()
        entry_id = str(uuid.uuid4())
        db.collection("audit_logs").document(entry_id).set({
            "id": entry_id,
            "org_id": org_id,
            "user_id": user_id,
            "action": action,
            "entity_type": "platform",
            "entity_id": org_id,
            "metadata": meta or {},
            "created_at": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass
