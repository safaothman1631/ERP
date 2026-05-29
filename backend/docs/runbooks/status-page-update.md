# Status-Page Update Runbook (G2 / R2.5)

## When to use

* A live customer incident is detected (S0 or S1).
* Scheduled maintenance is about to start.
* A degraded-performance threshold has tripped in monitoring and needs a
  human acknowledgment.

## Provider

We use **Statuspage.io** as the primary status-page host (per ADR-G-06).
A self-hosted **Cachet** instance is the documented fallback.

Both are pushed automatically by
`backend/app/api/internal/health_emit.py::emit_status_now`, called every
60 seconds from APScheduler (`scheduler.add_job(_emit_status, ...)`).

## Components mapped

| Internal key       | Statuspage component                                   |
| ------------------ | ------------------------------------------------------ |
| `api`              | "API"                                                   |
| `firestore`        | "Firestore / database"                                  |
| `pos_offline_sync` | "POS offline sync"                                     |
| `email_delivery`   | "Email delivery"                                       |

Map IDs are loaded from the `STATUSPAGE_COMPONENTS` env var (JSON).

## Status thresholds

`emit_status_now` computes a status string per component based on
rolling metrics (`_ROUTE_STATS`, cache counters):

| Condition (rolling) | Status                  |
| ------------------- | ----------------------- |
| 5xx ≥ 10%           | `major_outage`          |
| 5xx ≥ 2%            | `partial_outage`        |
| 5xx ≥ 0.5%          | `degraded_performance`  |
| otherwise           | `operational`           |

(Firestore / POS / email use similar thresholds — see source.)

## Manual override (during an incident)

The cron is **best-effort**. For active incidents, on-call publishes the
incident **from Statuspage's web UI**, then:

1. SSH to the operator host.
2. `curl -X POST https://app.zoho-kurdish.iq/api/internal/health-emit \
     -H 'X-Internal-Token: $INTERNAL_CRON_TOKEN'` — to push the latest
   per-component status immediately.
3. Verify on `https://status.zoho-kurdish.iq`.

## Required env vars

| Var                       | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `STATUSPAGE_API_KEY`      | Bearer token for api.statuspage.io       |
| `STATUSPAGE_PAGE_ID`      | Page ID                                  |
| `STATUSPAGE_COMPONENTS`   | JSON map `{ "api": "<id>", ... }`        |
| `CACHET_URL`              | Fallback Cachet URL                      |
| `CACHET_TOKEN`            | Cachet API token                         |
| `CACHET_COMPONENTS`       | JSON map (Cachet IDs)                    |
| `INTERNAL_CRON_TOKEN`     | Shared secret for `/api/internal/*`      |

## When the status page goes down

The page is hosted on a *separate* provider (Statuspage.io is fully
managed by Atlassian). If both Statuspage and our app go down at once:

1. Tweet from `@ZohoKurdish` Twitter account.
2. Post in the Crisp support inbox so users contacting us see the
   notice.
3. Update WhatsApp Business away-message.

## Post-incident

* Within 5 business days, publish a postmortem.
* Update this runbook if the incident exposed a gap.
