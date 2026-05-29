"""Ensure /api/v1/auth/* mirrors /api/auth/* (Google register/login fix)."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture()
def client():
    from app.main import app
    return TestClient(app)


class TestV1AuthRoutes:
    def test_v1_firebase_register_not_405(self, client):
        """POST must be routed — 405 was the reported production bug."""
        res = client.post("/api/v1/auth/firebase-register", json={
            "id_token": "invalid",
            "org_name": "Test Org",
        })
        assert res.status_code != 405
        assert res.status_code in (401, 422)

    def test_v1_firebase_register_requires_org_name(self, client):
        res = client.post("/api/v1/auth/firebase-register", json={
            "id_token": "invalid",
            "org_name": "",
        })
        assert res.status_code == 422

    def test_legacy_auth_path_still_works(self, client):
        res = client.post("/api/auth/firebase-register", json={
            "id_token": "invalid",
            "org_name": "Test Org",
        })
        assert res.status_code != 405
        assert res.status_code in (401, 422)

    def test_v1_login_not_405(self, client):
        res = client.post("/api/v1/auth/login", json={
            "email": "nobody@example.com",
            "password": "wrong-password-123!",
        })
        assert res.status_code != 405

    def test_v1_status(self, client):
        res = client.get("/api/v1/auth/status")
        assert res.status_code == 200
        assert "is_setup" in res.json()

    def test_v1_register_not_405(self, client):
        res = client.post("/api/v1/auth/register", json={
            "org_name": "Test",
            "user_name": "User",
            "email": "new@example.com",
            "password": "Test1234!",
        })
        assert res.status_code != 405
