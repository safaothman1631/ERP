# Runbook — Redis (Memorystore) outage

> **Owner:** BE on-call (primary), DevOps (secondary)
> **Trigger:**
> * Cloud Monitoring alert `redis_up == 0` for > 60 s; OR
> * Backend `/api/system/health` reports `redis.status="down"`.

Redis powers (a) the response cache (R5.1), (b) the rate limiter (R5.5),
and (c) CSP report storage. None of these are on the critical
write-path of money-moving operations — so the design choice is:
**fail open** for caches, **fail open with conservative defaults** for
the rate limiter, **fail silent** for CSP storage.

## 1. Confirm

```bash
gcloud redis instances describe zoho-rate-limit \
  --region me-central1 --project erp-system-494716 \
  --format='value(state,host,port,memorySizeGb)'
```

* `state=READY` → not the actual Redis; check network (Cloud Run VPC connector status).
* `state=MAINTENANCE` → Memorystore is on a scheduled patch. Expect 5-15 minutes.
* `state=REPAIRING` / `DELETED` / `CREATING` → GCP-side incident; check the Status page.

Cloud Run-side connectivity:

```bash
gcloud run services describe zoho-erp \
  --region me-central1 --project erp-system-494716 \
  --format='value(spec.template.spec.containers[0].env)'
# Look for RATE_LIMIT_STORAGE_URI and RESPONSE_CACHE_URL
```

Verify the VPC connector is healthy:

```bash
gcloud compute networks vpc-access connectors describe zoho-connector \
  --region me-central1 --project erp-system-494716 \
  --format='value(state)'
# state=READY required
```

## 2. Expected user impact

| Subsystem | Impact when Redis is unreachable |
|---|---|
| Response cache (R5.1) | **None on correctness.** Latency rises ~ 2-3x on the 20 hot endpoints. p95 may breach SLO. |
| Rate limiter (R5.5) | Limiter switches to **in-memory per-instance** fallback (slowapi default). Means an attacker can effectively get 600 req/min × N instances. **Acceptable for ≤ 1 hour**; longer needs Cloud Armor temporary block. |
| CSP report intake | Reports are still written to Cloud Logging (structured logs). The Redis ring buffer is unavailable; `/api/csp-report/_recent` returns empty. **No user impact.** |
| Session storage | We do **not** store sessions in Redis — sessions are JWTs. Unaffected. |
| Background-job queue | We use APScheduler in-process, not Redis-backed. Unaffected. |

If a customer reports timeouts during an outage, it is the latency, not a hard failure.

## 3. Fail-open behaviour — verify

The cache facade `backend/app/services/cache.py` swallows connection errors and goes straight to the source-of-truth read. Confirm in logs:

```
jsonPayload.cache_backend="memory_fallback"
| stats count by minute(timestamp)
```

The rate limiter is the only place a misconfiguration can cause a *hard* failure. Confirm:

```bash
gcloud logging read \
  'jsonPayload.message:"rate limiter using in-memory backend"' \
  --limit 5 --format=json --project=erp-system-494716
```

If the fallback line is **absent** during an outage, slowapi is throwing — file an emergency PR to wrap the slowapi init in a try/except and ship via the hot-fix branch.

## 4. Recovery options

### 4.1 Restart Memorystore (if MAINTENANCE)

Wait it out — Memorystore patches typically complete in 5-15 min. The Cloud Run side reconnects automatically.

### 4.2 Recreate (if REPAIRING / DELETED)

```bash
gcloud redis instances create zoho-rate-limit-2 \
  --region me-central1 --project erp-system-494716 \
  --size=1 --tier=basic --redis-version=redis_7_0 \
  --network=projects/erp-system-494716/global/networks/zoho-vpc
```

Then update the secret:

```bash
NEW_HOST=$(gcloud redis instances describe zoho-rate-limit-2 \
  --region me-central1 --project erp-system-494716 \
  --format='value(host)')

echo -n "redis://${NEW_HOST}:6379/0" \
  | gcloud secrets versions add redis-rate-limit-uri \
      --project erp-system-494716 --data-file=-

gcloud run services update zoho-erp \
  --region me-central1 --project erp-system-494716 \
  --update-secrets RATE_LIMIT_STORAGE_URI=redis-rate-limit-uri:latest
```

A new Cloud Run revision rolls. ETA: 3 minutes.

### 4.3 Region failover

If `me-central1` is in a regional incident:

* `gcloud redis instances create zoho-rate-limit-asia --region=asia-southeast1 ...`
* Update the secret to point at the new region.
* Note that **cross-region latency is ~ 60-80ms**, so p95 on cached endpoints will be worse than no-cache. Decide: maybe leave Redis off until `me-central1` is back.

## 5. Cold start of the cache

When Redis returns, the cache is empty. The first few minutes will show
elevated origin reads. Watch:

```
jsonPayload.cache_backend="redis"
jsonPayload.cache="miss"
| stats count by minute(timestamp)
```

Count should drop quickly as steady-state writes refill the cache. If
it stays high, a single VU is shouldering all the misses — file a
ticket against the cache key prefix's owner.

## 6. Confirm green

* `/api/system/health` reports `redis.status="up"`.
* Per-endpoint p95 returns to baseline (compare with the 7-day median).
* Rate limiter cookie returns to Redis backend (search logs).

## 7. Post-incident

* File `audit/incidents/YYYY-MM-DD-redis-down.md` with timing of each step.
* If the outage exceeded 1 hour, follow §8 (Cloud Armor) — document any IPs we hard-blocked so they can be released.

## 8. Optional: Cloud Armor temporary block

If during the outage we observe abuse exceeding 1k req/min/IP:

```bash
gcloud compute security-policies rules create 1000 \
  --security-policy zoho-erp-armor \
  --src-ip-ranges <BAD_IP>/32 \
  --action deny-403 \
  --description "TEMP: Redis-down abuse $(date -u +%FT%TZ)"
```

Schedule a removal task in the calendar for + 24h. **Do not let
temporary blocks linger.**
