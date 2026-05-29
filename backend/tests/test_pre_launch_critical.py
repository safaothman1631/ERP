"""Pre-launch critical fixes regression tests."""
import json
from pathlib import Path

from app.services.ttl_fields import COLLECTION_TTL_HOURS, attach_ttl_fields


def test_ttl_map_covers_required_collections():
    required = {"sessions", "ocr_cache", "webhook_inbox", "rate_limit_buckets", "receipt_scans"}
    assert required.issubset(COLLECTION_TTL_HOURS.keys())


def test_attach_ttl_adds_datetime():
    data = attach_ttl_fields("sessions", {"user_id": "u1"})
    assert "expires_at" in data


def test_firestore_indexes_ttl_manifest():
    root = Path(__file__).resolve().parents[2]
    manifest = json.loads((root / "firestore.indexes.json").read_text(encoding="utf-8"))
    groups = {
        o["collectionGroup"]
        for o in manifest.get("fieldOverrides", [])
        if o.get("ttl") and o.get("fieldPath") == "expires_at"
    }
    assert "sessions" in groups
    assert "revoked_tokens" in groups


def test_idempotency_hot_path_prefixes():
    from app.middleware import idempotency_http as mw

    assert mw._path_eligible("/api/pos/orders")
    assert not mw._path_eligible("/api/exports/invoices")
