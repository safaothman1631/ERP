import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/fiscal", tags=["Fiscal"])


class FiscalYearRepository(BaseRepository):
    collection_name = "fiscal_years"


class FiscalYearIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    start_date: str = Field(min_length=10, max_length=10)  # YYYY-MM-DD
    end_date: str = Field(min_length=10, max_length=10)
    is_current: bool = False
    is_closed: bool = False


def _validate_year(payload: FiscalYearIn) -> None:
    try:
        s = datetime.fromisoformat(payload.start_date).date()
        e = datetime.fromisoformat(payload.end_date).date()
    except ValueError:
        raise HTTPException(400, "ڕێکەوت دروست نییە (YYYY-MM-DD)")
    if e <= s:
        raise HTTPException(400, "کۆتایی ساڵی دارایی دەبێت دوای دەستپێک بێت")


def _default_current(year: int) -> dict:
    return {
        "id": str(year),
        "name": str(year),
        "start_date": f"{year}-01-01",
        "end_date": f"{year}-12-31",
        "is_current": True,
        "is_closed": False,
    }


@router.get("/years")
def list_fiscal_years(user: dict = Depends(get_current_user)):
    repo = FiscalYearRepository(user["org_id"])
    items, _ = repo.list(limit=200)
    if not items:
        # Return a sensible default so existing UI/reports keep working
        return [_default_current(datetime.now().year)]
    items.sort(key=lambda x: x.get("start_date", ""), reverse=True)
    return items


@router.post("/years")
def create_fiscal_year(payload: FiscalYearIn, user: dict = Depends(get_current_user)):
    _validate_year(payload)
    repo = FiscalYearRepository(user["org_id"])
    new_id = str(uuid.uuid4())
    data = payload.model_dump()
    if data.get("is_current"):
        # Only one current year allowed — clear flag on others
        for existing in repo.list(limit=500)[0]:
            if existing.get("is_current"):
                repo.update(existing["id"], {"is_current": False})
    data["id"] = new_id
    repo.create(data)
    return repo.get(new_id)


@router.put("/years/{year_id}")
def update_fiscal_year(year_id: str, payload: FiscalYearIn, user: dict = Depends(get_current_user)):
    _validate_year(payload)
    repo = FiscalYearRepository(user["org_id"])
    existing = repo.get(year_id)
    if not existing:
        raise HTTPException(404, "ساڵی دارایی نەدۆزرایەوە")
    if existing.get("is_closed") and not payload.is_closed:
        raise HTTPException(400, "ساڵی داخراو ناتوانرێت بکرێتەوە")
    data = payload.model_dump()
    if data.get("is_current"):
        for other in repo.list(limit=500)[0]:
            if other["id"] != year_id and other.get("is_current"):
                repo.update(other["id"], {"is_current": False})
    repo.update(year_id, data)
    return repo.get(year_id)


@router.post("/years/{year_id}/close")
def close_fiscal_year(year_id: str, user: dict = Depends(get_current_user)):
    from app.services.period_close import PeriodCloseService
    from app.services.fiscal_close_atomic import finalize_fiscal_year_close_atomic
    from app.services.firestore_tx import TenantMismatchError

    repo = FiscalYearRepository(user["org_id"])
    existing = repo.get(year_id)
    if not existing:
        raise HTTPException(404, "ساڵی دارایی نەدۆزرایەوە")
    if existing.get("is_closed"):
        return existing

    end_raw = existing.get("end_date", f"{year_id}-12-31")
    start_raw = existing.get("start_date", f"{year_id}-01-01")
    try:
        fiscal_end = datetime.fromisoformat(end_raw[:10] + "T23:59:59")
        period_start = datetime.fromisoformat(start_raw[:10] + "T00:00:00")
    except ValueError:
        raise HTTPException(400, "ڕێکەوتەکانی ساڵی دارایی دروست نین")

    result = PeriodCloseService.post_year_end_close(
        org_id=user["org_id"],
        fiscal_year_end=fiscal_end,
        period_start=period_start,
        created_by=user.get("id"),
    )
    try:
        out = finalize_fiscal_year_close_atomic(
            user["org_id"],
            year_id,
            lock_date=end_raw[:10],
            closing_journal_id=result.get("journal_id"),
            closed_by=user.get("id"),
        )
    except TenantMismatchError:
        raise HTTPException(404, "ساڵی دارایی نەدۆزرایەوە")

    out["close_result"] = result
    return out


