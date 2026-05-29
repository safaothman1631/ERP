"""Wave I7 — idempotency replay returns cached body."""
from unittest.mock import MagicMock, patch

from app.services.idempotency import IdempotencyService


def test_idempotency_complete_and_get():
    mock_db = MagicMock()
    coll = MagicMock()
    mock_db.collection.return_value = coll
    doc_ref = MagicMock()
    coll.document.return_value = doc_ref
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = {
        "body_hash": "abc",
        "status": "completed",
        "response": {"status_code": 201, "body": {"id": "x"}},
        "expires_at": None,
    }
    doc_ref.get.return_value = snap

    with patch("app.services.idempotency.get_db", return_value=mock_db):
        svc = IdempotencyService("org-1")
        data = svc.get("scope", "key-1")
    assert data["response"]["body"]["id"] == "x"
