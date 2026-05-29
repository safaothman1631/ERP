"""Tests for the CBI rate fetcher (growth-to-100 § R4.15)."""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.services import cbi_rates


# ─────────────────────────────────────────────────────────────────────────
# _parse_cbi_response — schema tolerance
# ─────────────────────────────────────────────────────────────────────────


def test_parse_shape_a_flat_rate_key():
    assert cbi_rates._parse_cbi_response({"rate": 1320.5}) == 1320.5


def test_parse_shape_a_usd_key():
    assert cbi_rates._parse_cbi_response({"USD": 1310}) == 1310.0


def test_parse_shape_b_data_array():
    payload = {"data": [{"currency": "EUR", "rate": 1500}, {"currency": "USD", "rate": 1300}]}
    assert cbi_rates._parse_cbi_response(payload) == 1300.0


def test_parse_shape_c_bare_number_string():
    assert cbi_rates._parse_cbi_response("1320.0") == 1320.0


def test_parse_returns_none_for_garbage():
    assert cbi_rates._parse_cbi_response({"foo": "bar"}) is None
    assert cbi_rates._parse_cbi_response(None) is None


# ─────────────────────────────────────────────────────────────────────────
# Network fetch — patched httpx
# ─────────────────────────────────────────────────────────────────────────


def test_fetch_returns_rate_on_success():
    fake_resp = MagicMock()
    fake_resp.json.return_value = {"rate": 1320.0}
    fake_resp.raise_for_status.return_value = None
    fake_client = MagicMock()
    fake_client.__enter__.return_value = fake_client
    fake_client.__exit__.return_value = False
    fake_client.get.return_value = fake_resp
    with patch("app.services.cbi_rates.httpx.Client", return_value=fake_client):
        assert cbi_rates.fetch_cbi_usd_iqd_rate() == 1320.0


def test_fetch_returns_none_on_http_error():
    with patch("app.services.cbi_rates.httpx.Client", side_effect=Exception("dns fail")):
        assert cbi_rates.fetch_cbi_usd_iqd_rate() is None


def test_fetch_returns_none_when_response_has_no_usable_rate():
    fake_resp = MagicMock()
    fake_resp.json.return_value = {"junk": True}
    fake_resp.raise_for_status.return_value = None
    fake_client = MagicMock()
    fake_client.__enter__.return_value = fake_client
    fake_client.__exit__.return_value = False
    fake_client.get.return_value = fake_resp
    with patch("app.services.cbi_rates.httpx.Client", return_value=fake_client):
        assert cbi_rates.fetch_cbi_usd_iqd_rate() is None


# ─────────────────────────────────────────────────────────────────────────
# Fallback walk + hardcoded last-resort
# ─────────────────────────────────────────────────────────────────────────


def test_get_latest_with_fallback_walks_yesterday():
    today = date(2026, 5, 29)
    stored_yesterday = {
        "id": "2026-05-28",
        "rate_date": "2026-05-28",
        "rate": 1318.0,
        "source": "cbi",
    }

    def fake_get_rate(d):
        return stored_yesterday if d == date(2026, 5, 28) else None

    with patch("app.services.cbi_rates.get_rate", side_effect=fake_get_rate):
        doc = cbi_rates.get_latest_rate_with_fallback(today)
    assert doc["rate"] == 1318.0
    assert doc["source"] == "fallback"
    assert doc["fallback_age_days"] == 1


def test_get_latest_falls_back_to_hardcoded_after_7_misses():
    with patch("app.services.cbi_rates.get_rate", return_value=None):
        doc = cbi_rates.get_latest_rate_with_fallback(date(2026, 5, 29))
    assert doc["source"] == "hardcoded_fallback"
    assert doc["rate"] == cbi_rates.HARDCODED_FALLBACK_IQD_PER_USD


# ─────────────────────────────────────────────────────────────────────────
# Currency converter
# ─────────────────────────────────────────────────────────────────────────


def test_converter_identity_returns_input():
    from app.services.currency_converter import convert
    r = convert(100, "USD", "USD")
    assert r.converted == 100
    assert r.source == "identity"


def test_converter_usd_to_iqd_uses_rate():
    from app.services.currency_converter import convert
    with patch(
        "app.services.currency_converter.cbi_rates.get_latest_rate_with_fallback",
        return_value={"rate": 1320.0, "rate_date": "2026-05-29", "source": "cbi"},
    ):
        r = convert(100, "USD", "IQD")
    assert r.converted == 132000  # IQD has no decimals
    assert r.rate == 1320.0
    assert r.source == "cbi"


def test_converter_iqd_to_usd_uses_inverse_rate():
    from app.services.currency_converter import convert
    with patch(
        "app.services.currency_converter.cbi_rates.get_latest_rate_with_fallback",
        return_value={"rate": 1320.0, "rate_date": "2026-05-29", "source": "cbi"},
    ):
        r = convert(132000, "IQD", "USD")
    assert r.converted == pytest.approx(100.0, abs=0.01)


def test_converter_raises_for_unsupported_pair():
    from app.services.currency_converter import convert, UnsupportedConversion
    with pytest.raises(UnsupportedConversion):
        convert(100, "EUR", "IQD")


# ─────────────────────────────────────────────────────────────────────────
# Refresh cron entrypoint
# ─────────────────────────────────────────────────────────────────────────


def test_refresh_persists_fetched_rate(monkeypatch):
    stored = {}

    def fake_store(on_date, rate, source="cbi", metadata=None):
        stored.update({"date": on_date, "rate": rate, "source": source})
        return {"rate_date": on_date.isoformat(), "rate": rate, "source": source}

    monkeypatch.setattr(cbi_rates, "store_rate", fake_store)
    monkeypatch.setattr(cbi_rates, "fetch_cbi_usd_iqd_rate", lambda: 1320.0)
    out = cbi_rates.refresh_today_rate()
    assert out["source"] == "cbi"
    assert stored["rate"] == 1320.0


def test_refresh_uses_yesterday_when_fetch_fails(monkeypatch):
    stored = {}

    def fake_store(on_date, rate, source="cbi", metadata=None):
        stored.update({"on_date": on_date, "rate": rate, "source": source})
        return {"rate_date": on_date.isoformat(), "rate": rate, "source": source}

    yesterday = {"rate": 1318.0, "rate_date": (date.today() - timedelta(days=1)).isoformat()}
    monkeypatch.setattr(cbi_rates, "store_rate", fake_store)
    monkeypatch.setattr(cbi_rates, "fetch_cbi_usd_iqd_rate", lambda: None)
    monkeypatch.setattr(cbi_rates, "get_rate", lambda d: yesterday)
    out = cbi_rates.refresh_today_rate()
    assert out["source"] == "fallback"
    assert stored["rate"] == 1318.0
