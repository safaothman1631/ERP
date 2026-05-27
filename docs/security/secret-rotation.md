# Secret Rotation Policy

> **Spec ref:** requirements.md §10.7 (R10.7), §7.6 (R7.6)
> **Owner:** DevOps (primary), Security lead (escalation)
> **Last reviewed:** 2026-05-27

This document defines how, when, and by whom every secret in the
production Zoho-Kurdish ERP is rotated, and the operational steps to
perform each rotation safely.

## 1. Policy table

| Secret name | Storage | Rotation cadence | Owner | Notes |
|---|---|---|---|---|
| `SECRET_KEY` (JWT signing) | GCP Secret Manager | **180 days** | DevOps | Rotation triggers re-login for all users; schedule on a low-traffic Sunday. |
| `FIRESTORE_FIELD_ENCRYPTION_KEY` | GCP Secret Manager | **180 days** | DevOps | New version becomes the *encryptor*; old version is kept as a *decryptor* for one year (envelope rotation). |
| `DATABASE_URL` (Cloud SQL admin) | GCP Secret Manager | **365 days** | DevOps | Coordinate with backup window. |
| `REDIS_RATE_LIMIT_URI` | GCP Secret Manager | **On suspicion only** | DevOps | Memorystore credentials are infra-managed; rotate by re-creating the instance. |
| `SENTRY_DSN` (backend) | GCP Secret Manager | **On suspicion only** | DevOps | DSN exposure is low-risk; rotate if a key is found in logs or commits. |
| `SENTRY_DSN` (frontend) | Vercel env | **On suspicion only** | DevOps | Frontend DSN is intentionally public-shaped. |
| `STRIPE_API_KEY` / `ASIACELL_API_KEY` / `ZAINCASH_API_KEY` etc. (third-party) | GCP Secret Manager | **365 days** | Finance + DevOps | Coordinate with vendor; some providers require ticketed rotation. |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | GCP Secret Manager | **180 days** | DevOps | Provider keys leak through logs more than most; tighter cadence. |
| GitHub Actions deploy credentials | **GCP Workload Identity Federation** (no static keys) | **N/A** | DevOps | Replaces JSON service-account keys per R7.6 — see `workload-identity-federation.md`. |
| Backup encryption key (`BACKUP_ENCRYPTION_KEY`) | GCP KMS (Cloud KMS) | **730 days** | DevOps | KMS key versions auto-managed; old versions remain available for decrypt of historical backups. |
| Admin API token (break-glass) | 1Password vault, sealed | **90 days** | Security lead | Recorded use only; alerts on any use. |

Definitions:

* **"On suspicion only"** means there is no automatic timer; rotation happens within 24 hours of a leak, a leaving employee with access, or a vendor-disclosed incident.
* All third-party credentials must be procured under the corporate account (not a personal account), so off-boarding does not strand a renewal.

## 2. Operational procedure — `SECRET_KEY`

Use the wrapper script:

```bash
./scripts/rotate-secret.sh --secret SECRET_KEY
```

What it does, step by step:

1. Generates a new value: `openssl rand -hex 64`.
2. `gcloud secrets versions add SECRET_KEY --data-file=-` adds a new version, becoming `latest`.
3. `gcloud run services update zoho-erp --update-secrets SECRET_KEY=SECRET_KEY:latest` rolls out a new revision pointing at the new version.
4. Waits 60 seconds, then probes `/api/health` until 200 (or fails the script).
5. Logs the old version id; after a **24-hour grace** the old version is disabled (not deleted) so we can re-enable on rollback.

Manual fallback (if the script is unavailable):

