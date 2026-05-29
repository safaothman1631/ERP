# Requirements Document: Scale Foundation (100 → 1000+ Customers)

> **Spec ID:** `scale-foundation`
> **Tier:** 3 — Scale Foundation
> **Status:** Draft v1.0
> **Owner:** Safa Othman (current), transitioning to a 3-person leadership team during execution
> **Target window:** 9–14 months (overlapping phases SF1 → SF6)
> **North-star goal:** Eliminate the six structural blockers that stand between *"a small business with 100 paying tenants"* and *"a credible Iraqi SaaS company serving 1000+ tenants, ready for Series-A diligence, enterprise contracts, and a regional press release."*
> **Cross-references:** `launch-readiness` (Tier 1), `growth-to-100` (Tier 2), `world-class-performance` (the felt-speed program), `firestore-performance-resilience`, `database-foundation-excellence`.

---

## Introduction

Tier 1 (`launch-readiness`) gets the product to the first paying customer. Tier 2 (`growth-to-100`) gets us to ≈100 tenants by sharpening onboarding, packaging, and basic support. **Tier 3 — this spec — is the difference between "a founder's project that happens to make money" and "a company."** It is what venture investors, enterprise procurement officers, security auditors, and the Iraqi Ministry of Finance all look at before they sign.

At 100 customers, every issue below is survivable through founder heroics. At 1000 customers, every issue below becomes existential:

- One founder cannot be on-call 24/7 across two time zones (Iraqi customers + a sales pipeline that may include Gulf and EU buyers).
- One legal incident — a customer data leak, a missing DPA, an unregistered company collecting VAT — can erase three years of work.
- One untested backup script can erase three years of customer data.
- One un-pen-tested multi-tenant boundary can leak Shop A's invoices to Shop B and end the brand.
- One missing dashboard means an outage runs for hours undetected.
- One un-validated assumption about how a Karak shopkeeper actually uses the printer can mean every churn is on us.

This spec covers **six issues**, each of which is independently a "stop work on everything else until this is true" condition for going past ~100 tenants. They are deliberately ordered by **how badly they hurt at scale**, not by how easy they are to do.

| # | Blocker | Failure mode at 1000 customers |
|---|---------|----------------------------------|
| R1 | Solo operator (founder bus factor) | One unavailable week = no deploys, no incidents, no refunds, no support. |
| R2 | No legal/compliance foundation | First enterprise lead asks for a DPA, MSA, and SLA. We have none. Sale dies. |
| R3 | Untested backup restoration | A bad migration deletes a customer's 18-month history. We learn we can't restore. |
| R4 | Unverified tenant isolation | A bug or a curious attacker reads across tenant boundaries. Iraqi press picks it up. |
| R5 | Observability still a workbench, not a production system | A SEV1 runs for 90 minutes before anyone notices. SLA credits trigger. |
| R6 | Code not battle-tested on real Iraqi counters | NPS plateaus at 30; high churn at month 2; sales team has no reference customers. |

The output of this spec is not "features." It is **operational maturity**, **legal posture**, **proven resilience**, **verified security**, **production-grade observability**, and **earned credibility with the first 5 anchor pilots**.

---

## Glossary

### Operational / SRE

| Term | Definition |
|------|------------|
| **SRE** | Site Reliability Engineering — Google's discipline of operating production systems as a software problem. |
| **SLI** | Service Level Indicator — a measurable signal (e.g., availability ratio, latency, error rate). |
| **SLO** | Service Level Objective — internal target for an SLI (e.g., 99.5% availability monthly). |
| **SLA** | Service Level Agreement — contractual commitment to a customer, typically with credit penalties on miss. |
| **RPO** | Recovery Point Objective — maximum tolerable data loss measured in time (we target ≤ 5 min). |
| **RTO** | Recovery Time Objective — maximum tolerable downtime to restore service (we target ≤ 1 h). |
| **MTTR** | Mean Time To Restore — average across all incidents in a period. |
| **MTTD** | Mean Time To Detect — average gap between incident start and pager fire. |
| **Incident Command** | The discipline of running an active incident: IC, scribe, communicator, subject-matter expert roles. |
| **Error budget** | The fraction of the period during which SLO is permitted to be missed (e.g., 99.5% gives 0.5% = ~3.6h/month). |
| **Bus factor** | The number of people whose simultaneous unavailability kills the project. Today: **1**. Target: **3+**. |
| **WIF** | Workload Identity Federation — Google's keyless authentication for CI to GCP. |
| **IAM** | Identity and Access Management. |
| **PagerDuty / Opsgenie** | Commercial on-call rotation + paging platforms. |
| **Runbook** | A written, step-by-step procedure to handle a specific operational scenario. |
| **ADR** | Architecture Decision Record — short markdown file capturing one design decision and its consequences. |

### Legal / Compliance

| Term | Definition |
|------|------------|
| **ToS** | Terms of Service — the customer-facing agreement governing use of the platform. |
| **DPA** | Data Processing Agreement — required by GDPR Art. 28 (and equivalent in Iraqi PDPL). |
| **MSA** | Master Service Agreement — enterprise contract framework for tier-3 customers. |
| **AUP** | Acceptable Use Policy — what customers are allowed to do with the service. |
| **GDPR** | General Data Protection Regulation (EU 2016/679) — applies if we sell into the EU or process EU residents' data. |
| **Article 17** | GDPR right to erasure ("right to be forgotten"). Customers can demand hard delete of their personal data. |
| **PDPL** | Personal Data Protection Law — Iraqi data protection regime (Federal Law No. 37/2015 + 2023 amendments). |
| **شركة ذات مسؤولية محدودة** | Iraqi LLC — limited-liability company, the standard SaaS company form in Iraq/KRG. |
| **MoF / GCT** | Iraqi Ministry of Finance / General Commission for Taxes — VAT and corporate-income-tax authority. |
| **Sub-processor** | A third party we use to process customer data (Firestore, Cloud Run, Vercel, Sentry, BigQuery). Customers must consent. |
| **E&O insurance** | Errors & Omissions — covers professional liability claims. |
| **Cyber liability** | Insurance covering breach response, notification costs, regulatory fines. |
| **IP assignment** | Contract clause where contractors/employees assign all work IP to the company. |

