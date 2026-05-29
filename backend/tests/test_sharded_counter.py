"""Wave A8 — sharded counter increment."""
from unittest.mock import MagicMock, patch

from app.services import sharded_counter as sc


def test_increment_sharded_calls_firestore():
    mock_db = MagicMock()
    coll = MagicMock()
    mock_db.collection.return_value = coll
    doc_ref = MagicMock()
    coll.document.return_value = doc_ref
    with patch("app.services.sharded_counter.get_db", return_value=mock_db):
        sc.increment_sharded("org-1", "audit_daily")
    coll.document.assert_called_once()
