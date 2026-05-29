# Firestore Security Rules — Line-by-Line Audit

**Scope:** `firestore.rules` (repo root) · **Audit task:** SF4 / T-SF.4.1
**Auditor:** Application-security review · **Date:** 2026-05-29
**Firebase project:** `zoho-83cda`
**Companion tests:** `firestore-rules-tests/` (emulator), `backend/tests/test_tenant_isolation.py` (app layer)

> This document walks the rules file region-by-region, states the security
> intent, confirms whether the intent is met, and records findings with a
> severity. Findings are tracked at the bottom. **No rule changes are made by
> this audit** — `firestore.rules` is a shared file; fixes are proposed as
> patch instructions for the orchestrator (see "Recommended changes").

---

## 1. Architecture & threat model

The database serves a multi-tenant ERP. The tenant boundary is `org_id`. Two
document shapes coexist:

1. **Nested** — `organizations/{orgId}/<collection>/{docId}`. Used by the
   client realtime SDK and legacy sub-collections. Isolation is by **path**:
   the `{orgId}` segment must equal the caller's `org_id` claim.
2. **Root/flat** — `<collection>/{docId}` with an `org_id` *field* on the
   document. This is what the Python `BaseRepository` (Admin SDK) writes in
   production. Isolation is by **field**: `resource.data.org_id` must equal the
   caller's claim.

The Admin SDK (backend) **bypasses rules entirely** — these rules exist to
constrain the *client* SDK (the React app's realtime listeners and any direct
writes). The backend enforces the same boundary independently in
`BaseRepository` (see the app-layer test).

Primary threats considered: cross-tenant read/write (IDOR), privilege
escalation via role claim, audit-log tampering, and global-collection abuse.

---

## 2. Helper functions (lines 26–84)

```
isAuthenticated()        L26  request.auth != null && request.auth.uid != null
belongsToOrg(orgId)      L31  isAuthenticated() && request.auth.token.org_id == orgId
userRole()               L37  request.auth.token.get('role', 'viewer')
hasRole(roles)           L42  isAuthenticated() && userRole() in roles
isAdmin(orgId)           L47  belongsToOrg && role in [admin, super_admin]
isManagerOrAbove(orgId)  L52  + manager
isAccountantOrAbove      L57  + accountant
isHROrAbove(orgId)       L63  + hr
hasCorrectOrgId(orgId)   L69  request.resource.data.org_id == orgId
onlyUpdatingOwnProfile() L74  diff().affectedKeys().hasOnly([...])
isNotDeleted()           L81  !('deleted_at' in resource.data) || == null
```

**Assessment — strong.** Key observations:

- ✅ `belongsToOrg` keys off `request.auth.token.org_id`, the **custom claim**
  set by the backend on login. A client cannot forge a custom claim — only the
  Admin SDK can mint it — so this is the correct anchor for tenant isolation.
- ✅ `userRole()` defaults to the least-privileged `viewer` when the claim is
  absent (fail-safe default). `hasRole` re-checks `isAuthenticated()`.
- ✅ The role ladder is *inclusive* (each tier lists every higher role
  explicitly), which avoids the classic "manager can't do what accountant can"
  inversion bug.
- ✅ `hasCorrectOrgId` is applied on **create** everywhere (see §3), preventing
  a client from creating a nested doc whose body claims a *different* org than
  its path — important because some code reads `org_id` from the body.
- ⚠️ **F-1 (informational):** `onlyUpdatingOwnProfile()` (L74) allows a user to
  patch `preferences` freely. If `preferences` is ever used to store anything
  authorization-relevant (feature entitlements, role hints), this becomes a
  privilege-escalation vector. Today it is cosmetic; flag for review if that
  changes.
- ⚠️ **F-2 (informational):** `isNotDeleted()` (L81) is **defined but never
  referenced** in the file. Dead helper — harmless, but indicates an intended
  soft-delete read guard was never wired. Confirm whether reads of
  soft-deleted docs should be hidden at the rules layer (today they are
  visible to any same-org user).

---

## 3. Nested organization tree (lines 90–701)

`match /organizations/{orgId}` with `read: belongsToOrg(orgId)` and
`update: isAdmin(orgId)`; `create: isAuthenticated()` (registration);
`delete: false`.

**Assessment — strong with one note.**

- ✅ Every sub-collection gates **read** on `belongsToOrg(orgId)`, so the
  `{orgId}` path segment must match the caller's claim. Cross-tenant read is
  structurally impossible here.
- ✅ Every **create** pairs `belongsToOrg(orgId)` with `hasCorrectOrgId(orgId)`,
  blocking org-id spoofing in the body.
