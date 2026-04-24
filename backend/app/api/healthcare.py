"""Sprint 55-56: Healthcare — patients, appointments, prescriptions, insurance.

FIX-1726..FIX-1790.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/healthcare", tags=["Healthcare"])


class PatientRepo(BaseRepository):
    collection_name = "hc_patients"


class MedAppointmentRepo(BaseRepository):
    collection_name = "hc_appointments"


class PrescriptionRepo(BaseRepository):
    collection_name = "hc_prescriptions"


class MedRecordRepo(BaseRepository):
    collection_name = "hc_med_records"


class InsuranceRepo(BaseRepository):
    collection_name = "hc_insurances"


class InsuranceClaimRepo(BaseRepository):
    collection_name = "hc_insurance_claims"


class LabResultRepo(BaseRepository):
    collection_name = "hc_lab_results"


class VitalSignRepo(BaseRepository):
    collection_name = "hc_vital_signs"


class PatientCreate(BaseModel):
    name: str
    national_id: Optional[str] = None
    dob: Optional[str] = None
    gender: str = Field("unknown", pattern=r"^(male|female|unknown)$")
    phone: Optional[str] = None
    email: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: list[str] = Field(default_factory=list)


class AppointmentCreate(BaseModel):
    patient_id: str
    doctor_id: Optional[str] = None
    scheduled_at: str
    duration_minutes: int = 30
    reason: Optional[str] = None


class PrescriptionCreate(BaseModel):
    patient_id: str
    doctor_id: Optional[str] = None
    items: list[dict] = Field(default_factory=list)
    notes: Optional[str] = None
    issued_at: Optional[str] = None


class MedRecordCreate(BaseModel):
    patient_id: str
    record_type: str = Field("note", pattern=r"^(note|diagnosis|procedure|surgery|imaging)$")
    title: str
    body: Optional[str] = None
    recorded_at: Optional[str] = None


class InsuranceCreate(BaseModel):
    patient_id: str
    provider: str
    policy_number: str
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    coverage_pct: float = Field(80.0, ge=0, le=100)


class ClaimCreate(BaseModel):
    insurance_id: str
    patient_id: str
    amount: float
    description: Optional[str] = None


class LabResultCreate(BaseModel):
    patient_id: str
    test_name: str
    value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    is_abnormal: bool = False


class VitalsCreate(BaseModel):
    patient_id: str
    temperature: Optional[float] = None
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    respiratory_rate: Optional[int] = None
    oxygen_saturation: Optional[float] = None


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


_quick("/patients", PatientRepo, PatientCreate)
_quick("/appointments", MedAppointmentRepo, AppointmentCreate)
_quick("/prescriptions", PrescriptionRepo, PrescriptionCreate)
_quick("/records", MedRecordRepo, MedRecordCreate)
_quick("/insurances", InsuranceRepo, InsuranceCreate)
_quick("/claims", InsuranceClaimRepo, ClaimCreate)
_quick("/lab-results", LabResultRepo, LabResultCreate)
_quick("/vitals", VitalSignRepo, VitalsCreate)


@router.post("/appointments/{aid}/checkin")
def checkin_appt(aid: str, user: dict = Depends(get_current_user)):
    repo = MedAppointmentRepo(user["org_id"])
    _own(repo, aid, user["org_id"])
    return repo.update(aid, {"status": "checked_in", "checked_in_at": datetime.utcnow().isoformat()})


@router.post("/claims/{cid}/approve")
def approve_claim(cid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = InsuranceClaimRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, {
        "status": "approved",
        "approved_amount": body.get("approved_amount"),
        "approved_at": datetime.utcnow().isoformat(),
    })


@router.get("/patients/{pid}/history")
def patient_history(pid: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    apps, _ = MedAppointmentRepo(org).list(filters=[{"field": "patient_id", "op": "==", "value": pid}], limit=500)
    rxs, _ = PrescriptionRepo(org).list(filters=[{"field": "patient_id", "op": "==", "value": pid}], limit=500)
    recs, _ = MedRecordRepo(org).list(filters=[{"field": "patient_id", "op": "==", "value": pid}], limit=500)
    labs, _ = LabResultRepo(org).list(filters=[{"field": "patient_id", "op": "==", "value": pid}], limit=500)
    return {
        "appointments": apps,
        "prescriptions": rxs,
        "records": recs,
        "lab_results": labs,
    }
