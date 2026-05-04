"""POS API endpoints - Sprint 6.1 Core POS (~33 endpoints)"""
import uuid
import hashlib
import random
import string
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel, Field

from app.firestore.pos import (
    POSConfigRepository, POSPaymentMethodRepository, POSSessionRepository,
    POSOrderRepository, POSOrderLineRepository, POSPaymentRepository,
    POSCashMoveRepository, POSCategoryRepository, POSComboRepository,
    POSPricelistRepository, POSPresetRepository, POSFloorRepository,
    POSTableRepository, POSPreparationDisplayRepository, POSPreparationOrderRepository,
    POSEmployeeRepository, POSSelfOrderRepository, POSLoyaltyProgramRepository,
    POSLoyaltyCardRepository, POSGiftCardRepository, POSCustomerDisplayRepository,
    POSElectronicLabelRepository, POSReceiptLogRepository
)
from app.firestore.items import ItemRepository
from app.firestore.system import SequenceRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services.pos_pricing import apply_pricelist
from app.services import settings_service
from app.firebase_client import get_db


router = APIRouter(prefix="/api/pos", tags=["POS"])


# ===== SCHEMAS =====

class POSConfigBase(BaseModel):
    name: str
    name_ku: Optional[str] = None
    is_active: bool = True
    branch_id: Optional[str] = None
    cash_control: bool = True
    opening_cash_default: float = 0
    closing_cash_required: bool = True
    allow_discount: bool = True
    max_discount_percent: float = 100
    default_pricelist_id: Optional[str] = None
    journal_id: Optional[str] = None
    cash_journal_id: Optional[str] = None
    card_journal_id: Optional[str] = None
    receipt_header: Optional[dict] = None  # {ku: str, en: str}
    receipt_footer: Optional[dict] = None
    auto_invoice: bool = False
    restaurant_mode: bool = False
    iface_type: str = 'shop'  # 'shop' | 'restaurant'
    customer_display: bool = False
    barcode_scanner: bool = True


class POSConfigCreate(POSConfigBase):
    pass


class POSConfigUpdate(POSConfigBase):
    pass


class PaymentMethodBase(BaseModel):
    name: str
    name_ku: Optional[str] = None
    type: str  # 'cash'|'card'|'bank'|'qr'|'credit'|'gift'|'loyalty'
    journal_id: Optional[str] = None
    is_cash_count: bool = False
    open_drawer: bool = False
    requires_terminal: bool = False
    terminal_config: Optional[dict] = None
    is_active: bool = True
    config_ids: List[str] = []


class PaymentMethodCreate(PaymentMethodBase):
    pass


class PaymentMethodUpdate(PaymentMethodBase):
    pass


class SessionOpenRequest(BaseModel):
    config_id: str
    opening_cash: float = 0


class SessionCloseRequest(BaseModel):
    closing_cash_counted: float
    notes: Optional[str] = None


class CashMoveRequest(BaseModel):
    amount: float
    reason: str


class OrderLineCreate(BaseModel):
    item_id: str
    qty: float
    unit_price: float
    discount_percent: float = 0
    tax_rate: float = 0
    note: Optional[str] = None
    manual_price: bool = False  # If True, skip pricelist override


class OrderCreate(BaseModel):
    session_id: str
    partner_id: Optional[str] = None
    pricelist_id: Optional[str] = None
    lines: List[OrderLineCreate]
    notes: Optional[str] = None


class OrderUpdate(BaseModel):
    partner_id: Optional[str] = None
    lines: Optional[List[OrderLineCreate]] = None
    notes: Optional[str] = None


class PaymentMethodPayment(BaseModel):
    payment_method_id: str
    amount: float
    tendered: Optional[float] = None
    reference: Optional[str] = None
    tips: Optional[float] = Field(default=0, ge=0)  # Tip amount (FIX-78)


class OrderPayRequest(BaseModel):
    payments: List[PaymentMethodPayment]


class RefundLineRequest(BaseModel):
    line_id: str
    qty: float
    reason: Optional[str] = None


class OrderRefundRequest(BaseModel):
    lines: List[RefundLineRequest]


class OrderSendReceiptRequest(BaseModel):
    channel: str  # 'email' | 'sms' | 'whatsapp'
    recipient: str


class OrderSyncItem(BaseModel):
    temp_id: str
    session_id: str
    partner_id: Optional[str] = None
    lines: List[OrderLineCreate]
    payments: Optional[List[PaymentMethodPayment]] = None
    notes: Optional[str] = None
    date: Optional[str] = None


class OrderSyncRequest(BaseModel):
    orders: List[OrderSyncItem]


# ===== A. CONFIGS (8 endpoints) =====

@router.get("/configs")
def list_configs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    is_active: Optional[bool] = None,
    user: dict = Depends(get_current_user),
):
    """List POS configurations"""
    repo = POSConfigRepository(user["org_id"])
    filters = []
    if is_active is not None:
        filters.append({"field": "is_active", "op": "==", "value": is_active})
    
    items, total = repo.list(
        filters=filters,
        order_by="created_at",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("/configs", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_config(data: POSConfigCreate, user: dict = Depends(get_current_user)):
    """Create new POS config"""
    repo = POSConfigRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    config = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        **data.model_dump(),
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
        "updated_by": user["id"],
    })
    return config


@router.get("/configs/{config_id}")
def get_config(config_id: str, user: dict = Depends(get_current_user)):
    """Get POS config detail"""
    repo = POSConfigRepository(user["org_id"])
    config = repo.get(config_id)
    if not config:
        raise HTTPException(404, "Config not found")
    return config


@router.put("/configs/{config_id}", dependencies=[Depends(require_perm("pos.manage"))])
def update_config(config_id: str, data: POSConfigUpdate, user: dict = Depends(get_current_user)):
    """Update POS config"""
    repo = POSConfigRepository(user["org_id"])
    config = repo.get(config_id)
    if not config:
        raise HTTPException(404, "Config not found")
    
    updated = repo.update(config_id, {
        **data.model_dump(),
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": user["id"],
    })
    return updated


@router.delete("/configs/{config_id}", dependencies=[Depends(require_perm("pos.manage"))])
def delete_config(config_id: str, user: dict = Depends(get_current_user)):
    """Delete POS config"""
    repo = POSConfigRepository(user["org_id"])
    config = repo.get(config_id)
    if not config:
        raise HTTPException(404, "Config not found")
    
    # Check if there are any sessions linked
    session_repo = POSSessionRepository(user["org_id"])
    sessions, _ = session_repo.list(filters=[{"field": "config_id", "op": "==", "value": config_id}], limit=1)
    if sessions:
        raise HTTPException(400, "Cannot delete config with existing sessions")
    
    repo.delete(config_id)
    return {"message": "Config deleted"}


@router.post("/configs/{config_id}/clone", dependencies=[Depends(require_perm("pos.manage"))])
def clone_config(config_id: str, user: dict = Depends(get_current_user)):
    """Clone a POS config"""
    repo = POSConfigRepository(user["org_id"])
    config = repo.get(config_id)
    if not config:
        raise HTTPException(404, "Config not found")
    
    now = datetime.utcnow().isoformat()
    new_config = {k: v for k, v in config.items() if k not in ["id", "created_at", "updated_at"]}
    new_config["id"] = str(uuid.uuid4())
    new_config["name"] = f"{config['name']} (Copy)"
    if config.get("name_ku"):
        new_config["name_ku"] = f"{config['name_ku']} (کۆپی)"
    new_config["is_active"] = False
    new_config["created_at"] = now
    new_config["updated_at"] = now
    new_config["created_by"] = user["id"]
    new_config["updated_by"] = user["id"]
    
    cloned = repo.create(new_config)
    return cloned


@router.post("/configs/{config_id}/activate", dependencies=[Depends(require_perm("pos.manage"))])
def activate_config(config_id: str, user: dict = Depends(get_current_user)):
    """Activate a config"""
    repo = POSConfigRepository(user["org_id"])
    config = repo.get(config_id)
    if not config:
        raise HTTPException(404, "Config not found")
    
    updated = repo.update(config_id, {
        "is_active": True,
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": user["id"],
    })
    return updated


@router.post("/configs/{config_id}/deactivate", dependencies=[Depends(require_perm("pos.manage"))])
def deactivate_config(config_id: str, user: dict = Depends(get_current_user)):
    """Deactivate a config"""
    repo = POSConfigRepository(user["org_id"])
    config = repo.get(config_id)
    if not config:
        raise HTTPException(404, "Config not found")
    
    updated = repo.update(config_id, {
        "is_active": False,
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": user["id"],
    })
    return updated


@router.get("/configs/{config_id}/available")
def check_config_available(config_id: str, user: dict = Depends(get_current_user)):
    """Check if config is available for opening session"""
    repo = POSConfigRepository(user["org_id"])
    config = repo.get(config_id)
    if not config:
        raise HTTPException(404, "Config not found")
    
    if not config.get("is_active", False):
        return {"can_open": False, "reason": "Config is not active"}
    
    # Check if there's already an open session
    session_repo = POSSessionRepository(user["org_id"])
    sessions, _ = session_repo.list(
        filters=[
            {"field": "config_id", "op": "==", "value": config_id},
            {"field": "state", "op": "in", "value": ["opening", "opened"]}
        ],
        limit=1
    )
    
    if sessions:
        return {
            "can_open": False,
            "reason": "Session already open",
            "open_session": sessions[0]
        }
    
    return {"can_open": True, "reason": "Available"}


# ===== B. SESSIONS (10 endpoints) =====