- ✅ **Tiered writes are correct:**
  - Sales/purchasing/inventory docs: create/update by any org member, **delete
    by manager-or-above** (L115, L142, …).
  - Accounting (`journal_entries`, `accounts`, `taxes`, `fiscal_years`,
    `bank_*`): create/update by **accountant-or-above**, delete by **admin**
    (L267–347).
  - HR/payroll (`hr_employees`, `hr_contracts`, `payroll_runs`, …): read+write
    require **HR-or-above** (L394–465). Payslips/attendance/time-off add a
    self-service carve-out: an employee can read **their own** record via
    `resource.data.employee_user_id == request.auth.uid` (L409, L417, L447,
    L461). This is a correct, tightly-scoped exception.
  - `subscriptions`, `settings`, `numbering_sequences`, `email_templates`,
    `automation_rules`: **admin-only** writes (L569–616).
- ✅ **Immutable/append-only collections:**
  - `audit_logs` (L687): `read: isAdmin`, `create/update/delete: false`. Client
    can never write audit logs — only the backend audit middleware (Admin SDK)
    does. **Correct.**
  - `chatter` (L660): `update: false` (messages immutable).
  - `job_runs` (L676): `create/update: false` (backend-only).
- ✅ **org `delete: false`** (L94) — orgs are never deleted via client.
- ✅ **Catch-all inside the org** (L698): `match /{document=**} { allow read,
  write: if false; }`. Any sub-collection not explicitly listed is denied. This
  is the single most important defensive line in the nested tree — a new
  feature that forgets to add a rule **fails closed**, not open.

**Findings in this region:**

- ⚠️ **F-3 (low):** `hr_attendance` / `hr_time_off` **create** is allowed for
  any org member (`belongsToOrg(orgId) && hasCorrectOrgId`, L411/L419). A user
  could create an attendance/time-off row attributed to **another** employee's
  `employee_user_id` because create does not assert
  `request.resource.data.employee_user_id == request.auth.uid`. Impact is
  limited (same-org, HR can correct, and the backend is the normal writer), but
  the self-service create path should bind the subject to the caller. Proposed
  fix below.
- ⚠️ **F-4 (informational):** Several `match .../lines/{lineId} { allow read,
  write: if belongsToOrg(orgId); }` blocks (e.g. invoice lines, L144) grant
  **write** to any org member regardless of the parent document's stricter
  delete/role gate. Since the parent header already restricts who can mutate
  the document and lines carry no independent authorization, this is acceptable,
  but note that line writes are *not* role-gated the way the header is.

---

## 4. Global collections (lines 708–711)

```
match /currencies/{currencyId} {
  allow read:  if isAuthenticated();
  allow create, update, delete: if false;   // backend seed only
}
```

**Assessment — correct.** `currencies` is reference data shared by all tenants;
world-readable to authenticated users, never client-writable. No `org_id`
needed because it is genuinely global. ✅

---

## 5. Root flat collections (lines 718–824)

Helper set:

```
tenantOrgId()      L718  request.auth.token.org_id
tenantDocRead()    L722  isAuthenticated() && resource.data.org_id == tenantOrgId()
tenantDocCreate()  L726  isAuthenticated() && request.resource.data.org_id == tenantOrgId()
tenantDocUpdate()  L730  resource.data.org_id == tenantOrgId() && request.resource.data.org_id == tenantOrgId()
tenantDocDelete()  L736  isAuthenticated() && resource.data.org_id == tenantOrgId()
```

Applied to `invoices`, `bills`, `payments_received`, `payments_made`, `items`,
`stock_movements`, `bank_accounts`, `bank_transactions`, `contacts`,
`pos_orders`, `audit_logs`, `org_counters`, `reconcile_runs`.

**Assessment — strong.** This is the production-critical shape (matches
`BaseRepository`). Key observations:

- ✅ **Read** requires `resource.data.org_id == tenantOrgId()` — a foreign doc
  is denied. **No cross-tenant read.**
- ✅ **Create** requires the *incoming* `org_id` to equal the caller's claim —
  cannot plant a doc into another tenant.
- ✅ **Update** checks `org_id` on **both** the stored doc *and* the incoming
  doc (L730–734). This is the subtle, correct part: it blocks **tenant
  re-homing** — a user cannot take their own doc and flip its `org_id` to
  another tenant, and cannot edit a foreign doc (the stored-side check fails
  first). 👍
- ✅ Role overlays preserved on the flat shape: `bank_*` create/update needs
  accountant-or-above + admin delete (L782–794); `payments_*` update needs
  accountant-or-above (L757/L764); destructive deletes need manager-or-above
  (L744 etc.).
- ✅ **`stock_movements`** (L775) is append-only client-side: `update: false`,
  `delete: false`.
- ✅ **Root `audit_logs`** (L810): read requires own-org **and** admin;
  `create/update/delete: false`. Consistent with the nested audit rule.
