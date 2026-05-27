import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.firestore.budgets import BudgetRepository, BudgetLineRepository
from app.firestore.journals import JournalEntryRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/budgets", tags=["Budgets"])


# ===== SCHEMAS =====
class BudgetCreate(BaseModel):
    name: str = Field(max_length=200)
    fiscal_year: int
    status: str = Field(default="draft", max_length=20)


class BudgetLineCreate(BaseModel):
    budget_id: str
    account_id: str
    period_year: int
    period_month: int
    amount: float
    notes: Optional[str] = None


# ===== BUDGETS =====
@router.get("")
def list_budgets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    repo = BudgetRepository(user["org_id"])
    items, total = repo.list(
        order_by="fiscal_year",
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


@router.post("", status_code=201, dependencies=[Depends(require_perm("accounts.create"))])
def create_budget(
    data: BudgetCreate,
    user: dict = Depends(get_current_user),
):
    repo = BudgetRepository(user["org_id"])
    budget = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "created_at": datetime.utcnow(),
        **data.model_dump(),
    })
    return budget


@router.get("/{budget_id}")
def get_budget(budget_id: str, user: dict = Depends(get_current_user)):
    repo = BudgetRepository(user["org_id"])
    budget = repo.get(budget_id)
    if not budget or budget.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="بودجە نەدۆزرایەوە")
    return budget


@router.put("/{budget_id}", dependencies=[Depends(require_perm("accounts.update"))])
def update_budget(
    budget_id: str,
    data: BudgetCreate,
    user: dict = Depends(get_current_user),
):
    repo = BudgetRepository(user["org_id"])
    budget = repo.get(budget_id)
    if not budget or budget.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="بودجە نەدۆزرایەوە")
    
    updated = repo.update(budget_id, data.model_dump())
    return updated


@router.delete("/{budget_id}", dependencies=[Depends(require_perm("accounts.delete"))])
def delete_budget(budget_id: str, user: dict = Depends(get_current_user)):
    repo = BudgetRepository(user["org_id"])
    budget = repo.get(budget_id)
    if not budget or budget.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="بودجە نەدۆزرایەوە")
    
    repo.delete(budget_id)
    return {"success": True}


# ===== BUDGET LINES =====
@router.get("/{budget_id}/lines")
def list_budget_lines(
    budget_id: str,
    user: dict = Depends(get_current_user),
):
    line_repo = BudgetLineRepository(user["org_id"])
    lines = line_repo.get_by_budget(budget_id)
    return lines


@router.post("/{budget_id}/lines", status_code=201, dependencies=[Depends(require_perm("accounts.create"))])
def create_budget_line(
    budget_id: str,
    data: BudgetLineCreate,
    user: dict = Depends(get_current_user),
):
    # Verify budget exists
    budget_repo = BudgetRepository(user["org_id"])
    budget = budget_repo.get(budget_id)
    if not budget or budget.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="بودجە نەدۆزرایەوە")
    
    line_repo = BudgetLineRepository(user["org_id"])
    line = line_repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "created_at": datetime.utcnow(),
        **data.model_dump(),
    })
    return line


@router.delete("/{budget_id}/lines/{line_id}", dependencies=[Depends(require_perm("accounts.delete"))])
def delete_budget_line(
    budget_id: str,
    line_id: str,
    user: dict = Depends(get_current_user),
):
    line_repo = BudgetLineRepository(user["org_id"])
    line = line_repo.get(line_id)
    if not line or line.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هێڵی بودجە نەدۆزرایەوە")
    
    line_repo.delete(line_id)
    return {"success": True}


@router.get("/{budget_id}/variance")
def get_budget_variance(
    budget_id: str,
    user: dict = Depends(get_current_user),
):
    """Compare budget vs actual from journal entries"""
    budget_repo = BudgetRepository(user["org_id"])
    budget = budget_repo.get(budget_id)
    if not budget or budget.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="بودجە نەدۆزرایەوە")
    
    line_repo = BudgetLineRepository(user["org_id"])
    budget_lines = line_repo.get_by_budget(budget_id)
    
    # Get actual from journal entries
    journal_repo = JournalEntryRepository(user["org_id"])
    all_journals = collect_stream(journal_repo, max_docs=5000)
    
    # Build variance report
    variances = []
    for budget_line in budget_lines:
        account_id = budget_line["account_id"]
        period_year = budget_line["period_year"]
        period_month = budget_line["period_month"]
        budgeted = budget_line["amount"]
        
        # Calculate actual for this account/period from journal lines
        actual = 0.0
        for journal in all_journals:
            journal_date = journal.get("date", "")
            if not journal_date:
                continue
            
            try:
                if isinstance(journal_date, str):
                    dt = datetime.fromisoformat(journal_date.replace(" ", "T").rstrip("Z"))
                else:
                    dt = journal_date
                
                if dt.year == period_year and dt.month == period_month:
                    for line in journal.get("lines", []):
                        if line.get("account_id") == account_id:
                            actual += line.get("debit", 0) - line.get("credit", 0)
            except:
                continue
        
        variance = budgeted - actual
        variances.append({
            "account_id": account_id,
            "period_year": period_year,
            "period_month": period_month,
            "budgeted": budgeted,
            "actual": actual,
            "variance": variance,
            "variance_percent": (variance / budgeted * 100) if budgeted != 0 else 0,
        })
    
    return {
        "budget_id": budget_id,
        "budget_name": budget.get("name"),
        "variances": variances,
    }
