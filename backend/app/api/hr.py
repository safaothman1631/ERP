"""HR API: departments, positions, employees, contracts, attendance, time off."""
from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.firestore.hr import (
    HRAttendanceRepository,
    HRContractRepository,
    HRDepartmentRepository,
    HREmployeeRepository,
    HRLeaveTypeRepository,
    HRPositionRepository,
    HRTimeOffRepository,
    HRLeaveAllocationRepository,
)
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services import settings_service

router = APIRouter(prefix="/api/hr", tags=["HR"])


# ---------- Schemas ----------
class DepartmentCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    manager_id: Optional[str] = None


class PositionCreate(BaseModel):
    title: str
    department_id: Optional[str] = None
    description: Optional[str] = None


class EmployeeCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[str] = None
    position_id: Optional[str] = None
    manager_id: Optional[str] = None
    hire_date: Optional[str] = None
    national_id: Optional[str] = None
    address: Optional[str] = None
    status: str = "active"
    work_email: Optional[str] = None
    work_phone: Optional[str] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[str] = None
    position_id: Optional[str] = None
    manager_id: Optional[str] = None
    hire_date: Optional[str] = None
    status: Optional[str] = None
    address: Optional[str] = None


class ContractCreate(BaseModel):
    employee_id: str
    type: str = "permanent"  # permanent | temporary | internship
    wage: float = Field(default=0, gt=0, le=999999999)
    currency: str = "IQD"
    start_date: str
    end_date: Optional[str] = None
    payment_frequency: str = "monthly"
    status: str = "active"
    notes: Optional[str] = None


class CheckInRequest(BaseModel):
    employee_id: str
    note: Optional[str] = None


class CheckOutRequest(BaseModel):
    attendance_id: str
    note: Optional[str] = None


class LeaveTypeCreate(BaseModel):
    name: str
    days_per_year: float = 0
    paid: bool = True
    color: Optional[str] = None


class TimeOffCreate(BaseModel):
    employee_id: str
    leave_type_id: str
    start_date: str
    end_date: str
    reason: Optional[str] = None


# ---------- Departments ----------
@router.get("/departments")
def list_departments(user: dict = Depends(get_current_user)):
    items, total = HRDepartmentRepository(user["org_id"]).list(limit=500)
    return {"items": items, "total": total}


@router.post("/departments", dependencies=[Depends(require_perm("hr.create"))])
def create_department(payload: DepartmentCreate, user: dict = Depends(get_current_user)):
    return HRDepartmentRepository(user["org_id"]).create(payload.model_dump())


@router.put("/departments/{dept_id}", dependencies=[Depends(require_perm("hr.update"))])
def update_department(dept_id: str, payload: DepartmentCreate, user: dict = Depends(get_current_user)):
    return HRDepartmentRepository(user["org_id"]).update(dept_id, payload.model_dump())


@router.delete("/departments/{dept_id}", dependencies=[Depends(require_perm("hr.delete"))])
def delete_department(dept_id: str, user: dict = Depends(get_current_user)):
    HRDepartmentRepository(user["org_id"]).delete(dept_id)
    return {"success": True}


# ---------- Positions ----------
@router.get("/positions")
def list_positions(user: dict = Depends(get_current_user)):
    items, total = HRPositionRepository(user["org_id"]).list(limit=500)
    return {"items": items, "total": total}


@router.post("/positions", dependencies=[Depends(require_perm("hr.create"))])
def create_position(payload: PositionCreate, user: dict = Depends(get_current_user)):
    return HRPositionRepository(user["org_id"]).create(payload.model_dump())


@router.put("/positions/{pid}", dependencies=[Depends(require_perm("hr.update"))])
def update_position(pid: str, payload: PositionCreate, user: dict = Depends(get_current_user)):
    return HRPositionRepository(user["org_id"]).update(pid, payload.model_dump())


