from app.services.reconciliation import compute_stock_drift


def test_opening_stock_fixes_false_drift():
    item = {"id": "x", "is_trackable": True, "stock_on_hand": 99, "opening_stock": 100}
    assert compute_stock_drift(item, [-1.0]) is None
