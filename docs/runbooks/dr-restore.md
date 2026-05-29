# Runbook — Disaster Recovery Restore (Firestore)

> **Spec reference:** SF3 tasks T-SF.3.2–T-SF.3.9, T-SF.3.11
> **Parent runbook:** [`DISASTER_RECOVERY.md`](../../DISASTER_RECOVERY.md) §4.3, §4.4, §6
> **Owner:** Platform / on-call SRE
> **Tooling:** `scripts/dr/restore-full.sh`, `scripts/dr/restore-tenant.sh`,
> `scripts/dr/provision-dr.sh`, super-admin console at `/platform/dr-restore`
> **Last rehearsed:** _TBD — log drills in `DISASTER_RECOVERY.md` §10_

## Why this runbook exists

`DISASTER_RECOVERY.md` is the incident-level playbook (severities, comms, the
full failure-class matrix). This runbook is the **operator-level, step-by-step
procedure** for the specific act of *restoring Firestore data* — the part that
is fiddly, irreversible if done wrong, and must not be improvised at 3am.

There are three restore paths, in increasing blast radius and decreasing
preference:

| Path | Tool | Use when | Blast radius |
|---|---|---|---|
| **PITR** (preferred) | `gcloud firestore databases restore` | Data loss within the last 7 days | New DB; live untouched |
| **Per-tenant** | `scripts/dr/restore-tenant.sh` | One org corrupted; PITR too coarse or expired | One org_id |
| **Full GCS restore** | `scripts/dr/restore-full.sh` | Catastrophic loss; PITR window blown | Entire DB (into a new DB) |

> **Golden rule:** none of these scripts ever writes to the live `(default)`
> database except `restore-tenant.sh --apply`, and that one is org-scoped and
> guarded. Restores always stage into a *fresh* database first.

---

## 0. Pre-flight (every restore)

1. Declare the incident per `DISASTER_RECOVERY.md` §3 and get the **Incident
   Commander's go-ahead**. A restore is a go/no-go decision, not a reflex.
2. Confirm you have the right credentials:
   ```bash
   gcloud auth list --filter=status:ACTIVE --format='value(account)'
   gcloud config get-value project
   ```
   You need **Firestore Admin** + **Storage Admin** (or Owner) on the data
   project (`erp-system-494716` compute / `zoho-83cda` Firestore — confirm
   which project the affected DB lives in).
3. Identify the **target timestamp** or **backup export** to restore from
   (see each path below).
4. **Always `--dry-run` first.** Every script supports it and performs zero
   mutations — read the plan, then re-run for real.

---

## 1. PITR restore (preferred — loss within 7 days)

This path is documented in `DISASTER_RECOVERY.md` §4.3 and does **not** use the
`scripts/dr/` tooling (PITR is a single gcloud call). Summary:

```bash
# Restore to T_bad - 1 minute into a NEW database
gcloud firestore databases restore \
  --source-database='projects/erp-system-494716/databases/(default)' \
  --source-snapshot-time="2026-05-27T14:32:00Z" \
  --destination-database="zoho-restore-$(date +%s)" \
  --project=erp-system-494716
```

Then verify (sample 10 docs) and promote per §6 below. If PITR is unavailable
(loss older than 7 days), fall through to §2 or §3.

---

## 2. Per-tenant restore (single org_id)

Use when exactly one organization's data is wrong and you want to leave every
other tenant untouched. Firestore's native import cannot filter by `org_id`, so
`restore-tenant.sh` runs **export → scratch DB → filter → re-import**:

```
full GCS export --import--> isolated scratch DB --extract--> per-tenant JSON
                                                              --apply--> live (default)
```

### 2.1 Dry-run (produces the patch + diff, NO live writes)

```bash
scripts/dr/restore-tenant.sh \
  --org-id    064a4a1a-487b-4835-a42a-4806ba8add72 \
  --project   erp-system-494716 \
  --bucket    zoho-83cda-erp-backups \
  --source    firestore/2026-05-26/        # omit to auto-pick the latest export \
  --out-dir   ./_dr/tenant-restore \
  --dry-run
```

