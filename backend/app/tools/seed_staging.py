"""Synthetic staging-tenant seeder (launch-readiness § R3.4).

Provisions a fully-populated tenant for end-to-end testing on the staging
environment without polluting real customer data. Re-runnable: ``--reset``
deletes prior rows for the tenant before seeding.

Usage::

    python -m app.tools.seed_staging --tenant-id acme-staging
    python -m app.tools.seed_staging --tenant-id acme-staging --reset
    python -m app.tools.seed_staging --tenant-id acme-staging --dry-run

Seeded data:

  * Medium-SMB COA template (~70 accounts)
  * Tax rates per Baghdad governorate (R3.4)
  * 50 customers (Iraqi-named)
  * 10 vendors
  * 100 items across 5 categories
  * 5 bank accounts
  * 30 invoices with varied dates spanning the last 90 days

All writes go through the existing repository layer — we never bypass write
models or audit hooks. ``--reset`` uses the soft-delete cascade the repos
already implement; in a Cloud Run Job context, a final ``--hard-reset`` flag
would harden against the 30-day TTL, but that's deferred to a follow-up.

The Cloud Scheduler cron defined in
``infra/scheduler/staging-monthly-reset.yaml`` invokes this script with
``--reset`` on the 1st of every month at 02:00 Asia/Baghdad.
"""
from __future__ import annotations

import argparse
import logging
import random
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

logger = logging.getLogger("seed_staging")


# ── Sample data ─────────────────────────────────────────────────────────

IRAQI_FIRST_NAMES = [
    "Ali", "Hussein", "Hasan", "Mohammed", "Omar", "Ahmed", "Ibrahim",
    "Yusuf", "Karim", "Rashid", "Bilal", "Sami", "Khalil", "Tariq",
    "Salim", "Faisal", "Walid", "Nabil", "Jamal", "Adnan",
    "Layla", "Zainab", "Fatima", "Maryam", "Noor", "Hala", "Sara",
    "Dunya", "Rana", "Lina", "Amira", "Suha", "Lubna", "Iman",
    "Aram", "Rebin", "Diyari", "Hawkar", "Hêmin", "Roja", "Shîlan",
    "Çinar", "Nazê", "Berdar", "Kawa",
]
IRAQI_LAST_NAMES = [
    "Al-Baghdadi", "Al-Mosuli", "Al-Basri", "Al-Najafi", "Al-Karbalai",
    "Al-Anbari", "Al-Kurdi", "Al-Sulaimani", "Al-Erbili", "Al-Dohuki",
    "Saleh", "Hadi", "Mahmoud", "Khan", "Aziz", "Rahman", "Hamid",
    "Barzani", "Talabani", "Pîrbal", "Salahaddin", "Şêx Latif",
]
GOVERNORATES = [
    "Baghdad", "Basra", "Erbil", "Sulaymaniyah", "Dohuk", "Mosul",
    "Najaf", "Karbala", "Anbar", "Kirkuk",
]
ITEM_CATEGORIES = {
    "Electronics": ["Smartphone", "Laptop", "Headphones", "Power Bank", "Cable"],
    "Groceries": ["Rice 1kg", "Sugar 1kg", "Tea", "Olive Oil", "Bread"],
    "Apparel": ["T-Shirt", "Jeans", "Jacket", "Shoes", "Scarf"],
    "Home": ["Pillow", "Lamp", "Curtain", "Pan", "Mug"],
    "Services": ["Installation", "Consulting", "Repair", "Training", "Delivery"],
}
VENDOR_NAMES = [
    "Baghdad Wholesale Co.", "Erbil Imports Ltd.", "Basra Distributors",
    "Tigris Trading", "Euphrates Supply", "Mesopotamia Logistics",
    "Kurdistan Foodstuffs", "Mosul Hardware", "Najaf Textiles", "Anbar Office Supplies",
]
BANK_NAMES = ["Cihan Bank", "Trade Bank of Iraq", "Bank of Baghdad", "TBI", "Kurdistan International Bank"]
BAGHDAD_TAX_RATES = [
    {"name": "VAT 15%", "rate": 15.0, "tax_type": "vat"},
    {"name": "Sales Tax 10% — Hospitality", "rate": 10.0, "tax_type": "sales_tax"},
    {"name": "Sales Tax 20% — Telecom", "rate": 20.0, "tax_type": "sales_tax"},
    {"name": "Service Tax 5%", "rate": 5.0, "tax_type": "service_tax"},
    {"name": "Withholding Tax 3.3%", "rate": 3.3, "tax_type": "wht"},
    {"name": "Tax-Exempt", "rate": 0.0, "tax_type": "vat", "is_default": True},
]


