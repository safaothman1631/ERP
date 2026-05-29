-- =============================================================================
-- cost_per_tenant.sql — Per-tenant GCP cost attribution rollup (T-SF.5.5)
-- =============================================================================
-- Rolls the standard GCP "detailed usage cost" billing export into a daily,
-- per-tenant (org_id) cost table. Wired by terraform/monitoring/bigquery.tf as
-- a scheduled query; created only when a billing export is configured.
--
-- Attribution model
-- ------------------
-- We attribute cost to a tenant via the resource/system label `org_id`, which
-- the backend stamps on tenant-scoped resources. Spend that carries no org_id
-- (shared infrastructure: the single Cloud Run service, the shared Firestore
-- database, networking) cannot be attributed per-tenant from labels alone, so
-- it is bucketed as tenant_id = 'shared'. A fair-share split of 'shared' across
-- active tenants is a reporting-layer concern (Looker Studio / finance), not
-- something we bake into the raw rollup — keeping 'shared' explicit avoids
-- silently misattributing cost.
--
-- Idempotent: deletes the target usage_day partition, then re-inserts.
--
-- @run_date is the BQ DTS logical date; we roll up the day BEFORE it. Billing
-- export rows can arrive late, so we also widen the export scan window to the
-- export_time of the prior 3 days and filter by usage_start_time DATE to catch
-- late-arriving rows for the target day on re-runs.
--
-- Template variables (Terraform templatefile):
--   ${project}          project that owns the destination dataset
--   ${dataset}          destination dataset id (e.g. "rum")
--   ${dest_table}       destination table id   (e.g. "cost_per_tenant_daily")
--   ${billing_project}  project that holds the billing export
--   ${billing_dataset}  billing export dataset id
--   ${billing_table}    billing export table   (gcp_billing_export_resource_v1_XXXXXX)
-- =============================================================================

DECLARE target_day DATE DEFAULT DATE_SUB(@run_date, INTERVAL 1 DAY);

-- 1) Idempotent clear of the destination partition.
DELETE FROM `${project}.${dataset}.${dest_table}`
WHERE usage_day = target_day;

-- 2) Recompute. Net cost = cost + SUM(credits.amount) (credits are negative).
INSERT INTO `${project}.${dataset}.${dest_table}`
  (usage_day, tenant_id, service, sku, cost_usd, credits_usd,
   usage_amount, usage_unit)
WITH exported AS (
  SELECT
    DATE(usage_start_time)                                   AS usage_day,
    -- org_id may live in resource.labels or labels (system vs user labels).
    COALESCE(
      (SELECT value FROM UNNEST(resource.labels) WHERE key = 'org_id'),
      (SELECT value FROM UNNEST(labels)          WHERE key = 'org_id'),
      'shared'
    )                                                        AS tenant_id,
    service.description                                      AS service,
    sku.description                                          AS sku,
    cost,
    usage.amount                                             AS usage_amount,
    usage.unit                                               AS usage_unit,
    -- Sum any credits attached to the line (promotions, committed-use, etc.).
    IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) AS c), 0) AS credit_amount
  FROM `${billing_project}.${billing_dataset}.${billing_table}`
  -- Late-arrival safety: scan a few days of export_time, then filter by usage.
  WHERE _PARTITIONTIME >= TIMESTAMP(DATE_SUB(target_day, INTERVAL 1 DAY))
    AND DATE(usage_start_time) = target_day
)
SELECT
  usage_day,
  tenant_id,
  service,
  sku,
  ROUND(SUM(cost) + SUM(credit_amount), 6)                  AS cost_usd,
  ROUND(SUM(credit_amount), 6)                              AS credits_usd,
  SUM(usage_amount)                                         AS usage_amount,
  -- usage_unit is consistent within a (service, sku); take any.
  ANY_VALUE(usage_unit)                                     AS usage_unit
FROM exported
GROUP BY usage_day, tenant_id, service, sku;
