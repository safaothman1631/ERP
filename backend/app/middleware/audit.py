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
_SKIP_METHODS = {"GET", "HEAD", "OPTIONS"}


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


async def audit_middleware(request: Request, call_next):
    method = request.method.upper()
    path = request.url.path

    # Skip non-mutating and whitelisted paths
    if method in _SKIP_METHODS or any(path.startswith(p) for p in _SKIP_PATHS):
        return await call_next(request)

    start = time.time()
    response: Response = await call_next(request)
    duration_ms = int((time.time() - start) * 1000)

    # Only log successful mutating operations (2xx)
    if response.status_code >= 400:
        return response

    try:
        user_info = _decode_user(request)
        if not user_info or not user_info.get("org_id"):
            return response

        entity_type, entity_id = _entity_from_path(path)

        action_map = {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}
        action = action_map.get(method, method.lower())

        now = datetime.utcnow()
        db = get_db()
        db.collection("audit_logs").document(str(uuid.uuid4())).set({
            "org_id": user_info["org_id"],
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
            # داواکاری ٦.٦، ١٤.٨: timestamp field required by spec (P5 audit trail property)
            "timestamp": now,
            "created_at": now,
        })
    except Exception:
        # Never block the response because of audit failures
        pass

    return response
