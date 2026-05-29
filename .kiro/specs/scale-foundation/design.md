# Design Document: Scale Foundation (100 → 1000+ Customers)

> **Spec ID:** `scale-foundation`
> **Companion to:** `requirements.md`
> **Status:** Draft v1.0
> **Owner:** Safa Othman + (incoming) Ops/SRE Lead + (incoming) Senior FE
> **Scope:** The engineering, organizational, legal, and process design that operationalizes the six requirement groups.

---

## Introduction & scaling architecture diagram

This document is the *how* behind the *what* of `requirements.md`. Where the requirements answer "what must be true for us to credibly serve 1000+ customers?", this design answers "what specific systems, processes, vendors, runbooks, and contracts will we put in place to make it true?"

At a glance, the architecture going from 100 → 1000 tenants looks like this:

```
                 ┌──────────────────────────────────────────────────────────┐
                 │                  Customer Surface                        │
                 │  Web app (Vercel/CF edge) · Mobile (Capacitor) · POS PWA│
                 └────────────────────┬─────────────────────────────────────┘
                                      │  W3C traceparent
                 ┌────────────────────▼─────────────────────────────────────┐
                 │   Cloud Run (me-central1)  min=1, max=20, conc=80        │
                 │   FastAPI · OTel · structured JSON logs · Redis client   │
                 └────┬─────────────┬────────────────┬──────────────────────┘
                      │             │                │
            ┌─────────▼────┐ ┌──────▼─────┐  ┌───────▼────────┐
            │  Firestore   │ │   Redis    │  │ GCS (artifacts │
            │  multi-tenant│ │   (cache,  │  │  backups, RUM) │
            │  + PITR 7d   │ │   ratelim) │  └───────┬────────┘
            └────┬─────────┘ └────────────┘          │
                 │ nightly export + CDC               │ cross-region
                 │                                    │ to eu-west4
                 ▼                                    ▼
            ┌─────────────┐                  ┌────────────────┐
            │ GCS backup  │  weekly verify   │ Cold backup    │
            │ bucket(prim)│ ◀─── restore ───▶│ bucket(sec)    │
            └─────────────┘                  └────────────────┘

                ┌───────────────── Observability plane ─────────────────┐
                │ OTel collector → Cloud Trace · Cloud Monitoring · BQ  │
                │ Sentry (errors+RUM frontend) · Cloud Logging          │
                │ PagerDuty/Opsgenie ◀ alert policies (24) ◀ dashboards │
                └────────────────────────────────────────────────────────┘

                ┌──────────────────  Human plane  ─────────────────────┐
                │ Founder + Sr.FE + Ops/SRE + Support × 2  on rotation │
                │ Runbook ownership matrix · ADRs · Quarterly DR drill │
                │ Lawyer (Iraq) · Insurance broker · Pen-test firm     │
                └───────────────────────────────────────────────────────┘
```

Three structural shifts happen across this spec:

1. **From a single brain to a 3-person operational core.** People, schedules, runbooks, paging.
2. **From "we have backups" to "we have proven restore."** Drilled, automated, customer-visible.
3. **From "we instrumented" to "we operate from dashboards."** Six dashboards become the operating cockpit.

Sections 1–7 below detail each.

---

## Section 1 — Team & Operations

### 1.1 Hiring plan and JD templates

**Hire #1 — Senior Frontend / Full-Stack Engineer (month 1, USD 30K–48K/yr).**
The first hire is the founder's executor: someone who can ship features end-to-end across React + TypeScript + Python without supervision. Required: ≥ 5 years professional, ≥ 2 years React + TS, Firestore familiarity, Kurdish OR Arabic fluency. Strong-plus: prior fintech/ERP, prior multi-tenant SaaS, prior Iraqi market.

JD outline (full template in `docs/hr/jd-senior-fe-fs.md`):
- Headline + company pitch (3 sentences, Kurdish/English bilingual)
- What you'll do (5 bullets)
- What we expect (must-haves + nice-to-haves)
- Comp (publish band openly, not "competitive"): IQD 3.5M–6M/month + equity 0.25%–0.75%
- Process: take-home (4h paid) → pair-coding (90 min) → founder chat → reference checks → offer

**Hire #2 — Operations / SRE / Customer Success (month 2, USD 24K–42K/yr).**
This is the person who runs incidents, owns dashboards, owns the runbooks, and is the second pager. Required: production ops experience (Linux + cloud), some scripting (Python or bash), willingness to pick up Cloud Run + Firestore, customer-facing comfort (incident comms), Kurdish + Arabic.

**Hire #3 — Customer Support Specialist (month 4, USD 7K–14K/yr).**
Front-line for the inbox/WhatsApp. Required: spoken + written Kurdish + Arabic, comfortable with software, patience. Will be trained on the product week 1, on incident comms week 2.

A pinned design decision: **all three first hires need at least one Iraqi language fluently.** Customer support cannot be outsourced to English-only.

### 1.2 Comp bands and equity

