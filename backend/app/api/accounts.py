import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.accounts import AccountRepository
from app.firestore.journals import JournalEntryRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services.accounting import AccountingService
from app.schemas.schemas import AccountCreate, AccountResponse, JournalEntryCreate, JournalEntryResponse

router = APIRouter(prefix="/api/accounts", tags=["Chart of Accounts"])


# ── R2.4 hardening helpers ────────────────────────────────────────────────
# Iraqi 5-digit chart-of-accounts convention used by the seeded COA
# templates (assets 10000-19999, liabilities 20000-29999, equity 30000-39999,
# revenue 40000-49999, expense 50000-59999). ``income`` is accepted as a
# synonym for ``revenue`` because the existing AccountCreate schema uses the
# Zoho-style ``income`` label.

ACCOUNT_CODE_RANGES = {
    "asset": (10000, 19999),
    "liability": (20000, 29999),
    "equity": (30000, 39999),
    "revenue": (40000, 49999),
    "income": (40000, 49999),
    "expense": (50000, 59999),
}


def _normalize_account_type(t: str) -> str:
    """``income`` is the legacy label; map it to ``revenue`` for range lookup."""
    return "revenue" if t == "income" else t


def _auto_account_code(repo: AccountRepository, account_type: str) -> str:
    """Generate the next available 5-digit code in the type's range.

    Walks the existing account codes within the type's [low, high] window and
    returns ``low + 1 + max_seen_offset``. If the range is exhausted, we fall
    back to ``high`` and let downstream uniqueness checks pick this up (the
    expected real-world range for an SMB COA is well under 1000 entries per
    type).
    """
    low, high = ACCOUNT_CODE_RANGES.get(_normalize_account_type(account_type), (90000, 99999))
    next_code = low
    try:
        items, _ = repo.list(
            filters=[{"field": "account_type", "op": "==", "value": account_type}],
            limit=500,
        )
        used = set()
        for it in items or []:
            code = (it or {}).get("code")
            if code is None:
                continue
            try:
                n = int(str(code).strip())
            except ValueError:
                continue
            if low <= n <= high:
                used.add(n)
        # Walk from low until we find a free slot.
        for n in range(low, high + 1):
            if n not in used:
                next_code = n
                break
        else:
            next_code = high
    except Exception:
        next_code = low
    return str(next_code)


def _ancestor_chain(repo: AccountRepository, start_id: str, max_depth: int = 50):
    """Return ``(chain, cycle_detected)`` for the ancestry of ``start_id``.

    ``chain`` is the ordered list of dicts from ``start_id`` upward; if a node
    points back to one already in the chain, traversal stops and
    ``cycle_detected`` is True.
    """
    chain = []
    seen = set()
    current_id = start_id
    depth = 0
    while current_id and depth < max_depth:
        if current_id in seen:
            return chain, True
        seen.add(current_id)
        try:
            rec = repo.get(current_id)
        except Exception:
            rec = None
        if not rec:
            return chain, False
        chain.append(rec)
        current_id = rec.get("parent_id")
        depth += 1
    return chain, False


@router.get("")
def list_accounts(
    account_type: str = Query("", max_length=30),
    user: dict = Depends(get_current_user),
):
    repo = AccountRepository(user["org_id"])

    filters = [{"field": "is_active", "op": "!=", "value": False}]
    if account_type:
        filters.append({"field": "account_type", "op": "==", "value": account_type})

    items, _ = repo.list(filters=filters, order_by="code", order_dir="ASCENDING", limit=500)
    return items


@router.post("", status_code=201, dependencies=[Depends(require_perm("accounts.create"))])
def create_account(
    data: AccountCreate,
    user: dict = Depends(get_current_user),
):
    repo = AccountRepository(user["org_id"])
    payload = data.model_dump()

    # R2.4 — Validate parent (if supplied): same type + no cycle.
    parent_id = payload.get("parent_id")
    if parent_id:
        parent = None
        try:
            parent = repo.get(parent_id)
        except Exception:
            parent = None
        if not parent:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "account.parent_not_found",
                    "message": "هەژماری سەرەکی نەدۆزرایەوە",
                    "field": "parent_id",
                },
            )
        if parent.get("account_type") != payload.get("account_type"):
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "account.parent_type_mismatch",
                    "message": "جۆری هەژماری سەرەکی و لاوەکی پێویستە یەکسان بێت",
                    "field": "parent_id",
                    "parent_type": parent.get("account_type"),
                    "child_type": payload.get("account_type"),
                },
            )
        # Cycle detection — walk the parent's ancestor chain. If any node
        # appears twice (i.e., the parent's chain already contains a cycle,
        # which would propagate to the new child), reject. We also reject
        # if any ancestor's id matches the new account's parent_id loop —
        # the common case where two existing accounts already point at
        # each other.
        _chain, cycle_found = _ancestor_chain(repo, parent_id)
        if cycle_found:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "account.cycle_detected",
                    "message": "زنجیرەی سەرەکی-لاوەکی دایرە دروست دەکات",
                    "field": "parent_id",
                },
            )

    # R2.4 — Auto-generate a 5-digit code if not provided.
    code = (payload.get("code") or "").strip()
    if not code:
        code = _auto_account_code(repo, payload.get("account_type", ""))
    payload["code"] = code

    account = repo.create({
        "id": str(uuid.uuid4()),
        "is_system": False,
        **payload,
    })
    return account


@router.get("/{account_id}")
def get_account(account_id: str, user: dict = Depends(get_current_user)):
    repo = AccountRepository(user["org_id"])
    account = repo.get(account_id)
    if not account or account.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هەژمار نەدۆزرایەوە")
    return account


