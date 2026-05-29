# Architecture Decision Records (ADRs)

Significant, hard-to-reverse decisions in this codebase, captured in
[Michael Nygard's format](https://github.com/joelparkerhenderson/architecture-decision-record).
Each ADR is immutable once **Accepted**; to change a decision, add a new ADR that
**supersedes** the old one (don't edit history).

- Authored under scale-foundation SF1 / **T-SF.1.9** (seed 20 ADRs capturing
  existing implicit decisions).
- New ADRs: copy [`0000-template.md`](0000-template.md), take the next number.

| # | Decision | Status |
|---|----------|--------|
| 0001 | [Stay on Firestore (not Postgres + Hasura)](0001-firestore-over-postgres.md) | Accepted |
| 0002 | [Workbox via `vite-plugin-pwa` (don't hand-roll the SW)](0002-workbox-sw.md) | Accepted |
| 0003 | [Capacitor for the native mobile shell (not React Native)](0003-capacitor-mobile.md) | Accepted |
| 0004 | [Tier-based pricing: Starter / Growth / Pro](0004-tier-pricing.md) | Accepted |
| 0005 | [IQD pricing and calculations without decimals](0005-iqd-no-decimals.md) | Accepted |
| 0006 | [Stripe (not a local provider) for SaaS subscription billing](0006-stripe-for-saas-billing.md) | Accepted |
| 0007 | [PaymentGateway abstraction (Strategy pattern)](0007-payment-gateway-abstraction.md) | Accepted |
| 0008 | [Dunning sequence day-3 / 7 / 14 / 30](0008-dunning-sequence.md) | Accepted |
| 0009 | [Free trial: 90 days](0009-free-trial-90-days.md) | Accepted |
| 0010 | [Web Bluetooth for POS hardware pairing](0010-web-bluetooth-pos-hardware.md) | Accepted |
| 0011 | [Chart of Accounts: ship templates, not blank-slate](0011-coa-templates.md) | Accepted |
| 0012 | [Iraqi 5-digit Chart of Accounts code convention](0012-iraqi-5-digit-account-codes.md) | Accepted |
| 0013 | [Hosted payment link via signed JWT](0013-hosted-pay-link-jwt.md) | Accepted |
| 0014 | [Pin `signxml>=4.0` (pyOpenSSL-free) for e-Fakhata XAdES signing](0014-signxml-4-for-xades.md) | Accepted |
| 0015 | [Ship Iraqi payment gateways as registered-but-stubbed adapters](0015-iraqi-gateways-stub-pending-credentials.md) | Accepted |
| 0016 | [`zoho-83cda` is the single canonical Firebase/Firestore project](0016-firebase-project-consolidation.md) | Accepted |
| 0017 | [In-process APScheduler for background jobs](0017-apscheduler-in-process.md) | Accepted |
| 0018 | [CSRF double-submit + SameSite=Strict, with a Bearer-auth exemption](0018-csrf-double-submit-samesite-strict.md) | Accepted |
| 0019 | [Workload Identity Federation for CI→GCP (no SA JSON keys)](0019-workload-identity-federation.md) | Accepted |
| 0020 | [Per-tenant DR restore with four-eyes approval + diff preview](0020-per-tenant-dr-restore-four-eyes.md) | Accepted |

> Numbers 0004–0015 carry legacy `ADR-LR-0xx` titles from the launch-readiness
> series; they are renumbered into this unified sequence here.
