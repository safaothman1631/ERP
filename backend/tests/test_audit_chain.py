"""Audit hash chain verification tests."""
from datetime import datetime

from app.services.audit_chain import GENESIS_HASH, compute_audit_hash, verify_audit_chain


def test_compute_audit_hash_deterministic():
    ts = datetime(2026, 5, 25, 12, 0, 0)
    h1 = compute_audit_hash(
        org_id="org1",
        user_id="u1",
        method="POST",
        path="/api/items",
        action="create",
        entity_type="items",
        entity_id="i1",
        prev_hash=GENESIS_HASH,
        timestamp=ts,
    )
    h2 = compute_audit_hash(
        org_id="org1",
        user_id="u1",
        method="POST",
        path="/api/items",
        action="create",
        entity_type="items",
        entity_id="i1",
        prev_hash=GENESIS_HASH,
        timestamp=ts,
    )
    assert h1 == h2
    assert len(h1) == 64


def test_verify_audit_chain_valid():
    ts1 = datetime(2026, 5, 25, 10, 0, 0)
    ts2 = datetime(2026, 5, 25, 11, 0, 0)
    h1 = compute_audit_hash(
        org_id="org1", user_id="u1", method="POST", path="/a", action="create",
        entity_type="x", entity_id="1", prev_hash=GENESIS_HASH, timestamp=ts1,
    )
    h2 = compute_audit_hash(
        org_id="org1", user_id="u1", method="PUT", path="/b", action="update",
        entity_type="y", entity_id="2", prev_hash=h1, timestamp=ts2,
    )
    entries = [
        {"id": "1", "org_id": "org1", "user_id": "u1", "method": "POST", "path": "/a",
         "action": "create", "entity_type": "x", "entity_id": "1",
         "prev_hash": GENESIS_HASH, "hash": h1, "created_at": ts1.isoformat()},
        {"id": "2", "org_id": "org1", "user_id": "u1", "method": "PUT", "path": "/b",
         "action": "update", "entity_type": "y", "entity_id": "2",
         "prev_hash": h1, "hash": h2, "created_at": ts2.isoformat()},
    ]
    result = verify_audit_chain(entries)
    assert result["valid"] is True
    assert result["checked"] == 2


def test_verify_audit_chain_detects_tamper():
    ts = datetime(2026, 5, 25, 10, 0, 0)
    h1 = compute_audit_hash(
        org_id="org1", user_id="u1", method="POST", path="/a", action="create",
        entity_type="x", entity_id="1", prev_hash=GENESIS_HASH, timestamp=ts,
    )
    entries = [
        {"id": "1", "org_id": "org1", "user_id": "u1", "method": "POST", "path": "/a",
         "action": "create", "entity_type": "x", "entity_id": "1",
         "prev_hash": GENESIS_HASH, "hash": "tampered", "created_at": ts.isoformat()},
    ]
    result = verify_audit_chain(entries)
    assert result["valid"] is False
    assert result["broken_at"] == "1"