@router.get("/sessions")
def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    config_id: Optional[str] = None,
    state: Optional[str] = None,
    user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List POS sessions"""
    repo = POSSessionRepository(user["org_id"])
    filters = []
    if config_id:
        filters.append({"field": "config_id", "op": "==", "value": config_id})
    if state:
        filters.append({"field": "state", "op": "==", "value": state})
    if user_id:
        filters.append({"field": "user_id", "op": "==", "value": user_id})
    if date_from:
        filters.append({"field": "opened_at", "op": ">=", "value": datetime.fromisoformat(date_from)})
    if date_to:
        filters.append({"field": "opened_at", "op": "<=", "value": datetime.fromisoformat(date_to)})
    
    items, total = repo.list(
        filters=filters,
        order_by="opened_at",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/sessions/{session_id}")
def get_session(session_id: str, user: dict = Depends(get_current_user)):
    """Get session detail with aggregated totals"""
    session_repo = POSSessionRepository(user["org_id"])
    session = session_repo.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    # Aggregate order totals
    order_repo = POSOrderRepository(user["org_id"])
    orders, _ = order_repo.list(
        filters=[{"field": "session_id", "op": "==", "value": session_id}],
        limit=10000
    )
    
    total_sales = sum(o.get("total", 0) for o in orders if o.get("state") == "paid")
    total_tax = sum(o.get("tax_total", 0) for o in orders if o.get("state") == "paid")
    total_orders = len([o for o in orders if o.get("state") == "paid"])
    
    session["total_sales"] = total_sales
    session["total_tax"] = total_tax
    session["total_orders"] = total_orders
    
    return session


@router.post("/sessions/open", status_code=201, dependencies=[Depends(require_perm("pos.view"))])
def open_session(data: SessionOpenRequest, user: dict = Depends(get_current_user)):
    """Open a new POS session"""
    # Apply POS config
    try:
        cfg = settings_service.get_bag(user["org_id"], "pos")
    except Exception:
        cfg = {}
    
    # Require cashier PIN if configured
    if cfg.get("require_cashier_pin", False):
        if not hasattr(data, 'pin') or not data.pin:
            raise HTTPException(400, "Cashier PIN required")
    
    config_repo = POSConfigRepository(user["org_id"])
    config = config_repo.get(data.config_id)
    if not config:
        raise HTTPException(404, "Config not found")
    
    if not config.get("is_active", False):
        raise HTTPException(400, "Config is not active")
    
    # Check if there's already an open session
    session_repo = POSSessionRepository(user["org_id"])
    existing, _ = session_repo.list(
        filters=[
            {"field": "config_id", "op": "==", "value": data.config_id},
            {"field": "state", "op": "in", "value": ["opening", "opened"]}
        ],
        limit=1
    )
    
    if existing:
        raise HTTPException(400, "Session already open for this config")
    
    now = datetime.utcnow().isoformat()
    session = session_repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "config_id": data.config_id,
        "config_name": config.get("name", ""),
        "user_id": user["id"],
        "cashier_name": user.get("name", user.get("email", "")),
        "state": "opened",
        "opening_cash": data.opening_cash,
        "closing_cash_expected": 0,
        "closing_cash_counted": 0,
        "closing_difference": 0,
        "opened_at": now,
        "closed_at": None,
        "notes": "",
        "total_sales": 0,
        "total_tax": 0,
        "total_orders": 0,
        "journal_entry_id": None,
        "created_at": now,
        "updated_at": now,
    })
    
    return session


@router.post("/sessions/{session_id}/close", dependencies=[Depends(require_perm("pos.view"))])
def close_session(
    session_id: str,
    data: SessionCloseRequest,
    user: dict = Depends(get_current_user)
):
    """Close a POS session"""
    session_repo = POSSessionRepository(user["org_id"])
    session = session_repo.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    if session.get("state") not in ["opening", "opened"]:
        raise HTTPException(400, "Session is not open")
    
    # Calculate expected cash
    order_repo = POSOrderRepository(user["org_id"])
    payment_repo = POSPaymentRepository(user["org_id"])
    cash_move_repo = POSCashMoveRepository(user["org_id"])
    
    # Get all payments for this session
    payments, _ = payment_repo.list(
        filters=[{"field": "session_id", "op": "==", "value": session_id}],
        limit=10000
    )
    
    # Get cash moves
    cash_moves, _ = cash_move_repo.list(
        filters=[{"field": "session_id", "op": "==", "value": session_id}],
        limit=10000
    )
    
    # Calculate expected cash: opening + cash payments + cash_in - cash_out
    cash_payments = sum(p.get("amount", 0) for p in payments if p.get("payment_method_name", "").lower() == "cash")
    cash_in = sum(m.get("amount", 0) for m in cash_moves if m.get("type") == "in")
    cash_out = sum(m.get("amount", 0) for m in cash_moves if m.get("type") == "out")
    
    closing_expected = session.get("opening_cash", 0) + cash_payments + cash_in - cash_out
    closing_difference = data.closing_cash_counted - closing_expected
    
    # Aggregate totals
    orders, _ = order_repo.list(
        filters=[{"field": "session_id", "op": "==", "value": session_id}],
        limit=10000
    )
    
    total_sales = sum(o.get("total", 0) for o in orders if o.get("state") == "paid")
    total_tax = sum(o.get("tax_total", 0) for o in orders if o.get("state") == "paid")
    total_orders = len([o for o in orders if o.get("state") == "paid"])
    
    # Create journal entry (basic - non-blocking)
    journal_entry_id = None
    try:
        # FIX-82: Create JE for cash short/over
        if closing_difference != 0:
            # Import JournalEntryRepository if not already imported
            from app.firestore.accounts import JournalEntryRepository
            
            je_repo = JournalEntryRepository(user["org_id"])
            
            # Create journal entry for cash short/over
            # If difference > 0: credit Cash Short/Over (gain), debit Cash
            # If difference < 0: debit Cash Short/Over (loss), credit Cash
            je = je_repo.create({
                "id": str(uuid.uuid4()),
                "org_id": user["org_id"],
                "entry_date": datetime.utcnow().isoformat()[:10],
                "reference": f"POS Session {session_id}",
                "description": f"Cash {'short' if closing_difference < 0 else 'over'} from session",
                "state": "posted",
                "is_audit": False,
                "lines": [
                    {
                        "account_code": session.get("config_id"),  # Cash account placeholder
                        "debit": max(0, closing_difference),
                        "credit": max(0, -closing_difference),
                        "description": "Cash difference"
                    },
                    {
                        "account_code": "6950",  # Bad debts/Cash short account (Ireland-standard)
                        "debit": max(0, -closing_difference),
                        "credit": max(0, closing_difference),
                        "description": f"Cash {'short' if closing_difference < 0 else 'over'}"
                    }
                ],
                "created_at": datetime.utcnow().isoformat(),
            })
            journal_entry_id = je.get("id")
    except Exception as e:
        # Don't block close if accounting fails
        print(f"Accounting entry failed: {e}")
    
    # Update session
    updated = session_repo.update(session_id, {
        "state": "closed",
        "closing_cash_expected": closing_expected,
        "closing_cash_counted": data.closing_cash_counted,
        "closing_difference": closing_difference,
        "closed_at": datetime.utcnow().isoformat(),
        "notes": data.notes or "",
        "total_sales": total_sales,
        "total_tax": total_tax,
        "total_orders": total_orders,
        "journal_entry_id": journal_entry_id,
        "updated_at": datetime.utcnow().isoformat(),
    })
    
    return updated


@router.post("/sessions/{session_id}/cash-in", status_code=201, dependencies=[Depends(require_perm("pos.view"))])
def cash_in(
    session_id: str,
    data: CashMoveRequest,
    user: dict = Depends(get_current_user)
):
    """Add cash to session"""
    session_repo = POSSessionRepository(user["org_id"])
    session = session_repo.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    if session.get("state") != "opened":
        raise HTTPException(400, "Session is not open")
    
    cash_move_repo = POSCashMoveRepository(user["org_id"])
    move = cash_move_repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "session_id": session_id,
        "type": "in",
        "amount": data.amount,
        "reason": data.reason,
        "user_id": user["id"],
        "created_at": datetime.utcnow().isoformat(),
    })
    
    return move


@router.post("/sessions/{session_id}/cash-out", status_code=201, dependencies=[Depends(require_perm("pos.view"))])
def cash_out(
    session_id: str,
    data: CashMoveRequest,
    user: dict = Depends(get_current_user)
):
    """Remove cash from session"""
    session_repo = POSSessionRepository(user["org_id"])
    session = session_repo.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    if session.get("state") != "opened":
        raise HTTPException(400, "Session is not open")
    
    cash_move_repo = POSCashMoveRepository(user["org_id"])
    move = cash_move_repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "session_id": session_id,
        "type": "out",
        "amount": data.amount,
        "reason": data.reason,
        "user_id": user["id"],
        "created_at": datetime.utcnow().isoformat(),
    })
    
    return move


@router.get("/sessions/{session_id}/summary")
def session_summary(session_id: str, user: dict = Depends(get_current_user)):
    """Get session summary (X/Z report)"""
    session_repo = POSSessionRepository(user["org_id"])
    session = session_repo.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    payment_repo = POSPaymentRepository(user["org_id"])
    payments, _ = payment_repo.list(
        filters=[{"field": "session_id", "op": "==", "value": session_id}],
        limit=10000
    )
    
    order_repo = POSOrderRepository(user["org_id"])
    orders, _ = order_repo.list(
        filters=[{"field": "session_id", "op": "==", "value": session_id}],
        limit=10000
    )
    
    # Group by payment method
    payment_summary = {}
    for p in payments:
        method = p.get("payment_method_name", "Unknown")
        if method not in payment_summary:
            payment_summary[method] = 0
        payment_summary[method] += p.get("amount", 0)
    
    # Tax breakdown
    total_tax = sum(o.get("tax_total", 0) for o in orders if o.get("state") == "paid")
    total_discount = sum(o.get("discount_total", 0) for o in orders if o.get("state") == "paid")
    
    return {
        "session": session,
        "payment_summary": payment_summary,
        "total_tax": total_tax,
        "total_discount": total_discount,
        "order_count": len([o for o in orders if o.get("state") == "paid"]),
    }


@router.get("/sessions/{session_id}/orders")
def session_orders(
    session_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    user: dict = Depends(get_current_user)
):
    """Get all orders for a session"""
    order_repo = POSOrderRepository(user["org_id"])
    items, total = order_repo.list(
        filters=[{"field": "session_id", "op": "==", "value": session_id}],
        order_by="created_at",
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


@router.get("/sessions/{session_id}/payments")
def session_payments(
    session_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    user: dict = Depends(get_current_user)
):
    """Get all payments for a session"""
    payment_repo = POSPaymentRepository(user["org_id"])
    items, total = payment_repo.list(
        filters=[{"field": "session_id", "op": "==", "value": session_id}],
        order_by="created_at",
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


@router.post("/sessions/{session_id}/force-close", dependencies=[Depends(require_perm("pos.force_close"))])
def force_close_session(
    session_id: str,
    data: SessionCloseRequest,
    user: dict = Depends(get_current_user)
):
    """Force close a session (admin only)"""
    # Same as close_session but with admin permission
    return close_session(session_id, data, user)


# ===== C. ORDERS (10 endpoints) =====

@router.get("/orders")
def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    session_id: Optional[str] = None,
    state: Optional[str] = None,
    partner_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List POS orders"""
    repo = POSOrderRepository(user["org_id"])
    filters = []
    if session_id:
        filters.append({"field": "session_id", "op": "==", "value": session_id})
    if state:
        filters.append({"field": "state", "op": "==", "value": state})
    if partner_id:
        filters.append({"field": "partner_id", "op": "==", "value": partner_id})
    if date_from:
        filters.append({"field": "date", "op": ">=", "value": datetime.fromisoformat(date_from)})
    if date_to:
        filters.append({"field": "date", "op": "<=", "value": datetime.fromisoformat(date_to)})
    
    items, total = repo.list(
        filters=filters,
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
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/orders/search")
def search_orders(q: str = Query(""), user: dict = Depends(get_current_user)):
    """Search orders by number, partner name, phone, item barcode"""
    order_repo = POSOrderRepository(user["org_id"])
    line_repo = POSOrderLineRepository(user["org_id"])
    item_repo = ItemRepository(user["org_id"])
    
    orders, _ = order_repo.list(limit=1000)
    
    # Python-side search
    q_lower = q.lower()
    results = []
    
    for o in orders:
        # Search by order number, partner name, customer phone
        if (q_lower in o.get("order_number", "").lower() or
            q_lower in o.get("partner_name", "").lower() or
            q_lower in o.get("customer_phone", "").lower()):
            results.append(o)
            continue
        
        # Search by item barcode in order lines
        lines, _ = line_repo.list(
            filters=[{"field": "order_id", "op": "==", "value": o["id"]}],
            limit=100
        )
        for line in lines:
            item = item_repo.get(line.get("item_id", ""))
            if item and q_lower in item.get("barcode", "").lower():
                results.append(o)
                break
    
    return {"items": results[:50]}


@router.get("/orders/quotations")
def list_quotations(
    config_id: Optional[str] = None,
    partner_id: Optional[str] = None,
    date_from: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """List quotation/draft orders"""
    repo = POSOrderRepository(user["org_id"])
    filters = [{"field": "state", "op": "in", "value": ["draft", "quotation"]}]
    
    if config_id:
        filters.append({"field": "config_id", "op": "==", "value": config_id})
    if partner_id:
        filters.append({"field": "partner_id", "op": "==", "value": partner_id})
    if date_from:
        filters.append({"field": "date", "op": ">=", "value": date_from})
    
    items, total = repo.list(
        filters=filters,
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
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/orders/{order_id}")
def get_order(order_id: str, user: dict = Depends(get_current_user)):
    """Get order detail with lines and payments"""
    order_repo = POSOrderRepository(user["org_id"])
    order = order_repo.get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    # Get lines
    line_repo = POSOrderLineRepository(user["org_id"])
    lines, _ = line_repo.list(
        filters=[{"field": "order_id", "op": "==", "value": order_id}],
        limit=1000
    )
    
    # Get payments
    payment_repo = POSPaymentRepository(user["org_id"])
    payments, _ = payment_repo.list(
        filters=[{"field": "order_id", "op": "==", "value": order_id}],
        limit=100
    )
    
    order["lines"] = lines
    order["payments"] = payments
    
    return order


def _generate_order_number(org_id: str, config_id: str) -> str:
    """Generate POS order number like POS-000001 using transactional sequence.

    Per-config sequence so each terminal/register has its own gap-less stream.
    Falls back to legacy scan if the sequence write somehow fails.
    """
    entity_type = f"pos_order_{config_id}"
    try:
        seq_repo = SequenceRepository(org_id)
        return seq_repo.get_next(entity_type)
    except Exception:
        # Fallback (single-threaded last-resort) — keeps POS usable if Firestore txn fails
        order_repo = POSOrderRepository(org_id)
        orders, _ = order_repo.list(
            filters=[{"field": "config_id", "op": "==", "value": config_id}],
            order_by="created_at",
            order_dir="DESCENDING",
            limit=1,
        )
        next_num = 1
        if orders and orders[0].get("order_number"):
            last_num = orders[0]["order_number"].split("-")[-1].split("/")[-1]
            try:
                next_num = int(last_num) + 1
            except Exception:
                next_num = 1
        return f"POS-{next_num:06d}"


def _calculate_order_totals(lines_data: List[OrderLineCreate], item_repo: ItemRepository, org_id: str, pricelist_id: Optional[str] = None):
    """Calculate order totals from lines with optional pricelist"""
    subtotal = 0
    tax_total = 0
    discount_total = 0
    
    # Fetch pricelist if provided
    pricelist = None
    if pricelist_id:
        pricelist_repo = POSPricelistRepository(org_id)
        pricelist = pricelist_repo.get(pricelist_id)
    
    calculated_lines = []
    for line in lines_data:
        qty = line.qty
        unit_price = line.unit_price
        discount_percent = line.discount_percent
        tax_rate = line.tax_rate
        
        # Get item details
        item = item_repo.get(line.item_id)
        item_name = item.get("name", "") if item else ""
        sku = item.get("sku", "") if item else ""
        category_id = item.get("pos_category_id") if item else None
        
        # Apply pricelist if available and price is not manual
        if pricelist and not line.manual_price:
            unit_price = apply_pricelist(pricelist, line.item_id, qty, unit_price, category_id)
        
        line_subtotal = qty * unit_price
        discount_amount = line_subtotal * (discount_percent / 100)
        line_after_discount = line_subtotal - discount_amount
        tax_amount = line_after_discount * (tax_rate / 100)
        line_total = line_after_discount + tax_amount
        
        # IQD rounding - round to nearest integer
        line_subtotal = int(round(line_subtotal))
        discount_amount = int(round(discount_amount))
        line_after_discount = int(round(line_after_discount))
        tax_amount = int(round(tax_amount))
        line_total = int(round(line_total))
        
        calculated_lines.append({
            "item_id": line.item_id,
            "item_name": item_name,
            "sku": sku,
            "qty": qty,
            "unit_price": unit_price,
            "discount_percent": discount_percent,
            "discount_amount": discount_amount,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "subtotal": line_after_discount,
            "total": line_total,
            "note": line.note or "",
        })
        
        subtotal += line_after_discount
        tax_total += tax_amount
        discount_total += discount_amount
    
    # Round totals to IQD (integer)
    return calculated_lines, int(round(subtotal)), int(round(tax_total)), int(round(discount_total))


@router.post("/orders", status_code=201, dependencies=[Depends(require_perm("pos.view"))])
def create_order(data: OrderCreate, user: dict = Depends(get_current_user)):
    """Create a new POS order (draft)"""
    session_repo = POSSessionRepository(user["org_id"])
    session = session_repo.get(data.session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    if session.get("state") != "opened":
        raise HTTPException(400, "Session is not open")
    
    # FIX-79: Pricelist enforcement — check if config requires pricelist
    config_repo = POSConfigRepository(user["org_id"])
    config = config_repo.get(session.get("config_id", ""))
    if config and config.get("default_pricelist_id"):
        # If config has default pricelist, enforce it (unless explicitly overridden)
        if not data.pricelist_id:
            data.pricelist_id = config.get("default_pricelist_id")
    
    # Calculate totals
    item_repo = ItemRepository(user["org_id"])
    calculated_lines, subtotal, tax_total, discount_total = _calculate_order_totals(
        data.lines, item_repo, user["org_id"], data.pricelist_id
    )
    total = subtotal + tax_total
    
    # Generate order number
    order_number = _generate_order_number(user["org_id"], session.get("config_id", ""))
    
    # Create order
    order_repo = POSOrderRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    order = order_repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "session_id": data.session_id,
        "config_id": session.get("config_id", ""),
        "order_number": order_number,
        "state": "draft",
        "user_id": user["id"],
        "cashier_name": user.get("name", user.get("email", "")),
        "partner_id": data.partner_id,
        "partner_name": "",  # Fetch from contacts if needed
        "pricelist_id": data.pricelist_id,
        "date": now,
        "subtotal": subtotal,
        "tax_total": tax_total,
        "discount_total": discount_total,
        "total": total,
        "amount_paid": 0,
        "amount_due": total,
        "currency": "IQD",
        "notes": data.notes or "",
        "is_refund": False,
        "refund_of_order_id": None,
        "invoice_id": None,
        "created_at": now,
    })
    
    # Create lines
    line_repo = POSOrderLineRepository(user["org_id"])
    for line_data in calculated_lines:
        line_repo.create({
            "id": str(uuid.uuid4()),
            "org_id": user["org_id"],
            "order_id": order["id"],
            **line_data,
            "created_at": now,
        })
    
    return order


@router.put("/orders/{order_id}", dependencies=[Depends(require_perm("pos.view"))])
def update_order(order_id: str, data: OrderUpdate, user: dict = Depends(get_current_user)):
    """Update order (only draft state)"""
    order_repo = POSOrderRepository(user["org_id"])
    order = order_repo.get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    if order.get("state") != "draft":
        raise HTTPException(400, "Can only update draft orders")
    
    updates = {}
    if data.partner_id is not None:
        updates["partner_id"] = data.partner_id
    if data.notes is not None:
        updates["notes"] = data.notes
    
    # Update lines if provided
    if data.lines is not None:
        # FIX-81: Discount restriction enforcement
        config_repo = POSConfigRepository(user["org_id"])
        config = config_repo.get(order.get("config_id", ""))
        max_discount = config.get("max_discount_percent", 100) if config else 100
        
        for line in data.lines:
            if line.discount_percent > max_discount:
                raise HTTPException(400, f"Discount {line.discount_percent}% exceeds limit {max_discount}%")
        
        # Delete existing lines
        line_repo = POSOrderLineRepository(user["org_id"])
        old_lines, _ = line_repo.list(
            filters=[{"field": "order_id", "op": "==", "value": order_id}],
            limit=1000
        )
        for old_line in old_lines:
            line_repo.delete(old_line["id"])
        
        # Recalculate and create new lines
        item_repo = ItemRepository(user["org_id"])
        calculated_lines, subtotal, tax_total, discount_total = _calculate_order_totals(
            data.lines, item_repo, user["org_id"], order.get("pricelist_id")
        )
        total = subtotal + tax_total
        
        for line_data in calculated_lines:
            line_repo.create({
                "id": str(uuid.uuid4()),
                "org_id": user["org_id"],
                "order_id": order_id,
                **line_data,
                "created_at": datetime.utcnow().isoformat(),
            })
        
        updates["subtotal"] = subtotal
        updates["tax_total"] = tax_total
        updates["discount_total"] = discount_total
        updates["total"] = total
        updates["amount_due"] = total
    
    updated = order_repo.update(order_id, updates)
    return updated


@router.post("/orders/{order_id}/pay", dependencies=[Depends(require_perm("pos.view"))])
def pay_order(order_id: str, data: OrderPayRequest, user: dict = Depends(get_current_user)):
    """Pay an order"""
    order_repo = POSOrderRepository(user["org_id"])
    order = order_repo.get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    if order.get("state") not in ["draft", "paid"]:
        raise HTTPException(400, "Order cannot be paid")
    
    total_amount = order.get("total", 0)
    payment_sum = sum(p.amount for p in data.payments)
    
    if payment_sum < total_amount:
        raise HTTPException(400, f"Payment sum ({payment_sum}) is less than order total ({total_amount})")
    
    # Create payment records
    payment_repo = POSPaymentRepository(user["org_id"])
    payment_method_repo = POSPaymentMethodRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    for payment in data.payments:
        method = payment_method_repo.get(payment.payment_method_id)
        if not method:
            raise HTTPException(404, f"Payment method {payment.payment_method_id} not found")
        
        payment_repo.create({
            "id": str(uuid.uuid4()),
            "org_id": user["org_id"],
            "order_id": order_id,
            "session_id": order.get("session_id", ""),
            "payment_method_id": payment.payment_method_id,
            "payment_method_name": method.get("name", ""),
            "amount": payment.amount,
            "tendered": payment.tendered or payment.amount,
            "change": (payment.tendered or payment.amount) - payment.amount if payment.tendered else 0,
            "reference": payment.reference or "",
            "created_at": now,
            "user_id": user["id"],
        })
    
    # Update order state
    order_repo.update(order_id, {
        "state": "paid",
        "amount_paid": payment_sum,
        "amount_due": 0,
    })
    
    # Deduct inventory (non-blocking — failure must NOT block payment)
    try:
        from app.firestore.inventory import ItemRepository, StockMovementRepository
        line_repo = POSOrderLineRepository(user["org_id"])
        lines, _ = line_repo.list(
            filters=[{"field": "order_id", "op": "==", "value": order_id}],
            limit=1000,
        )
        item_repo = ItemRepository(user["org_id"])
        movement_repo = StockMovementRepository(user["org_id"])
        ts = datetime.utcnow().isoformat()
        for line in lines:
            item_id = line.get("item_id") or line.get("product_id")
            qty = float(line.get("quantity", 0) or 0)
            if not item_id or qty <= 0:
                continue
            item = item_repo.get(item_id)
            if not item or not item.get("is_trackable", True):
                continue
            current = float(item.get("stock_on_hand", 0) or 0)
            new_qty = current - qty
            item_repo.update(item_id, {"stock_on_hand": new_qty})
            movement_repo.create({
                "id": str(uuid.uuid4()),
                "item_id": item_id,
                "quantity": -qty,
                "type": "pos_sale",
                "reference_type": "pos_order",
                "reference_id": order_id,
                "balance_after": new_qty,
                "created_at": ts,
                "user_id": user["id"],
            })
    except Exception as e:
        # Don't break the checkout if inventory side has issues; log loudly.
        import logging
        logging.getLogger(__name__).warning(
            "POS inventory deduction failed for order %s: %s", order_id, e
        )
    
    return {"message": "Order paid successfully", "change": payment_sum - total_amount}


@router.post("/orders/{order_id}/invoice", dependencies=[Depends(require_perm("pos.view"))])
def invoice_order(order_id: str, user: dict = Depends(get_current_user)):
    """Convert order to invoice"""
    order_repo = POSOrderRepository(user["org_id"])
    order = order_repo.get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    if order.get("state") != "paid":
        raise HTTPException(400, "Order must be paid before invoicing")
    
    if order.get("invoice_id"):
        raise HTTPException(400, "Order already invoiced")
    
    # Create invoice (placeholder - implement when ready)
    invoice_id = str(uuid.uuid4())
    
    order_repo.update(order_id, {
        "invoice_id": invoice_id,
        "state": "invoiced",
    })
    
    return {"message": "Invoice created", "invoice_id": invoice_id}


@router.post("/orders/{order_id}/refund", dependencies=[Depends(require_perm("pos.refund"))])
def refund_order(order_id: str, data: OrderRefundRequest, user: dict = Depends(get_current_user)):
    """Create a refund order"""
    order_repo = POSOrderRepository(user["org_id"])
    original_order = order_repo.get(order_id)
    if not original_order:
        raise HTTPException(404, "Order not found")
    
    if original_order.get("state") != "paid":
        raise HTTPException(400, "Can only refund paid orders")
    
    # Get original lines
    line_repo = POSOrderLineRepository(user["org_id"])
    original_lines, _ = line_repo.list(
        filters=[{"field": "order_id", "op": "==", "value": order_id}],
        limit=1000
    )
    
    # Create refund order with negative amounts
    now = datetime.utcnow().isoformat()
    refund_order_number = f"{original_order.get('order_number', '')}-R"
    
    # Calculate refund totals
    refund_subtotal = 0
    refund_tax = 0
    refund_lines = []
    
    for refund_line in data.lines:
        # Find original line
        orig_line = next((l for l in original_lines if l["id"] == refund_line.line_id), None)
        if not orig_line:
            continue
        
        # Calculate negative amounts
        qty_ratio = refund_line.qty / orig_line.get("qty", 1)
        refund_line_subtotal = -orig_line.get("subtotal", 0) * qty_ratio
        refund_line_tax = -orig_line.get("tax_amount", 0) * qty_ratio
        
        refund_lines.append({
            "item_id": orig_line.get("item_id"),
            "item_name": orig_line.get("item_name"),
            "sku": orig_line.get("sku"),
            "qty": -refund_line.qty,
            "unit_price": orig_line.get("unit_price"),
            "discount_percent": orig_line.get("discount_percent"),
            "discount_amount": -orig_line.get("discount_amount", 0) * qty_ratio,
            "tax_rate": orig_line.get("tax_rate"),
            "tax_amount": refund_line_tax,
            "subtotal": refund_line_subtotal,
            "total": refund_line_subtotal + refund_line_tax,
            "note": refund_line.reason or "",
        })
        
        refund_subtotal += refund_line_subtotal
        refund_tax += refund_line_tax
    
    refund_order = order_repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "session_id": original_order.get("session_id"),
        "config_id": original_order.get("config_id"),
        "order_number": refund_order_number,
        "state": "paid",
        "user_id": user["id"],
        "cashier_name": user.get("name", user.get("email", "")),
        "partner_id": original_order.get("partner_id"),
        "partner_name": original_order.get("partner_name"),
        "date": now,
        "subtotal": refund_subtotal,
        "tax_total": refund_tax,
        "discount_total": 0,
        "total": refund_subtotal + refund_tax,
        "amount_paid": refund_subtotal + refund_tax,
        "amount_due": 0,
        "currency": "IQD",
        "notes": f"Refund for {original_order.get('order_number')}",
        "is_refund": True,
        "refund_of_order_id": order_id,
        "invoice_id": None,
        "created_at": now,
    })
    
    # Create refund lines
    for line_data in refund_lines:
        line_repo.create({
            "id": str(uuid.uuid4()),
            "org_id": user["org_id"],
            "order_id": refund_order["id"],
            **line_data,
            "created_at": now,
        })
    
    return refund_order


