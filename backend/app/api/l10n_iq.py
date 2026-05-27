"""Iraq Localization - Tax categories, withholding, compliance reports"""
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from app.services.auth import get_current_user
from app.firestore.taxes import TaxRateRepository
from app.firestore.accounts import AccountRepository
from app.firestore.invoices import InvoiceRepository
from app.firestore.payments import PaymentReceivedRepository, PaymentMadeRepository
from app.seed.chart_of_accounts import CHART_OF_ACCOUNTS
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/l10n/iq", tags=["Iraq Localization"])


# ===== Tax categories (Iraq-specific) =====
# NOTE: VAT rate is 0.0 (suspended in Iraq as of 2024; previously 5-10%). Update if GoI re-enables.
IRAQ_TAX_CATEGORIES = [
    {"code": "vat",         "name": "VAT",                    "name_ku": "باجی بەرزکراوە",        "default_rate": 0.0},
    {"code": "withholding", "name": "Withholding Tax",        "name_ku": "باجی گرتنەوە",          "default_rate": 3.0},
    {"code": "service",     "name": "Service Tax",            "name_ku": "باجی خزمەتگوزاری",       "default_rate": 5.0},
    {"code": "income",      "name": "Corporate Income Tax",   "name_ku": "باجی داهاتی کۆمپانیا",    "default_rate": 15.0},
    {"code": "municipal",   "name": "Municipal Tax (KRG)",    "name_ku": "باجی شاروانی (KRG)",    "default_rate": 10.0},
]

IRAQ_WITHHOLDING_RULES = [
    {"rate": 3.0, "applies_to": "goods",    "description": "Goods — default"},
    {"rate": 5.0, "applies_to": "services", "description": "Services — default"},
    {"rate": 7.0, "applies_to": "contracts","description": "Construction/Contracts"},
]


@router.get("/tax-categories")
def list_tax_categories(user: dict = Depends(get_current_user)):
    """Iraq-specific tax categories."""
    return IRAQ_TAX_CATEGORIES


@router.get("/withholding-rules")
def list_withholding_rules(user: dict = Depends(get_current_user)):
    """Standard withholding tax rules for Iraq."""
    return IRAQ_WITHHOLDING_RULES


@router.get("/chart-of-accounts-template")
def coa_template(user: dict = Depends(get_current_user)):
    """Iraq-compatible Chart of Accounts template (Kurdish + English)."""
    return CHART_OF_ACCOUNTS


