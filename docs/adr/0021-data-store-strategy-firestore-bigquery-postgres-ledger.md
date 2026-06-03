# ADR 0021 — Data-store strategy: keep Firestore for OLTP, add BigQuery for OLAP, evaluate Postgres for the financial ledger

| | |
|---|---|
| **Date** | 2026-06-03 |
| **Authors** | Safa Othman |
| **Reviewers** | Tech lead, Backend lead, DevOps lead |
| **Status** | Proposed |
| **Supersedes** | — |
| **Related** | ADR-0001 (Stay on Firestore); ADR-0016 (single `zoho-83cda` project); ADR-0024 (Money & numeric policy); `backend/app/services/reports_v2.py`; `backend/app/services/report_streams.py`; `backend/app/services/firestore_resilience.py` (`LIST_HARD_CAP`); `backend/app/api/rum.py`; `docs/architecture/POSTGRES_TRIGGER_CRITERIA.md` |

## 1. Context

ADR-0001 committed us to **Firestore for everything**, with reporting handled "inside the Firestore model" and BigQuery named as the eventual analytics sink. A year of build-out later, the reality is narrower than that ADR's aspiration, and three forces now push for an explicit revisit:

* **Reporting is an in-memory fetch-and-fold, hard-capped at 10k docs.** The financial-statement engine (`backend/app/services/reports_v2.py`) is a set of *pure functions* over **pre-fetched** accounts + journal entries. The fetch (`report_streams.py` → `stream_org_filtered` / `collect_stream`) is bounded by `LIST_HARD_CAP = 10_000` (`firestore_resilience.py:12`). Trial Balance, P&L, Balance Sheet, and Cash Flow all iterate journal lines in Python and accumulate in floats (`reports_v2._aggregate_lines`). For a tenant past ~10k posted journal entries in a period, **the reports silently truncate** — there is no warehouse, no `GROUP BY`, no incremental aggregate.
* **There is no analytics warehouse.** The only BigQuery usage in the backend is a **RUM web-vitals sink** (`api/rum.py` — "streams into BigQuery"). No financial/operational data lands in BigQuery. ADR-0001's "BigQuery for analytics (D-009)" is unbuilt.
* **The ledger does not have ACID multi-row guarantees from the store.** Double-entry correctness is enforced in *application code* — `journal_entry_atomic.create_journal_entry_in_transaction` posts the JE and per-account balance increments inside one Firestore transaction, and `je_validation.validate_je_balance` checks debits==credits with `Decimal` and an IQD tolerance. That works, but the *database* offers no cross-row constraint, no `CHECK (debit*credit=0)`, no referential integrity between a line and its account; a bug in the writer path can persist an unbalanced or orphaned ledger row, and only a property test catches it.

These are real limits, surfaced by the same audits that produced ADR-0001 and the P0 finance review (ADR-0024). We are still pre-/early-scale (largest tenant well under the ADR-0001 trigger), so this is a **plan**, not an emergency migration.

## 2. Decision

**We will keep Firestore as the per-tenant OLTP store, ADD a BigQuery warehouse for OLAP/reporting in Phase 2, and seriously evaluate (not yet commit to) a relational store — Postgres on Cloud SQL — for the financial ledger.** Proposed because Phase-2/3 capacity, the BigQuery sink, and the ledger spike are not yet scheduled.

* **OLTP stays on Firestore.** All transactional writes (invoices, payments, POS, CRM, inventory) keep the existing repository + atomic-transaction pattern. ADR-0001's keep-Firestore rationale (real-time listeners, offline POS, rules-as-defence, auto-scale) still holds for the write path.
* **Phase 2 — BigQuery for OLAP.** Stand up a `reporting` dataset. Feed it from the **transactional outbox / event backbone** (ADR-0022) or a scheduled Firestore→BQ export, not a second write path. Move heavy aggregation (multi-period P&L, consolidated balance sheet, cross-entity reporting, anything that would exceed `LIST_HARD_CAP`) to SQL against BigQuery. `reports_v2.py` stays for small/live tenants; BQ-backed reports take over above a doc threshold. Removes the silent 10k truncation.
* **Phase 3 (evaluate) — Postgres for the financial ledger.** Spike a relational ledger (`accounts`, `journal_entries`, `journal_lines`) with DB-enforced ACID: a single transaction posting balanced lines, `NUMERIC(18,2)` money columns (ADR-0024), FK from line→account, and a balance constraint. Decide go/no-go against the trade-offs in §3. If go, the ledger is the **only** subsystem to leave Firestore; everything else stays.

## 3. Consequences

### Positive

* **Reporting stops truncating.** BigQuery aggregates the whole ledger in SQL — no `LIST_HARD_CAP`, no Python fold, no float accumulation in the report path.
* **The ledger could gain real integrity.** A relational store turns "balanced & non-orphaned" from a code invariant + property test into a **database constraint** — the strongest place to enforce money correctness (complements ADR-0024).
* **Right tool per workload.** Firestore keeps the real-time/offline write path it is good at; OLAP goes where `GROUP BY`/joins are cheap; the ledger (if migrated) gets ACID where correctness matters most.
* **Clean seam.** The thin repository pattern ADR-0001 preserved (`backend/app/firestore/*`) is exactly the boundary a ledger extraction would cut at.

