# On-Call Rotation

> scale-foundation SF1 / T-SF.1.13 — 3-person weekly rotation with Sunday handoff.

## Model

- **3-person rotation** (Founder, Ops/SRE Lead, Sr. FE/FS) once both hires are
  onboarded (T-SF.1.2, T-SF.1.5). Until then it is founder-only — documented here
  so the schedule is ready the day the third person signs.
- **Weekly cadence**, **handoff every Sunday 18:00 Baghdad (15:00 UTC)**.
- Each engineer is **primary** one week in three; the next person in the cycle is
  **secondary** (L2 in the [escalation policy](./escalation-policy.md)).
- The schedule is **pre-published 12 weeks out** in the paging tool so people can
  plan life around it (T-SF.1.13 exit criterion).

## Why weekly (not daily)

Daily rotation fragments context mid-incident; weekly keeps one owner across a
problem's lifecycle. The Sunday handoff lands before the Iraqi work week
(Sun–Thu) so the incoming primary starts fresh on day one.

## Handoff checklist (outgoing → incoming, every Sunday)

- [ ] Walk through any open incidents / still-degraded components.
- [ ] Review the week's alerts in `#alerts` — anything noisy or recurring?
- [ ] Confirm `backup-verify` is green and the last DR drill log is filed.
- [ ] Flag any planned maintenance / deploys in the incoming week.
- [ ] Confirm the incoming primary's phone + paging app are working (test page).
- [ ] Post the handoff note in `#oncall` (template below).

```
:rotating_light: On-call handoff <date>
Outgoing: <name>  →  Incoming primary: <name>  | Secondary: <name>
Open incidents: <none | links>
Watch items: <noisy alert / fragile area / planned deploy>
Backups: verify <green/red> | last DR drill: <date>
```

## Holiday & override procedure

- **Planned absence:** swap weeks with another rotation member ≥ 1 week ahead;
  update the paging tool override (not this file).
- **Public holidays (Iraqi + religious):** the primary may pre-arrange a covering
  secondary; if no one is available, the **Ops/SRE Lead** is default holiday cover,
  then the **Founder** (L4) as final backstop.
- **Mandatory vacation (T-SF.X.3):** each member takes ≥ 1 week fully off-rotation
  per quarter — burnout (RSK-7) is a Tier-3 risk, not a badge of honor.

## Mapping to the paging tool

- The rotation, escalation windows, and overrides are configured in PagerDuty /
  Opsgenie (T-SF.1.11) — this doc is the **human-readable source of intent**; the
  tool is the **enforced source of truth**. Keep them in sync at each handoff.
- Per-person contact details (phone, Slack handle) live in the tool, never here.

## Compliance hook

The weekly handoff is also when the **IAM leaver audit**
(`scripts/ops/iam-leaver-audit.py`, T-SF.1.17) output is reviewed — a leaver who
left the rotation must also be gone from GCP IAM within 24 h.
