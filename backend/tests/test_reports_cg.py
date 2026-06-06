"""Reports N+1 -> collection_group: date normalization + dispatcher routing.

The collection_group query itself is validated against the legacy method on real
Firestore (old == new) in the deploy runbook; here we lock down the pure logic:
date normalization (so line je_date matches the legacy header filter) and the
flag-gated dispatcher with its automatic fallback.
"""
from datetime import datetime
from unittest.mock import patch

from app.services.journal_entry_atomic import _normalize_je_date


def test_normalize_passthrough_naive_datetime():
    d = datetime(2026, 6, 1, 9, 30)
    assert _normalize_je_date(d) == d


def test_normalize_strips_tzinfo():
    from datetime import timezone

    d = datetime(2026, 6, 1, 9, 30, tzinfo=timezone.utc)
    out = _normalize_je_date(d)
    assert out.tzinfo is None and out == datetime(2026, 6, 1, 9, 30)


def test_normalize_date_only_string_is_midnight():
    assert _normalize_je_date("2026-06-01") == datetime(2026, 6, 1, 0, 0, 0)


def test_normalize_iso_with_space_and_z():
    assert _normalize_je_date("2026-06-01 13:45:00Z") == datetime(2026, 6, 1, 13, 45)


def test_normalize_unparseable_falls_back_to_now():
    out = _normalize_je_date("not-a-date")
    assert isinstance(out, datetime)  # falls back to utcnow(), never raises


def test_dispatcher_uses_legacy_when_flag_off():
    from app.services import report_queries as rq

    with patch.object(rq, "_journal_balances_legacy", return_value={"a": 1}) as legacy, \
         patch.object(rq, "journal_balances_cg") as cg:
        with patch("app.config.settings.REPORTS_USE_COLLECTION_GROUP", False, create=True):
            out = rq.journal_balances("org-1")
    assert out == {"a": 1}
    legacy.assert_called_once()
    cg.assert_not_called()


def test_dispatcher_uses_cg_when_flag_on():
    from app.services import report_queries as rq

    with patch.object(rq, "journal_balances_cg", return_value={"b": 2}) as cg, \
         patch.object(rq, "_journal_balances_legacy") as legacy:
        with patch("app.config.settings.REPORTS_USE_COLLECTION_GROUP", True, create=True):
            out = rq.journal_balances("org-1")
    assert out == {"b": 2}
    cg.assert_called_once()
    legacy.assert_not_called()


def test_dispatcher_falls_back_to_legacy_when_cg_raises():
    from app.services import report_queries as rq

    with patch.object(rq, "journal_balances_cg", side_effect=RuntimeError("no index")), \
         patch.object(rq, "_journal_balances_legacy", return_value={"c": 3}) as legacy:
        with patch("app.config.settings.REPORTS_USE_COLLECTION_GROUP", True, create=True):
            out = rq.journal_balances("org-1")
    assert out == {"c": 3}  # missing index can never break a report
    legacy.assert_called_once()
