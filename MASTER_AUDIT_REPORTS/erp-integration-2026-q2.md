# Integration Audit — 2026-Q2
**Agent:** ERP Integration | **Date:** 2026-04-24

## A. Coverage (which integrations exist?)

| Integration | Status | Collections/Files | Notes |
|------------|--------|-------------------|-------|
| WhatsApp Business API | ✅ Implemented | `whatsapp_messages`, `whatsapp_templates` | Meta Cloud API v20.0, status lifecycle, templates |
| OCR (Receipt Scanning) | ✅ Implemented | `receipt_scans` | pytesseract + PIL, Kurdish/Arabic support, heuristic parser |
| E-Invoice Iraq | ✅ Implemented | `einvoice_submissions` | XML signing, QR generation, ITA portal integration |
| Email SMTP | ✅ Implemented | `email_logs` | Invoice/quote PDF attachment, org-level SMTP config |
| Payment Links | ✅ Basic | `payment_links` | Token-based, expiry tracking, manual payment recording |

**Missing:** Payment gateways (FIB/Stripe/Zain Cash), SMS, calendar sync, bank API, Zapier, webhooks (outbound), Google Maps, currency API.

---

## B. Top 10 Missing Integrations

| # | Integration | Priority | Impact | Complexity | Iraq Relevance |
|---|------------|----------|--------|------------|----------------|
| 1 | FIB Payment Gateway | CRITICAL | HIGH | MEDIUM | 🇮🇶 Primary bank |
| 2 | Zain Cash | CRITICAL | HIGH | MEDIUM | 🇮🇶 Mobile payments |
| 3 | Stripe | HIGH | HIGH | LOW | International cards |
| 4 | SMS Gateway (Zain/Asiacell) | HIGH | MEDIUM | LOW | 🇮🇶 OTP + notifications |
| 5 | Outbound Webhooks | HIGH | MEDIUM | MEDIUM | Event-driven automation |
| 6 | Google Maps API | MEDIUM | MEDIUM | LOW | Delivery/shipping tracking |
| 7 | Bank Statement Import (FIB/RBI) | MEDIUM | MEDIUM | MEDIUM | 🇮🇶 Auto reconciliation |
| 8 | Currency Exchange API | MEDIUM | LOW | LOW | CBI rates (IQD/USD/EUR) |
| 9 | FastPay | MEDIUM | MEDIUM | MEDIUM | 🇮🇶 Card payments |
| 10 | Google Calendar/Outlook Sync | LOW | LOW | MEDIUM | Appointment scheduling |

---

## C. Quick Wins (max 8)

1. **SMS Gateway Integration** — کوردی و عەرەبی OTP + payment reminders (2 days)
2. **Payment Links → QR Code** — Generate QR for mobile payment apps (1 day)
3. **WhatsApp → Invoice PDF** — Auto-attach invoice PDF to WhatsApp message (0.5 day)
4. **Currency Exchange API** — Daily CBI rate fetch + auto-update (1 day)
5. **Email → Retry Logic** — Failed email retry with exponential backoff (0.5 day)
6. **OCR → Multi-language** — Add Arabic-only mode (easyocr) (1 day)
7. **Payment Links → Partial Payment** — Allow partial invoice payment (1 day)
8. **Google Maps → Geocode API** — Customer address → lat/lng for delivery (1 day)

---

## D. Big Rocks (max 8)

1. **FIB Gateway Integration** — Direct API + QR code flow (10 days)
2. **Zain Cash Gateway** — OTP-based payment flow (8 days)
3. **Stripe Gateway** — International credit/debit cards (5 days)
4. **Outbound Webhooks** — Event catalog + retry policy + HMAC signing (7 days)
5. **Bank Statement Import (FIB)** — OFX/CSV parser + auto-match (10 days)
6. **iPaaS (Zapier-style)** — Visual flow builder + triggers/actions (20 days)
7. **Calendar Sync (Google/Outlook)** — Two-way sync for appointments (8 days)
8. **Asia Hawala Gateway** — Manual confirmation flow (5 days)

---

## E. External services Odoo offers (max 10)

1. **Bank Sync** — Plaid (US/CA), Yodlee (EU), Salt Edge (worldwide)
2. **Payment Providers** — Stripe, PayPal, Adyen, Razorpay, Mollie, Authorize.net, Flutterwave, Paymob, Xendit
3. **SMS** — IAP-based SMS (global coverage)
4. **WhatsApp** — WhatsApp Business API (same as implemented)
5. **E-Invoice** — Country-specific (Mexico CFDI, Italy FatturaPA, Egypt ETA, Saudi ZATCA, etc.)
6. **Shipping** — FedEx, UPS, DHL, USPS (carrier APIs)
7. **Silverfin** — Accounting sync for EU accountants
8. **Google Maps** — Geocoding + distance matrix
9. **Calendar** — Google Calendar, Outlook, CalDAV
10. **Document AI** — OCR + document parsing (IAP-based)

---

## F. Zoho Marketplace integrations (max 10)

1. **Zoho Books → Stripe** — Payment gateway
2. **Zoho Books → PayPal** — Payment gateway
3. **Zoho Books → Razorpay** — Payment gateway (India)
4. **Zoho Books → WhatsApp** — Invoice sharing
5. **Zoho Books → SMS** — Payment reminders
6. **Zoho Books → Google Drive** — Document backup
7. **Zoho Books → Zapier** — 2000+ app integrations
8. **Zoho Books → Slack** — Notifications
9. **Zoho Books → Mailchimp** — Customer sync
10. **Zoho Books → Twilio** — SMS/voice

---

## G. Counts

| Metric | Count |
|--------|-------|
| Implemented integrations | 5 |
| API endpoints (integration-specific) | ~28 |
| Collections | 6 (`whatsapp_messages`, `whatsapp_templates`, `receipt_scans`, `einvoice_submissions`, `email_logs`, `payment_links`) |
| Services | 4 (`whatsapp_service.py`, `ocr_service.py`, `einvoice_service.py`, `email_service.py`) |
| External libraries | 4 (pytesseract, PIL, httpx, reportlab) |
| Missing critical integrations (Iraq-specific) | 4 (FIB, Zain Cash, FastPay, SMS) |
| Missing standard integrations | 6 (Stripe, webhooks, bank sync, calendar, Google Maps, currency API) |

---

## H. Lead + skills (3 lines)

**Lead:** ERP Integration — پسپۆڕی یەکگرتنی دەرەکی (webhooks، gateways، external APIs)  
**Skills:** `.github/skills/backend/api-design-fastapi.md` + `.github/skills/security/security-review-owasp.md` (credential encryption، HMAC signing، retry policies، rate limiting)  
**Next:** FIB Gateway → Zain Cash → Stripe → Outbound Webhooks → SMS → Bank Sync
