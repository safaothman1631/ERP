"""Wave Q — platform org usage endpoint."""
from unittest.mock import patch

from fastapi.testclient import TestClient


def test_org_usage_requires_platform_admin():
    from app.main import app

    client = TestClient(app)
    resp = client.get("/api/platform/orgs/org-1/usage")
    assert resp.status_code in (401, 403, 422)


@patch("app.api.platform.usage.get_counters")
@patch("app.api.platform._guards.require_platform_admin")
def test_org_usage_shape(mock_admin, mock_counters):
    mock_admin.return_value = lambda: {"user_id": "u1", "org_id": "platform"}
    mock_counters.return_value = {
        "invoices_open_count": 3,
        "bills_open_count": 1,
        "invoices_open_balance": 100.0,
        "bills_open_balance": 50.0,
        "updated_at": "2026-05-01",
    }
    from app.api.platform.usage import org_usage

    out = org_usage("org-1", period="2026-05", user={"user_id": "admin"})
    assert out["org_id"] == "org-1"
    assert out["document_counts"]["invoices_open"] == 3
