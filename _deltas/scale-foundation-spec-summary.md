# Delta: Scale Foundation Spec — Tier 3 (100 → 1000+ customers)

**Date:** 2026-05-29
**Author:** Claude (Specifications Architect role)
**Files produced:**
- `.kiro/specs/scale-foundation/requirements.md`
- `.kiro/specs/scale-foundation/design.md`
- `.kiro/specs/scale-foundation/tasks.md`

---

## Approximate word counts

| File | Lines | Approx words |
|------|-------|--------------|
| requirements.md | 251 | ~5,400 |
| design.md | 628 | ~5,900 |
| tasks.md | 273 | ~5,200 |
| **Total** | **1,152** | **~16,500** |

(Estimated from line × average words per line for prose-heavy markdown with tables.)

---

## What this spec covers

Six requirement groups, each independently a "stop everything else" blocker before 1000 customers:

| # | Group | Cost ballpark |
|---|-------|---------------|
| R1 | Team & Operational Maturity (3-person core, runbooks, on-call) | USD 60K–120K people; USD 5K tools |
| R2 | Legal & Compliance Foundation (LLC, ToS, Privacy, DPA, MSA, SLA, insurance) | USD 9K–18K |
| R3 | Disaster Recovery Drilled (RPO 5min, RTO 1h, quarterly drill, per-tenant restore) | USD 1K/year storage |
| R4 | Security & Tenant Isolation (pen test, SOC 2 Type I path, bug bounty, SIRP) | USD 50K–90K |
| R5 | Observability Production-Grade (BigQuery + 6 dashboards + 24 alerts + OTel) | USD 2K/year |
| R6 | Production UAT with 5 Iraqi pilot shops | USD 4K–8K hardware |

**Total Tier-3 budget envelope:** USD 130K–240K across 9–14 months.

---

## Top 5 risks (called out explicitly in tasks.md risk register)

1. **RSK-7 Founder burnout** — single point of failure on legal + sales + ops + on-call. Mitigation: aggressive hire sequence, mandatory vacation, advisor cadence, share refund + deploy authority by month 4.
2. **RSK-2 Iraqi senior talent thin** — key hires may take 6 months instead of 6 weeks. Mitigation: week-1 outreach, widen funnel, accept remote, raise upper band USD 6K if needed, contract bridge senior at USD 70/h.
3. **RSK-1 Pen test discovers Critical multi-tenant breach** — finds an IDOR or rules-bypass that takes weeks to remediate. Mitigation: T-SF.4.1–T-SF.4.9 pre-hardening, USD 10K reserve for emergency remediation, accept-and-retest ADR.
4. **RSK-9 SOC 2 Type I fails first attempt** — auditor finds material gaps. Mitigation: Drata pre-audit dashboard requirement ≥ 90% green before fieldwork, USD 5K reserve for re-engagement.
5. **RSK-3 Iraqi LLC formation delayed** — bureaucratic timeline > 12 weeks. Mitigation: SaaS-experienced lawyer, pre-prepared docs, UAE Free Zone (DIFC ~ USD 6K, faster) as fallback.

Honorable mentions:
- **RSK-5 Pilot NPS < 30** (product not ready) — would force a delay of broader sales.
- **RSK-8 Cyber insurance carrier denies** Iraq-domiciled co — fallback to self-insurance reserve or Dubai entity.
- **RSK-17 GCP me-central1 outage** — rare but consequential; cross-region restore + SLA force-majeure language.

---

## Cross-references

- **`launch-readiness` (Tier 1):** assumed delivered — first paying customer, billing live. SF builds on it.
- **`growth-to-100` (Tier 2):** sales motion + packaging assumed delivered — SF needs ≥ 100 paying tenants as ramp context. R6 pilots feed reference customers back into Tier 2 sales motion.
- **`world-class-performance`:** R6 of that spec (observability instrumentation) and R7 (security baseline) are technical prerequisites for SF5 and SF4. SF *provisions* what `world-class-performance` *instruments*.
- **`firestore-performance-resilience`:** depends-on for SF3 (PITR + backup architecture).
- **`database-foundation-excellence`:** depends-on for SF4 (rules audit baseline).

---

## Open questions for Safa to decide before SF1 kickoff

1. **Hiring sequence FE-first vs Ops-first?** Spec recommends FE-first (Hire #1) because founder is bottlenecked on shipping; Ops/SRE second because incidents are currently rare. Validate.
2. **PagerDuty vs Opsgenie?** Spec recommends PagerDuty (better Iraqi SMS, mature). Acceptable to start with Opsgenie if cash-constrained.
3. **Help AG (Dubai) vs NCC Group for pen test?** Spec recommends Help AG year 1 (USD 18K–28K) vs NCC USD 25K–35K. Validate brand-name vs price tradeoff.
4. **Drata vs Vanta vs Secureframe for SOC 2 automation?** Spec recommends Drata. Validate.
5. **Bugcrowd vs HackerOne for bug bounty?** Spec recommends Bugcrowd. Validate.
6. **Iraqi LLC vs UAE Free Zone (DIFC) domicile?** Spec recommends Iraqi LLC for Iraqi market credibility, UAE as fallback if delays. Confirm.
7. **Pilot conversion discount: 40% year-1?** ADR-112 recommendation. Validate.
8. **SLA publish 99.5% or 99.9%?** Spec recommends 99.5% (operationally safer; matches `world-class-performance` R6.7 error budget). Validate.
9. **Customer data residency offer for enterprise customers?** Defer to growth-to-1000 or include in MSA Annex now?
10. **Office: Erbil only or distributed?** Spec recommends 2-day in-office Erbil + 3-day remote. Validate.

---

## What this spec deliberately does NOT cover

(Listed in requirements.md "Out of Scope" — surfaced here for orientation:)

- SOC 2 Type II (Type I only in this phase)
- ISO 27001 full certification (gap analysis only)
- PCI-DSS (don't store card data)
- Multi-region active-active (active-passive only)
- Enterprise SSO (belongs to growth-to-100)
- Public bug bounty (private only here)
- Statistically powered PMF study (qualitative only here)
- Hiring beyond first 3 (belongs to growth-to-1000)
- International market expansion (Iraq only)

---

## Files modified

| File | Action |
|------|--------|
| `.kiro/specs/scale-foundation/requirements.md` | Created |
| `.kiro/specs/scale-foundation/design.md` | Created |
| `.kiro/specs/scale-foundation/tasks.md` | Created |
| `_deltas/scale-foundation-spec-summary.md` | Created (this file) |

No source code modified. Pure specification work.

---

## CLAUDE.md update note

Per project convention, a line should be added to the change log in `CLAUDE.md`:

```
### 2026-05-29 — Tier 3 Scale Foundation spec authored

- `.kiro/specs/scale-foundation/requirements.md` — 6 requirement groups covering team, legal, DR, security, observability, UAT (≈ 5.4K words).
- `.kiro/specs/scale-foundation/design.md` — system + organizational design with vendor selection, comp bands, runbook matrix, ADRs (≈ 5.9K words).
- `.kiro/specs/scale-foundation/tasks.md` — 6 phases SF1–SF6 with 100+ tasks, 20-entry risk register, USD 130K–240K budget envelope (≈ 5.2K words).
- `_deltas/scale-foundation-spec-summary.md` — summary + open questions.
```

(Left as recommendation; not auto-applied since this was a specification-authoring task only.)
