<!-- Worked EXAMPLE weekly status, produced at the Monday Pilot Review. Illustrative, not a real customer. -->

# Weekly Status — `p-a-supermarket-erbil` — Week 01 (2026-06-30 → 2026-07-06)

- **Pilot manager:** Safa (Founder)
- **Pilot day range covered:** Day 0–6
- **Overall health:** 🟢 Green — strong adoption, offline resilience proven in the field; one P1 product gap (daftar credit) identified early.

## 1. Adoption & volume

| Metric | This week | Target | Trend |
|--------|:---------:|:------:|:-----:|
| Active days (DAU) | 6/6 operating days | ≥ 80% | → (100%) |
| Avg transactions/day | ~128 | ≥ 50 | ↑ |
| Offline episodes (count / total min) | 7 / ~95 min | n/a | — |
| Days hardware was fully working | 6/6 | 7/7 | → |

## 2. Issue ledger (against SLA)

| Severity | Opened this week | Closed this week | Still open | Oldest open (days) |
|----------|:----------------:|:----------------:|:----------:|:------------------:|
| P0 | 0 | 0 | 0 | — |
| P1 | 1 (PA-005 daftar) | 0 | 1 | 4 |
| P2 | 2 (PA-001, PA-003) | 1 (PA-001 → doc'd as printer warm-up) | 1 | 5 |
| P3 | 3 (PA-002, PA-004, PA-006) | 0 | 3 | 5 |

> **Backlog gate:** P0 + P1 still-open = **1** → within the < 3 ceiling. ✅

## 3. New Iraqi edge cases captured this week

| ID in `iraq-edge-cases.md` | One-liner | Status |
|----------------------------|-----------|--------|
| EC-17 | Daftar / charge-to-account credit | open → scheduled for w02 pilot release |
| EC-01 | Cash rounding to 250/500 (setting exists, discoverability poor) | partial → training callout |
| EC-12 | Cold-start Arabic glyph on first print | workaround (morning test print) |
| EC-30 | Sell-by-weight quantity entry | open |

## 4. What shipped to the `pilot` channel this week

- Friday release revision: `pilot-2026-07-04` (baseline pilot revision; pilots onboarded onto it).
- Notable changes: none customer-visible yet (week 0/1 was deploy + observe). First feature drop (daftar, PA-005) targeted for `pilot-2026-07-11`.

## 5. Wins this week

- **Offline resilience proven live:** 7 power cuts / ~95 min offline across the week, zero lost sales, zero double-charges. Owner quote captured (consent pending exit).
- 100% DAU and ~128 txns/day — well above the ≥50 bar.

## 6. Decisions & action items

| Action | Owner | Due | Status |
|--------|-------|-----|--------|
| Build "charge to account / daftar" + partial payment (PA-005, EC-17) | Sr. FE | Ship to pilot channel Fri 2026-07-11 | in progress |
| Document morning test-print + cash-rounding setting in training script #2 | Support Lead | 2026-07-08 | open |
| Confirm PA-001 is printer warm-up, not typesetter bug (bench repro) | Ops/SRE | 2026-07-07 | in progress |

## 7. Surveys

- NPS/CSAT due this week? No — first survey is **day 14** (≈2026-07-14).

## 8. Conversion signal

- Read: **warm-to-hot.** Owner is visibly happy with offline behaviour and throughput. The daftar gap is the main thing standing between "likes it" and "can't live without it" — closing PA-005 should move him to hot.
