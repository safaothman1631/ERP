# iOS Fastlane Match — Operations Runbook

> Spec refs: requirements.md §R5.4 (reproducible iOS provisioning),
> design.md §5.3, tasks.md T-G.5.4. The acceptance criterion is *a new
> engineer can produce a signed build within 30 minutes of being granted
> access*.

This document explains how to set up Fastlane Match for the Zoho Kurdish
ERP iOS app, onboard a new engineer, and rotate certificates safely.

---

## 1. One-time setup (Eng B, founder present)

### 1.1 Create the certs repo

1. In the org's GitHub, create a **private** repo called `ios-match-certs`.
2. Grant *Maintain* access to the founder and Eng B only.
3. Do **not** invite collaborators directly — use a `mobile-signing` team
   so access can be revoked atomically.

### 1.2 Choose a strong passphrase

Generate with `openssl rand -base64 32`. Store in 1Password vault
`mobile/ios/match-passphrase`. The passphrase encrypts every cert and
profile in the repo.

### 1.3 Run Match for the first time

```bash
cd mobile/ios
bundle install
bundle exec fastlane match development --force
bundle exec fastlane match appstore --force
```

The first invocation will:
- Authenticate to Apple Developer using `APPLE_ID` + an app-specific password
  (or the App Store Connect API key — preferred).
- Create new certs + provisioning profiles for `com.zoho.kurdishierp`.
- Encrypt them with `MATCH_PASSWORD`.
- Commit the encrypted payload to the `ios-match-certs` repo.

After this, the App Store Connect website should show two profiles named
`match Development com.zoho.kurdishierp` and `match AppStore com.zoho.kurdishierp`.

### 1.4 Wire CI secrets

In the main repo (zoho-kurd/...) Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `MATCH_PASSWORD` | Passphrase from 1Password |
| `MATCH_GIT_URL` | `https://github.com/zoho-kurd/ios-match-certs.git` |
| `MATCH_GIT_BASIC_AUTH_BASE64` | `echo -n "USERNAME:FINE_GRAINED_PAT" \| base64` |
| `APPLE_ID` | Founder's Apple ID |
| `APPLE_TEAM_ID` | 10-char team id from <https://developer.apple.com/account/#MembershipDetail> |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID from App Store Connect → Users and Access → Keys |
| `APP_STORE_CONNECT_API_ISSUER` | Issuer ID (same page) |
| `APP_STORE_CONNECT_API_KEY_B64` | `base64 -w 0 AuthKey_XXXX.p8` |

The fine-grained PAT used for `MATCH_GIT_BASIC_AUTH_BASE64` should have:
- Repository access: only `ios-match-certs`
- Permissions: Contents (read & write), Metadata (read)

---

## 2. Onboarding a new engineer (30-minute path)

1. Grant the new engineer access to the `ios-match-certs` repo (Read role).
2. Share the `MATCH_PASSWORD` from 1Password (Make sure they have a 1Password
   account first).
3. Have them run:
   ```bash
   cd mobile/ios
   bundle install
   export MATCH_PASSWORD="<from 1password>"
   bundle exec fastlane match development --readonly
   ```
4. Match clones the repo, decrypts, installs the dev cert + profile into
   the macOS keychain. The engineer can now open `App/App.xcworkspace`
   in Xcode and build to a device.

Total elapsed time: ~10 minutes assuming Bundler + Ruby are already
installed and 1Password access is granted.

---

## 3. Rotating certificates

Apple certs expire annually. Fastlane Match handles this:

```bash
cd mobile/ios
bundle exec fastlane match nuke distribution  # revoke old distribution certs
bundle exec fastlane match appstore --force   # generate new ones
```

> `nuke development` is rarely needed; dev certs auto-renew up to 5 active.

**Coordinate with the team before nuking** — all in-flight builds will
fail signing until they re-fetch. Run during a low-activity window.

---

## 4. Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `MATCH_PASSWORD environment variable not set` | Missing env var | `export MATCH_PASSWORD=…` from 1Password |
| `Could not find credentials for GitHub` | Bad PAT | Regenerate fine-grained PAT, re-encode to base64 |
| `Your account doesn't have permission to create new certificates` | Apple account not Account Holder / Admin | Founder must promote your Apple ID via App Store Connect Users and Access |
| `Couldn't get any apps for your team_id` | Wrong `APPLE_TEAM_ID` | Re-check at <https://developer.apple.com/account/#MembershipDetail> |
| `keychain locked` | Local macOS keychain timeout | `security unlock-keychain login.keychain` |

---

## 5. CI integration

`.github/workflows/mobile-ios-debug.yml` runs on PR:
- `fastlane ios debug` — builds with development cert, surfaces sign errors early.

`.github/workflows/mobile-ios-testflight.yml` runs on `mobile-v*` tag:
- `fastlane ios testflight` — fetches AppStore profile via Match (readonly),
  builds Release IPA, uploads to TestFlight via App Store Connect API.

The first TestFlight build of a new app version takes 5–20 minutes to
process in Apple's queue; subsequent builds are typically faster.

---

## 6. Partner-entity fallback impact

If iOS enrollment must use a Turkey or Jordan partner entity (see
`docs/mobile/partner-entity-fallback.md`), then:
- `APPLE_ID` is the partner entity's Apple ID.
- `APPLE_TEAM_ID` is the partner entity's team id.
- Match repo stays the same (it's storage-agnostic).
- Royalty reporting tracked separately in the licensing agreement.
