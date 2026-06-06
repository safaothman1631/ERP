# Base repository for Firestore operations
from google.cloud import firestore as fs
from app.firebase_client import get_db, safe_query
from app.cache import cache
from typing import Any, ClassVar, Iterator, Optional
import json
import uuid
import logging
from datetime import datetime, date

from app.services.firestore_resilience import (
    LIST_HARD_CAP,
    ListMeta,
    empty_list_meta,
    is_firestore_quota_error,
)


class VersionConflict(Exception):
    """Raised by `update_versioned` when client `expected_version` mismatches stored `_version`."""

    def __init__(self, current_version: int, doc_id: str | None = None):
        super().__init__(f"version_conflict:{doc_id}:{current_version}")
        self.current_version = current_version
        self.doc_id = doc_id


DOC_SIZE_WARN_BYTES = 600 * 1024
DOC_SIZE_HARD_BYTES = 950 * 1024

logger = logging.getLogger(__name__)


def _track_fs_reads(n: int = 1) -> None:
    try:
        from app.config import get_settings
        from app.services import fs_metrics

        if get_settings().FS_METRICS_ENABLED:
            fs_metrics.increment_reads(n)
    except Exception:
        pass


def _track_fs_writes(n: int = 1) -> None:
    try:
        from app.config import get_settings
        from app.services import fs_metrics

        if get_settings().FS_METRICS_ENABLED:
            fs_metrics.increment_writes(n)
    except Exception:
        pass


def _coerce(item_val, filter_val):
    """Normalize types for comparison: convert string dates to datetime when filter is datetime."""
    if isinstance(filter_val, datetime) and isinstance(item_val, str):
        try:
            s = item_val.replace(" ", "T").rstrip("Z")
            if len(s) == 10:
                s += "T00:00:00"
            return datetime.fromisoformat(s)
        except Exception:
            return item_val
    if isinstance(filter_val, datetime) and isinstance(item_val, date):
        return datetime(item_val.year, item_val.month, item_val.day)
    return item_val


