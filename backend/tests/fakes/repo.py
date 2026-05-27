"""In-memory repository fake for contract tests (Wave K)."""
from __future__ import annotations

from typing import Any, ClassVar, Optional

from pydantic import BaseModel

from app.firestore.base import VersionConflict


class FakeRepo:
    collection_name = "fake"
    WRITE_MODEL: ClassVar[type[BaseModel] | None] = None
    SCHEMA_TARGET_VERSION = 1

    def __init__(self, org_id: str):
        self.org_id = org_id
        self._store: dict[str, dict] = {}

    def create(self, data: dict) -> dict:
        doc_id = data.pop("id", "doc-1")
        row = {**data, "id": doc_id, "org_id": self.org_id, "_version": 1, "schema_version": 1}
        self._store[doc_id] = row
        return row

    def get(self, doc_id: str) -> Optional[dict]:
        row = self._store.get(doc_id)
        if not row or row.get("org_id") != self.org_id:
            return None
        return dict(row)

    def update(self, doc_id: str, data: dict) -> dict:
        row = self._store.get(doc_id) or {}
        row.update(data)
        row["_version"] = int(row.get("_version") or 1) + 1
        self._store[doc_id] = row
        return self.get(doc_id)

    def update_versioned(self, doc_id: str, data: dict, expected_version: int) -> dict:
        row = self._store.get(doc_id)
        if not row:
            raise LookupError(doc_id)
        current = int(row.get("_version") or 1)
        if current != int(expected_version):
            raise VersionConflict(current, doc_id=doc_id)
        row.update(data)
        row["_version"] = current + 1
        self._store[doc_id] = row
        return dict(row)

    def delete(self, doc_id: str, hard: bool = False) -> None:
        if hard:
            self._store.pop(doc_id, None)
        elif doc_id in self._store:
            self._store[doc_id]["deleted_at"] = "now"