### Security

| Term | Definition |
|------|------------|
| **IDOR** | Insecure Direct Object Reference — an attacker manipulates an ID parameter to access someone else's data. |
| **Pen test** | Penetration test — authorized adversarial assessment by external security firm. |
| **SOC 2** | AICPA Service Organization Control 2 — Type I (point-in-time) and Type II (over period) attestations. |
| **ISO 27001** | International information-security management standard, certifiable. |
| **CSP** | Content Security Policy — HTTP header limiting which resources a page can load. |
| **CSRF** | Cross-Site Request Forgery — attacker tricks a logged-in user into a state-changing request. |
| **XSS** | Cross-Site Scripting — attacker injects JS into a page someone else views. |
| **Bug bounty** | Paid vulnerability disclosure program (HackerOne, Bugcrowd, Intigriti). |
| **SBOM** | Software Bill of Materials — list of every dependency for license + CVE auditing. |

### Observability

| Term | Definition |
|------|------------|
| **RUM** | Real User Monitoring — telemetry from real client browsers. |
| **APM** | Application Performance Monitoring — server-side tracing and metrics. |
| **OTel** | OpenTelemetry — vendor-neutral instrumentation standard. |
| **Distributed trace** | One end-to-end trace ID followed across frontend → backend → Firestore. |
| **Cardinality** | The number of unique label combinations in a metric — exploding cardinality breaks Prometheus/Cloud Monitoring. |
| **k6 / Locust** | Open-source load-testing tools. |
| **Synthetic monitoring** | Scripted nightly probe against production from an external location. |

### UAT / Pilot

| Term | Definition |
|------|------------|
| **UAT** | User Acceptance Testing — customer-side verification that the product solves the real-world problem. |
| **NPS** | Net Promoter Score — single-question loyalty metric (0–10 scale → promoters minus detractors). |
| **CSAT** | Customer Satisfaction Score — post-interaction rating. |
| **Anchor pilot** | A friendly early customer who tolerates rough edges in exchange for influence + price discount. |
| **Reference customer** | A customer who will speak publicly (case study, sales call, logo on site) about results. |

---

## Requirements

### Requirement 1 — Team & Operational Maturity (eliminate the founder bus factor)

THE Company SHALL transition from a single-operator structure to a minimum **3-person operational core** with documented knowledge transfer, multi-admin infrastructure access, and 24x7 on-call coverage for paying customers, completed before customer #150 onboards.

**1.1 Hiring plan and sequencing.** THE founder SHALL hire, in order, (a) a **Senior Frontend / Full-Stack Engineer** (months 1–3 of SF1), (b) an **Operations / SRE / Support Lead** (months 2–5), (c) a **Customer Support Specialist** Kurdish + Arabic native (months 4–6). Each hire SHALL be onboarded with a documented 30/60/90 plan and a runbook ownership transfer at day 60.

**1.2 Iraq-market compensation bands.** THE Company SHALL publish internal salary bands grounded in the Iraqi/KRG market: Senior FE/FS engineer USD 2,000–4,000/month (USD 24K–48K/year), Ops/SRE Lead USD 1,800–3,500/month, Customer Support USD 600–1,200/month. International remote hires SHALL be priced separately and capped at 1 per cohort to protect margin.

**1.3 Knowledge transfer documentation.** THE founder SHALL produce, before hire #2 starts, a written **Engineering Handbook** covering: repo layout, branching model, deploy procedure, secret access procedure, customer-data access procedure, on-call procedure, incident-response procedure, refund-authorization procedure. Each chapter SHALL be < 2,000 words and version-controlled in `docs/handbook/`.

**1.4 Multi-admin GCP access (no single key holder).** THE GCP project `kurdish-erp-prod` SHALL be governed by an IAM group `gcp-admins@` with at least 3 members. Console access SHALL use Workload Identity Federation for CI and Google sign-in with 2FA for humans. WHEN a person leaves the company, THEIR access SHALL be revoked within 24 hours via group removal, verified by an automated weekly IAM audit.

**1.5 On-call rotation.** THE Company SHALL run a **primary on-call rotation of 3 engineers** (1 week each) and a **secondary rotation of 2** for escalation. Weekly handoff SHALL include the open-incidents brief. WHEN a primary acknowledges within 5 min of a P1 page, NO secondary is paged. WHEN no acknowledgement within 15 min, the secondary is paged automatically.

**1.6 PagerDuty / Opsgenie configured.** THE Company SHALL select one paging platform (PagerDuty recommended for international reach; Opsgenie acceptable as cheaper alternative) and configure: services per system (api, frontend, firestore, sw-pos, billing), escalation policies, business hours vs after-hours, schedule overrides for holidays, and integration with Slack + SMS + voice call.

**1.7 Runbook ownership matrix.** EACH production system SHALL have **exactly one** named owner per runbook, with a backup owner. Runbooks SHALL cover at minimum: full-region outage, Firestore write throttling, Cloud Run deploy rollback, billing webhook failures, customer-reported data loss, POS sync stuck, login spike (DDoS suspect), receipt printer mass failure, e-invoice submission backlog, Sentry alert storm.

