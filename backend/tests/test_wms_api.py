"""Tests for the WMS warehouse bin-management API (Pool 3.5 buildout).

Mock the repositories so no live Firestore is hit; assert that putaway/pick wire
the pure ``wms_allocation`` engine correctly, and that bins CRUD + validation work.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.wms import router as wms_router
from app.services.auth import get_current_user


def _user():
    return {
        "id": "user-1",
        "org_id": "org-1",
        "email": "user@example.com",
        "name": "Test User",
    }


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(wms_router)
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


# ── Bins CRUD ─────────────────────────────────────────────────────

@patch("app.api.wms.BinRepository")
def test_list_bins(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.list.return_value = (
        [{"id": "b1", "bin_id": "A", "zone": "z1", "capacity": 10, "load": 2}],
        1,
    )

    resp = client.get("/api/wms/bins")
    assert resp.status_code == 200
    assert resp.json()[0]["bin_id"] == "A"
    mock_repo_cls.assert_called_once_with("org-1")


@patch("app.api.wms.BinRepository")
def test_create_bin(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.create.return_value = {
        "id": "b1", "bin_id": "A", "zone": "z1", "capacity": 10.0, "load": 0.0,
    }

    resp = client.post(
        "/api/wms/bins",
        json={"bin_id": "A", "zone": "z1", "capacity": 10},
    )
    assert resp.status_code == 201
    assert resp.json()["bin_id"] == "A"
    payload = mock_repo.create.call_args.args[0]
    assert payload["bin_id"] == "A"
    assert payload["capacity"] == 10.0
    assert payload["load"] == 0.0


def test_create_bin_requires_bin_id(client):
    resp = client.post("/api/wms/bins", json={"zone": "z1"})
    assert resp.status_code == 400


@patch("app.api.wms.BinRepository")
def test_get_bin_404(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.get.return_value = None
    resp = client.get("/api/wms/bins/nope")
    assert resp.status_code == 404


@patch("app.api.wms.BinRepository")
def test_update_bin(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.get.return_value = {"id": "b1", "org_id": "org-1", "bin_id": "A"}
    mock_repo.update.return_value = {"id": "b1", "bin_id": "A", "zone": "z2"}
    resp = client.put("/api/wms/bins/b1", json={"zone": "z2"})
    assert resp.status_code == 200
    assert resp.json()["zone"] == "z2"
    # protected fields stripped, updated_at stamped
    update_payload = mock_repo.update.call_args.args[1]
    assert "id" not in update_payload and "org_id" not in update_payload
    assert "updated_at" in update_payload


@patch("app.api.wms.BinRepository")
def test_delete_bin(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.get.return_value = {"id": "b1", "org_id": "org-1", "bin_id": "A"}
    resp = client.delete("/api/wms/bins/b1")
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    mock_repo.delete.assert_called_once_with("b1")


# ── Putaway (engine wiring) ───────────────────────────────────────

@patch("app.api.wms.BinRepository")
def test_putaway_wires_engine_consolidate(mock_repo_cls, client):
    """Real engine: A(cap10,load8,item) + B(cap10,load0); putaway 5 of itm
    consolidate → A gets 2, B gets 3, leftover 0."""
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.list.return_value = (
        [
            {"bin_id": "A", "zone": "z1", "capacity": 10, "load": 8, "item_id": "itm"},
            {"bin_id": "B", "zone": "z1", "capacity": 10, "load": 0},
        ],
        2,
    )

    resp = client.post(
        "/api/wms/putaway",
        json={"item_id": "itm", "qty": 5, "strategy": "consolidate"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["allocations"] == [
        {"bin_id": "A", "qty": 2.0},
        {"bin_id": "B", "qty": 3.0},
    ]
    assert body["leftover"] == 0.0
    assert body["strategy"] == "consolidate"


@patch("app.api.wms.BinRepository")
def test_putaway_reports_leftover_when_full(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.list.return_value = (
        [
            {"bin_id": "A", "zone": "z1", "capacity": 10, "load": 8, "item_id": "itm"},
            {"bin_id": "B", "zone": "z1", "capacity": 10, "load": 0},
        ],
        2,
    )
    resp = client.post("/api/wms/putaway", json={"item_id": "itm", "qty": 15})
    assert resp.status_code == 200
    assert resp.json()["leftover"] == 3.0  # free 2 + 10 = 12


def test_putaway_requires_positive_qty(client):
    resp = client.post("/api/wms/putaway", json={"item_id": "itm", "qty": 0})
    assert resp.status_code == 400


# ── Pick (engine wiring) ──────────────────────────────────────────

@patch("app.api.wms.BinStockRepository")
def test_pick_wires_engine_fifo(mock_repo_cls, client):
    """Real engine fifo: oldest received_at first → A(5) then C(2) for qty 7."""
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.list.return_value = (
        [
            {"bin_id": "A", "item_id": "itm", "qty": 5, "received_at": "2026-01-01", "seq": 9},
            {"bin_id": "B", "item_id": "itm", "qty": 5, "received_at": "2026-02-01", "seq": 1},
            {"bin_id": "C", "item_id": "itm", "qty": 5, "received_at": "2026-01-15", "seq": 0},
        ],
        3,
    )

    resp = client.post("/api/wms/pick", json={"item_id": "itm", "qty": 7, "strategy": "fifo"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["allocations"] == [
        {"bin_id": "A", "qty": 5.0},
        {"bin_id": "C", "qty": 2.0},
    ]
    assert body["short"] == 0.0


@patch("app.api.wms.BinStockRepository")
def test_pick_nearest_by_seq(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.list.return_value = (
        [
            {"bin_id": "A", "item_id": "itm", "qty": 5, "received_at": "2026-01-01", "seq": 9},
            {"bin_id": "B", "item_id": "itm", "qty": 5, "received_at": "2026-02-01", "seq": 1},
            {"bin_id": "C", "item_id": "itm", "qty": 5, "received_at": "2026-01-15", "seq": 0},
        ],
        3,
    )
    resp = client.post("/api/wms/pick", json={"item_id": "itm", "qty": 7, "strategy": "nearest"})
    assert resp.status_code == 200
    assert resp.json()["allocations"] == [
        {"bin_id": "C", "qty": 5.0},
        {"bin_id": "B", "qty": 2.0},
    ]


@patch("app.api.wms.BinStockRepository")
def test_pick_reports_short_when_insufficient(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.list.return_value = (
        [{"bin_id": "A", "item_id": "itm", "qty": 5, "received_at": "2026-01-01"}],
        1,
    )
    resp = client.post("/api/wms/pick", json={"item_id": "itm", "qty": 20})
    assert resp.status_code == 200
    assert resp.json()["short"] == 15.0


def test_pick_requires_item_id(client):
    resp = client.post("/api/wms/pick", json={"qty": 5})
    assert resp.status_code == 400


def test_pick_requires_positive_qty(client):
    resp = client.post("/api/wms/pick", json={"item_id": "itm", "qty": 0})
    assert resp.status_code == 400
