import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.assets import FixedAssetRepository as AssetRepository
from app.firestore.base import BaseRepository
from app.firestore.journals import JournalEntryRepository
from app.firestore.accounts import AccountRepository
from app.firestore.system import SequenceRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/assets", tags=["Assets"])

class DepreciationEntryRepository(BaseRepository):
    collection_name = "depreciation_entries"


def _post_depreciation_journal(org_id: str, asset: dict, amount: float, asset_id: str) -> dict | None:
    """Post a balanced journal entry for an asset depreciation.

    DR Depreciation Expense (P&L)
    CR Accumulated Depreciation (Balance Sheet)

    Account selection priority:
      1. asset["depreciation_expense_account_id"] / asset["accumulated_depreciation_account_id"]
      2. fallback by account name match (Depreciation Expense / Accumulated Depreciation)
      3. if no accounts found, return None and skip posting (the depreciation
         entry itself is still recorded — accounting integration is best-effort)
    """
    if amount <= 0:
        return None

    acct_repo = AccountRepository(org_id)
    expense_id = asset.get("depreciation_expense_account_id")
    accum_id = asset.get("accumulated_depreciation_account_id")

    if not expense_id or not accum_id:
        # Fallback: scan accounts for typical names
        all_accounts, _ = acct_repo.list(limit=2000)
        for a in all_accounts:
            name = (a.get("name") or "").lower()
            atype = (a.get("account_type") or "").lower()
            if not expense_id and "depreciation" in name and "accumulated" not in name and atype in ("expense", "operating_expense", "other_expense"):
                expense_id = a["id"]
            if not accum_id and "accumulated" in name and "depreciation" in name:
                accum_id = a["id"]
            if expense_id and accum_id:
                break

    if not expense_id or not accum_id:
        return None  # Best-effort: skip GL post if no chart configured

    je_repo = JournalEntryRepository(org_id)
    seq = SequenceRepository(org_id)
    try:
        number = seq.get_next("journal")
    except Exception:
        number = f"DEP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    today = datetime.utcnow().date().isoformat()
    header = {
        "id": str(uuid.uuid4()),
        "entry_number": number,
        "date": today,
        "narration": f"Monthly depreciation: {asset.get('name', asset_id)}",
        "status": "posted",
        "source_type": "asset_depreciation",
        "source_id": asset_id,
        "total_debit": round(amount, 2),
        "total_credit": round(amount, 2),
    }
    lines = [
        {"account_id": expense_id, "debit": round(amount, 2), "credit": 0, "description": header["narration"]},
        {"account_id": accum_id, "debit": 0, "credit": round(amount, 2), "description": header["narration"]},
    ]
    return je_repo.create_with_lines(header, lines)


@router.get("")
def list_assets(page: int = Query(1), page_size: int = Query(20, le=500), user: dict = Depends(get_current_user)):
    repo = AssetRepository(user["org_id"])
    items, total = repo.list(order_by="name", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("", status_code=201)
def create_asset(data: dict, user: dict = Depends(get_current_user)):
    repo = AssetRepository(user["org_id"])
    asset = repo.create({"id": str(uuid.uuid4()), **data})
    return asset

@router.get("/{asset_id}")
def get_asset(asset_id: str, user: dict = Depends(get_current_user)):
    repo = AssetRepository(user["org_id"])
    asset = repo.get(asset_id)
    if not asset or asset.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="سامانە نەدۆزرایەوە")
    return asset

@router.put("/{asset_id}")
def update_asset(asset_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = AssetRepository(user["org_id"])
    asset = repo.get(asset_id)
    if not asset or asset.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="سامانە نەدۆزرایەوە")
    updated = repo.update(asset_id, data)
    return updated

@router.delete("/{asset_id}")
def delete_asset(asset_id: str, user: dict = Depends(get_current_user)):
    repo = AssetRepository(user["org_id"])
    asset = repo.get(asset_id)
    if not asset or asset.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="سامانە نەدۆزرایەوە")
    repo.delete(asset_id)
    return {"message": "سامانە سڕایەوە"}

