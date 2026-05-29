"""Wave I7 — body hash mismatch is detectable on replay."""
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from app.services.idempotency import IdempotencyService


def test_idempotency_body_hash_stored():
    mock_db = MagicMock()
    coll = MagicMock()
    mock_db.collection.return_value = coll
    doc_ref = MagicMock()
    coll.document.return_value = doc_ref

    with patch("app.services.idempotency.get_db", return_value=mock_db):
        svc = IdempotencyService("org-1")
        svc.create_key("POST:/pay", "k1", body_hash="hash-a")
    doc = doc_ref.set.call_args[0][0]
    assert doc["body_hash"] == "hash-a"
    assert doc["expires_at"] > datetime.utcnow() - timedelta(hours=1)
