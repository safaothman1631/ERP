# backend/app/api/imports.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from app.services.import_service import parse_csv, parse_excel, import_contacts, import_items, import_accounts, import_bank_transactions
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/import", tags=["Import"])

@router.post("/preview")
async def preview_import(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Preview first 10 rows of import file"""
    contents = await file.read()
    if file.filename.endswith('.csv'):
        rows = parse_csv(contents)
    elif file.filename.endswith(('.xlsx', '.xls')):
        rows = parse_excel(contents)
    else:
        raise HTTPException(400, "Unsupported file type. Use CSV or Excel.")
    
    headers = list(rows[0].keys()) if rows else []
    return {"headers": headers, "preview": rows[:10], "total_rows": len(rows)}


@router.post("/{entity_type}")
async def import_data(entity_type: str, file: UploadFile = File(...), 
                      bank_account_id: str = None,
                      dry_run: bool = False,
                      user: dict = Depends(get_current_user)):
    """Import data from CSV/Excel.

    When `dry_run=true`, the file is parsed and each row validated against the
    same logic used for a real import (missing required fields, type coercion),
    but NOTHING is written to Firestore. Returns the same shape as a real run
    so the UI can show a preview of what would be created/skipped.
    """
    contents = await file.read()
    if file.filename.endswith('.csv'):
        rows = parse_csv(contents)
    elif file.filename.endswith(('.xlsx', '.xls')):
        rows = parse_excel(contents)
    else:
        raise HTTPException(400, "Unsupported file type")
    
    if not rows:
        raise HTTPException(400, "No data found in file")
    
    org_id = user["org_id"]

    if dry_run:
        # Validate-only: count rows that would succeed/fail without touching DB
        from app.services.import_service import validate_rows
        result = validate_rows(entity_type, rows, bank_account_id=bank_account_id)
        result["dry_run"] = True
        return result

    if entity_type == "contacts":
        result = import_contacts(org_id, rows)
    elif entity_type == "items":
        result = import_items(org_id, rows)
    elif entity_type == "accounts":
        result = import_accounts(org_id, rows)
    elif entity_type == "bank_transactions":
        if not bank_account_id:
            raise HTTPException(400, "bank_account_id required")
        result = import_bank_transactions(org_id, rows, bank_account_id)
    else:
        raise HTTPException(400, f"Unsupported entity type: {entity_type}")
    
    result["dry_run"] = False
    return result
