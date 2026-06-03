"""BPMN Workflow API (Pool 3.6 buildout).

Definitions + running instances on top of the pure
``app.services.workflow_engine`` state machine.

Prefix is ``/api/bpmn`` (deliberately NOT ``/api/workflows`` / ``/api/automation``
— ``/api/automation`` already exists for the automation engine; verified free).

Endpoints:
    GET    /api/bpmn/definitions                 list workflow definitions
    POST   /api/bpmn/definitions                 create (validate_definition; 422 on errors)
    GET    /api/bpmn/definitions/{id}            definition detail
    PUT    /api/bpmn/definitions/{id}            update (re-validates; 422 on errors)
    DELETE /api/bpmn/definitions/{id}            delete definition
    GET    /api/bpmn/instances                   list instances
    POST   /api/bpmn/instances                   create at definition.start
    GET    /api/bpmn/instances/{id}              instance detail
    POST   /api/bpmn/instances/{id}/advance      advance via event (409 on WorkflowError)

Guards: a transition stored on a definition may carry an ``guard`` object
``{"field": str, "op": "gt"|"gte"|"lt"|"lte"|"eq"|"ne"|"truthy", "value": ...}``.
It is compiled to a callable at advance-time and evaluated against the posted
``context`` — keeping the persisted definition JSON-serialisable while still
honouring the engine's guard contract.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.firestore.bpmn import WorkflowDefRepository, WorkflowInstanceRepository
from app.services.auth import get_current_user
from app.services import workflow_engine as wf

router = APIRouter(prefix="/api/bpmn", tags=["BPMN Workflows"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ───────────────────────────── helpers ──────────────────────────────


def _compile_guard(spec: Any):
    """Compile a serialisable guard spec into a ``(context) -> bool`` callable.

    A guard ``spec`` is a dict like ``{"field": "amount", "op": "gt",
    "value": 0}``. Unknown / malformed specs evaluate to ``True`` (fail-open at
    the spec level — validation already guarantees the transition exists; the
    guard only narrows it). Returns ``None`` when there is no guard so the
    engine treats the transition as unconditional.
    """
    if not spec or not isinstance(spec, dict):
        return None
    field = spec.get("field")
    op = (spec.get("op") or "truthy").lower()
    target = spec.get("value")

    def _guard(ctx: dict) -> bool:
        actual = (ctx or {}).get(field)
        try:
            if op == "truthy":
                return bool(actual)
            if op == "eq":
                return actual == target
            if op == "ne":
                return actual != target
            if actual is None:
                return False
            if op == "gt":
                return actual > target
            if op == "gte":
                return actual >= target
            if op == "lt":
                return actual < target
            if op == "lte":
                return actual <= target
        except TypeError:
            return False
        return True

    return _guard


def _runtime_definition(stored: dict) -> dict:
    """Convert a stored definition (JSON guards) into a runtime definition the
    engine understands (callable guards)."""
    transitions = []
    for t in stored.get("transitions") or []:
        rt = {k: v for k, v in t.items() if k != "guard"}
        guard = _compile_guard(t.get("guard"))
        if guard is not None:
            rt["guard"] = guard
        transitions.append(rt)
    return {
        "states": stored.get("states") or [],
        "start": stored.get("start"),
        "end": stored.get("end") or [],
        "transitions": transitions,
    }


def _sanitize_transitions(raw: Any) -> list[dict]:
    """Keep only the fields we persist on transitions (guards stay as plain
    serialisable dicts)."""
    out: list[dict] = []
    for t in raw or []:
        if not isinstance(t, dict):
            continue
        clean = {
            "from": t.get("from"),
            "to": t.get("to"),
            "on": t.get("on"),
        }
        if t.get("guard") is not None:
            clean["guard"] = t.get("guard")
        out.append(clean)
    return out


def _validate_or_422(definition: dict) -> None:
    """Run the engine's structural validation; raise 422 with the error list."""
    errors = wf.validate_definition(definition)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors})


# ───────────────────────────── definitions ──────────────────────────


@router.get("/definitions")
def list_definitions(user: dict = Depends(get_current_user)):
    repo = WorkflowDefRepository(user["org_id"])
    items, _ = repo.list(order_by="name", order_dir="ASCENDING", limit=200)
    return items


@router.post("/definitions", status_code=201)
def create_definition(data: dict, user: dict = Depends(get_current_user)):
    if not data.get("name"):
        raise HTTPException(400, "name required")
    definition = {
        "states": list(data.get("states") or []),
        "start": data.get("start"),
        "end": list(data.get("end") or []),
        "transitions": _sanitize_transitions(data.get("transitions")),
    }
    # validate_definition only flags 'start not in states' when start is set;
    # require a start explicitly so instances have a well-defined entry point.
    if not definition["start"]:
        raise HTTPException(status_code=422, detail={"errors": ["start state required"]})
    _validate_or_422(definition)

    repo = WorkflowDefRepository(user["org_id"])
    payload = {
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "description": data.get("description", ""),
        **definition,
        "created_at": _now_iso(),
        "created_by": user.get("id") or user.get("email"),
    }
    return repo.create(payload)


