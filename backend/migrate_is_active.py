"""
One-time migration: Add is_active=True to all Firestore documents missing the field.
Run: cd backend && python migrate_is_active.py

SAFE: Uses batch writes, skips docs that already have is_active (True or False).
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import logging
logging.disable(logging.CRITICAL)

from app.firebase_client import init_firebase, get_db

COLLECTIONS = [
    # Contacts & Items
    "contacts",
    "items",
    "item_groups",
    # Accounts & Journals
    "accounts",
    "journal_entries",
    # Sales
    "invoices",
    "quotes",
    "sales_orders",
    "credit_notes",
    "recurring_invoices",
    "payments_received",
    # Purchases
    "bills",
    "purchase_orders",
    "vendor_credits",
    "recurring_bills",
    # Expenses
    "expenses",
    "expense_claims",
    "mileage_logs",
    # Banking
    "bank_accounts",
    "bank_transactions",
    "bank_rules",
    # Inventory
    "warehouses",
    "price_lists",
    "inventory_adjustments",
    # Assets
    "fixed_assets",
    # Projects
    "projects",
    # Tax
    "tax_rates",
    "tax_groups",
    "withholding_taxes",
    # Config
    "reporting_tags",
    "branches",
    "custom_field_definitions",
    "attachments",
    "comments",
    # Payments
    "payments_made",
    "payment_links",
]

BATCH_SIZE = 400  # Firestore limit 500, safe margin


def migrate_collection(db, name: str) -> tuple:
    """Returns (total_scanned, total_updated)"""
    total = updated = 0
    batch = db.batch()
    count_in_batch = 0

    try:
        for doc in db.collection(name).stream():
            total += 1
            d = doc.to_dict() or {}
            if "is_active" not in d:
                batch.update(doc.reference, {"is_active": True})
                updated += 1
                count_in_batch += 1
                if count_in_batch >= BATCH_SIZE:
                    batch.commit()
                    batch = db.batch()
                    count_in_batch = 0

        if count_in_batch > 0:
            batch.commit()
    except Exception as e:
        raise e

    return total, updated


def run():
    init_firebase()
    db = get_db()
    grand_total = 0
    grand_updated = 0
    errors = []

    print("=" * 60)
    print("  is_active Migration — Zoho Books Clone")
    print("=" * 60)

    for coll in COLLECTIONS:
        try:
            total, upd = migrate_collection(db, coll)
            grand_total += total
            grand_updated += upd
            if upd:
                print(f"  ✓  {coll:<40} {total:>4} docs   {upd} fixed")
            else:
                print(f"  ·  {coll:<40} {total:>4} docs   OK")
        except Exception as e:
            errors.append((coll, str(e)))
            print(f"  ✗  {coll:<40} ERROR: {e}")

    print("-" * 60)
    print(f"  TOTAL: {grand_updated}/{grand_total} documents updated")
    if errors:
        print(f"\n  {len(errors)} ERROR(S):")
        for c, e in errors:
            print(f"    {c}: {e}")
    print("=" * 60)


if __name__ == "__main__":
    run()
