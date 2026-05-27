"""Sprint 50: eLearning + Certifications.

FIX-1581..FIX-1615.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/elearning", tags=["eLearning"])


class CourseRepo(BaseRepository):
    collection_name = "el_courses"


class LessonRepo(BaseRepository):
    collection_name = "el_lessons"


class QuizRepo(BaseRepository):
    collection_name = "el_quizzes"


class QuestionRepo(BaseRepository):
    collection_name = "el_quiz_questions"


class EnrollmentRepo(BaseRepository):
    collection_name = "el_enrollments"


class ProgressRepo(BaseRepository):
    collection_name = "el_progress"


class CertificateRepo(BaseRepository):
    collection_name = "el_certificates"


class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    duration_hours: float = 0.0
    is_published: bool = False
    pass_score: int = Field(70, ge=0, le=100)


class LessonCreate(BaseModel):
    course_id: str
    title: str
    body: Optional[str] = None
    video_url: Optional[str] = None
    sequence: int = 0
    duration_minutes: int = 0


class QuizCreate(BaseModel):
    course_id: str
    title: str
    pass_score: int = Field(70, ge=0, le=100)


class QuestionCreate(BaseModel):
    quiz_id: str
    text: str
    type: str = Field("single", pattern=r"^(single|multi|true_false|short)$")
    options: list[str] = Field(default_factory=list)
    correct_answers: list[str] = Field(default_factory=list)
    points: int = Field(1, ge=1)


class EnrollmentCreate(BaseModel):
    course_id: str
    employee_id: str


class ProgressCreate(BaseModel):
    enrollment_id: str
    lesson_id: str
    completed: bool = True


class CertificateCreate(BaseModel):
    enrollment_id: str
    employee_id: str
    course_id: str
    score: float = 0.0


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


_quick("/courses", CourseRepo, CourseCreate)
_quick("/lessons", LessonRepo, LessonCreate)
_quick("/quizzes", QuizRepo, QuizCreate)
_quick("/questions", QuestionRepo, QuestionCreate)
_quick("/enrollments", EnrollmentRepo, EnrollmentCreate)
_quick("/progress", ProgressRepo, ProgressCreate)
_quick("/certificates", CertificateRepo, CertificateCreate)


@router.post("/courses/{cid}/publish")
def publish_course(cid: str, user: dict = Depends(get_current_user)):
    repo = CourseRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, {"is_published": True, "published_at": datetime.utcnow().isoformat()})


@router.post("/enrollments/{eid}/complete")
def complete_enrollment(eid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = EnrollmentRepo(user["org_id"])
    enr = _own(repo, eid, user["org_id"])
    score = float(body.get("score", 0))
    repo.update(eid, {
        "status": "completed",
        "completed_at": datetime.utcnow().isoformat(),
        "score": score,
    })
    course = CourseRepo(user["org_id"]).get(enr.get("course_id"))
    pass_score = int(course.get("pass_score", 70)) if course else 70
    if score >= pass_score:
        cert = CertificateRepo(user["org_id"]).create({
            "enrollment_id": eid,
            "employee_id": enr.get("employee_id"),
            "course_id": enr.get("course_id"),
            "score": score,
            "issued_at": datetime.utcnow().isoformat(),
        })
        return {"completed": True, "passed": True, "certificate": cert}
    return {"completed": True, "passed": False}


@router.get("/dashboard")
def el_dashboard(user: dict = Depends(get_current_user)):
    courses = collect_stream(CourseRepo(user["org_id"]), max_docs=10000)
    enrolls = collect_stream(EnrollmentRepo(user["org_id"]), max_docs=10000)
    return {
        "courses": len(courses),
        "published": sum(1 for c in courses if c.get("is_published")),
        "enrollments": len(enrolls),
        "completed": sum(1 for e in enrolls if e.get("status") == "completed"),
    }
