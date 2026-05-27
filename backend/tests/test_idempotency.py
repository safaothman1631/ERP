"""Idempotency store tests."""
from unittest.mock import MagicMock, patch

from app.services.idempotency import get_cached_response, store_response


@patch("app.services.idempotency.get_db")
def test_store_and_retrieve(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "response": {"order_id": "o1"},
        "expires_at": "2099-01-01T00:00:00",
    }
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    cached = get_cached_response("org1", "pos_order_sync", "temp-1")
    assert cached == {"order_id": "o1"}

    store_response("org1", "pos", "k1", {"ok": True})
    mock_db.collection.return_value.document.return_value.set.assert_called_once()
