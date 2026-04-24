---
description: "Use when: building CRM module, leads management, opportunities, sales pipeline, Kanban board, lead scoring, lead source, lost reasons, activities, meetings, calls log, email integration with CRM, convert lead to opportunity, convert opportunity to quote, sales team management, CRM dashboard"
name: "ERP CRM"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی لە CRM دروست بکەم؟ — نموونە: Pipeline Kanban، Lead form، ئۆتۆماتیکی Activity"
---

# ERP CRM — پسپۆڕی CRM

## دۆمین
Leads، Opportunities، Pipeline، Sales Teams، Activities، Lost Reasons.

## سەرچاوەی Odoo
- `odoo-19-ERP.md` §`applications/sales/crm/`
- acquire_leads.rst، pipeline.rst، performance.rst، track_leads.rst

## مۆدێلی داتا (پێشنیار — بۆ Firestore)

| Collection | Fields |
|-----------|--------|
| `crm_teams` | name, leader_id, members[], target_monthly |
| `crm_stages` | name, sequence, team_id, is_won, fold |
| `crm_leads` | name, partner_name, email, phone, source, stage_id=new, team_id, user_id, expected_revenue, probability, priority, tags[], active, lost_reason |
| `crm_activities` | lead_id, type (call/email/meeting/todo), due_date, user_id, note, done |
| `crm_lost_reasons` | name, active |

## Endpointەکان (پێشنیار)

| Method | Path |
|--------|------|
| GET/POST/PUT/DELETE | `/api/crm/leads` |
| POST | `/api/crm/leads/{id}/convert-opportunity` |
| POST | `/api/crm/leads/{id}/won` |
| POST | `/api/crm/leads/{id}/lost` (body: lost_reason_id) |
| POST | `/api/crm/leads/{id}/move-stage` (body: stage_id) |
| GET/POST/PUT/DELETE | `/api/crm/stages`, `/api/crm/teams`, `/api/crm/activities` |
| GET | `/api/crm/pipeline` — گرووپ بە stage |
| GET | `/api/crm/reports/win-rate`, `/api/crm/reports/forecast` |

## UI
- `/crm/pipeline` — Kanban drag-drop بە stage
- `/crm/leads` — لیست + filter + bulk actions
- `/crm/lead/{id}` — Form + Activities timeline + Convert دوگمە
- `/crm/dashboard` — Win rate، Forecast، Top performers

## Integration
- لە هەموو lead ـەوە → Convert to Quote (erp-sales-purchase)
- Email open/click tracking → Activities (erp-integration)
- Audit هەموو stage changes (erp-security-audit)

## ڕێنمایی
- Kanban دەبێت drag-drop پشتگیری بکات (react-dnd یان AntD Cards).
- ستاتوسی `won` ئۆتۆماتیکی Quote دروست بکات.
- Lead scoring: فۆرمولای سادە (recency + size + source weight).
