import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.firestore.analytic import AnalyticAccountRepository, AnalyticLineRepository
from app.firestore.journals import JournalEntryRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/analytic", tags=["Analytic Accounting"])


# ===== SCHEMAS =====
class AnalyticAccountCreate(BaseModel):
    code: str = Field(max_length=50)
    name: str = Field(max_length=200)
    parent_id: Optional[str] = None
    active: bool = True


class AnalyticLineCreate(BaseModel):
    account_id: str
    journal_entry_id: Optional[str] = None
    date: str
    amount: float
    description: Optional[str] = None
    ref_doc: Optional[str] = None


# ===== ANALYTIC ACCOUNTS =====
@router.get("/accounts")
def list_analytic_accounts(
    active_only: bool = Query(True),
    user: dict = Depends(get_current_user),
):
    repo = AnalyticAccountRepository(user["org_id"])
    filters = []
    if active_only:
        filters.append({"field": "active", "op": "!=", "value": False})
    
    items, _ = repo.list(filters=filters, order_by="code", order_dir="ASCENDING", limit=500)
    return items


@router.post("/accounts", status_code=201, dependencies=[Depends(require_perm("accounts.create"))])
def create_analytic_account(
    data: AnalyticAccountCreate,
    user: dict = Depends(get_current_user),
):
    repo = AnalyticAccountRepository(user["org_id"])
    account = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "created_at": datetime.utcnow(),
        **data.model_dump(),
    })
    return account


@router.get("/accounts/{account_id}")
def get_analytic_account(account_id: str, user: dict = Depends(get_current_user)):
    repo = AnalyticAccountRepository(user["org_id"])
    account = repo.get(account_id)
    if not account or account.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هەژماری تایبەت نەدۆزرایەوە")
    return account


@router.put("/accounts/{account_id}", dependencies=[Depends(require_perm("accounts.update"))])
def update_analytic_account(
    account_id: str,
    data: AnalyticAccountCreate,
    user: dict = Depends(get_current_user),
):
    repo = AnalyticAccountRepository(user["org_id"])
    account = repo.get(account_id)
    if not account or account.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هەژماری تایبەت نەدۆزرایەوە")
    
    updated = repo.update(account_id, data.model_dump())
    return updated


@router.delete("/accounts/{account_id}", dependencies=[Depends(require_perm("accounts.delete"))])
def delete_analytic_account(account_id: str, user: dict = Depends(get_current_user)):
    repo = AnalyticAccountRepository(user["org_id"])
    account = repo.get(account_id)
    if not account or account.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هەژماری تایبەت نەدۆزرایەوە")
    
    repo.delete(account_id)
    return {"success": True}


# ===== ANALYTIC LINES =====
@router.get("/lines")
def list_analytic_lines(
    account_id: Optional[str] = Query(None),
    journal_entry_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    repo = AnalyticLineRepository(user["org_id"])
    filters = []
    if account_id:
        filters.append({"field": "account_id", "op": "==", "value": account_id})
    if journal_entry_id:
        filters.append({"field": "journal_entry_id", "op": "==", "value": journal_entry_id})
    
    items, total = repo.list(
        filters=filters,
        order_by="date",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/lines", status_code=201, dependencies=[Depends(require_perm("journals.create"))])
def create_analytic_line(
    data: AnalyticLineCreate,
    user: dict = Depends(get_current_user),
):
    repo = AnalyticLineRepository(user["org_id"])
    line = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "created_at": datetime.utcnow(),
        **data.model_dump(),
    })
    return line


@router.get("/lines/{line_id}")
def get_analytic_line(line_id: str, user: dict = Depends(get_current_user)):
    repo = AnalyticLineRepository(user["org_id"])
    line = repo.get(line_id)
    if not line or line.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هێڵی تایبەت نەدۆزرایەوە")
    return line


@router.delete("/lines/{line_id}", dependencies=[Depends(require_perm("journals.delete"))])
def delete_analytic_line(line_id: str, user: dict = Depends(get_current_user)):
    repo = AnalyticLineRepository(user["org_id"])
    line = repo.get(line_id)
    if not line or line.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هێڵی تایبەت نەدۆزرایەوە")
    
    repo.delete(line_id)
    return {"success": True}


@router.get("/summary/{account_id}")
def get_analytic_summary(
    account_id: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """Get summary of analytic lines for an account in a period"""
    repo = AnalyticLineRepository(user["org_id"])
    summary = repo.get_summary(account_id, date_from, date_to)
    return summary


@router.post("/distribute/{journal_entry_id}", dependencies=[Depends(require_perm("journals.create"))])
def distribute_journal_entry(
    journal_entry_id: str,
    distributions: list[dict],
    user: dict = Depends(get_current_user),
):
    """Distribute a journal entry across multiple analytic accounts
    
    distributions = [
        {"account_id": "...", "amount": 1000.0, "description": "..."},
        ...
    ]
    """
    # Verify journal entry exists
    journal_repo = JournalEntryRepository(user["org_id"])
    journal = journal_repo.get(journal_entry_id)
    if not journal or journal.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تۆمارەکە نەدۆزرایەوە")
    
    line_repo = AnalyticLineRepository(user["org_id"])
    created_lines = []
    
    for dist in distributions:
        line = line_repo.create({
            "id": str(uuid.uuid4()),
            "org_id": user["org_id"],
            "account_id": dist["account_id"],
            "journal_entry_id": journal_entry_id,
            "date": journal.get("date"),
            "amount": dist["amount"],
            "description": dist.get("description", ""),
            "ref_doc": f"journal:{journal_entry_id}",
            "created_at": datetime.utcnow(),
        })
        created_lines.append(line)
    
    return {"success": True, "lines": created_lines}
