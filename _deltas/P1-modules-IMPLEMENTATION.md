# P1 — MODULE-DEPTH Implementation Guide (WMS · TMS · Manufacturing Costing · Multi-Company Consolidation · Perpetual Valuation)

> **ستاتووس:** ئەمە **پلانێکی پێداچوونەوەکراوە (reviewed guide)** ـە — **جێبەجێ نەکراوە** و **commit نەکراوە**. هەموو بەشێک لەسەر بنەمای کۆدی ڕاستەقینەی ئەم ڕیپۆیە نووسراوە (Read tool، نەک bash mount). پێش merge **پێویستی بە تاقیکردنەوەی تەواوی pytest لەسەر Windows هەیە** (بڕوانە §6).
>
> **Scope guard:** هەموو زیادکراوەکان **additive** ـن — کۆلێکشنی نوێ، فیلدی نوێ، endpoint-ی نوێ، service-ی نوێ. هیچ schema-یەکی بەردەست ناشکێنرێت. هەموو نموونە کۆد بە شێوازی هەمان کۆدبەیس (FastAPI router + `BaseRepository` + atomic transaction services) نووسراون.

---

## 0. Grounding — ئەوەی هەیە بەرامبەر ئەوەی نییە (verified against real code)

ئەم خشتەیە لە خوێندنەوەی ڕاستەقینەی فایلەکان دروستکراوە. هەموو ڕێگەکان absolute (Windows).

| ناوچە | فایلی ڕاستەقینە | ئەوەی **هەیە** | ئەوەی **نییە** (P1 gap) |
|-------|-----------------|----------------|--------------------------|
| Warehouse / stock | `backend\app\api\inventory.py` (1055 ڕیز) | warehouses CRUD (`WarehouseRepository`)، `warehouse_stock` per (org, warehouse, item)، stock-moves draft→validate، pickings draft→confirm→done، transfers + approval، batches/lots، landed costs، serials | **بین/زۆن/شوێن لەناو کۆگا نییە** (تەنها `warehouse_id`)، putaway rules نییە، wave/zone picking نییە، dock/staging نییە، barcode hook لە backend نییە |
| Lot allocation | `backend\app\services\lot_allocation.py` | FIFO/LIFO/FEFO greedy allocate + `consume()` (batch decrement)، `unit_cost` لەسەر هەر lot | allocation **بەستراوەتەوە بە JE نییە**؛ COGS لە `unit_cost`ـی lot دەرناهێنرێت |
| Atomic moves | `backend\app\services\warehouse_move_atomic.py`, `grn_receive_atomic.py` | `validate_stock_move_atomic`، `done_picking_atomic`، `create_goods_receipt_atomic` (lot + item.stock_on_hand increment) | warehouse_stock تەنها `quantity/qty` ـی هەیە — **بەهای پارەیی (value) و avg-cost نییە لەسەر stock doc** |
| Manufacturing | `backend\app\api\manufacturing.py` (473 ڕیز)، `services\mo_complete_atomic.py`، `services\mrp.py` | BOM (components + byproducts + routing)، work-centers (`cost_per_hour`!)، MO + WO، `complete_manufacturing_order_atomic` (consume components, receive FG)، MRP explode/requirements | **costing روول-ئەپ نییە** — FG ـی تەواوبوو هیچ `cost_price`ـی پێ نادرێت؛ **هیچ WIP/manufacturing JE پۆست ناکرێت**؛ labor/overhead هەرگیز هەژمار ناکرێن (`cost_per_hour` بەکارنایەت) |
| TMS | `backend\app\api\shipments.py`, `logistics.py` | `shipments` (carrier, tracking_number, shipping_charge)، logistics scaffold: `log_shipments/routes/drivers/vehicles/gps/freight_rates/waybills` + `/track/{tn}` + events | **carrier selection نییە**، route optimization نییە، freight-rate **بەکارناهێنرێت بۆ نرخ** (تەنها CRUD)، last-mile/POD نییە، cost→GL نییە |
| Multi-company | `backend\app\api\companies.py`, `branches.py`، `firestore\companies.py` | companies CRUD + `is_primary` head، `/consolidated/pl` + `/consolidated/bs` (filter بە `company_id`)، `intercompany_journals` CRUD + `eliminate` (flag تەنها) | **per-entity ledger نییە** (هەموو JE لە یەک `journal_entries` بێ `company_id`)، **IC elimination هیچ JE دروست ناکات** ("no journal reversal yet" — ڕیز 215)، fiscal calendar per-entity نییە |
| Accounting (reuse) | `backend\app\services\accounting.py`، `services\journal_entry_atomic.py` | `AccountingService.create_journal_entry()` (balanced, period-lock check, atomic)، `create_journal_entry_in_transaction()` (بۆ بەکارهێنان لەناو tx-ی هەیە)، `_get_account_by_type()` | — (ئەمە بناغەیە بۆ هەموو JE-ی نوێ) |
| COGS-on-issue | `backend\app\api\invoices.py`، `services\pos_accounting.py` | POS: `create_invoice_journal` پۆست دەکات (revenue تەنها)، `post_session_sales_journal` | **invoice confirm (`status="sent"`, ڕیز 272) هیچ JE پۆست ناکات** و **COGS هەرگیز پۆست ناکرێت** لە هیچ فرۆشتنێک — ئەمە cross-link بۆ P0 |

**COA facts (verified `data\coa_templates\retail.yaml`):** account-ەکان بە `type:` (asset/expense/income/liability/equity) + `is_default_for:` (مثل `default_inventory` = `11400`, `default_cogs` = `51000`, `default_accounts_receivable` = `11300`) نیشانە دەکرێن. بەڵام `AccountingService._get_account_by_type()` بەدوای فیلدی **`account_type`** ـدا دەگەڕێت (`"cost_of_goods_sold"`, `"sales"`, `"inventory"`, `"accounts_receivable"`). ⚠️ **پێش پۆستکردنی هەر JE-ی نوێ، دڵنیابە لە مەپینگ** — یان `account_type` لەسەر account-ـەکان دانراوە لە کاتی seed، یان دەبێت helper-ێکی نوێ `_get_default_account(org_id, "default_inventory")` بەکاربهێنیت کە بەدوای `is_default_for` ـدا بگەڕێت. ئەم guide ـە helper-ی نوێ پێشنیار دەکات (§5.1) بۆ ئەوەی پشت بە مەپینگی نادیار نەبەستین.

**BaseRepository facts (verified `firestore\base.py`):** `create(data)` خۆکارانە `org_id`, `created_at`, `updated_at`, `_version=1`, `schema_version` زیاد دەکات؛ `id` لە payload وەردەگرێت یان uuid دروست دەکات. `org_id` لە payload **ڕەت دەکرێتەوە** ئەگەر جیاواز بێت. `increment(doc_id, field, value)` بەردەستە. atomic services لە `firestore` ـدا `fs.transactional` بەکاردەهێنن + `assert_org_doc()`.

---

## 1. WMS Depth — بین/زۆن/شوێن + putaway + wave/zone picking + dock/staging + barcode

### 1.1 داتا مۆدێل — چۆن لەسەر warehouse/lot ـی بەردەست layer دەبێت

ئەم نەخشەیە **`warehouse_id`ـی بەردەست ناشکێنێت** — `location_id` فیلدێکی **ئیختیاری** زیاد دەکرێت بۆ stock + moves. ئەگەر `location_id=None` بێت، هەڵسوکەوت وەک ئێستا دەمێنێتەوە (warehouse-level).

```
warehouses/{id}                         ← (هەیە) name, address, is_primary
  └── wh_zones/{id}                      ← NEW: zone (receiving/storage/picking/packing/shipping)
        warehouse_id, code, name, kind, sequence
  └── wh_locations/{id}                  ← NEW: bin/location (aisle-rack-shelf-bin)
        warehouse_id, zone_id, code, barcode, kind,
        is_pickable, is_receivable, max_qty, x, y, z (for path), is_active

warehouse_stock/{id}                     ← (هەیە) — زیادکردنی فیلدی NEW:
        org_id, warehouse_id, item_id, quantity, qty,
        location_id (NEW, nullable), lot_id (NEW, nullable),
        avg_cost (NEW — بڕوانە §5), value (NEW = quantity*avg_cost)

putaway_rules/{id}                       ← NEW
        org_id, warehouse_id, item_id|item_group_id|null (wildcard),
        dest_zone_id|dest_location_id, priority, strategy (fixed|nearest_empty|by_category)

wave_picks/{id}                          ← NEW (groups many pickings into a wave)
        org_id, warehouse_id, status (draft|released|in_progress|done),
        strategy (batch|zone|single), picking_ids: [], zone_id (for zone-wave),
        assigned_to, released_at, done_at
```

