# ADR 0019 — Workload Identity Federation for CI→GCP (no service-account JSON keys)

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Security review, Ops/SRE |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | `.kiro/specs/scale-foundation` §SF4 (T-SF.4.9); `vercel.json` / GitHub Actions deploy; ADR-0016 (Firebase project consolidation on `zoho-83cda`); ADR-0018 (CSRF) |

## 1. Context

CI/CD (GitHub Actions) and the Cloud Run runtime need to authenticate to GCP
(`zoho-83cda`): deploy services, read/write Firestore, push to Artifact
Registry, run the DR backup/restore and IAM-audit jobs. The historically easy
path is a **long-lived service-account JSON key** stored as a CI secret.

Long-lived keys are the single most common cloud-credential leak vector: they
end up in logs, forks, `.env` files, laptop disks, and screenshots; they never
expire; and rotating them is manual and forgotten. The SF4 pre-test hardening
explicitly requires **zero JSON keys in repo or CI** (T-SF.4.9), and the pen
test will look for exactly this.

## 2. Decision

Use **Workload Identity Federation (WIF)**: GitHub's OIDC token is exchanged at
runtime for a short-lived GCP access token scoped to a dedicated deployer
service account. **No service-account JSON key is ever created, stored, or
committed.**

- A Workload Identity **Pool** + **Provider** trusts GitHub's OIDC issuer,
  constrained to this repository (and, for production, specific refs).
- CI authenticates via `google-github-actions/auth` with `workload_identity_provider`
  + `service_account` — no `credentials_json`.
- The Cloud Run runtime uses its **attached service account** (Application
  Default Credentials), never a key file.
- `gitleaks` (ADR-relatedSF4) runs in pre-commit + CI to block any reintroduced
  key material; the IAM leaver audit (`scripts/ops/iam-leaver-audit.py`) flags
  unexpected service accounts.

## 3. Consequences

**Positive:** no leakable long-lived secret; tokens are minutes-long and
auto-rotated; access is auditable per-workflow-run; satisfies SOC 2 / pen-test
expectations.

**Negative / costs:** one-time setup of the pool/provider/SA bindings is fiddly
and is a **cloud apply step** that needs project-Owner access (tracked as an
external blocker, not codeable here); local developers still use their own
`gcloud auth` (human identity), which the IAM audit must allowlist.

**Risk if reverted:** any return to JSON keys reopens the leak vector and would
fail the pen test and SOC 2 control — do not.
