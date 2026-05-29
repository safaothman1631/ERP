# ADR 0017 — In-process APScheduler for background jobs (not Cloud Tasks / Cloud Scheduler)

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Backend lead, DevOps lead |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | `backend/app/services/scheduler.py`; `backend/app/main.py` (`lifespan`); `backend/app/firestore/job_runs.py`; `docs/handbook/engineering-handbook.md` §11; ADR-0001 (Firestore); `terraform/monitoring/main.tf` (scheduler health metrics) |

## 1. Context

The product has ~20 recurring background jobs: subscription renewal, scheduled
reports, dunning, recurring invoices, payment reminders, monthly depreciation,
daily backup, GDPR hard-delete after grace, e-invoice + e-Fakhata dispatch, CBI
exchange-rate refresh, payments reconciliation, audit/soft-delete retention,
org-counter refresh, outbox dispatch, status-page emit, onboarding drip, and an
observability heartbeat. They are defined in `backend/app/services/scheduler.py`
and started from the FastAPI `lifespan` context manager in `main.py`.

Most jobs follow the same shape: stream `db.collection("organizations")`,
instantiate a per-`org_id` repository, do work, and record a run in `job_runs`
via `JobRunRepository("__system__")`.

On GCP, the textbook alternative is to push this to managed infrastructure:
**Cloud Scheduler** (cron) firing **Cloud Tasks** or Pub/Sub messages into
dedicated worker endpoints/services. That's the "correct at scale" pattern and
deserves an explicit decision rather than a default.

Constraints that shape the choice:

* Small team (3 FE + 1 BE). Every piece of infra is something *someone* has to
  operate, monitor, and pay for.
* The backend already runs on Cloud Run with **`min-instances=1`** and
  CPU-always-on (cold-start budget, handbook §3) — i.e. there is always exactly
  one warm instance that can host a scheduler.
* Jobs are **low-frequency and idempotent-ish**: hourly/daily crons and a few
  short-interval drains. None are high-throughput fan-out.
* We are deliberately on Firestore (ADR-0001) and avoid adding stateful infra we
  don't strictly need.

## 2. Decision

**We run jobs in-process with `apscheduler.AsyncIOScheduler`, started in the
FastAPI `lifespan` on the single always-warm Cloud Run instance. We do not use
Cloud Scheduler + Cloud Tasks.**

Key properties of the implementation:

* **Single-runner assumption.** The scheduler runs on the one
  `min-instances=1` instance. Jobs are written to tolerate being skipped or
  re-run (they record to `job_runs` and use `coalesce=True` / `max_instances=1`
  on the short-interval drains).
* **Opt-out switch.** `SCHEDULER_ENABLED` (env) lets us disable the scheduler
  entirely — used in tests and when we want a "web-only" instance.
* **Per-run audit.** Every cross-org job writes a `job_runs` row
  (`items_processed`, `items_failed`, `errors`, `status`) so `GET /api/jobs`
  shows history and on-call can see what ran.
* **Failure observability.** An `EVENT_JOB_ERROR` listener emits a structured
  failure line, and a 5-minute **heartbeat job** lets monitoring detect a dead
  scheduler by *absence* (the Terraform `scheduler_heartbeat` /
  `scheduler_job_failed` log-based metrics in `terraform/monitoring/main.tf`,
  alert "scheduler down").
* **Best-effort startup.** `start_scheduler(app)` is called inside a
  `try/except` in `lifespan`; a scheduler failure logs a warning and does not
  stop the API from serving requests.

## 3. Consequences

### Positive

* **Zero extra infrastructure.** No Cloud Scheduler jobs, no Cloud Tasks queues,
  no separate worker service, no Pub/Sub topics to provision, secure, and pay
  for.
* Jobs share the app's code, config, Firestore client, and Secret Manager
  access directly — no RPC boundary, no duplicate bootstrapping.
* Local/dev parity: the same scheduler runs locally; `SCHEDULER_ENABLED=false`
  turns it off cleanly for tests.
* Adding a job is a few lines in one file (`scheduler.py`) — the handbook's
  "background work" entry point.

### Negative

* **Single point of execution.** If the warm instance is unhealthy at fire
  time, a tick can be missed. Mitigated by idempotent jobs, `job_runs` history,
  and the absence-of-heartbeat alert. This is acceptable for hourly/daily work;
  it would **not** be acceptable for high-frequency or strictly-exactly-once
  jobs.
* **No horizontal scale-out of jobs.** If the backend ever scales to multiple
  always-on instances, we'd risk double-runs. Today `min-instances=1` and the
  scheduler conceptually belongs to that one instance; scaling out is the
  trigger to revisit (see §5).
* Long-running jobs occupy the web instance's event loop / CPU; a heavy job can
  add latency to requests on that instance. Jobs are kept short or chunked for
  this reason.

### Neutral / known unknowns

* If we later split a dedicated "scheduler instance" from the web instances
  (same image, `SCHEDULER_ENABLED` only on one), we get isolation without
  changing the job code — a cheap escape hatch short of Cloud Tasks.

## 4. Alternatives considered

### Alternative A — Cloud Scheduler + Cloud Tasks → worker endpoints

* **Pros:** managed, durable, retried-by-the-platform, horizontally scalable;
  exactly the right answer for high-volume fan-out; survives instance churn.
* **Cons:** a real infra footprint to provision and secure (queues, OIDC-authed
  task endpoints, IAM); each job becomes an HTTP endpoint with its own auth;
  more moving parts for a 1-BE team; over-engineered for hourly crons.
* **Why rejected (for now):** cost/complexity vastly exceeds the need at our job
  volume and team size. It's the documented upgrade path, not today's tool.

### Alternative B — Cloud Scheduler → single `/internal/cron/{job}` endpoint

* **Pros:** durable cron from a managed service; still in-process workers;
  no Tasks queue.
* **Cons:** still requires provisioning + securing N scheduler jobs and an
  authenticated internal endpoint; duplicates the trigger definitions outside
  the codebase (drift risk); buys little over APScheduler given we already have
  a warm instance.
* **Why rejected:** marginal durability gain, real config-drift cost.

### Alternative C — Celery / RQ with a broker (Redis/RabbitMQ)

* **Pros:** mature task framework; retries, scheduling, workers.
* **Cons:** requires a broker and worker processes — exactly the stateful infra
  ADR-0001 keeps us away from; heavy for ~20 crons.
* **Why rejected:** infra weight unjustified at our scale.

## 5. Validation

We will know we made the right call if:

* The scheduler heartbeat metric is present every interval; the "scheduler
  down" alert never fires except during a real incident.
* `GET /api/jobs` shows expected run cadence and the `job_runs` failure rate is
  low; no job silently stops running unnoticed.
* No duplicate-execution bug appears (which would indicate we've quietly scaled
  past one always-on instance — the trigger to migrate).
* Cold-start/boot stays within budget despite the scheduler starting in
  `lifespan`.

**Revisit (migrate toward Alternative A) if any holds:** we need multiple
always-on web instances (double-run risk), a job needs sub-minute reliable
scheduling, a job becomes high-throughput fan-out, or a single job's runtime
starts hurting request latency on the web instance.

## 6. Notes

* Job count and the cross-tenant loop pattern are documented in handbook §11.
  The scheduler logs "Scheduler started with N jobs" at boot.
* The short-interval drains (outbox 1m, e-Fakhata 30s, status emit 60s) set
  `coalesce=True, max_instances=1` so a slow tick can't stack instances.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: when the backend is configured for >1 always-on instance, or a sub-minute/exactly-once job appears.*
