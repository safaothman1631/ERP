# Security Incident Response Plan (SIRP)

> **Task ref:** SF4 / T-SF.4.28
> **Owner:** Security lead (interim: Tech lead) + DevOps
> **Companion:** `DISASTER_RECOVERY.md` (availability/data-loss incidents),
> `docs/security/pii-handling.md`, `docs/security/secret-rotation.md`
> **Status:** Operational draft. Legal/breach-notification timelines below are
> **pending review by qualified counsel** (see T-SF.2.x) — do not treat the
> regulatory deadlines as legal advice.

This plan governs the response to a **security** incident — a confirmed or
suspected event that compromises the confidentiality, integrity, or
availability of customer data or the platform. It complements the Disaster
Recovery runbook: DR handles outages and data loss; this plan handles
**breaches, intrusions, and abuse**. When an incident is both (e.g.
ransomware), run both — this plan owns the security/notification track and DR
owns the recovery track.

---

## 1. Scope & definitions

A **security incident** includes, but is not limited to:

- Unauthorized access to customer data (cross-tenant data exposure, IDOR,
  account takeover).
- Leaked credentials or secrets (committed key, exposed service account,
  phished admin).
- Malware / ransomware on infrastructure or developer machines with prod access.
- Exploited application vulnerability (RCE, SQLi/NoSQLi, auth bypass, SSRF).
- Data exfiltration or a confirmed/suspected **personal-data breach**.
- Denial-of-service that is *attacker-driven* (vs. a capacity outage).
- Insider misuse of access (including misuse of the impersonation feature).

A **personal-data breach** is "a breach of security leading to the accidental
or unlawful destruction, loss, alteration, unauthorized disclosure of, or
access to, personal data." This definition triggers the notification clock in
§6.

---

## 2. Severity classification

Severity is assigned by the Incident Commander at declaration and re-evaluated
as facts emerge. It drives timelines and who is paged.

| Severity | Definition | Examples | Page? |
|---|---|---|---|
| **SEC-1 (Critical)** | Confirmed unauthorized access to **multiple tenants'** data, active intrusion, ransomware, or a confirmed personal-data breach at scale. | Cross-tenant data dump; prod DB exfiltration; admin account takeover; leaked prod Firebase service-account key being used. | Yes — immediate page, 24/7. |
| **SEC-2 (High)** | Confirmed compromise limited to **one tenant** or a single account; an exploited vuln with no confirmed data access yet; a leaked secret not yet known to be abused. | Single-tenant IDOR exploited; one user's credentials phished; Stripe restricted key committed to a private repo. | Yes — during extended hours; next morning if after-hours and contained. |
| **SEC-3 (Medium)** | Latent vulnerability or policy violation with no evidence of exploitation; suspicious activity under investigation. | Dependency CVE with a known exploit but no prod exposure; gitleaks finding for a dev-only key; anomalous login blocked by brute-force defense. | No — ticketed, same business day. |
| **SEC-4 (Low)** | Hygiene/finding with negligible immediate risk. | Expiring TLS cert; missing security header on a non-API host; a low-severity scanner finding. | No — backlog with SLA. |

A **SEC-1 or SEC-2 with a personal-data breach** additionally starts the
breach-notification timeline in §6, regardless of remediation status.

**Response-time targets (from declaration):**

| Severity | Acknowledge | Bridge / triage | Containment target | Customer comms |
|---|---|---|---|---|
| SEC-1 | 15 min | 30 min | ≤ 4 h | per §6 (≤ 72 h notification window) |
| SEC-2 | 1 h | 2 h | ≤ 24 h | per §6 if PII involved |
| SEC-3 | same business day | — | ≤ 5 business days | usually none |
| SEC-4 | 2 business days | — | backlog SLA | none |

---

## 3. Roles & responsibilities

The same person may hold multiple roles in a small team, **except** the
Incident Commander and the Operator should be different people on a SEC-1.

