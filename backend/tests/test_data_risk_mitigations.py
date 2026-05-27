"""Non-critical data risk mitigations (foundation P1)."""
from unittest.mock import MagicMock, patch

import pytest

from app.services.audit_pii import scrub_audit_entry
from app.services.gdpr_traversal import build_org_data_manifest
from app.firestore.write_models.generic import GenericWriteModel


def test_scrub_audit_entry_hashes_user_id():
    out = scrub_audit_entry({
        "user_id": "secret-user-123",
        "path": "/api/contacts/c1?email=test@example.com",
    })
    assert out["user_id"] is None
    assert out.get("user_id_hash")
    assert "[email]" in out["path"]


def test_generic_write_model_rejects_oversized_name():
    with pytest.raises(Exception):
        GenericWriteModel(name="x" * 600)


@patch("app.services.gdpr_traversal.get_db")
def test_build_org_data_manifest_counts(mock_get_db):
    mock_doc = MagicMock()
    mock_doc.id = "d1"
    mock_doc.to_dict.return_value = {"org_id": "org1"}
    mock_coll = MagicMock()
    mock_coll.where.return_value.limit.return_value.stream.return_value = [mock_doc]
    mock_db = MagicMock()
    mock_db.collection.return_value = mock_coll
    mock_get_db.return_value = mock_db

    result = build_org_data_manifest("org1", limit_per_collection=10)
    assert result["org_id"] == "org1"
    assert "collections" in result
    assert result["total_docs"] >= 0


@patch("app.services.reference_guard.find_blocking_references", return_value=[])
@patch("app.firebase_client.get_db")
def test_find_item_usage_blockers_invoice_line(mock_get_db, _mock_block):
    from app.services.reference_guard import find_item_usage_blockers

    line = MagicMock()
    inv = MagicMock()
    inv.id = "inv1"
    inv.to_dict.return_value = {"org_id": "org1"}
    inv.reference.collection.return_value.where.return_value.limit.return_value.stream.return_value = [
        line
    ]
    mock_db = MagicMock()
    mock_db.collection.return_value.where.return_value.limit.return_value.stream.return_value = [
        inv
    ]
    mock_get_db.return_value = mock_db

    blockers = find_item_usage_blockers("org1", "item-1", invoice_scan_limit=5)
    assert blockers
    assert blockers[0]["collection"] == "invoices"
