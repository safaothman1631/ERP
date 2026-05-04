"""Currency Revaluation API Endpoints"""
import uuid
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.revaluations import RevaluationRunRepository
from app.firestore.journals import JournalEntryRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services.fx_service import FXService

router = APIRouter(prefix="/api/revaluations", tags=["FX Revaluations"])


class RevaluationPreviewRequest(BaseModel):
    """Request for previewing revaluation"""
    period_end: date = Field(..., description="Period end date")


class RevaluationRunRequest(BaseModel):
    """Request for running revaluation"""
    period_end: date = Field(..., description="Period end date")
    gain_account_id: str = Field(..., min_length=1, max_length=100, description="Gain account ID")
    loss_account_id: str = Field(..., min_length=1, max_length=100, description="Loss account ID")
    notes: Optional[str] = Field("", max_length=1000, description="Optional notes")


@router.get("")
def list_revaluations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    """List all revaluation runs"""
    repo = RevaluationRunRepository(user["org_id"])
    
    items, total = repo.list(
        filters=[],
        order_by="created_at",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("/preview", dependencies=[Depends(require_perm("journals.create"))])
def preview_revaluation(
    data: RevaluationPreviewRequest,
    user: dict = Depends(get_current_user)
):
    """
    Preview currency revaluation without posting journal entry.
    
    Returns calculated gains/losses for review.
    """
    result = FXService.run_period_revaluation(
        org_id=user["org_id"],
        period_end=data.period_end,
        post_journal=False,
        created_by=user.get("id"),
    )
    
    return result


@router.post("/run", status_code=201, dependencies=[Depends(require_perm("journals.create"))])
def run_revaluation(
    data: RevaluationRunRequest,
    user: dict = Depends(get_current_user)
):
    """
    Run currency revaluation and post journal entry.
    
    Creates a journal entry to record unrealized FX gains/losses.
    """
    result = FXService.run_period_revaluation(
        org_id=user["org_id"],
        period_end=data.period_end,
        gain_account_id=data.gain_account_id,
        loss_account_id=data.loss_account_id,
        post_journal=True,
        created_by=user.get("id"),
        notes=data.notes,
    )
    
    return result


@router.get("/{revaluation_id}")
def get_revaluation(
    revaluation_id: str,
    user: dict = Depends(get_current_user)
):
    """Get detailed information about a specific revaluation run"""
    repo = RevaluationRunRepository(user["org_id"])
    
    run = repo.get_with_details(revaluation_id)
    if not run:
        raise HTTPException(status_code=404, detail="ڕێکخستن نەدۆزرایەوە")
    
    return run


@router.post("/{revaluation_id}/reverse", status_code=201, dependencies=[Depends(require_perm("journals.create"))])
def reverse_revaluation(
    revaluation_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Create a reversing journal entry for a revaluation.
    
    This is typically done at the start of the next period.
    """
    from app.services.accounting import AccountingService
    
    repo = RevaluationRunRepository(user["org_id"])
    run = repo.get_with_details(revaluation_id)
    
    if not run:
        raise HTTPException(status_code=404, detail="ڕێکخستن نەدۆزرایەوە")
    
    if run.get("status") != "posted":
        raise HTTPException(
            status_code=400,
            detail="تەنها ڕێکخستنە تۆمارکراوەکان دەتوانرێت پێچەوانە بکرێنەوە"
        )
    
    journal_entry_id = run.get("journal_entry_id")
    if not journal_entry_id:
        raise HTTPException(status_code=400, detail="ژورناڵی سەرەکی نەدۆزرایەوە")
    
    # Get original journal entry
    je_repo = JournalEntryRepository(user["org_id"])
    original_je = je_repo.get_with_lines(journal_entry_id)
    
    if not original_je:
        raise HTTPException(status_code=404, detail="ژورناڵی سەرەکی نەدۆزرایەوە")
    
    # Create reversing lines (swap debit and credit)
    reversing_lines = []
    for line in original_je.get("lines", []):
        reversing_lines.append({
            "account_id": line["account_id"],
            "debit": line.get("credit", 0),  # Swap
            "credit": line.get("debit", 0),   # Swap
            "description": f"پێچەوانەی: {line.get('description', '')}",
        })
    
    # Post reversing entry
    period_end = run.get("period_end", "")
    reversing_je = AccountingService.create_journal_entry(
        org_id=user["org_id"],
        date=datetime.utcnow(),
        lines=reversing_lines,
        description=f"پێچەوانەکردنەوەی ڕێکخستنی {period_end}",
        reference=f"FX-REVAL-REV-{datetime.utcnow().strftime('%Y%m%d')}",
        source_type="fx_revaluation_reversal",
        source_id=revaluation_id,
        created_by=user.get("id"),
    )
    
    # Update run status
    repo.update(revaluation_id, {
        "reversed": True,
        "reversal_journal_id": reversing_je["id"],
        "reversed_at": datetime.utcnow(),
        "reversed_by": user.get("id"),
    })
    
    return {
        "message": "ڕێکخستن بەسەرکەوتوویی پێچەوانە کرایەوە",
        "reversing_journal_id": reversing_je["id"],
    }


@router.get("/exposure/current")
def get_fx_exposure(
    as_of: Optional[str] = Query(None, description="Date (YYYY-MM-DD)"),
    user: dict = Depends(get_current_user)
):
    """
    Get current foreign exchange exposure by currency.
    
    Shows unrealized gains/losses without posting journal entries.
    """
    # Parse date
    if as_of:
        try:
            as_of_date = datetime.strptime(as_of, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="فۆرماتی بەروار هەڵەیە (YYYY-MM-DD)")
    else:
        as_of_date = date.today()
    
    # Get foreign currency accounts and calculate exposure
    foreign_accounts = FXService._get_foreign_currency_accounts(user["org_id"])
    
    exposure_by_currency = {}
    
    for account in foreign_accounts:
        try:
            result = FXService.revalue_account(user["org_id"], account["id"], as_of_date)
            
            currency = result["currency"]
            if currency not in exposure_by_currency:
                exposure_by_currency[currency] = {
                    "currency": currency,
                    "foreign_balance": 0,
                    "book_value": 0,
                    "current_value": 0,
                    "unrealized_gain_loss": 0,
                    "accounts": [],
                }
            
            exposure_by_currency[currency]["foreign_balance"] += result["foreign_balance"]
            exposure_by_currency[currency]["book_value"] += result["book_local"]
            exposure_by_currency[currency]["current_value"] += result["revalued_local"]
            exposure_by_currency[currency]["unrealized_gain_loss"] += result["gain_loss"]
            exposure_by_currency[currency]["accounts"].append({
                "account_id": result["account_id"],
                "account_name": result["account_name"],
                "balance": result["foreign_balance"],
                "gain_loss": result["gain_loss"],
            })
        except Exception as e:
            print(f"Error calculating exposure for account {account['id']}: {e}")
            continue
    
    return {
        "as_of_date": as_of_date.isoformat(),
        "currencies": list(exposure_by_currency.values()),
        "total_unrealized": sum(c["unrealized_gain_loss"] for c in exposure_by_currency.values()),
    }
