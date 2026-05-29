# Launch-Readiness Spec — Authoring Summary

> **Spec authored:** 2026-05-29
> **Owner:** Safa Othman
> **Status:** Draft v1.0 — ready for review

## Files produced

| File | Path | Word count (approx.) |
|------|------|----------------------|
| Requirements | `.kiro/specs/launch-readiness/requirements.md` | ~ 5,400 |
| Design | `.kiro/specs/launch-readiness/design.md` | ~ 5,800 |
| Tasks | `.kiro/specs/launch-readiness/tasks.md` | ~ 5,200 |
| **Total** | | **~ 16,400 words** |

## Scope covered

The spec addresses the **five launch blockers** between "code exists" and "first paying Iraqi customer":

1. **R1 — Compile + Build Health** — `tsc --noEmit` gating, pre-commit hardening, path-alias drift detection, orphan-file scan, truncation detector, React-19 strict-mode audit, top-20 typecheck recipes.
2. **R2 — Backend Quick-Create Endpoint Completeness** — 13 endpoints fully scoped (contacts, items, taxes, accounts, expense-categories, equipment-categories, subscription-plans, locations, teams, bank-accounts, currencies, tags, payment-methods) with Pydantic schemas, idempotency, per-tenant rate-limiting, RBAC, integration-test harness.
3. **R3 — Staging Environment** — `zoho-staging` GCP project, Vercel staging environment, `staging.erp.zoho.kurd.iq` subdomain, synthetic tenant seeder, monthly reset cron, `staging-smoke` workflow as a required production-deploy check.
4. **R4 — First-Run Onboarding Wizard** — 5-step state machine (Company → Iraq Region → COA → POS hardware → First sale), governorate-aware tax presets for all 18 Iraqi governorates, 5 COA templates (small/medium general trade, restaurant, pharmacy, construction), Web Bluetooth printer pairing, guided first sale.
5. **R5 — Dual Payment System** — Tenant-side `PaymentGateway` abstraction (Cash, COD, FastPay, Qi Card, Zain Cash, Asia Pay, Stripe) plus SaaS billing (Stripe for international, FastPay business / manual invoice for Iraqi tenants), webhook handlers per provider, nightly reconciliation jobs, refund + GL reversal flow, full 5-stage dunning sequence.

## Top-5 risks identified (from `tasks.md` Risk Register)

1. **`tsc --noEmit` baseline > 500 errors** (RR-1) — likelihood High, impact High. Mitigation: time-boxed 3-day ratchet, extending to 2 weeks if baseline > 300.
2. **Iraqi payment-provider sandboxes inaccessible or undocumented** (RR-3) — Stripe + Cash + COD remain the floor; gateway abstraction is provider-pluggable.
3. **Qi Card business onboarding > 4 weeks** (RR-5) — launch with FastPay + Cash + COD; add Qi post-launch.
4. **Stripe entity-formation delay blocks SaaS billing collection** (RR-14) — launch Iraqi-only first; international ~ a month later.
5. **Web Bluetooth unreliable on Iraqi-market Android tablets** (RR-9) — fall back to USB/serial via a small Cordova plugin in the mobile build.

## Cross-references to other specs

- `world-class-performance` — R2 (React Query classes) and R6.1 (RUM ingest) are upstream.
- `empty-state-quick-create` — `<SelectWithQuickCreate>` consumes the registry that our R1 endpoints back.
- `super-admin-console` — extended in T-LR.5.7 with MRR / churn / dunning views.
- `phase-4-pos-iraq` — POS receipt + Bluetooth primitives reused in T-LR.3.9 and T-LR.4.15.
- `data-integrity-wave` — tenant-scoping foundation our payments + billing data leans on.
- `growth-to-100` / `scale-foundation` (referenced in prompt) — downstream specs that pick up after launch; not authored here.

## Open Questions list (from `tasks.md` Phase R7)

| ID | Question | Owner | Target |
|----|----------|-------|--------|
| T-LR.7.1 | Verify Iraq tax rates per governorate with a tax accountant | Safa | Week 2 |
| T-LR.7.2 | FastPay business sandbox credentials + recurring availability | Safa | Week 1 |
| T-LR.7.3 | Qi Card business API access process | Safa | Week 2 |
| T-LR.7.4 | Zain Cash merchant API documentation | Safa | Week 3 |
| T-LR.7.5 | Asia Pay / Asia Hawala API — needed for launch? | Safa | Week 4 |
| T-LR.7.6 | E-Fakhata (Iraq E-Invoice) schema version | Safa | Week 4 |
| T-LR.7.7 | Stripe payable entity (Atlas vs direct US/UK C-corp) | Safa + legal | Week 2 |
| T-LR.7.8 | Iraqi POS thermal printer compatibility list | Safa | Week 3 |

## Style notes

- All 5 requirement groups use **EARS** ("THE system SHALL …") format consistent with `world-class-performance` and `empty-state-quick-create`.
- Glossary includes both Iraq-specific (E-Fakhata, Qi Card, FastPay, Zain Cash, Asia Hawala, IQD, governorate, mutawassit, PDPL, KRG) and technical terms (`tsc --noEmit`, path alias, Pydantic, idempotency key, webhook, reconciliation, synthetic tenant, `PaymentGateway`, settlement, 3DS, SaaS billing, onboarding state machine, region preset).
- 10 ADR-style decision entries documented in `design.md` § Section 6.
- 86 tasks with IDs `T-LR.X.Y`, each carrying Description, Acceptance, Effort, Owner, BlockedBy.
- 15-entry risk register.
- 13-row success-metrics table.

## What is intentionally not covered

Per the spec's Out of Scope section: native app-store releases, multi-merchant Stripe Connect setups, embedded finance, multi-currency tax tables beyond per-region presets, automatic FX updates, voice/chatbot onboarding, marketplace, multi-region SaaS billing beyond Iraq + international generic, full PCI-DSS Level 1 (we target SAQ-A via hosted payment pages).

## Effort summary

| Phase | Days | Window |
|-------|------|--------|
| R0 Compile + Type Health | 6 | Week 1 |
| R1 Backend Endpoints | 10 | Weeks 1–3 |
| R2 Staging | 6 | Weeks 2–3 |
| R3 Onboarding Wizard | 12 | Weeks 3–5 |
| R4 Tenant Payments | 16 | Weeks 4–7 |
| R5 SaaS Billing | 7 | Weeks 6–8 |
| R6 Cross-cutting | 5 | Throughout |
| **Total** | **62 days** | **8 weeks calendar** |

## Recommended next actions

1. Safa reviews `requirements.md` end-to-end and flags any Iraq-context inaccuracies (especially the placeholder tax rates in the glossary and the COA template assumptions).
2. Send Open Question T-LR.7.1, T-LR.7.2, T-LR.7.3 to the relevant external parties this week (tax accountant + FastPay business team + Qi Card business team) since they are on the critical path.
3. Spin up `zoho-staging` GCP project immediately (T-LR.2.1) — it has no external dependencies and unblocks the rest of Phase R2.
4. Run `npx tsc --noEmit` in `frontend/` to capture the real baseline (T-LR.0.1) so the team knows the size of the typecheck hill.
5. Schedule a 30-minute review session with the dev team to walk through the 86 tasks and confirm ownership assignments.
