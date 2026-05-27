import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.accounts import AccountRepository
from app.firestore.journals import JournalEntryRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services.accounting import AccountingService
from app.schemas.schemas import AccountCreate, AccountResponse, JournalEntryCreate, JournalEntryResponse

router = APIRouter(prefix="/api/accounts", tags=["Chart of Accounts"])


@router.get("")
def list_accounts(
    account_type: str = Query("", max_length=30),
    user: dict = Depends(get_current_user),
):
    repo = AccountRepository(user["org_id"])
    
    filters = [{"field": "is_active", "op": "!=", "value": False}]
    if account_type:
        filters.append({"field": "account_type", "op": "==", "value": account_type})

    items, _ = repo.list(filters=filters, order_by="code", order_dir="ASCENDING", limit=500)
    return items


@router.post("", status_code=201, dependencies=[Depends(require_perm("accounts.create"))])
def create_account(
    data: AccountCreate,
    user: dict = Depends(get_current_user),
):
    repo = AccountRepository(user["org_id"])
    account = repo.create({
        "id": str(uuid.uuid4()),
        "is_system": False,
        **data.model_dump(),
    })
    return account


@router.get("/{account_id}")
def get_account(account_id: str, user: dict = Depends(get_current_user)):
    repo = AccountRepository(user["org_id"])
    account = repo.get(account_id)
    if not account or account.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هەژمار نەدۆزرایەوە")
    return account


# ===== JOURNAL ENTRIES =====
journal_router = APIRouter(prefix="/api/journals", tags=["Journals"])


@journal_router.get("")
def list_journals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    repo = JournalEntryRepository(user["org_id"])
    items, total = repo.list(
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


@journal_router.post("", status_code=201, dependencies=[Depends(require_perm("journals.create"))])
def create_manual_journal(
    data: JournalEntryCreate,
    user: dict = Depends(get_current_user),
):
    lines = [
        {
            "account_id": line.account_id,
            "debit": line.debit,
            "credit": line.credit,
            "description": line.description,
            "contact_id": line.contact_id,
        }
        for line in data.lines
    ]

    journal_date = data.date
    if isinstance(journal_date, str):
        journal_date = datetime.fromisoformat(journal_date.replace("Z", "+00:00")[:19])

    return AccountingService.create_journal_entry(
        org_id=user["org_id"],
        date=journal_date,
        lines=lines,
        description=data.notes or data.reference or "Manual journal entry",
        reference=data.reference or "",
        source_type="manual",
        created_by=user.get("id"),
    )


class ReverseJournalBody(BaseModel):
    reversal_date: str = Field(..., description="YYYY-MM-DD")
    description: str | None = Field(default=None, max_length=500)


@journal_router.post("/{journal_id}/reverse", status_code=201, dependencies=[Depends(require_perm("journals.create"))])
def reverse_journal(
    journal_id: str,
    body: ReverseJournalBody,
    user: dict = Depends(get_current_user),
):
    try:
        rev_date = datetime.fromisoformat(body.reversal_date[:10] + "T12:00:00")
    except ValueError:
        raise HTTPException(status_code=400, detail="ڕێکەوتی گەڕاندنەوە نادروستە")

    return AccountingService.reverse_journal_entry(
        org_id=user["org_id"],
        je_id=journal_id,
        reversal_date=rev_date,
        user_id=user.get("id"),
        description=body.description,
    )


# ===== SUB-ACCOUNTS =====
@router.get("/{account_id}/sub-accounts")
def list_sub_accounts(account_id: str, user: dict = Depends(get_current_user)):
    """List all sub-accounts of a parent account"""
    repo = AccountRepository(user["org_id"])
    account = repo.get(account_id)
    if not account or account.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هەژمار نەدۆزرایەوە")
    
    filters = [
        {"field": "parent_id", "op": "==", "value": account_id},
        {"field": "is_active", "op": "!=", "value": False},
    ]
    items, _ = repo.list(filters=filters, order_by="code", order_dir="ASCENDING", limit=500)
    return items


@router.post("/{account_id}/sub-accounts", status_code=201, dependencies=[Depends(require_perm("accounts.create"))])
def create_sub_account(account_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Create a sub-account under a parent account"""
    repo = AccountRepository(user["org_id"])
    parent = repo.get(account_id)
    if not parent or parent.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هەژماری سەرەکی نەدۆزرایەوە")
    
    sub_account = repo.create({
        "id": str(uuid.uuid4()),
        "parent_id": account_id,
        "name": data["name"],
        "name_ku": data.get("name_ku", ""),
        "code": data.get("code", ""),
        "account_type": parent["account_type"],  # Inherit from parent
        "description": data.get("description", ""),
        "is_system": False,
    })
    return sub_account


# ===== CURRENCY ADJUSTMENTS =====
@router.post("/currency-adjustment", status_code=201, dependencies=[Depends(require_perm("journals.create"))])
def record_currency_adjustment(data: dict, user: dict = Depends(get_current_user)):
    """Record a base currency adjustment for exchange rate changes"""
    from app.firestore.journals import JournalEntryRepository
    from datetime import datetime
    
    journal_repo = JournalEntryRepository(user["org_id"])
    
    # Create journal entry for the adjustment
    adjustment_amount = float(data.get("adjustment_amount", 0))
    gains_losses_account_id = data.get("gains_losses_account_id")
    
    if not gains_losses_account_id:
        raise HTTPException(status_code=400, detail="هەژماری قازانج/زەرەر پێویستە")
    
    lines = []
    if adjustment_amount > 0:
        # Gain
        lines.append({
            "account_id": data.get("base_currency_account_id"),
            "debit": adjustment_amount,
            "credit": 0,
            "description": data.get("notes", "ڕێکخستنی دراو"),
        })
        lines.append({
            "account_id": gains_losses_account_id,
            "debit": 0,
            "credit": adjustment_amount,
            "description": data.get("notes", "قازانجی نرخی دراو"),
        })
    else:
        # Loss
        lines.append({
            "account_id": gains_losses_account_id,
            "debit": abs(adjustment_amount),
            "credit": 0,
            "description": data.get("notes", "زەرەری نرخی دراو"),
        })
        lines.append({
            "account_id": data.get("base_currency_account_id"),
            "debit": 0,
            "credit": abs(adjustment_amount),
            "description": data.get("notes", "ڕێکخستنی دراو"),
        })
    
    journal = journal_repo.create({
        "id": str(uuid.uuid4()),
        "date": data.get("adjustment_date", datetime.utcnow()),
        "reference": f"CURR-ADJ-{datetime.utcnow().strftime('%Y%m%d')}",
        "notes": data.get("notes", ""),
        "entry_type": "currency_adjustment",
        "status": "posted",
        "exchange_rate": data.get("exchange_rate"),
    })
    
    journal_repo.set_lines(journal["id"], lines)
    return journal
