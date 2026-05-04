"""Payroll: salary rules, payroll runs, payslips."""
from __future__ import annotations

from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.firestore.hr import HRContractRepository, HREmployeeRepository
from app.firestore.payroll import PayrollRunRepository, PayslipRepository, SalaryRuleRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services import settings_service

router = APIRouter(prefix="/api/payroll", tags=["Payroll"])


class SalaryRuleCreate(BaseModel):
    code: str
    name: str
    type: str = "allowance"  # allowance | deduction | tax | social_security
    amount_type: str = "fixed"  # fixed | percent
    amount: float = 0
    apply_on: str = "basic"  # basic | gross
    active: bool = True


class PayrollRunCreate(BaseModel):
    name: str
    period_start: str
    period_end: str
    employee_ids: Optional[list[str]] = None  # None = all active employees


class PayslipUpdate(BaseModel):
    status: Optional[str] = None  # draft | confirmed | paid
    notes: Optional[str] = None


# ---------- Salary Rules ----------
@router.get("/rules")
def list_rules(user: dict = Depends(get_current_user)):
    items, total = SalaryRuleRepository(user["org_id"]).list(limit=200)
    return {"items": items, "total": total}


@router.post("/rules", dependencies=[Depends(require_perm("hr.payroll.create"))])
def create_rule(payload: SalaryRuleCreate, user: dict = Depends(get_current_user)):
    return SalaryRuleRepository(user["org_id"]).create(payload.model_dump())


@router.put("/rules/{rid}", dependencies=[Depends(require_perm("hr.payroll.update"))])
def update_rule(rid: str, payload: SalaryRuleCreate, user: dict = Depends(get_current_user)):
    return SalaryRuleRepository(user["org_id"]).update(rid, payload.model_dump())


@router.delete("/rules/{rid}", dependencies=[Depends(require_perm("hr.payroll.delete"))])
def delete_rule(rid: str, user: dict = Depends(get_current_user)):
    SalaryRuleRepository(user["org_id"]).delete(rid)
    return {"success": True}


# ---------- Compute payslip lines ----------
def _compute_payslip(basic: float, rules: list[dict]) -> dict:
    """Two-pass payslip computation (FIX-66).

    Pass 1: process all rules where apply_on == 'basic' (default) to
            establish gross = basic + allowances_on_basic.
    Pass 2: process rules where apply_on == 'gross' using the gross
            from pass 1 as their base. This lets income tax and SS be
            computed on the gross including allowances.
    """
    lines: list[dict] = [{"code": "BASIC", "name": "Basic Salary", "type": "basic", "amount": basic}]
    active = [r for r in rules if r.get("active", True)]
    pass1 = [r for r in active if (r.get("apply_on") or "basic") == "basic"]
    pass2 = [r for r in active if r.get("apply_on") == "gross"]

    allowances = 0.0
    deductions = 0.0

    def _amount(rule: dict, base: float) -> float:
        amt = float(rule.get("amount") or 0)
        if rule.get("amount_type") == "percent":
            amt = round(base * amt / 100, 2)
        return amt

    # Pass 1: rules applied on basic salary
    for rule in pass1:
        amt = _amount(rule, basic)
        rtype = rule.get("type")
        if rtype == "allowance":
            allowances += amt
            lines.append({"code": rule.get("code"), "name": rule.get("name"), "type": "allowance", "amount": amt})
        elif rtype in ("deduction", "tax", "social_security"):
            deductions += amt
            lines.append({"code": rule.get("code"), "name": rule.get("name"), "type": rtype, "amount": -amt})

    gross_after_pass1 = round(basic + allowances, 2)

    # Pass 2: rules applied on gross (typically tax / social security)
    for rule in pass2:
        amt = _amount(rule, gross_after_pass1)
        rtype = rule.get("type")
        if rtype == "allowance":
            allowances += amt
            lines.append({"code": rule.get("code"), "name": rule.get("name"), "type": "allowance", "amount": amt})
        elif rtype in ("deduction", "tax", "social_security"):
            deductions += amt
            lines.append({"code": rule.get("code"), "name": rule.get("name"), "type": rtype, "amount": -amt})

    gross = round(basic + allowances, 2)
    net = round(gross - deductions, 2)
    return {
        "lines": lines,
        "basic": round(basic, 2),
        "allowances": round(allowances, 2),
        "deductions": round(deductions, 2),
        "gross": gross,
        "net": net,
    }