@router.post("/{asset_id}/depreciate")
def depreciate_asset(asset_id: str, user: dict = Depends(get_current_user)):
    repo = AssetRepository(user["org_id"])
    asset = repo.get(asset_id)
    if not asset or asset.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="سامانە نەدۆزرایەوە")
    
    if asset.get("status") != "active":
        raise HTTPException(status_code=400, detail="تەنها سامانە چالاکەکان دەتوانرێت دابەزێنن")
    
    purchase_price = float(asset.get("purchase_price", 0))
    salvage_value = float(asset.get("salvage_value", 0))
    useful_life_months = float(asset.get("useful_life_months", 1))
    
    if useful_life_months <= 0:
        raise HTTPException(status_code=400, detail="تەمەنی بەسوود دەبێت زیاتر لە سفر بێت")
    
    monthly_amount = (purchase_price - salvage_value) / useful_life_months
    current_value = float(asset.get("current_value", purchase_price))
    new_value = max(current_value - monthly_amount, salvage_value)
    
    # Create depreciation entry
    dep_repo = DepreciationEntryRepository(user["org_id"])
    je = _post_depreciation_journal(user["org_id"], asset, monthly_amount, asset_id)
    entry = {
        "id": str(uuid.uuid4()),
        "asset_id": asset_id,
        "date": datetime.now().isoformat(),
        "amount": monthly_amount,
        "org_id": user["org_id"],
        "created_at": datetime.now().isoformat(),
        "journal_entry_id": je["id"] if je else None,
    }
    dep_repo.create(entry)
    
    # Update asset current value
    repo.update(asset_id, {"current_value": new_value})
    
    return {"message": "دابەزین سەرکەوتوو بوو", "amount": monthly_amount, "new_value": new_value, "journal_entry_id": je["id"] if je else None}

@router.get("/{asset_id}/depreciation-schedule")
def get_depreciation_schedule(asset_id: str, user: dict = Depends(get_current_user)):
    repo = AssetRepository(user["org_id"])
    asset = repo.get(asset_id)
    if not asset or asset.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="سامانە نەدۆزرایەوە")
    
    dep_repo = DepreciationEntryRepository(user["org_id"])
    filters = [{"field": "asset_id", "op": "==", "value": asset_id}]
    entries, total = dep_repo.list(filters=filters, order_by="date", order_dir="DESCENDING")
    return {"items": entries, "total": total}

@router.post("/{asset_id}/dispose")
def dispose_asset(asset_id: str, user: dict = Depends(get_current_user)):
    repo = AssetRepository(user["org_id"])
    asset = repo.get(asset_id)
    if not asset or asset.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="سامانە نەدۆزرایەوە")
    
    repo.update(asset_id, {"status": "disposed", "disposal_date": datetime.now().isoformat()})
    return {"message": "سامانە وەک فڕێدراو نیشانکرا"}

@router.post("/depreciate-all")
def depreciate_all_assets(user: dict = Depends(get_current_user)):
    repo = AssetRepository(user["org_id"])
    filters = [{"field": "status", "op": "==", "value": "active"}]
    assets, total = repo.list(filters=filters)
    
    depreciated_count = 0
    dep_repo = DepreciationEntryRepository(user["org_id"])
    
    for asset in assets:
        try:
            purchase_price = float(asset.get("purchase_price", 0))
            salvage_value = float(asset.get("salvage_value", 0))
            useful_life_months = float(asset.get("useful_life_months", 1))
            
            if useful_life_months <= 0:
                continue
            
            monthly_amount = (purchase_price - salvage_value) / useful_life_months
            current_value = float(asset.get("current_value", purchase_price))
            new_value = max(current_value - monthly_amount, salvage_value)
            
            # Create depreciation entry + GL post (best-effort)
            je = _post_depreciation_journal(user["org_id"], asset, monthly_amount, asset["id"])
            entry = {
                "id": str(uuid.uuid4()),
                "asset_id": asset["id"],
                "date": datetime.now().isoformat(),
                "amount": monthly_amount,
                "org_id": user["org_id"],
                "created_at": datetime.now().isoformat(),
                "journal_entry_id": je["id"] if je else None,
            }
            dep_repo.create(entry)
            
            # Update asset
            repo.update(asset["id"], {"current_value": new_value})
            depreciated_count += 1
        except Exception:
            continue
    
    return {"message": f"{depreciated_count} سامانە دابەزان", "count": depreciated_count}