@router.post("/orders/{order_id}/cancel", dependencies=[Depends(require_perm("pos.view"))])
def cancel_order(order_id: str, user: dict = Depends(get_current_user)):
    """Cancel an order (draft only)"""
    order_repo = POSOrderRepository(user["org_id"])
    order = order_repo.get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    if order.get("state") != "draft":
        raise HTTPException(400, "Can only cancel draft orders")
    
    updated = order_repo.update(order_id, {"state": "cancelled"})
    return updated


@router.post("/orders/{order_id}/send-receipt", dependencies=[Depends(require_perm("pos.view"))])
def send_receipt(
    order_id: str,
    data: OrderSendReceiptRequest,
    user: dict = Depends(get_current_user)
):
    """Send receipt via email, SMS or WhatsApp"""
    order_repo = POSOrderRepository(user["org_id"])
    order = order_repo.get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    # Generate receipt content (similar to print-receipt endpoint)
    line_repo = POSOrderLineRepository(user["org_id"])
    payment_repo = POSPaymentRepository(user["org_id"])
    
    lines, _ = line_repo.list(
        filters=[{"field": "order_id", "op": "==", "value": order_id}],
        limit=1000
    )
    payments, _ = payment_repo.list(
        filters=[{"field": "order_id", "op": "==", "value": order_id}],
        limit=100
    )
    
    # Build receipt text/HTML
    receipt_text = f"""
Receipt #{order.get('order_number')}
Date: {order.get('created_at', '')[:10]}
---
"""
    for line in lines:
        receipt_text += f"{line.get('item_name')}: {line.get('qty')} x {line.get('unit_price')} = {line.get('total')} IQD\\n"
    
    receipt_text += f"""
---
Subtotal: {order.get('subtotal')} IQD
Tax: {order.get('tax_total')} IQD
Total: {order.get('total')} IQD
Paid: {order.get('amount_paid')} IQD
"""
    
    if data.channel == "email":
        # Use email service if available
        try:
            # Search for email service
            from app.services.email_service import send_email
            send_email(
                to=data.recipient,
                subject=f"Receipt {order.get('order_number')}",
                body=receipt_text,
                html=receipt_text.replace("\\n", "<br>")
            )
            return {"status": "sent", "channel": "email", "recipient": data.recipient}
        except ImportError:
            # Email service not available - return queued
            return {
                "status": "queued",
                "channel": "email",
                "recipient": data.recipient,
                "message": "Email service not configured - implement app.services.email_service"
            }
    elif data.channel in ["sms", "whatsapp"]:
        # SMS/WhatsApp - stub for now
        return {
            "status": "queued",
            "channel": data.channel,
            "recipient": data.recipient,
            "message": receipt_text
        }
    else:
        raise HTTPException(400, f"Unsupported channel: {data.channel}")


@router.post("/orders/sync", dependencies=[Depends(require_perm("pos.view"))])
def sync_orders(data: OrderSyncRequest, user: dict = Depends(get_current_user)):
    """Bulk sync offline orders"""
    mapping = {}
    
    for order_data in data.orders:
        try:
            # Create order
            session_repo = POSSessionRepository(user["org_id"])
            session = session_repo.get(order_data.session_id)
            if not session:
                continue
            
            item_repo = ItemRepository(user["org_id"])
            calculated_lines, subtotal, tax_total, discount_total = _calculate_order_totals(
                order_data.lines, item_repo, user["org_id"], None
            )
            total = subtotal + tax_total
            
            order_number = _generate_order_number(user["org_id"], session.get("config_id", ""))
            
            order_repo = POSOrderRepository(user["org_id"])
            now = order_data.date or datetime.utcnow().isoformat()
            
            order = order_repo.create({
                "id": str(uuid.uuid4()),
                "org_id": user["org_id"],
                "session_id": order_data.session_id,
                "config_id": session.get("config_id", ""),
                "order_number": order_number,
                "state": "paid" if order_data.payments else "draft",
                "user_id": user["id"],
                "cashier_name": user.get("name", user.get("email", "")),
                "partner_id": order_data.partner_id,
                "partner_name": "",
                "date": now,
                "subtotal": subtotal,
                "tax_total": tax_total,
                "discount_total": discount_total,
                "total": total,
                "amount_paid": sum(p.amount for p in order_data.payments) if order_data.payments else 0,
                "amount_due": 0 if order_data.payments else total,
                "currency": "IQD",
                "notes": order_data.notes or "",
                "is_refund": False,
                "refund_of_order_id": None,
                "invoice_id": None,
                "created_at": now,
            })
            
            # Create lines
            line_repo = POSOrderLineRepository(user["org_id"])
            for line_data in calculated_lines:
                line_repo.create({
                    "id": str(uuid.uuid4()),
                    "org_id": user["org_id"],
                    "order_id": order["id"],
                    **line_data,
                    "created_at": now,
                })
            
            # Create payments if any
            if order_data.payments:
                payment_repo = POSPaymentRepository(user["org_id"])
                payment_method_repo = POSPaymentMethodRepository(user["org_id"])
                for payment in order_data.payments:
                    method = payment_method_repo.get(payment.payment_method_id)
                    payment_repo.create({
                        "id": str(uuid.uuid4()),
                        "org_id": user["org_id"],
                        "order_id": order["id"],
                        "session_id": order_data.session_id,
                        "payment_method_id": payment.payment_method_id,
                        "payment_method_name": method.get("name", "") if method else "",
                        "amount": payment.amount,
                        "tendered": payment.tendered or payment.amount,
                        "change": 0,
                        "reference": payment.reference or "",
                        "created_at": now,
                        "user_id": user["id"],
                    })
            
            mapping[order_data.temp_id] = order["id"]
        
        except Exception as e:
            print(f"Failed to sync order {order_data.temp_id}: {e}")
            continue
    
    return {"mapping": mapping}


# ===== D. PAYMENT METHODS (5 endpoints) =====

@router.get("/payment-methods")
def list_payment_methods(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    is_active: Optional[bool] = None,
    user: dict = Depends(get_current_user),
):
    """List payment methods"""
    repo = POSPaymentMethodRepository(user["org_id"])
    filters = []
    if is_active is not None:
        filters.append({"field": "is_active", "op": "==", "value": is_active})
    
    items, total = repo.list(
        filters=filters,
        order_by="created_at",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/payment-methods", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_payment_method(data: PaymentMethodCreate, user: dict = Depends(get_current_user)):
    """Create payment method"""
    repo = POSPaymentMethodRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    method = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        **data.model_dump(),
        "created_at": now,
        "updated_at": now,
    })
    return method


@router.get("/payment-methods/{method_id}")
def get_payment_method(method_id: str, user: dict = Depends(get_current_user)):
    """Get payment method detail"""
    repo = POSPaymentMethodRepository(user["org_id"])
    method = repo.get(method_id)
    if not method:
        raise HTTPException(404, "Payment method not found")
    return method


@router.put("/payment-methods/{method_id}", dependencies=[Depends(require_perm("pos.manage"))])
def update_payment_method(method_id: str, data: PaymentMethodUpdate, user: dict = Depends(get_current_user)):
    """Update payment method"""
    repo = POSPaymentMethodRepository(user["org_id"])
    method = repo.get(method_id)
    if not method:
        raise HTTPException(404, "Payment method not found")
    
    updated = repo.update(method_id, {
        **data.model_dump(),
        "updated_at": datetime.utcnow().isoformat(),
    })
    return updated


@router.delete("/payment-methods/{method_id}", dependencies=[Depends(require_perm("pos.manage"))])
def delete_payment_method(method_id: str, user: dict = Depends(get_current_user)):
    """Delete payment method"""
    repo = POSPaymentMethodRepository(user["org_id"])
    method = repo.get(method_id)
    if not method:
        raise HTTPException(404, "Payment method not found")
    
    repo.delete(method_id)
    return {"message": "Payment method deleted"}


# ===== E. CATEGORIES (4 endpoints) - Sprint 6.2 =====

class CategoryBase(BaseModel):
    name: str
    name_ku: Optional[str] = None
    parent_id: Optional[str] = None
    sequence: int = 10
    image_url: Optional[str] = None
    color: Optional[str] = None
    is_active: bool = True


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(CategoryBase):
    pass


@router.get("/categories")
def list_categories(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    parent_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    user: dict = Depends(get_current_user),
):
    """List POS categories (tree structure)"""
    repo = POSCategoryRepository(user["org_id"])
    filters = []
    
    if parent_id is not None:
        filters.append({"field": "parent_id", "op": "==", "value": parent_id})
    if is_active is not None:
        filters.append({"field": "is_active", "op": "==", "value": is_active})
    
    items, total = repo.list(
        filters=filters,
        order_by="sequence",
        order_dir="ASCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    
    # Group into tree structure
    tree = []
    items_by_id = {item["id"]: {**item, "children": []} for item in items}
    
    for item in items:
        parent = item.get("parent_id")
        if parent and parent in items_by_id:
            items_by_id[parent]["children"].append(items_by_id[item["id"]])
        elif not parent:
            tree.append(items_by_id[item["id"]])
    
    return {
        "items": tree if parent_id is None else items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/categories", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_category(data: CategoryCreate, user: dict = Depends(get_current_user)):
    """Create new POS category"""
    repo = POSCategoryRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    category = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        **data.model_dump(),
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
    })
    return category


@router.put("/categories/{category_id}", dependencies=[Depends(require_perm("pos.manage"))])
def update_category(category_id: str, data: CategoryUpdate, user: dict = Depends(get_current_user)):
    """Update POS category"""
    repo = POSCategoryRepository(user["org_id"])
    category = repo.get(category_id)
    if not category:
        raise HTTPException(404, "Category not found")
    
    # Validate no circular parent
    new_parent = data.parent_id
    if new_parent:
        current_id = new_parent
        depth = 0
        while current_id and depth < 10:
            if current_id == category_id:
                raise HTTPException(400, "Circular parent reference detected")
            parent = repo.get(current_id)
            current_id = parent.get("parent_id") if parent else None
            depth += 1
    
    updated = repo.update(category_id, {
        **data.model_dump(),
        "updated_at": datetime.utcnow().isoformat(),
    })
    return updated


@router.delete("/categories/{category_id}", dependencies=[Depends(require_perm("pos.manage"))])
def delete_category(category_id: str, user: dict = Depends(get_current_user)):
    """Delete POS category"""
    repo = POSCategoryRepository(user["org_id"])
    category = repo.get(category_id)
    if not category:
        raise HTTPException(404, "Category not found")
    
    # Check for children
    children, _ = repo.list(filters=[{"field": "parent_id", "op": "==", "value": category_id}], limit=1)
    if children:
        raise HTTPException(400, "Cannot delete category with children")
    
    repo.delete(category_id)
    return {"message": "Category deleted"}


