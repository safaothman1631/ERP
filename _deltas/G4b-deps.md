# G4b Iraq Localization — Dependencies

Phase: growth-to-100 Phase G4 (Iraq Compliance, non-e-Fakhata portions).
This file lists the dependencies that **need to be added** to make the new
modules light up. Per project rules I did not touch `backend/requirements.txt`
or `frontend/package.json` — the user adds them.

## Backend (Python)

Already present in `backend/requirements.txt`:

  * `reportlab>=4.0.0`               — PDF generation
  * `arabic-reshaper>=3.0.0`         — Arabic glyph shaping
  * `python-bidi>=0.6.0`             — BIDI algorithm
  * `httpx>=0.27.0`                  — CBI HTTP fetch
  * `apscheduler>=3.10.4`            — daily CBI cron

**To add for Hijri date conversion (optional but recommended):**

```
hijri-converter>=2.3.1,<3.0
```

If `hijri-converter` is not installed, the Arabic typesetter silently
returns an empty Hijri string — the Gregorian date still renders so
no template breaks. Tests do not require this dependency.

## Frontend (TypeScript / npm)

**No new npm dependencies.** All Hijri conversion uses the browser's built-in
`Intl.DateTimeFormat` with `calendar: 'islamic-umalqura'` and a tabular
fallback hand-written in `utils/hijri-date.ts`. The choice was deliberate —
shipping `moment-hijri` adds ~150KB to the bundle and we deleted moment
elsewhere in the codebase.

## Static font files

The Arabic typesetter looks for two font files at:

```
backend/app/static/fonts/NotoNaskhArabic-Regular.ttf      (preferred)
backend/app/static/fonts/Amiri-Regular.ttf                (fallback)
```

**Neither file is bundled in the repo** — they must be dropped in by ops
during deploy. If both are missing the PDF still renders but Arabic
glyphs fall back to Helvetica (boxes/tofu). Both fonts are free for
commercial use under the SIL Open Font License.

Download:
  * Noto Naskh Arabic: https://fonts.google.com/noto/specimen/Noto+Naskh+Arabic
  * Amiri:             https://fonts.google.com/specimen/Amiri

## Environment variables

```
CBI_API_URL=https://cbi.iq/en/api/exchange-rate   # placeholder pending R7.6
CBI_API_TIMEOUT=10
```
