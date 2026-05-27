# Observability Dashboards

> **Spec:** `world-class-performance` — T-0.7, R6.6
> **Status:** Placeholders. Templates documented here; Terraform/Dashboard JSON provisioning is out of scope for P0.

This document is the index of the **six Cloud Monitoring dashboards** the platform needs to honor the performance and reliability SLOs in the spec. Each dashboard is owned by the named team and has a single job. When you can't find a widget, it doesn't belong here yet — open a follow-up rather than overloading any one board.

Each dashboard URL placeholder will be filled in after the dashboards are provisioned. Until then, the link below points to the Cloud Monitoring overview.

> **Project:** `<GCP_PROJECT_ID>` — region `me-central1`.
> **Tool:** Google Cloud Monitoring (Cloud Operations). Migration to Grafana is **not** planned at this time (D-004).

---

## Dashboard index

| # | Dashboard | Owner | Link | Source data |
|---|-----------|-------|------|-------------|
| 1 | API SLOs | `@backend` | _placeholder — paste Cloud Monitoring URL after provisioning_ | OTel spans → Cloud Trace + Cloud Logging |
| 2 | Firestore | `@backend` | _placeholder_ | Firestore metrics + traced ops |
| 3 | Cache (Redis) | `@backend` | _placeholder_ | Cache facade counters |
| 4 | POS Ops | `@pos` | _placeholder_ | Client-reported metrics + RUM |
| 5 | RUM CWV | `@frontend` | _placeholder_ | BigQuery `vitals_raw` rollups |
| 6 | Deploys | `@platform` | _placeholder_ | Cloud Run revision events + CI |

---

## 1. API SLOs

**Purpose:** answer the question "is the backend meeting its p95 SLO right now?" at a glance, segmented by endpoint class.

**Widgets:**

- p50 / p95 / p99 request latency, faceted by endpoint class (read-single, read-list, write-single, bulk-write, report, pos-checkout). Source: OTel histogram exported to Cloud Trace.
- Request rate per endpoint class, stacked.
- 5xx error rate per endpoint class, with the SLO line drawn (0.1% / 0.2% / 0.5% per class).
- Rolling 28-day SLO burn-rate gauge.
- Top 10 slowest routes table, with p95.

**Alerts wired to this board:** R6.7 burn-rate at 2x and 10x.

---

## 2. Firestore

**Purpose:** confirm Firestore is healthy and find slow / hot collections fast.

**Widgets:**

- Reads/sec and writes/sec, segmented by collection.
- p95 read latency by collection; slow-read panel filtered to `slow_read=true` log entries.
- Open listener count (R2.6 cap = 25); alert at > 25.
- Index miss / scan rate (Cloud Monitoring builtin).
- Hot collections (top 10 by write rate over 1h).

**Source:** the `traced_firestore_op` wrapper attaches `firestore.collection` and `firestore.operation` attributes. Cloud Trace aggregates from there.

---

## 3. Cache (Redis)

**Purpose:** hit ratio, evictions, latency.

**Widgets:**

- Hit ratio per resource (matches the cache key namespace `{tenant}:{resource}:…`).
- Evictions per minute.
- Memory used vs. configured max.
- p95 Redis op latency.
- Rate-limit denials per tenant (slowapi → Redis store).

**Source:** the `Cache.get_or_set` facade increments hit/miss counters per resource.

---

## 4. POS Ops

**Purpose:** the in-store reality. "Are tablets behind real counters succeeding?"

**Widgets:**

- POS sales per minute, stacked by location.
- Offline-queue depth (client-reported gauge), p95 + max.
- Sync lag (median time from offline POST → server-confirmed).
- Receipt-print latency p50 / p95 per device class (the `pos:print:*` performance.mark pair, reported via RUM).
- KDS update latency (R4.8 — alert if > 2s).
- POS chunk-load failure rate.

---

## 5. RUM Core Web Vitals

**Purpose:** the real-user truth on field speed.

**Widgets:**

- LCP p75 per device class × network class.
- INP p75 per route (top 20 routes).
- CLS p95 per route.
- TTFB p75 by region (Baghdad / Erbil / Sulaymaniyah / Basra / Other).
- Sessions sampled vs. full-population estimate.
- 28-day CWV trend, one line per metric.

**Source:** `POST /api/rum/vitals` → in-process batch → BigQuery `vitals_raw` (when `RUM_BIGQUERY_DATASET` is set) → daily materialized rollups → dashboard. Until BigQuery is wired, vitals are emitted to Cloud Logging and visible there with the `rum.vital` label.

---

## 6. Deploys

**Purpose:** every other dashboard becomes 10x more useful with deploy events overlaid. This one is the source of truth for "what changed when".

**Widgets:**

- Cloud Run revision history (this week), with traffic-split percentages.
- CI run links per revision (matched by commit SHA).
- Last-known-good revision indicator.
- Average soak time before 100% cutover.
- Rollback rate (last 30 days).

**Source:** Cloud Run audit logs + GitHub Actions webhook (separate spec for the webhook).

---

## Terraform / provisioning (out of scope today)

Once the dashboards are stable, they will be exported to JSON, committed under `infra/observability/dashboards/`, and provisioned via the existing Terraform stack. Tracked separately — do **not** block P0 on this.

## Related runbooks

- Burn-rate alert → `docs/runbooks/api-burn-rate.md` (to be written).
- Chunk-load spike → `docs/runbooks/chunk-load-spike.md` (to be written).
- Backup-not-run → `docs/runbooks/backup-not-run.md` (to be written).
