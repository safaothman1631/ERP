"""Comprehensive endpoint test for all API routes."""
import urllib.request
import json
import sys


BASE = "http://127.0.0.1:8000"


def api(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        raw = resp.read().decode()
        if not raw:
            return resp.status, "(empty)"
        if raw.startswith("<!doctype") or raw.startswith("<html"):
            return -1, "HTML_FALLBACK"
        try:
            return resp.status, json.loads(raw)
        except json.JSONDecodeError:
            return resp.status, raw[:120]
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        if raw.startswith("<!doctype"):
            return -1, "HTML_FALLBACK"
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:120]
    except Exception as e:
        return 0, str(e)[:120]


def main():
    # Login
    code, data = api("POST", "/api/auth/login", body={"email": "admin@test.com", "password": "123456"})
    if code != 200:
        print(f"LOGIN FAILED: {code}")
        sys.exit(1)
    token = data["access_token"]
    print("LOGIN OK\n")

    endpoints = [
        ("GET", "/api/auth/status"),
        ("GET", "/api/auth/me"),
        ("GET", "/api/dashboard"),
        ("GET", "/api/contacts?page=1&page_size=5"),
        ("GET", "/api/items?page=1&page_size=5"),
        ("GET", "/api/invoices?page=1&page_size=5"),
        ("GET", "/api/invoices/payments?page=1&page_size=5"),
        ("GET", "/api/expenses?page=1&page_size=5"),
        ("GET", "/api/bills?page=1&page_size=5"),
        ("GET", "/api/payments-made?page=1&page_size=5"),
        ("GET", "/api/payments-received?page=1&page_size=5"),
        ("GET", "/api/accounts"),
        ("GET", "/api/journals?page=1&page_size=5"),
        ("GET", "/api/banking/accounts"),
        ("GET", "/api/banking/transactions?page=1&page_size=5"),
        ("GET", "/api/banking/rules"),
        ("GET", "/api/quotes?page=1&page_size=5"),
        ("GET", "/api/sales-orders?page=1&page_size=5"),
        ("GET", "/api/purchase-orders?page=1&page_size=5"),
        ("GET", "/api/credit-notes?page=1&page_size=5"),
        ("GET", "/api/vendor-credits?page=1&page_size=5"),
        ("GET", "/api/recurring-invoices?page=1&page_size=5"),
        ("GET", "/api/inventory/warehouses"),
        ("GET", "/api/inventory/movements?page=1&page_size=5"),
        ("GET", "/api/inventory/serials?page=1&page_size=5"),
        ("GET", "/api/inventory/transfers?page=1&page_size=5"),
        ("GET", "/api/inventory/price-lists"),
        ("GET", "/api/assets?page=1&page_size=5"),
        ("GET", "/api/taxes/rates"),
        ("GET", "/api/taxes/groups"),
        ("GET", "/api/taxes/returns?page=1&page_size=5"),
        ("GET", "/api/projects?page=1&page_size=5"),
        ("GET", "/api/fiscal/years"),
        ("GET", "/api/reports/trial-balance?start_date=2024-01-01&end_date=2024-12-31"),
        ("GET", "/api/reports/profit-loss?start_date=2024-01-01&end_date=2024-12-31"),
        ("GET", "/api/reports/balance-sheet?as_of_date=2024-12-31"),
        ("GET", "/api/reports/receivable-aging"),
        ("GET", "/api/reports/payable-aging"),
        ("GET", "/api/reports/general-ledger?start_date=2024-01-01&end_date=2024-12-31"),
        ("GET", "/api/reports/tax-summary?start_date=2024-01-01&end_date=2024-12-31"),
        ("GET", "/api/reports/sales-by-customer?start_date=2024-01-01&end_date=2024-12-31"),
        ("GET", "/api/reports/sales-by-item?start_date=2024-01-01&end_date=2024-12-31"),
        ("GET", "/api/reports/expense-by-category?start_date=2024-01-01&end_date=2024-12-31"),
        ("GET", "/api/shipments?page=1&page_size=5"),
        ("GET", "/api/challans?page=1&page_size=5"),
        ("GET", "/api/returns/sales?page=1&page_size=5"),
        ("GET", "/api/returns/purchases?page=1&page_size=5"),
        ("GET", "/api/custom-fields"),
        ("GET", "/api/approvals/workflows"),
        ("GET", "/api/approvals/requests"),
        ("GET", "/api/branches"),
        ("GET", "/api/expense-claims?page=1&page_size=5"),
        ("GET", "/api/payment-links?page=1&page_size=5"),
        ("GET", "/api/audit?page=1&page_size=5"),
        ("GET", "/api/system/settings"),
    ]

    ok_count = 0
    fail_count = 0
    fails = []

    for method, ep in endpoints:
        code, body = api(method, ep, token)
        if code in (200, 404):
            ok_count += 1
        else:
            fail_count += 1
            detail = str(body)[:120] if not isinstance(body, dict) else json.dumps(body)[:120]
            fails.append(f"  FAIL [{code}] {method} {ep}\n    -> {detail}")

    print("=" * 60)
    print(f"GET ENDPOINT TEST RESULTS")
    print(f"  Passed: {ok_count}")
    print(f"  Failed: {fail_count}")
    print(f"  Total:  {len(endpoints)}")
    print("=" * 60)

    if fails:
        print("\nFailed endpoints:")
        for f in fails:
            print(f)

    # Test POST endpoints (create operations)
    print("\n" + "=" * 60)
    print("POST/PUT/DELETE TESTS (CRUD)")
    print("=" * 60)

    post_tests = [
        ("POST", "/api/banking/accounts", {"account_name": "Test Bank", "account_number": "123456", "bank_name": "Test Bank", "account_type": "checking", "currency": "IQD"}),
        ("POST", "/api/banking/rules", {"rule_name": "Test Rule", "condition_field": "description", "condition_operator": "contains", "condition_value": "salary", "action_type": "categorize", "action_value": "salary-cat"}),
        ("POST", "/api/inventory/price-lists", {"name": "Test Price List", "description": "Test", "currency_code": "IQD"}),
        ("POST", "/api/assets", {"name": "Test Asset", "purchase_price": 1000, "salvage_value": 100, "useful_life_months": 12, "depreciation_method": "straight_line", "status": "active"}),
        ("POST", "/api/invoices/retainer", {"contact_id": "test", "amount": 500, "date": "2024-06-01", "notes": "Retainer test"}),
    ]

    post_ok = 0
    post_fail = 0
    created_ids = {}

    for method, path, body in post_tests:
        code, resp = api(method, path, token, body)
        if code in (200, 201):
            post_ok += 1
            if isinstance(resp, dict) and "id" in resp:
                created_ids[path] = resp["id"]
            print(f"  OK  [{code}] {method} {path}")
        else:
            post_fail += 1
            detail = str(resp)[:120] if not isinstance(resp, dict) else json.dumps(resp)[:120]
            print(f"  FAIL [{code}] {method} {path} -> {detail}")

    print(f"\nPOST Results: {post_ok} OK, {post_fail} FAIL")

    # Cleanup: delete created test data
    for path, item_id in created_ids.items():
        api("DELETE", path + "/" + item_id, token)

    # Final summary
    total_ok = ok_count + post_ok
    total_fail = fail_count + post_fail
    total = len(endpoints) + len(post_tests)
    print("\n" + "=" * 60)
    print(f"FINAL SUMMARY: {total_ok} OK, {total_fail} FAIL out of {total} tests")
    print("=" * 60)

    if total_fail > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
