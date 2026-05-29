"""R2.3 — Tax-rate unification.

  * ``POST /api/taxes`` is the canonical path.
  * ``POST /api/taxes/rates`` is the deprecated alias; it still works but
    emits a ``Deprecation: true`` response header that points clients at
    the canonical route via a ``Link`` ``rel="successor-version"``.
  * ``GET /api/taxes`` and ``GET /api/taxes/rates`` both list tax rates;
    only the alias carries the deprecation header.
"""
from unittest.mock import patch

from app.api.taxes import router as ROUTER
from tests.quick_create.conftest import echo_create, make_client

REPO = "app.api.taxes.TaxRateRepository"


def _body():
    return {"name": "VAT", "rate": 5.0, "tax_type": "vat", "is_compound": False}


def test_canonical_post_returns_201_with_location():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post("/api/taxes", json=_body())
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "VAT"
    assert body["rate"] == 5.0
    assert res.headers.get("Location", "").startswith("/api/taxes/")


def test_canonical_post_has_no_deprecation_header():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post("/api/taxes", json=_body())
    assert res.status_code == 201
    assert res.headers.get("Deprecation") is None


def test_deprecated_alias_post_still_works():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post("/api/taxes/rates", json=_body())
    assert res.status_code == 201
    assert res.json()["rate"] == 5.0


def test_deprecated_alias_post_emits_deprecation_header():
    with patch(REPO) as cls:
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post("/api/taxes/rates", json=_body())
    assert res.status_code == 201
    assert res.headers.get("Deprecation") == "true"
    link = res.headers.get("Link", "")
    assert "</api/taxes>" in link
    assert 'rel="successor-version"' in link


def test_canonical_get_lists_rates():
    rates = [{"id": "t1", "name": "VAT", "rate": 5.0}]
    with patch(REPO) as cls:
        cls.return_value.list.return_value = (rates, 1)
        res = make_client(ROUTER).get("/api/taxes")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert any(r["id"] == "t1" for r in data)


def test_deprecated_get_emits_deprecation_header():
    rates = [{"id": "t1", "name": "VAT", "rate": 5.0}]
    with patch(REPO) as cls:
        cls.return_value.list.return_value = (rates, 1)
        res = make_client(ROUTER).get("/api/taxes/rates")
    assert res.status_code == 200
    assert res.headers.get("Deprecation") == "true"


def test_missing_name_on_canonical_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post(
            "/api/taxes", json={"rate": 5.0}
        )
    assert res.status_code == 422


def test_missing_rate_on_alias_returns_422():
    """Validation must run regardless of which path the client used."""
    with patch(REPO):
        res = make_client(ROUTER).post(
            "/api/taxes/rates", json={"name": "VAT"}
        )
    assert res.status_code == 422
