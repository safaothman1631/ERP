"""
Demo Data Seeder for Zoho ERP
==============================
Creates a demo organization with realistic Iraqi business data via HTTP API.

Usage:
    # Make sure backend is running on port 8000
    python backend/scripts/seed_demo_data.py

Output: prints the demo email + password at the end.
"""
import sys
import time
import random
from datetime import datetime, timedelta
from typing import Any

import requests

BASE = "http://127.0.0.1:8000"

DEMO_EMAIL = "demo@zohoerp.example.com"
DEMO_PASSWORD = "Demo@2026"
DEMO_ORG = "کۆمپانیای دیمۆ بۆ بازرگانی"
DEMO_USER = "بەڕێوەبەری دیمۆ"


def log(msg: str) -> None:
    print(f"[seed] {msg}", flush=True)


def post(path: str, token: str | None, body: dict) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = requests.post(f"{BASE}{path}", json=body, headers=headers, timeout=120)
    if r.status_code >= 400:
        raise RuntimeError(f"POST {path} -> {r.status_code}: {r.text[:300]}")
    return r.json() if r.text else {}


def get(path: str, token: str) -> Any:
    r = requests.get(
        f"{BASE}{path}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"GET {path} -> {r.status_code}: {r.text[:300]}")
    return r.json()


def wait_for_backend() -> None:
    log("waiting for backend...")
    for _ in range(30):
        try:
            r = requests.get(f"{BASE}/api/health", timeout=2)
            if r.status_code < 500:
                log("backend is up")
                return
        except Exception:
            time.sleep(1)
    raise RuntimeError("backend did not start in 30s")


def register_or_login() -> tuple[str, str]:
    """Try register; if email exists, login. Returns (token, org_id)."""
    try:
        log(f"registering demo org: {DEMO_EMAIL}")
        res = post("/api/auth/register", None, {
            "org_name": DEMO_ORG,
            "user_name": DEMO_USER,
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD,
            "currency_code": "IQD",
            "language": "ku",
        })
        return res["access_token"], res["org_id"]
    except RuntimeError as e:
        if "پێشتر تۆمارکراوە" in str(e) or "already" in str(e).lower() or "400" in str(e):
            log("demo email exists, logging in instead")
            res = post("/api/auth/login", None, {
                "email": DEMO_EMAIL,
                "password": DEMO_PASSWORD,
            })
            return res["access_token"], res["org_id"]
        raise


# ---------- Demo data definitions ----------

CUSTOMERS = [
    ("ئاسۆ تریدینگ", "info@aso.iq", "07501112233"),
    ("کۆمپانیای زاگرۆس", "sales@zagros.iq", "07502223344"),
    ("بازاڕی نەورۆز", "newroz@market.iq", "07503334455"),
    ("سەنتەری شار", "city@center.iq", "07504445566"),
    ("ڕۆژی ڕەنگاوڕەنگ", "rang@iq.com", "07505556677"),
    ("کارگەی هیوا", "hiwa@factory.iq", "07506667788"),
    ("فرۆشگای کوردستان", "kurd@store.iq", "07507778899"),
    ("ئەلکترۆنیکس پلەس", "elec@plus.iq", "07508889900"),
]

VENDORS = [
    ("کۆمپانیای هاوردە سامسۆن", "samson@import.iq", "07700001122"),
    ("بەشی دابینکار LG", "lg@vendor.iq", "07700002233"),
    ("کارگەی پلاستیک کوردستان", "plastic@kurd.iq", "07700003344"),
    ("هاوردەی ترکیا", "turkey@import.iq", "07700004455"),
    ("دابینکاری چین", "china@supply.iq", "07700005566"),
]

ITEMS = [
    # (name, sku, type, unit, sell, cost)
    ("تەلەفزیۆنی LG 55 ئینج", "TV-LG-55", "goods", "دانە", 850000, 600000),
    ("تەلەفزیۆنی Samsung 43 ئینج", "TV-SAM-43", "goods", "دانە", 600000, 420000),
    ("ساردکەری LG", "FRG-LG-01", "goods", "دانە", 900000, 650000),
    ("جلشۆری Bosch", "WSH-BSH-01", "goods", "دانە", 750000, 530000),
    ("مایکرۆوەیڤ Samsung", "MCR-SAM-01", "goods", "دانە", 220000, 150000),
    ("لاپتۆپ Dell i5", "LAP-DEL-I5", "goods", "دانە", 1200000, 950000),
    ("لاپتۆپ HP i7", "LAP-HP-I7", "goods", "دانە", 1700000, 1300000),
    ("مۆبایلی iPhone 15", "MOB-IP-15", "goods", "دانە", 2100000, 1700000),
    ("مۆبایلی Samsung S24", "MOB-S24", "goods", "دانە", 1800000, 1450000),
    ("هیدفۆنی Sony", "HP-SONY-01", "goods", "دانە", 180000, 110000),
    ("کیبۆردی گەیمەر", "KB-GAM-01", "goods", "دانە", 95000, 55000),
    ("ماوسی وایەرلێس", "MS-WL-01", "goods", "دانە", 35000, 18000),
    ("کێبڵی USB-C", "CBL-USB-C", "goods", "دانە", 12000, 5000),
    ("شارژەری 65W", "CHG-65W", "goods", "دانە", 45000, 22000),
    ("کیسەی لاپتۆپ", "BAG-LAP", "goods", "دانە", 55000, 28000),
    # Services
    ("خزمەتی چاککردنەوە", "SVC-REPAIR", "service", "کاتژمێر", 50000, 0),
    ("ڕاوێژی IT", "SVC-IT", "service", "کاتژمێر", 75000, 0),
    ("گەیاندن ناو شار", "SVC-DELIVERY", "service", "جار", 15000, 0),
    ("دامەزراندن", "SVC-INSTALL", "service", "جار", 40000, 0),
    ("گارانتیی زیادە", "SVC-WARRANTY", "service", "ساڵ", 100000, 0),
]


def seed_contacts(token: str) -> tuple[list[str], list[str]]:
    log("seeding contacts (customers + vendors)...")
    # idempotency: reuse existing
    try:
        existing = get("/api/contacts?page=1&page_size=500", token)
        if isinstance(existing, dict):
            existing = existing.get("items", [])
    except Exception:
        existing = []
    if len(existing) >= len(CUSTOMERS) + len(VENDORS):
        log("  contacts already seeded, reusing")
        c_ids = [c["id"] for c in existing if c.get("contact_type") == "customer"]
        v_ids = [c["id"] for c in existing if c.get("contact_type") == "vendor"]
        log(f"  -> {len(c_ids)} customers, {len(v_ids)} vendors (reused)")
        return c_ids, v_ids
    customer_ids: list[str] = []
    vendor_ids: list[str] = []
    for name, email, phone in CUSTOMERS:
        c = post("/api/contacts", token, {
            "contact_type": "customer",
            "display_name": name,
            "company_name": name,
            "email": email,
            "phone": phone,
            "currency_code": "IQD",
            "payment_terms": 30,
        })
        customer_ids.append(c["id"])
    for name, email, phone in VENDORS:
        v = post("/api/contacts", token, {
            "contact_type": "vendor",
            "display_name": name,
            "company_name": name,
            "email": email,
            "phone": phone,
            "currency_code": "IQD",
            "payment_terms": 45,
        })
        vendor_ids.append(v["id"])
    log(f"  -> {len(customer_ids)} customers, {len(vendor_ids)} vendors")
    return customer_ids, vendor_ids


def seed_items(token: str) -> list[dict]:
    log("seeding items...")
    try:
        existing = get("/api/items?page=1&page_size=500", token)
        if isinstance(existing, dict):
            existing = existing.get("items", [])
    except Exception:
        existing = []
    if len(existing) >= len(ITEMS):
        log(f"  items already seeded ({len(existing)}), reusing")
        return existing
    items = []
    for name, sku, itype, unit, sell, cost in ITEMS:
        it = post("/api/items", token, {
            "name": name,
            "sku": sku,
            "item_type": itype,
            "unit": unit,
            "selling_price": float(sell),
            "cost_price": float(cost),
            "is_trackable": itype == "goods",
        })
        items.append(it)
    log(f"  -> {len(items)} items")
    return items


def seed_invoices(token: str, customer_ids: list[str], items: list[dict], n: int = 15) -> list[dict]:
    log(f"seeding {n} invoices...")
    invoices = []
    today = datetime.utcnow()
    for i in range(n):
        cust = random.choice(customer_ids)
        n_lines = random.randint(1, 4)
        chosen = random.sample(items, n_lines)
        lines = []
        for it in chosen:
            qty = random.randint(1, 5)
            lines.append({
                "item_id": it["id"],
                "description": it["name"],
                "quantity": qty,
                "unit_price": it["selling_price"],
                "discount_percent": random.choice([0, 0, 0, 5, 10]),
            })
        date = today - timedelta(days=random.randint(0, 60))
        try:
            inv = post("/api/invoices", token, {
                "contact_id": cust,
                "date": date.isoformat(),
                "due_date": (date + timedelta(days=30)).isoformat(),
                "currency_code": "IQD",
                "exchange_rate": 1.0,
                "lines": lines,
                "notes": "فاکتووری دیمۆ بۆ تاقیکردنەوە",
            })
            invoices.append(inv)
            log(f"  invoice {i+1}/{n} ok ({inv.get('invoice_number','?')})")
        except Exception as e:
            log(f"  invoice {i+1}/{n} failed: {str(e)[:200]}")
    log(f"  -> {len(invoices)} invoices")
    return invoices


def seed_payments(token: str, invoices: list[dict]) -> int:
    log("seeding payments-received...")
    n = 0
    # Pay first 10 invoices fully
    for inv in invoices[:10]:
        try:
            total = float(inv.get("total") or inv.get("grand_total") or 0)
            if total <= 0:
                continue
            post("/api/payments-received", token, {
                "contact_id": inv["contact_id"],
                "date": datetime.utcnow().isoformat(),
                "amount": total,
                "payment_mode": random.choice(["cash", "bank_transfer", "fib"]),
                "currency_code": "IQD",
                "exchange_rate": 1.0,
                "allocations": [{"invoice_id": inv["id"], "amount": total}],
            })
            n += 1
        except RuntimeError as e:
            log(f"  ! payment skipped: {e}")
    log(f"  -> {n} payments")
    return n


def seed_expenses(token: str) -> int:
    log("seeding expenses...")
    # need an expense account + bank account; fetch first available
    try:
        accts = get("/api/accounts", token)
        if isinstance(accts, dict) and "items" in accts:
            accts = accts["items"]
    except Exception:
        accts = []
    expense_accts = [a for a in accts if a.get("account_type") in ("expense", "Expense")]
    bank_accts = [a for a in accts if a.get("account_type") in ("bank", "Bank", "cash", "Cash")]
    if not expense_accts:
        log("  ! no expense accounts found, skipping")
        return 0
    paid_through = bank_accts[0]["id"] if bank_accts else None
    n = 0
    descriptions = [
        "کرێی ئۆفیس", "کارەبا", "ئاو", "ئینتەرنێت", "سووتەمەنی",
        "کرێی فێرکار", "ڕیکلام", "نووسینگە", "خواردن بۆ تیم", "ڕاهێنان",
    ]
    for desc in descriptions:
        acct = random.choice(expense_accts)
        try:
            post("/api/expenses", token, {
                "date": (datetime.utcnow() - timedelta(days=random.randint(0, 60))).isoformat(),
                "account_id": acct["id"],
                "amount": float(random.randint(50, 500)) * 1000,
                "paid_through_account_id": paid_through,
                "description": desc,
                "currency_code": "IQD",
                "exchange_rate": 1.0,
            })
            n += 1
        except RuntimeError as e:
            log(f"  ! expense skipped: {e}")
    log(f"  -> {n} expenses")
    return n


def verify(token: str) -> None:
    log("verifying via dashboard...")
    try:
        d = get("/api/dashboard", token)
        log(f"  dashboard response keys: {list(d.keys()) if isinstance(d, dict) else type(d)}")
    except Exception as e:
        log(f"  dashboard skipped: {e}")
    try:
        invs = get("/api/invoices?page=1&page_size=5", token)
        total = invs.get("total") if isinstance(invs, dict) else len(invs)
        log(f"  invoices total: {total}")
    except Exception as e:
        log(f"  invoices skipped: {e}")
    try:
        cs = get("/api/contacts?page=1&page_size=5", token)
        total = cs.get("total") if isinstance(cs, dict) else len(cs)
        log(f"  contacts total: {total}")
    except Exception as e:
        log(f"  contacts skipped: {e}")


def main() -> int:
    random.seed(42)
    wait_for_backend()
    token, org_id = register_or_login()
    log(f"org_id = {org_id}")

    customers, vendors = seed_contacts(token)
    items = seed_items(token)
    invoices = seed_invoices(token, customers, items)
    seed_payments(token, invoices)
    seed_expenses(token)
    verify(token)

    print()
    print("=" * 60)
    print("  ZOHO ERP DEMO ACCOUNT READY")
    print("=" * 60)
    print(f"  URL:      http://localhost:5173")
    print(f"  Email:    {DEMO_EMAIL}")
    print(f"  Password: {DEMO_PASSWORD}")
    print(f"  Org ID:   {org_id}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
