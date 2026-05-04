"""Numbering sequences API - per-branch document numbering"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.firestore.numbering import NumberingSequenceRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/numbering", tags=["Numbering"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class NumberingSequenceCreate(BaseModel):
    branch_id: str
    doc_type: str  # 'invoice' | 'sales_order' | 'purchase_order' | 'credit_note' | 'bill' | 'receipt'
    prefix: str
    padding: int = 6
    format: str = "{prefix}-{branch_code}-{year}-{seq}"
    next_value: int = 1


class NumberingSequenceUpdate(BaseModel):
    prefix: Optional[str] = None
    padding: Optional[int] = None
    format: Optional[str] = None
    next_value: Optional[int] = None


class GetNextRequest(BaseModel):
    branch_id: str
    doc_type: str


@router.get("/sequences")
def list_numbering_sequences(
    branch_id: Optional[str] = Query(None),
    doc_type: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """List numbering sequences with optional filters"""
    repo = NumberingSequenceRepository(user["org_id"])
    
    filters = []
    if branch_id:
        filters.append({"field": "branch_id", "op": "==", "value": branch_id})
    if doc_type:
        filters.append({"field": "doc_type", "op": "==", "value": doc_type})
    
    items, total = repo.list(filters=filters, order_by="created_at", limit=200)
    return {"items": items, "total": total}


@router.post("/sequences", status_code=201)
def create_numbering_sequence(
    data: NumberingSequenceCreate,
    user: dict = Depends(get_current_user)
):
    """Create a new numbering sequence"""
    repo = NumberingSequenceRepository(user["org_id"])
    
    # Check if sequence already exists for this branch+doc_type
    existing = repo.get_by_branch_and_type(data.branch_id, data.doc_type)
    if existing:
        raise HTTPException(400, f"Sequence already exists for branch {data.branch_id} and doc_type {data.doc_type}")
    
    # Validate branch exists
    from app.firestore.system import BranchRepository
    branch_repo = BranchRepository(user["org_id"])
    if not branch_repo.get(data.branch_id):
        raise HTTPException(404, "Branch not found")
    
    seq = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "branch_id": data.branch_id,
        "doc_type": data.doc_type,
        "prefix": data.prefix,
        "padding": data.padding,
        "format": data.format,
        "next_value": data.next_value,
        "created_at": _now_iso(),
    })
    
    return seq


@router.get("/sequences/{seq_id}")
def get_numbering_sequence(
    seq_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Get a specific numbering sequence"""
    repo = NumberingSequenceRepository(user["org_id"])
    seq = repo.get(seq_id)
    if not seq:
        raise HTTPException(404, "Sequence not found")
    return seq


@router.put("/sequences/{seq_id}")
def update_numbering_sequence(
    data: NumberingSequenceUpdate,
    seq_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Update a numbering sequence"""
    repo = NumberingSequenceRepository(user["org_id"])
    seq = repo.get(seq_id)
    if not seq:
        raise HTTPException(404, "Sequence not found")
    
    update_data = {}
    if data.prefix is not None:
        update_data["prefix"] = data.prefix
    if data.padding is not None:
        update_data["padding"] = data.padding
    if data.format is not None:
        update_data["format"] = data.format
    if data.next_value is not None:
        update_data["next_value"] = data.next_value
    
    if update_data:
        update_data["updated_at"] = _now_iso()
        repo.update(seq_id, update_data)
    
    return repo.get(seq_id)


@router.delete("/sequences/{seq_id}")
def delete_numbering_sequence(
    seq_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Delete a numbering sequence"""
    repo = NumberingSequenceRepository(user["org_id"])
    if not repo.get(seq_id):
        raise HTTPException(404, "Sequence not found")
    
    repo.delete(seq_id)
    return {"success": True}


@router.post("/sequences/next")
def get_next_number(
    data: GetNextRequest,
    user: dict = Depends(get_current_user)
):
    """Generate next document number for branch + doc_type"""
    repo = NumberingSequenceRepository(user["org_id"])
    
    try:
        number = repo.get_next_number(data.branch_id, data.doc_type)
        return {"number": number}
    except Exception as e:
        raise HTTPException(500, f"Failed to generate number: {str(e)}")


class PreviewRequest(BaseModel):
    branch_id: Optional[str] = None
    doc_type: str


@router.post("/preview")
def preview_next_number(
    data: PreviewRequest,
    user: dict = Depends(get_current_user)
):
    """Preview what the next document number will be WITHOUT incrementing.
    
    Use this to show users what number will be assigned before they save.
    """
    from app.services.numbering_service import preview_next_number as preview_svc
    
    # Map doc_type to fallback prefix
    prefix_map = {
        "invoice": "INV",
        "sales_order": "SO",
        "purchase_order": "PO",
        "credit_note": "CN",
        "bill": "BILL",
        "vendor_credit": "VC",
        "payment_received": "RCP",
    }
    fallback_prefix = prefix_map.get(data.doc_type, "DOC")
    
    result = preview_svc(user["org_id"], data.branch_id, data.doc_type, fallback_prefix)
    return result
