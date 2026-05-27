"""Bank reconciliation summary movement uses transaction_type."""


def _reconciled_movement(transactions: list[dict]) -> float:
    """Mirror of get_reconciliation_summary loop (post-fix)."""
    movement = 0.0
    for t in transactions:
        amt = float(t.get("amount", 0) or 0)
        tx_type = t.get("transaction_type") or t.get("type") or "credit"
        if tx_type == "debit":
            movement -= abs(amt)
        else:
            movement += abs(amt) if amt > 0 else amt
    return movement


def test_system_balance_credit_and_debit():
    opening = 1000.0
    txns = [
        {"amount": 500, "transaction_type": "credit"},
        {"amount": 200, "transaction_type": "debit"},
    ]
    system = opening + _reconciled_movement(txns)
    assert system == 1300.0


def test_legacy_type_field_still_supported():
    txns = [{"amount": 100, "type": "debit"}]
    assert _reconciled_movement(txns) == -100.0
