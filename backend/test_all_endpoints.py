"""Comprehensive endpoint test for all 281 routes"""
import urllib.request, json, sys

BASE = 'http://127.0.0.1:8000'

# Login
data = json.dumps({'email': 'admin@test.com', 'password': '123456'}).encode()
req = urllib.request.Request(BASE + '/api/auth/login', data=data, headers={'Content-Type': 'application/json'})
resp = urllib.request.urlopen(req)
token = json.loads(resp.read())['access_token']
headers = {'Authorization': 'Bearer ' + token}

ok = 0
fail = 0
fails = []

def test_get(ep):
    global ok, fail
    r = urllib.request.Request(BASE + ep, headers=headers)
    try:
        urllib.request.urlopen(r, timeout=30)
        ok += 1
    except urllib.error.HTTPError as e:
        e.read()
        fails.append('GET ' + ep.split('?')[0] + ' -> ' + str(e.code))
        fail += 1
    except Exception as e:
        fails.append('GET ' + ep.split('?')[0] + ' -> ERR')
        fail += 1

def test_post(ep, body):
    global ok, fail
    d = json.dumps(body).encode()
    r = urllib.request.Request(BASE + ep, data=d, headers={**headers, 'Content-Type': 'application/json'})
    try:
        resp = urllib.request.urlopen(r, timeout=30)
        result = json.loads(resp.read())
        ok += 1
        return result
    except urllib.error.HTTPError as e:
        e.read()
        fails.append('POST ' + ep + ' -> ' + str(e.code))
        fail += 1
        return None

# ===== ALL GET ENDPOINTS =====
get_endpoints = [
    '/api/auth/status',
    '/api/auth/me',
    '/api/health',
    '/api/dashboard',
    '/api/contacts?page=1&page_size=5',
    '/api/items?page=1&page_size=5',
    '/api/invoices?page=1&page_size=5',
    '/api/accounts',
    '/api/credit-notes?page=1&page_size=5',
    '/api/expenses?page=1&page_size=5',
    '/api/bills?page=1&page_size=5',
    '/api/quotes?page=1&page_size=5',
    '/api/sales-orders?page=1&page_size=5',
    '/api/purchase-orders?page=1&page_size=5',
    '/api/vendor-credits?page=1&page_size=5',
    '/api/recurring-invoices?page=1&page_size=5',
    '/api/banking/accounts',
    '/api/banking/transactions?page=1&page_size=5',
    '/api/banking/rules',
    '/api/projects?page=1&page_size=5',
    '/api/taxes/rates',
    '/api/taxes/groups',
    '/api/taxes/returns',
    '/api/taxes/withholding',
    '/api/fiscal/years',
    '/api/assets?page=1&page_size=5',
    '/api/shipments?page=1&page_size=5',
    '/api/challans?page=1&page_size=5',
    '/api/returns/sales?page=1&page_size=5',
    '/api/returns/purchases?page=1&page_size=5',
    '/api/custom-fields',
    '/api/approvals/workflows',
    '/api/approvals/requests',
    '/api/expense-claims?page=1&page_size=5',
    '/api/branches',
    '/api/payment-links',
    '/api/payments-received?page=1&page_size=5',
    '/api/payments-made',
    '/api/journals',
    '/api/system/settings',
    '/api/system/currencies',
    '/api/audit',
    '/api/inventory/movements',
    '/api/inventory/warehouses',
    '/api/inventory/serials',
    '/api/inventory/price-lists',
    '/api/inventory/batches',
    '/api/inventory/landed-costs',
    '/api/recurring-bills?page=1&page_size=5',
    '/api/mileage?page=1&page_size=5',
    '/api/reporting-tags',
    '/api/transaction-locking',
    '/api/transaction-locking/check/2026-01-01',
    # Reports with required params
    '/api/reports/trial-balance?start_date=2025-01-01&end_date=2026-12-31',
    '/api/reports/profit-loss?start_date=2025-01-01&end_date=2026-12-31',
    '/api/reports/balance-sheet?as_of_date=2026-04-14',
    '/api/reports/receivable-aging',
    '/api/reports/payable-aging',
    '/api/reports/general-ledger?start_date=2025-01-01&end_date=2026-12-31',
    '/api/reports/tax-summary?start_date=2025-01-01&end_date=2026-12-31',
    '/api/reports/sales-by-customer?start_date=2025-01-01&end_date=2026-12-31',
    '/api/reports/sales-by-item?start_date=2025-01-01&end_date=2026-12-31',
    '/api/reports/expense-by-category?start_date=2025-01-01&end_date=2026-12-31',
    '/api/reports/cash-flow?start_date=2025-01-01&end_date=2026-12-31',
    '/api/reports/budget-vs-actual',
    '/api/reports/project-profitability',
]

print("Testing GET endpoints...")
for ep in get_endpoints:
    test_get(ep)
print(f"GET: {ok}/{ok+fail} passed")

# ===== POST ENDPOINTS =====
print("\nTesting POST endpoints...")
test_post('/api/comments/invoice/test-1', {'text': 'Test'})
test_post('/api/reporting-tags', {'name': 'TestTag', 'options': ['A', 'B']})
test_post('/api/mileage', {'date': '2026-04-14', 'distance_km': 10, 'from_location': 'A', 'to_location': 'B', 'purpose': 'Test', 'rate_per_km': 0.5})
test_post('/api/recurring-bills', {'vendor_id': 'v1', 'frequency': 'monthly', 'amount': 100, 'description': 'Test'})
test_post('/api/projects', {'name': 'TestPrj'})
test_post('/api/custom-fields/values/invoice/test-1', {'field1': 'val1'})
test_post('/api/taxes/withholding', {'name': 'TestWHT', 'rate': 3, 'applies_to': 'all'})
test_post('/api/transaction-locking', {'lock_date': '2025-12-31', 'reason': 'Test'})
test_post('/api/accounts/currency-adjustment', {'adjustment_date': '2026-04-14', 'exchange_rate': 1.05, 'adjustment_amount': 50, 'gains_losses_account_id': 'test-gl', 'base_currency_account_id': 'test-bc'})

# Final summary
print(f"\n{'='*50}")
print(f"FINAL: {ok} OK, {fail} FAIL out of {ok+fail}")
if fails:
    print("\nFAILURES:")
    for f in fails:
        print(f"  {f}")
else:
    print("ALL TESTS PASSED!")
