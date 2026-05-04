"""Comprehensive test for all Zoho Books APIs"""
import json, sys, os, urllib.request, urllib.error

# Fix encoding for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://localhost:8000"
TOKEN = None
RESULTS = {"pass": 0, "fail": 0, "errors": []}

def req(method, path, data=None, expect=None):
    """Make HTTP request and check result"""
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    body = json.dumps(data).encode() if data else None
    try:
        r = urllib.request.Request(url, data=body, headers=headers, method=method)
        resp = urllib.request.urlopen(r)
        result = json.loads(resp.read().decode())
        code = resp.status
    except urllib.error.HTTPError as e:
        code = e.code
        try:
            result = json.loads(e.read().decode())
        except Exception:
            result = {}
    except Exception as e:
        code = 0
        result = {"error": str(e)}
    
    ok = True
    if expect:
        # When expect is provided, ONLY the explicit list determines pass/fail
        if code not in (expect if isinstance(expect, list) else [expect]):
            ok = False
    elif code >= 400:
        ok = False
    return ok, code, result

def test(name, method, path, data=None, expect=None):
    ok, code, result = req(method, path, data, expect)
    if ok:
        RESULTS["pass"] += 1
        print(f"  ✅ {name} ({code})")
    else:
        RESULTS["fail"] += 1
        detail = result.get("detail", result) if isinstance(result, dict) else result
        RESULTS["errors"].append(f"{name}: {code} - {detail}")
        print(f"  ❌ {name} ({code}) - {detail}")
    return ok, code, result

# ==================== AUTH ====================
print("\n🔐 AUTH")

# First-time setup (creates org + admin + seed data)
setup_ok, setup_code, setup_r = test("Setup", "POST", "/api/auth/setup", {
    "org_name": "Test Company",
    "currency_code": "IQD",
    "language": "ku",
    "user_name": "Admin",
    "email": "admin@test.com",
    "password": "12345678"
}, expect=[200, 400, 422])  # 400/422 if already set up

if setup_ok and setup_r.get("access_token"):
    TOKEN = setup_r["access_token"]
    print(f"     Token from setup ✓")

# Login
ok, code, r = test("Login", "POST", "/api/auth/login", {"email": "admin@test.com", "password": "123456"})
if ok:
    TOKEN = r.get("access_token")
    print(f"     Token obtained ✓")
else:
    print("❌ Cannot proceed without login!")
    sys.exit(1)

# ==================== CONTACTS ====================
print("\n👥 CONTACTS")
test("List contacts", "GET", "/api/contacts?page=1&page_size=10")

_, _, r = test("Create customer", "POST", "/api/contacts", {
    "display_name": "Test Customer", "contact_type": "customer",
    "email": "cust@test.com", "phone": "0750111"
})
CUSTOMER_ID = r.get("id")

_, _, r = test("Create vendor", "POST", "/api/contacts", {
    "display_name": "Test Vendor", "contact_type": "vendor",
    "email": "vend@test.com", "phone": "0750222"
})
VENDOR_ID = r.get("id")

# ==================== ACCOUNTS ====================
print("\n📒 ACCOUNTS")
_, _, accts = test("List accounts", "GET", "/api/accounts")
# Accounts API returns flat list, not paginated
ACCOUNT_ID = None
EXPENSE_ACCOUNT_ID = None
CASH_ACCOUNT_ID = None
acct_list = accts if isinstance(accts, list) else accts.get("items", [])
for a in acct_list:
    at = a.get("account_type", "")
    if at == "income" and not ACCOUNT_ID:
        ACCOUNT_ID = a["id"]
    if at == "expense" and not EXPENSE_ACCOUNT_ID:
        EXPENSE_ACCOUNT_ID = a["id"]
    if at == "cash" and not CASH_ACCOUNT_ID:
        CASH_ACCOUNT_ID = a["id"]
if not ACCOUNT_ID and acct_list:
    ACCOUNT_ID = acct_list[0]["id"]
if not EXPENSE_ACCOUNT_ID and acct_list:
    EXPENSE_ACCOUNT_ID = acct_list[-1]["id"]
if not CASH_ACCOUNT_ID:
    CASH_ACCOUNT_ID = ACCOUNT_ID
print(f"     Income: {ACCOUNT_ID and ACCOUNT_ID[:8]}..., Expense: {EXPENSE_ACCOUNT_ID and EXPENSE_ACCOUNT_ID[:8]}..., Cash: {CASH_ACCOUNT_ID and CASH_ACCOUNT_ID[:8]}...")

