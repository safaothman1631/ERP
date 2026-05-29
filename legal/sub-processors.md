# Sub-processors

> **DRAFT — pending licensed-counsel review (T-SF.2.14).** Prepared by a non-lawyer drafter. It does **not** constitute legal advice and has **no** legal effect until published. This page is the **single source of truth** for the sub-processors we engage to process personal data on behalf of our customers, and is incorporated into the **DPA** (`legal/dpa.md`, Annex III). Keeping one authoritative list mitigates translation drift (RSK-19) and vendor-outage exposure (RSK-16).

| | |
|---|---|
| **Maintained by** | Security lead (internal owner) |
| **Published at** | `/legal/sub-processors` |
| **Change-notice mechanism** | Email subscribe form on the published page; **30-day** advance notice for additions/replacements; right of objection per DPA §6.2 |
| **Last updated** | `[TO BE SET ON PUBLICATION]` |
| **Governing language** | **Arabic is the legally binding version** (RSK-19) |

---

## 1. Current sub-processors

| Sub-processor | Service provided | Personal-data categories processed | Hosting region | Transfer safeguard |
|---|---|---|---|---|
| **Google Cloud Platform** (Firestore, Cloud Run, Cloud Storage, Secret Manager, Cloud Logging) | Core hosting, primary database, compute, object storage, secrets, logs | All categories (account, business records, usage, communications) | **`me-central1` (Doha, Qatar)** primary; **`europe-west4` (Netherlands)** backup; DR standby `asia-southeast1` | Google Cloud Data Processing Addendum incorporating EU SCCs (2021) |
| **Firebase** (Authentication, project `zoho-83cda`) | Identity/auth infrastructure (part of Google Cloud) | Account identifiers, auth tokens | Google Cloud regions as above | Google Cloud DPA / SCCs |
| **Vercel** | Marketing site and frontend static/edge hosting | Minimal — request metadata and static assets; **no Customer Personal Data at rest** | EU + global edge | Vercel DPA incorporating SCCs |
| **Sentry** | Application error and performance monitoring | Incidental identifiers in error stack traces (PII scrubber enabled) | EU (Frankfurt) | Sentry DPA / SCCs |
| **Stripe** | Payment processing (international cards and SaaS billing) | Billing contact, payment token, last-4 of card, transaction metadata | EU / global | Stripe DPA incorporating SCCs; PCI-DSS Level 1 |
| **360Dialog** | WhatsApp Business API message transport | Phone number, message content and metadata | EU | 360Dialog DPA / SCCs |
| **Crisp** | Live-chat customer support | Support-conversation content, contact identifiers (name, email) | EU (France) | Crisp DPA / SCCs |

## 2. Notes

- We do **not** sell personal data and do not use sub-processors for advertising.
- Each sub-processor is engaged under a written data-processing agreement imposing obligations no less protective than our DPA, and we remain responsible for their performance (DPA §6.3).
- For customers requiring **enhanced data residency** (e.g., `me-central1`-only, no cross-region backup outside the agreed region), see MSA §6.2.
- Iraqi in-country **payment providers** (e.g., FastPay, Qi, ZainCash, Asia Pay) may act as additional processors **where you enable them** for local collection; they are engaged under their provider terms and will be added to this list as they are activated for production.

## 3. How to subscribe to change notices

Subscribe via the form on `/legal/sub-processors` to receive email notice of any intended addition or replacement of a sub-processor at least **30 days** in advance. You may object on reasonable data-protection grounds per **DPA §6.2**.

## 4. Change log

| Date | Change | Notice sent |
|---|---|---|
| `[YYYY-MM-DD]` | Initial publication | n/a (initial list) |

---

### Drafter's notes for counsel / engineering (remove before publication)

- **Reconcile messaging transport:** This list names **360Dialog (WhatsApp)** and **Crisp (live chat)** per the SF2 brief; `docs/security/pii-handling.md` currently lists **Twilio** for WhatsApp. Confirm the actual production transport(s) and update both documents so this page remains the single source of truth.
- Verify each named sub-processor's **current** sub-region and DPA URL before publication.
- Add the in-country payment processors to §1 once their production integration is live (R4 payment work).