@router.delete("/positions/{pid}", dependencies=[Depends(require_perm("hr.delete"))])
def delete_position(pid: str, user: dict = Depends(get_current_user)):
    HRPositionRepository(user["org_id"]).delete(pid)
    return {"success": True}


# ---------- Employees ----------
@router.get("/employees")
def list_employees(
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    repo = HREmployeeRepository(user["org_id"])
    filters = []
    if status:
        filters.append(("status", "==", status))
    if department_id:
        filters.append(("department_id", "==", department_id))
    items, total = repo.list(filters=filters or None, limit=500)
    return {"items": items, "total": total}


@router.post("/employees", dependencies=[Depends(require_perm("hr.create"))])
def create_employee(payload: EmployeeCreate, user: dict = Depends(get_current_user)):
    # Apply HR config defaults
    try:
        cfg = settings_service.get_bag(user["org_id"], "hr")
    except Exception:
        cfg = {}
    
    data = payload.model_dump()
    data.setdefault("default_leave_balance", cfg.get("default_leave_balance_days", 21))
    data.setdefault("probation_days", cfg.get("probation_period_days", 90))
    data.setdefault("contract_template", cfg.get("default_contract_template", "standard"))
    
    return HREmployeeRepository(user["org_id"]).create(data)


@router.get("/employees/{emp_id}")
def get_employee(emp_id: str, user: dict = Depends(get_current_user)):
    emp = HREmployeeRepository(user["org_id"]).get(emp_id)
    if not emp or emp.get("org_id") != user["org_id"]:
        raise HTTPException(404, "employee not found")
    return emp


@router.put("/employees/{emp_id}", dependencies=[Depends(require_perm("hr.update"))])
def update_employee(emp_id: str, payload: EmployeeUpdate, user: dict = Depends(get_current_user)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    return HREmployeeRepository(user["org_id"]).update(emp_id, data)


@router.delete("/employees/{emp_id}", dependencies=[Depends(require_perm("hr.delete"))])
def delete_employee(emp_id: str, user: dict = Depends(get_current_user)):
    HREmployeeRepository(user["org_id"]).delete(emp_id)
    return {"success": True}


@router.get("/employees/{emp_id}/org-chart")
def org_chart(emp_id: str, user: dict = Depends(get_current_user)):
    repo = HREmployeeRepository(user["org_id"])
    items, _ = repo.list(limit=1000)
    children = [e for e in items if e.get("manager_id") == emp_id]
    return {"manager": repo.get(emp_id), "reports": children}


# ---------- Contracts ----------
@router.get("/contracts")
def list_contracts(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    repo = HRContractRepository(user["org_id"])
    filters = []
    if employee_id:
        filters.append(("employee_id", "==", employee_id))
    if status:
        filters.append(("status", "==", status))
    items, total = repo.list(filters=filters or None, limit=500)
    return {"items": items, "total": total}


@router.post("/contracts", dependencies=[Depends(require_perm("hr.create"))])
def create_contract(payload: ContractCreate, user: dict = Depends(get_current_user)):
    return HRContractRepository(user["org_id"]).create(payload.model_dump())


@router.put("/contracts/{cid}", dependencies=[Depends(require_perm("hr.update"))])
def update_contract(cid: str, payload: ContractCreate, user: dict = Depends(get_current_user)):
    return HRContractRepository(user["org_id"]).update(cid, payload.model_dump())


@router.delete("/contracts/{cid}", dependencies=[Depends(require_perm("hr.delete"))])
def delete_contract(cid: str, user: dict = Depends(get_current_user)):
    HRContractRepository(user["org_id"]).delete(cid)
    return {"success": True}


# ---------- Attendance ----------
@router.post("/attendance/check-in", dependencies=[Depends(require_perm("hr.attendance.create"))])
def check_in(payload: CheckInRequest, user: dict = Depends(get_current_user)):
    # Validate employee exists & is active to avoid orphaned attendance records
    emp_repo = HREmployeeRepository(user["org_id"])
    emp = emp_repo.get(payload.employee_id)
    if not emp:
        raise HTTPException(404, "کارمەند نەدۆزرایەوە")
    if emp.get("status") and emp.get("status") != "active":
        raise HTTPException(400, "کارمەند چالاک نییە")

    repo = HRAttendanceRepository(user["org_id"])
    # Prevent duplicate open record
    items, _ = repo.list(filters=[{"field": "employee_id", "op": "==", "value": payload.employee_id}, {"field": "check_out", "op": "==", "value": None}], limit=1)
    if items:
        raise HTTPException(400, "already checked in")
    return repo.create({
        "employee_id": payload.employee_id,
        "check_in": datetime.utcnow().isoformat(),
        "check_out": None,
        "note": payload.note,
        "duration_hours": 0,
    })


@router.post("/attendance/check-out", dependencies=[Depends(require_perm("hr.attendance.update"))])
def check_out(payload: CheckOutRequest, user: dict = Depends(get_current_user)):
    repo = HRAttendanceRepository(user["org_id"])
    rec = repo.get(payload.attendance_id)
    if not rec:
        raise HTTPException(404, "attendance not found")
    check_in_dt = datetime.fromisoformat(rec["check_in"])
    now = datetime.utcnow()
    duration = round((now - check_in_dt).total_seconds() / 3600, 2)
    return repo.update(payload.attendance_id, {
        "check_out": now.isoformat(),
        "duration_hours": duration,
        "note": payload.note or rec.get("note"),
    })


@router.get("/attendance")
def list_attendance(
    employee_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    repo = HRAttendanceRepository(user["org_id"])
    filters = []
    if employee_id:
        filters.append(("employee_id", "==", employee_id))
    items, total = repo.list(filters=filters or None, limit=1000, order_by="check_in", order_dir="DESCENDING")
    if date_from or date_to:
        df = date_from or "0000-01-01"
        dt = date_to or "9999-12-31"
        items = [r for r in items if r.get("check_in", "")[:10] >= df and r.get("check_in", "")[:10] <= dt]
    return {"items": items, "total": len(items)}


@router.get("/attendance/summary")
def attendance_summary(
    employee_id: Optional[str] = None,
    month: Optional[str] = None,  # YYYY-MM
    user: dict = Depends(get_current_user),
):
    """Hours worked per employee in a given month (defaults to current month)."""
    if not month:
        month = datetime.utcnow().strftime("%Y-%m")
    repo = HRAttendanceRepository(user["org_id"])
    filters = []
    if employee_id:
        filters.append(("employee_id", "==", employee_id))
    items, _ = repo.list(filters=filters or None, limit=2000)
    by_emp: dict[str, float] = {}
    for r in items:
        ci = r.get("check_in", "")
        if not ci.startswith(month):
            continue
        eid = r.get("employee_id")
        by_emp[eid] = by_emp.get(eid, 0) + float(r.get("duration_hours") or 0)
    return {"month": month, "summary": [{"employee_id": k, "hours": round(v, 2)} for k, v in by_emp.items()]}


# ---------- Leave Types ----------
@router.get("/leave-types")
def list_leave_types(user: dict = Depends(get_current_user)):
    items, total = HRLeaveTypeRepository(user["org_id"]).list(limit=200)
    return {"items": items, "total": total}


@router.post("/leave-types", dependencies=[Depends(require_perm("hr.create"))])
def create_leave_type(payload: LeaveTypeCreate, user: dict = Depends(get_current_user)):
    return HRLeaveTypeRepository(user["org_id"]).create(payload.model_dump())


@router.delete("/leave-types/{lt_id}", dependencies=[Depends(require_perm("hr.delete"))])
def delete_leave_type(lt_id: str, user: dict = Depends(get_current_user)):
    HRLeaveTypeRepository(user["org_id"]).delete(lt_id)
    return {"success": True}


# ---------- Time Off ----------
def _calc_days(start: str, end: str) -> int:
    """Inclusive day count between two ISO dates. Raises HTTPException on invalid input."""
    try:
        s = date.fromisoformat(start)
        e = date.fromisoformat(end)
    except (ValueError, TypeError):
        raise HTTPException(400, "بەرواری دەستپێک یان کۆتایی نادروستە")
    if e < s:
        raise HTTPException(400, "بەرواری کۆتایی پێش بەرواری دەستپێکە")
    return (e - s).days + 1


@router.get("/time-off")
def list_time_off(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    repo = HRTimeOffRepository(user["org_id"])
    filters = []
    if employee_id:
        filters.append(("employee_id", "==", employee_id))
    if status:
        filters.append(("status", "==", status))
    items, total = repo.list(filters=filters or None, limit=500)
    return {"items": items, "total": total}


@router.post("/time-off", dependencies=[Depends(require_perm("hr.timeoff.create"))])
def create_time_off(payload: TimeOffCreate, user: dict = Depends(get_current_user)):
    days = _calc_days(payload.start_date, payload.end_date)
    # FIX-68: prevent overlapping time-off requests for the same employee
    repo = HRTimeOffRepository(user["org_id"])
    existing, _ = repo.list(
        filters=[
            ("employee_id", "==", payload.employee_id),
            ("status", "in", ["pending", "approved"]),
        ],
        limit=500,
    )
    new_s = date.fromisoformat(payload.start_date)
    new_e = date.fromisoformat(payload.end_date)
    for r in existing:
        try:
            rs = date.fromisoformat(str(r.get("start_date", "")))
            re_ = date.fromisoformat(str(r.get("end_date", "")))
        except (ValueError, TypeError):
            continue
        if rs <= new_e and re_ >= new_s:
            raise HTTPException(
                400,
                f"داواکاری مۆڵەت بەداهات لەگەڵ داواکارییەکی هەنووکەییدا تێکەڵە ({rs} → {re_})",
            )
    return repo.create({
        **payload.model_dump(),
        "days": days,
        "status": "pending",
        "requested_at": datetime.utcnow().isoformat(),
    })


@router.post("/time-off/{to_id}/approve", dependencies=[Depends(require_perm("hr.timeoff.update"))])
def approve_time_off(to_id: str, user: dict = Depends(get_current_user)):
    repo = HRTimeOffRepository(user["org_id"])
    rec = repo.get(to_id)
    if not rec:
        raise HTTPException(404, "داواکاری نەدۆزرایەوە")
    if rec.get("status") == "approved":
        return rec  # idempotent

    # Check & deduct leave balance if a leave_type is set with annual allowance
    leave_type_id = rec.get("leave_type_id")
    requested_days = float(rec.get("days") or 0)
    if leave_type_id and requested_days > 0:
        lt_repo = HRLeaveTypeRepository(user["org_id"])
        lt = lt_repo.get(leave_type_id)
        if lt:
            allowance = float(lt.get("days_per_year") or 0)
            # FIX-67: include extra per-employee allocations for the year
            year = datetime.utcnow().strftime("%Y")
            alloc_repo = HRLeaveAllocationRepository(user["org_id"])
            allocs, _ = alloc_repo.list(
                filters=[
                    ("employee_id", "==", rec.get("employee_id")),
                    ("leave_type_id", "==", leave_type_id),
                    ("year", "==", year),
                ],
                limit=100,
            )
            allowance += sum(float(a.get("days") or 0) for a in allocs)
            if allowance > 0:
                # Sum already-approved days in current year for the same employee + type
                approved, _ = repo.list(
                    filters=[
                        ("employee_id", "==", rec.get("employee_id")),
                        ("leave_type_id", "==", leave_type_id),
                        ("status", "==", "approved"),
                    ],
                    limit=500,
                )
                used = sum(
                    float(a.get("days") or 0)
                    for a in approved
                    if str(a.get("start_date", "")).startswith(year)
                )
                if used + requested_days > allowance:
                    remaining = max(allowance - used, 0)
                    raise HTTPException(
                        400,
                        f"هەژماری پشوو نەماوە. ماوە: {remaining:g} ڕۆژ، داواکراو: {requested_days:g} ڕۆژ",
                    )

    return repo.update(to_id, {
        "status": "approved",
        "approved_at": datetime.utcnow().isoformat(),
        "approved_by": user.get("uid") or user.get("email"),
    })


@router.post("/time-off/{to_id}/reject", dependencies=[Depends(require_perm("hr.timeoff.update"))])
def reject_time_off(to_id: str, reason: Optional[str] = None, user: dict = Depends(get_current_user)):
    return HRTimeOffRepository(user["org_id"]).update(to_id, {
        "status": "rejected",
        "rejected_at": datetime.utcnow().isoformat(),
        "reject_reason": reason,
    })


@router.delete("/time-off/{to_id}", dependencies=[Depends(require_perm("hr.timeoff.delete"))])
def delete_time_off(to_id: str, user: dict = Depends(get_current_user)):
    HRTimeOffRepository(user["org_id"]).delete(to_id)
    return {"success": True}


# ---------- Dashboard ----------
@router.get("/dashboard")
def hr_dashboard(user: dict = Depends(get_current_user)):
    org = user["org_id"]
    employees, _ = HREmployeeRepository(org).list(limit=2000)
    active = [e for e in employees if e.get("status") == "active"]
    contracts, _ = HRContractRepository(org).list(limit=2000)
    pending_to, _ = HRTimeOffRepository(org).list(
        filters=[{"field": "status", "op": "==", "value": "pending"}],
        limit=200,
    )
    today = datetime.utcnow().strftime("%Y-%m-%d")
    att, _ = HRAttendanceRepository(org).list(limit=1000, order_by="check_in", order_dir="DESCENDING")
    today_in = [a for a in att if a.get("check_in", "").startswith(today)]
    return {
        "employees_total": len(employees),
        "employees_active": len(active),
        "active_contracts": len([c for c in contracts if c.get("status") == "active"]),
        "pending_time_off": len(pending_to),
        "checked_in_today": len(today_in),
    }


# ---------- Leave Allocations (FIX-67) ----------

class LeaveAllocationCreate(BaseModel):
    employee_id: str
    leave_type_id: str
    days: float = Field(..., ge=0, le=365)
    year: Optional[str] = None  # YYYY; defaults to current year
    notes: Optional[str] = None


class LeaveAllocationUpdate(BaseModel):
    days: Optional[float] = Field(default=None, ge=0, le=365)
    notes: Optional[str] = None


@router.get("/leave-allocations")
def list_leave_allocations(
    employee_id: Optional[str] = None,
    leave_type_id: Optional[str] = None,
    year: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    repo = HRLeaveAllocationRepository(user["org_id"])
    filters = []
    if employee_id:
        filters.append(("employee_id", "==", employee_id))
    if leave_type_id:
        filters.append(("leave_type_id", "==", leave_type_id))
    if year:
        filters.append(("year", "==", year))
    items, total = repo.list(filters=filters or None, limit=500)
    return {"items": items, "total": total}


@router.post("/leave-allocations", dependencies=[Depends(require_perm("hr.create"))])
def create_leave_allocation(payload: LeaveAllocationCreate, user: dict = Depends(get_current_user)):
    data = payload.model_dump()
    if not data.get("year"):
        data["year"] = datetime.utcnow().strftime("%Y")
    return HRLeaveAllocationRepository(user["org_id"]).create(data)


@router.put("/leave-allocations/{alloc_id}", dependencies=[Depends(require_perm("hr.update"))])
def update_leave_allocation(alloc_id: str, payload: LeaveAllocationUpdate, user: dict = Depends(get_current_user)):
    repo = HRLeaveAllocationRepository(user["org_id"])
    if not repo.get(alloc_id):
        raise HTTPException(404, "بەشکراوە نەدۆزرایەوە")
    body = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    return repo.update(alloc_id, body)


@router.delete("/leave-allocations/{alloc_id}", dependencies=[Depends(require_perm("hr.delete"))])
def delete_leave_allocation(alloc_id: str, user: dict = Depends(get_current_user)):
    repo = HRLeaveAllocationRepository(user["org_id"])
    if not repo.get(alloc_id):
        raise HTTPException(404, "بەشکراوە نەدۆزرایەوە")
    repo.delete(alloc_id)
    return {"deleted": True}



# ----------- Sprint 27: Recruitment + Appraisals + Self-Service (FIX-421..440) -----------

def _br_class(coll: str):
    from app.firestore.base import BaseRepository as _BR
    class _R(_BR):
        collection_name = coll
    return _R


# Job openings
@router.get("/jobs")
def list_jobs(status: str = None, user: dict = Depends(get_current_user)):
    R = _br_class("hr_jobs")
    filters = [{"field": "status", "op": "==", "value": status}] if status else None
    items, total = R(user["org_id"]).list(filters=filters, limit=500, order_by="title")
    return {"items": items, "total": total}


@router.post("/jobs", status_code=201, dependencies=[Depends(require_perm("hr.create"))])
def create_job(data: dict, user: dict = Depends(get_current_user)):
    R = _br_class("hr_jobs")
    payload = {
        "title": data.get("title"),
        "department_id": data.get("department_id"),
        "description": data.get("description", ""),
        "openings": int(data.get("openings") or 1),
        "status": data.get("status", "open"),
        "salary_range": data.get("salary_range"),
    }
    return R(user["org_id"]).create(payload)


@router.put("/jobs/{job_id}", dependencies=[Depends(require_perm("hr.update"))])
def update_job(job_id: str, data: dict, user: dict = Depends(get_current_user)):
    R = _br_class("hr_jobs")
    repo = R(user["org_id"])
    if not repo.get(job_id):
        raise HTTPException(404, "job not found")
    return repo.update(job_id, data)


# Applicants
@router.get("/applicants")
def list_applicants(job_id: str = None, stage: str = None,
                    user: dict = Depends(get_current_user)):
    R = _br_class("hr_applicants")
    filters = []
    if job_id:
        filters.append({"field": "job_id", "op": "==", "value": job_id})
    if stage:
        filters.append({"field": "stage", "op": "==", "value": stage})
    items, total = R(user["org_id"]).list(filters=filters or None, limit=500)
    return {"items": items, "total": total}


@router.post("/applicants", status_code=201)
def create_applicant(data: dict, user: dict = Depends(get_current_user)):
    R = _br_class("hr_applicants")
    payload = {
        "job_id": data.get("job_id"),
        "name": data.get("name"),
        "email": data.get("email"),
        "phone": data.get("phone"),
        "resume_url": data.get("resume_url"),
        "stage": data.get("stage", "new"),  # new|screen|interview|offer|hired|rejected
        "rating": data.get("rating"),
    }
    return R(user["org_id"]).create(payload)


@router.post("/applicants/{app_id}/move-stage",
             dependencies=[Depends(require_perm("hr.update"))])
def move_applicant_stage(app_id: str, data: dict,
                          user: dict = Depends(get_current_user)):
    R = _br_class("hr_applicants")
    repo = R(user["org_id"])
    item = repo.get(app_id)
    if not item:
        raise HTTPException(404, "applicant not found")
    new_stage = data.get("stage")
    if new_stage not in {"new", "screen", "interview", "offer", "hired", "rejected"}:
        raise HTTPException(400, "invalid stage")
    return repo.update(app_id, {"stage": new_stage})


@router.post("/applicants/{app_id}/hire",
             dependencies=[Depends(require_perm("hr.create"))])
def hire_applicant(app_id: str, data: dict = None,
                    user: dict = Depends(get_current_user)):
    """Convert applicant ? Employee record + close stage."""
    R = _br_class("hr_applicants")
    repo = R(user["org_id"])
    item = repo.get(app_id)
    if not item:
        raise HTTPException(404, "applicant not found")
    emp_repo = HREmployeeRepository(user["org_id"])
    emp = emp_repo.create({
        "name": item.get("name"),
        "email": item.get("email"),
        "phone": item.get("phone"),
        "job_title": (data or {}).get("job_title"),
        "department_id": (data or {}).get("department_id"),
        "hire_date": (data or {}).get("hire_date"),
        "salary": (data or {}).get("salary"),
        "status": "active",
        "source_applicant_id": app_id,
    })
    repo.update(app_id, {"stage": "hired", "employee_id": emp["id"]})
    return {"applicant_id": app_id, "employee_id": emp["id"]}


# Appraisals
@router.get("/appraisals")
def list_appraisals(employee_id: str = None, user: dict = Depends(get_current_user)):
    R = _br_class("hr_appraisals")
    filters = [{"field": "employee_id", "op": "==", "value": employee_id}] if employee_id else None
    items, total = R(user["org_id"]).list(filters=filters, limit=500)
    return {"items": items, "total": total}


@router.post("/appraisals", status_code=201,
             dependencies=[Depends(require_perm("hr.create"))])
def create_appraisal(data: dict, user: dict = Depends(get_current_user)):
    R = _br_class("hr_appraisals")
    payload = {
        "employee_id": data.get("employee_id"),
        "period": data.get("period"),
        "manager_id": data.get("manager_id"),
        "scores": data.get("scores", {}),
        "comments": data.get("comments", ""),
        "status": "draft",
    }
    return R(user["org_id"]).create(payload)


@router.post("/appraisals/{ap_id}/finalize",
             dependencies=[Depends(require_perm("hr.update"))])
def finalize_appraisal(ap_id: str, user: dict = Depends(get_current_user)):
    from datetime import datetime as _dt
    R = _br_class("hr_appraisals")
    repo = R(user["org_id"])
    item = repo.get(ap_id)
    if not item:
        raise HTTPException(404, "appraisal not found")
    scores = item.get("scores") or {}
    avg = sum(float(v) for v in scores.values()) / len(scores) if scores else 0
    return repo.update(ap_id, {
        "status": "finalized",
        "average_score": round(avg, 2),
        "finalized_at": _dt.utcnow().isoformat(),
        "finalized_by": user["id"],
    })


# Self-service
@router.get("/self/me")
def self_me(user: dict = Depends(get_current_user)):
    """Return current user's employee record + recent leave/payroll."""
    emp_repo = HREmployeeRepository(user["org_id"])
    emps, _ = emp_repo.list(filters=[
        {"field": "user_id", "op": "==", "value": user["id"]},
    ], limit=1)
    if not emps:
        emps, _ = emp_repo.list(filters=[
            {"field": "email", "op": "==", "value": user.get("email")},
        ], limit=1)
    employee = emps[0] if emps else None
    return {"user_id": user["id"], "employee": employee}


@router.get("/self/payslips")
def self_payslips(user: dict = Depends(get_current_user)):
    from app.firestore.payroll import PayslipRepository
    emp_repo = HREmployeeRepository(user["org_id"])
    emps, _ = emp_repo.list(filters=[
        {"field": "email", "op": "==", "value": user.get("email")},
    ], limit=1)
    if not emps:
        return {"items": [], "total": 0}
    items, total = PayslipRepository(user["org_id"]).list(filters=[
        {"field": "employee_id", "op": "==", "value": emps[0]["id"]},
    ], limit=200)
    return {"items": items, "total": total}



