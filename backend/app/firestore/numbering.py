"""Numbering sequence repository for per-branch document numbering"""
from .base import BaseRepository
from google.cloud import firestore as fs


class NumberingSequenceRepository(BaseRepository):
    """Repository for numbering sequences (per-branch document numbering)"""
    collection_name = "numbering_sequences"

    def get_by_branch_and_type(self, branch_id: str, doc_type: str):
        """Get numbering sequence for specific branch and document type"""
        items, _ = self.list(
            filters=[
                {"field": "branch_id", "op": "==", "value": branch_id},
                {"field": "doc_type", "op": "==", "value": doc_type}
            ],
            limit=1
        )
        return items[0] if items else None

    def get_next_number(self, branch_id: str, doc_type: str) -> str:
        """
        Atomically get next number for branch + doc_type.
        Returns formatted document number like "INV-BR1-2026-000123"
        """
        # Find or create sequence
        seq = self.get_by_branch_and_type(branch_id, doc_type)
        
        if not seq:
            # Create default sequence
            import uuid
            from datetime import datetime, timezone
            seq_id = str(uuid.uuid4())
            seq = {
                "id": seq_id,
                "org_id": self.org_id,
                "branch_id": branch_id,
                "doc_type": doc_type,
                "prefix": doc_type.upper()[:3],
                "padding": 6,
                "next_value": 1,
                "format": "{prefix}-{branch_code}-{year}-{seq}",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self.create(seq)
            seq_id_to_use = seq_id
        else:
            seq_id_to_use = seq["id"]
        
        # Atomic increment using transaction
        doc_ref = self.db.collection(self.collection_name).document(seq_id_to_use)
        
        @fs.transactional
        def _increment(transaction):
            snapshot = doc_ref.get(transaction=transaction)
            if not snapshot.exists:
                return None
            
            data = snapshot.to_dict()
            current_value = int(data.get("next_value", 1))
            prefix = data.get("prefix", "DOC")
            padding = int(data.get("padding", 6))
            format_template = data.get("format", "{prefix}-{seq}")
            
            # Get branch code (if needed in format)
            branch_code = ""
            if "{branch_code}" in format_template:
                from app.firestore.system import BranchRepository
                branch_repo = BranchRepository(self.org_id)
                branch = branch_repo.get(data.get("branch_id"))
                branch_code = branch.get("code", "BR") if branch else "BR"
            
            # Format number
            from datetime import datetime
            year = datetime.now().year
            seq_str = str(current_value).zfill(padding)
            
            number = format_template.format(
                prefix=prefix,
                branch_code=branch_code,
                year=year,
                seq=seq_str
            )
            
            # Increment
            transaction.update(doc_ref, {"next_value": current_value + 1})
            
            return number
        
        return _increment(self.db.transaction())
