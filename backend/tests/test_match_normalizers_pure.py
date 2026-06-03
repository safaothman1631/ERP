"""Pure-logic unit tests for PO/GRN/bill normalizers.

Targets ``app.services.match_normalizers`` — three zero-dependency functions
that coerce raw PO / receipt / bill dicts into the canonical shape consumed by
``ThreeWayMatchService``. Covers field-alias fallbacks, the line-id resolution
order, float coercion, and dropping lines that have no identifiable line id.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.match_normalizers import (
    normalize_bill_for_match,
    normalize_po_for_match,
    normalize_receipts_for_match,
)


# ─────────────────────────────────────────────────────────────────────────
# normalize_po_for_match
# ─────────────────────────────────────────────────────────────────────────


def test_po_canonical_fields():
    po = {"id": "PO1", "lines": [{"po_line_id": "L1", "item_id": "A", "qty_ordered": 5, "unit_price": 2.5}]}
    out = normalize_po_for_match(po)
    assert out == {
        "id": "PO1",
        "lines": [{"po_line_id": "L1", "item_id": "A", "qty_ordered": 5.0, "unit_price": 2.5}],
    }


def test_po_line_id_falls_back_to_id_then_item_id():
    # No po_line_id → use id.
    out = normalize_po_for_match({"id": "PO1", "lines": [{"id": "X", "item_id": "A"}]})
    assert out["lines"][0]["po_line_id"] == "X"
    # No po_line_id, no id → use item_id.
    out2 = normalize_po_for_match({"id": "PO1", "lines": [{"item_id": "ITM"}]})
    assert out2["lines"][0]["po_line_id"] == "ITM"


def test_po_qty_alias_quantity_and_qty():
    out = normalize_po_for_match({"id": "PO1", "lines": [{"po_line_id": "L1", "quantity": 7}]})
    assert out["lines"][0]["qty_ordered"] == 7.0
    out2 = normalize_po_for_match({"id": "PO1", "lines": [{"po_line_id": "L1", "qty": 3}]})
    assert out2["lines"][0]["qty_ordered"] == 3.0


def test_po_price_alias_rate():
    out = normalize_po_for_match({"id": "PO1", "lines": [{"po_line_id": "L1", "rate": 9}]})
    assert out["lines"][0]["unit_price"] == 9.0


def test_po_line_without_any_id_is_dropped():
    out = normalize_po_for_match({"id": "PO1", "lines": [{"qty_ordered": 5}, {"po_line_id": "L1"}]})
    assert len(out["lines"]) == 1
    assert out["lines"][0]["po_line_id"] == "L1"


def test_po_missing_lines_yields_empty():
    assert normalize_po_for_match({"id": "PO1"}) == {"id": "PO1", "lines": []}


def test_po_qty_and_price_default_zero():
    out = normalize_po_for_match({"id": "PO1", "lines": [{"po_line_id": "L1"}]})
    assert out["lines"][0]["qty_ordered"] == 0.0
    assert out["lines"][0]["unit_price"] == 0.0


# ─────────────────────────────────────────────────────────────────────────
# normalize_receipts_for_match
# ─────────────────────────────────────────────────────────────────────────


def test_receipts_canonical_fields():
    receipts = [{"id": "GR1", "lines": [{"po_line_id": "L1", "item_id": "A", "qty_received": 4, "unit_cost": 2}]}]
    out = normalize_receipts_for_match(receipts)
    assert out == [
        {"id": "GR1", "lines": [{"po_line_id": "L1", "item_id": "A", "qty_received": 4.0, "unit_cost": 2.0}]}
    ]


def test_receipts_qty_alias_qty():
    out = normalize_receipts_for_match([{"id": "GR1", "lines": [{"po_line_id": "L1", "qty": 6}]}])
    assert out[0]["lines"][0]["qty_received"] == 6.0


def test_receipts_cost_alias_unit_price_then_rate():
    out = normalize_receipts_for_match([{"id": "GR1", "lines": [{"po_line_id": "L1", "unit_price": 8}]}])
    assert out[0]["lines"][0]["unit_cost"] == 8.0
    out2 = normalize_receipts_for_match([{"id": "GR1", "lines": [{"po_line_id": "L1", "rate": 3}]}])
    assert out2[0]["lines"][0]["unit_cost"] == 3.0


def test_receipts_empty_list():
    assert normalize_receipts_for_match([]) == []


def test_receipts_line_without_id_dropped():
    out = normalize_receipts_for_match([{"id": "GR1", "lines": [{"qty_received": 1}]}])
    assert out[0]["lines"] == []


# ─────────────────────────────────────────────────────────────────────────
# normalize_bill_for_match
# ─────────────────────────────────────────────────────────────────────────


def test_bill_canonical_fields():
    bill = {"id": "B1", "lines": [{"po_line_id": "L1", "item_id": "A", "qty_billed": 5, "unit_price": 4}]}
    out = normalize_bill_for_match(bill)
    assert out == {
        "id": "B1",
        "lines": [{"po_line_id": "L1", "item_id": "A", "qty_billed": 5.0, "unit_price": 4.0}],
    }


def test_bill_explicit_lines_override_doc_lines():
    bill = {"id": "B1", "lines": [{"po_line_id": "DOC", "qty_billed": 1}]}
    explicit = [{"po_line_id": "OVR", "qty_billed": 9}]
    out = normalize_bill_for_match(bill, lines=explicit)
    assert len(out["lines"]) == 1
    assert out["lines"][0]["po_line_id"] == "OVR"
    assert out["lines"][0]["qty_billed"] == 9.0


def test_bill_qty_alias_quantity():
    out = normalize_bill_for_match({"id": "B1", "lines": [{"po_line_id": "L1", "quantity": 2}]})
    assert out["lines"][0]["qty_billed"] == 2.0


def test_bill_empty_explicit_lines_is_honored():
    # lines=[] is "not None" → use it (empty), not the doc's lines.
    bill = {"id": "B1", "lines": [{"po_line_id": "L1", "qty_billed": 5}]}
    out = normalize_bill_for_match(bill, lines=[])
    assert out["lines"] == []
