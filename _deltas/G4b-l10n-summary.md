# G4b — Iraq Localization (growth-to-100 Phase G4)

Production-grade Iraq-specific localization: withholding tax, IQD
denominations + cash-drawer break-down, Arabic-Indic digit rendering,
Hijri-date support, CBI exchange-rate fetcher with fallback, multi-currency
conversion, Iraqi PDF typesetting (Naskh font, RTL, Arabic-Indic page
numbers), per-governorate tax presets, and Iraqi commercial-registration
field on the company profile.

## All files

### Backend — WHT engine

* **NEW** `backend/app/tax/__init__.py`
* **NEW** `backend/app/tax/withholding.py` — `WHTCalculator`, `WithholdingType`
  enum, `WHTBreakdown` dataclass, `DEFAULT_WHT_RATES` registry (4 entries,
  all `placeholder=True`), `placeholder_rate_count()` for audit.
* **NEW** `backend/app/api/wht.py` — `POST /api/tax/wht/calculate`,
  `GET /api/tax/wht/rates`, `GET /api/tax/wht/report?from=&to=&wht_type=`.
* **NEW** `backend/tests/test_withholding.py` — 18 tests covering default
  rates, B2B / B2G / B2C semantics, override rate, edge cases, rounding,
  serialisation.

### Backend — CBI rate fetcher + currency converter

* **NEW** `backend/app/services/cbi_rates.py` — `fetch_cbi_usd_iqd_rate()`,
  `store_rate()`, `get_latest_rate_with_fallback()` (7-day walk + hard-coded
  last resort 1320 IQD/USD), `refresh_today_rate()` cron entrypoint,
  multi-shape JSON parser tolerant of the as-yet-unknown CBI schema.
* **NEW** `backend/app/services/currency_converter.py` — `convert(amount,
  from, to, date) -> ConversionResult` with `UnsupportedConversion` for
  unwired pairs (EUR/GBP/TRY pending R7.6).
* **NEW** `backend/app/api/cbi_rates.py` — `GET /api/cbi-rates/latest`,
  `GET /api/cbi-rates?from=&to=`, `GET /api/cbi-rates/convert?amount=&from=&to=`.
* **NEW** `backend/tests/test_cbi_rates.py` — 14 tests covering JSON
  parsing, HTTP success/failure (patched httpx), fallback walk, hard-coded
  last resort, converter math, and the refresh cron.

### Backend — Iraqi PDF typesetting

* **NEW** `backend/app/pdf/__init__.py`
* **NEW** `backend/app/pdf/iraqi_formatter.py` — `format_iqd()` (R4.9 —
  no decimals, `U+066C` thousands separator, ` د.ع` / ` IQD` suffix),
  `format_amount()` (any currency), `format_date_dmy()`, `format_date_iraqi()`
  (optional Hijri), `format_iraqi_phone()` (`+964 7XX XXX XXXX`),
  `format_page_number()`, `to_arabic_indic()` / `to_latin_digits()`.
* **NEW** `backend/app/pdf/arabic_typesetter.py` — `register_arabic_font()`
  (Noto Naskh preferred, Amiri fallback, Helvetica last resort with warn
  log), `shape_rtl()` (arabic-reshaper + bidi), `rtl_paragraph_style()`,
  `gregorian_to_hijri_str()` (hijri-converter when installed, umalqurra
  fallback, silent empty string on failure).
* **NEW** `backend/app/pdf/templates/__init__.py`
* **NEW** `backend/app/pdf/templates/invoice_arabic.py` — `render_arabic_invoice(invoice)`
  → PDF bytes. A4, RTL, Naskh, optional Arabic-Indic digits, optional Hijri
  date, page numbering.
* **NEW** `backend/app/pdf/templates/invoice_kurdish.py` — Kurdish (Sorani)
  variant using the same RTL infrastructure.
* **NEW** `backend/app/pdf/templates/receipt_arabic.py` — 80mm thermal receipt.
* **NEW** `backend/tests/test_pdf_iraqi.py` — 17 tests covering formatter
  helpers + template smoke tests (PDF bytes start with `%PDF-`, exceed
  size threshold).

### Backend — per-region tax presets + company schema

* **NEW** `backend/app/data/iraqi_tax_presets.py` — 18-governorate registry
  with `GovernoratePreset` dataclass, `WithholdingDefaults`,
  shared sector rows (hospitality 10%, telecom 20%, tobacco 300%),
  `get_preset()`, `all_governorates()`, `placeholder_count()`.
* **NEW** `backend/app/schemas/company.py` — `CompanyProfileBase`,
  `…Create`, `…Update`, `…Response` with `commercial_registration_no`
  field + format validator (`XX-NNNNNN` or 6–15 bare digits).