This creates the scratch DB plan, prints the gcloud commands it *would* run,
and (when run for real without `--apply`) writes the per-collection patch to
`./_dr/tenant-restore/<org_id>/` plus a `_manifest.json` with doc counts.

### 2.2 Review the diff

```bash
cat ./_dr/tenant-restore/<org_id>/_manifest.json    # per-collection counts
# The applier can also print a diff against live without writing:
python backend/scripts/apply_tenant_patch.py \
  --project erp-system-494716 --database "(default)" \
  --org-id <org_id> --in-dir ./_dr/tenant-restore/<org_id> --mode diff
```

Prefer driving this through the **super-admin console** (`/platform/dr-restore`)
which shows the diff visually and enforces four-eyes approval (see §4).

### 2.3 Apply to live (gated, org-scoped, audited)

```bash
scripts/dr/restore-tenant.sh \
  --org-id 064a4a1a-487b-4835-a42a-4806ba8add72 \
  --project erp-system-494716 --bucket zoho-83cda-erp-backups \
  --source firestore/2026-05-26/ \
  --apply --mode upsert        # 'upsert' = additive; 'replace' also deletes omitted docs
```

The script demands you re-type the `org_id` to confirm (skip with `--yes` only
in automation). The applier (`apply_tenant_patch.py`) enforces a **tenant
guard**: it refuses to write any document whose `org_id` differs from the
target — a corrupt patch can never cross tenant boundaries. Every apply writes
an `audit_logs` row of type `dr_tenant_restore_apply`.

The scratch DB is torn down automatically (pass `--keep-scratch` to retain it
for forensics — then delete it manually to avoid cost).

### 2.4 Mode choice

* `--mode upsert` (default): merge restored docs over live. Safe — never
  deletes. Use this unless you specifically need a point-in-time replacement.
* `--mode replace`: upsert **and** delete live docs for the org that are absent
  from the backup. Use only when the tenant wants their data rolled back wholesale.

---

## 3. Full GCS restore (catastrophic — PITR blown)

Use when the whole database is lost/corrupt and PITR cannot help. Restores the
entire nightly export into a **new** database; it never touches `(default)`.

### 3.1 Dry-run

```bash
scripts/dr/restore-full.sh \
  --project erp-system-494716 \
  --bucket  zoho-83cda-erp-backups \
  --source  firestore/2026-05-26/     # omit to auto-pick the latest export \
  --location me-central1 \
  --dry-run
```

The script integrity-checks the export (manifest present, object set non-empty,
optional `checksums.sha256` sidecar sample) **before** it touches any database.

### 3.2 Real restore

```bash
scripts/dr/restore-full.sh \
  --project erp-system-494716 --bucket zoho-83cda-erp-backups \
  --source firestore/2026-05-26/ --location me-central1
# It auto-generates a destination DB name like zoho-restore-YYYYMMDD-HHMMSS,
# creates it, imports, and runs a post-restore integrity sample.
```

You will be asked to type the destination DB name to confirm. ETA 30–240 min
depending on tenant size (RTO budget: `DISASTER_RECOVERY.md` §1, R5.9).

### 3.3 Scoped restore (subset of collections)

```bash
scripts/dr/restore-full.sh ... --collection-ids invoices,invoice_lines,journal_entries
```

---

## 4. Super-admin console (four-eyes approval + diff preview)

For per-tenant restores, prefer the UI at **`/platform/dr-restore`** (super-admin
only). It implements the **four-eyes control** required for destructive
privileged operations (T-SF.3.9):

1. Admin A creates a restore request (org_id + backup archive path + mode). The
   backend auto-computes a **diff preview** (added / changed / unchanged per
   collection) by comparing the backup archive to live data.
2. Admin A reviews the diff. **Admin B** (a *different* super-admin) approves —
   the API rejects self-approval with HTTP 403.
3. Admin B executes. The API does **not** run gcloud; it returns the exact
   `restore-tenant.sh --apply` command to run on the incident bridge, then the
   operator reports the result back (`POST .../result`).

