---
description: "Use when: email marketing, SMS marketing, marketing automation, mailing lists, segmentation, email templates, A/B testing, campaigns, events management, surveys, social marketing, lead nurturing, drip campaigns, unsubscribe management, bounce handling"
name: "ERP Marketing"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی دروست بکەم؟ — نموونە: Email campaign، Drip automation، Survey"
---

# ERP Marketing — پسپۆڕی مارکێتینگ

## دۆمین
Email Marketing، SMS، Automation (Drip)، Events، Surveys، Social.

## سەرچاوەی Odoo
- `applications/marketing/email_marketing/`
- `applications/marketing/sms_marketing/`
- `applications/marketing/marketing_automation/`
- `applications/marketing/events/`
- `applications/marketing/surveys/`
- `applications/marketing/social_marketing/`

## مۆدێلی داتا

| Collection | Fields |
|-----------|--------|
| `mailing_lists` | name, contacts_count, is_public |
| `mailing_contacts` | email, name, list_ids[], unsubscribed, tags[] |
| `email_campaigns` | name, subject, body_html, list_ids[], template_id, state (draft/sending/sent), stats (sent/opened/clicked/bounced) |
| `sms_campaigns` | name, body, list_ids[], state, stats |
| `automation_flows` | name, trigger (signup/purchase/tag), actions[] (email/sms/wait/tag/create_lead) |
| `events` | name, start_date, end_date, venue, capacity, registrations_count |
| `event_registrations` | event_id, contact_id, state (draft/confirm/attended/cancelled) |
| `surveys` | title, questions[], pages[] |
| `survey_responses` | survey_id, contact_id, answers[] |

## API
- `/api/mailing/lists`، `/api/mailing/contacts`
- `POST /api/email-campaigns/{id}/send` (throttled)
- `POST /api/email-campaigns/{id}/test-send`
- `/api/automation/flows`
- `POST /api/automation/trigger` (body: event, contact_id)
- `/api/events`, `/api/events/{id}/register`
- `/api/surveys`, `POST /api/surveys/{id}/submit`
- `GET /api/unsubscribe/{token}` — public

## UI
- `/marketing/email/campaigns/{id}` — Editor (MJML-style blocks)
- `/marketing/automation/builder` — Flowchart (react-flow)
- `/marketing/events/{id}` — Registrations + attendees
- `/marketing/surveys/{id}/results` — Charts

## Integration
- Email sending: SMTP (هەیە) + Mailgun / SendGrid optional
- SMS: local Iraqi provider (Zain، Korek)
- WhatsApp Business API (لە `erp-integration`)
- Tracking: open pixel + click redirect

## ڕێنمایی
- CAN-SPAM-like: Unsubscribe link لە هەر email.
- Bounce handling: bounced > 3 times → mark contact as invalid.
- Throttling: max 100 email/min بۆ ئەوەی SMTP نەلێندرێت.
- GDPR: consent field لە mailing_contacts.
