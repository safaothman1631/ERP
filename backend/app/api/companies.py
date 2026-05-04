"""Multi-Company API (Sprint 9.1).

Endpoints:
    POST   /api/companies                        create subsidiary
    GET    /api/companies                        list user's companies
    GET    /api/companies/{id}                   detail
    PUT    /api/companies/{id}                   update settings
    POST   /api/companies/{id}/switch            switch active company
    DELETE /api/companies/{id}                   archive subsidiary
    GET    /api/companies/consolidated/pl        consolidated P&L
    GET    /api/companies/consolidated/bs        consolidated balance sheet
    POST   /api/companies/intercompany           inter-company journal entry
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.firestore.companies import CompanyRepository, IntercompanyJournalRepository
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/companies", tags=["Companies"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────── CRUD ────────────────────────────

@router.get("")
def list_companies(user: dict = Depends(get_current_user)):
    repo = CompanyRepository(user["org_id"])
    items, _ = repo.list(order_by="name", order_dir="ASCENDING", limit=200)
    # Always include the default "head" company derived from org itself
    if not any(c.get("is_primary") for c in items):
        items.insert(0, {
            "id": user["org_id"],
            "name": "Head Company",
            "code": "HQ",
            "is_primary": True,
            "is_active": True,
            "currency": "IQD",
        })
    return items


@router.post("", status_code=201)
def create_company(data: dict, user: dict = Depends(get_current_user)):
    if not data.get("name"):
        raise HTTPException(400, "name required")
    repo = CompanyRepository(user["org_id"])
    payload = {
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "name": data["name"],
        "code": data.get("code", ""),
        "currency": data.get("currency", "IQD"),
        "tax_id": data.get("tax_id", ""),
        "address": data.get("address", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "is_primary": False,
        "is_active": True,
        "created_at": _now_iso(),
    }
    return repo.create(payload)


@router.get("/consolidated/pl")
def consolidated_pl(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Consolidated P&L across all companies in the org."""
    companies = CompanyRepository(user["org_id"]).list(limit=200)[0]
    rows = []
    total_revenue = 0.0
    total_expense = 0.0
    # Lazy import to avoid circular
    from app.firestore.invoices import InvoiceRepository
    from app.firestore.bills import BillRepository
    inv_repo = InvoiceRepository(user["org_id"])
    bill_repo = BillRepository(user["org_id"])
    invoices, _ = inv_repo.list(limit=10000)
    bills, _ = bill_repo.list(limit=10000)

    def _in_range(rec: dict) -> bool:
        d = rec.get("date") or rec.get("invoice_date") or rec.get("bill_date")
        if not d:
            return True
        if date_from and str(d) < date_from:
            return False
        if date_to and str(d) > date_to:
            return False
        return True

    for c in companies:
        cid = c["id"]
        rev = sum(
            float(i.get("total") or 0)
            for i in invoices
            if (i.get("company_id") or user["org_id"]) == cid and _in_range(i)
            and i.get("status") not in ("draft", "void")
        )
        exp = sum(
            float(b.get("total") or 0)
            for b in bills
            if (b.get("company_id") or user["org_id"]) == cid and _in_range(b)
            and b.get("status") not in ("draft", "void")
        )
        rows.append({
            "company_id": cid,
            "company_name": c["name"],
            "revenue": rev,
            "expenses": exp,
            "profit": rev - exp,
        })
        total_revenue += rev
        total_expense += exp
    return {
        "rows": rows,
        "totals": {
            "revenue": total_revenue,
            "expenses": total_expense,
            "profit": total_revenue - total_expense,
        },
        "date_from": date_from,
        "date_to": date_to,
    }


@router.get("/consolidated/bs")
def consolidated_bs(user: dict = Depends(get_current_user)):
    """Consolidated balance sheet snapshot grouped by company."""
    companies = CompanyRepository(user["org_id"]).list(limit=200)[0]
    from app.firestore.accounts import AccountRepository
    acc_repo = AccountRepository(user["org_id"])
    accounts, _ = acc_repo.list(limit=10000)

    def _kind_total(cid: str, kinds: tuple[str, ...]) -> float:
        return sum(
            float(a.get("balance") or 0)
            for a in accounts
            if (a.get("company_id") or user["org_id"]) == cid
            and (a.get("account_type") or "").lower() in kinds
        )

    rows = []
    for c in companies:
        cid = c["id"]
        assets = _kind_total(cid, ("asset", "current_asset", "fixed_asset"))
        liab = _kind_total(cid, ("liability", "current_liability", "long_term_liability"))
        eq = _kind_total(cid, ("equity",))
        rows.append({
            "company_id": cid,
            "company_name": c["name"],
            "assets": assets,
            "liabilities": liab,
            "equity": eq,
        })
    return {
        "rows": rows,
        "totals": {
            "assets": sum(r["assets"] for r in rows),
            "liabilities": sum(r["liabilities"] for r in rows),
            "equity": sum(r["equity"] for r in rows),
        },
    }