> **یاسای layering:** `warehouse_stock` ئێستا یەک doc-ە بۆ هەر (org, warehouse, item) — بڕوانە `_find_warehouse_stock_doc` لە `warehouse_move_atomic.py` ڕیز 20-38. کاتێک `location_id` زیاد دەکرێت، **uniqueness دەبێتە (org, warehouse, item, location, lot)**. بۆ ئەوەی موڤە بەردەستەکان نەشکێن، helper-ـی نوێ دروست بکە (location-aware) و كۆنەکە بەجێبهێڵە بۆ موڤی warehouse-level.

### 1.2 فایلی نوێ: `backend\app\firestore\wms.py`

```python
"""WMS repositories: zones, locations, putaway rules, wave picks."""
from app.firestore.base import BaseRepository


class ZoneRepository(BaseRepository):
    collection_name = "wh_zones"


class LocationRepository(BaseRepository):
    collection_name = "wh_locations"


class PutawayRuleRepository(BaseRepository):
    collection_name = "putaway_rules"


class WavePickRepository(BaseRepository):
    collection_name = "wave_picks"
```

### 1.3 فایلی نوێ: `backend\app\api\wms.py`

```python
"""WMS depth API: zones, bin locations, putaway, wave/zone picking."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.firestore.wms import (
    ZoneRepository, LocationRepository, PutawayRuleRepository, WavePickRepository,
)
from app.services.auth import get_current_user
from app.services.module_gate import require_module

router = APIRouter(
    prefix="/api/wms",
    tags=["WMS"],
    dependencies=[Depends(require_module("inventory"))],  # gate under inventory module
)


# ---------- Zones ----------
@router.get("/warehouses/{wh_id}/zones")
def list_zones(wh_id: str, user: dict = Depends(get_current_user)):
    items, total = ZoneRepository(user["org_id"]).list(
        filters=[{"field": "warehouse_id", "op": "==", "value": wh_id}], limit=500,
    )
    return {"items": items, "total": total}


@router.post("/warehouses/{wh_id}/zones", status_code=201)
def create_zone(wh_id: str, data: dict, user: dict = Depends(get_current_user)):
    return ZoneRepository(user["org_id"]).create({
        "id": str(uuid.uuid4()),
        "warehouse_id": wh_id,
        "code": data["code"],
        "name": data.get("name", data["code"]),
        "kind": data.get("kind", "storage"),  # receiving|storage|picking|packing|shipping
        "sequence": int(data.get("sequence", 0)),
    })


# ---------- Locations (bins) ----------
@router.get("/warehouses/{wh_id}/locations")
def list_locations(wh_id: str, zone_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    filters = [{"field": "warehouse_id", "op": "==", "value": wh_id}]
    if zone_id:
        filters.append({"field": "zone_id", "op": "==", "value": zone_id})
    items, total = LocationRepository(user["org_id"]).list(filters=filters, limit=2000)
    return {"items": items, "total": total}


@router.post("/warehouses/{wh_id}/locations", status_code=201)
def create_location(wh_id: str, data: dict, user: dict = Depends(get_current_user)):
    return LocationRepository(user["org_id"]).create({
        "id": str(uuid.uuid4()),
        "warehouse_id": wh_id,
        "zone_id": data.get("zone_id"),
        "code": data["code"],                       # e.g. "A-01-03-B"
        "barcode": data.get("barcode") or data["code"],
        "kind": data.get("kind", "bin"),            # bin|rack|dock|staging
        "is_pickable": bool(data.get("is_pickable", True)),
        "is_receivable": bool(data.get("is_receivable", True)),
        "max_qty": float(data.get("max_qty", 0) or 0),
        "x": float(data.get("x", 0) or 0),
        "y": float(data.get("y", 0) or 0),
        "z": float(data.get("z", 0) or 0),
        "is_active": True,
    })


@router.get("/locations/by-barcode/{barcode}")
def location_by_barcode(barcode: str, user: dict = Depends(get_current_user)):
    """Barcode/RFID scan hook — scan a bin label, get the location doc."""
    items, _ = LocationRepository(user["org_id"]).list(
        filters=[{"field": "barcode", "op": "==", "value": barcode}], limit=1,
    )
    if not items:
        raise HTTPException(404, "شوێن نەدۆزرایەوە بەو بارکۆدە")
    return items[0]


# ---------- Putaway rules + suggestion ----------
@router.get("/putaway-rules")
def list_putaway_rules(user: dict = Depends(get_current_user)):
    items, total = PutawayRuleRepository(user["org_id"]).list(order_by="priority", order_dir="ASCENDING", limit=500)
    return {"items": items, "total": total}


@router.post("/putaway-rules", status_code=201)
def create_putaway_rule(data: dict, user: dict = Depends(get_current_user)):
    return PutawayRuleRepository(user["org_id"]).create({
        "id": str(uuid.uuid4()),
        "warehouse_id": data["warehouse_id"],
        "item_id": data.get("item_id"),
        "item_group_id": data.get("item_group_id"),
        "dest_zone_id": data.get("dest_zone_id"),
        "dest_location_id": data.get("dest_location_id"),
        "strategy": data.get("strategy", "fixed"),  # fixed|nearest_empty|by_category
        "priority": int(data.get("priority", 100)),
    })


@router.post("/putaway/suggest")
def suggest_putaway(data: dict, user: dict = Depends(get_current_user)):
    """Given item_id + qty + warehouse, return the destination location per rules.

    Body: {warehouse_id, item_id, item_group_id?, qty}
    Used by the GRN/receiving screen to auto-fill where to put received stock.
    """
    from app.services.wms_putaway import suggest_putaway_location
    loc = suggest_putaway_location(
        user["org_id"],
        warehouse_id=data["warehouse_id"],
        item_id=data.get("item_id"),
        item_group_id=data.get("item_group_id"),
        qty=float(data.get("qty", 0) or 0),
    )
    return {"location": loc}


# ---------- Wave / batch / zone picking ----------
@router.post("/waves", status_code=201)
def create_wave(data: dict, user: dict = Depends(get_current_user)):
    """Group existing pickings into a wave. strategy = batch|zone|single."""
    return WavePickRepository(user["org_id"]).create({
        "id": str(uuid.uuid4()),
        "warehouse_id": data["warehouse_id"],
        "status": "draft",
        "strategy": data.get("strategy", "batch"),
        "zone_id": data.get("zone_id"),
        "picking_ids": data.get("picking_ids", []),
        "assigned_to": data.get("assigned_to"),
        "created_by_id": user["id"],
    })


@router.post("/waves/{wave_id}/release")
def release_wave(wave_id: str, user: dict = Depends(get_current_user)):
    """Release a wave → builds an optimized pick list across its pickings."""
    from app.services.wms_wave import build_wave_pick_list
    repo = WavePickRepository(user["org_id"])
    wave = repo.get(wave_id)
    if not wave or wave.get("org_id") != user["org_id"]:
        raise HTTPException(404, "wave not found")
    pick_list = build_wave_pick_list(user["org_id"], wave)
    repo.update(wave_id, {
        "status": "released",
        "pick_list": pick_list,
        "released_at": datetime.utcnow().isoformat(),
    })
    return {"wave_id": wave_id, "pick_list": pick_list, "line_count": len(pick_list)}


@router.get("/waves")
def list_waves(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = WavePickRepository(user["org_id"]).list(filters=filters or None, limit=500)
    return {"items": items, "total": total}
```

### 1.4 فایلی نوێ: `backend\app\services\wms_putaway.py`

