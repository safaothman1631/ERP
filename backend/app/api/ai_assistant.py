"""HTTP surface for the LLM analytics assistant (Pool 4.7+ — AI).

Thin router over :mod:`app.analytics.ai.assistant`. The service layer is
flag-gated and never raises — it always returns a dict carrying a ``status`` —
so these endpoints simply forward the result and never return a 500 for a
missing key / missing warehouse / Claude error.

Auth: every endpoint requires an authenticated user (``get_current_user``) and
the existing ``reports.read`` permission (no new permission codes are minted —
the analytics layer reuses the same code).
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends

from app.analytics.ai import assistant
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/ai", tags=["AI — Assistant"])

# Reuse the existing reports.read code (same as app/api/analytics.py); no new perm.
_PERM_READ = "reports.read"


@router.post("/ask", dependencies=[Depends(require_perm(_PERM_READ))])
def ask(
    body: dict = Body(...),
    user: dict = Depends(get_current_user),
):
    """Answer a natural-language data question over the safe warehouse.

    Body: ``{"question": "..."}``. The question is translated by Claude into a
    whitelisted ``AnalysisDef`` and run through the injection-safe analytics
    layer — the LLM never reaches SQL. Returns ``{question, query, rows, status}``
    (status is one of ok / ai_not_configured / warehouse_not_configured /
    could_not_interpret / error). Never 500s.
    """
    question = ""
    if isinstance(body, dict):
        question = str(body.get("question") or "").strip()
    return assistant.ask_data(user["org_id"], question)


@router.get("/insights", dependencies=[Depends(require_perm(_PERM_READ))])
def insights(
    lang: str = "ku",
    user: dict = Depends(get_current_user),
):
    """Plain-language business summary (Sorani Kurdish by default).

    ``?lang=ku|ar|en``. Fetches a few key analyses and asks Claude to write a
    short narrative. Returns ``{summary, data_used, status}``. Never 500s.
    """
    return assistant.narrative_insights(user["org_id"], lang=lang)


ALL_ROUTERS = [router]
