# ADR 0018 — CSRF double-submit + SameSite=Strict, with a Bearer-auth exemption

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Security review, Backend lead |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | `.kiro/specs/scale-foundation` §SF4 (T-SF.4.6); `backend/app/middleware/csrf.py`; `backend/app/main.py` (middleware order); `backend/app/services/auth.py`; ADR-0019 (WIF); OWASP Top-10 A01/A05 |

## 1. Context

The platform's primary authentication scheme is a **stateless Bearer JWT** in
the `Authorization` header (`backend/app/services/auth.py`, HS256). Browsers do
**not** automatically attach an `Authorization` header to cross-site requests,
so a pure Bearer client is inherently immune to classic Cross-Site Request
Forgery (CSRF). If that were the whole story, we'd need no CSRF control at all.

It isn't the whole story:

* Some flows issue a **refresh-token cookie**.
* The first-party web app may, now or later, fall back to a cookie/session for
  convenience or for endpoints hit by plain HTML `<form>` posts.

Any cookie that the browser attaches automatically to a state-changing request
is a CSRF vector. We want defence-in-depth so a *future* cookie-bearing flow
can't quietly reintroduce CSRF — without breaking the many non-browser clients
(mobile, integrations, server-to-server) that legitimately use Bearer auth and
should never be forced to carry a CSRF token.

The SF4 hardening pass (the same wave that added the OTel enrichment middleware,
ADR-relevant note below) is where we settle this.

## 2. Decision

**We add a CSRF middleware (`backend/app/middleware/csrf.py`) that combines two
controls, and we exempt Bearer-authenticated requests from the token check.**

1. **SameSite=Strict cookie hardening (always on).**
   `harden_set_cookie_headers` rewrites every `Set-Cookie` the app emits to add
   `SameSite=Strict`, `Secure` (in production), and `HttpOnly` (when not already
   present). A `Strict` cookie is never sent on a cross-site navigation, which
   neutralises cookie-replay for the vast majority of CSRF attacks. This runs
   even when enforcement is disabled — it's cheap and has no downside.

2. **Double-submit token check (for cookie-authenticated mutations only).**
   For state-changing methods (`POST/PUT/PATCH/DELETE`) on a request that is
   **cookie-authenticated and not Bearer-authenticated**, the caller must echo
   the value of the `csrf_token` cookie in the `X-CSRF-Token` header. A
   cross-site attacker can neither read the victim's cookie (same-origin
   policy) nor set a custom header on a simple form post, so a matching header
   proves first-party origin. Tokens are 32 bytes of `secrets`-grade entropy;
   comparison is constant-time (`hmac.compare_digest`).

3. **Bearer exemption.** A request carrying a valid `Authorization: Bearer`
   credential skips rule (2). It already presents an unguessable, non-cookie
   credential the browser won't auto-attach cross-site; forcing a CSRF header on
   every API client would break them for **zero** security gain.

Configuration: `settings.CSRF_PROTECTION_ENABLED` (default `True`) toggles the
double-submit enforcement; cookie hardening always applies. Safe methods
(`GET/HEAD/OPTIONS/TRACE`) and a small exempt-prefix list (login/refresh before
a session exists, provider-signed public webhooks, liveness probes) are never
checked.

**Wiring** (`main.py`): `app.middleware("http")(csrf_middleware)` is added in
the SF4/SF5 hardening block, after `org_context_middleware` so request state is
available.

## 3. Consequences

### Positive

* A future cookie/session flow is CSRF-safe **by construction** — the control is
  already in place; it starts enforcing the moment a cookie-authed mutation
  appears.
* Bearer clients (mobile, integrations, server-to-server) are untouched — no
  CSRF header to manage, no breakage.
* `SameSite=Strict` + `Secure` + `HttpOnly` hardening applies to *every* cookie
  the app sets, independently of the token check, raising the floor for free.