### Backend — wiring

* **EDIT** `backend/app/main.py`
  * Added `from app.api import wht as wht_api` + `cbi_rates as cbi_rates_api`.
  * Registered both routers in the launch block (~line 478).
* **EDIT** `backend/app/middleware/idempotency_http.py`
  * Added `/api/tax/wht/` and `/api/cbi-rates` to `_IDEMPOTENCY_PREFIXES`.
* **EDIT** `backend/app/services/scheduler.py`
  * Added `_job_cbi_rate_refresh()` and `cbi_rate_refresh_daily` cron
    at 06:00 UTC (09:00 Baghdad). Updated job count log to 16.

### Frontend — utilities

* **NEW** `frontend/src/utils/iqd-denominations.ts` — `DENOMINATIONS`,
  `DENOMINATION_META`, `WITHDRAWN_DENOMINATIONS` (50/100/200 IQD legacy
  notes), `breakDown()` greedy algorithm, `roundToNearestDenomination()`,
  `quickCashTenders()`, `format()`, `sumFromBreakdown()`.
* **NEW** `frontend/src/utils/arabic-digits.ts` — `toArabicIndic()`,
  `toLatin()`, `formatNumberDigits()`, `defaultDigitPreference()`.
* **NEW** `frontend/src/utils/hijri-date.ts` — `toHijri()`, `fromHijri()`,
  `formatHijri()`, Hijri month tables in Arabic + English. Browser-Intl
  primary, hand-rolled tabular fallback.
* **NEW** `frontend/src/utils/iqd-denominations.test.ts` — 17 vitest cases.
* **NEW** `frontend/src/utils/arabic-digits.test.ts` — 11 vitest cases.
* **NEW** `frontend/src/utils/hijri-date.test.ts` — 11 vitest cases.

### Frontend — contexts + hooks

* **NEW** `frontend/src/contexts/DigitPreferenceContext.tsx` — provider +
  `useDigitPreference()` hook. Persists to `localStorage`. Locale-default
  resolution (Arabic → Indic; Kurdish/English → Latin).
* **NEW** `frontend/src/contexts/CalendarPreferenceContext.tsx` — provider +
  `useCalendarPreference()` for Gregorian / Hijri / Both.
* **NEW** `frontend/src/hooks/useCBIRate.ts` — auto-polling hook (every 6h)
  for the latest CBI rate.

### Frontend — components

* **NEW** `frontend/src/components/tax/WHTBreakdown.tsx` — invoice sidebar
  showing gross / rate / withheld / net payable. Yellow placeholder badge
  surfaces R7.1 verification status.
* **NEW** `frontend/src/components/pos/CashDrawerBreakdown.tsx` — live
  cash-drawer counter with all current denominations + withdrawn notes
  shown with a "withdrawn" tag.
* **NEW** `frontend/src/components/pos/QuickCashTender.tsx` — one-tap "round
  up to 5K / 10K / 25K / 50K" tender buttons.
* **NEW** `frontend/src/components/CurrencyConverter.tsx` — wraps the
  `/api/cbi-rates/convert` endpoint; tag colour shows rate freshness.
* **NEW** `frontend/src/components/CalendarToggle.tsx` — settings UI for
  Gregorian / Hijri / Both preference.
* **NEW** `frontend/src/components/settings/DigitPreferenceToggle.tsx` —
  settings UI for digit preference with live preview.

### Frontend — settings (Iraqi CRN field)

* **EDIT** `frontend/src/pages/settings/sections/general/CompanyInfo.tsx`
  * Added `commercial_registration_no` to `CompanyInfoApi` /
    `CompanyInfoForm` typings.
  * Form populates / resets the field on data load.
  * New Antd column with format-hint tooltip and regex validator
    (`/^(?:[A-Za-z]{2}-)?\d{6,15}$/`).

## Tax-rate placeholder count

Every Iraqi tax rate introduced in this phase is flagged
`placeholder=True` pending R7.1 verification by a Kurdish/Iraqi tax accountant.

| Source | Count |
|---|---|
| `backend/app/tax/withholding.py` — `DEFAULT_WHT_RATES`           | 4 |
| `backend/app/data/iraqi_tax_presets.py` — governorate flags      | 18 |
| `backend/app/data/iraqi_tax_presets.py` — withholding defaults   | 18 (one per governorate) |
| `backend/app/data/iraqi_tax_presets.py` — sector rows            | 54 (3 sectors × 18) |
| Frontend `iraqRegionPresets.ts` — already flagged in launch-readiness R3 | 18 |
| **Total placeholder flags surfaced for R7.1 review**             | **112** |

