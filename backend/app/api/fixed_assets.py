"""Fixed Assets API — Categories, assets, depreciation, disposal, reports."""
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.firestore.fixed_assets import (
    AssetCategoryRepository,
    AssetRepository,
    DepreciationEntryRepository,
)
from app.firestore.journals import JournalEntryRepository
from app.firestore.system import SequenceRepository
from app.services.auth import get_current_user
from app.services.depreciation_service import (
    compute_monthly_depreciation,
    run_depreciation_for_asset,
    run_monthly_depreciation_batch,
)

router = APIRouter(prefix="/api/fixed-assets", tags=["Fixed Assets"])


# ═══════════════════════════════════════════════════════════════════════════
# ASSET CATEGORIES
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/asset-categories")
def list_asset_categories(
    user: dict = Depends(get_current_user),
):
    """List all asset categories"""
    repo = AssetCategoryRepository(user["org_id"])
    items, total = repo.list(order_by="name", limit=500)
    return {"items": items, "total": total}


@router.post("/asset-categories", status_code=201)
def create_asset_category(
    data: dict,
    user: dict = Depends(get_current_user),
):
    """Create new asset category"""
    repo = AssetCategoryRepository(user["org_id"])
    
    # Check for duplicate name
    existing = repo.get_by_name(data.get("name", ""))
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")
    
    category = repo.create({
        "id": str(uuid.uuid4()),
        **data,
    })
    return category


@router.get("/asset-categories/{category_id}")
def get_asset_category(
    category_id: str,
    user: dict = Depends(get_current_user),
):
    """Get asset category by ID"""
    repo = AssetCategoryRepository(user["org_id"])
    category = repo.get(category_id)
    if not category or category.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.put("/asset-categories/{category_id}")
def update_asset_category(
    data: dict,
    category_id: str,
    user: dict = Depends(get_current_user),
):
    """Update asset category"""
    repo = AssetCategoryRepository(user["org_id"])
    category = repo.get(category_id)
    if not category or category.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="Category not found")
    
    updated = repo.update(category_id, data)
    return updated


