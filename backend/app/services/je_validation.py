"""Pure journal-entry validation helpers (no Firestore I/O)."""
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import HTTPException

# Rounding tolerance per currency (half-cent for IQD)
_TOLERANCE: dict[str, Decimal] = {
    "IQD": Decimal("0.005"),
    "USD": Decimal("0.01"),
    "EUR": Decimal("0.01"),
    "GBP": Decimal("0.01"),
}
_DEFAULT_TOLERANCE = Decimal("0.01")


def _to_decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(
            status_code=422,
            detail={"code": "je_invalid_amount", "message": f"Invalid amount: {value!r}"},
        )


def validate_je_balance(lines: list[dict], currency: str = "IQD") -> None:
    """Raise HTTPException(422) when journal lines fail double-entry rules."""
    if len(lines) < 2:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "je_min_lines",
                "message": "Journal entry must have at least 2 lines",
            },
        )

    tolerance = _TOLERANCE.get(currency.upper(), _DEFAULT_TOLERANCE)
    total_debit = Decimal("0")
    total_credit = Decimal("0")

    for idx, line in enumerate(lines):
        debit = _to_decimal(line.get("debit", 0))
        credit = _to_decimal(line.get("credit", 0))

        if debit < 0 or credit < 0:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "je_negative_amount",
                    "message": "Debit and credit must be non-negative",
                    "line_index": idx,
                },
            )

        if debit > 0 and credit > 0:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "je_both_sides",
                    "message": "Each line must be either debit or credit, not both",
                    "line_index": idx,
                },
            )

        total_debit += debit
        total_credit += credit

    diff = abs(total_debit - total_credit)
    if diff > tolerance:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "je_unbalanced",
                "message": "Journal entry unbalanced",
                "total_debit": float(total_debit),
                "total_credit": float(total_credit),
                "diff": float(diff),
            },
        )
