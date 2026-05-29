"""Tests for the Super-Admin SaaS billing endpoints (R5.7)."""
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.saas_admin import router as ADMIN_ROUTER
from app.services.auth import get_current_user


def _admin_user() -> dict:
    return {
        "id": "u-1", "org_id": "platform",
        "email": "safa@zoho.kurd.iq", "name": "Safa",
        "role": "super_admin", "is_active": True,
        "is_platform_admin": True,
    }


def _viewer_user() -> dict:
    return {
        "id": "u-2", "org_id": "tenant-1",
        "email": "viewer@x.io", "name": "Viewer",
        "role": "viewer", "is_active": True,
        "is_platform_admin": False,
    }


def _client(user_fn=_admin_user) -> TestClient:
    app = FastAPI()
    app.include_router(ADMIN_ROUTER)
    app.dependency_overrides[get_current_user] = user_fn
    return TestClient(app, raise_server_exceptions=False)


def _fake_states():
    return [
        {"tenant_id": "t1", "status": "active",  "plan_slug": "starter",
         "billing_cycle": "monthly", "currency": "IQD"},
        {"tenant_id": "t2", "status": "active",  "plan_slug": "growth",
         "billing_cycle": "monthly", "currency": "IQD"},
        {"tenant_id": "t3", "status": "trialing","plan_slug": "starter",
         "billing_cycle": "monthly", "currency": "IQD"},
        {"tenant_id": "t4", "status": "past_due","plan_slug": "starter",
         "billing_cycle": "monthly", "currency": "IQD"},
        {"tenant_id": "t5", "status": "suspended","plan_slug": "starter",
         "billing_cycle": "monthly", "currency": "IQD"},
        {"tenant_id": "t6", "status": "cancelled","plan_slug": "starter",
         "billing_cycle": "monthly", "currency": "IQD"},
    ]


def test_dashboard_returns_correct_counts():
    with patch("app.api.saas_admin.SaasBillingAdminRepository") as cls:
        cls.return_value.iter_states.return_value = iter(_fake_states())
        res = _client().get("/api/saas-billing/admin/dashboard")
    assert res.status_code == 200
    body = res.json()
    assert body["active_tenants"] == 2
    assert body["trialing_tenants"] == 1
    assert body["past_due_tenants"] == 1
    assert body["suspended_tenants"] == 1
    assert body["cancelled_tenants"] == 1


def test_dashboard_sums_mrr_from_active_only():
    with patch("app.api.saas_admin.SaasBillingAdminRepository") as cls:
        cls.return_value.iter_states.return_value = iter(_fake_states())
        res = _client().get("/api/saas-billing/admin/dashboard")
    body = res.json()
    # starter monthly IQD = 30000; growth monthly IQD = 80000; total = 110000.
    assert body["mrr_iqd"] == 110_000
    # ARR is 12× MRR.
    assert body["arr_iqd"] == 110_000 * 12


def test_dashboard_forbids_non_admin():
    with patch("app.api.saas_admin.SaasBillingAdminRepository") as cls:
        cls.return_value.iter_states.return_value = iter([])
        res = _client(_viewer_user).get("/api/saas-billing/admin/dashboard")
    assert res.status_code == 403


def test_tenants_endpoint_paginates_and_sorts_by_mrr():
    with patch("app.api.saas_admin.SaasBillingAdminRepository") as cls:
        cls.return_value.iter_states.return_value = iter(_fake_states())
        res = _client().get("/api/saas-billing/admin/tenants?page_size=2")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 6
    assert len(body["items"]) == 2
    # Growth (80k) should sort before Starter (30k).
    assert body["items"][0]["plan_slug"] == "growth"


def test_tenants_status_filter_narrows_results():
    with patch("app.api.saas_admin.SaasBillingAdminRepository") as cls:
        cls.return_value.iter_states.return_value = iter(_fake_states())
        res = _client().get(
            "/api/saas-billing/admin/tenants?status_filter=past_due"
        )
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["tenant_id"] == "t4"


def test_manual_payment_marks_status_active():
    with patch("app.api.saas_admin.TenantBillingRepository") as cls:
        repo = cls.return_value
        repo.get.return_value = {"tenant_id": "t1", "status": "past_due"}
        repo.record_payment.return_value = {"tenant_id": "t1", "status": "active"}
        res = _client().post(
            "/api/saas-billing/admin/tenants/t1/manual-payment",
            json={"amount": 30000, "provider": "fastpay", "reference": "FP-001"},
        )
    assert res.status_code == 200
    assert res.json()["new_status"] == "active"


def test_manual_payment_404_when_no_state():
    with patch("app.api.saas_admin.TenantBillingRepository") as cls:
        cls.return_value.get.return_value = None
        res = _client().post(
            "/api/saas-billing/admin/tenants/nope/manual-payment",
            json={"amount": 30000, "provider": "fastpay", "reference": "FP-1"},
        )
    assert res.status_code == 404
