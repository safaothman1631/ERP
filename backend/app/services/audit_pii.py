"""PII scrubbing for audit log entries (Wave E)."""
from __future__ import annotations

import hashlib
import re
from typing import Any

_EMAIL = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_PHONE = re.compile(r"\b\+?\d{10,15}\b")
_TAX_ID = re.compile(r"\b\d{9,14}\b")


def scrub_text(value: str, *, max_len: int = 2048) -> str:
    if not value:
        return value
    value = _EMAIL.sub("[email]", value)
    value = _PHONE.sub("[phone]", value)
    if len(value) > max_len:
        value = value[: max_len - 24] + "...[truncated]"
    return value


def hash_user_id(user_id: str | None) -> str | None:
    if not user_id:
        return None
    return hashlib.sha256(user_id.encode()).hexdigest()[:16]


def scrub_audit_entry(entry: dict[str, Any]) -> dict[str, Any]:
    out = dict(entry)
    if out.get("user_id"):
        out["user_id_hash"] = hash_user_id(str(out["user_id"]))
        out["user_id"] = None
    for key in ("path", "user_agent", "entity_id", "entity_type"):
        if key in out and isinstance(out[key], str):
            out[key] = scrub_text(out[key])
    return out
