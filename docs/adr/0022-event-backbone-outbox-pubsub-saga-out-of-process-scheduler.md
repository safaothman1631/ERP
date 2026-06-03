# ADR 0022 — Event backbone: transactional outbox + Pub/Sub, a domain-event bus + sagas, and an out-of-process scheduler

| | |
|---|---|
| **Date** | 2026-06-03 |
| **Authors** | Safa Othman |
| **Reviewers** | Backend lead, DevOps lead, Tech lead |
| **Status** | Proposed |
| **Supersedes** | revisits ADR-0017 (in-process APScheduler) — see §6 |
| **Related** | ADR-0017 (in-process APScheduler); ADR-0001 / ADR-0021 (Firestore + warehouse); `backend/app/firestore/outbox.py`; `backend/app/services/outbox_dispatcher.py`; `backend/app/services/scheduler.py`; `backend/app/api/jobs.py` (`SCHEDULER_ENABLED`) |

## 1. Context

The system is a modular monolith on Cloud Run + Firestore. Cross-aggregate side effects (e-invoice dispatch, reporting rollups, notifications, payments reconciliation, e-Fakhata submission) are currently handled two ways, both with gaps:

* **A transactional outbox exists, but it is barely a backbone.** `backend/app/firestore/outbox.py` + `services/outbox_dispatcher.py` implement the right pattern (write an event row, drain it later). But `dispatch_pending` has effectively **one handler** — `_handle_event` matches `"einvoice_dispatch"` and logs `outbox_no_handler` for everything else. There is **no message broker**, **no publish to Pub/Sub or Kafka**, and **no internal domain-event bus** that other modules subscribe to. It is an outbox with a single hard-coded consumer, drained in-process.
* **Multi-step workflows have no saga / compensation.** Flows like confirm-invoice → post-GL → submit-e-invoice (or payment → reconcile → notify) are stitched together with direct calls and best-effort `try/except`. There is no orchestration that can compensate a half-completed sequence — exactly the asymmetry the P0 finance review flagged (e.g. invoice confirmed but GL not posted).
* **The scheduler is in-process, and that has bitten us in prod.** ADR-0017 accepted `apscheduler.AsyncIOScheduler` started in the FastAPI `lifespan` on the single `min-instances=1` instance. In practice the in-process scheduler can contend with the request event loop / CPU on that one instance, contributing to request timeouts (**504s**) under load — which is why a `SCHEDULER_ENABLED` env gate exists (`scheduler.py:30`, `api/jobs.py:72` reports "Scheduler is not running (disabled or not started)") and can be / has been turned **off in production**. With it off, the outbox is **not drained** and time-based jobs **do not run** — a correctness hole, not just a perf knob.

So the backbone is half-built: a real outbox table, but no broker, no fan-out bus, no saga, and a scheduler whose in-process design forces an unhappy choice between "jobs run but risk 504s" and "no 504s but jobs don't run."

## 2. Decision

**We will build a proper event backbone: keep the transactional outbox, publish from it to Pub/Sub (Kafka if/when scale demands), add an internal domain-event bus with explicit subscribers, introduce sagas for multi-step workflows, and move the scheduler out-of-process to a Cloud Run Job.** Proposed because it is multi-phase infra work, not yet scheduled.

1. **Outbox (keep, harden).** Continue writing the event row **in the same Firestore transaction** as the state change (we already do this for invoices/payments via `journal_entry_atomic`). The outbox is the durable, exactly-recorded source of events.
2. **Publish to Pub/Sub.** A dispatcher reads the outbox and **publishes to Pub/Sub topics** (per event type / bounded context). Pub/Sub gives at-least-once delivery, retries, dead-letter topics, and decouples producers from consumers. **Kafka** is the upgrade path only if we hit Pub/Sub limits (ordering-per-key at high throughput, log replay needs) — not day one.
3. **Internal domain-event bus.** Define explicit domain events (`InvoiceConfirmed`, `PaymentReceived`, `StockMoved`, …) and a registry of subscribers, so adding a side effect is "subscribe to the event," not "edit the producer." In-process subscribers for low-latency reactions; Pub/Sub subscribers (push to an authenticated `/internal/events/{type}` endpoint or a worker) for durable/cross-instance ones.
4. **Sagas for multi-step flows.** Model confirm→GL→e-invoice (and similar) as a saga with explicit steps and **compensating actions** (e.g. reverse the GL entry if e-invoice submission is rejected), replacing best-effort `try/except` chains. This is the durable-workflow layer the P0 review implies is missing.
5. **Out-of-process scheduler (Cloud Run Job).** Move cron/drain triggers off the web instance: **Cloud Scheduler → Cloud Run Job** (or an authenticated internal endpoint) that runs the drains and time-based jobs. The web service no longer hosts APScheduler, so a heavy job can never starve request handlers — directly removing the 504 cause and letting us stop relying on `SCHEDULER_ENABLED=off` in prod.

## 3. Consequences

### Positive

