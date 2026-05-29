# Power-User Training Video Scripts (T-SF.6.23)

> Spec: scale-foundation SF6. Record **10 power-user training videos**, each narrated in **Kurdish (Sorani)** and **Arabic** → 20 videos live in the `kb` module.
> These are the **scripts** (titles + shot-by-shot narration). Recording the actual videos is field/production work (external blocker).

## Production conventions

- **Length target:** 2–4 minutes each. Power-user shorts, not webinars.
- **Format:** screen recording of the real app (POS terminal + back office) with a voice-over. Capture on a 10" tablet layout where the topic is POS, desktop layout for back-office topics.
- **Language:** record each script twice — once Kurdish, once Arabic. Keep the on-screen UI in the language being narrated (the app is trilingual). Optionally burn in subtitles in the other language.
- **Naming:** `kb/training/<NN>-<slug>.<lang>.mp4` (e.g. `kb/training/01-first-sale.ku.mp4`, `…/01-first-sale.ar.mp4`).
- **Intro/outro:** 3s branded intro, 3s outro pointing to the next video. Keep it tight.
- **Real data:** use a demo tenant with realistic Iraqi products (with Arabic/Kurdish names) and IQD pricing. Never show real customer PII.
- **Accessibility:** subtitles file (`.vtt`) per language; the narration text in each script doubles as the subtitle source.

## The 10 scripts

| # | Slug | Title (theme) | Primary module | Iraq edge-cases reinforced |
|---|------|---------------|----------------|----------------------------|
| 01 | `first-sale` | Your first sale, start to receipt | POS | EC-21, EC-32, EC-01 |
| 02 | `printer-and-hardware` | Pairing your printer, scanner & cash drawer | Hardware | EC-12, EC-15, EC-16, EC-31, EC-32 |
| 03 | `offline-power-cuts` | Selling through power cuts (offline mode) | POS offline | EC-07, EC-08, EC-09 |
| 04 | `cash-iqd-rounding` | Cash, change & IQD rounding | POS payments | EC-01, EC-30 |
| 05 | `daftar-credit` | Customer credit — the digital daftar | Customers / AR | EC-17, EC-20 |
| 06 | `usd-iqd-pricing` | Selling in USD and IQD together | Multi-currency | EC-02, EC-03, EC-04 |
| 07 | `inventory-stock` | Stock in, stock counts & low-stock alerts | Inventory | EC-10, EC-30, EC-27 |
| 08 | `receipts-language` | Receipts in Kurdish & Arabic the way you want | Receipts/settings | EC-12, EC-13, EC-14, EC-26 |
| 09 | `day-close-reports` | Closing the day & reading your numbers | Reports | EC-11, EC-01 |
| 10 | `vat-einvoice` | VAT settings & e-Fakhata basics | Tax/compliance | EC-22, EC-23, EC-24, EC-25 |

Each script file contains: a metadata header, the shot list, and **two full narration tracks (KU + AR)** keyed to the shot numbers so the editor can sync voice to screen.

## How to use a script

1. Open the script; rehearse the shot list against the live app once.
2. Record the screen following the shots, then record the KU voice track, then the AR voice track (or record voice live per language).
3. Cut to the narration timing; generate `.vtt` subtitles from the narration text.
4. Upload both language versions to the `kb` module under `training/`; tag with the module + edge-case IDs for searchability.