@router.delete("/asset-categories/{category_id}")
def delete_asset_category(
    category_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete asset category"""
    repo = AssetCategoryRepository(user["org_id"])
    category = repo.get(category_id)
    if not category or category.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if any assets use this category
    asset_repo = AssetRepository(user["org_id"])
    filters = [{"field": "category_id", "op": "==", "value": category_id}]
    assets, _ = asset_repo.list(filters=filters, limit=1)
    if assets:
        raise HTTPException(status_code=400, detail="Cannot delete category with assets")
    
    repo.delete(category_id)
    return {"message": "Category deleted"}


# ═══════════════════════════════════════════════════════════════════════════
# FIXED ASSETS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/assets")
def list_assets(
    status: str = Query("", max_length=30),
    category_id: str = Query("", max_length=50),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    """List fixed assets with optional filters"""
    repo = AssetRepository(user["org_id"])
    
    # Firestore filters (limited)
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    
    items, total = repo.list(
        filters=filters if filters else None,
        order_by="created_at",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size,
    )
    
    # Python filter for category
    if category_id:
        items = [a for a in items if a.get("category_id") == category_id]
        total = len(items)
    
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/assets", status_code=201)
def create_asset(
    data: dict,
    user: dict = Depends(get_current_user),
):
    """Create new fixed asset"""
    repo = AssetRepository(user["org_id"])
    seq_repo = SequenceRepository(user["org_id"])
    
    # Generate asset code if not provided
    if not data.get("asset_code"):
        try:
            num = seq_repo.get_next("asset")
            data["asset_code"] = f"AST-{num:05d}"
        except Exception:
            data["asset_code"] = f"AST-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    # Initialize calculated fields
    cost = Decimal(str(data.get("acquisition_cost", 0)))
    data["accumulated_depreciation"] = 0
    data["book_value"] = float(cost)
    data["status"] = data.get("status", "active")
    
    asset = repo.create({
        "id": str(uuid.uuid4()),
        **data,
    })
    return asset


@router.get("/assets/{asset_id}")
def get_asset(
    asset_id: str,
    user: dict = Depends(get_current_user),
):
    """Get asset by ID with depreciation entries"""
    repo = AssetRepository(user["org_id"])
    asset = repo.get_with_depreciation(asset_id)
    if not asset or asset.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.put("/assets/{asset_id}")
def update_asset(
    data: dict,
    asset_id: str,
    user: dict = Depends(get_current_user),
):
    """Update asset"""
    repo = AssetRepository(user["org_id"])
    asset = repo.get(asset_id)
    if not asset or asset.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    updated = repo.update(asset_id, data)
    return updated


@router.delete("/assets/{asset_id}")
def delete_asset(
    asset_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete asset"""
    repo = AssetRepository(user["org_id"])
    asset = repo.get(asset_id)
    if not asset or asset.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    repo.delete(asset_id)
    return {"message": "Asset deleted"}


# ═══════════════════════════════════════════════════════════════════════════
# DEPRECIATION
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/assets/{asset_id}/depreciate")
def depreciate_single_asset(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    asset_id: str = ...,
    user: dict = Depends(get_current_user),
):
    """Run depreciation for a single asset for a specific period"""
    result = run_depreciation_for_asset(user["org_id"], asset_id, period)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Depreciation failed"))
    return result


@router.post("/assets/run-monthly")
def run_monthly_depreciation(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    user: dict = Depends(get_current_user),
):
    """Run monthly depreciation for all active assets"""
    result = run_monthly_depreciation_batch(user["org_id"], period)
    return result


@router.get("/assets/{asset_id}/depreciation-history")
def get_depreciation_history(
    asset_id: str,
    user: dict = Depends(get_current_user),
):
    """Get depreciation history for an asset"""
    # Verify asset ownership
    asset_repo = AssetRepository(user["org_id"])
    asset = asset_repo.get(asset_id)
    if not asset or asset.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    dep_repo = DepreciationEntryRepository(user["org_id"])
    entries = dep_repo.get_by_asset(asset_id)
    return {"items": entries, "total": len(entries)}


# ═══════════════════════════════════════════════════════════════════════════
# DISPOSAL
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/assets/{asset_id}/dispose")
def dispose_asset(
    data: dict,
    asset_id: str,
    user: dict = Depends(get_current_user),
):
    """Dispose/sell an asset.
    
    Posts disposal JE:
    DR Cash/AR (proceeds)
    DR Accumulated Depreciation (accumulated to date)
    CR Asset Account (original cost)
    CR/DR Gain/Loss on Disposal (balancing)
    """
    asset_repo = AssetRepository(user["org_id"])
    asset = asset_repo.get(asset_id)
    if not asset or asset.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    if asset.get("status") == "disposed":
        raise HTTPException(status_code=400, detail="Asset already disposed")
    
    disposal_date = data.get("disposal_date", datetime.utcnow().date().isoformat())
    proceeds = Decimal(str(data.get("proceeds", 0)))
    notes = data.get("notes", "")
    
    # Get account IDs
    asset_account_id = asset.get("asset_account_id")
    accumulated_account_id = asset.get("accumulated_depreciation_account_id")
    
    if not asset_account_id or not accumulated_account_id:
        raise HTTPException(status_code=400, detail="Asset missing account configuration")
    
    # Calculate gain/loss
    cost = Decimal(str(asset.get("acquisition_cost", 0)))
    accumulated = Decimal(str(asset.get("accumulated_depreciation", 0)))
    book_value = cost - accumulated
    gain_loss = proceeds - book_value
    
    # Create disposal JE
    je_repo = JournalEntryRepository(user["org_id"])
    seq_repo = SequenceRepository(user["org_id"])
    
    try:
        je_number = seq_repo.get_next("journal")
    except Exception:
        je_number = f"DISP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    # Determine gain/loss account (simple: use a default or first expense/income account)
    # In production, this should be configurable
    gain_loss_account_id = None
    if gain_loss != 0:
        # Use a placeholder — in real system, configure these accounts
        gain_loss_account_id = asset.get("depreciation_expense_account_id")  # Reuse expense account as fallback
    
    je_lines = []
    
    # DR Cash/proceeds
    if proceeds > 0:
        je_lines.append({
            "account_id": "1020",  # Cash/Bank default — should be configurable
            "debit": float(proceeds),
            "credit": 0,
            "description": f"Disposal proceeds: {asset.get('name', asset_id)}",
        })
    
    # DR Accumulated Depreciation
    if accumulated > 0:
        je_lines.append({
            "account_id": accumulated_account_id,
            "debit": float(accumulated),
            "credit": 0,
            "description": f"Remove accumulated depreciation: {asset.get('name', asset_id)}",
        })
    
    # CR Asset Account (original cost)
    je_lines.append({
        "account_id": asset_account_id,
        "debit": 0,
        "credit": float(cost),
        "description": f"Remove asset: {asset.get('name', asset_id)}",
    })
    
    # Gain/Loss balancing
    if gain_loss > 0:  # Gain
        je_lines.append({
            "account_id": gain_loss_account_id or "4010",  # Revenue account
            "debit": 0,
            "credit": float(gain_loss),
            "description": f"Gain on disposal: {asset.get('name', asset_id)}",
        })
    elif gain_loss < 0:  # Loss
        je_lines.append({
            "account_id": gain_loss_account_id or "5010",  # Expense account
            "debit": float(abs(gain_loss)),
            "credit": 0,
            "description": f"Loss on disposal: {asset.get('name', asset_id)}",
        })
    
    # Validate balance
    total_dr = sum(Decimal(str(line["debit"])) for line in je_lines)
    total_cr = sum(Decimal(str(line["credit"])) for line in je_lines)
    
    if total_dr != total_cr:
        raise HTTPException(status_code=500, detail=f"JE unbalanced: DR={total_dr}, CR={total_cr}")
    
    je_header = {
        "id": str(uuid.uuid4()),
        "entry_number": je_number,
        "date": disposal_date,
        "narration": f"Asset disposal: {asset.get('name', asset_id)}",
        "status": "posted",
        "source_type": "asset_disposal",
        "source_id": asset_id,
        "total_debit": float(total_dr),
        "total_credit": float(total_cr),
    }
    
    je = je_repo.create_with_lines(je_header, je_lines)
    
    # Update asset
    asset_repo.update(asset_id, {
        "status": "disposed",
        "disposed_date": disposal_date,
        "disposal_proceeds": float(proceeds),
        "gain_loss_on_disposal": float(gain_loss),
        "notes": notes,
    })
    
    return {
        "message": "Asset disposed successfully",
        "journal_entry_id": je["id"],
        "gain_loss": float(gain_loss),
    }


# ═══════════════════════════════════════════════════════════════════════════
# REPORTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/assets/reports/summary")
def get_assets_summary(
    user: dict = Depends(get_current_user),
):
    """Get summary report: total cost, accumulated depreciation, NBV, breakdown by category"""
    asset_repo = AssetRepository(user["org_id"])
    category_repo = AssetCategoryRepository(user["org_id"])
    
    # Get all assets
    filters = [{"field": "status", "op": "in", "value": ["active", "fully_depreciated"]}]
    assets, _ = asset_repo.list(filters=None, limit=2000)  # Get all
    
    # Filter active/fully_depreciated in Python
    assets = [a for a in assets if a.get("status") in ("active", "fully_depreciated")]
    
    total_cost = Decimal("0")
    total_accumulated = Decimal("0")
    total_nbv = Decimal("0")
    by_category: dict[str, dict[str, Any]] = {}
    
    for asset in assets:
        cost = Decimal(str(asset.get("acquisition_cost", 0)))
        accumulated = Decimal(str(asset.get("accumulated_depreciation", 0)))
        nbv = Decimal(str(asset.get("book_value", 0)))
        
        total_cost += cost
        total_accumulated += accumulated
        total_nbv += nbv
        
        cat_id = asset.get("category_id", "uncategorized")
        if cat_id not in by_category:
            by_category[cat_id] = {
                "category_id": cat_id,
                "category_name": "",
                "count": 0,
                "cost": Decimal("0"),
                "accumulated": Decimal("0"),
                "nbv": Decimal("0"),
            }
        
        by_category[cat_id]["count"] += 1
        by_category[cat_id]["cost"] += cost
        by_category[cat_id]["accumulated"] += accumulated
        by_category[cat_id]["nbv"] += nbv
    
    # Load category names
    categories, _ = category_repo.list(limit=500)
    cat_map = {c["id"]: c.get("name", "") for c in categories}
    
    for cat_id, data in by_category.items():
        data["category_name"] = cat_map.get(cat_id, "Uncategorized")
        data["cost"] = float(data["cost"])
        data["accumulated"] = float(data["accumulated"])
        data["nbv"] = float(data["nbv"])
    
    return {
        "total_cost": float(total_cost),
        "total_accumulated_depreciation": float(total_accumulated),
        "net_book_value": float(total_nbv),
        "by_category": list(by_category.values()),
    }


@router.get("/assets/reports/depreciation-schedule")
def get_depreciation_schedule(
    asset_id: str = Query(None),
    months: int = Query(60, ge=1, le=600),
    user: dict = Depends(get_current_user),
):
    """Get projected depreciation schedule for an asset (or all assets).
    
    Returns monthly projections for next N months.
    """
    asset_repo = AssetRepository(user["org_id"])
    
    if asset_id:
        # Single asset
        asset = asset_repo.get(asset_id)
        if not asset or asset.get("org_id") != user["org_id"]:
            raise HTTPException(status_code=404, detail="Asset not found")
        assets = [asset]
    else:
        # All active assets
        filters = [{"field": "status", "op": "==", "value": "active"}]
        assets, _ = asset_repo.list(filters=filters, limit=1000)
    
    schedule = []
    
    for asset in assets:
        if asset.get("status") != "active":
            continue
        
        cost = Decimal(str(asset.get("acquisition_cost", 0)))
        salvage = Decimal(str(asset.get("salvage_value", 0)))
        book_value = Decimal(str(asset.get("book_value", cost)))
        
        # Generate future months
        current_date = datetime.utcnow().date()
        for i in range(months):
            # Calculate month
            month_date = current_date + timedelta(days=30 * i)
            period = month_date.strftime("%Y-%m")
            
            # Compute depreciation
            temp_asset = {**asset, "book_value": float(book_value)}
            monthly_dep = compute_monthly_depreciation(temp_asset)
            
            if monthly_dep == 0:
                break  # Fully depreciated
            
            schedule.append({
                "asset_id": asset["id"],
                "asset_name": asset.get("name", ""),
                "period": period,
                "opening_book_value": float(book_value),
                "depreciation_amount": float(monthly_dep),
                "closing_book_value": float(book_value - monthly_dep),
            })
            
            book_value -= monthly_dep
            
            if book_value <= salvage:
                break
    
    return {"items": schedule, "total": len(schedule)}


# ═══════════════════════════════════════════════════════════════════════════
# ROUTER EXPORT
# ═══════════════════════════════════════════════════════════════════════════
# FastAPI will auto-include this router when imported in main.py