```python
"""Putaway suggestion: pick destination location for received stock."""
from __future__ import annotations

from typing import Optional

from app.firestore.wms import PutawayRuleRepository, LocationRepository


def suggest_putaway_location(
    org_id: str,
    *,
    warehouse_id: str,
    item_id: Optional[str],
    item_group_id: Optional[str],
    qty: float,
) -> Optional[dict]:
    """Return the best destination location dict per putaway rules.

    Rule match order (lowest `priority` int wins):
      1. exact item_id rule
      2. item_group_id rule
      3. wildcard rule (no item, no group)
    Strategy:
      - fixed         → use rule.dest_location_id
      - nearest_empty → first receivable location in dest_zone with free capacity
      - by_category   → same as fixed but scoped to zone
    """
    rules, _ = PutawayRuleRepository(org_id).list(
        filters=[{"field": "warehouse_id", "op": "==", "value": warehouse_id}],
        order_by="priority", order_dir="ASCENDING", limit=500,
    )

    def _matches(r: dict) -> int:
        if item_id and r.get("item_id") == item_id:
            return 0
        if item_group_id and r.get("item_group_id") == item_group_id:
            return 1
        if not r.get("item_id") and not r.get("item_group_id"):
            return 2
        return 99

    candidates = sorted(
        [(p, r) for r in rules if (p := _matches(r)) < 99],
        key=lambda t: (t[0], int(t[1].get("priority", 100))),
    )
    if not candidates:
        return None

    rule = candidates[0][1]
    loc_repo = LocationRepository(org_id)

    if rule.get("strategy") == "fixed" and rule.get("dest_location_id"):
        return loc_repo.get(rule["dest_location_id"])

    zone_id = rule.get("dest_zone_id")
    if not zone_id:
        return loc_repo.get(rule["dest_location_id"]) if rule.get("dest_location_id") else None

    locs, _ = loc_repo.list(
        filters=[
            {"field": "warehouse_id", "op": "==", "value": warehouse_id},
            {"field": "zone_id", "op": "==", "value": zone_id},
            {"field": "is_receivable", "op": "==", "value": True},
        ],
        limit=2000,
    )
    # nearest_empty: prefer locations with spare capacity; fall back to first active
    for loc in locs:
        cap = float(loc.get("max_qty", 0) or 0)
        if cap <= 0 or cap >= qty:
            return loc
    return locs[0] if locs else None
```

### 1.5 فایلی نوێ: `backend\app\services\wms_wave.py`

```python
"""Wave pick-list builder: aggregate + sort lines for batch/zone picking."""
from __future__ import annotations

from app.firestore.inventory import StockMovementRepository
from app.firestore.wms import LocationRepository


def build_wave_pick_list(org_id: str, wave: dict) -> list[dict]:
    """Aggregate picking lines into one path-optimized pick list.

    - batch  → one consolidated list across all pickings, qty summed per (item, location)
    - zone   → only lines whose location falls in wave.zone_id
    - single → keep per-picking grouping (no merge)

    Sort key = (x, y, z) of the location for S-shape path traversal.
    """
    pk_repo = StockMovementRepository(org_id)
    loc_repo = LocationRepository(org_id)

    # location_id -> coords for sorting
    loc_cache: dict[str, dict] = {}

    def _coords(loc_id):
        if not loc_id:
            return (0.0, 0.0, 0.0)
        if loc_id not in loc_cache:
            loc_cache[loc_id] = loc_repo.get(loc_id) or {}
        l = loc_cache[loc_id]
        return (float(l.get("x", 0) or 0), float(l.get("y", 0) or 0), float(l.get("z", 0) or 0))

    strategy = wave.get("strategy", "batch")
    zone_id = wave.get("zone_id")

    agg: dict[tuple, dict] = {}
    for pid in wave.get("picking_ids") or []:
        pk = pk_repo.get(pid)
        if not pk or pk.get("type") != "picking":
            continue
        for line in pk.get("lines") or []:
            item_id = line.get("item_id")
            loc_id = line.get("location_id")
            qty = float(line.get("qty") or line.get("quantity") or 0)
            if not item_id or qty <= 0:
                continue
            if strategy == "zone" and zone_id:
                loc = loc_cache.get(loc_id) or (loc_repo.get(loc_id) if loc_id else {})
                if (loc or {}).get("zone_id") != zone_id:
                    continue
            key = (item_id, loc_id) if strategy != "single" else (pid, item_id, loc_id)
            row = agg.setdefault(key, {
                "item_id": item_id, "location_id": loc_id,
                "qty": 0.0, "picking_ids": [],
            })
            row["qty"] += qty
            if pid not in row["picking_ids"]:
                row["picking_ids"].append(pid)

    rows = list(agg.values())
    rows.sort(key=lambda r: _coords(r.get("location_id")))
    for i, r in enumerate(rows):
        r["sequence"] = i + 1
        r["qty"] = round(r["qty"], 3)
    return rows
```

### 1.6 Dock / staging + barcode/RFID
- **Dock/staging** = `wh_locations` بە `kind="dock"` یان `kind="staging"`. ناوچەی receiving (zone `kind="receiving"`) و shipping (zone `kind="shipping"`) لێرە دەبن. GRN ـی نوێ دەتوانێت stock بخاتە dock، دواتر putaway موڤی بکات بۆ storage (دوو موڤ بەکاربهێنە، هەردووکیان لە `warehouse_move_atomic` ـی location-aware §1.7).
- **Barcode/RFID hook (backend):** `GET /api/wms/locations/by-barcode/{barcode}` (§1.3) + `GET /api/inventory/serials?...` (هەیە). فرۆنتئیند پێشتر scanner-ی هاردوێری هەیە (`frontend/src/hardware/scanner/`، بڕوانە CLAUDE.md G3) — تەنها endpoint-ـی lookup-ی نوێ بەکاردەهێنرێت بۆ scan→resolve.

### 1.7 Location-aware atomic move (هەنگاوی پێویست)
`_find_warehouse_stock_doc` لە `warehouse_move_atomic.py` (ڕیز 20) تەنها (org, warehouse, item) دەگرێت. بۆ بین-لێڤڵ، helper-ـی نوێ زیاد بکە **لە هەمان فایل** (کۆنەکە مەگۆڕە):

```python
def _find_location_stock_doc(transaction, db, org_id, warehouse_id, item_id, location_id):
    q = (db.collection("warehouse_stock")
         .where("org_id", "==", org_id)
         .where("warehouse_id", "==", warehouse_id)
         .where("item_id", "==", item_id)
         .where("location_id", "==", location_id)
         .limit(1))
    docs = list(q.stream(transaction=transaction))
    if not docs:
        return None, None
    return docs[0].reference, docs[0].to_dict() or {}
```

> ئەمە composite index پێویستە (بڕوانە §6). کاتێک `location_id` لە move payload بوو، ئەم helper-ـە بەکاربهێنە؛ نا، helper-ی کۆن.

---

## 2. TMS — carrier selection · route optimization · freight/cost · last-mile · track & trace

> بناغە: `logistics.py` پێشتر `log_shipments/routes/drivers/vehicles/gps/freight_rates/waybills` + `/track/{tracking_number}` + `deliver` ـی هەیە (CRUD scaffold). P1 = **engine layer** لەسەری.

### 2.1 Carrier selection + freight rating (freight_rates ئێستا بەکاردێت)
فایلی نوێ: `backend\app\services\tms_rating.py`

```python
"""TMS: freight rating + carrier selection from log_freight_rates."""
from __future__ import annotations

from typing import Optional

from app.api.logistics import FreightRateRepo  # reuse existing repo class


def rate_shipment(
    org_id: str,
    *,
    origin_zone: str,
    destination_zone: str,
    weight_kg: float,
    carrier_id: Optional[str] = None,
) -> list[dict]:
    """Return matching freight quotes sorted cheapest-first.

    log_freight_rates doc shape (existing): {origin_zone, destination_zone,
    weight_min, weight_max, price, carrier_id?}. We add carrier_id usage.
    """
    rates, _ = FreightRateRepo(org_id).list(limit=2000)
    quotes = []
    for r in rates:
        if r.get("origin_zone") != origin_zone:
            continue
        if r.get("destination_zone") != destination_zone:
            continue
        if carrier_id and r.get("carrier_id") not in (None, carrier_id):
            continue
        wmin = float(r.get("weight_min", 0) or 0)
        wmax = float(r.get("weight_max", 99999) or 99999)
        if not (wmin <= weight_kg <= wmax):
            continue
        quotes.append({
            "carrier_id": r.get("carrier_id"),
            "rate_id": r.get("id"),
            "price": float(r.get("price", 0) or 0),
            "origin_zone": origin_zone,
            "destination_zone": destination_zone,
        })
    quotes.sort(key=lambda q: q["price"])
    return quotes


def select_best_carrier(org_id: str, **kw) -> Optional[dict]:
    quotes = rate_shipment(org_id, **kw)
    return quotes[0] if quotes else None
```

### 2.2 Route optimization (nearest-neighbour over stops)
فایلی نوێ: `backend\app\services\tms_routing.py`

