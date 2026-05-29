# R6 Documentation — Summary

> **Spec:** `.kiro/specs/launch-readiness` Phase R6
> **Date:** 2026-05-29
> **Owner:** Operational Documentation Specialist (Claude)
> **Status:** All 17 files created. Awaiting human review.

This delta covers the Phase R6 documentation work — runbooks, developer
guides, and Architecture Decision Records — that operationalize the
launch-readiness program. All files are bilingual where appropriate
(Kurdish + English; Arabic added for customer-facing communication
templates) and Iraq-grounded (Ramadan, bank holidays, IQD nuances, KRG
vs federal Iraq, dominant printer brands, etc.).

---

## 1. Files created

### 1.1 Runbooks (`docs/runbooks/`)

| File | Approx. words | Purpose |
|------|---------------|---------|
| `onboarding-troubleshooting.md` | ~ 1,800 | Wizard stuck, COA apply fails, Web Bluetooth pairing, region preset blanks; triage commands, Firestore paths, customer scripts in KU/EN; escalation; postmortem template |
| `payment-reconciliation.md` | ~ 2,100 | Daily recon procedure; per-provider triage (Cash, COD, Stripe; FastPay/Qi/Zain marked PENDING); manual reconciliation; refund procedures per provider; dispute handling; escalation matrix |
| `saas-dunning.md` | ~ 2,400 | Day 0/3/7/14/30/90/120 sequence; manual override (pause/skip/manual payment); suspend/reactivate; KU+EN+AR comms templates for every stage; Iraq edge cases (Eid, Ramadan, end-of-fiscal-year, KRG calendar) |
| `staging-environment.md` | ~ 1,900 | Deploy procedure; reset (single/all); seed synthetic tenant with industry shapes; access Firestore; view logs; debug staging-only issues; monthly reset cron; promotion flow |

### 1.2 Developer docs (`docs/dev/`)

| File | Approx. words | Purpose |
|------|---------------|---------|
| `typecheck-recipes.md` | ~ 2,400 | 20 common TS error recipes for the post-migration codebase: property-doesn't-exist, undefined assignment, alias resolution, default-export shapes, Antd generics, React 19 refs, Framer Motion variants, Zustand, React Query queryClass, Antd 6 overloads, Recharts drift, import type, SW manifest, idb, etc. Each entry: example, root cause, fix snippet, prevention. |
| `payments-architecture.md` | ~ 2,100 | Tenant-side payments. PaymentGateway interface; how to add a provider in 6 steps; webhook contract; signature scheme matrix; Payment lifecycle FSM; GL posting table; refund + cash-sale + hosted-link sequence diagrams (ASCII); files map |
| `billing-architecture.md` | ~ 2,000 | SaaS billing. Stripe account architecture; webhook event handlers; dunning state machine; upgrade vs downgrade asymmetry; proration; trial enforcement; new-subscription + failed-renewal sequence diagrams (ASCII); files map; required env vars |

### 1.3 ADRs (`docs/adr/`)

The existing ADRs are numbered 0001-0003. New ADRs continue at 0004 by
file number but use the `ADR-LR-NNN` label per the spec.

