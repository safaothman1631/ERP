# Empty-state Funnel — Cloud Monitoring dashboard

> Spec: `.kiro/specs/empty-state-quick-create/requirements.md` §12.
> Phase entry: EP-2 task T-E.2.8 ("Dashboard publish + first conversion read").
> Owner: DevOps + FE (Safa Othman).

This document is the source-of-truth configuration for the **`empty-state-funnel`** dashboard in Google Cloud Monitoring. It mirrors what the BigQuery RUM ingest produces, so the dashboard can be re-created from this doc if it's ever lost.

The events that feed it (per `frontend/src/design-system/empty/useEmptyStateTelemetry.ts`):

| Event | Fired by | Critical attributes |
|-------|----------|---------------------|
| `empty_state.shown` | `<EmptyState>` mount | `variant`, `entity`, `surface`, `locale` |
| `empty_state.cta_clicked` | primary/secondary action | `action`, `entity` |
| `quick_create.opened` | modal/drawer mount | `entity`, `prefill_present` |
| `quick_create.succeeded` | apiCreate resolved | `entity`, `duration_ms`, `field_count` |
| `quick_create.failed` | apiCreate rejected | `entity`, `error_code` |
| `quick_create.cancelled` | user dismissed unsaved | `entity`, `was_dirty` |
| `quick_create.save_and_add_another` | drawer 2nd path | `entity`, `iteration` |
| `empty_state.permission_gate_shown` | Request-access fallback | `permission` |

All events land in `rum_events.empty_state_funnel_v1` (BigQuery table) via the existing `/api/rum/vitals` ingest. The schema is event-name + `attrs` JSON + `tenant_id` + `user_id_hash` + `ts`.

---

## 1. Dashboard layout

The dashboard has **five row sections**, top to bottom:

### Row A — Per-entity conversion funnel

One stacked-bar widget **per entity**. Each bar shows the four stages:

`shown` → `cta_clicked` → `opened` → `succeeded`

Tooltip on hover shows the absolute counts and the stage-to-stage conversion %.

### Row B — Time-to-save histogram

One histogram per entity. Bucketed by `duration_ms` on `quick_create.succeeded` events. Buckets: `[0, 1s, 2s, 5s, 10s, 30s, 60s, +∞]`.

### Row C — Error rate per entity

One time-series chart per entity, plotting `quick_create.failed / (quick_create.failed + quick_create.succeeded)` over 1-hour windows.

### Row D — "Full form…" click rate

A single time-series chart (no per-entity split) showing the share of `quick_create.opened` events that subsequently fire `empty_state.cta_clicked` with `action='full_form_link'`. High rate = the modal is too restrictive.

### Row E — Save-and-add-another usage

Single counter and weekly trend showing `quick_create.save_and_add_another` count and the average `iteration` value. Useful to size the drawer's value beyond single-record creates.

---

## 2. BigQuery queries

Replace `your-project.your-dataset` with the actual table path; the analytics team manages the deployment.

### 2.1 Funnel per entity (Row A)

```sql
WITH events AS (
  SELECT
    JSON_VALUE(attrs, '$.entity') AS entity,
    event,
    ts
  FROM `your-project.your-dataset.rum_events`
  WHERE event IN (
    'empty_state.shown',
    'empty_state.cta_clicked',
    'quick_create.opened',
    'quick_create.succeeded'
  )
    AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 28 DAY)
)
SELECT
  entity,
  COUNTIF(event = 'empty_state.shown')        AS shown,
  COUNTIF(event = 'empty_state.cta_clicked')  AS cta_clicked,
  COUNTIF(event = 'quick_create.opened')      AS opened,
  COUNTIF(event = 'quick_create.succeeded')   AS succeeded,
  SAFE_DIVIDE(COUNTIF(event = 'empty_state.cta_clicked'),  COUNTIF(event = 'empty_state.shown')) AS rate_cta,
  SAFE_DIVIDE(COUNTIF(event = 'quick_create.opened'),      COUNTIF(event = 'empty_state.cta_clicked')) AS rate_opened,
  SAFE_DIVIDE(COUNTIF(event = 'quick_create.succeeded'),   COUNTIF(event = 'quick_create.opened')) AS rate_succeeded
FROM events
WHERE entity IS NOT NULL
GROUP BY entity
ORDER BY shown DESC;
```

### 2.2 Time-to-save histogram (Row B)

```sql
SELECT
  JSON_VALUE(attrs, '$.entity') AS entity,
  CASE
    WHEN CAST(JSON_VALUE(attrs, '$.duration_ms') AS INT64) < 1000  THEN '0-1s'
    WHEN CAST(JSON_VALUE(attrs, '$.duration_ms') AS INT64) < 2000  THEN '1-2s'
    WHEN CAST(JSON_VALUE(attrs, '$.duration_ms') AS INT64) < 5000  THEN '2-5s'
    WHEN CAST(JSON_VALUE(attrs, '$.duration_ms') AS INT64) < 10000 THEN '5-10s'
    WHEN CAST(JSON_VALUE(attrs, '$.duration_ms') AS INT64) < 30000 THEN '10-30s'
    WHEN CAST(JSON_VALUE(attrs, '$.duration_ms') AS INT64) < 60000 THEN '30-60s'
    ELSE '60s+'
  END AS bucket,
  COUNT(*) AS n
FROM `your-project.your-dataset.rum_events`
WHERE event = 'quick_create.succeeded'
  AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 28 DAY)
GROUP BY entity, bucket
ORDER BY entity, bucket;
```