```python
"""Route optimization: nearest-neighbour ordering of route stops.

Stops are dicts: {address, lat, lng, shipment_id?, sequence?}.
Pure function — no external map API (Iraq has poor geocoding coverage; a real
provider can replace `_haversine` later via the same signature)."""
from __future__ import annotations

import math


def _haversine(a: dict, b: dict) -> float:
    try:
        lat1, lng1 = float(a["lat"]), float(a["lng"])
        lat2, lng2 = float(b["lat"]), float(b["lng"])
    except (KeyError, TypeError, ValueError):
        return 0.0
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    x = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def optimize_route(stops: list[dict], start: dict | None = None) -> dict:
    """Greedy nearest-neighbour. Returns {ordered_stops, total_km}."""
    if not stops:
        return {"ordered_stops": [], "total_km": 0.0}
    remaining = list(stops)
    current = start or remaining[0]
    if start is None:
        remaining = remaining[1:]
    ordered = [current] if start is None else []
    total = 0.0
    while remaining:
        nxt = min(remaining, key=lambda s: _haversine(current, s))
        total += _haversine(current, nxt)
        ordered.append(nxt)
        remaining.remove(nxt)
        current = nxt
    for i, s in enumerate(ordered):
        s["sequence"] = i + 1
    return {"ordered_stops": ordered, "total_km": round(total, 2)}
```

### 2.3 Endpoints — زیادکردن بۆ `backend\app\api\logistics.py` (بەردەست)
لە کۆتایی فایل زیاد بکە (دوای `deliver_shipment`):

```python
@router.post("/rate")
def rate(data: dict, user: dict = Depends(get_current_user)):
    """Get freight quotes; cheapest first. Body: origin_zone, destination_zone, weight_kg, carrier_id?"""
    from app.services.tms_rating import rate_shipment
    quotes = rate_shipment(
        user["org_id"],
        origin_zone=data["origin_zone"],
        destination_zone=data["destination_zone"],
        weight_kg=float(data.get("weight_kg", 0) or 0),
        carrier_id=data.get("carrier_id"),
    )
    return {"quotes": quotes, "best": quotes[0] if quotes else None}


@router.post("/routes/{rid}/optimize")
def optimize(rid: str, user: dict = Depends(get_current_user)):
    """Re-order a route's stops by nearest-neighbour and persist."""
    from app.services.tms_routing import optimize_route
    repo = RouteRepo(user["org_id"])
    route = _own(repo, rid, user["org_id"])
    result = optimize_route(route.get("stops") or [])
    repo.update(rid, {"stops": result["ordered_stops"], "total_km": result["total_km"]})
    return result


@router.post("/shipments/{sid}/pod")
def proof_of_delivery(sid: str, data: dict, user: dict = Depends(get_current_user)):
    """Last-mile: record proof of delivery (signature/photo/receiver name)."""
    repo = ShipmentRepo(user["org_id"])
    _own(repo, sid, user["org_id"])
    repo.update(sid, {
        "status": "delivered",
        "delivered_at": datetime.utcnow().isoformat(),
        "pod_receiver_name": data.get("receiver_name"),
        "pod_signature_url": data.get("signature_url"),
        "pod_photo_url": data.get("photo_url"),
        "pod_lat": data.get("lat"),
        "pod_lng": data.get("lng"),
    })
    ShipmentEventRepo(user["org_id"]).create({
        "shipment_id": sid, "event_type": "pod_captured",
        "notes": data.get("receiver_name", ""),
    })
    return {"ok": True}
```

### 2.4 Freight cost → GL (cross-link §5/accounting)
کاتێک carrier-bill دێت، freight-ـەکە دەبێتە یان landed-cost (بۆ inbound، بەکارهێنانی `POST /api/inventory/landed-costs` ـی بەردەست) یان expense (بۆ outbound). بۆ outbound-ـی پۆستکراو، JE-ـی سادە بەکاربهێنە (هەمان شێوازی `create_expense_journal`):

```python
# لە service-ـی نوێ یان لە deliver flow
from app.services.accounting import AccountingService
AccountingService.create_journal_entry(
    org_id=org_id,
    date=ship["delivered_at"][:10],
    lines=[
        {"account_id": freight_expense_acc, "debit": cost, "credit": 0, "description": f"Freight {ship['id']}"},
        {"account_id": accrued_freight_payable_acc, "debit": 0, "credit": cost, "description": f"Carrier {carrier_id}"},
    ],
    source_type="freight", source_id=ship["id"],
)
```

> **Track & trace** پێشتر کاردەکات (`GET /api/logistics/track/{tracking_number}` + `log_shipment_events`). تەنها زیادکردنی `event_type` ـە نوێیەکان (`out_for_delivery`, `pod_captured`, `exception`) بەس دەکات — schema بەردەستە.

---

## 3. Manufacturing Costing — **گەورەترین گەپ** (cost roll-up + WIP/manufacturing JE)

> ئێستا `complete_manufacturing_order_atomic` (verified `services\mo_complete_atomic.py`) تەنها quantity موڤ دەکات: components ـی consume دەکات (`-consume`) و FG وەردەگرێت (`+qty`) — **هیچ بەهای پارەیی، هیچ `cost_price` بۆ FG، هیچ JE.** `cost_per_hour` ـی work-center (`manufacturing.py` ڕیز 53) هەرگیز بەکارنایەت. ئەمە دەبێت چارەسەر بکرێت بە **دوو شت پێکەوە: (الف) costing روول-ئەپ، (ب) WIP JE.**

### 3.1 فۆرمولای costing روول-ئەپ

```
material_cost  = Σ over components: required_qty × scale × component.unit_cost
                 (unit_cost = avg_cost لە warehouse_stock یان item.cost_price — §5)
labor_cost     = Σ over done work_orders of this MO:
                 (duration_minutes / 60) × work_center.cost_per_hour
overhead_cost  = labor_cost × overhead_rate            (config: mrp.overhead_rate, default 0)
                 یان material_cost × material_overhead_rate
total_cost     = material_cost + labor_cost + overhead_cost
fg_unit_cost   = total_cost / produced_qty             (if produced_qty > 0)
```

`duration_minutes` پێشتر لە `finish_wo` (`manufacturing.py` ڕیز 310-328) دەخەمڵێنرێت — بەکاری بهێنە. `cost_per_hour` لە `WorkCenterRepository`. `overhead_rate` لە `settings_service.get_bag(org, "mrp")` (هەمان شوێنی `create_order`).

### 3.2 فایلی نوێ: `backend\app\services\mo_costing.py`

```python
"""Manufacturing cost roll-up: materials + labor + overhead → FG unit cost."""
from __future__ import annotations

from app.firestore.manufacturing import WorkCenterRepository, WorkOrderRepository
from app.firestore.items import ItemRepository
from app.services import settings_service


def compute_mo_cost(org_id: str, mo: dict, produced_qty: float) -> dict:
    """Roll up cost for a completed MO. Returns a cost breakdown dict.

    Reads (no writes): work_orders (labor), work_centers (cost_per_hour),
    items (component unit cost fallback), mrp settings (overhead_rate).
    """
    planned = float(mo.get("quantity", 0) or 0)
    scale = (produced_qty / planned) if planned > 0 else 1.0

    item_repo = ItemRepository(org_id)

    # --- materials ---
    material_cost = 0.0
    material_lines = []
    for comp in mo.get("components") or []:
        item_id = comp.get("item_id")
        if not item_id:
            continue
        req = float(comp.get("required_qty", comp.get("quantity", 0)) or 0) * scale
        # unit cost: prefer explicit comp.unit_cost, else item.cost_price (§5 avg_cost)
        unit_cost = float(comp.get("unit_cost") or 0)
        if unit_cost <= 0:
            it = item_repo.get(item_id) or {}
            unit_cost = float(it.get("cost_price", 0) or 0)
        line_cost = round(req * unit_cost, 4)
        material_cost += line_cost
        material_lines.append({
            "item_id": item_id, "qty": round(req, 4),
            "unit_cost": unit_cost, "cost": line_cost,
        })

    # --- labor (from done work orders of this MO) ---
    wo_repo = WorkOrderRepository(org_id)
    wcs, _ = WorkCenterRepository(org_id).list(limit=500)
    wc_rate = {w["id"]: float(w.get("cost_per_hour", 0) or 0) for w in wcs}
    wos, _ = wo_repo.list(
        filters=[{"field": "mo_id", "op": "==", "value": mo["id"]}], limit=500,
    )
    labor_cost = 0.0
    labor_lines = []
    for wo in wos:
        if wo.get("status") != "done":
            continue
        mins = float(wo.get("duration_minutes", 0) or 0)
        rate = wc_rate.get(wo.get("work_center_id"), 0.0)
        c = round((mins / 60.0) * rate, 4)
        labor_cost += c
        labor_lines.append({
            "work_order_id": wo.get("id"), "work_center_id": wo.get("work_center_id"),
            "minutes": mins, "rate_per_hour": rate, "cost": c,
        })

    # --- overhead ---
    try:
        cfg = settings_service.get_bag(org_id, "mrp")
    except Exception:
        cfg = {}
    overhead_rate = float(cfg.get("overhead_rate", 0) or 0)       # applied to labor
    overhead_cost = round(labor_cost * overhead_rate, 4)

    total_cost = round(material_cost + labor_cost + overhead_cost, 4)
    fg_unit_cost = round(total_cost / produced_qty, 6) if produced_qty > 0 else 0.0

    return {
        "material_cost": round(material_cost, 4),
        "labor_cost": round(labor_cost, 4),
        "overhead_cost": overhead_cost,
        "total_cost": total_cost,
        "produced_qty": produced_qty,
        "fg_unit_cost": fg_unit_cost,
        "material_lines": material_lines,
        "labor_lines": labor_lines,
    }
```