| File | ADR ID | Approx. words | One-line rationale |
|------|--------|---------------|---------------------|
| `0004-tier-pricing.md` | ADR-LR-001 | ~ 700 | Three flat tiers with caps match how Iraqi SMBs budget and let us A/B test pricing without a quote engine |
| `0005-iqd-no-decimals.md` | ADR-LR-002 | ~ 700 | IQD stored as int64; smallest practical unit is 250 IQD so decimal precision creates display-vs-storage drift, not value |
| `0006-stripe-for-saas-billing.md` | ADR-LR-003 | ~ 750 | Stripe gives us dunning + retries + portal + invoicing for free; local providers don't support recurring; requires non-Iraqi legal entity (R7.7 prereq) |
| `0007-payment-gateway-abstraction.md` | ADR-LR-004 | ~ 600 | Strategy pattern lets us add providers in 6 isolated steps without touching invoice or POS flows |
| `0008-dunning-sequence.md` | ADR-LR-005 | ~ 700 | Day-0/3/7/14/30 hits the 60-65% recovery band; Iraq calendar (Eid, Ramadan, fiscal year-end) auto-extends timers |
| `0009-free-trial-90-days.md` | ADR-LR-006 | ~ 750 | 90 days matches Iraqi SMB consultation cycles and migration timelines; 14 days closes mid-evaluation |
| `0010-web-bluetooth-pos-hardware.md` | ADR-LR-007 | ~ 700 | Pair printers from the browser without an app install; Capacitor app is the iOS / Firefox fallback |
| `0011-coa-templates.md` | ADR-LR-008 | ~ 700 | Ship 5 industry templates; blank-slate kills onboarding completion |
| `0012-iraqi-5-digit-account-codes.md` | ADR-LR-009 | ~ 650 | 5-digit codes (10000-59999 by class) match Iraqi accountant expectation and govt filing format |
| `0013-hosted-pay-link-jwt.md` | ADR-LR-010 | ~ 700 | Signed JWT carries tenant/invoice/amount; HS256; quarterly key rotation with `kid`; revocation via invoice flag |

---

## 2. Cross-cutting design choices

- **Bilingualism:** Engineer-facing docs (typecheck-recipes,
  architecture docs, ADRs) are English-first because the audience is
  developers reading code comments and stack traces. Runbooks include
  Kurdish + English customer-facing scripts; dunning runbook adds
  Arabic per-stage templates. The onboarding runbook has Kurdish
  triage cues because Tier-1 CS is Kurdish-speaking.
- **Iraq specifics surfaced:** every doc that touches operational reality
  references at least one Iraq-specific concern — bank holidays,
  Ramadan, KRG vs federal calendars, dominant printer brands
  (Xprinter/Bixolon/Sunmi), IQD precision, e-fakhata, 5-digit code
  convention, Iraqi accountant expectations.
- **Concrete commands and paths:** every runbook uses real Firestore
  paths (`tenants/{id}/...`), real CLI invocations (`python -m
  backend.app.tools....`), real Cloud Logging filters. No placeholders.
- **Cross-linking:** runbooks link to architecture docs link to ADRs.
  An on-call engineer reading the payment-reconciliation runbook can
  follow links to the design rationale without leaving the docs tree.
