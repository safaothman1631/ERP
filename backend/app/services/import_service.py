# backend/app/services/import_service.py
import csv
import io
import uuid
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)

def parse_csv(file_content: bytes, encoding: str = "utf-8") -> list[dict]:
    text = file_content.decode(encoding)
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader]


def parse_excel(file_content: bytes) -> list[dict]:
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_content), read_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows: return []
        headers = [str(h or "").strip() for h in rows[0]]
        return [dict(zip(headers, [str(v or "") for v in row])) for row in rows[1:]]
    except ImportError:
        logger.warning("openpyxl not installed")
        return []


def import_contacts(org_id: str, rows: list[dict]) -> dict:
    from app.firestore.contacts import ContactRepository
    repo = ContactRepository(org_id)
    created = 0
    errors = []
    for i, row in enumerate(rows):
        try:
            name = row.get("display_name") or row.get("name") or row.get("Name", "")
            if not name:
                errors.append(f"Row {i+1}: Missing name")
                continue
            repo.create({
                "id": str(uuid.uuid4()),
                "display_name": name,
                "contact_type": row.get("type", row.get("contact_type", "customer")),
                "email": row.get("email", ""),
                "phone": row.get("phone", ""),
                "company_name": row.get("company", row.get("company_name", "")),
                "is_active": True,
            })
            created += 1
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
    return {"created": created, "errors": errors, "total": len(rows)}


def import_items(org_id: str, rows: list[dict]) -> dict:
    from app.firestore.inventory import ItemRepository
    repo = ItemRepository(org_id)
    created = 0
    errors = []
    for i, row in enumerate(rows):
        try:
            name = row.get("name") or row.get("Name", "")
            if not name:
                errors.append(f"Row {i+1}: Missing name")
                continue
            repo.create({
                "id": str(uuid.uuid4()),
                "name": name,
                "sku": row.get("sku", row.get("SKU", "")),
                "type": row.get("type", "goods"),
                "unit": row.get("unit", "pcs"),
                "selling_price": float(row.get("selling_price", row.get("price", 0))),
                "purchase_price": float(row.get("purchase_price", row.get("cost", 0))),
                "description": row.get("description", ""),
                "is_active": True,
            })
            created += 1
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
    return {"created": created, "errors": errors, "total": len(rows)}


def import_accounts(org_id: str, rows: list[dict]) -> dict:
    from app.firestore.accounts import AccountRepository
    repo = AccountRepository(org_id)
    created = 0
    errors = []
    for i, row in enumerate(rows):
        try:
            name = row.get("name") or row.get("Name", "")
            if not name:
                errors.append(f"Row {i+1}: Missing name")
                continue
            repo.create({
                "id": str(uuid.uuid4()),
                "name": name,
                "code": row.get("code", ""),
                "account_type": row.get("type", row.get("account_type", "other_expense")),
                "parent_id": row.get("parent_id", None),
                "balance": float(row.get("opening_balance", row.get("balance", 0))),
                "is_active": True,
            })
            created += 1
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
    return {"created": created, "errors": errors, "total": len(rows)}


def import_bank_transactions(org_id: str, rows: list[dict], bank_account_id: str) -> dict:
    from app.firestore.banking import BankTransactionRepository
    repo = BankTransactionRepository(org_id)
    created = 0
    errors = []
    for i, row in enumerate(rows):
        try:
            amount = float(row.get("amount", row.get("Amount", 0)))
            if amount == 0:
                errors.append(f"Row {i+1}: Zero amount")
                continue
            repo.create({
                "id": str(uuid.uuid4()),
                "bank_account_id": bank_account_id,
                "date": row.get("date", row.get("Date", "")),
                "description": row.get("description", row.get("Description", "")),
                "reference": row.get("reference", row.get("Reference", "")),
                "amount": amount,
                "type": "credit" if amount > 0 else "debit",
                "status": "uncategorized",
            })
            created += 1
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
    return {"created": created, "errors": errors, "total": len(rows)}


def validate_rows(entity_type: str, rows: list[dict], bank_account_id: Optional[str] = None) -> dict:
    """Dry-run validator: checks each row using the same rules as the real
    import functions, but does NOT touch Firestore. Returns the same shape
    so the UI can render a preview/diff before the user confirms.
    """
    would_create = 0
    errors: list[str] = []

    if entity_type == "bank_transactions" and not bank_account_id:
        return {"created": 0, "errors": ["bank_account_id required"], "total": len(rows)}

    for i, row in enumerate(rows):
        try:
            if entity_type == "contacts":
                name = row.get("display_name") or row.get("name") or row.get("Name", "")
                if not name:
                    errors.append(f"Row {i+1}: Missing name")
                    continue
            elif entity_type == "items":
                name = row.get("name") or row.get("Name", "")
                if not name:
                    errors.append(f"Row {i+1}: Missing name")
                    continue
                # Exercise the same coercions to surface bad numbers
                float(row.get("selling_price", row.get("price", 0)) or 0)
                float(row.get("purchase_price", row.get("cost", 0)) or 0)
            elif entity_type == "accounts":
                name = row.get("name") or row.get("Name", "")
                if not name:
                    errors.append(f"Row {i+1}: Missing name")
                    continue
                float(row.get("opening_balance", row.get("balance", 0)) or 0)
            elif entity_type == "bank_transactions":
                amount = float(row.get("amount", row.get("Amount", 0)) or 0)
                if amount == 0:
                    errors.append(f"Row {i+1}: Zero amount")
                    continue
            else:
                return {"created": 0, "errors": [f"Unsupported entity type: {entity_type}"], "total": len(rows)}
            would_create += 1
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    return {"created": would_create, "errors": errors, "total": len(rows)}
