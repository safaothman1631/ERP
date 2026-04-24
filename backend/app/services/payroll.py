"""Payroll Calculation Service - Phase 9 HR / Payroll

Calculates monthly payslip components per Iraqi labour law approximations.
Pure functions; storage/posting handled by API layer.

Key concepts:
- Gross = base_salary + sum(allowances) + overtime_pay
- Deductions = employee social_security + income_tax + other_deductions
- Net = Gross - Deductions
- Employer also pays employer_social_security (cost, not deducted from gross)

Iraq defaults (configurable per org):
- Employee social security: 5%
- Employer social security: 12%
- Income tax brackets (annual, IQD): see DEFAULT_TAX_BRACKETS
"""
from typing import Optional


# Iraq social security rates (configurable)
DEFAULT_EMPLOYEE_SS_RATE = 0.05   # 5%
DEFAULT_EMPLOYER_SS_RATE = 0.12   # 12%

# Annual income-tax brackets (IQD); Iraq simplified
DEFAULT_TAX_BRACKETS = [
    (3_000_000, 0.03),     # up to 3M IQD/year => 3%
    (8_000_000, 0.05),     # up to 8M
    (15_000_000, 0.10),    # up to 15M
    (float("inf"), 0.15),  # above => 15%
]
DEFAULT_PERSONAL_EXEMPTION_ANNUAL = 2_500_000  # IQD


def _round(amount: float, decimals: int = 2) -> float:
    if amount is None:
        return 0.0
    factor = 10 ** decimals
    # banker's rounding-friendly half-up
    return round(amount + 1e-9, decimals)


class PayrollService:

    @staticmethod
    def compute_overtime(
        overtime_hours: float,
        hourly_rate: float,
        multiplier: float = 1.5,
    ) -> float:
        if overtime_hours <= 0 or hourly_rate <= 0:
            return 0.0
        return _round(overtime_hours * hourly_rate * multiplier)

    @staticmethod
    def compute_gross(
        base_salary: float,
        allowances: Optional[list[dict]] = None,
        overtime_pay: float = 0.0,
        bonus: float = 0.0,
    ) -> dict:
        """Gross = base + sum(allowances) + overtime + bonus."""
        allow_total = sum(
            float(a.get("amount", 0) or 0)
            for a in (allowances or [])
        )
        gross = float(base_salary) + allow_total + float(overtime_pay) + float(bonus)
        return {
            "base_salary": _round(base_salary),
            "allowances_total": _round(allow_total),
            "overtime_pay": _round(overtime_pay),
            "bonus": _round(bonus),
            "gross": _round(gross),
        }

    @staticmethod
    def compute_income_tax(
        annual_taxable: float,
        brackets: Optional[list] = None,
        personal_exemption: float = DEFAULT_PERSONAL_EXEMPTION_ANNUAL,
    ) -> dict:
        """Progressive bracket tax. Returns annual + monthly amount.

        Brackets: list of (upper_bound_inclusive, rate). Last must be inf.
        """
        brackets = brackets or DEFAULT_TAX_BRACKETS
        taxable = max(annual_taxable - personal_exemption, 0.0)

        annual_tax = 0.0
        breakdown = []
        prev_upper = 0.0
        for upper, rate in brackets:
            if taxable <= 0:
                break
            band_amount = min(taxable, upper - prev_upper)
            if band_amount <= 0:
                prev_upper = upper
                continue
            tax_in_band = band_amount * rate
            annual_tax += tax_in_band
            breakdown.append({
                "from": prev_upper, "to": upper, "rate": rate,
                "band_amount": _round(band_amount),
                "tax": _round(tax_in_band),
            })
            taxable -= band_amount
            prev_upper = upper

        return {
            "annual_taxable": _round(annual_taxable),
            "personal_exemption": _round(personal_exemption),
            "annual_tax": _round(annual_tax),
            "monthly_tax": _round(annual_tax / 12.0),
            "breakdown": breakdown,
        }

    @staticmethod
    def compute_payslip(
        base_salary: float,
        allowances: Optional[list[dict]] = None,
        overtime_hours: float = 0.0,
        hourly_rate: float = 0.0,
        bonus: float = 0.0,
        other_deductions: Optional[list[dict]] = None,
        loan_repayment: float = 0.0,
        employee_ss_rate: float = DEFAULT_EMPLOYEE_SS_RATE,
        employer_ss_rate: float = DEFAULT_EMPLOYER_SS_RATE,
        tax_brackets: Optional[list] = None,
        personal_exemption: float = DEFAULT_PERSONAL_EXEMPTION_ANNUAL,
    ) -> dict:
        """Compute a full monthly payslip.

        Returns: {
          gross_breakdown, tax_breakdown, deductions, net_pay,
          employer_costs, total_employer_cost
        }
        """
        ot_pay = PayrollService.compute_overtime(overtime_hours, hourly_rate)
        gross_b = PayrollService.compute_gross(
            base_salary, allowances, ot_pay, bonus,
        )
        gross = gross_b["gross"]

        # Social security on gross
        ee_ss = _round(gross * employee_ss_rate)
        er_ss = _round(gross * employer_ss_rate)

        # Income tax: annualise gross MINUS employee SS (SS is pre-tax in many regimes)
        annualised_taxable = (gross - ee_ss) * 12.0
        tax_b = PayrollService.compute_income_tax(
            annualised_taxable, tax_brackets, personal_exemption,
        )

        other_ded_total = sum(
            float(d.get("amount", 0) or 0)
            for d in (other_deductions or [])
        )

        deductions_total = ee_ss + tax_b["monthly_tax"] + other_ded_total + float(loan_repayment)
        net = gross - deductions_total

        return {
            "gross_breakdown": gross_b,
            "tax_breakdown": tax_b,
            "deductions": {
                "employee_social_security": ee_ss,
                "income_tax": tax_b["monthly_tax"],
                "other_deductions_total": _round(other_ded_total),
                "loan_repayment": _round(loan_repayment),
                "total": _round(deductions_total),
            },
            "net_pay": _round(net),
            "employer_costs": {
                "employer_social_security": er_ss,
            },
            "total_employer_cost": _round(gross + er_ss),
        }