# ---------- Payroll Runs ----------
@router.get("/runs")
def list_runs(user: dict = Depends(get_current_user)):
    items, total = PayrollRunRepository(user["org_id"]).list(limit=200, order_by="period_end", order_dir="DESCENDING")
    return {"items": items, "total": total}


@router.post("/runs", dependencies=[Depends(require_perm("hr.payroll.create"))])
def create_run(payload: PayrollRunCreate, user: dict = Depends(get_current_user)):
    # Apply payroll config
    try:
        cfg = settings_service.get_bag(user["org_id"], "payroll")
    except Exception:
        cfg = {}
    
    org = user["org_id"]
    employees, _ = HREmployeeRepository(org).list(limit=2000)
    targets = [e for e in employees if e.get("status") == "active"]
    if payload.employee_ids:
        targets = [e for e in targets if e["id"] in payload.employee_ids]

    contracts, _ = HRContractRepository(org).list(filters=[{"field": "status", "op": "==", "value": "active"}], limit=2000)
    by_emp = {c["employee_id"]: c for c in contracts}

    rules, _ = SalaryRuleRepository(org).list(limit=200)
    active_rules = [r for r in rules if r.get("active", True)]

    run = PayrollRunRepository(org).create({
        "name": payload.name,
        "period_start": payload.period_start,
        "period_end": payload.period_end,
        "status": "draft",
        "employee_count": len(targets),
        "created_at": datetime.utcnow().isoformat(),
        "total_gross": 0,
        "total_net": 0,
        "tax_brackets": cfg.get("tax_brackets", []),
        "social_security_rate": cfg.get("social_security_rate", 0.05),
        "default_allowances": cfg.get("default_allowances", []),
    })

    pslip_repo = PayslipRepository(org)
    total_gross = 0.0
    total_net = 0.0
    for emp in targets:
        contract = by_emp.get(emp["id"])
        basic = float(contract.get("wage") or 0) if contract else 0.0
        comp = _compute_payslip(basic, active_rules)
        pslip_repo.create({
            "run_id": run["id"],
            "employee_id": emp["id"],
            "employee_name": emp.get("name"),
            "period_start": payload.period_start,
            "period_end": payload.period_end,
            "currency": (contract.get("currency") if contract else None) or "IQD",
            "status": "draft",
            **comp,
        })
        total_gross += comp["gross"]
        total_net += comp["net"]

    return PayrollRunRepository(org).update(run["id"], {
        "total_gross": round(total_gross, 2),
        "total_net": round(total_net, 2),
    })


@router.get("/runs/{run_id}")
def get_run(run_id: str, user: dict = Depends(get_current_user)):
    run = PayrollRunRepository(user["org_id"]).get(run_id)
    if not run or run.get("org_id") != user["org_id"]:
        raise HTTPException(404, "run not found")
    slips, _ = PayslipRepository(user["org_id"]).list(filters=[{"field": "run_id", "op": "==", "value": run_id}], limit=2000)
    return {**run, "payslips": slips}