# ==================== ITEMS ====================
print("\n📦 ITEMS")
_, _, r = test("Create item", "POST", "/api/items", {
    "name": "Test Item", "sku": "TST-001", "selling_price": 50000,
    "cost_price": 30000, "stock_on_hand": 100, "item_type": "goods",
    "income_account_id": ACCOUNT_ID, "expense_account_id": EXPENSE_ACCOUNT_ID
})
ITEM_ID = r.get("id")
test("List items", "GET", "/api/items?page=1&page_size=10")

# ==================== INVOICES ====================
print("\n🧾 INVOICES")
_, _, inv = test("Create invoice", "POST", "/api/invoices", {
    "contact_id": CUSTOMER_ID, "date": "2026-04-01", "due_date": "2026-05-01",
    "reference": "TEST-INV", "currency_code": "IQD", "exchange_rate": 1,
    "notes": "", "terms": "",
    "lines": [{"item_id": ITEM_ID, "description": "Test line", "quantity": 2, "unit_price": 50000, "discount_percent": 0}]
})
INVOICE_ID = inv.get("id")
test("List invoices", "GET", "/api/invoices?page=1&page_size=10")
test("Get invoice", "GET", f"/api/invoices/{INVOICE_ID}")
test("Send invoice", "POST", f"/api/invoices/{INVOICE_ID}/send")

# ==================== QUOTES ====================
print("\n📝 QUOTES")
_, _, q = test("Create quote", "POST", "/api/quotes", {
    "contact_id": CUSTOMER_ID, "date": "2026-04-01", "expiry_date": "2026-04-30",
    "reference": "TEST-Q", "currency_code": "IQD", "notes": "", "terms": "",
    "lines": [{"item_id": ITEM_ID, "description": "Quote line", "quantity": 3, "unit_price": 50000, "discount_percent": 5}]
})
QUOTE_ID = q.get("id")
test("List quotes", "GET", "/api/quotes?page=1&page_size=10")
test("Get quote", "GET", f"/api/quotes/{QUOTE_ID}")
test("Send quote", "POST", f"/api/quotes/{QUOTE_ID}/send")
test("Accept quote", "POST", f"/api/quotes/{QUOTE_ID}/accept")

# Create another quote to test convert
_, _, q2 = test("Create quote 2", "POST", "/api/quotes", {
    "contact_id": CUSTOMER_ID, "date": "2026-04-01", "expiry_date": "2026-04-30",
    "reference": "TEST-Q2", "currency_code": "IQD", "notes": "", "terms": "",
    "lines": [{"item_id": ITEM_ID, "description": "Q2 line", "quantity": 1, "unit_price": 75000, "discount_percent": 0}]
})
QUOTE2_ID = q2.get("id")
test("Convert quote to invoice", "POST", f"/api/quotes/{QUOTE2_ID}/convert-to-invoice")

_, _, q3 = test("Create quote 3", "POST", "/api/quotes", {
    "contact_id": CUSTOMER_ID, "date": "2026-04-01", "expiry_date": "2026-04-30",
    "reference": "TEST-Q3", "currency_code": "IQD", "notes": "", "terms": "",
    "lines": [{"item_id": ITEM_ID, "description": "Q3 line", "quantity": 1, "unit_price": 60000, "discount_percent": 0}]
})
QUOTE3_ID = q3.get("id")
test("Convert quote to sales order", "POST", f"/api/quotes/{QUOTE3_ID}/convert-to-so")

# ==================== SALES ORDERS ====================
print("\n📋 SALES ORDERS")
_, _, so = test("Create sales order", "POST", "/api/sales-orders", {
    "contact_id": CUSTOMER_ID, "date": "2026-04-01", "expected_shipment_date": "2026-04-15",
    "reference": "TEST-SO", "currency_code": "IQD", "notes": "",
    "lines": [{"item_id": ITEM_ID, "description": "SO line", "quantity": 5, "unit_price": 50000, "discount_percent": 0}]
})
SO_ID = so.get("id")
test("List sales orders", "GET", "/api/sales-orders?page=1&page_size=10")
test("Get sales order", "GET", f"/api/sales-orders/{SO_ID}")
test("Confirm sales order", "POST", f"/api/sales-orders/{SO_ID}/confirm")
test("Convert SO to invoice", "POST", f"/api/sales-orders/{SO_ID}/convert-to-invoice")

