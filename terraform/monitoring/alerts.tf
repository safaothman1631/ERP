# =============================================================================
# alerts.tf — 24 Cloud Monitoring alert policies (T-SF.5.4, 5.12, 5.14, 5.16)
# =============================================================================
# Routing:
#   - Page-worthy (user-facing outage / data-loss risk)  → local.page_channels
#   - Awareness (degradation, capacity, hygiene)          → local.alert_channels
#
# Each policy sets a severity user-label so PagerDuty / Slack can route further.
# Burn-rate alerts use the SLO objects from main.tf. Latency/error-rate alerts
# read Cloud Run built-in metrics. Compliance / job-health alerts read the
# log-based metrics from main.tf.
# =============================================================================

locals {
  alert_user_labels = merge(local.common_labels, { layer = "alert" })

  # Multi-window error-budget burn (Google SRE workbook): a fast-burn (1h, 14.4x)
  # page and a slow-burn (6h, 6x) ticket. Encoded as lookback windows below.
}

# -----------------------------------------------------------------------------
# 1. API latency p95 too high (read-list class)               [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "api_latency_p95" {
  display_name = "[${var.environment}] API latency p95 > ${var.slo_api_latency_p95_ms}ms"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Cloud Run request latency p95"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.slo_api_latency_p95_ms
      duration        = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  alert_strategy { auto_close = "1800s" }
  documentation {
    content   = "API p95 latency exceeded ${var.slo_api_latency_p95_ms}ms for 5m. Check D1 dashboard, recent deploy, Firestore latency (D2), and instance saturation."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 2. POS checkout latency p95 too high                        [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "pos_checkout_latency" {
  display_name = "[${var.environment}] POS checkout p95 > ${var.slo_pos_checkout_p95_ms}ms"
  combiner     = "OR"
  severity     = "CRITICAL"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "POS-class request latency p95"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.slo_pos_checkout_p95_ms
      duration        = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.page_channels
  alert_strategy { auto_close = "1800s" }
  documentation {
    content   = "Checkout latency breached the ${var.slo_pos_checkout_p95_ms}ms SLO. POS is revenue-critical — investigate immediately. See D3."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 3. 5xx error rate elevated                                  [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "error_rate_5xx" {
  display_name = "[${var.environment}] 5xx error ratio > ${var.slo_5xx_error_rate}"
  combiner     = "OR"
  severity     = "CRITICAL"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "5xx / total request ratio"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\" metric.label.\"response_code_class\"=\"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.slo_5xx_error_rate
      duration        = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
      denominator_filter = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\""
      denominator_aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.page_channels
  alert_strategy { auto_close = "1800s" }
  documentation {
    content   = "5xx ratio exceeded ${var.slo_5xx_error_rate}. Check recent deploy + Sentry release health. Roll back via deploy-production if a bad revision is implicated."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 4. Error-budget FAST burn (availability SLO, 1h window)     [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "availability_fast_burn" {
  display_name = "[${var.environment}] Availability error-budget FAST burn (1h, 14.4x)"
  combiner     = "OR"
  severity     = "CRITICAL"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Burn rate over 1h"
    condition_threshold {
      filter          = "select_slo_burn_rate(\"projects/${var.project_id}/services/${google_monitoring_custom_service.api.service_id}/serviceLevelObjectives/${google_monitoring_slo.api_availability.slo_id}\", \"3600s\")"
      comparison      = "COMPARISON_GT"
      threshold_value = 14.4
      duration        = "0s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.page_channels
  documentation {
    content   = "Burning the 28-day availability budget 14.4x over the last hour — at this rate the entire budget is gone in ~2 days. Page and mitigate."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 5. Error-budget SLOW burn (availability SLO, 6h window)     [TICKET]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "availability_slow_burn" {
  display_name = "[${var.environment}] Availability error-budget SLOW burn (6h, 6x)"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Burn rate over 6h"
    condition_threshold {
      filter          = "select_slo_burn_rate(\"projects/${var.project_id}/services/${google_monitoring_custom_service.api.service_id}/serviceLevelObjectives/${google_monitoring_slo.api_availability.slo_id}\", \"21600s\")"
      comparison      = "COMPARISON_GT"
      threshold_value = 6
      duration        = "0s"
      aggregations {
        alignment_period   = "600s"
        per_series_aligner = "ALIGN_MEAN"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "Sustained slow burn of the availability budget. Open a ticket and investigate the dominant error source before it becomes a page."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 6. Latency SLO FAST burn                                    [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "latency_slo_fast_burn" {
  display_name = "[${var.environment}] Latency error-budget FAST burn (1h, 14.4x)"
  combiner     = "OR"
  severity     = "CRITICAL"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Latency burn rate over 1h"
    condition_threshold {
      filter          = "select_slo_burn_rate(\"projects/${var.project_id}/services/${google_monitoring_custom_service.api.service_id}/serviceLevelObjectives/${google_monitoring_slo.api_latency.slo_id}\", \"3600s\")"
      comparison      = "COMPARISON_GT"
      threshold_value = 14.4
      duration        = "0s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.page_channels
  documentation {
    content   = "Latency SLO budget burning fast. A large share of requests are over ${var.slo_api_latency_p95_ms}ms."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 7. Firestore read quota approaching limit                   [TICKET]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "firestore_read_quota" {
  display_name = "[${var.environment}] Firestore read ops sustained high"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Document reads/s over threshold"
    condition_threshold {
      filter          = "metric.type=\"firestore.googleapis.com/document/read_count\" resource.type=\"firestore_instance\""
      comparison      = "COMPARISON_GT"
      threshold_value = 8000
      duration        = "600s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "Firestore read rate sustained above 8k/s — review N+1 query patterns (scripts/audit-firestore-queries.py) and cache hit ratio before hitting account quota."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 8. Firestore write quota approaching limit                  [TICKET]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "firestore_write_quota" {
  display_name = "[${var.environment}] Firestore write ops sustained high"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Document writes/s over threshold"
    condition_threshold {
      filter          = "metric.type=\"firestore.googleapis.com/document/write_count\" resource.type=\"firestore_instance\""
      comparison      = "COMPARISON_GT"
      threshold_value = 4000
      duration        = "600s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "Firestore write rate sustained above 4k/s. Check for hot documents / unbatched writes."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 9. Backup verification failed                               [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "backup_verify_failed" {
  display_name = "[${var.environment}] Backup verification FAILED"
  combiner     = "OR"
  severity     = "CRITICAL"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "backup_verify_failed log metric > 0"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.backup_verify_failed.name}\" resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.page_channels
  documentation {
    content   = "A Firestore backup failed verification (see DISASTER_RECOVERY.md). RPO is at risk — investigate the backup pipeline and re-run verify_latest_backup."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 10. No successful backup-verify in 36h (absence)            [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "backup_verify_absent" {
  display_name = "[${var.environment}] No backup-verify signal in 36h"
  combiner     = "OR"
  severity     = "CRITICAL"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Absence of backup-verify log activity"
    condition_absent {
      filter   = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.backup_verify_failed.name}\" resource.type=\"cloud_run_revision\""
      duration = "129600s" # 36h
      aggregations {
        alignment_period   = "3600s"
        per_series_aligner = "ALIGN_SUM"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.page_channels
  documentation {
    content   = "No backup-verify telemetry for 36h. Either the weekly backup-verify job is not running or logging is broken. NOTE: this fires on absence of the *failure* metric stream; pair with the backup-verify CI workflow's own success signal."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 11. TLS certificate expiring soon (API host)               [TICKET]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "cert_expiry" {
  display_name = "[${var.environment}] TLS cert expiring < ${var.cert_expiry_warning_days}d"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Uptime SSL time-until-expiry"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/time_until_ssl_cert_expiry\" resource.type=\"uptime_url\" metric.label.\"check_id\"=\"${google_monitoring_uptime_check_config.api_health.uptime_check_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = var.cert_expiry_warning_days * 24 * 60 * 60
      duration        = "600s"
      aggregations {
        alignment_period   = "3600s"
        per_series_aligner = "ALIGN_MIN"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "The API TLS certificate expires within ${var.cert_expiry_warning_days} days. If managed by Google/Vercel this usually auto-renews — verify the renewal happened."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 12. API uptime check failing                                [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "api_uptime_failing" {
  display_name = "[${var.environment}] API /api/health uptime check failing"
  combiner     = "OR"
  severity     = "CRITICAL"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Uptime check_passed = false"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" resource.type=\"uptime_url\" metric.label.\"check_id\"=\"${google_monitoring_uptime_check_config.api_health.uptime_check_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "180s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_FRACTION_TRUE"
        cross_series_reducer = "REDUCE_MEAN"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.page_channels
  documentation {
    content   = "Global uptime probes can't reach /api/health. Confirm Cloud Run is serving and DNS/LB are healthy."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 13. Frontend shell uptime failing                          [TICKET]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "frontend_uptime_failing" {
  display_name = "[${var.environment}] Frontend shell uptime check failing"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Frontend uptime check_passed = false"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" resource.type=\"uptime_url\" metric.label.\"check_id\"=\"${google_monitoring_uptime_check_config.frontend_shell.uptime_check_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "600s"
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_FRACTION_TRUE"
        cross_series_reducer = "REDUCE_MEAN"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "The marketing/app shell is unreachable from global probes. Check Vercel status + DNS."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 14. Scheduler job failures                                  [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "scheduler_job_failed" {
  display_name = "[${var.environment}] Scheduler job failures"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "scheduler_job_failed > 0"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.scheduler_job_failed.name}\" resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["metric.label.\"job_id\""]
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "An APScheduler job errored (e.g. cbi_rate_refresh, payments_reconciliation, efakhata_submission_drain). Check the job_id label and recent logs."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 15. Scheduler heartbeat absent (scheduler down)            [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "scheduler_down" {
  display_name = "[${var.environment}] Scheduler heartbeat absent (down)"
  combiner     = "OR"
  severity     = "CRITICAL"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "No scheduler heartbeat in 15m"
    condition_absent {
      filter   = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.scheduler_heartbeat.name}\" resource.type=\"cloud_run_revision\""
      duration = "900s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.page_channels
  documentation {
    content   = "No scheduler heartbeat for 15 minutes — nightly reconciliation, backups, CBI refresh, and e-Fakhata drain will silently stop. Confirm at least one instance runs the scheduler (min-instances >= 1)."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 16. RUM LCP p75 regression                                  [TICKET]
# -----------------------------------------------------------------------------
# Reads the prometheus-exported LCP gauge if present; the authoritative BQ-based
# check is the rum_daily_agg rollup reviewed by the scorecard. This live policy
# catches a sharp regression between rollups.
resource "google_monitoring_alert_policy" "rum_lcp_regression" {
  display_name = "[${var.environment}] RUM LCP p75 > ${var.rum_lcp_p75_regression_ms}ms"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Client LCP p75 over 'good' threshold"
    condition_threshold {
      filter          = "metric.type=\"prometheus.googleapis.com/rum_lcp_ms/histogram\" resource.type=\"prometheus_target\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.rum_lcp_p75_regression_ms
      duration        = "1800s"
      aggregations {
        alignment_period   = "600s"
        per_series_aligner = "ALIGN_PERCENTILE_50"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "Field LCP p75 regressed past ${var.rum_lcp_p75_regression_ms}ms (Google 'good' bound). Check the latest frontend deploy, bundle-diff, and image weight. Cross-check D4 + vitals_daily."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 17. RUM INP p75 regression                                  [TICKET]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "rum_inp_regression" {
  display_name = "[${var.environment}] RUM INP p75 > ${var.rum_inp_p75_regression_ms}ms"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Client INP p75 over 'good' threshold"
    condition_threshold {
      filter          = "metric.type=\"prometheus.googleapis.com/rum_inp_ms/histogram\" resource.type=\"prometheus_target\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.rum_inp_p75_regression_ms
      duration        = "1800s"
      aggregations {
        alignment_period   = "600s"
        per_series_aligner = "ALIGN_PERCENTILE_50"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "Field INP p75 regressed past ${var.rum_inp_p75_regression_ms}ms. Investigate long tasks / main-thread blocking introduced by the latest deploy."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 18. RUM ingest stalled (no vitals received)               [TICKET]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "rum_ingest_stalled" {
  display_name = "[${var.environment}] RUM ingest stalled (no vitals 1h)"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "No requests to /api/rum/vitals in 1h"
    condition_absent {
      filter   = "metric.type=\"prometheus.googleapis.com/http_requests_total/counter\" resource.type=\"prometheus_target\" metric.label.\"route\"=\"/api/rum/vitals\""
      duration = "3600s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "No RUM vitals received for an hour during normal traffic — the client reporter or the ingest endpoint may be broken. Dashboards D4 will go stale."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 19. Rate-limit rejection spike                              [TICKET]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "rate_limit_spike" {
  display_name = "[${var.environment}] Rate-limit rejection spike"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "429 rejections/min high"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.rate_limit_rejected.name}\" resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 100
      duration        = "300s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "Sustained 429s — either an abusive client/integration or a too-tight limit. Inspect the tenant_id label on D6."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 20. POS sync conflict spike                                 [TICKET]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "pos_sync_conflict_spike" {
  display_name = "[${var.environment}] POS sync conflict spike"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "POS sync conflicts/min high"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.pos_sync_conflict.name}\" resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 20
      duration        = "300s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "Elevated POS offline-sync conflicts. A device may be running an old build or there is clock skew. See D3."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 21. e-Fakhata submission rejections                         [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "efakhata_rejections" {
  display_name = "[${var.environment}] e-Fakhata MoF rejections"
  combiner     = "OR"
  severity     = "CRITICAL"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "e-Fakhata rejected > 0 over 15m"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.efakhata_rejected.name}\" resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"
      aggregations {
        alignment_period     = "900s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.page_channels
  documentation {
    content   = "The Ministry of Finance rejected an e-Fakhata submission — a compliance/legal issue for the merchant. Check the submission queue + cert validity."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 22. Cloud Run CPU saturation (capacity)                     [TICKET]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "cpu_saturation" {
  display_name = "[${var.environment}] Cloud Run CPU > 80% sustained"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Container CPU utilization p95 > 0.8"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/container/cpu/utilizations\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "600s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "CPU sustained above 80%. Raise max-instances or CPU allocation before latency degrades."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 23. Cloud Run memory saturation (OOM risk)                  [PAGE]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "memory_saturation" {
  display_name = "[${var.environment}] Cloud Run memory > 90% (OOM risk)"
  combiner     = "OR"
  severity     = "CRITICAL"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Container memory utilization p95 > 0.9"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/container/memory/utilizations\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.9
      duration        = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.page_channels
  documentation {
    content   = "Memory above 90% — container restarts (OOM) are imminent and will drop in-flight requests + the scheduler. Raise the memory limit."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# 24. Cloud Run scaled to ceiling (request loss risk)         [TICKET]
# -----------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "instance_ceiling" {
  display_name = "[${var.environment}] Cloud Run pinned at max instances"
  combiner     = "OR"
  severity     = "WARNING"
  user_labels  = local.alert_user_labels

  conditions {
    display_name = "Active instance count sustained high"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/container/instance_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\" metric.label.\"state\"=\"active\""
      comparison      = "COMPARISON_GT"
      threshold_value = 18 # alert at 90% of a default max-instances=20; tune per service config
      duration        = "600s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = local.alert_channels
  documentation {
    content   = "Active instances near the max-instances ceiling for 10m — new requests risk being queued or rejected. Raise max-instances or investigate the load source. Adjust the threshold to 90% of the service's configured max-instances."
    mime_type = "text/markdown"
  }
}
