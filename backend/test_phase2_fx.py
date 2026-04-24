"""Smoke test for Phase 2 FX Service.

Pure-function tests with monkey-patched repos to avoid Firestore writes.
"""
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase
from app.services.fx import FXService

init_firebase()

results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


# Helper to fake repo data
class _FakeRepo:
    def __init__(self, items):
        self._items = items
    def list(self, **kw):
        return list(self._items), len(self._items)


def _patch_rates(items):
    import app.services.fx as fx_mod
    original = fx_mod.ExchangeRateRepository
    fx_mod.ExchangeRateRepository = lambda org_id: _FakeRepo(items)
    return original


def _restore_rates(original):
    import app.services.fx as fx_mod
    fx_mod.ExchangeRateRepository = original


def _patch_base(currency):
    original = FXService.get_base_currency
    FXService.get_base_currency = staticmethod(lambda org_id: currency)
    return original


def t1_same_currency():
    print("\nT1 - same currency = 1.0")
    r = FXService.get_rate("o", "IQD", "IQD")
    _assert("rate == 1.0", r == 1.0, str(r))


def t2_direct_rate():
    print("\nT2 - direct rate lookup")
    orig_rates = _patch_rates([
        {"from_currency": "USD", "to_currency": "IQD", "rate": 1310.0,
         "date": "2026-01-01"},
    ])
    try:
        r = FXService.get_rate("o", "USD", "IQD", datetime(2026, 4, 1))
        _assert("USD->IQD == 1310", abs(r - 1310.0) < 0.01, str(r))
    finally:
        _restore_rates(orig_rates)


def t3_inverse_rate():
    print("\nT3 - inverse lookup")
    orig_rates = _patch_rates([
        {"from_currency": "USD", "to_currency": "IQD", "rate": 1310.0,
         "date": "2026-01-01"},
    ])
    try:
        r = FXService.get_rate("o", "IQD", "USD", datetime(2026, 4, 1))
        _assert("IQD->USD == 1/1310", abs(r - 1.0/1310.0) < 1e-6, str(r))
    finally:
        _restore_rates(orig_rates)


def t4_picks_latest_before_date():
    print("\nT4 - picks latest rate <= on_date")
    orig_rates = _patch_rates([
        {"from_currency": "USD", "to_currency": "IQD", "rate": 1300.0,
         "date": "2026-01-01"},
        {"from_currency": "USD", "to_currency": "IQD", "rate": 1310.0,
         "date": "2026-03-01"},
        {"from_currency": "USD", "to_currency": "IQD", "rate": 1320.0,
         "date": "2026-06-01"},
    ])
    try:
        r = FXService.get_rate("o", "USD", "IQD", datetime(2026, 4, 15))
        _assert("uses March rate (1310)", abs(r - 1310.0) < 0.01, str(r))
    finally:
        _restore_rates(orig_rates)


def t5_triangulate():
    print("\nT5 - triangulation via base IQD")
    orig_base = _patch_base("IQD")
    orig_rates = _patch_rates([
        {"from_currency": "USD", "to_currency": "IQD", "rate": 1310.0,
         "date": "2026-01-01"},
        {"from_currency": "EUR", "to_currency": "IQD", "rate": 1428.0,
         "date": "2026-01-01"},
    ])
    try:
        # USD -> EUR via IQD: USD->IQD=1310, IQD->EUR=1/1428, so 1310/1428 = ~0.9174
        r = FXService.get_rate("o", "USD", "EUR", datetime(2026, 4, 1))
        expected = 1310.0 / 1428.0
        _assert("USD->EUR triangulated", abs(r - expected) < 1e-4, f"got {r}, exp {expected}")
    finally:
        _restore_rates(orig_rates)
        FXService.get_base_currency = orig_base


def t6_no_rate_raises():
    print("\nT6 - no rate raises ValueError")
    orig_rates = _patch_rates([])
    orig_base = _patch_base("IQD")
    try:
        try:
            FXService.get_rate("o", "USD", "EUR", datetime(2026, 4, 1))
            _assert("raises ValueError", False, "no exception")
        except ValueError:
            _assert("raises ValueError", True)
    finally:
        _restore_rates(orig_rates)
        FXService.get_base_currency = orig_base


def t7_convert():
    print("\nT7 - convert 100 USD to IQD")
    orig_rates = _patch_rates([
        {"from_currency": "USD", "to_currency": "IQD", "rate": 1310.0,
         "date": "2026-01-01"},
    ])
    try:
        v = FXService.convert("o", 100.0, "USD", "IQD", datetime(2026, 4, 1), decimals=0)
        _assert("100 USD = 131000 IQD", abs(v - 131000.0) < 0.01, str(v))
    finally:
        _restore_rates(orig_rates)


