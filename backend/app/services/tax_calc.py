"""Tax Calculation Service - Phase 1 Tax Engine v2

Pure-function tax engine that handles:
- Single tax rates
- Compound taxes (tax-on-tax)
- Tax groups (multiple rates combined)
- Per-line tax override
- Reverse charge (no cash impact, only declaration)
- Withholding tax (applied at payment time)

All amounts use float; rounding to 2 decimals at the boundary only.
"""
from typing import Optional
from app.firestore.taxes import TaxRateRepository, TaxGroupRepository


def _round(value: float) -> float:
    """Round to 2 decimals, half away from zero (banker-safe)."""
    return round(value + 1e-9, 2) if value >= 0 else -round(-value + 1e-9, 2)


class TaxCalculationService:
    """Stateless tax calculator. Resolves rates lazily per call."""

    @staticmethod
    def resolve_rates(org_id: str, tax_id: Optional[str]) -> list[dict]:
        """Resolve a tax_id (rate or group) to a list of effective rate dicts.

        Returns list of {"id", "name", "rate", "is_compound", "tax_type",
        "is_reverse_charge"}.
        Empty list if tax_id is falsy.
        """
        if not tax_id:
            return []

        rate_repo = TaxRateRepository(org_id)
        group_repo = TaxGroupRepository(org_id)

        # Try as a group first
        group = group_repo.get(tax_id)
        if group and group.get("org_id") == org_id and group.get("tax_ids"):
            rates = []
            for rid in group["tax_ids"]:
                r = rate_repo.get(rid)
                if r and r.get("org_id") == org_id:
                    rates.append(r)
            return rates

        # Otherwise treat as a single rate
        rate = rate_repo.get(tax_id)
        if rate and rate.get("org_id") == org_id:
            return [rate]
        return []

    @staticmethod
    def compute_line_tax(
        line_subtotal: float,
        rates: list[dict],
    ) -> dict:
        """Compute tax for a single line given resolved rates.

        Compound rule (Odoo-style):
          - Non-compound rates apply to the original subtotal.
          - Compound rates apply to (subtotal + sum of preceding non-compound taxes).

        Returns: {
          "taxable": <subtotal>,
          "tax_total": <sum of all tax amounts>,
          "breakdown": [{"tax_id", "name", "rate", "amount", "tax_type",
                         "is_reverse_charge"}],
          "withholding_total": <sum of withholding amounts (informational)>,
        }
        """
        breakdown = []
        non_compound_total = 0.0
        withholding_total = 0.0

        # Pass 1: non-compound (operate on original subtotal)
        for r in rates:
            if r.get("is_compound"):
                continue
            rate_pct = float(r.get("rate", 0) or 0)
            tax_type = r.get("tax_type", "vat")
            is_reverse = bool(r.get("is_reverse_charge", False))
            amount = _round(line_subtotal * rate_pct / 100.0)

            if tax_type == "withholding":
                # Withholding does not add to invoice total; tracked separately
                withholding_total += amount
            elif is_reverse:
                # Reverse charge: declared but not collected from customer
                pass
            else:
                non_compound_total += amount

            breakdown.append({
                "tax_id": r.get("id"),
                "name": r.get("name") or r.get("name_ku") or "Tax",
                "rate": rate_pct,
                "amount": amount,
                "tax_type": tax_type,
                "is_reverse_charge": is_reverse,
            })

        # Pass 2: compound (operate on subtotal + non-compound)
        compound_base = line_subtotal + non_compound_total
        compound_total = 0.0
        for r in rates:
            if not r.get("is_compound"):
                continue
            rate_pct = float(r.get("rate", 0) or 0)
            tax_type = r.get("tax_type", "vat")
            is_reverse = bool(r.get("is_reverse_charge", False))
            amount = _round(compound_base * rate_pct / 100.0)

            if tax_type == "withholding":
                withholding_total += amount
            elif is_reverse:
                pass
            else:
                compound_total += amount

            breakdown.append({
                "tax_id": r.get("id"),
                "name": r.get("name") or r.get("name_ku") or "Tax",
                "rate": rate_pct,
                "amount": amount,
                "tax_type": tax_type,
                "is_reverse_charge": is_reverse,
            })

        return {
            "taxable": _round(line_subtotal),
            "tax_total": _round(non_compound_total + compound_total),
            "breakdown": breakdown,
            "withholding_total": _round(withholding_total),
        }

    @staticmethod
    def compute_invoice_taxes(
        org_id: str,
        lines: list[dict],
        document_tax_id: Optional[str] = None,
    ) -> dict:
        """Compute taxes for a full invoice/bill.

        Each line may carry its own `tax_id` (override). Otherwise the
        document-level `document_tax_id` applies.

        Each line dict must have: `subtotal` (float). Optional: `tax_id`.

        Returns: {
          "lines": [<line with computed tax fields>],
          "subtotal": <sum of line subtotals>,
          "tax_total": <sum of all line tax_total>,
          "withholding_total": <sum of withholding>,
          "grand_total": subtotal + tax_total,
          "tax_summary": [{"tax_id", "name", "rate", "amount", "tax_type"}]
                          (aggregated, reverse-charge excluded from amount),
        }
        """
        line_results = []
        subtotal_sum = 0.0
        tax_sum = 0.0
        withholding_sum = 0.0
        # Aggregate by tax_id for the summary table
        agg: dict = {}

        for line in lines:
            line_subtotal = float(line.get("subtotal", 0) or 0)
            tax_id = line.get("tax_id") or document_tax_id
            rates = TaxCalculationService.resolve_rates(org_id, tax_id)
            calc = TaxCalculationService.compute_line_tax(line_subtotal, rates)

            line_out = dict(line)
            line_out.update({
                "tax_total": calc["tax_total"],
                "tax_breakdown": calc["breakdown"],
                "withholding_total": calc["withholding_total"],
                "line_total": _round(line_subtotal + calc["tax_total"]),
            })
            line_results.append(line_out)

            subtotal_sum += line_subtotal
            tax_sum += calc["tax_total"]
            withholding_sum += calc["withholding_total"]

            for b in calc["breakdown"]:
                key = (b["tax_id"], b["rate"])
                if key not in agg:
                    agg[key] = {
                        "tax_id": b["tax_id"],
                        "name": b["name"],
                        "rate": b["rate"],
                        "tax_type": b["tax_type"],
                        "is_reverse_charge": b["is_reverse_charge"],
                        "amount": 0.0,
                    }
                # Reverse-charge taxes are declared but not collected — show 0 in summary
                if not b["is_reverse_charge"] and b["tax_type"] != "withholding":
                    agg[key]["amount"] += b["amount"]

        return {
            "lines": line_results,
            "subtotal": _round(subtotal_sum),
            "tax_total": _round(tax_sum),
            "withholding_total": _round(withholding_sum),
            "grand_total": _round(subtotal_sum + tax_sum),
            "tax_summary": [
                {**v, "amount": _round(v["amount"])} for v in agg.values()
            ],
        }
