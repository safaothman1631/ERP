"""Unit tests for audit middleware (Task 7.3).

Validates:
- POST/PUT/PATCH/DELETE requests are logged to audit_logs collection
- Each log entry contains user_id, action, and timestamp fields
- GET/HEAD/OPTIONS requests are NOT logged
- Whitelisted paths (health, auth/login, etc.) are NOT logged
- Failed requests (4xx/5xx) are NOT logged
- Audit failures never block the response
"""
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch, call
import pytest
from fastapi import Request
from fastapi.responses import Response


# ─── helpers ────────────────────────────────────────────────────────────────

def _make_request(method: str, path: str, auth_header: str | None = None) -> MagicMock:
    """Build a minimal mock Request object."""
    req = MagicMock(spec=Request)
    req.method = method
    req.url.path = path
    req.client.host = "127.0.0.1"
    req.headers = {}
    if auth_header:
        req.headers = {"authorization": auth_header, "user-agent": "test-agent"}
    else:
        req.headers = {"user-agent": "test-agent"}
    return req


def _make_response(status_code: int = 201) -> MagicMock:
    resp = MagicMock(spec=Response)
    resp.status_code = status_code
    return resp


# ─── fixtures ────────────────────────────────────────────────────────────────

VALID_JWT_PAYLOAD = {"sub": "user-123", "org_id": "org-abc"}

# A fake JWT token string (content doesn't matter — we mock jwt.decode)
FAKE_TOKEN = "header.payload.signature"
FAKE_AUTH_HEADER = f"Bearer {FAKE_TOKEN}"


# ─── tests ───────────────────────────────────────────────────────────────────

class TestAuditMiddlewareLogsRequiredFields:
    """Verify that mutating requests produce log entries with user_id, action, timestamp."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("method,expected_action", [
        ("POST", "create"),
        ("PUT", "update"),
        ("PATCH", "update"),
        ("DELETE", "delete"),
    ])
    async def test_mutating_methods_are_logged(self, method, expected_action):
        """POST/PUT/PATCH/DELETE must produce an audit_logs entry."""
        from app.middleware.audit import audit_middleware

        req = _make_request(method, "/api/invoices", FAKE_AUTH_HEADER)
        resp = _make_response(201)
        call_next = AsyncMock(return_value=resp)

        captured = {}

        def fake_set(data):
            captured.update(data)

        mock_doc_ref = MagicMock()
        mock_doc_ref.set = fake_set
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection

        with patch("app.middleware.audit.jwt.decode", return_value=VALID_JWT_PAYLOAD), \
             patch("app.middleware.audit.get_db", return_value=mock_db):
            result = await audit_middleware(req, call_next)

        assert result is resp
        # Verify the collection used
        mock_db.collection.assert_called_once_with("audit_logs")

        # Required fields per spec (داواکاری ٦.٦، ١٤.٨)
        assert captured.get("user_id") == "user-123", "user_id must be logged"
        assert captured.get("action") == expected_action, f"action must be '{expected_action}' for {method}"
        assert "timestamp" in captured, "timestamp field must be present"
        assert isinstance(captured["timestamp"], datetime), "timestamp must be a datetime"
        assert captured["timestamp"] <= datetime.utcnow(), "timestamp must be ≤ now()"

    @pytest.mark.asyncio
    async def test_log_entry_contains_org_id(self):
        """Audit log must include org_id for multi-tenant isolation."""
        from app.middleware.audit import audit_middleware

        req = _make_request("POST", "/api/contacts", FAKE_AUTH_HEADER)
        resp = _make_response(201)
        call_next = AsyncMock(return_value=resp)

        captured = {}
        mock_doc_ref = MagicMock()
        mock_doc_ref.set = lambda data: captured.update(data)
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection

        with patch("app.middleware.audit.jwt.decode", return_value=VALID_JWT_PAYLOAD), \
             patch("app.middleware.audit.get_db", return_value=mock_db):
            await audit_middleware(req, call_next)

        assert captured.get("org_id") == "org-abc"

    @pytest.mark.asyncio
    async def test_log_entry_contains_created_at(self):
        """created_at must also be present (backward compat with AuditLogRepository)."""
        from app.middleware.audit import audit_middleware

        req = _make_request("POST", "/api/invoices", FAKE_AUTH_HEADER)
        resp = _make_response(201)
        call_next = AsyncMock(return_value=resp)

        captured = {}
        mock_doc_ref = MagicMock()
        mock_doc_ref.set = lambda data: captured.update(data)
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection

        with patch("app.middleware.audit.jwt.decode", return_value=VALID_JWT_PAYLOAD), \
             patch("app.middleware.audit.get_db", return_value=mock_db):
            await audit_middleware(req, call_next)

        assert "created_at" in captured
        assert isinstance(captured["created_at"], datetime)

    @pytest.mark.asyncio
    async def test_timestamp_and_created_at_are_equal(self):
        """timestamp and created_at must be the same value (same datetime object)."""
        from app.middleware.audit import audit_middleware

        req = _make_request("PUT", "/api/invoices/inv-1", FAKE_AUTH_HEADER)
        resp = _make_response(200)
        call_next = AsyncMock(return_value=resp)

        captured = {}
        mock_doc_ref = MagicMock()
        mock_doc_ref.set = lambda data: captured.update(data)
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection

        with patch("app.middleware.audit.jwt.decode", return_value=VALID_JWT_PAYLOAD), \
             patch("app.middleware.audit.get_db", return_value=mock_db):
            await audit_middleware(req, call_next)

        assert captured["timestamp"] == captured["created_at"]


class TestAuditMiddlewareSkipsNonMutating:
    """GET/HEAD/OPTIONS must NOT produce audit log entries."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("method", ["GET", "HEAD", "OPTIONS"])
    async def test_read_methods_not_logged(self, method):
        from app.middleware.audit import audit_middleware

        req = _make_request(method, "/api/invoices", FAKE_AUTH_HEADER)
        resp = _make_response(200)
        call_next = AsyncMock(return_value=resp)

        mock_db = MagicMock()

        with patch("app.middleware.audit.get_db", return_value=mock_db):
            result = await audit_middleware(req, call_next)

        assert result is resp
        mock_db.collection.assert_not_called()


