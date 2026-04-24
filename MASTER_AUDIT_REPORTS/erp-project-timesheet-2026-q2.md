# Project+Timesheet Audit — 2026-Q2
Agent: ERP Project + Timesheet | Date: 2026-04-24

## A. Coverage % (one-liner)
~15% — Basic project CRUD + nested tasks/time_entries only. Zero Gantt, dependencies, milestones, billable hours, planning, helpdesk.

## B. Top 10 Gaps (table)

| # | Gap | Impact | Odoo Ref |
|---|-----|--------|----------|
| 1 | **No Gantt chart** | Cannot visualize timeline/dependencies | project/milestones |
| 2 | **No task dependencies** | Cannot model FS/FF/SS/SF relationships | project/tasks/task_dependencies |
| 3 | **No milestones** | Cannot track key deliverables or invoice by milestone | project/project_milestones |
| 4 | **No timesheet billing rates** | Cannot track billable vs non-billable hours | timesheets/billing_rates |
| 5 | **No project profitability** | Cannot see cost vs budget burn | project/project_profitability |
| 6 | **No resource planning/allocation** | Cannot plan employee capacity | planning |
| 7 | **No helpdesk/SLA** | Cannot track support tickets with deadlines | helpdesk/overview/sla |
| 8 | **No subtasks** | Cannot break down complex tasks | project/tasks/sub-tasks |
| 9 | **No recurring tasks** | Manual recreation for repeat work | project/tasks/recurring_tasks |
| 10 | **No project templates** | Duplicate setup for similar projects | project/project_management/project_templates |

## C. Quick Wins (max 8)

1. **Milestones CRUD** — `api/projects/{id}/milestones`, link tasks to milestone
2. **Task dependencies** — `tasks.depends_on[]`, kanban_state (blocked/ready/normal)
3. **Billable flag** — `time_entries.billable=true/false`, timesheet approval
4. **Project dashboard** — Budget vs spent, hours logged, task completion %
5. **Task stages** — Kanban columns (todo/in_progress/done/blocked)
6. **Subtasks** — `tasks.parent_task_id`, nested view
7. **Project templates** — Copy project structure
8. **Time entry bulk invoice** — POST `/timesheets/bulk-invoice` → draft invoices

## D. Big Rocks (max 8)

1. **Gantt chart UI** — dhtmlx-gantt or frappe-gantt, drag-drop dates, dependency arrows
2. **Resource planning grid** — Weekly allocation per employee/project, workload heatmap
3. **Timesheet grid** — Excel-like weekly hour entry, project/task dropdowns
4. **Project profitability report** — Cost (employee_hours × cost_rate) vs revenue (billed), margin %
5. **Helpdesk module** — Tickets, SLA policies, escalation, customer portal
6. **Field Service Management (FSM)** — On-site tasks, worksheets, map view
7. **Recurring tasks** — Cron pattern, auto-generate tasks
8. **Task dependency engine** — Auto-block successor tasks, Gantt recalc on date changes

## E. Odoo missing (max 15)

1. Task dependencies (FS/FF/SS/SF)
2. Milestones (linked to tasks, invoicing)
3. Gantt view with drag-drop
4. Subtasks (parent_task_id)
5. Recurring tasks (cron)
6. Project templates
7. Project profitability dashboard
8. Timesheet billing rates (billable/non-billable)
9. Timesheet leaderboard
10. Planning/resource allocation
11. Helpdesk tickets
12. SLA policies (deadlines, escalation)
13. Field Service Management (on-site tasks)
14. Task stages/kanban customization
15. Project forecast (Gantt + budget burn)

## F. Zoho Projects missing (max 15)

1. Task dependencies (critical path)
2. Milestones (deliverables)
3. Gantt chart
4. Time tracking approval workflow
5. Billable/non-billable hours
6. Project budgeting (planned vs actual)
7. Resource utilization reports
8. Project profitability
9. Task templates
10. Custom fields for tasks
11. Task reminders/notifications
12. Client portal (view project progress)
13. Document attachments on tasks
14. Task checklists
15. Time entry bulk operations

## G. Counts

| Metric | Count |
|--------|-------|
| Backend endpoints | 10 (projects.py only) |
| Frontend pages | 1 (Projects.tsx) |
| Firestore collections | 3 (projects, project_tasks, time_entries) |
| Schemas | 2 (ProjectCreate, ProjectResponse) |
| Missing modules | 4 (tasks, timesheets, helpdesk, planning) |
| Odoo docs sections | 5 (project, timesheets, helpdesk, planning, FSM) |
| Gantt-ready | ❌ No |
| Billing-ready | ❌ No |

## H. Lead + skills (3 lines)

**Lead:** ERP Project + Timesheet  
**Skills:** `python-patterns`, `firestore-patterns`, `api-design-fastapi`, `react19-patterns`, `antd-rtl-patterns`, `karpathy-guidelines`  
**Estimate:** 8-12 sprints (Gantt + Dependencies: 2-3, Timesheet billing: 2, Planning: 2, Helpdesk+SLA: 3-4, FSM: 2-3)
