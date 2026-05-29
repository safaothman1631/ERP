"""Email support routing tests (G2 / R2.8)."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import email_support  # noqa: E402


def test_classify_recognises_categories():
    assert email_support.classify("Bug report", "I got a 500 error") == "bug"
    assert email_support.classify("Refund", "please process refund") == "billing"
    assert email_support.classify("How do I", "create invoice?") == "how-to"
    assert email_support.classify("Random subject", "just saying hi") == "other"


def test_handle_inbound_email_creates_ticket_id_and_calls_crisp_and_mail():
    fake_db = MagicMock()
    fake_db.collection.return_value.document.return_value.set.return_value = None

    with patch("app.firebase_client.get_db", return_value=fake_db), \
         patch("app.services.email_support._forward_to_crisp", return_value=True) as crisp, \
         patch("app.services.email_support._send_autoreply", return_value=True) as reply:
        result = email_support.handle_inbound_email(
            {
                "from_email": "user@example.com",
                "subject": "I got an error",
                "body": "There was a 500 error on the invoice screen",
                "plan": "starter",
            }
        )
    assert result["ticket_id"]
    assert result["category"] == "bug"
    assert result["forwarded_to_crisp"] is True
    assert result["autoreply_sent"] is True
    crisp.assert_called_once()
    reply.assert_called_once()


def test_handle_inbound_email_detects_language_arabic():
    fake_db = MagicMock()
    fake_db.collection.return_value.document.return_value.set.return_value = None
    with patch("app.firebase_client.get_db", return_value=fake_db), \
         patch("app.services.email_support._forward_to_crisp", return_value=False), \
         patch("app.services.email_support._send_autoreply", return_value=False):
        result = email_support.handle_inbound_email(
            {
                "from_email": "u@example.com",
                "subject": "مرحبا",
                "body": "كيف يمكنني إنشاء فاتورة",
                "plan": "free",
            }
        )
    assert result["language"] == "ar"
