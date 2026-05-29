"""Sprint 57: Hospital Mgmt — admissions, wards, beds, doctors, lab, radiology.

FIX-1791..FIX-1830.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/hospital", tags=["Hospital"])


class WardRepo(BaseRepository):
    collection_name = "hosp_wards"


class BedRepo(BaseRepository):
    collection_name = "hosp_beds"


class DoctorRepo(BaseRepository):
    collection_name = "hosp_doctors"


class AdmissionRepo(BaseRepository):
    collection_name = "hosp_admissions"


class DischargeRepo(BaseRepository):
    collection_name = "hosp_discharges"


class LabOrderRepo(BaseRepository):
    collection_name = "hosp_lab_orders"


class RadiologyOrderRepo(BaseRepository):
    collection_name = "hosp_radiology_orders"


class SurgeryRepo(BaseRepository):
    collection_name = "hosp_surgeries"


class WardCreate(BaseModel):
    name: str
    floor: Optional[str] = None
    capacity: int = 0


class BedCreate(BaseModel):
    ward_id: str
    bed_number: str
    is_occupied: bool = False
    type: str = Field("standard", pattern=r"^(standard|icu|isolation|pediatric|maternity)$")


class DoctorCreate(BaseModel):
    name: str
    specialty: Optional[str] = None
    license_no: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True


class AdmissionCreate(BaseModel):
    patient_id: str
    bed_id: Optional[str] = None
    doctor_id: Optional[str] = None
    admitted_at: Optional[str] = None
    reason: Optional[str] = None


class DischargeCreate(BaseModel):
    admission_id: str
    discharged_at: Optional[str] = None
    summary: Optional[str] = None


class LabOrderCreate(BaseModel):
    patient_id: str
    doctor_id: Optional[str] = None
    tests: list[str] = Field(default_factory=list)
    priority: str = Field("normal", pattern=r"^(routine|urgent|stat|normal)$")


class RadiologyOrderCreate(BaseModel):
    patient_id: str
    doctor_id: Optional[str] = None
    modality: str = Field("xray", pattern=r"^(xray|ct|mri|ultrasound|pet)$")
    body_part: Optional[str] = None


class SurgeryCreate(BaseModel):
    patient_id: str
    surgeon_id: Optional[str] = None
    procedure: str
    scheduled_at: str
    operating_room: Optional[str] = None


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


_quick("/wards", WardRepo, WardCreate)
_quick("/beds", BedRepo, BedCreate)
_quick("/doctors", DoctorRepo, DoctorCreate)
_quick("/admissions", AdmissionRepo, AdmissionCreate)
_quick("/discharges", DischargeRepo, DischargeCreate)
_quick("/lab-orders", LabOrderRepo, LabOrderCreate)
_quick("/radiology-orders", RadiologyOrderRepo, RadiologyOrderCreate)
_quick("/surgeries", SurgeryRepo, SurgeryCreate)


@router.post("/admissions/{aid}/discharge")
def discharge_patient(aid: str, body: dict, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    adm_repo = AdmissionRepo(org)
    adm = _own(adm_repo, aid, org)
    if adm.get("bed_id"):
        bed_repo = BedRepo(org)
        bed = bed_repo.get(adm["bed_id"])
        if bed and bed.get("org_id") == org:
            bed_repo.update(adm["bed_id"], {"is_occupied": False})
    adm_repo.update(aid, {"status": "discharged", "discharged_at": datetime.utcnow().isoformat()})
    return DischargeRepo(org).create({
        "admission_id": aid,
        "discharged_at": datetime.utcnow().isoformat(),
        "summary": body.get("summary"),
    })


@router.get("/dashboard")
def hosp_dashboard(user: dict = Depends(get_current_user)):
    org = user["org_id"]
    beds = collect_stream(BedRepo(org), max_docs=10000)
    adms = collect_stream(AdmissionRepo(org), max_docs=10000)
    return {
        "total_beds": len(beds),
        "occupied_beds": sum(1 for b in beds if b.get("is_occupied")),
        "active_admissions": sum(1 for a in adms if a.get("status") not in ("discharged",)),
    }
