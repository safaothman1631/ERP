# Service Level Agreement (SLA)

> **DRAFT — pending licensed-counsel review (T-SF.2.13).** Prepared by a non-lawyer drafter for review by a qualified Iraqi commercial lawyer and confirmation against the platform's measured availability posture (scale-foundation R5 / DISASTER_RECOVERY.md). It does **not** constitute legal advice and has **no** legal effect until published after sign-off. Bracketed `[…]` items require confirmation.

| | |
|---|---|
| **Applies to** | The Zoho Kurdish ERP / ERPIQ production Service, for paid subscriptions in good standing |
| **Forms part of** | The Terms of Service (`legal/terms-of-service.md`) and, for enterprise, the MSA (`legal/msa.md`, Exhibit A) |
| **Version** | 0.1 (draft) |
| **Governing language** | **Arabic is the legally binding version** (RSK-19); English/Kurdish are courtesy translations |

---

## 1. Uptime commitment

We commit to a **Monthly Uptime Percentage of at least 99.5%** for the production Service.

**"Monthly Uptime Percentage"** = `(Total minutes in the calendar month − Downtime minutes) ÷ Total minutes in the calendar month × 100`, rounded to two decimals.

**"Downtime"** means a period during which the core Service (sign-in, the application API, and data read/write) is unavailable to you, as confirmed by our monitoring and external probes, **excluding** the events in §4.

## 2. Service-credit ladder

If we miss the commitment in a calendar month, you may claim a **Service Credit** calculated as a percentage of the fees for the affected Service for that month:

| Monthly Uptime Percentage | Service Credit |
|---|---|
| **≥ 99.5%** | 0% |
| **99.0% – 99.49%** | **10%** of that month's fees |
| **95.0% – 98.99%** | **25%** of that month's fees |
| **< 95.0%** | **50%** of that month's fees |

- **Maximum credit** in any single month is **100%** of that month's fees for the affected Service.
- Service Credits are your **sole and exclusive remedy** for any failure to meet the uptime commitment.
- Credits are applied to a **future invoice**; they are **not** paid in cash and are not refundable.
- Credits do not apply to one-time, usage-based, or professional-services fees.

## 3. How to claim a credit

3.1 Submit a claim to **`[billing@zoho.kurd.iq]`** **within thirty (30) days** of the end of the month in which the Downtime occurred.

3.2 Include: the dates and times of the Downtime you observed, the affected organization (`org_id`) and users, and any logs or evidence.

3.3 We will validate the claim against our monitoring and incident records and apply approved credits to your next invoice within `[two (2) billing cycles]`.

## 4. Exclusions

Downtime does **not** include unavailability arising from:

1. **Scheduled maintenance** — up to **four (4) hours per month**, announced with at least **72 hours' notice** (via email and in-app/status page). Emergency maintenance to address a security or stability risk is also excluded, with as much notice as practicable.
2. **Force Majeure** events as defined in the Terms of Service §12 (including electricity outages exceeding eight (8) hours, nationwide/regional internet outages, and government service-blocking).
3. **Customer-caused issues** — your acts or omissions, your equipment, networks, or software, misuse, or breach of the AUP; your exceeding plan limits or rate limits.
4. **Sub-processor outages** that exceed the relevant sub-processor's own SLA — we **pass through** those sub-processor commitments and are not liable beyond them (e.g., a confirmed Google Cloud regional incident; see DISASTER_RECOVERY.md §4.2).
5. **Beta, trial, free, or preview** features, which are provided "as is" without an SLA.
6. **Suspension** properly exercised under the Agreement (e.g., non-payment, security risk).

## 5. Status, monitoring & incident response

5.1 We publish service status at **`[status.zoho.kurd.iq]`** and post incident updates during a SEV-1, at least every **15 minutes**, per the incident process in `DISASTER_RECOVERY.md`.

5.2 Our recovery objectives for the user-facing Service are **RTO 1 hour / RPO 5 minutes** (DISASTER_RECOVERY.md §1). These are operational targets, not additional SLA commitments.

## 6. Support response targets

Support first-response targets by tier are set out in the MSA §4 for enterprise customers; standard subscriptions receive best-effort support during business hours (08:00–22:00 Baghdad time). Support response is a target, not a credit-bearing SLA.

---

### Drafter's notes for counsel (remove before publication)

- **Confirm the 99.5% commitment is achievable** given the single-primary-region posture (me-central1) before publishing externally (R5 confirmation, per task T-SF.2.13 exit criteria). The credit ladder values (0/10/25/50, max 100%, 30-day claim) are fixed by design.md §2.6 and the SF2 task brief.
- Confirm scheduled-maintenance allowance (≤ 4h/month, 72h notice) matches operational practice.
- Confirm the sub-processor pass-through (§4.4) is consistent with RSK-16 and the upstream Google Cloud / Vercel SLAs.
