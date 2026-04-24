"""Bulk export endpoints for accountants.

Each endpoint accepts `?format=excel|csv` plus optional `date_from` / `date_to`
filters and streams the result. Reuses repositories already in use elsewhere.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
import io

from app.firestore.invoices import InvoiceRepository
from app.firestore.bills import BillRepository
from app.firestore.journals import JournalEntryRepository
from app.firestore.contacts import ContactRepository
from app.firestore.items import ItemRepository
from app.firestore.inventory import WarehouseStockRepository, WarehouseRepository
from app.firestore.pos import POSOrderRepository
from app.firestore.accounts import AccountRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services.export_service import render

router = APIRouter(prefix="/api/export", tags=["Export"])


def _parse_date(val: str | None) -> datetime | None:
    if not val:
        return None
    try:
        s = val.replace(" ", "T").rstrip("Z")
        if len(s) == 10:
            s += "T00:00:00"
        return datetime.fromisoformat(s)
    except Exception:
        return None


def _date_filters(field: str, date_from: str | None, date_to: str | None) -> list[dict]:
    filters: list[dict] = []
    df = _parse_date(date_from)
    dt = _parse_date(date_to)
    if df:
        filters.append({"field": field, "op": ">=", "value": df})
    if dt:
        filters.append({"field": field, "op": "<=", "value": dt})
    return filters


def _stream(payload: bytes, media_type: str, filename: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(payload),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────── Invoices ───────────────────
@router.get("/invoices", dependencies=[Depends(require_perm("reports.export"))])
def export_invoices(
    format: str = Query("excel", pattern="^(excel|csv)$"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    status: str | None = Query(None),
    user: dict = Depends(get_current_user),
):
    repo = InvoiceRepository(user["org_id"])
    filters = _date_filters("date", date_from, date_to)
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    rows, _ = repo.list(filters=filters, order_by="date", order_dir="DESCENDING", limit=10000)

    columns = [
        ("invoice_number", "Invoice #"),
        ("date", "Date"),
        ("due_date", "Due Date"),
        ("contact_name", "Customer"),
        ("status", "Status"),
        ("currency_code", "Currency"),
        ("subtotal", "Subtotal"),
        ("tax_amount", "Tax"),
        ("total", "Total"),
        ("balance_due", "Balance Due"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="invoices",
        money_columns=["subtotal", "tax_amount", "total", "balance_due"],
        date_columns=["date", "due_date"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Bills ───────────────────
@router.get("/bills", dependencies=[Depends(require_perm("reports.export"))])
def export_bills(
    format: str = Query("excel", pattern="^(excel|csv)$"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    status: str | None = Query(None),
    user: dict = Depends(get_current_user),
):
    repo = BillRepository(user["org_id"])
    filters = _date_filters("date", date_from, date_to)
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    rows, _ = repo.list(filters=filters, order_by="date", order_dir="DESCENDING", limit=10000)

    columns = [
        ("bill_number", "Bill #"),
        ("date", "Date"),
        ("due_date", "Due Date"),
        ("vendor_name", "Vendor"),
        ("status", "Status"),
        ("currency_code", "Currency"),
        ("subtotal", "Subtotal"),
        ("tax_amount", "Tax"),
        ("total", "Total"),
        ("balance_due", "Balance Due"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="bills",
        money_columns=["subtotal", "tax_amount", "total", "balance_due"],
        date_columns=["date", "due_date"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Journal Entries ───────────────────
@router.get("/journal-entries", dependencies=[Depends(require_perm("reports.export"))])
def export_journal_entries(
    format: str = Query("excel", pattern="^(excel|csv)$"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    user: dict = Depends(get_current_user),
):
    repo = JournalEntryRepository(user["org_id"])
    accounts = {a["id"]: a for a in AccountRepository(user["org_id"]).list(limit=2000)[0]}
    filters = _date_filters("date", date_from, date_to)
    entries, _ = repo.list(filters=filters, order_by="date", order_dir="DESCENDING", limit=10000)

    rows: list[dict[str, Any]] = []
    for entry in entries:
        if entry.get("status") == "void":
            continue
        lines = repo.get_lines(entry["id"])
        for line in lines:
            acc = accounts.get(line.get("account_id", ""), {})
            rows.append({
                "date": entry.get("date"),
                "entry_number": entry.get("entry_number"),
                "reference": entry.get("reference"),
                "narration": entry.get("narration"),
                "account_code": acc.get("code", ""),
                "account_name": acc.get("name", ""),
                "description": line.get("description", ""),
                "debit": float(line.get("debit", 0) or 0),
                "credit": float(line.get("credit", 0) or 0),
            })

    columns = [
        ("date", "Date"),
        ("entry_number", "Entry #"),
        ("reference", "Reference"),
        ("account_code", "Account Code"),
        ("account_name", "Account Name"),
        ("description", "Description"),
        ("debit", "Debit"),
        ("credit", "Credit"),
        ("narration", "Narration"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="journal_entries",
        money_columns=["debit", "credit"],
        date_columns=["date"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Trial Balance ───────────────────
@router.get("/trial-balance", dependencies=[Depends(require_perm("reports.export"))])
def export_trial_balance(
    start_date: str = Query(...),
    end_date: str = Query(...),
    format: str = Query("excel", pattern="^(excel|csv)$"),
    user: dict = Depends(get_current_user),
):
    # Reuse the existing reports.trial_balance computation
    from app.api.reports import trial_balance as _trial_balance
    result = _trial_balance(start_date=start_date, end_date=end_date, user=user)
    rows = list(result.get("accounts", []))
    rows.append({
        "account_code": "",
        "account_name": "TOTAL",
        "debit": result.get("total_debit", 0),
        "credit": result.get("total_credit", 0),
    })
    columns = [
        ("account_code", "Code"),
        ("account_name", "Account"),
        ("account_name_ku", "ناوی حساب"),
        ("debit", "Debit"),
        ("credit", "Credit"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="trial_balance",
        money_columns=["debit", "credit"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Customers ───────────────────
@router.get("/customers", dependencies=[Depends(require_perm("reports.export"))])
def export_customers(
    format: str = Query("excel", pattern="^(excel|csv)$"),
    contact_type: str | None = Query(None, description="customer | vendor | both"),
    user: dict = Depends(get_current_user),
):
    repo = ContactRepository(user["org_id"])
    filters: list[dict] = []
    if contact_type and contact_type != "both":
        filters.append({"field": "contact_type", "op": "==", "value": contact_type})
    rows, _ = repo.list(filters=filters, order_by="name", order_dir="ASCENDING", limit=10000)

    columns = [
        ("name", "Name"),
        ("display_name", "Display Name"),
        ("email", "Email"),
        ("phone", "Phone"),
        ("mobile", "Mobile"),
        ("contact_type", "Type"),
        ("tax_number", "Tax #"),
        ("billing_address", "Billing Address"),
        ("shipping_address", "Shipping Address"),
        ("currency_code", "Currency"),
        ("payment_terms", "Payment Terms"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="customers",
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Products ───────────────────
@router.get("/products", dependencies=[Depends(require_perm("reports.export"))])
def export_products(
    format: str = Query("excel", pattern="^(excel|csv)$"),
    user: dict = Depends(get_current_user),
):
    repo = ItemRepository(user["org_id"])
    rows, _ = repo.list(order_by="name", order_dir="ASCENDING", limit=10000)

    columns = [
        ("sku", "SKU"),
        ("name", "Name"),
        ("name_ku", "ناوی کوردی"),
        ("description", "Description"),
        ("item_type", "Type"),
        ("unit", "Unit"),
        ("sales_price", "Sales Price"),
        ("purchase_price", "Purchase Price"),
        ("tax_rate", "Tax %"),
        ("opening_stock", "Opening Stock"),
        ("reorder_point", "Reorder Point"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="products",
        money_columns=["sales_price", "purchase_price"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── POS Sales ───────────────────
@router.get("/pos-sales", dependencies=[Depends(require_perm("reports.export"))])
def export_pos_sales(
    format: str = Query("excel", pattern="^(excel|csv)$"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    user: dict = Depends(get_current_user),
):
    repo = POSOrderRepository(user["org_id"])
    filters = _date_filters("date_order", date_from, date_to)
    rows, _ = repo.list(filters=filters, order_by="date_order", order_dir="DESCENDING", limit=10000)

    columns = [
        ("name", "Order #"),
        ("date_order", "Date"),
        ("session_id", "Session"),
        ("partner_name", "Customer"),
        ("state", "State"),
        ("amount_total", "Total"),
        ("amount_tax", "Tax"),
        ("amount_paid", "Paid"),
        ("amount_return", "Change"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="pos_sales",
        money_columns=["amount_total", "amount_tax", "amount_paid", "amount_return"],
        date_columns=["date_order"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Inventory ───────────────────
@router.get("/inventory", dependencies=[Depends(require_perm("reports.export"))])
def export_inventory(
    format: str = Query("excel", pattern="^(excel|csv)$"),
    warehouse_id: str | None = Query(None),
    user: dict = Depends(get_current_user),
):
    stock_repo = WarehouseStockRepository(user["org_id"])
    item_repo = ItemRepository(user["org_id"])
    wh_repo = WarehouseRepository(user["org_id"])

    items_by_id = {i["id"]: i for i in item_repo.list(limit=10000)[0]}
    wh_by_id = {w["id"]: w for w in wh_repo.list(limit=200)[0]}

    filters: list[dict] = []
    if warehouse_id:
        filters.append({"field": "warehouse_id", "op": "==", "value": warehouse_id})
    stock_rows, _ = stock_repo.list(filters=filters, limit=10000)

    rows = []
    for s in stock_rows:
        item = items_by_id.get(s.get("item_id"), {})
        wh = wh_by_id.get(s.get("warehouse_id"), {})
        qty = float(s.get("quantity", 0) or 0)
        cost = float(item.get("purchase_price", 0) or 0)
        rows.append({
            "sku": item.get("sku", ""),
            "name": item.get("name", ""),
            "warehouse": wh.get("name", ""),
            "quantity": qty,
            "unit": item.get("unit", ""),
            "unit_cost": cost,
            "total_value": round(qty * cost, 2),
            "reorder_point": item.get("reorder_point", 0),
        })

    columns = [
        ("sku", "SKU"),
        ("name", "Product"),
        ("warehouse", "Warehouse"),
        ("quantity", "Qty"),
        ("unit", "Unit"),
        ("unit_cost", "Unit Cost"),
        ("total_value", "Total Value"),
        ("reorder_point", "Reorder Point"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="inventory",
        money_columns=["unit_cost", "total_value"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Profit & Loss ───────────────────
@router.get("/profit-loss", dependencies=[Depends(require_perm("reports.export"))])
def export_profit_loss(
    start_date: str = Query(...),
    end_date: str = Query(...),
    format: str = Query("excel", pattern="^(excel|csv)$"),
    user: dict = Depends(get_current_user),
):
    from app.api.reports import profit_loss as _pl
    result = _pl(start_date=start_date, end_date=end_date, user=user)
    rows: list[dict] = []
    for r in result.get("revenue", []):
        rows.append({"section": "Income", **r, "amount": r.get("amount", 0)})
    for e in result.get("expenses", []):
        rows.append({"section": "Expense", **e, "amount": e.get("amount", 0)})
    rows.append({"section": "Total Income", "account_name": "", "amount": result.get("total_revenue", 0)})
    rows.append({"section": "Total Expenses", "account_name": "", "amount": result.get("total_expenses", 0)})
    rows.append({"section": "Net Profit", "account_name": "", "amount": result.get("net_profit", 0)})

    columns = [
        ("section", "Section"),
        ("account_code", "Code"),
        ("account_name", "Account"),
        ("account_name_ku", "ناوی حساب"),
        ("amount", "Amount"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="profit_loss",
        money_columns=["amount"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Balance Sheet ───────────────────
@router.get("/balance-sheet", dependencies=[Depends(require_perm("reports.export"))])
def export_balance_sheet(
    as_of_date: str = Query(...),
    format: str = Query("excel", pattern="^(excel|csv)$"),
    user: dict = Depends(get_current_user),
):
    from app.api.reports import balance_sheet as _bs
    result = _bs(as_of_date=as_of_date, user=user)
    rows: list[dict] = []
    for section_key, section_label in (
        ("assets", "Asset"),
        ("liabilities", "Liability"),
        ("equity", "Equity"),
    ):
        for r in result.get(section_key, []):
            rows.append({"section": section_label, **r})
    rows.append({"section": "Total Assets", "account_name": "", "balance": result.get("total_assets", 0)})
    rows.append({"section": "Total Liabilities", "account_name": "", "balance": result.get("total_liabilities", 0)})
    rows.append({"section": "Total Equity", "account_name": "", "balance": result.get("total_equity", 0)})

    columns = [
        ("section", "Section"),
        ("account_code", "Code"),
        ("account_name", "Account"),
        ("balance", "Balance"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="balance_sheet",
        money_columns=["balance"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Cash Flow ───────────────────
@router.get("/cash-flow", dependencies=[Depends(require_perm("reports.export"))])
def export_cash_flow(
    start_date: str = Query(...),
    end_date: str = Query(...),
    format: str = Query("excel", pattern="^(excel|csv)$"),
    user: dict = Depends(get_current_user),
):
    from app.api.reports import cash_flow_report as _cf
    result = _cf(start_date=start_date, end_date=end_date, user=user)
    rows: list[dict] = list(result.get("periods", []))
    rows.append({
        "month": "TOTAL",
        "inflows": result.get("total_inflows", 0),
        "outflows": result.get("total_outflows", 0),
        "net": result.get("net_cash_flow", 0),
    })
    columns = [
        ("month", "Month"),
        ("inflows", "Inflows"),
        ("outflows", "Outflows"),
        ("net", "Net Cash"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="cash_flow",
        money_columns=["inflows", "outflows", "net"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Aging — Receivables ───────────────────
@router.get("/aging-receivables", dependencies=[Depends(require_perm("reports.export"))])
def export_aging_receivables(
    format: str = Query("excel", pattern="^(excel|csv)$"),
    user: dict = Depends(get_current_user),
):
    from app.api.reports import receivable_aging as _ra
    result = _ra(user=user)
    rows = result.get("details", [])
    columns = [
        ("invoice_number", "Invoice #"),
        ("contact_name", "Customer"),
        ("due_date", "Due Date"),
        ("days_overdue", "Days Overdue"),
        ("bucket", "Bucket"),
        ("balance_due", "Balance Due"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="aging_receivables",
        money_columns=["balance_due"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Aging — Payables ───────────────────
@router.get("/aging-payables", dependencies=[Depends(require_perm("reports.export"))])
def export_aging_payables(
    format: str = Query("excel", pattern="^(excel|csv)$"),
    user: dict = Depends(get_current_user),
):
    from app.api.reports import payable_aging as _pa
    result = _pa(user=user)
    rows = result.get("details", [])
    columns = [
        ("bill_number", "Bill #"),
        ("vendor_name", "Vendor"),
        ("due_date", "Due Date"),
        ("days_overdue", "Days Overdue"),
        ("bucket", "Bucket"),
        ("balance_due", "Balance Due"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="aging_payables",
        money_columns=["balance_due"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Sales by Customer ───────────────────
@router.get("/sales-by-customer", dependencies=[Depends(require_perm("reports.export"))])
def export_sales_by_customer(
    start_date: str = Query(...),
    end_date: str = Query(...),
    format: str = Query("excel", pattern="^(excel|csv)$"),
    user: dict = Depends(get_current_user),
):
    from app.api.reports import sales_by_customer as _sbc
    result = _sbc(start_date=start_date, end_date=end_date, user=user)
    rows = result.get("customers", [])
    columns = [
        ("customer", "Customer"),
        ("count", "Invoices"),
        ("total", "Total"),
        ("paid", "Paid"),
        ("outstanding", "Outstanding"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="sales_by_customer",
        money_columns=["total", "paid", "outstanding"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Sales by Item ───────────────────
@router.get("/sales-by-item", dependencies=[Depends(require_perm("reports.export"))])
def export_sales_by_item(
    start_date: str = Query(...),
    end_date: str = Query(...),
    format: str = Query("excel", pattern="^(excel|csv)$"),
    user: dict = Depends(get_current_user),
):
    from app.api.reports import sales_by_item as _sbi
    result = _sbi(start_date=start_date, end_date=end_date, user=user)
    rows = result.get("items", [])
    columns = [
        ("item", "Product"),
        ("quantity", "Quantity"),
        ("revenue", "Revenue"),
        ("count", "Line Count"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="sales_by_item",
        money_columns=["revenue"],
    )
    return _stream(payload, media_type, filename)


# ─────────────────── Tax Summary ───────────────────
@router.get("/tax-summary", dependencies=[Depends(require_perm("reports.export"))])
def export_tax_summary(
    start_date: str = Query(...),
    end_date: str = Query(...),
    format: str = Query("excel", pattern="^(excel|csv)$"),
    user: dict = Depends(get_current_user),
):
    from app.api.reports import tax_summary as _ts
    result = _ts(start_date=start_date, end_date=end_date, user=user)
    rows = [
        {"label": "Output Tax (Sales)", "amount": result.get("output_tax", 0)},
        {"label": "Input Tax (Purchases)", "amount": result.get("input_tax", 0)},
        {"label": "Net Tax Payable", "amount": result.get("net_tax", 0)},
    ]
    columns = [
        ("label", "Item"),
        ("amount", "Amount"),
    ]
    payload, media_type, filename = render(
        rows, columns, fmt=format, title="tax_summary",
        money_columns=["amount"],
    )
    return _stream(payload, media_type, filename)

