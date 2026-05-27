# DR Drill — 2026 Q3

> **Spec ref:** requirements.md §10.6 (R10.6), tasks.md T-6.8
> **Drill date (planned):** 2026-07-15 (Wednesday — low-traffic mid-week slot)
> **Operator (planned):** TBD (DevOps lead)
> **Observer (IC):** Tech lead
> **Scribe:** TBD
>
> Template — fill in during/after the drill. One file per drill, named `YYYY-Qn-drill.md`. Commit to the repo on drill day.

## 1. Scope

Which playbooks from `DISASTER_RECOVERY.md` §4 are being exercised this drill?

| Playbook | In scope this quarter? |
|---|---|
| §4.1 — Cloud Run bad deploy rollback | [ ] |
| §4.2 — Cloud Run region failover | [ ] |
| §4.3 — Firestore PITR restore | [ ] |
| §4.4 — Firestore GCS restore | [ ] |
| §4.5 — Vercel rollback | [ ] |
| §4.6 — Vercel region outage | [ ] |
| §4.7 — Redis outage | [ ] |
| §4.8 — DNS failover | [ ] |
| §4.9 — Secret rotation under compromise | [ ] |

Default for the Q3 drill: **§4.2 + §4.3 + §4.9** (the three highest-impact paths). Rotate scope each quarter so all paths are exercised within 12 months.

## 2. Pre-flight checklist

* [ ] Drill window scheduled in the shared ops calendar.
* [ ] On-call rotation notified that this is a planned drill (so they do not page upstream).
* [ ] Deploy freeze active during the window: `gh workflow disable deploy-cloudrun.yml`.
* [ ] Staging is healthy (run `curl -sf https://staging-api.erp.zoho.kurd.iq/api/health`).
* [ ] Backup integrity confirmed by the latest run of `.github/workflows/backup-verify.yml`.
* [ ] Test tenant `dr-drill-2026-Q3` provisioned with seed data.
* [ ] Notifications muted in `#alerts` for the drill duration.
* [ ] All operators have working `gcloud`, `vercel`, and `firebase` CLIs.

## 3. Scenario script

The IC reads aloud at the start:

> "It is 10:00 UTC. At 09:55, customers in Iraq began reporting that
> the app refuses to log in. Sentry shows a flood of 503 errors from
> `me-central1`. The Google Cloud Status page shows a major incident
> on Cloud Run me-central1. SEV-1 declared. The drill begins now."

## 4. Execution — timing log

| Step | Owner | Started (UTC) | Completed (UTC) | Elapsed | Notes |
|---|---|---|---|---|---|
| Page on-call | IC | | | | |
| Bridge convened | IC | | | | |
| Severity classified | IC | | | | |
| Failover to asia-southeast1 (§4.2) | Operator | | | | |
| DNS CNAME updated | Operator | | | | |
| Health probe from 3 regions | Operator | | | | |
| Customer comms drafted | Comms | | | | |
| Customer comms sent | Comms | | | | |
| All-clear declared | IC | | | | |
| Rollback to me-central1 (post-drill) | Operator | | | | |

**Total time from declaration to all-clear:** `<HH:MM:SS>` (RTO target: 60 min).

## 5. Verifications

* [ ] `curl /api/health` returns 200 from a probe in Erbil (or proxied equivalent).
* [ ] A test tenant can log in and create a draft invoice.
* [ ] POS smoke: open a cart, add an item, settle a cash sale.
* [ ] Firestore writes from the failover region appear in the (default) database after region restoration (i.e., no data orphaned in the standby region).
* [ ] Sentry shows error rate below 0.5% in the 5 minutes after all-clear.

## 6. Findings

### What went well

* ...

### What went poorly

* ...

### Surprises

* ...

## 7. Follow-ups

| # | Item | Owner | Priority | Issue |
|---|---|---|---|---|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |

## 8. Decision

* **Did we meet the RTO?** YES / NO
* **Did we meet the RPO (zero data loss in the test tenant)?** YES / NO
* **Drill outcome:** PASS / RED

If RED, file an incident-style postmortem in `audit/incidents/postmortems/2026-Q3-dr-drill-postmortem.md` and treat the follow-ups as P0 until closed.

## 9. Sign-off

* IC: ____________ (date: _______)
* DevOps: ____________ (date: _______)
* Tech lead: ____________ (date: _______)