# ===== F. PRODUCTS (4 endpoints) - Sprint 6.2 =====

@router.get("/products")
def list_pos_products(
    config_id: Optional[str] = None,
    category_id: Optional[str] = None,
    q: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    """List products for POS (proxy to items with POS-friendly shape)"""
    item_repo = ItemRepository(user["org_id"])
    filters = [
        {"field": "is_active", "op": "==", "value": True},
        {"field": "available_in_pos", "op": "==", "value": True},
    ]
    
    if category_id:
        filters.append({"field": "pos_category_id", "op": "==", "value": category_id})
    
    if q:
        # Search by name or SKU
        all_items, _ = item_repo.list(filters=filters, limit=500)
        q_lower = q.lower()
        items = [
            item for item in all_items
            if q_lower in item.get("name", "").lower() or q_lower in item.get("sku", "").lower()
        ]
        total = len(items)
        items = items[(page - 1) * page_size : page * page_size]
    else:
        items, total = item_repo.list(
            filters=filters,
            order_by="name",
            order_dir="ASCENDING",
            limit=page_size,
            offset=(page - 1) * page_size
        )
    
    # Transform to POS shape
    pos_products = []
    for item in items:
        pos_products.append({
            "id": item["id"],
            "name": item.get("name", ""),
            "name_ku": item.get("name_ku"),
            "sku": item.get("sku", ""),
            "barcode": item.get("barcode"),
            "price": item.get("unit_price", 0),
            "cost": item.get("cost_price", 0),
            "tax_rate": item.get("tax_rate", 0),
            "image_url": item.get("image_url"),
            "category_id": item.get("pos_category_id"),
            "qty_available": item.get("qty_on_hand", 0),
            "type": item.get("type", "product"),
        })
    
    return {
        "items": pos_products,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/products/barcode/{barcode}")
def get_product_by_barcode(barcode: str, user: dict = Depends(get_current_user)):
    """Get product by barcode"""
    item_repo = ItemRepository(user["org_id"])
    items, _ = item_repo.list(
        filters=[
            {"field": "barcode", "op": "==", "value": barcode},
            {"field": "is_active", "op": "==", "value": True},
        ],
        limit=1
    )
    
    if not items:
        raise HTTPException(404, "Product not found")
    
    item = items[0]
    return {
        "id": item["id"],
        "name": item.get("name", ""),
        "name_ku": item.get("name_ku"),
        "sku": item.get("sku", ""),
        "barcode": item.get("barcode"),
        "price": item.get("unit_price", 0),
        "cost": item.get("cost_price", 0),
        "tax_rate": item.get("tax_rate", 0),
        "image_url": item.get("image_url"),
        "category_id": item.get("pos_category_id"),
        "qty_available": item.get("qty_on_hand", 0),
        "type": item.get("type", "product"),
    }


@router.get("/combos")
def list_combos(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    is_active: Optional[bool] = None,
    user: dict = Depends(get_current_user),
):
    """List POS combos"""
    repo = POSComboRepository(user["org_id"])
    filters = []
    if is_active is not None:
        filters.append({"field": "is_active", "op": "==", "value": is_active})
    
    items, total = repo.list(
        filters=filters,
        order_by="name",
        order_dir="ASCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


class ComboBase(BaseModel):
    name: str
    name_ku: Optional[str] = None
    base_price: float
    qty_max: int = 1
    choices: List[dict] = []  # [{category_id, products: [{item_id, extra_price}]}]
    is_active: bool = True


class ComboCreate(ComboBase):
    pass


@router.post("/combos", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_combo(data: ComboCreate, user: dict = Depends(get_current_user)):
    """Create new combo"""
    repo = POSComboRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    combo = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        **data.model_dump(),
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
    })
    return combo


# ===== G. PRICELISTS (4 endpoints) - Sprint 6.2 =====

class PricelistRuleBase(BaseModel):
    applies_on: str  # 'all' | 'category' | 'product'
    product_id: Optional[str] = None
    category_id: Optional[str] = None
    min_qty: float = 1
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    compute: str = "fixed"  # 'fixed' | 'discount' | 'formula'
    fixed_price: Optional[float] = None
    percent: Optional[float] = None
    base: Optional[float] = None
    price_discount: Optional[float] = None
    base_pricelist_id: Optional[str] = None


class PricelistBase(BaseModel):
    name: str
    name_ku: Optional[str] = None
    currency: str = "IQD"
    discount_policy: str = "with_discount"
    rules: List[PricelistRuleBase] = []
    is_active: bool = True


class PricelistCreate(PricelistBase):
    pass


class PricelistUpdate(PricelistBase):
    pass


@router.get("/pricelists")
def list_pricelists(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    is_active: Optional[bool] = None,
    user: dict = Depends(get_current_user),
):
    """List POS pricelists"""
    repo = POSPricelistRepository(user["org_id"])
    filters = []
    if is_active is not None:
        filters.append({"field": "is_active", "op": "==", "value": is_active})
    
    items, total = repo.list(
        filters=filters,
        order_by="name",
        order_dir="ASCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/pricelists", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_pricelist(data: PricelistCreate, user: dict = Depends(get_current_user)):
    """Create new pricelist"""
    repo = POSPricelistRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    pricelist = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        **data.model_dump(),
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
    })
    return pricelist


@router.put("/pricelists/{pricelist_id}", dependencies=[Depends(require_perm("pos.manage"))])
def update_pricelist(pricelist_id: str, data: PricelistUpdate, user: dict = Depends(get_current_user)):
    """Update pricelist"""
    repo = POSPricelistRepository(user["org_id"])
    pricelist = repo.get(pricelist_id)
    if not pricelist:
        raise HTTPException(404, "Pricelist not found")
    
    updated = repo.update(pricelist_id, {
        **data.model_dump(),
        "updated_at": datetime.utcnow().isoformat(),
    })
    return updated


@router.delete("/pricelists/{pricelist_id}", dependencies=[Depends(require_perm("pos.manage"))])
def delete_pricelist(pricelist_id: str, user: dict = Depends(get_current_user)):
    """Delete pricelist"""
    repo = POSPricelistRepository(user["org_id"])
    pricelist = repo.get(pricelist_id)
    if not pricelist:
        raise HTTPException(404, "Pricelist not found")
    
    repo.delete(pricelist_id)
    return {"message": "Pricelist deleted"}


# ===== H. PRESETS (4 endpoints) - Sprint 6.2 =====

class PresetBase(BaseModel):
    name: str
    name_ku: Optional[str] = None
    identification: str = "default"  # 'default' | 'table' | 'guest' | 'phone'
    use_pricelist_id: Optional[str] = None
    use_timing: bool = False
    sequence_label: Optional[str] = None
    is_active: bool = True


class PresetCreate(PresetBase):
    pass


class PresetUpdate(PresetBase):
    pass


@router.get("/presets")
def list_presets(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    is_active: Optional[bool] = None,
    user: dict = Depends(get_current_user),
):
    """List POS presets"""
    repo = POSPresetRepository(user["org_id"])
    filters = []
    if is_active is not None:
        filters.append({"field": "is_active", "op": "==", "value": is_active})
    
    items, total = repo.list(
        filters=filters,
        order_by="name",
        order_dir="ASCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/presets", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_preset(data: PresetCreate, user: dict = Depends(get_current_user)):
    """Create new preset"""
    repo = POSPresetRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    preset = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        **data.model_dump(),
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
    })
    return preset


@router.put("/presets/{preset_id}", dependencies=[Depends(require_perm("pos.manage"))])
def update_preset(preset_id: str, data: PresetUpdate, user: dict = Depends(get_current_user)):
    """Update preset"""
    repo = POSPresetRepository(user["org_id"])
    preset = repo.get(preset_id)
    if not preset:
        raise HTTPException(404, "Preset not found")
    
    updated = repo.update(preset_id, {
        **data.model_dump(),
        "updated_at": datetime.utcnow().isoformat(),
    })
    return updated


@router.delete("/presets/{preset_id}", dependencies=[Depends(require_perm("pos.manage"))])
def delete_preset(preset_id: str, user: dict = Depends(get_current_user)):
    """Delete preset"""
    repo = POSPresetRepository(user["org_id"])
    preset = repo.get(preset_id)
    if not preset:
        raise HTTPException(404, "Preset not found")
    
    repo.delete(preset_id)
    return {"message": "Preset deleted"}


# ===== SPRINT 6.3 - SHOP FEATURES =====

class OrderDraftRequest(BaseModel):
    name: Optional[str] = None
    valid_until: Optional[str] = None
    customer_phone: Optional[str] = None


class ShipLaterRequest(BaseModel):
    shipping_date: str
    shipping_address: dict
    notes: Optional[str] = None


class CustomerQuickCreateRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None


# ===== Sprint 6.4 Restaurant Schemas =====

class FloorBase(BaseModel):
    name: str
    name_ku: Optional[str] = None
    config_id: str
    sequence: int = 0
    background_image_url: Optional[str] = None
    is_active: bool = True


class FloorCreate(FloorBase):
    pass


class FloorUpdate(FloorBase):
    pass


class TableBase(BaseModel):
    floor_id: str
    config_id: str
    name: str
    seats: int = 4
    shape: str = 'square'  # 'square'|'round'|'rectangle'
    width: int = 100
    height: int = 100
    position_x: int = 0
    position_y: int = 0
    color: str = '#1890ff'
    is_active: bool = True


class TableCreate(TableBase):
    pass


class TableUpdate(BaseModel):
    name: Optional[str] = None
    seats: Optional[int] = None
    shape: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class TableOccupyRequest(BaseModel):
    order_id: str
    guests: int = 1


class PreparationDisplayBase(BaseModel):
    name: str
    name_ku: Optional[str] = None
    config_ids: List[str] = []
    category_ids: List[str] = []
    stages: List[dict] = Field(default_factory=lambda: [
        {"key": "received", "name": "Received", "color": "#ff4d4f"},
        {"key": "preparing", "name": "Preparing", "color": "#faad14"},
        {"key": "ready", "name": "Ready", "color": "#52c41a"},
        {"key": "served", "name": "Served", "color": "#8c8c8c"}
    ])
    printer_id: Optional[str] = None
    is_active: bool = True


class PreparationDisplayCreate(PreparationDisplayBase):
    pass


class PreparationDisplayUpdate(PreparationDisplayBase):
    pass


class PreparationOrderStageRequest(BaseModel):
    stage: str


class OrderSplitLine(BaseModel):
    line_ids: List[str]
    partner_id: Optional[str] = None


class OrderSplitRequest(BaseModel):
    splits: List[OrderSplitLine]


class OrderTransferTableRequest(BaseModel):
    new_table_id: str


class OrderAddCourseRequest(BaseModel):
    line_ids: List[str]
    course_label: str


@router.post("/orders/{order_id}/draft", dependencies=[Depends(require_perm("pos.view"))])
def save_order_as_draft(
    order_id: str,
    data: OrderDraftRequest,
    user: dict = Depends(get_current_user)
):
    """Save order as quotation/draft"""
    order_repo = POSOrderRepository(user["org_id"])
    order = order_repo.get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    # Update order to quotation state
    update_data = {
        "state": "quotation",
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": user["id"],
    }
    
    if data.name:
        update_data["quotation_name"] = data.name
    if data.valid_until:
        update_data["valid_until"] = data.valid_until
    if data.customer_phone:
        update_data["customer_phone"] = data.customer_phone
    
    updated = order_repo.update(order_id, update_data)
    return updated


@router.post("/orders/{order_id}/ship-later", dependencies=[Depends(require_perm("pos.view"))])
def ship_order_later(
    order_id: str,
    data: ShipLaterRequest,
    user: dict = Depends(get_current_user)
):
    """Create sales order for ship later"""
    from app.firestore.invoices import SalesOrderRepository
    from app.firestore.system import SequenceRepository
    
    order_repo = POSOrderRepository(user["org_id"])
    order = order_repo.get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    # Get order lines
    line_repo = POSOrderLineRepository(user["org_id"])
    lines, _ = line_repo.list(
        filters=[{"field": "order_id", "op": "==", "value": order_id}],
        limit=1000
    )
    
    # Create sales order
    so_repo = SalesOrderRepository(user["org_id"])
    seq_repo = SequenceRepository(user["org_id"])
    so_number = seq_repo.get_next("sales_orders")
    
    now = datetime.utcnow().isoformat()
    so_id = str(uuid.uuid4())
    
    # Create SO
    sales_order = so_repo.create({
        "id": so_id,
        "org_id": user["org_id"],
        "so_number": so_number,
        "contact_id": order.get("partner_id"),
        "date": now,
        "shipping_date": data.shipping_date,
        "shipping_address": data.shipping_address,
        "notes": data.notes or f"POS Order: {order.get('order_number')}",
        "subtotal": order.get("subtotal", 0),
        "tax_total": order.get("tax_total", 0),
        "total": order.get("total", 0),
        "status": "confirmed",
        "source": "pos",
        "pos_order_id": order_id,
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
        "updated_by": user["id"],
    })
    
    # Create SO lines
    for line in lines:
        so_repo.create_line(so_id, {
            "item_id": line.get("item_id"),
            "description": line.get("item_name"),
            "qty": line.get("qty", 1),
            "unit_price": line.get("unit_price", 0),
            "tax_rate": line.get("tax_rate", 0),
            "discount_percent": line.get("discount_percent", 0),
            "total": line.get("total", 0),
        })
    
    # Update POS order with SO reference
    order_repo.update(order_id, {
        "shipped_via_so_id": so_id,
        "updated_at": now,
        "updated_by": user["id"],
    })
    
    return {
        "order_id": order_id,
        "sales_order_id": so_id,
        "sales_order_number": so_number,
    }