### Negative

* **Two-to-three stores to operate and reconcile.** BigQuery adds an ingestion pipeline (freshness, schema drift, cost) — the "hybrid" cost ADR-0001 explicitly rejected, re-accepted now because the 10k cap is a concrete ceiling, not a hypothetical.
* **A Postgres ledger is the expensive option.** It re-introduces a relational schema, migrations, connection-pool sizing, multi-tenant isolation (RLS or schema-per-tenant), and a DBA-shaped responsibility on a 1-BE team — the exact migration cost ADR-0001 priced out. It also splits the source of truth: the sub-ledgers (invoices/payments) stay in Firestore while the GL moves to Postgres, so the Firestore↔Postgres reconciliation that ADR-0024 already worries about becomes a cross-database concern.
* **Dual-write / sync risk.** Any ledger migration needs the outbox/event backbone (ADR-0022) to keep Firestore sub-ledgers and the Postgres GL consistent; doing it with naive dual-writes would be a correctness regression.

### Neutral / known unknowns

* **Trigger for the Postgres decision.** Reuse the inversion in `POSTGRES_TRIGGER_CRITERIA.md`: migrate the ledger only when reporting/correctness pain is demonstrable (e.g. a tenant routinely exceeds the 10k journal-line cap in a period, or an audit/regulator requires DB-enforced ledger integrity). Until then, BigQuery alone may remove enough pain that the ledger stays on Firestore.
* **BigQuery freshness.** Reports become near-real-time, not real-time. Acceptable for financial statements (period-based); the live POS/dashboards stay on Firestore listeners.

## 4. Alternatives considered

### Alternative A — Do nothing (stay 100% Firestore, keep `reports_v2` + 10k cap)

* **Pros:** zero new infra; ADR-0001 unchanged.
* **Cons:** silent report truncation past 10k journal entries/period; reporting correctness degrades exactly as a tenant grows; ledger integrity stays code-only.
* **Why rejected:** the 10k cap is a real, already-shipped ceiling on financial reporting — not acceptable for an accounting product.

### Alternative B — Raise `LIST_HARD_CAP` and keep folding in Python

* **Pros:** one-line change.
* **Cons:** moves the cliff, doesn't remove it; large in-memory folds risk Cloud Run OOM and request-latency spikes; still float accumulation (ADR-0024); doesn't help joins/consolidation.
* **Why rejected:** treats the symptom; OLAP belongs in a warehouse.

### Alternative C — Firestore materialised aggregates (precomputed period rollups via the scheduler)

* **Pros:** stays on Firestore; ADR-0001's stated mitigation.
* **Cons:** every report shape needs its own maintained rollup + backfill; ad-hoc/auditor queries (arbitrary date ranges, drill-down) aren't covered; rollup drift is its own correctness risk.
* **Why rejected as the *whole* answer:** fine for a few hot dashboards, but a poor substitute for ad-hoc SQL — BigQuery covers the long tail. May still be used for a handful of live KPIs.

### Alternative D — Full migration to Postgres (everything, per ADR-0001 Alt-A)

* **Pros:** one store, SQL everywhere, RLS.
* **Cons:** loses real-time listeners + offline POS (ADR-0001's core reasons); months-long rewrite; highest risk.
* **Why rejected:** ADR-0001's verdict stands for OLTP. We migrate *at most* the ledger, never the real-time write path.

## 5. Validation

We will know this is right if:

* **Phase 2:** a tenant with >10k journal entries in a period gets a **complete** P&L/Balance Sheet from the BigQuery path (the `reports_v2` path would have truncated). Report numbers reconcile to the JE source.
* **Phase 2:** BigQuery ingestion freshness and cost stay within budget; no second transactional write path was introduced (ingestion is outbox/export-driven).
* **Phase 3 spike:** a Postgres-ledger prototype posts a balanced entry atomically and **rejects** an unbalanced/orphaned one *at the database* (constraint fires), proving the integrity win before any production migration.
* Go/no-go on the Postgres ledger is recorded as a follow-up ADR that supersedes this section.

## 6. Notes

* This ADR refines, not contradicts, ADR-0001: OLTP-on-Firestore stays; the new content is "OLAP→BigQuery" and "evaluate Postgres for the ledger only."
* Verified facts: `firestore_resilience.LIST_HARD_CAP = 10_000`; `reports_v2._aggregate_lines` accumulates `float`; BigQuery used only by `api/rum.py`; ledger atomicity/balance enforced in `journal_entry_atomic.py` + `je_validation.py`, not by the store.
* Money columns in any relational ledger must follow ADR-0024 (`NUMERIC`/`Decimal`, ROUND_HALF_UP, 2dp) — never float.

---

*Last reviewed: 2026-06-03 by Safa Othman. Next review: when Phase-2 reporting capacity is scheduled, or a tenant first exceeds the 10k journal-entry/period cap in production.*