Backend: `backend/app/api/admin/dr_restore.py` +
`backend/app/services/dr_restore_service.py`. Every transition writes an
`audit_logs` row of type `dr_restore.*`.

---

## 5. Backup-restore verification (automated fire-drill)

Two CI workflows guard backup health:

* `.github/workflows/backup-verify.yml` (existing) — weekly: the latest backup
  object exists and hashes.
* `.github/workflows/dr-backup-restore-verify.yml` (SF3, new) — weekly: picks a
  **random recent export**, restores it into a **throwaway sandbox DB**, runs an
  integrity sample (`backend/scripts/verify_restore_sample.py`), then tears the
  sandbox down. A backup that has never been restored is not a backup.

Both skip cleanly (green) when GCP credentials / Workload Identity Federation
are not configured (e.g. on forks). To enable the restore-verify in CI, set repo
secrets `GCP_WIF_PROVIDER` + `GCP_DR_SERVICE_ACCOUNT` and variables
`DR_GCP_PROJECT`, `BACKUP_GCS_BUCKET`, `DR_FIRESTORE_LOCATION`.

---

## 6. Promotion (making a restored DB live)

Restores stage into a new DB on purpose. To cut traffic over:

```bash
# Repoint the backend at the restored database (no data move):
gcloud run services update zoho-erp \
  --project erp-system-494716 --region me-central1 \
  --update-env-vars FIRESTORE_DATABASE_ID=zoho-restore-YYYYMMDD-HHMMSS
```

Then re-run the accounting smoke + `/api/health` from ≥3 probes. **Verify before
you promote** — sample 10 docs across `invoices`, `contacts`, `journal_entries`.

---

## 7. Rollback

* **Full restore:** the live `(default)` DB was never touched. Revert the Cloud
  Run env-var change above. Delete the staging DB when done:
  ```bash
  gcloud firestore databases delete --database=zoho-restore-... --project=erp-system-494716
  ```
* **Per-tenant `--apply`:** the write is an org-scoped upsert. To undo, re-apply
  an earlier export's patch, or restore that org from PITR (§1).

---

## 8. DR infrastructure provisioning

`scripts/dr/provision-dr.sh` (idempotent, `--dry-run`-able) stands up the
durable-storage side:

* **PITR** — 7-day window on `(default)` (T-SF.3.4).
* **Turbo replication** — me-central1 ↔ europe-west4 dual-region backup bucket,
  15-min RPO SLA (T-SF.3.5).
* **Object lock** — versioning + locked retention (WORM, 7-year default)
  (T-SF.3.6).
* **Lifecycle** — Standard → Nearline @30d → Coldline @90d → Archive @365d
  (T-SF.3.7).

```bash
scripts/dr/provision-dr.sh \
  --project erp-system-494716 --db "(default)" \
  --bucket zoho-83cda-erp-backups \
  --primary ME-CENTRAL1 --secondary EUROPE-WEST4 \
  --dry-run
```

> **External blocker:** applying PITR/replication/object-lock on the real GCP
> project requires production access (project Owner + Firestore/Storage Admin)
> and incurs cost. This is a deliberate, human-applied step — see the parent
> spec's external blockers.

---

## 9. Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `no *.overall_export_metadata under <prefix>` | Export still in progress, or wrong prefix | Pick a settled export (`gsutil ls gs://<bucket>/firestore/`) |
| `refusing to restore into the live (default)` | `--destination (default)` | Choose a fresh destination DB name |
| `four-eyes: the approver must be a different super-admin` | Requester tried to self-approve | A second super-admin must approve |
| `cannot execute a request in status 'requested'` | Execute before approval | Get four-eyes approval first |
| `TENANT GUARD: ... org_id != ...` | Patch contains another tenant's doc | Re-extract; never bypass the guard |
| Turbo replication won't enable | Bucket is single-region | Migrate to a dual-region bucket (provision script prints steps) |

---

## 10. Post-incident

Follow `DISASTER_RECOVERY.md` §7 (postmortem within 48h) and log the drill in
§10 of that file. File follow-ups with the `incident-followup` label.