def t8_unrealized_gain():
    """Customer owes 1000 USD, originally booked at 1300, current rate 1350.
    Gain = 1000 * (1350 - 1300) = 50,000 IQD"""
    print("\nT8 - unrealized gain (favourable rate move)")
    orig_base = _patch_base("IQD")
    orig_rates = _patch_rates([
        {"from_currency": "USD", "to_currency": "IQD", "rate": 1350.0,
         "date": "2026-04-01"},
    ])
    try:
        out = FXService.compute_unrealized_gain_loss(
            org_id="o",
            outstanding_balance_foreign=1000.0,
            currency="USD",
            original_rate_to_base=1300.0,
            as_of=datetime(2026, 4, 30),
        )
        _assert("gain == 50000", abs(out["unrealized_gain_loss"] - 50000.0) < 0.01,
                str(out["unrealized_gain_loss"]))
        _assert("current_rate == 1350", abs(out["current_rate"] - 1350.0) < 0.01)
    finally:
        _restore_rates(orig_rates)
        FXService.get_base_currency = orig_base


def t9_unrealized_loss():
    """Customer owes 1000 USD at 1300; rate drops to 1250. Loss = -50,000."""
    print("\nT9 - unrealized loss (unfavourable rate move)")
    orig_base = _patch_base("IQD")
    orig_rates = _patch_rates([
        {"from_currency": "USD", "to_currency": "IQD", "rate": 1250.0,
         "date": "2026-04-01"},
    ])
    try:
        out = FXService.compute_unrealized_gain_loss(
            org_id="o",
            outstanding_balance_foreign=1000.0,
            currency="USD",
            original_rate_to_base=1300.0,
            as_of=datetime(2026, 4, 30),
        )
        _assert("loss == -50000", abs(out["unrealized_gain_loss"] + 50000.0) < 0.01,
                str(out["unrealized_gain_loss"]))
    finally:
        _restore_rates(orig_rates)
        FXService.get_base_currency = orig_base


def t10_base_currency_no_exposure():
    """Balance in IQD when base is IQD => zero gain/loss."""
    print("\nT10 - base currency has no FX exposure")
    orig_base = _patch_base("IQD")
    try:
        out = FXService.compute_unrealized_gain_loss(
            org_id="o",
            outstanding_balance_foreign=1000.0,
            currency="IQD",
            original_rate_to_base=1.0,
            as_of=datetime(2026, 4, 30),
        )
        _assert("gain_loss == 0", abs(out["unrealized_gain_loss"]) < 0.01,
                str(out["unrealized_gain_loss"]))
    finally:
        FXService.get_base_currency = orig_base


def t11_revaluation_lines_gain_AR():
    """Gain on AR: DR AR, CR Gain account"""
    print("\nT11 - revaluation lines for AR gain")
    lines = FXService.build_revaluation_lines(
        gain_loss_amount=50000.0,
        ar_or_ap_account_id="ar-1",
        gain_account_id="gain-1",
        loss_account_id="loss-1",
    )
    _assert("2 lines", len(lines) == 2)
    _assert("AR debited 50000", lines[0]["account_id"] == "ar-1" and lines[0]["debit"] == 50000.0)
    _assert("Gain credited 50000", lines[1]["account_id"] == "gain-1" and lines[1]["credit"] == 50000.0)


def t12_revaluation_lines_loss_AR():
    """Loss on AR: DR Loss, CR AR"""
    print("\nT12 - revaluation lines for AR loss")
    lines = FXService.build_revaluation_lines(
        gain_loss_amount=-30000.0,
        ar_or_ap_account_id="ar-1",
        gain_account_id="gain-1",
        loss_account_id="loss-1",
    )
    _assert("2 lines", len(lines) == 2)
    _assert("Loss debited 30000", lines[0]["account_id"] == "loss-1" and lines[0]["debit"] == 30000.0)
    _assert("AR credited 30000", lines[1]["account_id"] == "ar-1" and lines[1]["credit"] == 30000.0)


def t13_revaluation_zero_returns_empty():
    print("\nT13 - zero gain/loss => no journal lines")
    lines = FXService.build_revaluation_lines(
        gain_loss_amount=0.0,
        ar_or_ap_account_id="ar-1",
        gain_account_id="gain-1",
        loss_account_id="loss-1",
    )
    _assert("0 lines", len(lines) == 0)


def main():
    print("=" * 70)
    print("PHASE 2 SMOKE TEST - FX Service (Multi-currency Revaluation)")
    print("=" * 70)
    t1_same_currency()
    t2_direct_rate()
    t3_inverse_rate()
    t4_picks_latest_before_date()
    t5_triangulate()
    t6_no_rate_raises()
    t7_convert()
    t8_unrealized_gain()
    t9_unrealized_loss()
    t10_base_currency_no_exposure()
    t11_revaluation_lines_gain_AR()
    t12_revaluation_lines_loss_AR()
    t13_revaluation_zero_returns_empty()

    print("\n" + "=" * 70)
    p = sum(1 for r in results if r[0] == "PASS")
    f = sum(1 for r in results if r[0] == "FAIL")
    print(f"RESULT: {p} PASS, {f} FAIL")
    print("=" * 70)
    if f:
        for s, n, d in results:
            if s == "FAIL":
                print(f"  FAIL: {n} - {d}")
    return 0 if f == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
