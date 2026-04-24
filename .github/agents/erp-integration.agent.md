---
description: "Use when: external API integration, webhooks, WhatsApp Business API, OCR invoice scanning, receipt scanning, payment gateway integration FIB Zain Asia Stripe, SMS gateway, email SMTP, Google Maps, calendar sync, bank API, currency exchange API, third-party apps, iPaaS, Zapier-like flows"
name: "ERP Integration"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی بکەمە یەکگرتوو؟ — نموونە: WhatsApp، FIB payment، Receipt OCR، Webhook"
---

# ERP Integration — پسپۆڕی یەکگرتنی دەرەکی

## دۆمین
Webhooks، External APIs، Payment Gateways، WhatsApp، OCR، SMS، Email.

## سەرچاوەی Odoo
- `developer/reference/external_api.html` — XML-RPC، JSON-RPC
- `applications/finance/payment_providers/` — Stripe، PayPal، local

## مۆدێلی داتا

| Collection | Fields |
|-----------|--------|
| `webhooks` | name, event (invoice.paid/lead.won/...), url, secret, active, last_fired_at |
| `webhook_deliveries` | webhook_id, payload, response_status, attempts, success |
| `integrations` | name, type (whatsapp/stripe/fib/zain/mailgun), credentials (encrypted), org_id, active |
| `api_calls` | integration_id, endpoint, request, response, duration_ms, status |
| `payment_providers` | type, config, fee_percent, is_online, supported_currencies[] |

## Payment Gateways عێراقی

| Gateway | Method |
|---------|--------|
| FIB (First Iraqi Bank) | Direct API + QR |
| Zain Cash | OTP flow |
| Asia Hawala | Manual confirm |
| FastPay | Card |
| Stripe | International |

### API
- `POST /api/payments/initiate` (body: invoice_id, provider) → returns payment_url or QR
- `POST /api/payments/webhook/{provider}` (public، verify signature)
- `POST /api/payments/confirm` (manual)

## WhatsApp Business API
- `POST /api/integrations/whatsapp/send` (body: to, template, variables)
- `POST /api/webhooks/whatsapp` (incoming messages)
- Use cases: invoice PDF، payment reminder، OTP، order status

## OCR (Receipt/Bill Scanning)
- Service: `backend/app/services/ocr_service.py`
- Libraries: `easyocr` (کوردی/عەرەبی) + `pytesseract` fallback
- Flow:
  1. Upload image → `POST /api/ocr/scan-receipt`
  2. Server extracts: vendor, date, total, lines, tax
  3. Returns structured JSON → UI pre-fills expense form
- Accuracy target: ٧٠٪+، user confirms.

## Webhooks (Outbound)
- Event catalog: `invoice.created`, `invoice.paid`, `lead.won`, `order.confirmed`, `payment.received`, `stock.moved`, etc.
- Retry policy: exponential backoff، max 5 attempts.
- Signing: HMAC-SHA256 with secret.

## API
- `/api/webhooks` (CRUD)
- `POST /api/webhooks/{id}/test` — send dummy payload
- `GET /api/webhooks/{id}/deliveries` — history
- `/api/integrations` (CRUD with encrypted credentials)

## UI
- `/settings/integrations` — marketplace-style cards
- `/settings/webhooks` — list + test button
- `/settings/payment-providers` — enable/disable + fees
- `/scan` — mobile-first camera page → OCR

## ڕێنمایی
- Credentials **هەمیشە encrypted** لە DB.
- Webhook payload **هەمیشە signed** بە HMAC.
- Payment confirm **هەمیشە server-side** verify بە provider API.
- Rate limit: 100 req/min per integration.
- Fallback: ئەگەر WhatsApp API down بوو → email backup.
