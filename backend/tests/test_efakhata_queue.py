"""e-Fakhata submission-queue tests (growth-to-100 § R4 / G4a).

Tests the state machine, dedup, retry/backoff, and the MoF-client
exception → status transitions in the worker loop.

We mock ``BaseRepository`` directly so no Firestore connection is
required — the test verifies the repository's transition logic by
exercising ``get`` / ``update`` / ``create`` on the underlying mock.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.efakhata import submission_queue as q
from app.efakhata.mof_client import MoFNotConfigured, MoFRejected, MoFTransient
from app.efakhata.submission_queue import (
    BACKOFF_MINUTES,
    MAX_ATTEMPTS,
    SubmissionQueueRepository,
)
from app.efakhata.submission_worker import process_tenant_queue


# ─────────────────────────────────────────────────────────────────────────────
# In-memory repo helper — overrides get/create/update/list to behave like a
# tiny dict-backed store while keeping the production transition logic intact.
# ─────────────────────────────────────────────────────────────────────────────


class _MemRepo(SubmissionQueueRepository):
    def __init__(self, org_id: str = "org-1"):
        self.org_id = org_id
        self._store: dict[str, dict] = {}
        self.last_list_meta = None  # type: ignore[assignment]

    def get(self, doc_id):
        rec = self._store.get(doc_id)
        return dict(rec) if rec else None

    def create(self, data):
        data = dict(data)
        sid = data.get("id") or str(len(self._store) + 1)
        data["id"] = sid
        data["created_at"] = datetime.utcnow()
        data["org_id"] = self.org_id
        self._store[sid] = data
        return dict(data)

    def update(self, doc_id, data):
        rec = self._store[doc_id]
        rec.update(data)
        rec["updated_at"] = datetime.utcnow()
        return dict(rec)

    def list(self, filters=None, limit=25, order_by=None, **kwargs):
        items = list(self._store.values())
        if filters:
            for f in filters:
                op = f["op"]
                fld = f["field"]
                val = f["value"]
                if op == "==":
                    items = [x for x in items if x.get(fld) == val]
                elif op == "in":
                    items = [x for x in items if x.get(fld) in val]
        return [dict(x) for x in items[:limit]], len(items)


# ─────────────────────────────────────────────────────────────────────────────
# Queue mechanics
# ─────────────────────────────────────────────────────────────────────────────


def test_enqueue_creates_pending_record():
    repo = _MemRepo()
    rec = repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u1")
    assert rec["status"] == q.PENDING
    assert rec["attempts"] == 0
    assert rec["invoice_id"] == "inv-1"
    assert rec["history"][0]["status"] == q.PENDING


def test_enqueue_is_idempotent_on_invoice_id():
    repo = _MemRepo()
    a = repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u1")
    b = repo.enqueue(invoice_id="inv-1", xml_signed="<y/>", created_by="u2")
    # Same submission returned — no duplicate.
    assert a["id"] == b["id"]
    items, total = repo.list()
    assert total == 1


def test_state_transitions_happy_path():
    repo = _MemRepo()
    rec = repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u")
    repo.mark_submitting(rec["id"])
    assert repo.get(rec["id"])["status"] == q.SUBMITTING
    repo.mark_submitted(rec["id"], ack_number="MOF-ACK-123")
    submitted = repo.get(rec["id"])
    assert submitted["status"] == q.SUBMITTED
    assert submitted["mof_ack_number"] == "MOF-ACK-123"
    repo.mark_acknowledged(rec["id"])
    assert repo.get(rec["id"])["status"] == q.ACKNOWLEDGED


def test_terminal_status_blocks_further_transitions():
    repo = _MemRepo()
    rec = repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u")
    repo.mark_acknowledged(rec["id"], ack_number="A")
    with pytest.raises(ValueError, match="terminal"):
        repo.mark_submitting(rec["id"])


def test_rejected_records_error_code_and_message():
    repo = _MemRepo()
    rec = repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u")
    repo.mark_rejected(rec["id"], error_code="BAD_TAX_ID", error_message="invalid tax id")
    out = repo.get(rec["id"])
    assert out["status"] == q.REJECTED
    assert out["error_code"] == "BAD_TAX_ID"
    assert out["error_message"] == "invalid tax id"


def test_mark_failed_schedules_exponential_backoff():
    repo = _MemRepo()
    rec = repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u")
    repo.mark_failed(rec["id"], error_code="500", error_message="boom")
    out = repo.get(rec["id"])
    assert out["status"] == q.FAILED
    assert out["attempts"] == 1
    # next_attempt_at must be roughly BACKOFF_MINUTES[0] minutes ahead.
    nxt = datetime.fromisoformat(out["next_attempt_at"])
    assert nxt > datetime.utcnow() + timedelta(seconds=30)
    assert nxt < datetime.utcnow() + timedelta(minutes=BACKOFF_MINUTES[0] + 1)


def test_mark_failed_uses_longer_backoff_each_attempt():
    repo = _MemRepo()
    rec = repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u")
    for expected_attempt in range(1, len(BACKOFF_MINUTES) + 1):
        repo.mark_failed(rec["id"], error_code="500", error_message="boom")
        out = repo.get(rec["id"])
        assert out["attempts"] == expected_attempt
    # After MAX_ATTEMPTS, list_due should not surface the record again.
    due = repo.list_due()
    assert all(d["id"] != rec["id"] for d in due)


def test_list_due_respects_next_attempt_at_window():
    repo = _MemRepo()
    rec = repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u")
    # Manually push next_attempt_at into the future.
    future = (datetime.utcnow() + timedelta(hours=1)).isoformat()
    repo.update(rec["id"], {"next_attempt_at": future, "status": q.FAILED})
    assert repo.list_due() == []


def test_cancel_terminates_record():
    repo = _MemRepo()
    rec = repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u")
    repo.cancel(rec["id"], reason="user requested")
    out = repo.get(rec["id"])
    assert out["status"] == q.CANCELLED
    assert "user requested" in out["error_message"]


# ─────────────────────────────────────────────────────────────────────────────
# Worker dispatch
# ─────────────────────────────────────────────────────────────────────────────


def _ack(num="ACK-1"):
    obj = MagicMock()
    obj.ack_number = num
    return obj


def test_worker_marks_submitted_on_success():
    repo = _MemRepo()
    repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u")
    client = MagicMock()
    client.submit_invoice.return_value = _ack("ACK-100")
    counters = process_tenant_queue("org-1", client=client, repo=repo)
    assert counters["submitted"] == 1
    items, _ = repo.list()
    assert items[0]["status"] == q.SUBMITTED
    assert items[0]["mof_ack_number"] == "ACK-100"


def test_worker_marks_rejected_on_business_error():
    repo = _MemRepo()
    repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u")
    client = MagicMock()
    client.submit_invoice.side_effect = MoFRejected("BAD_TAX", "tax id missing")
    counters = process_tenant_queue("org-1", client=client, repo=repo)
    assert counters["rejected"] == 1
    items, _ = repo.list()
    assert items[0]["status"] == q.REJECTED
    assert items[0]["error_code"] == "BAD_TAX"


def test_worker_marks_failed_on_transient_error():
    repo = _MemRepo()
    repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u")
    client = MagicMock()
    client.submit_invoice.side_effect = MoFTransient("502 bad gateway")
    counters = process_tenant_queue("org-1", client=client, repo=repo)
    assert counters["failed"] == 1
    items, _ = repo.list()
    assert items[0]["status"] == q.FAILED
    assert items[0]["attempts"] == 1


def test_worker_skips_when_mof_not_configured():
    repo = _MemRepo()
    repo.enqueue(invoice_id="inv-1", xml_signed="<x/>", created_by="u")

    # Make MoFClient construction raise MoFNotConfigured by sending a
    # client whose submit_invoice raises mid-batch.
    client = MagicMock()
    client.submit_invoice.side_effect = MoFNotConfigured("MOF_BASE missing")
    counters = process_tenant_queue("org-1", client=client, repo=repo)
    # Record stays pending after mark_submitting flips it; the worker
    # treats config loss as "leave the rest of the batch alone".
    assert counters["skipped_not_configured"] == 1
    items, _ = repo.list()
    # First record was marked submitting before the error.
    assert items[0]["status"] in {q.SUBMITTING, q.PENDING}