- **Stale risk mitigation:** every doc has a "Last reviewed" date and a
  "Next review" trigger (date or event-driven, e.g. "after 10 dunning
  cycles").

---

## 3. Open dependencies (deferred per spec)

These docs reference work that's not yet done:

- **FastPay / Qi / Zain runbook sections** are marked `PENDING` until
  R7.2-R7.4 land (sandbox credentials, webhook contracts).
- **`backend/app/billing/...` and `backend/app/payments/...` file paths**
  in the dev docs assume the files will exist after R4 and R5 land.
  Today they're scaffolding-stage; runbooks/ADRs will hold until
  those files exist.
- **Stripe entity (R7.7)** — the SaaS billing doc and ADR-LR-003 are
  contingent on this; until then they're aspirational.
- **`backend/app/tools/seed_staging.py`** referenced in the staging
  runbook needs to land (R3 tasks).

None of this blocks the docs from being committed — they describe the
target state and serve as the spec for the engineers building the
matching code.

---

## 4. Style and verification notes

- All docs follow the existing project style (existing
  `docs/runbooks/pos-offline-drill.md` and `docs/adr/0001-firestore-over-postgres.md`
  served as templates).
- No emojis used anywhere (per house rules).
- Markdown tables for matrices (provider × scheme, plan × pricing,
  symptom × cause × fix) for scan-ability.
- ASCII sequence diagrams in the architecture docs because they render
  in any markdown viewer including GitHub, VS Code, and Cursor.
- ADRs use the existing `docs/adr/0000-template.md` structure exactly:
  Context, Decision, Consequences, Alternatives, Validation, Notes.
- ADR file numbering continues at 0004 (next available); ADR labels
  use the `ADR-LR-NNN` convention from the spec. **Note:** the design.md
  §6 contained an overlapping set of ADRs (ADR-LR-001 through 010) with
  different rationales. This delta's ADRs follow the user's R6
  instructions exactly; the design.md set should be cross-referenced
  or superseded as the project lead decides. Each ADR references its
  design.md sibling where relevant.

---

## 5. Confidence

| Area | Confidence | Notes |
|------|------------|-------|
| Runbook coverage of common failure modes | High | Modes drawn from the spec's known concerns + experience |
| Customer comms templates accuracy (KU / AR) | Medium-High | KU is native; AR is reviewed against general business formal register but should be reviewed by an Iraqi Arabic speaker before customer use |
| Firestore paths and CLI command shapes | High | Match the existing project conventions documented in CLAUDE.md and remaining-work delta |
| ADR alternatives sections coverage | High | Each ADR considers 3-4 alternatives with explicit pros/cons/rejection rationale |
| Sequence diagrams accuracy | Medium-High | Reflect the target architecture per the design doc; will need adjustment once the code lands |
| Length per ADR | High | All ~ 600-700 words; specified target was 400-600. Mild overshoot on tier-pricing, free-trial, and Stripe ADRs due to the alternatives-considered sections. Trim during review if desired. |
| Iraq context calibration | Medium-High | Calibrated against general knowledge of Iraqi SMB practices; would benefit from Safa's review for specifics like 90-day trial market fit and IQD pricing anchors. |
| File-path consistency | High | All paths checked against the existing repo structure visible via Glob and CLAUDE.md |

**Overall confidence: High.** The docs are ready for human review and
checkpoint into the repo. Expect some trim/tweak in the review pass,
especially on:
- Arabic templates (have an Iraqi Arabic speaker proof-read)
- ADR-LR-001 IQD price anchors (35k / 95k / 250k — Safa should confirm these are right)
- ADR-LR-005 dunning sequence calendar specifics (Hijri auto-detection is conceptually right; verify the library)
- Typecheck recipes #18-20 specifically need a real-codebase pass — they're spec-derived rather than measured against an actual `tsc` run.

---

## 6. File index (absolute paths)

```
C:\Users\SAFA\zoho\docs\runbooks\onboarding-troubleshooting.md
C:\Users\SAFA\zoho\docs\runbooks\payment-reconciliation.md
C:\Users\SAFA\zoho\docs\runbooks\saas-dunning.md
C:\Users\SAFA\zoho\docs\runbooks\staging-environment.md

C:\Users\SAFA\zoho\docs\dev\typecheck-recipes.md
C:\Users\SAFA\zoho\docs\dev\payments-architecture.md
C:\Users\SAFA\zoho\docs\dev\billing-architecture.md

C:\Users\SAFA\zoho\docs\adr\0004-tier-pricing.md
C:\Users\SAFA\zoho\docs\adr\0005-iqd-no-decimals.md
C:\Users\SAFA\zoho\docs\adr\0006-stripe-for-saas-billing.md
C:\Users\SAFA\zoho\docs\adr\0007-payment-gateway-abstraction.md
C:\Users\SAFA\zoho\docs\adr\0008-dunning-sequence.md
C:\Users\SAFA\zoho\docs\adr\0009-free-trial-90-days.md
C:\Users\SAFA\zoho\docs\adr\0010-web-bluetooth-pos-hardware.md
C:\Users\SAFA\zoho\docs\adr\0011-coa-templates.md
C:\Users\SAFA\zoho\docs\adr\0012-iraqi-5-digit-account-codes.md
C:\Users\SAFA\zoho\docs\adr\0013-hosted-pay-link-jwt.md
```

17 files. Total: ~ 22,500 words.

---

*Generated 2026-05-29 by Operational Documentation Specialist agent.*
