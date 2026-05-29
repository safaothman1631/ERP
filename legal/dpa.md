# Data Processing Agreement (DPA)

> **DRAFT — pending licensed-counsel review (T-SF.2.11; GDPR review T-SF.2.10).** Prepared by a non-lawyer drafter for review by a qualified Iraqi commercial lawyer and GDPR-conversant counsel. It does **not** constitute legal advice and has **no** legal effect until executed/published after counsel sign-off. Bracketed `[…]` items require confirmation. Anchored on the **EU Standard Contractual Clauses, 2021 (Commission Implementing Decision (EU) 2021/914)** as the international-transfer base, supplemented for the **Iraqi PDPL**.

| | |
|---|---|
| **Processor** | `[LEGAL ENTITY NAME]` (شركة ذات مسؤولية محدودة), Iraq ("**Processor**", "we") |
| **Controller** | The customer entity that accepts this DPA or executes an Order Form referencing it ("**Controller**", "you") |
| **Forms part of** | The Terms of Service (`legal/terms-of-service.md`) or the Master Service Agreement (`legal/msa.md`), as applicable (the "**Agreement**") |
| **Execution** | Click-through (clickwrap) for SMB customers; counterpart-signed PDF available for enterprise |
| **Version** | 0.1 (draft) |
| **Governing language** | **Arabic is the legally binding version** (RSK-19); English/Kurdish are courtesy translations |

This DPA prevails over conflicting terms in the Agreement with respect to the processing of personal data.

---

## 1. Definitions

Terms not defined here have the meaning in the Agreement, the PDPL, or the GDPR (as applicable).

- **"Personal Data"** — any information relating to an identified or identifiable natural person that the Processor processes on behalf of the Controller under the Agreement (the "**Controller Personal Data**"), as described in **Annex I**.
- **"Processing", "Controller", "Processor", "Data Subject", "Personal Data Breach"** — as defined in the GDPR / PDPL equivalents.
- **"Sub-processor"** — any third party engaged by the Processor to process Controller Personal Data (**Annex III**).
- **"Standard Contractual Clauses" / "SCCs"** — the clauses annexed to Commission Implementing Decision (EU) 2021/914 of 4 June 2021.
- **"Data Protection Laws"** — the Iraqi PDPL and, where applicable to a transfer or Data Subject, the GDPR and EU/EEA member-state law.

## 2. Subject matter, duration, nature & purpose

2.1 **Subject matter & nature.** The Processor processes Controller Personal Data to provide the Zoho Kurdish ERP / ERPIQ Service (accounting, invoicing, POS, inventory, CRM, payroll, e-invoicing, messaging, and related modules) under the Agreement.

2.2 **Purpose.** Processing is solely to provide, secure, support, and maintain the Service and as instructed by the Controller.

2.3 **Duration.** Processing continues for the term of the Agreement plus the post-termination export window (30 days) and any legally required retention, after which data is deleted or returned per §9.

2.4 **Details.** The categories of Data Subjects and Personal Data, and the processing operations, are specified in **Annex I**.

## 3. Processor duties

3.1 **Documented instructions.** The Processor processes Controller Personal Data **only on the Controller's documented instructions**, including the Agreement, this DPA, and use of the Service's configuration. The Processor informs the Controller if, in its opinion, an instruction infringes Data Protection Laws.

3.2 **Confidentiality.** The Processor ensures persons authorized to process Controller Personal Data are bound by confidentiality and are trained.

3.3 **Security.** The Processor implements the technical and organizational measures in **Annex II** (Art. 32 GDPR / PDPL Art. 14 equivalent).

3.4 **Sub-processors.** Governed by §6 and **Annex III**.

3.5 **Data-subject requests.** Taking into account the nature of the processing, the Processor assists the Controller by appropriate technical and organizational measures (including in-app export and deletion tooling) to respond to Data Subjects exercising their rights.