class BaseRepository:
    """Base repository with common CRUD operations.

    Optional class hooks (database-foundation-excellence spec):
        WRITE_MODEL            — pydantic class used to validate create/update payload
        SCHEMA_TARGET_VERSION  — int; lazy upgrade triggers when stored version is lower
        ENCRYPTED_FIELDS       — tuple of field names auto-encrypted at rest (mixin)
    """

    collection_name: str = ""
    WRITE_MODEL: ClassVar[type | None] = None
    SCHEMA_TARGET_VERSION: ClassVar[int] = 1

    def __init__(self, org_id: str):
        self.org_id = org_id
        self.db = get_db()
        self.collection = self.db.collection(self.collection_name)
        self.last_list_meta: ListMeta = empty_list_meta(self.collection_name, org_id)

    @classmethod
    def _validate_payload(cls, data: dict) -> dict:
        from app.config import settings
        import datetime as _dt

        model = cls.WRITE_MODEL
        if model is None and getattr(settings, "GENERIC_WRITE_VALIDATION", True):
            from app.firestore.write_models.generic import GenericWriteModel

            model = GenericWriteModel
        if model is None:
            return data

        # Pre-coerce datetime/date → ISO string so callers can pass either type
        # without each endpoint needing to call .isoformat() before repo.create.
        # Write-models declare these fields as `str`, so we feed them strings.
        def _coerce(v):
            if isinstance(v, (_dt.datetime, _dt.date)):
                return v.isoformat()
            return v

        cleaned = {
            k: _coerce(v)
            for k, v in data.items()
            if k not in {"id", "org_id", "_version", "schema_version", "created_at", "updated_at"}
        }
        validated = model.model_validate(cleaned)
        out = validated.model_dump(exclude_unset=True)
        for k, v in data.items():
            if k in {"id"}:
                out[k] = v
        return out

    @staticmethod
    def _check_doc_size(coll: str, data: dict) -> None:
        try:
            size = len(json.dumps(data, default=str).encode("utf-8"))
        except Exception:
            return
        if size > DOC_SIZE_HARD_BYTES:
            raise ValueError(f"doc_size_exceeded:{coll}:{size}")
        if size > DOC_SIZE_WARN_BYTES:
            logger.warning(
                "doc_size_warning",
                extra={"collection": coll, "size_bytes": size},
            )

    def _upgrade_schema(self, doc_id: str, data: dict) -> dict:
        target = self.SCHEMA_TARGET_VERSION
        current = int(data.get("schema_version") or 1)
        if current >= target:
            return data
        try:
            from app.firestore.migrations import run_migrations

            data = run_migrations(self.collection_name, data, current, target)
        except Exception as exc:
            logger.warning(
                "schema_migration_failed",
                extra={"collection": self.collection_name, "doc_id": doc_id, "error": str(exc)},
            )
            return data
        try:
            self.collection.document(doc_id).update({"schema_version": target})
        except Exception:
            pass
        data["schema_version"] = target
        return data

    def get(self, doc_id: str) -> Optional[dict]:
        """Get single document by ID with caching."""
        cache_key = f"{self.collection_name}:{doc_id}"
        cached = cache.get(cache_key)
        if cached:
            if cached.get("org_id") != self.org_id:
                cache.delete(cache_key)
                return None
            return cached

        try:
            doc = self.collection.document(doc_id).get()
            _track_fs_reads(1)
        except Exception as exc:
            if is_firestore_quota_error(exc):
                return cache.get(cache_key)
            raise
        if doc.exists:
            data = {"id": doc.id, **doc.to_dict()}
            if data.get("org_id") != self.org_id:
                cache.delete(cache_key)
                return None
            data["is_deleted"] = data.get("deleted_at") is not None
            if self.SCHEMA_TARGET_VERSION > 1:
                data = self._upgrade_schema(doc_id, data)
            cache.set(cache_key, data)
            return data
        return None

    def stream_org_docs(
        self,
        *,
        batch_size: int = 500,
        include_deleted: bool = False,
    ) -> Iterator[dict]:
        """Stream all org documents without the 10k list() cap."""
        query = self.collection.where("org_id", "==", self.org_id)
        last_doc = None
        while True:
            q = query.limit(batch_size)
            if last_doc is not None:
                q = q.start_after(last_doc)
            batch = safe_query(q)
            if not batch:
                break
            for doc in batch:
                data = {"id": doc.id, **doc.to_dict()}
                if not include_deleted and data.get("deleted_at"):
                    continue
                data["is_deleted"] = data.get("deleted_at") is not None
                yield data
            last_doc = batch[-1]
            if len(batch) < batch_size:
                break

    def _fetch_org_docs_capped(self) -> tuple[list[dict], ListMeta]:
        meta = ListMeta(collection=self.collection_name, org_id=self.org_id)
        query = self.collection.where("org_id", "==", self.org_id)
        try:
            all_items = [
                {"id": doc.id, **doc.to_dict()}
                for doc in safe_query(query.limit(LIST_HARD_CAP))
            ]
        except Exception as exc:
            if is_firestore_quota_error(exc):
                logger.warning(
                    "Firestore quota on list collection=%s org_id=%s",
                    self.collection_name,
                    self.org_id,
                )
                meta.degraded = True
                return [], meta
            raise
        meta.doc_count_fetched = len(all_items)
        if len(all_items) >= LIST_HARD_CAP:
            meta.truncated = True
            logger.warning(
                "list_truncated collection=%s org_id=%s cap=%s",
                self.collection_name,
                self.org_id,
                LIST_HARD_CAP,
            )
        return all_items, meta

    def list(
        self,
        filters=None,
        order_by=None,
        order_dir="DESCENDING",
        limit=25,
        offset=0,
        start_after=None,
        include_deleted=False,
        _force_client_side: bool = False,
    ) -> tuple:
        """List documents with pagination. Returns (items, total_count).

        ``_force_client_side`` forces the in-memory capped path, bypassing the
        indexed ``list_page``. The index-missing fallback uses this to avoid
        infinitely re-entering ``list_page`` (which would re-raise the same
        index error and recurse until the stack overflows -> 500).
        """
        from app.config import get_settings

        if get_settings().USE_FIRESTORE_QUERY and not offset and not _force_client_side:
            page = self.list_page(
                filters=filters,
                order_by=order_by,
                order_dir=order_dir,
                limit=limit,
                cursor_id=start_after,
                include_deleted=include_deleted,
            )
            return page.items, len(page.items) + (1 if page.has_more else 0)

        all_items, meta = self._fetch_org_docs_capped()
        self.last_list_meta = meta

        if not include_deleted:
            all_items = [item for item in all_items if not item.get("deleted_at")]

        for f in filters or []:
            op = f["op"]
            field = f["field"]
            val = f["value"]
            if op == "==":
                all_items = [item for item in all_items if item.get(field) == val]
            elif op == "!=":
                all_items = [item for item in all_items if item.get(field) != val]
            elif op == ">":
                all_items = [
                    item
                    for item in all_items
                    if item.get(field) is not None and _coerce(item.get(field), val) > val
                ]
            elif op == ">=":
                all_items = [
                    item
                    for item in all_items
                    if item.get(field) is not None and _coerce(item.get(field), val) >= val
                ]
            elif op == "<":
                all_items = [
                    item
                    for item in all_items
                    if item.get(field) is not None and _coerce(item.get(field), val) < val
                ]
            elif op == "<=":
                all_items = [
                    item
                    for item in all_items
                    if item.get(field) is not None and _coerce(item.get(field), val) <= val
                ]
            elif op == "in":
                all_items = [item for item in all_items if item.get(field) in val]
            elif op == "not-in":
                all_items = [item for item in all_items if item.get(field) not in val]
            elif op == "array_contains":
                all_items = [item for item in all_items if val in (item.get(field) or [])]

        total = len(all_items)

        if order_by:
            reverse = order_dir == "DESCENDING"

            def _sort_key(x):
                v = x.get(order_by)
                if v is None:
                    return (True, "")
                return (False, str(v))

            all_items = sorted(all_items, key=_sort_key, reverse=reverse)

        start_idx = offset
        if start_after:
            for i, item in enumerate(all_items):
                if item["id"] == start_after:
                    start_idx = i + 1
                    break

        items = all_items[start_idx : start_idx + limit]
        for item in items:
            item["is_deleted"] = item.get("deleted_at") is not None
        return items, total

    def list_page(
        self,
        *,
        filters=None,
        order_by=None,
        order_dir="DESCENDING",
        limit=25,
        cursor_id: str | None = None,
        include_deleted: bool = False,
    ):
        from app.firestore.query import PageResult, list_page

        return list_page(
            self,
            filters=filters,
            order_by=order_by or "created_at",
            order_dir=order_dir,
            limit=limit,
            cursor_id=cursor_id,
            include_deleted=include_deleted,
        )

    def _reject_client_org_id(self, data: dict) -> None:
        if data.get("org_id") and data.get("org_id") != self.org_id:
            raise ValueError("org_id must not be supplied on write payload")

    def _soft_cascade_subcollection(self, doc_id: str, sub_name: str = "lines") -> None:
        if self.collection_name not in ("invoices", "journal_entries"):
            return
        now = datetime.utcnow()
        for sub in self.collection.document(doc_id).collection(sub_name).stream():
            _track_fs_reads(1)
            sub.reference.update({"deleted_at": now, "updated_at": now})
            _track_fs_writes(1)

    def create(self, data: dict) -> dict:
        doc_id = data.pop("id", str(uuid.uuid4()))
        self._reject_client_org_id(data)
        data.pop("org_id", None)
        if self.WRITE_MODEL is not None:
            data = self._validate_payload(data)
        data["org_id"] = self.org_id
        data.setdefault("is_active", True)
        data.pop("is_deleted", None)
        now = datetime.utcnow()
        data["created_at"] = now
        data["updated_at"] = now
        data.setdefault("_version", 1)
        data.setdefault("schema_version", self.SCHEMA_TARGET_VERSION)
        from app.services.ttl_fields import attach_ttl_fields

        data = attach_ttl_fields(self.collection_name, data)
        self._check_doc_size(self.collection_name, data)

        self.collection.document(doc_id).set(data)
        result = {"id": doc_id, **data}
        result["is_deleted"] = result.get("deleted_at") is not None
        return result

    def update(self, doc_id: str, data: dict) -> dict:
        self._reject_client_org_id(data)
        data.pop("org_id", None)
        if self.WRITE_MODEL is not None:
            cleaned = self._validate_payload(data)
        else:
            cleaned = dict(data)
        cleaned["updated_at"] = datetime.utcnow()
        if "_version" not in cleaned:
            current = self.get(doc_id)
            if current:
                cleaned["_version"] = int(current.get("_version") or 1) + 1
        self._check_doc_size(self.collection_name, cleaned)
        self.collection.document(doc_id).update(cleaned)
        _track_fs_writes(1)
        cache.delete(f"{self.collection_name}:{doc_id}")
        return self.get(doc_id)

    def update_versioned(self, doc_id: str, data: dict, expected_version: int) -> dict:
        """Optimistic-lock update; raises VersionConflict on stale write."""
        if self.WRITE_MODEL is not None:
            cleaned = self._validate_payload(data)
        else:
            cleaned = dict(data)
        doc_ref = self.collection.document(doc_id)

        @fs.transactional
        def _tx(transaction: fs.Transaction) -> dict:
            snap = doc_ref.get(transaction=transaction)
            if not snap.exists:
                raise LookupError(f"doc_not_found:{doc_id}")
            current = snap.to_dict() or {}
            if current.get("org_id") != self.org_id:
                raise LookupError(f"doc_not_found:{doc_id}")
            stored_version = int(current.get("_version") or 1)
            if stored_version != int(expected_version):
                raise VersionConflict(stored_version, doc_id=doc_id)
            now = datetime.utcnow()
            payload = {**cleaned, "updated_at": now, "_version": stored_version + 1}
            self._check_doc_size(self.collection_name, payload)
            transaction.update(doc_ref, payload)
            return {**current, **payload, "id": doc_id}

        result = _tx(self.db.transaction())
        _track_fs_writes(1)
        _track_fs_reads(1)
        cache.delete(f"{self.collection_name}:{doc_id}")
        return result

    def delete(self, doc_id: str, hard: bool = False):
        from app.firestore.references import ReferenceConflict
        from app.services.reference_guard import find_blocking_references, find_item_usage_blockers

        if self.collection_name == "items":
            blockers = find_item_usage_blockers(self.org_id, doc_id)
        else:
            blockers = find_blocking_references(self.org_id, self.collection_name, doc_id)
        if blockers:
            raise ReferenceConflict(self.collection_name, doc_id, blockers)
        if hard:
            self._delete_subcollections(doc_id)
            self.collection.document(doc_id).delete()
            _track_fs_writes(1)
        else:
            self._soft_cascade_subcollection(doc_id)
            self.collection.document(doc_id).update({
                "deleted_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            })
            _track_fs_writes(1)
        cache.delete(f"{self.collection_name}:{doc_id}")

    def restore(self, doc_id: str) -> Optional[dict]:
        self.collection.document(doc_id).update({
            "deleted_at": fs.DELETE_FIELD,
            "updated_at": datetime.utcnow(),
        })
        cache.delete(f"{self.collection_name}:{doc_id}")
        return self.get(doc_id)

    def _delete_subcollections(self, doc_id: str):
        doc_ref = self.collection.document(doc_id)
        for subcol in doc_ref.collections():
            for subdoc in subcol.stream():
                subdoc.reference.delete()

    def get_lines(self, doc_id: str, subcol: str = "lines") -> list:
        refs = self.collection.document(doc_id).collection(subcol).order_by("sort_order").stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in refs]

    def set_lines(self, doc_id: str, lines: list, subcol: str = "lines"):
        batch = self.db.batch()
        for doc in self.collection.document(doc_id).collection(subcol).stream():
            batch.delete(doc.reference)
        for i, line in enumerate(lines):
            line_id = line.pop("id", str(uuid.uuid4()))
            line["sort_order"] = i
            ref = self.collection.document(doc_id).collection(subcol).document(line_id)
            batch.set(ref, line)
        batch.commit()

    def search(self, field: str, term: str, limit: int = 20) -> list:
        query = (
            self.collection.where("org_id", "==", self.org_id)
            .where(field, ">=", term)
            .where(field, "<=", term + "\uf8ff")
            .limit(limit)
        )
        return [{"id": doc.id, **doc.to_dict()} for doc in safe_query(query)]

    def increment(self, doc_id: str, field: str, value):
        self.collection.document(doc_id).update({field: fs.Increment(value)})
        cache.delete(f"{self.collection_name}:{doc_id}")
