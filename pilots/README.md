# UAT Pilot Program — Operator Toolkit (SF6)

> Spec: `.kiro/specs/scale-foundation` — Phase **SF6 — UAT Pilots** (tasks `T-SF.6.1` → `T-SF.6.25`).
> Design reference: `scale-foundation/design.md` Section 6 (Pilot selection, agreement, check-in, SLA, cadence, success metrics, graduation).
>
> **Status of this folder:** TOOLKIT — templates, instruments, trackers, and one worked example. The *real* program work (recruiting shops, procuring hardware, on-site deploy, daily calls, recording videos, conversions) is operator/field work and is tracked as external blockers, not in this repo.

---

## 1. What SF6 is

We run **5 paid-conversion-track pilots × 30 days** with real Iraqi retail businesses, gather structured feedback through a tight weekly release loop, and convert at least 3 of them to paying customers. The pilots make the product *real*: every Iraqi edge case we hit becomes a tracked entry, a fix, or a documented workaround.

**SF6 exit criteria** (from the spec — do not move the goalposts):

- 5 pilots completed (full 30-day run each).
- Median NPS ≥ **30** (measured at day 14 *and* day 30).
- ≥ **3** conversions to paid (target 4) at the discounted year-1 rate.
- ≥ **30** Iraqi edge cases captured in `pilots/iraq-edge-cases.md`.
- 5 case studies captured (3 published, 2 confidential) — `pilots/case-study-template.md`.

**Budget envelope:** USD 4K–8K (hardware + travel), per the spec cost line. Hardware kit configs live in `docs/sales/hardware-kits.md`.

---

## 2. The five pilots

| Code | Sector | City | Emphasis (what this pilot stress-tests) | Task |
|------|--------|------|------------------------------------------|------|
| `p-a-supermarket-erbil` | Supermarket / grocery | Erbil | High POS throughput, barcode scanning, IQD rounding, offline resilience | T-SF.6.13 |
| `p-b-restaurant-slemani` | Restaurant / café | Sulaymaniyah | Kitchen display, table/floor map, split bills, tipping | T-SF.6.14 |
| `p-c-pharmacy-baghdad` | Pharmacy | Baghdad | Controlled-substance log, insurance/ration interplay, batch + expiry | T-SF.6.15 |
| `p-d-hardware-mosul` | Hardware / spare parts | Mosul (or Erbil) | Deep inventory, supplier credit (daftar), unit conversions | T-SF.6.16 |
| `p-e-electronics-baghdad` | Electronics | Baghdad | Serial-tracked items, warranty, USD/IQD dual pricing | T-SF.6.17 |

Sector diversity (≥5 sectors), geographic diversity (≥3 governorates: Erbil, Sulaymaniyah, Baghdad, Mosul), and a mix of owner-operator decision-makers are deliberate — they come straight from the scoring rubric (`pilots/scoring-rubric.md`).

Each pilot gets its own folder copied from `pilots/_template/`. `pilots/p-a-supermarket-erbil/` is a fully worked example you can read end-to-end before standing up the rest.

---

## 3. Folder layout

```
pilots/
├── README.md                     ← this file (program overview + cadence)
├── scoring-rubric.md             ← T-SF.6.2 candidate scoring (design §6.1)
├── iraq-edge-cases.md            ← T-SF.6.18 living tracker (≥30 entries seeded)
├── results.md                    ← T-SF.6.24 aggregate results (template, fills weekly)
├── case-study-template.md        ← T-SF.6.21 case-study skeleton
├── surveys/                      ← T-SF.6.12 NPS + CSAT instruments (ku / ar / en)
│   ├── README.md
│   ├── nps.md
│   └── csat.md
├── _template/                    ← copy this per new pilot
│   ├── agreement.md
│   ├── weekly-status-template.md
│   ├── exit-interview.md
│   └── log/
│       └── DAY-TEMPLATE.md
└── p-a-supermarket-erbil/        ← worked example (T-SF.6.13)
    ├── agreement.md
    ├── weekly-status-template.md
    ├── exit-interview.md
    └── log/
        ├── DAY-TEMPLATE.md
        ├── 2026-07-01.md
        └── 2026-07-02.md
```

Related toolkit pieces that live outside `pilots/`:

- `templates/pilot-agreement.md` — the canonical 30-day agreement **DRAFT** (master copy; per-pilot `agreement.md` files are instantiations of it).
- `docs/training/scripts/` — 10 power-user training-video scripts (Kurdish + Arabic narration). Task T-SF.6.23.
- `.github/workflows/pilot-release.yml` — the dedicated weekly `pilot` Cloud Run revision channel. Task T-SF.6.6 / T-SF.6.19.

---

## 4. Standing up a new pilot

1. **Score the candidate** with `pilots/scoring-rubric.md`. Only proceed if the candidate makes the top-5 cut.
2. **Copy the template folder:**
   ```bash
   cp -r pilots/_template "pilots/<code>"
   ```
   Use the naming convention `p-<letter>-<sector>-<city>` (lowercase, hyphenated), e.g. `p-b-restaurant-slemani`.
3. **Fill the agreement** from `templates/pilot-agreement.md`, get it signed (PDF stored in the team Notion / DMS — **never commit a signed PDF with a wet signature or personal ID to git**; commit only the redacted markdown).
4. **Provision the tenant** on the `pilot` Cloud Run channel (see §6) and create the hardware kit (`docs/sales/hardware-kits.md`).
5. **Deploy on-site + train** owner + 1 staff (T-SF.6.5). Record the training session date in the day-0 log.
6. **Start the check-in cadence** (§5). File a log per call in `pilots/<code>/log/YYYY-MM-DD.md`.
7. **Schedule the surveys** for day 14 and day 30 (`pilots/surveys/`).

