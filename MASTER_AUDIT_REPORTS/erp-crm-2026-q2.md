# CRM Audit — 2026-Q2
**Agent:** ERP CRM | **Date:** 2026-04-24

## A. Coverage Snapshot

| Reference | Coverage % | Notes |
|-----------|-----------|-------|
| Odoo 19   | ~30%      | Pipeline + leads + opps هەیە، Sales Teams، automation، scoring نییە |
| Zoho CRM  | ~25%      | Core entities هەیە، Accounts/Workflows/Templates/Reports نییە |

| Domain | Odoo % | Zoho % |
|--------|--------|--------|
| Core Entities | 50% | 40% |
| Pipeline | 70% | 55% |
| Activities | 40% | 25% |
| Reporting | 35% | 30% |
| Automation | 0% | 0% |
| Lead Generation | 0% | 0% |

## B. Top P0/P1 Gaps (max 10)

| ID | Severity | Title | File(s) | Odoo ref | Zoho ref | Effort |
|----|----------|-------|---------|----------|----------|--------|
| G-1 | P0 | No Sales Teams/Territory | backend/app/api/crm.py:N/A | applications/sales/crm/pipeline/manage_sales_teams.rst | Sales Teams | L |
| G-2 | P0 | No Accounts entity (vs Contacts) | backend/app/api/crm.py:N/A | — | Accounts module | L |
| G-3 | P0 | No Contacts CRUD inside CRM | backend/app/api/crm.py:N/A | partner integration | Contacts | M |
| G-4 | P0 | Lost Reasons mandatory check missing | crm.py:L345 | applications/sales/crm/pipeline/lost_opportunities.rst | Lost Reason field | S |
| G-5 | P1 | No Predictive Lead Scoring | crm.py:N/A | applications/sales/crm/track_leads/lead_scoring.rst | Scoring Rules | L |
| G-6 | P1 | No Lead Enrichment (IAP) | crm.py:N/A | applications/sales/crm/optimize/lead_enrichment.rst | — | M |
| G-7 | P1 | No UTM Marketing Attribution | crm.py:N/A | applications/sales/crm/track_leads/marketing_attribution.rst | Campaigns | M |
| G-8 | P1 | No Email Templates + Mass Email | new module | mail integration | Email Templates | L |
| G-9 | P1 | No Workflow/Assignment Rules | new module | server actions | Workflow + Blueprint | XL |
| G-10| P1 | No Lead Mining | crm.py:N/A | applications/sales/crm/acquire_leads/lead_mining.rst | Lead Mining | M |

## C. Quick Wins

- QW-1: Lost Reasons collection — backend/app/firestore/crm.py — Add CRMLostReasonRepository — 2h
- QW-2: Merge duplicate leads/opps — backend/app/api/crm.py — POST /leads/{id}/merge، /opportunities/{id}/merge — 4h
- QW-3: Lead/Opp detail pages — frontend/src/pages/CRMLeadDetail.tsx، CRMOpportunityDetail.tsx — 3h
- QW-4: Expected Revenue Report — crm.py:L420 — GET /reports/expected-revenue (sum amount × probability/100) — 2h
- QW-5: Bulk actions (archive, assign) — frontend/src/pages/CRMLeads.tsx:L87 — selection + bulk API — 3h
- QW-6: Activity reminders/due today — frontend/src/pages/CRMActivities.tsx:L40 — filter due_date <= today + badge — 2h
- QW-7: Tags for leads/opps — backend/app/schemas/crm.py — add tags: list[str] — 1h
- QW-8: Probability bounds [0,100] check — crm.py:L75 — Pydantic ge/le validators — 0.5h

## D. Big Rocks

- BR-1: Sales Teams Module — multi-team، territory، quotas، leaderboard — 2 weeks (deps: RBAC)
- BR-2: Accounts Module — separate Company entity، hierarchy، industry، revenue — 1.5 weeks (deps: Contacts refactor)
- BR-3: Full Automation Engine — Workflow Rules + Assignment Rules + Blueprints — 3 weeks (deps: Activities، Email، Audit)
- BR-4: Predictive Lead Scoring — Naive Bayes ML، variable config — 2 weeks (deps: ≥200 historical opps)
- BR-5: Marketing Attribution — UTM tracking، multi-touch — 2 weeks (deps: Marketing app)
- BR-6: Lead Enrichment — IAP service بۆ company data — 1.5 weeks
- BR-7: Email Integration — Templates، Mass، Email-to-Lead، tracking — 3 weeks
- BR-8: Gamification — Goals، badges، leaderboards — 1 week (deps: Sales Teams)

