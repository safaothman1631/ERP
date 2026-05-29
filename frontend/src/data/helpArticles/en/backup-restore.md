# Backup and restore

Zoho Kurdish backs up your data automatically every day. On top of that, you can export your data on demand and request a restore.

## Daily auto-backup

Every night your data is snapshotted to a separate region. Daily snapshots are retained 30 days, weekly snapshots 90 days, monthly snapshots 1 year.

## On-demand export

**Settings → Data → Export**. Pick:

* What to export — invoices, contacts, items, all data.
* Format — CSV or JSON.
* Period — all time, this fiscal year, custom.

A signed download URL is emailed when the export is ready (usually < 5 minutes).

## Request a restore

**Settings → Data → Restore**. Pick a snapshot date. A confirmation phrase is required. The restore runs into a temporary tenant first so you can verify before swapping.

A full restore for a normal tenant takes 30–60 minutes. We coordinate the cut-over with you so no data is lost.

## Common issues

* **Export is huge** — large tenants can chunk by year.
* **Restore won't run** — the source snapshot may be a different schema version. Contact support for a guided migration.

## Related

* Audit log