class TestAuditMiddlewareSkipsWhitelistedPaths:
    """Whitelisted paths must NOT be logged (health, auth/login, etc.)."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("path", [
        "/api/health",
        "/api/auth/login",
        "/api/auth/setup",
        "/api/auth/status",
        "/api/auth/refresh",
        "/api/audit",
    ])
    async def test_whitelisted_paths_not_logged(self, path):
        from app.middleware.audit import audit_middleware

        req = _make_request("POST", path, FAKE_AUTH_HEADER)
        resp = _make_response(200)
        call_next = AsyncMock(return_value=resp)

        mock_db = MagicMock()

        with patch("app.middleware.audit.get_db", return_value=mock_db):
            result = await audit_middleware(req, call_next)

        assert result is resp
        mock_db.collection.assert_not_called()


class TestAuditMiddlewareSkipsFailedRequests:
    """4xx/5xx responses must NOT produce audit log entries."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("status_code", [400, 401, 403, 404, 422, 500])
    async def test_error_responses_not_logged(self, status_code):
        from app.middleware.audit import audit_middleware

        req = _make_request("POST", "/api/invoices", FAKE_AUTH_HEADER)
        resp = _make_response(status_code)
        call_next = AsyncMock(return_value=resp)

        mock_db = MagicMock()

        with patch("app.middleware.audit.jwt.decode", return_value=VALID_JWT_PAYLOAD), \
             patch("app.middleware.audit.get_db", return_value=mock_db):
            result = await audit_middleware(req, call_next)

        assert result is resp
        mock_db.collection.assert_not_called()


class TestAuditMiddlewareNeverBlocksResponse:
    """Audit failures must never block the HTTP response."""

    @pytest.mark.asyncio
    async def test_firestore_error_does_not_raise(self):
        """If Firestore write fails, the response must still be returned."""
        from app.middleware.audit import audit_middleware

        req = _make_request("POST", "/api/invoices", FAKE_AUTH_HEADER)
        resp = _make_response(201)
        call_next = AsyncMock(return_value=resp)

        mock_db = MagicMock()
        mock_db.collection.side_effect = RuntimeError("Firestore unavailable")

        with patch("app.middleware.audit.jwt.decode", return_value=VALID_JWT_PAYLOAD), \
             patch("app.middleware.audit.get_db", return_value=mock_db):
            result = await audit_middleware(req, call_next)

        # Response must be returned despite the Firestore error
        assert result is resp

    @pytest.mark.asyncio
    async def test_missing_auth_header_does_not_log(self):
        """Requests without Authorization header are silently skipped (no crash)."""
        from app.middleware.audit import audit_middleware

        req = _make_request("POST", "/api/invoices")  # no auth header
        resp = _make_response(201)
        call_next = AsyncMock(return_value=resp)

        mock_db = MagicMock()

        with patch("app.middleware.audit.get_db", return_value=mock_db):
            result = await audit_middleware(req, call_next)

        assert result is resp
        mock_db.collection.assert_not_called()


class TestAuditMiddlewareEntityExtraction:
    """Verify entity_type and entity_id are correctly extracted from paths."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("path,expected_entity_type,expected_entity_id", [
        ("/api/invoices", "invoices", None),
        ("/api/invoices/inv-00000001", "invoices", "inv-00000001"),
        ("/api/contacts/contact-abc123def", "contacts", "contact-abc123def"),
        ("/api/v1/invoices", "v1", None),  # versioned path — entity_type is 'v1'
    ])
    async def test_entity_extraction(self, path, expected_entity_type, expected_entity_id):
        from app.middleware.audit import audit_middleware

        req = _make_request("POST", path, FAKE_AUTH_HEADER)
        resp = _make_response(201)
        call_next = AsyncMock(return_value=resp)

        captured = {}
        mock_doc_ref = MagicMock()
        mock_doc_ref.set = lambda data: captured.update(data)
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection

        with patch("app.middleware.audit.jwt.decode", return_value=VALID_JWT_PAYLOAD), \
             patch("app.middleware.audit.get_db", return_value=mock_db):
            await audit_middleware(req, call_next)

        assert captured.get("entity_type") == expected_entity_type
        assert captured.get("entity_id") == expected_entity_id
