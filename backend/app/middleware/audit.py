"""Audit middleware - auto-logs POST/PUT/PATCH/DELETE requests to audit_logs."""
import json
import time
import uuid
from datetime import datetime
from typing import Optional
from fastapi import Request, Response
from jose import jwt, JWTError
from app.config import get_settings
from app.firebase_client import get_db
from app.services.audit_chain import GENESIS_HASH, compute_audit_hash

_settings = get_settings()

# Paths that should NOT be audited (noise)
_SKIP_PATHS = (
    "/api/health",
    "/api/auth/login",
    "/api/auth/setup",
    "/api/auth/status",
    "/api/auth/refresh",
    "/api/audit",
)
_SKIP_METHODS = {"HEAD", "OPTIONS"}
_MAX_AUDIT_FIELD_LEN = 100 * 1024  # Wave D: cap stored audit payload fields


def _truncate(value: str, limit: int = _MAX_AUDIT_FIELD_LEN) -> str:
    if len(value) <= limit:
        return value
    return value[: limit - 32] + "...[truncated]"


def _scrub_pii_from_text(text: str) -> str:
    """Redact obvious PII patterns from audit metadata (Wave E)."""
    import re

    text = re.sub(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", "[email]", text)
    text = re.sub(r"\b\+?\d{10,15}\b", "[phone]", text)
    return _truncate(text, 2048)

# Sensitive GET paths logged for compliance (Phase 2)
_SENSITIVE_GET_PREFIXES = (
    "/api/payroll",
    "/api/hr",
    "/api/banking",
    "/api/users",
    "/api/settings",
)


def _decode_user(request: Request) -> Optional[dict]:
    """Best-effort decode of JWT from Authorization header."""
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, _settings.SECRET_KEY, algorithms=[_settings.ALGORITHM])
        return {"user_id": payload.get("sub"), "org_id": payload.get("org_id")}
    except JWTError:
        return None


def _entity_from_path(path: str) -> tuple:
    """Extract entity_type and entity_id from a path like /api/invoices/{id}/pay."""
    parts = [p for p in path.split("/") if p]
    # Drop leading 'api'
    if parts and parts[0] == "api":
        parts = parts[1:]
    entity_type = parts[0] if parts else ""
    entity_id = parts[1] if len(parts) > 1 and len(parts[1]) > 8 else None
    return entity_type, entity_id


def _last_audit_hash(db, org_id: str) -> str:
    """Return the hash of the most recent audit log for an org (Python-side sort)."""
    try:
        docs = db.collection("audit_logs").where("org_id", "==", org_id).limit(200).stream()
        items = [{"id": d.id, **d.to_dict()} for d in docs]
        if not items:
            return GENESIS_HASH
        items.sort(key=lambda x: str(x.get("created_at") or x.get("timestamp") or ""), reverse=True)
        return items[0].get("hash") or GENESIS_HASH
    except Exception:
        return GENESIS_HASH


def _write_audit_entry(db, entry: dict) -> None:
    db.collection("audit_logs").document(entry["id"]).set(entry)


_MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


async def audit_middleware(request: Request, call_next):
    method = request.method.upper()
    path = request.url.path

    # Skip whitelisted paths for mutations; GET only logged when sensitive
    if any(path.startswith(p) for p in _SKIP_PATHS):
        return await call_next(request)

    log_get = method == "GET" and any(path.startswith(p) for p in _SENSITIVE_GET_PREFIXES)
    if method in _SKIP_METHODS:
        return await call_next(request)
    if method == "GET" and not log_get:
        return await call_next(request)

    start = time.time()
    response: Response = await call_next(request)
    duration_ms = int((time.time() - start) * 1000)

    # Only log successful operations (2xx)
    if response.status_code >= 400:
        return response

    try:
        user_info = _decode_user(request)
        if not user_info or not user_info.get("org_id"):
            return response

        entity_type, entity_id = _entity_from_path(path)

        if log_get:
            action = "read"
        elif method not in _MUTATING_METHODS:
            return response
        else:
            action_map = {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}
            action = action_map.get(method, method.lower())

        now = datetime.utcnow()
        db = get_db()
        org_id = user_info["org_id"]
        prev_hash = _last_audit_hash(db, org_id)
        log_id = str(uuid.uuid4())
        entry_hash = compute_audit_hash(
            org_id=org_id,
            user_id=user_info.get("user_id"),
            method=method,
            path=path,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            prev_hash=prev_hash,
            timestamp=now,
        )
        from app.services.audit_pii import scrub_audit_entry

        _write_audit_entry(
            db,
            scrub_audit_entry({
                "id": log_id,
                "org_id": org_id,
                "user_id": user_info.get("user_id"),
                "method": method,
                "path": path,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "action": action,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "ip": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent", "")[:300],
                "timestamp": now,
                "created_at": now,
                "prev_hash": prev_hash,
                "hash": entry_hash,
            }),
        )
    except Exception:
        # Never block the response because of audit failures
        pass

    return response
