# =============================================================================
# dashboards.tf — Cloud Monitoring dashboards D1-D6 (T-SF.5.3)
# =============================================================================
# Each dashboard is a google_monitoring_dashboard whose body is dashboard JSON.
# We build the JSON with jsonencode() so it is type-checked and diffable rather
# than an opaque heredoc. Widgets use Cloud Run built-in metrics, the
# log-based metrics defined in main.tf, and the SLO objects.
#
#   D1  API latency & error rate
#   D2  Firestore health
#   D3  POS offline sync
#   D4  RUM web-vitals
#   D5  Business KPIs
#   D6  Per-tenant (templated by tenant_id label)
# =============================================================================

locals {
  # Reusable filter fragments.
  _run_request_count   = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\""
  _run_request_latency = "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\""
  _run_container_cpu   = "metric.type=\"run.googleapis.com/container/cpu/utilizations\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\""
  _run_container_mem   = "metric.type=\"run.googleapis.com/container/memory/utilizations\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\""
  _run_instance_count  = "metric.type=\"run.googleapis.com/container/instance_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.cloud_run_service_name}\""

  # Firestore (the API surfaces document read/write/delete ops + TTL).
  _fs_api_requests = "metric.type=\"firestore.googleapis.com/api/request_count\" resource.type=\"firestore_instance\""
  _fs_doc_reads    = "metric.type=\"firestore.googleapis.com/document/read_count\" resource.type=\"firestore_instance\""
  _fs_doc_writes   = "metric.type=\"firestore.googleapis.com/document/write_count\" resource.type=\"firestore_instance\""
  _fs_doc_deletes  = "metric.type=\"firestore.googleapis.com/document/delete_count\" resource.type=\"firestore_instance\""
}

# -----------------------------------------------------------------------------
# D1 — API latency & error rate
# -----------------------------------------------------------------------------
resource "google_monitoring_dashboard" "d1_api" {
  project = var.project_id

  dashboard_json = jsonencode({
    displayName = "D1 — API latency & error rate (${var.environment})"
    labels      = { component = "observability" }
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width = 6, height = 4, xPos = 0, yPos = 0
          widget = {
            title = "Request latency p50 / p95 / p99 (ms)"
            xyChart = {
              dataSets = [
                for pct in [50, 95, 99] : {
                  plotType   = "LINE"
                  legendTemplate = "p${pct}"
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = local._run_request_latency
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_PERCENTILE_${pct}"
                        crossSeriesReducer = "REDUCE_MEAN"
                      }
                    }
                  }
                }
              ]
              thresholds = [{ value = var.slo_api_latency_p95_ms, color = "RED", direction = "ABOVE" }]
              yAxis      = { label = "ms", scale = "LINEAR" }
            }
          }
        },
        {
          width = 6, height = 4, xPos = 6, yPos = 0
          widget = {
            title = "Request rate by response class (req/s)"
            xyChart = {
              dataSets = [{
                plotType = "STACKED_AREA"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = local._run_request_count
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.label.\"response_code_class\""]
                    }
                  }
                }
              }]
              yAxis = { label = "req/s", scale = "LINEAR" }
            }
          }
        },
        {
          width = 6, height = 4, xPos = 0, yPos = 4
          widget = {
            title = "5xx error ratio"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = {
                  timeSeriesFilterRatio = {
                    numerator = {
                      filter      = "${local._run_request_count} metric.label.\"response_code_class\"=\"5xx\""
                      aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM" }
                    }
                    denominator = {
                      filter      = local._run_request_count
                      aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM" }
                    }
                  }
                }
              }]
              thresholds = [{ value = var.slo_5xx_error_rate, color = "RED", direction = "ABOVE" }]
              yAxis      = { label = "ratio", scale = "LINEAR" }
            }
          }
        },
        {
          width = 3, height = 4, xPos = 6, yPos = 4
          widget = {
            title = "Instance count"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter      = local._run_instance_count
                    aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_MEAN", crossSeriesReducer = "REDUCE_SUM", groupByFields = ["metric.label.\"state\""] }
                  }
                }
              }]
            }
          }
        },
        {
          width = 3, height = 4, xPos = 9, yPos = 4
          widget = {
            title       = "Availability SLO (28d)"
            scorecard = {
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter      = "select_slo_health(\"${google_monitoring_custom_service.api.service_id}\", \"${google_monitoring_slo.api_availability.slo_id}\")"
                  aggregation = { alignmentPeriod = "300s", perSeriesAligner = "ALIGN_MEAN" }
                }
              }
              gaugeView = { lowerBound = var.slo_availability_target, upperBound = 1.0 }
            }
          }
        },
      ]
    }
  })
}