---

## 5. Cadence (design §6.3 / §6.5)

### Daily check-ins
- **Days 1–14:** 10-minute WhatsApp video call, scheduled **11:00 local**, every operating day. Owner: Founder, rotating with Support Lead. (T-SF.6.7 — ~70 calls across 5 pilots.)
- **Days 15–30:** 3× per week. Owner: Support Lead. (T-SF.6.8 — ~35 calls.)
- **Pre-call:** the caller reviews the tenant's observability dashboard (RUM + error rate + crash signals, filtered to that `org_id`).
- **The 4 standard questions** (every call):
  1. Anything **broken** today? (errors, crashes, data wrong)
  2. Anything **slow** today? (waited, spinner, lag)
  3. Anything **confusing** today? (couldn't find, didn't understand)
  4. Anything you **wish** it did? (wishlist)
- **Post-call:** file the day log; open tickets with severity (P0–P3).

### Weekly loop
| Day | Ritual | Output |
|-----|--------|--------|
| **Monday** | Pilot Review (1h) — eng + pilot manager + founder | Action items posted Monday evening; `weekly-status-template.md` updated per pilot (T-SF.6.11) |
| **Wednesday** | Release Decision | The change-set that ships to the `pilot` channel Friday |
| **Friday** | Pilot Channel Release | New `pilot` Cloud Run revision (`.github/workflows/pilot-release.yml`) — T-SF.6.19 |
| **Sat / Sun** | Monitor | On-call watches the `pilot` revision for anomalies before it influences prod cadence |

### Surveys
- **Day 14** and **Day 30**: send NPS + CSAT (`pilots/surveys/`). Target 10 responses per pilot (2 touchpoints × 5 roles/staff) → 50 across the program (T-SF.6.12).

---

## 6. The `pilot` release channel

SF6 ships **weekly** to a *dedicated* Cloud Run revision tagged `pilot`, kept separate from production traffic so pilots get fast iteration without putting general-availability tenants at risk.

- **Workflow:** `.github/workflows/pilot-release.yml` (cron: Friday, plus manual `workflow_dispatch`).
- **Channel model:** the workflow deploys a new revision with `--no-traffic --tag pilot`, so the pilot URL is `https://pilot---<service>-<hash>-<region>.run.app`. Pilot tenants are pointed at the tagged URL; production keeps serving the stable revision.
- **Promotion:** a pilot revision is only promoted into the production traffic split after it has soaked through a weekend and the Monday review signs off (re-use `scripts/deploy-bluegreen.sh` for the eventual prod cutover).
- **Rollback:** `gcloud run services update-traffic <service> --remove-tags pilot` instantly removes the pilot tag; pilots fall back to stable.

This extends — does not replace — the existing `deploy-cloudrun.yml` / `deploy-production.yml` pipelines.

---

## 7. Issue triage SLA (design §6.4 / requirement 6.10)

| Severity | Definition | Commitment |
|----------|------------|------------|
| **P0** | Pilot cannot transact / data loss / money wrong | Same-day fix or escalation |
| **P1** | Major feature broken, workaround painful | 24 hours |
| **P2** | Feature broken, workaround exists | 1 week |
| **P3** | Annoyance / polish / wishlist | 1 month |

**Backlog ceiling:** P0 + P1 open count SHALL stay **< 3 per pilot** at any moment. If it crosses, the Friday release is reprioritised to burn it down before any new feature ships.

---

## 8. Success metrics per pilot (design §6.6)

- **DAU ≥ 80%** of the shop's operating days.
- **NPS ≥ 30** at day 14 and day 30.
- **≥ 50 transactions/day.**
- **≥ 1 documented "win"** (time saved, error rate reduced, faster close, etc.) — captured in the case study.
- **Conversion target ≥ 60%** (3 of 5 pilots → paid).

All of these roll up into `pilots/results.md` and the board one-pager (T-SF.6.25).

---

## 9. Privacy & data-handling rules for this folder

- **No personal IDs, no wet signatures, no customer PII in git.** Day logs reference the owner by first name + role only. Real names, phone numbers, national IDs, and signed PDFs live in the team Notion / DMS, governed by the DPA (`marketing/src/pages/legal/dpa.astro`, pending counsel review).
- **Right to review & redact:** every case study and every published quote is shown to the pilot before publication (agreement clause). Confidential pilots are never named publicly.
- **Data export on request:** at any point a pilot can request a full export (handled via `backend/app/api/admin/exports.py`); deletion via `backend/app/api/admin/pii_delete.py`. The pilot agreement promises this.

---

## 10. Ownership

| Stream | Owner |
|--------|-------|
| Recruiting + scoring + conversions | Founder |
| Hardware kits + on-site deploy | Ops/SRE Lead |
| Daily check-ins (days 1–14) | Founder ↔ Support Lead (rotating) |
| Check-ins (days 15–30) + surveys | Support Lead |
| Weekly release engineering | Sr. FE + Ops/SRE |
| Edge-case tracker upkeep | Support Lead |
| Case studies + reference roster | Founder + Support Lead |

---

*This is operator tooling, not legal advice. The agreement and any legal page referenced here are DRAFTS pending licensed-counsel review (T-SF.2.x).*
