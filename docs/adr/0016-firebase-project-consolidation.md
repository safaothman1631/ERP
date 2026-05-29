# ADR 0016 — `zoho-83cda` is the single canonical Firebase/Firestore project

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | DevOps lead, Backend lead |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | `.firebaserc`; `firebase.json`; `backend/app/config.py` (`FIREBASE_PROJECT_ID`); `.github/workflows/deploy-firestore.yml`; `terraform/monitoring/variables.tf`; `DISASTER_RECOVERY.md` §6; `docs/handbook/engineering-handbook.md` (cloud-projects note); ADR-0001 (Firestore) |

## 1. Context

This product was assembled in waves, and its Google Cloud footprint grew
organically. Over time, references to **more than one** GCP project crept into
the codebase, docs, and CI, which is a recurring source of "which project am I
even pointed at?" confusion — and a genuine risk (a `firebase deploy` against
the wrong project, or an API pointed at an empty Firestore).

The reality on the ground today:

* **Firebase / Firestore / Auth / backups** are all in **`zoho-83cda`**:
  * `.firebaserc` → `{"projects": {"default": "zoho-83cda"}}`.
  * `backend/app/config.py` → `FIREBASE_PROJECT_ID: str = "zoho-83cda"`.
  * `.github/workflows/deploy-firestore.yml` →
    `firebase deploy --only firestore:rules,firestore:indexes --project zoho-83cda`.
  * Backup bucket `gs://zoho-83cda-erp-backups` (DISASTER_RECOVERY.md §6).
  * Terraform `variables.tf` documents `project_id` as "the Firebase project
    `zoho-83cda`" and defaults the monitoring stack to it.
* **Older artifacts still name a separate compute project** (`erp-system-494716`)
  and region `me-central1` for `gcloud run` / `gcloud dns` commands
  (DISASTER_RECOVERY.md §4), while the Cloud Run **deploy workflow** currently
  sets `REGION: europe-west1` and `SERVICE: zoho-erp`. In other words there is
  *drift* across docs/CI on both project name and region.

We need one written, authoritative statement of the canonical contract so the
drift converges instead of spreading.

## 2. Decision

**`zoho-83cda` is the single canonical Firebase project for all Firestore data,
security rules, indexes, Auth, and backups. Everything that says "Firebase
project" or `FIREBASE_PROJECT_ID` resolves to `zoho-83cda` and nothing else.**

Concretely:

* **Firestore data plane** — `zoho-83cda`. The backend's `FIREBASE_PROJECT_ID`
  default is `zoho-83cda`; production overrides must point at `zoho-83cda` (or a
  restore DB *within* it). Pointing the API's Firestore at any other project is
  a misconfiguration.
* **Rules + indexes deploy** — always
  `firebase deploy ... --project zoho-83cda` (the firestore workflow already
  hard-codes this; do not parameterise it away).
* **Backups** — `gs://zoho-83cda-erp-backups`; PITR enabled on `zoho-83cda`.
* **Observability-as-code** — the Terraform monitoring stack
  (`terraform/monitoring/`) takes `project_id` and is intended to target
  `zoho-83cda`, co-locating dashboards/alerts/RUM warehouse with the data they
  describe.

The **compute project** (Cloud Run, Cloud DNS, Memorystore, Secret Manager) is
supplied to CI as the `GCP_PROJECT_ID` secret and is *intentionally separate*
(see handbook). This ADR does not force compute and data into one project; it
**fixes the data project as `zoho-83cda` and forbids ambiguity about it.**

**Drift cleanup (tracked, not blocking):** the `erp-system-494716` /
`me-central1` / `europe-west1` mentions are a documentation tail. Each
reference is to be reconciled to the live values during routine doc review; the
*source of truth* is, in priority order: `.firebaserc` + `config.py` (data
project), the deploy workflow env (compute region/service), and Terraform
`variables.tf` (which records the intended steady state, `me-central1` /
`zoho-erp-backend`).

## 3. Consequences

### Positive

* One unambiguous answer to "which project holds the data?" — `zoho-83cda`.
* `firebase` CLI just works from a fresh checkout (`.firebaserc` default), with
  no `--project` guessing.
* Backups, rules, indexes, and the data they protect are co-located; a DR
  operator has a single project to reason about for the data plane.
* New engineers get the rule in the handbook on day one ("never `firebase
  deploy` against the compute project").

### Negative

* The compute/data split remains a thing newcomers must learn — two projects,
  two mental models. We accept this; consolidating compute into `zoho-83cda`
  now would be a riskier migration than the confusion it removes.
* The historical `erp-system-494716` / region references in older docs are
  *incorrect-until-reconciled* and could mislead during an incident. Mitigated
  by the handbook's explicit cloud-projects note and the pre-flight step in
  `docs/runbooks/dr-restore.md` ("confirm which project the affected DB lives
  in").

### Neutral / known unknowns

* Whether to *also* consolidate the compute project into `zoho-83cda` is a
  separate, larger decision (Cloud Run + DNS + secrets migration). Out of scope
  here; this ADR only canonicalises the **data** project.

## 4. Alternatives considered

### Alternative A — Multiple Firebase projects (e.g. per-environment data projects)

* **Pros:** hard isolation between prod and staging data.
* **Cons:** doubles the rules/index deploy surface, the backup buckets, and the
  IAM allowlists; we already separate staging via environment + a staging DB,
  not a separate Firebase project.
* **Why rejected:** isolation we don't currently need, at real ops cost.

### Alternative B — Collapse compute and data into one project (`zoho-83cda`)

* **Pros:** truly one project; the handbook's two-project note goes away.
* **Cons:** a live migration of Cloud Run, Cloud DNS, Memorystore, and Secret
  Manager into the Firebase project, with downtime risk and IAM rework, for an
  ergonomic gain.
* **Why rejected for now:** the data-project canonicalisation captures most of
  the benefit at none of the migration risk. Revisit if the split keeps causing
  incidents.

### Alternative C — Leave it undocumented (status quo)

* **Pros:** zero work.
* **Cons:** the drift that motivated this ADR keeps spreading; the wrong-project
  deploy risk persists.
* **Why rejected:** ambiguity around the data project is a standing incident
  waiting to happen.

## 5. Validation

We will know we made the right call if:

* A grep for `--project` in CI shows the firestore deploy pinned to
  `zoho-83cda` and nothing pointing the data plane elsewhere.
* `backend/app/config.py`'s `FIREBASE_PROJECT_ID` stays `zoho-83cda`; any PR
  changing it is challenged in review.
* No incident is caused by a wrong-project `firebase deploy` or a
  Firestore-points-at-empty-project misconfig.
* Over the next two doc-review cycles, stale `erp-system-494716` / region
  references trend to zero (or are explicitly re-confirmed as the live compute
  values).

Revisit if: we decide to consolidate compute into the same project (Alternative
B), or to introduce per-environment data projects (Alternative A).

## 6. Notes

* The authoritative, plain-language version of the two-project model lives in
  the engineering handbook's "A note on cloud projects" preface — read it before
  any `gcloud`/`firebase` command.
* Verify PITR on the canonical project:
  ```bash
  gcloud firestore databases describe --database="(default)" --project=zoho-83cda \
    --format="value(pointInTimeRecoveryEnablement)"
  ```

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: after the stale-reference cleanup completes, or if compute/data consolidation is reconsidered.*