@router.post("/intercompany", status_code=201)
def create_intercompany_journal(data: dict, user: dict = Depends(get_current_user)):
    if not data.get("from_company_id") or not data.get("to_company_id"):
        raise HTTPException(400, "from_company_id and to_company_id required")
    if data["from_company_id"] == data["to_company_id"]:
        raise HTTPException(400, "from and to companies must differ")
    amount = float(data.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(400, "amount must be > 0")
    repo = IntercompanyJournalRepository(user["org_id"])
    payload = {
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "from_company_id": data["from_company_id"],
        "to_company_id": data["to_company_id"],
        "amount": amount,
        "currency": data.get("currency", "IQD"),
        "description": data.get("description", ""),
        "reference": data.get("reference", ""),
        "date": data.get("date") or datetime.now(timezone.utc).date().isoformat(),
        "status": "posted",
        "created_at": _now_iso(),
        "created_by": user.get("uid") or user.get("email"),
    }
    return repo.create(payload)


@router.get("/intercompany")
def list_intercompany(user: dict = Depends(get_current_user)):
    items, _ = IntercompanyJournalRepository(user["org_id"]).list(
        order_by="date", order_dir="DESCENDING", limit=200
    )
    return items


@router.post("/intercompany/{ic_id}/eliminate")
def eliminate_intercompany(ic_id: str, user: dict = Depends(get_current_user)):
    """Mark an IC transaction as eliminated (no journal reversal yet)."""
    repo = IntercompanyJournalRepository(user["org_id"])
    item = repo.get(ic_id)
    if not item:
        raise HTTPException(404, "IC transaction not found")
    repo.update(ic_id, {"eliminated": True, "eliminated_at": _now_iso()})
    return {"success": True, "eliminated_at": _now_iso()}


# ── Item-scoped routes (must come after literal paths) ──

@router.get("/{company_id}")
def get_company(company_id: str, user: dict = Depends(get_current_user)):
    if company_id == user["org_id"]:
        return {
            "id": user["org_id"],
            "name": "Head Company",
            "code": "HQ",
            "is_primary": True,
            "is_active": True,
            "currency": "IQD",
        }
    repo = CompanyRepository(user["org_id"])
    item = repo.get(company_id)
    if not item:
        raise HTTPException(404, "Company not found")
    return item


@router.put("/{company_id}")
def update_company(company_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = CompanyRepository(user["org_id"])
    if not repo.get(company_id):
        raise HTTPException(404, "Company not found")
    # Strip protected fields
    data.pop("id", None); data.pop("org_id", None); data.pop("is_primary", None)
    data["updated_at"] = _now_iso()
    return repo.update(company_id, data)


@router.delete("/{company_id}")
def archive_company(company_id: str, user: dict = Depends(get_current_user)):
    repo = CompanyRepository(user["org_id"])
    item = repo.get(company_id)
    if not item:
        raise HTTPException(404, "Company not found")
    if item.get("is_primary"):
        raise HTTPException(400, "Cannot archive primary company")
    repo.update(company_id, {"is_active": False, "archived_at": _now_iso()})
    return {"success": True}


@router.post("/{company_id}/switch")
def switch_company(company_id: str, user: dict = Depends(get_current_user)):
    """Mark a company as the user's active company (stored on user prefs)."""
    if company_id != user["org_id"]:
        repo = CompanyRepository(user["org_id"])
        if not repo.get(company_id):
            raise HTTPException(404, "Company not found")
    # Persist on user preferences (best-effort)
    try:
        from app.firestore.system import SettingsRepository
        prefs = SettingsRepository(user["org_id"])
        prefs.update("user_prefs", {"active_company_id": company_id})  # type: ignore[arg-type]
    except Exception:
        pass
    return {"active_company_id": company_id, "switched_at": _now_iso()}