# ==================== PURCHASE ORDERS ====================
print("\n🛒 PURCHASE ORDERS")
_, _, po = test("Create purchase order", "POST", "/api/purchase-orders", {
    "contact_id": VENDOR_ID, "date": "2026-04-01", "expected_delivery_date": "2026-04-20",
    "reference": "TEST-PO", "currency_code": "IQD", "notes": "",
    "lines": [{"item_id": ITEM_ID, "description": "PO line", "quantity": 10, "unit_price": 30000, "discount_percent": 0}]
})
PO_ID = po.get("id")
test("List purchase orders", "GET", "/api/purchase-orders?page=1&page_size=10")
test("Get purchase order", "GET", f"/api/purchase-orders/{PO_ID}")
test("Issue purchase order", "POST", f"/api/purchase-orders/{PO_ID}/issue")
test("Convert PO to bill", "POST", f"/api/purchase-orders/{PO_ID}/convert-to-bill")

# ==================== BILLS ====================
print("\n💰 BILLS")
_, _, bill = test("Create bill", "POST", "/api/bills", {
    "contact_id": VENDOR_ID, "date": "2026-04-01", "due_date": "2026-05-01",
    "reference": "TEST-BILL", "currency_code": "IQD", "exchange_rate": 1,
    "notes": "", "terms": "",
    "lines": [{"item_id": ITEM_ID, "description": "Bill line", "quantity": 5, "unit_price": 30000, "discount_percent": 0, "account_id": EXPENSE_ACCOUNT_ID}]
})
BILL_ID = bill.get("id")
test("List bills", "GET", "/api/bills?page=1&page_size=10")
test("Approve bill", "POST", f"/api/bills/{BILL_ID}/approve")

# ==================== EXPENSES ====================
print("\n💸 EXPENSES")
_, _, exp = test("Create expense", "POST", "/api/expenses", {
    "date": "2026-04-01", "account_id": EXPENSE_ACCOUNT_ID, "amount": 25000,
    "reference": "TEST-EXP", "description": "Test expense", "currency_code": "IQD",
    "exchange_rate": 1, "contact_id": VENDOR_ID
})
EXPENSE_ID = exp.get("id")
test("List expenses", "GET", "/api/expenses?page=1&page_size=10")

# ==================== CREDIT NOTES ====================
print("\n📄 CREDIT NOTES")
_, _, cn = test("Create credit note", "POST", "/api/credit-notes", {
    "contact_id": CUSTOMER_ID, "date": "2026-04-01",
    "reference": "TEST-CN", "currency_code": "IQD", "notes": "",
    "lines": [{"item_id": ITEM_ID, "description": "CN line", "quantity": 1, "unit_price": 50000, "discount_percent": 0}]
})
CN_ID = cn.get("id")
test("List credit notes", "GET", "/api/credit-notes?page=1&page_size=10")
test("Get credit note", "GET", f"/api/credit-notes/{CN_ID}")
test("Approve credit note", "POST", f"/api/credit-notes/{CN_ID}/approve")

# ==================== VENDOR CREDITS ====================
print("\n🏷️ VENDOR CREDITS")
_, _, vc = test("Create vendor credit", "POST", "/api/vendor-credits", {
    "contact_id": VENDOR_ID, "date": "2026-04-01",
    "reference": "TEST-VC", "currency_code": "IQD", "notes": "",
    "lines": [{"item_id": ITEM_ID, "description": "VC line", "quantity": 1, "unit_price": 30000, "discount_percent": 0}]
})
VC_ID = vc.get("id")
test("List vendor credits", "GET", "/api/vendor-credits?page=1&page_size=10")
test("Get vendor credit", "GET", f"/api/vendor-credits/{VC_ID}")
test("Approve vendor credit", "POST", f"/api/vendor-credits/{VC_ID}/approve")

