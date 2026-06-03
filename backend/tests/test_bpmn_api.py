"""Tests for the BPMN workflow API (Pool 3.6 buildout).

Follows the repo-mocking convention used elsewhere in the suite: build a tiny
FastAPI app around the router, override ``get_current_user`` for org scoping,
and patch the Repository classes (``app.api.bpmn.*Repository``) with an
in-memory fake so no real Firestore connection is needed.

Coverage:
  * definitions — create validates via workflow_engine.validate_definition
                  (422 on structural errors; 422 when start missing).
  * instances   — created at definition.start; advance applies transitions,
                  appends history, persists new state; guard rejection and
                  unknown-transition both surface as 409.
"""
from __future__ import annotations

import uuid
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.bpmn import router as ROUTER
from app.services.auth import get_current_user


# ── Auth override ───────────────────────────────────────────────────────────


def _user() -> dict:
    return {
        "id": "user-1",
        "org_id": "org-1",
        "email": "owner@test.com",
        "name": "Owner",
        "role": "admin",
        "is_active": True,
    }


# ── In-memory fake repository ────────────────────────────────────────────────


class FakeRepo:
    """Minimal in-memory stand-in for BaseRepository (per-collection store)."""

    _stores: dict[str, dict] = {}

    def __init__(self, org_id: str):
        self.org_id = org_id
        self.store = FakeRepo._stores.setdefault(self.collection_name, {})

    def create(self, data: dict) -> dict:
        doc_id = data.pop("id", None) or str(uuid.uuid4())
        data.pop("org_id", None)
        rec = {"id": doc_id, "org_id": self.org_id, **data}
        self.store[doc_id] = rec
        return dict(rec)

    def get(self, doc_id: str):
        rec = self.store.get(doc_id)
        if not rec or rec.get("org_id") != self.org_id:
            return None
        return dict(rec)

    def update(self, doc_id: str, data: dict) -> dict:
        rec = self.store[doc_id]
        data.pop("id", None)
        data.pop("org_id", None)
        rec.update(data)
        return dict(rec)

    def delete(self, doc_id: str, hard: bool = False):
        self.store.pop(doc_id, None)

    def list(self, order_by=None, order_dir="DESCENDING", limit=25, **kw):
        items = [dict(r) for r in self.store.values() if r.get("org_id") == self.org_id]
        if order_by:
            items.sort(
                key=lambda x: str(x.get(order_by) or ""),
                reverse=(order_dir == "DESCENDING"),
            )
        return items[:limit], len(items)


class FakeDefRepo(FakeRepo):
    collection_name = "bpmn_definitions"


class FakeInstRepo(FakeRepo):
    collection_name = "bpmn_instances"


def make_client() -> TestClient:
    FakeRepo._stores = {}  # reset per client
    app = FastAPI()
    app.include_router(ROUTER)
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


def _patch_repos():
    return (
        patch("app.api.bpmn.WorkflowDefRepository", FakeDefRepo),
        patch("app.api.bpmn.WorkflowInstanceRepository", FakeInstRepo),
    )


# ── Sample definitions ───────────────────────────────────────────────────────


def _valid_def() -> dict:
    return {
        "name": "Invoice flow",
        "states": ["draft", "sent", "paid"],
        "start": "draft",
        "end": ["paid"],
        "transitions": [
            {"from": "draft", "to": "sent", "on": "send"},
            {
                "from": "sent",
                "to": "paid",
                "on": "pay",
                "guard": {"field": "amount", "op": "gt", "value": 0},
            },
        ],
    }


# ── Definition tests ─────────────────────────────────────────────────────────


def test_create_definition_happy_path():
    p1, p2 = _patch_repos()
    with p1, p2:
        client = make_client()
        resp = client.post("/api/bpmn/definitions", json=_valid_def())
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["id"]
    assert body["start"] == "draft"
    assert body["org_id"] == "org-1"
    # guard persisted as a plain dict (JSON-serialisable, no callable)
    pay = next(t for t in body["transitions"] if t["on"] == "pay")
    assert pay["guard"] == {"field": "amount", "op": "gt", "value": 0}


