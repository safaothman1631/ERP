"""Currency Rates API Endpoints"""
import uuid
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.system import ExchangeRateRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/currency-rates", tags=["Currency Rates"])


class CurrencyRateCreate(BaseModel):
    """Request for creating a currency rate"""
    currency: str = Field(..., min_length=3, max_length=3, description="Currency code (e.g., USD)")
    rate: float = Field(..., gt=0, description="Exchange rate to base currency")
    effective_date: date = Field(..., description="Effective date")
    source: str = Field("manual", max_length=50, description="Source: manual, cbi, imported")
    notes: Optional[str] = Field("", max_length=500, description="Optional notes")


@router.get("")
def list_currency_rates(
    currency: Optional[str] = Query(None, max_length=3, description="Filter by currency"),
    from_date: Optional[str] = Query(None, description="From date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="To date (YYYY-MM-DD)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    """List currency exchange rates with optional filters"""
    repo = ExchangeRateRepository("system")
    
    filters = []
    
    if currency:
        filters.append({"field": "currency", "op": "==", "value": currency.upper()})
    
    if from_date:
        try:
            from_dt = datetime.strptime(from_date, "%Y-%m-%d").date()
            filters.append({"field": "effective_date", "op": ">=", "value": from_dt.isoformat()})
        except ValueError:
            raise HTTPException(status_code=400, detail="فۆرماتی from_date هەڵەیە")
    
    if to_date:
        try:
            to_dt = datetime.strptime(to_date, "%Y-%m-%d").date()
            filters.append({"field": "effective_date", "op": "<=", "value": to_dt.isoformat()})
        except ValueError:
            raise HTTPException(status_code=400, detail="فۆرماتی to_date هەڵەیە")
    
    items, total = repo.list(
        filters=filters,
        order_by="effective_date",
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


@router.post("", status_code=201, dependencies=[Depends(require_perm("settings.update"))])
def create_currency_rate(
    data: CurrencyRateCreate,
    user: dict = Depends(get_current_user)
):
    """Create a new currency exchange rate"""
    repo = ExchangeRateRepository("system")
    
    # Check if rate already exists for this currency and date
    existing = repo.list(
        filters=[
            {"field": "currency", "op": "==", "value": data.currency.upper()},
            {"field": "effective_date", "op": "==", "value": data.effective_date.isoformat()},
        ],
        limit=1
    )[0]
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"نرخ لەم بەروارەدا پێشتر تۆمار کراوە بۆ {data.currency}"
        )
    
    rate_data = {
        "id": str(uuid.uuid4()),
        "currency": data.currency.upper(),
        "base_currency": "IQD",
        "rate": data.rate,
        "effective_date": data.effective_date.isoformat(),
        "source": data.source,
        "notes": data.notes,
        "created_by": user.get("id"),
        "created_at": datetime.utcnow(),
    }
    
    created = repo.create(rate_data)
    return created


@router.get("/latest")
def get_latest_rate(
    currency: str = Query(..., min_length=3, max_length=3, description="Currency code"),
    user: dict = Depends(get_current_user),
):
    """Get the latest exchange rate for a currency"""
    repo = ExchangeRateRepository("system")
    
    rates = repo.collection \
        .where("currency", "==", currency.upper()) \
        .order_by("effective_date", direction="DESCENDING") \
        .limit(1) \
        .stream()
    
    for doc in rates:
        return {"id": doc.id, **doc.to_dict()}
    
    raise HTTPException(
        status_code=404,
        detail=f"نرخ نەدۆزرایەوە بۆ {currency}"
    )


@router.get("/at")
def get_rate_at_date(
    currency: str = Query(..., min_length=3, max_length=3, description="Currency code"),
    date_param: str = Query(..., alias="date", description="Date (YYYY-MM-DD)"),
    user: dict = Depends(get_current_user),
):
    """Get exchange rate for a currency as of a specific date"""
    try:
        target_date = datetime.strptime(date_param, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="فۆرماتی بەروار هەڵەیە (YYYY-MM-DD)")
    
    from app.services.fx_service import FXService
    
    try:
        rate = FXService.get_rate("system", currency.upper(), target_date)
        return {
            "currency": currency.upper(),
            "date": target_date.isoformat(),
            "rate": float(rate),
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{rate_id}", dependencies=[Depends(require_perm("settings.update"))])
def delete_currency_rate(
    rate_id: str,
    user: dict = Depends(get_current_user)
):
    """Delete a currency rate"""
    repo = ExchangeRateRepository("system")
    
    rate = repo.get(rate_id)
    if not rate:
        raise HTTPException(status_code=404, detail="نرخ نەدۆزرایەوە")
    
    repo.delete(rate_id)
    return {"message": "نرخ بەسەرکەوتوویی سڕایەوە"}
