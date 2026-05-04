"""API endpoints for custom user dashboards"""
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from typing import Optional, Any, Literal
from datetime import datetime
from app.firestore.dashboards import DashboardRepository
from app.firestore.invoices import InvoiceRepository, PaymentReceivedRepository
from app.firestore.bills import BillRepository, PaymentMadeRepository
from app.firestore.expenses import ExpenseRepository
from app.firestore.contacts import ContactRepository
from app.firestore.items import ItemRepository
from app.firestore.pos import POSOrderRepository
from app.services.auth import get_current_user
import uuid
import functools


router = APIRouter(prefix="/api/dashboards", tags=["Dashboards"])


class WidgetLayout(BaseModel):
    x: int
    y: int
    w: int
    h: int


class WidgetDataSource(BaseModel):
    key: str
    params: dict[str, Any] = Field(default_factory=dict)
    value_path: str = Field(default="data.value")


class WidgetConfig(BaseModel):
    color: Optional[str] = None
    icon: Optional[str] = None
    unit: Optional[str] = None
    format: Optional[str] = "number"


class DashboardWidget(BaseModel):
    id: str
    type: Literal["kpi", "line", "bar", "pie", "table", "progress", "iframe"]
    title: str
    data_source: WidgetDataSource
    layout: WidgetLayout
    config: WidgetConfig = Field(default_factory=WidgetConfig)
    refresh_interval_sec: Optional[int] = None


class DefaultFilters(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    branch_id: Optional[str] = None


class DashboardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    is_shared: bool = False
    shared_with: list[str] = Field(default_factory=list)
    widgets: list[DashboardWidget] = Field(default_factory=list)
    default_filters: DefaultFilters = Field(default_factory=DefaultFilters)


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    is_shared: Optional[bool] = None
    widgets: Optional[list[DashboardWidget]] = None
    default_filters: Optional[DefaultFilters] = None


class ShareRequest(BaseModel):
    user_ids: list[str]


def _get_nested_value(data: dict, path: str) -> Any:
    """Resolve dotted path like 'data.summary.total'"""
    try:
        keys = path.split(".")
        return functools.reduce(lambda d, k: d[k] if isinstance(d, dict) else None, keys, data)
    except (KeyError, TypeError):
        return None


def _parse_date(val):
    """Parse date string to datetime"""
    if not val:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=None)
    if isinstance(val, str):
        try:
            s = val.replace(" ", "T").rstrip("Z")
            if len(s) == 10:
                s += "T00:00:00"
            dt = datetime.fromisoformat(s)
            return dt.replace(tzinfo=None)
        except Exception:
            return None
    return None