```bash
PROJECT=erp-system-494716
SVC=zoho-erp
REGION=me-central1
NAME=SECRET_KEY

# 1. Mint and stash
NEW=$(openssl rand -hex 64)
echo -n "$NEW" | gcloud secrets versions add "$NAME" \
  --project="$PROJECT" --data-file=-

# 2. Roll Cloud Run to it
gcloud run services update "$SVC" \
  --project="$PROJECT" --region="$REGION" \
  --update-secrets "$NAME=$NAME:latest"

# 3. Verify
gcloud run services describe "$SVC" \
  --project="$PROJECT" --region="$REGION" \
  --format='value(spec.template.metadata.annotations."run.googleapis.com/secrets")'

curl -fsS "https://${SVC}.run.app/api/health" >/dev/null && echo OK
```

## 3. Operational procedure — third-party API keys (annual)

For each provider (Stripe, AsiaCell, ZainCash, OpenAI, etc.):

1. Generate a new key in the provider's dashboard. Label it `zoho-erp-prod-YYYY-MM`.
2. Add it as a new Secret Manager version: `gcloud secrets versions add <NAME> --data-file=-`.
3. Roll Cloud Run: `gcloud run services update zoho-erp --update-secrets <NAME>=<NAME>:latest`.
4. Wait 30 minutes (Cloud Run revision soak).
5. Verify production logs show no auth failures from the provider.
6. Revoke the **old** key in the provider's dashboard.
7. File the rotation in `audit/secrets/rotations.csv` with: secret name, date, performer, ticket id.

Vendors that require a maintenance window (e.g., terminal-acquirer integrations) get scheduled change tickets via the `change-request` skill.

## 4. Operational procedure — `FIRESTORE_FIELD_ENCRYPTION_KEY` (envelope)

Field encryption uses envelope encryption: every encrypted field stores its DEK encrypted under the current KEK. Rotation rotates the KEK; existing data continues to decrypt under the old version, new writes encrypt under the new version. We never re-encrypt historical data in-place.

```bash
gcloud secrets versions add FIRESTORE_FIELD_ENCRYPTION_KEY \
  --data-file=<(openssl rand -base64 32)
gcloud run services update zoho-erp --update-secrets FIRESTORE_FIELD_ENCRYPTION_KEY=FIRESTORE_FIELD_ENCRYPTION_KEY:latest
```

Old versions are kept **enabled** indefinitely (cost: trivial; benefit: backward decrypt).

## 5. Compromise response

If a secret is suspected leaked (in logs, in a git commit, in an email):

1. **Within 1 hour:** disable the affected version in Secret Manager (`gcloud secrets versions disable`).
2. Mint and roll a new version (steps in §2).
3. Audit recent access logs:
   ```bash
   gcloud logging read 'protoPayload.serviceName="secretmanager.googleapis.com" AND protoPayload.resourceName="projects/PROJECT/secrets/NAME"' --limit=200
   ```
4. If the leak made it to a public commit, rewrite history (`git filter-repo`) and rotate all credentials the repo has touched.
5. File an incident note in `audit/incidents/YYYY-MM-DD-secret-leak.md`.

## 6. Calendar reminders

Calendar invites are owned by the DevOps lead and live on the shared `ops@zoho.kurd.iq` calendar:

* `SECRET_KEY rotation` — recurring every 180 days, all-day, Sunday slot.
* `Third-party key rotation review` — quarterly, first Monday of the quarter.
* `WIF + IAM audit` — semi-annual.
* `DR drill` — quarterly (see `DISASTER_RECOVERY.md`).

If a reminder fires and the owner is on leave, escalation is to the Security lead, then the Tech lead, then the CEO.

## 7. Audit

* Every rotation creates a Secret Manager version, which is timestamped and signed by GCP — that *is* the audit log.
* In addition, the operator writes one line to `audit/secrets/rotations.csv`: `secret_name,date_utc,old_version,new_version,operator,ticket_id`.
* The Security lead reviews the CSV every quarter and reconciles missing rotations against the policy table.

## 8. Owners and escalation

| Role | Person | When to escalate |
|---|---|---|
| Primary | DevOps lead | Every routine rotation. |
| Backup | Tech lead | DevOps lead on leave. |
| Security | Security lead | Suspected compromise; any out-of-policy rotation. |
| Final | CEO | Customer-impacting incident or vendor-disclosed breach. |