**1.8 Cross-trained support tier.** THE Customer Support team SHALL include at minimum **3 trained agents** (founder + 2 hires) so that no single person blocks live chat / email. Average response time SHALL be < 30 min during business hours (08:00–22:00 Baghdad time), < 4 h after hours.

**1.9 Decision log / Architecture-of-Record.** THE Company SHALL maintain `docs/adr/` with **at least 20 ADRs** by end of SF1 capturing: choice of Firestore, choice of Cloud Run, choice of React + Vite, multi-tenancy model, RBAC model, POS offline model, choice of paging vendor, choice of legal counsel, currency-rounding policy, fiscal-year handling, refund policy.

**1.10 Disaster recovery captain rotation.** EACH quarter, ONE engineer SHALL be designated **DR Captain** with authority to call a DR drill and freeze deploys during one. The role SHALL rotate so that all engineers practice incident command at least once per year.

**1.11 Incident command training.** ALL engineers SHALL complete a 4-hour Incident Command workshop covering: roles (IC, Scribe, Comms, SME), communications cadence (15-min status), severity definitions (SEV1/2/3), customer-comms templates, postmortem authorship. Training SHALL be repeated annually.

**1.12 1:1 cadence and 360 reviews.** EACH employee SHALL have a documented weekly 30-min 1:1 with their manager and a quarterly written 360 review. Founder-as-CEO SHALL receive feedback from each direct report quarterly via anonymous form. Output stored in `people/` with restricted ACL.

**1.13 Hiring scorecards.** EACH hire SHALL pass a written scorecard with weighted criteria: domain experience, Kurdish language for support roles, Iraqi-tax familiarity for accountant-adjacent roles, on-call willingness, on-site availability for Erbil office days. Take-home tasks SHALL be < 4 h paid.

**1.14 Office vs remote policy.** THE Company SHALL adopt a **2-days-in-office / 3-days-remote** norm with a shared Erbil co-working space, given Iraqi-internet reliability concerns. Full-remote allowed for senior engineers after 6 months of tenure.

**1.15 Founder succession plan.** WITHIN 12 months of hire #2, THE founder SHALL be replaceable for any 2-consecutive-week absence: deploy authority, billing authority, support authority, customer-data access, and incident-command authority SHALL all have at least one non-founder backup.

### Requirement 2 — Legal & Compliance Foundation (enterprise-ready posture)

THE Company SHALL stand up the legal and compliance documents that enterprise customers, investors, and regulators expect, before customer #200 or the first enterprise contract — whichever comes first.

**2.1 Iraqi LLC formation.** THE Company SHALL be registered as a **شركة ذات مسؤولية محدودة (LLC)** with the appropriate Iraqi commercial registry (KRG or Federal depending on HQ). Minimum capital ≈ IQD 1,000,000 (USD 700). Estimated total formation cost (legal + notary + chamber of commerce + initial accountant): **USD 1,500–3,000**.

**2.2 Tax authority registration.** THE Company SHALL register with the Iraqi General Commission for Taxes (GCT) for: corporate income tax, VAT (where Iraqi VAT becomes generally applicable), and employee withholding. Compliance calendar SHALL include quarterly VAT returns and annual income-tax filing with documented preparer responsibility.

**2.3 Terms of Service.** THE Company SHALL publish a **Terms of Service** drafted by a qualified Iraqi commercial lawyer (budget USD 1,500–3,500), covering: scope of license, account responsibilities, payment terms, acceptable use, termination, dispute resolution under Iraqi commercial law, limitation of liability capped at 12 months of fees, intellectual-property ownership, governing law (Iraq, Erbil courts as primary), force-majeure including electricity and internet outages.

**2.4 Privacy Policy.** THE Company SHALL publish a dual-compliance **Privacy Policy** addressing both Iraqi PDPL and GDPR principles. The policy SHALL enumerate: data categories collected, lawful basis per category, retention periods, sub-processors, international-transfer mechanisms, data-subject rights (access, rectification, erasure, portability), DPO contact (a named role, not a person email), breach-notification commitments (72h to authority).

**2.5 Data Processing Agreement (DPA).** THE Company SHALL publish a **DPA template** at `/legal/dpa` executable in counterpart or via clickwrap. Mandatory clauses: processor duties, sub-processor list with right-of-objection, security measures (Annex II), data-residency disclosure (me-central1 + cross-region backups), breach notification within 24h to controller, audit rights once per year on reasonable notice.

**2.6 Master Service Agreement (MSA).** FOR enterprise customers (≥ USD 10,000 ARR or ≥ 100 seats), THE Company SHALL offer a negotiable MSA with order-form structure: master terms once, scope-specific order forms per deal. Includes uptime SLA, support-tier definitions, data-residency commitments, change-control procedures, payment terms net-30.

**2.7 Service Level Agreement.** THE customer-facing SLA SHALL commit to **99.5% monthly uptime** with the following credits ladder: 99.0–99.49% = 10% monthly credit; 95.0–98.99% = 25%; < 95.0% = 50%. Excluded: customer-caused outages, scheduled maintenance < 4h/month with 72h notice, force-majeure (electricity, internet, government action). SLA SHALL be tied to SLOs in `world-class-performance` R5 and observability in R5 of this spec.

**2.8 Sub-processor list, current and dated.** THE Company SHALL maintain `/legal/sub-processors` with: vendor name, function, data accessed, country of processing, security-attestation links (e.g., Google SOC2 link). Mandatory entries: Google Firestore, Google Cloud Run, Vercel, Sentry (if used), BigQuery, PagerDuty/Opsgenie, payment processor (Visa Iraq / FIB / Qi Card), email vendor (SendGrid/Mailgun), customer-comms (WhatsApp Business API provider).

