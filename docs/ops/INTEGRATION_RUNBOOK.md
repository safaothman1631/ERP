# Integration Runbook

Operational checklist for third-party integrations and platform secrets used by the ERP.

## E-Invoice (ITA Iraq)

1. Open **Settings → Finance → E-Invoice**.
2. Enable the integration and enter seller tax ID and branch code.
3. Set **Portal URL** to the ITA production submission endpoint (sandbox URL for testing).
4. Upload or paste the signing private key; store API key / bearer token if required by your provider.
5. Leave **Preview mode** enabled until a test submission succeeds, then disable preview for production.
6. Verify status in **Integration health** (`Settings → System → Integration health`) shows **OK**.

**Rollback:** Re-enable preview mode to stop live submissions without deleting credentials.

## WhatsApp Business (Cloud API)

1. Create a Meta Business app with WhatsApp product enabled.
2. Copy **Phone number ID**, **Business account ID**, and a long-lived **API token**.
3. Open **Settings → Content → SMS & WhatsApp** and paste credentials.
4. Disable **Preview mode** only after a test message delivers successfully.
5. Confirm **Integration health** shows **OK** for WhatsApp.

**Rollback:** Enable preview mode or clear the API token to stop outbound sends.

## FIB & Zain Cash (Iraq payments)

### Option A — Organisation settings (recommended)

1. Open **Settings → Finance → Payment methods** or use **API → Iraq payments → Gateways**.
2. Configure **FIB** with merchant ID, API key, and callback URL.
3. Configure **Zain Cash** with merchant ID and secret.
4. Enable each gateway after sandbox callback tests succeed.

### Option B — Environment variables (platform-wide)

Set on the backend deployment (Cloud Run / `.env`):

| Variable | Gateway |
|----------|---------|
| `FIB_MERCHANT_ID` | FIB |
| `FIB_API_KEY` | FIB |
| `ZAIN_CASH_MERCHANT_ID` | Zain Cash |
| `ZAIN_CASH_SECRET` | Zain Cash |

Restart the backend after changing env vars.

## Firebase (Firestore & Auth)

1. Ensure `FIREBASE_PROJECT_ID` matches your GCP project.
2. **Development:** place a service account JSON at `FIREBASE_CREDENTIALS_PATH` (default `serviceAccountKey.json`).
3. **Cloud Run:** rely on Application Default Credentials (no file required when the service account is attached).
4. Optional: set `FIREBASE_STORAGE_BUCKET` for attachment uploads.
5. Deploy Firestore indexes from `firestore.indexes.json` before production traffic.

**Verify:** `GET /api/system/health/full` (authenticated) should report Firestore as healthy.

## FIELD_ENCRYPTION_KEY (PII encryption)

Used to encrypt sensitive fields at rest (contacts, HR, payroll).

1. Generate a Fernet key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
2. Set `FIELD_ENCRYPTION_KEY` in production secrets (never commit to git).
3. When rotating keys, set the old value in `FIELD_ENCRYPTION_KEY_PREVIOUS` during migration, then run `backend/scripts/migrate_pii_encryption.py`.
4. Remove `FIELD_ENCRYPTION_KEY_PREVIOUS` after all records are re-encrypted.

**Warning:** Losing this key makes encrypted PII unrecoverable.

## SMTP email

1. Open **Settings → Content → Email**.
2. Enter SMTP host, port, username, password, and **From** address.
3. Alternatively set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM` in backend env.
4. Send a test notification from **Settings → Notifications** if available.

## Webhooks (outbound)

1. Open **Settings → Automation → Webhooks**.
2. Add one HTTPS endpoint URL per line.
3. Set an HMAC **signing secret** and choose subscribed events.
4. Integration health shows **OK** when at least one endpoint and a signing secret are configured.

## Public API v1

- Base path: `/api/v1/`
- OpenAPI docs: `/docs` (when `DEBUG` or docs enabled)
- Manage bearer tokens under **Settings → Automation → API tokens**

## Integration health endpoint

`GET /api/settings/integration-health` (requires `settings.read`) returns a JSON `{ "items": [...] }` array used by the Settings UI. Each item includes:

| Field | Description |
|-------|-------------|
| `key` | Stable identifier (`einvoice`, `whatsapp`, `fib`, …) |
| `label` | Display name |
| `status` | `ok`, `preview`, or `missing` |
| `configure_url` | Deep link into Settings |
| `message` | Human-readable detail |

Use this endpoint for dashboards and pre-launch checklists.