def _execute_data_source(org_id: str, key: str, params: dict) -> dict:
    """Execute a data source query and return structured result"""
    now = datetime.utcnow()
    date_from = _parse_date(params.get("date_from"))
    date_to = _parse_date(params.get("date_to"))
    
    # Default to current month if no dates
    if not date_from:
        date_from = datetime(now.year, now.month, 1)
    if not date_to:
        date_to = now
    
    inv_repo = InvoiceRepository(org_id)
    bill_repo = BillRepository(org_id)
    payment_repo = PaymentReceivedRepository(org_id)
    bill_payment_repo = PaymentMadeRepository(org_id)
    expense_repo = ExpenseRepository(org_id)
    contact_repo = ContactRepository(org_id)
    item_repo = ItemRepository(org_id)
    pos_repo = POSOrderRepository(org_id)
    
    if key == "total_revenue":
        payments, _ = payment_repo.list(
            filters=[
                {"field": "date", "op": ">=", "value": date_from},
                {"field": "date", "op": "<=", "value": date_to}
            ],
            limit=10000
        )
        total = sum(p.get("amount", 0) for p in payments)
        return {"data": {"value": total}}
    
    elif key == "total_expenses":
        expenses, _ = expense_repo.list(
            filters=[
                {"field": "date", "op": ">=", "value": date_from},
                {"field": "date", "op": "<=", "value": date_to}
            ],
            limit=10000
        )
        total = sum(e.get("amount", 0) for e in expenses if e.get("status") != "void")
        return {"data": {"value": total}}
    
    elif key == "ar_balance":
        invoices, _ = inv_repo.list(
            filters=[
                {"field": "status", "op": "in", "value": ["sent", "partially_paid", "overdue"]}
            ],
            limit=10000
        )
        total = sum(inv.get("balance_due", 0) for inv in invoices)
        return {"data": {"value": total}}
    
    elif key == "ap_balance":
        bills, _ = bill_repo.list(
            filters=[
                {"field": "status", "op": "in", "value": ["open", "partially_paid", "overdue"]}
            ],
            limit=10000
        )
        total = sum(b.get("balance_due", 0) for b in bills)
        return {"data": {"value": total}}
    
    elif key == "cash_position":
        # Revenue - Expenses
        payments, _ = payment_repo.list(limit=10000)
        bill_payments, _ = bill_payment_repo.list(limit=10000)
        expenses, _ = expense_repo.list(limit=10000)
        
        revenue = sum(p.get("amount", 0) for p in payments)
        paid_bills = sum(bp.get("amount", 0) for bp in bill_payments)
        direct_expenses = sum(e.get("amount", 0) for e in expenses if e.get("status") != "void")
        
        cash = revenue - paid_bills - direct_expenses
        return {"data": {"value": cash}}
    
    elif key == "open_invoices_count":
        invoices, _ = inv_repo.list(
            filters=[
                {"field": "status", "op": "in", "value": ["draft", "sent", "partially_paid"]}
            ],
            limit=10000
        )
        return {"data": {"value": len(invoices)}}
    
    elif key == "overdue_bills_count":
        bills, _ = bill_repo.list(
            filters=[
                {"field": "status", "op": "in", "value": ["open", "partially_paid"]}
            ],
            limit=10000
        )
        overdue = [b for b in bills if _parse_date(b.get("due_date")) and _parse_date(b.get("due_date")) < now]
        return {"data": {"value": len(overdue)}}
    
    elif key == "inventory_value":
        items, _ = item_repo.list(limit=10000)
        total = sum(
            (item.get("stock_on_hand", 0) * item.get("purchase_price", 0))
            for item in items if item.get("type") == "inventory"
        )
        return {"data": {"value": total}}
    
    elif key == "total_contacts":
        contacts, total = contact_repo.list(
            filters=[{"field": "is_active", "op": "!=", "value": False}],
            limit=1
        )
        return {"data": {"value": total}}
    
    elif key == "pos_sales_today":
        today_start = datetime(now.year, now.month, now.day)
        orders, _ = pos_repo.list(
            filters=[
                {"field": "created_at", "op": ">=", "value": today_start},
                {"field": "status", "op": "==", "value": "completed"}
            ],
            limit=10000
        )
        total = sum(o.get("total", 0) for o in orders)
        return {"data": {"value": total}}
    
    elif key == "top_customers":
        invoices, _ = inv_repo.list(
            filters=[
                {"field": "date", "op": ">=", "value": date_from},
                {"field": "date", "op": "<=", "value": date_to}
            ],
            limit=10000
        )
        # Aggregate by contact
        customer_totals = {}
        for inv in invoices:
            cid = inv.get("contact_id")
            cname = inv.get("contact_name", "Unknown")
            total = inv.get("total", 0)
            if cid not in customer_totals:
                customer_totals[cid] = {"name": cname, "total": 0}
            customer_totals[cid]["total"] += total
        
        top = sorted(customer_totals.values(), key=lambda x: x["total"], reverse=True)[:5]
        return {"data": {"items": top}}
    
    elif key == "top_products":
        # Aggregate line items from invoices
        invoices, _ = inv_repo.list(
            filters=[
                {"field": "date", "op": ">=", "value": date_from},
                {"field": "date", "op": "<=", "value": date_to}
            ],
            limit=10000
        )
        product_totals = {}
        for inv in invoices:
            for line in inv.get("line_items", []):
                item_id = line.get("item_id")
                item_name = line.get("item_name", "Unknown")
                qty = line.get("quantity", 0)
                if item_id not in product_totals:
                    product_totals[item_id] = {"name": item_name, "quantity": 0}
                product_totals[item_id]["quantity"] += qty
        
        top = sorted(product_totals.values(), key=lambda x: x["quantity"], reverse=True)[:5]
        return {"data": {"items": top}}
    
    elif key == "ar_aging":
        invoices, _ = inv_repo.list(
            filters=[
                {"field": "status", "op": "in", "value": ["sent", "partially_paid", "overdue"]}
            ],
            limit=10000
        )
        aging_buckets = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
        for inv in invoices:
            due = _parse_date(inv.get("due_date"))
            if not due:
                continue
            days_overdue = (now - due).days
            balance = inv.get("balance_due", 0)
            
            if days_overdue < 0:
                aging_buckets["0-30"] += balance
            elif days_overdue <= 30:
                aging_buckets["0-30"] += balance
            elif days_overdue <= 60:
                aging_buckets["31-60"] += balance
            elif days_overdue <= 90:
                aging_buckets["61-90"] += balance
            else:
                aging_buckets["90+"] += balance
        
        items = [{"period": k, "amount": v} for k, v in aging_buckets.items()]
        return {"data": {"items": items}}
    
    elif key == "stock_alerts":
        items, _ = item_repo.list(limit=10000)
        low_stock = [
            {
                "name": item.get("name"),
                "stock": item.get("stock_on_hand", 0),
                "reorder_level": item.get("reorder_level", 0)
            }
            for item in items
            if item.get("type") == "inventory" and item.get("stock_on_hand", 0) < item.get("reorder_level", 0)
        ]
        return {"data": {"items": low_stock}}
    
    elif key == "upcoming_due":
        # Bills due in next 7 days
        in_7_days = now + datetime.timedelta(days=7)
        bills, _ = bill_repo.list(
            filters=[
                {"field": "status", "op": "in", "value": ["open", "partially_paid"]}
            ],
            limit=10000
        )
        upcoming = [
            {
                "bill_number": b.get("bill_number"),
                "vendor_name": b.get("vendor_name"),
                "due_date": b.get("due_date"),
                "balance_due": b.get("balance_due", 0)
            }
            for b in bills
            if _parse_date(b.get("due_date")) and now <= _parse_date(b.get("due_date")) <= in_7_days
        ]
        return {"data": {"items": upcoming}}
    
    # Default fallback
    return {"data": {"value": 0}}


