"""Sprint 64: Education — students, fees, grades, attendance, classes.

FIX-2026..FIX-2070.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/education", tags=["Education"])


class StudentRepo(BaseRepository):
    collection_name = "edu_students"


class TeacherRepo(BaseRepository):
    collection_name = "edu_teachers"


class CourseRepo(BaseRepository):
    collection_name = "edu_courses"


class ClassRepo(BaseRepository):
    collection_name = "edu_classes"


class EnrollmentRepo(BaseRepository):
    collection_name = "edu_enrollments"


class AttendanceRepo(BaseRepository):
    collection_name = "edu_attendance"


class GradeRepo(BaseRepository):
    collection_name = "edu_grades"


class FeeRepo(BaseRepository):
    collection_name = "edu_fees"


class FeePaymentRepo(BaseRepository):
    collection_name = "edu_fee_payments"


class StudentCreate(BaseModel):
    name: str
    student_id: Optional[str] = None
    dob: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    grade_level: Optional[str] = None


class TeacherCreate(BaseModel):
    name: str
    employee_id: Optional[str] = None
    subjects: list[str] = Field(default_factory=list)
    phone: Optional[str] = None


class CourseCreate(BaseModel):
    name: str
    code: str
    credits: int = 3
    teacher_id: Optional[str] = None


class ClassCreate(BaseModel):
    course_id: str
    name: str
    teacher_id: Optional[str] = None
    room: Optional[str] = None
    schedule: Optional[str] = None
    academic_year: Optional[str] = None


class EnrollmentCreate(BaseModel):
    student_id: str
    class_id: str
    enrolled_at: Optional[str] = None


class AttendanceCreate(BaseModel):
    student_id: str
    class_id: str
    date: str
    status: str = Field("present", pattern=r"^(present|absent|late|excused)$")


class GradeCreate(BaseModel):
    student_id: str
    class_id: str
    assessment: str
    score: float
    max_score: float = 100.0


class FeeCreate(BaseModel):
    student_id: str
    fee_type: str
    amount: float
    due_date: Optional[str] = None


class FeePaymentCreate(BaseModel):
    fee_id: str
    amount: float
    paid_at: Optional[str] = None
    method: str = Field("cash", pattern=r"^(cash|card|transfer|cheque)$")


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


_quick("/students", StudentRepo, StudentCreate)
_quick("/teachers", TeacherRepo, TeacherCreate)
_quick("/courses", CourseRepo, CourseCreate)
_quick("/classes", ClassRepo, ClassCreate)
_quick("/enrollments", EnrollmentRepo, EnrollmentCreate)
_quick("/attendance", AttendanceRepo, AttendanceCreate)
_quick("/grades", GradeRepo, GradeCreate)
_quick("/fees", FeeRepo, FeeCreate)
_quick("/fee-payments", FeePaymentRepo, FeePaymentCreate)


@router.get("/students/{sid}/transcript")
def transcript(sid: str, user: dict = Depends(get_current_user)):
    grades, _ = GradeRepo(user["org_id"]).list(
        filters=[{"field": "student_id", "op": "==", "value": sid}], limit=1000,
    )
    if not grades:
        return {"items": [], "average": 0.0}
    pcts = [(float(g.get("score", 0)) / float(g.get("max_score", 100) or 100)) * 100 for g in grades]
    avg = round(sum(pcts) / len(pcts), 2)
    return {"items": grades, "average_pct": avg}


@router.get("/students/{sid}/balance")
def student_balance(sid: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    fees, _ = FeeRepo(org).list(filters=[{"field": "student_id", "op": "==", "value": sid}], limit=1000)
    fee_ids = [f.get("id") for f in fees]
    pays = collect_stream(FeePaymentRepo(org), max_docs=10000)
    relevant = [p for p in pays if p.get("fee_id") in fee_ids]
    total_fees = sum(float(f.get("amount", 0)) for f in fees)
    total_paid = sum(float(p.get("amount", 0)) for p in relevant)
    return {"billed": total_fees, "paid": total_paid, "balance": total_fees - total_paid}
