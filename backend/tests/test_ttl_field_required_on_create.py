"""Wave T7 — idempotency keys always get expires_at datetime."""
from datetime import datetime
from unittest.mock import MagicMock, patch

from app.services.idempotency import IdempotencyService


def test_idempotency_create_sets_expires_at():
    mock_db = MagicMock()
    coll = MagicMock()
    mock_db.collection.return_value = coll
    doc_ref = MagicMock()
    coll.document.return_value = doc_ref

    with patch("app.services.idempotency.get_db", return_value=mock_db):
        svc = IdempotencyService("org-1")
        svc.create_key("POST:/api/invoices", "key-abc", body_hash="hash")
    payload = doc_ref.set.call_args[0][0]
    assert isinstance(payload["expires_at"], datetime)
