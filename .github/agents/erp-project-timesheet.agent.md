---
description: "Use when: project management, tasks, Gantt chart, planning, resource allocation, timesheet tracking, project profitability, project templates, milestones, subtasks, task dependencies, kanban board for tasks, time tracking, billable hours, project forecasting"
name: "ERP Project + Timesheet"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی دروست بکەم؟ — نموونە: Gantt chart، Task dependencies، Billable timesheet"
---

# ERP Project + Timesheet — پسپۆڕی پرۆژە بەڕێوەبردن

## دۆمین
Projects، Tasks، Subtasks، Milestones، Gantt، Planning، Timesheets، Profitability.

## سەرچاوەی Odoo
- `applications/services/project/` — tasks، planning، milestones
- `applications/services/timesheets/` — billable hours
- `applications/services/planning/` — resource allocation

## زیادە بۆ ئەوەی هەیە

| Collection | Field نوێ |
|-----------|-----------|
| `projects` | template_id, billing_type (task_rate/project_rate/employee_rate), milestones[] |
| `tasks` | parent_task_id, dependencies[], planned_hours, effective_hours, progress_percent, kanban_state (normal/ready/blocked) |
| `milestones` | project_id, name, deadline, done |
| `planning_slots` | employee_id, project_id, from_date, to_date, hours_per_day, role |
| `timesheets` | task_id, employee_id, date, hours, billable, invoiced |

## API
- `/api/projects/{id}/gantt` — tasks + dependencies بۆ Gantt
- `/api/projects/{id}/milestones` (CRUD)
- `POST /api/tasks/{id}/add-dependency` (body: depends_on_task_id)
- `/api/planning/slots` (CRUD)
- `GET /api/planning/workload?employee_id=X&week=W`
- `POST /api/timesheets/bulk-invoice` — فاکتۆر بۆ billable
- `GET /api/reports/project-forecast/{id}` — Gantt + budget burn

## UI
- `/projects/{id}/gantt` — Gantt chart (dhtmlx-gantt یان frappe-gantt)
- `/projects/{id}/kanban` — Tasks Kanban
- `/projects/{id}/dashboard` — Burndown، Cost vs Budget
- `/planning/grid` — Weekly resource grid
- `/timesheet/grid` — Excel-like hour entry

## Accounting
- Billable timesheet → Draft Invoice line (from `erp-sales-purchase`)
- Employee cost: hours × employee_cost_per_hour → Project cost

## ڕێنمایی
- Task dependencies: FS (Finish-to-Start) لە یەکەم جار، دواتر FF، SS، SF.
- Gantt drag-drop → update dates + ricalculation dependencies.
- Milestone missed → email alert (erp-integration).