| Role | Responsibility |
|---|---|
| **Incident Commander (IC)** | Owns the incident end-to-end. Declares severity, runs the bridge, makes containment go/no-go calls, decides on notification with Legal. Does **not** type commands on a SEC-1. |
| **Operator / Responder** | Executes technical actions (revoke keys, rotate secrets, deploy patches, pull logs). Reports back to IC. |
| **Scribe** | Maintains the minute-by-minute timeline in `audit/incidents/<date>-<topic>.md`. Captures every action, decision, and timestamp (UTC) — this record feeds the post-mortem and any regulator filing. |
| **Communications lead** | Drafts internal updates and customer/regulator notifications (with Legal). Single external voice. |
| **Legal / DPO** | Determines notification obligations and deadlines, approves external wording, interfaces with regulators. (Interim: Tech lead escalates to retained counsel — see externalBlockers.) |
| **Executive sponsor (CEO/CTO)** | Informed within 30 min on SEC-1; owns business decisions (e.g. public statement, taking the service offline). |

**Escalation path:** Responder → IC → Executive sponsor → Legal/DPO. Anyone
may declare an incident; nobody needs permission to **escalate**.

---

## 4. Lifecycle — the six phases

Based on NIST SP 800-61r2 (Preparation → Detection & Analysis → Containment →
Eradication → Recovery → Post-incident).

### 4.0 Preparation (ongoing)
- Detection signals wired: Cloud Logging alerts, gitleaks (CI + pre-commit),
  rate-limit/brute-force counters (`app/services/auth.py`), audit-log hash
  chain (`app/services/audit_chain.py`), Sentry error spikes, RUM anomalies.
- This plan rehearsed quarterly (see Appendix A tabletop).
- Break-glass: a documented procedure to revoke all sessions and rotate the
  app `SECRET_KEY` and Firebase keys (see `docs/security/secret-rotation.md`).

### 4.1 Detection & analysis
1. **Triage the signal.** Confirm it is a real incident vs. a false positive.
2. **Declare + assign severity** (§2). Open `#incident` and post
   `#incident sec=<n> ts=<utc> summary=<one line>`.
3. **Assign roles** (§3) and open the timeline file.
4. **Scope the blast radius:** which tenants, which data, which systems.
   - For suspected **cross-tenant exposure**, immediately check the audit log
     hash chain for tampering and query `audit_logs` for the actor/IP.
   - For a **leaked secret**, determine whether it was ever used (Cloud Logging
     access records, Stripe/Firebase dashboards).
5. **Preserve evidence** before changing anything: snapshot relevant logs,
   export the suspect audit-log range, capture the offending commit/PR.

### 4.2 Containment
Short-term (stop the bleeding) then long-term (stable hold while you fix):

- **Credential compromise:** revoke the affected tokens (`revoke_token` /
  session denylist), force-logout, rotate the secret. For a leaked Firebase
  service-account key: disable the key in GCP IAM **immediately**, then issue a
  new one.
- **Account takeover:** disable the account, revoke its sessions, reset
  credentials, require re-auth + 2FA on restore.
- **Exploited vuln:** deploy a hotfix or a feature-flag kill-switch; if no fix
  is ready and exposure is active, consider read-only mode
  (`app/middleware/read_only_mode.py`) or taking the affected route offline.
- **Active intrusion:** rotate **all** secrets (break-glass), revoke all
  sessions, block the source, preserve forensic copies.
- **Cross-tenant exposure:** identify every affected tenant; do not "fix" by
  deleting evidence — quarantine and document.

Record the containment time — it is reported to regulators.

### 4.3 Eradication
- Remove the root cause: patch the code, remove the malware, close the
  misconfiguration, purge leaked secrets from history (BFG/`git filter-repo`)
  **and** rotate them (history rewrite alone is insufficient — assume the
  secret is burned).
- Confirm no persistence/backdoors remain (new IAM grants, added users,
  modified rules). Diff `firestore.rules`, IAM policy, and admin user lists
  against a known-good baseline.

### 4.4 Recovery
- Restore service per `DISASTER_RECOVERY.md` if availability was affected.
- Validate integrity: re-verify the audit-log hash chain; reconcile financial
  records if accounting data was touched; run the tenant-isolation test suite
  (`backend/tests/test_tenant_isolation.py`) and the rules tests
  (`firestore-rules-tests/`) as a post-fix gate.