## E. Odoo Features Missing

- acquire_leads/lead_mining.rst — IAP prospecting
- track_leads/lead_scoring.rst — ML probability
- optimize/lead_enrichment.rst — Company data fetch
- track_leads/marketing_attribution.rst — UTM + multi-touch reports
- optimize/gamification.rst — Goals، badges، leaderboards
- pipeline/manage_sales_teams.rst — Teams، territories، quotas، aliases
- optimize/partner_autocomplete.rst — Address autocomplete IAP
- optimize/member_partner_module.rst — Membership tracking
- pipeline/merge_similar.rst — Duplicate detection + merge wizard
- pipeline/lost_opportunities.rst — Lost reason mandatory + statistics
- performance/expected_revenue_report.rst — Revenue by stage × probability
- performance/forecast_report.rst — Monthly/quarterly forecast
- performance/win_loss.rst — Win rate by segment/salesperson
- track_leads/quality_leads_report.rst — Lead health metrics
- track_leads/lead_distribution_report.rst — Assignment balance
- track_leads/unattended_leads_report.rst — SLA tracking
- track_leads/resellers.rst — Channel partner portal
- optimize/utilize_activities.rst — Activity types، templates، auto-schedule
- acquire_leads/email_manual.rst — Email-to-lead conversion
- acquire_leads/send_quotes.rst — One-click quote generation
- acquire_leads/opportunities_form.rst — Custom fields، layouts
- acquire_leads/convert.rst — Multi-step conversion wizard

## F. Zoho Features Missing

### Core Entities
- Accounts (Companies) — separate from Contacts، hierarchy، parent، industry، revenue
- Contacts CRUD — Person entity، multiple contacts per account
- Deals (Enhanced Opps) — products، competitors، deal reviews

### Modules
- Campaigns — campaign mgmt، member status، ROI
- Vendors، Products، Price Books، Quotes، Sales Orders، Purchase Orders، Invoices (link to CRM)
- Cases، Solutions

### Automation (50+ items)
- Workflow Rules، Assignment Rules، Blueprints، Approvals، Macros، Schedules، Scoring Rules

### Communication
- Email Templates، Mass Email، SalesInbox، Telephony، Social CRM، Notes، Attachments، Feeds، Tags

### Lead Generation
- Web Forms، Web-to-Lead، Webinars، Lead Import (CSV mapping)، Duplicate Detection

### Reports & Analytics
- Dashboards، Custom Report Builder، Funnels، Forecasting، Target Meter

### Customization
- Custom Fields، Custom Modules، Layouts، Related Lists، Picklists، Multi-User Portal، Canvas، Sandbox

### Mobile/Integrations
- Native iOS/Android، Offline Mode، Zia AI، Marketplace، REST/SOAP API

## G. Counts
- P0: 4 | P1: 6 | P2: ~10 | QW: 8 | BR: 8

| Metric | Current | Odoo Target | Zoho Target |
|--------|---------|-------------|-------------|
| Backend Endpoints | 22 | 60+ | 120+ |
| Firestore Collections | 4 | 12 | 25+ |
| Frontend Pages | 4 | 12 | 20+ |
| Reports | 3 | 10+ | 20+ |
| Automation Rules | 0 | 0 | 50+ |
| Integrations | 0 | 3 | 10+ |

## H. Recommended Lead + Skills

**Lead:** ERP CRM | **Support:** زۆهۆ مێشک (orchestration)، زۆهۆ فرۆنتئێند، زۆهۆ باکئێند

**Skills:**
- backend/api-design-fastapi (automation endpoints)
- backend/firestore-patterns (Accounts، Workflows، Rules schemas)
- frontend/react19-patterns (Builder UI)
- frontend/antd-rtl-patterns (Blueprints، Scoring config forms)
- testing/e2e-playwright (workflow E2E)
- security/agentshield-rules (user-defined rules validation)
- meta/karpathy-guidelines

**Sprint Plan (3 sprints, 6 weeks):**
- Sprint X: Sales Teams + Accounts + Contacts + QW (Lost Reasons، Merge، Tags، Expected Revenue)
- Sprint X+1: Workflow Rules engine + Assignment Rules + Activity Templates
- Sprint X+2: Predictive Lead Scoring (ML) + Marketing Attribution (UTM)

**Notes:**
- Architecture decision: CRM currently standalone — needs integration with contacts/sales/marketing
- Data model gap: Zoho separates Accounts (companies) from Contacts (people) — refactor needed
- ML feature needs ≥200 historical won/lost opps for training
- Backend Kurdish error i18n incomplete (crm.py:L338 mixed)
