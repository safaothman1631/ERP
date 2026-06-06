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
    """Consolidated P&L across all companies in the org.

    Deprecated shape-shim: now delegates to the GL consolidation engine for
    GL-accurate figures; prefer ``/consolidated/financials`` and
    ``/consolidated/trial-balance``.
    """
    from app.services import consolidation
    from app.services.report_queries import parse_report_date

    start = parse_report_date(date_from) if date_from else None
    end = parse_report_date(date_to) if date_to else None

    cons = consolidation.consolidated_trial_balance(user["org_id"], start, end)
    account_map = consolidation.build_account_map(user["org_id"])

    def _entity_pl(accounts: dict) -> tuple[float, float]:
        revenue = expense = 0.0
        for aid, v in accounts.items():
            atype = ((account_map.get(aid) or {}).get("account_type") or "").lower()
            debit = float(v.get("debit", 0) or 0)
            credit = float(v.get("credit", 0) or 0)
            if atype in consolidation._INCOME_TYPES:
                revenue += credit - debit
            elif atype in consolidation._EXPENSE_TYPES:
                expense += debit - credit
        return round(revenue, 2), round(expense, 2)

    rows = []
    total_revenue = 0.0
    total_expense = 0.0
    for ent in cons["entities"]:
        cid = ent["id"]
        accounts = cons["per_entity"].get(cid, {}).get("accounts", {})
        rev, exp = _entity_pl(accounts)
        rows.append({
            "company_id": cid,
            "company_name": ent.get("name"),
            "revenue": rev,
            "expenses": exp,
            "profit": round(rev - exp, 2),
        })
        total_revenue += rev
        total_expense += exp

    total_revenue = round(total_revenue, 2)
    total_expense = round(total_expense, 2)
    return {
        "rows": rows,
        "totals": {
            "revenue": total_revenue,
            "expenses": total_expense,
            "profit": round(total_revenue - total_expense, 2),
        },
        "date_from": date_from,
        "date_to": date_to,
    }


@router.get("/consolidated/bs")
def consolidated_bs(user: dict = Depends(get_current_user)):
    """Consolidated balance sheet snapshot grouped by company.

    Deprecated shape-shim: now delegates to the GL consolidation engine for
    GL-accurate figures; prefer ``/consolidated/financials`` and
    ``/consolidated/trial-balance``.
    """
    from app.services import consolidation

    cons = consolidation.consolidated_trial_balance(user["org_id"])
    account_map = consolidation.build_account_map(user["org_id"])

    def _entity_bs(accounts: dict) -> tuple[float, float, float]:
        assets = liabilities = equity = 0.0
        for aid, v in accounts.items():
            atype = ((account_map.get(aid) or {}).get("account_type") or "").lower()
            debit = float(v.get("debit", 0) or 0)
            credit = float(v.get("credit", 0) or 0)
            if atype in consolidation._ASSET_TYPES:
                assets += debit - credit
            elif atype in consolidation._LIABILITY_TYPES:
                liabilities += credit - debit
            elif atype in consolidation._EQUITY_TYPES:
                equity += credit - debit
        return round(assets, 2), round(liabilities, 2), round(equity, 2)

    rows = []
    for ent in cons["entities"]:
        cid = ent["id"]
        accounts = cons["per_entity"].get(cid, {}).get("accounts", {})
        assets, liab, eq = _entity_bs(accounts)
        rows.append({
            "company_id": cid,
            "company_name": ent.get("name"),
            "assets": assets,
            "liabilities": liab,
            "equity": eq,
        })
    return {
        "rows": rows,
        "totals": {
            "assets": round(sum(r["assets"] for r in rows), 2),
            "liabilities": round(sum(r["liabilities"] for r in rows), 2),
            "equity": round(sum(r["equity"] for r in rows), 2),
        },
    }


@router.get("/consolidated/trial-balance")
def get_consolidated_trial_balance(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    eliminate_intercompany: bool = Query(True),
    user: dict = Depends(get_current_user),
):
    """GL-based consolidated trial balance (Pool 3.2): the sum of every entity's
    trial balance (JEs tagged by company_id) with intercompany account balances
    eliminated. Returns the per-entity breakdown, eliminations, and totals."""
    from app.services import consolidation
    from app.services.report_queries import parse_report_date

    start = parse_report_date(start_date) if start_date else None
    end = parse_report_date(end_date) if end_date else None
    return consolidation.consolidated_trial_balance(
        user["org_id"], start, end, eliminate_intercompany=eliminate_intercompany
    )


@router.get("/consolidated/financials")
def get_consolidated_financials(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """GL-based consolidated income statement + balance sheet (Pool 3.2), derived
    from the consolidated trial balance with intercompany eliminations and
    minority-interest allocation for partially-owned subsidiaries."""
    from app.services import consolidation
    from app.services.report_queries import parse_report_date

    start = parse_report_date(start_date) if start_date else None
    end = parse_report_date(end_date) if end_date else None
    return consolidation.consolidated_financials(user["org_id"], start, end)


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
