"""Tests for module gate and path registry."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _user():
    return {"id": "u1", "org_id": "org-1", "role": "admin"}


class TestModuleRegistry:
    def test_module_for_sales_paths(self):
        from app.services.module_registry import module_for_path

        assert module_for_path("/api/invoices") == "sales"
        assert module_for_path("/api/invoices/abc123") == "sales"
        assert module_for_path("/api/purchase-orders") == "purchase"
        assert module_for_path("/api/onboarding/preferences") is None

    def test_always_on_modules(self):
        from app.services.module_registry import ALWAYS_ON

        assert "accounting" in ALWAYS_ON
        assert "banking" in ALWAYS_ON


class TestModuleGate:
    @patch("app.services.module_gate.get_enabled_modules")
    @patch("app.services.module_gate.is_license_valid", return_value=True)
    def test_require_module_blocks_disabled(self, _valid, mock_enabled):
        from fastapi import HTTPException
        from app.services.module_gate import require_module

        mock_enabled.return_value = ["accounting", "banking"]
        dep = require_module("sales")

        with pytest.raises(HTTPException) as exc:
            dep(user=_user())
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "module_disabled"

    @patch("app.services.module_gate.get_enabled_modules")
    @patch("app.services.module_gate.is_license_valid", return_value=True)
    def test_require_module_allows_enabled(self, _valid, mock_enabled):
        from app.services.module_gate import require_module

        mock_enabled.return_value = ["accounting", "banking", "sales"]
        dep = require_module("sales")
        assert dep(user=_user())["org_id"] == "org-1"

    @patch("app.services.module_gate.get_enabled_modules")
    @patch("app.services.module_gate.is_license_valid", return_value=True)
    def test_legacy_passthrough_all_modules(self, _valid, mock_enabled):
        from app.services.module_gate import is_module_enabled

        mock_enabled.return_value = None
        assert is_module_enabled("org-1", "manufacturing") is True

    @patch("app.services.module_gate.is_module_enabled", return_value=False)
    @patch("app.services.module_gate.is_license_valid", return_value=True)
    @patch("app.services.module_gate._decode_user_from_request")
    def test_middleware_blocks_post_when_disabled(self, mock_decode, _valid, _enabled):
        from app.services.module_gate import module_gate_middleware

        mock_decode.return_value = {"user_id": "u1", "org_id": "org-1"}

        app = FastAPI()

        @app.post("/api/invoices")
        async def create_invoice():
            return {"ok": True}

        app.middleware("http")(module_gate_middleware)
        client = TestClient(app)
        res = client.post("/api/invoices", headers={"Authorization": "Bearer fake"})
        assert res.status_code == 403
        assert res.json()["detail"]["code"] == "module_disabled"
