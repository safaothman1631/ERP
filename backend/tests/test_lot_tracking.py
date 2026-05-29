"""Lot allocation API normalization tests."""
from app.services.lot_allocation import LotAllocationService, STRATEGY_FIFO


def test_allocate_fifo_from_batches():
    org = "test-org"
    batches = [
        {
            "id": "b1", "org_id": org, "item_id": "item1", "warehouse_id": "wh1",
            "batch_number": "LOT-1", "qty_on_hand": 5, "received_date": "2026-01-01",
        },
        {
            "id": "b2", "org_id": org, "item_id": "item1", "warehouse_id": "wh1",
            "batch_number": "LOT-2", "qty_on_hand": 10, "received_date": "2026-02-01",
        },
    ]

    class FakeRepo:
        def __init__(self, _org):
            pass

        def list(self, **kwargs):
            return batches, len(batches)

        def stream_org_docs(self):
            yield from batches

    import app.services.lot_allocation as mod
    orig = mod.BatchRepository
    mod.BatchRepository = FakeRepo
    try:
        result = LotAllocationService.allocate(org, "item1", 7, strategy=STRATEGY_FIFO, warehouse_id="wh1")
    finally:
        mod.BatchRepository = orig

    allocations = result["allocations"]
    assert len(allocations) == 2
    assert sum(r["qty"] for r in allocations) == 7
    assert allocations[0]["lot_id"] == "b1"
    assert result["fully_allocated"] is True