**2.9 Cookie policy and consent banner.** THE web app SHALL deploy a consent banner for EU visitors (Geo-targeted) and an "I accept" banner for Iraqi users. Categories: strictly necessary, analytics (web-vitals), functional. Default for non-EU: opt-out. Default for EU: opt-in. Cookie inventory documented.

**2.10 Insurance program.** THE Company SHALL purchase by month 9 of SF1: **Cyber Liability** USD 1,000,000 limit, **Errors & Omissions (E&O)** USD 1,000,000 limit. Iraqi market typically routes through London brokers (AIG, Allianz, Chubb via brokers in Dubai). Estimated annual premium USD 3,500–8,000.

**2.11 Employment + IP-assignment agreements.** EVERY employee and contractor SHALL sign: confidentiality, IP-assignment (all work product to the company), non-compete (12 months, narrow to direct competitors), arbitration clause (Iraqi commercial chamber). Templates drafted by Iraqi labor lawyer (budget included in 2.3).

**2.12 GDPR Article 17 / PDPL erasure workflow.** THE Company SHALL build a documented data-erasure pipeline: customer raises request via in-app form or email → ticket auto-created → 30-day grace for billing reconciliation → hard delete with audit log entry → confirmation email to requester. Time-to-completion SHALL be ≤ 30 days from request.

**2.13 Audit log retention.** THE Company SHALL retain security-relevant audit logs (auth events, admin actions, billing actions, data-export events) for **18 months minimum**. Stored in Cloud Logging with sink to BigQuery cold storage after 30 days. Encrypted at rest, hash-chained for tamper evidence (a SHA-256 of previous entry stored on next entry).

**2.14 Acceptable Use Policy (AUP).** THE Company SHALL publish an AUP at `/legal/aup` prohibiting: illegal goods, sanctioned-entity transactions, spam, malware distribution, infringing content. Enforcement includes warning → suspension → termination ladder.

**2.15 Refund policy.** THE customer-facing refund policy SHALL be: **30-day full refund** for monthly plans paid up-front; pro-rated for annual after 30 days; no refund for usage-based fees (per-transaction). Policy lives at `/legal/refunds` and is referenced by ToS.

**2.16 Open-source license compliance.** THE Company SHALL run an SBOM (CycloneDX) on each build and a license scan (FOSSA / Snyk Open Source / Syft + Grype) blocking GPL/AGPL in dependencies that we redistribute. Compatible licenses inventoried; attribution file generated at `/legal/oss-attribution`.

### Requirement 3 — Disaster Recovery Drilled and Proven

THE backup and restore subsystem SHALL be **demonstrably operable** — not merely scripted — with RPO ≤ 5 minutes, RTO ≤ 1 hour, quarterly full drills, tenant-level point-in-time recovery, and cross-region resilience.

**3.1 Recovery Point Objective ≤ 5 min.** THE Firestore export-to-GCS pipeline SHALL run such that the maximum window of unrecoverable writes is ≤ 5 minutes. This requires either: (a) Firestore PITR with 7-day window enabled (Google native), (b) change-data-capture (CDC) into GCS via Firestore triggers, or (c) hybrid: nightly full export + continuous CDC. Choice documented in design.md.

**3.2 Recovery Time Objective ≤ 1 hour.** GIVEN a destructive event at T0, THE Company SHALL restore tenant-readable service by T0 + 60 min, measured end-to-end (decision → restore script start → Firestore writes complete → cache warm → user login succeeds). Validated in DR drills.

**3.3 Tenant-level restore.** WHEN a single tenant requests data restoration (e.g., they deleted their inventory), THE Company SHALL be able to restore that tenant's data to any 5-minute boundary within the last 7 days **without affecting other tenants**. Mechanism: PITR-derived export filtered by `tenant_id`, applied as merge into live collections with a confirmation step.

**3.4 Cross-region backup.** GCS backup bucket SHALL be replicated **automatically** to a second region (primary: me-central1; secondary: europe-west4 for proximity + Google SLA). Replication lag SHALL be < 1 hour, monitored. Bucket retention policy SHALL prevent accidental delete (Object Lock or Bucket Lock).

**3.5 Quarterly full DR drill.** EVERY quarter, the on-call DR Captain SHALL execute a **complete restore** to a non-production project from the previous night's backup, validate data integrity (row counts, checksums, sample queries), document the drill, and file the report in `audit/dr/YYYY-QN/`. Drill SHALL be unannounced to engineering at large at least once per year.

**3.6 Customer-visible restore (admin feature).** THE in-app super-admin console SHALL include a **"Restore tenant data from date"** flow that: shows backup catalog, requires two-person approval (4-eyes) for production, dry-runs the restore showing diff, executes with progress, logs every action, notifies the tenant admin.

**3.7 Backup integrity verification.** THE `backup-verify.yml` GitHub Action SHALL pick a random tenant weekly, restore into a sandbox project, run integrity queries (counts per top-10 collections, last-write timestamps within expected band), and post a green/red badge to the team channel. Red SHALL page on-call.

**3.8 Encryption at rest and in transit.** THE Firestore exports SHALL be encrypted at rest using Google-managed keys (CMEK considered for enterprise tier customers paying for it). Transit uses TLS 1.3. Access to backup buckets SHALL be limited to the `gcp-admins@` group + a dedicated `backup-svc@` service account.

**3.9 Retention schedule.** THE backup retention SHALL be: **daily for 30 days**, **weekly (Sunday) for 12 weeks**, **monthly (1st of month) for 12 months**, **yearly (Jan 1) for 7 years** (Iraqi commercial books retention requirement). Lifecycle rules in GCS enforce this.

