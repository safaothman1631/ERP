"""NPS survey endpoints (G2 / R2.15).

* ``GET  /api/nps/should-show`` — whether to prompt the calling user.
* ``POST /api/nps/submit``      — store the score and an optional comment.

NPS prompts are scheduled at 30, 90, and 180 days post-signup. Each
prompt fires at most once per user.

Storage layout
--------------
``nps_responses/{response_id}`` per submission.
``nps_prompts/{user_id}`` tracks the last prompt window the user was
shown so we never re-ask within the same window.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.security.dependencies import get_current_user

log = logging.getLogger("api.nps")

router = APIRouter(prefix="/api/nps", tags=["NPS"])

# Days post-signup at which to prompt. Each window is "open" for ±7 days.
PROMPT_DAYS: tuple[int, ...] = (30, 90, 180)
WINDOW_DAYS: int = 7


# ── Schemas ────────────────────────────────────────────────────────────────


class NPSShouldShowResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    should_show: bool
    prompt_day: Optional[int] = None
    days_since_signup: Optional[int] = None


class NPSSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    score: int = Field(..., ge=0, le=10)
    comment: Optional[str] = Field(default=None, max_length=2000)
    anonymous: bool = False
    prompt_day: Optional[int] = Field(default=None, description="30, 90, or 180")


class NPSSubmitResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    saved_at: datetime
    score: int


# ── Helpers ────────────────────────────────────────────────────────────────


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_signup_date(user: dict) -> Optional[datetime]:
    for k in ("created_at", "signup_at", "registered_at"):
        v = user.get(k)
        if isinstance(v, datetime):
            return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        if isinstance(v, str):
            try:
                dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except Exception:  # noqa: BLE001
                continue
    return None


def _current_prompt_day(days_since_signup: int) -> Optional[int]:
    for d in PROMPT_DAYS:
        if d <= days_since_signup <= d + WINDOW_DAYS:
            return d
    return None


def _last_prompt(user_id: str) -> Optional[int]:
    try:
        from app.firebase_client import get_db

        snap = get_db().collection("nps_prompts").document(user_id).get()
        if not snap.exists:
            return None
        return (snap.to_dict() or {}).get("last_prompt_day")
    except Exception as exc:  # noqa: BLE001
        log.debug("nps.last_prompt_read_failed", extra={"err": str(exc)})
        return None


def _mark_prompt_shown(user_id: str, prompt_day: int) -> None:
    try:
        from app.firebase_client import get_db

        get_db().collection("nps_prompts").document(user_id).set(
            {"user_id": user_id, "last_prompt_day": prompt_day, "shown_at": _now_utc()},
            merge=True,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("nps.mark_prompt_failed", extra={"err": str(exc)})


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get(
    "/should-show",
    response_model=NPSShouldShowResponse,
    summary="Whether the calling user should be shown the NPS survey now",
)
async def should_show(user: dict = Depends(get_current_user)) -> NPSShouldShowResponse:
    signup = _parse_signup_date(user)
    if not signup:
        return NPSShouldShowResponse(should_show=False)
    days = (_now_utc() - signup).days
    prompt = _current_prompt_day(days)
    if prompt is None:
        return NPSShouldShowResponse(should_show=False, days_since_signup=days)

    # One-shot per window per user.
    last = _last_prompt(user.get("id") or "")
    if last == prompt:
        return NPSShouldShowResponse(
            should_show=False, prompt_day=prompt, days_since_signup=days
        )

    _mark_prompt_shown(user.get("id") or "", prompt)
    return NPSShouldShowResponse(
        should_show=True, prompt_day=prompt, days_since_signup=days
    )


@router.post(
    "/submit",
    response_model=NPSSubmitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an NPS score (0-10) with optional comment",
)
async def submit(
    payload: NPSSubmitRequest,
    user: dict = Depends(get_current_user),
) -> NPSSubmitResponse:
    response_id = uuid.uuid4().hex
    now = _now_utc()
    doc = {
        "id": response_id,
        "score": payload.score,
        "comment": (payload.comment or "").strip() or None,
        "prompt_day": payload.prompt_day,
        "tenant_id": user.get("org_id") or user.get("tenant_id"),
        "user_id": None if payload.anonymous else user.get("id"),
        "anonymous": payload.anonymous,
        "locale": user.get("locale"),
        "created_at": now,
    }
    try:
        from app.firebase_client import get_db

        get_db().collection("nps_responses").document(response_id).set(doc)
    except Exception as exc:  # noqa: BLE001
        log.error("nps.write_failed", extra={"err": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="could not record NPS response",
        ) from exc

    # Best-effort audit so platform admins can see who submitted what.
    try:
        from app.firebase_client import get_db

        get_db().collection("audit_logs").document(uuid.uuid4().hex).set(
            {
                "type": "nps.submit",
                "actor_id": doc["user_id"],
                "tenant_id": doc["tenant_id"],
                "score": doc["score"],
                "prompt_day": doc["prompt_day"],
                "ts": now,
            }
        )
    except Exception as exc:  # noqa: BLE001
        log.debug("nps.audit_failed", extra={"err": str(exc)})

    return NPSSubmitResponse(id=response_id, saved_at=now, score=payload.score)


ALL_ROUTERS = [router]

__all__ = ["router", "ALL_ROUTERS", "PROMPT_DAYS"]
