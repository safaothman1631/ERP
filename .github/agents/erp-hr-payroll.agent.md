---
description: "Use when: HR module, employee management, contracts, attendance tracking, time off leaves, payroll, payslips, salary rules, allowances, deductions, social security, tax withholding for employees, recruitment, job positions, candidates, appraisals, employee self-service, HR reports, organizational chart"
name: "ERP HR + Payroll"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی دروست بکەم؟ — نموونە: Attendance system، Payslip generator، Time-off approval"
---

# ERP HR + Payroll — پسپۆڕی سەرچاوە مرۆییەکان و مووچە

## دۆمین
Employees، Contracts، Departments، Attendance، Time-off، Recruitment، Appraisals، Payroll.

## سەرچاوەی Odoo
- `applications/hr/employees/` — managers، departments، contracts
- `applications/hr/attendances/` — check-in/out
- `applications/hr/time_off/` — allocation، approval
- `applications/hr/payroll/` — salary rules، payslips
- `applications/hr/recruitment/` — job positions، candidates
- `applications/hr/appraisals/`

## مۆدێلی داتا

### Employees
| Collection | Fields |
|-----------|--------|
| `departments` | name, manager_id, parent_id |
| `job_positions` | name, department_id, requirements |
| `employees` | name, email, phone, department_id, job_id, manager_id, hire_date, birth_date, national_id, bank_account, status |
| `contracts` | employee_id, start_date, end_date, wage, schedule, state (draft/running/expired) |

### Attendance
| Collection | Fields |
|-----------|--------|
| `attendances` | employee_id, check_in, check_out, worked_hours, method (manual/pin/face/barcode) |
| `work_schedules` | name, hours_per_day, days_of_week[], attendance_policy |

### Time-off
| Collection | Fields |
|-----------|--------|
| `leave_types` | name, allocation_required, paid, color |
| `leave_allocations` | employee_id, type_id, year, days_allocated, days_remaining |
| `leave_requests` | employee_id, type_id, from_date, to_date, days, state (draft/confirm/approve/refuse), approver_id |

### Recruitment
| Collection | Fields |
|-----------|--------|
| `job_openings` | position_id, state (open/closed), recruiter_id |
| `candidates` | name, email, phone, job_id, stage (new/interview/offer/hired), resume_url |

### Payroll
| Collection | Fields |
|-----------|--------|
| `salary_rules` | name, code, category (basic/allowance/deduction/tax), formula (python/percent/fixed), sequence |
| `salary_structures` | name, rule_ids[] |
| `payslip_batches` | name, period_from, period_to, state |
| `payslips` | employee_id, batch_id, contract_id, period_from, period_to, gross, net, state, lines[] |
| `payslip_lines` | payslip_id, rule_id, amount, quantity, rate |

## API

### Employees
- `/api/hr/departments`, `/api/hr/positions`, `/api/hr/employees`, `/api/hr/contracts`
- `GET /api/hr/employees/{id}/timeline` — all events

### Attendance
- `POST /api/hr/attendance/check-in` (body: employee_id, method)
- `POST /api/hr/attendance/check-out`
- `GET /api/hr/attendance?employee_id=X&from=Y&to=Z`

### Time-off
- `/api/hr/leave-types`, `/api/hr/leave-allocations`, `/api/hr/leave-requests`
- `POST /api/hr/leave-requests/{id}/approve`
- `POST /api/hr/leave-requests/{id}/refuse`

### Recruitment
- `/api/hr/job-openings`, `/api/hr/candidates`
- `POST /api/hr/candidates/{id}/hire` → create employee

### Payroll
- `/api/hr/salary-rules`, `/api/hr/salary-structures`
- `POST /api/hr/payslip-batches` → generate for all employees
- `POST /api/hr/payslips/{id}/compute`
- `POST /api/hr/payslips/{id}/confirm`
- `GET /api/hr/payslips/{id}/pdf`

## UI
- `/hr/employees` — Kanban + List
- `/hr/org-chart` — Tree view
- `/hr/attendance/kiosk` — Full-screen PIN/Face check-in
- `/hr/my-timesheet` — Self-service
- `/hr/leaves/calendar` — Team calendar
- `/hr/recruitment/pipeline` — Kanban
- `/hr/payroll/batches/{id}` — Compute + confirm

## Payroll فۆرمولای عێراق (لە ڕێی `erp-localization-iraq`)
```
Basic Salary     (from contract)
+ Allowances     (transport، food، housing)
- Social Security 5% (employee) + 12% (employer)
- Income Tax      (Progressive: 0-250k=0%، 250k-500k=3%، 500k-1M=5%، 1M+=15%)
= Net Salary
```

## Accounting Impact
هەر Payslip Confirmed → JE:
- DR Salary Expense
- CR Net Salary Payable (Liability)
- CR Social Security Payable
- CR Income Tax Payable

## ڕێنمایی
- Self-service portal بۆ هەر employee (token-based لە `erp-integration`).
- Attendance geofencing پێشنیاردەکرێت بۆ site workers.
- Payslip PDF بە زمانی کوردی.
- GDPR-like: `national_id` encrypted.