@router.post("/years/{year_id}/reopen")
def reopen_fiscal_year(year_id: str, user: dict = Depends(get_current_user)):
    repo = FiscalYearRepository(user["org_id"])
    existing = repo.get(year_id)
    if not existing:
        raise HTTPException(404, "ساڵی دارایی نەدۆزرایەوە")
    if not existing.get("is_closed"):
        return existing

    closing_je_id = existing.get("closing_journal_id")
    if closing_je_id:
        from app.services.accounting import AccountingService
        je_repo = __import__(
            "app.firestore.journals", fromlist=["JournalEntryRepository"]
        ).JournalEntryRepository(user["org_id"])
        original = je_repo.get(closing_je_id)
        if original and not original.get("reversed_by"):
            lines = je_repo.get_lines(closing_je_id)
            reversed_lines = [
                {
                    "account_id": ln["account_id"],
                    "debit": ln.get("credit", 0),
                    "credit": ln.get("debit", 0),
                    "description": f"Reopen FY — reverse {closing_je_id}",
                }
                for ln in lines
            ]
            rev = AccountingService.create_journal_entry(
                org_id=user["org_id"],
                date=datetime.utcnow(),
                lines=reversed_lines,
                description=f"Reopen fiscal year {existing.get('name', year_id)}",
                source_type="year_end_reopen",
                source_id=year_id,
                created_by=user.get("id"),
            )
            je_repo.update(closing_je_id, {"reversed_by": rev["id"]})

    repo.update(year_id, {
        "is_closed": False,
        "closed_at": None,
        "closing_journal_id": None,
    })

    db = __import__("app.firebase_client", fromlist=["get_db"]).get_db()
    db.collection("transaction_locks").document(user["org_id"]).delete()

    return repo.get(year_id)


@router.get("/lock-status")
def fiscal_lock_status(
    date: str,
    user: dict = Depends(get_current_user),
):
    from app.services.period_close import PeriodCloseService

    try:
        on_date = datetime.fromisoformat(date[:10] + "T12:00:00")
    except ValueError:
        raise HTTPException(400, "ڕێکەوت دروست نییە (YYYY-MM-DD)")
    return PeriodCloseService.get_lock_status(user["org_id"], on_date)


@router.delete("/years/{year_id}")
def delete_fiscal_year(year_id: str, user: dict = Depends(get_current_user)):
    repo = FiscalYearRepository(user["org_id"])
    existing = repo.get(year_id)
    if not existing:
        raise HTTPException(404, "ساڵی دارایی نەدۆزرایەوە")
    if existing.get("is_closed"):
        raise HTTPException(400, "ساڵی داخراو ناتوانرێت بسڕدرێتەوە")
    repo.delete(year_id)
    return {"deleted": year_id}


# ===== BUDGETS =====
class BudgetRepository(BaseRepository):
    collection_name = "budgets"


class BudgetIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    fiscal_year_id: Optional[str] = None
    period: Optional[str] = Field(default="monthly", max_length=20)
    start_date: str = Field(min_length=10, max_length=10)
    end_date: str = Field(min_length=10, max_length=10)
    account_id: Optional[str] = None
    amount: float = Field(default=0, ge=0)
    notes: Optional[str] = Field(default=None, max_length=2000)


@router.get("/budgets")
def list_budgets(user: dict = Depends(get_current_user)):
    repo = BudgetRepository(user["org_id"])
    items, total = repo.list(order_by="start_date", order_dir="DESCENDING", limit=500)
    return {"items": items, "total": total}


@router.post("/budgets", status_code=201)
def create_budget(payload: BudgetIn, user: dict = Depends(get_current_user)):
    try:
        s = datetime.fromisoformat(payload.start_date).date()
        e = datetime.fromisoformat(payload.end_date).date()
    except ValueError:
        raise HTTPException(400, "ڕێکەوت دروست نییە (YYYY-MM-DD)")
    if e <= s:
        raise HTTPException(400, "کۆتایی بودجە دەبێت دوای دەستپێک بێت")
    repo = BudgetRepository(user["org_id"])
    new_id = str(uuid.uuid4())
    data = payload.model_dump()
    data["id"] = new_id
    data["created_by_id"] = user["id"]
    repo.create(data)
    return repo.get(new_id)


@router.get("/budgets/{budget_id}")
def get_budget(budget_id: str, user: dict = Depends(get_current_user)):
    repo = BudgetRepository(user["org_id"])
    item = repo.get(budget_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "بودجە نەدۆزرایەوە")
    return item


@router.put("/budgets/{budget_id}")
def update_budget(budget_id: str, payload: BudgetIn, user: dict = Depends(get_current_user)):
    repo = BudgetRepository(user["org_id"])
    item = repo.get(budget_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "بودجە نەدۆزرایەوە")
    repo.update(budget_id, payload.model_dump())
    return repo.get(budget_id)


@router.delete("/budgets/{budget_id}")
def delete_budget(budget_id: str, user: dict = Depends(get_current_user)):
    repo = BudgetRepository(user["org_id"])
    item = repo.get(budget_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "بودجە نەدۆزرایەوە")
    repo.delete(budget_id)
    return {"deleted": budget_id}