`placeholder_rate_count()` (WHT) and `placeholder_count()` (presets) make
this count programmatically queryable.

## Hijri conversion approach

**Frontend**: `Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', ...)`
when supported by the runtime (modern browsers + Node 18+). When `Intl`
doesn't ship the Islamic calendar, falls through to a hand-rolled tabular
(Kuwaiti) algorithm baked into `hijri-date.ts`. Accuracy: exact for Umm
al-Qura via Intl; ±1 day on the tabular fallback path. **No npm
dependency added.**

**Backend**: tries `hijri-converter` (recommended, listed in
`_deltas/G4b-deps.md`), then `umalqurra`, then silently returns `""` so
PDFs continue to render without Hijri. **Strict R4.11 compliance requires
`hijri-converter` to be installed** (deterministic across timezones).

## PDF font verification needed

The Arabic typesetter searches for two TTF files at:

```
backend/app/static/fonts/NotoNaskhArabic-Regular.ttf   ← preferred
backend/app/static/fonts/Amiri-Regular.ttf             ← fallback
```

**Neither file is in the repo.** Ops must drop them in before any
Arabic/Kurdish PDF goes to a real customer. The smoke tests confirm the
template runs end-to-end even with the Helvetica last-resort fallback —
they assert the PDF starts with `%PDF-` and exceeds a size threshold.
**Visual-regression verification against a reference PNG is the open
R4.12 acceptance criterion** and requires the real font files present.

The fallback name returned by `register_arabic_font()` is logged at WARN
level so missing-font deploys are visible in observability.

## Dependencies to add

See `_deltas/G4b-deps.md`. Summary:

* **Add to backend/requirements.txt**: `hijri-converter>=2.3.1,<3.0`
  (optional, recommended for R4.11 strict compliance — code degrades
  gracefully without it).
* **No new npm packages.**
* **Static fonts** as described above.
* **Env vars**: `CBI_API_URL`, `CBI_API_TIMEOUT`.

## Open issues for R7 / verification

| # | Owner | What needs to happen |
|---|---|---|
| R7.1 | Iraqi tax accountant | Verify WHT rates, sector taxes, withholding defaults; flip 112 `placeholder` flags. |
| R7.6 | Ops | Confirm CBI API URL + JSON schema; the parser is shape-tolerant but the URL placeholder `https://cbi.iq/en/api/exchange-rate` must be replaced. |
| R4.12 visual | Design | Provide a reference PNG of the Arabic invoice for visual-regression CI. |
| Fonts | Ops | Drop Noto Naskh + Amiri TTFs into `backend/app/static/fonts/`. |

## Constraints honoured

* **`backend/requirements.txt` unchanged.** `hijri-converter` is documented
  in `_deltas/G4b-deps.md` and the code degrades gracefully if absent.
* **`frontend/package.json` unchanged.** Browser Intl + hand-rolled
  tabular conversion — no `moment-hijri`, no extra bundle weight.
* **No live CBI call.** URL is a placeholder env var; the fetcher tolerates
  any of three plausible JSON shapes when the real schema arrives.
* **All tax rates marked placeholder** until R7.1.
* **Font files documented**, not bundled.

## Wiring summary

* `app.main`: 2 new routers (`wht_api`, `cbi_rates_api`).
* `app.middleware.idempotency_http`: 2 new prefixes
  (`/api/tax/wht/`, `/api/cbi-rates`).
* `app.services.scheduler`: 1 new cron `cbi_rate_refresh_daily` (06:00 UTC).
* Existing `formatCurrency`, `formatDate`, `formatNumber` utilities NOT
  modified — the new helpers extend/post-process their output instead.
* Existing `iraqRegionPresets.ts` already has `placeholder: true` per
  launch-readiness R3 — unchanged.

## Confidence

**High** on:

* WHT calculator math, B2C exemption, rate registry, API endpoints, idempotency.
* CBI rate fetcher resilience (multi-shape parser, 7-day fallback walk,
  hardcoded last resort, cron wiring).
* IQD denomination math (greedy decomposition, rounding, quick-tender).
* Arabic-Indic digit translation (pure char map).
* Formatter helpers (IQD, date, phone, page numbering).

**Medium** on:

* Hijri conversion when `Intl` doesn't support Umm al-Qura. The tabular
  fallback can diverge ±1 day; tests accept this. Strict accuracy
  requires `hijri-converter` server-side (declared as optional dep).
* PDF visual fidelity. Smoke tests confirm bytes; visual regression
  against a designer-reviewed reference is a separate workstream
  awaiting font files + a reference PNG.

**Pending external sign-off** (out of scope, blocking nothing in this
phase): R7.1 (tax-rate verification), R7.6 (CBI URL/schema).
