"""Master Data Management (MDM) repository — golden records (Pool 3.6).

Persists merged "golden" master records produced by ``app.services.mdm_golden``.
Each golden record is scoped under the org and tagged with the source entity
("contacts" | "items") it was consolidated from.
"""
from app.firestore.base import BaseRepository


class GoldenRecordRepository(BaseRepository):
    """Repository for merged MDM golden master records."""
    collection_name = "mdm_golden_records"