### 2.3 Error rate per entity (Row C)

```sql
WITH per_hour AS (
  SELECT
    TIMESTAMP_TRUNC(ts, HOUR) AS hour,
    JSON_VALUE(attrs, '$.entity') AS entity,
    COUNTIF(event = 'quick_create.failed')   AS failed,
    COUNTIF(event = 'quick_create.succeeded') AS succeeded
  FROM `your-project.your-dataset.rum_events`
  WHERE event IN ('quick_create.failed', 'quick_create.succeeded')
    AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
  GROUP BY hour, entity
)
SELECT
  hour,
  entity,
  SAFE_DIVIDE(failed, failed + succeeded) AS error_rate,
  failed + succeeded AS volume
FROM per_hour
WHERE failed + succeeded > 0
ORDER BY entity, hour;
```

### 2.4 Full-form-link click rate (Row D)

```sql
WITH opens AS (
  SELECT ts, JSON_VALUE(attrs, '$.entity') AS entity, 1 AS opened
  FROM `your-project.your-dataset.rum_events`
  WHERE event = 'quick_create.opened'
    AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 28 DAY)
),
fullform AS (
  SELECT ts, JSON_VALUE(attrs, '$.entity') AS entity, 1 AS clicked
  FROM `your-project.your-dataset.rum_events`
  WHERE event = 'empty_state.cta_clicked'
    AND JSON_VALUE(attrs, '$.action') = 'full_form_link'
    AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 28 DAY)
)
SELECT
  TIMESTAMP_TRUNC(ts, DAY) AS day,
  SUM(opened) AS opens,
  SUM(clicked) AS fullform_clicks,
  SAFE_DIVIDE(SUM(clicked), SUM(opened)) AS fullform_rate
FROM (
  SELECT ts, opened, 0 AS clicked FROM opens
  UNION ALL
  SELECT ts, 0 AS opened, clicked FROM fullform
)
GROUP BY day
ORDER BY day;
```

### 2.5 Save-and-add-another (Row E)

```sql
SELECT
  TIMESTAMP_TRUNC(ts, WEEK) AS week,
  JSON_VALUE(attrs, '$.entity') AS entity,
  COUNT(*) AS save_and_add_count,
  AVG(CAST(JSON_VALUE(attrs, '$.iteration') AS INT64)) AS avg_iteration
FROM `your-project.your-dataset.rum_events`
WHERE event = 'quick_create.save_and_add_another'
  AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
GROUP BY week, entity
ORDER BY week DESC, save_and_add_count DESC;
```

---

## 3. Alert policies

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| **Entity success rate dipped** | `succeeded / opened < 0.70` for any entity for **24 consecutive hours** with **volume ≥ 50/day** | P1 | PagerDuty `@frontend-oncall` |
| **Funnel regression** | `cta_clicked / shown < 0.50` for a Class-A entity for 7 consecutive days | P2 | Slack `#frontend-alerts` |
| **Telemetry blackout** | Any of the 8 events drops to zero for > 48h while peer events continue | P1 | PagerDuty `@frontend-oncall` |
| **Error spike** | `failed / (failed + succeeded) > 0.20` for any entity over a 1-hour window with ≥ 30 attempts | P1 | PagerDuty `@frontend-oncall` |

The "Entity success rate dipped" alert uses the BigQuery `error rate` query (§2.3) inverted, joined to a 24-hour rolling window. The threshold of 70% is the §12.3 target in the spec.

---

## 4. Dashboard JSON (template)

The full dashboard config is committed at `audit/dashboards/empty-state-funnel.json` (TODO — DevOps lands the JSON when the BQ tables are confirmed live). The structure mirrors the rows in §1, one Cloud Monitoring `tile` per chart.

When you regenerate the dashboard:

1. Run each query in §2 against staging to confirm the schema (column names match the dashboard's expected fields).
2. Import the JSON via `gcloud monitoring dashboards create --config-from-file=audit/dashboards/empty-state-funnel.json`.
3. Pin the dashboard in the project's monitoring favourites.
4. Add the dashboard URL to the FE team's wiki sidebar.

---

## 5. Maintenance

Weekly (rotating FE oncall):

- [ ] Confirm all 8 event names appear in BigQuery in the last 7 days.
- [ ] Spot-check any entity below the 70% success threshold and file a follow-up ticket if no P1 fired.
- [ ] Verify the `empty-state-audit.md` migration percent moved forward (or is stable).

The dashboard is the contract: numbers below the §12 spec thresholds block flag retirement (`empty-state-v2-retirement.md`).