@router.post("/runs/{run_id}/confirm", dependencies=[Depends(require_perm("hr.payroll.update"))])
def confirm_run(run_id: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    run = PayrollRunRepository(org).get(run_id)
    if not run:
        raise HTTPException(404, "run not found")
    slips, _ = PayslipRepository(org).list(filters=[{"field": "run_id", "op": "==", "value": run_id}], limit=2000)
    for s in slips:
        PayslipRepository(org).update(s["id"], {"status": "confirmed"})
    return PayrollRunRepository(org).update(run_id, {"status": "confirmed",
                                                      "confirmed_at": datetime.utcnow().isoformat(),
                                                      "confirmed_by_id": user["id"],
                                                      "confirmed_by_name": user.get("name") or user.get("email", "")})


@router.delete("/runs/{run_id}", dependencies=[Depends(require_perm("hr.payroll.delete"))])
def delete_run(run_id: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    slips, _ = PayslipRepository(org).list(filters=[{"field": "run_id", "op": "==", "value": run_id}], limit=2000)
    for s in slips:
        PayslipRepository(org).delete(s["id"])
    PayrollRunRepository(org).delete(run_id)
    return {"success": True}


# ---------- Payslips ----------
@router.get("/payslips")
def list_payslips(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    repo = PayslipRepository(user["org_id"])
    # FIX-119: tuple-filter bug — BaseRepository expects dict format
    filters = []
    if employee_id:
        filters.append({"field": "employee_id", "op": "==", "value": employee_id})
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters or None, limit=2000, order_by="period_end", order_dir="DESCENDING")
    return {"items": items, "total": total}


@router.get("/payslips/{ps_id}")
def get_payslip(ps_id: str, user: dict = Depends(get_current_user)):
    ps = PayslipRepository(user["org_id"]).get(ps_id)
    if not ps:
        raise HTTPException(404, "payslip not found")
    return ps


@router.put("/payslips/{ps_id}", dependencies=[Depends(require_perm("hr.payroll.update"))])
def update_payslip(ps_id: str, payload: PayslipUpdate, user: dict = Depends(get_current_user)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    return PayslipRepository(user["org_id"]).update(ps_id, data)


@router.post("/payslips/{ps_id}/mark-paid", dependencies=[Depends(require_perm("hr.payroll.update"))])
def mark_paid(ps_id: str, user: dict = Depends(get_current_user)):
    return PayslipRepository(user["org_id"]).update(ps_id, {
        "status": "paid",
        "paid_at": datetime.utcnow().isoformat(),
        "paid_by_id": user["id"],
        "paid_by_name": user.get("name") or user.get("email", ""),
    })


# ---------- Sprint 11: Iraq Payroll MVP ----------
@router.post("/runs/{run_id}/iraq-compute", dependencies=[Depends(require_perm("hr.payroll.update"))])
def iraq_compute_run(run_id: str, user: dict = Depends(get_current_user)):
    """FIX-120: Apply Iraq SS (5% EE) + progressive income tax to every payslip in a run."""
    from app.services.iraq_payroll import (
        IRAQ_SS_EMPLOYEE_PERCENT,
        IRAQ_SS_EMPLOYER_PERCENT,
        compute_iraq_income_tax_monthly,
    )
    org = user["org_id"]
    run = PayrollRunRepository(org).get(run_id)
    if not run or run.get("org_id") != org:
        raise HTTPException(404, "run not found")
    if run.get("status") == "confirmed":
        raise HTTPException(400, "ناتوانیت ڕانی پشتڕاستکراوە بگۆڕیت")
    slips, _ = PayslipRepository(org).list(
        filters=[{"field": "run_id", "op": "==", "value": run_id}], limit=2000
    )
    updated = 0
    total_ss_emp = 0.0
    total_ss_er = 0.0
    total_tax = 0.0
    for s in slips:
        basic = float(s.get("basic_salary") or s.get("gross") or 0)
        ss_emp = round(basic * IRAQ_SS_EMPLOYEE_PERCENT / 100.0, 2)
        ss_er = round(basic * IRAQ_SS_EMPLOYER_PERCENT / 100.0, 2)
        taxable = max(0.0, basic - ss_emp)
        income_tax = compute_iraq_income_tax_monthly(taxable)
        deductions = round(ss_emp + income_tax, 2)
        net = round(basic - deductions, 2)
        PayslipRepository(org).update(s["id"], {
            "iraq_ss_employee": ss_emp,
            "iraq_ss_employer": ss_er,
            "iraq_income_tax": income_tax,
            "deductions": deductions,
            "net_salary": net,
            "iraq_computed_at": datetime.utcnow().isoformat(),
        })
        total_ss_emp += ss_emp
        total_ss_er += ss_er
        total_tax += income_tax
        updated += 1
    return {
        "run_id": run_id,
        "payslips_updated": updated,
        "totals": {
            "ss_employee": round(total_ss_emp, 2),
            "ss_employer": round(total_ss_er, 2),
            "income_tax": round(total_tax, 2),
        },
    }


@router.post("/runs/{run_id}/post-je", dependencies=[Depends(require_perm("journals.create"))])
def post_payroll_je(run_id: str, data: dict, user: dict = Depends(get_current_user)):
    """FIX-121: Auto-create a balanced JournalEntry from a confirmed payroll run.

    Body: { salary_expense_account_id, ss_payable_account_id, tax_payable_account_id, cash_account_id }
    """
    import uuid
    from app.firestore.journals import JournalEntryRepository
    org = user["org_id"]
    run = PayrollRunRepository(org).get(run_id)
    if not run or run.get("org_id") != org:
        raise HTTPException(404, "run not found")
    if run.get("status") != "confirmed":
        raise HTTPException(400, "ڕان پێویستە پشتڕاستکراوبێت")
    if run.get("journal_entry_id"):
        raise HTTPException(400, "تۆمارەکە پێشتر تۆمار کراوە")
    salary_acc = data.get("salary_expense_account_id")
    ss_acc = data.get("ss_payable_account_id")
    tax_acc = data.get("tax_payable_account_id")
    cash_acc = data.get("cash_account_id")
    if not all([salary_acc, ss_acc, tax_acc, cash_acc]):
        raise HTTPException(400, "هەموو هەژمارەکان پێویستن")
    slips, _ = PayslipRepository(org).list(
        filters=[{"field": "run_id", "op": "==", "value": run_id}], limit=2000
    )
    total_basic = sum(float(s.get("basic_salary") or s.get("gross") or 0) for s in slips)
    total_ss = sum(float(s.get("iraq_ss_employee") or 0) for s in slips)
    total_tax = sum(float(s.get("iraq_income_tax") or 0) for s in slips)
    total_net = sum(float(s.get("net_salary") or 0) for s in slips)
    if total_basic <= 0:
        raise HTTPException(400, "هیچ موچەیەک نییە")
    lines = [
        {"account_id": salary_acc, "debit": round(total_basic, 2), "credit": 0,
         "description": f"Payroll {run_id}"},
        {"account_id": ss_acc, "debit": 0, "credit": round(total_ss, 2),
         "description": "Iraq SS payable (employee)"},
        {"account_id": tax_acc, "debit": 0, "credit": round(total_tax, 2),
         "description": "Iraq income tax payable"},
        {"account_id": cash_acc, "debit": 0, "credit": round(total_net, 2),
         "description": "Net salaries payable"},
    ]
    je_repo = JournalEntryRepository(org)
    je = je_repo.create({
        "id": str(uuid.uuid4()),
        "date": run.get("period_to") or datetime.utcnow().isoformat(),
        "reference": f"PAYROLL-{run_id[:8]}",
        "notes": f"Payroll run {run_id}",
        "entry_type": "payroll",
        "status": "posted",
    })
    je_repo.set_lines(je["id"], lines)
    PayrollRunRepository(org).update(run_id, {"journal_entry_id": je["id"]})
    return {"run_id": run_id, "journal_entry_id": je["id"], "lines": len(lines),
            "total_debit": round(total_basic, 2),
            "total_credit": round(total_ss + total_tax + total_net, 2)}


@router.get("/runs/{run_id}/summary")
def payroll_run_summary(run_id: str, user: dict = Depends(get_current_user)):
    """FIX-122: Aggregated totals for a run (basic, deductions, net, headcount)."""
    org = user["org_id"]
    run = PayrollRunRepository(org).get(run_id)
    if not run or run.get("org_id") != org:
        raise HTTPException(404, "run not found")
    slips, _ = PayslipRepository(org).list(
        filters=[{"field": "run_id", "op": "==", "value": run_id}], limit=2000
    )
    return {
        "run_id": run_id,
        "status": run.get("status"),
        "period_from": run.get("period_from"),
        "period_to": run.get("period_to"),
        "headcount": len(slips),
        "totals": {
            "basic": round(sum(float(s.get("basic_salary") or s.get("gross") or 0) for s in slips), 2),
            "ss_employee": round(sum(float(s.get("iraq_ss_employee") or 0) for s in slips), 2),
            "ss_employer": round(sum(float(s.get("iraq_ss_employer") or 0) for s in slips), 2),
            "income_tax": round(sum(float(s.get("iraq_income_tax") or 0) for s in slips), 2),
            "deductions": round(sum(float(s.get("deductions") or 0) for s in slips), 2),
            "net": round(sum(float(s.get("net_salary") or 0) for s in slips), 2),
        },
        "journal_entry_id": run.get("journal_entry_id"),
    }

