# ADR-LR-010 — Hosted payment link via signed JWT

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Backend lead, Security review (TBD) |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | ADR-LR-004 (PaymentGateway); `.kiro/specs/launch-readiness` T-LR.4.16; `docs/dev/payments-architecture.md` §8 |

## 1. Context

When a tenant emails an invoice to their customer, the email needs a
"Pay now" link the customer can click. The link must:

* Identify the invoice without exposing internal IDs in a guessable shape.
* Work without the customer needing to log in (most are walk-up payers, not tenant users).
* Authorize a payment for the specific invoice's specific amount.
* Be short-lived (a payment link emailed in February shouldn't work in June).
* Be revocable if the tenant cancels or refunds the invoice.
* Show the tenant's enabled providers (so customer can pick Cash, FastPay, Stripe, etc.).

The link is shared via email, WhatsApp, or SMS — over channels we don't
control. Anyone with the link can attempt to pay, but we want to ensure
they can only pay the intended invoice for the intended amount.

Three approaches to the link's "identity carrier":

1. **Opaque token in DB** — generate a random token, store it server-side, look up on visit.
2. **Signed JWT** — embed the relevant claims in a JWT, sign with our key, validate on visit.
3. **Path + query** — `/pay/<invoice_id>?token=<hmac>` — token is HMAC over invoice details.

## 2. Decision

**The hosted payment link uses a signed JWT carrying tenant_id,
invoice_id, amount_minor, currency, and exp. The JWT is signed with
`PAY_LINK_SIGNING_KEY` (HS256) and rotated quarterly.**

URL structure:

```
https://pay.erp.zoho.kurd.iq/?t=<jwt>
```

The JWT payload:

```json
{
  "tid": "tenant_id",
  "iid": "invoice_id",
  "amt": 50000,         // minor units, IQD has no decimals (ADR-LR-002)
  "cur": "IQD",
  "iat": 1748520000,
  "exp": 1748606400,    // default 24h; tenant-configurable up to 30d
  "kid": "v3"           // key ID — supports rotation
}
```

Validation flow:

1. Parse JWT; verify signature with the key whose `kid` matches.
2. Check `exp` against now.
3. Look up the invoice; verify `amt`, `cur` still match (in case the
   invoice changed after the link was issued — we reject if so).
4. Look up the tenant's payment provider config; render the provider
   picker.
5. The pay action calls our standard `POST /api/payments/charge` with
   the invoice context resolved from the JWT.

Revocation:

* Server-side, the invoice doc has a `pay_link_revoked: bool`. If true,
  any JWT for it rejects regardless of expiry.
* Tenants who cancel an invoice automatically flip the revoked flag.

## 3. Consequences

### Positive

* No DB lookup on the issuance side — JWT is self-contained for verification.
* The URL is shareable but tamper-evident; changing the amount or invoice ID invalidates the signature.
* Short default expiry (24h) limits replay risk.
* Quarterly key rotation reduces blast radius if a key is ever exfiltrated.
* `kid` field allows multiple active keys during rotation.

### Negative

* JWTs are long URLs (~ 250-400 characters) which can be awkward in SMS. We mitigate with a URL shortener (`erp.zoho.kurd.iq/p/<8char>` that 302s to the full JWT URL) when SMS is the channel.
* The signing key must never leak. We rotate quarterly and keep current+previous active so links don't break mid-rotation.
* Embedding `amount_minor` in the JWT means re-issuing the link if the invoice amount changes (e.g. partial payment). We accept this — invoice amount changes are rare.
* No instant revocation without server-side state — but we added the `pay_link_revoked` flag for that exact case, so the JWT alone isn't authoritative.

### Neutral / known unknowns

* If a customer pays via the link and the JWT expires mid-payment (between provider redirect and webhook), we accept the webhook anyway because the provider_payment_id is authoritative at that point. The JWT is for the pre-payment authorization only.

## 4. Alternatives considered

### Alternative A — Opaque token in DB

* **Pros:** Easy to revoke (delete the row); simpler validation logic.
* **Cons:** Requires a DB lookup on every pay-page load; adds a table to maintain (`payment_links`); harder to expose to the frontend without leaking shape.
* **Why rejected:** We prefer self-contained tokens; the revocation case is handled by `pay_link_revoked` on the invoice doc, which we already read.

### Alternative B — Path + HMAC (`/pay/<invoice_id>?sig=<hmac>`)

* **Pros:** Shorter URLs; invoice_id is visible (no DB lookup for routing).
* **Cons:** Invoice ID in the URL is technically PII-adjacent; HMAC alone doesn't carry expiry (we'd add a separate `exp` param, recreating JWT).
* **Why rejected:** Reinvents JWT badly.

### Alternative C — Magic-link email with full server session

* **Pros:** Pure-session model; pay page is just an authenticated session.
* **Cons:** Customer isn't a tenant user; we don't want to create an account for every payer. Session lifetime is awkward.
* **Why rejected:** Wrong identity model.

### Alternative D — Stripe Checkout link only

* **Pros:** Stripe handles everything including expiry.
* **Cons:** Locks every paying customer into Stripe; Iraqi customers paying via FastPay/Cash can't use a Stripe checkout link.
* **Why rejected:** Single-provider; we need multi-provider links.

## 5. Validation

We will know we made the right call if:

* < 0.1% of pay-link clicks fail with signature errors (i.e. tampering / corruption).
* < 1% of clicks hit an expired link (i.e. our default expiry isn't too short).
* No payment for an amount different from the invoice's actual amount.
* Quarterly key rotation runs without breaking active links (the kid mechanism works).
* Zero security incidents involving pay-link key exposure.

Revisit if:
* SMS shortlink usage is very high — we may want a shorter primary form.
* We see > 5% expired-link traffic — extend default expiry.
* Multi-tenant or multi-domain pay pages emerge as a need — JWT shape can extend, the design holds.

## 6. Notes

* The signing key lives in Secret Manager (`PROD_PAY_LINK_SIGNING_KEY_V<n>`). Rotation:
  1. Generate v(n+1), add to Secret Manager.
  2. Deploy with both v(n) and v(n+1) accepted; new links use v(n+1).
  3. Wait until max link lifetime (30d) passes.
  4. Remove v(n) from Secret Manager and deploy.
* The pay page (`pay.erp.zoho.kurd.iq`) is served by a minimal Cloud Run service with a separate domain to reduce cookie/CSRF surface from the main app.
* JWT library: `python-jose` on the backend; `jose` on the frontend (we don't actually sign on the frontend — only the pay page reads claims for display).

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: after first key rotation completes.*
