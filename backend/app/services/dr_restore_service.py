"""dr_restore_service — orchestration + state for super-admin tenant restores
(SF3 / T-SF.3.9, T-SF.3.11).

This service backs the super-admin restore endpoint
(:mod:`app.api.admin.dr_restore`). It models a **four-eyes** (two-person)
approval workflow over a per-tenant Firestore restore:

    requested  --approve(by a DIFFERENT admin)-->  approved
    approved   --execute-->                        executing -> completed/failed
    requested  --reject-->                         rejected
    (any open) --cancel-->                         cancelled

Why four-eyes? A tenant restore overwrites live production data for a customer.
Requiring a second, distinct super-admin to approve before execution is a
standard control for destructive privileged operations and gives us a clean
audit trail (who requested, who approved, what changed).

Diff preview
------------
Before approval, an admin can ask for a **diff preview**: we read the candidate
source export's per-tenant document set and compare it against the live tenant
data, returning per-collection ``added / changed / unchanged`` counts plus a
small sample of changed doc ids. This reuses the same comparison semantics as
``backend/scripts/apply_tenant_patch.py`` (--mode diff) but operates on the
backup archive produced by :class:`app.services.backup_service.BackupService`,
so it works without a scratch Firestore database and is safe to call from a
request handler.

Storage
-------
Restore requests live in the ``dr_restore_requests`` Firestore collection. The
repository is intentionally thin and fully mockable (the tests patch
``DrRestoreRepository``) — it never imports Firebase at module import time.

NOTE: actual execution against GCS/Firestore (the heavy ``gcloud`` import path)
is performed out-of-band by ``scripts/dr/restore-tenant.sh``. The ``execute``
transition here records intent + an audit row and marks the request
``executing``; an operator (or a future Cloud Tasks worker) runs the shell
pipeline and calls ``mark_executed`` with the result. This keeps the request
handler fast and avoids spawning gcloud from the API process.
"""
from __future__ import annotations

import gzip
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal, Optional

logger = logging.getLogger(__name__)

RestoreStatus = Literal[
    "requested", "approved", "rejected", "executing", "completed", "failed", "cancelled"
]

# Collections eligible for per-tenant restore mirror BackupService.COLLECTIONS.
# Imported lazily in :func:`_backup_collections` to avoid a hard dependency at
# import time (keeps the service unit-testable without the backup module).


@dataclass
class RestoreRequest:
    """A single four-eyes tenant-restore request."""

    id: str
    org_id: str
    source_path: str                         # GCS/local backup archive path
    status: RestoreStatus
    mode: Literal["upsert", "replace"]
    reason: str
    requested_by: str
    requested_by_email: Optional[str]
    requested_at: str                        # ISO8601 UTC
    approved_by: Optional[str] = None
    approved_by_email: Optional[str] = None
    approved_at: Optional[str] = None
    rejected_by: Optional[str] = None
    rejected_at: Optional[str] = None
    executed_at: Optional[str] = None
    result: Optional[dict] = None            # per-collection summary after execution
    diff_preview: Optional[dict] = None      # cached diff at request/approval time
    error_message: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "org_id": self.org_id,
            "source_path": self.source_path,
            "status": self.status,
            "mode": self.mode,
            "reason": self.reason,
            "requested_by": self.requested_by,
            "requested_by_email": self.requested_by_email,
            "requested_at": self.requested_at,
            "approved_by": self.approved_by,
            "approved_by_email": self.approved_by_email,
            "approved_at": self.approved_at,
            "rejected_by": self.rejected_by,
            "rejected_at": self.rejected_at,
            "executed_at": self.executed_at,
            "result": self.result,
            "diff_preview": self.diff_preview,
            "error_message": self.error_message,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "RestoreRequest":
        return cls(
            id=d["id"],
            org_id=d["org_id"],
            source_path=d.get("source_path", ""),
            status=d.get("status", "requested"),
            mode=d.get("mode", "upsert"),
            reason=d.get("reason", ""),
            requested_by=d.get("requested_by", ""),
            requested_by_email=d.get("requested_by_email"),
            requested_at=d.get("requested_at", ""),
            approved_by=d.get("approved_by"),
            approved_by_email=d.get("approved_by_email"),
            approved_at=d.get("approved_at"),
            rejected_by=d.get("rejected_by"),
            rejected_at=d.get("rejected_at"),
            executed_at=d.get("executed_at"),
            result=d.get("result"),
            diff_preview=d.get("diff_preview"),
            error_message=d.get("error_message"),
        )


