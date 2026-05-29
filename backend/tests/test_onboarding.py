"""Tests for the onboarding wizard backend (launch-readiness § R3).

Follows the repo-mocking pattern from ``backend/tests/quick_create/``: build a
tiny FastAPI app around the router, override ``get_current_user``, and stub
the persistence layer so no Firestore connection is required.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.onboarding_wizard import router as ONBOARDING_ROUTER  # noqa: E402
from app.services.auth import get_current_user  # noqa: E402


# ── Fixtures / helpers ──────────────────────────────────────────────────

def _admin_user() -> dict:
    return {
        "id": "user-admin",
        "org_id": "org-1",
        "email": "admin@test.com",
        "name": "Admin",
        "role": "admin",
        "is_active": True,
    }


def _viewer_user() -> dict:
    """Read-only role: lacks ``accounts.create`` → expects 403 on coa/apply."""
    return {
        "id": "user-viewer",
        "org_id": "org-1",
        "email": "viewer@test.com",
        "name": "Viewer",
        "role": "viewer",
        "is_active": True,
    }


def _missing_org_user() -> dict:
    """A user whose token is missing ``org_id`` — should produce 400."""
    return {
        "id": "user-stray",
        "email": "stray@test.com",
        "name": "Stray",
        "role": "admin",
        "is_active": True,
    }


def _client(user_fn=_admin_user) -> TestClient:
    app = FastAPI()
    app.include_router(ONBOARDING_ROUTER)
    app.dependency_overrides[get_current_user] = user_fn
    return TestClient(app, raise_server_exceptions=False)


REPO_PATH = "app.api.onboarding_wizard.OnboardingRepository"
APPLY_COA_PATH = "app.api.onboarding_wizard.repo_apply_coa"
LIST_TEMPLATES_PATH = "app.api.onboarding_wizard.list_template_names"
GET_TEMPLATE_PATH = "app.api.onboarding_wizard.get_template"


# ── GET /api/onboarding/state ───────────────────────────────────────────

def test_get_state_for_new_tenant_returns_defaults():
    with patch(REPO_PATH) as cls:
        cls.return_value.get_state.return_value = None
        res = _client().get("/api/onboarding/state")
    assert res.status_code == 200
    body = res.json()
    assert body["current_step"] == "step1_company"
    assert body["completed_steps"] == []
    assert body["completed_at"] is None
    # company/region/coa start as None (the reducer populates them).
    assert body["company"] is None
    assert body["region"] is None


def test_get_state_for_existing_tenant_returns_persisted_blob():
    persisted = {
        "current_step": "step3_coa",
        "completed_steps": ["step1_company", "step2_region"],
        "skipped_steps": [],
        "company": {
            "legal_name": "Acme",
            "intended_use": ["retail"],
            "fiscal_year_start_month": 1,
            "base_currency": "IQD",
        },
        "region": None,
        "coa": None,
        "pos_hardware": None,
        "first_sale": None,
        "started_at": "2026-05-01T10:00:00",
        "completed_at": None,
        "expires_at": "2026-05-31T10:00:00",
    }
    with patch(REPO_PATH) as cls:
        cls.return_value.get_state.return_value = persisted
        res = _client().get("/api/onboarding/state")
    assert res.status_code == 200
    body = res.json()
    assert body["current_step"] == "step3_coa"
    assert body["company"]["legal_name"] == "Acme"


def test_get_state_without_tenant_returns_400():
    with patch(REPO_PATH):
        res = _client(_missing_org_user).get("/api/onboarding/state")
    assert res.status_code == 400


# ── PUT /api/onboarding/state ───────────────────────────────────────────

def test_put_then_get_round_trips_state():
    saved_payload = {}

    def _put_state(tenant_id, state):
        saved_payload["tid"] = tenant_id
        saved_payload["state"] = state
        return {**state, "started_at": "2026-05-29T00:00:00", "expires_at": "2026-06-28T00:00:00"}

    def _get_state(tenant_id):
        return saved_payload.get("state")

    with patch(REPO_PATH) as cls:
        instance = cls.return_value
        instance.put_state.side_effect = _put_state
        instance.get_state.side_effect = _get_state
        body = {
            "current_step": "step2_region",
            "completed_steps": ["step1_company"],
            "skipped_steps": [],
            "company": {
                "legal_name": "Erbil Trading",
                "intended_use": ["retail"],
                "fiscal_year_start_month": 1,
                "base_currency": "IQD",
            },
        }
        res = _client().put("/api/onboarding/state", json=body)
        assert res.status_code == 200
        assert saved_payload["tid"] == "org-1"
        assert saved_payload["state"]["current_step"] == "step2_region"

        # Round-trip: subsequent GET returns the same blob
        res2 = _client().get("/api/onboarding/state")
        assert res2.status_code == 200
        assert res2.json()["current_step"] == "step2_region"


def test_put_state_with_invalid_step_returns_422():
    with patch(REPO_PATH):
        res = _client().put(
            "/api/onboarding/state",
            json={"current_step": "step99_invalid", "completed_steps": [], "skipped_steps": []},
        )
    assert res.status_code == 422


def test_put_state_dedupes_completed_steps():
    captured = {}

    def _put_state(tenant_id, state):
        captured["state"] = state
        return state

    with patch(REPO_PATH) as cls:
        cls.return_value.put_state.side_effect = _put_state
        res = _client().put(
            "/api/onboarding/state",
            json={
                "current_step": "step2_region",
                "completed_steps": ["step1_company", "step1_company", "step1_company"],
                "skipped_steps": [],
            },
        )
    assert res.status_code == 200
    # Pydantic validator dedupes (preserving order).
    assert captured["state"]["completed_steps"] == ["step1_company"]


# ── GET /api/onboarding/coa/templates ──────────────────────────────────

def test_list_coa_templates_returns_all_yaml_files():
    sample = {
        "name": "small_smb",
        "display_name_en": "Small business",
        "display_name_ku": "شرکەت بچووک",
        "display_name_ar": "شركة صغيرة",
        "recommended_for": ["sole_proprietor"],
        "accounts": [{"code": "10000"}, {"code": "20000"}],
    }
    with patch(LIST_TEMPLATES_PATH, return_value=["small_smb"]), \
         patch(GET_TEMPLATE_PATH, return_value=sample):
        res = _client().get("/api/onboarding/coa/templates")
    assert res.status_code == 200
    body = res.json()
    assert body["templates"][0]["name"] == "small_smb"
    assert body["templates"][0]["account_count"] == 2
    assert body["templates"][0]["display_name_ku"] == "شرکەت بچووک"


# ── POST /api/onboarding/coa/apply ──────────────────────────────────────

def _apply_result(n: int = 30) -> dict:
    return {
        "accounts_created": n,
        "ids": [f"acc-{i}" for i in range(n)],
        "default_account_map": {
            "default_cash": "acc-0",
            "default_sales_revenue": "acc-10",
        },
        "template": "small_smb",
    }


def test_apply_coa_small_smb_returns_count_and_ids():
    with patch(APPLY_COA_PATH, return_value=_apply_result(30)) as fn:
        res = _client().post(
            "/api/onboarding/coa/apply",
            json={"template": "small_smb", "overrides": []},
        )
    assert res.status_code == 201
    body = res.json()
    assert body["accounts_created"] == 30
    assert len(body["ids"]) == 30
    assert body["default_account_map"]["default_cash"] == "acc-0"
    fn.assert_called_once_with("org-1", "small_smb", [])


def test_apply_coa_each_template_succeeds():
    for tpl in ("small_smb", "medium_smb", "restaurant", "pharmacy", "retail"):
        with patch(APPLY_COA_PATH, return_value=_apply_result(40)) as fn:
            res = _client().post(
                "/api/onboarding/coa/apply",
                json={"template": tpl, "overrides": []},
            )
        assert res.status_code in (200, 201), f"template {tpl} failed: {res.text}"
        assert res.json()["accounts_created"] == 40
        fn.assert_called_once()


def test_apply_coa_idempotent_second_call_returns_200_when_nothing_new():
    """Re-applying skips already-existing codes → accounts_created=0 → 200."""
    with patch(APPLY_COA_PATH, return_value=_apply_result(0)):
        res = _client().post(
            "/api/onboarding/coa/apply",
            json={"template": "small_smb", "overrides": []},
        )
    assert res.status_code == 200
    assert res.json()["accounts_created"] == 0


def test_apply_coa_with_unknown_template_returns_422():
    with patch(APPLY_COA_PATH):
        res = _client().post(
            "/api/onboarding/coa/apply",
            json={"template": "made_up", "overrides": []},
        )
    # Pydantic Literal validation catches this before the repo is called.
    assert res.status_code == 422


def test_apply_coa_with_missing_template_file_returns_422():
    with patch(APPLY_COA_PATH, side_effect=FileNotFoundError("coa_template_not_found:small_smb")):
        res = _client().post(
            "/api/onboarding/coa/apply",
            json={"template": "small_smb", "overrides": []},
        )
    assert res.status_code == 422


def test_apply_coa_permission_denied_for_viewer():
    with patch(APPLY_COA_PATH, return_value=_apply_result(30)):
        res = _client(_viewer_user).post(
            "/api/onboarding/coa/apply",
            json={"template": "small_smb", "overrides": []},
        )
    assert res.status_code == 403


def test_apply_coa_with_overrides_passes_them_through():
    captured = {}

    def _capture(tid, tpl, overrides):
        captured["overrides"] = overrides
        return _apply_result(30)

    with patch(APPLY_COA_PATH, side_effect=_capture):
        res = _client().post(
            "/api/onboarding/coa/apply",
            json={
                "template": "small_smb",
                "overrides": [
                    {"code": "11200", "name": "Cihan Bank — Erbil"},
                    {"code": "11300", "new_code": "11305"},
                ],
            },
        )
    assert res.status_code == 201
    assert captured["overrides"][0]["code"] == "11200"
    assert captured["overrides"][0]["name"] == "Cihan Bank — Erbil"
    assert captured["overrides"][1]["new_code"] == "11305"


# ── POST /api/onboarding/complete ───────────────────────────────────────

def test_complete_stamps_completed_at_and_returns_tenant_id():
    saved = {
        "completed_at": "2026-05-29T12:00:00",
        "current_step": "completed",
    }
    with patch(REPO_PATH) as cls:
        cls.return_value.complete.return_value = saved
        res = _client().post("/api/onboarding/complete")
    assert res.status_code == 200
    body = res.json()
    assert body["tenant_id"] == "org-1"
    assert body["completed_at"].startswith("2026-05-29")


def test_complete_uses_now_if_repo_omits_timestamp():
    """If the repo returns a doc without ``completed_at``, we synthesise one."""
    with patch(REPO_PATH) as cls:
        cls.return_value.complete.return_value = {"current_step": "completed"}
        res = _client().post("/api/onboarding/complete")
    assert res.status_code == 200
    assert "completed_at" in res.json()


# ── Integration: COA template files exist + parse ──────────────────────

def test_all_coa_yaml_files_exist_on_disk():
    """Sanity check that the five templates land where the repo expects."""
    from app.firestore.onboarding_repo import _TEMPLATES_DIR

    expected = {"small_smb", "medium_smb", "restaurant", "pharmacy", "retail"}
    found = {p.stem for p in _TEMPLATES_DIR.glob("*.yaml")}
    missing = expected - found
    assert not missing, f"missing COA templates: {missing}"


def test_coa_yaml_files_have_required_shape():
    """Each template must declare ``name`` + ``accounts`` + at least one default-mapping."""
    try:
        from app.firestore.onboarding_repo import get_template, list_template_names
    except ImportError:
        # pyyaml not installed in this env — skipped, not a failure.
        import pytest
        pytest.skip("pyyaml not available")
        return
    try:
        import yaml  # noqa: F401
    except ImportError:
        import pytest
        pytest.skip("pyyaml not available")
        return

    for name in list_template_names():
        tpl = get_template(name)
        assert tpl.get("name") == name, f"name mismatch in {name}.yaml"
        accounts = tpl.get("accounts") or []
        assert len(accounts) >= 25, f"{name} has only {len(accounts)} accounts"
        # Every template must designate a default cash + sales-revenue account.
        defaults = {a.get("is_default_for") for a in accounts if a.get("is_default_for")}
        assert "default_cash" in defaults, f"{name} missing default_cash"
        assert "default_sales_revenue" in defaults, f"{name} missing default_sales_revenue"
