# When to consider PostgreSQL (trigger criteria)

Stay on Firestore while:

- Per-org documents per collection remain mostly under 10k (or cursor queries are deployed)
- Reconcile drift rate stays under 1% weekly after integrity + performance waves
- Reporting needs are served by denormalized fields + export jobs

Evaluate PostgreSQL read replica or migration when:

- Any single collection exceeds **50k** active docs per org with sub-second list SLA
- Complex ad-hoc joins exceed maintenance cost of denormalized copies
- Multi-warehouse inventory requires transactional constraints across many rows per request

Until then: **Firestore + atomic services + reconcile cron** is the approved architecture.
