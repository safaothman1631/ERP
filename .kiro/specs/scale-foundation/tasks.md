# Tasks Document: Scale Foundation (100 → 1000+ Customers)

> **Spec ID:** `scale-foundation`
> **Companion to:** `requirements.md`, `design.md`
> **Status:** Draft v1.0
> **Owner:** Safa Othman (with rotating phase leads)
> **Total horizon:** 9–14 months across overlapping phases SF1 → SF6
> **Task numbering:** `T-SF.<phase>.<n>` (e.g., `T-SF.1.5`)

This document is the execution plan. Each task has an owner (initial), exit criteria, dependencies, and indicative cost. Phases overlap intentionally: SF2 (Legal) begins in week 1 because contracts have long lead times; SF1 (Team) anchors everything; SF3 (DR) and SF5 (Observability) are technical-eng-led and can run in parallel; SF4 (Security pen test) requires SF3 + R7 baseline; SF6 (UAT) sequences last when product + ops + support are ready to absorb feedback.

---

## Phase overview

| Phase | Window | Duration | Lead | Key output |
|-------|--------|----------|------|------------|
| **SF1 — Team & Ops** | Months 1–8 | 8 weeks active + 6 months ramp | Founder → Ops/SRE Lead | 3-person core, runbooks, on-call live |
| **SF2 — Legal Foundation** | Months 1–6 | 6 weeks effort across 6 months | Founder + Iraqi lawyer | LLC, ToS, Privacy, DPA, MSA, SLA, insurance |
| **SF3 — DR Drill** | Months 3–4 | 4 weeks | Ops/SRE Lead | Quarterly drill cadence, per-tenant restore |
| **SF4 — Security & Pen Test** | Months 6–15 | 10 weeks active | Ops/SRE + external | Pen test clean, SOC 2 Type I in progress, bug bounty live |
| **SF5 — Observability Provisioning** | Months 4–9 | 6 weeks | Sr. FE + Ops/SRE | 6 dashboards, 24 alerts, OTel, BQ RUM live |
| **SF6 — UAT Pilots** | Months 6–14 | 12+ weeks | Founder + Support Lead | 5 pilots × 30 days, ≥ 3 converted |

---

## Phase SF1 — Team & Operational Maturity

**Goal:** Eliminate the founder bus factor; stand up runbook-driven operations.

### Hiring stream

- **T-SF.1.1** Write the Senior FE/FS JD; publish to LinkedIn + Indeed Iraq + KRG-tech Telegram + Bayt + word-of-mouth. Owner: Founder. Exit: 10+ qualified applications. Effort: 2 days drafting + 2 weeks outreach.
- **T-SF.1.2** Run hiring funnel: screen 30 → take-home 10 → pair-code 4 → references 2 → offer 1. Owner: Founder. Exit: signed offer for Sr. FE/FS. Effort: 4 weeks elapsed. Cost: USD 200 in take-home stipends.
- **T-SF.1.3** Onboard Sr. FE/FS with 30/60/90 plan in `docs/handbook/onboarding.md`. Owner: Founder. Exit: 30-day check-in passed. Effort: 1 day prep + ongoing.
- **T-SF.1.4** Write Ops/SRE JD; outreach same channels + GitOps community + DevOpsDays MENA. Owner: Founder. Exit: 10+ applications. Effort: 2 days + 3 weeks.
- **T-SF.1.5** Hire Ops/SRE Lead. Owner: Founder. Exit: signed offer. Effort: 4 weeks. Cost: USD 200 take-homes.
- **T-SF.1.6** Onboard Ops/SRE; transfer runbook ownership + GCP admin. Owner: Founder. Exit: Ops/SRE runs 1 deploy + 1 incident drill. Effort: 4 weeks.
- **T-SF.1.7** Hire + onboard Customer Support Specialist. Owner: Founder + Ops/SRE. Exit: handles 80% of support tickets autonomously. Effort: 4 weeks hire + 4 weeks ramp.

### Knowledge transfer stream

- **T-SF.1.8** Author Engineering Handbook covering 12 chapters: repo layout, branching, deploy, secret access, customer-data access, on-call, incident response, refund auth, RBAC, billing webhook, Firestore data model, multi-tenancy. Owner: Founder. Exit: handbook merged + linked from README. Effort: 5 days.
- **T-SF.1.9** Seed 20 ADRs in `docs/adr/` capturing existing implicit decisions. Owner: Founder + Sr. FE. Exit: 20 ADRs merged. Effort: 5 days. Format: Michael Nygard.
- **T-SF.1.10** Establish Notion workspace for HR + sales + customer notes; migrate scattered docs. Owner: Founder. Exit: Notion live, 3 spaces seeded. Effort: 2 days. Cost: Notion Team USD 8/user/month × 5 = USD 40/month.

