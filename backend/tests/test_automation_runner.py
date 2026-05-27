"""Tests for Phase 4.3 automation runner."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.automation_runner import evaluate_condition, fire_automated_actions


class TestEvaluateCondition:
    def test_none_passes(self):
        assert evaluate_condition(None, {"total": 50}) is True
        assert evaluate_condition("", {"total": 50}) is True

    def test_amount_gt(self):
        assert evaluate_condition("amount > 1000", {"total": 1500}) is True
        assert evaluate_condition("amount > 1000", {"amount": 500}) is False

    def test_unsupported_condition_fails(self):
        assert evaluate_condition("status == open", {"status": "open"}) is False


class TestFireAutomatedActions:
    @patch("app.services.automation_runner.dispatch_event")
    @patch("app.services.automation_runner.AutomatedActionRepository")
    def test_webhook_fires_when_condition_met(self, mock_repo_cls, mock_dispatch):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.list.return_value = (
            [
                {
                    "id": "rule-1",
                    "name": "Big invoice webhook",
                    "entity_type": "invoice",
                    "trigger": "on_create",
                    "condition": "amount > 1000",
                    "action_type": "webhook",
                    "action_config": {"event": "invoice.created"},
                    "active": True,
                }
            ],
            1,
        )

        result = fire_automated_actions(
            "org-1",
            "invoice",
            "on_create",
            {"id": "inv-1", "total": 2500},
        )

        assert result == {"fired": 1, "skipped": 0, "errors": 0}
        mock_dispatch.assert_called_once_with(
            "org-1",
            "invoice.created",
            {"id": "inv-1", "total": 2500},
        )

    @patch("app.services.automation_runner.dispatch_event")
    @patch("app.services.automation_runner.AutomatedActionRepository")
    def test_skips_when_condition_not_met(self, mock_repo_cls, mock_dispatch):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.list.return_value = (
            [
                {
                    "id": "rule-1",
                    "condition": "amount > 1000",
                    "action_type": "webhook",
                    "action_config": {"event": "invoice.created"},
                    "active": True,
                }
            ],
            1,
        )

        result = fire_automated_actions(
            "org-1",
            "invoice",
            "on_create",
            {"id": "inv-2", "total": 100},
        )

        assert result == {"fired": 0, "skipped": 1, "errors": 0}
        mock_dispatch.assert_not_called()

    @patch("app.services.automation_runner.ActivityRepository")
    @patch("app.services.automation_runner.AutomatedActionRepository")
    def test_create_activity(self, mock_repo_cls, mock_activity_cls):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.list.return_value = (
            [
                {
                    "id": "rule-2",
                    "name": "Follow up",
                    "action_type": "create_activity",
                    "action_config": {"title": "Call customer", "assignee_id": "user-1"},
                    "active": True,
                }
            ],
            1,
        )
        mock_activity = MagicMock()
        mock_activity_cls.return_value = mock_activity

        result = fire_automated_actions(
            "org-1",
            "quote",
            "on_create",
            {"id": "q-1", "total": 500},
        )

        assert result["fired"] == 1
        mock_activity.create.assert_called_once()
        payload = mock_activity.create.call_args.args[0]
        assert payload["entity_type"] == "quote"
        assert payload["entity_id"] == "q-1"
        assert payload["title"] == "Call customer"
        assert payload["assignee_id"] == "user-1"
