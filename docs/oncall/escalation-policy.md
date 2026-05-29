# On-Call Escalation Policy

> scale-foundation SF1 / T-SF.1.12 — 4-layer escalation.
> Status: active once the paging tool (PagerDuty/Opsgenie, T-SF.1.11) and the
> 3-person rotation (T-SF.1.13) are live. Until then, the founder is the sole
> responder (bus factor = 1 — the exact risk SF1 closes).

## Severity definitions

| Sev | Definition | Examples | Target response (MTTA) | Target resolve (MTTR) |
|-----|------------|----------|------------------------|------------------------|
| **P1** | Customer-facing outage or data risk | API down, login broken, POS can't sync, billing double-charge, suspected data breach | **5 min**, 24/7, paged | 60 min |
| **P2** | Major degradation, no full outage | High latency, one module failing, e-Fakhata queue stuck, backup-verify red | 30 min (business hrs), 60 min (off-hrs) | 4 h |
| **P3** | Minor / cosmetic / single-tenant | One report wrong, UI glitch, non-urgent bug | next business day | best-effort |

## The 4 escalation layers

A page escalates to the next layer automatically if the current layer does not
**acknowledge** within the window.

| Layer | Who | Ack window | Notes |
|-------|-----|-----------|-------|
| **L1 — Primary on-call** | rotation engineer of the week | 5 min (P1) / 15 min (P2) | First responder; owns the incident until handed off |
| **L2 — Secondary on-call** | next engineer in rotation | +5 min | Paged if L1 doesn't ack, or pulled in by L1 for help |
| **L3 — Ops/SRE Lead** | Ops/SRE Lead (T-SF.1.5) | +10 min | Owns infra/GCP; declares Incident Commander for P1 |
| **L4 — Founder** | Safa | +10 min | Final backstop; customer comms + business decisions (refunds, SLA credits) |

For a **P1**, L3 and L4 are notified immediately (awareness, not paged) in
parallel with L1 — they don't wait for escalation to learn an outage is live.

## Routing

- **Paging (wakes someone up):** P1 always; P2 only during the responder's
  off-hours if it risks becoming P1.
- **Awareness (Slack `#alerts`, no page):** P2 business-hours, P3 always, and
  every alert-policy fire from `terraform/monitoring/alerts.tf`.
- Channels are wired in `terraform/monitoring/` (PagerDuty for page, Slack for
  awareness) — see T-SF.5.6.

## Incident roles (P1)

- **Incident Commander (IC):** coordinates, decides, owns the timeline. Usually L3.
- **Comms:** customer-facing status (status page, affected-tenant email). Usually L4.
- **Ops:** hands on keyboard (the responder). 
One person may hold multiple roles in a small team, but IC and Ops should be
different people once the 3-person core exists.

## Worked example (P1 — API down)

1. Synthetic check + 5xx-rate alert fire → PagerDuty pages **L1** (`#alerts` also posts).
2. L1 doesn't ack in 5 min (asleep) → auto-escalates to **L2**; L3/L4 already notified.
3. L2 acks, opens incident, pulls the [API-down runbook](../runbooks/) and [DR runbook](../runbooks/dr-restore.md).
4. L3 (Ops Lead) joins, takes **IC**; L4 drafts the status-page note (Comms).
5. Mitigated within RTO (≤ 60 min); IC declares resolved; blameless postmortem filed in `audit/` within 48 h.

## Maintenance

- Reviewed quarterly with the rotation (T-SF.1.20 Incident Command training).
- Contact details (phone/Slack handle per person) live in the paging tool, **not**
  in this repo, and must be filled before go-live.