### Paging + on-call stream

- **T-SF.1.11** Procure PagerDuty (or Opsgenie if cost-constrained); configure services per system. Owner: Ops/SRE. Exit: 5 services configured, integrations to Slack live. Effort: 2 days. Cost: USD 70–120/month for 3 users.
- **T-SF.1.12** Build escalation policies (4 layers per design.md). Owner: Ops/SRE. Exit: tested with synthetic page. Effort: 1 day.
- **T-SF.1.13** Configure 3-person rotation, weekly Sunday handoff, holiday overrides. Owner: Ops/SRE. Exit: 12 weeks pre-published. Effort: 1 day.
- **T-SF.1.14** Write 12 mandatory runbooks per design.md §1.4. Owner: Ops/SRE (with topic experts). Exit: 12 runbooks merged + YAML headers. Effort: 3 weeks of half-day chunks.
- **T-SF.1.15** Run runbook drills (1 per runbook over 3 months). Owner: rotating. Exit: each drill recorded + gaps filed. Effort: 90 min/drill × 12 = 18h.

### Governance stream

- **T-SF.1.16** Stand up IAM group `gcp-admins@` with WIF for CI. Owner: Ops/SRE. Exit: 3 admins, weekly automated audit. Effort: 1 day.
- **T-SF.1.17** Set up automated IAM-leaver audit (Cloud Scheduler → script → Slack report). Owner: Ops/SRE. Exit: weekly report posted. Effort: 1 day.
- **T-SF.1.18** Establish 1:1 + 360 cadence; configure tooling (Google Forms for 360, calendar for 1:1). Owner: Founder. Exit: 4 weeks of 1:1 notes filed. Effort: ongoing.
- **T-SF.1.19** Procure office space in Erbil co-working (Five One Labs, Re:Coded space, or Korek Co-Lab). Owner: Founder. Exit: 3 desks reserved. Effort: 1 week search. Cost: USD 200–400/desk/month × 3 = USD 600–1,200/month.
- **T-SF.1.20** Hold quarterly Incident Command training (4 hours) for all engineers. Owner: Ops/SRE. Exit: 4 trained, certificate filed. Effort: 4 hours quarterly. Cost: USD 0 (internal) or USD 500 (external trainer one-time).

**SF1 exit criteria:** 3-person operational core, paging live, 12 runbooks, 20 ADRs, weekly IAM audit green, founder replaceable for 2-week absence per A1.

---

## Phase SF2 — Legal Foundation

**Goal:** Stand up the legal posture an enterprise buyer expects; register the company; insure.

### Iraqi LLC formation

- **T-SF.2.1** Engage mid-size Iraqi commercial lawyer; sign retainer. Owner: Founder. Exit: engagement letter signed. Effort: 1 week. Cost: USD 1,000 retainer.
- **T-SF.2.2** Reserve company name; prepare Articles of Association. Owner: Lawyer + Founder. Exit: AoA notarized. Effort: 2 weeks. Cost: IQD ~700K (~ USD 500).
- **T-SF.2.3** Deposit minimum capital + submit incorporation file. Owner: Founder. Exit: provisional registration receipt. Effort: 1 week. Cost: IQD 1M capital (refundable) + IQD 250K fees.
- **T-SF.2.4** Receive commercial registration certificate. Owner: Lawyer. Exit: certificate in hand. Effort: 4–6 weeks elapsed.
- **T-SF.2.5** Join Chamber of Commerce (KRG or Federal). Owner: Founder. Exit: membership card. Effort: 1 week. Cost: IQD 150K/year.
- **T-SF.2.6** Open corporate bank account (FIB, Bank of Baghdad, or KIB). Owner: Founder. Exit: account active. Effort: 2 weeks.
- **T-SF.2.7** Register with GCT for VAT + income tax. Owner: Founder + accountant. Exit: tax ID issued. Effort: 2 weeks. Cost: USD 200 accountant setup.

### Document drafting

- **T-SF.2.8** Lawyer drafts ToS per design.md §2.2 outline. Owner: Lawyer. Exit: 3 review rounds → final. Effort: 4 weeks elapsed. Cost: USD 1,500–2,500.
- **T-SF.2.9** Lawyer drafts Privacy Policy (PDPL + GDPR). Owner: Lawyer. Exit: published at /legal/privacy. Effort: 3 weeks. Cost: USD 1,000–2,000.
- **T-SF.2.10** Engage GDPR-conversant counsel (one-time, EU-based or UAE-based) to review Privacy + DPA. Owner: Founder. Exit: written confirmation. Effort: 2 weeks. Cost: USD 1,500.
- **T-SF.2.11** Draft DPA template (EU SCC 2021 modules base) + 3 annexes. Owner: Lawyer + Founder. Exit: clickwrap version live; counterpart PDF available. Effort: 3 weeks. Cost: USD 1,000.
- **T-SF.2.12** Draft MSA template + Order Form template. Owner: Lawyer. Exit: enterprise-ready. Effort: 3 weeks. Cost: USD 1,500.
- **T-SF.2.13** Publish SLA at /legal/sla with credits ladder. Owner: Founder. Exit: page live. Effort: 1 day (after template + R5 confirmation).
- **T-SF.2.14** Publish sub-processor list at /legal/sub-processors; subscribe interface for change notices. Owner: Sr. FE. Exit: page live; email subscribe form. Effort: 3 days.
- **T-SF.2.15** Publish AUP, Cookie policy, Refund policy. Owner: Founder + Lawyer. Exit: 3 pages live. Effort: 1 week. Cost: USD 500.

