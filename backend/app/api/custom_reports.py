# API endpoints for custom report builder
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from app.firestore.custom_reports import CustomReportRepository
from app.firestore.invoices import InvoiceRepository, SalesOrderRepository
from app.firestore.bills import BillRepository
from app.firestore.contacts import ContactRepository
from app.firestore.items import ItemRepository
from app.firestore.journals import JournalEntryRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
import uuid

router = APIRouter(prefix="/api/custom-reports", tags=["CustomReports"])


# Field definitions for each data source
FIELD_MAPS = {
    "invoices": {
        "id": "string", "invoice_number": "string", "contact_name": "string",
        "date": "date", "due_date": "date", "status": "string",
        "subtotal": "number", "tax_total": "number", "total": "number",
        "balance": "number", "notes": "string", "created_at": "date"
    },
    "bills": {
        "id": "string", "bill_number": "string", "vendor_name": "string",
        "date": "date", "due_date": "date", "status": "string",
        "subtotal": "number", "tax_total": "number", "total": "number",
        "balance": "number", "notes": "string", "created_at": "date"
    },
    "sales_orders": {
        "id": "string", "order_number": "string", "contact_name": "string",
        "date": "date", "expected_shipment_date": "date", "status": "string",
        "subtotal": "number", "tax_total": "number", "total": "number",
        "notes": "string", "created_at": "date"
    },
    "contacts": {
        "id": "string", "name": "string", "email": "string", "phone": "string",
        "type": "string", "company": "string", "address": "string",
        "balance": "number", "created_at": "date"
    },
    "items": {
        "id": "string", "name": "string", "sku": "string", "type": "string",
        "unit": "string", "sales_price": "number", "purchase_price": "number",
        "stock_on_hand": "number", "reorder_level": "number", "created_at": "date"
    },
    "journals": {
        "id": "string", "reference": "string", "date": "date", "status": "string",
        "notes": "string", "created_at": "date", "created_by": "string"
    }
}


class FilterCondition(BaseModel):
    field: str
    operator: str = Field(..., description="eq|gt|lt|contains|between")
    value: Any


class CustomReportCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    source: str = Field(..., description="invoices|bills|sales_orders|contacts|items|journals")
    columns: list[str] = Field(..., min_items=1)
    filters: list[FilterCondition] = Field(default_factory=list)
    group_by: Optional[str] = None
    sort_by: Optional[str] = None
    sort_dir: Optional[str] = Field("DESC", pattern="^(ASC|DESC)$")


class CustomReportUpdate(BaseModel):
    name: Optional[str] = None
    columns: Optional[list[str]] = None
    filters: Optional[list[FilterCondition]] = None
    group_by: Optional[str] = None
    sort_by: Optional[str] = None
    sort_dir: Optional[str] = None


class RunReportRequest(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None


def _parse_date(val):
    """Parse date string to datetime"""
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        try:
            s = val.replace(" ", "T").rstrip("Z")
            if len(s) == 10:
                s += "T00:00:00"
            return datetime.fromisoformat(s)
        except Exception:
            return None
    return None


def _apply_filter(item: dict, condition: FilterCondition) -> bool:
    """Apply a single filter condition to an item"""
    field_value = item.get(condition.field)
    if field_value is None:
        return False

    operator = condition.operator
    filter_value = condition.value

    # Handle date comparisons
    if operator in ["gt", "lt", "between"]:
        field_value = _parse_date(field_value)
        if operator == "between" and isinstance(filter_value, list) and len(filter_value) == 2:
            start = _parse_date(filter_value[0])
            end = _parse_date(filter_value[1])
            return start <= field_value <= end if (start and end and field_value) else False
        filter_value = _parse_date(filter_value)

    if operator == "eq":
        return field_value == filter_value
    elif operator == "gt":
        return field_value > filter_value if field_value and filter_value else False
    elif operator == "lt":
        return field_value < filter_value if field_value and filter_value else False
    elif operator == "contains":
        return filter_value.lower() in str(field_value).lower()
    
    return False


def _get_repo_for_source(source: str, org_id: str):
    """Get the appropriate repository for a data source"""
    repo_map = {
        "invoices": InvoiceRepository,
        "bills": BillRepository,
        "sales_orders": SalesOrderRepository,
        "contacts": ContactRepository,
        "items": ItemRepository,
        "journals": JournalEntryRepository,
    }
    repo_class = repo_map.get(source)
    if not repo_class:
        raise ValueError(f"Unknown source: {source}")
    return repo_class(org_id)


@router.get("/sources/{source}/fields", dependencies=[Depends(require_perm("reports.read"))])
def get_source_fields(source: str):
    """Get available fields for a data source"""
    if source not in FIELD_MAPS:
        raise HTTPException(status_code=400, detail="Unknown source")
    return {"source": source, "fields": FIELD_MAPS[source]}


@router.get("", dependencies=[Depends(require_perm("reports.read"))])
def list_custom_reports(user: dict = Depends(get_current_user)):
    """List all custom reports for the current user"""
    org_id = user.get("org_id")
    user_id = user.get("uid")
    repo = CustomReportRepository(org_id)
    reports = repo.get_user_reports(user_id)
    return {"items": reports, "total": len(reports)}


@router.post("", dependencies=[Depends(require_perm("reports.write"))])
def create_custom_report(
    data: CustomReportCreate,
    user: dict = Depends(get_current_user)
):
    """Create a new custom report"""
    org_id = user.get("org_id")
    user_id = user.get("uid")
    repo = CustomReportRepository(org_id)

    # Validate source
    if data.source not in FIELD_MAPS:
        raise HTTPException(status_code=400, detail="Invalid source")

    # Validate columns
    available_fields = FIELD_MAPS[data.source]
    for col in data.columns:
        if col not in available_fields:
            raise HTTPException(status_code=400, detail=f"Invalid column: {col}")

    report_doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "name": data.name,
        "source": data.source,
        "columns": data.columns,
        "filters": [f.model_dump() for f in data.filters],
        "group_by": data.group_by,
        "sort_by": data.sort_by,
        "sort_dir": data.sort_dir,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": user_id,
    }
    repo.create(report_doc["id"], report_doc)
    return report_doc


