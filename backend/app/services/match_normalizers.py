"""Normalize PO/GRN/bill documents for ThreeWayMatchService."""
from __future__ import annotations


def _line_id(line: dict) -> str | None:
    return line.get("po_line_id") or line.get("id") or line.get("item_id")


def normalize_po_for_match(po: dict) -> dict:
    lines = []
    for ln in po.get("lines") or []:
        lid = _line_id(ln)
        if not lid:
            continue
        lines.append({
            "po_line_id": lid,
            "item_id": ln.get("item_id"),
            "qty_ordered": float(ln.get("qty_ordered") or ln.get("qty") or ln.get("quantity") or 0),
            "unit_price": float(ln.get("unit_price") or ln.get("rate") or 0),
        })
    return {"id": po.get("id"), "lines": lines}


def normalize_receipts_for_match(receipts: list[dict]) -> list[dict]:
    out = []
    for gr in receipts or []:
        gr_lines = []
        for ln in gr.get("lines") or []:
            lid = _line_id(ln)
            if not lid:
                continue
            gr_lines.append({
                "po_line_id": lid,
                "item_id": ln.get("item_id"),
                "qty_received": float(ln.get("qty_received") or ln.get("qty") or 0),
                "unit_cost": float(ln.get("unit_cost") or ln.get("unit_price") or ln.get("rate") or 0),
            })
        out.append({"id": gr.get("id"), "lines": gr_lines})
    return out


def normalize_bill_for_match(bill: dict, lines: list[dict] | None = None) -> dict:
    bill_lines = lines if lines is not None else (bill.get("lines") or [])
    normalized = []
    for ln in bill_lines:
        lid = _line_id(ln)
        if not lid:
            continue
        normalized.append({
            "po_line_id": lid,
            "item_id": ln.get("item_id"),
            "qty_billed": float(ln.get("qty_billed") or ln.get("qty") or ln.get("quantity") or 0),
            "unit_price": float(ln.get("unit_price") or ln.get("rate") or 0),
        })
    return {"id": bill.get("id"), "lines": normalized}