### Insurance

- **T-SF.2.16** Engage Dubai broker (Marsh / Aon / AHC); complete underwriting questionnaire. Owner: Founder. Exit: 3 quotes. Effort: 3 weeks. Cost: USD 0 (broker fee-free).
- **T-SF.2.17** Bind cyber + E&O policies (USD 1M each). Owner: Founder. Exit: certificate of insurance. Effort: 1 week post-quote. Cost: USD 3,500–8,000/year.
- **T-SF.2.18** File certificates in `legal/insurance/`; calendar renewal. Owner: Founder. Exit: filed + calendared.

### Employment + IP

- **T-SF.2.19** Draft employment + IP-assignment templates with Iraqi labor lawyer. Owner: Lawyer + Founder. Exit: templates in `templates/employment/`. Effort: 2 weeks. Cost: USD 1,000.
- **T-SF.2.20** Existing team members sign IPA (founder + hires). Owner: Founder. Exit: signed PDFs filed.

### Compliance ops

- **T-SF.2.21** Stand up `docs/compliance/calendar.yml` per design.md §2.10. Owner: Ops/SRE. Exit: calendar live in Google Calendar. Effort: 1 day.
- **T-SF.2.22** Build in-app data-export + erasure workflow (GDPR Art. 17 / PDPL). Owner: Sr. FE. Exit: tenant admin can request export + delete. Effort: 2 weeks. Cost: dev time.
- **T-SF.2.23** Configure SBOM + license scan (Syft + Grype + FOSSA free tier). Owner: Sr. FE. Exit: SBOM artifact in every release; license report green. Effort: 3 days.

**SF2 exit criteria:** LLC registered, 9 legal docs published, insurance bound, compliance calendar live per A2.

**SF2 cumulative cost:** USD 9K–18K (lawyer + insurance + government fees + setup).

---

## Phase SF3 — DR Drill

**Goal:** Prove backup → restore in production-equivalent conditions; ship per-tenant restore.

- **T-SF.3.1** Enable Firestore native PITR (7-day window) on production database. Owner: Ops/SRE. Exit: PITR active; ADR-107 referenced. Effort: 1 day. Cost: ~30% storage line bump (acceptable, ~ USD 20/month at current scale).
- **T-SF.3.2** Verify nightly export GitHub Action; tune to complete < 30 min. Owner: Ops/SRE. Exit: 7 consecutive successful exports. Effort: 2 days.
- **T-SF.3.3** Configure GCS Turbo Replication primary me-central1 → secondary europe-west4. Owner: Ops/SRE. Exit: replication healthy; lag < 1h verified. Effort: 1 day. Cost: secondary storage ~ USD 30/month.
- **T-SF.3.4** Apply Bucket Lock + Object Lock on secondary bucket (immutable). Owner: Ops/SRE. Exit: policy applied. Effort: 0.5 day.
- **T-SF.3.5** Configure lifecycle rules (Standard → Nearline 30d → Coldline 90d → Archive 365d). Owner: Ops/SRE. Exit: rules applied. Effort: 0.5 day.
- **T-SF.3.6** Build full-restore script (`scripts/dr/restore-full.sh`) + runbook. Owner: Ops/SRE. Exit: dry-run successful in sandbox. Effort: 1 week.
- **T-SF.3.7** Build per-tenant restore script (`scripts/dr/restore-tenant.sh`) + runbook. Owner: Sr. FE + Ops/SRE. Exit: dry-run successful for sandbox tenant. Effort: 2 weeks.
- **T-SF.3.8** Build in-app super-admin restore UI (4-eyes approval, diff preview). Owner: Sr. FE. Exit: feature flagged on. Effort: 2 weeks.
- **T-SF.3.9** Build `backup-verify.yml` GitHub Action — weekly random-sample restore + integrity check. Owner: Ops/SRE. Exit: 4 consecutive green weeks. Effort: 3 days.
- **T-SF.3.10** Run first announced DR drill: full restore to sandbox; time it; document gaps. Owner: DR Captain. Exit: drill report filed; RTO ≤ 1h achieved. Effort: 4 hours.
- **T-SF.3.11** Update `DISASTER_RECOVERY.md` with proven procedures + timings. Owner: Ops/SRE. Exit: doc merged; PR reviewed. Effort: 1 day.
- **T-SF.3.12** Schedule quarterly DR drill calendar entries (4 quarters out). Owner: Ops/SRE. Exit: calendar set.

