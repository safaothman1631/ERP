"""Bill approve atomic service."""
from unittest.mock import MagicMock, patch

import pytest


def test_approve_bill_draft_to_open():
    from app.services.bill_approve import approve_bill_atomic

    mock_db = MagicMock()
    mock_snap = MagicMock()
    mock_snap.exists = True
    mock_snap.to_dict.return_value = {
        "org_id": "org-1",
        "status": "draft",
        "balance_due": 200,
        "total": 200,
    }
    mock_db.collection.return_value.document.return_value.get.return_value = mock_snap

    with patch("app.services.bill_approve.get_db", return_value=mock_db), patch(
        "app.services.bill_approve.fs.transactional", lambda f: f
    ), patch("app.services.org_counters.transition_bill_counters") as bump:
        result = approve_bill_atomic(
            "org-1",
            "bill-1",
            approved_by_id="u1",
            approved_by_name="User",
        )
        assert result["status"] == "open"
        bump.assert_called_once()
