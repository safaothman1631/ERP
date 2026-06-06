"""Tests for the TMS API (Pool 3.5 buildout).

CRUD endpoints mock the repository classes (no live Firestore); the
freight-quote and optimize-route endpoints exercise the real pure engine math.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.tms import router as tms_router
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
    app.include_router(tms_router)
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


# ─────────────────────── freight-quote (real engine math) ───────────────────────

class TestFreightQuote:
    def test_freight_quote_formula(self, client):
        # 5000 base + 250*10 + 120*50 = 5000 + 2500 + 6000 = 13500
        resp = client.post("/api/tms/freight-quote", json={"weight_kg": 10, "distance_km": 50})
        assert resp.status_code == 200
        body = resp.json()
        assert body["cost"] == 13500.0
        assert body["breakdown"]["weight_cost"] == 2500.0
        assert body["breakdown"]["distance_cost"] == 6000.0

    def test_freight_quote_min_charge_floor(self, client):
        # base 5000 < min 7000 → floored
        resp = client.post("/api/tms/freight-quote", json={"weight_kg": 0, "distance_km": 0})
        assert resp.status_code == 200
        body = resp.json()
        assert body["cost"] == 7000.0
        assert body["breakdown"]["floored_to_min"] is True

    def test_freight_quote_zone_and_service_mult(self, client):
        resp = client.post(
            "/api/tms/freight-quote",
            json={"weight_kg": 10, "distance_km": 50, "zone": "regional", "service": "express"},
        )
        assert resp.status_code == 200
        assert resp.json()["cost"] == round(13500 * 1.4 * 1.6, 2)

    def test_freight_quote_custom_rate_card(self, client):
        # override base/per_kg/per_km/min: 1000 + 100*2 + 10*5 = 1250
        resp = client.post(
            "/api/tms/freight-quote",
            json={
                "weight_kg": 2,
                "distance_km": 5,
                "rate_card": {"base": 1000, "per_kg": 100, "per_km": 10, "min_charge": 0},
            },
        )
        assert resp.status_code == 200
        assert resp.json()["cost"] == 1250.0

    def test_freight_quote_missing_fields_400(self, client):
        resp = client.post("/api/tms/freight-quote", json={"weight_kg": 10})
        assert resp.status_code == 400

    def test_freight_quote_non_numeric_400(self, client):
        resp = client.post(
            "/api/tms/freight-quote", json={"weight_kg": "heavy", "distance_km": 5}
        )
        assert resp.status_code == 400


# ─────────────────────── optimize-route (real engine ordering) ───────────────────────

class TestOptimizeRoute:
    def test_optimize_route_nearest_neighbour(self, client):
        resp = client.post(
            "/api/tms/optimize-route",
            json={
                "start": "S",
                "stops": ["A", "B", "C"],
                "distances": {
                    "S|A": 10, "S|B": 5, "S|C": 20,
                    "B|A": 3, "B|C": 15, "A|C": 8,
                },
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        # S->B(5) ->A(3) ->C(8) = 16
        assert body["order"] == ["B", "A", "C"]
        assert body["total"] == 16.0

    def test_optimize_route_undirected_key_lookup(self, client):
        # only reverse-keyed distances provided; closure must still resolve them
        resp = client.post(
            "/api/tms/optimize-route",
            json={
                "start": "S",
                "stops": ["A", "B"],
                "distances": {"A|S": 10, "B|S": 5, "A|B": 2},
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        # S->B(5) ->A(2) = 7
        assert body["order"] == ["B", "A"]
        assert body["total"] == 7.0

    def test_optimize_route_missing_start_400(self, client):
        resp = client.post("/api/tms/optimize-route", json={"stops": ["A"]})
        assert resp.status_code == 400

    def test_optimize_route_empty_stops_400(self, client):
        resp = client.post(
            "/api/tms/optimize-route", json={"start": "S", "stops": []}
        )
        assert resp.status_code == 400


# ─────────────────────── Carriers CRUD (mocked repo) ───────────────────────

class TestCarriersCrud:
    @patch("app.api.tms.CarrierRepository")
    def test_list_carriers(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.list.return_value = ([{"id": "c1", "name": "DHL"}], 1)

        resp = client.get("/api/tms/carriers")
        assert resp.status_code == 200
        assert resp.json()[0]["id"] == "c1"
        assert mock_repo.list.call_args.kwargs["order_by"] == "name"

    @patch("app.api.tms.CarrierRepository")
    def test_create_carrier(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.create.side_effect = lambda payload: {**payload}

        resp = client.post("/api/tms/carriers", json={"name": "Aramex", "code": "ARX"})
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Aramex"
        assert body["code"] == "ARX"
        assert body["is_active"] is True
        # org_id is injected by BaseRepository.create, not the route payload
        assert mock_repo.create.called

    @patch("app.api.tms.CarrierRepository")
    def test_create_carrier_requires_name(self, mock_repo_cls, client):
        resp = client.post("/api/tms/carriers", json={"code": "X"})
        assert resp.status_code == 400

    @patch("app.api.tms.CarrierRepository")
    def test_get_carrier_404(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.get.return_value = None

        resp = client.get("/api/tms/carriers/missing")
        assert resp.status_code == 404

    @patch("app.api.tms.CarrierRepository")
    def test_update_carrier(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.get.return_value = {"id": "c1", "org_id": "org-1", "name": "DHL"}
        mock_repo.update.return_value = {"id": "c1", "name": "DHL Express"}

        resp = client.put("/api/tms/carriers/c1", json={"name": "DHL Express"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "DHL Express"
        update_payload = mock_repo.update.call_args.args[1]
        assert "updated_at" in update_payload
        assert "id" not in update_payload  # stripped

    @patch("app.api.tms.CarrierRepository")
    def test_delete_carrier(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.get.return_value = {"id": "c1", "org_id": "org-1"}

        resp = client.delete("/api/tms/carriers/c1")
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        mock_repo.delete.assert_called_once_with("c1")


# ─────────────────────── Shipments CRUD (mocked repo) ───────────────────────

class TestShipmentsCrud:
    @patch("app.api.tms.ShipmentRepository")
    def test_list_shipments(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.list.return_value = ([{"id": "s1", "reference": "SH-1"}], 1)

        resp = client.get("/api/tms/shipments")
        assert resp.status_code == 200
        assert resp.json()[0]["id"] == "s1"
        assert mock_repo.list.call_args.kwargs["order_dir"] == "DESCENDING"

    @patch("app.api.tms.ShipmentRepository")
    def test_create_shipment_coerces_numbers(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.create.side_effect = lambda payload: {**payload}

        resp = client.post(
            "/api/tms/shipments",
            json={"reference": "SH-9", "weight_kg": "12.5", "distance_km": "40"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["reference"] == "SH-9"
        assert body["weight_kg"] == 12.5
        assert body["distance_km"] == 40.0
        assert body["status"] == "draft"

    @patch("app.api.tms.ShipmentRepository")
    def test_get_shipment_404(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.get.return_value = None

        resp = client.get("/api/tms/shipments/nope")
        assert resp.status_code == 404

    @patch("app.api.tms.ShipmentRepository")
    def test_update_shipment(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.get.return_value = {"id": "s1", "org_id": "org-1"}
        mock_repo.update.return_value = {"id": "s1", "status": "delivered"}

        resp = client.put("/api/tms/shipments/s1", json={"status": "delivered"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "delivered"

    @patch("app.api.tms.ShipmentRepository")
    def test_delete_shipment(self, mock_repo_cls, client):
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.get.return_value = {"id": "s1", "org_id": "org-1"}

        resp = client.delete("/api/tms/shipments/s1")
        assert resp.status_code == 200
        mock_repo.delete.assert_called_once_with("s1")
