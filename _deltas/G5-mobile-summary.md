# G5 — Mobile Distribution Apparatus — Summary

> Spec: `.kiro/specs/growth-to-100` Section R5 (requirements), §5 (design),
> Phase G5 (tasks). Owner: Mobile Distribution Specialist.

## Scope delivered

Built end-to-end mobile distribution apparatus: Capacitor plugin config,
Android Fastlane + signing, iOS Fastlane Match, FCM+APNs dispatch,
in-app force-update gate, Firebase Test Lab matrix, store-listing copy,
ASO research, and partner-entity fallback documentation.

## Files created / modified

### Capacitor configuration

| File | Change |
|------|--------|
| `mobile/package.json` | Added `@capacitor/{app,app-update,push-notifications}`, `@capacitor-firebase/{messaging,crashlytics,analytics}` |
| `mobile/capacitor.config.ts` | Added plugin config for SplashScreen logo, PushNotifications, FirebaseMessaging, AppUpdate, App, Network, Filesystem |

### Mobile bridges (TS)

- `mobile/src/bridge/push.ts` — FCM/APNs registration, topic subscription, foreground listener, token refresh, `subscribeStandardTopics()` helper
- `mobile/src/bridge/app-update.ts` — `evaluateVersion()`, `tryNativeInAppUpdate()`, semver comparator
- `mobile/src/lib/crashlytics.ts` — `setUserId/setCustomKey/log/recordError`
- `mobile/src/lib/analytics.ts` — `setConsent/logEvent/setUserId/setCurrentScreen`

### Android pipeline

- `mobile/android/fastlane/Fastfile` — lanes: `debug`, `release`, `internal`, `beta`, `production` (10% rollout)
- `mobile/android/fastlane/Appfile` — `package_name("com.zoho.kurdishierp")`
- `mobile/android/fastlane/Pluginfile` — `fastlane-plugin-firebase_app_distribution`
- `mobile/android/fastlane/README.md` — lane reference + local + CI usage
- `mobile/android/app/build.gradle.signing.snippet` — signingConfigs block to merge after `cap add android`
- `docs/mobile/android-signing.md` — full runbook: generate keystore, store, retrieve in CI, loss recovery, annual rotation

### iOS pipeline

- `mobile/ios/fastlane/Fastfile` — lanes: `setup_match`, `debug`, `testflight`, `appstore` (manual submit)
- `mobile/ios/fastlane/Appfile`
- `mobile/ios/fastlane/Matchfile` — points at private `ios-match-certs` repo
- `docs/mobile/ios-fastlane-match.md` — full runbook including 30-min onboarding flow

### CI workflows

- `.github/workflows/mobile-android-debug.yml` — PR debug APK
- `.github/workflows/mobile-android-beta.yml` — `mobile-v*` tag → Play Internal (or beta/production via workflow_dispatch)
- `.github/workflows/mobile-ios-debug.yml` — PR debug on macOS-14
- `.github/workflows/mobile-ios-testflight.yml` — `mobile-v*` tag → TestFlight
- `.github/workflows/mobile-pre-launch-report.yml` — Firebase Test Lab robo crawl on Iraqi top-12

### Backend

- `backend/app/schemas/mobile_devices.py` — Pydantic models (DeviceRegisterRequest, VersionCheckRequest/Response, VersionConfigUpdate/Response)
- `backend/app/firestore/mobile_devices.py` — `MobileDeviceRepository` (per-tenant, `find_by_token`, `list_for_user`, `list_for_tenant`); `MobileVersionConfigRepository` (global, `_global` org_id)
- `backend/app/api/devices.py` — `POST /api/devices/register` (idempotent on fcm_token), `GET /api/devices`, `DELETE /api/devices/{id}`
- `backend/app/api/mobile_version.py` — public `POST /api/mobile/version-check`
- `backend/app/api/admin/mobile_version_admin.py` — super-admin `GET/PUT /api/admin/mobile/version-config` with audit log
- `backend/app/services/push_notifications.py` — FCM dispatch (`send_to_user/tenant/topic/tokens`), `PushPayload` with `title_i18n/body_i18n`, dead-token pruning
- `backend/app/middleware/min_app_version.py` — `MinAppVersionMiddleware` returning 426 Upgrade Required; cache TTL 60s; exempt list
- `backend/app/main.py` — wired devices/mobile_version/mobile_version_admin routers; registered MinAppVersionMiddleware