**SF3 exit criteria:** PITR live, weekly backup-verify green for 4 weeks, drill report filed, per-tenant restore tested, runbook updated per A3.

**SF3 cumulative cost:** USD 600/year (storage + replication) + dev time.

---

## Phase SF4 — Security & Pen Test

**Goal:** Verify multi-tenant isolation externally; begin SOC 2 Type I; launch bug bounty.

### Pre-test hardening

- **T-SF.4.1** Audit `firestore.rules` line-by-line; add unit tests via `@firebase/rules-unit-testing`. Owner: Sr. FE. Exit: 100% rule coverage in tests. Effort: 1 week.
- **T-SF.4.2** Add CI suite of 200+ cross-tenant access attempts via Playwright + API tests. Owner: Sr. FE. Exit: all 200 return 403/404. Effort: 1 week.
- **T-SF.4.3** Implement JWT signature/aud/iss/exp/tenant verification middleware audit. Owner: Sr. FE. Exit: middleware test suite passes. Effort: 3 days.
- **T-SF.4.4** Add CSP report-only header; collect violations 14 days; enforce. Owner: Sr. FE. Exit: enforced CSP live. Effort: 2 weeks elapsed.
- **T-SF.4.5** Configure CSRF protection (SameSite=strict cookies + token header on state-changing endpoints). Owner: Sr. FE. Exit: penetration test scope verified. Effort: 3 days.
- **T-SF.4.6** Add file-upload validation (size, MIME, magic-byte, ClamAV scan). Owner: Sr. FE. Exit: invalid uploads rejected; clean uploads pass. Effort: 1 week.
- **T-SF.4.7** Configure rate-limiter (Redis-backed, per-tenant). Owner: Ops/SRE. Exit: limits enforced; test passes. Effort: 3 days.
- **T-SF.4.8** Run `gitleaks` in pre-commit + CI; remediate any historical findings. Owner: Sr. FE. Exit: clean scan; pre-commit installed for all devs. Effort: 1 week.
- **T-SF.4.9** Implement Workload Identity Federation everywhere; eliminate service-account JSON. Owner: Ops/SRE. Exit: zero JSON keys in repo or CI. Effort: 1 week.

### Independent firestore-rules audit

- **T-SF.4.10** Engage independent firm for static rules audit. Owner: Founder. Exit: signed scope. Effort: 1 week. Cost: USD 3,000–6,000.
- **T-SF.4.11** Receive audit report; remediate findings. Owner: Sr. FE. Exit: zero open Critical/High. Effort: 2 weeks.

### Penetration test

- **T-SF.4.12** RFQ 4 vendors (Bishop Fox, Trail of Bits, NCC Group, Help AG); evaluate. Owner: Founder. Exit: 4 quotes received + scoring matrix complete. Effort: 3 weeks. Cost: USD 0 for RFQ.
- **T-SF.4.13** Select vendor (recommended: Help AG year 1); sign engagement letter. Owner: Founder. Exit: contract signed. Cost: USD 18K–28K.
- **T-SF.4.14** Pre-test prep: provision test account, share docs, scope freeze. Owner: Ops/SRE + Sr. FE. Exit: kickoff call. Effort: 1 week.
- **T-SF.4.15** Active pen-test window (2 weeks). Owner: Vendor + Sr. FE on-call for clarification. Effort: 2 weeks elapsed.
- **T-SF.4.16** Receive findings report; categorize by severity. Owner: Founder + Ops/SRE. Exit: tracker populated. Effort: 1 week review.
- **T-SF.4.17** Remediate Critical (24h SLA) + High (7d SLA). Owner: Sr. FE. Exit: zero open. Effort: 2 weeks for typical findings.
- **T-SF.4.18** Remediate Medium (30d). Owner: Sr. FE. Effort: ongoing.
- **T-SF.4.19** Retest by vendor. Owner: Vendor. Exit: clean retest letter. Effort: 1 week. Cost: included.
- **T-SF.4.20** Publish 1-page customer-facing security summary (no findings detail) at /legal/security. Owner: Founder. Exit: page live. Effort: 1 day.

### SOC 2 Type I path

