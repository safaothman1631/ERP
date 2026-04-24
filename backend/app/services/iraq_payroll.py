"""Iraq-specific payroll computation helpers (FIX-64, FIX-65).

References:
- Iraq Social Security Law: employee share 5%, employer share 12% of basic salary.
- Iraq Income Tax (current personal income brackets, simplified annual basis):
    0  – 250,000 IQD/month → 0%
    250,001 – 500,000      → 3%
    500,001 – 1,000,000    → 5%
    1,000,001 – above      → 15%

These are used as default rule seeds and as a programmatic helper for
income-tax computation when the configured rules are not enough.
"""
from __future__ import annotations

from typing import Iterable


# Employee social security contribution (deducted from salary)
IRAQ_SS_EMPLOYEE_PERCENT = 5.0
# Employer contribution (informational; recorded as company cost, not in payslip net)
IRAQ_SS_EMPLOYER_PERCENT = 12.0

# Monthly income tax brackets (lower_inclusive, upper_inclusive, rate_percent)
IRAQ_INCOME_TAX_BRACKETS_MONTHLY: list[tuple[float, float, float]] = [
    (0.0, 250_000.0, 0.0),
    (250_000.01, 500_000.0, 3.0),
    (500_000.01, 1_000_000.0, 5.0),
    (1_000_000.01, float("inf"), 15.0),
]


def compute_iraq_income_tax_monthly(taxable_monthly: float) -> float:
    """Progressive income tax on monthly taxable amount in IQD."""
    if taxable_monthly <= 0:
        return 0.0
    tax = 0.0
    remaining = taxable_monthly
    last_top = 0.0
    for low, high, rate in IRAQ_INCOME_TAX_BRACKETS_MONTHLY:
        if taxable_monthly <= last_top:
            break
        bracket_width = max(0.0, min(taxable_monthly, high) - last_top)
        if bracket_width > 0 and rate > 0:
            tax += round(bracket_width * rate / 100.0, 2)
        last_top = high
        if taxable_monthly <= high:
            break
    return round(tax, 2)


def default_iraq_payroll_rules() -> list[dict]:
    """Seed rules to insert into a fresh org for Iraq payroll basics."""
    return [
        {
            "code": "SS_EMP",
            "name": "Social Security (Employee)",
            "type": "social_security",
            "amount_type": "percent",
            "amount": IRAQ_SS_EMPLOYEE_PERCENT,
            "apply_on": "basic",
            "active": True,
        },
        {
            "code": "IT",
            "name": "Income Tax",
            "type": "tax",
            "amount_type": "percent",
            "amount": 5.0,  # placeholder flat — runtime helper does true progressive
            "apply_on": "gross",
            "active": True,
        },
    ]


def compute_iraq_employer_ss(basic_salary: float) -> float:
    """Employer SS contribution (informational)."""
    return round(max(basic_salary, 0.0) * IRAQ_SS_EMPLOYER_PERCENT / 100.0, 2)
