"""Depreciation calculation and batch processing service."""
import uuid
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from app.firestore.fixed_assets import AssetRepository, DepreciationEntryRepository
from app.firestore.journals import JournalEntryRepository
from app.firestore.system import SequenceRepository


def compute_monthly_depreciation(asset: dict[str, Any]) -> Decimal:
    """Compute monthly depreciation amount for an asset.
    
    Implements:
    - straight_line: (cost - salvage) / useful_life_months
    - declining_balance: book_value * (declining_rate / 12)
    
    Returns 0 if book_value <= salvage_value or fully_depreciated.
    Caps last period to not exceed (book_value - salvage).
    """
    method = asset.get("depreciation_method", "straight_line")
    cost = Decimal(str(asset.get("acquisition_cost", 0)))
    salvage = Decimal(str(asset.get("salvage_value", 0)))
    life = int(asset.get("useful_life_months", 60))
    book_value = Decimal(str(asset.get("book_value", cost)))
    
    if life <= 0:
        return Decimal("0")
    
    if book_value <= salvage:
        return Decimal("0")
    
    if method == "declining_balance":
        rate = Decimal(str(asset.get("declining_rate", 0.2)))
        monthly = book_value * (rate / Decimal("12"))
    else:  # straight_line
        monthly = (cost - salvage) / Decimal(str(life))
    
    # Cap to not exceed remaining depreciable amount
    max_depreciation = book_value - salvage
    if monthly > max_depreciation:
        monthly = max_depreciation
    
    return monthly.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def run_depreciation_for_asset(org_id: str, asset_id: str, period: str) -> dict[str, Any]:
    """Run depreciation for a single asset for a given period.
    
    Steps:
    1. Compute depreciation amount
    2. Create JournalEntry (DR depreciation_expense, CR accumulated_depreciation)
    3. Update asset (accumulated_depreciation, book_value, last_depreciated_date)
    4. Create DepreciationEntry record
    5. Mark fully_depreciated if book_value == salvage
    
    Args:
        org_id: Organization ID
        asset_id: Asset ID
        period: Period in format 'YYYY-MM'
    
    Returns:
        dict with keys: success, amount, journal_entry_id, error (if failed)
    """
    asset_repo = AssetRepository(org_id)
    dep_repo = DepreciationEntryRepository(org_id)
    je_repo = JournalEntryRepository(org_id)
    seq_repo = SequenceRepository(org_id)
    
    try:
        asset = asset_repo.get(asset_id)
        if not asset:
            return {"success": False, "error": "Asset not found"}
        
        if asset.get("status") != "active":
            return {"success": False, "error": "Asset not active"}
        
        # Check if already depreciated for this period
        if dep_repo.exists_for_asset_period(asset_id, period):
            return {"success": False, "error": "Already depreciated for this period"}
        
        # Compute amount
        amount = compute_monthly_depreciation(asset)
        
        if amount == Decimal("0"):
            return {"success": False, "error": "No depreciation needed"}
        
        # Create JE
        try:
            je_number = seq_repo.get_next("journal")
        except Exception:
            je_number = f"DEP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        # Period end date: last day of month
        year, month = int(period[:4]), int(period[5:7])
        if month == 12:
            next_month = datetime(year + 1, 1, 1)
        else:
            next_month = datetime(year, month + 1, 1)
        period_end_date = (next_month - timedelta(days=1)).date().isoformat()
        
        je_header = {
            "id": str(uuid.uuid4()),
            "entry_number": je_number,
            "date": period_end_date,
            "narration": f"Depreciation {period}: {asset.get('name', asset_id)}",
            "status": "posted",
            "source_type": "depreciation",
            "source_id": asset_id,
            "total_debit": float(amount),
            "total_credit": float(amount),
        }
        
        je_lines = [
            {
                "account_id": asset.get("depreciation_expense_account_id"),
                "debit": float(amount),
                "credit": 0,
                "description": je_header["narration"],
            },
            {
                "account_id": asset.get("accumulated_depreciation_account_id"),
                "debit": 0,
                "credit": float(amount),
                "description": je_header["narration"],
            },
        ]
        
        # Validate balance
        total_dr = sum(Decimal(str(line["debit"])) for line in je_lines)
        total_cr = sum(Decimal(str(line["credit"])) for line in je_lines)
        assert total_dr == total_cr, f"JE unbalanced: DR={total_dr}, CR={total_cr}"
        
        je = je_repo.create_with_lines(je_header, je_lines)
        
        # Update asset
        current_accumulated = Decimal(str(asset.get("accumulated_depreciation", 0)))
        current_book = Decimal(str(asset.get("book_value", asset.get("acquisition_cost", 0))))
        salvage = Decimal(str(asset.get("salvage_value", 0)))
        
        new_accumulated = current_accumulated + amount
        new_book = current_book - amount
        
        update_data: dict[str, Any] = {
            "accumulated_depreciation": float(new_accumulated),
            "book_value": float(new_book),
            "last_depreciated_date": period_end_date,
        }
        
        # Check fully depreciated
        if new_book <= salvage:
            update_data["status"] = "fully_depreciated"
        
        asset_repo.update(asset_id, update_data)
        
        # Create depreciation entry
        dep_entry = {
            "id": str(uuid.uuid4()),
            "asset_id": asset_id,
            "period": period,
            "period_end_date": period_end_date,
            "depreciation_amount": float(amount),
            "journal_entry_id": je["id"],
            "status": "posted",
        }
        dep_repo.create(dep_entry)
        
        return {
            "success": True,
            "amount": float(amount),
            "journal_entry_id": je["id"],
            "new_book_value": float(new_book),
            "fully_depreciated": new_book <= salvage,
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


def run_monthly_depreciation_batch(org_id: str, period: str) -> dict[str, Any]:
    """Run depreciation for all active assets in an organization for a period.
    
    Args:
        org_id: Organization ID
        period: Period in format 'YYYY-MM'
    
    Returns:
        dict with keys: processed, failed, total_amount, errors
    """
    asset_repo = AssetRepository(org_id)
    
    assets = asset_repo.get_active_for_period(period)
    
    processed = 0
    failed = 0
    total_amount = Decimal("0")
    errors = []
    
    for asset in assets:
        result = run_depreciation_for_asset(org_id, asset["id"], period)
        if result["success"]:
            processed += 1
            total_amount += Decimal(str(result["amount"]))
        else:
            failed += 1
            errors.append({
                "asset_id": asset["id"],
                "asset_name": asset.get("name", ""),
                "error": result.get("error", "Unknown error"),
            })
    
    return {
        "processed": processed,
        "failed": failed,
        "total_amount": float(total_amount),
        "errors": errors,
    }