- **T-SF.4.21** Procure Drata (SOC 2 automation). Owner: Ops/SRE. Exit: account active; agents installed. Effort: 1 week. Cost: USD 8K–14K/year.
- **T-SF.4.22** Engage Prescient Assurance as auditor. Owner: Founder. Exit: engagement letter. Effort: 2 weeks. Cost: USD 15K–25K.
- **T-SF.4.23** 6-month evidence collection period (logs, policies, control attestations). Owner: Ops/SRE. Exit: Drata dashboard 90%+ green. Effort: ongoing.
- **T-SF.4.24** Audit fieldwork (3 months). Owner: Auditor + Ops/SRE. Exit: Type I report issued.

### Bug bounty

- **T-SF.4.25** Set up Bugcrowd private program; invite ~ 30 researchers. Owner: Ops/SRE. Exit: program live, scope published. Effort: 1 week. Cost: USD 1K/month Bugcrowd platform + USD 12K/year payout budget.
- **T-SF.4.26** Define triage SLA + payout tiers; route to ticket system. Owner: Ops/SRE. Exit: docs published.
- **T-SF.4.27** Triage first 5 submissions; pay if valid. Owner: Ops/SRE. Effort: ongoing.

### Incident response

- **T-SF.4.28** Write Security Incident Response Plan (`docs/security/sirp.md`). Owner: Ops/SRE + Founder + Lawyer. Exit: signed off. Effort: 1 week.
- **T-SF.4.29** Run tabletop SIRP exercise once (simulated S1 breach). Owner: Founder. Exit: postmortem of the tabletop. Effort: 3 hours.

### ISO 27001 gap

- **T-SF.4.30** Commission ISO 27001 gap analysis. Owner: Founder. Exit: report received. Effort: 4 weeks. Cost: USD 5K–10K.

**SF4 exit criteria:** Zero Critical/High open from pen test; SOC 2 Type I evidence collection ≥ 6 months in; bug bounty live; SIRP signed off per A4.

**SF4 cumulative cost:** USD 50K–90K across the 10 weeks active + 12 months SOC 2 timeline.

---

## Phase SF5 — Observability Provisioning

**Goal:** Operationalize the apparatus built in `world-class-performance` R6.

- **T-SF.5.1** Create BigQuery dataset `vitals_raw` + tables (partitioned/clustered per design.md §5.1). Owner: Ops/SRE. Exit: dataset live; sample data ingested. Effort: 2 days.
- **T-SF.5.2** Build RUM ingest endpoint `POST /api/rum/vitals` + sampling logic. Owner: Sr. FE. Exit: 1k events/min ingested in load test. Effort: 1 week.
- **T-SF.5.3** Build daily rollup Scheduled Query → `rum_daily_agg`. Owner: Ops/SRE. Exit: 7 days of aggregates verified. Effort: 1 day.
- **T-SF.5.4** Author Terraform for 6 dashboards (D1–D6 per design §5.2). Owner: Ops/SRE. Exit: 6 dashboards live in Cloud Monitoring. Effort: 2 weeks.
- **T-SF.5.5** Author Terraform for 24 alert policies (per design §5.3). Owner: Ops/SRE. Exit: 24 policies live; test fires routed. Effort: 1 week.
- **T-SF.5.6** Wire PagerDuty + Slack channels to alert policies. Owner: Ops/SRE. Exit: synthetic fire produces real page. Effort: 2 days.
- **T-SF.5.7** Install OTel SDK in backend (FastAPI) per `world-class-performance` R6.3. Owner: Sr. FE. Exit: spans in Cloud Trace. Effort: 1 week.
- **T-SF.5.8** Install OTel SDK in frontend; propagate `traceparent` on every fetch. Owner: Sr. FE. Exit: end-to-end trace visible in Cloud Trace. Effort: 1 week.
- **T-SF.5.9** Configure OTel Collector + sampling. Owner: Ops/SRE. Exit: configured 10% baseline + 100% errors. Effort: 3 days.
- **T-SF.5.10** Configure Sentry release auto-tagging on deploy via GitHub Action. Owner: Ops/SRE. Exit: deploys auto-create Sentry release. Effort: 2 days.
- **T-SF.5.11** Add `tenant_id` filter to all 6 dashboards. Owner: Ops/SRE. Exit: per-tenant view works. Effort: 2 days.
- **T-SF.5.12** Implement per-tenant cost attribution: tenant-tagged logs + nightly BigQuery rollup. Owner: Sr. FE + Ops/SRE. Exit: cost-per-tenant dashboard live. Effort: 2 weeks.
- **T-SF.5.13** Stand up capacity-planning dashboard + quarterly review meeting. Owner: Ops/SRE. Exit: dashboard live; first meeting scheduled. Effort: 1 week.
- **T-SF.5.14** Configure regional RUM segmentation (IP geo to Iraqi governorate). Owner: Sr. FE. Exit: dashboard segments by region. Effort: 3 days.
- **T-SF.5.15** Build k6 nightly synthetic test against production. Owner: Sr. FE. Exit: nightly run + results in D1. Effort: 1 week.
- **T-SF.5.16** Enforce cardinality budget — lint rule against unbounded labels. Owner: Sr. FE. Exit: lint catches violations. Effort: 2 days.
- **T-SF.5.17** Move all dashboards + alerts into `terraform/monitoring/`; document the apply procedure. Owner: Ops/SRE. Exit: `terraform plan` clean. Effort: 1 week.
- **T-SF.5.18** Train support team on per-tenant dashboard usage. Owner: Ops/SRE. Exit: support uses dashboards in real ticket triage. Effort: 1 day workshop.