# ==================== RECURRING INVOICES ====================
print("\n🔄 RECURRING INVOICES")
_, _, ri = test("Create recurring invoice", "POST", "/api/recurring-invoices", {
    "contact_id": CUSTOMER_ID, "profile_name": "Monthly Service", "frequency": "monthly",
    "start_date": "2026-04-01", "end_date": "2026-12-31",
    "payment_terms": 30, "currency_code": "IQD", "notes": "",
    "lines": [{"item_id": ITEM_ID, "description": "Recurring line", "quantity": 1, "unit_price": 100000, "discount_percent": 0}]
})
RI_ID = ri.get("id")
test("List recurring invoices", "GET", "/api/recurring-invoices?page=1&page_size=10")
test("Get recurring invoice", "GET", f"/api/recurring-invoices/{RI_ID}")
test("Generate invoice from recurring", "POST", f"/api/recurring-invoices/{RI_ID}/generate-invoice")
test("Pause recurring", "POST", f"/api/recurring-invoices/{RI_ID}/pause")
test("Resume recurring", "POST", f"/api/recurring-invoices/{RI_ID}/resume")

# ==================== PAYMENTS ====================
print("\n💳 PAYMENTS")
test("Record payment received", "POST", "/api/payments-received", {
    "contact_id": CUSTOMER_ID, "date": "2026-04-02", "amount": 50000,
    "invoice_id": INVOICE_ID, "account_id": CASH_ACCOUNT_ID,
    "reference": "PAY-RCV", "currency_code": "IQD", "exchange_rate": 1
})
test("List payments received", "GET", "/api/payments-received?page=1&page_size=10")

test("Record payment made", "POST", "/api/payments-made", {
    "contact_id": VENDOR_ID, "date": "2026-04-02", "amount": 30000,
    "account_id": CASH_ACCOUNT_ID,
    "reference": "PAY-MADE", "currency_code": "IQD", "exchange_rate": 1,
    "bill_id": BILL_ID,
})
test("List payments made", "GET", "/api/payments-made?page=1&page_size=10")

# ==================== INVENTORY ====================
print("\n📦 INVENTORY")
test("Inventory valuation", "GET", "/api/inventory/valuation")
test("Low stock alerts", "GET", "/api/inventory/low-stock")
test("List item groups", "GET", "/api/inventory/groups")
_, _, grp = test("Create item group", "POST", "/api/inventory/groups", {"name": "Electronics", "description": "Electronic items"})

test("Create inventory adjustment", "POST", "/api/inventory/adjustments", {
    "date": "2026-04-01", "reason": "Damaged stock", "adjustment_type": "quantity",
    "account_id": EXPENSE_ACCOUNT_ID,
    "lines": [{"item_id": ITEM_ID, "quantity_adjusted": -5, "value_adjusted": 0}]
})
test("List adjustments", "GET", "/api/inventory/adjustments")
test("Stock movement", "GET", f"/api/inventory/movement/{ITEM_ID}")

# ==================== TAX ====================
print("\n🏛️ TAX MANAGEMENT")
_, _, tax = test("Create tax rate", "POST", "/api/taxes/rates", {
    "name": "VAT 15%", "rate": 15, "tax_type": "percentage", "description": "Standard VAT"
})
TAX_ID = tax.get("id")
test("List tax rates", "GET", "/api/taxes/rates")
test("Update tax rate", "PUT", f"/api/taxes/rates/{TAX_ID}", {
    "name": "VAT 15%", "rate": 15, "tax_type": "percentage", "description": "Updated VAT", "is_active": True
})

_, _, tg = test("Create tax group", "POST", "/api/taxes/groups", {
    "name": "Combined Tax", "tax_rate_ids": [TAX_ID] if TAX_ID else []
})
test("List tax groups", "GET", "/api/taxes/groups")

# ==================== FISCAL ====================
print("\n📅 FISCAL YEARS & BUDGETS")
_, _, fy = test("Create fiscal year", "POST", "/api/fiscal/years", {
    "name": "FY 2026", "start_date": "2026-01-01", "end_date": "2026-12-31"
})
FY_ID = fy.get("id")
test("List fiscal years", "GET", "/api/fiscal/years")

_, _, budget = test("Create budget", "POST", "/api/fiscal/budgets", {
    "name": "Q1 Budget 2026", "fiscal_year_id": FY_ID,
    "start_date": "2026-01-01", "end_date": "2026-03-31",
    "period": "quarterly", "amount": 100000, "lines": []
})
BUDGET_ID = budget.get("id")
test("List budgets", "GET", "/api/fiscal/budgets")
test("Get budget detail", "GET", f"/api/fiscal/budgets/{BUDGET_ID}")
test("Close fiscal year", "POST", f"/api/fiscal/years/{FY_ID}/close")

