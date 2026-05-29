# Runbook — Cold-start spike on Cloud Run

> **Owner:** BE on-call
> **Trigger:** Cloud Monitoring alert
> `cloud_run.cold_start_p95_ms > 2000` for 5 min,
> or `cloud_run.instance_count` flapping above the historical ceiling.

`min-instances=1` is supposed to eliminate cold starts on the
user-facing tier (R5.6). A cold-start spike means either:
(a) traffic exceeded what 1 instance can handle and Cloud Run spun up cold ones, or
(b) the warm instance died and was replaced, or
(c) someone deployed a heavier image and boot time crossed the 2s budget.

## 1. First-minute triage

```bash
gcloud run services describe zoho-erp \
  --region me-central1 --project erp-system-494716 \
  --format='yaml(spec.template.metadata.annotations, spec.template.spec.containers[0].resources)'
```

Confirm the **active** revision has:
* `autoscaling.knative.dev/minScale: '1'` (R5.6)
* `autoscaling.knative.dev/maxScale: '20'`
* `run.googleapis.com/cpu-allocation: always-allocated` (R5.7)
* CPU ≥ `1000m`, memory ≥ `512Mi`

If any of these are wrong, jump to §3.

## 2. Boot time — what does the image actually do?

```bash
# Find the cold-start spans
gcloud logging read \
  'resource.type="cloud_run_revision"
   jsonPayload.message=~"app.boot"
   timestamp > "$(date -u -d '15 min ago' +%FT%TZ)"' \
  --format='value(jsonPayload.duration_ms, jsonPayload.phase)' \
  --limit 50
```

We log structured `app.boot.{phase}` events with timings:

* `phase=imports` — Python imports. Bloat = recent dep added (numpy, pandas, scikit). Audit `requirements.txt`.
* `phase=secret_manager` — Loading secrets. Slow = Secret Manager throttling; check IAM quotas.
* `phase=firestore_ping` — First Firestore call. Slow = network init; usually < 200ms after warm.
* `phase=router_register` — FastAPI route registration. Slow = > 200 routers being included (we are at ~ 130 today; budget 300).

If `imports` dominates (> 1s), the cold start budget is being eaten by Python startup. Mitigations:

* Lazy-import the offender (move `import` inside the function).
* Trim `requirements.txt` (e.g., `numpy` removed in P4).
* Last resort: bump `min-instances=2` for 24 hours while we investigate.

## 3. Misconfigured revision

If a recent deploy lost the cold-start mitigations:

```bash
gcloud run services update zoho-erp \
  --region me-central1 --project erp-system-494716 \
  --min-instances=1 --max-instances=20 \
  --cpu=1 --memory=512Mi \
  --cpu-throttling=no \
  --concurrency=80
```

Rolls a new revision; ETA 2-3 minutes.

## 4. Traffic exceeded 1-instance capacity

Concurrency is 80 RPS per instance. If real traffic is now > 80 sustained, the 81st request triggers a cold spin-up.

```
resource.type="cloud_run_revision"
jsonPayload.message:"new instance started"
| stats count by minute(timestamp)
```

If we are scaling routinely:

* Raise `min-instances` to 2 (or 3 during business hours via an APScheduler hook).
* Or raise `concurrency` to 100 (only after confirming we are not memory-bound).

## 5. Region-wide

Check the [GCP Status page](https://status.cloud.google.com/) for `Cloud Run me-central1`. Cold-start anomalies that affect every Cloud Run service in a region usually mean a GCP-side host turnover.

* Wait it out (typical resolution 15-30 min).
* If our error budget is being burned faster than acceptable, fail traffic over to `asia-southeast1` per `DISASTER_RECOVERY.md` §4.

## 6. Confirm green

* `cold_start_p95_ms < 1500` over 5 min.
* No new instance starts in the last 60 s (`new instance started` log shows quiet).
* Synthetic probe (`curl /api/health` from a cold geographic region) reports < 600 ms.

## 7. Post-incident

* File a `audit/incidents/YYYY-MM-DD-cold-start.md`.
* If a deploy was the cause, add a CI gate: bench `python -X importtime -c "import app.main"` in `ci-quality.yml`; fail if total > 1500 ms.
