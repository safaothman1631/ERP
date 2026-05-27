#!/usr/bin/env python3
"""Seed minimal POS + banking data for Playwright shopkeeper_core E2E."""
from __future__ import annotations

import sys
import uuid
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.firebase_client import get_db, init_firebase  # noqa: E402
from app.firestore.banking import BankAccountRepository  # noqa: E402
from app.firestore.inventory import ItemRepository  # noqa: E402
from app.firestore.pos import (  # noqa: E402
    POSConfigRepository,
    POSPaymentMethodRepository,
    POSSessionRepository,
)

DEMO_ORG_ID = "064a4a1a-487b-4835-a42a-4806ba8add72"
E2E_MARKER = "shopkeeper_e2e_seed"


def main() -> None:
    init_firebase()
    org_id = DEMO_ORG_ID
    now = datetime.utcnow().isoformat()

    cfg_repo = POSConfigRepository(org_id)
    configs, _ = cfg_repo.list(filters=[{"field": "name", "op": "==", "value": "E2E Shop"}], limit=1)
    if configs:
        config_id = configs[0]["id"]
        print(f"[e2e] existing config {config_id}")
    else:
        config_id = str(uuid.uuid4())
        cfg_repo.create({
            "id": config_id,
            "org_id": org_id,
            "name": "E2E Shop",
            "name_ku": "دووکانی تێست",
            "is_active": True,
            "cash_control": True,
            "e2e_marker": E2E_MARKER,
            "created_at": now,
            "updated_at": now,
        })
        print(f"[e2e] created config {config_id}")

    pm_repo = POSPaymentMethodRepository(org_id)
    methods, _ = pm_repo.list(filters=[{"field": "name", "op": "==", "value": "Cash"}], limit=1)
    if not methods:
        pm_repo.create({
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "name": "Cash",
            "type": "cash",
            "is_cash_count": True,
            "is_active": True,
            "e2e_marker": E2E_MARKER,
            "created_at": now,
        })
        print("[e2e] created payment method Cash")

    sess_repo = POSSessionRepository(org_id)
    open_sessions, _ = sess_repo.list(
        filters=[{"field": "state", "op": "==", "value": "opened"}],
        limit=1,
    )
    if not open_sessions:
        sess_repo.create({
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "config_id": config_id,
            "state": "opened",
            "opening_cash": 100000,
            "opened_at": now,
            "e2e_marker": E2E_MARKER,
            "created_at": now,
        })
        print("[e2e] opened POS session")

    bank_repo = BankAccountRepository(org_id)
    banks, _ = bank_repo.list(
        filters=[{"field": "account_name", "op": "==", "value": "E2E Bank"}],
        limit=1,
    )
    if not banks:
        bank_repo.create({
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "account_name": "E2E Bank",
            "account_number": "E2E-001",
            "bank_name": "Demo Bank",
            "account_type": "checking",
            "currency": "IQD",
            "opening_balance": 500000.0,
            "current_balance": 500000.0,
            "is_active": True,
            "e2e_marker": E2E_MARKER,
            "created_at": now,
        })
        print("[e2e] created bank account")

    item_repo = ItemRepository(org_id)
    items, _ = item_repo.list(
        filters=[{"field": "sku", "op": "==", "value": "E2E-ITEM-1"}],
        limit=1,
    )
    if not items:
        item_repo.create({
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "name": "E2E Product",
            "sku": "E2E-ITEM-1",
            "selling_price": 1000,
            "stock_on_hand": 100,
            "is_trackable": True,
            "is_active": True,
            "e2e_marker": E2E_MARKER,
            "created_at": now,
        })
        print("[e2e] created item E2E-ITEM-1")

    print("[e2e] done — re-run: npm run e2e:shopkeeper")


if __name__ == "__main__":
    main()
