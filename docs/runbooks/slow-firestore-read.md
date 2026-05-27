# Runbook — Slow Firestore reads (p99 > 1s)

> **Owner:** BE on-call
> **Trigger:** Cloud Monitoring alert `firestore_read_p99_ms > 1000` for 5 min,
> **or** OTel span search `service.name=zoho-erp duration_ms>1000 db.system=firestore` rate > 5/min.

A p99 read exceeding 1 second on a single-doc read is almost always one
of: a missing index, a listener-fan-out problem, a tenant that has
exploded in size, or a Firestore regional incident.

## 1. First minute — confirm and locate

1. Open Cloud Monitoring → "Firestore reads p50/p95/p99 by tenant" dashboard.
2. Identify whether the spike is:
   * **Tenant-isolated** (one tenant_id is anomalous) → §3.
   * **Collection-isolated** (one collection across all tenants) → §4.
   * **Region-wide** (every tenant, every collection) → §6.
3. Check the OTel trace search for slow spans:
   ```
   service.name="zoho-erp"
   db.system="firestore"
   duration_ms > 1000
   tenant_id = "<offender>"
   ```
   The span attributes `firestore.collection` and `firestore.operation` show what the user was doing.

## 2. Health snapshot

```bash
curl -sf https://api.erp.zoho.kurd.iq/api/system/health | jq '.firestore'
```

Look at `last_read_p99_ms`, `listener_count`, `slow_read_count_5min`.
Healthy production values: `last_read_p99_ms < 400`,
`listener_count < 2000`, `slow_read_count_5min < 10`.

## 3. Tenant-isolated spike

The tenant has either:

* **Grown beyond expected size.** Query: `SELECT collection, COUNT(*) FROM tenant_<tid> GROUP BY collection ORDER BY 2 DESC LIMIT 5` (we ship a tenant-stats tool — `python -m app.scripts.tenant_stats --tid <tid>`).
  * If `contacts` > 200k or `invoices` > 500k for a non-enterprise plan, escalate to Sales — this tenant should be on a higher tier with sharded reads.
* **A bot is hammering an endpoint.** Per-tenant rate limiter trip:
  ```bash
  python -m app.scripts.rate_limit_status --tid <tid>
  ```
  If the bucket is empty (we're at the throttle), the slowdown is the *symptom*, not the *cause*. Confirm the source IP isn't ours (it could be a runaway integration).
* **Holding a long-lived listener that fan-outs writes.** Check `useFirestoreLive` time-boxing — every listener must dispose after 10 minutes idle. If a tenant has a stale listener, the resume-from-token cost scales with the queue size.

**Fixes:**
* Stale listener → server-side restart of the affected Cloud Run instance (`gcloud run services update zoho-erp --update-env-vars FORCE_RESTART=$(date +%s)`).
* Bot → ban IP at Cloud Armor.
* Big tenant → run the on-call sharding tool: `python -m app.scripts.shard_tenant --tid <tid> --collection contacts`.

## 4. Collection-isolated spike

A query against a single collection has gone bad.

* In Firestore Console → Indexes, search the collection. Look for any
  composite index in `BUILDING` or `ERROR`. A query that was using an
  index that is now rebuilding will hit the slow path.
* `gcloud firestore indexes composite list --project=erp-system-494716 --format='table(name,state,fields[].fieldPath)'`
* If an index is missing entirely (a new query was deployed without an
  index): the query throws `FAILED_PRECONDITION` and the FE falls back
  to a client-side filter (slow!). Search Cloud Logging:
  ```
  severity=ERROR
  jsonPayload.message:"FAILED_PRECONDITION"
  jsonPayload.message:"needs an index"
  ```

**Fix:**
* Take the index hint from the error message and `firebase deploy --only firestore:indexes`.
* If a deploy is in progress, **roll back the FE** until the index is `READY` — the index build can take 10-30 minutes for large collections, and meanwhile the query is brutal.

## 5. Listener fan-out

Symptom: `listener_count` in `/api/system/health` is climbing, not stabilising.

This is the §1.5 design issue — a hook somewhere is registering a new listener on every render. To find it:

```
service.name="zoho-erp"
jsonPayload.message:"firestore.listener.opened"
| stats count by jsonPayload.route, jsonPayload.collection
| order by count desc
```

The top row is the offender. Add a hook hook-rule unit test (`hooks/__tests__/listener-leak.test.ts`) and fix the dep array.

## 6. Region-wide / Firestore incident

If the spike is region-wide, check the [GCP Status page](https://status.cloud.google.com/) for `Firestore me-central1`. If GCP confirms an incident:

* Switch the `read_replica` flag (`READ_REPLICA_REGION` env) to a backup region.
* Notify users via the `/api/system/banner` admin API — show "Slow performance — Google Cloud incident #XXXX".
* Wait. There is nothing to fix on our side.

## 7. Confirm green

* p99 returns below 400ms over a rolling 5-minute window.
* `slow_read_count_5min` drops below 10.
* No new SEV-1/2 tickets in 30 minutes.

## 8. Post-incident

* Write a brief in `audit/incidents/YYYY-MM-DD-firestore-slow.md` with the trace ids of the worst spans.
* If a missing index was the cause, add a CI check that fails on deploy if `firestore.indexes.json` is missing an entry for any query found in `git grep "where(" -- 'backend/app/firestore/'`.
