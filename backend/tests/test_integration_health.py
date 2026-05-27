"""Tests for integration health aggregation and API."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _admin_user(org_id: str = "org-1") -> dict:
    return {"id": "u1", "org_id": org_id, "role": "admin", "permissions": ["settings.read"]}


class TestIntegrationHealthService:
    @patch("app.services.integration_health.get_webhooks_settings")
    @patch("app.services.integration_health._load_email_kv")
    @patch("app.services.integration_health._gateway_configured")
    @patch("app.services.integration_health._load_integrations_doc")
    def test_all_missing_when_nothing_configured(
        self,
        mock_integrations,
        mock_gateway,
        mock_email,
        mock_webhooks,
    ):
        from app.services.integration_health import get_integration_health

        mock_integrations.side_effect = lambda _org, key: {}
        mock_gateway.return_value = (False, "not configured")
        mock_email.return_value = {}
        mock_webhooks.return_value = {"endpoints": "", "signing_secret": ""}

        items = get_integration_health("org-1")
        by_key = {row["key"]: row for row in items}

        assert by_key["einvoice"]["status"] == "missing"
        assert by_key["whatsapp"]["status"] == "missing"
        assert by_key["fib"]["status"] == "missing"
        assert by_key["zain_cash"]["status"] == "missing"
        assert by_key["smtp"]["status"] == "missing"
        assert by_key["webhooks"]["status"] == "missing"
        assert by_key["api_v1"]["status"] == "ok"

    @patch("app.services.integration_health.get_webhooks_settings")
    @patch("app.services.integration_health._load_email_kv")
    @patch("app.services.integration_health._gateway_configured")
    @patch("app.services.integration_health._load_integrations_doc")
    def test_production_ready_integrations_report_ok(
        self,
        mock_integrations,
        mock_gateway,
        mock_email,
        mock_webhooks,
    ):
        from app.services.integration_health import get_integration_health

        def _doc(_org, key):
            if key == "einvoice_config":
                return {
                    "enabled": True,
                    "preview_mode": False,
                    "portal_url": "https://ita.example/submit",
                }
            if key == "whatsapp_config":
                return {
                    "enabled": True,
                    "preview_mode": False,
                    "api_token": "secret-token",
                    "phone_number_id": "12345",
                }
            return {}

        mock_integrations.side_effect = _doc
        mock_gateway.return_value = (True, "configured")
        mock_email.return_value = {
            "smtp_host": "smtp.example.com",
            "smtp_user": "mailer",
            "smtp_password": "pass",
            "email_from": "noreply@example.com",
        }
        mock_webhooks.return_value = {
            "endpoints": "https://hooks.example/a\nhttps://hooks.example/b",
            "signing_secret": "secret",
        }

        items = get_integration_health("org-1")
        by_key = {row["key"]: row for row in items}

        assert by_key["einvoice"]["status"] == "ok"
        assert by_key["whatsapp"]["status"] == "ok"
        assert by_key["fib"]["status"] == "ok"
        assert by_key["zain_cash"]["status"] == "ok"
        assert by_key["smtp"]["status"] == "ok"
        assert by_key["webhooks"]["status"] == "ok"
        assert by_key["webhooks"]["message"].startswith("2 endpoint")

    @patch("app.services.integration_health.get_webhooks_settings")
    @patch("app.services.integration_health._load_email_kv")
    @patch("app.services.integration_health._gateway_configured")
    @patch("app.services.integration_health._load_integrations_doc")
    def test_preview_status_for_partial_configs(
        self,
        mock_integrations,
        mock_gateway,
        mock_email,
        mock_webhooks,
    ):
        from app.services.integration_health import get_integration_health

        mock_integrations.side_effect = lambda _org, key: {
            "einvoice_config": {"enabled": True, "preview_mode": True, "portal_url": ""},
            "whatsapp_config": {"enabled": True, "preview_mode": True, "api_token": ""},
        }.get(key, {})
        mock_gateway.return_value = (False, "missing")
        mock_email.return_value = {"smtp_host": "smtp.example.com"}
        mock_webhooks.return_value = {"endpoints": "https://hooks.example/a", "signing_secret": ""}

        items = get_integration_health("org-1")
        by_key = {row["key"]: row for row in items}

        assert by_key["einvoice"]["status"] == "preview"
        assert by_key["whatsapp"]["status"] == "preview"
        assert by_key["smtp"]["status"] == "preview"
        assert by_key["webhooks"]["status"] == "preview"


class TestIntegrationHealthApi:
    def test_endpoint_requires_settings_read(self):
        from app.api.system import settings_router
        from app.services.auth import get_current_user

        app = FastAPI()
        app.include_router(settings_router)
        app.dependency_overrides[get_current_user] = lambda: {
            "id": "u1",
            "org_id": "org-1",
            "role": "custom_no_access",
            "permissions": [],
        }

        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/settings/integration-health")
        assert response.status_code == 403

    @patch("app.services.integration_health.get_integration_health")
    def test_endpoint_returns_items(self, mock_health):
        from app.api.system import settings_router
        from app.services.auth import get_current_user

        mock_health.return_value = [
            {
                "key": "api_v1",
                "label": "Public API v1",
                "status": "ok",
                "configure_url": "/settings?s=api_tokens",
                "message": "available",
            }
        ]

        app = FastAPI()
        app.include_router(settings_router)
        app.dependency_overrides[get_current_user] = _admin_user

        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/settings/integration-health")

        assert response.status_code == 200
        body = response.json()
        assert "items" in body
        assert body["items"][0]["key"] == "api_v1"
        mock_health.assert_called_once_with("org-1")


class TestProductionReadyHelpers:
    def test_is_einvoice_production_ready(self):
        from app.services.einvoice_service import is_einvoice_production_ready

        assert is_einvoice_production_ready({"enabled": True, "preview_mode": False, "portal_url": "https://x"}) is True
        assert is_einvoice_production_ready({"enabled": True, "preview_mode": True, "portal_url": "https://x"}) is False
        assert is_einvoice_production_ready({"enabled": False}) is False

    def test_is_whatsapp_production_ready(self):
        from app.services.whatsapp_service import is_whatsapp_production_ready

        assert is_whatsapp_production_ready({
            "enabled": True,
            "preview_mode": False,
            "api_token": "tok",
            "phone_number_id": "123",
        }) is True
        assert is_whatsapp_production_ready({
            "enabled": True,
            "preview_mode": True,
            "api_token": "tok",
            "phone_number_id": "123",
        }) is False
