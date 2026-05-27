# Workload Identity Federation (WIF) — GitHub → GCP

> **Spec ref:** requirements.md §7.6 (R7.6), tasks.md T-6.2
> **Owner:** DevOps
> **Status:** Migration plan. Target completion: end of P6.

The goal is to **eliminate every JSON service-account key** from the
repository and from GitHub Actions secrets, and replace them with a
**short-lived OIDC-issued access token** minted by GCP on demand for a
given GitHub workflow.

## 1. Why WIF

Today, `deploy-cloudrun.yml` reads a `GCP_SA_KEY` secret containing a
JSON key for `deploy-runner@erp-system-494716.iam.gserviceaccount.com`.
The risks:

* JSON keys do not expire. A leak compromises the account forever (until manually revoked).
* They are copy-pasted across CI configs, increasing exposure.
* Rotation is manual (see `secret-rotation.md`), so cadence slips.

With WIF, GitHub's OIDC issuer (`https://token.actions.githubusercontent.com`) presents a signed JWT to GCP STS, which exchanges it for a short-lived access token (default 1 hour). No long-lived secret is ever stored.

## 2. Step-by-step setup

### 2.1 Prerequisites

```bash
gcloud config set project erp-system-494716
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com
```

### 2.2 Create the Workload Identity Pool

```bash
gcloud iam workload-identity-pools create "github" \
  --project="erp-system-494716" \
  --location="global" \
  --display-name="GitHub Actions Pool"
```

### 2.3 Create the OIDC Provider inside the pool

```bash
gcloud iam workload-identity-pools providers create-oidc "github-actions" \
  --project="erp-system-494716" \
  --location="global" \
  --workload-identity-pool="github" \
  --display-name="GitHub Actions OIDC" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref,attribute.workflow=assertion.workflow" \
  --attribute-condition="assertion.repository_owner == 'safaothman'" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

**Important — `attribute-condition`:** This is the *gate* that stops a
malicious repo in some other GitHub org from minting tokens. We only
accept assertions from our own repository owner. If we add a new GitHub
org, this expression must be updated.

### 2.4 Create the deploy service account (if not already present)

```bash
gcloud iam service-accounts create gh-deployer \
  --project=erp-system-494716 \
  --display-name="GitHub Actions deployer"

# Roles needed for Cloud Run + Firestore deploys
for role in \
  roles/run.admin \
  roles/iam.serviceAccountUser \
  roles/artifactregistry.writer \
  roles/datastore.indexAdmin \
  roles/secretmanager.secretAccessor \
  roles/cloudbuild.builds.editor \
  roles/logging.logWriter
do
  gcloud projects add-iam-policy-binding erp-system-494716 \
    --member="serviceAccount:gh-deployer@erp-system-494716.iam.gserviceaccount.com" \
    --role="$role"
done
```

### 2.5 Bind the GitHub repo to the service account

```bash
PROJECT_NUMBER=$(gcloud projects describe erp-system-494716 --format='value(projectNumber)')
REPO="safaothman/zoho"   # adjust if the repo name differs

gcloud iam service-accounts add-iam-policy-binding \
  "gh-deployer@erp-system-494716.iam.gserviceaccount.com" \
  --project="erp-system-494716" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"
```

This grants `iam.workloadIdentityUser` on the deploy SA to **only**
workflows running in `safaothman/zoho`. Add separate bindings for any
other repo that needs to deploy.

To restrict further to a specific branch/environment, swap
`attribute.repository` for `attribute.ref` (e.g., `refs/heads/main`).

### 2.6 Capture the provider resource name

```bash
gcloud iam workload-identity-pools providers describe "github-actions" \
  --project="erp-system-494716" \
  --location="global" \
  --workload-identity-pool="github" \
  --format='value(name)'
# projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-actions
```

Save this string — it is the value of the `workload_identity_provider`
input in the GH Actions step below.

## 3. GitHub Actions usage

Existing workflows that consumed `secrets.GCP_SA_KEY`:

```yaml
- uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}
```

Become:

```yaml
permissions:
  contents: read
  id-token: write   # REQUIRED to mint the OIDC token

# ...

- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: 'projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-actions'
    service_account: 'gh-deployer@erp-system-494716.iam.gserviceaccount.com'
```

`id-token: write` is mandatory; without it the runner cannot present an OIDC assertion.

## 4. Migration plan

We do a **side-by-side migration**, not a flag-day cut:

1. **Day 0:** Create pool + provider + bindings (steps 2.2 – 2.5). No workflow changes yet.
2. **Day 1:** Add a new workflow `deploy-cloudrun-wif.yml` that uses WIF, triggered manually. Run it against staging; verify it deploys.
3. **Day 2 – 7:** Run staging deploys exclusively through the WIF workflow for one week. Production still uses the JSON-key workflow.
4. **Day 8:** Flip the production workflow to WIF (PR that just changes the `auth` step input). Keep the old workflow file in the repo, disabled (`on: { workflow_dispatch: }`).
5. **Day 9:** Disable the JSON key in IAM:
   ```bash
   gcloud iam service-accounts keys list \
     --iam-account="deploy-runner@erp-system-494716.iam.gserviceaccount.com"
   gcloud iam service-accounts keys disable KEY_ID \
     --iam-account="deploy-runner@erp-system-494716.iam.gserviceaccount.com"
   ```
6. **Day 30:** Delete the disabled key. Delete the `GCP_SA_KEY` GH secret. Delete the now-unused service account if no other workload depends on it.

## 5. Verification

After cutover, on any successful deploy:

* The `auth` step output `credentials_file_path` should reference a temp file — no static key.
* In GCP Cloud Audit Logs:
  ```
  protoPayload.serviceName="sts.googleapis.com"
  protoPayload.methodName="google.identity.sts.v1.SecurityTokenService.ExchangeToken"
  protoPayload.metadata.@type:"type.googleapis.com/google.identity.sts.v1.ExchangeTokenMetadata"
  ```
  shows the federated identity exchange.
* `gcloud iam service-accounts keys list ...` for the old SA shows **zero enabled user-managed keys**.

## 6. Rollback strategy

If WIF causes an outage (token exchange failing, IAM misconfig, repo rename):

1. **Re-enable the disabled JSON key:**
   ```bash
   gcloud iam service-accounts keys enable KEY_ID \
     --iam-account="deploy-runner@erp-system-494716.iam.gserviceaccount.com"
   ```
2. Add `GCP_SA_KEY` back as a GH secret with the key's JSON value (preserved in 1Password until Day 30).
3. Revert the PR that flipped the `auth` step.
4. File an incident note in `audit/incidents/` describing the failure mode.

After Day 30 (key deleted) the rollback is:

1. Mint a brand-new JSON key for the SA.
2. Set the GH secret.
3. Revert the PR.

This is slower (~ 15 minutes), so **do not delete the key on Day 30 if there has been any WIF-related instability in the prior 14 days.**

## 7. Owners

* **Owner:** DevOps lead
* **Backup:** Tech lead
* **Reviewer for IAM bindings:** Security lead (sign-off required on any new `principalSet` member)