def test_create_definition_validation_422_on_unknown_state():
    bad = {
        "name": "Bad flow",
        "states": ["a"],
        "start": "a",
        # 'b' is not a declared state -> validate_definition flags it
        "transitions": [{"from": "a", "to": "b", "on": "x"}],
    }
    p1, p2 = _patch_repos()
    with p1, p2:
        client = make_client()
        resp = client.post("/api/bpmn/definitions", json=bad)
    assert resp.status_code == 422, resp.text
    errs = resp.json()["detail"]["errors"]
    assert any("unknown state 'b'" in e for e in errs)


def test_create_definition_requires_start():
    no_start = {"name": "No start", "states": ["a", "b"], "transitions": []}
    p1, p2 = _patch_repos()
    with p1, p2:
        client = make_client()
        resp = client.post("/api/bpmn/definitions", json=no_start)
    assert resp.status_code == 422, resp.text
    assert "start state required" in resp.json()["detail"]["errors"]


# ── Instance tests ───────────────────────────────────────────────────────────


def test_create_instance_starts_at_definition_start():
    p1, p2 = _patch_repos()
    with p1, p2:
        client = make_client()
        def_id = client.post("/api/bpmn/definitions", json=_valid_def()).json()["id"]
        resp = client.post("/api/bpmn/instances", json={"definition_id": def_id})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["state"] == "draft"
    assert body["status"] == "running"
    assert body["history"] == []
    assert body["definition_id"] == def_id


def test_create_instance_404_unknown_definition():
    p1, p2 = _patch_repos()
    with p1, p2:
        client = make_client()
        resp = client.post("/api/bpmn/instances", json={"definition_id": "nope"})
    assert resp.status_code == 404


def test_advance_transitions_and_appends_history():
    p1, p2 = _patch_repos()
    with p1, p2:
        client = make_client()
        def_id = client.post("/api/bpmn/definitions", json=_valid_def()).json()["id"]
        inst_id = client.post(
            "/api/bpmn/instances", json={"definition_id": def_id}
        ).json()["id"]

        # draft --send--> sent
        r1 = client.post(f"/api/bpmn/instances/{inst_id}/advance", json={"event": "send"})
        assert r1.status_code == 200, r1.text
        assert r1.json()["state"] == "sent"
        assert len(r1.json()["history"]) == 1
        assert r1.json()["history"][0] == {
            "event": "send",
            "from": "draft",
            "to": "sent",
            "at": r1.json()["history"][0]["at"],
            "context": {},
        }

        # sent --pay--> paid  (guard amount > 0 satisfied) -> end state -> completed
        r2 = client.post(
            f"/api/bpmn/instances/{inst_id}/advance",
            json={"event": "pay", "context": {"amount": 500}},
        )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["state"] == "paid"
    assert body["status"] == "completed"
    assert body.get("completed_at")
    assert len(body["history"]) == 2
    assert body["history"][1]["to"] == "paid"


def test_advance_guard_rejection_409():
    p1, p2 = _patch_repos()
    with p1, p2:
        client = make_client()
        def_id = client.post("/api/bpmn/definitions", json=_valid_def()).json()["id"]
        inst_id = client.post(
            "/api/bpmn/instances", json={"definition_id": def_id}
        ).json()["id"]
        client.post(f"/api/bpmn/instances/{inst_id}/advance", json={"event": "send"})
        # guard amount > 0 fails (amount = 0) -> 409
        resp = client.post(
            f"/api/bpmn/instances/{inst_id}/advance",
            json={"event": "pay", "context": {"amount": 0}},
        )
    assert resp.status_code == 409, resp.text
    assert "guard" in resp.json()["detail"]


def test_advance_unknown_transition_409():
    p1, p2 = _patch_repos()
    with p1, p2:
        client = make_client()
        def_id = client.post("/api/bpmn/definitions", json=_valid_def()).json()["id"]
        inst_id = client.post(
            "/api/bpmn/instances", json={"definition_id": def_id}
        ).json()["id"]
        # 'pay' is not valid from 'draft' -> no transition -> 409
        resp = client.post(f"/api/bpmn/instances/{inst_id}/advance", json={"event": "pay"})
    assert resp.status_code == 409, resp.text
    assert "no transition" in resp.json()["detail"]


def test_advance_404_unknown_instance():
    p1, p2 = _patch_repos()
    with p1, p2:
        client = make_client()
        resp = client.post("/api/bpmn/instances/nope/advance", json={"event": "send"})
    assert resp.status_code == 404