Published internally and to candidates as a 6×3 matrix (level × function). For a privately-held Iraqi LLC, equity is offered as a phantom-share scheme until conversion (see Section 2). Vesting: 4-year, 1-year cliff, monthly thereafter, double-trigger acceleration on acquisition.

| Function | Junior | Mid | Senior | Lead | Principal |
|----------|--------|-----|--------|------|-----------|
| Engineering | USD 8–14K | 14–24K | 24–42K | 42–60K | 60K+ |
| Ops/SRE | USD 8–14K | 14–24K | 24–42K | 42–55K | — |
| Support | USD 7–12K | 12–18K | 18–28K | 28–40K | — |

Bands are reviewed semi-annually and benchmarked against KRG/Baghdad market via a private survey shared with 2–3 peer founders.

### 1.3 Paging platform: PagerDuty vs Opsgenie selection

**Recommendation: PagerDuty.** Reasoning:
- Better Iraqi-mobile SMS reliability via international carrier partnerships.
- Native Slack + Microsoft Teams integration (we use Slack).
- Built-in incident management (postmortems, SEV tagging).
- Pricing: USD 21–41/user/month — at 3 users, USD 63–123/month — acceptable.

**Opsgenie acceptable alternative** at USD 9–29/user/month if PagerDuty cost becomes a friction. Atlassian integration is a plus if we ever adopt Jira.

Escalation policy (PagerDuty terms):
- Layer 0: primary on-call (5 min)
- Layer 1: secondary on-call (10 min after layer 0)
- Layer 2: founder (15 min after layer 1)
- Layer 3: founder voice call + WhatsApp (30 min after layer 1)

Schedule: 3-engineer rotation, 1 week each, Sunday 00:00 Baghdad handoff. Holidays handled via "override" feature.

### 1.4 Runbook ownership matrix (RACI)

Each runbook lives in `docs/runbooks/<name>.md` with a YAML header:

```yaml
title: Cloud Run deploy rollback
owner: ops-sre
backup: senior-fe
last_drill: 2026-03-15
severity_when_triggered: P1
estimated_runtime_min: 10
```

The 12 mandatory runbooks (R1.7 in requirements):

| # | Runbook | Owner | Backup |
|---|---------|-------|--------|
| 1 | Full-region outage | Ops/SRE | Founder |
| 2 | Firestore write throttling | Senior FE | Ops/SRE |
| 3 | Cloud Run deploy rollback | Ops/SRE | Senior FE |
| 4 | Billing webhook failure | Founder | Senior FE |
| 5 | Customer-reported data loss | Ops/SRE | Founder |
| 6 | POS sync stuck (offline queue) | Senior FE | Ops/SRE |
| 7 | Login / auth spike (DDoS suspect) | Ops/SRE | Senior FE |
| 8 | Receipt-printer mass failure | Support | Senior FE |
| 9 | E-invoice submission backlog | Senior FE | Founder |
| 10 | Sentry alert storm | Ops/SRE | Senior FE |
| 11 | Account takeover (credential stuffing) | Founder | Ops/SRE |
| 12 | Pen-test critical finding remediation | Founder | Ops/SRE |

Each runbook reviewed quarterly during a 90-min runbook drill.

### 1.5 Knowledge management — Notion vs Confluence vs GitBook

**Recommendation: Notion + version-controlled `docs/` in repo.**
- Notion for living, frequently edited content: HR handbook, onboarding, sales playbook, customer notes, meeting notes.
- `docs/` for engineering: ADRs, runbooks, handbook chapters that need to be referenced from code/CI.

Confluence rejected: heavier, expensive at small scale.
GitBook rejected: yet another tool; markdown in repo is sufficient.

A weekly "doc-hygiene Friday" — 30 min where on-call closes stale notes.

### 1.6 Architecture Decision Records (ADR) process

Template: `docs/adr/NNNN-title.md` using the **Michael Nygard format**:

```
# ADR-NNNN: Title
Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by ADR-NNNN
Context: ...
Decision: ...
Consequences: ...
Alternatives considered: ...
```

Cadence: every architecture decision worth a Slack debate (> 2 messages) gets an ADR. The 20 mandatory ADRs from R1.9 are seeded in SF1 phase 1.

Review: ADRs receive 2 reviewer approvals before "Accepted." A monthly 30-min ADR review surfaces drift.

### 1.7 Performance management — 1:1s and 360s

