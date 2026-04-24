"""Sprint 52: AI Features — forecasts, anomalies, recommendations, OCR jobs.

FIX-1641..FIX-1675. Note: pure data scaffolding; ML inference handled externally.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI"])


class AIModelRepo(BaseRepository):
    collection_name = "ai_models"


class AIForecastRepo(BaseRepository):
    collection_name = "ai_forecasts"


class AIAnomalyRepo(BaseRepository):
    collection_name = "ai_anomalies"


class AIRecommendationRepo(BaseRepository):
    collection_name = "ai_recommendations"


class AIOCRJobRepo(BaseRepository):
    collection_name = "ai_ocr_jobs"


class ModelCreate(BaseModel):
    name: str
    type: str = Field("forecast", pattern=r"^(forecast|anomaly|recommendation|classification|ocr|nlp)$")
    target_entity: Optional[str] = None
    config: dict = Field(default_factory=dict)
    is_active: bool = True


class ForecastCreate(BaseModel):
    model_id: Optional[str] = None
    entity: str
    horizon_days: int = 30
    points: list[dict] = Field(default_factory=list)


class AnomalyCreate(BaseModel):
    entity: str
    score: float
    description: Optional[str] = None
    detected_at: Optional[str] = None


class RecommendationCreate(BaseModel):
    target_user_id: Optional[str] = None
    entity: str
    items: list[dict] = Field(default_factory=list)
    rationale: Optional[str] = None


class OCRJobCreate(BaseModel):
    file_url: str
    document_type: str = Field("invoice", pattern=r"^(invoice|receipt|id|contract|other)$")
    language: str = "ar"


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


_quick("/models", AIModelRepo, ModelCreate)
_quick("/forecasts", AIForecastRepo, ForecastCreate)
_quick("/anomalies", AIAnomalyRepo, AnomalyCreate)
_quick("/recommendations", AIRecommendationRepo, RecommendationCreate)
_quick("/ocr", AIOCRJobRepo, OCRJobCreate)


@router.post("/ocr/{jid}/complete")
def ocr_complete(jid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = AIOCRJobRepo(user["org_id"])
    _own(repo, jid, user["org_id"])
    return repo.update(jid, {
        "status": "completed",
        "completed_at": datetime.utcnow().isoformat(),
        "extracted_text": body.get("text"),
        "extracted_fields": body.get("fields", {}),
    })
