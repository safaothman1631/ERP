"""Firestore-backed durable queue for MoF e-Fakhata submissions.

State machine:

    pending ──► submitting ──► submitted ──► acknowledged
                                       │
                                       └──► rejected (MoF business error)
       │
       └──► failed (transient — retried with backoff up to max_attempts)

Backoff schedule (minutes since last_attempt_at):
    attempt 1 →  1m
    attempt 2 →  5m
    attempt 3 → 30m
    attempt 4 →  2h
    attempt 5 → 12h

After ``MAX_ATTEMPTS`` the record stays in ``failed`` until an operator
manually re-queues it. Dedup is enforced by ``invoice_id`` — submitting
the same invoice twice returns the existing submission instead of
creating a duplicate.

Collection layout:
    efakhata_submissions/{submission_id}
        org_id, invoice_id, status, xml_signed (str), attempts,
        last_attempt_at, next_attempt_at, mof_ack_number?, error_code?,
        error_message?, created_at, updated_at
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

from app.firestore.base import BaseRepository

logger = logging.getLogger(__name__)


# Status constants — exported so tests / API can reference them.
PENDING = "pending"
SUBMITTING = "submitting"
SUBMITTED = "submitted"
ACKNOWLEDGED = "acknowledged"
REJECTED = "rejected"
FAILED = "failed"
CANCELLED = "cancelled"

TERMINAL_STATUSES = frozenset({ACKNOWLEDGED, REJECTED, CANCELLED})

MAX_ATTEMPTS = 5
BACKOFF_MINUTES = [1, 5, 30, 120, 720]  # attempts 1..5


class SubmissionQueueRepository(BaseRepository):
    """Concrete repo for e-Fakhata submissions."""

    collection_name = "efakhata_submissions"

    # ── Lookups ────────────────────────────────────────────────────────────

    def get_by_invoice_id(self, invoice_id: str) -> Optional[dict]:
        items, _ = self.list(
            filters=[{"field": "invoice_id", "op": "==", "value": invoice_id}],
            limit=1,
        )
        return items[0] if items else None

    def get_by_ack_number(self, ack_number: str) -> Optional[dict]:
        items, _ = self.list(
            filters=[{"field": "mof_ack_number", "op": "==", "value": ack_number}],
            limit=1,
        )
        return items[0] if items else None

    def list_due(self, *, batch_size: int = 50) -> list[dict]:
        """Return submissions whose ``next_attempt_at`` is in the past."""
        now = datetime.utcnow()
        items, _ = self.list(
            filters=[
                {"field": "status", "op": "in", "value": [PENDING, SUBMITTING, FAILED]},
            ],
            limit=batch_size,
        )
        out = []
        for item in items:
            if item.get("status") in TERMINAL_STATUSES:
                continue
            if int(item.get("attempts") or 0) >= MAX_ATTEMPTS and item.get("status") == FAILED:
                continue
            nxt = item.get("next_attempt_at")
            if isinstance(nxt, str):
                try:
                    nxt = datetime.fromisoformat(nxt)
                except Exception:
                    nxt = None
            if nxt is None or nxt <= now:
                out.append(item)
        return out

    # ── Mutations ──────────────────────────────────────────────────────────

    def enqueue(
        self,
        *,
        invoice_id: str,
        xml_signed: str,
        created_by: str,
    ) -> dict:
        """Insert a new submission OR return the existing one for this invoice
        (dedup). Returns the persisted record either way.
        """
        existing = self.get_by_invoice_id(invoice_id)
        if existing is not None:
            return existing
        now = datetime.utcnow()
        sid = str(uuid.uuid4())
        record = {
            "id": sid,
            "invoice_id": invoice_id,
            "xml_signed": xml_signed,
            "status": PENDING,
            "attempts": 0,
            "last_attempt_at": None,
            "next_attempt_at": now.isoformat(),
            "mof_ack_number": None,
            "error_code": None,
            "error_message": None,
            "created_by": created_by,
            "history": [{"at": now.isoformat(), "status": PENDING, "actor": created_by}],
        }
        return self.create(record)

    def mark_submitting(self, submission_id: str) -> dict:
        return self._transition(submission_id, SUBMITTING)

    def mark_submitted(self, submission_id: str, *, ack_number: Optional[str]) -> dict:
        return self._transition(
            submission_id,
            SUBMITTED,
            extra={"mof_ack_number": ack_number} if ack_number else None,
        )

    def mark_acknowledged(self, submission_id: str, *, ack_number: Optional[str] = None) -> dict:
        extra: dict = {"acknowledged_at": datetime.utcnow().isoformat()}
        if ack_number:
            extra["mof_ack_number"] = ack_number
        return self._transition(submission_id, ACKNOWLEDGED, extra=extra)

    def mark_rejected(self, submission_id: str, *, error_code: str, error_message: str) -> dict:
        return self._transition(
            submission_id,
            REJECTED,
            extra={"error_code": error_code, "error_message": error_message},
        )

    def mark_failed(self, submission_id: str, *, error_code: str, error_message: str) -> dict:
        record = self.get(submission_id)
        if not record:
            raise ValueError(f"submission_not_found:{submission_id}")
        attempts = int(record.get("attempts") or 0) + 1
        now = datetime.utcnow()
        # Pick the backoff window for *this* attempt (1-based).
        idx = min(attempts, len(BACKOFF_MINUTES)) - 1
        next_at = now + timedelta(minutes=BACKOFF_MINUTES[idx])
        extra = {
            "attempts": attempts,
            "last_attempt_at": now.isoformat(),
            "next_attempt_at": next_at.isoformat(),
            "error_code": error_code,
            "error_message": error_message,
        }
        # If we've exhausted retries we stay in FAILED but stop scheduling.
        return self._transition(submission_id, FAILED, extra=extra)

    def cancel(self, submission_id: str, *, reason: str) -> dict:
        return self._transition(
            submission_id,
            CANCELLED,
            extra={"cancelled_at": datetime.utcnow().isoformat(), "error_message": reason},
        )

    # ── Internals ──────────────────────────────────────────────────────────

    def _transition(self, submission_id: str, new_status: str,
                    *, extra: Optional[dict] = None) -> dict:
        record = self.get(submission_id)
        if not record:
            raise ValueError(f"submission_not_found:{submission_id}")
        if record.get("status") in TERMINAL_STATUSES and new_status not in TERMINAL_STATUSES:
            raise ValueError(
                f"cannot transition from terminal {record['status']} → {new_status}"
            )
        patch: dict = {"status": new_status}
        if extra:
            patch.update(extra)
        history = list(record.get("history") or [])
        history.append({
            "at": datetime.utcnow().isoformat(),
            "status": new_status,
        })
        patch["history"] = history
        return self.update(submission_id, patch)
