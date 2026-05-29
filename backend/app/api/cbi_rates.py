"""CBI exchange-rate API endpoints (growth-to-100 § R4.15).

* ``GET /api/cbi-rates/latest`` — most recent persisted rate (with fallback walk)
* ``GET /api/cbi-rates``         — historical range
* ``GET /api/cbi-rates/convert`` — convenience converter for the UI
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.services.auth import get_current_user
from app.services import cbi_rates as cbi_service
from app.services.currency_converter import convert, UnsupportedConversion


router = APIRouter(prefix="/api/cbi-rates", tags=["CBI Rates"])


@router.get("/latest")
def latest_rate(user: dict = Depends(get_current_user)):
    """Return today's CBI rate with fallback to the most recent stored date.

    Always returns a record — the ``source`` field indicates whether the
    rate is fresh (``cbi``) or a stale fallback (``fallback`` /
    ``hardcoded_fallback``).
    """
    doc = cbi_service.get_latest_rate_with_fallback()
    return doc


@router.get("")
def list_rates(
    from_date: str = Query(..., alias="from", description="ISO yyyy-mm-dd"),
    to_date: str = Query(..., alias="to", description="ISO yyyy-mm-dd"),
    user: dict = Depends(get_current_user),
):
    """Return all stored CBI rate docs within an inclusive date range."""
    try:
        d_from = datetime.strptime(from_date, "%Y-%m-%d").date()
        d_to = datetime.strptime(to_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="فۆرماتی بەروار هەڵەیە (YYYY-MM-DD)")
    if d_from > d_to:
        raise HTTPException(status_code=400, detail="from > to")
    if (d_to - d_from).days > 366:
        raise HTTPException(status_code=400, detail="range > 366 days")

    rows: list[dict] = []
    current = d_from
    while current <= d_to:
        doc = cbi_service.get_rate(current)
        if doc:
            rows.append(doc)
        current += timedelta(days=1)
    return {"from": d_from.isoformat(), "to": d_to.isoformat(), "rates": rows}


@router.get("/convert")
def convert_endpoint(
    amount: float = Query(..., ge=0),
    from_currency: str = Query(..., alias="from", min_length=3, max_length=3),
    to_currency: str = Query(..., alias="to", min_length=3, max_length=3),
    on_date: Optional[str] = Query(None, alias="date"),
    user: dict = Depends(get_current_user),
):
    """Convert amount using the persisted CBI rate (or fallback)."""
    target_date: Optional[date] = None
    if on_date:
        try:
            target_date = datetime.strptime(on_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="فۆرماتی بەروار هەڵەیە")
    try:
        result = convert(amount, from_currency, to_currency, target_date)
    except UnsupportedConversion as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "amount": result.amount,
        "converted": result.converted,
        "rate": result.rate,
        "from": result.from_currency,
        "to": result.to_currency,
        "rate_date": result.rate_date,
        "source": result.source,
        "fallback_age_days": result.fallback_age_days,
    }


ALL_ROUTERS = [router]
