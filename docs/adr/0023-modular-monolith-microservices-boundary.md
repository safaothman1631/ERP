# ADR 0023 — Target tech stack & microservices boundary: stay a modular monolith, extract services only for proven hotspots via DDD bounded contexts

| | |
|---|---|
| **Date** | 2026-06-03 |
| **Authors** | Safa Othman |
| **Reviewers** | Tech lead, Backend lead, DevOps lead |
| **Status** | Proposed |
| **Supersedes** | — |
| **Related** | ADR-0001 (Firestore); ADR-0016 (single GCP project); ADR-0017 (scheduler); ADR-0021 (data stores); ADR-0022 (event backbone); `backend/app/main.py` (single FastAPI app, ~2330 routes); `backend/app/api/*`, `backend/app/services/*`, `backend/app/firestore/*` |

## 1. Context

The backend is **one FastAPI application** (`backend/app/main.py`) deployed as **one Cloud Run service** on a single GCP project (ADR-0016), registering ~2330 routes across ~115 API modules and 30+ ext modules. It is a **modular monolith**: code is split by module (`api/`, `services/`, `firestore/` per domain), but it ships and scales as a unit and shares one process, one Firestore client, and one Secret Manager binding.

Two pressures invite a "should we go microservices?" decision, and it deserves an explicit answer rather than drift:

* **The reference architecture we are learning from is microservices-shaped.** The book/stack we draw patterns from assumes Kafka, Redis, Kubernetes, Vault, OpenTelemetry, and independently deployable services per bounded context. It is tempting to adopt that topology wholesale.
* **The org reality is the opposite of that topology's assumptions.** We are a **1-backend-engineer** team on a pre-/early-scale product. The monolith already gives us the thing microservices are usually adopted *for* later (clear module seams), without the distributed-systems tax.

We also have nascent pieces that *look* like service boundaries but aren't yet: the scheduler (ADR-0017, moving out-of-process per ADR-0022), the outbox/event backbone (ADR-0022), and per-domain repositories (ADR-0001's thin seam). These are the natural future extraction points — but extracting now would buy distribution cost with no scaling return.

## 2. Decision

**We stay a modular monolith. We will extract a microservice only for a *proven* scaling or isolation hotspot, and only along a DDD bounded-context seam — targeted for Phase 3, not before. We adopt the reference stack (Kafka/Redis/K8s/Vault/OTel) selectively and incrementally, as needs prove out, not as a target topology.**

* **Default = monolith.** New features are new modules in the existing app. One deployable, one Cloud Run service, ADR-0016's single project. Module boundaries are enforced *in code* (per-domain `api/`/`services/`/`firestore/`), not by network hops.
* **Define bounded contexts now, services later.** Name the DDD contexts (e.g. *Sales/Invoicing*, *Ledger/Accounting*, *Inventory*, *POS*, *Payments*, *Compliance/e-Fakhata*, *CRM*, *People/Payroll*). Keep cross-context calls going through the event backbone (ADR-0022) and thin service interfaces, so a context *could* be lifted out without a rewrite — but it stays in-process until proven otherwise.
* **Extract on evidence.** A context becomes a service only when it shows a concrete need: a scaling hotspot that hurts the rest of the app (CPU/latency contention), an isolation requirement (independent deploy cadence, blast-radius, compliance), or a fan-out workload the monolith can't host. The first realistic candidate is a **worker/scheduler service** (ADR-0022) — same image, different entrypoint — which is an extraction without a rewrite.
* **Adopt the reference stack à la carte:**
  * **OpenTelemetry** — adopt early; tracing is the prerequisite for ever splitting services and for debugging the event backbone (ADR-0022). Lowest-regret item.
  * **Redis** — adopt where it pays (read-through cache for hot endpoints, rate-limiting) — already used; not a topology change.
  * **Pub/Sub now, Kafka later** — per ADR-0022; Kafka only at proven scale.
  * **Kubernetes** — **not** adopted; Cloud Run is the right serverless fit at our size. K8s is the escape hatch if/when we run a real service mesh.
  * **Vault** — **not** adopted; GCP Secret Manager (ADR-0016/0019) covers secrets. Revisit only for multi-cloud or dynamic-secret needs.

## 3. Consequences

### Positive