**SF5 exit criteria:** 6 dashboards live + used; 24 alerts firing; OTel end-to-end; per-tenant cost attribution working per A5.

**SF5 cumulative cost:** BigQuery storage ~ USD 50–150/month; Drata not double-counted; PagerDuty already in SF1.

---

## Phase SF6 — UAT Pilots

**Goal:** 5 pilots × 30 days; ≥ 3 convert to paid + reference.

### Recruitment

- **T-SF.6.1** Build pilot shortlist of 12 candidates via founder network, KRG-tech meetups, supplier referrals. Owner: Founder. Exit: 12-name list. Effort: 2 weeks.
- **T-SF.6.2** Apply scoring rubric (design.md §6.1) to shortlist. Owner: Founder. Exit: top 7 ranked. Effort: 1 day.
- **T-SF.6.3** Outreach top 7; close 5 signed pilot agreements. Owner: Founder. Exit: 5 contracts. Effort: 4 weeks elapsed. Cost: USD 200 in coffee meetings.
- **T-SF.6.4** Procure hardware kits for 5 pilots (printer + scanner + tablet + cash drawer). Owner: Ops/SRE. Exit: 5 kits assembled + tested. Effort: 2 weeks. Cost: USD 1,500 × 5 = USD 7,500 max; mid-range USD 4K total.
- **T-SF.6.5** Deploy hardware on-site; train owner + 1 staff per shop. Owner: Founder + Support Lead. Exit: 5 shops operational. Effort: 1 day per shop × 5 = 1 week.

### Run pilots

- **T-SF.6.6** Spin up dedicated `pilot` Cloud Run revision channel. Owner: Ops/SRE. Exit: weekly Friday release pipeline live. Effort: 3 days.
- **T-SF.6.7** Run daily 10-min WhatsApp video check-ins for first 14 days × 5 = 70 calls. Owner: Founder rotating with Support Lead. Effort: 700 min total ≈ 12 hours over 14 days.
- **T-SF.6.8** Run 3x/week check-ins days 15–30 × 5 = 35 calls. Owner: Support Lead. Effort: 6h total.
- **T-SF.6.9** File daily notes per pilot in `pilots/<name>/log/`. Owner: caller of the day.
- **T-SF.6.10** Triage issues per SLA: P0 same-day, P1 24h, P2 1 week, P3 1 month. Owner: rotating eng. Effort: ongoing.
- **T-SF.6.11** Hold weekly Monday Pilot Review (1h × 5 weeks = 5h). Owner: Founder. Exit: action items posted Monday eve.
- **T-SF.6.12** Send NPS + CSAT surveys at day 14 and day 30. Owner: Support Lead. Exit: 10 surveys × 5 = 50 responses (target). Effort: 1 day.

### Per-pilot work blocks (each ~ 6 weeks elapsed end to end including ramp + exit)

- **T-SF.6.13 — Pilot P-a Supermarket (Erbil).** Recruit, deploy, run 30d, exit + survey + decision.
- **T-SF.6.14 — Pilot P-b Restaurant (Sulaymaniyah).** Same template; emphasis on kitchen display.
- **T-SF.6.15 — Pilot P-c Pharmacy (Baghdad).** Same template; emphasis on controlled-substance log + insurance.
- **T-SF.6.16 — Pilot P-d Hardware/spare-parts (Mosul or Erbil).** Same template; emphasis on inventory + supplier credit.
- **T-SF.6.17 — Pilot P-e Electronics (Baghdad).** Same template; emphasis on serial-tracked + warranty.

Each pilot expands into sub-tasks: weekly status report, top-3 issues each week, daily DAU check, NPS survey, exit interview, conversion ask, case-study draft, photo + quote capture.

### Iteration deliverables