* **Jobs run without risking request latency.** Out-of-process execution removes the in-process contention behind the 504s (ADR-0017 §3 negative); we no longer trade "jobs run" against "API stays fast."
* **Side effects become decoupled and durable.** Pub/Sub gives retries + dead-letter; the domain-event bus makes new reactions additive (no producer edits); the outbox guarantees no event is lost on a crash between commit and publish.
* **Multi-step money flows become recoverable.** Sagas + compensation turn "best-effort `try/except`, hope it finished" into an explicit, observable, compensatable workflow — the right home for confirm→GL→e-invoice.
* **Horizontal scale unblocks.** Once the scheduler is out-of-process, the web service can run >1 always-on instance without the double-run risk ADR-0017 §3 listed as the trigger to migrate.

### Negative

* **Real infra footprint** — exactly the cost ADR-0017 deferred: Pub/Sub topics/subscriptions/DLQs to provision and secure, OIDC-authed worker/endpoint, a Cloud Run Job + Cloud Scheduler trigger, IAM bindings. More moving parts for a small team.
* **At-least-once means consumers must be idempotent.** Every subscriber needs dedup (we already use deterministic `uuid5` entry-ids on the GL side; this pattern must be standard). Sagas add state to persist and reason about.
* **More end-to-end complexity to debug.** A failure can now live in the outbox, the publish, a subscriber, or a saga step — needs tracing (OTel) and per-stage observability to stay diagnosable.

### Neutral / known unknowns

* **Ordering.** Pub/Sub ordering keys cover per-aggregate ordering; if a flow needs strict global ordering or replay, that is the Kafka trigger.
* **Migration of existing jobs.** The ~20 scheduler jobs move one-by-one to the Cloud Run Job; the outbox `_handle_event` single handler becomes the first registered domain-event subscriber.

## 4. Alternatives considered

### Alternative A — Keep ADR-0017 as-is (in-process APScheduler, single-handler outbox)

* **Pros:** zero new infra; status quo.
* **Cons:** the prod 504 problem forces `SCHEDULER_ENABLED=off`, which silently stops the outbox drain and all cron jobs — a correctness hole; no fan-out, no saga.
* **Why rejected:** "turn the scheduler off to keep the API up" is not a tenable steady state for a system that owes e-invoice submission, dunning, and reconciliation to cron.

### Alternative B — Cloud Scheduler + Cloud Tasks → worker endpoints (no Pub/Sub bus)

* **Pros:** managed, durable scheduling; ADR-0017's documented upgrade path; simpler than a full bus.
* **Cons:** Cloud Tasks is point-to-point — it solves *scheduling* but not *fan-out*; adding a second consumer to an event still means editing the producer. No native pub/sub semantics or DLQ-per-topic.
* **Why rejected as the whole answer:** it fixes the scheduler half (and we adopt its Cloud Run Job variant), but not the "decoupled domain events + saga" half.

### Alternative C — Kafka from day one

* **Pros:** log replay, strong ordering, mature ecosystem.
* **Cons:** a stateful broker to run/secure/pay for — the heavy infra ADR-0001/0017 keep us away from; overkill at current volume.
* **Why rejected (for now):** Pub/Sub covers our needs at far lower ops cost; Kafka is the documented escalation, not the start.

### Alternative D — Celery/RQ + Redis broker

* **Pros:** mature task framework with retries/scheduling.
* **Cons:** a broker + worker fleet — same stateful-infra objection as ADR-0017 Alt-C; doesn't give a domain-event bus or saga out of the box.
* **Why rejected:** Pub/Sub + a thin saga layer is lighter and more GCP-native.

## 5. Validation

We will know this is right if:

* With the scheduler **out-of-process**, prod 504s attributable to job/event-loop contention go to zero, **and** we no longer run with `SCHEDULER_ENABLED=off` — i.e. jobs run *and* the API stays fast.
* The outbox publishes every committed event exactly once *recorded*, at-least-once *delivered*, with a measurable dead-letter rate near zero; no event is lost across a deploy/crash.
* Adding a new side effect (e.g. "notify on payment received") is done by **subscribing**, with **zero** edits to the payment producer.
* A deliberately failed e-invoice submission triggers the saga's **compensating** GL reversal automatically (provable in a test), instead of leaving a half-completed flow.

**Revisit toward Kafka** only if Pub/Sub ordering/replay limits bite at scale.

## 6. Notes

* This ADR **revisits ADR-0017's scheduler decision**: ADR-0017 was right for its constraints (1 warm instance, ~20 idempotent crons), but the in-process design's negative (jobs contend with requests → 504s → `SCHEDULER_ENABLED=off`) has now materialised in prod. When the Cloud Run Job lands, supersede ADR-0017 with a short follow-up ADR recording the cutover.
* Verified facts: outbox exists (`firestore/outbox.py`, `services/outbox_dispatcher.py`) with a single `_handle_event` matching `"einvoice_dispatch"` and logging `outbox_no_handler` otherwise; no Pub/Sub/Kafka in the backend; scheduler is in-process APScheduler gated by `SCHEDULER_ENABLED`.
* Consumers must be idempotent (reuse the deterministic-`uuid5` pattern already used for GL entry ids — see ADR-0024 / the P0 finance guide).

---

*Last reviewed: 2026-06-03 by Safa Othman. Next review: when the out-of-process scheduler (Cloud Run Job) is scheduled, or the next prod 504 incident traced to in-process jobs.*