- Heightened monitoring for ≥ 2 weeks on the affected surface.
- Lift kill-switches/read-only mode only on IC sign-off.

### 4.5 Post-incident
- **Blameless post-mortem within 5 business days** of resolution. Output: root
  cause, timeline, what worked, what didn't, and **dated action items with
  owners**.
- File the post-mortem in `audit/incidents/`. Feed action items into the
  backlog and update this plan / detection rules.

---

## 5. Communications

- **Internal:** `#incident` channel is the single source of truth. IC posts a
  status update at a cadence matching severity (SEC-1: every 30 min).
- **External:** **only** the Communications lead speaks externally, with Legal's
  approval. No individual engineer comments publicly or to customers.
- **Holding statement** (use within the first hour of a customer-impacting
  SEC-1, even before facts are complete):
  > "We are investigating a security event affecting [scope]. We have engaged
  > our incident response process and will provide an update by [time]. The
  > affected systems are [status]."
- **Status page** updated for any customer-visible impact.
- **Do not** speculate on cause, attribution, or scope before confirmation.

---

## 6. Breach-notification timelines (PDPL / GDPR)

> **Counsel review pending (T-SF.2.x).** These are planning defaults derived
> from the regulations' plain text; the retained Data Protection Officer /
> counsel confirms applicability (Iraq PDPL, KRG rules, and GDPR where EU data
> subjects are involved) before any filing.

The clock starts when the organization becomes **aware** of a personal-data
breach (i.e. has a reasonable degree of certainty a breach occurred), **not**
when it is fully understood.

| Obligation | Trigger | Deadline | Owner |
|---|---|---|---|
| **GDPR Art. 33 — notify supervisory authority** | Breach likely to result in a risk to individuals' rights/freedoms | **Without undue delay, and where feasible ≤ 72 hours** of awareness. If > 72 h, the notification must explain the delay. | Legal/DPO |
| **GDPR Art. 34 — notify affected data subjects** | Breach likely to result in a **high** risk to individuals | **Without undue delay** | Legal/DPO + Comms |
| **GDPR Art. 33(5) — internal breach register** | Any personal-data breach (even if not notifiable) | Document **immediately**; retain | DPO |
| **Iraq PDPL — notify the competent authority** | Personal-data breach as defined by the PDPL | **Per the PDPL implementing regulation timeline — confirm with counsel** (planning assumption: prompt notification, treat as ≤ 72 h until confirmed) | Legal/DPO |
| **Contractual (DPA) — notify customer/controller** | Breach affecting a customer's data where we are processor | **≤ 72 hours of discovery** (per `marketing/.../legal/dpa.astro` §5 "Incident Notification") | Comms + Legal |
| **Payment data (Stripe)** | Suspected compromise of payment flows | Notify Stripe per their agreement **immediately**; we do **not** store raw card data (Stripe-hosted) | Operator + Legal |

**Notification content (regulator) should include:** nature of the breach,
categories and approximate number of data subjects and records affected, likely
consequences, measures taken/proposed, and the DPO contact. If not all facts
are known within the deadline, file an **initial** notification and supplement.

**Awareness → action mapping:**

```
T0  Breach suspected ───────────► declare SEC-x, start timeline
T0+ Confirm "awareness" with IC + Legal (begins the 72h clock)
    ├─ Containment in parallel (do NOT wait for legal sign-off to contain)
    ├─ Scope: which data subjects, which categories, how many
    └─ Legal assesses risk level → Art.33 and/or Art.34 + PDPL + DPA paths
T0+72h (max)  Regulator notification filed (or documented why not notifiable)
```

---

## 7. Special procedures

- **Impersonation misuse:** every impersonation session is read-only and audited
  (`app/middleware/impersonation_audit.py`, `read_only_mode.py`). If misuse is
  alleged, pull the impersonation audit rows by `audit_id`, disable the actor,
  and review the read-only enforcement logs.
- **Audit-log integrity:** the audit log is a hash chain
  (`app/services/audit_chain.py`). On any integrity incident, verify the chain
  end-to-end; a broken link is itself a SEC-1 indicator.
