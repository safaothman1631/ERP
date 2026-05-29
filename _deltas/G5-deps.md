# G5 Mobile Distribution — Deps

> Spec ref: growth-to-100 § R5, design.md § 5, tasks.md Phase G5.

## Backend (Python — `backend/requirements.txt`)

The mobile push dispatcher uses the official `firebase-admin` SDK's
Messaging API. The repo already has `firebase-admin` pinned for Firestore;
G5 needs at least 6.5.0 for the multicast + topic management APIs.

> ⚠️ **DO NOT EDIT** `backend/requirements.txt` per the agent constraint.
> Hand off the bump below to the integration agent.

Required addition / bump:
```
firebase-admin>=6.5.0,<8.0
```

If the existing pin is already ≥ 6.5.0, no change is needed. Verify with:
```
grep firebase-admin backend/requirements.txt
```

## Frontend (TS — `frontend/package.json`)

No frontend dependency additions. The new hook `useMobileVersionGate.ts`
uses only React standard library + `fetch`. The hook is intentionally
plain so it ships without a Capacitor import (web builds use the
same hook with a no-op gate).

## Mobile (TS — `mobile/package.json`) — UPDATED

Added in this phase (already wired into the workspace's package.json):

| Plugin | Version | Purpose |
|---|---|---|
| `@capacitor/app` | ^6.0.2 | App lifecycle events for version-check on resume |
| `@capacitor/app-update` | ^1.0.0 | Android Play in-app update flow |
| `@capacitor/push-notifications` | ^6.0.2 | iOS APNs + Android FCM permission flow |
| `@capacitor-firebase/messaging` | ^6.1.0 | FCM token + topic management |
| `@capacitor-firebase/crashlytics` | ^6.1.0 | Crash reporting |
| `@capacitor-firebase/analytics` | ^6.1.0 | Funnel telemetry |

After `npm install --legacy-peer-deps` (Windows host), the user MUST run:
```
cd mobile
npx cap sync android   # if android/ exists
npx cap sync ios       # if ios/ exists
```

## CI runners

The new workflows require:
- `ubuntu-latest` for Android (works with existing GitHub Actions free tier)
- `macos-14` for iOS (paid tier — ~10x cost; budget accordingly)

## Firebase / Google secrets (CI)

The user must add the following GitHub Actions secrets before the
release workflows succeed. None of these are committed:

### Android signing + Play upload
- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`
- `PLAY_JSON_KEY_BASE64`

### iOS signing + TestFlight upload
- `MATCH_PASSWORD`
- `MATCH_GIT_URL`
- `MATCH_GIT_BASIC_AUTH_BASE64`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER`
- `APP_STORE_CONNECT_API_KEY_B64`

### Firebase Test Lab (pre-launch report)
- `GCP_WIF_PROVIDER` (workload identity federation provider)
- `GCP_TESTLAB_SA` (service account with Test Lab + Storage permissions)
- `TESTLAB_RESULTS_BUCKET` (GCS bucket for results)

### GitHub Actions environments
- Create a `mobile-production` environment with manual approval
  required for jobs that touch Play Store / App Store.

## Firestore indexes

The mobile_devices collection benefits from a composite index for the
`find_by_token` query:

```json
{
  "collectionGroup": "mobile_devices",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "fcm_token", "order": "ASCENDING" }
  ]
}
```

> The user should add this to `firestore.indexes.json` and `firebase deploy --only firestore:indexes`.

## Permissions (RBAC)

No new RBAC permission codes are required for G5. The super-admin
endpoints (`/api/admin/mobile/version-config`) use the same
`_require_super_admin` pattern as existing admin endpoints.

Device registration (`/api/devices/register`) is authenticated but
unscoped — every logged-in user can register their own device.
