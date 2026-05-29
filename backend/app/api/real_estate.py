"""Sprint 63: Real Estate — properties, leases, tenants, maintenance.

FIX-1991..FIX-2025.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/real-estate", tags=["Real Estate"])


class PropertyRepo(BaseRepository):
    collection_name = "re_properties"


class UnitRepo(BaseRepository):
    collection_name = "re_units"


class TenantRepo(BaseRepository):
    collection_name = "re_tenants"


class LeaseRepo(BaseRepository):
    collection_name = "re_leases"


class RentInvoiceRepo(BaseRepository):
    collection_name = "re_rent_invoices"


class MaintRequestRepo(BaseRepository):
    collection_name = "re_maint_requests"


class ListingRepo(BaseRepository):
    collection_name = "re_listings"


class PropertyCreate(BaseModel):
    name: str
    address: str
    property_type: str = Field("residential", pattern=r"^(residential|commercial|industrial|land|mixed)$")
    total_units: int = 1
    purchase_price: float = 0.0


class UnitCreate(BaseModel):
    property_id: str
    unit_number: str
    bedrooms: int = 0
    bathrooms: int = 0
    area_sqm: float = 0.0
    rent_amount: float = 0.0
    is_available: bool = True


class TenantCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    national_id: Optional[str] = None


class LeaseCreate(BaseModel):
    unit_id: str
    tenant_id: str
    start_date: str
    end_date: str
    monthly_rent: float = Field(..., ge=0)
    deposit: float = 0.0
    status: str = Field("active", pattern=r"^(active|expired|terminated|pending)$")


class RentInvoiceCreate(BaseModel):
    lease_id: str
    period_start: str
    period_end: str
    amount: float
    due_date: Optional[str] = None


class MaintRequestCreate(BaseModel):
    unit_id: Optional[str] = None
    property_id: Optional[str] = None
    tenant_id: Optional[str] = None
    description: str
    priority: str = Field("normal", pattern=r"^(low|normal|high|urgent)$")


class ListingCreate(BaseModel):
    unit_id: str
    listing_type: str = Field("rent", pattern=r"^(rent|sale)$")
    price: float
    description: Optional[str] = None
    is_active: bool = True


def _own(repo, doc_id, org_id):
    item = repo.get(doc_id)
    if not item or item.get("org_id") != org_id:
        raise HTTPException(404, "نەدۆزرایەوە")
    return item


def _quick(prefix, repo_cls, model):
    @router.get(prefix)
    def _ls(user: dict = Depends(get_current_user), limit: int = Query(50, ge=1, le=500), offset: int = 0):
        items, total = repo_cls(user["org_id"]).list(limit=limit, offset=offset)
        return {"items": items, "total": total}

    @router.post(prefix, status_code=201)
    def _cr(body: model, user: dict = Depends(get_current_user)):
        return repo_cls(user["org_id"]).create(body.model_dump())

    @router.get(prefix + "/{rid}")
    def _gt(rid: str, user: dict = Depends(get_current_user)):
        return _own(repo_cls(user["org_id"]), rid, user["org_id"])

    @router.patch(prefix + "/{rid}")
    def _up(rid: str, body: model, user: dict = Depends(get_current_user)):
        repo = repo_cls(user["org_id"])
        _own(repo, rid, user["org_id"])
        return repo.update(rid, {k: v for k, v in body.model_dump().items() if v is not None})

    @router.delete(prefix + "/{rid}", status_code=204)
    def _dl(rid: str, user: dict = Depends(get_current_user)):
        repo = repo_cls(user["org_id"])
        _own(repo, rid, user["org_id"])
        repo.delete(rid)


_quick("/properties", PropertyRepo, PropertyCreate)
_quick("/units", UnitRepo, UnitCreate)
_quick("/tenants", TenantRepo, TenantCreate)
_quick("/leases", LeaseRepo, LeaseCreate)
_quick("/rent-invoices", RentInvoiceRepo, RentInvoiceCreate)
_quick("/maint-requests", MaintRequestRepo, MaintRequestCreate)
_quick("/listings", ListingRepo, ListingCreate)


@router.post("/leases/{lid}/terminate")
def terminate_lease(lid: str, body: dict, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    lease = _own(LeaseRepo(org), lid, org)
    LeaseRepo(org).update(lid, {
        "status": "terminated",
        "terminated_at": datetime.utcnow().isoformat(),
        "termination_reason": body.get("reason"),
    })
    if lease.get("unit_id"):
        UnitRepo(org).update(lease["unit_id"], {"is_available": True})
    return {"ok": True}


@router.get("/dashboard")
def re_dashboard(user: dict = Depends(get_current_user)):
    org = user["org_id"]
    units = collect_stream(UnitRepo(org), max_docs=10000)
    leases = collect_stream(LeaseRepo(org), max_docs=10000)
    return {
        "total_units": len(units),
        "occupied_units": sum(1 for u in units if not u.get("is_available")),
        "active_leases": sum(1 for l in leases if l.get("status") == "active"),
    }