3.6 **Assistance.** The Processor assists the Controller in ensuring compliance with security, breach-notification, data-protection-impact-assessment, and prior-consultation obligations, taking into account the information available to the Processor.

3.7 **Deletion or return.** On termination, the Processor deletes or returns Controller Personal Data per §9.

3.8 **Records & audits.** The Processor makes available information necessary to demonstrate compliance and supports audits per §8.

## 4. Controller duties

4.1 The Controller warrants that it has a lawful basis to provide the Controller Personal Data and to instruct the processing, has provided required notices, and has obtained any required consents from Data Subjects.

4.2 The Controller is responsible for the accuracy, quality, and legality of Controller Personal Data and the means by which it acquired them.

## 5. Security measures

5.1 The Processor implements and maintains the measures described in **Annex II**, designed to ensure a level of security appropriate to the risk, including pseudonymization and encryption, confidentiality, integrity, availability, and resilience of processing systems, the ability to restore availability after an incident, and a process for regularly testing the effectiveness of measures.

5.2 The Processor may update measures provided the level of protection is not materially reduced.

## 6. Sub-processors

6.1 **General authorization.** The Controller grants a **general authorization** for the Processor to engage Sub-processors listed in **Annex III** and at `/legal/sub-processors`.

6.2 **Change notice & objection.** The Processor will give at least **thirty (30) days' notice** of any intended addition or replacement of a Sub-processor (via the subscribe interface at `/legal/sub-processors` and/or email). The Controller may **object** on reasonable data-protection grounds within that period. If the parties cannot resolve the objection, the Controller may terminate the affected portion of the Service and receive a pro-rated refund of pre-paid, unused fees.

6.3 **Flow-down.** The Processor imposes on each Sub-processor data-protection obligations no less protective than this DPA and remains liable for the Sub-processor's performance.

## 7. Personal Data Breach

7.1 The Processor notifies the Controller **without undue delay and in any event within twenty-four (24) hours** of becoming aware of a confirmed Personal Data Breach affecting Controller Personal Data, **regardless of severity**.

7.2 The notice includes, to the extent known, the nature of the breach, categories and approximate number of Data Subjects and records, likely consequences, and measures taken or proposed. The Processor provides updates as information becomes available.

7.3 This supports the Controller's own obligation to notify the competent supervisory authority within **72 hours** (GDPR Art. 33) and affected Data Subjects where required, and the Iraqi authority per PDPL.

## 8. Audit rights

8.1 Once per twelve (12) months, on at least **thirty (30) days' written notice**, during business hours, and subject to a mutual NDA, the Controller (or an independent auditor it appoints, not a competitor of the Processor) may audit the Processor's compliance with this DPA.

8.2 The Processor may satisfy audit requests by providing **current third-party attestations or certifications** (e.g., a SOC 2 report or equivalent) and responses to a security questionnaire, where these reasonably address the Controller's request. On-site audits are limited to once per year absent a Personal Data Breach or regulator requirement. The Controller bears its own audit costs.

## 9. International transfers

9.1 The Processor discloses the hosting locations in **Annex II/§(Hosting)** — primarily **Google Cloud `me-central1` (Doha)** with cross-region backup to **`europe-west4` (Netherlands)**.

9.2 **Where Controller Personal Data of EEA/UK Data Subjects is transferred** outside the EEA to a country without an adequacy decision, the parties incorporate the **EU SCCs (2021)** as set out in §10; the **UK International Data Transfer Addendum** applies for UK transfers.

9.3 For PDPL-governed transfers, the Processor applies equivalent contractual safeguards and the disclosures in this DPA and the Privacy Policy.

## 10. Incorporation of the EU Standard Contractual Clauses

10.1 Where the SCCs apply (§9.2), the parties are deemed to have entered into the SCCs (Decision (EU) 2021/914), which are incorporated by reference and completed as follows:

- **Module in operation:** **Module Two (Controller-to-Processor)** where the Controller is the data exporter and the Processor the data importer. **Module Three (Processor-to-Processor)** applies where the Controller is itself a processor for its own customers.
- **Clause 7 (docking):** **applies** (optional docking clause included).
- **Clause 9 (sub-processors):** **Option 2 — general written authorization**, with a **30-day** prior-notice period (consistent with §6).
- **Clause 11 (redress):** the optional independent-dispute-resolution body is **not** elected.
- **Clause 17 (governing law):** the law of **`[EU member state to be selected by counsel — e.g., Ireland]`**.
- **Clause 18 (forum):** the courts of the same member state.
- **Annexes to the SCCs:** **Annex I** (parties, description of transfer, competent supervisory authority), **Annex II** (technical and organizational measures), and **Annex III** (sub-processors) of *this DPA* populate the corresponding SCC annexes.

10.2 If there is any conflict between the SCCs and this DPA, the **SCCs prevail** with respect to transfers they govern.

## 11. Term, liability & miscellaneous

11.1 This DPA takes effect on acceptance of the Agreement and continues until processing ends (§2.3).

11.2 Each party's liability under this DPA is subject to the limitations in the Agreement, except where Data Protection Laws prohibit such limitation.

11.3 This DPA is governed by the same law as the Agreement (Iraqi law), except that the SCCs are governed as stated in §10.1.

---

# Annex I — Description of the processing (data categories & Data Subjects)

> Populates SCC Annex I.

### A. List of parties

- **Data exporter (Controller):** the customer entity accepting this DPA; contact as in its account.
- **Data importer (Processor):** `[LEGAL ENTITY NAME]`, Iraq; contact **privacy@zoho.kurd.iq**.

### B. Categories of Data Subjects

The Controller may upload Personal Data concerning:
- The Controller's **employees, contractors, and staff** (e.g., payroll, HR, user accounts).
- The Controller's **customers and contacts** (e.g., CRM, invoices, POS receipts).
- The Controller's **suppliers and vendor contacts**.
- **End users / authorized users** of the Controller's tenant.

### C. Categories of Personal Data

| Tier | Examples |
|---|---|
| Identification & contact | Name, work/personal email, phone, business name, address, national ID `[where the Controller chooses to store it]`, IBAN |
| Account & security | Username, hashed password, 2FA settings, roles/permissions, login timestamps |
| Financial / transactional | Invoice and bill line items, payment references, payroll amounts, tax IDs (VAT, withholding) |
| Usage & device | Hashed IP, user-agent, navigation events, RUM telemetry |
| Communications | Support messages and attachments; messaging metadata |

**Special-category data:** The Service is **not** intended for special-category data. If the Controller chooses to store such data (e.g., a pharmacy module storing health-adjacent records), the Controller is responsible for the additional lawful basis and safeguards. `[Flag for counsel: pharmacy/healthcare verticals.]`

### D. Nature and purpose of processing

Hosting, storage, organization, retrieval, transmission, display, backup, and deletion of Controller Personal Data to provide the Service.

### E. Duration

For the term of the Agreement plus the export window and legally required retention (see §2.3, §9).

### F. Competent supervisory authority (for SCC purposes)

`[To be determined by counsel — e.g., the supervisory authority of the EU member state selected under SCC Clause 17, or the lead authority of the EEA exporter.]`

---

# Annex II — Technical and Organizational Measures (TOMs)

> Populates SCC Annex II. Reflects the controls in `docs/security/pii-handling.md`, `DISASTER_RECOVERY.md`, and `firestore.rules`.