### 3.3 WIP / manufacturing JE — شێوازی `accounting.py` بەکاربهێنە

دوو ڕێگەی پۆستکردن هەیە؛ ئەم guide ـە **single-step (backflush)** پێشنیار دەکات بۆ سادەیی، کە لەگەڵ flow-ی ئێستا (یەک `done` step) دەگونجێت:

```
Dr  Finished Goods Inventory (default_inventory)     total_cost
    Cr  Raw Materials Inventory (default_inventory)      material_cost
    Cr  Wages Payable / Labor Clearing                   labor_cost
    Cr  Manufacturing Overhead Applied                   overhead_cost
```

> ⚠️ ئەگەر raw + FG هەردووکیان هەمان account-ی `default_inventory` بەکاربهێنن (وەک `retail.yaml` کە یەک `default_inventory` ـی هەیە)، ئەوا inventory net delta = `total_cost - material_cost = labor + overhead` (واتە value-added دەچێتە inventory). ئەمە دروستە بۆ standard costing. ئەگەر COA-ـەکە account-ی جیاوازی هەیە بۆ raw-vs-FG، helper-ـی §5.1 بەکاربهێنە بۆ دۆزینەوەیان.

فانکشنی نوێ بۆ `accounting.py` (لە کۆتایی `AccountingService` زیاد بکە — هەمان شێواز وەک `create_bill_journal`):

```python
    @staticmethod
    def create_manufacturing_journal(org_id: str, mo: dict, cost: dict) -> dict:
        """Backflush MO completion: Dr FG inventory; Cr raw inv + labor + overhead.

        `cost` is the dict from mo_costing.compute_mo_cost().
        Posts only the non-zero credit legs. Skips entirely if total_cost == 0.
        """
        total = float(cost.get("total_cost", 0) or 0)
        if total <= 0:
            return {}
        from app.services.account_defaults import get_default_account  # §5.1

        inv_acc = get_default_account(org_id, "default_inventory")
        lines = [{
            "account_id": inv_acc, "debit": total, "credit": 0,
            "description": f"تەواوکردنی بەرهەمهێنان {mo.get('number', mo['id'])}",
        }]
        mat = float(cost.get("material_cost", 0) or 0)
        if mat > 0:
            lines.append({
                "account_id": inv_acc, "debit": 0, "credit": mat,
                "description": f"بەکارهێنانی کەرەستە {mo.get('number','')}",
            })
        lab = float(cost.get("labor_cost", 0) or 0)
        if lab > 0:
            lines.append({
                "account_id": get_default_account(org_id, "default_wages_payable", fallback_type="liability"),
                "debit": 0, "credit": lab,
                "description": f"کرێی کار {mo.get('number','')}",
            })
        ovh = float(cost.get("overhead_cost", 0) or 0)
        if ovh > 0:
            lines.append({
                "account_id": get_default_account(org_id, "default_mfg_overhead", fallback_type="liability"),
                "debit": 0, "credit": ovh,
                "description": f"سەرخەرجی بەرهەمهێنان {mo.get('number','')}",
            })
        return AccountingService.create_journal_entry(
            org_id=org_id, date=mo.get("done_at") or datetime.utcnow(),
            lines=lines,
            description=f"بەرهەمهێنان {mo.get('number', mo['id'])}",
            source_type="manufacturing_order", source_id=mo["id"],
        )
```

### 3.4 وەسڵکردن لە `mo_complete_atomic.py` + `manufacturing.py`

دوو options، **option B (post-commit) پێشنیار دەکرێت** بۆ ئەوەی atomicity-ی stock نەشکێت و JE engine-ی خۆی tx-ی خۆی بەکاربهێنێت (هەمان نمونەی POS کە JE لە دەرەوەی stock tx پۆست دەکات):

**A) لەناو atomic tx (strong consistency, پێچیدەتر):** `create_journal_entry_in_transaction()` (verified بوونی لە `journal_entry_atomic.py` ڕیز 66) لەناو `_complete` بانگ بکە. مەترسی: account reads لەناو هەمان tx زیاد دەکات.

**B) post-commit (پێشنیارکراو):** لە `manufacturing.py` → `done_order` (ڕیز 220)، **دوای** `complete_manufacturing_order_atomic` سەرکەوتوو بوو:

```python
    # بەش (existing) — دوای result وەرگرتن:
    try:
        from app.services.mo_costing import compute_mo_cost
        from app.services.accounting import AccountingService
        cost = compute_mo_cost(org, {**mo, "id": mo_id}, qty)
        # 1) FG unit cost → item.cost_price (perpetual, §5)
        if cost["fg_unit_cost"] > 0 and mo.get("product_id"):
            from app.services.inventory_costing import set_item_avg_cost  # §5.2
            set_item_avg_cost(org, mo["product_id"], cost["fg_unit_cost"], received_qty=qty)
        # 2) manufacturing JE
        je = AccountingService.create_manufacturing_journal(org, {**mo, "id": mo_id, "done_at": result.get("done_at")}, cost)
        result["cost"] = cost
        result["journal_entry_id"] = je.get("id")
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("MO costing/JE skipped for %s: %s", mo_id, exc)
    return result
```

> ئەم نمونەیە دەقاودەق هەمان "try/except + logger.warning" ـی POS (`pos_accounting.py` ڕیز 81-84) پەیڕەو دەکات بۆ ئەوەی شکستی costing، تەواوکردنی MO نەشکێنێت (stock پێشتر atomically پۆست کراوە).

### 3.5 By-products (هەیە لە BOM، costing-ی پێویستە)
`BOMCreate.byproducts` بوونی هەیە (`manufacturing.py` ڕیز 43). ئەگەر MO byproduct دەردەهێنێت، costing-ـەکە دەبێت تێچووی کۆ دابەش بکات (مثل by NRV یان physical qty). بۆ P1، سادە: by-products بە `cost=0` (scrap) یان بە fixed standard cost وەربگرە، دواتر `total_cost` ـی FG کەم بکەرەوە بەو بڕە. لە `compute_mo_cost` زیادکردنی:

```python
    byproduct_credit = 0.0
    for bp in mo.get("byproducts") or []:
        bp_qty = float(bp.get("quantity", 0) or 0) * scale
        bp_unit = float(bp.get("unit_cost") or 0)   # standard cost of scrap, default 0
        byproduct_credit += round(bp_qty * bp_unit, 4)
    # FG absorbs (total_cost - byproduct_credit)
    fg_total = max(total_cost - byproduct_credit, 0.0)
    fg_unit_cost = round(fg_total / produced_qty, 6) if produced_qty > 0 else 0.0
```

---

## 4. Multi-Company Consolidation & Intercompany

> ئێستا (verified `companies.py`): `/consolidated/pl` و `/consolidated/bs` invoice/bill/account ـەکان بە `company_id` فلتەر دەکەن، بەڵام **هەموو JE-ـەکان لە یەک `journal_entries` ـن بێ `company_id`**؛ و `eliminate_intercompany` تەنها flag-ێک set دەکات بێ هیچ JE-ێک (ڕیز 213-221, "no journal reversal yet").