# ── Targets ─────────────────────────────────────────────────────────────

TARGET_COUNTS = {
    "customers": 50,
    "vendors": 10,
    "items": 100,
    "bank_accounts": 5,
    "invoices": 30,
    "tax_rates": len(BAGHDAD_TAX_RATES),
}


# ── Seeder ──────────────────────────────────────────────────────────────

class StagingSeeder:
    """Provisions / resets a synthetic tenant.

    Built as a class so a future Cloud Run Job can construct it once and call
    ``seed()`` per-tenant without re-importing.
    """

    def __init__(self, tenant_id: str, *, dry_run: bool = False, seed: int = 42):
        self.tenant_id = tenant_id
        self.dry_run = dry_run
        self.rng = random.Random(seed)
        self.summary: dict[str, int] = {}

    # ── public API ──

    def reset(self) -> None:
        """Soft-deletes existing data on the tenant.

        We rely on the repos' built-in soft-delete + cascade rather than
        rewriting that logic here. For full data eviction (e.g. between test
        runs) call this method first then ``seed()``.
        """
        if self.dry_run:
            logger.info("[dry-run] would reset tenant=%s", self.tenant_id)
            return
        logger.info("Resetting tenant=%s", self.tenant_id)
        from app.firestore.accounts import AccountRepository
        from app.firestore.banking import BankAccountRepository
        from app.firestore.contacts import ContactRepository
        from app.firestore.invoices import InvoiceRepository
        from app.firestore.items import ItemRepository
        from app.firestore.taxes import TaxRepository

        for repo_cls in (
            InvoiceRepository, ItemRepository, ContactRepository,
            BankAccountRepository, AccountRepository, TaxRepository,
        ):
            repo = repo_cls(self.tenant_id)
            try:
                items, _ = repo.list(limit=500)
            except Exception as exc:
                logger.warning("reset list failed cls=%s err=%s", repo_cls.__name__, exc)
                continue
            for it in items:
                try:
                    repo.delete(it["id"])  # soft-delete by default
                except Exception as exc:
                    logger.debug("reset skip cls=%s id=%s err=%s", repo_cls.__name__, it["id"], exc)
        logger.info("Reset complete tenant=%s", self.tenant_id)

    def seed(self) -> dict[str, int]:
        logger.info("Seeding tenant=%s dry_run=%s", self.tenant_id, self.dry_run)
        self._seed_chart_of_accounts()
        self._seed_tax_rates()
        self._seed_customers()
        self._seed_vendors()
        self._seed_items()
        self._seed_bank_accounts()
        self._seed_invoices()
        logger.info("Seed complete tenant=%s summary=%s", self.tenant_id, self.summary)
        return dict(self.summary)

    # ── individual steps ──

    def _seed_chart_of_accounts(self) -> None:
        if self.dry_run:
            self.summary["accounts"] = 70  # medium_smb size
            logger.info("[dry-run] would seed medium_smb COA")
            return
        from app.firestore.onboarding_repo import apply_coa

        result = apply_coa(self.tenant_id, "medium_smb", overrides=[])
        self.summary["accounts"] = result["accounts_created"]
        logger.info("Seeded %d accounts (medium_smb)", result["accounts_created"])

    def _seed_tax_rates(self) -> None:
        count = 0
        if self.dry_run:
            self.summary["tax_rates"] = TARGET_COUNTS["tax_rates"]
            logger.info("[dry-run] would seed %d Baghdad tax rates", TARGET_COUNTS["tax_rates"])
            return
        from app.firestore.taxes import TaxRepository

        repo = TaxRepository(self.tenant_id)
        for row in BAGHDAD_TAX_RATES:
            try:
                repo.create({**row, "is_active": True, "governorate": "Baghdad"})
                count += 1
            except Exception as exc:
                logger.warning("tax_rate create failed name=%s err=%s", row["name"], exc)
        self.summary["tax_rates"] = count
        logger.info("Seeded %d tax rates", count)

    def _seed_customers(self) -> None:
        if self.dry_run:
            self.summary["customers"] = TARGET_COUNTS["customers"]
            logger.info("[dry-run] would seed %d customers", TARGET_COUNTS["customers"])
            return
        from app.firestore.contacts import ContactRepository

        repo = ContactRepository(self.tenant_id)
        count = 0
        for i in range(TARGET_COUNTS["customers"]):
            first = self.rng.choice(IRAQI_FIRST_NAMES)
            last = self.rng.choice(IRAQI_LAST_NAMES)
            display = f"{first} {last}"
            try:
                repo.create({
                    "display_name": display,
                    "name": display,
                    "contact_type": "customer",
                    "email": f"{first.lower()}.{i}@staging.example.iq",
                    "phone": f"+9647{self.rng.randint(50, 99)}{self.rng.randint(1000000, 9999999)}",
                    "currency_code": "IQD",
                    "is_active": True,
                })
                count += 1
            except Exception as exc:
                logger.warning("customer create failed i=%d err=%s", i, exc)
        self.summary["customers"] = count
        logger.info("Seeded %d customers", count)

    def _seed_vendors(self) -> None:
        if self.dry_run:
            self.summary["vendors"] = TARGET_COUNTS["vendors"]
            logger.info("[dry-run] would seed %d vendors", TARGET_COUNTS["vendors"])
            return
        from app.firestore.contacts import ContactRepository

        repo = ContactRepository(self.tenant_id)
        count = 0
        for name in VENDOR_NAMES[: TARGET_COUNTS["vendors"]]:
            try:
                repo.create({
                    "display_name": name,
                    "name": name,
                    "contact_type": "vendor",
                    "currency_code": "IQD",
                    "is_active": True,
                })
                count += 1
            except Exception as exc:
                logger.warning("vendor create failed name=%s err=%s", name, exc)
        self.summary["vendors"] = count
        logger.info("Seeded %d vendors", count)

    def _seed_items(self) -> None:
        if self.dry_run:
            self.summary["items"] = TARGET_COUNTS["items"]
            logger.info("[dry-run] would seed %d items across %d categories",
                        TARGET_COUNTS["items"], len(ITEM_CATEGORIES))
            return
        from app.firestore.items import ItemRepository

        repo = ItemRepository(self.tenant_id)
        per_category = TARGET_COUNTS["items"] // len(ITEM_CATEGORIES)
        count = 0
        for category, base_names in ITEM_CATEGORIES.items():
            for i in range(per_category):
                base = self.rng.choice(base_names)
                price = self.rng.choice([1000, 2500, 5000, 7500, 10000, 25000, 50000])
                try:
                    repo.create({
                        "name": f"{base} #{i:03d}",
                        "sku": f"{category[:3].upper()}-{i:04d}",
                        "item_type": "service" if category == "Services" else "product",
                        "selling_price": float(price),
                        "cost_price": float(price) * 0.65,
                        "stock_on_hand": 0.0 if category == "Services" else float(self.rng.randint(0, 200)),
                        "currency_code": "IQD",
                        "is_active": True,
                        "available_in_pos": True,
                    })
                    count += 1
                except Exception as exc:
                    logger.warning("item create failed cat=%s i=%d err=%s", category, i, exc)
        self.summary["items"] = count
        logger.info("Seeded %d items", count)

    def _seed_bank_accounts(self) -> None:
        if self.dry_run:
            self.summary["bank_accounts"] = TARGET_COUNTS["bank_accounts"]
            logger.info("[dry-run] would seed %d bank accounts", TARGET_COUNTS["bank_accounts"])
            return
        from app.firestore.banking import BankAccountRepository

        repo = BankAccountRepository(self.tenant_id)
        count = 0
        for i, bank in enumerate(BANK_NAMES[: TARGET_COUNTS["bank_accounts"]]):
            try:
                repo.create({
                    "name": f"{bank} — Main",
                    "bank_name": bank,
                    "account_number": f"IQ{self.rng.randint(10_000_000, 99_999_999)}",
                    "currency": "IQD",
                    "opening_balance": float(self.rng.randint(10_000_000, 200_000_000)),
                    "is_active": True,
                })
                count += 1
            except Exception as exc:
                logger.warning("bank account create failed i=%d err=%s", i, exc)
        self.summary["bank_accounts"] = count
        logger.info("Seeded %d bank accounts", count)

    def _seed_invoices(self) -> None:
        target = TARGET_COUNTS["invoices"]
        if self.dry_run:
            self.summary["invoices"] = target
            logger.info("[dry-run] would seed %d invoices over the last 90 days", target)
            return
        from app.firestore.contacts import ContactRepository
        from app.firestore.invoices import InvoiceRepository

        contacts_repo = ContactRepository(self.tenant_id)
        customers, _ = contacts_repo.list(
            filters=[{"field": "contact_type", "op": "==", "value": "customer"}], limit=200,
        )
        if not customers:
            logger.warning("no customers seeded — skipping invoices")
            self.summary["invoices"] = 0
            return

        repo = InvoiceRepository(self.tenant_id)
        count = 0
        today = datetime.utcnow().date()
        # Realistic status mix per design.md § 3.4 (60/20/15/5 paid/partial/open/overdue).
        status_pool = (
            ["paid"] * 18 + ["partially_paid"] * 6 + ["sent"] * 4 + ["overdue"] * 2
        )
        self.rng.shuffle(status_pool)
        for i in range(target):
            customer = self.rng.choice(customers)
            days_ago = self.rng.randint(0, 90)
            inv_date = today - timedelta(days=days_ago)
            due_date = inv_date + timedelta(days=30)
            subtotal = float(self.rng.randint(50_000, 2_500_000))
            tax = round(subtotal * 0.15, 2)
            total = round(subtotal + tax, 2)
            status = status_pool[i % len(status_pool)]
            amount_paid = total if status == "paid" else (
                round(total * 0.5, 2) if status == "partially_paid" else 0.0
            )
            try:
                repo.create({
                    "invoice_number": f"INV-S-{i+1:05d}",
                    "contact_id": customer["id"],
                    "date": inv_date.isoformat(),
                    "due_date": due_date.isoformat(),
                    "status": status,
                    "subtotal": subtotal,
                    "tax_amount": tax,
                    "total": total,
                    "amount_paid": amount_paid,
                    "balance_due": round(total - amount_paid, 2),
                    "currency_code": "IQD",
                })
                count += 1
            except Exception as exc:
                logger.warning("invoice create failed i=%d err=%s", i, exc)
        self.summary["invoices"] = count
        logger.info("Seeded %d invoices", count)


# ── CLI ─────────────────────────────────────────────────────────────────

def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="seed_staging",
        description="Seed a synthetic tenant for the staging environment.",
    )
    parser.add_argument(
        "--tenant-id", required=True,
        help="Target tenant id (e.g. acme-staging-2026).",
    )
    parser.add_argument(
        "--reset", action="store_true",
        help="Soft-delete existing data on the tenant before seeding.",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Log what would happen without writing to Firestore.",
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="RNG seed for reproducible fake data (default: 42).",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Enable DEBUG-level logging.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    seeder = StagingSeeder(args.tenant_id, dry_run=args.dry_run, seed=args.seed)
    if args.reset:
        seeder.reset()
    summary = seeder.seed()
    logger.info("Done. tenant=%s totals=%s", args.tenant_id, summary)
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
