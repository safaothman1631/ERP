"""Withholding Tax API endpoints (growth-to-100 § R4.5).

Surfaces a preview calculator and a register report over the WHT engine in
``app.tax.withholding``. The report is intentionally minimal — it pulls
invoices for the date range and returns aggregate withheld amounts grouped
by WHT type and customer. The auditor export (R4.16) builds on top of this.
"""
from __future__ import annotations

from datetime import datetime, date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.tax.withholding import (
    DEFAULT_CALCULATOR,
    WHTCalculator,
    WithholdingType,
    placeholder_rate_count,
)


router = APIRouter(prefix="/api/tax/wht", tags=["Tax - Withholding"])


# ─────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────


class WHTCalculateRequest(BaseModel):
    """Preview the WHT for a single amount / type / customer combination."""

    amount: float = Field(..., ge=0)
    wht_type: Literal["services", "rent", "materials", "other"] = "services"
    customer_type: Literal["b2b", "b2c", "b2g"] = "b2b"
    override_rate_percent: Optional[float] = Field(None, ge=0, le=100)

    @field_validator("amount")
    @classmethod
    def _check_amount(cls, v: float) -> float:
        # Pydantic ge=0 already rejects negative; explicit NaN guard.
        if v != v:  # NaN
            raise ValueError("amount must be a finite number")
        return v


class WHTCalculateResponse(BaseModel):
    gross_amount: float
    wht_rate: float
    wht_withheld: float
    net_payable: float
    wht_type: str
    customer_type: str
    applied: bool
    reason: str
    reason_key: str
    placeholder_rate: bool
    rate_name_en: str
    rate_name_ku: str
    rate_name_ar: str


# ─────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────


@router.post("/calculate", response_model=WHTCalculateResponse)
def calculate_wht(
    payload: WHTCalculateRequest,
    user: dict = Depends(get_current_user),
):
    """Preview-only: returns the WHT breakdown without persisting anything.

    Use this from the invoice form to show the "Net payable after WHT" line
    as the user fills in service category and customer type.
    """
    result = DEFAULT_CALCULATOR.calculate(
        amount=payload.amount,
        wht_type=payload.wht_type,
        customer_type=payload.customer_type,
        override_rate_percent=payload.override_rate_percent,
    )
    return WHTCalculateResponse(**result.to_dict())


@router.get("/rates")
def list_wht_rates(user: dict = Depends(get_current_user)):
    """Return the configured Iraqi WHT rate table.

    ``placeholder=True`` rows are not yet signed off by an accountant — the
    frontend surfaces a yellow badge on every line that uses them.
    """
    return {
        "rates": DEFAULT_CALCULATOR.all_rates(),
        "placeholder_count": placeholder_rate_count(),
        "verification_ticket": "growth-to-100 R7.1",
    }


@router.get("/report", dependencies=[Depends(require_perm("taxes.read"))])
def wht_report(
    from_date: str = Query(..., alias="from", description="ISO yyyy-mm-dd"),
    to_date: str = Query(..., alias="to", description="ISO yyyy-mm-dd"),
    wht_type: Optional[Literal["services", "rent", "materials", "other"]] = None,
    user: dict = Depends(get_current_user),
):
    """Aggregate WHT amounts withheld over a date range.

    Reads from the ``invoices`` collection (which carries the per-invoice
    ``wht_withheld`` field once the WHT engine is wired into invoice save).
    Returns an empty register when no invoices match — the UI surfaces a
    "Nothing to report for this period" empty state.
    """
    try:
        d_from = datetime.strptime(from_date, "%Y-%m-%d").date()
        d_to = datetime.strptime(to_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="فۆرماتی بەروار هەڵەیە (YYYY-MM-DD)")

    if d_from > d_to:
        raise HTTPException(status_code=400, detail="from > to")

    # Lazy Firestore import keeps this endpoint testable without a live DB.
    try:
        from app.firestore.schema import InvoiceRepository  # type: ignore
    except Exception:  # pragma: no cover - schema repo always exists in prod
        InvoiceRepository = None  # type: ignore[assignment]

    rows: list[dict] = []
    if InvoiceRepository is not None and user.get("org_id"):
        repo = InvoiceRepository(user["org_id"])
        filters = [
            {"field": "issue_date", "op": ">=", "value": d_from.isoformat()},
            {"field": "issue_date", "op": "<=", "value": d_to.isoformat()},
        ]
        if wht_type:
            filters.append({"field": "wht_type", "op": "==", "value": wht_type})
        try:
            items, _ = repo.list(filters=filters, limit=1000)
        except Exception:
            items = []
        for inv in items or []:
            withheld = float(inv.get("wht_withheld") or 0)
            if withheld <= 0:
                continue
            rows.append({
                "invoice_id": inv.get("id"),
                "invoice_no": inv.get("invoice_no"),
                "issue_date": inv.get("issue_date"),
                "customer_id": inv.get("customer_id"),
                "customer_name": inv.get("customer_name"),
                "wht_type": inv.get("wht_type"),
                "gross_amount": float(inv.get("subtotal") or inv.get("grand_total") or 0),
                "wht_rate": float(inv.get("wht_rate") or 0),
                "wht_withheld": withheld,
                "net_payable": float(inv.get("net_payable") or 0),
                "currency": inv.get("currency") or "IQD",
            })

    total_withheld = sum(r["wht_withheld"] for r in rows)
    total_gross = sum(r["gross_amount"] for r in rows)

    by_type: dict[str, dict] = {}
    for r in rows:
        t = r.get("wht_type") or "other"
        bucket = by_type.setdefault(t, {"wht_type": t, "gross_amount": 0.0, "wht_withheld": 0.0, "count": 0})
        bucket["gross_amount"] += r["gross_amount"]
        bucket["wht_withheld"] += r["wht_withheld"]
        bucket["count"] += 1

    return {
        "from": d_from.isoformat(),
        "to": d_to.isoformat(),
        "rows": rows,
        "total_gross": round(total_gross, 2),
        "total_withheld": round(total_withheld, 2),
        "by_type": list(by_type.values()),
        "currency": "IQD",
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


ALL_ROUTERS = [router]
