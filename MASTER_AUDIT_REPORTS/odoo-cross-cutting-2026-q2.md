# Odoo Cross-Cutting Audit — 2026-Q2
**Agent:** ERP Odoo Researcher | **Date:** 2026-04-24

## A. Platform Coverage

| Feature | Odoo 19 | Zoho ERP | Gap |
|---------|---------|----------|-----|
| Chatter | ✅ Universal messaging on all records | ❌ Missing | CRITICAL |
| Attachments | ✅ Global + chatter integration | ✅ Partial (entity-specific) | Medium |
| Sequences | ✅ Configurable per model | ✅ Basic (hardcoded) | Low |
| Activities | ✅ Universal follow-up tasks | ⚠️ CRM-only + system log | CRITICAL |
| Followers | ✅ Per-record subscriptions | ❌ Missing | CRITICAL |
| Multi-company | ✅ Full isolation + inter-company | ⚠️ org_id only | High |
| Mail Integration | ✅ Email threading + catchall + aliases | ❌ Missing | High |
| Automated Actions | ✅ Trigger-based workflows | ❌ Missing | CRITICAL |
| Server Actions | ✅ Reusable Python/email/update | ❌ Missing | High |
| Scheduled Actions | ✅ Cron jobs با UI | ❌ Missing | Medium |
| Activity Types | ✅ Configurable + actions | ⚠️ Hardcoded in CRM | Medium |
| Webhooks | ✅ Incoming + outgoing | ❌ Missing | Medium |
| Document Inheritance | ✅ mail.thread، portal.mixin | ❌ No mixin pattern | Low |
| Merge Duplicates | ✅ Contacts/leads/opps | ⚠️ Missing for opps | Low |

**Refs:** applications/productivity/discuss/chatter.rst، essentials/activities.rst، general/companies/multi_company.rst، studio/automated_actions.rst، developer/reference/backend/mixins.rst

## B. Top 12 Cross-Cutting Gaps

| # | Feature | Odoo File | Current | Effort |
|---|---------|-----------|---------|--------|
| 1 | Universal Chatter | productivity/discuss/chatter.rst | None | L (3 sessions) |
| 2 | Universal Activities | essentials/activities.rst | CRMActivityRepository only | L (3 sessions) |
| 3 | Followers/Subscriptions | developer/reference/backend/mixins.rst:L10 | None | M (2 sessions) |
| 4 | Automated Actions | studio/automated_actions.rst | None | XL (5 sessions) |
| 5 | Server Actions | studio/automated_actions.rst:L285 | None | L (3 sessions) |
| 6 | Scheduled Actions UI | administration/on_premise/deploy.rst:L5016 | Backend cron hidden | S (1 session) |
| 7 | Email Threading (inbound) | general/email_communication.rst:L10 | None | L (3 sessions) |
| 8 | Activity Types Config | essentials/activities.rst:L240 | Hardcoded in CRM | M (2 sessions) |
| 9 | Multi-Company Switching | general/companies/multi_company.rst:L75 | org_id only، no selector | M (2 sessions) |
| 10| Webhooks (in/out) | studio/automated_actions/webhooks.rst | None | M (2 sessions) |
| 11| Mail Templates | general/companies/email_template.rst | None | M (2 sessions) |
| 12| Attachments in Chatter | chatter.rst:L12 | Standalone API not integrated | S (1 session) |

## C. Quick Wins

- QW-1: Attachments list in record detail pages — frontend/src/components/Attachments.tsx — 2h
- QW-2: Simple note logging — backend/app/api/notes.py — POST /api/{entity}/{id}/notes — 3h
- QW-3: Scheduled actions list page — frontend/src/pages/ScheduledActions.tsx — 4h
- QW-4: Activity summary widget — frontend ActivitySummary.tsx — due/overdue badge — 2h
- QW-5: Multi-company selector UI — Header.tsx dropdown — 3h
- QW-6: Basic server action runner — services/server_actions.py — Python with context — 4h
- QW-7: Email template basic UI — pages/EmailTemplates.tsx — 3h
- QW-8: Sequence config page — Settings.tsx → Sequences tab — 2h