# -----------------------------------------------------------------------------
# D2 — Firestore health
# -----------------------------------------------------------------------------
resource "google_monitoring_dashboard" "d2_firestore" {
  project = var.project_id

  dashboard_json = jsonencode({
    displayName = "D2 — Firestore health (${var.environment})"
    labels      = { component = "observability" }
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width = 6, height = 4, xPos = 0, yPos = 0
          widget = {
            title = "Document ops/s (read / write / delete)"
            xyChart = {
              dataSets = [
                for f in [local._fs_doc_reads, local._fs_doc_writes, local._fs_doc_deletes] : {
                  plotType = "LINE"
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter      = f
                      aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM" }
                    }
                  }
                }
              ]
              yAxis = { label = "ops/s", scale = "LINEAR" }
            }
          }
        },
        {
          width = 6, height = 4, xPos = 6, yPos = 0
          widget = {
            title = "API request count by type"
            xyChart = {
              dataSets = [{
                plotType = "STACKED_BAR"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter      = local._fs_api_requests
                    aggregation = { alignmentPeriod = "300s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM", groupByFields = ["metric.label.\"op\""] }
                  }
                }
              }]
            }
          }
        },
        {
          width = 12, height = 4, xPos = 0, yPos = 4
          widget = {
            title = "Backend-observed Firestore op latency p95 (ms, from /metrics histogram)"
            xyChart = {
              dataSets = [{
                plotType       = "LINE"
                legendTemplate = "p95 — $${metric.label.collection}"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    # prometheus_target export of firestore_op_duration_ms histogram.
                    filter      = "metric.type=\"prometheus.googleapis.com/firestore_op_duration_ms/histogram\" resource.type=\"prometheus_target\""
                    aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_PERCENTILE_95", crossSeriesReducer = "REDUCE_MAX", groupByFields = ["metric.label.\"collection\""] }
                  }
                }
              }]
              yAxis = { label = "ms", scale = "LINEAR" }
            }
          }
        },
      ]
    }
  })
}

# -----------------------------------------------------------------------------
# D3 — POS offline sync
# -----------------------------------------------------------------------------
resource "google_monitoring_dashboard" "d3_pos_sync" {
  project = var.project_id

  dashboard_json = jsonencode({
    displayName = "D3 — POS offline sync (${var.environment})"
    labels      = { component = "observability" }
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width = 6, height = 4, xPos = 0, yPos = 0
          widget = {
            title = "Offline orders queued (client-reported gauge)"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter      = "metric.type=\"prometheus.googleapis.com/pos_orders_offline_queued/gauge\" resource.type=\"prometheus_target\""
                    aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_MEAN", crossSeriesReducer = "REDUCE_SUM" }
                  }
                }
              }]
              yAxis = { label = "orders", scale = "LINEAR" }
            }
          }
        },
        {
          width = 6, height = 4, xPos = 6, yPos = 0
          widget = {
            title = "POS sync conflicts/min (log-based)"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter      = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.pos_sync_conflict.name}\""
                    aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM" }
                  }
                }
              }]
            }
          }
        },
        {
          width = 12, height = 4, xPos = 0, yPos = 4
          widget = {
            title = "POS checkout latency p95 (ms)"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter      = "${local._run_request_latency} metric.label.\"response_code_class\"=\"2xx\""
                    aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_PERCENTILE_95", crossSeriesReducer = "REDUCE_MEAN" }
                  }
                }
              }]
              thresholds = [{ value = var.slo_pos_checkout_p95_ms, color = "RED", direction = "ABOVE" }]
              yAxis      = { label = "ms", scale = "LINEAR" }
            }
          }
        },
      ]
    }
  })
}

# -----------------------------------------------------------------------------
# D4 — RUM web-vitals (BigQuery-backed via the daily rollup + scorecard tiles)
# -----------------------------------------------------------------------------
# Cloud Monitoring can't query BigQuery directly, so the live tiles use the
# prometheus-exported client gauges where present, and a text tile links to the
# Looker Studio report built on vitals_daily. The LCP/INP regression ALERTS
# read the BigQuery rollup via the scheduled-query alerting path (alerts.tf).
resource "google_monitoring_dashboard" "d4_rum" {
  project = var.project_id

  dashboard_json = jsonencode({
    displayName = "D4 — RUM web-vitals (${var.environment})"
    labels      = { component = "observability" }
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width = 12, height = 1, xPos = 0, yPos = 0
          widget = {
            title = "Source"
            text = {
              content = "Core Web Vitals are stored in BigQuery `${var.rum_dataset_id}.vitals_daily` (p50/p75/p95 per route+device). Full interactive analysis: Looker Studio report on that table. Regression alerts (LCP p75 > ${var.rum_lcp_p75_regression_ms}ms, INP p75 > ${var.rum_inp_p75_regression_ms}ms) are defined in alerts.tf."
              format  = "MARKDOWN"
            }
          }
        },
        {
          width = 6, height = 4, xPos = 0, yPos = 1
          widget = {
            title = "RUM ingest rate (events/s, from request_count on /api/rum/vitals)"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter      = "metric.type=\"prometheus.googleapis.com/http_requests_total/counter\" resource.type=\"prometheus_target\" metric.label.\"route\"=\"/api/rum/vitals\""
                    aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM" }
                  }
                }
              }]
            }
          }
        },
        {
          width = 6, height = 4, xPos = 6, yPos = 1
          widget = {
            title = "RUM endpoint latency p95 (ms)"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter      = "metric.type=\"prometheus.googleapis.com/http_request_duration_ms/histogram\" resource.type=\"prometheus_target\" metric.label.\"route\"=\"/api/rum/vitals\""
                    aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_PERCENTILE_95", crossSeriesReducer = "REDUCE_MEAN" }
                  }
                }
              }]
              yAxis = { label = "ms", scale = "LINEAR" }
            }
          }
        },
      ]
    }
  })
}

