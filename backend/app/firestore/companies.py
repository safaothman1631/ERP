"""Multi-Company / Multi-Branch repositories.

Companies are subsidiaries scoped under a parent org_id. Each user can switch
their active company; downstream queries filter by `company_id` when present.
"""
from app.firestore.base import BaseRepository


class CompanyRepository(BaseRepository):
    """Repository for companies (subsidiaries) under an org."""
    collection_name = "companies"


class IntercompanyJournalRepository(BaseRepository):
    """Repository for inter-company journal entries."""
    collection_name = "intercompany_journals"
