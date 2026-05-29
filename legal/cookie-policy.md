# Cookie Policy

> **DRAFT — pending licensed-counsel review (T-SF.2.15).** Prepared by a non-lawyer drafter for review by a qualified Iraqi commercial lawyer and GDPR-conversant counsel. It does **not** constitute legal advice and has **no** legal effect until published after sign-off. Bracketed `[…]` items require confirmation against the deployed cookie/SDK inventory.

| | |
|---|---|
| **Applies to** | Our marketing website and the Zoho Kurdish ERP / ERPIQ web application |
| **Related** | Privacy Policy (`legal/privacy-policy.md`) |
| **Version** | 0.1 (draft) |
| **Governing language** | **Arabic is the legally binding version** (RSK-19); English/Kurdish are courtesy translations |

---

## 1. What cookies are

Cookies and similar technologies (local storage, IndexedDB, pixels) are small data stored on your device. We use them to operate the Service, remember preferences, keep you signed in, and — with your consent — measure marketing performance.

## 2. Our approach

We use **privacy-friendly, cookie-less analytics (Plausible) by default**, which does not set tracking cookies or build cross-site profiles. **Non-essential** cookies and analytics (such as Google Analytics 4) load **only after you consent** via our cookie banner. You can change your choice at any time via the banner or your browser settings.

## 3. Categories of cookies and storage we use

| Category | Purpose | Consent required? | Examples |
|---|---|---|---|
| **Strictly necessary** | Sign-in/session, security (CSRF), load balancing, language/region preference | No (required to provide the Service) | Session token cookie; preference cookies |
| **Functional (app)** | Offline-first POS data and app state | No (essential to features you enable) | **IndexedDB** stores for the POS cart/session/offline queue |
| **Analytics — privacy-friendly** | Aggregate, cookie-less usage measurement | No cookies set; runs by default | Plausible (no persistent identifier) |
| **Analytics — marketing** | Marketing-funnel measurement and attribution | **Yes** (opt-in) | Google Analytics 4 `[GA4 cookies — confirm exact names]` |
| **Performance (RUM)** | Web-vitals telemetry to keep the app fast (anonymized; IP hashed) | `[Confirm classification with counsel — treated as legitimate-interest performance, not advertising]` | RUM client beacons |

We do **not** use advertising or cross-site tracking cookies.

## 4. Managing your choices

- **Cookie banner.** Accept or reject non-essential cookies; re-open the banner anytime to change your choice.
- **Browser controls.** You can block or delete cookies in your browser settings. Blocking strictly-necessary cookies may break sign-in and core features.
- **Do Not Track.** We honour explicit consent choices; where a recognized opt-out signal is sent, we treat non-essential analytics as not consented.

## 5. Third parties

Non-essential analytics may involve third-party processors (e.g., Google for GA4). Their processing is described in the Privacy Policy and, where they act on our behalf, in the **Sub-processors** list (`legal/sub-processors.md`).

## 6. Changes

We may update this policy; the "last updated" date reflects the current version. Material changes follow the Privacy Policy change process.

*Last updated: `[TO BE SET ON PUBLICATION]`.*

---

### Drafter's notes for counsel / engineering (remove before publication)

- **Verify the deployed cookie/SDK inventory** (Plausible default + consent-gated GA4 are referenced in the marketing site's AnalyticsScripts and the existing placeholder Privacy copy). List exact cookie names, durations, and providers before publication.
- Confirm RUM web-vitals classification (strictly-necessary/legitimate-interest performance vs consent) with GDPR counsel; IP is hashed per `docs/security/pii-handling.md`.
- Confirm whether an Iraqi-law cookie/ePrivacy-equivalent consent requirement applies in addition to GDPR for EU visitors.