# ==================== JOURNALS ====================
print("\n📖 JOURNALS")
test("List journals", "GET", "/api/journals?page=1&page_size=10")
test("Create manual journal", "POST", "/api/journals", {
    "date": "2026-04-01", "reference": "TEST-JRN", "description": "Test journal",
    "lines": [
        {"account_id": ACCOUNT_ID, "debit": 10000, "credit": 0, "description": "Debit"},
        {"account_id": EXPENSE_ACCOUNT_ID, "debit": 0, "credit": 10000, "description": "Credit"}
    ]
})

# ==================== BANKING ====================
print("\n🏦 BANKING")
# Get a bank account ID for transactions
bank_accts = test("List bank accounts", "GET", "/api/banking/accounts")
BANK_ACCT_ID = None
if bank_accts and isinstance(bank_accts, list) and len(bank_accts) > 0:
    BANK_ACCT_ID = bank_accts[0].get("id")
elif bank_accts and isinstance(bank_accts, dict) and "items" in bank_accts and len(bank_accts["items"]) > 0:
    BANK_ACCT_ID = bank_accts["items"][0].get("id")
if BANK_ACCT_ID:
    test("List transactions", "GET", f"/api/banking/accounts/{BANK_ACCT_ID}/transactions?page=1&page_size=10")
else:
    print("  ⚠️  No bank account found, skipping transactions list")

# ==================== REPORTS ====================
print("\n📊 REPORTS")
test("Profit & Loss", "GET", "/api/reports/profit-loss?start_date=2026-01-01&end_date=2026-12-31")
test("Balance Sheet", "GET", "/api/reports/balance-sheet?as_of_date=2026-04-03")
test("Trial Balance", "GET", "/api/reports/trial-balance?start_date=2026-01-01&end_date=2026-04-03")
test("Receivables Aging", "GET", "/api/reports/receivables-aging")
test("Payables Aging", "GET", "/api/reports/payables-aging")
test("General Ledger", "GET", "/api/reports/general-ledger?start_date=2026-01-01&end_date=2026-12-31")
test("Sales by Customer", "GET", "/api/reports/sales-by-customer?start_date=2026-01-01&end_date=2026-12-31")
test("Purchases by Vendor", "GET", "/api/reports/purchases-by-vendor?start_date=2026-01-01&end_date=2026-12-31")
test("Expense by Category", "GET", "/api/reports/expense-by-category?start_date=2026-01-01&end_date=2026-12-31")
test("Tax Summary", "GET", "/api/reports/tax-summary?start_date=2026-01-01&end_date=2026-12-31")
test("Cash Flow", "GET", "/api/reports/cash-flow?start_date=2026-01-01&end_date=2026-12-31")

# ==================== SYSTEM ====================
print("\n⚙️ SYSTEM")
test("Get settings", "GET", "/api/system/settings")
test("Save setting", "POST", "/api/system/settings", {"key": "org_name", "value": "Test Company"})
test("Get currencies", "GET", "/api/system/currencies")
test("Create exchange rate", "POST", "/api/system/exchange-rates", {
    "from_currency": "USD", "to_currency": "IQD", "rate": 1460, "date": "2026-04-01"
})
test("List exchange rates", "GET", "/api/system/exchange-rates")
test("Activity log", "GET", "/api/system/activity-log?page=1&page_size=10")
test("Global search", "GET", "/api/system/search?q=Test")
test("Create backup", "POST", "/api/system/backup")
test("List backups", "GET", "/api/system/backup/list")

# ==================== PROJECTS ====================
print("\n📐 PROJECTS")
_, _, proj = test("Create project", "POST", "/api/projects", {
    "name": "Test Project", "contact_id": CUSTOMER_ID,
    "billing_method": "fixed", "budget": 500000,
    "start_date": "2026-04-01", "description": "Test"
})
test("List projects", "GET", "/api/projects?page=1&page_size=10")

# ==================== DASHBOARD ====================
print("\n📊 DASHBOARD")
test("Dashboard", "GET", "/api/dashboard")

# ==================== SUMMARY ====================
print("\n" + "="*60)
print(f"📊 RESULTS: {RESULTS['pass']} passed, {RESULTS['fail']} failed, {RESULTS['pass'] + RESULTS['fail']} total")
print("="*60)

if RESULTS["errors"]:
    print("\n❌ FAILURES:")
    for e in RESULTS["errors"]:
        print(f"   • {e}")
else:
    print("\n🎉 ALL TESTS PASSED!")
