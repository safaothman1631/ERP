# G4a Iraq e-Fakhata — Python Dependencies

> **Spec:** `.kiro/specs/growth-to-100` § R4 (Iraq Compliance — e-Fakhata)
> **Date:** 2026-05-29
> **Owner:** Iraq e-Invoicing specialist (Claude)

This file records the new Python package(s) introduced by G4a so the user
can add them to `backend/requirements.txt` (the spec constrains agents
from modifying `requirements.txt` directly).

## New runtime dependencies

| Package | Pin | Purpose | Used by |
|---------|-----|---------|---------|
| `lxml` | `>=5.0,<6.0` | XML serialization + canonicalization for e-Fakhata invoices | `backend/app/efakhata/schema.py`, `backend/app/efakhata/signing.py` |
| `signxml` | `>=3.2,<4.0` | XAdES-BES + plain XML-DSig signing & verification | `backend/app/efakhata/signing.py` |

## Optional / already-present

| Package | Why optional / already present |
|---------|--------------------------------|
| `cryptography` | Already in `requirements.txt` (used by JWT/auth). Reused here for PKCS#12 unwrap. |
| `google-cloud-secret-manager` | Optional. If absent, `EFAKHATA_LOCAL_CERT_STORE=1` enables an in-process dev fallback. Production needs this installed. |
| `httpx` | Already present (used elsewhere). Reused as the MoF HTTP client. |

## Install commands (Windows PowerShell)

```powershell
cd C:\Users\SAFA\zoho\backend
.\venv\Scripts\Activate.ps1
pip install "lxml>=5.0,<6.0" "signxml>=3.2,<4.0" "google-cloud-secret-manager>=2.20.0"
```

## Environment variables introduced

| Var | Required when | Purpose |
|-----|---------------|---------|
| `MOF_BASE` | Submission worker active | Iraq MoF e-Fakhata API base URL (HTTPS). If unset, queue holds without erroring. |
| `EFAKHATA_LOCAL_CERT_STORE` | Dev / CI | Set to `1` to bypass Secret Manager and use the in-process cert store. |
| `GCP_PROJECT_ID` | Secret Manager backend | Used to build the `projects/{p}/secrets/...` resource names. |
| `DEFAULT_TENANT_ID` | Single-tenant fallback | When the worker can't enumerate orgs, processes this one. |

## MoF API contract — pending R7.X

Field shapes, endpoint paths, and ack-number naming are all *placeholder*
until the published MoF e-Fakhata spec is verified. The locations marked
with `# TODO: verify against published spec (R7.X)` are:

- `app/efakhata/schema.py` — `NS_EFK` URI, element vs attribute splits, version on root
- `app/efakhata/mof_client.py` — `/api/v1/invoices/submit`, `/status`, `/cancel` paths
- `app/efakhata/mof_client.py` — response keys (`ack_number` vs `ackNumber`)