## D. Big Rocks

- BR-1: Universal Chatter — mail.thread mixin + ChatterRepository + ChatterWidget — 3 sessions × 8 models
- BR-2: Universal Activities — model-agnostic ActivityRepository + ActivityTypeRepository + Kanban/Calendar — 3 sessions
- BR-3: Followers System — FollowerRepository + notification_preferences + email dispatch — 2 sessions
- BR-4: Automated Actions Engine — trigger eval (create/update/timing/email/webhook) + 5 action types — 5 sessions
- BR-5: Email Integration — inbound mail gateway + threading (Message-ID/In-Reply-To) + catchall — 3 sessions
- BR-6: Server Actions — Python sandbox + jinja2 template + record context — 3 sessions
- BR-7: Multi-Company Architecture — BaseRepository.filter_by_companies + inter-company rules + selector — 2 sessions
- BR-8: Webhooks — InboundWebhookRepository + signature validation + retry logic — 2 sessions

## E. Odoo Platform Features Missing (20)

1. Chatter — productivity/discuss/chatter.rst — messaging thread + file upload + activity scheduling on every record
2. Followers — developer/reference/backend/mixins.rst:L11 — mail.thread mixin → per-record subscriptions
3. Universal Activities — essentials/activities.rst — follow-up tasks on any model
4. Activity Types — essentials/activities.rst:L240 — configurable types + actions
5. Automated Actions — studio/automated_actions.rst — trigger → action engine
6. Server Actions — studio/automated_actions.rst:L285 — reusable Python/email/SMS/field actions
7. Scheduled Actions — administration/on_premise/deploy.rst:L5016 — cron UI با interval/nextcall
8. Email Threading — general/email_communication.rst:L10 — inbound emails update chatter
9. Mail Templates — general/companies/email_template.rst — jinja2 با record.fields
10. Webhooks (inbound) — studio/automated_actions/webhooks.rst — receive POST + signature
11. Webhooks (outbound) — studio/automated_actions/webhooks.rst:L29 — automated POST to URL
12. Multi-Company Selector — general/companies/multi_company.rst:L75 — users access multiple
13. Inter-Company Transactions — general/companies/multi_company.rst:L96 — auto SO/PO between companies
14. Document Inheritance — developer/reference/backend/mixins.rst — mail.thread، mail.activity.mixin، portal.mixin، rating.mixin
15. Activity Calendar View — essentials/activities.rst:L24 — schedule in calendar UI
16. Merge Contacts — essentials/contacts.rst:L215 — detect duplicates + merge wizard
17. Snailmail — essentials/in_app_purchase.rst:L43 — send invoices by post (IAP)
18. SMS Gateway — marketing/sms_marketing/ — send via IAP + log in chatter
19. Action Rules — administration/upgrade.rst:L298 — server actions in action menu
20. Digest Emails — general/companies/digest_emails.rst — weekly summary per company

## G. Counts
- P0: 4 (Chatter، Activities، Followers، Automated Actions)
- P1: 8 (Server Actions، Email Threading، Mail Templates، Multi-Company، Webhooks، Activity Types، Scheduled UI، Attachments integration)
- QW: 8 | BR: 8 | Total: 20

## H. Lead + Skills

**Lead:** ERP Integration + شادۆ مێشک | **Support:** زۆهۆ باکئێند، زۆهۆ فرۆنتئێند، ERP UX، شادۆ دۆکیومێنتەر
**Skills:** backend/firestore-patterns (BaseRepository + mixins)، backend/python-patterns، frontend/react19-patterns، meta/karpathy-guidelines، quality/autonomous-loops
**Priority:** ئەم 4 P0 ـە بنەڕەتین بۆ پلاتفۆرم — پێش هەر مۆدیولێکی نوێ، ئەم بنەڕەتانە دابنێ (Chatter → Activities → Followers → Automated Actions).