# -----------------------------------------------------------------------------
# D5 — Business KPIs (log-based business signals + request volume by route)
# -----------------------------------------------------------------------------
resource "google_monitoring_dashboard" "d5_business" {
  project = var.project_id

  dashboard_json = jsonencode({
    displayName = "D5 — Business KPIs (${var.environment})"
    labels      = { component = "observability" }
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width = 4, height = 4, xPos = 0, yPos = 0
          widget = {
            title = "Idempotency replays/min"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.idempotency_replay.name}\""
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM" }
                } }
              }]
            }
          }
        },
        {
          width = 4, height = 4, xPos = 4, yPos = 0
          widget = {
            title = "Rate-limit rejections/min"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.rate_limit_rejected.name}\""
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM" }
                } }
              }]
            }
          }
        },
        {
          width = 4, height = 4, xPos = 8, yPos = 0
          widget = {
            title = "e-Fakhata rejections/hour"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.efakhata_rejected.name}\""
                  aggregation = { alignmentPeriod = "3600s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM" }
                } }
              }]
            }
          }
        },
        {
          width = 12, height = 4, xPos = 0, yPos = 4
          widget = {
            title = "Top routes by request rate"
            xyChart = {
              dataSets = [{
                plotType = "STACKED_AREA"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"prometheus.googleapis.com/http_requests_total/counter\" resource.type=\"prometheus_target\""
                  aggregation = { alignmentPeriod = "300s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM", groupByFields = ["metric.label.\"route\""] }
                  pickTimeSeriesFilter = { rankingMethod = "METHOD_MEAN", numTimeSeries = 10, direction = "TOP" }
                } }
              }]
            }
          }
        },
      ]
    }
  })
}

# -----------------------------------------------------------------------------
# D6 — Per-tenant (templated by the org_id label)
# -----------------------------------------------------------------------------
# A dashboard-level label filter (`org_id`) lets an operator scope every tile to
# one tenant. Tiles read the prometheus-exported metrics that carry a tenant
# label plus the per-tenant log-based metrics.
resource "google_monitoring_dashboard" "d6_per_tenant" {
  project = var.project_id

  dashboard_json = jsonencode({
    displayName = "D6 — Per-tenant (${var.environment})"
    labels      = { component = "observability" }
    dashboardFilters = [
      {
        labelKey     = "org_id"
        templateVariable = "org_id"
        filterType   = "METRIC_LABEL"
        stringValue  = ""
      }
    ]
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width = 12, height = 1, xPos = 0, yPos = 0
          widget = {
            title = "Usage"
            text = {
              content = "Set the **org_id** template variable (top of dashboard) to scope all tiles to one tenant. Per-tenant cost lives in BigQuery `${var.rum_dataset_id}.cost_per_tenant_daily`."
              format  = "MARKDOWN"
            }
          }
        },
        {
          width = 6, height = 4, xPos = 0, yPos = 1
          widget = {
            title = "Tenant request rate (req/s)"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"prometheus.googleapis.com/http_requests_total/counter\" resource.type=\"prometheus_target\""
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM", groupByFields = ["metric.label.\"org_id\""] }
                } }
              }]
            }
          }
        },
        {
          width = 6, height = 4, xPos = 6, yPos = 1
          widget = {
            title = "Tenant rate-limit rejections/min"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.rate_limit_rejected.name}\""
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM", groupByFields = ["metric.label.\"tenant_id\""] }
                } }
              }]
            }
          }
        },
        {
          width = 6, height = 4, xPos = 0, yPos = 5
          widget = {
            title = "Tenant backup-verify failures (log-based)"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.backup_verify_failed.name}\""
                  aggregation = { alignmentPeriod = "3600s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM", groupByFields = ["metric.label.\"tenant_id\""] }
                } }
              }]
            }
          }
        },
      ]
    }
  })
}
