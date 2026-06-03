"""Iraqi Withholding Tax (WHT) calculator (growth-to-100 § R4.5).

WHT is deducted at source by the buyer (the payer) when paying a registered
business supplier. Iraqi practice in 2026 sets the following default rates:

    * Services (professional, consulting, IT, marketing) ... 3 %
    * Rent (commercial premises, equipment rental) ......... 5 %
    * Materials (sale of goods, contracted materials) ...... 2 %
    * Other (catch-all, configurable) ...................... 0 %

These rates are **placeholders** until verified by an Iraqi tax accountant
(R7.1). The registry below carries an ``placeholder: True`` flag so audits
can find every unverified rate in one query.

B2C (consumer-final) is **not** subject to WHT — the consumer is not a
withholding agent. The ``customer_type`` argument controls this:

    customer_type='b2b'      → WHT applies (if applicable_to_type matches)
    customer_type='b2c'      → WHT does not apply (returns zero)
    customer_type='b2g'      → WHT applies (government bodies always withhold)

This module is a **pure-function** calculator. All amounts are floats; the
single rounding step happens at the boundary (banker-safe ``_round`` from
``app.services.tax_calc``).
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Literal, Optional


# ─────────────────────────────────────────────────────────────────────────
# Types
# ─────────────────────────────────────────────────────────────────────────


class WithholdingType(str, Enum):
    """Recognised WHT categories in Iraqi practice."""

    SERVICES = "services"
    RENT = "rent"
    MATERIALS = "materials"
    OTHER = "other"


CustomerType = Literal["b2b", "b2c", "b2g"]


# ─────────────────────────────────────────────────────────────────────────
# Rate registry (placeholders pending R7.1 sign-off)
# ─────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class WHTRate:
    """One row in the Iraq WHT rate table.

    ``placeholder=True`` flags rows that need accountant sign-off before
    customer-facing production use (R7.1).
    """

    wht_type: WithholdingType
    rate_percent: float
    name_en: str
    name_ku: str
    name_ar: str
    applies_to_b2b: bool = True
    applies_to_b2g: bool = True
    applies_to_b2c: bool = False
    placeholder: bool = True
    effective_from: str = "2024-01-01"
    notes: str = ""


# Default Iraqi rates. ``placeholder=True`` for ALL entries — see R7.1.
DEFAULT_WHT_RATES: dict[WithholdingType, WHTRate] = {
    WithholdingType.SERVICES: WHTRate(
        wht_type=WithholdingType.SERVICES,
        rate_percent=3.0,
        name_en="WHT — Services",
        name_ku="باجی داشکاندن — خزمەتگوزاری",
        name_ar="ضريبة الاستقطاع — الخدمات",
        placeholder=True,
        notes="Professional services, consulting, IT, marketing. R7.1 verification pending.",
    ),
    WithholdingType.RENT: WHTRate(
        wht_type=WithholdingType.RENT,
        rate_percent=5.0,
        name_en="WHT — Rent",
        name_ku="باجی داشکاندن — کرێ",
        name_ar="ضريبة الاستقطاع — الإيجار",
        placeholder=True,
        notes="Commercial premises and equipment rental. R7.1 verification pending.",
    ),
    WithholdingType.MATERIALS: WHTRate(
        wht_type=WithholdingType.MATERIALS,
        rate_percent=2.0,
        name_en="WHT — Materials / Contracts",
        name_ku="باجی داشکاندن — کەرەستە/گرێبەست",
        name_ar="ضريبة الاستقطاع — المواد/العقود",
        placeholder=True,
        notes="Goods supply and contracted materials. R7.1 verification pending.",
    ),
    WithholdingType.OTHER: WHTRate(
        wht_type=WithholdingType.OTHER,
        rate_percent=0.0,
        name_en="WHT — Other",
        name_ku="باجی داشکاندن — هیتر",
        name_ar="ضريبة الاستقطاع — أخرى",
        placeholder=True,
        notes="Catch-all; rate set per tenant. R7.1 verification pending.",
    ),
}


def placeholder_rate_count() -> int:
    """Count of rates still flagged as placeholder pending R7.1."""
    return sum(1 for r in DEFAULT_WHT_RATES.values() if r.placeholder)


# ─────────────────────────────────────────────────────────────────────────
# Calculation
# ─────────────────────────────────────────────────────────────────────────


def _round(value: float) -> float:
    """Round to 2 decimals, half away from zero — matches ``tax_calc._round``.

    Deterministic Decimal quantize: replaces the float ``round(x + 1e-9, 2)``
    epsilon hack, which drifted non-deterministically at the sub-cent boundary
    and could fail audit reconciliation.
    """
    from decimal import Decimal, ROUND_HALF_UP
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


@dataclass
class WHTBreakdown:
    """The shape returned by :py:meth:`WHTCalculator.calculate`.

    All amounts are positive floats rounded to 2 decimals.

      * ``gross_amount`` — amount before withholding
      * ``wht_rate`` — the percentage applied (0–100)
      * ``wht_withheld`` — gross × rate ÷ 100 (the amount the buyer keeps)
      * ``net_payable`` — gross − wht_withheld (the amount the supplier receives)
      * ``applied`` — False when WHT was not applicable (B2C, zero rate, etc.)
      * ``reason`` — short human-readable reason (i18n keys via ``reason_key``)
    """

    gross_amount: float
    wht_rate: float
    wht_withheld: float
    net_payable: float
    wht_type: WithholdingType
    customer_type: CustomerType
    applied: bool
    reason: str = ""
    reason_key: str = ""
    placeholder_rate: bool = False
    rate_name_en: str = ""
    rate_name_ku: str = ""
    rate_name_ar: str = ""

    def to_dict(self) -> dict:
        out = asdict(self)
        out["wht_type"] = self.wht_type.value
        return out


class WHTCalculator:
    """Pure-function withholding-tax calculator for Iraqi invoicing."""

    def __init__(
        self,
        rates: Optional[dict[WithholdingType, WHTRate]] = None,
    ) -> None:
        # Allow tenant-level rate override. Default = bundled Iraqi defaults.
        self._rates = rates or DEFAULT_WHT_RATES

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def calculate(
        self,
        amount: float,
        wht_type: WithholdingType | str,
        customer_type: CustomerType = "b2b",
        *,
        is_business: Optional[bool] = None,
        override_rate_percent: Optional[float] = None,
    ) -> WHTBreakdown:
        """Compute withholding for one line item or one invoice total.

        Parameters
        ----------
        amount
            Gross amount (must be ≥ 0). Negative input is clamped to 0.
        wht_type
            ``WithholdingType`` or its string value (``"services"`` etc.).
        customer_type
            ``"b2b"``, ``"b2c"`` or ``"b2g"``. Default ``"b2b"``.
        is_business
            Legacy flag — when supplied overrides ``customer_type``. ``True``
            → ``"b2b"``, ``False`` → ``"b2c"``. The keyword exists because
            some integration code already carries the boolean.
        override_rate_percent
            Force a specific rate (e.g. tenant configured 4 % on services).
            ``None`` uses the rate from the registry.
        """
        if is_business is not None:
            customer_type = "b2b" if is_business else "b2c"

        if isinstance(wht_type, str):
            try:
                wht_type = WithholdingType(wht_type)
            except ValueError:
                wht_type = WithholdingType.OTHER

        rate_row = self._rates.get(wht_type, self._rates[WithholdingType.OTHER])
        rate_pct = (
            override_rate_percent
            if override_rate_percent is not None
            else rate_row.rate_percent
        )

        gross = max(0.0, float(amount or 0))

        # Zero/negative gross → nothing to withhold. Short-circuit so the
        # breakdown reads as "not applied" rather than "applied, 0 withheld".
        if gross <= 0:
            return WHTBreakdown(
                gross_amount=0.0,
                wht_rate=0.0,
                wht_withheld=0.0,
                net_payable=0.0,
                wht_type=wht_type,
                customer_type=customer_type,
                applied=False,
                reason=self._reason_text("zero_amount", customer_type),
                reason_key="zero_amount",
                placeholder_rate=rate_row.placeholder,
                rate_name_en=rate_row.name_en,
                rate_name_ku=rate_row.name_ku,
                rate_name_ar=rate_row.name_ar,
            )

        # Eligibility check — B2C is exempt by default (consumer-final).
        applicable = (
            (customer_type == "b2b" and rate_row.applies_to_b2b)
            or (customer_type == "b2g" and rate_row.applies_to_b2g)
            or (customer_type == "b2c" and rate_row.applies_to_b2c)
        )

        if not applicable or rate_pct <= 0:
            reason = (
                "b2c_exempt"
                if customer_type == "b2c"
                else ("zero_rate" if rate_pct <= 0 else "not_applicable")
            )
            return WHTBreakdown(
                gross_amount=_round(gross),
                wht_rate=0.0,
                wht_withheld=0.0,
                net_payable=_round(gross),
                wht_type=wht_type,
                customer_type=customer_type,
                applied=False,
                reason=self._reason_text(reason, customer_type),
                reason_key=reason,
                placeholder_rate=rate_row.placeholder,
                rate_name_en=rate_row.name_en,
                rate_name_ku=rate_row.name_ku,
                rate_name_ar=rate_row.name_ar,
            )

        withheld = _round(gross * rate_pct / 100.0)
        net = _round(gross - withheld)
        return WHTBreakdown(
            gross_amount=_round(gross),
            wht_rate=float(rate_pct),
            wht_withheld=withheld,
            net_payable=net,
            wht_type=wht_type,
            customer_type=customer_type,
            applied=True,
            reason=self._reason_text("applied", customer_type),
            reason_key="applied",
            placeholder_rate=rate_row.placeholder,
            rate_name_en=rate_row.name_en,
            rate_name_ku=rate_row.name_ku,
            rate_name_ar=rate_row.name_ar,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _reason_text(key: str, customer_type: CustomerType) -> str:
        """Short English reason string (UI uses ``reason_key`` for i18n)."""
        if key == "applied":
            return f"WHT applied — {customer_type.upper()} payer"
        if key == "b2c_exempt":
            return "B2C consumer — WHT not applicable"
        if key == "zero_rate":
            return "Configured rate is 0 % — no withholding"
        if key == "zero_amount":
            return "Zero gross amount — nothing to withhold"
        return "WHT not applicable for this combination"

    def get_rate(self, wht_type: WithholdingType | str) -> WHTRate:
        """Look up a configured rate row."""
        if isinstance(wht_type, str):
            try:
                wht_type = WithholdingType(wht_type)
            except ValueError:
                wht_type = WithholdingType.OTHER
        return self._rates.get(wht_type, self._rates[WithholdingType.OTHER])

    def all_rates(self) -> list[dict]:
        """Return every configured rate as a list of dicts (for the API)."""
        return [
            {
                "wht_type": r.wht_type.value,
                "rate_percent": r.rate_percent,
                "name_en": r.name_en,
                "name_ku": r.name_ku,
                "name_ar": r.name_ar,
                "applies_to_b2b": r.applies_to_b2b,
                "applies_to_b2g": r.applies_to_b2g,
                "applies_to_b2c": r.applies_to_b2c,
                "placeholder": r.placeholder,
                "effective_from": r.effective_from,
                "notes": r.notes,
            }
            for r in self._rates.values()
        ]


# Module-level default instance — what most callers want.
DEFAULT_CALCULATOR = WHTCalculator()
