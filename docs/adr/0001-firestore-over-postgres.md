# ADR 0001 — Stay on Firestore (do not migrate to Postgres + Hasura)

| | |
|---|---|
| **Date** | 2026-05-27 |
| **Authors** | Safa Othman |
| **Reviewers** | Tech lead, DevOps lead |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | design.md §11 (D-001); requirements.md §5; `docs/architecture/POSTGRES_TRIGGER_CRITERIA.md` |

## 1. Context

The Zoho Kurdish ERP runs on Firestore. The audit that produced the
`world-class-performance` spec asked the question explicitly: do we
need to migrate the persistence layer to a relational database
(Postgres) with a GraphQL gateway (Hasura) to hit the SLOs in
requirements.md §5?

We are at:

* ~ 115 FastAPI endpoint modules — most of which read 1–5 collections.
* 30+ ext modules in `pages/modules/moduleConfigs.ts`.
* Largest tenant today: ~ 80k documents; design ceiling: 500k docs / tenant.
* Customer base is Iraqi SMBs running on intermittent 3G/4G — real-time updates over a robust client SDK are highly valuable.
* The team is 4 engineers (3 FE + 1 BE).

A migration would mean rewriting every repository (`backend/app/firestore/*.py`),
every Firestore rule (`firestore.rules`), and every client subscription
(`useFirestoreLive`). It would also re-introduce a primary-key / FK
schema layer we have so far avoided.

## 2. Decision

**We will stay on Firestore.** All performance and reliability work
described in `world-class-performance` is to be achieved *inside* the
Firestore model:

* Composite indexes audited quarterly (R5.2).
* Query discipline enforced by a lint rule + per-route stats.
* Reads cached in Redis for the top-20 endpoints (R5.1).
* Backups via nightly GCS export + 7-day PITR (R5.9, DR runbook §6).
* Async-safe access on all routes (R5.4).

The trigger conditions for revisiting this decision are documented in
`docs/architecture/POSTGRES_TRIGGER_CRITERIA.md`. Stated as an
inversion: we will only migrate if **two or more** of the following
hold for three consecutive months:

1. A single tenant exceeds 5 M documents and queries blow past p95 budgets even with sharding.
2. Reporting queries require joins of cardinality > 100k × 100k that we cannot satisfy with read-side materialised views.
3. Firestore pricing per tenant exceeds 20% of that tenant's plan price.

## 3. Consequences

### Positive

* No 6-month migration cost; engineering capacity stays on user-visible features.
* Real-time listeners stay first-class for POS multi-device sync and KDS.
* Offline POS keeps using the official Firestore JS SDK's offline persistence as a fallback layer below our own IndexedDB queue.
* Firestore rules give us a *defence in depth* layer that Postgres+Hasura would require us to recreate.
* Per-tenant scaling is automatic (no shard rebalance ops cost).

### Negative

* Reporting (P&L, balance sheet, aggregations across the tenant) is hard. We mitigate with **materialised views** computed by APScheduler jobs (`backend/app/services/reporting.py`) and BigQuery for analytics (D-009).
* Some queries we'd write trivially in SQL require a composite index in Firestore — we have a quarterly review (R5.2) to catch these.
* Vendor lock-in to Google. Mitigated by keeping our repository pattern thin — a future migration would have a clear seam at `backend/app/firestore/*`.

### Neutral / known unknowns

* Hot-tenant fan-out: if a single tenant exceeds the ~ 10k writes/s soft limit, Firestore expects us to shard documents. We have not hit this. The plan is documented under "tenant sharding" in `OPERATIONS_RUNBOOK.md`.

## 4. Alternatives considered

### Alternative A — Postgres (Cloud SQL) + Hasura

* **Pros:** Familiar SQL; ad-hoc reporting via BI tools; mature indexing & explain-plan tooling; row-level security via RLS.
* **Cons:** Months-long migration; we lose real-time listeners; we'd need to build a websocket layer or use Hasura subscriptions (extra hop); harder offline story; multi-tenant requires careful RLS + connection pool sizing; would require a DBA seat.
* **Why rejected:** Migration cost outweighs the marginal improvement; the SLOs in §5 are achievable on Firestore with discipline.

### Alternative B — Spanner (Google Cloud Spanner)

* **Pros:** Strong transactional consistency at scale; SQL surface; managed.
* **Cons:** Costs ~ 10× Firestore at our shape; overkill for our largest tenants; no real-time listener equivalent for the client.
* **Why rejected:** Cost; we are nowhere near the scale where Spanner pays off.

### Alternative C — MongoDB Atlas

* **Pros:** Familiar document model; mature aggregation pipeline; multi-region replication.
* **Cons:** No first-class real-time listener with offline persistence baked into the official client; we'd be operating MongoDB ourselves (or paying Atlas a premium); no integrated security-rule story (would need our own middleware).
* **Why rejected:** No clear win vs Firestore at our shape; introduces ops cost.

### Alternative D — Hybrid (Firestore for hot writes; Postgres for reporting)

* **Pros:** Best of both for reporting.
* **Cons:** Two systems to operate, two sets of rules to keep in sync; reporting still needs a CDC pipeline.
* **Why rejected:** We can get the same reporting outcome with BigQuery sinks (D-009) without operating two transactional stores.

## 5. Validation

We will know we made the right call if:

* End-of-P4: SLOs in requirements.md §5 are green at p95 for 7 consecutive days.
* End-of-P6: top 20 tenants are within budget (no tenant exceeds the trigger conditions in §2 above).
* CW6 / Sprint 26: customer NPS comment volume mentioning "slow" is below 5 / 1000 customers.

Reviewed at every quarterly architecture sync; demoted to "Deprecated" if any two trigger conditions hold for 3 months.

## 6. Notes

* The `docs/architecture/POSTGRES_TRIGGER_CRITERIA.md` document is the load-bearing companion: it removes future ambiguity about when we *would* migrate.
* See also: design.md §3.7 (Firestore indexes & query discipline), §1.5 (Firestore live subscriptions), §3.2 (caching facade).

---

*Last reviewed: 2026-05-27 by Safa Othman. Next review: 2026-08-27.*
