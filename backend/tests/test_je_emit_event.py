"""Pool 3.3: create_journal_entry_in_transaction couples an outbox event to the
JE write, but ONLY when OUTBOX_HOTPATH_ENABLED is on. Off (default) => the
emit_event arg is ignored, so the hot JE/invoice path has zero behavior change.

The enqueue is the LAST write in the transaction (after every read), preserving
Firestore's reads-before-writes rule — see journal_entry_atomic for the ordering.
"""
from datetime import datetime
from unittest.mock import MagicMock, patch

from app.config import settings
from app.services import journal_entry_atomic as JEA


def _acct_snap(org_id: str):
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = {"org_id": org_id, "account_type": "cash"}
    return snap


def _mock_db(org_id: str):
    """db.collection(name).document(id) -> ref; account refs read back a real
    snapshot so the balance-update path runs; lines subcollection is a no-op."""
    db = MagicMock()

    def _collection(name):
        col = MagicMock()

        def _document(doc_id=None):
            ref = MagicMock()
            if name == "accounts":
                ref.get.return_value = _acct_snap(org_id)
            ref.collection.return_value.document.return_value = MagicMock()
            return ref

        col.document.side_effect = _document
        return col

    db.collection.side_effect = _collection
    return db


_LINES = [
    {"account_id": "a1", "debit": 100, "credit": 0},
    {"account_id": "a2", "debit": 0, "credit": 100},
]

_EVENT = {
    "event_type": "invoice.confirmed",
    "payload": {"invoice_id": "inv-1", "org_id": "org1"},
    "idempotency_key": "invoice-confirmed:inv-1",
}


def _run(emit_event, flag_on: bool):
    txn, db = MagicMock(), _mock_db("org1")
    with patch.object(settings, "OUTBOX_HOTPATH_ENABLED", flag_on), patch(
        "app.firestore.outbox.enqueue_in_transaction"
    ) as enq:
        JEA.create_journal_entry_in_transaction(
            txn, db, "org1",
            date=datetime(2026, 6, 3),
            lines=_LINES,
            entry_id="je-test",
            entry_number="JE-TEST",  # skip the sequence read
            emit_event=emit_event,
        )
    return enq


def test_emit_event_enqueues_when_flag_on():
    enq = _run(_EVENT, flag_on=True)
    enq.assert_called_once()
    # event_type + payload + idempotency_key are threaded through verbatim.
    args, kwargs = enq.call_args
    assert args[3] == "invoice.confirmed"
    assert args[4] == {"invoice_id": "inv-1", "org_id": "org1"}
    assert kwargs["idempotency_key"] == "invoice-confirmed:inv-1"


def test_emit_event_ignored_when_flag_off():
    enq = _run(_EVENT, flag_on=False)
    enq.assert_not_called()


def test_no_emit_event_never_enqueues():
    enq = _run(None, flag_on=True)
    enq.assert_not_called()
