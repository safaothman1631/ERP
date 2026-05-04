import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body, File, UploadFile
from pydantic import BaseModel
from app.firestore.banking import (
    BankAccountRepository,
    BankTransactionRepository,
    BankRuleRepository,
    BankReconciliationRepository
)
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/banking", tags=["Banking"])


# ==================== SCHEMAS ====================

class BankAccountCreate(BaseModel):
    account_name: str
    account_number: str
    bank_name: str
    account_type: str = "checking"
    currency: str = "IQD"
    opening_balance: float = 0.0
    current_balance: float = 0.0
    is_active: bool = True


class BankAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    account_type: Optional[str] = None
    currency: Optional[str] = None
    current_balance: Optional[float] = None
    is_active: Optional[bool] = None


class BankTransactionCreate(BaseModel):
    bank_account_id: str
    date: str
    transaction_type: str  # "debit" or "credit"
    amount: float
    description: str
    reference: Optional[str] = None
    category: Optional[str] = None
    matched: bool = False
    reconciled: bool = False


class BankTransactionUpdate(BaseModel):
    date: Optional[str] = None
    transaction_type: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    reference: Optional[str] = None
    category: Optional[str] = None
    matched: Optional[bool] = None
    reconciled: Optional[bool] = None


class BankRuleCreate(BaseModel):
    rule_name: str
    condition_field: str  # "description", "reference", "amount"
    condition_operator: str  # "contains", "equals", "greater_than", "less_than"
    condition_value: str
    action_type: str  # "categorize", "tag", "auto_match"
    action_value: str
    is_active: bool = True


class BankRuleUpdate(BaseModel):
    rule_name: Optional[str] = None
    condition_field: Optional[str] = None
    condition_operator: Optional[str] = None
    condition_value: Optional[str] = None
    action_type: Optional[str] = None
    action_value: Optional[str] = None
    is_active: Optional[bool] = None


class ReconciliationComplete(BaseModel):
    statement_date: str
    statement_balance: float
    reconciled_transaction_ids: list[str]


class TransactionMatch(BaseModel):
    transaction_id: str
    matched_document_id: str
    matched_document_type: str  # "invoice", "bill", "expense"


class BankingImportPayload(BaseModel):
    column_map: dict[str, str] = {}
    data: list[dict]


class CompatibilityMatchPayload(BaseModel):
    bank_transaction_ids: list[str]
    system_transaction_ids: list[str]


# ==================== BANK ACCOUNTS ====================

@router.get("/accounts")
def list_bank_accounts(user: dict = Depends(get_current_user)):
    repo = BankAccountRepository(user["org_id"])
    items, _ = repo.list(limit=500)
    return items


@router.post("/accounts", dependencies=[Depends(require_perm("bank.create"))])
def create_bank_account(data: BankAccountCreate, user: dict = Depends(get_current_user)):
    repo = BankAccountRepository(user["org_id"])
    account_id = str(uuid.uuid4())
    account_data = {
        "id": account_id,
        "org_id": user["org_id"],
        "account_name": data.account_name,
        "account_number": data.account_number,
        "bank_name": data.bank_name,
        "account_type": data.account_type,
        "currency": data.currency,
        "opening_balance": data.opening_balance,
        "current_balance": data.current_balance,
        "is_active": data.is_active,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "created_by_id": user["id"]
    }
    return repo.create(account_data)


@router.get("/accounts/{account_id}")
def get_bank_account(account_id: str, user: dict = Depends(get_current_user)):
    repo = BankAccountRepository(user["org_id"])
    account = repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return account


@router.put("/accounts/{account_id}", dependencies=[Depends(require_perm("bank.update"))])
def update_bank_account(account_id: str, data: BankAccountUpdate, user: dict = Depends(get_current_user)):
    repo = BankAccountRepository(user["org_id"])
    account = repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()
    repo.update(account_id, update_data)
    return {**account, **update_data}


@router.delete("/accounts/{account_id}", dependencies=[Depends(require_perm("bank.delete"))])
def delete_bank_account(account_id: str, user: dict = Depends(get_current_user)):
    repo = BankAccountRepository(user["org_id"])
    account = repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    # Soft delete
    repo.update(account_id, {"is_active": False, "updated_at": datetime.utcnow().isoformat()})
    return {"message": "Bank account deactivated"}


