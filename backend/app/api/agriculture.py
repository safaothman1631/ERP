"""Sprint 66: Agriculture — crops, livestock, fields, harvests.

FIX-2111..FIX-2140.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/agriculture", tags=["Agriculture"])


class FieldRepo(BaseRepository):
    collection_name = "ag_fields"


class CropRepo(BaseRepository):
    collection_name = "ag_crops"


class PlantingRepo(BaseRepository):
    collection_name = "ag_plantings"


class HarvestRepo(BaseRepository):
    collection_name = "ag_harvests"


class LivestockRepo(BaseRepository):
    collection_name = "ag_livestock"


class LivestockEventRepo(BaseRepository):
    collection_name = "ag_livestock_events"


class IrrigationRepo(BaseRepository):
    collection_name = "ag_irrigation"


class FertilizationRepo(BaseRepository):
    collection_name = "ag_fertilization"


class FieldCreate(BaseModel):
    name: str
    area_dunum: float = Field(0.0, ge=0)
    soil_type: Optional[str] = None
    location: Optional[str] = None


class CropCreate(BaseModel):
    name: str
    variety: Optional[str] = None
    growth_days: int = 0


class PlantingCreate(BaseModel):
    field_id: str
    crop_id: str
    planted_at: str
    expected_harvest: Optional[str] = None
    quantity_seed: float = 0.0


class HarvestCreate(BaseModel):
    planting_id: str
    harvested_at: str
    quantity: float = Field(..., ge=0)
    unit: str = "kg"
    quality: Optional[str] = None


class LivestockCreate(BaseModel):
    species: str
    breed: Optional[str] = None
    tag_number: Optional[str] = None
    sex: str = Field("unknown", pattern=r"^(male|female|unknown)$")
    dob: Optional[str] = None
    weight_kg: float = 0.0
    status: str = Field("active", pattern=r"^(active|sold|deceased|slaughtered)$")


class LivestockEventCreate(BaseModel):
    livestock_id: str
    event_type: str = Field("vaccination", pattern=r"^(vaccination|treatment|breeding|weighing|birth|sale|death)$")
    notes: Optional[str] = None


class IrrigationCreate(BaseModel):
    field_id: str
    method: str = Field("drip", pattern=r"^(drip|sprinkler|flood|manual)$")
    duration_minutes: int = 0
    water_liters: float = 0.0


class FertilizationCreate(BaseModel):
    field_id: str
    fertilizer: str
    quantity_kg: float = 0.0
    applied_at: Optional[str] = None


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


_quick("/fields", FieldRepo, FieldCreate)
_quick("/crops", CropRepo, CropCreate)
_quick("/plantings", PlantingRepo, PlantingCreate)
_quick("/harvests", HarvestRepo, HarvestCreate)
_quick("/livestock", LivestockRepo, LivestockCreate)
_quick("/livestock-events", LivestockEventRepo, LivestockEventCreate)
_quick("/irrigation", IrrigationRepo, IrrigationCreate)
_quick("/fertilization", FertilizationRepo, FertilizationCreate)


@router.get("/fields/{fid}/yield")
def field_yield(fid: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    plantings, _ = PlantingRepo(org).list(filters=[{"field": "field_id", "op": "==", "value": fid}], limit=500)
    pids = {p.get("id") for p in plantings}
    harvests, _ = HarvestRepo(org).list(limit=10000)
    relevant = [h for h in harvests if h.get("planting_id") in pids]
    total = sum(float(h.get("quantity", 0)) for h in relevant)
    return {"plantings": len(plantings), "harvests": len(relevant), "total_yield": total}
