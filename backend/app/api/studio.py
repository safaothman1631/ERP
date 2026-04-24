"""Sprint 44: Studio — no-code custom models, views, workflows.

FIX-1321..FIX-1370.
"""
from datetime import datetime
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/studio", tags=["Studio"])


class CustomModelRepo(BaseRepository):
    collection_name = "studio_models"


class CustomFieldRepo(BaseRepository):
    collection_name = "studio_fields"


class CustomViewRepo(BaseRepository):
    collection_name = "studio_views"


class CustomWorkflowRepo(BaseRepository):
    collection_name = "studio_workflows"


class CustomReportRepo(BaseRepository):
    collection_name = "studio_reports"


class CustomMenuRepo(BaseRepository):
    collection_name = "studio_menus"


class CustomDataRepo(BaseRepository):
    collection_name = "studio_records"


class ModelCreate(BaseModel):
    name: str
    label_singular: str
    label_plural: str
    description: Optional[str] = None
    icon: Optional[str] = None


class FieldCreate(BaseModel):
    model_name: str
    name: str
    label: str
    type: str = Field("text", pattern=r"^(text|number|date|datetime|boolean|select|multi_select|email|phone|url|relation|currency)$")
    required: bool = False
    default_value: Optional[Any] = None
    options: list[str] = Field(default_factory=list)
    relation_model: Optional[str] = None


class ViewCreate(BaseModel):
    model_name: str
    name: str
    type: str = Field("list", pattern=r"^(list|form|kanban|calendar|gantt|chart)$")
    config: dict = Field(default_factory=dict)


class WorkflowCreate(BaseModel):
    model_name: str
    name: str
    trigger: str = Field("on_create", pattern=r"^(on_create|on_update|on_delete|scheduled)$")
    conditions: list[dict] = Field(default_factory=list)
    actions: list[dict] = Field(default_factory=list)
    is_active: bool = True


class ReportCreate(BaseModel):
    model_name: str
    name: str
    type: str = Field("table", pattern=r"^(table|pivot|chart|dashboard)$")
    config: dict = Field(default_factory=dict)


class MenuCreate(BaseModel):
    label: str
    parent_id: Optional[str] = None
    icon: Optional[str] = None
    sequence: int = 0
    target_view_id: Optional[str] = None
    target_url: Optional[str] = None


class RecordCreate(BaseModel):
    model_name: str
    data: dict


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


_quick("/models", CustomModelRepo, ModelCreate)
_quick("/fields", CustomFieldRepo, FieldCreate)
_quick("/views", CustomViewRepo, ViewCreate)
_quick("/workflows", CustomWorkflowRepo, WorkflowCreate)
_quick("/reports", CustomReportRepo, ReportCreate)
_quick("/menus", CustomMenuRepo, MenuCreate)


# Records (dynamic data tied to a custom model)
@router.get("/records/{model_name}")
def list_records(model_name: str, user: dict = Depends(get_current_user), limit: int = Query(50, ge=1, le=500), offset: int = 0):
    items, total = CustomDataRepo(user["org_id"]).list(
        filters=[{"field": "model_name", "op": "==", "value": model_name}],
        limit=limit, offset=offset,
    )
    return {"items": items, "total": total}


@router.post("/records/{model_name}", status_code=201)
def create_record(model_name: str, body: dict, user: dict = Depends(get_current_user)):
    return CustomDataRepo(user["org_id"]).create({
        "model_name": model_name,
        "data": body,
    })


@router.get("/records/{model_name}/{rid}")
def get_record(model_name: str, rid: str, user: dict = Depends(get_current_user)):
    item = _own(CustomDataRepo(user["org_id"]), rid, user["org_id"])
    if item.get("model_name") != model_name:
        raise HTTPException(404, "نەدۆزرایەوە")
    return item


@router.patch("/records/{model_name}/{rid}")
def update_record(model_name: str, rid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = CustomDataRepo(user["org_id"])
    item = _own(repo, rid, user["org_id"])
    if item.get("model_name") != model_name:
        raise HTTPException(404, "نەدۆزرایەوە")
    return repo.update(rid, {"data": {**item.get("data", {}), **body}})


@router.delete("/records/{model_name}/{rid}", status_code=204)
def delete_record(model_name: str, rid: str, user: dict = Depends(get_current_user)):
    repo = CustomDataRepo(user["org_id"])
    item = _own(repo, rid, user["org_id"])
    if item.get("model_name") != model_name:
        raise HTTPException(404, "نەدۆزرایەوە")
    repo.delete(rid)


# Schema introspection
@router.get("/models/{model_name}/schema")
def model_schema(model_name: str, user: dict = Depends(get_current_user)):
    fields, _ = CustomFieldRepo(user["org_id"]).list(
        filters=[{"field": "model_name", "op": "==", "value": model_name}], limit=500,
    )
    views, _ = CustomViewRepo(user["org_id"]).list(
        filters=[{"field": "model_name", "op": "==", "value": model_name}], limit=100,
    )
    return {"fields": fields, "views": views}