# ==================== BANK TRANSACTIONS ====================

@router.get("/transactions")
def list_transactions(
    page: int = Query(1),
    page_size: int = Query(20, le=500),
    bank_account_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    repo = BankTransactionRepository(user["org_id"])
    
    filters = []
    if bank_account_id:
        filters = [{"field": "bank_account_id", "op": "==", "value": bank_account_id}]
    
    items, total = repo.list(
        filters=filters,
        order_by="date",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page-1)*page_size
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/transactions", dependencies=[Depends(require_perm("bank.create"))])
def create_transaction(data: BankTransactionCreate, user: dict = Depends(get_current_user)):
    repo = BankTransactionRepository(user["org_id"])
    transaction_id = str(uuid.uuid4())
    transaction_data = {
        "id": transaction_id,
        "org_id": user["org_id"],
        "bank_account_id": data.bank_account_id,
        "date": data.date,
        "transaction_type": data.transaction_type,
        "amount": data.amount,
        "description": data.description,
        "reference": data.reference,
        "category": data.category,
        "matched": data.matched,
        "reconciled": data.reconciled,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "created_by_id": user["id"]
    }
    created = repo.create(transaction_data)
    
    # Update bank account balance
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(data.bank_account_id)
    if account:
        new_balance = account.get("current_balance", 0.0)
        if data.transaction_type == "credit":
            new_balance += data.amount
        else:
            new_balance -= data.amount
        account_repo.update(data.bank_account_id, {
            "current_balance": new_balance,
            "updated_at": datetime.utcnow().isoformat()
        })
    
    return created


@router.get("/transactions/{transaction_id}")
def get_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    repo = BankTransactionRepository(user["org_id"])
    transaction = repo.get(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@router.put("/transactions/{transaction_id}", dependencies=[Depends(require_perm("bank.update"))])
def update_transaction(transaction_id: str, data: BankTransactionUpdate, user: dict = Depends(get_current_user)):
    repo = BankTransactionRepository(user["org_id"])
    transaction = repo.get(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()
    repo.update(transaction_id, update_data)
    return {**transaction, **update_data}


@router.delete("/transactions/{transaction_id}", dependencies=[Depends(require_perm("bank.delete"))])
def delete_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    repo = BankTransactionRepository(user["org_id"])
    transaction = repo.get(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Update bank account balance
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(transaction["bank_account_id"])
    if account:
        amount = transaction["amount"]
        transaction_type = transaction["transaction_type"]
        new_balance = account.get("current_balance", 0.0)
        if transaction_type == "credit":
            new_balance -= amount
        else:
            new_balance += amount
        account_repo.update(transaction["bank_account_id"], {
            "current_balance": new_balance,
            "updated_at": datetime.utcnow().isoformat()
        })
    
    repo.delete(transaction_id)
    return {"message": "Transaction deleted"}


# ==================== BANK RECONCILIATION ====================

@router.get("/accounts/{account_id}/reconciliation-status")
def get_reconciliation_status(account_id: str, user: dict = Depends(get_current_user)):
    """Get reconciliation status for a bank account"""
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    transaction_repo = BankTransactionRepository(user["org_id"])
    filters = [{"field": "bank_account_id", "op": "==", "value": account_id}]
    
    # Get all transactions
    all_transactions, total = transaction_repo.list(filters=filters, limit=1000)
    
    # Count reconciled vs unreconciled
    reconciled = [t for t in all_transactions if t.get("reconciled", False)]
    unreconciled = [t for t in all_transactions if not t.get("reconciled", False)]
    
    # Get last reconciliation
    recon_repo = BankReconciliationRepository(user["org_id"])
    recon_filters = [{"field": "bank_account_id", "op": "==", "value": account_id}]
    reconciliations, _ = recon_repo.list(filters=recon_filters, order_by="statement_date", order_dir="DESCENDING", limit=1)
    
    last_reconciliation = reconciliations[0] if reconciliations else None
    
    return {
        "bank_account_id": account_id,
        "total_transactions": total,
        "reconciled_count": len(reconciled),
        "unreconciled_count": len(unreconciled),
        "last_reconciliation": last_reconciliation,
        "current_balance": account.get("current_balance", 0.0)
    }


@router.get("/accounts/{account_id}/unreconciled")
def get_unreconciled_transactions(account_id: str, user: dict = Depends(get_current_user)):
    """Get all unreconciled transactions for a bank account"""
    transaction_repo = BankTransactionRepository(user["org_id"])
    filters = [
        {"field": "bank_account_id", "op": "==", "value": account_id},
        {"field": "reconciled", "op": "==", "value": False},
    ]
    unreconciled, total = transaction_repo.list(filters=filters, order_by="date", limit=1000)
    return {"items": unreconciled, "total": total}


@router.get("/accounts/{account_id}/statements")
def get_account_statements(
    account_id: str,
    status: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    filters = [{"field": "bank_account_id", "op": "==", "value": account_id}]
    if status == "unreconciled":
        filters.append({"field": "reconciled", "op": "==", "value": False})

    items, total = BankTransactionRepository(user["org_id"]).list(
        filters=filters,
        order_by="date",
        order_dir="DESCENDING",
        limit=1000,
    )
    return {"items": items, "total": total}


@router.get("/accounts/{account_id}/transactions")
def get_account_transactions(
    account_id: str,
    status: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    filters = [{"field": "bank_account_id", "op": "==", "value": account_id}]
    if status == "unreconciled":
        filters.append({"field": "reconciled", "op": "==", "value": False})

    items, total = BankTransactionRepository(user["org_id"]).list(
        filters=filters,
        order_by="date",
        order_dir="DESCENDING",
        limit=1000,
    )
    return {"items": items, "total": total}


@router.get("/accounts/{account_id}/reconciliation-summary")
def get_reconciliation_summary(account_id: str, user: dict = Depends(get_current_user)):
    """Reconciliation summary with REAL difference calculation.

    system_balance = opening_balance + sum(reconciled credits) - sum(reconciled debits)
    statement_balance = closing balance from latest BankReconciliation record (if any)
    difference = system_balance - statement_balance (zero ⇒ books match bank statement)
    """
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    opening_balance = float(account.get("opening_balance", 0.0) or 0.0)
    current_balance = float(account.get("current_balance", 0.0) or 0.0)

    # Compute system balance from reconciled transactions only
    txn_repo = BankTransactionRepository(user["org_id"])
    reconciled_txns, _ = txn_repo.list(
        filters=[
            {"field": "bank_account_id", "op": "==", "value": account_id},
            {"field": "reconciled", "op": "==", "value": True},
        ],
        limit=10000,
    )
    reconciled_movement = 0.0
    for t in reconciled_txns:
        amt = float(t.get("amount", 0) or 0)
        if t.get("type") == "debit":
            reconciled_movement -= abs(amt)
        else:
            reconciled_movement += abs(amt) if amt > 0 else amt
    system_balance = opening_balance + reconciled_movement

    # Statement balance from latest reconciliation record
    recon_repo = BankReconciliationRepository(user["org_id"])
    recons, _ = recon_repo.list(
        filters=[{"field": "bank_account_id", "op": "==", "value": account_id}],
        order_by="statement_date",
        order_dir="DESCENDING",
        limit=1,
    )
    statement_balance = None
    statement_date = None
    if recons:
        last = recons[0]
        statement_balance = float(last.get("statement_balance", last.get("ending_balance", 0)) or 0)
        statement_date = last.get("statement_date")

    difference = (system_balance - statement_balance) if statement_balance is not None else None

    return {
        "opening_balance": opening_balance,
        "closing_balance": current_balance,
        "system_balance": round(system_balance, 2),
        "statement_balance": statement_balance,
        "statement_date": statement_date,
        "difference": round(difference, 2) if difference is not None else None,
        "reconciled_count": len(reconciled_txns),
    }


@router.post("/accounts/{account_id}/match", dependencies=[Depends(require_perm("bank.update"))])
def compatibility_match_transactions(
    account_id: str,
    data: CompatibilityMatchPayload,
    user: dict = Depends(get_current_user),
):
    repo = BankTransactionRepository(user["org_id"])
    linked_id = data.system_transaction_ids[0] if data.system_transaction_ids else None

    matched_count = 0
    for transaction_id in data.bank_transaction_ids:
        transaction = repo.get(transaction_id)
        if not transaction or transaction.get("bank_account_id") != account_id:
            continue
        repo.update(transaction_id, {
            "matched": True,
            "matched_document_id": linked_id,
            "matched_document_type": "transaction" if linked_id else None,
            "updated_at": datetime.utcnow().isoformat(),
        })
        matched_count += 1

    return {"message": "Transactions matched", "matched_count": matched_count}


@router.post("/accounts/{account_id}/complete-reconciliation", dependencies=[Depends(require_perm("bank.update"))])
def compatibility_complete_reconciliation(account_id: str, user: dict = Depends(get_current_user)):
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    transaction_repo = BankTransactionRepository(user["org_id"])
    unreconciled, _ = transaction_repo.list(
        filters=[
            {"field": "bank_account_id", "op": "==", "value": account_id},
            {"field": "reconciled", "op": "==", "value": False},
        ],
        limit=1000,
    )
    tx_ids = [item["id"] for item in unreconciled]

    if not tx_ids:
        return {"message": "No unreconciled transactions", "reconciled_count": 0}

    return complete_reconciliation(
        account_id,
        ReconciliationComplete(
            statement_date=datetime.utcnow().date().isoformat(),
            statement_balance=float(account.get("current_balance", 0.0) or 0.0),
            reconciled_transaction_ids=tx_ids,
        ),
        user,
    )


@router.post("/accounts/{account_id}/import", dependencies=[Depends(require_perm("bank.create"))])
def compatibility_import_transactions(
    account_id: str,
    payload: BankingImportPayload,
    user: dict = Depends(get_current_user),
):
    account = BankAccountRepository(user["org_id"]).get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    transaction_repo = BankTransactionRepository(user["org_id"])
    imported = []
    for row in payload.data:
        raw_amount = str(row.get("amount", "0") or "0").replace(",", "").strip()
        try:
            amount = float(raw_amount)
        except ValueError:
            amount = 0.0

        imported.append(transaction_repo.create({
            "id": str(uuid.uuid4()),
            "bank_account_id": account_id,
            "date": row.get("date") or datetime.utcnow().date().isoformat(),
            "transaction_type": row.get("type") or ("credit" if amount >= 0 else "debit"),
            "amount": abs(amount),
            "description": row.get("description") or "Imported transaction",
            "reference": row.get("reference"),
            "category": row.get("category"),
            "matched": False,
            "reconciled": False,
            "created_by_id": user["id"],
        }))

    return {"message": "Import completed", "imported_count": len(imported), "items": imported}


@router.post("/accounts/{account_id}/reconcile", dependencies=[Depends(require_perm("bank.update"))])
def start_reconciliation(account_id: str, user: dict = Depends(get_current_user)):
    """Start a new reconciliation session"""
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    # Get unreconciled transactions
    transaction_repo = BankTransactionRepository(user["org_id"])
    filters = [
        {"field": "bank_account_id", "op": "==", "value": account_id},
        {"field": "reconciled", "op": "==", "value": False},
    ]
    unreconciled, total = transaction_repo.list(filters=filters, order_by="date", limit=1000)
    
    return {
        "bank_account_id": account_id,
        "account_name": account.get("account_name"),
        "current_balance": account.get("current_balance", 0.0),
        "unreconciled_transactions": unreconciled,
        "unreconciled_count": total
    }


@router.post("/accounts/{account_id}/reconcile/complete", dependencies=[Depends(require_perm("bank.update"))])
def complete_reconciliation(
    account_id: str,
    data: ReconciliationComplete,
    user: dict = Depends(get_current_user)
):
    """Complete reconciliation and save"""
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    # Mark transactions as reconciled
    transaction_repo = BankTransactionRepository(user["org_id"])
    for tx_id in data.reconciled_transaction_ids:
        transaction_repo.update(tx_id, {
            "reconciled": True,
            "updated_at": datetime.utcnow().isoformat()
        })
    
    # Create reconciliation record
    recon_repo = BankReconciliationRepository(user["org_id"])
    recon_id = str(uuid.uuid4())
    recon_data = {
        "id": recon_id,
        "org_id": user["org_id"],
        "bank_account_id": account_id,
        "statement_date": data.statement_date,
        "statement_balance": data.statement_balance,
        "book_balance": account.get("current_balance", 0.0),
        "reconciled_transaction_count": len(data.reconciled_transaction_ids),
        "created_at": datetime.utcnow().isoformat(),
        "created_by_id": user["id"]
    }
    recon_repo.create(recon_data)
    
    return {
        "message": "Reconciliation completed",
        "reconciliation": recon_data
    }


@router.post("/transactions/{transaction_id}/match", dependencies=[Depends(require_perm("bank.update"))])
def match_transaction(
    transaction_id: str,
    data: TransactionMatch,
    user: dict = Depends(get_current_user)
):
    """Manually match a bank transaction to a document"""
    repo = BankTransactionRepository(user["org_id"])
    transaction = repo.get(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    repo.update(transaction_id, {
        "matched": True,
        "matched_document_id": data.matched_document_id,
        "matched_document_type": data.matched_document_type,
        "updated_at": datetime.utcnow().isoformat()
    })
    
    return {"message": "Transaction matched successfully"}


@router.post("/transactions/{transaction_id}/unmatch", dependencies=[Depends(require_perm("bank.update"))])
def unmatch_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    """Remove match from a bank transaction"""
    repo = BankTransactionRepository(user["org_id"])
    transaction = repo.get(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    repo.update(transaction_id, {
        "matched": False,
        "matched_document_id": None,
        "matched_document_type": None,
        "updated_at": datetime.utcnow().isoformat()
    })
    
    return {"message": "Transaction unmatched successfully"}


@router.post("/accounts/{account_id}/auto-match", dependencies=[Depends(require_perm("bank.update"))])
def auto_match_transactions(account_id: str, user: dict = Depends(get_current_user)):
    """Automatically match transactions based on rules and fuzzy matching"""
    transaction_repo = BankTransactionRepository(user["org_id"])
    filters = [
        {"field": "bank_account_id", "op": "==", "value": account_id},
        {"field": "matched", "op": "==", "value": False},
    ]
    unmatched, total = transaction_repo.list(filters=filters, limit=1000)
    
    # Simple auto-matching logic (can be enhanced)
    matched_count = 0
    for transaction in unmatched:
        # Example: match by reference number
        reference = transaction.get("reference", "")
        if reference and reference.startswith("INV-"):
            # Try to match with invoice
            transaction_repo.update(transaction["id"], {
                "matched": True,
                "matched_document_id": reference,
                "matched_document_type": "invoice",
                "updated_at": datetime.utcnow().isoformat()
            })
            matched_count += 1
    
    return {
        "message": f"Auto-matched {matched_count} transactions",
        "matched_count": matched_count,
        "total_unmatched": total
    }


# ==================== BANK RULES ====================

@router.get("/rules")
def list_bank_rules(user: dict = Depends(get_current_user)):
    """List all banking rules"""
    repo = BankRuleRepository(user["org_id"])
    rules, total = repo.list(limit=500)
    return {"items": rules, "total": total}


@router.post("/rules", dependencies=[Depends(require_perm("bank.create"))])
def create_bank_rule(data: BankRuleCreate, user: dict = Depends(get_current_user)):
    """Create a new banking rule"""
    repo = BankRuleRepository(user["org_id"])
    rule_id = str(uuid.uuid4())
    rule_data = {
        "id": rule_id,
        "org_id": user["org_id"],
        "rule_name": data.rule_name,
        "condition_field": data.condition_field,
        "condition_operator": data.condition_operator,
        "condition_value": data.condition_value,
        "action_type": data.action_type,
        "action_value": data.action_value,
        "is_active": data.is_active,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "created_by_id": user["id"]
    }
    return repo.create(rule_data)


@router.put("/rules/{rule_id}", dependencies=[Depends(require_perm("bank.update"))])
def update_bank_rule(rule_id: str, data: BankRuleUpdate, user: dict = Depends(get_current_user)):
    """Update a banking rule"""
    repo = BankRuleRepository(user["org_id"])
    rule = repo.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()
    repo.update(rule_id, update_data)
    return {**rule, **update_data}


@router.delete("/rules/{rule_id}", dependencies=[Depends(require_perm("bank.delete"))])
def delete_bank_rule(rule_id: str, user: dict = Depends(get_current_user)):
    """Delete a banking rule"""
    repo = BankRuleRepository(user["org_id"])
    rule = repo.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    repo.delete(rule_id)
    return {"message": "Bank rule deleted"}


@router.post("/rules/apply", dependencies=[Depends(require_perm("bank.update"))])
def apply_bank_rules(
    bank_account_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Apply all active rules to unmatched transactions"""
    rule_repo = BankRuleRepository(user["org_id"])
    filters = [{"field": "is_active", "op": "!=", "value": False}]
    rules, _ = rule_repo.list(filters=filters, limit=500)
    
    # Get unmatched transactions
    transaction_repo = BankTransactionRepository(user["org_id"])
    tx_filters = [{"field": "matched", "op": "==", "value": False}]
    if bank_account_id:
        tx_filters.append({"field": "bank_account_id", "op": "==", "value": bank_account_id})
    
    transactions, total = transaction_repo.list(filters=tx_filters, limit=1000)
    
    applied_count = 0
    for transaction in transactions:
        for rule in rules:
            # Check if rule condition matches
            field_value = transaction.get(rule["condition_field"], "")
            condition_value = rule["condition_value"]
            operator = rule["condition_operator"]
            
            matched = False
            if operator == "contains" and condition_value.lower() in str(field_value).lower():
                matched = True
            elif operator == "equals" and str(field_value).lower() == condition_value.lower():
                matched = True
            elif operator == "greater_than" and float(field_value) > float(condition_value):
                matched = True
            elif operator == "less_than" and float(field_value) < float(condition_value):
                matched = True
            
            if matched:
                # Apply rule action
                if rule["action_type"] == "categorize":
                    transaction_repo.update(transaction["id"], {
                        "category": rule["action_value"],
                        "updated_at": datetime.utcnow().isoformat()
                    })
                    applied_count += 1
                elif rule["action_type"] == "tag":
                    tags = transaction.get("tags", [])
                    if rule["action_value"] not in tags:
                        tags.append(rule["action_value"])
                        transaction_repo.update(transaction["id"], {
                            "tags": tags,
                            "updated_at": datetime.utcnow().isoformat()
                        })
                        applied_count += 1
                break  # Apply only first matching rule
    
    return {
        "message": f"Applied {applied_count} rules",
        "rules_count": len(rules),
        "transactions_processed": total,
        "applied_count": applied_count
    }


# ==================== CSV IMPORT ====================

@router.get("/accounts/{account_id}/import/template")
def get_csv_import_template(account_id: str, user: dict = Depends(get_current_user)):
    """Get CSV import template headers and sample row"""
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    return {
        "headers": ["date", "description", "amount", "reference", "type"],
        "sample_row": ["2026-01-01", "Payment from customer", "1000.00", "REF001", "credit"],
        "instructions": {
            "date": "Format: YYYY-MM-DD",
            "description": "Transaction description",
            "amount": "Positive number",
            "reference": "Optional reference number",
            "type": "Either 'credit' or 'debit'"
        }
    }


@router.post("/accounts/{account_id}/import/csv", dependencies=[Depends(require_perm("bank.create"))])
async def import_csv_transactions(
    account_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Upload and import bank transactions from CSV file"""
    import csv
    import io
    
    # Verify account exists
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    # Read and parse CSV
    contents = await file.read()
    try:
        csv_data = contents.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid CSV file encoding. Use UTF-8.")
    
    csv_reader = csv.DictReader(io.StringIO(csv_data))
    
    transaction_repo = BankTransactionRepository(user["org_id"])
    imported = []
    duplicates_skipped = 0
    errors = []
    
    # Get existing transactions to check for duplicates
    existing_filters = [{"field": "bank_account_id", "op": "==", "value": account_id}]
    existing_txs, _ = transaction_repo.list(filters=existing_filters, limit=10000)
    existing_refs = {(tx.get("date"), tx.get("reference"), tx.get("amount")) for tx in existing_txs}
    
    for row_num, row in enumerate(csv_reader, start=2):
        try:
            # Parse row
            date = row.get("date", "").strip()
            description = row.get("description", "").strip()
            amount_str = row.get("amount", "").strip()
            reference = row.get("reference", "").strip()
            tx_type = row.get("type", "").strip().lower()
            
            # Validate
            if not date or not description or not amount_str:
                errors.append(f"Row {row_num}: Missing required fields")
                continue
            
            try:
                amount = float(amount_str)
            except ValueError:
                errors.append(f"Row {row_num}: Invalid amount '{amount_str}'")
                continue
            
            if tx_type not in ["credit", "debit"]:
                errors.append(f"Row {row_num}: Type must be 'credit' or 'debit', got '{tx_type}'")
                continue
            
            # Check for duplicate
            dup_key = (date, reference, amount)
            if dup_key in existing_refs:
                duplicates_skipped += 1
                continue
            
            # Create transaction
            tx_id = str(uuid.uuid4())
            tx_data = {
                "id": tx_id,
                "org_id": user["org_id"],
                "bank_account_id": account_id,
                "date": date,
                "transaction_type": tx_type,
                "amount": amount,
                "description": description,
                "reference": reference,
                "category": "",
                "matched": False,
                "reconciled": False,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "created_by_id": user["id"]
            }
            transaction_repo.create(tx_data)
            imported.append(tx_data)
            existing_refs.add(dup_key)
            
            # Update bank account balance
            new_balance = account.get("current_balance", 0.0)
            if tx_type == "credit":
                new_balance += amount
            else:
                new_balance -= amount
            account.update({"current_balance": new_balance})
            
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
    
    # Final balance update
    if imported:
        account_repo.update(account_id, {
            "current_balance": account.get("current_balance", 0.0),
            "updated_at": datetime.utcnow().isoformat()
        })
    
    return {
        "imported": len(imported),
        "duplicates_skipped": duplicates_skipped,
        "errors": errors,
        "transactions": imported[:10]  # Return first 10 for preview
    }


# ==================== WAVE Q: BANK STATEMENT IMPORT ====================

class ImportStatementPayload(BaseModel):
    format: Optional[str] = None
    mapping: Optional[dict] = None


@router.post("/accounts/{account_id}/import-preview", dependencies=[Depends(require_perm("bank.view"))])
async def import_statement_preview(
    file: UploadFile = File(...),
    format: Optional[str] = Body(None),
    mapping_json: Optional[str] = Body(None),
    account_id: str = None,
    user: dict = Depends(get_current_user)
):
    """Preview bank statement import without saving"""
    from app.services.bank_import_service import detect_format, parse_csv_statement, parse_ofx_statement, parse_mt940_statement, dedupe_transactions
    
    # Verify account
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    # Read file
    contents = await file.read()
    
    # Detect format
    file_format = format or detect_format(file.filename or '', contents)
    
    # Parse
    try:
        if file_format == 'csv':
            import json
            mapping = json.loads(mapping_json) if mapping_json else {}
            txns = parse_csv_statement(contents, mapping)
        elif file_format == 'ofx':
            txns = parse_ofx_statement(contents)
        elif file_format == 'mt940':
            txns = parse_mt940_statement(contents)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {file_format}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse error: {str(e)}")
    
    # Check for duplicates
    unique = dedupe_transactions(user["org_id"], account_id, txns)
    
    return {
        "format": file_format,
        "total_parsed": len(txns),
        "unique_count": len(unique),
        "duplicate_count": len(txns) - len(unique),
        "preview": unique[:20]
    }


@router.post("/accounts/{account_id}/import-statement", dependencies=[Depends(require_perm("bank.create"))])
async def import_statement(
    file: UploadFile = File(...),
    format: Optional[str] = Body(None),
    mapping_json: Optional[str] = Body(None),
    account_id: str = None,
    user: dict = Depends(get_current_user)
):
    """Import bank statement and save transactions"""
    from app.services.bank_import_service import detect_format, parse_csv_statement, parse_ofx_statement, parse_mt940_statement, dedupe_transactions
    
    # Verify account
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    # Read file
    contents = await file.read()
    
    # Detect format
    file_format = format or detect_format(file.filename or '', contents)
    
    # Parse
    try:
        if file_format == 'csv':
            import json
            mapping = json.loads(mapping_json) if mapping_json else {}
            txns = parse_csv_statement(contents, mapping)
        elif file_format == 'ofx':
            txns = parse_ofx_statement(contents)
        elif file_format == 'mt940':
            txns = parse_mt940_statement(contents)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {file_format}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse error: {str(e)}")
    
    # Dedupe
    unique = dedupe_transactions(user["org_id"], account_id, txns)
    
    # Save transactions
    transaction_repo = BankTransactionRepository(user["org_id"])
    imported = []
    errors = []
    
    for idx, txn in enumerate(unique):
        try:
            tx_id = str(uuid.uuid4())
            tx_data = {
                "id": tx_id,
                "org_id": user["org_id"],
                "bank_account_id": account_id,
                "date": txn['date'],
                "transaction_type": txn['debit_or_credit'],
                "amount": txn['amount'],
                "description": txn['description'],
                "reference": txn.get('reference', ''),
                "external_id": txn.get('reference', ''),
                "matched": False,
                "reconciled": False,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "created_by_id": user["id"]
            }
            created = transaction_repo.create(tx_data)
            imported.append(created)
        except Exception as e:
            errors.append(f"Row {idx+1}: {str(e)}")
    
    return {
        "imported": len(imported),
        "skipped": len(txns) - len(unique),
        "errors": errors,
        "preview": imported[:5]
    }


@router.get("/transactions/{txn_id}/match-candidates")
def get_match_candidates(txn_id: str, user: dict = Depends(get_current_user)):
    """Get match candidates for a bank transaction"""
    from app.services.bank_matching_service import find_match_candidates
    
    repo = BankTransactionRepository(user["org_id"])
    txn = repo.get(txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    candidates = find_match_candidates(user["org_id"], txn)
    return {"candidates": candidates}


class ApplyMatchPayload(BaseModel):
    match_type: str
    target_id: str
    action: str = 'link'
    notes: Optional[str] = None


@router.post("/transactions/{txn_id}/match", dependencies=[Depends(require_perm("bank.update"))])
def match_transaction_new(
    data: ApplyMatchPayload,
    txn_id: str = None,
    user: dict = Depends(get_current_user)
):
    """Apply a match to a bank transaction"""
    from app.services.bank_matching_service import apply_match
    
    try:
        result = apply_match(
            user["org_id"],
            txn_id,
            data.match_type,
            data.target_id,
            data.action,
            data.notes
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AutoMatchPayload(BaseModel):
    threshold: int = 90
    dry_run: bool = False


@router.post("/accounts/{account_id}/auto-match-new", dependencies=[Depends(require_perm("bank.update"))])
def auto_match_transactions_new(
    data: AutoMatchPayload,
    account_id: str = None,
    user: dict = Depends(get_current_user)
):
    """Bulk auto-match transactions"""
    from app.services.bank_matching_service import auto_match
    
    account_repo = BankAccountRepository(user["org_id"])
    account = account_repo.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    result = auto_match(user["org_id"], account_id, data.threshold, data.dry_run)
    return result


@router.post("/transactions/{txn_id}/unmatch-new", dependencies=[Depends(require_perm("bank.update"))])
def unmatch_transaction_new(txn_id: str, user: dict = Depends(get_current_user)):
    """Remove match from a transaction"""
    repo = BankTransactionRepository(user["org_id"])
    txn = repo.get(txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    repo.update(txn_id, {
        'matched': False,
        'matched_document_id': None,
        'matched_document_type': None,
        'match_notes': None,
        'updated_at': datetime.utcnow().isoformat()
    })
    
    return {"message": "Transaction unmatched successfully"}