| Measure | Implementation |
|---|---|
| **Encryption in transit** | TLS 1.2+ for all client-server and service-to-service traffic. |
| **Encryption at rest** | All data encrypted at rest on Google Cloud. **Field-level envelope encryption** for direct identifiers (P1) via a dedicated key. |
| **Password & secret handling** | Passwords hashed with **Argon2id**. Secrets in Google Secret Manager with rotation (`docs/security/secret-rotation.md`). Payment-card PAN never stored — only a processor token + last four digits. |
| **Access control** | Role-based access control (RBAC); least privilege; admin/break-glass access logged. |
| **Tenant isolation** | Per-tenant `org_id` scoping enforced at the Firestore security-rules layer and the repository layer; cross-tenant access denied and alerted. |
| **Audit logging** | Security-relevant events (auth, admin, billing, export, deletion) logged and **hash-chained (SHA-256 of the prior entry)** for tamper evidence; retained ≥ 18 months. |
| **Backups & resilience** | Native Point-in-Time Recovery (7-day window); daily export to GCS with lifecycle (Nearline 30d, Coldline 90d, Archive 365d); cross-region replication to `europe-west4`; bucket-lock against accidental delete. |
| **Disaster recovery** | Documented runbook (`DISASTER_RECOVERY.md`); RTO 1 hour / RPO 5 minutes for the user-facing service; pre-warmed standby in `asia-southeast1`; quarterly DR drills. |
| **Hosting locations** | Primary **Google Cloud `me-central1` (Doha)**; backup **`europe-west4`**; static assets via **Vercel** edge; error telemetry via **Sentry (EU)** with PII scrubbing. |
| **Vulnerability & patch management** | Dependency and image scanning in CI (security-scan workflow); SBOM + license scan on release; annual third-party penetration test. |
| **Secure development** | Code review, branch protection, CI quality gates, scorecard checks. |
| **Incident response** | SEV-1/2/3 process; breach notification to controllers within 24 hours (§7). |
| **Personnel** | Confidentiality obligations; security and incident-command training (repeated annually). |
| **Data minimization & deletion** | Models reject unknown fields; 30-day soft-delete grace then hard delete with a deletion certificate. |
| **Availability** | Service Level Agreement (`legal/sla.md`) — 99.5% monthly uptime target with credit ladder. |

---

# Annex III — Sub-processors

> Populates SCC Annex III. The **authoritative, current** list is maintained at **`legal/sub-processors.md`** and published at `/legal/sub-processors`. As of this draft:

| Sub-processor | Purpose | Data categories | Region |
|---|---|---|---|
| **Google Cloud / Firebase** (Firestore, Cloud Run, GCS, Secret Manager) | Core hosting, database, storage, compute | All categories | `me-central1` (Doha) + `europe-west4` backup |
| **Vercel** | Marketing site & frontend static hosting (edge) | Minimal — no Customer Personal Data at rest | EU + global edge |
| **Sentry** | Error monitoring | Incidental identifiers in stack traces (PII scrubber enabled) | EU (Frankfurt) |
| **Stripe** | Payment processing (international cards / SaaS billing) | Billing contact, payment token, last-4 | EU / global (Stripe DPA + SCCs) |
| **360Dialog** | WhatsApp Business API transport | Phone number, message content/metadata | EU |
| **Crisp** | Live-chat support | Support messages, contact identifiers | EU (France) |

Each Sub-processor is engaged under a data-processing agreement incorporating SCCs where required.

---

### Drafter's notes for counsel (remove before publication)

- **SCC module/anchors (§10):** Confirm Module Two vs Three usage, the **governing-law member state** (Clause 17/18 placeholder), and the **competent supervisory authority** (Annex I.F). UK IDTA wording to be added if UK customers are in scope. Source: design.md §2.4, requirements R2.5.
- **Breach window (§7):** 24h-to-controller is product policy (design.md §2.4, requirements R2.5); confirm against PDPL Art. 24 (pii-handling.md cites 72h to the Iraqi authority for breaches > 100 records).
- **Sub-processor list:** Reconcile **360Dialog/Crisp** (this DPA) vs **Twilio** (currently in `docs/security/pii-handling.md`) before publication. Keep `legal/sub-processors.md` as the single source of truth (RSK-19 / RSK-16).
- **Healthcare/pharmacy verticals (Annex I.C):** Flag special-category-data handling for counsel; may need a vertical-specific addendum.