class DrRestoreRepository:
    """Firestore persistence for :class:`RestoreRequest` (collection
    ``dr_restore_requests``). All Firebase access is lazy so the class can be
    imported (and mocked) without credentials.
    """

    COLLECTION = "dr_restore_requests"

    def _db(self):
        from app.firebase_client import get_db  # local import — no creds at import

        return get_db()

    def create(self, req: RestoreRequest) -> RestoreRequest:
        self._db().collection(self.COLLECTION).document(req.id).set(req.to_dict())
        return req

    def get(self, request_id: str) -> Optional[RestoreRequest]:
        snap = self._db().collection(self.COLLECTION).document(request_id).get()
        if not getattr(snap, "exists", False):
            return None
        return RestoreRequest.from_dict(snap.to_dict() or {})

    def update(self, request_id: str, patch: dict) -> None:
        self._db().collection(self.COLLECTION).document(request_id).set(patch, merge=True)

    def list(self, org_id: Optional[str] = None, limit: int = 100) -> list[RestoreRequest]:
        col = self._db().collection(self.COLLECTION)
        query = col.where("org_id", "==", org_id) if org_id else col
        out: list[RestoreRequest] = []
        for snap in query.stream():
            try:
                out.append(RestoreRequest.from_dict(snap.to_dict() or {}))
            except Exception:  # noqa: BLE001
                continue
        out.sort(key=lambda r: r.requested_at, reverse=True)
        return out[:limit]


class FourEyesViolation(Exception):
    """Raised when the same admin tries to approve their own request."""


class InvalidTransition(Exception):
    """Raised when a state transition is not allowed from the current status."""


class DrRestoreService:
    """Stateless orchestrator over :class:`DrRestoreRepository`."""

    def __init__(self, repo: Optional[DrRestoreRepository] = None) -> None:
        self.repo = repo or DrRestoreRepository()

    # ── create ────────────────────────────────────────────────────────────
    def request_restore(
        self,
        *,
        org_id: str,
        source_path: str,
        mode: str,
        reason: str,
        requested_by: str,
        requested_by_email: Optional[str],
        diff_preview: Optional[dict] = None,
    ) -> RestoreRequest:
        if mode not in ("upsert", "replace"):
            raise ValueError("mode must be 'upsert' or 'replace'")
        if not org_id:
            raise ValueError("org_id is required")
        req = RestoreRequest(
            id=str(uuid.uuid4()),
            org_id=org_id,
            source_path=source_path,
            status="requested",
            mode=mode,  # type: ignore[arg-type]
            reason=reason,
            requested_by=requested_by,
            requested_by_email=requested_by_email,
            requested_at=datetime.now(timezone.utc).isoformat(),
            diff_preview=diff_preview,
        )
        return self.repo.create(req)

    # ── approve (four-eyes) ─────────────────────────────────────────────────
    def approve(self, request_id: str, *, approver_id: str, approver_email: Optional[str]) -> RestoreRequest:
        req = self._require(request_id)
        if req.status != "requested":
            raise InvalidTransition(f"cannot approve a request in status '{req.status}'")
        if approver_id == req.requested_by:
            raise FourEyesViolation(
                "four-eyes: the approver must be a different super-admin than the requester"
            )
        now = datetime.now(timezone.utc).isoformat()
        self.repo.update(
            request_id,
            {
                "status": "approved",
                "approved_by": approver_id,
                "approved_by_email": approver_email,
                "approved_at": now,
            },
        )
        req.status = "approved"
        req.approved_by = approver_id
        req.approved_by_email = approver_email
        req.approved_at = now
        return req

    def reject(self, request_id: str, *, actor_id: str) -> RestoreRequest:
        req = self._require(request_id)
        if req.status not in ("requested", "approved"):
            raise InvalidTransition(f"cannot reject a request in status '{req.status}'")
        now = datetime.now(timezone.utc).isoformat()
        self.repo.update(request_id, {"status": "rejected", "rejected_by": actor_id, "rejected_at": now})
        req.status = "rejected"
        req.rejected_by = actor_id
        req.rejected_at = now
        return req

    def cancel(self, request_id: str, *, actor_id: str) -> RestoreRequest:
        req = self._require(request_id)
        if req.status in ("completed", "failed", "rejected", "cancelled"):
            raise InvalidTransition(f"cannot cancel a request in terminal status '{req.status}'")
        self.repo.update(request_id, {"status": "cancelled", "rejected_by": actor_id})
        req.status = "cancelled"
        return req

    # ── execute ─────────────────────────────────────────────────────────────
    def mark_executing(self, request_id: str) -> RestoreRequest:
        """Transition approved -> executing. Requires prior four-eyes approval."""
        req = self._require(request_id)
        if req.status != "approved":
            raise InvalidTransition(
                f"cannot execute a request in status '{req.status}' "
                "(must be 'approved' — four-eyes approval required first)"
            )
        now = datetime.now(timezone.utc).isoformat()
        self.repo.update(request_id, {"status": "executing", "executed_at": now})
        req.status = "executing"
        req.executed_at = now
        return req

    def mark_executed(
        self, request_id: str, *, result: dict, error_message: Optional[str] = None
    ) -> RestoreRequest:
        req = self._require(request_id)
        status: RestoreStatus = "failed" if error_message else "completed"
        self.repo.update(
            request_id,
            {"status": status, "result": result, "error_message": error_message},
        )
        req.status = status
        req.result = result
        req.error_message = error_message
        return req

    # ── helpers ─────────────────────────────────────────────────────────────
    def _require(self, request_id: str) -> RestoreRequest:
        req = self.repo.get(request_id)
        if req is None:
            raise KeyError(request_id)
        return req


