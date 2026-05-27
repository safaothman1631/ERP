"""Unit tests for journal reversal logic."""
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.services.accounting import AccountingService


@pytest.fixture
def mock_je_repo():
    with patch("app.services.accounting.JournalEntryRepository") as cls:
        repo = MagicMock()
        cls.return_value = repo
        yield repo


def test_reverse_already_reversed_raises(mock_je_repo):
    mock_je_repo.get.return_value = {
        "id": "je-1",
        "org_id": "org-1",
        "entry_number": "JE-001",
        "reversed_by": "je-2",
    }
    with pytest.raises(HTTPException) as exc:
        AccountingService.reverse_journal_entry(
            "org-1", "je-1", datetime(2026, 5, 25), user_id="u1"
        )
    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "je_already_reversed"


def test_reverse_creates_mirrored_entry(mock_je_repo):
    mock_je_repo.get.return_value = {
        "id": "je-1",
        "org_id": "org-1",
        "entry_number": "JE-001",
    }
    mock_je_repo.get_lines.return_value = [
        {"account_id": "a1", "debit": 100, "credit": 0, "description": "Dr"},
        {"account_id": "a2", "debit": 0, "credit": 100, "description": "Cr"},
    ]

    with patch.object(AccountingService, "create_journal_entry") as create_je:
        create_je.return_value = {"id": "je-rev", "entry_number": "JE-002"}
        result = AccountingService.reverse_journal_entry(
            "org-1", "je-1", datetime(2026, 5, 25), user_id="u1"
        )

    assert result["id"] == "je-rev"
    lines = create_je.call_args.kwargs["lines"]
    assert lines[0]["debit"] == 0 and lines[0]["credit"] == 100
    assert lines[1]["debit"] == 100 and lines[1]["credit"] == 0
    mock_je_repo.update.assert_any_call("je-1", {"reversed_by": "je-rev", "status": "reversed"})
