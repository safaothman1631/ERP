# Pilot Agreement — `p-a-supermarket-erbil`

> **Per-pilot instantiation of `templates/pilot-agreement.md`.** This is the redacted markdown kept in git; the signed PDF lives in Notion/DMS.
> **DRAFT — pending licensed-counsel review (T-SF.2.x). Not a binding agreement; not legal advice.**
> _This is a worked EXAMPLE for the toolkit. The business below is illustrative, not a real signed customer._

## §0 — Key facts for this pilot

| Field | Value |
|-------|-------|
| Pilot code | `p-a-supermarket-erbil` |
| Customer (trade name) | "Hawler Fresh Market" (illustrative) |
| Owner-operator contact | Aram — owner/operator |
| Sector / city | Supermarket · Erbil (Erbil governorate) |
| Plan tier | Retail (POS + Inventory + Accounting) |
| Hardware kit on loan | **Kit A — Shopkeeper Starter** (Xprinter XP-T80A, LS2208 scanner, 10" tablet, EB-3000 cash drawer) — `docs/sales/hardware-kits.md` |
| Pilot start (Day 0) | 2026-06-30 (on-site deploy + training) |
| Pilot end (Day 30) | 2026-07-30 |
| Tenant `org_id` | `org_pilot_paerbil` (illustrative) |
| Pilot channel URL | `https://pilot---zoho-erp-xxxxxx-uc.a.run.app` (tagged revision) |

## Agreement body

Full clauses (purpose, mutual commitments, data ownership, case-study rights, SLA, fees, conversion, termination, liability, governing law) are in **`templates/pilot-agreement.md`** (ku / ar / en). For this pilot:

- Master template version signed: `<git short SHA at signing>`
- Date signed: 2026-06-29
- Signed PDF location (NOT in git): Notion → Pilots → p-a-supermarket-erbil → "Signed agreement"

## Pilot-specific deviations

- **None.** Standard 30-day terms, Kit A on loan, 40% year-1 conversion discount offered at day 30.

## Stress-test emphasis for this pilot

Per `pilots/README.md` §2, P-a is the program's canary for **high POS throughput**, **barcode scanning** (EC-32), **IQD rounding** (EC-01), and **offline resilience** (EC-07, EC-08). The daily logs explicitly probe power cuts and offline behaviour.

## Linked artifacts

- Day logs: `pilots/p-a-supermarket-erbil/log/`
- Weekly status: `pilots/p-a-supermarket-erbil/weekly-status-w01.md`
- Exit interview: `pilots/p-a-supermarket-erbil/exit-interview.md`
- Surveys: `pilots/surveys/`
