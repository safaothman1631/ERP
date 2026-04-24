from decimal import Decimal, ROUND_HALF_UP


def convert_amount(amount: float, exchange_rate: float) -> float:
    """Convert amount using exchange rate"""
    result = Decimal(str(amount)) * Decimal(str(exchange_rate))
    return float(result.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def format_currency(amount: float, symbol: str = "د.ع", decimal_places: int = 0) -> str:
    """Format amount with currency symbol"""
    if decimal_places == 0:
        formatted = f"{amount:,.0f}"
    else:
        formatted = f"{amount:,.{decimal_places}f}"
    return f"{formatted} {symbol}"