- **Weekly 1:1** 30 min per direct report, agenda template in Notion: "what's working, what's blocked, what's next, growth."
- **Quarterly written 360** via anonymous Google Form with 5 questions: communication, technical bar, ownership, what to start, what to stop.
- **Semi-annual compensation review** triggered by 360 + market benchmark.
- **Founder gets 360 too.** Reports submit to a designated board member or external advisor (we don't have a formal board yet — a paid advisor at USD 1K/quarter works).

### 1.8 Knowledge transfer — the 30/60/90 plan

Every hire gets:
- **Day 1–30:** product tour, customer-call shadow, write 3 issues + fix 1, read all ADRs.
- **Day 31–60:** own 1 module end-to-end, run 1 deploy, shadow on-call, write 1 runbook.
- **Day 61–90:** primary on-call for 1 week, lead 1 customer call, ship 1 P0 fix, contribute 1 ADR.

If a 90-day check fails any of those criteria, we have a misfire and decide explicitly: extend, reassign, or part ways.

---

## Section 2 — Legal & Compliance

### 2.1 Iraqi LLC formation — step by step

The Iraqi LLC ("شركة ذات مسؤولية محدودة") for a SaaS company is formed via:

1. **Reserve company name** with the Companies Registrar (1–2 weeks). Cost: ~ IQD 50,000.
2. **Draft Articles of Association** with a notary public. Cost: ~ IQD 200,000–500,000.
3. **Deposit minimum capital** to a designated bank account (IQD 1,000,000+). The capital is unblocked after registration.
4. **Submit incorporation file** to the Companies Registrar with founders' IDs, articles, capital deposit slip. Government fees ~ IQD 250,000.
5. **Obtain commercial registration certificate** (2–6 weeks).
6. **Join the Chamber of Commerce** in the relevant governorate (Erbil for KRG, Baghdad for Federal). Annual fee ~ IQD 150,000.
7. **Open a corporate bank account** (Bank of Baghdad, FIB, or KIB are SaaS-friendly).
8. **Register with the GCT** for VAT (when applicable) and corporate income tax.

End-to-end realistic timeline: **6–10 weeks**. Total out-of-pocket: **USD 1,500–3,000** including lawyer fees.

Legal vendor recommendation: a mid-size Erbil firm (e.g., Sarwar Law Firm tier, NRT Legal, Kurdistan Legal Advisors). Avoid the very largest (Patton Boggs, Crowell & Moring) — they price for oil-and-gas, not SaaS.

### 2.2 Terms of Service — structure

The ToS template (drafted by counsel from the outline below) covers:

1. **Acceptance & eligibility.** Customer must be 18+, authorized representative of the entity.
2. **Account & access.** Credentials confidentiality, user-count limits per plan.
3. **Payment.** Pricing, billing cycle, taxes, late fees, currency (IQD primary, USD alternative).
4. **Acceptable use.** Reference to AUP.
5. **IP.** Company owns the platform; customer owns their data.
6. **Confidentiality.** Mutual.
7. **Warranties.** Limited; "as-is" with named carve-outs for SLA.
8. **Liability cap.** Greater of (a) 12 months of fees paid or (b) USD 5,000 — whichever is higher; carve-out for gross negligence + IP indemnity.
9. **Indemnification.** Customer indemnifies for misuse; Company indemnifies for IP infringement of the platform itself.
10. **Term & termination.** Auto-renew; 30-day notice to cancel; export window 30 days post-termination.
11. **Governing law.** Iraqi commercial law; Erbil courts; arbitration option for amounts > USD 50,000 via Iraq Arbitration Centre or Dubai International Arbitration Centre.
12. **Force majeure.** Includes electricity outage > 8h, nationwide internet outage, government blocking, currency-controls intervention.
13. **Modifications.** 30-day notice via email + in-app; continued use = acceptance.

Two language versions — Arabic (legally binding) and English (for international customers). Kurdish translation provided as courtesy but Arabic governs.

### 2.3 Privacy Policy — PDPL + GDPR dual compliance

The policy is structured as:

1. **Who we are** (controller + DPO email).
2. **What data we collect** (categorized table: account info, business records, usage data, support comms, device/network metadata).
3. **Why** (lawful basis): contract performance, legitimate interests, consent (analytics), legal obligation.
4. **How long we keep it** (alignment to retention schedule).
5. **Who we share with** (sub-processors list — link to live page).
6. **Where it goes** (Google Cloud me-central1 primary + eu-west4 backup; cross-border transfer disclosure).
7. **Your rights** (PDPL: access, correction, deletion, objection; GDPR Articles 15–22).
8. **How to exercise rights** (in-app form, email, postal address).
9. **Children** (not directed at under-18s).
10. **Changes** (notify 30 days in advance for material).
11. **Contact** (DPO email + postal).

Drafted alongside ToS by Iraqi counsel; reviewed by GDPR-conversant lawyer (one-time engagement ~ USD 1,500).

### 2.4 Data Processing Agreement (DPA) template

Anchored on **EU SCC 2021 modules + Iraqi PDPL Article 18 derivatives**. Sections:

1. **Definitions** (controller, processor, sub-processor, personal data).
2. **Subject matter, duration, nature, purpose.**
3. **Processor duties:** confidentiality, security (Annex II), assistance, sub-processors (Annex III), deletion at term, audit support.
4. **Sub-processor list** (Annex III, link to live page; 30-day right-of-objection on new sub-processors).
5. **Security measures** (Annex II, technical + organizational — encryption, access control, backups, incident response).
6. **Breach notification** within 24h to controller (regardless of severity); controller has 72h to authority per GDPR.
7. **International transfers** — disclosed; SCCs incorporated where EU data subjects are involved.
8. **Audit rights** — once/year, 30-day notice, business hours, mutual NDA.
9. **Term & termination.**
10. **Annexes I/II/III.**

Executable via clickwrap for SMB; counterpart-signed PDF for enterprise.

### 2.5 MSA structure

Master Service Agreement is the framework for enterprise (≥ USD 10K ARR). It pairs with **Order Forms** that specify scope.

Key clauses in MSA:
- **Order forms govern** scope, pricing, term.
- **SLA Exhibit** with credit ladder (R2.7).
- **Support tiers** (Standard / Priority / Premier).
- **Custom data residency** options (e.g., me-central1-only for sensitive customers).
- **Audit rights** beyond DPA (subject to NDA + frequency cap).
- **Insurance certificates** (we provide, customer may request).
- **Termination for convenience** with notice + pro-rated refund.

### 2.6 SLA structure and credit ladder

| Monthly uptime | Service credit |
|----------------|----------------|
| ≥ 99.5% | 0% |
| 99.0% – 99.49% | 10% of monthly fees |
| 95.0% – 98.99% | 25% |
| < 95.0% | 50% |

Maximum credits per month: 100% of that month's fees. Credits applied to next invoice; not refunded in cash. Customer must claim within 30 days of incident.

Excluded from downtime: scheduled maintenance (≤ 4h/month with 72h notice), force-majeure events, customer-caused outages, sub-processor outages exceeding their SLA (we pass through).

### 2.7 Iraqi LLC formation — vendor list

Suggested legal counsel options (cost-ordered):

| Firm | Strength | Indicative fee |
|------|----------|----------------|
| Solo Iraqi commercial lawyer (Erbil/Baghdad) | Cheap, fast | USD 1,000–2,500 |
| Mid-size Iraqi firm (e.g., Sarwar, NRT Legal) | Good for SaaS, bilingual | USD 3,000–6,000 |
| Regional firm (Al Tamimi, Clyde & Co Iraq desk) | Enterprise-grade | USD 10,000+ |

Recommendation: **Mid-size Iraqi firm** for the foundational ToS + Privacy + DPA + LLC formation. Total budget: **USD 5,000–8,000** across SF2.

### 2.8 Insurance — brokers and carriers

For Iraqi-domiciled SaaS, the path to cyber + E&O insurance typically routes through **Dubai-based brokers** (Marsh, Aon, AHC Insurance) who place with London or international carriers. Iraqi insurance carriers exist (e.g., AIG Iraq, Iraqi Insurance Company) but cyber-specific products are rare locally.

Process:
1. Engage broker (free; they earn commission).
2. Complete underwriting questionnaire (~ 50 questions: security, employees, revenue, data volumes).
3. Receive 2–3 quotes.
4. Choose USD 1M cyber + USD 1M E&O combined.
5. Estimated annual premium: **USD 3,500–8,000**.

Typical inclusions:
- Cyber: breach response (forensic, notification, credit monitoring), regulatory fines (where insurable), business interruption, cyber extortion.
- E&O: professional liability for software defects, missed-deliverable claims.

Exclusions to negotiate: war/terrorism (Iraq risk pushes premium; broker can sometimes carve back limited cover), sanctioned-entity transactions.

### 2.9 IP-assignment for employees and contractors

Two templates:

**Employee IPA** clauses: assignment of all work product, moral-rights waiver, prior IP disclosure schedule, post-termination cooperation, non-solicit 12 months.

**Contractor IPA** clauses: project-scoped or service-scoped assignment, payment-conditional vesting of IP, license-back of background IP, indemnity for third-party IP.

Both drafted by Iraqi counsel; signed at offer-acceptance. Stored encrypted in `people/<name>/` with restricted ACL.

### 2.10 Compliance calendar

A YAML calendar `docs/compliance/calendar.yml` lists every recurring obligation with owner + due date + grace + escalation:

- Quarterly VAT return (GCT) — owner: external accountant
- Annual corporate income tax — owner: external accountant
- Quarterly Chamber of Commerce dues — owner: Founder/admin
- Annual LLC renewal — owner: lawyer
- Annual insurance renewal — owner: Founder
- Annual pen test scheduling — owner: Ops/SRE
- Annual SOC 2 attestation — owner: Ops/SRE
- Quarterly DR drill — owner: rotating DR Captain
- Weekly backup verify — owner: on-call

Calendar is mirrored in Google Calendar with 14-day and 1-day reminders.

---

## Section 3 — Disaster Recovery design

### 3.1 Backup architecture

```
   Production Firestore (me-central1)
     │
     │ (a) Native PITR enabled (7-day window)
     │ (b) Scheduled daily export at 02:00 Baghdad → GCS primary bucket
     │ (c) Optional CDC: Firestore triggers → Pub/Sub → GCS append-only log
     ▼
   gs://kerp-backup-primary/  (Standard storage, lifecycle to Nearline at 30d, Coldline at 90d, Archive at 365d)
     │
     │ GCS native replication (Turbo Replication) to europe-west4
     ▼
   gs://kerp-backup-secondary/  (cold, immutable via Bucket Lock)
```

Choice between (a) PITR vs (b) export vs (c) CDC: we use **both PITR and nightly export**.
- PITR gives sub-minute RPO for the last 7 days at zero operational cost beyond a Firestore tier upgrade.
- Nightly export gives auditable, long-term restore capability and is required for the 7-year yearly retention.

CDC is deferred unless RPO < 5 min becomes binding (which it doesn't with PITR active).

### 3.2 Restore procedures — full and per-tenant

**Full restore (catastrophic loss).** Documented in `docs/runbooks/dr-full-restore.md`:

1. Declare incident; notify customers via status page within 15 min.
2. Stand up restore project (`kurdish-erp-restore-YYYYMMDD`).
3. Choose RPO target: PITR timestamp (for last-7d) OR latest nightly export.
4. Run Firestore import from GCS to the restore project.
5. Validate row counts vs pre-incident dashboard snapshot.
6. Update DNS/Cloud Run to point at restore project.
7. Warm caches via synthetic load.
8. Notify customers of restoration; post incident bulletin.
9. Schedule postmortem within 5 business days.

Target end-to-end: **≤ 60 min**.

**Per-tenant restore.** Documented in `docs/runbooks/dr-per-tenant-restore.md`:

1. Customer raises request via in-app form or email; ticket auto-created.
2. Support confirms tenant ownership (auth check + secondary email).
3. Ops/SRE chooses PITR timestamp or nightly export.
4. Extract that tenant's docs only (filter by `tenant_id` during export job).
5. Stage extracted docs in a sandbox project.
6. Generate diff report for customer review.
7. Customer + Ops/SRE both approve (4-eyes).
8. Apply merge to live tenant: keys updated, old docs soft-deleted to `_restore_archive` collection.
9. Customer notified; restore-event entry written to audit log.

Target end-to-end: **≤ 2 h** including customer approval cycle.

### 3.3 PITR + 7-day window

Firestore native PITR is enabled on the production database. Cost impact: ~ 30% bump on storage line (acceptable). Window: 7 days.

The 7-day window is the **operational RPO**; the nightly export is the **operational RTO floor for older recovery**. Customers can request restore to any 5-minute boundary within 7 days, or to any nightly snapshot in the last 12 months.

### 3.4 Cross-region failover

In a primary-region outage:
- **DNS:** Cloud DNS with 60-second TTL on the API record. Failover handled manually (we don't auto-fail because Firestore is single-region; we'd be writing to a stale restore).
- **Cloud Run:** revisions pinned in both me-central1 (primary) and europe-west4 (warm standby, scaled to 0).
- **Firestore:** restore from cross-region backup into a europe-west4 Firestore project. RTO 1–4 h.

This is **active-passive**, not active-active. Active-active is deferred (see Out of Scope).

### 3.5 DR drill procedure (quarterly)

Drill SLA:
- Announced 7 days in advance to engineering, except for one annual unannounced drill.
- Conducted in non-production project.
- DR Captain runs, secondary observes.
- Total drill window: 4 hours.
- Required artifacts: timing log, restore success/fail, integrity report, action items.

Filed at `audit/dr/YYYY-QN/drill-report.md`.

Quarterly summary published to leadership.

### 3.6 Customer communication during DR

Templates pre-written in `docs/runbooks/dr-comms-templates.md`:

- **15-min status-page update:** "We are investigating a service degradation affecting <area>. Updates every 30 minutes."
- **1-hour status-page update:** confirmed scope + estimated restore time.
- **Email (within 1h):** affected tenant admins receive a templated email with incident summary + workarounds.
- **WhatsApp (enterprise, within 30 min):** direct message from Support Lead via the customer's emergency contact.

After resolution, a postmortem summary email goes to affected customers within 5 business days.

---

## Section 4 — Security architecture

### 4.1 Tenant isolation design

**Firestore Rules** are the primary enforcement. Pattern:

```
match /tenants/{tid}/{document=**} {
  allow read, write: if request.auth.token.tenant_id == tid
                     && request.auth.token.tenant_id != null
                     && resource.data.tenant_id == tid;
}

match /collectionGroup/contacts {
  allow read: if request.auth.token.tenant_id == resource.data.tenant_id;
}
```

Three defenses, defense-in-depth:

1. **Rules** verify `auth.token.tenant_id == resource.data.tenant_id` on every read/write.
2. **Backend middleware** verifies the JWT `tenant_id` matches the route's tenant scope before any Firestore call.
3. **Server-side query** always includes a `where('tenant_id', '==', current_tid)` clause; if missing, a custom lint rule fails CI.

### 4.2 JWT structure

```json
{
  "iss": "https://auth.kerp.iq",
  "aud": "kerp-api",
  "sub": "user_<id>",
  "tenant_id": "tnt_<id>",
  "membership_id": "mbr_<id>",
  "roles": ["admin"],
  "permissions": ["invoices.read", "invoices.write"],
  "iat": 1717000000,
  "exp": 1717003600,
  "jti": "<unique>"
}
```

The `tenant_id` is set server-side based on the **server-recorded membership**, never trusted from client. Token-refresh flow re-checks membership.

### 4.3 API authentication + authorization layers

```
   Request
     │
     ▼
   Cloud Run ingress (HTTPS, HSTS)
     │
     ▼
   FastAPI middleware [auth_required] → verify JWT signature, exp, iss, aud
     │
     ▼
   FastAPI middleware [tenant_resolve] → load membership, set request.state.tenant_id
     │
     ▼
   FastAPI dependency [require_permission(perm)] per route → load RBAC role, check perm
     │
     ▼
   Route handler → all queries filter by request.state.tenant_id
     │
     ▼
   Firestore SDK → query + Rules also enforce
```

Each layer is independently testable. A failure in any layer denies the request.

### 4.4 Encryption

- **At rest:** Google-managed keys on Firestore + GCS. CMEK option offered to enterprise customers paying for it.
- **In transit:** TLS 1.3 everywhere; HSTS preload (`max-age=31536000; includeSubDomains; preload`); certificate pinning at mobile app.

### 4.5 Secret rotation

Quarterly rotation jobs (Cloud Scheduler → Cloud Function):
- Database service-account keys avoided in favor of Workload Identity Federation.
- Sentry DSN rotation annual.
- SECRET_KEY (FastAPI session) 180-day.
- Payment-processor keys per processor policy.

Rotation events logged to audit log.

### 4.6 Pen-test vendor evaluation

We evaluate 4 vendors:

| Vendor | Pro | Con | Indicative quote (2-week scoped test) |
|--------|-----|-----|----------------------------------------|
| **Bishop Fox** | Strong web + cloud, US-based, well-known | Pricey, US-timezone | USD 35K–45K |
| **Trail of Bits** | Top-tier reputation, open-source contributions | Booked out, expensive | USD 40K–55K |
| **NCC Group** | Broad expertise, EU offices | Less SaaS-specialized | USD 25K–35K |
| **Help AG (Dubai)** | Regional, faster, cheaper, Arabic-capable reports | Lower brand-name vs above | USD 18K–28K |

**Recommendation: Help AG (Dubai) for initial test; NCC Group for second test in year 2 once the team is more mature.** Brand-name only matters for enterprise sales after Series A; in the meantime, regional + price wins.

Scope agreed in writing:
- White-box (we share repo access)
- 2-week active testing window
- Multi-tenancy + IDOR primary focus
- Web app + API + mobile
- Findings retest included
- Final report in English + Arabic summary
- Remediation SLA: Critical 24h, High 7d, Medium 30d, Low 90d

### 4.7 SOC 2 Type I path

**Vendor selection:** Vanta vs Drata vs Secureframe.

| Vendor | Pro | Con | Annual subscription |
|--------|-----|-----|---------------------|
| **Vanta** | Largest, most integrations, mature playbook | Most expensive | USD 11K–18K |
| **Drata** | Strong automation, Firestore connector | Younger | USD 8K–14K |
| **Secureframe** | Mid-priced, decent automation | Smaller integration catalog | USD 8K–13K |

**Recommendation: Drata.** Pricing tier and Firestore connector best for us.

**Auditor selection (separate from automation vendor):**
- A-LIGN — well-known, mid-priced
- Prescient Assurance — startup-friendly, well-priced
- Sensiba — boutique, fast

**Recommendation: Prescient Assurance** for Type I. Audit fee USD 15K–25K. Combined with Drata subscription: total SOC 2 Type I path budget **USD 25K–35K**.

Timeline: month 9 start, month 18 attestation issued. 6 months of evidence collection + 3 months audit fieldwork + report.

### 4.8 Bug bounty program

**Platform: Bugcrowd** (cheaper than HackerOne for smaller co's; equally reputable for private programs).

- **Year 1:** Private program with ~ 30 invited researchers.
- **Scope:** *.kerp.iq web + API; mobile out of scope in year 1.
- **Out-of-scope:** Self-XSS, missing headers without impact, social engineering, physical attacks, third-party services.
- **Payouts:** Critical USD 1,500; High USD 600; Medium USD 250; Low USD 75.
- **Triage SLA:** initial ack 48h; severity assignment 5 business days; payout on validation.
- **Annual budget cap:** USD 12K (sufficient for ~ 10 medium + 3 high + 2 critical).

Going public deferred until after SOC 2 Type I.

### 4.9 Incident classification + comms

| Severity | Examples | Response | Customer comms |
|----------|----------|----------|----------------|
| **S1 — Personal data breach / cross-tenant exposure** | Confirmed leak; rules bypass; data exfiltration | All-hands; founder + lawyer; 72h regulator | Email + status page + WhatsApp + press if material |
| **S2 — Severe service outage** | API down; POS unable to take payments | On-call + secondary | Status page within 15 min; email within 1h |
| **S3 — Partial impact** | One module down; one region degraded | On-call | Status page within 30 min |
| **S4 — Internal-only** | Build broken; Sentry noise | Next business hour | None |

Incident commander roles defined per R1.11.

### 4.10 Security review per PR

PR template checklist (mandatory boxes):
- [ ] Inputs validated server-side
- [ ] Authz check present
- [ ] Tenant filter present on every Firestore query
- [ ] No secrets in code or logs
- [ ] No PII in logs
- [ ] No new sub-processor introduced (or DPA updated)
- [ ] No new public endpoint (or rate-limit added)

PRs touching `firestore.rules`, auth middleware, JWT validation, or RBAC require **2 reviewers**, at least one from the security-trained pool (3 people designated).

---

## Section 5 — Observability stack

### 5.1 BigQuery `vitals_raw` schema

```
Dataset: vitals_raw  (location: me-central1)
Tables:
  rum_events (partitioned by DATE(event_ts), clustered by tenant_id, route)
    event_ts TIMESTAMP
    tenant_id STRING
    user_id STRING
    session_id STRING
    route STRING
    device_class STRING
    network STRING
    region STRING
    metric_name STRING       -- LCP / INP / CLS / TTFB / FCP
    metric_value FLOAT64
    app_version STRING

  rum_daily_agg (partitioned by event_date)
    event_date DATE
    tenant_id STRING
    route STRING
    region STRING
    metric_name STRING
    p50 FLOAT64
    p75 FLOAT64
    p95 FLOAT64
    p99 FLOAT64
    sample_count INT64
```

Retention: raw 90 days; aggregates 7 years. Daily roll-up via Scheduled Query.

### 5.2 Dashboard definitions

Each dashboard is a Terraform `google_monitoring_dashboard` resource with widgets:

- **D1 API SLOs** — request rate per endpoint class; p50/p95/p99 latency; 5xx rate; burn-rate (2x and 10x of 99.5% budget).
- **D2 Firestore** — read/write ops/sec; slow-query tail count; throttling events; PITR status.
- **D3 Cache** — Redis hit ratio, eviction, memory, connection count.
- **D4 POS Ops** — receipts/min; offline queue depth; sync success rate; kitchen-display heartbeat lag.
- **D5 RUM CWV** — LCP/INP/CLS p75 by region/device/version.
- **D6 Deploys** — revision rollout state; error rate before/after; deploy frequency.

### 5.3 Alert policy wiring

YAML manifest `terraform/monitoring/alerts.yml` declares each policy. Example:

```yaml
- name: api_5xx_high
  condition: cloud_run.request_count{response_code_class="5xx"} / cloud_run.request_count > 0.01
  window: 5m
  severity: P1
  channels: [slack#alerts, pagerduty#api]
- name: rum_lcp_regression
  condition: vitals_raw.lcp_p75 > 4000
  window: 1h
  severity: P2
  channels: [slack#perf]
```

Channels mapped: PagerDuty service per system; Slack channels per concern.

### 5.4 OpenTelemetry collector configuration

Architecture: SDK in app → OTel Collector (sidecar or central) → Cloud Trace + Cloud Monitoring.

```yaml
receivers:
  otlp:
    protocols: { grpc: {}, http: {} }
processors:
  batch: {}
  attributes:
    actions:
      - key: tenant_id
        action: insert
        from_attribute: tenant_id
exporters:
  googlecloud:
    project: kurdish-erp-prod
service:
  pipelines:
    traces: { receivers: [otlp], processors: [batch, attributes], exporters: [googlecloud] }
```

Sampling: 10% baseline + 100% on errors (tail-based).

### 5.5 Distributed tracing flow

```
Browser fetch() with `traceparent: 00-<traceid>-<spanid>-01`
   ↓ Cloud Run receives, OTel middleware extracts, creates child span
   ↓ Backend handler creates spans per Firestore call (collection, op)
   ↓ Backend handler creates span per Redis call
   ↓ Response sent
   ↓ Browser RUM SDK records the round-trip into the same trace
```

In Cloud Trace UI a single click trace looks like:

```
[click /invoices "Save"] 420ms
 └─ [POST /api/invoices] 310ms
     ├─ [Firestore: invoices.create] 180ms
     ├─ [Firestore: audit.write] 40ms
     └─ [Redis: invalidate /api/invoices] 8ms
```

### 5.6 Per-tenant observability

Cloud Monitoring dashboards accept a `tenant_id` filter parameter. Support staff load `https://console.cloud.google.com/monitoring/dashboards/...?filter=tenant_id:tnt_abc123` and see that tenant's slice.

No bespoke UI — just dashboards with filters.

### 5.7 Cost attribution per tenant

Each Cloud Run request log includes `tenant_id`. A scheduled BigQuery job computes per-tenant:

- Request count + total request-seconds (proxy for Cloud Run cost)
- Firestore reads + writes (logged in middleware)
- Storage bytes consumed (per-tenant collection counts × avg doc size)

Output table `cost_attribution_daily` powers a dashboard "Cost per tenant per month". Tenants with cost-to-revenue > 30% are flagged in a monthly business review.

### 5.8 Capacity planning

A capacity dashboard tracks:

- Cloud Run instance utilization (CPU + memory + concurrency) vs threshold (raise max-instances when sustained > 70% peak for 7 days)
- Firestore read quota: alert at 60% sustained
- Redis memory pressure: scale up node tier at 70%
- BigQuery slot utilization (if using reservations)

Reviewed quarterly with an action plan.

---

## Section 6 — UAT design

### 6.1 Pilot selection criteria

Scoring rubric (top 5 score):

| Criterion | Weight |
|-----------|--------|
| Sector diversity (≥ 5 unique sectors) | 3x |
| Geographic diversity (≥ 3 governorates) | 2x |
| Transaction volume potential (≥ 50/day) | 2x |
| Founder relationship / trust | 1x |
| Willing to be a public reference | 2x |
| English/Kurdish/Arabic capability for support | 1x |
| Owner-operator (decision-maker accessible) | 2x |

Aim for 5 pilots from a shortlist of 12. We expect 2-of-3 outreach yes-rate with founder warm intro.

### 6.2 Pilot agreement template

Lives at `docs/pilots/pilot-agreement-template.md`. 2 pages, Arabic + Kurdish + English. Key clauses:

- 90 days free service, including hardware loan.
- Customer commits: use the system as primary, accept weekly releases, complete weekly survey, take 30 min/week founder call.
- Founder commits: P0 same-day, P1 24h, hardware replacement < 48h.
- Data export at any time on request.
- Case-study rights with right-to-review-and-redact.
- No reference-call exclusivity (we can use them for sales).
- Termination: either side, any time, no penalty.
- Conversion at day 90: discounted year-1 (40% off) for graduates.

### 6.3 Daily check-in protocol

- WhatsApp video call, 10 minutes, scheduled 11:00 daily for first 14 days.
- Pre-call: pilot manager reviews dashboard for that tenant (D1+D4+D5 filtered).
- During: 4 standard questions: anything broken today? slow today? confused today? wish-list?
- Post-call: notes filed in `pilots/<name>/log/YYYY-MM-DD.md`; tickets created with severity.

### 6.4 Issue triage SLA

(Already in requirements 6.7; surfaced here as commitment.)

- P0: same-day fix or escalation
- P1: 24h
- P2: 1 week
- P3: 1 month

P0/P1 backlog SHALL be < 3 open per pilot at any moment.

### 6.5 Iteration cadence

- Monday Pilot Review (1h) — engineering + pilot manager + founder.
- Wednesday Release Decision — what goes to pilot channel Friday.
- Friday Pilot Channel Release.
- Saturday/Sunday Monitor — on-call watches for anomalies.

### 6.6 Success metrics per pilot

- DAU ≥ 80% of operating days
- NPS ≥ 30 at day 14 and day 30
- ≥ 50 transactions/day
- ≥ 1 documented "win" (time saved, error rate reduced, etc.)
- Conversion rate: target ≥ 60% (3 of 5)

### 6.7 Graduation criteria

Detailed in requirements 6.16. At graduation, pilot moves to a paying plan (discounted) and joins the reference pool.

---

## Section 7 — Architecture Decision Records

A starter set of 12 ADRs is created in SF1:

- **ADR-101: Paging vendor = PagerDuty.** Cost vs Opsgenie tradeoff; Iraqi-SMS reliability decisive.
- **ADR-102: Hiring sequencing FE → Ops → Support.** Why FE first vs founder + Ops first.
- **ADR-103: 2-day-in-office norm.** Iraqi internet reliability + cohesion.
- **ADR-104: Iraqi LLC vs UAE Free Zone.** Tradeoffs of Iraqi domicile.
- **ADR-105: Legal counsel = mid-size Iraqi firm.** Cost vs name brand.
- **ADR-106: Insurance via Dubai broker.** Iraqi cyber-insurance gap.
- **ADR-107: PITR + nightly export combo (not just one).** Cost / recovery trade.
- **ADR-108: Pen-test vendor = Help AG year 1, NCC Group year 2.** Cost / reputation trajectory.
- **ADR-109: SOC 2 automation = Drata.** vs Vanta / Secureframe.
- **ADR-110: Bug bounty platform = Bugcrowd.** vs HackerOne pricing.
- **ADR-111: BigQuery as the RUM warehouse.** vs Firestore aggregation.
- **ADR-112: Pilot conversion discount 40% year-1.** Anchor pricing for references.

ADRs reviewed in monthly architecture meeting; superseded ADRs marked accordingly.

---

## Cross-cutting design notes

- **Spec interaction.** This spec depends on `world-class-performance` shipping its observability instrumentation (R6) and security baseline (R7). It depends on `launch-readiness` for billing reliability. It feeds back into `growth-to-100` by producing reference customers and a polished onboarding.
- **Cost discipline.** Total Tier-3 hard-cost budget is bounded in the tasks doc. We make decisions assuming we are pre-Series-A; we spend on lawyer + insurance + pen test + first 2 hires before SOC 2 + bug bounty.
- **Iraq-grounding.** Every legal, banking, and hardware choice routes through real Iraqi vendors first; international options are fallback.
- **Documentation is the deliverable.** This spec produces handbooks, runbooks, ADRs, policies, agreements. The code changes are comparatively small; the institutional changes are the work.
