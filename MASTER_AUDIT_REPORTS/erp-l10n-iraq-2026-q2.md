# Iraq Localization Audit — 2026-Q2
**Agent:** ERP Localization Iraq | **Date:** 2026-04-24

## A. Coverage Snapshot

| Domain | Coverage % | Notes |
|--------|-----------|-------|
| Tax Engine | 85% | VAT/WHT/Corp/Municipal categories ✅، rate constants need verify |
| Chart of Accounts | 95% | Iraq CoA seeded، WHT payable code missing |
| IQD Formatting | 75% | symbol+zero-decimals OK، inconsistent across pages |
| E-Invoice (ITA) | 60% | XML+QR+signature ✅، ITA-specific schema + portal API not wired |
| Hijri Calendar | 0% | not implemented |
| Compliance Reports | 40% | VAT return + WHT summary ✅، Form 5/3/SS-1 PDFs missing |
| Payment Gateways | 0% | FIB/Zain Cash/Asia Hawala not integrated |
| RTL & Kurdish/Arabic | 90% | RTL OK، no Arabic locale، PDF not RTL-aware |
| **OVERALL** | **~68%** | 19 gaps total |

## B. Top P0/P1 Gaps (max 10)

| ID | Severity | Title | File(s) | Ref | Effort |
|----|----------|-------|---------|-----|--------|
| G-1 | P0 | ITA-specific e-invoice XML schema (not generic) | backend/app/services/einvoice_service.py:L113 | ITA Tech Specs 2025 | M (8h) |
| G-2 | P0 | ITA portal API integration (currently stub) | backend/app/api/einvoice.py:L149 | ITA REST API | L (12h) |
| G-3 | P0 | Iraq VAT Form 5 PDF (compliance) | backend/app/api/l10n_iq.py:L124 | Iraq Form 5 (2024) | L (10h) |
| G-4 | P0 | Arabic (ar) locale missing (legal req) | frontend/src/locales/ | Iraq Trade Law | M (8h) |
| G-5 | P1 | FIB PayWay integration | new | FIB PayWay API | L (16h) |
| G-6 | P1 | Corporate tax return (Form 3) | new | Iraq Income Tax Law | L (12h) |
| G-7 | P1 | Social security report (Form SS-1) | backend/app/services/payroll.py:L143 | Iraq SS Law | M (6h) |
| G-8 | P1 | PDF reports not RTL-aware (no Arabic/Kurdish font) | backend PDF templates | Odoo report_aeroo RTL | L (10h) |
| G-9 | P1 | ITA fiscal ID format (currently UUID-based) | backend/app/services/einvoice_service.py:L72 | ITA Fiscal ID Algorithm | M (4h) |
| G-10| P2 | VAT rate = 0.0 (currently suspended), needs comment/config | backend/app/api/l10n_iq.py:L14 | Iraq Tax Law 2023 | XS (5min) |

## C. Quick Wins

- QW-1: Add WHT Payable account code 2155 — backend/app/seed/chart_of_accounts.py:L44 — 15min
- QW-2: VAT rate documentation comment — l10n_iq.py:L14 — 5min
- QW-3: Reverse-charge VAT UI label — Invoices.tsx tax breakdown — 1h
- QW-4: Consistent IQD formatting (replace toLocaleString with formatCurrency) — ~15 files — 1h
- QW-5: Arabic-Indic numerals option — formatters.ts + settings — 3h
- QW-6: Municipal tax (KRG 10%) auto-apply flag — schema + tax_calc.py — 2h

## D. Big Rocks

- BR-1: ITA E-Invoice full integration (schema + portal API + fiscal ID) — 24h
- BR-2: FIB PayWay integration (initiate + webhook + verification) — 16h
- BR-3: Zain Cash integration (mobile wallet + QR flow) — 12h
- BR-4: Asia Hawala integration (custom + manual testing) — 20h
- BR-5: Hijri Calendar (org setting + DatePicker wrapper + dual display) — 10h
- BR-6: Iraq compliance PDFs (Form 5 + Form 3 + SS-1) — 28h
- BR-7: PDF RTL templates with Cairo/Amiri font embedding — 10h
- BR-8: Arabic locale (~1200 keys translation) — 8h

## E. Required Compliance References

- Iraq Tax Law 113/1982 (amended 2020): VAT, WHT, Corporate Tax
- Iraq e-Invoice Portal: portal.mof.gov.iq/einvoice
- Odoo Fiscal Localizations: applications/finance/fiscal_localizations.rst
- KRG Municipal Law 12/2013
- FIB PayWay API: fib.iq/en/corporate/payway
- Iraq Income Tax Law Art. 4 (2003, amended 2020)
- Iraq Social Security Law (Law 39/1971, amended 2014)

## F. Existing Strengths

- VAT calculation engine with compound tax support (services/tax_calc.py:L14-L220)
- Withholding rules: 3% goods، 5% services، 7% contracts (l10n_iq.py:L23-L27)
- Withholding summary report (l10n_iq.py:L91-L121)
- VAT return endpoint (l10n_iq.py:L124-L164)
- Social security 5%/12% (services/payroll.py:L20-L21)
- 2FA TOTP، refresh tokens، JWT jti revocation
- Iraq CoA seeded with Kurdish + English
- IQD symbol (د.ع)، zero decimals
- RTL automatic، Kurdish UI complete

## G. Counts
- P0: 4 | P1: 5 | P2: 1 | QW: 6 | BR: 8
- Total effort: ~136h (~17 days)

## H. Recommended Lead + Skills

**Lead:** ERP Localization Iraq | **Support:** زۆهۆ ئەکاونتینگ (CoA + reports)، ERP HR + Payroll (SS report)، ERP Integration (payment gateways)

**Skills:**
- backend/python-patterns
- backend/firestore-patterns
- security/agentshield-rules (payment gateway credentials)
- frontend/antd-rtl-patterns (PDF RTL)
- meta/karpathy-guidelines

**Sprint Priority:**
- Sprint A: ITA E-Invoice + Arabic locale + VAT Form 5 (compliance critical) — 36h
- Sprint B: FIB PayWay + corp tax + SS report — 34h
- Sprint C: PDF RTL + Hijri + remaining QWs — 24h

**Risks:**
- ITA portal API requires merchant registration at mof.gov.iq
- FIB/Zain Cash require merchant agreements
- Asia Hawala has no public docs (custom integration)