- ✅ **`reconcile_runs`** (L821) and **`org_counters`** (L815): backend-managed;
  counters are accountant-gated and never deletable, reconcile runs are
  read-only to org admins.

**Findings in this region:**

- 🟠 **F-5 (medium, defense-in-depth):** The root collections that mirror the
  nested ones do **not** re-apply the role ladder uniformly. For example, root
  `items` allows `create: tenantDocCreate()` (any authenticated org member),
  which matches the nested rule — fine. But there is **no rules-level
  enforcement that a given collection is only ever accessed in *one* of the two
  shapes.** A tenant that writes `invoices` via the flat shape and *also* has
  legacy nested `organizations/{orgId}/invoices` docs is governed by two
  independent rule blocks. This is not a cross-tenant hole (both blocks enforce
  `org_id`), but it is a **consistency hazard**: a future weakening of one shape
  would not be caught by tests that only exercise the other. The companion test
  suite deliberately exercises **both** shapes to mitigate this.
- ⚠️ **F-6 (low):** `tenantOrgId()` returns `request.auth.token.org_id` with no
  null-guard. If a token genuinely lacks the claim, `tenantDocRead()` compares
  `resource.data.org_id == null`, which is `false` for any real doc → safe
  (denied). Confirmed fail-safe, but the backend should never mint a token
  without `org_id` (it does not — `get_current_user` 401s on a missing
  `org_id`, see `app/services/auth.py`).

---

## 6. Final default-deny (lines 829–831)

```
match /{document=**} { allow read, write: if false; }
```

**Assessment — correct and essential.** Any root path not explicitly matched
above is denied. Combined with the in-org catch-all (§3), the rules are
**deny-by-default at both levels**. ✅

---

## 7. `aud` / `iss` / token-shape note (cross-reference)

These rules trust `request.auth.token.org_id` and `request.auth.token.role`.
Firebase validates the token signature, issuer, and audience for its **own**
ID tokens automatically before exposing `request.auth`. However, the *backend
API* uses a separate HS256 application JWT (see `app/services/auth.py`) that
does **not** set `aud`/`iss` claims (single-audience, single-issuer
deployment). That is acceptable today but should be revisited if the platform
ever issues tokens for multiple audiences. Asserted at the algorithm/claim-
pinning level in `backend/tests/test_jwt_verification.py` (rejects `alg:none`,
wrong-key, and RS256-downgrade forgeries).

---

## 8. Findings summary

| # | Severity | Area | Finding | Status |
|---|----------|------|---------|--------|
| F-1 | Info | Helpers | `onlyUpdatingOwnProfile` permits free `preferences` edits — watch if it becomes authz-relevant | Open (watch) |
| F-2 | Info | Helpers | `isNotDeleted()` defined but never used (dead helper) | Open (cleanup) |
| F-3 | Low | HR self-service | `hr_attendance`/`hr_time_off` **create** doesn't bind `employee_user_id` to the caller | Recommend fix |
| F-4 | Info | Sub-collections | `lines` sub-collections grant write to any org member (not role-gated) | Accepted |
| F-5 | Medium | Dual shapes | Same collection governed by two rule blocks (nested + flat); consistency hazard, not a hole | Mitigated by tests |
| F-6 | Low | Root helpers | `tenantOrgId()` lacks an explicit null-guard (verified fail-safe) | Accepted |

**No critical or high findings.** Cross-tenant isolation is enforced
**correctly and redundantly** (path + field, plus a deny-by-default catch-all
at each level). The audit-log append-only and HR/payroll role guards are sound.

---

## 9. Recommended changes (for the orchestrator — `firestore.rules` is shared)

These are **proposals**, not applied edits.

1. **F-3 — bind self-service create to the caller.** For `hr_attendance` and
   `hr_time_off`, change the create rule from:

   ```
   allow create: if belongsToOrg(orgId) && hasCorrectOrgId(orgId);
   ```

   to:

   ```
   allow create: if belongsToOrg(orgId) && hasCorrectOrgId(orgId)
     && (isHROrAbove(orgId)
         || request.resource.data.employee_user_id == request.auth.uid);
   ```

2. **F-2 — remove the dead `isNotDeleted()` helper**, or wire it into reads
   that should hide soft-deleted documents (decide product intent first).

3. **F-5 — pick one canonical shape per collection** long-term. Until then,
   keep the dual-shape rules tests (`firestore-rules-tests/`) green so a
   weakening of either block is caught.

## 10. How to re-run this audit's tests

```bash
cd firestore-rules-tests
npm install
npm test        # boots the Firestore emulator, runs the rules specs
```

The emulator is **required** (`@firebase/rules-unit-testing` has no mock mode).
See `firestore-rules-tests/README.md`.
