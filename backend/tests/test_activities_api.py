"""Tests for universal activities API (Phase 4 G-02)."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.activities import router as activities_router
from app.services.auth import get_current_user


def _user():
    return {
        "id": "user-1",
        "org_id": "org-1",
        "email": "user@example.com",
        "name": "Test User",
    }


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(activities_router)
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


class TestActivitiesApi:
    @patch("app.api.activities.ActivityRepository")
    def test_list_assignee_me_open(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.list.return_value = (
            [
                {
                    "id": "a1",
                    "title": "Follow up",
                    "status": "open",
                    "assignee_id": "user-1",
                    "due_at": "2026-05-20T00:00:00",
                }
            ],
            1,
        )

        response = client.get("/api/activities", params={"assignee": "me", "status": "open"})
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["id"] == "a1"
        mock_repo.list.assert_called_once()
        filters = mock_repo.list.call_args.kwargs["filters"]
        assert {"field": "assignee_id", "op": "==", "value": "user-1"} in filters
        assert {"field": "status", "op": "==", "value": "open"} in filters

    @patch("app.api.activities.ActivityRepository")
    def test_create_and_mark_done(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.create.return_value = {
            "id": "a2",
            "entity_type": "invoice",
            "entity_id": "inv-1",
            "title": "Call customer",
            "status": "open",
            "assignee_id": "user-1",
        }
        mock_repo.get.return_value = {
            "id": "a2",
            "org_id": "org-1",
            "status": "open",
        }
        mock_repo.update.return_value = {
            "id": "a2",
            "status": "done",
            "done_by_id": "user-1",
        }

        create_resp = client.post(
            "/api/activities",
            json={
                "entity_type": "invoice",
                "entity_id": "inv-1",
                "title": "Call customer",
                "due_at": "2026-05-26T12:00:00",
            },
        )
        assert create_resp.status_code == 201
        assert create_resp.json()["id"] == "a2"

        patch_resp = client.patch("/api/activities/a2", json={"status": "done"})
        assert patch_resp.status_code == 200
        assert patch_resp.json()["status"] == "done"
        mock_repo.update.assert_called_once()
        update_payload = mock_repo.update.call_args.args[1]
        assert update_payload["status"] == "done"
        assert update_payload["done_by_id"] == "user-1"