- **Vulnerability disclosure (inbound):** reports to `security@zoho-kurdish.iq`
  are acknowledged within 2 business days and triaged into this plan. See the
  customer-facing summary (`docs/security/security-summary.md`).

---

## 8. Contacts (fill in before go-live)

| Role | Primary | Backup |
|---|---|---|
| Incident Commander | _TBD_ | _TBD_ |
| Security/DevOps on-call | _TBD_ | _TBD_ |
| Legal / DPO | _TBD (retained counsel — see externalBlockers)_ | — |
| Executive sponsor | _TBD_ | — |
| GCP support | Cloud Console support case | — |
| Stripe support | Stripe dashboard / emergency contact | — |

---

## Appendix A — Tabletop exercise scenarios

Run **one scenario per quarter** as a 60–90 minute tabletop. The IC facilitates;
the team talks through each phase without touching prod. Record gaps as action
items. Log completion in the drill table at the end of this appendix.

### Scenario 1 — Leaked Firebase service-account key (SEC-1)
A contributor pushes a commit containing `serviceAccountKey.json`. gitleaks
flags it in CI **after** the push.
- **Inject:** Cloud Logging shows one access from an unfamiliar IP 20 minutes
  ago.
- **Discuss:** How fast can you disable the key in IAM? Who rotates it? Do you
  assume tenant data was read? What's the notification decision and clock?
- **Success criteria:** key disabled < 15 min; rotation done; awareness/72h
  decision made with Legal; history purge **and** rotation both planned.

### Scenario 2 — Cross-tenant data exposure via app bug (SEC-1)
A customer reports seeing another company's invoice numbers in a list view.
- **Inject:** The bug is a missing `org_id` filter on a new endpoint; audit logs
  show 3 tenants viewed foreign data over 6 days.
- **Discuss:** Containment (feature-flag kill-switch vs. rollback); scoping
  affected tenants from audit logs; which of the 3 tenants get notified and on
  what timeline; how the tenant-isolation test suite should have caught it.
- **Success criteria:** endpoint contained < 1 h; affected tenants enumerated;
  Art.33/PDPL decision documented; a regression test added before recovery.

### Scenario 3 — Account takeover of a tenant admin (SEC-2)
A tenant admin's credentials are phished; the attacker logs in and exports data.
- **Inject:** Brute-force defense did **not** trigger (valid credentials);
  export happened from a new geo.
- **Discuss:** Detecting via anomalous-geo/RUM; disabling the account and
  revoking sessions; forcing 2FA on restore; was MFA available/enforced?
- **Success criteria:** account disabled and sessions revoked < 30 min; customer
  DPA-notified; 2FA-enforcement gap captured as an action item.

### Scenario 4 — Exploited dependency RCE (SEC-1)
A CVE in a Python dependency allows RCE on Cloud Run.
- **Inject:** Sentry shows anomalous outbound connections; you cannot
  immediately confirm what was accessed.
- **Discuss:** Break-glass secret rotation; assume-breach posture; rebuild from
  a known-good image; integrity re-verification (audit chain, financial recon).
- **Success criteria:** break-glass executed; clean redeploy; heightened
  monitoring scheduled; SBOM/dependency-scanning gap noted.

### Tabletop drill log

| Date | Scenario | Facilitator | Gaps found | Action items closed |
|---|---|---|---|---|
| _TBD_ | — | — | — | — |

---

## Appendix B — Quick reference card

```
DECLARE   → #incident sec=<n> ts=<utc> summary=<one line>
ROLES     → IC · Operator · Scribe · Comms · Legal
TIMELINE  → audit/incidents/<date>-<topic>.md  (UTC, every action)
CONTAIN   → revoke tokens · rotate secrets · kill-switch/read-only · block source
SECRETS   → docs/security/secret-rotation.md (break-glass)
RECOVER   → DISASTER_RECOVERY.md · re-verify audit chain · run isolation tests
NOTIFY    → PII breach? start 72h clock with Legal (GDPR Art.33 / PDPL / DPA)
LEARN     → blameless post-mortem ≤ 5 business days
```
