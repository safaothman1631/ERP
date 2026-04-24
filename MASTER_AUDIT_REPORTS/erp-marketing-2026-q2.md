# Marketing Audit — 2026-Q2
Agent: ERP Marketing | Date: 2026-04-24

## A. Coverage %
**MODULE NOT IMPLEMENTED — Build from zero (0%)**

## B. Top 10 P0/P1 Gaps
| # | Gap | Priority |
|---|-----|----------|
| 1 | No mailing lists collection or API | P0 |
| 2 | No email campaigns (design/send/track) | P0 |
| 3 | No SMS campaigns | P0 |
| 4 | No contacts/subscribers management | P0 |
| 5 | No unsubscribe mechanism | P0 |
| 6 | No marketing automation (drip/workflows) | P1 |
| 7 | No email templates/MJML editor | P1 |
| 8 | No events module | P1 |
| 9 | No surveys module | P1 |
| 10 | No social media integration | P1 |

## C. Quick Wins
- Create `mailing_lists` and `mailing_contacts` Firestore collections
- Build basic CRUD API for lists and contacts (`/api/mailing/*`)
- Add `email_campaigns` collection with SMTP send via existing backend
- Implement unsubscribe token endpoint (public, no auth)
- Add simple email template storage (HTML body)
- Create mailing list import from CSV (reuse `imports.py` pattern)
- Build basic frontend page `/marketing/lists` with Ant Design table
- Add email open tracking via 1x1 pixel

## D. Big Rocks
- **Email Marketing Core:** Campaign builder with MJML/blocks, A/B testing, scheduling, stats dashboard
- **SMS Marketing:** SMS campaigns via local Iraqi providers (Zain/Korek/AsiaCell)
- **Marketing Automation:** Workflow builder (react-flow) with triggers (signup/purchase/tag), actions (email/sms/wait/tag/lead)
- **Events Management:** Event creation, registration, ticketing, QR check-in, attendee tracking
- **Surveys:** Multi-page surveys, conditional logic, question types (MCQ/text/rating), response analysis
- **Social Marketing:** Post scheduling to Facebook/Instagram/Twitter, unified inbox
- **WhatsApp Campaigns:** Integrate with existing `whatsapp.py` for bulk messaging
- **Lead Generation:** Landing pages, forms, UTM tracking, attribution

## E. Odoo Missing (Features)
- Email marketing campaigns with drag-drop editor
- Mailing lists with smart filters (domain-based)
- A/B testing for subject lines
- Email statistics (sent/delivered/opened/clicked/bounced/replied)
- Blacklists and unsubscribe management
- SMS marketing with templates and personalization
- Marketing automation workflows with activity nodes
- Trigger-based campaigns (signup/cart abandon/birthday)
- Event management (tickets, booths, tracks, sponsors)
- Event website integration with online registration
- Survey builder with 12+ question types
- Survey conditional questions and scoring
- Live session surveys with real-time results
- Social media multi-channel posting
- Social listening and engagement tracking

## F. Zoho Campaigns Missing (Features)
- Email campaign templates library (100+ pre-built)
- List hygiene (bounce handling, invalid email removal)
- Social media signup forms
- Poll integration in emails
- Autoresponders (welcome series, drip campaigns)
- Dynamic content blocks (personalization by segment)
- RSS-to-email automation
- Ecommerce triggers (purchase/browse abandon)
- Webinar integration
- CRM sync for lead nurturing
- Workflow automation with conditional logic
- Re-engagement campaigns (inactive subscribers)
- Spam score checker
- Email deliverability reports
- GDPR compliance tools (consent, data export)

## G. Counts
| Category | Backend | Frontend | Odoo Ref |
|----------|---------|----------|----------|
| API files | 0 | 0 | 6 modules |
| Collections | 0 | 0 | 15+ |
| Endpoints | 0 | 0 | 80+ |
| Pages | 0 | 0 | 12+ |

## H. Lead + Skills
**Lead:** ERP Marketing + Zoho Accounting + Backend + Frontend
**Skills:** `email-marketing-patterns`, `automation-builder-workflow`, `smtp-throttling`, `unsubscribe-compliance`
**Deps:** SMTP (existing), SMS provider integration, react-flow for workflow builder, MJML editor