# ════════════════════════════════════════════════════════════════════════════
# Diff preview — compare a tenant's backup archive vs live Firestore data
# ════════════════════════════════════════════════════════════════════════════


def _read_backup_archive(source_path: str) -> dict[str, list[dict]]:
    """Load and decode a BackupService archive (gzip JSON) into
    ``{collection: [doc, ...]}``. Works for both GCS and local-dev paths by
    reusing BackupService's path resolution.

    Raises on a malformed/missing archive so callers can surface a clear error.
    """
    import os

    from app.services.backup_service import BackupService

    raw: bytes
    bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET", "")
    if bucket_name:
        from app.firebase_client import get_bucket

        blob = get_bucket().blob(source_path)
        raw = blob.download_as_bytes()
    else:
        # BackupService._local_path is a classmethod that maps storage_path ->
        # an on-disk file for dev/test.
        local_file = BackupService._local_path(source_path)  # noqa: SLF001 (intentional reuse)
        with open(local_file, "rb") as fh:
            raw = fh.read()

    parsed = json.loads(gzip.decompress(raw))
    collections = parsed.get("collections", {})
    if not isinstance(collections, dict):
        raise ValueError("backup archive missing 'collections' object")
    return collections


def compute_diff_preview(
    *,
    org_id: str,
    source_path: str,
    sample_size: int = 10,
    live_reader: Optional[Any] = None,
) -> dict:
    """Return a per-collection diff between the backup archive and live data.

    Shape::

        {
          "org_id": ...,
          "source_path": ...,
          "generated_at": ISO8601,
          "totals": {"added": N, "changed": N, "unchanged": N},
          "collections": {
             "invoices": {"added": .., "changed": .., "unchanged": ..,
                          "sample_changed_ids": [...]},
             ...
          }
        }

    ``live_reader`` is an injection seam for tests: a callable
    ``live_reader(collection, org_id) -> {doc_id: doc_dict}``. In production it
    defaults to a Firestore-backed reader scoped by ``org_id``.
    """
    archive = _read_backup_archive(source_path)

    if live_reader is None:
        live_reader = _default_live_reader

    collections_out: dict[str, dict] = {}
    tot_added = tot_changed = tot_unchanged = 0

    for name, docs in archive.items():
        # Only diff docs belonging to this org (archives are already org-scoped,
        # but we re-check defensively to avoid cross-tenant bleed in diffs).
        archive_docs = {
            d.get("id"): {k: v for k, v in d.items() if k != "id"}
            for d in docs
            if isinstance(d, dict) and d.get("id") and d.get("org_id", org_id) == org_id
        }
        try:
            live_docs = live_reader(name, org_id) or {}
        except Exception as exc:  # noqa: BLE001
            logger.warning("diff_preview: live read failed for %s: %s", name, exc)
            live_docs = {}

        added = changed = unchanged = 0
        sample_changed: list[str] = []
        for doc_id, payload in archive_docs.items():
            live = live_docs.get(doc_id)
            if live is None:
                added += 1
            else:
                # Compare ignoring the live doc's own 'id' echo if present.
                live_cmp = {k: v for k, v in live.items() if k != "id"}
                if live_cmp != payload:
                    changed += 1
                    if len(sample_changed) < sample_size:
                        sample_changed.append(str(doc_id))
                else:
                    unchanged += 1

        collections_out[name] = {
            "added": added,
            "changed": changed,
            "unchanged": unchanged,
            "archive_count": len(archive_docs),
            "live_count": len(live_docs),
            "sample_changed_ids": sample_changed,
        }
        tot_added += added
        tot_changed += changed
        tot_unchanged += unchanged

    return {
        "org_id": org_id,
        "source_path": source_path,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "totals": {"added": tot_added, "changed": tot_changed, "unchanged": tot_unchanged},
        "collections": collections_out,
    }


def _default_live_reader(collection: str, org_id: str) -> dict[str, dict]:
    """Firestore-backed live reader: ``{doc_id: doc_dict}`` for one org."""
    from app.firebase_client import get_db

    db = get_db()
    out: dict[str, dict] = {}
    for snap in db.collection(collection).where("org_id", "==", org_id).stream():
        out[snap.id] = snap.to_dict() or {}
    return out


__all__ = [
    "RestoreRequest",
    "RestoreStatus",
    "DrRestoreRepository",
    "DrRestoreService",
    "FourEyesViolation",
    "InvalidTransition",
    "compute_diff_preview",
]
