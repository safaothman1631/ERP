# Content Security Policy (CSP)

> **Spec ref:** requirements.md §7.4, design.md §5.1
> **Phase:** P6 (T-6.1)
> **Status:** Stage 1 — Report-Only (active). Stage 2 — Enforced (planned).

## 1. The policy

The final, enforced policy will be:

```
default-src 'self';
script-src 'self' 'nonce-{N}' https://www.googletagmanager.com https://apis.google.com;
style-src 'self' 'nonce-{N}';
img-src 'self' data: blob: https://*.gstatic.com https://*.googleusercontent.com https://firebasestorage.googleapis.com https://storage.googleapis.com;
font-src 'self' data:;
connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com wss://*;
worker-src 'self' blob:;
manifest-src 'self';
media-src 'self' blob:;
object-src 'none';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
report-uri /api/csp-report;
report-to csp-endpoint;
```

The policy is served from the Vercel edge (`vercel.json` → `headers`). Cloud Run does not need to re-emit CSP — the only HTML the user ever sees is shipped via Vercel.

## 2. Two-stage rollout

### Stage 1 — Report-Only (current)

```
Content-Security-Policy-Report-Only: <policy>
```

* The browser **does not block** anything; it merely sends a JSON report to `/api/csp-report` for every violation.
* Reports are stored in Redis (last 1000, TTL 7 days) and emitted as structured logs (`severity=WARNING, csp.violation`).
* Triage dashboard query (Cloud Logging):
  ```
  jsonPayload.message = "csp.violation"
  | stats count by jsonPayload.csp_directive, jsonPayload.blocked_uri
  ```

During Stage 1 we keep `'unsafe-inline'` in `script-src` / `style-src` so the existing site does not appear broken in user reports. **This is removed when we move to Stage 2.**

### Stage 2 — Enforced (planned)

Move to:

```
Content-Security-Policy: <policy>
```

**Gate to flip:** 14 days of zero unexpected violations after the last fix lands (a "clean week" plus a buffer). The cutover is a single PR that:

1. Removes the `Content-Security-Policy-Report-Only` header from `vercel.json`.
2. Adds `Content-Security-Policy` with the final policy (no `'unsafe-inline'`, no `'unsafe-eval'`).
3. Keeps `report-uri` so we keep observing residual violations.

### Stage 3 — Locked

After 7 more days of zero violations in enforce mode, we delete `'unsafe-inline'` fallback if present, drop wildcard hosts where possible, and pin specific Firebase project hostnames in `connect-src`.

## 3. How to verify

### Local (preview build)

```bash
# Vercel CLI emits the headers from vercel.json against the production build
npx vercel dev --listen 3000
curl -sI http://localhost:3000/ | grep -iE 'content-security|strict-transport|referrer|permissions-policy|x-content-type'
```

### Production

```bash
curl -sI https://erp.zoho.kurd.iq/ | grep -iE 'content-security|strict-transport|referrer|permissions-policy|x-content-type'
```

Expected headers (Stage 1):

```
content-security-policy-report-only: default-src 'self'; ...
strict-transport-security: max-age=31536000; includeSubDomains; preload
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
permissions-policy: geolocation=(), microphone=(), camera=(self), bluetooth=(self), ...
```

### Backend endpoint smoke test

```bash
curl -X POST \
  -H 'Content-Type: application/csp-report' \
  -d '{"csp-report":{"document-uri":"https://x.test/","violated-directive":"script-src","blocked-uri":"inline"}}' \
  https://api.erp.zoho.kurd.iq/api/csp-report -i
# Expect: HTTP/1.1 204 No Content
```

Then list recent reports (admin):

```bash
curl https://api.erp.zoho.kurd.iq/api/csp-report/_recent?limit=10
```

## 4. Known exceptions and rationale

| Allowance | Why it is allowed | Risk | Mitigation |
|---|---|---|---|
| `script-src https://www.googletagmanager.com` | Analytics + Tag Manager. | Third-party JS execution. | Pinned to GTM only; subresource integrity (SRI) on the script tag; reviewed quarterly. |
| `script-src https://apis.google.com` | Firebase Auth UI helpers. | Same. | Required by Firebase Auth; pinned to `apis.google.com` (no wildcard). |
| `img-src https://firebasestorage.googleapis.com https://storage.googleapis.com` | Customer-uploaded logos, attachments, receipts. | Hostile image. | Backend stores `Content-Type`, refuses unknown types; CSP `img-src` cannot exfiltrate. |
| `connect-src wss://*` | Firestore real-time + KDS WebSocket relay (R4.8). | Connection to arbitrary origin. | Tighten in Stage 3 once relay host is fixed (e.g. `wss://kds.zoho.kurd.iq`). |
| `connect-src https://*.googleapis.com` | Firestore REST fallback, Cloud Functions, GCS signed URLs. | Wildcard. | Required for Firebase JS SDK; cannot tighten without forking the SDK. |
| `font-src data:` | Inlined webfont fallbacks (Ant Design Icons). | Data-URI font. | Limited blast radius; no script execution from `font-src`. |
| `worker-src blob:` | Workbox SW + barcode worker (R4.9). | Worker can fetch. | SW is precached + integrity-checked by Workbox. |
| `'nonce-{N}'` in Stage 2 | Required for the few inline `<script>` tags that ship Ant Design theme variables. | Nonce reuse if leaked. | Nonce regenerated per response by the Vercel edge function; never logged. |

## 5. CSP nonce strategy (open question OQ-2)

We currently rely on `'unsafe-inline'` in Stage 1. Stage 2 must replace it with nonces. Two options:

* **Option A (preferred):** Vercel edge function rewrites the served HTML, injecting a fresh per-request nonce into every `<script>`/`<style>` tag and into the CSP header. Single source of truth.
* **Option B (fallback):** Build-time nonce hash list; CSP uses `'sha256-...'` instead of nonce. Simpler ops, less flexible.

Decision will be filed as `docs/adr/0004-csp-nonce-strategy.md` before Stage 2 cutover (target Sprint+4).

## 6. Reverting

If post-enforcement we see a wave of false positives (e.g. a third-party login flow we forgot about):

1. `git revert <enforce-PR>` — flips back to Report-Only within a Vercel deploy (~ 60 seconds).
2. File an incident note in `audit/incidents/` with the broken directive + offending origin.
3. Triage from the violation logs, ship a targeted fix, redo the 14-day soak.

## 7. Owners

* **Policy author:** Safa Othman
* **Operator (rotation triage):** DevOps on-call
* **Escalation:** Security lead → Tech lead → CEO