* **Velocity for a 1-BE team.** One repo, one deploy, in-process calls, shared client/config. No service mesh, no inter-service auth, no distributed transactions to reason about for everyday work.
* **Correctness is easier to hold.** Money flows (ADR-0024) and the ledger stay in one process where a Firestore transaction spans the writes; we avoid premature distributed-transaction/saga complexity for flows that don't need it.
* **Future-proof seams without present cost.** DDD contexts + the event backbone mean the *option* to extract is preserved; we pay for distribution only when a hotspot justifies it.
* **Lower-regret stack adoption.** OTel + Redis + Pub/Sub deliver most of the book's value; K8s/Vault/Kafka are deferred until they earn their keep, avoiding ops we can't staff.

### Negative

* **Shared-fate deploys.** One bad change can affect all modules; one heavy in-process job can contend with requests (the ADR-0017 → ADR-0022 lesson). Mitigated by the out-of-process worker extraction and by module discipline.
* **Discipline required to keep boundaries clean.** Without network enforcement, modules can grow illicit cross-context coupling that makes a later extraction painful. Mitigated by routing cross-context interactions through events/interfaces and by code review against the bounded-context map.
* **"Why not microservices?" recurs.** New hires steeped in the reference stack will expect services; this ADR is the standing answer (extract on evidence, not on fashion).

### Neutral / known unknowns

* **Where the first real split happens** is data, not guess: most likely the scheduler/worker (already separating per ADR-0022), or whichever context first shows sustained contention (POS at peak, or compliance/e-Fakhata batch).
* **Monolith scaling headroom.** Cloud Run scales the monolith horizontally already; the blocker to >1 always-on instance is the in-process scheduler (ADR-0022 removes it), not the monolith shape.

## 4. Alternatives considered

### Alternative A — Adopt the full microservices topology now (K8s + Kafka + Vault + service-per-context)

* **Pros:** independent deploy/scale; textbook alignment with the reference stack; strong blast-radius isolation.
* **Cons:** distributed transactions, inter-service auth, a mesh, and an ops surface no 1-BE team can run; would slow every feature; correctness (money flows) gets *harder* (cross-service sagas where an in-process transaction sufficed).
* **Why rejected:** classic premature decomposition — pays the distribution tax with no scaling return at our size.

### Alternative B — "Macroservices" (split into 3–4 coarse services up front)

* **Pros:** less extreme than full microservices; some isolation.
* **Cons:** still introduces network boundaries, deploy coordination, and cross-service data access before any hotspot is proven; picks seams by guesswork.
* **Why rejected:** the modular monolith already gives the seams; coarse splitting now is cost without evidence.

### Alternative C — Stay monolith forever, no bounded-context discipline

* **Pros:** maximal short-term simplicity.
* **Cons:** boundaries rot; when a real hotspot finally appears, extraction is a rewrite, not a lift.
* **Why rejected:** the cheap insurance (name the contexts, route cross-context via events) is worth keeping the extraction option alive.

### Alternative D — Lift-and-shift to Kubernetes (keep monolith, swap Cloud Run for GKE)

* **Pros:** more control; aligns with the book's K8s assumption.
* **Cons:** GKE is an ops burden Cloud Run spares us; no benefit until we run multiple stateful services.
* **Why rejected:** Cloud Run is the correct serverless fit now; K8s is a Phase-3+ option, not a target.

## 5. Validation

We will know this is right if:

* Feature throughput stays high with a small team — no per-feature cross-service coordination tax.
* When the first extraction happens, it is a **clean lift** of an already-isolated context (the worker/scheduler is the test case: same image, `SCHEDULER_ENABLED`-style entrypoint split, no domain rewrite).
* Cross-context coupling stays low in review (interactions go through events/interfaces, not direct reach-ins) — measurable by how localized changes remain.
* We adopted OTel/Redis/Pub/Sub and got their value **without** standing up K8s/Vault/Kafka before a proven need.

**Revisit (extract a service) when** a bounded context shows sustained contention with the rest of the app, needs an independent deploy/compliance boundary, or becomes a fan-out workload the monolith can't host.

## 6. Notes

* This is the standing answer to "should this be microservices?": **modular monolith now, DDD-seamed, extract on evidence.** It depends on ADR-0022 (event backbone) for clean cross-context communication and ADR-0017→0022 (out-of-process scheduler) as the first non-rewrite extraction.
* The reference stack (Kafka/Redis/K8s/Vault/OTel) is a *menu*, not a destination — adopted item-by-item against real needs.
* Verified facts: single FastAPI app in `backend/app/main.py` (~2330 routes), one Cloud Run service (ADR-0016), per-domain code split under `api/`/`services/`/`firestore/`.

---

*Last reviewed: 2026-06-03 by Safa Othman. Next review: at the first proven scaling/isolation hotspot, or when the worker/scheduler service is extracted (ADR-0022).*