@router.get("/{report_id}", dependencies=[Depends(require_perm("reports.read"))])
def get_custom_report(
    report_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Get a custom report by ID"""
    org_id = user.get("org_id")
    repo = CustomReportRepository(org_id)
    report = repo.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.put("/{report_id}", dependencies=[Depends(require_perm("reports.write"))])
def update_custom_report(
    data: CustomReportUpdate,
    report_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Update a custom report"""
    org_id = user.get("org_id")
    repo = CustomReportRepository(org_id)

    existing = repo.get(report_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Report not found")

    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    
    # Validate columns if provided
    if "columns" in update_data:
        source = existing.get("source")
        available_fields = FIELD_MAPS.get(source, {})
        for col in update_data["columns"]:
            if col not in available_fields:
                raise HTTPException(status_code=400, detail=f"Invalid column: {col}")

    repo.update(report_id, update_data)
    return {**existing, **update_data}


@router.delete("/{report_id}", dependencies=[Depends(require_perm("reports.write"))])
def delete_custom_report(
    report_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Delete a custom report"""
    org_id = user.get("org_id")
    repo = CustomReportRepository(org_id)

    existing = repo.get(report_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Report not found")

    repo.delete(report_id)
    return {"message": "Report deleted"}


@router.post("/{report_id}/run", dependencies=[Depends(require_perm("reports.read"))])
def run_custom_report(
    request: RunReportRequest,
    report_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Execute a custom report and return results"""
    org_id = user.get("org_id")
    repo = CustomReportRepository(org_id)

    report = repo.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    source = report.get("source")
    columns = report.get("columns", [])
    filters = report.get("filters", [])
    sort_by = report.get("sort_by")
    sort_dir = report.get("sort_dir", "DESC")

    # Load data from source
    data_repo = _get_repo_for_source(source, org_id)
    items, _ = data_repo.list(limit=10000)

    # Apply date range if provided
    date_from = _parse_date(request.date_from)
    date_to = _parse_date(request.date_to)
    if date_from or date_to:
        filtered = []
        for item in items:
            item_date = _parse_date(item.get("date") or item.get("created_at"))
            if date_from and item_date and item_date < date_from:
                continue
            if date_to and item_date and item_date > date_to:
                continue
            filtered.append(item)
        items = filtered

    # Apply custom filters
    for filter_dict in filters:
        condition = FilterCondition(**filter_dict)
        items = [item for item in items if _apply_filter(item, condition)]

    # Project columns
    rows = []
    for item in items:
        row = {col: item.get(col) for col in columns}
        rows.append(row)

    # Sort
    if sort_by and sort_by in columns:
        reverse = (sort_dir == "DESC")
        rows.sort(key=lambda x: x.get(sort_by) or "", reverse=reverse)

    # Calculate summary stats
    summary = {"total_rows": len(rows)}
    for col in columns:
        field_type = FIELD_MAPS.get(source, {}).get(col)
        if field_type == "number":
            values = [row.get(col) for row in rows if row.get(col) is not None]
            if values:
                summary[f"{col}_sum"] = sum(values)
                summary[f"{col}_avg"] = sum(values) / len(values)

    return {
        "columns": columns,
        "rows": rows,
        "total_count": len(rows),
        "summary": summary
    }
