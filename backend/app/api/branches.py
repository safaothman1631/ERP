"""Branches API (Sprint 9.2 — expanded)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.firestore.system import BranchRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/branches", tags=["Branches"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("")
def list_branches(
    company_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    repo = BranchRepository(user["org_id"])
    items, _ = repo.list(order_by="name", order_dir="ASCENDING", limit=200)
    if company_id:
        items = [b for b in items if (b.get("company_id") or user["org_id"]) == company_id]
    return items


@router.post("", status_code=201)
def create_branch(data: dict, user: dict = Depends(get_current_user)):
    if not data.get("name"):
        raise HTTPException(400, "name required")
    repo = BranchRepository(user["org_id"])
    return repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "company_id": data.get("company_id") or user["org_id"],
        "name": data["name"],
        "code": data.get("code", ""),
        "address": data.get("address", ""),
        "phone": data.get("phone", ""),
        "manager_name": data.get("manager_name", ""),
        "is_head_office": bool(data.get("is_head_office", False)),
        "is_active": True,
        "created_at": _now_iso(),
    })


@router.get("/comparison")
def branches_comparison(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Revenue + expense per branch (for grouped bar chart)."""
    branches, _ = BranchRepository(user["org_id"]).list(limit=200)
    from app.firestore.invoices import InvoiceRepository
    from app.firestore.bills import BillRepository
    invoices, _ = InvoiceRepository(user["org_id"]).list(limit=10000)
    bills, _ = BillRepository(user["org_id"]).list(limit=10000)

    def _in_range(rec: dict) -> bool:
        d = rec.get("date") or rec.get("invoice_date") or rec.get("bill_date")
        if not d:
            return True
        if date_from and str(d) < date_from:
            return False
        if date_to and str(d) > date_to:
            return False
        return True

    rows = []
    for b in branches:
        bid = b["id"]
        rev = sum(
            float(i.get("total") or 0)
            for i in invoices
            if i.get("branch_id") == bid and _in_range(i)
            and i.get("status") not in ("draft", "void")
        )
        exp = sum(
            float(bl.get("total") or 0)
            for bl in bills
            if bl.get("branch_id") == bid and _in_range(bl)
            and bl.get("status") not in ("draft", "void")
        )
        rows.append({
            "branch_id": bid,
            "branch_name": b.get("name"),
            "revenue": rev,
            "expenses": exp,
            "profit": rev - exp,
        })
    return {"rows": rows, "date_from": date_from, "date_to": date_to}


@router.put("/users/{user_id}/branch")
def assign_user_to_branch(
    user_id: str,
    data: dict,
    user: dict = Depends(get_current_user),
):
    branch_id = data.get("branch_id")
    if not branch_id:
        raise HTTPException(400, "branch_id required")
    if not BranchRepository(user["org_id"]).get(branch_id):
        raise HTTPException(404, "Branch not found")
    from app.firebase_client import get_db
    db = get_db()
    db.collection("user_branch_assignments").document(
        f"{user['org_id']}:{user_id}"
    ).set({
        "org_id": user["org_id"],
        "user_id": user_id,
        "branch_id": branch_id,
        "assigned_at": _now_iso(),
        "assigned_by": user.get("uid") or user.get("email"),
    })
    return {"success": True, "user_id": user_id, "branch_id": branch_id}


@router.put("/pos-terminals/{terminal_id}/branch")
def assign_pos_terminal_to_branch(
    terminal_id: str,
    data: dict,
    user: dict = Depends(get_current_user),
):
    branch_id = data.get("branch_id")
    if not branch_id:
        raise HTTPException(400, "branch_id required")
    if not BranchRepository(user["org_id"]).get(branch_id):
        raise HTTPException(404, "Branch not found")
    try:
        from app.firestore.pos import POSTerminalRepository  # type: ignore
        repo = POSTerminalRepository(user["org_id"])
        if repo.get(terminal_id):
            repo.update(terminal_id, {"branch_id": branch_id, "updated_at": _now_iso()})
    except Exception:
        pass
    from app.firebase_client import get_db
    db = get_db()
    db.collection("pos_terminal_branches").document(
        f"{user['org_id']}:{terminal_id}"
    ).set({
        "org_id": user["org_id"],
        "terminal_id": terminal_id,
        "branch_id": branch_id,
        "assigned_at": _now_iso(),
    })
    return {"success": True, "terminal_id": terminal_id, "branch_id": branch_id}


@router.get("/{branch_id}")
def get_branch(branch_id: str, user: dict = Depends(get_current_user)):
    repo = BranchRepository(user["org_id"])
    item = repo.get(branch_id)
    if not item:
        raise HTTPException(404, "Branch not found")
    return item


@router.put("/{branch_id}")
def update_branch(branch_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = BranchRepository(user["org_id"])
    if not repo.get(branch_id):
        raise HTTPException(404, "Branch not found")
    data.pop("id", None); data.pop("org_id", None)
    data["updated_at"] = _now_iso()
    return repo.update(branch_id, data)


@router.delete("/{branch_id}")
def archive_branch(branch_id: str, user: dict = Depends(get_current_user)):
    repo = BranchRepository(user["org_id"])
    if not repo.get(branch_id):
        raise HTTPException(404, "Branch not found")
    repo.update(branch_id, {"is_active": False, "archived_at": _now_iso()})
    return {"success": True}