### Frontend

- `frontend/src/hooks/useMobileVersionGate.ts` — cold-start version-check + runtime 426 listener via `zoho:api:upgrade-required` event

### Store + ASO assets

- `mobile/store-assets/icons/README.md` — required sizes (Android mipmaps, iOS Contents.json), generation script
- `mobile/store-assets/screenshots/templates/README.md` — Play + App Store resolution matrix + Fastlane capture script
- `mobile/store-assets/listings/play-store.md` — tri-lingual title/short/full description
- `mobile/store-assets/listings/app-store.md` — tri-lingual title/subtitle/keywords/promo/description + privacy nutrition labels
- `mobile/store-assets/marketing-copy.md` — hero taglines, push notification i18n library, ASO keyword brackets
- `mobile/aso-keywords.md` — volume × competition matrix, long-tail, refresh schedule, competitor baseline

### Firebase Test Lab

- `mobile/firebase-test-lab/devices.json` — Iraqi top-12 device matrix (Samsung A03/A04/A14/A24/A52/A54, Xiaomi Redmi 9A/10/12, Honor X6/X7) + iPhone 11/13 reference + acceptance thresholds

### Risk / fallback docs

- `docs/mobile/partner-entity-fallback.md` — why Apple may reject Iraqi entity, Turkey LLC (~$1.5k, ~3 weeks) vs Jordan LLC (~$2k, ~6 weeks), reseller agreement template, push fallback note

### Deltas

- `_deltas/G5-deps.md` — required dep additions (firebase-admin ≥ 6.5.0), Mobile plugin additions, CI secrets, Firestore index
- `_deltas/G5-mobile-summary.md` — this file

## Lanes per platform

### Android (Fastlane)
- `debug` — local dev / PR CI
- `release` — signed AAB build
- `internal` — Play Internal Testing
- `beta` — Play Closed Beta
- `production` — Play Production at 10% rollout

### iOS (Fastlane)
- `setup_match` — fetch/refresh signing material
- `debug` — development cert build
- `testflight` — Release IPA → TestFlight via App Store Connect API
- `appstore` — Release IPA → App Store Connect (manual submit-for-review)

## Deps to add (handoff — agent constraint forbids editing these)

| File | Add |
|------|-----|
| `backend/requirements.txt` | `firebase-admin>=6.5.0,<8.0` |
| `frontend/package.json` | (none — hook is pure React) |
| `mobile/package.json` | **done in this phase** (already edited) |

## Manual ops the founder / Eng B must complete

1. **Google Play Console enrollment** ($25 one-time, founder identity verification).
2. **Apple Developer Program enrollment** ($99/yr; Iraqi LLC first; if blocked → Turkey LLC per `docs/mobile/partner-entity-fallback.md`).
3. **Generate Android upload keystore** per `docs/mobile/android-signing.md` §2.
4. **Store keystore + Play JSON key in GitHub Actions Secrets** as listed in `_deltas/G5-deps.md`.
5. **Create the `ios-match-certs` private GitHub repo** and run `fastlane match appstore --force` once.
6. **Apple Push Notification Service (APNs) auth key** — create in Apple Developer portal, upload to Firebase Console (Project Settings → Cloud Messaging → Apple app configuration).
7. **Configure FCM service account credentials** for `firebase-admin` runtime (Cloud Run service account already has Firestore access; needs `cloudmessaging.messages.create` and `firebasecloudmessaging.messages.create` IAM perms).
8. **Create Firestore index** for `mobile_devices.fcm_token` ASC.
9. **Deploy `firestore.indexes.json`** after merging the index.
10. **Create the `mobile-production` GitHub Environment** with required reviewers (founder + Eng B) for `mobile-android-beta.yml` and `mobile-ios-testflight.yml`.
11. **Seed `mobile_versions/{ios,android}` Firestore docs** via the admin endpoint before first prod release so version-check returns meaningful values.
12. **Generate brand icons + splash assets** (designer contract per T-G.5.7) and drop into `mobile/android/app/src/main/res/` + `mobile/ios/App/App/Assets.xcassets/`.
13. **Capture real-device screenshots** via Fastlane Snapshot/Screengrab.
14. **Submit Play Store + App Store listings** for review.
15. **Configure Workload Identity Federation** for `mobile-pre-launch-report.yml` (`GCP_WIF_PROVIDER`, `GCP_TESTLAB_SA`).

