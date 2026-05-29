# Firestore Security-Rules Tests

Automated tests for `firestore.rules` (repo root), proving the platform's
per-tenant isolation and role-based guards hold at the **database** layer —
independent of any backend code. Part of **SF4 / T-SF.4.1** (pre-test
hardening).

These complement the application-layer isolation tests in
`backend/tests/test_tenant_isolation.py`: the backend tests prove the FastAPI +
`BaseRepository` layer scopes every query by `org_id`, while these prove that
*even a client talking directly to Firestore* (e.g. the realtime SDK in the
React app) cannot cross the tenant boundary.

## What is covered

| Spec file | Coverage |
|---|---|
| `tests/tenant-isolation.test.js` | Org B cannot read/write/create/update Org A documents — across nested `organizations/{orgId}/<collection>` paths **and** flat root collections (`org_id` on the doc, the shape the Python `BaseRepository` writes). Anonymous access denied. Catch-all default-deny verified. |
| `tests/role-gating.test.js` | HR/payroll require an HR-or-above role even for same-org users; audit logs are append-only (no client create/update/delete, admin read only); global `currencies` are world-readable but never writable; accounting create requires accountant-or-above; destructive deletes require manager-or-above. |

The authenticated test contexts mint JWT custom claims (`org_id`, `role`) that
mirror exactly what the backend sets on login (see
`backend/app/services/auth.py` and the `belongsToOrg` / `userRole` helpers in
`firestore.rules`).

## ⚠️ The Firebase emulator is required

`@firebase/rules-unit-testing` exercises the **real** rules against a local
Firestore emulator — there is no offline/mock mode. You must have the Firebase
CLI and a JVM available.

### Prerequisites

- Node.js >= 18
- Java JDK >= 11 (the Firestore emulator is a Java process)
- Firebase CLI (installed transitively via the `firebase-tools` devDependency,
  or globally with `npm i -g firebase-tools`)

### Install

```bash
cd firestore-rules-tests
npm install
```

### Run

The default `test` script starts the emulator, runs the specs, then tears the
emulator down — no manual setup:

```bash
npm test
```

This runs:

```
firebase emulators:exec --only firestore --project zoho-83cda "vitest run"
```

`firebase.json` here points the emulator at `../firestore.rules` and
`../firestore.indexes.json`, so the tests always run against the live rules
file — they will fail if a future edit weakens tenant isolation.

### Run against an already-running emulator

```bash
# terminal 1
npm run emulator           # firebase emulators:start --only firestore

# terminal 2
npm run test:nostart       # vitest run (expects emulator on 127.0.0.1:8080)
```

## CI note

These tests are **not** wired into the default backend CI job because they need
a JVM + emulator. To enable in CI, add a step that installs `firebase-tools`
and runs `npm test` inside this directory on a runner with Java available
(`actions/setup-java`). Tracked as a follow-up — see
`docs/security/firestore-rules-audit.md`.

## Interpreting failures

- `assertFails(...)` rejects if the operation **succeeds** — a failure here
  means the rules let something through that should have been denied (a real
  isolation regression).
- `assertSucceeds(...)` rejects if the operation is **denied** — a failure here
  usually means the rules became *too* strict and would break a legitimate
  same-org flow.
