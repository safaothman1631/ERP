# Base repository for Firestore operations
from google.cloud import firestore as fs
from app.firebase_client import get_db
from app.cache import cache
from typing import Optional
import uuid
from datetime import datetime, date


def _coerce(item_val, filter_val):
    """Normalize types for comparison: convert string dates to datetime when filter is datetime."""
    if isinstance(filter_val, datetime) and isinstance(item_val, str):
        try:
            # ISO format strings: "2026-01-01T00:00:00" or "2026-01-01 00:00:00" or "2026-01-01"
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
    """Base repository with common CRUD operations"""
    collection_name: str = ""
    
    def __init__(self, org_id: str):
        self.org_id = org_id
        self.db = get_db()
        self.collection = self.db.collection(self.collection_name)
    
    def get(self, doc_id: str) -> Optional[dict]:
        """Get single document by ID with caching.

        Returns the document with `is_deleted` computed field:
          is_deleted = True  if deleted_at is set (soft-deleted)
          is_deleted = False if deleted_at is None (active)
        """
        cache_key = f"{self.collection_name}:{doc_id}"
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        doc = self.collection.document(doc_id).get()
        if doc.exists:
            data = {"id": doc.id, **doc.to_dict()}
            data["is_deleted"] = data.get("deleted_at") is not None
            cache.set(cache_key, data)
            return data
        return None
    
    def list(self, filters=None, order_by=None, order_dir="DESCENDING", 
             limit=25, offset=0, start_after=None, include_deleted=False) -> tuple:
        """List documents with pagination and filtering. Returns (items, total_count).
        
        To avoid requiring Firestore composite indexes, all filtering beyond org_id
        is performed in Python after fetching documents.

        Soft-delete: items with `deleted_at` set are excluded unless `include_deleted=True`.
        """
        # Only filter by org_id in Firestore to avoid composite index requirements
        query = self.collection.where("org_id", "==", self.org_id)
        
        # Fetch all org documents (up to 10000)
        all_items = [{"id": doc.id, **doc.to_dict()} for doc in query.limit(10000).stream()]

        # Soft-delete filter (apply first so it's cheap)
        if not include_deleted:
            all_items = [item for item in all_items if not item.get("deleted_at")]
        
        # Apply all filters in Python
        for f in (filters or []):
            op = f["op"]
            field = f["field"]
            val = f["value"]
            if op == "==":
                all_items = [item for item in all_items if item.get(field) == val]
            elif op == "!=":
                all_items = [item for item in all_items if item.get(field) != val]
            elif op == ">":
                all_items = [item for item in all_items if item.get(field) is not None and _coerce(item.get(field), val) > val]
            elif op == ">=":
                all_items = [item for item in all_items if item.get(field) is not None and _coerce(item.get(field), val) >= val]
            elif op == "<":
                all_items = [item for item in all_items if item.get(field) is not None and _coerce(item.get(field), val) < val]
            elif op == "<=":
                all_items = [item for item in all_items if item.get(field) is not None and _coerce(item.get(field), val) <= val]
            elif op == "in":
                all_items = [item for item in all_items if item.get(field) in val]
            elif op == "not-in":
                all_items = [item for item in all_items if item.get(field) not in val]
            elif op == "array_contains":
                all_items = [item for item in all_items if val in (item.get(field) or [])]
        
        total = len(all_items)
        
        # Sort in Python
        if order_by:
            reverse = (order_dir == "DESCENDING")
            def _sort_key(x):
                v = x.get(order_by)
                if v is None:
                    return (True, "")
                # Normalize to string for consistent comparison across types
                return (False, str(v))
            all_items = sorted(
                all_items,
                key=_sort_key,
                reverse=reverse
            )
        
        # Apply pagination
        start_idx = offset
        if start_after:
            for i, item in enumerate(all_items):
                if item["id"] == start_after:
                    start_idx = i + 1
                    break
        
        items = all_items[start_idx:start_idx + limit]
        # Add is_deleted computed field to each item (داواکاری ٧.٧)
        for item in items:
            item["is_deleted"] = item.get("deleted_at") is not None
        return items, total
    
    def create(self, data: dict) -> dict:
        """Create new document.

        Soft-delete convention (داواکاری ٧.٧):
          - `deleted_at` is not set on creation (None = not deleted)
          - `is_deleted` is a computed alias: is_deleted = (deleted_at is not None)
          - Use delete(doc_id) for soft-delete, delete(doc_id, hard=True) for hard-delete
        """
        doc_id = data.pop("id", str(uuid.uuid4()))
        data["org_id"] = self.org_id
        data.setdefault("is_active", True)  # ensure is_active is always set
        # Soft-delete: deleted_at is None on creation (not deleted)
        # is_deleted is a computed alias exposed in API responses
        data.pop("is_deleted", None)  # never store is_deleted; use deleted_at instead
        now = datetime.utcnow()
        data["created_at"] = now
        data["updated_at"] = now

        self.collection.document(doc_id).set(data)
        result = {"id": doc_id, **data}
        result["is_deleted"] = result.get("deleted_at") is not None
        return result
    
    def update(self, doc_id: str, data: dict) -> dict:
        """Update existing document"""
        data["updated_at"] = datetime.utcnow()
        self.collection.document(doc_id).update(data)
        cache.delete(f"{self.collection_name}:{doc_id}")
        return self.get(doc_id)
    
    def delete(self, doc_id: str, hard: bool = False):
        """Soft-delete by default (sets `deleted_at`). Pass `hard=True` to permanently remove.

        Soft-deleted items remain in Firestore for 30 days, then a scheduled job
        purges them. They are excluded from `list()` unless `include_deleted=True`.
        """
        if hard:
            self._delete_subcollections(doc_id)
            self.collection.document(doc_id).delete()
        else:
            self.collection.document(doc_id).update({
                "deleted_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            })
        cache.delete(f"{self.collection_name}:{doc_id}")

    def restore(self, doc_id: str) -> Optional[dict]:
        """Restore a soft-deleted document by clearing `deleted_at`."""
        self.collection.document(doc_id).update({
            "deleted_at": fs.DELETE_FIELD,
            "updated_at": datetime.utcnow(),
        })
        cache.delete(f"{self.collection_name}:{doc_id}")
        return self.get(doc_id)
    
    def _delete_subcollections(self, doc_id: str):
        """Recursively delete all subcollections"""
        doc_ref = self.collection.document(doc_id)
        for subcol in doc_ref.collections():
            for subdoc in subcol.stream():
                subdoc.reference.delete()
    
    def get_lines(self, doc_id: str, subcol: str = "lines") -> list:
        """Get subcollection items (e.g., invoice lines)"""
        refs = self.collection.document(doc_id).collection(subcol).order_by("sort_order").stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in refs]
    
    def set_lines(self, doc_id: str, lines: list, subcol: str = "lines"):
        """Replace subcollection items in batch"""
        batch = self.db.batch()
        
        # Delete existing lines
        for doc in self.collection.document(doc_id).collection(subcol).stream():
            batch.delete(doc.reference)
        
        # Add new lines
        for i, line in enumerate(lines):
            line_id = line.pop("id", str(uuid.uuid4()))
            line["sort_order"] = i
            ref = self.collection.document(doc_id).collection(subcol).document(line_id)
            batch.set(ref, line)
        
        batch.commit()
    
    def search(self, field: str, term: str, limit: int = 20) -> list:
        """Search documents by field prefix"""
        query = self.collection.where("org_id", "==", self.org_id) \
            .where(field, ">=", term) \
            .where(field, "<=", term + "\uf8ff") \
            .limit(limit)
        return [{"id": doc.id, **doc.to_dict()} for doc in query.stream()]
    
    def increment(self, doc_id: str, field: str, value):
        """Atomically increment a numeric field"""
        self.collection.document(doc_id).update({
            field: fs.Increment(value)
        })
        cache.delete(f"{self.collection_name}:{doc_id}")
