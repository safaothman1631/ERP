"""Repository for background job execution history (Wave L)."""
from __future__ import annotations
from typing import Optional
from app.firestore.base import BaseRepository


class JobRunRepository(BaseRepository):
    """Repository for job_runs collection - tracks scheduler execution history."""
    collection_name = "job_runs"

    def list_by_job(
        self,
        job_name: str,
        limit: int = 50,
        order_by: str = "started_at",
        order_dir: str = "DESCENDING"
    ) -> tuple[list[dict], int]:
        """List runs for a specific job."""
        filters = [{"field": "job_name", "op": "==", "value": job_name}]
        return self.list(filters=filters, limit=limit, order_by=order_by, order_dir=order_dir)

    def get_last_run(self, job_name: str) -> Optional[dict]:
        """Get the most recent run for a job."""
        items, _ = self.list_by_job(job_name, limit=1)
        return items[0] if items else None

    def create_run(
        self,
        job_name: str,
        org_id: Optional[str] = None,
        items_processed: int = 0,
        items_failed: int = 0,
        errors: list[dict] = None,
        started_at: str = None,
        finished_at: str = None,
        status: str = "success"
    ) -> dict:
        """Create a job run record."""
        from datetime import datetime
        import uuid

        if started_at is None:
            started_at = datetime.utcnow().isoformat()
        if finished_at is None:
            finished_at = datetime.utcnow().isoformat()

        # Calculate duration
        start_dt = datetime.fromisoformat(started_at)
        finish_dt = datetime.fromisoformat(finished_at)
        duration_ms = int((finish_dt - start_dt).total_seconds() * 1000)

        # Limit errors array to first 20
        if errors and len(errors) > 20:
            errors = errors[:20]

        doc = {
            "id": str(uuid.uuid4()),
            "job_name": job_name,
            "org_id": org_id,
            "status": status,
            "items_processed": items_processed,
            "items_failed": items_failed,
            "errors": errors or [],
            "started_at": started_at,
            "finished_at": finished_at,
            "duration_ms": duration_ms,
            "created_at": datetime.utcnow().isoformat(),
        }
        return self.create(doc)
