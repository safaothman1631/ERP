# Repository for FX revaluations
import uuid
from datetime import datetime
from .base import BaseRepository


class RevaluationRunRepository(BaseRepository):
    """Repository for currency revaluation runs"""
    collection_name = "revaluation_runs"

    def get_with_details(self, doc_id: str) -> dict:
        """Get revaluation run with full details"""
        run = self.get(doc_id)
        if not run:
            return None
        # Lines are stored embedded in the document
        return run

    def create_run(self, header: dict) -> dict:
        """Create a revaluation run record"""
        doc_id = header.pop("id", None) or str(uuid.uuid4())
        header["org_id"] = self.org_id
        header.setdefault("is_active", True)
        now = datetime.utcnow()
        header["created_at"] = now
        header["updated_at"] = now
        
        self.collection.document(doc_id).set(header)
        return {"id": doc_id, **header}
    
    def get_by_period(self, period_end: str) -> list:
        """Get all revaluation runs for a specific period"""
        return self.list(
            filters=[{"field": "period_end", "op": "==", "value": period_end}],
            order_by="created_at",
            order_dir="DESCENDING",
        )[0]