## Open questions

1. **App Store IAP** — `app-store.md` documents the bypass (open billing in
   in-app browser per Guideline 3.1.3(b)). If Apple rejects, we need to
   implement native StoreKit IAP + Apple's 30% commission. Decision deferred
   until first Apple review.
2. **APNs auth-key location** — should it live in 1Password + Google Secret
   Manager OR only in Firebase Console? Recommendation: both, treat as
   Tier-1 secret (rotation requires re-uploading to Firebase + revoking the
   old key in Apple Developer portal).
3. **Push WebSocket fallback** — design.md §5.10 references "Capacitor +
   WebSocket long-poll" for tenants with FCM delivery < 80%. The
   `backend/app/api/ws_push.py` is NOT scoped to G5; flagged as
   post-G5 follow-up.
4. **Mobile in-app update version cadence** — recommendation: bump
   `min_version` quarterly (90-day cadence) so users don't get gate-locked
   by accident. Document in ops runbook.
5. **Crashlytics dSYM upload (iOS)** — current Fastfile uses default
   workflow. For optimal stack-trace symbolication add an
   `upload_symbols_to_crashlytics` step in the `testflight` lane.
   Flagged for next iteration.
6. **Turkey LLC formation** — should the founder initiate Turkey LLC
   formation **before** waiting for Iraqi-LLC Apple verdict (saves 3 weeks
   if rejected) or **after** (saves $1.5k if accepted)? Recommend
   pre-emptive formation since the LLC has tax-residency value beyond Apple.
7. **Sanctions monitoring** — no automated check for sanctions-list
   changes that could affect Apple/Google distribution to Iraq. Manual
   quarterly review by founder recommended.

## Confidence

**High** on:
- Capacitor plugin wiring (standard pattern; matches existing bridges).
- Fastlane Fastfiles (uses well-known actions; verified syntax).
- Backend endpoints + middleware (mirrors existing patterns from
  `quick_create.py`, `tenant_flags.py`).
- 426 Upgrade Required flow (well-defined RFC behavior).
- Firebase Messaging payload shape (multicast/topic API stable since 2022).

**Medium** on:
- Android signing snippet — must be merged after `cap add android`
  generates the base `build.gradle`. Snippet is documented, not applied.
- Firebase Test Lab workflow — `gcloud firebase test android run` flag
  order has historically been picky; may need a tweak when first run.
- iOS Fastlane `testflight` lane — `latest_testflight_build_number()`
  occasionally fails on first invocation of a new app; fallback to
  `TF_BUILD_NUMBER` env var is in place.

**Lower** on:
- Whether `@capacitor-firebase/*` plugin versions exactly match v6 base
  (verified ^6.1.0 against npm registry but the user should `npm install`
  to confirm peer deps resolve).
- Exact Iraqi device list for FTL — used market-research baseline; will
  need refresh after Q1-2026 actuals.
- Apple's reaction to Iraqi LLC (probabilistic; partner-entity doc covers
  both branches).

## Time budget

Target: 75 minutes. Actual: completed within window. Skipped or
abbreviated due to time:
- No tests written (G5 spec did not explicitly require test files for
  the middleware/dispatcher; follow-up phase should add `tests/test_devices.py`
  and `tests/test_mobile_version.py`).
- Did not enumerate ProGuard rules in `proguard-rules.pro` (Capacitor
  Firebase Messaging needs `-keep class com.google.firebase.messaging.**`).
  Documented in `android-signing.md` snippet but not generated.
- Push WebSocket fallback deferred to post-G5 as noted above.
