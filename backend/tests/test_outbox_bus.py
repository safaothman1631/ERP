"""Pool 3.3 event bus: handler registry, retry/dead-letter, transactional enqueue."""
from datetime import timedelta
from unittest.mock import MagicMock, patch

from app.firestore import outbox as OB
from app.services import outbox_dispatcher as OD


def setup_function(_):
    OD.clear_handlers()


def test_register_and_handle_invokes_handler():
    seen = []
    OD.register_handler("x", lambda org, p: seen.append((org, p)))
    assert OD._handle_event("org1", "x", {"a": 1}) == 1
    assert seen == [("org1", {"a": 1})]


def test_no_handler_returns_zero():
    assert OD._handle_event("org1", "unknown", {}) == 0


def test_backoff_escalates_and_clamps():
    assert OD._backoff(1) == timedelta(minutes=1)
    assert OD._backoff(2) == timedelta(minutes=5)
    assert OD._backoff(99) == timedelta(minutes=720)


def test_build_event_idempotency_key_is_id():
    ev = OB.build_outbox_event("org1", "t", {"k": 1}, idempotency_key="dedupe-1")
    assert ev["id"] == "dedupe-1" and ev["org_id"] == "org1" and ev["status"] == "pending"


def test_enqueue_in_transaction_writes_once():
    txn, db = MagicMock(), MagicMock()
    db.collection.return_value.document.return_value = MagicMock()
    eid = OB.enqueue_in_transaction(txn, db, "org1", "t", {"k": 1}, idempotency_key="d1")
    assert eid == "d1"
    txn.set.assert_called_once()


def _fake_doc(data):
    doc = MagicMock()
    doc.to_dict.return_value = data
    doc.reference = MagicMock()
    return doc


def _mock_db(docs):
    db = MagicMock()
    q = MagicMock()
    db.collection.return_value.where.return_value.limit.return_value = q
    q.where.return_value = q
    q.stream.return_value = iter(docs)
    return db


def test_dispatch_delivers_and_marks_delivered():
    seen = []
    OD.register_handler("e", lambda org, p: seen.append(p))
    doc = _fake_doc({"event_type": "e", "org_id": "o", "payload": {"n": 1}, "attempts": 0})
    with patch("app.firebase_client.get_db", return_value=_mock_db([doc])):
        assert OD.dispatch_pending(max_events=10) == 1
    assert seen == [{"n": 1}]
    assert doc.reference.update.call_args[0][0]["status"] == "delivered"


def test_dispatch_retry_then_dead_letter():
    def _boom(org, p):
        raise RuntimeError("boom")
    OD.register_handler("e", _boom)
    doc = _fake_doc({"event_type": "e", "org_id": "o", "payload": {}, "attempts": 4})
    with patch("app.firebase_client.get_db", return_value=_mock_db([doc])):
        assert OD.dispatch_pending(max_events=10) == 0
    upd = doc.reference.update.call_args[0][0]
    assert upd["status"] == "dead" and upd["attempts"] == 5


def test_dispatch_first_failure_stays_pending():
    OD.register_handler("e", lambda org, p: (_ for _ in ()).throw(ValueError("x")))
    doc = _fake_doc({"event_type": "e", "org_id": "o", "payload": {}, "attempts": 0})
    with patch("app.firebase_client.get_db", return_value=_mock_db([doc])):
        OD.dispatch_pending(max_events=10)
    upd = doc.reference.update.call_args[0][0]
    assert upd["status"] == "pending" and upd["attempts"] == 1
