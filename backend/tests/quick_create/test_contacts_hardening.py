"""R2.1 — POST /api/contacts hardening.

Covers the launch-readiness specifications for the contacts quick-create:
  * ``display_name`` is the sole required field; ``email`` and ``phone`` are
    fully optional and a missing value SHALL NOT produce 400/422.
  * Iraqi mobile phone numbers are normalized to E.164 form
    (``+9647XXXXXXXXX``) regardless of how the user typed them.
  * Tenant isolation (org_id) is unaffected by the new validators.

The tests mock ``ContactRepository`` so no Firestore connection is needed,
mirroring the pattern in :mod:`tests.quick_create.conftest`.
"""
from unittest.mock import patch

from app.api.contacts import router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.contacts.ContactRepository"


def test_minimum_fields_create_returns_201():
    """Only ``display_name`` is required — no email, no phone, no anything else."""
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/contacts", json={"display_name": "Acme LLC"}
        )
    assert res.status_code == 201
    body = res.json()
    assert body["display_name"] == "Acme LLC"
    assert body["org_id"] == "org-1"


def test_missing_email_does_not_422():
    """Email is optional — sending only display_name MUST succeed."""
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/contacts", json={"display_name": "Walk-in Customer"}
        )
    assert res.status_code == 201
    assert "email" not in res.json() or res.json().get("email") is None


def test_missing_display_name_returns_422():
    """display_name is the one required field."""
    with patch(REPO):
        res = make_client(ROUTER).post(
            "/api/contacts", json={"email": "foo@example.com"}
        )
    assert res.status_code == 422


def test_iraqi_phone_local_zero_prefix_normalized():
    """``07XX-XXX-XXXX`` → ``+9647XXXXXXXXX``."""
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    with patch(REPO) as cls:
        cls.return_value.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/contacts",
            json={"display_name": "Ali", "phone": "0770-123-4567"},
        )
    assert res.status_code == 201
    assert captured["phone"] == "+9647701234567"


def test_iraqi_phone_no_leading_zero_normalized():
    """``7XX-XXX-XXXX`` (10 digits) → ``+9647XXXXXXXXX``."""
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    with patch(REPO) as cls:
        cls.return_value.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/contacts",
            json={"display_name": "Sara", "phone": "750 111 2222"},
        )
    assert res.status_code == 201
    assert captured["phone"] == "+9647501112222"


def test_iraqi_phone_already_e164_passes_through():
    """An already-canonical E.164 number is preserved verbatim."""
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    with patch(REPO) as cls:
        cls.return_value.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/contacts",
            json={"display_name": "Co", "phone": "+9647811112222"},
        )
    assert res.status_code == 201
    assert captured["phone"] == "+9647811112222"


def test_iraqi_phone_with_double_zero_prefix_normalized():
    """``009647XXXXXXXXX`` → ``+9647XXXXXXXXX``."""
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    with patch(REPO) as cls:
        cls.return_value.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/contacts",
            json={"display_name": "Co", "phone": "009647811112222"},
        )
    assert res.status_code == 201
    assert captured["phone"] == "+9647811112222"


def test_non_iraqi_phone_kept_cleaned():
    """A non-Iraqi number is preserved but with whitespace/punct stripped."""
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    with patch(REPO) as cls:
        cls.return_value.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/contacts",
            json={"display_name": "US Vendor", "phone": "+1 (415) 555-0100"},
        )
    assert res.status_code == 201
    # Whitespace, parens and dashes stripped; otherwise preserved.
    assert captured["phone"] == "+14155550100"


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post(
            "/api/contacts", json={"display_name": "Blocked"}
        )
    assert res.status_code == 403


def test_optional_email_when_supplied_still_validates():
    """A garbage email value still 422s — optional doesn't mean unvalidated."""
    with patch(REPO):
        res = make_client(ROUTER).post(
            "/api/contacts",
            json={"display_name": "Bad", "email": "not-an-email"},
        )
    assert res.status_code == 422
