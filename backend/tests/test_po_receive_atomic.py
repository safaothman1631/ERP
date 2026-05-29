"""PO receive atomic service."""
from unittest.mock import MagicMock, patch

import pytest


def test_mark_po_received_not_found():
    from app.services.po_receive import mark_po_received_atomic

    mock_db = MagicMock()
    mock_snap = MagicMock()
    mock_snap.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_snap

    with patch("app.services.po_receive.get_db", return_value=mock_db):
        with patch("app.services.po_receive.fs.transactional", lambda f: f):
            from app.services.firestore_tx import TenantMismatchError

            with pytest.raises(TenantMismatchError):
                mark_po_received_atomic("org-1", "po-x", status="received", received_by="u1")
