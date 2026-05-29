-- =============================================================================
-- rum_daily_agg.sql — Daily Core Web Vitals rollup (T-SF.5.5)
-- =============================================================================
-- Scheduled query (BigQuery Data Transfer Service) that rolls yesterday's raw
-- vitals into `vitals_daily`. Wired by terraform/monitoring/bigquery.tf, which
-- substitutes the templatefile() variables below. It is also runnable by hand
-- in the BQ console after replacing the ${...} tokens with literals.
--
-- Idempotent: deletes the target day's partition first, then re-inserts, so a
-- re-run (or a late backfill) produces the same result.
--
-- @run_date is supplied by BQ DTS as the schedule's logical date. We roll up
-- the day BEFORE @run_date so the day is closed (the 02:30 schedule runs after
-- midnight UTC). When run manually, @run_date defaults to CURRENT_DATE().
--
-- NOTE on NULL tenant_id: anonymous routes (login/landing) have tenant_id IS
-- NULL. We group with the raw NULL (BigQuery GROUP BY treats NULLs as one
-- group, unlike a JOIN), so anonymous traffic rolls up into a single
-- tenant_id = NULL bucket rather than being dropped.
--
-- Template variables (Terraform templatefile):
--   ${project}    GCP project id
--   ${dataset}    RUM dataset id (e.g. "rum")
--   ${raw_table}  raw table id   (e.g. "vitals_raw")
--   ${agg_table}  rollup table id(e.g. "vitals_daily")
-- =============================================================================

DECLARE target_day DATE DEFAULT DATE_SUB(@run_date, INTERVAL 1 DAY);

-- 1) Clear the partition we are about to (re)compute — makes the job idempotent.
DELETE FROM `${project}.${dataset}.${agg_table}`
WHERE day = target_day;

-- 2) Recompute and insert. Percentiles via APPROX_QUANTILES (cheap, accurate
--    enough for SLO dashboards). good_rate is the share of 'good'-rated samples.
--    app_version is the most-frequent build within the bucket (APPROX_TOP_COUNT)
--    so version churn within a day doesn't fragment the rollup.
INSERT INTO `${project}.${dataset}.${agg_table}`
  (day, tenant_id, app_version, route, metric, device_class,
   samples, p50, p75, p95, good_rate)
SELECT
  DATE(ts)                                                  AS day,
  tenant_id,
  APPROX_TOP_COUNT(app_version, 1)[OFFSET(0)].value         AS app_version,
  route,
  metric,
  device_class,
  COUNT(*)                                                  AS samples,
  APPROX_QUANTILES(value, 100)[OFFSET(50)]                  AS p50,
  APPROX_QUANTILES(value, 100)[OFFSET(75)]                  AS p75,
  APPROX_QUANTILES(value, 100)[OFFSET(95)]                  AS p95,
  SAFE_DIVIDE(COUNTIF(rating = 'good'), COUNT(*))           AS good_rate
FROM `${project}.${dataset}.${raw_table}`
-- Partition pruning: only scan the target day's partition.
WHERE DATE(ts) = target_day
  AND value IS NOT NULL
GROUP BY day, tenant_id, route, metric, device_class;
