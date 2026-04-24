"""Sprint 49: Events + Surveys + Appointments.

FIX-1511..FIX-1580.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/engagement", tags=["Engagement"])


# Events
class EventRepo(BaseRepository):
    collection_name = "events"


class EventTicketTypeRepo(BaseRepository):
    collection_name = "event_ticket_types"


class EventRegistrationRepo(BaseRepository):
    collection_name = "event_registrations"


class EventSponsorRepo(BaseRepository):
    collection_name = "event_sponsors"


class EventSessionRepo(BaseRepository):
    collection_name = "event_sessions"


# Surveys
class SurveyRepo(BaseRepository):
    collection_name = "surveys"


class SurveyQuestionRepo(BaseRepository):
    collection_name = "survey_questions"


class SurveyResponseRepo(BaseRepository):
    collection_name = "survey_responses"


# Appointments
class CalendarRepo(BaseRepository):
    collection_name = "appt_calendars"


class TimeSlotRepo(BaseRepository):
    collection_name = "appt_slots"


class BookingRepo(BaseRepository):
    collection_name = "appt_bookings"


# Schemas
class EventCreate(BaseModel):
    name: str
    start_at: str
    end_at: str
    location: Optional[str] = None
    venue_capacity: int = 0
    description: Optional[str] = None
    is_online: bool = False
    online_url: Optional[str] = None


class TicketTypeCreate(BaseModel):
    event_id: str
    name: str
    price: float = 0.0
    currency: str = "IQD"
    quantity: int = 0


class RegistrationCreate(BaseModel):
    event_id: str
    ticket_type_id: Optional[str] = None
    attendee_name: str
    attendee_email: Optional[str] = None
    attendee_phone: Optional[str] = None


class SponsorCreate(BaseModel):
    event_id: str
    name: str
    tier: str = Field("silver", pattern=r"^(platinum|gold|silver|bronze)$")
    logo_url: Optional[str] = None
    contribution: float = 0.0


class SessionCreate(BaseModel):
    event_id: str
    title: str
    speaker: Optional[str] = None
    start_at: str
    end_at: str
    room: Optional[str] = None


class SurveyCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_published: bool = False


class QuestionCreate(BaseModel):
    survey_id: str
    text: str
    type: str = Field("text", pattern=r"^(text|number|choice|multi_choice|rating|scale|date)$")
    options: list[str] = Field(default_factory=list)
    required: bool = False
    sequence: int = 0


class ResponseCreate(BaseModel):
    survey_id: str
    respondent_email: Optional[str] = None
    answers: list[dict] = Field(default_factory=list)


class CalendarCreate(BaseModel):
    name: str
    owner_id: Optional[str] = None
    timezone: str = "Asia/Baghdad"
    is_active: bool = True


class SlotCreate(BaseModel):
    calendar_id: str
    start_at: str
    end_at: str
    is_booked: bool = False


class BookingCreate(BaseModel):
    calendar_id: str
    slot_id: Optional[str] = None
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    notes: Optional[str] = None


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


_quick("/events", EventRepo, EventCreate)
_quick("/ticket-types", EventTicketTypeRepo, TicketTypeCreate)
_quick("/registrations", EventRegistrationRepo, RegistrationCreate)
_quick("/sponsors", EventSponsorRepo, SponsorCreate)
_quick("/sessions", EventSessionRepo, SessionCreate)
_quick("/surveys", SurveyRepo, SurveyCreate)
_quick("/questions", SurveyQuestionRepo, QuestionCreate)
_quick("/responses", SurveyResponseRepo, ResponseCreate)
_quick("/calendars", CalendarRepo, CalendarCreate)
_quick("/slots", TimeSlotRepo, SlotCreate)
_quick("/bookings", BookingRepo, BookingCreate)


@router.post("/registrations/{rid}/checkin")
def checkin(rid: str, user: dict = Depends(get_current_user)):
    repo = EventRegistrationRepo(user["org_id"])
    _own(repo, rid, user["org_id"])
    return repo.update(rid, {"checked_in": True, "checked_in_at": datetime.utcnow().isoformat()})


@router.post("/bookings/{bid}/confirm")
def confirm_booking(bid: str, user: dict = Depends(get_current_user)):
    repo = BookingRepo(user["org_id"])
    _own(repo, bid, user["org_id"])
    return repo.update(bid, {"status": "confirmed", "confirmed_at": datetime.utcnow().isoformat()})


@router.post("/bookings/{bid}/cancel")
def cancel_booking(bid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = BookingRepo(user["org_id"])
    _own(repo, bid, user["org_id"])
    return repo.update(bid, {
        "status": "cancelled",
        "cancelled_at": datetime.utcnow().isoformat(),
        "cancel_reason": body.get("reason"),
    })


@router.get("/surveys/{sid}/results")
def survey_results(sid: str, user: dict = Depends(get_current_user)):
    responses, _ = SurveyResponseRepo(user["org_id"]).list(
        filters=[{"field": "survey_id", "op": "==", "value": sid}], limit=10000,
    )
    questions, _ = SurveyQuestionRepo(user["org_id"]).list(
        filters=[{"field": "survey_id", "op": "==", "value": sid}], limit=500,
    )
    return {
        "responses": len(responses),
        "questions": len(questions),
        "items": responses[:100],
    }


@router.get("/events/{eid}/stats")
def event_stats(eid: str, user: dict = Depends(get_current_user)):
    regs, _ = EventRegistrationRepo(user["org_id"]).list(
        filters=[{"field": "event_id", "op": "==", "value": eid}], limit=10000,
    )
    return {
        "registrations": len(regs),
        "checked_in": sum(1 for r in regs if r.get("checked_in")),
    }