### 4.1 Per-entity ledger — `company_id` بخەرە سەر هەموو JE
**کەمترین دەستکاری:** `create_journal_entry()` و `create_journal_entry_in_transaction()` پێشتر `extra_header` پارامیتەریان هەیە (verified `journal_entry_atomic.py` ڕیز 83, 113-116). تەنها `company_id` بەرەو header بنێرە:

1. لە `AccountingService.create_journal_entry` (`accounting.py` ڕیز 13) پارامیتەری `company_id: str | None = None` زیاد بکە و بیدە بە atomic call وەک `extra_header={"company_id": company_id}` (لەگەڵ merge ئەگەر extra_header پێشتر هەبوو).
2. هەر caller-ێک (invoice/bill/expense/payment JE) `company_id` لە source doc وەربگرێت: `invoice.get("company_id")`. ئەگەر None، head-company (= `org_id`) — هەمان logic ـی consolidation (`(i.get("company_id") or user["org_id"])`).
3. ئیندێکس: `journal_entries (org_id, company_id, date)` — بۆ per-entity trial balance.

ئەمە **هیچ JE-ی بەردەست ناشکێنێت** (فیلدی نوێ، nullable). consolidation-ـی ئێستا (invoice/bill-based) بەردەوام دەبێت کاردەکات؛ بەڵام ئێستا دەتوانیت **ledger-based** consolidation-ی ڕاستەقینەش دروست بکەیت.

### 4.2 Intercompany elimination — JE-ی ڕاستەقینە (نەک تەنها flag)
فایلی نوێ: `backend\app\services\intercompany.py`

```python
"""Intercompany: post matched IC journal + elimination on consolidation."""
from __future__ import annotations

from datetime import datetime

from app.services.accounting import AccountingService
from app.services.account_defaults import get_default_account  # §5.1


def post_intercompany_journal(org_id: str, ic: dict) -> dict:
    """Post the two-sided IC entry: due-from in seller, due-to in buyer.

    Creates ONE balanced JE tagged with both company_ids on the lines so that
    elimination can find and reverse the intra-group balance at consolidation.
    """
    amount = float(ic.get("amount", 0) or 0)
    if amount <= 0:
        return {}
    due_from = get_default_account(org_id, "default_ic_receivable", fallback_type="asset")
    due_to = get_default_account(org_id, "default_ic_payable", fallback_type="liability")
    lines = [
        {"account_id": due_from, "debit": amount, "credit": 0,
         "company_id": ic["from_company_id"], "is_intercompany": True,
         "description": f"IC receivable from {ic['to_company_id']}"},
        {"account_id": due_to, "debit": 0, "credit": amount,
         "company_id": ic["to_company_id"], "is_intercompany": True,
         "description": f"IC payable to {ic['from_company_id']}"},
    ]
    return AccountingService.create_journal_entry(
        org_id=org_id, date=ic.get("date") or datetime.utcnow().date().isoformat(),
        lines=lines, description=ic.get("description", "Intercompany"),
        source_type="intercompany", source_id=ic["id"],
    )


def compute_eliminations(org_id: str, *, date_from=None, date_to=None) -> dict:
    """Sum intercompany line balances per account to be removed on consolidation.

    Reads JE lines flagged is_intercompany and nets them out. Returns the
    elimination adjustments (not posted to any single entity — applied only to
    the consolidated view)."""
    from app.firestore.journals import JournalEntryRepository
    from app.services.report_streams import collect_stream
    je_repo = JournalEntryRepository(org_id)
    entries = collect_stream(je_repo, max_docs=20000)
    elim: dict[str, float] = {}
    for e in entries:
        if e.get("source_type") != "intercompany":
            continue
        d = e.get("date")
        if date_from and str(d) < date_from:
            continue
        if date_to and str(d) > date_to:
            continue
        for ln in je_repo.get_lines(e["id"]):
            if not ln.get("is_intercompany"):
                continue
            acc = ln["account_id"]
            elim[acc] = elim.get(acc, 0.0) + float(ln.get("debit", 0) or 0) - float(ln.get("credit", 0) or 0)
    return {"eliminations": elim, "date_from": date_from, "date_to": date_to}
```

وەسڵ لە `companies.py`:
- `create_intercompany_journal` (ڕیز 178) → دوای `repo.create(payload)`، بانگکردنی `post_intercompany_journal(org_id, payload)` و لینککردنی `je_id`.
- `eliminate_intercompany` (ڕیز 213) → بەکارهێنانی `AccountingService.reverse_journal_entry()` (verified بوونی لە `accounting.py` ڕیز 360) لەسەر IC JE-ـەکە بۆ reverse-ـی ڕاستەقینە، نەک تەنها flag.
- `consolidated_pl`/`consolidated_bs` → بانگکردنی `compute_eliminations()` و دەرکردنی `eliminations` بڕ لە totals (intra-group revenue/receivable لاببرێت).

### 4.3 Fiscal calendars per-entity
فایلی نوێ: `backend\app\firestore\fiscal.py` + endpoint بچووک لە `companies.py`:

```python
# firestore/fiscal.py
from app.firestore.base import BaseRepository
class FiscalCalendarRepository(BaseRepository):
    collection_name = "fiscal_calendars"
# doc: {org_id, company_id, fy_start_month (1-12), fy_start_day, periods: [{name, start, end, status}]}
```

> period-lock-ی ئێستا (`PeriodCloseService.check_period_locked`، verified بانگکراوە لە `accounting.py` ڕیز 42) global-ـە بۆ org. بۆ per-entity locking، `company_id` بدە بە `check_period_locked` (هەنگاوی دواتر — P1 تەنها calendar storage + UI پێشنیار دەکات، نەک گۆڕینی lock semantics بۆ ئەوەی regression نەبێت).

---

## 5. Inventory Perpetual Valuation — moving-average / FIFO cost ledger + COGS-on-issue

> **Cross-link بۆ P0 finance guide** (`_deltas/P0-finance-correctness-IMPLEMENTATION.md`، کە CLAUDE.md ئاماژەی پێ دەکات بەڵام **هێشتا جێبەجێ نەکراوە — "بەمەبەست جێبەجێ نەکرا"**). ئەم بەشە depth-ـی WMS/manufacturing تەواو دەکات: بێ avg-cost، نە manufacturing FG cost (§3) و نە lot `unit_cost` (هەیە بەڵام بەکارنایەت) دەتوانن COGS بپۆستن.

### 5.1 فایلی نوێ: `backend\app\services\account_defaults.py` (helper بۆ هەموو §3/§4/§5)

```python
"""Resolve GL accounts by is_default_for tag (COA-template aware).

`accounting.py._get_account_by_type` looks up by `account_type`, but COA
templates tag accounts via `is_default_for` (e.g. default_inventory=11400,
default_cogs=51000). This helper bridges both so new JE code is robust."""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

from app.firestore.accounts import AccountRepository

# is_default_for tag -> fallback account_type if tag not present on any account
_FALLBACK_TYPE = {
    "default_inventory": "inventory",
    "default_cogs": "cost_of_goods_sold",
    "default_accounts_receivable": "accounts_receivable",
    "default_sales": "sales",
}


def get_default_account(org_id: str, tag: str, *, fallback_type: Optional[str] = None) -> str:
    repo = AccountRepository(org_id)
    by_tag, _ = repo.list(
        filters=[{"field": "is_default_for", "op": "==", "value": tag}], limit=1,
    )
    if by_tag:
        return by_tag[0]["id"]
    acc_type = fallback_type or _FALLBACK_TYPE.get(tag)
    if acc_type:
        by_type, _ = repo.list(
            filters=[
                {"field": "account_type", "op": "==", "value": acc_type},
                {"field": "is_active", "op": "==", "value": True},
            ], limit=1,
        )
        if by_type:
            return by_type[0]["id"]
    raise HTTPException(404, f"حسابی بنەڕەت بۆ '{tag}' نەدۆزرایەوە")
```

### 5.2 فایلی نوێ: `backend\app\services\inventory_costing.py` — moving-average + FIFO ledger

