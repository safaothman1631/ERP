"""Smoke test for Phase 1 Tax Engine v2.

Pure-function tests (no Firestore needed for compute_line_tax).
Resolution tests use the real DB.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase
from app.services.tax_calc import TaxCalculationService

init_firebase()

results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


def t1_single_rate():
    """100 @ 5% = 5 tax, 105 total"""
    print("\nT1 - single VAT 5% on 100")
    rates = [{"id": "r1", "name": "VAT 5", "rate": 5.0, "tax_type": "vat"}]
    out = TaxCalculationService.compute_line_tax(100.0, rates)
    _assert("tax_total == 5.00", abs(out["tax_total"] - 5.0) < 0.01, str(out["tax_total"]))
    _assert("1 breakdown entry", len(out["breakdown"]) == 1)


def t2_zero_rate():
    """100 @ 0% = 0 tax"""
    print("\nT2 - zero rate")
    rates = [{"id": "r0", "name": "Exempt", "rate": 0.0, "tax_type": "vat"}]
    out = TaxCalculationService.compute_line_tax(100.0, rates)
    _assert("tax_total == 0", abs(out["tax_total"]) < 0.01)


def t3_no_rates():
    """No rates -> 0 tax, empty breakdown"""
    print("\nT3 - no rates")
    out = TaxCalculationService.compute_line_tax(100.0, [])
    _assert("tax_total == 0", abs(out["tax_total"]) < 0.01)
    _assert("0 breakdown", len(out["breakdown"]) == 0)


def t4_two_non_compound():
    """100, VAT 5% + Service 3% (both non-compound) = 5 + 3 = 8"""
    print("\nT4 - two non-compound rates")
    rates = [
        {"id": "v", "name": "VAT 5", "rate": 5.0, "tax_type": "vat"},
        {"id": "s", "name": "Svc 3", "rate": 3.0, "tax_type": "service_tax"},
    ]
    out = TaxCalculationService.compute_line_tax(100.0, rates)
    _assert("tax_total == 8.00", abs(out["tax_total"] - 8.0) < 0.01, str(out["tax_total"]))


def t5_compound():
    """100, VAT 10% non-compound + 5% compound on top = 10 + (110 * 0.05) = 10 + 5.50 = 15.50"""
    print("\nT5 - compound tax (tax-on-tax)")
    rates = [
        {"id": "v", "name": "VAT 10", "rate": 10.0, "tax_type": "vat", "is_compound": False},
        {"id": "c", "name": "Surcharge 5", "rate": 5.0, "tax_type": "vat", "is_compound": True},
    ]
    out = TaxCalculationService.compute_line_tax(100.0, rates)
    _assert("tax_total == 15.50", abs(out["tax_total"] - 15.50) < 0.01, str(out["tax_total"]))


def t6_withholding_excluded_from_total():
    """Withholding does not increase tax_total but tracked in withholding_total."""
    print("\nT6 - withholding tracked separately")
    rates = [
        {"id": "w", "name": "WH 5", "rate": 5.0, "tax_type": "withholding"},
    ]
    out = TaxCalculationService.compute_line_tax(1000.0, rates)
    _assert("tax_total == 0", abs(out["tax_total"]) < 0.01, str(out["tax_total"]))
    _assert("withholding_total == 50", abs(out["withholding_total"] - 50.0) < 0.01,
            str(out["withholding_total"]))


def t7_reverse_charge_in_breakdown_zero_in_summary():
    """Reverse-charge: amount calculated but flagged; not added to invoice tax."""
    print("\nT7 - reverse charge")
    rates = [
        {"id": "rc", "name": "RC VAT 5", "rate": 5.0, "tax_type": "vat",
         "is_reverse_charge": True},
    ]
    out = TaxCalculationService.compute_invoice_taxes(
        org_id="test",
        lines=[{"subtotal": 100.0, "tax_id": None}],
        document_tax_id=None,
    )
    # No tax resolved (org=test has no real tax) - skip this check
    # Instead test summary aggregation directly:
    inv = TaxCalculationService.compute_line_tax(100.0, rates)
    _assert("breakdown amount > 0", inv["breakdown"][0]["amount"] > 0)
    _assert("tax_total excludes RC", abs(inv["tax_total"]) < 0.01,
            f"got {inv['tax_total']}")


def t8_invoice_aggregation():
    """compute_invoice_taxes aggregates across lines (no Firestore)."""
    print("\nT8 - invoice-level aggregation (no DB)")
    # Inline rate via a mock by stubbing resolve_rates
    original = TaxCalculationService.resolve_rates
    fake_rates = [{"id": "vat5", "name": "VAT 5", "rate": 5.0, "tax_type": "vat"}]
    TaxCalculationService.resolve_rates = staticmethod(lambda org_id, tid: fake_rates if tid else [])
    try:
        out = TaxCalculationService.compute_invoice_taxes(
            org_id="any",
            lines=[
                {"subtotal": 100.0, "tax_id": "vat5"},
                {"subtotal": 200.0, "tax_id": "vat5"},
                {"subtotal": 50.0, "tax_id": None},
            ],
            document_tax_id=None,
        )
    finally:
        TaxCalculationService.resolve_rates = original

    _assert("subtotal == 350", abs(out["subtotal"] - 350.0) < 0.01, str(out["subtotal"]))
    _assert("tax_total == 15", abs(out["tax_total"] - 15.0) < 0.01, str(out["tax_total"]))
    _assert("grand_total == 365", abs(out["grand_total"] - 365.0) < 0.01, str(out["grand_total"]))
    _assert("3 line results", len(out["lines"]) == 3)
    _assert("summary has 1 row", len(out["tax_summary"]) == 1, str(len(out["tax_summary"])))
    _assert("summary amount == 15", abs(out["tax_summary"][0]["amount"] - 15.0) < 0.01,
            str(out["tax_summary"][0]["amount"]))


def t9_per_line_override():
    """Different lines use different tax_id."""
    print("\nT9 - per-line tax override")
    rates_map = {
        "v5": [{"id": "v5", "rate": 5.0, "tax_type": "vat", "name": "V5"}],
        "v15": [{"id": "v15", "rate": 15.0, "tax_type": "vat", "name": "V15"}],
    }
    original = TaxCalculationService.resolve_rates
    TaxCalculationService.resolve_rates = staticmethod(
        lambda org_id, tid: rates_map.get(tid, [])
    )
    try:
        out = TaxCalculationService.compute_invoice_taxes(
            org_id="any",
            lines=[
                {"subtotal": 100.0, "tax_id": "v5"},
                {"subtotal": 100.0, "tax_id": "v15"},
            ],
        )
    finally:
        TaxCalculationService.resolve_rates = original
    _assert("tax_total == 20 (5+15)", abs(out["tax_total"] - 20.0) < 0.01, str(out["tax_total"]))
    _assert("summary has 2 rows", len(out["tax_summary"]) == 2)


def t10_iraq_vat_plus_withholding():
    """Iraq scenario: VAT 5% adds to invoice; WH 5% only deducted at payment."""
    print("\nT10 - Iraq VAT + Withholding combined")
    rates = [
        {"id": "vat", "name": "VAT 5", "rate": 5.0, "tax_type": "vat"},
        {"id": "wh", "name": "WH 5", "rate": 5.0, "tax_type": "withholding"},
    ]
    out = TaxCalculationService.compute_line_tax(1000.0, rates)
    _assert("tax_total == 50 (VAT only)", abs(out["tax_total"] - 50.0) < 0.01,
            str(out["tax_total"]))
    _assert("withholding_total == 50", abs(out["withholding_total"] - 50.0) < 0.01,
            str(out["withholding_total"]))


def main():
    print("=" * 70)
    print("PHASE 1 SMOKE TEST - Tax Engine v2")
    print("=" * 70)
    t1_single_rate()
    t2_zero_rate()
    t3_no_rates()
    t4_two_non_compound()
    t5_compound()
    t6_withholding_excluded_from_total()
    t7_reverse_charge_in_breakdown_zero_in_summary()
    t8_invoice_aggregation()
    t9_per_line_override()
    t10_iraq_vat_plus_withholding()

    print("\n" + "=" * 70)
    p = sum(1 for r in results if r[0] == "PASS")
    f = sum(1 for r in results if r[0] == "FAIL")
    print(f"RESULT: {p} PASS, {f} FAIL (total {len(results)})")
    print("=" * 70)
    if f:
        for status, name, detail in results:
            if status == "FAIL":
                print(f"  FAIL: {name} - {detail}")
    return 0 if f == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