- **T-SF.6.18** Maintain `pilots/iraq-edge-cases.md` tracker — at least 30 entries by end of phase. Owner: Support Lead. Effort: ongoing.
- **T-SF.6.19** Ship 8 weekly pilot releases (8 × 5 pilots = 40 release-applications). Owner: Sr. FE + Ops/SRE. Effort: 1 day/week.
- **T-SF.6.20** Convert ≥ 3 pilots to paid (target 4) at discounted year-1. Owner: Founder. Exit: 3 signed paid agreements.
- **T-SF.6.21** Capture 5 case studies (3 published, 2 confidential). Owner: Founder + Support Lead. Exit: 5 case-study PDFs + 3 published online. Effort: 1 week per study × 5 = 5 weeks.
- **T-SF.6.22** Build sales-reference pool roster. Owner: Founder. Exit: roster in CRM with contact prefs.
- **T-SF.6.23** Record 10 power-user training videos (Kurdish + Arabic). Owner: Support Lead. Exit: 20 videos (10 × 2 langs) live in `kb` module. Effort: 1 week.

### Exit reporting

- **T-SF.6.24** Publish `pilots/results.md` aggregating NPS, CSAT, transactions, conversions. Owner: Founder. Exit: page in repo + shared with leadership. Effort: 2 days.
- **T-SF.6.25** Author 1-page executive summary for board/advisors. Owner: Founder. Effort: 1 day.

**SF6 exit criteria:** 5 pilots completed, median NPS ≥ 30, ≥ 3 conversions, ≥ 30 Iraqi edge-cases captured, case studies live per A6.

**SF6 cumulative cost:** USD 4K–8K hardware + dev time.

---

## Cross-cutting tasks

- **T-SF.X.1** Acceptance audit. At each milestone (A1–A7), run a checklist review and file in `audit/scale-foundation/Q-NNN/`. Owner: rotating.
- **T-SF.X.2** Cost dashboard. Maintain monthly spend report mapping to phase budgets; flag overruns > 15%. Owner: Founder.
- **T-SF.X.3** Founder burnout watch. Quarterly "is the founder OK?" check via the advisor + a documented vacation in each quarter ≥ 1 week. Owner: Sr. FE + Ops/SRE Lead.
- **T-SF.X.4** Press strategy. Once 3 pilots converted + pen test clean, prepare a press release for Iraqi tech outlets (Iraqi Innovators, KRG-tech blogs). Owner: Founder. Cost: USD 0 internal.

---

## Risk register

20 named risks; each has likelihood (L/M/H), impact (L/M/H), and mitigation.

| ID | Risk | L | I | Mitigation |
|----|------|---|---|------------|
| RSK-1 | Pen test discovers Critical multi-tenant breach | M | H | T-SF.4.1–T-SF.4.9 pre-hardening; budget USD 10K reserve for emergency remediation; ADR-108 says we accept this risk and pay for retest |
| RSK-2 | Key hire takes 6 months instead of 6 weeks (Iraqi talent market thin) | H | H | Start outreach week 1; widen funnel; offer remote work; raise upper band by USD 6K if needed; contract bridge senior contractor at USD 70/h for max 3 months |
| RSK-3 | Iraqi LLC formation delayed > 12 weeks (bureaucratic) | M | M | Engage lawyer with prior SaaS LLC experience; pre-prepare all docs; consider parallel UAE Free Zone (DIFC) as fallback (USD 6K, faster) |
| RSK-4 | Pilot drops out mid-pilot (shop change of plans) | M | M | Sign 7 candidates target 5 actual; have a wait-list; if drop in week 1, fast-replace |
| RSK-5 | Pilot NPS median < 30 (product not ready) | M | H | Hold conversion ask; iterate 4 more weeks; honest assessment; possibly delay broader sales |
| RSK-6 | DR drill reveals broken restore (data loss in restore) | M | H | Run sandbox drill before any customer-impacting promise; PITR fallback; cross-region as last resort; postpone SLA publication if drill fails |
| RSK-7 | Founder burnout — single point of failure on legal + sales + ops | H | H | Sequence hires aggressively; mandatory vacation; advisor cadence; share refund + deploy authority by month 4 |
| RSK-8 | Insurance carrier denies / unaffordable premium (Iraq risk) | M | M | Engage broker early; consider self-insurance reserve USD 20K if commercial denies; Dubai-domiciled entity as fallback |
| RSK-9 | SOC 2 Type I fails first attempt | M | M | Drata pre-audit dashboard requirement 90% green; remediate before fieldwork; budget USD 5K reserve for re-engagement |
| RSK-10 | Bug bounty submission floods inbox (cost blow-up) | L | M | Start private with 30 researchers; cap monthly payouts at USD 1K; clear scope |
| RSK-11 | Iraqi tax authority disputes VAT treatment of SaaS subscription | M | M | Iraqi tax accountant engaged before first VAT return; conservative posture; legal opinion if needed |
| RSK-12 | Hardware procurement delayed (printer not available in Erbil) | M | M | Pre-buy 2 spares; use FIB/Korek for cash-on-delivery import; fall back to Bluetooth printer ordered from Dubai |
| RSK-13 | PagerDuty payment failures (international card from Iraqi bank) | M | M | Use UAE bank account if available; founder personal card backup with reimbursement; Opsgenie as fallback |
| RSK-14 | Pen test vendor cancels mid-engagement | L | M | Contract with cancellation clause; 50% deposit only; backup vendor identified |
| RSK-15 | Customer data exposed in dev/staging fixtures | M | H | Synthetic-data policy; CI lint to detect PII patterns; immediate purge procedure |
| RSK-16 | Sub-processor outage (e.g., Sentry, BigQuery) takes us down | L | H | Multi-vendor strategy for critical paths; status-page automation; SLA pass-through clause |
| RSK-17 | GCP region outage me-central1 (rare but happens) | L | H | Cross-region backup ready; documented failover; SLA force-majeure clause |
| RSK-18 | Sentry release auto-tagging fails silently → unattributed errors | M | L | Synthetic test that production logs new release within 5 min of deploy |
| RSK-19 | Legal doc translation drift (Arabic vs English vs Kurdish) | M | M | Designate Arabic as legally binding; periodic counsel re-review; one source of truth |
| RSK-20 | Customer demands data residency in Iraq (no Google in Iraq) | L | M | Acknowledge; offer DPA clause; defer sovereign-cloud option to growth-to-1000; lose deal if blocker |

