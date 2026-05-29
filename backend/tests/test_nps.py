"""NPS endpoint tests (G2 / R2.15)."""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.nps import router as nps_router  # noqa: E402
from app.services.auth import get_current_user  # noqa: E402


def _user(days_old: int = 30, user_id: str = "u-1") -> dict:
    return {
        "id": user_id,
        "org_id": "org-1",
        "email": "u@test.com",
        "is_active": True,
        "created_at": datetime.now(timezone.utc) - timedelta(days=days_old),
    }


def _make_app(days_old: int = 30, user_id: str = "u-1") -> TestClient:
    app = FastAPI()
    app.include_router(nps_router)
    app.dependency_overrides[get_current_user] = lambda: _user(days_old, user_id)
    return TestClient(app)


# ── should-show ─────────────────────────────────────────────────────────


def test_should_show_returns_true_at_30_days_first_time():
    fake_db = MagicMock()
    fake_db.collection.return_value.document.return_value.get.return_value = (
        MagicMock(exists=False)
    )
    with patch("app.firebase_client.get_db", return_value=fake_db):
        res = _make_app(days_old=30).get("/api/nps/should-show")
    assert res.status_code == 200
    body = res.json()
    assert body["should_show"] is True
    assert body["prompt_day"] == 30


def test_should_show_returns_false_outside_window():
    fake_db = MagicMock()
    fake_db.collection.return_value.document.return_value.get.return_value = (
        MagicMock(exists=False)
    )
    with patch("app.firebase_client.get_db", return_value=fake_db):
        res = _make_app(days_old=15).get("/api/nps/should-show")
    assert res.status_code == 200
    assert res.json()["should_show"] is False


def test_should_show_returns_false_if_already_shown_for_window():
    last_doc = MagicMock()
    last_doc.exists = True
    last_doc.to_dict.return_value = {"last_prompt_day": 30}
    fake_db = MagicMock()
    fake_db.collection.return_value.document.return_value.get.return_value = last_doc
    with patch("app.firebase_client.get_db", return_value=fake_db):
        res = _make_app(days_old=32).get("/api/nps/should-show")
    assert res.status_code == 200
    assert res.json()["should_show"] is False


# ── submit ──────────────────────────────────────────────────────────────


def test_submit_persists_score_and_returns_201():
    fake_db = MagicMock()
    fake_db.collection.return_value.document.return_value.set.return_value = None
    with patch("app.firebase_client.get_db", return_value=fake_db):
        res = _make_app().post(
            "/api/nps/submit",
            json={"score": 9, "comment": "great app", "prompt_day": 30},
        )
    assert res.status_code == 201
    body = res.json()
    assert body["score"] == 9
    assert body["id"]


def test_submit_score_out_of_range_returns_422():
    res = _make_app().post("/api/nps/submit", json={"score": 11})
    assert res.status_code == 422
    res = _make_app().post("/api/nps/submit", json={"score": -1})
    assert res.status_code == 422
