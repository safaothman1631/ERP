from fastapi import APIRouter, Depends, Path
from datetime import datetime, timedelta
from typing import Optional
from app.firestore.invoices import InvoiceRepository
from app.firestore.bills import BillRepository
from app.firestore.banking import BankAccountRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/cashflow", tags=["Cashflow Forecast"])


def _parse_date(date_str: str | datetime) -> datetime:
    """Parse date string or datetime to datetime"""
    if isinstance(date_str, datetime):
        return date_str
    try:
        return datetime.fromisoformat(date_str.replace(" ", "T").rstrip("Z"))
    except:
        return datetime.utcnow()


@router.get("/forecast/{days}")
def get_cashflow_forecast(
    days: int = Path(..., ge=1, le=365),
    user: dict = Depends(get_current_user),
):
    """Get cashflow forecast for the next N days
    
    Returns:
    - starting_cash: current bank balances
    - projected_inflow: unpaid invoices due in period
    - projected_outflow: unpaid bills due in period
    - ending_cash: starting + inflow - outflow
    - daily_breakdown: day-by-day projection
    """
    org_id = user["org_id"]
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = today + timedelta(days=days)
    
    # Get starting cash from bank accounts
    bank_repo = BankAccountRepository(org_id)
    bank_accounts, _ = bank_repo.list(limit=100)
    starting_cash = sum(acc.get("balance", 0) for acc in bank_accounts)
    
    # Get unpaid invoices (inflow)
    invoice_repo = InvoiceRepository(org_id)
    all_invoices, _ = invoice_repo.list(limit=5000)
    unpaid_invoices = [
        inv for inv in all_invoices
        if inv.get("status") != "paid" and inv.get("status") != "void"
    ]
    
    # Get unpaid bills (outflow)
    bill_repo = BillRepository(org_id)
    all_bills, _ = bill_repo.list(limit=5000)
    unpaid_bills = [
        bill for bill in all_bills
        if bill.get("status") != "paid" and bill.get("status") != "void"
    ]
    
    # Build daily breakdown
    daily_breakdown = []
    current_balance = starting_cash
    
    for day_offset in range(days + 1):
        current_day = today + timedelta(days=day_offset)
        daily_inflow = 0.0
        daily_outflow = 0.0
        
        # Check invoices due on this day
        for inv in unpaid_invoices:
            due_date = inv.get("due_date")
            if due_date:
                try:
                    due = _parse_date(due_date)
                    if due.date() == current_day.date():
                        daily_inflow += inv.get("total", 0)
                except:
                    continue
        
        # Check bills due on this day
        for bill in unpaid_bills:
            due_date = bill.get("due_date")
            if due_date:
                try:
                    due = _parse_date(due_date)
                    if due.date() == current_day.date():
                        daily_outflow += bill.get("total", 0)
                except:
                    continue
        
        current_balance = current_balance + daily_inflow - daily_outflow
        
        daily_breakdown.append({
            "date": current_day.date().isoformat(),
            "inflow": daily_inflow,
            "outflow": daily_outflow,
            "balance": current_balance,
        })
    
    total_inflow = sum(d["inflow"] for d in daily_breakdown)
    total_outflow = sum(d["outflow"] for d in daily_breakdown)
    
    return {
        "starting_cash": starting_cash,
        "projected_inflow": total_inflow,
        "projected_outflow": total_outflow,
        "ending_cash": starting_cash + total_inflow - total_outflow,
        "days": days,
        "daily_breakdown": daily_breakdown,
    }
