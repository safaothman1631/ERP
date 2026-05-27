"""Database foundation excellence — core wave smoke tests."""
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError


def test_invoice_write_model_rejects_bad_total():
    from app.firestore.write_models import InvoiceWriteModel

    with pytest.raises(ValidationError):
        InvoiceWriteModel(total=-1)


def test_contact_write_model_schema_default():
    from app.firestore.write_models import ContactWriteModel

    m = ContactWriteModel(display_name="Test Co", contact_type="customer")
    assert m.schema_version == 2


def test_update_versioned_conflict():
    from app.firestore.base import BaseRepository, VersionConflict

    class _R(BaseRepository):
        collection_name = "items"

    mock_db = MagicMock()
    tx = MagicMock()
    mock_db.transaction.return_value = tx
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = {"org_id": "org-1", "_version": 2, "name": "x"}
    doc_ref = MagicMock()
    doc_ref.get.return_value = snap
    mock_db.collection.return_value.document.return_value = doc_ref

    with patch("app.firestore.base.get_db", return_value=mock_db), patch(
        "app.firestore.base.fs.transactional", lambda f: f
    ):
        with pytest.raises(VersionConflict) as exc:
            _R("org-1").update_versioned("i1", {"name": "y"}, expected_version=1)
    assert exc.value.current_version == 2


def test_reference_conflict_on_delete():
    from app.firestore.base import BaseRepository
    from app.firestore.references import ReferenceConflict

    class _R(BaseRepository):
        collection_name = "contacts"

    with patch("app.firestore.base.get_db", return_value=MagicMock()), patch(
        "app.services.reference_guard.find_blocking_references",
        return_value=[{"collection": "invoices", "id": "inv-1", "field": "contact_id"}],
    ):
        with pytest.raises(ReferenceConflict):
            _R("org-1").delete("c1")


def test_parse_if_match_header():
    from app.services.version_dependency import parse_version_header

    assert parse_version_header('"3"') == 3
    assert parse_version_header('W/"7"') == 7
    assert parse_version_header("12") == 12


def test_sharded_counter_increment():
    from app.services import sharded_counter as sc

    mock_db = MagicMock()
    coll = MagicMock()
    mock_db.collection.return_value = coll
    doc_ref = MagicMock()
    coll.document.return_value = doc_ref

    with patch("app.services.sharded_counter.get_db", return_value=mock_db):
        for _ in range(5):
            sc.increment_sharded("org-1", "audit_test")
    assert coll.document.call_count == 5
