"""Sharded counters to avoid hot-spot documents (Wave A)."""
from __future__ import annotations

import random

from google.cloud import firestore as fs

from app.firebase_client import get_db

NUM_SHARDS = 10
COLLECTION = "counters_sharded"


def increment_sharded(org_id: str, counter_name: str, delta: int = 1) -> None:
    db = get_db()
    shard = random.randint(0, NUM_SHARDS - 1)
    doc_id = f"{org_id}_{counter_name}_{shard}"
    db.collection(COLLECTION).document(doc_id).set(
        {
            "org_id": org_id,
            "counter_name": counter_name,
            "shard": shard,
            "value": fs.Increment(delta),
        },
        merge=True,
    )


def read_sharded(org_id: str, counter_name: str) -> int:
    db = get_db()
    total = 0
    for doc in (
        db.collection(COLLECTION)
        .where("org_id", "==", org_id)
        .where("counter_name", "==", counter_name)
        .stream()
    ):
        total += int((doc.to_dict() or {}).get("value") or 0)
    return total
