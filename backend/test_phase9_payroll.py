"""Smoke test for Phase 9 Payroll Service."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase
from app.services.payroll import (
    PayrollService, DEFAULT_TAX_BRACKETS, DEFAULT_PERSONAL_EXEMPTION_ANNUAL,
)

init_firebase()
results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


def t1_overtime():
    print("\nT1 - overtime calc")
    ot = PayrollService.compute_overtime(10, 5000, 1.5)
    _assert("10h * 5000 * 1.5 = 75000", ot == 75000.0, str(ot))
    _assert("zero hours = 0", PayrollService.compute_overtime(0, 5000) == 0.0)


def t2_gross_basic():
    print("\nT2 - gross with allowances + OT + bonus")
    g = PayrollService.compute_gross(
        base_salary=1_000_000,
        allowances=[{"name": "transport", "amount": 100_000},
                    {"name": "housing", "amount": 200_000}],
        overtime_pay=75_000,
        bonus=50_000,
    )
    _assert("allowances_total 300k", g["allowances_total"] == 300_000.0)
    _assert("gross == 1,425,000", g["gross"] == 1_425_000.0, str(g["gross"]))


def t3_tax_zero_when_under_exemption():
    """Annual taxable < exemption => 0 tax."""
    print("\nT3 - tax = 0 when annual income < exemption")
    t = PayrollService.compute_income_tax(annual_taxable=2_000_000)
    _assert("annual_tax 0", t["annual_tax"] == 0.0)
    _assert("monthly_tax 0", t["monthly_tax"] == 0.0)


def t4_tax_first_bracket_only():
    """Annual gross 5M; exemption 2.5M; taxable 2.5M; all in first 3M bracket @3% = 75k."""
    print("\nT4 - tax: 5M annual stays in first bracket")
    t = PayrollService.compute_income_tax(annual_taxable=5_000_000)
    _assert("annual_tax = 75000", abs(t["annual_tax"] - 75_000.0) < 0.01,
            str(t["annual_tax"]))


def t5_tax_multi_bracket():
    """Annual 12M; exemption 2.5M => taxable 9.5M.
    Bracket 1 (0-3M @3%) = 90k
    Bracket 2 (3-8M @5%) = 250k
    Bracket 3 (8-15M @10%) = 1.5M * 10% = 150k
    Total = 490k"""
    print("\nT5 - tax: 12M annual crosses 3 brackets")
    t = PayrollService.compute_income_tax(annual_taxable=12_000_000)
    _assert("annual_tax = 490000", abs(t["annual_tax"] - 490_000.0) < 0.01,
            str(t["annual_tax"]))
    _assert("3 bands used", len(t["breakdown"]) == 3, str(t["breakdown"]))


def t6_payslip_full():
    """Base 1M + 300k allowances = 1.3M gross.
    EE SS 5% = 65k. Employer SS 12% = 156k.
    Annualised taxable = (1.3M - 65k)*12 = 14.82M; minus exemption 2.5M = 12.32M
    B1 (3M@3%)=90k, B2 (5M@5%)=250k, B3 (4.32M@10%)=432k => annual_tax 772k => monthly 64,333.33
    Net = 1.3M - 65k - 64,333 = 1,170,667 (approx)"""
    print("\nT6 - full payslip computation")
    p = PayrollService.compute_payslip(
        base_salary=1_000_000,
        allowances=[{"name": "transport", "amount": 100_000},
                    {"name": "housing", "amount": 200_000}],
    )
    _assert("gross 1,300,000", p["gross_breakdown"]["gross"] == 1_300_000.0)
    _assert("EE SS 65,000", p["deductions"]["employee_social_security"] == 65_000.0)
    _assert("ER SS 156,000", p["employer_costs"]["employer_social_security"] == 156_000.0)
    _assert("monthly tax = 64,333.33",
            abs(p["deductions"]["income_tax"] - 64_333.33) < 1.0,
            str(p["deductions"]["income_tax"]))
    expected_net = 1_300_000 - 65_000 - p["deductions"]["income_tax"]
    _assert("net_pay matches",
            abs(p["net_pay"] - expected_net) < 1.0,
            f"net={p['net_pay']} expected={expected_net}")
    _assert("total employer cost = gross + ER SS",
            p["total_employer_cost"] == 1_300_000.0 + 156_000.0)


def t7_payslip_with_loan_and_other_deductions():
    print("\nT7 - payslip with loan repayment + other deductions")
    p = PayrollService.compute_payslip(
        base_salary=2_000_000,
        loan_repayment=100_000,
        other_deductions=[{"name": "uniform", "amount": 25_000}],
    )
    _assert("loan in deductions", p["deductions"]["loan_repayment"] == 100_000.0)
    _assert("other_deductions_total 25k",
            p["deductions"]["other_deductions_total"] == 25_000.0)
    # Total deductions = EE SS (100k) + tax + 25k + 100k
    expected_total = 100_000 + p["deductions"]["income_tax"] + 25_000 + 100_000
    _assert("total deductions match",
            abs(p["deductions"]["total"] - expected_total) < 1.0)


def t8_payslip_with_overtime():
    print("\nT8 - payslip with overtime hours")
    p = PayrollService.compute_payslip(
        base_salary=1_000_000,
        overtime_hours=10,
        hourly_rate=5_000,
    )
    _assert("OT pay 75,000", p["gross_breakdown"]["overtime_pay"] == 75_000.0)
    _assert("gross 1,075,000", p["gross_breakdown"]["gross"] == 1_075_000.0)


def t9_zero_salary():
    print("\nT9 - zero salary => zero everything")
    p = PayrollService.compute_payslip(base_salary=0)
    _assert("gross 0", p["gross_breakdown"]["gross"] == 0.0)
    _assert("net 0", p["net_pay"] == 0.0)
    _assert("ER SS 0", p["employer_costs"]["employer_social_security"] == 0.0)


def t10_high_salary_top_bracket():
    """Annual 30M; exemption 2.5M; taxable 27.5M.
    B1=90k, B2=250k, B3=700k (7M*10%), B4=12.5M*15%=1,875k => annual=2,915k"""
    print("\nT10 - high salary hits top bracket")
    t = PayrollService.compute_income_tax(annual_taxable=30_000_000)
    _assert("annual_tax = 2,915,000",
            abs(t["annual_tax"] - 2_915_000.0) < 0.01,
            str(t["annual_tax"]))


def main():
    print("=" * 70)
    print("PHASE 9 SMOKE TEST - Payroll Service (Iraq)")
    print("=" * 70)
    t1_overtime()
    t2_gross_basic()
    t3_tax_zero_when_under_exemption()
    t4_tax_first_bracket_only()
    t5_tax_multi_bracket()
    t6_payslip_full()
    t7_payslip_with_loan_and_other_deductions()
    t8_payslip_with_overtime()
    t9_zero_salary()
    t10_high_salary_top_bracket()

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