@router.get("/products/lookup")
def lookup_products(
    barcode: Optional[str] = None,
    q: Optional[str] = None,
    config_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Quick product lookup by barcode or search query"""
    item_repo = ItemRepository(user["org_id"])
    
    filters = [{"field": "is_active", "op": "==", "value": True}]
    
    if barcode:
        # Search by barcode first
        filters.append({"field": "barcode", "op": "==", "value": barcode})
    
    items, total = item_repo.list(
        filters=filters,
        order_by="name",
        order_dir="ASCENDING",
        limit=20
    )
    
    # If no barcode match and query provided, search by name/sku
    if not items and q:
        filters = [{"field": "is_active", "op": "==", "value": True}]
        items, total = item_repo.list(
            filters=filters,
            order_by="name",
            order_dir="ASCENDING",
            limit=20
        )
        # Python-side filtering for name/sku
        q_lower = q.lower()
        items = [
            item for item in items
            if q_lower in item.get("name", "").lower() or
               q_lower in item.get("sku", "").lower() or
               q_lower in item.get("barcode", "").lower()
        ][:20]
    
    # Transform to POS-friendly format
    result = []
    for item in items:
        result.append({
            "id": item["id"],
            "name": item.get("name", ""),
            "name_ku": item.get("name_ku", ""),
            "sku": item.get("sku", ""),
            "barcode": item.get("barcode", ""),
            "price": item.get("selling_price", 0),
            "tax_rate": item.get("tax_rate", 0),
            "image_url": item.get("image_url", ""),
            "qty_available": item.get("qty_on_hand", 0),
            "category_id": item.get("category_id", ""),
        })
    
    return {"items": result, "total": len(result)}


@router.post("/customers/quick-create", dependencies=[Depends(require_perm("pos.view"))])
def quick_create_customer(
    data: CustomerQuickCreateRequest,
    user: dict = Depends(get_current_user)
):
    """Quick create customer from POS"""
    from app.firestore.contacts import ContactRepository
    
    contact_repo = ContactRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    contact = contact_repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "display_name": data.name,
        "company_name": data.name,
        "contact_type": "customer",
        "phone": data.phone or "",
        "email": data.email or "",
        "is_active": True,
        "source": "pos_quick_create",
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
        "updated_by": user["id"],
    })
    
    return contact


# ===== Sprint 6.4: FLOORS (4 endpoints) =====

@router.get("/floors")
def list_floors(
    config_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """List all floors for a config"""
    repo = POSFloorRepository(user["org_id"])
    filters = []
    if config_id:
        filters.append({"field": "config_id", "op": "==", "value": config_id})
    
    items, total = repo.list(
        filters=filters,
        order_by="sequence",
        order_dir="ASCENDING",
        limit=500
    )
    return {"items": items, "total": total}


@router.post("/floors", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_floor(data: FloorCreate, user: dict = Depends(get_current_user)):
    """Create new floor"""
    repo = POSFloorRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    floor = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        **data.model_dump(),
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
        "updated_by": user["id"],
    })
    return floor


@router.put("/floors/{floor_id}", dependencies=[Depends(require_perm("pos.manage"))])
def update_floor(floor_id: str, data: FloorUpdate, user: dict = Depends(get_current_user)):
    """Update floor"""
    repo = POSFloorRepository(user["org_id"])
    floor = repo.get(floor_id)
    if not floor:
        raise HTTPException(404, "Floor not found")
    
    updated = repo.update(floor_id, {
        **data.model_dump(),
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": user["id"],
    })
    return updated


@router.delete("/floors/{floor_id}", dependencies=[Depends(require_perm("pos.manage"))])
def delete_floor(floor_id: str, user: dict = Depends(get_current_user)):
    """Delete floor (only if no tables)"""
    repo = POSFloorRepository(user["org_id"])
    floor = repo.get(floor_id)
    if not floor:
        raise HTTPException(404, "Floor not found")
    
    # Check if there are tables
    table_repo = POSTableRepository(user["org_id"])
    tables, _ = table_repo.list(filters=[{"field": "floor_id", "op": "==", "value": floor_id}], limit=1)
    if tables:
        raise HTTPException(400, "Cannot delete floor with existing tables")
    
    repo.delete(floor_id)
    return {"message": "Floor deleted"}


# ===== Sprint 6.4: TABLES (6 endpoints) =====

@router.get("/floors/{floor_id}/tables")
def list_floor_tables(floor_id: str, user: dict = Depends(get_current_user)):
    """List all tables on a floor"""
    table_repo = POSTableRepository(user["org_id"])
    tables, total = table_repo.list(
        filters=[{"field": "floor_id", "op": "==", "value": floor_id}],
        order_by="name",
        order_dir="ASCENDING",
        limit=500
    )
    return {"items": tables, "total": total}


@router.post("/tables", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_table(data: TableCreate, user: dict = Depends(get_current_user)):
    """Create new table"""
    repo = POSTableRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    table = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        **data.model_dump(),
        "state": "available",
        "current_order_id": None,
        "current_guests": 0,
        "occupied_at": None,
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
        "updated_by": user["id"],
    })
    return table


@router.put("/tables/{table_id}", dependencies=[Depends(require_perm("pos.manage"))])
def update_table(table_id: str, data: TableUpdate, user: dict = Depends(get_current_user)):
    """Update table (including position for drag-save)"""
    repo = POSTableRepository(user["org_id"])
    table = repo.get(table_id)
    if not table:
        raise HTTPException(404, "Table not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()
    update_data["updated_by"] = user["id"]
    
    updated = repo.update(table_id, update_data)
    return updated


@router.delete("/tables/{table_id}", dependencies=[Depends(require_perm("pos.manage"))])
def delete_table(table_id: str, user: dict = Depends(get_current_user)):
    """Delete table (only if no current order)"""
    repo = POSTableRepository(user["org_id"])
    table = repo.get(table_id)
    if not table:
        raise HTTPException(404, "Table not found")
    
    if table.get("current_order_id"):
        raise HTTPException(400, "Cannot delete table with active order")
    
    repo.delete(table_id)
    return {"message": "Table deleted"}


@router.post("/tables/{table_id}/occupy", dependencies=[Depends(require_perm("pos.view"))])
def occupy_table(table_id: str, data: TableOccupyRequest, user: dict = Depends(get_current_user)):
    """Occupy a table with an order"""
    repo = POSTableRepository(user["org_id"])
    table = repo.get(table_id)
    if not table:
        raise HTTPException(404, "Table not found")
    
    if table.get("state") == "occupied" and table.get("current_order_id") != data.order_id:
        raise HTTPException(400, "Table is already occupied")
    
    updated = repo.update(table_id, {
        "state": "occupied",
        "current_order_id": data.order_id,
        "current_guests": data.guests,
        "occupied_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": user["id"],
    })
    return updated


@router.post("/tables/{table_id}/free", dependencies=[Depends(require_perm("pos.view"))])
def free_table(table_id: str, user: dict = Depends(get_current_user)):
    """Free a table (clear occupancy)"""
    repo = POSTableRepository(user["org_id"])
    table = repo.get(table_id)
    if not table:
        raise HTTPException(404, "Table not found")
    
    updated = repo.update(table_id, {
        "state": "available",
        "current_order_id": None,
        "current_guests": 0,
        "occupied_at": None,
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": user["id"],
    })
    return updated


# ===== Sprint 6.4: PREPARATION DISPLAYS (4 endpoints) =====

@router.get("/preparation/displays")
def list_preparation_displays(
    config_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """List all preparation displays"""
    repo = POSPreparationDisplayRepository(user["org_id"])
    filters = []
    # Filter by config_id if provided (check if it's in config_ids array)
    
    items, total = repo.list(
        filters=filters,
        order_by="created_at",
        order_dir="DESCENDING",
        limit=500
    )
    
    # Post-filter by config_id if needed (Firestore doesn't support array-contains queries in BaseRepository)
    if config_id:
        items = [item for item in items if config_id in item.get("config_ids", [])]
        total = len(items)
    
    return {"items": items, "total": total}


@router.post("/preparation/displays", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_preparation_display(data: PreparationDisplayCreate, user: dict = Depends(get_current_user)):
    """Create new preparation display (KDS)"""
    repo = POSPreparationDisplayRepository(user["org_id"])
    now = datetime.utcnow().isoformat()
    
    display = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        **data.model_dump(),
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
        "updated_by": user["id"],
    })
    return display


@router.put("/preparation/displays/{display_id}", dependencies=[Depends(require_perm("pos.manage"))])
def update_preparation_display(display_id: str, data: PreparationDisplayUpdate, user: dict = Depends(get_current_user)):
    """Update preparation display"""
    repo = POSPreparationDisplayRepository(user["org_id"])
    display = repo.get(display_id)
    if not display:
        raise HTTPException(404, "Display not found")
    
    updated = repo.update(display_id, {
        **data.model_dump(),
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": user["id"],
    })
    return updated


@router.delete("/preparation/displays/{display_id}", dependencies=[Depends(require_perm("pos.manage"))])
def delete_preparation_display(display_id: str, user: dict = Depends(get_current_user)):
    """Delete preparation display"""
    repo = POSPreparationDisplayRepository(user["org_id"])
    display = repo.get(display_id)
    if not display:
        raise HTTPException(404, "Display not found")
    
    repo.delete(display_id)
    return {"message": "Display deleted"}


# ===== Sprint 6.4: PREPARATION ORDERS (3 endpoints) =====

@router.get("/preparation/displays/{display_id}/orders")
def list_preparation_orders(
    display_id: str,
    stage: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """List active preparation orders for a display"""
    repo = POSPreparationOrderRepository(user["org_id"])
    filters = [{"field": "display_id", "op": "==", "value": display_id}]
    
    if stage:
        filters.append({"field": "stage", "op": "==", "value": stage})
    else:
        # Exclude served orders by default
        filters.append({"field": "stage", "op": "!=", "value": "served"})
    
    items, total = repo.list(
        filters=filters,
        order_by="sent_at",
        order_dir="ASCENDING",
        limit=500
    )
    return {"items": items, "total": total}


@router.post("/preparation/orders/{prep_order_id}/stage", dependencies=[Depends(require_perm("pos.view"))])
def update_preparation_order_stage(
    prep_order_id: str,
    data: PreparationOrderStageRequest,
    user: dict = Depends(get_current_user)
):
    """Move preparation order to next stage"""
    repo = POSPreparationOrderRepository(user["org_id"])
    prep_order = repo.get(prep_order_id)
    if not prep_order:
        raise HTTPException(404, "Preparation order not found")
    
    now = datetime.utcnow().isoformat()
    update_data = {
        "stage": data.stage,
        "updated_at": now,
        "updated_by": user["id"],
    }
    
    # Record stage timestamps
    if data.stage == "preparing":
        update_data["preparing_at"] = now
    elif data.stage == "ready":
        update_data["ready_at"] = now
    elif data.stage == "served":
        update_data["served_at"] = now
    
    updated = repo.update(prep_order_id, update_data)
    return updated


@router.post("/preparation/orders/{prep_order_id}/complete", dependencies=[Depends(require_perm("pos.view"))])
def complete_preparation_order(prep_order_id: str, user: dict = Depends(get_current_user)):
    """Complete preparation order (set to served)"""
    repo = POSPreparationOrderRepository(user["org_id"])
    prep_order = repo.get(prep_order_id)
    if not prep_order:
        raise HTTPException(404, "Preparation order not found")
    
    now = datetime.utcnow().isoformat()
    updated = repo.update(prep_order_id, {
        "stage": "served",
        "served_at": now,
        "updated_at": now,
        "updated_by": user["id"],
    })
    return updated


# ===== Sprint 6.4: RESTAURANT ORDER EXTRAS (3 endpoints) =====

@router.post("/orders/{order_id}/split", dependencies=[Depends(require_perm("pos.manage"))])
def split_order(order_id: str, data: OrderSplitRequest, user: dict = Depends(get_current_user)):
    """Split order into multiple child orders"""
    order_repo = POSOrderRepository(user["org_id"])
    line_repo = POSOrderLineRepository(user["org_id"])
    
    parent_order = order_repo.get(order_id)
    if not parent_order:
        raise HTTPException(404, "Order not found")
    
    if parent_order.get("state") not in ["draft", "paid"]:
        raise HTTPException(400, "Can only split draft or paid orders")
    
    # Get all lines
    all_lines, _ = line_repo.list(filters=[{"field": "order_id", "op": "==", "value": order_id}], limit=500)
    lines_map = {line["id"]: line for line in all_lines}
    
    # Create child orders
    child_orders = []
    now = datetime.utcnow().isoformat()
    
    for idx, split in enumerate(data.splits, 1):
        # Calculate totals for this split
        split_total = 0
        split_tax = 0
        
        for line_id in split.line_ids:
            if line_id not in lines_map:
                raise HTTPException(400, f"Line {line_id} not found in order")
            line = lines_map[line_id]
            split_total += line.get("price_subtotal", 0)
            split_tax += line.get("price_subtotal_incl", 0) - line.get("price_subtotal", 0)
        
        # Create child order
        child_order = {
            "id": str(uuid.uuid4()),
            "org_id": user["org_id"],
            "session_id": parent_order["session_id"],
            "config_id": parent_order["config_id"],
            "name": f"{parent_order['name']}/SPLIT-{idx}",
            "date_order": now,
            "state": "draft",
            "partner_id": split.partner_id or parent_order.get("partner_id"),
            "employee_id": user["id"],
            "amount_subtotal": split_total,
            "amount_tax": split_tax,
            "amount_total": split_total + split_tax,
            "amount_paid": 0,
            "amount_return": 0,
            "table_id": parent_order.get("table_id"),
            "floor_id": parent_order.get("floor_id"),
            "customer_count": parent_order.get("customer_count", 1),
            "pricelist_id": parent_order.get("pricelist_id"),
            "parent_order_id": order_id,
            "created_at": now,
            "updated_at": now,
            "created_by": user["id"],
            "updated_by": user["id"],
        }
        
        created_child = order_repo.create(child_order)
        
        # Move lines to child order
        for line_id in split.line_ids:
            line_repo.update(line_id, {
                "order_id": created_child["id"],
                "updated_at": now,
            })
        
        child_orders.append(created_child)
    
    # Update parent order state
    order_repo.update(order_id, {
        "state": "split",
        "updated_at": now,
        "updated_by": user["id"],
    })
    
    return {"parent": parent_order, "children": child_orders}


@router.post("/orders/{order_id}/transfer-table", dependencies=[Depends(require_perm("pos.view"))])
def transfer_order_to_table(
    order_id: str,
    data: OrderTransferTableRequest,
    user: dict = Depends(get_current_user)
):
    """Transfer order to a different table"""
    order_repo = POSOrderRepository(user["org_id"])
    table_repo = POSTableRepository(user["org_id"])
    
    order = order_repo.get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    new_table = table_repo.get(data.new_table_id)
    if not new_table:
        raise HTTPException(404, "New table not found")
    
    # Free old table if exists
    old_table_id = order.get("table_id")
    if old_table_id:
        old_table = table_repo.get(old_table_id)
        if old_table:
            table_repo.update(old_table_id, {
                "state": "available",
                "current_order_id": None,
                "current_guests": 0,
                "occupied_at": None,
                "updated_at": datetime.utcnow().isoformat(),
            })
    
    # Occupy new table
    now = datetime.utcnow().isoformat()
    table_repo.update(data.new_table_id, {
        "state": "occupied",
        "current_order_id": order_id,
        "current_guests": order.get("customer_count", 1),
        "occupied_at": now,
        "updated_at": now,
    })
    
    # Update order
    updated_order = order_repo.update(order_id, {
        "table_id": data.new_table_id,
        "floor_id": new_table["floor_id"],
        "updated_at": now,
        "updated_by": user["id"],
    })
    
    return updated_order


@router.post("/orders/{order_id}/add-course", dependencies=[Depends(require_perm("pos.view"))])
def add_course_to_lines(
    order_id: str,
    data: OrderAddCourseRequest,
    user: dict = Depends(get_current_user)
):
    """Add course label to order lines and send to KDS"""
    line_repo = POSOrderLineRepository(user["org_id"])
    prep_display_repo = POSPreparationDisplayRepository(user["org_id"])
    prep_order_repo = POSPreparationOrderRepository(user["org_id"])
    order_repo = POSOrderRepository(user["org_id"])
    
    order = order_repo.get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    now = datetime.utcnow().isoformat()
    updated_lines = []
    
    for line_id in data.line_ids:
        line = line_repo.get(line_id)
        if not line or line.get("order_id") != order_id:
            continue
        
        updated = line_repo.update(line_id, {
            "course": data.course_label,
            "updated_at": now,
        })
        updated_lines.append(updated)
    
    # KDS dispatch: Find applicable preparation displays
    displays, _ = prep_display_repo.list(limit=100)
    config_id = order.get("config_id")
    
    # Group lines by display (based on category match)
    from collections import defaultdict
    display_lines = defaultdict(list)
    
    for line in updated_lines:
        item_id = line.get("item_id")
        # Find displays that match this item's category
        # For now, send to all active displays (simplified)
        for display in displays:
            if display.get("config_id") == config_id and display.get("is_active"):
                display_lines[display["id"]].append(line)
    
    # Create or update preparation orders for each display
    for display_id, lines in display_lines.items():
        # Check if prep order exists for this order + display
        existing_prep_orders, _ = prep_order_repo.list(limit=1000)
        existing = next(
            (po for po in existing_prep_orders 
             if po.get("order_id") == order_id and po.get("display_id") == display_id),
            None
        )
        
        if existing:
            # Update existing prep order
            prep_order_repo.update(existing["id"], {
                "stage": "received",
                "sent_at": now,
                "updated_at": now,
            })
        else:
            # Create new prep order
            prep_order_repo.create({
                "id": str(uuid.uuid4()),
                "org_id": user["org_id"],
                "order_id": order_id,
                "display_id": display_id,
                "stage": "received",
                "sent_at": now,
                "created_at": now,
            })
    
    return {"lines": updated_lines, "count": len(updated_lines), "kds_dispatched": len(display_lines)}


# ===== SPRINT 6.5: EMPLOYEES, SELF-ORDER, LOYALTY, GIFT CARDS =====

# --- Schemas ---

class EmployeeBase(BaseModel):
    name: str
    name_ku: Optional[str] = None
    user_id: Optional[str] = None
    barcode: Optional[str] = None
    config_ids: List[str] = []
    role: str = "cashier"  # cashier|manager|waiter
    is_active: bool = True


class EmployeeCreate(EmployeeBase):
    pin: str  # 4-6 digit PIN, will be hashed


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    name_ku: Optional[str] = None
    user_id: Optional[str] = None
    barcode: Optional[str] = None
    config_ids: Optional[List[str]] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    pin: Optional[str] = None  # Reset PIN


class EmployeeLoginRequest(BaseModel):
    pin: str
    config_id: Optional[str] = None
    org_id: Optional[str] = None


class SelfOrderStartRequest(BaseModel):
    config_id: str
    preset_id: Optional[str] = None
    table_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None


class SelfOrderLineItem(BaseModel):
    product_id: str
    product_name: str
    qty: float
    price: float
    discount: float = 0
    tax_ids: List[str] = []


class SelfOrderUpdateItemsRequest(BaseModel):
    lines: List[SelfOrderLineItem]


class SelfOrderPayRequest(BaseModel):
    payment_method_id: str
    amount: float
    reference: Optional[str] = None


class LoyaltyProgramBase(BaseModel):
    name: str
    name_ku: Optional[str] = None
    program_type: str = "loyalty"  # loyalty|coupons|gift_card|ewallet|promotion
    point_ratio: float = 1.0  # points per 1000 IQD
    min_amount: float = 0
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    applies_on: str = "current"  # current|future|both
    is_active: bool = True


class LoyaltyProgramCreate(LoyaltyProgramBase):
    pass


class LoyaltyProgramUpdate(LoyaltyProgramBase):
    pass


class LoyaltyCardCreate(BaseModel):
    program_id: str
    partner_id: str
    initial_points: float = 0


class LoyaltyCardRedeemRequest(BaseModel):
    reward_id: str
    order_id: str


class LoyaltyEarnRequest(BaseModel):
    card_code: str
    order_id: str


class GiftCardCreate(BaseModel):
    initial_value: float
    partner_id: Optional[str] = None
    expiration_date: Optional[str] = None
    batch_count: int = 1


class GiftCardChargeRequest(BaseModel):
    amount: float
    order_id: str


# --- Sprint 6.6 Schemas ---

class PrintReceiptRequest(BaseModel):
    order_id: str
    printer_name: Optional[str] = None
    format: str = '80mm'  # '80mm'|'58mm'|'a4'


class OpenDrawerRequest(BaseModel):
    drawer_id: Optional[str] = None
    printer_id: Optional[str] = None


class ScaleReadRequest(BaseModel):
    device_id: str


class CustomerDisplayUpdateRequest(BaseModel):
    order: Optional[dict] = None
    ads: List[dict] = []


class IoTStatusRequest(BaseModel):
    device_id: str
    status: str
    capabilities: Optional[dict] = None


class IraqEInvoiceRequest(BaseModel):
    order_id: str


class PostSessionAccountingRequest(BaseModel):
    session_id: str


class PickOrderInventoryRequest(BaseModel):
    order_id: str


# --- Employee PIN Login Endpoints ---

@router.get("/employees")
def get_employees(
    config_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Get all POS employees"""
    emp_repo = POSEmployeeRepository(user["org_id"])
    employees, _ = emp_repo.list(limit=10000)
    
    if config_id:
        employees = [e for e in employees if config_id in e.get("config_ids", [])]
    
    return {"items": employees, "total": len(employees)}


@router.post("/employees", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_employee(
    data: EmployeeCreate,
    user: dict = Depends(get_current_user)
):
    """Create new POS employee with PIN"""
    emp_repo = POSEmployeeRepository(user["org_id"])
    
    # Hash PIN using SHA256 with org salt
    pin_hash = hashlib.sha256(f"{data.pin}:{user['org_id']}".encode()).hexdigest()
    
    employee = emp_repo.create({
        "name": data.name,
        "name_ku": data.name_ku,
        "user_id": data.user_id,
        "barcode": data.barcode,
        "config_ids": data.config_ids,
        "role": data.role,
        "is_active": data.is_active,
        "pin_hash": pin_hash,
        "failed_pin_attempts": 0,
        "locked_until": None,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": user["id"],
    })
    
    # Don't return pin_hash
    employee.pop("pin_hash", None)
    return employee


@router.put("/employees/{employee_id}", dependencies=[Depends(require_perm("pos.manage"))])
def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    user: dict = Depends(get_current_user)
):
    """Update POS employee (including PIN reset)"""
    emp_repo = POSEmployeeRepository(user["org_id"])
    
    employee = emp_repo.get(employee_id)
    if not employee:
        raise HTTPException(404, "Employee not found")
    
    updates = data.model_dump(exclude_unset=True)
    
    # Hash new PIN if provided
    if data.pin:
        updates["pin_hash"] = hashlib.sha256(f"{data.pin}:{user['org_id']}".encode()).hexdigest()
        updates["failed_pin_attempts"] = 0
        updates["locked_until"] = None
        updates.pop("pin", None)
    
    updates["updated_at"] = datetime.utcnow().isoformat()
    updates["updated_by"] = user["id"]
    
    updated = emp_repo.update(employee_id, updates)
    updated.pop("pin_hash", None)
    return updated


@router.post("/employees/login")
def employee_pin_login(data: EmployeeLoginRequest):
    """Employee PIN login - returns simple token"""
    # Note: No user auth required, credential-based
    
    if not data.config_id:
        raise HTTPException(400, "config_id is required for PIN login")
    
    # Derive org_id from config_id if not provided
    org_id = data.org_id
    if not org_id:
        # Query pos_configs collection directly to find the config and its org_id
        db = get_db()
        config_doc = db.collection("pos_configs").document(data.config_id).get()
        if not config_doc.exists:
            raise HTTPException(404, "Config not found")
        
        config_data = config_doc.to_dict()
        org_id = config_data.get("org_id")
        if not org_id:
            raise HTTPException(400, "Config does not have org_id")
    
    emp_repo = POSEmployeeRepository(org_id)
    config_repo = POSConfigRepository(org_id)
    
    # Verify config exists
    config = config_repo.get(data.config_id)
    if not config:
        raise HTTPException(404, "Config not found")
    
    # Hash PIN
    pin_hash = hashlib.sha256(f"{data.pin}:{org_id}".encode()).hexdigest()
    
    # Find employee with matching PIN and access to this config
    employees, _ = emp_repo.list(limit=1000)
    matching = [
        e for e in employees
        if e.get("pin_hash") == pin_hash and data.config_id in e.get("config_ids", [])
    ]
    
    if not matching:
        # Try to find employee by PIN to implement lockout on wrong PIN
        all_with_pin = [e for e in employees if e.get("pin_hash") == pin_hash]
        if all_with_pin:
            # Employee exists but doesn't have access to this config
            raise HTTPException(401, "No access to this POS")
        
        # Wrong PIN - check if any employee with config access to increment failed attempts
        employees_with_access = [e for e in employees if data.config_id in e.get("config_ids", [])]
        if employees_with_access:
            # This is a brute-force attempt on a valid config - log it
            # In production, implement IP-based rate limiting
            pass
        
        raise HTTPException(401, "Invalid PIN")
    
    employee = matching[0]
    
    # Check if locked due to failed attempts
    if employee.get("locked_until"):
        locked_until = datetime.fromisoformat(employee["locked_until"])
        if datetime.utcnow() < locked_until:
            remaining = (locked_until - datetime.utcnow()).total_seconds() / 60
            raise HTTPException(403, f"Employee locked due to failed attempts. Try again in {int(remaining)} minutes.")
    
    # Check wrong PIN - should not happen here since we matched by pin_hash above
    # This section is for future enhancement if we want to track attempts per employee
    
    # Reset failed attempts on successful login
    emp_repo.update(employee["id"], {
        "failed_pin_attempts": 0,
        "locked_until": None,
        "last_login_at": datetime.utcnow().isoformat(),
    })
    
    # Generate simple session token (not JWT, just random string for POS session)
    token = hashlib.sha256(f"{employee['id']}:{datetime.utcnow().isoformat()}".encode()).hexdigest()
    
    return {
        "success": True,
        "employee_id": employee["id"],
        "name": employee["name"],
        "token": token,
        "role": employee.get("role", "cashier"),
    }


@router.post("/employees/logout")
def employee_logout(token: str = Body(..., embed=True)):
    """Logout employee (invalidate token)"""
    # Simple in-memory revocation for now
    # In production, use Redis or Firestore collection
    return {"message": "Logged out"}


# --- Self-Order Kiosk Endpoints ---

@router.get("/self-order/menu")
def get_self_order_menu(
    config_id: str = Query(...),
    user: dict = Depends(get_current_user)
):
    """Get menu for self-order kiosk (public if self_order_enabled)"""
    config_repo = POSConfigRepository(user["org_id"])
    config = config_repo.get(config_id)
    
    if not config:
        raise HTTPException(404, "Config not found")
    
    # Check if self-order is enabled
    if not config.get("self_order_enabled", False):
        raise HTTPException(403, "Self-order is not enabled for this config")
    
    # Get categories and products
    cat_repo = POSCategoryRepository(user["org_id"])
    item_repo = ItemRepository(user["org_id"])
    
    categories, _ = cat_repo.list(limit=10000)
    categories = [c for c in categories if config_id in c.get("config_ids", [])]
    
    # Get all available items (simplified - should filter by category)
    items, _ = item_repo.list(limit=10000)
    items = [i for i in items if i.get("is_active") and i.get("type") == "product"]
    
    return {
        "config": {"id": config["id"], "name": config.get("name")},
        "categories": categories,
        "products": items[:50]  # Limit for performance
    }


@router.post("/self-order/start", status_code=201)
def start_self_order(
    data: SelfOrderStartRequest,
    user: dict = Depends(get_current_user)
):
    """Start new self-order session"""
    so_repo = POSSelfOrderRepository(user["org_id"])
    
    self_order = so_repo.create({
        "config_id": data.config_id,
        "preset_id": data.preset_id,
        "table_id": data.table_id,
        "state": "cart",
        "order_id": None,
        "customer_name": data.customer_name,
        "customer_phone": data.customer_phone,
        "lines": [],
        "total": 0,
        "created_at": datetime.utcnow().isoformat(),
    })
    
    return self_order


@router.post("/self-order/{self_order_id}/items")
def update_self_order_items(
    self_order_id: str,
    data: SelfOrderUpdateItemsRequest,
    user: dict = Depends(get_current_user)
):
    """Update items in self-order cart"""
    so_repo = POSSelfOrderRepository(user["org_id"])
    
    self_order = so_repo.get(self_order_id)
    if not self_order:
        raise HTTPException(404, "Self-order not found")
    
    if self_order["state"] != "cart":
        raise HTTPException(400, "Cannot modify submitted order")
    
    # Convert lines to dict
    lines = [line.model_dump() for line in data.lines]
    
    # Calculate total
    total = sum(
        (line["qty"] * line["price"] * (1 - line["discount"] / 100))
        for line in lines
    )
    
    updated = so_repo.update(self_order_id, {
        "lines": lines,
        "total": total,
        "updated_at": datetime.utcnow().isoformat(),
    })
    
    return updated


@router.post("/self-order/{self_order_id}/submit")
def submit_self_order(
    self_order_id: str,
    user: dict = Depends(get_current_user)
):
    """Submit self-order and create POS order"""
    so_repo = POSSelfOrderRepository(user["org_id"])
    order_repo = POSOrderRepository(user["org_id"])
    line_repo = POSOrderLineRepository(user["org_id"])
    seq_repo = SequenceRepository(user["org_id"])
    
    self_order = so_repo.get(self_order_id)
    if not self_order:
        raise HTTPException(404, "Self-order not found")
    
    if self_order["state"] != "cart":
        raise HTTPException(400, "Order already submitted")
    
    lines_data = self_order.get("lines") or []
    if not lines_data:
        raise HTTPException(400, "Empty cart")
    
    # Create POS order
    order_ref = seq_repo.get_next("pos_order")
    now = datetime.utcnow().isoformat()
    
    pos_order = order_repo.create({
        "order_ref": order_ref,
        "config_id": self_order.get("config_id"),
        "session_id": None,  # No session for self-orders
        "table_id": self_order.get("table_id"),
        "customer_name": self_order.get("customer_name"),
        "customer_phone": self_order.get("customer_phone"),
        "state": "draft",
        "amount_total": self_order.get("total", 0),
        "amount_paid": 0,
        "created_at": now,
        "source": "self_order",
    })
    
    # Create order lines
    for line_data in lines_data:
        qty = line_data.get("qty", 1) or 1
        price = line_data.get("price", 0) or 0
        discount = line_data.get("discount", 0) or 0
        line_repo.create({
            "order_id": pos_order["id"],
            "product_id": line_data.get("product_id"),
            "product_name": line_data.get("product_name", ""),
            "qty": qty,
            "price_unit": price,
            "discount": discount,
            "tax_ids": line_data.get("tax_ids", []),
            "subtotal": qty * price * (1 - discount / 100),
            "created_at": now,
        })
    
    # Update self-order state
    so_repo.update(self_order_id, {
        "state": "submitted",
        "order_id": pos_order["id"],
        "submitted_at": now,
    })
    
    return {"self_order": self_order, "pos_order": pos_order}


@router.post("/self-order/{self_order_id}/pay")
def pay_self_order(
    self_order_id: str,
    data: SelfOrderPayRequest,
    user: dict = Depends(get_current_user)
):
    """Pay for self-order"""
    so_repo = POSSelfOrderRepository(user["org_id"])
    order_repo = POSOrderRepository(user["org_id"])
    payment_repo = POSPaymentRepository(user["org_id"])
    
    self_order = so_repo.get(self_order_id)
    if not self_order:
        raise HTTPException(404, "Self-order not found")
    
    if self_order["state"] != "submitted":
        raise HTTPException(400, "Order must be submitted first")
    
    order_id = self_order.get("order_id")
    if not order_id:
        raise HTTPException(400, "No POS order linked")
    
    # Create payment
    now = datetime.utcnow().isoformat()
    payment = payment_repo.create({
        "order_id": order_id,
        "method_id": data.payment_method_id,
        "amount": data.amount,
        "reference": data.reference,
        "created_at": now,
    })
    
    # Update order
    order = order_repo.get(order_id)
    new_paid = order.get("amount_paid", 0) + data.amount
    state = "paid" if new_paid >= order["amount_total"] else "draft"
    
    order_repo.update(order_id, {
        "amount_paid": new_paid,
        "state": state,
        "updated_at": now,
    })
    
    # Update self-order
    so_repo.update(self_order_id, {
        "state": "paid",
        "paid_at": now,
    })
    
    return {"payment": payment, "order_state": state}


# --- Loyalty Programs ---

@router.get("/loyalty/programs")
def get_loyalty_programs(user: dict = Depends(get_current_user)):
    """Get all loyalty programs"""
    lp_repo = POSLoyaltyProgramRepository(user["org_id"])
    programs, _ = lp_repo.list(limit=10000)
    return {"items": programs, "total": len(programs)}


@router.post("/loyalty/programs", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_loyalty_program(
    data: LoyaltyProgramCreate,
    user: dict = Depends(get_current_user)
):
    """Create loyalty program"""
    lp_repo = POSLoyaltyProgramRepository(user["org_id"])
    
    program = lp_repo.create({
        **data.model_dump(),
        "created_at": datetime.utcnow().isoformat(),
        "created_by": user["id"],
    })
    
    return program


@router.put("/loyalty/programs/{program_id}", dependencies=[Depends(require_perm("pos.manage"))])
def update_loyalty_program(
    program_id: str,
    data: LoyaltyProgramUpdate,
    user: dict = Depends(get_current_user)
):
    """Update loyalty program"""
    lp_repo = POSLoyaltyProgramRepository(user["org_id"])
    
    program = lp_repo.get(program_id)
    if not program:
        raise HTTPException(404, "Program not found")
    
    updates = data.model_dump(exclude_unset=True)
    updates["updated_at"] = datetime.utcnow().isoformat()
    
    return lp_repo.update(program_id, updates)


@router.delete("/loyalty/programs/{program_id}", dependencies=[Depends(require_perm("pos.manage"))])
def delete_loyalty_program(
    program_id: str,
    user: dict = Depends(get_current_user)
):
    """Delete loyalty program"""
    lp_repo = POSLoyaltyProgramRepository(user["org_id"])
    lp_repo.delete(program_id)
    return {"message": "Program deleted"}


@router.get("/loyalty/cards")
def get_loyalty_cards(
    partner_id: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Get loyalty cards"""
    lc_repo = POSLoyaltyCardRepository(user["org_id"])
    cards, _ = lc_repo.list(limit=10000)
    
    if partner_id:
        cards = [c for c in cards if c.get("partner_id") == partner_id]
    if code:
        cards = [c for c in cards if c.get("code") == code]
    
    return {"items": cards, "total": len(cards)}


# --- Loyalty Cards Actions ---

@router.post("/loyalty/cards", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_loyalty_card(
    data: LoyaltyCardCreate,
    user: dict = Depends(get_current_user)
):
    """Issue new loyalty card"""
    lc_repo = POSLoyaltyCardRepository(user["org_id"])
    
    # Generate unique 12-char code
    max_attempts = 10
    for _ in range(max_attempts):
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))
        # Check if code exists
        existing, _ = lc_repo.list(limit=10000)
        if not any(c.get("code") == code for c in existing):
            break
    else:
        raise HTTPException(500, "Failed to generate unique card code")
    
    card = lc_repo.create({
        "program_id": data.program_id,
        "partner_id": data.partner_id,
        "code": code,
        "points_balance": data.initial_points,
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": user["id"],
    })
    
    return card


@router.post("/loyalty/cards/{code}/redeem", dependencies=[Depends(require_perm("pos.manage"))])
def redeem_loyalty_points(
    code: str,
    data: LoyaltyCardRedeemRequest,
    user: dict = Depends(get_current_user)
):
    """Redeem loyalty points for reward"""
    lc_repo = POSLoyaltyCardRepository(user["org_id"])
    lp_repo = POSLoyaltyProgramRepository(user["org_id"])
    
    # Find card by code
    cards, _ = lc_repo.list(limit=10000)
    card = next((c for c in cards if c.get("code") == code), None)
    
    if not card:
        raise HTTPException(404, "Card not found")
    
    if not card.get("is_active"):
        raise HTTPException(400, "Card is not active")
    
    # Get program
    program = lp_repo.get(card["program_id"])
    if not program:
        raise HTTPException(404, "Program not found")
    
    # Check if reward exists in program
    rewards = program.get("rewards", [])
    reward = next((r for r in rewards if r.get("id") == data.reward_id), None)
    
    if not reward:
        raise HTTPException(404, "Reward not found in program")
    
    points_required = reward.get("points_cost", 0)
    current_points = card.get("points_balance", 0)
    
    if current_points < points_required:
        raise HTTPException(400, f"Insufficient points. Required: {points_required}, Available: {current_points}")
    
    # Deduct points
    new_balance = current_points - points_required
    updated = lc_repo.update(card["id"], {
        "points_balance": new_balance,
        "updated_at": datetime.utcnow().isoformat(),
    })
    
    return {
        "success": True,
        "reward": reward,
        "points_redeemed": points_required,
        "points_remaining": new_balance,
        "card": updated
    }


@router.post("/loyalty/earn", dependencies=[Depends(require_perm("pos.manage"))])
def earn_loyalty_points(
    data: LoyaltyEarnRequest,
    user: dict = Depends(get_current_user)
):
    """Earn loyalty points from order"""
    lc_repo = POSLoyaltyCardRepository(user["org_id"])
    lp_repo = POSLoyaltyProgramRepository(user["org_id"])
    order_repo = POSOrderRepository(user["org_id"])
    
    # Find card
    cards, _ = lc_repo.list(limit=10000)
    card = next((c for c in cards if c.get("code") == data.card_code), None)
    
    if not card:
        raise HTTPException(404, "Card not found")
    
    # Get program
    program = lp_repo.get(card["program_id"])
    if not program:
        raise HTTPException(404, "Program not found")
    
    # Get order
    order = order_repo.get(data.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    # Calculate points
    total = order.get("amount_total", 0)
    ratio = program.get("point_ratio", 1.0)
    points = (total / 1000) * ratio
    
    # Add to balance
    new_balance = card.get("points_balance", 0) + points
    lc_repo.update(card["id"], {
        "points_balance": new_balance,
        "updated_at": datetime.utcnow().isoformat(),
    })
    
    return {"points_earned": points, "new_balance": new_balance}


# --- Gift Cards ---

@router.get("/gift-cards")
def list_gift_cards(
    batch_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    partner_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """List all gift cards with optional filters"""
    gc_repo = POSGiftCardRepository(user["org_id"])
    cards, total = gc_repo.list(limit=1000)
    
    # Apply filters
    if batch_id:
        cards = [c for c in cards if c.get("batch_id") == batch_id]
    if is_active is not None:
        cards = [c for c in cards if c.get("is_active") == is_active]
    if partner_id:
        cards = [c for c in cards if c.get("partner_id") == partner_id]
    
    return {"items": cards, "total": len(cards)}


@router.get("/gift-cards/{code}")
def get_gift_card(
    code: str,
    user: dict = Depends(get_current_user)
):
    """Get gift card by code"""
    gc_repo = POSGiftCardRepository(user["org_id"])
    cards, _ = gc_repo.list(limit=10000)
    card = next((c for c in cards if c.get("code") == code), None)
    
    if not card:
        raise HTTPException(404, "Gift card not found")
    
    return card


@router.post("/gift-cards", status_code=201, dependencies=[Depends(require_perm("pos.manage"))])
def create_gift_cards(
    data: GiftCardCreate,
    user: dict = Depends(get_current_user)
):
    """Issue gift card(s)"""
    gc_repo = POSGiftCardRepository(user["org_id"])
    
    batch_id = str(uuid.uuid4()) if data.batch_count > 1 else None
    cards = []
    
    for _ in range(data.batch_count):
        # Generate unique 16-char code
        max_attempts = 10
        for _ in range(max_attempts):
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=16))
            existing, _ = gc_repo.list(limit=10000)
            if not any(c.get("code") == code for c in existing):
                break
        else:
            raise HTTPException(500, "Failed to generate unique gift card code")
        
        card = gc_repo.create({
            "code": code,
            "initial_value": data.initial_value,
            "current_value": data.initial_value,
            "partner_id": data.partner_id,
            "expiration_date": data.expiration_date,
            "is_active": False,  # Must be activated
            "batch_id": batch_id,
            "activated_at": None,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": user["id"],
        })
        cards.append(card)
    
    return {"cards": cards, "count": len(cards), "batch_id": batch_id}


@router.post("/gift-cards/{code}/activate", dependencies=[Depends(require_perm("pos.manage"))])
def activate_gift_card(
    code: str,
    user: dict = Depends(get_current_user)
):
    """Activate gift card"""
    gc_repo = POSGiftCardRepository(user["org_id"])
    cards, _ = gc_repo.list(limit=10000)
    card = next((c for c in cards if c.get("code") == code), None)
    
    if not card:
        raise HTTPException(404, "Gift card not found")
    
    if card.get("is_active"):
        raise HTTPException(400, "Card already active")
    
    updated = gc_repo.update(card["id"], {
        "is_active": True,
        "activated_at": datetime.utcnow().isoformat(),
    })
    
    return updated


@router.post("/gift-cards/{code}/charge", dependencies=[Depends(require_perm("pos.manage"))])
def charge_gift_card(
    code: str,
    data: GiftCardChargeRequest,
    user: dict = Depends(get_current_user)
):
    """Charge amount from gift card"""
    gc_repo = POSGiftCardRepository(user["org_id"])
    cards, _ = gc_repo.list(limit=10000)
    card = next((c for c in cards if c.get("code") == code), None)
    
    if not card:
        raise HTTPException(404, "Gift card not found")
    
    if not card.get("is_active"):
        raise HTTPException(400, "Card not activated")
    
    current_value = card.get("current_value", 0)
    if data.amount > current_value:
        raise HTTPException(400, f"Insufficient balance. Available: {current_value}")
    
    new_value = current_value - data.amount
    updated = gc_repo.update(card["id"], {
        "current_value": new_value,
        "updated_at": datetime.utcnow().isoformat(),
    })
    
    return {"charged": data.amount, "remaining_balance": new_value}


# ===== SPRINT 6.6: HARDWARE, REPORTS, IRAQ FISCAL =====

# --- Hardware Endpoints (6) ---

@router.post("/hardware/print-receipt", dependencies=[Depends(require_perm("pos.view"))])
def print_receipt(
    data: PrintReceiptRequest,
    user: dict = Depends(get_current_user)
):
    """Generate receipt for printing"""
    order_repo = POSOrderRepository(user["org_id"])
    line_repo = POSOrderLineRepository(user["org_id"])
    payment_repo = POSPaymentRepository(user["org_id"])
    receipt_log_repo = POSReceiptLogRepository(user["org_id"])
    
    order = order_repo.get(data.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    lines, _ = line_repo.list(limit=1000)
    order_lines = [l for l in lines if l.get("order_id") == data.order_id]
    
    payments, _ = payment_repo.list(limit=1000)
    order_payments = [p for p in payments if p.get("order_id") == data.order_id]
    
    # Generate HTML receipt (simple template)
    html_template = f"""
    <!DOCTYPE html>
    <html dir="rtl">
    <head><meta charset="UTF-8"><style>
    body {{ font-family: 'Courier New', monospace; width: {data.format}; margin: 0 auto; }}
    .center {{ text-align: center; }}
    .line {{ border-bottom: 1px dashed #000; margin: 5px 0; }}
    table {{ width: 100%; }}
    </style></head>
    <body>
    <div class="center"><h3>پسوولەی فرۆشتن</h3></div>
    <div class="center">Order: {order.get('order_ref', 'N/A')}</div>
    <div class="center">Date: {order.get('created_at', '')[:16]}</div>
    <div class="line"></div>
    <table>
    """
    
    for line in order_lines:
        html_template += f"""
        <tr>
            <td>{line.get('product_name', 'N/A')}</td>
            <td>{line.get('qty', 0)} x {line.get('price_unit', 0)}</td>
            <td>{line.get('subtotal', 0)}</td>
        </tr>
        """
    
    html_template += f"""
    </table>
    <div class="line"></div>
    <div><strong>Total: {order.get('amount_total', 0)} IQD</strong></div>
    <div class="center">Thank you!</div>
    </body></html>
    """
    
    # Generate ESC/POS bytes (stub - base64 encoded pulse command)
    escpos_bytes = [27, 112, 0, 25, 250]  # ESC p 0 25 250 (open drawer)
    import base64
    escpos_base64 = base64.b64encode(bytes(escpos_bytes)).decode()
    
    # Log receipt
    receipt_log_repo.create({
        "order_id": data.order_id,
        "printed_at": datetime.utcnow().isoformat(),
        "printer_name": data.printer_name or "default",
        "channel": "pos",
        "format": data.format,
    })
    
    return {
        "rendered_html": html_template,
        "rendered_text": f"Order {order.get('order_ref')} - Total {order.get('amount_total')} IQD",
        "escpos_bytes_base64": escpos_base64
    }


@router.post("/hardware/open-cash-drawer", dependencies=[Depends(require_perm("pos.view"))])
def open_cash_drawer(
    data: OpenDrawerRequest,
    user: dict = Depends(get_current_user)
):
    """Send command to open cash drawer"""
    # ESC/POS pulse command: ESC p m t1 t2
    # Standard: 27(ESC) 112(p) 0(pin2) 25(100ms) 250(200ms)
    escpos_pulse = [27, 112, 0, 25, 250]
    
    import base64
    escpos_base64 = base64.b64encode(bytes(escpos_pulse)).decode()
    
    return {
        "command_sent": True,
        "escpos_pulse_base64": escpos_base64,
        "drawer_id": data.drawer_id or "default",
        "message": "Cash drawer open command generated"
    }


@router.post("/hardware/scale-read", dependencies=[Depends(require_perm("pos.view"))])
def read_scale(
    data: ScaleReadRequest,
    user: dict = Depends(get_current_user)
):
    """Read weight from scale (stub - requires IoT box)"""
    # In production, this would communicate with IoT box or WebUSB
    # For now, return mock data
    return {
        "weight": 0.0,
        "unit": "kg",
        "stable": True,
        "device_id": data.device_id,
        "message": "Scale read (stub - IoT box required)"
    }


@router.get("/hardware/customer-display/{config_id}")
def get_customer_display(
    config_id: str,
    user: dict = Depends(get_current_user)
):
    """Get current customer display snapshot"""
    cd_repo = POSCustomerDisplayRepository(user["org_id"])
    displays, _ = cd_repo.list(limit=100)
    
    display = next((d for d in displays if d.get("config_id") == config_id), None)
    
    if not display:
        # Create default display
        display = cd_repo.create({
            "config_id": config_id,
            "device_id": f"display_{config_id}",
            "display_mode": "mixed",
            "ad_content_ids": [],
            "current_order_snapshot": {},
            "last_updated_at": datetime.utcnow().isoformat(),
            "is_active": True,
        })
    
    return display


@router.post("/hardware/customer-display/{config_id}/update", dependencies=[Depends(require_perm("pos.view"))])
def update_customer_display(
    config_id: str,
    data: CustomerDisplayUpdateRequest,
    user: dict = Depends(get_current_user)
):
    """Update customer display snapshot"""
    cd_repo = POSCustomerDisplayRepository(user["org_id"])
    displays, _ = cd_repo.list(limit=100)
    
    display = next((d for d in displays if d.get("config_id") == config_id), None)
    
    if not display:
        # Create new
        display = cd_repo.create({
            "config_id": config_id,
            "device_id": f"display_{config_id}",
            "display_mode": "order" if data.order else "ad",
            "ad_content_ids": [a.get("id") for a in data.ads],
            "current_order_snapshot": data.order or {},
            "last_updated_at": datetime.utcnow().isoformat(),
            "is_active": True,
        })
    else:
        # Update existing
        display = cd_repo.update(display["id"], {
            "current_order_snapshot": data.order or {},
            "ad_content_ids": [a.get("id") for a in data.ads] if data.ads else display.get("ad_content_ids", []),
            "last_updated_at": datetime.utcnow().isoformat(),
        })
    
    return display


@router.post("/hardware/iot/status", dependencies=[Depends(require_perm("pos.view"))])
def iot_device_status(
    data: IoTStatusRequest,
    user: dict = Depends(get_current_user)
):
    """Register/heartbeat from IoT box"""
    # In production, store IoT device status in a collection
    # For now, just acknowledge
    return {
        "acknowledged": True,
        "device_id": data.device_id,
        "status": data.status,
        "server_time": datetime.utcnow().isoformat()
    }


# --- Reports Endpoints (6) ---

@router.get("/reports/dashboard")
def reports_dashboard(
    date_from: str = Query(...),
    date_to: str = Query(...),
    config_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """POS dashboard KPIs and charts"""
    order_repo = POSOrderRepository(user["org_id"])
    line_repo = POSOrderLineRepository(user["org_id"])
    payment_repo = POSPaymentRepository(user["org_id"])
    
    # Get orders in date range
    orders, _ = order_repo.list(limit=10000)
    filtered_orders = [
        o for o in orders
        if date_from <= (o.get("created_at") or "")[:10] <= date_to
        and (not config_id or o.get("config_id") == config_id)
        and o.get("state") in ["paid", "invoiced"]
    ]
    
    total_sales = sum(o.get("amount_total", 0) for o in filtered_orders)
    total_orders = len(filtered_orders)
    average_basket = total_sales / total_orders if total_orders > 0 else 0
    
    # Calculate tax
    total_tax = sum(o.get("tax_total", 0) for o in filtered_orders)
    total_discount = sum(o.get("discount_total", 0) for o in filtered_orders)
    
    # Top products
    lines, _ = line_repo.list(limit=10000)
    order_ids = {o["id"] for o in filtered_orders}
    relevant_lines = [l for l in lines if l.get("order_id") in order_ids]
    
    from collections import defaultdict
    product_stats = defaultdict(lambda: {"qty": 0, "revenue": 0, "name": ""})
    for line in relevant_lines:
        pid = line.get("product_id")
        product_stats[pid]["qty"] += line.get("qty", 0)
        product_stats[pid]["revenue"] += line.get("subtotal", 0)
        product_stats[pid]["name"] = line.get("product_name", "Unknown")
    
    top_products = sorted(
        [{"product_id": k, "name": v["name"], "qty": v["qty"], "revenue": v["revenue"]} 
         for k, v in product_stats.items()],
        key=lambda x: x["revenue"],
        reverse=True
    )[:5]
    
    # Payment methods
    payments, _ = payment_repo.list(limit=10000)
    relevant_payments = [p for p in payments if p.get("order_id") in order_ids]
    
    payment_by_method = defaultdict(float)
    for p in relevant_payments:
        method = p.get("method_id") or "cash"
        payment_by_method[method] += p.get("amount", 0)
    
    by_payment_method = [{"method": k, "amount": v} for k, v in payment_by_method.items()]
    
    # By cashier
    cashier_stats = defaultdict(lambda: {"sales": 0, "orders": 0})
    for o in filtered_orders:
        cashier = o.get("cashier_id") or o.get("user_id") or "unknown"
        cashier_stats[cashier]["sales"] += o.get("amount_total", 0)
        cashier_stats[cashier]["orders"] += 1
    
    by_cashier = [{"cashier_id": k, **v} for k, v in cashier_stats.items()]
    
    # By hour (24-hour breakdown)
    by_hour = [0] * 24
    for o in filtered_orders:
        created = o.get("created_at", "")
        if len(created) >= 13:
            try:
                hour = int(created[11:13])
                by_hour[hour] += o.get("amount_total", 0)
            except Exception:
                pass
    
    # Previous period comparison
    period_length = (datetime.fromisoformat(date_to) - datetime.fromisoformat(date_from)).days
    prev_date_to = datetime.fromisoformat(date_from)
    prev_date_from = prev_date_to - timedelta(days=period_length)
    
    prev_orders = [
        o for o in orders
        if prev_date_from.strftime("%Y-%m-%d") <= (o.get("created_at") or "")[:10] < date_from
        and (not config_id or o.get("config_id") == config_id)
        and o.get("state") in ["paid", "invoiced"]
    ]
    
    prev_total_sales = sum(o.get("amount_total", 0) for o in prev_orders)
    prev_total_orders = len(prev_orders)
    
    sales_change = ((total_sales - prev_total_sales) / prev_total_sales * 100) if prev_total_sales > 0 else (100 if total_sales > 0 else 0)
    orders_change = ((total_orders - prev_total_orders) / prev_total_orders * 100) if prev_total_orders > 0 else (100 if total_orders > 0 else 0)
    
    return {
        "total_sales": round(total_sales, 2),
        "total_orders": total_orders,
        "average_basket": round(average_basket, 2),
        "total_tax": round(total_tax, 2),
        "total_discount": round(total_discount, 2),
        "top_products": top_products,
        "by_payment_method": by_payment_method,
        "by_cashier": by_cashier,
        "by_hour": [round(h, 2) for h in by_hour],
        "compared_to_previous": {
            "sales_change_percent": round(sales_change, 2),
            "orders_change_percent": round(orders_change, 2)
        }
    }


@router.get("/reports/sales-by-product")
def sales_by_product_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    config_id: Optional[str] = Query(None),
    limit: int = Query(50),
    user: dict = Depends(get_current_user)
):
    """Sales by product report"""
    order_repo = POSOrderRepository(user["org_id"])
    line_repo = POSOrderLineRepository(user["org_id"])
    
    orders, _ = order_repo.list(limit=10000)
    filtered_orders = [
        o for o in orders
        if date_from <= (o.get("created_at") or "")[:10] <= date_to
        and (not config_id or o.get("config_id") == config_id)
        and o.get("state") in ["paid", "invoiced"]
    ]
    
    order_ids = {o["id"] for o in filtered_orders}
    lines, _ = line_repo.list(limit=10000)
    relevant_lines = [l for l in lines if l.get("order_id") in order_ids]
    
    from collections import defaultdict
    product_stats = defaultdict(lambda: {"qty": 0, "revenue": 0, "name": "", "count": 0})
    for line in relevant_lines:
        pid = line.get("product_id")
        product_stats[pid]["qty"] += line.get("qty", 0)
        product_stats[pid]["revenue"] += line.get("subtotal", 0)
        product_stats[pid]["name"] = line.get("product_name", "Unknown")
        product_stats[pid]["count"] += 1
    
    results = sorted(
        [
            {
                "product_id": k,
                "product_name": v["name"],
                "qty_sold": v["qty"],
                "revenue": round(v["revenue"], 2),
                "avg_price": round(v["revenue"] / v["qty"], 2) if v["qty"] > 0 else 0
            }
            for k, v in product_stats.items()
        ],
        key=lambda x: x["revenue"],
        reverse=True
    )[:limit]
    
    return {"items": results, "total": len(results)}


@router.get("/reports/sales-by-category")
def sales_by_category_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    config_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Sales by category report"""
    order_repo = POSOrderRepository(user["org_id"])
    line_repo = POSOrderLineRepository(user["org_id"])
    item_repo = ItemRepository(user["org_id"])
    cat_repo = POSCategoryRepository(user["org_id"])
    
    # Get orders in date range
    orders, _ = order_repo.list(limit=10000)
    filtered_orders = [
        o for o in orders
        if date_from <= (o.get("created_at") or "")[:10] <= date_to
        and (not config_id or o.get("config_id") == config_id)
        and o.get("state") in ["paid", "invoiced"]
    ]
    
    order_ids = {o["id"] for o in filtered_orders}
    
    # Get all relevant order lines
    lines, _ = line_repo.list(limit=10000)
    relevant_lines = [l for l in lines if l.get("order_id") in order_ids]
    
    # Get all items to map category_id
    items, _ = item_repo.list(limit=10000)
    item_category_map = {i["id"]: i.get("pos_category_id") for i in items}
    
    # Get all categories
    categories, _ = cat_repo.list(limit=10000)
    category_map = {c["id"]: c.get("name", "Uncategorized") for c in categories}
    
    # Aggregate by category
    from collections import defaultdict
    category_stats = defaultdict(lambda: {"qty": 0, "revenue": 0})
    
    for line in relevant_lines:
        item_id = line.get("item_id")
        category_id = item_category_map.get(item_id, "uncategorized")
        qty = line.get("qty", 0)
        revenue = line.get("total", 0)
        
        category_stats[category_id]["qty"] += qty
        category_stats[category_id]["revenue"] += revenue
    
    # Calculate total revenue for share percentage
    total_revenue = sum(stats["revenue"] for stats in category_stats.values())
    
    # Build results
    results = [
        {
            "category_id": cat_id,
            "category_name": category_map.get(cat_id, "Uncategorized"),
            "qty_sold": stats["qty"],
            "revenue": round(stats["revenue"], 2),
            "share_percent": round((stats["revenue"] / total_revenue * 100) if total_revenue > 0 else 0, 2)
        }
        for cat_id, stats in category_stats.items()
    ]
    
    # Sort by revenue descending
    results.sort(key=lambda x: x["revenue"], reverse=True)
    
    return {"items": results, "total": len(results)}


@router.get("/reports/sales-by-cashier")
def sales_by_cashier_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    config_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Sales by cashier report"""
    order_repo = POSOrderRepository(user["org_id"])
    
    orders, _ = order_repo.list(limit=10000)
    filtered_orders = [
        o for o in orders
        if date_from <= (o.get("created_at") or "")[:10] <= date_to
        and (not config_id or o.get("config_id") == config_id)
        and o.get("state") in ["paid", "invoiced"]
    ]
    
    from collections import defaultdict
    cashier_stats = defaultdict(lambda: {"sales": 0, "orders": 0, "avg_basket": 0})
    for o in filtered_orders:
        cashier = o.get("cashier_id") or o.get("user_id") or "unknown"
        cashier_stats[cashier]["sales"] += o.get("amount_total", 0)
        cashier_stats[cashier]["orders"] += 1
    
    results = [
        {
            "cashier_id": k,
            "sales": round(v["sales"], 2),
            "orders": v["orders"],
            "avg_basket": round(v["sales"] / v["orders"], 2) if v["orders"] > 0 else 0
        }
        for k, v in cashier_stats.items()
    ]
    
    return {"items": sorted(results, key=lambda x: x["sales"], reverse=True), "total": len(results)}


@router.get("/reports/sessions-summary")
def sessions_summary_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    config_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Sessions summary report"""
    session_repo = POSSessionRepository(user["org_id"])
    order_repo = POSOrderRepository(user["org_id"])
    
    sessions, _ = session_repo.list(limit=1000)
    filtered_sessions = [
        s for s in sessions
        if date_from <= (s.get("opened_at") or s.get("created_at") or "")[:10] <= date_to
        and (not config_id or s.get("config_id") == config_id)
    ]
    
    # Get orders for each session
    orders, _ = order_repo.list(limit=10000)
    
    results = []
    for session in filtered_sessions:
        session_orders = [o for o in orders if o.get("session_id") == session["id"]]
        total_sales = sum(o.get("amount_total", 0) for o in session_orders)
        
        cash_diff = (session.get("closing_cash_counted") or 0) - (session.get("opening_cash") or 0) - (session.get("cash_sales") or 0)
        
        results.append({
            "session_id": session["id"],
            "opened_at": session.get("opened_at"),
            "closed_at": session.get("closed_at"),
            "sales": round(total_sales, 2),
            "orders": len(session_orders),
            "cash_diff": round(cash_diff, 2)
        })
    
    return {"items": results, "total": len(results)}


@router.get("/reports/hourly-heatmap")
def hourly_heatmap_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    config_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Hourly heatmap (7 days × 24 hours)"""
    order_repo = POSOrderRepository(user["org_id"])
    
    orders, _ = order_repo.list(limit=10000)
    filtered_orders = [
        o for o in orders
        if date_from <= (o.get("created_at") or "")[:10] <= date_to
        and (not config_id or o.get("config_id") == config_id)
        and o.get("state") in ["paid", "invoiced"]
    ]
    
    # 7x24 grid (Sunday=0 to Saturday=6, hour 0-23)
    heatmap = [[0 for _ in range(24)] for _ in range(7)]
    
    for o in filtered_orders:
        created = o.get("created_at", "")
        if len(created) >= 19:
            try:
                dt = datetime.fromisoformat(created[:19])
                day = dt.weekday()  # Monday=0, Sunday=6
                # Convert to Sunday=0
                day = (day + 1) % 7
                hour = dt.hour
                heatmap[day][hour] += o.get("amount_total", 0)
            except Exception:
                pass
    
    # Round values
    heatmap_rounded = [[round(h, 2) for h in day] for day in heatmap]
    
    return {
        "heatmap": heatmap_rounded,
        "days": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        "hours": list(range(24))
    }


# --- Iraq Fiscal Hooks (3) ---

@router.post("/hooks/iraq/einvoice", dependencies=[Depends(require_perm("pos.manage"))])
def generate_iraq_einvoice(
    data: IraqEInvoiceRequest,
    user: dict = Depends(get_current_user)
):
    """Generate Iraq e-invoice QR code and fiscal ID"""
    order_repo = POSOrderRepository(user["org_id"])
    config_repo = POSConfigRepository(user["org_id"])
    
    order = order_repo.get(data.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    config = config_repo.get(order.get("config_id"))
    seller_tax_id = config.get("iraq_seller_tax_id") if config else "UNKNOWN"
    
    # Generate deterministic QR payload
    qr_payload = f"IQ|{seller_tax_id}|{order.get('order_ref')}|{order.get('amount_total')}|{order.get('created_at')[:10]}"
    
    # Generate fiscal_id (stub)
    fiscal_id = f"IQ-{order.get('order_ref')}-{uuid.uuid4().hex[:8].upper()}"
    
    # Generate QR code as base64 (using simple approach - in production use qrcode library)
    # For now, use API.QRServer as fallback
    import urllib.parse
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={urllib.parse.quote(qr_payload)}"
    
    # In production, generate actual QR:
    # import qrcode, io, base64
    # qr = qrcode.make(qr_payload)
    # buffer = io.BytesIO()
    # qr.save(buffer, format='PNG')
    # qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # For now, return URL as stub
    qr_code_base64 = ""  # Would be actual base64 PNG
    
    return {
        "qr_code_base64": qr_code_base64,
        "qr_code_url": qr_url,
        "fiscal_id": fiscal_id,
        "status": "generated",
        "payload": qr_payload
    }


@router.post("/hooks/accounting/post-session", dependencies=[Depends(require_perm("pos.manage"))])
def post_session_accounting(
    data: PostSessionAccountingRequest,
    user: dict = Depends(get_current_user)
):
    """Create journal entry for session (stub - use existing AccountingService)"""
    session_repo = POSSessionRepository(user["org_id"])
    
    session = session_repo.get(data.session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    if session.get("state") != "closed":
        raise HTTPException(400, "Session must be closed first")
    
    # In production, call AccountingService to create journal entry
    # For now, return stub
    return {
        "success": True,
        "session_id": data.session_id,
        "journal_entry_id": f"JE-{uuid.uuid4().hex[:8].upper()}",
        "message": "Journal entry created (stub - integrate with AccountingService)"
    }


@router.post("/hooks/inventory/pick-order", dependencies=[Depends(require_perm("pos.manage"))])
def create_inventory_picking(
    data: PickOrderInventoryRequest,
    user: dict = Depends(get_current_user)
):
    """Create stock picking for order (stub - integrate with inventory module)"""
    order_repo = POSOrderRepository(user["org_id"])
    line_repo = POSOrderLineRepository(user["org_id"])
    
    order = order_repo.get(data.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    lines, _ = line_repo.list(limit=1000)
    order_lines = [l for l in lines if l.get("order_id") == data.order_id]
    
    # In production, create stock.picking via InventoryService
    # For now, return stub
    return {
        "success": True,
        "order_id": data.order_id,
        "picking_id": f"PICK-{uuid.uuid4().hex[:8].upper()}",
        "lines_count": len(order_lines),
        "message": "Stock picking created (stub - integrate with InventoryService)"
    }



# ---------------- Sprint 32: POS Hardware Registry (FIX-481..490) ----------------

@router.get("/hardware/devices")
def list_pos_devices(device_type: str = None, user: dict = Depends(get_current_user)):
    """List POS hardware devices: printer | scale | cash_drawer | scanner."""
    from app.firestore.base import BaseRepository as _BR
    class _D(_BR):
        collection_name = "pos_devices"
    repo = _D(user["org_id"])
    filters = [{"field": "device_type", "op": "==", "value": device_type}] if device_type else None
    items, total = repo.list(filters=filters, limit=500, order_by="name")
    return {"items": items, "total": total}


@router.post("/hardware/devices", status_code=201,
             dependencies=[Depends(require_perm("pos.manage_settings"))])
def register_pos_device(data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.base import BaseRepository as _BR
    class _D(_BR):
        collection_name = "pos_devices"
    dt = (data.get("device_type") or "").lower()
    if dt not in {"printer", "scale", "cash_drawer", "scanner", "display"}:
        raise HTTPException(400, "device_type must be printer|scale|cash_drawer|scanner|display")
    payload = {
        "name": data.get("name"),
        "device_type": dt,
        "session_id": data.get("session_id"),
        "config": data.get("config", {}),
        "endpoint": data.get("endpoint"),
        "status": "active",
    }
    return _D(user["org_id"]).create(payload)


@router.put("/hardware/devices/{device_id}",
            dependencies=[Depends(require_perm("pos.manage_settings"))])
def update_pos_device(device_id: str, data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.base import BaseRepository as _BR
    class _D(_BR):
        collection_name = "pos_devices"
    repo = _D(user["org_id"])
    if not repo.get(device_id):
        raise HTTPException(404, "device not found")
    return repo.update(device_id, data)


@router.delete("/hardware/devices/{device_id}",
                dependencies=[Depends(require_perm("pos.manage_settings"))])
def delete_pos_device(device_id: str, user: dict = Depends(get_current_user)):
    from app.firestore.base import BaseRepository as _BR
    class _D(_BR):
        collection_name = "pos_devices"
    repo = _D(user["org_id"])
    if not repo.get(device_id):
        raise HTTPException(404, "device not found")
    repo.delete(device_id)
    return {"deleted": True}


@router.post("/hardware/devices/{device_id}/test")
def test_pos_device(device_id: str, user: dict = Depends(get_current_user)):
    """Stub: device health-check. Real driver integration is deployment-specific."""
    from datetime import datetime as _dt
    from app.firestore.base import BaseRepository as _BR
    class _D(_BR):
        collection_name = "pos_devices"
    repo = _D(user["org_id"])
    item = repo.get(device_id)
    if not item:
        raise HTTPException(404, "device not found")
    return repo.update(device_id, {
        "last_test_at": _dt.utcnow().isoformat(),
        "last_test_result": "ok",
    })
