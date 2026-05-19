"""Comprehensive local API test."""
import requests
import json
import sys

BASE = "http://127.0.0.1:8000"

def login():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": "admin@test.com", "password": "Admin@123456"}, timeout=10)
    if r.status_code != 200:
        print(f"❌ Login failed: {r.status_code} {r.text}")
        sys.exit(1)
    token = r.json()["access_token"]
    print(f"[OK] Login OK - User: {r.json()['user_name']}")
    return token

def test(token):
    h = {"Authorization": f"Bearer {token}"}
    results = []

    # ── Core endpoints ──────────────────────────────────────────────────────
    endpoints = [
        ("GET", "/api/ready", None, "Readiness"),
        ("GET", "/api/auth/status", None, "Auth Status"),
        ("GET", "/api/auth/me", None, "Current User"),
        ("GET", "/api/contacts?page_size=3", None, "Contacts List"),
        ("GET", "/api/invoices?page_size=3", None, "Invoices List"),
        ("GET", "/api/bills?page_size=3", None, "Bills List"),
        ("GET", "/api/items?page_size=3", None, "Items List"),
        ("GET", "/api/accounts?page_size=3", None, "Accounts List"),
        ("GET", "/api/purchase-orders?page_size=3", None, "Purchase Orders"),
        ("GET", "/api/taxes?page_size=3", None, "Taxes"),
        ("GET", "/api/dashboard/summary", None, "Dashboard Summary"),
        ("GET", "/api/reports/profit-loss", None, "P&L Report"),
        ("GET", "/api/banking?page_size=3", None, "Banking"),
        ("GET", "/api/hr/employees?page_size=3", None, "HR Employees"),
        ("GET", "/api/inventory?page_size=3", None, "Inventory"),
    ]

    for method, path, body, name in endpoints:
        try:
            if method == "GET":
                r = requests.get(f"{BASE}{path}", headers=h, timeout=8)
            else:
                r = requests.post(f"{BASE}{path}", headers=h, json=body, timeout=8)
            ok = r.status_code < 400
            icon = "✅" if ok else "❌"
            print(f"  {icon} {name:30s} → {r.status_code}")
            results.append((name, ok, r.status_code))
        except Exception as e:
            print(f"  ❌ {name:30s} → ERROR: {e}")
            results.append((name, False, 0))

    # ── Create operations ───────────────────────────────────────────────────
    print("\n── Create operations ──")

    # Create contact
    r = requests.post(f"{BASE}/api/contacts", headers=h, json={
        "display_name": "API Test Vendor",
        "contact_type": "vendor",
        "email": "apitest@vendor.com"
    }, timeout=10)
    if r.status_code in (200, 201):
        vendor_id = r.json().get("id")
        print(f"  ✅ Create Vendor                → {r.status_code} (ID: {vendor_id[:8]}...)")
    else:
        vendor_id = None
        print(f"  ❌ Create Vendor                → {r.status_code}: {r.text[:100]}")

    # Create customer
    r = requests.post(f"{BASE}/api/contacts", headers=h, json={
        "display_name": "API Test Customer",
        "contact_type": "customer",
        "email": "apitest@customer.com"
    }, timeout=10)
    if r.status_code in (200, 201):
        customer_id = r.json().get("id")
        print(f"  ✅ Create Customer              → {r.status_code} (ID: {customer_id[:8]}...)")
    else:
        customer_id = None
        print(f"  ❌ Create Customer              → {r.status_code}: {r.text[:100]}")

    # Create invoice
    if customer_id:
        r = requests.post(f"{BASE}/api/invoices", headers=h, json={
            "contact_id": customer_id,
            "date": "2026-05-18",
            "due_date": "2026-06-18",
            "currency_code": "IQD",
            "lines": [{"description": "Test Service", "quantity": 1, "unit_price": 100000, "discount_percent": 0, "tax_rate": 0}]
        }, timeout=10)
        if r.status_code in (200, 201):
            inv = r.json()
            print(f"  ✅ Create Invoice               → {r.status_code} #{inv.get('invoice_number')} total={inv.get('total')}")
        else:
            print(f"  ❌ Create Invoice               → {r.status_code}: {r.text[:100]}")

    # Create bill
    if vendor_id:
        r = requests.post(f"{BASE}/api/bills", headers=h, json={
            "contact_id": vendor_id,
            "date": "2026-05-18",
            "currency_code": "IQD",
            "lines": [{"description": "Office Supplies", "quantity": 1, "rate": 50000, "tax_rate": 0}]
        }, timeout=10)
        if r.status_code in (200, 201):
            bill = r.json()
            print(f"  ✅ Create Bill                  → {r.status_code} #{bill.get('bill_number')} total={bill.get('total')}")
        else:
            print(f"  ❌ Create Bill                  → {r.status_code}: {r.text[:100]}")

    # ── Summary ─────────────────────────────────────────────────────────────
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{total} passed")
    if passed == total:
        print("✅ ALL TESTS PASSED")
    else:
        failed = [(n, c) for n, ok, c in results if not ok]
        print(f"❌ Failed: {[f'{n}({c})' for n, c in failed]}")

if __name__ == "__main__":
    token = login()
    test(token)
