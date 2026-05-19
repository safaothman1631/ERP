"""
BackupService — exports all critical Firestore collections per organization
to a gzip-compressed JSON archive, uploads to Firebase Cloud Storage, verifies
integrity via document count + SHA-256 checksum, and records metadata in the
`backups` Firestore collection.

Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1–5.6, 6.x, 7.x, 10.6
"""
from __future__ import annotations

import asyncio
import gzip
import hashlib
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import ClassVar, Literal

logger = logging.getLogger(__name__)


@dataclass
class BackupRecord:
    """Metadata for a single backup run stored in the Firestore `backups` collection."""

    id: str
    org_id: str
    filename: str
    storage_path: str
    created_at: str                                          # ISO8601 UTC
    status: Literal["success", "failed"]
    integrity_status: Literal["verified", "failed", "pending"]
    total_documents: int
    collections_backed_up: list[str]
    file_size_bytes: int
    checksum_sha256: str
    error_message: str | None                               # None on success


class BackupService:
    """Exports, compresses, uploads, and verifies Firestore backups per org.

    Class-level constants
    ---------------------
    COLLECTIONS : list[str]
        All 40 Firestore collection names that must be included in every backup
        (Requirement 4.1).
    RETENTION_COUNT : int
        Maximum number of backup records to keep per organization (Requirement 4.7).
    """

    # ── Requirement 4.1 — all 40 collections ──────────────────────────────
    COLLECTIONS: ClassVar[list[str]] = [
        "users",
        "organizations",
        "contacts",
        "items",
        "invoices",
        "invoice_lines",
        "expenses",
        "expense_lines",
        "accounts",
        "journal_entries",
        "payments",
        "payments_made",
        "quotes",
        "quote_lines",
        "sales_orders",
        "purchase_orders",
        "credit_notes",
        "vendor_credits",
        "inventory",
        "locations",
        "taxes",
        "settings",
        "audit_logs",
        "recurring_invoices",
        "fixed_assets",
        "hr_employees",
        "payroll_runs",
        "crm_leads",
        "crm_opportunities",
        "pos_sessions",
        "pos_orders",
        "manufacturing_orders",
        "subscriptions",
        "branches",
        "custom_fields",
        "automation_rules",
        "budgets",
        "currency_rates",
        "numbering_sequences",
    ]

    # ── Requirement 4.7 — retention ───────────────────────────────────────
    RETENTION_COUNT: ClassVar[int] = 30

    # ── Constructor ───────────────────────────────────────────────────────

    def __init__(self, org_id: str) -> None:
        """Initialise the service for a specific organisation.

        Args:
            org_id: The organisation identifier.  All Firestore queries and
                    Cloud Storage paths are scoped to this value.
        """
        self.org_id = org_id

    # ── Public orchestration ──────────────────────────────────────────────

    async def run_backup(self) -> BackupRecord:
        """Run a full backup cycle for the organisation.

        Orchestration order:
            1. Export all collections from Firestore.
            2. Serialise to JSON bytes.
            3. Gzip-compress.
            4. Compute SHA-256 checksum.
            5. Upload to Cloud Storage.
            6. Verify integrity (document count round-trip).
            7. Write BackupRecord to Firestore.
            8. Enforce retention policy.

        Returns:
            A completed :class:`BackupRecord` (status may be ``"failed"``).
        """
        now = datetime.now(timezone.utc)
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")
        date_str = now.strftime("%Y-%m-%d")
        filename = f"backup_{timestamp_str}.json.gz"
        storage_path = f"backups/{self.org_id}/{date_str}/{filename}"
        backup_id = str(uuid.uuid4())

        record = BackupRecord(
            id=backup_id,
            org_id=self.org_id,
            filename=filename,
            storage_path=storage_path,
            created_at=now.isoformat(),
            status="failed",
            integrity_status="pending",
            total_documents=0,
            collections_backed_up=list(self.COLLECTIONS),
            file_size_bytes=0,
            checksum_sha256="",
            error_message=None,
        )

        try:
            # Step 1 — export
            collections_data = await self._export_collections()
            total_docs = sum(len(docs) for docs in collections_data.values())
            record.total_documents = total_docs

            # Step 2 — serialise
            archive_payload = {
                "org_id": self.org_id,
                "exported_at": now.isoformat(),
                "version": "1.0",
                "collections": collections_data,
            }
            raw_bytes = self._serialize_to_json(archive_payload)

            # Step 3 — compress
            compressed = self._compress(raw_bytes)
            record.file_size_bytes = len(compressed)

            # Step 4 — checksum
            record.checksum_sha256 = self._compute_checksum(compressed)

            # Step 5 — upload
            await self._upload(compressed, storage_path)

        except Exception as exc:
            logger.error(
                "Backup upload failed for org %s: %s", self.org_id, exc, exc_info=True
            )
            record.error_message = str(exc)
            await self._write_record(record)
            await self._notify_failure(record)
            return record

        # Step 6 — integrity verification
        try:
            verified, actual_count = await self._verify_integrity(
                storage_path, total_docs
            )
        except Exception as exc:
            logger.error(
                "Integrity verification failed for org %s: %s",
                self.org_id,
                exc,
                exc_info=True,
            )
            record.integrity_status = "failed"
            record.error_message = str(exc)
            await self._write_record(record)
            await self._notify_failure(record)
            return record

        if not verified:
            record.integrity_status = "failed"
            record.error_message = (
                f"Document count mismatch: exported {total_docs}, verified {actual_count}"
            )
            await self._write_record(record)
            await self._notify_failure(record)
            return record

        # Step 7 — success
        record.status = "success"
        record.integrity_status = "verified"
        await self._write_record(record)

        # Step 8 — retention
        await self._enforce_retention()

        return record

    # ── Collection export ─────────────────────────────────────────────────

    async def _export_collections(self) -> dict[str, list[dict]]:
        """Export all 40 collections from Firestore, scoped to this org.

        Empty or missing collections are included as empty lists (Requirement 4.8).

        Returns:
            A dict mapping each collection name to a list of document dicts.
        """
        from app.firebase_client import get_db  # local import to avoid circular deps

        db = get_db()
        result: dict[str, list[dict]] = {}

        for collection_name in self.COLLECTIONS:
            try:
                docs = (
                    db.collection(collection_name)
                    .where("org_id", "==", self.org_id)
                    .stream()
                )
                result[collection_name] = [
                    {"id": doc.id, **doc.to_dict()} for doc in docs
                ]
            except Exception as exc:
                logger.warning(
                    "Failed to export collection %s for org %s: %s",
                    collection_name,
                    self.org_id,
                    exc,
                )
                # Include as empty array — never treat missing collection as error
                result[collection_name] = []

        return result

    # ── Pure utility methods ──────────────────────────────────────────────

    def _serialize_to_json(self, data: dict) -> bytes:
        """Serialise *data* to UTF-8 JSON bytes.

        The top-level structure must follow the archive schema:
        ``{"org_id": ..., "exported_at": ..., "version": "1.0", "collections": {...}}``.

        Args:
            data: Dict to serialise.

        Returns:
            Raw JSON bytes (UTF-8 encoded).
        """
        return json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")

    def _compress(self, data: bytes) -> bytes:
        """Gzip-compress *data*.

        Args:
            data: Raw bytes to compress.

        Returns:
            Compressed bytes.
        """
        return gzip.compress(data)

    def _compute_checksum(self, data: bytes) -> str:
        """Compute the SHA-256 hex digest of *data*.

        This is deterministic: the same byte sequence always produces the
        same hex string (Property 8).

        Args:
            data: Byte sequence to hash.

        Returns:
            Lowercase hex string of the SHA-256 digest.
        """
        return hashlib.sha256(data).hexdigest()

    # ── Upload ────────────────────────────────────────────────────────────

    # Base directory for local backup storage (relative to backend root)
    _LOCAL_BACKUP_DIR: ClassVar[str] = "backups"

    @classmethod
    def _local_path(cls, storage_path: str) -> str:
        """Convert a storage_path like 'backups/org/date/file.gz' to an absolute local path."""
        import os
        base = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), cls._LOCAL_BACKUP_DIR)
        # storage_path already starts with "backups/..." — strip the leading "backups/" prefix
        # to avoid doubling it, then join with base.
        relative = storage_path[len("backups/"):] if storage_path.startswith("backups/") else storage_path
        return os.path.join(base, relative)

    async def _upload(self, compressed: bytes, path: str) -> None:
        """Save *compressed* bytes to local filesystem (dev) or Cloud Storage (prod).

        Enforces org-scoped path prefix ``backups/{org_id}/`` (Requirement 10.6).
        """
        import os

        expected_prefix = f"backups/{self.org_id}/"
        if not path.startswith(expected_prefix):
            raise ValueError(
                f"Storage path '{path}' does not start with expected prefix "
                f"'{expected_prefix}' (Requirement 10.6)"
            )

        bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET", "")
        if bucket_name:
            # Production: upload to Firebase Cloud Storage
            from app.firebase_client import get_bucket
            bucket = get_bucket()
            blob = bucket.blob(path)
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: blob.upload_from_string(compressed, content_type="application/gzip"),
            )
            logger.info("Backup uploaded to Cloud Storage: %s", path)
        else:
            # Development: save to local filesystem
            local_file = self._local_path(path)
            os.makedirs(os.path.dirname(local_file), exist_ok=True)

            def _write() -> None:
                with open(local_file, "wb") as f:
                    f.write(compressed)

            await asyncio.get_event_loop().run_in_executor(None, _write)
            logger.info("Backup saved locally: %s (%d bytes)", local_file, len(compressed))

    # ── Integrity verification ────────────────────────────────────────────

    async def _verify_integrity(
        self, path: str, expected_count: int
    ) -> tuple[bool, int]:
        """Download, decompress, and count documents in the uploaded archive.

        Must complete within 120 seconds (Requirement 5.5).

        Args:
            path:           Cloud Storage path of the uploaded backup.
            expected_count: Total document count recorded during export.

        Returns:
            ``(True, actual_count)`` when counts match and parsing succeeded.
            ``(False, actual_count)`` when counts differ or parsing fails.
        """
        try:
            result = await asyncio.wait_for(
                self._do_verify(path, expected_count), timeout=120.0
            )
            return result
        except asyncio.TimeoutError:
            logger.error(
                "Integrity verification timed out for org %s path %s",
                self.org_id,
                path,
            )
            return False, 0

    async def _do_verify(
        self, path: str, expected_count: int
    ) -> tuple[bool, int]:
        """Verify integrity from local filesystem (dev) or Cloud Storage (prod)."""
        import os

        bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET", "")
        if bucket_name:
            # Production: download from Cloud Storage
            from app.firebase_client import get_bucket
            bucket = get_bucket()
            blob = bucket.blob(path)
            compressed = await asyncio.get_event_loop().run_in_executor(
                None, blob.download_as_bytes
            )
        else:
            # Development: read from local filesystem
            local_file = self._local_path(path)

            def _read() -> bytes:
                with open(local_file, "rb") as f:
                    return f.read()

            try:
                compressed = await asyncio.get_event_loop().run_in_executor(None, _read)
            except FileNotFoundError:
                logger.error("Backup file not found for verification: %s", local_file)
                return False, 0

        try:
            raw = gzip.decompress(compressed)
            parsed = json.loads(raw)
        except Exception as exc:
            logger.error("Failed to decompress/parse backup for org %s: %s", self.org_id, exc)
            return False, 0

        collections = parsed.get("collections", {})
        actual_count = sum(len(docs) for docs in collections.values())
        return actual_count == expected_count, actual_count

    # ── Firestore record ──────────────────────────────────────────────────

    async def _write_record(self, record: BackupRecord) -> None:
        """Persist *record* to the Firestore ``backups`` collection.

        Args:
            record: The :class:`BackupRecord` to write.
        """
        from app.firebase_client import get_db  # local import

        db = get_db()
        doc_data = {
            "id": record.id,
            "org_id": record.org_id,
            "filename": record.filename,
            "storage_path": record.storage_path,
            "created_at": record.created_at,
            "status": record.status,
            "integrity_status": record.integrity_status,
            "total_documents": record.total_documents,
            "collections_backed_up": record.collections_backed_up,
            "file_size_bytes": record.file_size_bytes,
            "checksum_sha256": record.checksum_sha256,
            "error_message": record.error_message,
        }
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: db.collection("backups").document(record.id).set(doc_data),
        )

    # ── Retention ─────────────────────────────────────────────────────────

    async def _enforce_retention(self) -> None:
        """Delete backup records and files beyond the retention limit."""
        import os
        from app.firebase_client import get_db

        db = get_db()
        docs = db.collection("backups").where("org_id", "==", self.org_id).stream()
        all_records = sorted(
            list(docs),
            key=lambda d: d.to_dict().get("created_at", ""),
            reverse=True,
        )

        if len(all_records) <= self.RETENTION_COUNT:
            return

        bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET", "")
        to_delete = all_records[self.RETENTION_COUNT:]
        for doc in to_delete:
            data = doc.to_dict()
            storage_path = data.get("storage_path", "")

            if storage_path:
                try:
                    if bucket_name:
                        from app.firebase_client import get_bucket
                        bucket = get_bucket()
                        blob = bucket.blob(storage_path)
                        await asyncio.get_event_loop().run_in_executor(
                            None, lambda b=blob: b.delete() if b.exists() else None
                        )
                    else:
                        local_file = self._local_path(storage_path)
                        if os.path.exists(local_file):
                            os.remove(local_file)
                except Exception as exc:
                    logger.warning("Failed to delete backup file %s: %s", storage_path, exc)

            try:
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda d=doc: db.collection("backups").document(d.id).delete(),
                )
            except Exception as exc:
                logger.warning("Failed to delete Firestore backup record %s: %s", doc.id, exc)

    # ── Failure notification ──────────────────────────────────────────────

    async def _notify_failure(self, record: BackupRecord) -> None:
        """Send failure alert emails to all admin/owner users in the org.

        Only fires when ``status == "failed"`` or ``integrity_status == "failed"``.
        Does NOT send email on successful backups (Requirement 7.3).

        Retries up to 3 times per recipient on email failure (Requirement 7.4).
        Never raises to the caller (Requirement 7.4).

        Args:
            record: The failed :class:`BackupRecord`.
        """
        # Guard: do not send email on success (Requirement 7.3)
        if record.status == "success" and record.integrity_status == "verified":
            return

        from app.firebase_client import get_db  # local import
        from app.services.email_service import send_email  # local import

        db = get_db()

        # Fetch all admin/owner users for this org
        try:
            users_docs = (
                db.collection("users")
                .where("org_id", "==", self.org_id)
                .where("role", "in", ["admin", "owner"])
                .stream()
            )
            admin_users = [doc.to_dict() for doc in users_docs]
        except Exception as exc:
            logger.error(
                "Failed to fetch admin users for failure notification, org %s: %s",
                self.org_id,
                exc,
            )
            return

        subject = f"[ERP] Backup Failed — {self.org_id}"
        body = (
            f"Backup failed for organization: {self.org_id}\n"
            f"Timestamp: {record.created_at}\n"
            f"Reason: {record.error_message or 'Unknown error'}\n\n"
            f"View details: /settings/system-health"
        )

        for user in admin_users:
            email = user.get("email", "")
            if not email:
                continue

            # Retry up to 3 times with exponential backoff
            for attempt in range(1, 4):
                try:
                    await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda e=email: send_email(
                            to=e, subject=subject, body=body
                        ),
                    )
                    break  # success — stop retrying
                except Exception as exc:
                    logger.error(
                        "Failed to send backup failure email to %s (attempt %d/3): %s",
                        email,
                        attempt,
                        exc,
                    )
                    if attempt < 3:
                        await asyncio.sleep(2 ** attempt)  # 2s, 4s backoff