```python
"""Perpetual inventory valuation: moving-average + FIFO cost layers.

Two cost models, selected per item (item.cost_method = 'avg' | 'fifo'):
- avg : maintain item.cost_price as the moving weighted average; recompute on
        every receipt (qty_in × cost_in). Issues use current avg as COGS.
- fifo: maintain a cost-layer ledger (collection `cost_layers`); issues consume
        oldest layers first and COGS = sum(consumed_layer.qty × layer.unit_cost).

Both write a `cost_ledger` audit row per movement for traceability + the
inventory-valuation report cross-check (§ inventory.py /valuation/summary)."""
from __future__ import annotations

import uuid
from datetime import datetime

from app.firestore.base import BaseRepository
from app.firestore.items import ItemRepository


class CostLayerRepository(BaseRepository):
    collection_name = "cost_layers"     # FIFO layers: {item_id, warehouse_id, qty_remaining, unit_cost, received_at}


class CostLedgerRepository(BaseRepository):
    collection_name = "cost_ledger"     # audit: {item_id, direction, qty, unit_cost, value, ref, balance_qty, balance_value}


def set_item_avg_cost(org_id: str, item_id: str, cost_in: float, *, received_qty: float) -> float:
    """Moving-average on receipt. new_avg = (old_qty*old_avg + in_qty*cost_in)/(old_qty+in_qty)."""
    repo = ItemRepository(org_id)
    item = repo.get(item_id)
    if not item:
        return cost_in
    old_qty = float(item.get("stock_on_hand", 0) or 0)
    old_avg = float(item.get("cost_price", 0) or 0)
    in_qty = float(received_qty or 0)
    denom = old_qty + in_qty
    new_avg = round((old_qty * old_avg + in_qty * cost_in) / denom, 6) if denom > 0 else cost_in
    repo.update(item_id, {"cost_price": new_avg})
    return new_avg


def cost_of_issue(org_id: str, item_id: str, qty_out: float, *, warehouse_id=None) -> dict:
    """Return COGS for issuing qty_out, per the item's cost method.

    avg  → qty_out × item.cost_price
    fifo → consume oldest cost_layers, decrement qty_remaining, sum cost.
    Returns {cogs, unit_cost_used, method, layers_consumed}."""
    item = ItemRepository(org_id).get(item_id) or {}
    method = item.get("cost_method", "avg")

    if method != "fifo":
        unit = float(item.get("cost_price", 0) or 0)
        return {"cogs": round(qty_out * unit, 4), "unit_cost_used": unit,
                "method": "avg", "layers_consumed": []}

    # FIFO: consume oldest layers
    lyr_repo = CostLayerRepository(org_id)
    filters = [{"field": "item_id", "op": "==", "value": item_id}]
    if warehouse_id:
        filters.append({"field": "warehouse_id", "op": "==", "value": warehouse_id})
    layers, _ = lyr_repo.list(filters=filters, order_by="received_at", order_dir="ASCENDING", limit=2000)
    remaining = qty_out
    cogs = 0.0
    consumed = []
    for ly in layers:
        if remaining <= 1e-9:
            break
        avail = float(ly.get("qty_remaining", 0) or 0)
        if avail <= 0:
            continue
        take = min(avail, remaining)
        unit = float(ly.get("unit_cost", 0) or 0)
        cogs += take * unit
        lyr_repo.update(ly["id"], {"qty_remaining": round(avail - take, 4)})
        consumed.append({"layer_id": ly["id"], "qty": round(take, 4), "unit_cost": unit})
        remaining -= take
    return {"cogs": round(cogs, 4), "unit_cost_used": None, "method": "fifo", "layers_consumed": consumed}


def add_cost_layer(org_id: str, item_id: str, qty: float, unit_cost: float, *, warehouse_id=None) -> dict:
    """Record a FIFO receipt layer (call on GRN/MO completion when method=fifo)."""
    return CostLayerRepository(org_id).create({
        "id": str(uuid.uuid4()),
        "item_id": item_id, "warehouse_id": warehouse_id,
        "qty_remaining": round(float(qty), 4), "unit_cost": round(float(unit_cost), 6),
        "received_at": datetime.utcnow().isoformat(),
    })
```

### 5.3 COGS-on-issue JE (شێوازی `create_invoice_journal`)
COGS دەبێت **پۆست بکرێت لە کاتی فرۆشتن** (invoice confirm / POS / picking done). ئێستا هیچ COGS-ێک پۆست ناکرێت (verified — هیچ `cost_of_goods` لە invoices.py). فانکشنی نوێ بۆ `accounting.py`:

```python
    @staticmethod
    def create_cogs_journal(org_id: str, *, item_lines: list[dict], source_type: str,
                            source_id: str, date) -> dict:
        """Dr COGS / Cr Inventory for issued goods. item_lines: [{item_id, qty}].

        Computes COGS via inventory_costing.cost_of_issue per item."""
        from app.services.inventory_costing import cost_of_issue
        from app.services.account_defaults import get_default_account
        total_cogs = 0.0
        details = []
        for ln in item_lines:
            r = cost_of_issue(org_id, ln["item_id"], float(ln.get("qty", 0) or 0),
                              warehouse_id=ln.get("warehouse_id"))
            total_cogs += r["cogs"]
            details.append({"item_id": ln["item_id"], **r})
        if total_cogs <= 0:
            return {}
        cogs_acc = get_default_account(org_id, "default_cogs")
        inv_acc = get_default_account(org_id, "default_inventory")
        return AccountingService.create_journal_entry(
            org_id=org_id, date=date,
            lines=[
                {"account_id": cogs_acc, "debit": round(total_cogs, 2), "credit": 0, "description": "COGS"},
                {"account_id": inv_acc, "debit": 0, "credit": round(total_cogs, 2), "description": "Inventory issue"},
            ],
            source_type=source_type + "_cogs", source_id=source_id,
        )
```

**وەسڵ:**
- **GRN** (`grn_receive_atomic.py`): دوای commit، بۆ هەر lot/item-ی وەرگیراو `set_item_avg_cost(org, item_id, unit_cost, received_qty=qty)` (avg) یان `add_cost_layer(...)` (fifo). `unit_cost` لە PO line یان bill وەربگرە.
- **Invoice confirm** (`invoices.py` ڕیز ~272, `status="sent"`): دوای revenue JE (`create_invoice_journal`)، بانگکردنی `create_cogs_journal(org, item_lines=[{item_id, qty} for line], source_type="invoice", source_id=invoice_id, date=...)`. ⚠️ ئەمە دەبێت لەگەڵ P0 (revenue JE on confirm) هاوتەریب بێت.
- **Picking done** (`done_picking_atomic`) و **POS** (`pos_accounting.py`): هەمان COGS call.

### 5.4 Valuation report cross-check
`GET /api/inventory/valuation/summary` (verified `inventory.py` ڕیز 950) ئێستا `stock_on_hand × cost_price` دەخەمڵێنێت. دوای avg-cost، ئەمە دەبێتە value-ی ڕاستەقینەی perpetual. زیادکردنی endpoint-ی نوێ بۆ duo-check بەرامبەر GL inventory balance (تەنها read، بۆ reconciliation):

```python
@router.get("/valuation/gl-check")
def valuation_gl_check(user: dict = Depends(get_current_user)):
    """Compare perpetual inventory value vs GL inventory account balance."""
    from app.services.account_defaults import get_default_account
    from app.firestore.accounts import AccountRepository
    summary = inventory_valuation_summary(user)        # reuse existing
    inv_acc_id = get_default_account(user["org_id"], "default_inventory")
    acc = AccountRepository(user["org_id"]).get(inv_acc_id) or {}
    gl_balance = float(acc.get("balance", 0) or 0)
    perpetual = float(summary["total_value"])
    return {"perpetual_value": perpetual, "gl_inventory_balance": gl_balance,
            "variance": round(perpetual - gl_balance, 2)}
```

---

## 6. Sequencing · Test Plan · Rollback

### 6.1 ڕیزبەندی جێبەجێکردن (dependency order)
ترتیب گرینگە — هەر هەنگاوێک پشت بەوەی پێشی دەبەستێت:

| # | هەنگاو | فایلەکان | پشتبەستوو بە |
|---|--------|----------|---------------|
| **S1** | `account_defaults.py` helper | §5.1 (نوێ) | هیچ |
| **S2** | `inventory_costing.py` (avg + fifo + ledger) | §5.2 (نوێ) | S1 |
| **S3** | COGS-on-issue JE + GRN avg-cost wiring | §5.3 → `accounting.py`, `grn_receive_atomic.py`, `invoices.py`, `pos_accounting.py` | S1, S2, **P0 revenue-JE** |
| **S4** | Manufacturing costing + WIP JE | §3 → `mo_costing.py` (نوێ), `accounting.py`, `manufacturing.py` | S1, S2 |
| **S5** | WMS depth (zones/bins/putaway/wave) | §1 → `wms.py`, `wms_putaway.py`, `wms_wave.py` (نوێ), location-aware move helper | هیچ (additive) |
| **S6** | TMS engine (rating/routing/POD) | §2 → `tms_rating.py`, `tms_routing.py` (نوێ), `logistics.py` | هیچ |
| **S7** | Multi-company per-entity ledger + IC elimination | §4 → `intercompany.py`, `fiscal.py` (نوێ), `accounting.py`, `companies.py` | S1 |

