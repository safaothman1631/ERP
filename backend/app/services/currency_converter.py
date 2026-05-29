"""Multi-currency conversion using CBI rates (growth-to-100 § R4.15).

Today: IQD ↔ USD via the persisted CBI rate. Tomorrow: EUR / GBP / TRY for
Iraqi imports (the value-object below already carries the metadata fields).

Rates are looked up via :py:mod:`app.services.cbi_rates`. Cross-rates (e.g.
EUR→IQD) need a future ECB-or-similar pipeline; the converter raises
``UnsupportedConversion`` until that lands so business logic fails loudly
rather than silently using a wrong number.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

from app.services import cbi_rates


class UnsupportedConversion(Exception):
    """Raised when no rate source is available for the requested pair."""


@dataclass
class ConversionResult:
    amount: float            # input amount
    converted: float         # result amount
    rate: float              # the multiplier used
    from_currency: str
    to_currency: str
    rate_date: str
    source: str              # "cbi" | "fallback" | "hardcoded_fallback" | "identity"
    fallback_age_days: int = 0


def _round_money(value: float, currency: str) -> float:
    if currency.upper() == "IQD":
        return round(value, 0)
    return round(value + 1e-9, 2)


def convert(
    amount: float,
    from_currency: str,
    to_currency: str,
    on_date: Optional[date] = None,
) -> ConversionResult:
    """Convert ``amount`` from one currency to another using the daily CBI rate.

    Same-currency conversions short-circuit with ``source="identity"``.
    """
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    if from_currency == to_currency:
        return ConversionResult(
            amount=float(amount),
            converted=_round_money(float(amount), to_currency),
            rate=1.0,
            from_currency=from_currency,
            to_currency=to_currency,
            rate_date=(on_date or date.today()).isoformat(),
            source="identity",
        )

    # Currently only USD↔IQD is wired. Other pairs require additional rate
    # sources (ECB, etc.) — not configured until R7.6 brings them online.
    pair = (from_currency, to_currency)
    if pair not in {("USD", "IQD"), ("IQD", "USD")}:
        raise UnsupportedConversion(
            f"No rate source configured for {from_currency}->{to_currency}. "
            "EUR/GBP/TRY pending R7.6."
        )

    doc = cbi_rates.get_latest_rate_with_fallback(on_date)
    iqd_per_usd = float(doc["rate"])

    if pair == ("USD", "IQD"):
        converted = float(amount) * iqd_per_usd
        rate = iqd_per_usd
    else:  # IQD → USD
        converted = float(amount) / iqd_per_usd if iqd_per_usd else 0.0
        rate = 1.0 / iqd_per_usd if iqd_per_usd else 0.0

    return ConversionResult(
        amount=float(amount),
        converted=_round_money(converted, to_currency),
        rate=rate,
        from_currency=from_currency,
        to_currency=to_currency,
        rate_date=doc.get("rate_date", (on_date or date.today()).isoformat()),
        source=doc.get("source", "cbi"),
        fallback_age_days=int(doc.get("fallback_age_days", 0) or 0),
    )