---

## Budget estimate per phase

Indicative ranges; not commitments. USD.

| Phase | Hard cost (vendors/tools) | People cost (3 hires + founder ramp) | Total |
|-------|---------------------------|---------------------------------------|-------|
| SF1 Team & Ops | 5K (paging + office + tools) | 60K (first 6 months 2 hires) | 65K |
| SF2 Legal | 9K–18K | small | 9K–18K |
| SF3 DR Drill | 1K (storage) | dev time embedded in SF1 | 1K |
| SF4 Security | 50K–90K (pen test + SOC 2 + Bug bounty) | embedded | 50K–90K |
| SF5 Observability | 2K (BigQuery + PagerDuty marginal) | embedded | 2K |
| SF6 UAT | 4K–8K (hardware + travel) | embedded | 4K–8K |
| **Total Tier-3** | **70K–120K hard** | **+ 60K–120K people** | **130K–240K** |

Cost-optimization options:
- Defer SOC 2 by 6 months (save USD 25K cash flow).
- Use Help AG for pen test instead of NCC (save USD 15K).
- Hire support specialist remotely from KRG outside Erbil (save USD 4K/year office).
- Use Opsgenie instead of PagerDuty (save USD 800/year).

---

## Success metrics

Top-line metrics that prove Scale Foundation is done:

| Metric | Baseline (today) | Target end of phase | Source |
|--------|------------------|---------------------|--------|
| Bus factor | 1 | ≥ 3 | self-report + handover demo |
| Time-to-revoke leaver | unknown / days | ≤ 24h | weekly IAM audit |
| MTTD P1 | unknown | ≤ 5 min | PagerDuty stats |
| MTTR P1 | unknown | ≤ 60 min | PagerDuty stats |
| DR drill cadence | 0 | quarterly | `audit/dr/` |
| RTO demonstrated | unproven | ≤ 60 min | drill report |
| Pen-test Critical/High open | unknown | 0 | vendor report |
| SOC 2 Type I attestation | none | issued or in progress | auditor letter |
| Dashboards live | 0 | 6 | Cloud Monitoring |
| Alert policies firing in 90d | 0 | ≥ 24 fired at least once | PagerDuty |
| Pilots completed | 0 | 5 | `pilots/results.md` |
| Pilot conversion rate | n/a | ≥ 60% | sales CRM |
| Median pilot NPS | n/a | ≥ 30 | survey |
| Case studies published | 0 | ≥ 3 | marketing site |
| Public uptime | unknown | 99.5%+ per SLA | dashboards |
| Insurance bound | no | yes | broker certificate |
| Iraqi LLC registered | no | yes | registrar certificate |
| ToS/Privacy/DPA/MSA/SLA published | partial | all 5 | /legal/ pages |

When the ratios in this table flip from baseline to target across 80% of rows, **Tier 3 is delivered** and the company is structurally ready to absorb 10× current growth.

---

## Closing note on sequencing

This spec is large because each requirement is independently necessary. The temptation will be to defer SF2 (legal) until "after a few more customers" or SF4 (security) until "after we hit revenue target." That sequencing is what kills companies. **Legal and security are the moats that let us say yes to enterprise customers; without them, every enterprise lead dies.** SF1 (team) is what makes the founder sleep again. SF6 (pilots) is what makes the product real.

The execution order is therefore: **SF1 in parallel with SF2 from day 1**; **SF3 + SF5 once Ops/SRE is hired (month 3)**; **SF4 once SF3 is green (month 6)**; **SF6 once Support is hired (month 6)**. By month 14, all six phases are either complete or in production cadence.