@router.get("")
def list_dashboards(user: dict = Depends(get_current_user)):
    """List all dashboards accessible to user (owned + shared)"""
    org_id = user["org_id"]
    user_id = user["id"]
    repo = DashboardRepository(org_id)
    
    owned = repo.get_by_owner(user_id)
    shared = repo.get_shared_with_user(user_id)
    
    # Mark ownership
    for d in owned:
        d["is_owner"] = True
    for d in shared:
        d["is_owner"] = False
    
    all_dashboards = owned + shared
    return {"data": all_dashboards}


@router.post("", status_code=201)
def create_dashboard(
    body: DashboardCreate,
    user: dict = Depends(get_current_user)
):
    """Create a new dashboard"""
    org_id = user["org_id"]
    user_id = user["id"]
    repo = DashboardRepository(org_id)
    
    doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "owner_user_id": user_id,
        "name": body.name,
        "is_shared": body.is_shared,
        "shared_with": body.shared_with,
        "widgets": [w.model_dump() for w in body.widgets],
        "default_filters": body.default_filters.model_dump(),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    repo.create(doc)
    return {"data": doc}


@router.get("/{dashboard_id}")
def get_dashboard(
    dashboard_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Get a single dashboard"""
    org_id = user["org_id"]
    user_id = user["id"]
    repo = DashboardRepository(org_id)
    
    doc = repo.get_by_id(dashboard_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # Check access
    if doc.get("owner_user_id") != user_id and user_id not in doc.get("shared_with", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {"data": doc}


@router.put("/{dashboard_id}")
def update_dashboard(
    body: DashboardUpdate,
    dashboard_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Update a dashboard (owner only)"""
    org_id = user["org_id"]
    user_id = user["id"]
    repo = DashboardRepository(org_id)
    
    doc = repo.get_by_id(dashboard_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    if doc.get("owner_user_id") != user_id:
        raise HTTPException(status_code=403, detail="Only owner can edit")
    
    updates = {"updated_at": datetime.utcnow()}
    if body.name is not None:
        updates["name"] = body.name
    if body.is_shared is not None:
        updates["is_shared"] = body.is_shared
    if body.widgets is not None:
        updates["widgets"] = [w.model_dump() for w in body.widgets]
    if body.default_filters is not None:
        updates["default_filters"] = body.default_filters.model_dump()
    
    repo.update(dashboard_id, updates)
    doc.update(updates)
    return {"data": doc}


@router.delete("/{dashboard_id}", status_code=204)
def delete_dashboard(
    dashboard_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Delete a dashboard (owner only)"""
    org_id = user["org_id"]
    user_id = user["id"]
    repo = DashboardRepository(org_id)
    
    doc = repo.get_by_id(dashboard_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    if doc.get("owner_user_id") != user_id:
        raise HTTPException(status_code=403, detail="Only owner can delete")
    
    repo.delete(dashboard_id)
    return None


@router.post("/{dashboard_id}/share")
def share_dashboard(
    body: ShareRequest,
    dashboard_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Share dashboard with users"""
    org_id = user["org_id"]
    user_id = user["id"]
    repo = DashboardRepository(org_id)
    
    doc = repo.get_by_id(dashboard_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    if doc.get("owner_user_id") != user_id:
        raise HTTPException(status_code=403, detail="Only owner can share")
    
    # Merge with existing
    existing = set(doc.get("shared_with", []))
    new_shared = list(existing | set(body.user_ids))
    
    repo.update(dashboard_id, {
        "shared_with": new_shared,
        "is_shared": True,
        "updated_at": datetime.utcnow()
    })
    
    return {"data": {"shared_with": new_shared}}


@router.post("/{dashboard_id}/clone", status_code=201)
def clone_dashboard(
    dashboard_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Clone a dashboard"""
    org_id = user["org_id"]
    user_id = user["id"]
    repo = DashboardRepository(org_id)
    
    src = repo.get_by_id(dashboard_id)
    if not src:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # Check access
    if src.get("owner_user_id") != user_id and user_id not in src.get("shared_with", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    clone = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "owner_user_id": user_id,
        "name": f"{src.get('name')} (Copy)",
        "is_shared": False,
        "shared_with": [],
        "widgets": src.get("widgets", []),
        "default_filters": src.get("default_filters", {}),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    repo.create(clone)
    return {"data": clone}


@router.get("/{dashboard_id}/data")
def get_widget_data(
    dashboard_id: str = Path(...),
    widget_id: str = Query(...),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Execute a widget's data source and return resolved value"""
    org_id = user["org_id"]
    user_id = user["id"]
    repo = DashboardRepository(org_id)
    
    dashboard = repo.get_by_id(dashboard_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # Check access
    if dashboard.get("owner_user_id") != user_id and user_id not in dashboard.get("shared_with", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Find widget
    widget = None
    for w in dashboard.get("widgets", []):
        if w.get("id") == widget_id:
            widget = w
            break
    
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    
    # Execute data source
    ds = widget.get("data_source", {})
    key = ds.get("key")
    params = ds.get("params", {})
    value_path = ds.get("value_path", "data.value")
    
    # Override with query params if provided
    if date_from:
        params["date_from"] = date_from
    if date_to:
        params["date_to"] = date_to
    
    result = _execute_data_source(org_id, key, params)
    value = _get_nested_value(result, value_path)
    
    return {"data": {"value": value, "raw": result}}


@router.get("/widget-catalog")
def get_widget_catalog():
    """Return available widget templates"""
    catalog = [
        {
            "type": "kpi",
            "label": "Total Revenue",
            "description": "Sum of all payment receipts",
            "default_config": {"color": "green", "icon": "dollar", "unit": "IQD", "format": "number"},
            "available_data_sources": [
                {
                    "key": "total_revenue",
                    "label": "Total Revenue",
                    "params_schema": {"date_from": "date", "date_to": "date"}
                }
            ]
        },
        {
            "type": "kpi",
            "label": "Total Expenses",
            "description": "Sum of all expenses",
            "default_config": {"color": "red", "icon": "wallet", "unit": "IQD", "format": "number"},
            "available_data_sources": [
                {
                    "key": "total_expenses",
                    "label": "Total Expenses",
                    "params_schema": {"date_from": "date", "date_to": "date"}
                }
            ]
        },
        {
            "type": "kpi",
            "label": "Accounts Receivable",
            "description": "Total outstanding from customers",
            "default_config": {"color": "blue", "icon": "file-text", "unit": "IQD", "format": "number"},
            "available_data_sources": [
                {
                    "key": "ar_balance",
                    "label": "AR Balance",
                    "params_schema": {}
                }
            ]
        },
        {
            "type": "kpi",
            "label": "Accounts Payable",
            "description": "Total outstanding to vendors",
            "default_config": {"color": "orange", "icon": "file", "unit": "IQD", "format": "number"},
            "available_data_sources": [
                {
                    "key": "ap_balance",
                    "label": "AP Balance",
                    "params_schema": {}
                }
            ]
        },
        {
            "type": "kpi",
            "label": "Cash Position",
            "description": "Net cash (revenue - expenses)",
            "default_config": {"color": "purple", "icon": "bank", "unit": "IQD", "format": "number"},
            "available_data_sources": [
                {
                    "key": "cash_position",
                    "label": "Cash Position",
                    "params_schema": {}
                }
            ]
        },
        {
            "type": "kpi",
            "label": "Open Invoices",
            "description": "Count of open/partially paid invoices",
            "default_config": {"color": "cyan", "icon": "file-text", "format": "number"},
            "available_data_sources": [
                {
                    "key": "open_invoices_count",
                    "label": "Open Invoices Count",
                    "params_schema": {}
                }
            ]
        },
        {
            "type": "kpi",
            "label": "Overdue Bills",
            "description": "Count of overdue bills",
            "default_config": {"color": "red", "icon": "warning", "format": "number"},
            "available_data_sources": [
                {
                    "key": "overdue_bills_count",
                    "label": "Overdue Bills Count",
                    "params_schema": {}
                }
            ]
        },
        {
            "type": "kpi",
            "label": "Inventory Value",
            "description": "Total value of stock on hand",
            "default_config": {"color": "geekblue", "icon": "inbox", "unit": "IQD", "format": "number"},
            "available_data_sources": [
                {
                    "key": "inventory_value",
                    "label": "Inventory Value",
                    "params_schema": {}
                }
            ]
        },
        {
            "type": "kpi",
            "label": "Total Contacts",
            "description": "Active customer and vendor count",
            "default_config": {"color": "magenta", "icon": "team", "format": "number"},
            "available_data_sources": [
                {
                    "key": "total_contacts",
                    "label": "Total Contacts",
                    "params_schema": {}
                }
            ]
        },
        {
            "type": "kpi",
            "label": "Today's POS Sales",
            "description": "POS orders completed today",
            "default_config": {"color": "green", "icon": "shopping-cart", "unit": "IQD", "format": "number"},
            "available_data_sources": [
                {
                    "key": "pos_sales_today",
                    "label": "Today POS Sales",
                    "params_schema": {}
                }
            ]
        },
        {
            "type": "bar",
            "label": "Top Customers",
            "description": "Top 5 customers by revenue",
            "default_config": {"color": "blue"},
            "available_data_sources": [
                {
                    "key": "top_customers",
                    "label": "Top Customers",
                    "params_schema": {"date_from": "date", "date_to": "date"}
                }
            ]
        },
        {
            "type": "bar",
            "label": "Top Products",
            "description": "Top 5 products by quantity sold",
            "default_config": {"color": "green"},
            "available_data_sources": [
                {
                    "key": "top_products",
                    "label": "Top Products",
                    "params_schema": {"date_from": "date", "date_to": "date"}
                }
            ]
        },
        {
            "type": "table",
            "label": "AR Aging",
            "description": "Receivables aging buckets",
            "default_config": {},
            "available_data_sources": [
                {
                    "key": "ar_aging",
                    "label": "AR Aging Report",
                    "params_schema": {}
                }
            ]
        },
        {
            "type": "table",
            "label": "Stock Alerts",
            "description": "Items below reorder level",
            "default_config": {},
            "available_data_sources": [
                {
                    "key": "stock_alerts",
                    "label": "Low Stock Items",
                    "params_schema": {}
                }
            ]
        },
        {
            "type": "table",
            "label": "Upcoming Due",
            "description": "Bills due in next 7 days",
            "default_config": {},
            "available_data_sources": [
                {
                    "key": "upcoming_due",
                    "label": "Upcoming Bills",
                    "params_schema": {}
                }
            ]
        }
    ]
    
    return {"data": catalog}


@router.post("/{dashboard_id}/set-default")
def set_default_dashboard(
    dashboard_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Set user's default dashboard (stored in user preferences - placeholder)"""
    org_id = user["org_id"]
    user_id = user["id"]
    repo = DashboardRepository(org_id)
    
    dashboard = repo.get_by_id(dashboard_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # Check access
    if dashboard.get("owner_user_id") != user_id and user_id not in dashboard.get("shared_with", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # In a real implementation, store in user_preferences collection
    # For now, just return success
    return {"data": {"default_dashboard_id": dashboard_id}}