* Two independent layers (SameSite *and* double-submit) — either alone defeats
  the common attack; together they defeat the edge cases.

### Negative

* First-party JS that ever relies on cookie auth must read `csrf_token` and send
  `X-CSRF-Token` on mutations. Today the SPA uses Bearer, so this is latent
  cost, not current cost.
* The exemption logic ("cookie-authed and not Bearer-authed") is a subtle
  predicate; misjudging it could either over-enforce (break Bearer clients) or
  under-enforce (miss a cookie path). Covered by tests and this ADR.

### Neutral / known unknowns

* If we adopt a full cookie-session model later, we may add a per-session token
  rotation policy on top; the double-submit primitive already supports it.

## 4. Alternatives considered

### Alternative A — No CSRF control (rely on "we're Bearer-only")

* **Pros:** nothing to build.
* **Cons:** the refresh-token cookie already exists, and any future cookie flow
  silently reintroduces CSRF with no guard. "We're Bearer-only" is a property
  that erodes the first time someone adds a session.
* **Why rejected:** defence-in-depth; the cost of the control is low and the
  failure mode of not having it is account-level.

### Alternative B — SameSite=Strict cookies only (no token)

* **Pros:** simple; kills most CSRF.
* **Cons:** `SameSite` enforcement varies across legacy browsers and some
  cross-subdomain navigations; relying on a single browser-side control is
  thin for state-changing requests.
* **Why rejected:** we want a second, server-verified layer for mutations.

### Alternative C — Synchroniser-token pattern (server-side session token store)

* **Pros:** classic, well-understood; per-session server-held token.
* **Cons:** requires server-side session state for the token — exactly what a
  stateless-JWT design avoids; adds a store and lifecycle to manage.
* **Why rejected:** double-submit gets equivalent protection without
  server-side session state.

### Alternative D — Custom-header-only requirement (no token value check)

* **Pros:** simplest "prove it's XHR" check.
* **Cons:** a bare header-presence check is weaker than verifying a value bound
  to a cookie the attacker can't read.
* **Why rejected:** double-submit binds the proof to an unreadable cookie value,
  which is strictly stronger.

## 5. Validation

We will know we made the right call if:

* `backend/tests/` cover: a cookie-authed mutation without `X-CSRF-Token` is
  rejected; the same request *with* a matching token passes; a Bearer-authed
  mutation passes with no CSRF header; safe methods and exempt prefixes are
  never blocked.
* Every `Set-Cookie` in a production response carries `SameSite=Strict; Secure;
  HttpOnly` (verifiable with a quick `curl -I` on a cookie-setting endpoint).
* Toggling `CSRF_PROTECTION_ENABLED=false` disables the token check but still
  hardens cookies.
* No mobile/integration client breaks (they never send a CSRF header and are
  Bearer-exempt).

Revisit if: we adopt a cookie-session auth model broadly (tighten to per-session
rotation), or browser `SameSite` semantics change materially.

## 6. Notes

* **Companion SF4/SF5 middleware.** The same hardening wave added the OTel
  **span-enrichment** middleware (`backend/app/observability/otel_middleware.py`),
  wired immediately after CSRF in `main.py`. It stamps `enduser.org_id` /
  `tenant.id` / `request.id` onto the active server span and copies the active
  `trace_id` onto the `X-Trace-Id` response header so the frontend RUM client can
  attach it to the web-vitals beacon — closing the loop between a slow trace and
  a poor LCP sample. It degrades to a no-op when OpenTelemetry isn't installed
  (dev) and never blocks a request. It is *not* a security control, but it lives
  in the same pipeline block and shares the "thin middleware, fail-open" design
  ethos, so it's recorded here alongside the CSRF decision.
* The CSRF middleware never logs token values. The request-id stamped by
  `RequestIDMiddleware` (added earliest in the stack) is the correlation handle
  used in logs.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: when a cookie-session auth model is adopted, or on a browser SameSite behaviour change.*
