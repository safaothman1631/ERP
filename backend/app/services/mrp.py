"""MRP / BOM Service - Phase 8 Manufacturing

Provides:
- explode_bom(item_id, qty, depth_limit): recursive BOM explosion to raw materials
- compute_requirements(orders): aggregate raw material need across multiple orders
- check_availability(requirements): compare against on-hand stock + open POs
- suggest_purchase_orders(shortages): build PO suggestions per supplier

BOM document shape (collection `boms`):
  {
    org_id, parent_item_id, version, is_active,
    components: [
      {component_item_id, qty_per_parent, scrap_pct (0..1), unit, optional},
    ],
  }

Work Order document shape (collection `work_orders`):
  {
    org_id, bom_id, parent_item_id, qty_to_produce,
    status: "draft|in_progress|done|cancelled",
    consumed_lines: [{item_id, qty}], produced_qty,
    created_at, started_at, completed_at,
  }

Phase 8 ships pure-function explosion + requirements engine.
DB integration (work order CRUD, MRP run posting) is API layer.
"""
from typing import Optional


MAX_BOM_DEPTH = 10  # safety against circular BOMs


class BOMService:

    @staticmethod
    def explode_bom(
        bom_lookup: dict,
        parent_item_id: str,
        qty: float,
        depth: int = 0,
        depth_limit: int = MAX_BOM_DEPTH,
        visited: Optional[set] = None,
    ) -> list[dict]:
        """Recursively explode a BOM to raw materials (leaf items).

        Args:
          bom_lookup: {item_id: bom_dict} — caller pre-fetches all relevant BOMs.
                      An item NOT in the lookup is treated as a raw material (leaf).
          parent_item_id: top item to explode.
          qty: how many of parent to make.
          depth_limit: max recursion depth.
          visited: cycle-detection set (do not pass externally).

        Returns: flat list of {item_id, qty, depth, source_bom_id, is_raw}.
        Quantities INCLUDE scrap allowance and are aggregated across same items
        only at the top level via `compute_requirements`.
        """
        if visited is None:
            visited = set()
        if depth > depth_limit:
            raise ValueError(f"BOM depth limit exceeded at {parent_item_id}")
        if parent_item_id in visited:
            raise ValueError(f"Circular BOM detected at {parent_item_id}")
        visited = visited | {parent_item_id}

        bom = bom_lookup.get(parent_item_id)
        if not bom or not bom.get("is_active", True):
            # Treat as raw material
            return [{
                "item_id": parent_item_id,
                "qty": qty,
                "depth": depth,
                "source_bom_id": None,
                "is_raw": True,
            }]

        out = []
        for comp in bom.get("components", []) or []:
            cid = comp.get("component_item_id")
            if not cid:
                continue
            qty_per = float(comp.get("qty_per_parent", 0) or 0)
            scrap = float(comp.get("scrap_pct", 0) or 0)
            need = qty * qty_per * (1.0 + scrap)

            sub_bom = bom_lookup.get(cid)
            if sub_bom and sub_bom.get("is_active", True):
                # Recurse into sub-assembly
                out.extend(BOMService.explode_bom(
                    bom_lookup, cid, need, depth + 1, depth_limit, visited,
                ))
            else:
                out.append({
                    "item_id": cid,
                    "qty": round(need, 4),
                    "depth": depth + 1,
                    "source_bom_id": bom.get("id"),
                    "is_raw": True,
                })
        return out

    @staticmethod
    def compute_requirements(
        bom_lookup: dict,
        orders: list[dict],
    ) -> dict:
        """Aggregate raw-material requirements across multiple production orders.

        `orders`: [{item_id, qty}, ...]

        Returns: {
          "by_item": {item_id: total_qty_required},
          "raw_lines": [exploded_lines...],   # flattened
        }
        """
        all_lines = []
        for o in orders:
            lines = BOMService.explode_bom(
                bom_lookup, o["item_id"], float(o.get("qty", 0) or 0),
            )
            all_lines.extend(lines)

        by_item: dict[str, float] = {}
        for l in all_lines:
            by_item[l["item_id"]] = round(
                by_item.get(l["item_id"], 0.0) + l["qty"], 4
            )
        return {"by_item": by_item, "raw_lines": all_lines}

    @staticmethod
    def check_availability(
        requirements: dict,
        on_hand: dict,
        on_order: Optional[dict] = None,
    ) -> dict:
        """Compare aggregated requirements vs on-hand + on-order qty.

        Returns: {
          "shortages": [{item_id, required, on_hand, on_order, shortfall}],
          "ok_items": [{item_id, required, on_hand, on_order}],
          "fully_available": bool,
        }
        """
        on_order = on_order or {}
        shortages = []
        ok_items = []
        fully_available = True
        for item_id, required in requirements.get("by_item", {}).items():
            oh = float(on_hand.get(item_id, 0) or 0)
            oo = float(on_order.get(item_id, 0) or 0)
            available = oh + oo
            if available + 0.0001 < required:
                shortages.append({
                    "item_id": item_id,
                    "required": round(required, 4),
                    "on_hand": round(oh, 4),
                    "on_order": round(oo, 4),
                    "shortfall": round(required - available, 4),
                })
                fully_available = False
            else:
                ok_items.append({
                    "item_id": item_id,
                    "required": round(required, 4),
                    "on_hand": round(oh, 4),
                    "on_order": round(oo, 4),
                })
        return {
            "shortages": shortages,
            "ok_items": ok_items,
            "fully_available": fully_available,
        }

    @staticmethod
    def suggest_purchase_orders(
        shortages: list[dict],
        preferred_supplier: Optional[dict] = None,
    ) -> list[dict]:
        """Group shortages by preferred supplier into PO suggestions.

        `preferred_supplier`: {item_id: vendor_id}

        Returns: [{vendor_id, lines: [{item_id, qty}]}, ...]
        Items without a preferred supplier are grouped under vendor_id=None.
        """
        preferred_supplier = preferred_supplier or {}
        by_vendor: dict = {}
        for s in shortages:
            vid = preferred_supplier.get(s["item_id"])
            by_vendor.setdefault(vid, []).append({
                "item_id": s["item_id"],
                "qty": s["shortfall"],
            })
        return [{"vendor_id": v, "lines": lines} for v, lines in by_vendor.items()]
