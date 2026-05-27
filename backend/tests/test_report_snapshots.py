"""Wave K3 — stable report math snapshots (no external deps)."""
import json
from datetime import date
from pathlib import Path

from app.services.aged_reports import build_aged_buckets

SNAP_DIR = Path(__file__).parent / "snapshots"


def test_aged_ar_snapshot_matches_golden():
    docs = [
        {"contact_id": "c1", "contact_name": "A", "balance_due": 100, "due_date": "2026-05-01"},
    ]
    result = build_aged_buckets(docs, date(2026, 5, 25))
    golden_path = SNAP_DIR / "aged_ar_single.json"
    golden_path.parent.mkdir(exist_ok=True)
    if not golden_path.exists():
        golden_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    golden = json.loads(golden_path.read_text(encoding="utf-8"))
    assert result == golden