**Router registration (`backend\app\main.py`):** زیادکردنی `wms.router` (S5). `logistics`/`companies`/`manufacturing` پێشتر تۆمارکراون (تەنها endpoint زیاد دەکرێت). **یاسا:** ئەگەر agent ناتوانێ `main.py` دەستکاری بکات، TODO بنووسە (وەک نمونەکانی پێشوو لە CLAUDE.md).

**Composite indices (`firestore.indexes.json`):** زیادکردن:
- `warehouse_stock (org_id, warehouse_id, item_id, location_id)` — §1.7
- `wh_locations (org_id, warehouse_id, zone_id)` — §1.3
- `cost_layers (org_id, item_id, warehouse_id, received_at ASC)` — §5.2 FIFO
- `journal_entries (org_id, company_id, date)` — §4.1 per-entity TB
- `cost_ledger (org_id, item_id, created_at)` — §5.2 audit

### 6.2 پلانی تێست (فایلە نوێیەکانی تێست — پشت بە pytest-ـی بەردەست)
هەموو تێست لە `backend\tests\` بنووسرێن، repo-mocked وەک `tests/test_payments_*` (نمونەی CLAUDE.md). pure-functions (costing, routing, putaway, allocation) **بێ Firestore تاقی بکرێنەوە** (ئاسانترین + خێراترین).

| فایلی تێست (نوێ) | چی تاقی دەکات | جۆر |
|-------------------|---------------|------|
| `tests/test_mo_costing.py` | `compute_mo_cost`: material+labor+overhead، scale، by-product credit، produced_qty=0 → fg_unit_cost=0 | pure |
| `tests/test_inventory_costing.py` | `set_item_avg_cost` (موازنەی weighted)، `cost_of_issue` avg، FIFO layer consumption (دوو لایەر، جزئی)، fifo زیاتر لە بەردەست | repo-mocked |
| `tests/test_account_defaults.py` | `get_default_account`: by tag، fallback by type، 404 | repo-mocked |
| `tests/test_manufacturing_je.py` | `create_manufacturing_journal`: balanced، skip غیر-سفر legs، total=0 → {} | repo-mocked |
| `tests/test_cogs_journal.py` | `create_cogs_journal`: balanced Dr COGS/Cr Inv، multi-item، total=0 → {} | repo-mocked |
| `tests/test_wms_putaway.py` | `suggest_putaway_location`: priority order (item>group>wildcard)، fixed vs nearest_empty، capacity | repo-mocked |
| `tests/test_wms_wave.py` | `build_wave_pick_list`: batch merge، zone filter، single keep، path sort by (x,y,z) | repo-mocked |
| `tests/test_tms_routing.py` | `optimize_route`: nearest-neighbour ترتیب، total_km، empty، start-point | pure |
| `tests/test_tms_rating.py` | `rate_shipment`: weight-band match، carrier filter، cheapest-first sort | repo-mocked |
| `tests/test_intercompany.py` | `post_intercompany_journal` balanced + tagged، `compute_eliminations` netting | repo-mocked |

**نمونەی تێستی pure (test_tms_routing.py):**
```python
from app.services.tms_routing import optimize_route

def test_nearest_neighbour_orders_by_distance():
    stops = [
        {"address": "A", "lat": 0, "lng": 0},
        {"address": "C", "lat": 0, "lng": 5},
        {"address": "B", "lat": 0, "lng": 1},
    ]
    out = optimize_route(stops, start={"lat": 0, "lng": 0})
    assert [s["address"] for s in out["ordered_stops"]] == ["B", "C"]
    assert out["total_km"] > 0

def test_empty_route():
    assert optimize_route([]) == {"ordered_stops": [], "total_km": 0.0}
```

**فەرمانی تاقیکردنەوە (Windows — sandbox-ی Linux ناتوانێ venv-ی Windows ڕان بکات):**
```powershell
cd C:\Users\SAFA\zoho\backend
.\venv\Scripts\Activate.ps1
pytest -q                              # هەموو suite — دەبێت ٠ regression
pytest tests/test_mo_costing.py tests/test_inventory_costing.py -v   # P1 نوێیەکان
python -c "import app.main"            # boot check — route_count دەبێت زیاد بێت
```
> **baseline-ی ئێستا (لە CLAUDE.md):** ~1333 سەرکەوتوو / 2 شکستی pre-existing (`test_firestore_audit_tool`, `test_redis_rate_limit_config`). تێستە نوێیەکان دەبێت ئەم baseline-ـە تێنەپەڕێنن (تەنها زیاد بکەن).

### 6.3 Rollback پلان
هەموو گۆڕانکاری additive و flag-able:
1. **Feature flags:** هەر wiring-ی JE-ـی نوێ (COGS, manufacturing, IC) بخە دوای `try/except + logger.warning` (وەک §3.4, §5.3 نیشانیدا) — ئەگەر شکست بهێنێت، flow-ی سەرەکی (invoice/MO/picking) ناشکێت. زیاتر: `settings_service` flag `inventory.perpetual_enabled`, `manufacturing.costing_enabled`, `multicompany.ic_je_enabled` بۆ on/off-ـی runtime.
2. **Routers:** لابردنی `wms.router` لە `main.py` → WMS depth بەتەواوی غایب دەبێت، کۆنەکە (warehouse-level) دەمێنێتەوە.
3. **Data:** کۆلێکشنە نوێیەکان (`wh_zones`, `wh_locations`, `cost_layers`, ...) جیاوازن — drop-یان هیچ شتی بەردەست ناشکێنێت. `company_id`/`location_id`/`avg_cost` فیلدی nullable-ـن — ئەگەر کۆد لایان ببات، None دەمێنێتەوە و logic-ی fallback (`or org_id`, warehouse-level) کاردەکات.
4. **Git:** هەر هەنگاو (S1–S7) لە commit-ی جیادا — `git revert <sha>` ـی هەر یەکێک بەبێ کاریگەری لەسەر ئەوانی تر (دوای ترتیب).
5. **JE reversal:** ئەگەر JE-ی هەڵە پۆست کرا، `AccountingService.reverse_journal_entry()` (بەردەست) بەکاربهێنە — هیچ JE-ێک hard-delete مەکە.

### 6.4 خاڵە مەترسیدارەکان (review before apply)
- **Account mapping (§0):** پێش هەر JE-ی نوێ، دڵنیابە `is_default_for` یان `account_type` لەسەر account-ـەکان دانراوە. `get_default_account` (§5.1) هەردووکی دەگرێت، بەڵام ئەگەر هیچیان نەبوو → 404. تاقیکردنەوەی seed-ـی هەر COA template.
- **COGS double-count:** دڵنیابە COGS تەنها **یەک جار** پۆست دەکرێت (invoice confirm یان picking done — نەک هەردوو). بڕیار لەسەر یەک trigger-point.
- **Avg-cost race:** `set_item_avg_cost` ئێستا read-then-write (نە atomic). بۆ concurrency-ی بەرز، بیکە atomic بە `fs.transactional` (وەک `mo_complete_atomic`). P1 read-then-write قبوڵە بۆ GRN (کەم-تکرار).
- **Decimal:** §P0 finance guide داوای `Decimal` دەکات بۆ پارە. ئەم guide ـە `float` بەکاردەهێنێت بۆ هاوتایی لەگەڵ کۆدی ئێستا (`accounting.py` float بەکاردەهێنێت). ئەگەر P0 → Decimal، costing-ـیش دەبێت Decimal بێت (هاوتەریب جێبەجێ بکە).

---

## کۆتایی
ئەم فایلە (`_deltas\P1-modules-IMPLEMENTATION.md`) تەنها **guide-ی پێداچوونەوەکراوە** — هیچ کۆدێکی پڕۆژە دەستکاری نەکراوە و هیچ commit نەکراوە. هەر بەشێک code block-ی copy-paste-ready + خاڵی وەسڵکردنی دیاریکراوی هەیە، بنچینەی لەسەر فایلە ڕاستەقینەکان. **پێش merge:** §6.2 (pytest لەسەر Windows) جێبەجێ بکە، account-mapping تاقی بکەرەوە، و لەگەڵ P0 finance guide هاوتەریب بکە (revenue-JE-on-confirm + Decimal).