**3.10 RPO/RTO public commitment.** THE SLA (R2.7) SHALL publicly commit to RPO ≤ 1 h, RTO ≤ 4 h (looser than internal targets to allow operational margin). Actual capability stays at 5 min / 1 h.

**3.11 DR runbook.** `DISASTER_RECOVERY.md` SHALL be expanded to cover: full-region loss, partial Firestore corruption, ransomware on operator laptop, malicious-employee delete, accidental schema drop. Each scenario gets a tested playbook with timing targets.

**3.12 Customer communication during DR.** WHEN a restore event affects production, THE Company SHALL update the **status page** within 15 minutes, send email to affected tenant admins within 1 hour, post WhatsApp message to enterprise tenants within 30 minutes (per their MSA). Templates pre-written in the runbook.

### Requirement 4 — Security, Tenant Isolation, and Attack Resilience

THE Company SHALL move from "we wrote rules and hoped" to "we paid an outside firm to break them and they couldn't" — with documented penetration testing, a SOC 2 Type I attestation path, a bug bounty program, and a written incident-response plan.

**4.1 External penetration test.** THE Company SHALL engage a reputable security firm — **Bishop Fox**, **Trail of Bits**, **NCC Group**, or a regional equivalent like **Help AG (Dubai)** or **CyberGate (Saudi)** — for an annual penetration test. Initial test scope: web app, mobile, API, multi-tenant isolation. Budget: **USD 20,000–40,000 per engagement** for a 2-week scoped test.

**4.2 IDOR test scenarios.** THE pen test scope SHALL specifically include IDOR class attacks: manipulating `tenant_id` in JWT claims, body parameters, query parameters, paths; attempts to read `/api/contacts/<other-tenant-id>`, `/api/items/...`, `/api/invoices/...`; attempts to mutate cross-tenant. Findings SHALL drive remediation within SLA: Critical 24h, High 7 days, Medium 30 days, Low 90 days.

**4.3 Firestore Rules independent audit.** BEFORE the pen test, THE Company SHALL submit `firestore.rules` to an external firm for a static audit. Cost: USD 3,000–6,000. Output: written report listing every collection's read/write policy and any gap.

**4.4 Cross-tenant data-leak tests.** THE Company SHALL author Playwright + API tests that attempt to read another tenant's data via every list/detail endpoint. Tests SHALL pass (i.e., receive 403/404) for at least 200 endpoint × tenant pairs. CI gates on this suite.

**4.5 Race condition on tenant assignment.** TENANT-creation flows (signup, invite-accept, organization-switch) SHALL be tested for race conditions where two concurrent requests might assign the wrong tenant. Backend SHALL use transactional writes and idempotency keys; tested via load test that fires 100 concurrent signups with the same email.

**4.6 JWT replay + manipulation testing.** TOKEN handling SHALL be tested for: replay after logout, tampering with `tenant_id` claim, algorithm downgrade (none/HS256→RS256 confusion), expired-token acceptance. Backend SHALL verify signature, `iss`, `aud`, `exp`, `nbf`, and our custom `tenant_id` against the server-side membership record.

**4.7 XSS, CSRF, and DOM-sink testing.** THE frontend SHALL pass an automated XSS scan (e.g., DOMSnitch / OWASP ZAP) for at least the top 30 routes. CSRF tokens SHALL be present on every state-changing form / API call (SameSite=strict cookies + token header). Antd component sinks SHALL be audited for HTML-injection.

**4.8 Rate-limit bypass testing.** THE pen tester SHALL attempt distributed rate-limit bypass via varying IP, user-agent, and JWT. Backend Redis-based limiter SHALL hold at the configured per-tenant quotas (600 req/min auth, 60 req/min unauth).

**4.9 File upload security.** UPLOADS (profile photos, expense receipts, item images) SHALL be: size-limited (≤ 10 MB), MIME-checked, magic-byte verified, scanned by Google Cloud Storage scanner (or ClamAV in Cloud Run), stored outside the app domain (signed URL only), filenames hashed (no user-controlled paths).