# ===== JOURNAL ENTRIES =====
journal_router = APIRouter(prefix="/api/journals", tags=["Journals"])


@journal_router.get("")
def list_journals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    repo = JournalEntryRepository(user["org_id"])
    items, total = repo.list(
        order_by="date",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@journal_router.post("", status_code=201, dependencies=[Depends(require_perm("journals.create"))])
def create_manual_journal(
    data: JournalEntryCreate,
    user: dict = Depends(get_current_user),
):
    lines = [
        {
            "account_id": line.account_id,
            "debit": line.debit,
            "credit": line.credit,
            "description": line.description,
            "contact_id": line.contact_id,
        }
        for line in data.lines
    ]

    journal_date = data.date
    if isinstance(journal_date, str):
        journal_date = datetime.fromisoformat(journal_date.replace("Z", "+00:00")[:19])

    return AccountingService.create_journal_entry(
        org_id=user["org_id"],
        date=journal_date,
        lines=lines,
        description=data.notes or data.reference or "Manual journal entry",
        reference=data.reference or "",
        source_type="manual",
        created_by=user.get("id"),
    )


class ReverseJournalBody(BaseModel):
    reversal_date: str = Field(..., description="YYYY-MM-DD")
    description: str | None = Field(default=None, max_length=500)


@journal_router.post("/{journal_id}/reverse", status_code=201, dependencies=[Depends(require_perm("journals.create"))])
def reverse_journal(
    journal_id: str,
    body: ReverseJournalBody,
    user: dict = Depends(get_current_user),
):
    try:
        rev_date = datetime.fromisoformat(body.reversal_date[:10] + "T12:00:00")
    except ValueError:
        raise HTTPException(status_code=400, detail="ڕێکەوتی گەڕاندنەوە نادروستە")

    return AccountingService.reverse_journal_entry(
        org_id=user["org_id"],
        je_id=journal_id,
        reversal_date=rev_date,
        user_id=user.get("id"),
        description=body.description,
    )


# ===== SUB-ACCOUNTS =====
@router.get("/{account_id}/sub-accounts")
def list_sub_accounts(account_id: str, user: dict = Depends(get_current_user)):
    """List all sub-accounts of a parent account"""
    repo = AccountRepository(user["org_id"])
    account = repo.get(account_id)
    if not account or account.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هەژمار نەدۆزرایەوە")
    
    filters = [
        {"field": "parent_id", "op": "==", "value": account_id},
        {"field": "is_active", "op": "!=", "value": False},
    ]
    items, _ = repo.list(filters=filters, order_by="code", order_dir="ASCENDING", limit=500)
    return items


@router.post("/{account_id}/sub-accounts", status_code=201, dependencies=[Depends(require_perm("accounts.create"))])
def create_sub_account(account_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Create a sub-account under a parent account"""
    repo = AccountRepository(user["org_id"])
    parent = repo.get(account_id)
    if not parent or parent.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="هەژماری سەرەکی نەدۆزرایەوە")
    
    sub_account = repo.create({
        "id": str(uuid.uuid4()),
        "parent_id": account_id,
        "name": data["name"],
        "name_ku": data.get("name_ku", ""),
        "code": data.get("code", ""),
        "account_type": parent["account_type"],  # Inherit from parent
        "description": data.get("description", ""),
        "is_system": False,
    })
    return sub_account


# ===== CURRENCY ADJUSTMENTS =====
@router.post("/currency-adjustment", status_code=201, dependencies=[Depends(require_perm("journals.create"))])
def record_currency_adjustment(data: dict, user: dict = Depends(get_current_user)):
    """Record a base currency adjustment for exchange rate changes"""
    from app.firestore.journals import JournalEntryRepository
    from datetime import datetime
    
    journal_repo = JournalEntryRepository(user["org_id"])
    
    # Create journal entry for the adjustment
    adjustment_amount = float(data.get("adjustment_amount", 0))
    gains_losses_account_id = data.get("gains_losses_account_id")
    
    if not gains_losses_account_id:
        raise HTTPException(status_code=400, detail="هەژماری قازانج/زەرەر پێویستە")
    
    lines = []
    if adjustment_amount > 0:
        # Gain
        lines.append({
            "account_id": data.get("base_currency_account_id"),
            "debit": adjustment_amount,
            "credit": 0,
            "description": data.get("notes", "ڕێکخستنی دراو"),
        })
        lines.append({
            "account_id": gains_losses_account_id,
            "debit": 0,
            "credit": adjustment_amount,
            "description": data.get("notes", "قازانجی نرخی دراو"),
        })
    else:
        # Loss
        lines.append({
            "account_id": gains_losses_account_id,
            "debit": abs(adjustment_amount),
            "credit": 0,
            "description": data.get("notes", "زەرەری نرخی دراو"),
        })
        lines.append({
            "account_id": data.get("base_currency_account_id"),
            "debit": 0,
            "credit": abs(adjustment_amount),
            "description": data.get("notes", "ڕێکخستنی دراو"),
        })
    
    journal = journal_repo.create({
        "id": str(uuid.uuid4()),
        "date": data.get("adjustment_date", datetime.utcnow()),
        "reference": f"CURR-ADJ-{datetime.utcnow().strftime('%Y%m%d')}",
        "notes": data.get("notes", ""),
        "entry_type": "currency_adjustment",
        "status": "posted",
        "exchange_rate": data.get("exchange_rate"),
    })
    
    journal_repo.set_lines(journal["id"], lines)
    return journal
