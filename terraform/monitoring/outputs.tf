# =============================================================================
# outputs.tf — Handy references after apply.
# =============================================================================

output "dashboard_urls" {
  description = "Direct Cloud Monitoring URLs for the six dashboards (D1-D6)."
  value = {
    d1_api        = "https://console.cloud.google.com/monitoring/dashboards/builder/${reverse(split("/", google_monitoring_dashboard.d1_api.id))[0]}?project=${var.project_id}"
    d2_firestore  = "https://console.cloud.google.com/monitoring/dashboards/builder/${reverse(split("/", google_monitoring_dashboard.d2_firestore.id))[0]}?project=${var.project_id}"
    d3_pos_sync   = "https://console.cloud.google.com/monitoring/dashboards/builder/${reverse(split("/", google_monitoring_dashboard.d3_pos_sync.id))[0]}?project=${var.project_id}"
    d4_rum        = "https://console.cloud.google.com/monitoring/dashboards/builder/${reverse(split("/", google_monitoring_dashboard.d4_rum.id))[0]}?project=${var.project_id}"
    d5_business   = "https://console.cloud.google.com/monitoring/dashboards/builder/${reverse(split("/", google_monitoring_dashboard.d5_business.id))[0]}?project=${var.project_id}"
    d6_per_tenant = "https://console.cloud.google.com/monitoring/dashboards/builder/${reverse(split("/", google_monitoring_dashboard.d6_per_tenant.id))[0]}?project=${var.project_id}"
  }
}

output "rum_dataset" {
  description = "BigQuery dataset + tables backing RUM analytics."
  value = {
    dataset         = google_bigquery_dataset.rum.dataset_id
    raw_table       = "${google_bigquery_dataset.rum.dataset_id}.${google_bigquery_table.vitals_raw.table_id}"
    daily_table     = "${google_bigquery_dataset.rum.dataset_id}.${google_bigquery_table.vitals_daily.table_id}"
    cost_table      = "${google_bigquery_dataset.rum.dataset_id}.${google_bigquery_table.cost_per_tenant_daily.table_id}"
  }
}

output "notification_channels" {
  description = "Notification channel ids that were created (empty when the corresponding input was unset)."
  value = {
    email     = local._email_ids
    pagerduty = local._pagerduty_ids
    slack     = local._slack_ids
  }
}

output "slo_ids" {
  description = "Service-level objective ids for dashboards / external tooling."
  value = {
    service      = google_monitoring_custom_service.api.service_id
    availability = google_monitoring_slo.api_availability.slo_id
    latency      = google_monitoring_slo.api_latency.slo_id
  }
}

output "alert_policy_count" {
  description = "Sanity check — number of alert policies managed by this module."
  value = length([
    google_monitoring_alert_policy.api_latency_p95.id,
    google_monitoring_alert_policy.pos_checkout_latency.id,
    google_monitoring_alert_policy.error_rate_5xx.id,
    google_monitoring_alert_policy.availability_fast_burn.id,
    google_monitoring_alert_policy.availability_slow_burn.id,
    google_monitoring_alert_policy.latency_slo_fast_burn.id,
    google_monitoring_alert_policy.firestore_read_quota.id,
    google_monitoring_alert_policy.firestore_write_quota.id,
    google_monitoring_alert_policy.backup_verify_failed.id,
    google_monitoring_alert_policy.backup_verify_absent.id,
    google_monitoring_alert_policy.cert_expiry.id,
    google_monitoring_alert_policy.api_uptime_failing.id,
    google_monitoring_alert_policy.frontend_uptime_failing.id,
    google_monitoring_alert_policy.scheduler_job_failed.id,
    google_monitoring_alert_policy.scheduler_down.id,
    google_monitoring_alert_policy.rum_lcp_regression.id,
    google_monitoring_alert_policy.rum_inp_regression.id,
    google_monitoring_alert_policy.rum_ingest_stalled.id,
    google_monitoring_alert_policy.rate_limit_spike.id,
    google_monitoring_alert_policy.pos_sync_conflict_spike.id,
    google_monitoring_alert_policy.efakhata_rejections.id,
    google_monitoring_alert_policy.cpu_saturation.id,
    google_monitoring_alert_policy.memory_saturation.id,
    google_monitoring_alert_policy.instance_ceiling.id,
  ])
}