**4.10 Secret-scanning in code.** THE CI pipeline SHALL run **gitleaks** (or GitHub's native secret scanning) on every PR. Pre-commit hook SHALL run the same locally. Any leaked secret SHALL trigger immediate rotation per R2.13 of `world-class-performance`.

**4.11 SOC 2 Type I attestation path.** THE Company SHALL begin a SOC 2 Type I readiness program (vendor: **Vanta**, **Drata**, **Secureframe**, or **Strike Graph**) by month 9 of SF1. Estimated cost: **USD 15,000–30,000** for Type I including auditor fee (auditor selection: **A-LIGN**, **Prescient Assurance**, or **Sensiba** at lower end). Target attestation by month 18.

**4.12 ISO 27001 gap analysis.** THE Company SHALL commission a one-time gap analysis against ISO 27001 controls (cost: USD 5,000–10,000) to determine certification roadmap. Decision on full certification deferred to growth-to-1000-customers spec.

**4.13 Bug bounty program.** BY month 12 of SF1, THE Company SHALL launch a private bug bounty on **HackerOne** or **Bugcrowd** (Bugcrowd cheaper for smaller co's). Initial scope: web app + API. Payout tiers: Critical USD 1,000–2,500; High USD 500–1,000; Medium USD 150–500; Low USD 50–150. Annual budget allocation: USD 5,000–15,000.

**4.14 Security incident response plan.** THE Company SHALL publish an internal **Security Incident Response Plan (SIRP)** covering: severity classification (S1 personal data breach, S2 cross-tenant exposure, S3 single-tenant impact, S4 internal-only), team roles, customer notification SLAs (72h for S1 per PDPL/GDPR), regulator notification, evidence preservation, post-incident review template.

**4.15 Per-PR security review.** THE PR template SHALL include a "Security checklist" with: input validation, authz check, tenant filter present, log-sensitive-data check, secret check. PRs touching auth, RBAC, or `firestore.rules` SHALL require a second reviewer from a designated security-trained pool of 2.

### Requirement 5 — Observability: Production-Grade, Not Workbench

THE observability infrastructure laid down by `world-class-performance` R6 SHALL be **fully provisioned, wired, and dashboarded in production**, not merely instrumented.

**5.1 BigQuery `vitals_raw` provisioned.** THE BigQuery dataset `vitals_raw` SHALL be created in me-central1 with: partitioning by ingestion date, clustering by `tenant_id, route`, retention policy 90 days raw + 7 years aggregates. IAM: write access only from RUM ingest service account; read access for analytics group + Cloud Monitoring.

**5.2 Six Cloud Monitoring dashboards.** THE Company SHALL publish six named dashboards: **(D1) API SLOs** by endpoint class with burn-rate; **(D2) Firestore** reads/writes per tenant, slow-query tail; **(D3) Cache** Redis hit/miss, eviction; **(D4) POS Ops** receipts/min, sync backlog, kitchen-display lag; **(D5) RUM CWV** LCP/INP/CLS p75 by region/device; **(D6) Deploys** revision rollout, error rate before/after. Stored as Terraform in `terraform/monitoring/`.

**5.3 Twenty-four alert policies.** ALERT policies SHALL cover at minimum (each routed Slack `#alerts` + PagerDuty severity-aware): API 5xx > 1% 5min, API p95 > 2x SLO, Firestore read p99 > 1s, Firestore write throttle, Cloud Run instance throttle, Redis hit ratio < 80%, SW registration rate drop, RUM LCP p75 > 4s, RUM INP p75 > 500ms, CWV regression vs prior day > 20%, deploy revision rollback, billing webhook failure, Sentry error spike (auto-thresholded), POS receipt-print failure spike, kitchen-display disconnect > 5min, e-invoice queue depth, backup-verify red, cert expiry < 30d, IAM unexpected change, Workload Identity Federation failure, GCS bucket policy change, Cloud Run min-instance failure to schedule, OTel exporter failure, BigQuery RUM ingest backlog.

**5.4 Sentry release tagging.** EACH production deploy SHALL auto-create a Sentry release with: version hash, commit SHA, commit author, sourcemaps uploaded. Errors auto-attributed to the deploying revision; "regression" badge added when an error first appears in the new release.

**5.5 OpenTelemetry traces in Cloud Trace.** THE backend SHALL emit OTel spans per `world-class-performance` R6.3 and they SHALL appear in Cloud Trace with > 10% sample rate. Trace search by `tenant_id`, `user_id`, `route`, `trace_id` SHALL work in < 5 seconds.

**5.6 Distributed tracing end-to-end.** THE frontend SHALL propagate `traceparent` header (W3C Trace Context) on every API call. Backend SHALL accept and continue the trace. Firestore calls SHALL be wrapped to attach spans. ONE user click SHALL produce one connected trace from button-press to Firestore-write.

**5.7 Per-tenant observability.** SUPPORT staff SHALL be able to load a single tenant's dashboard showing: their last 24h API health, error rate, slow queries, RUM CWV for their users, last deploy seen, last backup completed, billing status. This SHALL be a Cloud Monitoring dashboard with `tenant_id` filter, NOT a separately-built UI.

**5.8 Log aggregation with retention.** THE structured logs (`world-class-performance` R6.5) SHALL ship to Cloud Logging with: 30-day hot retention, sink to GCS Coldline for 18 months (security-relevant) or 90 days (operational), BigQuery sink for queryable retention 90 days.

**5.9 Per-tenant cost attribution.** GCP costs SHALL be attributable by `tenant_id` via: Cloud Run requests (logged with tenant tag), Firestore reads/writes (counted per tenant in middleware), GCS storage (per-tenant bucket prefix). Monthly cost-per-tenant dashboard SHALL be published. Tenants whose cost-to-revenue ratio > 30% SHALL be flagged for upsell or pricing review.

**5.10 Capacity planning dashboards.** A capacity dashboard SHALL show: Cloud Run instance utilization (CPU + memory + concurrency) with thresholds for adding instances; Firestore reads/min vs read-quota; Redis memory pressure; BigQuery query slot utilization. Capacity review SHALL be a quarterly meeting with action items.

**5.11 RUM per region.** THE RUM dashboard SHALL segment by Iraqi governorate (Baghdad, Erbil, Sulaymaniyah, Basra, Mosul, Karbala, others) using IP geo-lookup. A region with > 2x worse CWV than the median SHALL trigger an investigation ticket.

**5.12 Synthetic monitoring (k6 nightly).** A scheduled GitHub Action SHALL run k6 against production nightly with read-only scripts: login, list invoices, open POS, render dashboard. Latency p95 results SHALL be charted in D1. Failures SHALL page.

**5.13 Cardinality budget.** OBSERVABILITY labels SHALL respect a cardinality budget: `tenant_id` (high), `route` (≤ 300), `status_code` (≤ 20), `region` (≤ 10). NO unbounded labels (user_id, doc_id) shall be used as metric labels — they belong in traces and logs.

**5.14 Dashboards as code.** ALL dashboards and alert policies SHALL be Terraform-managed under `terraform/monitoring/` so they can be diff-reviewed, code-reviewed, and recreated in a new project.

### Requirement 6 — Production User Acceptance Testing (UAT) with Iraqi Shopkeepers

THE Company SHALL operate **five 30-day pilots** with real Iraqi merchants across multiple verticals and governorates before claiming the product is "validated for the Iraqi shopkeeper" market. Pilots SHALL drive a backlog of real-world fixes and produce reference customers for sales.

**6.1 Pilot diversity.** THE five pilots SHALL cover at minimum: **(P-a) a supermarket** (Erbil, > 3,000 SKUs, multi-cashier), **(P-b) a restaurant** with kitchen display (Sulaymaniyah, table service + delivery), **(P-c) a pharmacy** (Baghdad, controlled-substance log, insurance billing), **(P-d) a hardware/spare-parts store** (Mosul or Erbil, heavy inventory + supplier credit), **(P-e) an electronics shop** (Baghdad, serial-tracked items, warranty handling).

**6.2 Geographic distribution.** PILOTS SHALL be distributed across at least **3 governorates** to surface region-specific issues (electricity-cut frequency, internet reliability, postal-address conventions, local tax-office variation).

**6.3 Pilot agreement template.** EACH pilot SHALL sign a written 90-day pilot agreement granting: 90 days free service, dedicated WhatsApp support line, weekly check-in calls, hardware loan (printer + scanner + tablet) if the merchant doesn't already own. In exchange: usage data, named case-study rights, willingness to take a 30-min sales reference call.

**6.4 Hardware deployment.** EACH pilot SHALL operate on real production hardware: a **thermal printer 80mm** (USB or Bluetooth, USD 50–120), a **barcode scanner** (USB handheld, USD 25–60), an **Android tablet** 10-inch (USD 150–300 if loaned), optional **cash drawer** (USD 80–150). Hardware budget per pilot: USD 200–500.

**6.5 Real transaction volume.** EACH pilot SHALL reach **≥ 50 transactions/day** average by week 2 (allow ramp). Below 50/day, the pilot SHALL be deemed insufficient signal and either extended or replaced. Transaction count auto-monitored via R5 dashboard.

**6.6 Daily check-ins for first 14 days.** A pilot manager (initially the founder, later the Customer Support Lead) SHALL run **daily 10-minute WhatsApp video check-ins** for the first 14 days, then 3x/week for the next 16 days. Notes filed per pilot in `pilots/<name>/log/`.

**6.7 Issue triage SLA.** ISSUES raised by pilots SHALL be triaged within: **P0 same-day fix** (POS won't open, can't print, can't take payment), **P1 within 24h** (specific workflow broken), **P2 within 1 week** (UX irritation), **P3 within 1 month** (nice-to-have). P0/P1 backlog SHALL be < 3 open at any time per pilot.

**6.8 Weekly release to pilots.** A dedicated **pilot release channel** (a separate Cloud Run revision tagged `pilot`) SHALL receive weekly pre-prod releases with fixes. Once stable for 1 week, pilot revisions promote to general production. This isolates pilot risk from existing 100 paying customers.

**6.9 Success metrics per pilot.** EACH pilot SHALL be measured on: (a) Daily Active Use (≥ 80% of business days), (b) NPS ≥ 30 at exit, (c) Sales velocity uplift or workflow time saved per the merchant's report, (d) Bugs found and closed, (e) Willingness to convert to paid (≥ 70% Yes target).

**6.10 NPS + CSAT surveys.** AT day 14 and day 30 of each pilot, the merchant SHALL complete an NPS survey (Kurdish + Arabic options) and a CSAT per-workflow rating. Surveys collected via a tracked WhatsApp-friendly form. Results published in `pilots/results.md`.

**6.11 Iteration cadence.** EACH Monday during the pilot phase, the engineering team SHALL hold a 1-hour **Pilot Review** meeting reviewing: open P0/P1, NPS trend, asks blocked on engineering vs sales vs legal. Output: top-3 things to ship this week per pilot.

**6.12 Case studies.** AT pilot exit (or graduation to paying), the founder SHALL author a 1-page case study including: merchant context, baseline pain, what we changed, measurable outcome (e.g., "checkout time -40%", "stock-take from 6h to 30min"), pull-quote, optional photo. Case studies live at `/customers/<name>` on the marketing site (with explicit permission).

**6.13 Sales reference enablement.** EACH graduated pilot SHALL be added to a **sales reference pool** with: contact name + role, willingness window (calls allowed Mon-Wed 10:00–12:00), languages, vertical, governorate. Sales SHALL not contact references > once per quarter to preserve goodwill.

**6.14 Power-user training videos.** FROM pilot feedback, the Customer Support Lead SHALL record short Kurdish + Arabic training videos (3–7 minutes each) covering the 10 most-asked questions. Hosted on the in-app `kb` (Wave A) module and Iraqi-friendly platforms (Telegram, WhatsApp).

**6.15 Iraq-specific edge cases logged.** A dedicated tracker `pilots/iraq-edge-cases.md` SHALL collect findings such as: rounding to nearest 250 IQD vs 50 IQD per region; Friday closure handling (1-day vs half-day); Ramadan hours (POS opens after Iftar); power-cut auto-reopen behaviour; "credit on the book" حساب دفتر workflow for trusted customers; supplier-takeback workflows. Each item SHALL produce either an issue ticket, a feature in `growth-to-100`/`world-class-performance`, or an explicit out-of-scope decision.

**6.16 Graduation criteria.** A pilot SHALL graduate when: NPS ≥ 30, P0/P1 backlog = 0, the merchant converts to a paid plan or signs a letter committing to convert at end of grace, and the case study is approved. Non-graduating pilots SHALL be debriefed for learning and politely closed.

**6.17 Sample-size note and acknowledgement of limits.** WE EXPLICITLY accept that 5 pilots × 30 days is statistically weak; this is a **qualitative validation**, not a market study. Quantitative validation belongs in `growth-to-100` and beyond. The success of this requirement is "we know what's broken for real Iraqi shops" — not "we have proven product-market fit."

---

## Non-Functional Requirements Summary

| ID | NFR | Target |
|----|-----|--------|
| NFR-SF.1 | Bus factor (people whose simultaneous absence stops the business) | ≥ 3 by end of SF1 |
| NFR-SF.2 | Time to revoke a leaving employee's GCP access | ≤ 24 h, weekly audit |
| NFR-SF.3 | Time-to-first-acknowledge a P1 page | ≤ 5 min primary, ≤ 15 min secondary |
| NFR-SF.4 | RPO | ≤ 5 min internally; ≤ 1 h publicly committed |
| NFR-SF.5 | RTO | ≤ 1 h internally; ≤ 4 h publicly committed |
| NFR-SF.6 | DR drill cadence | Quarterly, full restore |
| NFR-SF.7 | Backup-verify cadence | Weekly random sample |
| NFR-SF.8 | Backup retention | 30d daily / 12w weekly / 12m monthly / 7y yearly |
| NFR-SF.9 | Pen test cadence | Annual + after major architecture change |
| NFR-SF.10 | Pen test budget per engagement | USD 20K–40K |
| NFR-SF.11 | SOC 2 Type I target date | Month 18 of SF1 |
| NFR-SF.12 | Bug bounty annual payout budget | USD 5K–15K |
| NFR-SF.13 | Security-incident notification (breach to authority) | ≤ 72 h (GDPR/PDPL) |
| NFR-SF.14 | Cross-tenant access attempt test coverage | ≥ 200 endpoint × tenant pairs in CI |
| NFR-SF.15 | Dashboards in production | 6 named, Terraform-managed |
| NFR-SF.16 | Alert policies live | ≥ 24 |
| NFR-SF.17 | Pilots executed | 5, ≥ 30 days each |
| NFR-SF.18 | Pilot NPS at exit | ≥ 30 (median across 5) |
| NFR-SF.19 | Pilot graduation rate | ≥ 60% (3 of 5 convert to paid + reference) |
| NFR-SF.20 | Lawyer engagement budget | USD 5K–10K cumulative through SF2 |
| NFR-SF.21 | Iraqi LLC formation cost | USD 1.5K–3K |
| NFR-SF.22 | Insurance annual premium | USD 3.5K–8K |
| NFR-SF.23 | Audit log retention | ≥ 18 months |
| NFR-SF.24 | Customer-support response time | ≤ 30 min business hours / ≤ 4 h after hours |
| NFR-SF.25 | Public uptime commitment (SLA) | 99.5% monthly |

---

## Out of Scope

Explicit non-goals for this spec — to be addressed elsewhere or deferred:

1. **SOC 2 Type II attestation** — Type I is sufficient at this stage; Type II is in `growth-to-1000-customers`.
2. **ISO 27001 full certification** — gap analysis only here; full cert deferred.
3. **PCI-DSS** — we do not store card data (payment processor tokenizes); applies only if we change that.
4. **HIPAA / Iraqi health-data law** — only relevant for the healthcare ext module at high pilot volume; deferred.
5. **Multi-region active-active deployment** — out of scope; primary me-central1 with DR restore is the chosen posture for this phase.
6. **Enterprise SSO (SAML, OIDC federation)** — addressed in `growth-to-100` for the enterprise tier feature.
7. **Public bug bounty (HackerOne public program)** — private only in this phase; public deferred to after SOC 2.
8. **Quantitative product-market-fit study (statistically significant pilot)** — qualitative only here; statistically powered cohort study deferred.
9. **Hiring beyond the first 3** — sales, marketing, additional engineering belong in `growth-to-1000`.
10. **Internationalization beyond Iraq** — Gulf, Levant, EU markets are not in this spec.

---

## Acceptance — the 1000-customer readiness milestone

THE SPEC is considered **accepted** when **all** of the following hold:

- **A1** Three people other than the founder can perform a complete deploy, take a P1 page, authorize a refund, and access customer data through the documented procedure, demonstrated in a recorded handover session.
- **A2** Iraqi LLC certificate, tax registrations, ToS, Privacy Policy, DPA, SLA, sub-processor list, AUP, and refund policy are all published and dated within the last 12 months.
- **A3** A quarterly DR drill is recorded in `audit/dr/` with a full successful restore in ≤ 1 hour, and `backup-verify.yml` is green for the last 4 consecutive weeks.
- **A4** An external pen test report dated within the last 12 months shows zero Critical and zero High open findings; SOC 2 Type I attestation is in progress with a documented target date ≤ 6 months out; bug bounty program is live (private OK) with at least one valid submission triaged.
- **A5** Six dashboards exist and have been used in a real incident; alert policies have fired at least 5 times and been acknowledged through PagerDuty/Opsgenie; OTel traces are searchable end-to-end for any request in the last 7 days.
- **A6** Five pilots have completed at least 30 days each; median NPS ≥ 30; at least 3 of 5 are paying customers or signed letters of intent; case studies are published with merchant consent; the Iraq-edge-cases tracker has been triaged through the backlog.
- **A7** All NFR-SF.* targets above are met or have a dated written exception approved by the leadership team (≥ 2 of 3 sign-off).

When A1–A7 are true, the platform is structurally ready to absorb 10× current load, withstand an unannounced two-week founder absence, pass an enterprise procurement security questionnaire, and weather a SEV1 without losing customers. **That is "Scale Foundation done."**
