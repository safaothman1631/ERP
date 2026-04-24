# Journal entry repository
import uuid
from datetime import datetime
from .base import BaseRepository


class JournalEntryRepository(BaseRepository):
    """Repository for journal entries"""
    collection_name = "journal_entries"

    def get_with_lines(self, doc_id):
        """Get journal entry with line items"""
        je = self.get(doc_id)
        if je:
            je["lines"] = self.get_lines(doc_id)
        return je

    def create_with_lines(self, header: dict, lines: list) -> dict:
        """Atomically create a journal header and its line items in one batch.

        Guarantees: either both header and lines are persisted, or neither is.
        Returns the created header (with generated id).
        """
        doc_id = header.pop("id", None) or str(uuid.uuid4())
        header["org_id"] = self.org_id
        header.setdefault("is_active", True)
        now = datetime.utcnow()
        header["created_at"] = now
        header["updated_at"] = now

        batch = self.db.batch()
        header_ref = self.collection.document(doc_id)
        batch.set(header_ref, header)

        for i, line in enumerate(lines):
            line_id = line.pop("id", None) or str(uuid.uuid4())
            line["sort_order"] = i
            line_ref = header_ref.collection("lines").document(line_id)
            batch.set(line_ref, line)

        batch.commit()
        return {"id": doc_id, **header}
