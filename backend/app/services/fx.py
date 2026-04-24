"""FX (Foreign Exchange) Service - Phase 2 Multi-currency

Provides:
- get_rate(from, to, on_date): lookup the closest rate <= on_date
- convert(amount, from, to, on_date): apply rate
- compute_unrealized_gain_loss(): for open AR/AP balances in foreign currency
- build_revaluation_lines(): generate journal lines for period-end revaluation

Design choices:
- Rates are stored per-org (ExchangeRateRepository) with optional date.
- IQD is the assumed base currency (functional currency). Configurable later.
- No external API call here; integration with FX provider is a TODO via
  scheduler that POSTs to /api/system/exchange-rates.
"""
from datetime import datetime, date
from typing import Optional
from decimal import Decimal, ROUND_HALF_UP

from app.firestore.system import ExchangeRateRepository, SettingsRepository

BASE_CURRENCY_DEFAULT = "IQD"


def _to_dt(v) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return datetime(v.year, v.month, v.day)
    if isinstance(v, str):
        try:
            s = v.replace(" ", "T").rstrip("Z")
            if len(s) == 10:
                s += "T00:00:00"
            return datetime.fromisoformat(s)
        except Exception:
            return None
    return None


def _round(amount: float, decimals: int = 2) -> float:
    q = Decimal(10) ** -decimals
    return float(Decimal(str(amount)).quantize(q, rounding=ROUND_HALF_UP))


class FXService:
    """Stateless FX engine."""

    @staticmethod
    def get_base_currency(org_id: str) -> str:
        try:
            settings = SettingsRepository(org_id)
            v = settings.get_by_key("base_currency", category="general")
            return v or BASE_CURRENCY_DEFAULT
        except Exception:
            return BASE_CURRENCY_DEFAULT

    @staticmethod
    def get_rate(
        org_id: str,
        from_currency: str,
        to_currency: str,
        on_date: Optional[datetime] = None,
    ) -> float:
        """Return the rate to convert 1 unit `from_currency` -> `to_currency`.

        Lookup priority:
          1. Direct rate at exact <= on_date (pick latest)
          2. Inverse rate at exact <= on_date (1 / inverse)
          3. Triangulate via base currency
          4. 1.0 if from == to
          5. Raises ValueError if no rate available.
        """
        if from_currency == to_currency:
            return 1.0

        repo = ExchangeRateRepository(org_id)
        rates, _ = repo.list(limit=10000)

        on_dt = _to_dt(on_date) or datetime.utcnow()

        def _candidates(src, dst):
            out = []
            for r in rates:
                if r.get("from_currency") == src and r.get("to_currency") == dst:
                    rdate = _to_dt(r.get("date")) or datetime.min
                    if rdate <= on_dt:
                        out.append((rdate, float(r.get("rate", 0) or 0)))
            return sorted(out, key=lambda x: x[0], reverse=True)

        # 1. direct
        direct = _candidates(from_currency, to_currency)
        if direct and direct[0][1] > 0:
            return direct[0][1]

        # 2. inverse
        inverse = _candidates(to_currency, from_currency)
        if inverse and inverse[0][1] > 0:
            return 1.0 / inverse[0][1]

        # 3. triangulate via base
        base = FXService.get_base_currency(org_id)
        if base not in (from_currency, to_currency):
            try:
                r1 = FXService.get_rate(org_id, from_currency, base, on_dt)
                r2 = FXService.get_rate(org_id, base, to_currency, on_dt)
                return r1 * r2
            except ValueError:
                pass

        raise ValueError(
            f"No exchange rate from {from_currency} to {to_currency} on {on_dt.date()}"
        )

    @staticmethod
    def convert(
        org_id: str,
        amount: float,
        from_currency: str,
        to_currency: str,
        on_date: Optional[datetime] = None,
        decimals: int = 2,
    ) -> float:
        """Convert amount, rounding to `decimals` (default 2)."""
        if amount == 0:
            return 0.0
        rate = FXService.get_rate(org_id, from_currency, to_currency, on_date)
        return _round(amount * rate, decimals)

    @staticmethod
    def compute_unrealized_gain_loss(
        org_id: str,
        outstanding_balance_foreign: float,
        currency: str,
        original_rate_to_base: float,
        as_of: datetime,
    ) -> dict:
        """For an outstanding foreign-currency balance, compute the gain/loss
        if revalued at today's rate.

        Returns: {
          "balance_foreign": float,
          "currency": str,
          "original_rate": float,
          "current_rate": float,
          "original_value_base": float,
          "current_value_base": float,
          "unrealized_gain_loss": float (positive = gain, negative = loss),
        }
        """
        base = FXService.get_base_currency(org_id)
        if currency == base:
            # No FX exposure
            return {
                "balance_foreign": outstanding_balance_foreign,
                "currency": currency,
                "original_rate": 1.0,
                "current_rate": 1.0,
                "original_value_base": _round(outstanding_balance_foreign),
                "current_value_base": _round(outstanding_balance_foreign),
                "unrealized_gain_loss": 0.0,
            }

        current_rate = FXService.get_rate(org_id, currency, base, as_of)
        original_value = outstanding_balance_foreign * original_rate_to_base
        current_value = outstanding_balance_foreign * current_rate
        gain_loss = current_value - original_value

        return {
            "balance_foreign": outstanding_balance_foreign,
            "currency": currency,
            "original_rate": original_rate_to_base,
            "current_rate": current_rate,
            "original_value_base": _round(original_value),
            "current_value_base": _round(current_value),
            "unrealized_gain_loss": _round(gain_loss),
        }

    @staticmethod
    def build_revaluation_lines(
        gain_loss_amount: float,
        ar_or_ap_account_id: str,
        gain_account_id: str,
        loss_account_id: str,
        description: str = "FX revaluation",
    ) -> list[dict]:
        """Build journal lines to record an unrealized gain/loss.

        Convention:
          - Gain on AR (rate moved favourably for receivables):
              DR AR, CR Gain
          - Loss on AR:
              DR Loss, CR AR
        Same logic mirrors for AP (caller supplies AR or AP account id).

        If gain_loss_amount == 0, returns empty list.
        """
        if abs(gain_loss_amount) < 0.005:
            return []

        if gain_loss_amount > 0:
            return [
                {"account_id": ar_or_ap_account_id, "debit": _round(gain_loss_amount),
                 "credit": 0, "description": description},
                {"account_id": gain_account_id, "debit": 0,
                 "credit": _round(gain_loss_amount), "description": description},
            ]
        else:
            amount = _round(-gain_loss_amount)
            return [
                {"account_id": loss_account_id, "debit": amount,
                 "credit": 0, "description": description},
                {"account_id": ar_or_ap_account_id, "debit": 0,
                 "credit": amount, "description": description},
            ]
