"""Onboarding wizard backend (launch-readiness § R3 / § 4).

This module is the **wizard** half of the onboarding surface — the existing
``app.api.onboarding`` module covers org-scoped *module preferences* and the
*module-access-request* workflow at the same ``/api/onboarding`` prefix. The
two modules use disjoint paths (``/state``, ``/coa/...``, ``/complete`` here
vs. ``/preferences``, ``/module-requests`` over there), so they can be
registered side-by-side without conflict.

Endpoints exposed:

  * ``GET /api/onboarding/state``          — hydrate the wizard on mount
  * ``PUT /api/onboarding/state``          — persist after each ``NEXT``/``BACK``
  * ``GET /api/onboarding/coa/templates``  — list YAML templates for the picker
  * ``POST /api/onboarding/coa/apply``     — materialise a COA YAML template
  * ``POST /api/onboarding/complete``      — stamp ``completed_at``

All endpoints scope to the caller's ``org_id`` (treated as the tenant id) and
return JSON shapes that mirror the frontend reducer in
``frontend/src/onboarding/state.ts`` exactly. ``Idempotency-Key`` and
per-tenant rate limiting are layered in by the global middleware once the
path prefix ``/api/onboarding`` is registered in ``idempotency_http.py``
(see ``_deltas/R3-backend-summary.md``).
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.firestore.onboarding_repo import (
    OnboardingRepository,
    apply_coa as repo_apply_coa,
    get_template,
    list_template_names,
)
from app.schemas.onboarding import (
    COAApplyRequest,
    COAApplyResponse,
    CompleteResponse,
    OnboardingState,
)
from app.services.auth import get_current_user
from app.services.permissions import require_perm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/onboarding", tags=["onboarding-wizard"])


def _tenant_id(user: dict) -> str:
    """The user's ``org_id`` doubles as the tenant id throughout the codebase."""
    tid = user.get("org_id")
    if not tid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="missing_tenant")
    return tid


def _emit_telemetry(event: str, **payload: Any) -> None:
    """Best-effort telemetry hook.

    The real RUM ingest lives in ``app.services.telemetry``; we log so traces
    survive if that module isn't wired into the deploy yet.
    """
    try:
        from app.services import telemetry  # type: ignore

        telemetry.emit(event, payload)
    except Exception:
        logger.info("onboarding_telemetry", extra={"event": event, **payload})


# ── State endpoints ─────────────────────────────────────────────────────

@router.get("/state")
def get_onboarding_state(user: dict = Depends(get_current_user)) -> dict:
    """Returns the persisted state, or the default-constructed envelope.

    Never 404s — a fresh tenant gets ``current_step='step1_company'`` so the
    frontend never has to special-case the "no draft yet" branch.
    """
    tid = _tenant_id(user)
    repo = OnboardingRepository(tid)
    state = repo.get_state(tid)
    if state is None:
        return OnboardingState().model_dump(mode="json")
    return state


@router.put("/state", status_code=200)
def put_onboarding_state(
    payload: OnboardingState,
    user: dict = Depends(get_current_user),
) -> dict:
    """Idempotent upsert of the whole envelope.

    Validation is via the ``OnboardingState`` pydantic model — clients can
    send partial step blobs (e.g. only ``company`` filled on step 1) and the
    optional fields stay ``None``.
    """
    tid = _tenant_id(user)
    repo = OnboardingRepository(tid)
    state = payload.model_dump(mode="json", exclude_none=False)
    saved = repo.put_state(tid, state)
    _emit_telemetry(
        "onboarding.step_advanced",
        tenant_id=tid,
        step=payload.current_step,
        completed_steps=list(payload.completed_steps),
    )
    return saved


# ── COA template apply ──────────────────────────────────────────────────

@router.get("/coa/templates")
def list_coa_templates(_: dict = Depends(get_current_user)) -> dict:
    """Returns metadata for every YAML template on disk.

    The wizard's step-3 picker uses this to render template cards without
    shipping the YAML to the browser.
    """
    out = []
    for name in list_template_names():
        try:
            tpl = get_template(name)
        except Exception as exc:
            logger.warning("coa_template_load_failed name=%s err=%s", name, exc)
            continue
        out.append({
            "name": tpl.get("name") or name,
            "display_name_en": tpl.get("display_name_en"),
            "display_name_ku": tpl.get("display_name_ku"),
            "display_name_ar": tpl.get("display_name_ar"),
            "recommended_for": tpl.get("recommended_for", []),
            "account_count": len(tpl.get("accounts") or []),
        })
    return {"templates": out}


@router.post(
    "/coa/apply",
    response_model=COAApplyResponse,
    status_code=200,
    dependencies=[Depends(require_perm("accounts.create"))],
)
def apply_coa_template(
    payload: COAApplyRequest,
    response: Response,
    user: dict = Depends(get_current_user),
) -> dict:
    """Materialise a COA YAML into the tenant's chart of accounts.

    Idempotent: a second call with the same template skips any code that
    already exists. The ``Idempotency-Key`` header (handled by the global
    middleware) provides cross-request replay safety on top of this.
    """
    tid = _tenant_id(user)
    overrides = [o.model_dump() for o in payload.overrides] if payload.overrides else []
    try:
        result = repo_apply_coa(tid, payload.template, overrides)
    except FileNotFoundError:
        # The Pydantic Literal already 422s unknown names, but the YAML file
        # could be missing in a misconfigured deploy — return 422 not 500.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"unknown_template:{payload.template}",
        )
    response.status_code = (
        status.HTTP_201_CREATED if result["accounts_created"] else status.HTTP_200_OK
    )
    _emit_telemetry(
        "onboarding.coa_applied",
        tenant_id=tid,
        template=payload.template,
        accounts_created=result["accounts_created"],
    )
    return result


# ── Completion ──────────────────────────────────────────────────────────

@router.post("/complete", response_model=CompleteResponse, status_code=200)
def complete_onboarding(user: dict = Depends(get_current_user)) -> dict:
    """Stamp ``completed_at`` and fire the ``onboarding.completed`` event.

    The frontend hides the wizard chunk once this returns; the dashboard
    welcome banner reads ``completed_at`` to decide whether to render
    confetti.
    """
    tid = _tenant_id(user)
    repo = OnboardingRepository(tid)
    saved = repo.complete(tid)
    completed_at = saved.get("completed_at") or datetime.utcnow()
    _emit_telemetry("onboarding.completed", tenant_id=tid)
    return {"tenant_id": tid, "completed_at": completed_at}


# Bulk-registration convenience for ``app.main`` (mirrors quick_create.ALL_ROUTERS).
ALL_ROUTERS = [router]