@router.get("/definitions/{def_id}")
def get_definition(def_id: str, user: dict = Depends(get_current_user)):
    repo = WorkflowDefRepository(user["org_id"])
    item = repo.get(def_id)
    if not item:
        raise HTTPException(404, "Definition not found")
    return item


@router.put("/definitions/{def_id}")
def update_definition(def_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = WorkflowDefRepository(user["org_id"])
    existing = repo.get(def_id)
    if not existing:
        raise HTTPException(404, "Definition not found")

    # Merge structural fields with the existing doc, then re-validate the whole.
    states = list(data["states"]) if "states" in data else existing.get("states") or []
    start = data.get("start", existing.get("start"))
    end = list(data["end"]) if "end" in data else existing.get("end") or []
    transitions = (
        _sanitize_transitions(data.get("transitions"))
        if "transitions" in data
        else existing.get("transitions") or []
    )
    definition = {"states": states, "start": start, "end": end, "transitions": transitions}
    if not start:
        raise HTTPException(status_code=422, detail={"errors": ["start state required"]})
    _validate_or_422(definition)

    update_payload: dict = {**definition, "updated_at": _now_iso()}
    if "name" in data:
        if not data["name"]:
            raise HTTPException(400, "name required")
        update_payload["name"] = data["name"]
    if "description" in data:
        update_payload["description"] = data["description"]
    update_payload.pop("id", None)
    update_payload.pop("org_id", None)
    return repo.update(def_id, update_payload)


@router.delete("/definitions/{def_id}")
def delete_definition(def_id: str, user: dict = Depends(get_current_user)):
    repo = WorkflowDefRepository(user["org_id"])
    if not repo.get(def_id):
        raise HTTPException(404, "Definition not found")
    repo.delete(def_id)
    return {"success": True}


# ───────────────────────────── instances ────────────────────────────


@router.get("/instances")
def list_instances(
    definition_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    repo = WorkflowInstanceRepository(user["org_id"])
    items, _ = repo.list(order_by="created_at", order_dir="DESCENDING", limit=200)
    if definition_id:
        items = [i for i in items if i.get("definition_id") == definition_id]
    return items


@router.post("/instances", status_code=201)
def create_instance(data: dict, user: dict = Depends(get_current_user)):
    definition_id = data.get("definition_id")
    if not definition_id:
        raise HTTPException(400, "definition_id required")
    def_repo = WorkflowDefRepository(user["org_id"])
    definition = def_repo.get(definition_id)
    if not definition:
        raise HTTPException(404, "Definition not found")
    start = definition.get("start")
    if not start:
        raise HTTPException(422, detail={"errors": ["definition has no start state"]})

    inst_repo = WorkflowInstanceRepository(user["org_id"])
    payload = {
        "id": str(uuid.uuid4()),
        "definition_id": definition_id,
        "definition_name": definition.get("name", ""),
        "state": start,
        "status": "running",
        "history": [],
        "context": data.get("context") or {},
        "created_at": _now_iso(),
        "created_by": user.get("id") or user.get("email"),
    }
    return inst_repo.create(payload)


@router.get("/instances/{instance_id}")
def get_instance(instance_id: str, user: dict = Depends(get_current_user)):
    repo = WorkflowInstanceRepository(user["org_id"])
    item = repo.get(instance_id)
    if not item:
        raise HTTPException(404, "Instance not found")
    return item


@router.post("/instances/{instance_id}/advance")
def advance_instance(instance_id: str, data: dict, user: dict = Depends(get_current_user)):
    event = data.get("event")
    if not event:
        raise HTTPException(400, "event required")
    context = data.get("context") or {}

    inst_repo = WorkflowInstanceRepository(user["org_id"])
    instance = inst_repo.get(instance_id)
    if not instance:
        raise HTTPException(404, "Instance not found")

    def_repo = WorkflowDefRepository(user["org_id"])
    definition = def_repo.get(instance["definition_id"])
    if not definition:
        raise HTTPException(404, "Definition not found")

    current_state = instance.get("state")
    runtime_def = _runtime_definition(definition)
    try:
        next_state = wf.advance(runtime_def, current_state, event, context)
    except wf.WorkflowError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    history = list(instance.get("history") or [])
    entry = {
        "event": event,
        "from": current_state,
        "to": next_state,
        "at": _now_iso(),
        "context": context,
    }
    history.append(entry)

    update_payload: dict = {
        "state": next_state,
        "history": history,
        "updated_at": _now_iso(),
    }
    if wf.is_end(runtime_def, next_state):
        update_payload["status"] = "completed"
        update_payload["completed_at"] = _now_iso()

    return inst_repo.update(instance_id, update_payload)
