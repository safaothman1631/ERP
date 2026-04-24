"""Three-Way Match Service - Phase 5

For each vendor bill, validate that quantities and prices match the originating
Purchase Order and Goods Receipt(s). Configurable tolerances.

Inputs (data dicts; pure logic — fetched from repos in API layer):
- po: { id, lines: [{po_line_id, item_id, qty_ordered, unit_price}] }
- receipts: [{ id, lines: [{po_line_id, item_id, qty_received, unit_cost}] }, ...]
- bill: { id, lines: [{po_line_id, item_id, qty_billed, unit_price}] }

Returns:
{
  "match_status": "matched" | "partial" | "discrepancy",
  "discrepancies": [
    {"po_line_id": ..., "type": "qty_over_received" | "qty_over_ordered" | "price_variance" | "missing_receipt" | "extra_line", "detail": str, "severity": "warn" | "block"},
  ],
  "summary": {
    "po_total": float, "received_total": float, "billed_total": float,
    "lines_matched": int, "lines_total": int,
  }
}
"""
from typing import Optional

DEFAULT_QTY_TOLERANCE = 0.0001
DEFAULT_PRICE_TOLERANCE_PCT = 0.05  # 5%


class ThreeWayMatchService:

    @staticmethod
    def match(
        po: dict,
        receipts: list[dict],
        bill: dict,
        qty_tolerance: float = DEFAULT_QTY_TOLERANCE,
        price_tolerance_pct: float = DEFAULT_PRICE_TOLERANCE_PCT,
    ) -> dict:
        po_lines = {l.get("po_line_id"): l for l in po.get("lines", []) if l.get("po_line_id")}
        bill_lines = bill.get("lines", []) or []

        # Aggregate received qty per po_line_id
        received_by_pl = {}
        received_cost_by_pl = {}
        for gr in receipts or []:
            for ln in gr.get("lines", []) or []:
                pl = ln.get("po_line_id")
                if not pl:
                    continue
                qty = float(ln.get("qty_received", 0) or 0)
                received_by_pl[pl] = received_by_pl.get(pl, 0.0) + qty
                # Track weighted-average cost (used only for reporting)
                cost = float(ln.get("unit_cost", 0) or 0)
                received_cost_by_pl.setdefault(pl, []).append((qty, cost))

        discrepancies = []
        lines_matched = 0
        lines_total = max(len(po_lines), len(bill_lines))
        billed_pls = set()

        for bl in bill_lines:
            pl = bl.get("po_line_id")
            qty_billed = float(bl.get("qty_billed", 0) or 0)
            unit_price_bill = float(bl.get("unit_price", 0) or 0)

            if pl not in po_lines:
                discrepancies.append({
                    "po_line_id": pl,
                    "type": "extra_line",
                    "detail": f"Bill line references no PO line ({pl})",
                    "severity": "block",
                })
                continue

            billed_pls.add(pl)
            po_line = po_lines[pl]
            qty_ordered = float(po_line.get("qty_ordered", 0) or 0)
            unit_price_po = float(po_line.get("unit_price", 0) or 0)
            qty_received = received_by_pl.get(pl, 0.0)

            line_ok = True

            # Rule 1: cannot bill more than received
            if qty_billed > qty_received + qty_tolerance:
                discrepancies.append({
                    "po_line_id": pl,
                    "type": "qty_over_received",
                    "detail": f"Billed {qty_billed} but only {qty_received} received",
                    "severity": "block",
                })
                line_ok = False

            # Rule 2: cannot bill more than ordered (over-billing)
            if qty_billed > qty_ordered + qty_tolerance:
                discrepancies.append({
                    "po_line_id": pl,
                    "type": "qty_over_ordered",
                    "detail": f"Billed {qty_billed} exceeds ordered {qty_ordered}",
                    "severity": "block",
                })
                line_ok = False

            # Rule 3: price variance vs PO
            if unit_price_po > 0:
                pct = abs(unit_price_bill - unit_price_po) / unit_price_po
                if pct > price_tolerance_pct:
                    sev = "block" if pct > price_tolerance_pct * 2 else "warn"
                    discrepancies.append({
                        "po_line_id": pl,
                        "type": "price_variance",
                        "detail": (
                            f"Bill price {unit_price_bill} vs PO {unit_price_po} "
                            f"({pct*100:.1f}%)"
                        ),
                        "severity": sev,
                    })
                    if sev == "block":
                        line_ok = False
            elif unit_price_bill > 0:
                # PO had no price but bill does
                discrepancies.append({
                    "po_line_id": pl,
                    "type": "price_variance",
                    "detail": f"PO has no price but bill charged {unit_price_bill}",
                    "severity": "warn",
                })

            if line_ok:
                lines_matched += 1

        # Rule 4: PO lines that have receipts but no bill yet => "partial"
        # (not a discrepancy per se, but signals partial billing)
        unbilled_with_receipts = []
        for pl, qty_recv in received_by_pl.items():
            if pl not in billed_pls and qty_recv > qty_tolerance:
                unbilled_with_receipts.append(pl)

        # Determine status
        has_block = any(d["severity"] == "block" for d in discrepancies)
        if has_block:
            status = "discrepancy"
        elif discrepancies or unbilled_with_receipts:
            status = "partial"
        else:
            status = "matched"

        po_total = sum(
            float(l.get("qty_ordered", 0) or 0) * float(l.get("unit_price", 0) or 0)
            for l in po.get("lines", []) or []
        )
        billed_total = sum(
            float(l.get("qty_billed", 0) or 0) * float(l.get("unit_price", 0) or 0)
            for l in bill_lines
        )
        received_total = 0.0
        for pl, parts in received_cost_by_pl.items():
            for qty, cost in parts:
                received_total += qty * cost

        return {
            "match_status": status,
            "discrepancies": discrepancies,
            "unbilled_received_lines": unbilled_with_receipts,
            "summary": {
                "po_total": round(po_total, 2),
                "received_total": round(received_total, 2),
                "billed_total": round(billed_total, 2),
                "lines_matched": lines_matched,
                "lines_total": lines_total,
            },
        }

    @staticmethod
    def can_post_bill(match_result: dict) -> tuple[bool, Optional[str]]:
        """Decide if a bill is allowed to post given the match result.

        Returns (allowed, reason_if_blocked).
        """
        if match_result["match_status"] == "discrepancy":
            blocks = [d for d in match_result["discrepancies"] if d["severity"] == "block"]
            return False, "; ".join(d["detail"] for d in blocks)
        return True, None
