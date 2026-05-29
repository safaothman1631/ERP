# 2026-Q2 Performance Baseline

> **Spec:** `world-class-performance` — T-0.8
> **Captured by:** _TBD — fill in when dashboards (T-0.7) go live_
> **Window:** 2026-04-01 → 2026-06-30 (28-day rolling at end-of-quarter)
> **Status:** TEMPLATE — values marked `TBD` are intentionally empty until the dashboards in `docs/observability/README.md` are provisioned and a clean 28-day window of RUM data is available.

This document is the **pre-optimization baseline**. Every subsequent phase (P1 → P6) measures itself against these numbers. The goal of P0 is to make these measurable; the goal of later phases is to move them.

---

## 1. Core Web Vitals (R1.1–1.3)

Source: RUM `vitals_raw` (dashboard #5), p75 over the captured window. All values in milliseconds except CLS (unitless).

### 1.1 LCP (Largest Contentful Paint)

| Route | Device class | Network | p75 | SLO | Pass? |
|-------|--------------|---------|-----|-----|-------|
| `/` | mobile-mid | 4g | TBD | ≤ 2000 | TBD |
| `/` | mobile-low | 3g | TBD | ≤ 2500 | TBD |
| `/dashboard` | mobile-mid | 4g | TBD | ≤ 2000 | TBD |
| `/invoices` | mobile-mid | 4g | TBD | ≤ 2000 | TBD |
| `/pos/terminal` | tablet | wifi | TBD | ≤ 2000 | TBD |
| any | desktop | wifi | TBD | ≤ 1500 | TBD |

### 1.2 INP (Interaction to Next Paint)

| Route | Device class | p75 | SLO | Pass? |
|-------|--------------|-----|-----|-------|
| `/dashboard` | mobile-mid | TBD | ≤ 150 | TBD |
| `/invoices` | mobile-mid | TBD | ≤ 150 | TBD |
| `/pos/terminal` | tablet | TBD | ≤ 150 | TBD |
| settings (any) | desktop | TBD | ≤ 150 | TBD |

### 1.3 CLS (Cumulative Layout Shift)

| Route | p75 | SLO | Pass? |
|-------|-----|-----|-------|
| `/` | TBD | ≤ 0.05 | TBD |
| `/dashboard` | TBD | ≤ 0.05 | TBD |
| `/invoices` | TBD | ≤ 0.05 | TBD |
| `/pos/terminal` | TBD | ≤ 0.05 | TBD |

### 1.4 TTFB (Time To First Byte, R1.4)

| Region | p75 | SLO | Pass? |
|--------|-----|-----|-------|
| Baghdad | TBD | ≤ 600 | TBD |
| Erbil | TBD | ≤ 600 | TBD |
| Sulaymaniyah | TBD | ≤ 600 | TBD |
| Basra | TBD | ≤ 1000 | TBD |
| Rural | TBD | ≤ 1000 | TBD |

### 1.5 Lighthouse Performance score (R1.6)

| URL | Mobile | Desktop | SLO |
|-----|-------:|--------:|------|
| `/` | TBD | TBD | ≥ 90 / ≥ 95 |
| `/login` | TBD | TBD | ≥ 90 / ≥ 95 |
| `/dashboard` | TBD | TBD | ≥ 90 / ≥ 95 |
| `/invoices` | TBD | TBD | ≥ 90 / ≥ 95 |
| `/pos/terminal` | TBD | TBD | ≥ 90 / ≥ 95 |

---

## 2. Bundle sizes (R1.5)

| Bundle | Current gzipped | SLO | Pass? |
|--------|---------------:|-----|-------|
| Public route shell (login / landing / onboarding) | TBD | ≤ 180 KB | TBD |
| Authenticated app shell (sidebar, top bar, dashboard) | TBD | ≤ 350 KB | TBD |
| Largest per-route chunk | TBD | ≤ 80 KB | TBD |
| Per-route chunk p95 | TBD | ≤ 80 KB | TBD |

> Capture method: `frontend/scripts/audit-bundle-size.mjs` after `npm run build` on `main`.

---

## 3. Backend API SLOs (R5, dashboard #1)

p95 over the captured window, segmented by endpoint class.

| Endpoint class | p50 | p95 | p99 | Error rate | SLO p95 | Pass? |
|----------------|----:|----:|----:|-----------:|--------:|-------|
| Read, single document | TBD | TBD | TBD | TBD | ≤ 150ms | TBD |
| Read, paginated list ≤ 50 | TBD | TBD | TBD | TBD | ≤ 300ms | TBD |
| Write, single document | TBD | TBD | TBD | TBD | ≤ 350ms | TBD |
| Bulk write ≤ 500 docs | TBD | TBD | TBD | TBD | ≤ 2000ms | TBD |
| Report query | TBD | TBD | TBD | TBD | ≤ 1500ms | TBD |
| POS checkout end-to-end | TBD | TBD | TBD | TBD | ≤ 400ms | TBD |

### Top 10 slowest routes

| # | Route | p95 | Owner | Notes |
|---|-------|-----|-------|-------|
| 1 | TBD | TBD | TBD | TBD |
| 2 | TBD | TBD | TBD | TBD |
| 3 | TBD | TBD | TBD | TBD |
| 4 | TBD | TBD | TBD | TBD |
| 5 | TBD | TBD | TBD | TBD |
| 6 | TBD | TBD | TBD | TBD |
| 7 | TBD | TBD | TBD | TBD |
| 8 | TBD | TBD | TBD | TBD |
| 9 | TBD | TBD | TBD | TBD |
| 10 | TBD | TBD | TBD | TBD |

---

## 4. Firestore (dashboard #2)

| Metric | Value | Notes |
|--------|------:|-------|
| Reads/sec, peak hour | TBD | TBD |
| Writes/sec, peak hour | TBD | TBD |
| p95 read latency | TBD | SLO ≤ 400ms (R5.8) |
| Slow reads (`slow_read=true`) per day | TBD | TBD |
| Open listener peak | TBD | Cap 25 per R2.6 |
| Top write-hot collection | TBD | TBD |

---

## 5. Redis cache (dashboard #3)

| Metric | Value |
|--------|------:|
| Hit ratio (overall) | TBD |
| Hit ratio per high-traffic resource (top 5) | TBD |
| Evictions/min, peak | TBD |
| Memory used / max | TBD |
| Rate-limit denials per day | TBD |

---

## 6. POS (dashboard #4)

| Metric | Value | SLO | Pass? |
|--------|------:|-----|-------|
| Receipt print latency p95 (tap → buffer) | TBD | ≤ 200ms (R4.7) | TBD |
| Offline-queue depth p95 | TBD | TBD | TBD |
| Sync lag median | TBD | TBD | TBD |
| KDS update latency p95 | TBD | ≤ 2000ms (R4.8) | TBD |

---

## 7. Reliability (R5, R6.7)

| Metric | Value | SLO | Pass? |
|--------|------:|-----|-------|
| Availability (28-day rolling) | TBD | ≥ 99.5% | TBD |
| Cold start p95 | TBD | ≤ 2000ms (R5.6) | TBD |
| Backup success last 7 days | TBD | 7/7 | TBD |

---

## 8. Monolith budget (R8.4)

Auto-generated from `docs/audit/monolith-watchlist.md`. Captured at baseline:

| # | File | LOC at baseline | Target |
|---|------|----------------:|-------:|
| 1 | `frontend/src/settings/sections/bodies.tsx` | TBD | ≤ 400 |
| 2 | `backend/app/api/pos.py` | TBD | ≤ 600 |
| 3 | (top 30 — see `docs/audit/monolith-watchlist.md`) | … | … |

---

## 9. Test coverage (R13.1)

| Codebase | Coverage | SLO | Pass? |
|----------|---------:|-----|-------|
| `frontend/src/` | TBD | ≥ 70% | TBD |
| `backend/app/` | TBD | ≥ 80% | TBD |

---

## How to capture this baseline

Once T-0.7 dashboards are live:

1. Wait for **28 contiguous days** of RUM data after deploying T-0.1 to production.
2. Open each dashboard, take a CSV export of the relevant percentile.
3. Replace every `TBD` above with the captured value plus the date captured.
4. Commit this file to `audit/baselines/2026-Q2-baseline.md`.
5. File ADR-002 if any SLO is materially missed at baseline (so the rationale for the next phase's priorities is on the record).

---

## Approvals

| Role | Name | Date | Sign-off |
|------|------|------|----------|
| Spec owner | Safa Othman | TBD | _pending baseline data_ |
| Backend lead | TBD | TBD | _pending_ |
| Frontend lead | TBD | TBD | _pending_ |
| POS lead | TBD | TBD | _pending_ |