@router.post("/setup")
def apply_iraq_setup(user: dict = Depends(get_current_user)):
    """Apply Iraq defaults to this organization: tax categories, currency (IQD), CoA."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    org_id = user["org_id"]
    tax_repo = TaxRateRepository(org_id)
    acct_repo = AccountRepository(org_id)

    created_taxes = 0
    existing_taxes, _ = tax_repo.list(limit=1000)
    existing_codes = {t.get("tax_category") for t in existing_taxes if t.get("tax_category")}

    # Add missing Iraq tax categories
    for cat in IRAQ_TAX_CATEGORIES:
        if cat["code"] not in existing_codes:
            tax_repo.create({
                "name": cat["name"],
                "name_ku": cat["name_ku"],
                "rate": cat["default_rate"],
                "tax_category": cat["code"],
                "tax_type": "vat" if cat["code"] == "vat" else "sales_tax",
                "is_active": True,
                "is_default": False,
            })
            created_taxes += 1

    return {
        "success": True,
        "taxes_created": created_taxes,
        "currency": "IQD",
        "locale": "ckb-IQ",
        "message": "Iraq localization applied",
    }


@router.get("/withholding-summary")
def withholding_summary(
    period_from: str = Query(...),
    period_to: str = Query(...),
    user: dict = Depends(get_current_user),
):
    """Total withholding tax withheld from vendor payments in a period."""
    org_id = user["org_id"]
    pm_repo = PaymentMadeRepository(org_id)
    payments = collect_stream(pm_repo)

    total_withheld = 0.0
    by_vendor: dict = {}
    rows = []

    for p in payments:
        date = str(p.get("payment_date") or p.get("date") or "")[:10]
        if not (period_from <= date <= period_to):
            continue
        wh = float(p.get("withholding_amount") or 0)
        if wh <= 0:
            continue
        total_withheld += wh
        vendor_id = p.get("vendor_id") or p.get("contact_id") or "unknown"
        by_vendor[vendor_id] = by_vendor.get(vendor_id, 0.0) + wh
        rows.append({
            "date": date,
            "vendor_id": vendor_id,
            "payment_id": p.get("id"),
            "gross_amount": p.get("amount"),
            "withholding_amount": wh,
        })

    return {
        "period_from": period_from,
        "period_to": period_to,
        "total_withheld": round(total_withheld, 2),
        "rows_count": len(rows),
        "by_vendor": [{"vendor_id": k, "amount": round(v, 2)} for k, v in by_vendor.items()],
        "rows": rows,
    }


@router.get("/vat-return")
def vat_return(
    period_from: str = Query(...),
    period_to: str = Query(...),
    user: dict = Depends(get_current_user),
):
    """VAT return report (output VAT from invoices - input VAT from bills)."""
    org_id = user["org_id"]
    inv_repo = InvoiceRepository(org_id)
    invoices = collect_stream(inv_repo)

    output_vat = 0.0
    taxable_sales = 0.0
    for inv in invoices:
        date = str(inv.get("invoice_date") or inv.get("date") or "")[:10]
        if period_from <= date <= period_to:
            # FIX-103: invoices store tax_amount, not tax_total
            output_vat += float(inv.get("tax_amount") or inv.get("tax_total") or 0)
            taxable_sales += float(inv.get("subtotal") or 0)

    # Input VAT from bills
    try:
        from app.firestore.bills import BillRepository
        bills = collect_stream(BillRepository(org_id))
        input_vat = 0.0
        taxable_purchases = 0.0
        for b in bills:
            date = str(b.get("bill_date") or b.get("date") or "")[:10]
            if period_from <= date <= period_to:
                input_vat += float(b.get("tax_amount") or b.get("tax_total") or 0)
                taxable_purchases += float(b.get("subtotal") or 0)
    except Exception:
        input_vat = 0.0
        taxable_purchases = 0.0

    return {
        "period_from": period_from,
        "period_to": period_to,
        "taxable_sales": round(taxable_sales, 2),
        "output_vat": round(output_vat, 2),
        "taxable_purchases": round(taxable_purchases, 2),
        "input_vat": round(input_vat, 2),
        "net_vat_payable": round(output_vat - input_vat, 2),
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/currency-info")
def currency_info(user: dict = Depends(get_current_user)):
    """IQD currency display rules."""
    return {
        "base": "IQD",
        "symbol": "د.ع",
        "format": "{amount} د.ع",
        "decimals": 0,
        "thousand_separator": ",",
        "numerals": "arabic-indic-optional",
        "supported": ["IQD", "USD", "EUR", "TRY"],
    }


# ============================================================
# FIX-104: Payroll Withholding Tax report (income tax withheld from salaries)
# ============================================================
@router.get("/payroll-wht-report")
def payroll_wht_report(
    period_from: str = Query(...),
    period_to: str = Query(...),
    user: dict = Depends(get_current_user),
):
    """Sum income tax withheld from payslips in the period (per Iraq progressive brackets)."""
    from app.firestore.payroll import PayrollRunRepository, PayslipRepository
    org_id = user["org_id"]
    runs, _ = PayrollRunRepository(org_id).list(limit=1000)
    in_period = [r for r in runs if period_from <= str(r.get("period_to") or r.get("period_from") or "")[:10] <= period_to]

    ps_repo = PayslipRepository(org_id)
    total_tax = 0.0
    total_gross = 0.0
    employees = {}
    for run in in_period:
        slips, _ = ps_repo.list(filters=[{"field": "run_id", "op": "==", "value": run["id"]}], limit=2000)
        for s in slips:
            tax = 0.0
            for ln in (s.get("lines") or []):
                code = (ln.get("code") or ln.get("name") or "").lower()
                if "tax" in code or "wht" in code or "income" in code:
                    tax += float(ln.get("amount") or 0)
            total_tax += tax
            total_gross += float(s.get("gross") or 0)
            emp_id = s.get("employee_id") or "unknown"
            if emp_id not in employees:
                employees[emp_id] = {"employee_id": emp_id, "gross": 0.0, "tax": 0.0}
            employees[emp_id]["gross"] += float(s.get("gross") or 0)
            employees[emp_id]["tax"] += tax

    return {
        "period_from": period_from,
        "period_to": period_to,
        "total_gross": round(total_gross, 2),
        "total_withheld_tax": round(total_tax, 2),
        "by_employee": [
            {"employee_id": e["employee_id"], "gross": round(e["gross"], 2), "tax": round(e["tax"], 2)}
            for e in employees.values()
        ],
        "runs_count": len(in_period),
    }


# ============================================================
# FIX-105: Iraq Social Security report (employee 5% + employer 12%)
# ============================================================
@router.get("/social-security-report")
def social_security_report(
    period_from: str = Query(...),
    period_to: str = Query(...),
    user: dict = Depends(get_current_user),
):
    """Sum SS contributions (employee 5% + employer 12%) per period for ISSI filing."""
    from app.firestore.payroll import PayrollRunRepository, PayslipRepository
    from app.services.iraq_payroll import IRAQ_SS_EMPLOYEE_PERCENT, IRAQ_SS_EMPLOYER_PERCENT

    org_id = user["org_id"]
    runs, _ = PayrollRunRepository(org_id).list(limit=1000)
    in_period = [r for r in runs if period_from <= str(r.get("period_to") or r.get("period_from") or "")[:10] <= period_to]

    ps_repo = PayslipRepository(org_id)
    total_basic = 0.0
    employee_ss = 0.0
    employer_ss = 0.0
    rows = []
    for run in in_period:
        slips, _ = ps_repo.list(filters=[{"field": "run_id", "op": "==", "value": run["id"]}], limit=2000)
        for s in slips:
            basic = float(s.get("basic") or 0)
            total_basic += basic
            ee = round(basic * IRAQ_SS_EMPLOYEE_PERCENT / 100, 2)
            er = round(basic * IRAQ_SS_EMPLOYER_PERCENT / 100, 2)
            employee_ss += ee
            employer_ss += er
            rows.append({
                "employee_id": s.get("employee_id"),
                "basic": round(basic, 2),
                "employee_ss": ee,
                "employer_ss": er,
                "total_ss": round(ee + er, 2),
            })

    return {
        "period_from": period_from,
        "period_to": period_to,
        "total_basic": round(total_basic, 2),
        "employee_contribution": round(employee_ss, 2),
        "employer_contribution": round(employer_ss, 2),
        "total_ss": round(employee_ss + employer_ss, 2),
        "rate_employee_pct": IRAQ_SS_EMPLOYEE_PERCENT,
        "rate_employer_pct": IRAQ_SS_EMPLOYER_PERCENT,
        "rows": rows,
    }


# ============================================================
# FIX-107: IQD rounding helper
# ============================================================
@router.post("/round-iqd")
def round_iqd(data: dict, user: dict = Depends(get_current_user)):
    """Round IQD amount to nearest 250 (Iraq standard, no decimals)."""
    amount = float(data.get("amount") or 0)
    step = float(data.get("step") or 250)
    rounded = round(amount / step) * step
    return {
        "input": amount,
        "step": step,
        "rounded": int(rounded),
        "delta": round(rounded - amount, 2),
    }


# ============================================================
# FIX-108: Iraq tax invoice number format (sequential per fiscal year)
# Returns next number formatted like "IQ-2026-000123"
# ============================================================
@router.get("/next-tax-invoice-number")
def next_tax_invoice_number(year: int = Query(None), user: dict = Depends(get_current_user)):
    """Compute next sequential tax-invoice number for the requested year (default: current year)."""
    from datetime import date
    org_id = user["org_id"]
    if year is None:
        year = date.today().year

    inv_repo = InvoiceRepository(org_id)
    invoices = collect_stream(inv_repo)
    prefix = f"IQ-{year}-"
    max_seq = 0
    for inv in invoices:
        num = str(inv.get("tax_invoice_number") or inv.get("invoice_number") or "")
        if num.startswith(prefix):
            try:
                seq = int(num[len(prefix):])
                if seq > max_seq:
                    max_seq = seq
            except ValueError:
                continue
    next_seq = max_seq + 1
    return {
        "year": year,
        "next_number": f"{prefix}{next_seq:06d}",
        "sequence": next_seq,
    }
