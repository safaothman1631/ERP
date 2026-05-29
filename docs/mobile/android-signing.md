# Android Signing — Operations Runbook

> Spec refs: requirements.md §R5.3 (Play App Signing), design.md §5.2
> (keystore stored encrypted in Actions secrets), tasks.md T-G.5.3.

This document explains how to generate the Zoho Kurdish ERP Android upload
keystore, store it securely, retrieve it in CI, and recover it if lost.

---

## 1. Concepts (read this first)

Google Play App Signing splits signing into **two keys**:

1. **Upload key** — what *we* hold. The Android Studio / Fastlane build signs
   the AAB with this key.
2. **App signing key** — what *Google* holds. Google re-signs the AAB with
   this key before distribution. We never see it.

Implication: **if we lose the upload key, recovery is possible in ≤ 72h via
a Play Console support ticket**. If we lost the app signing key, we would
have to publish a new app under a new package name — but Google holds it,
so this cannot happen.

---

## 2. Generate the upload keystore (one-time, founder + Eng B together)

Use a dedicated, never-connected-to-network machine if possible. The
output `.jks` file MUST be backed up encrypted before leaving the machine.

```bash
keytool -genkeypair \
  -alias upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 25000 \
  -keystore upload.jks \
  -storetype JKS \
  -dname "CN=Zoho Kurdish ERP, OU=Mobile, O=<Legal entity name>, L=Erbil, ST=Erbil, C=IQ"
```

When prompted:
- **Store password:** 20-char random, recorded in 1Password vault
  `mobile/android/upload-keystore`.
- **Key password:** same as store password (Fastlane convention; simplifies
  CI env wiring).
- **Validity 25000 days** = ~68 years — exceeds any realistic app lifetime
  and satisfies the Play Console's 25-year minimum.

Verify with:

```bash
keytool -list -v -keystore upload.jks -alias upload
```

The fingerprint (SHA-1 + SHA-256) is what you'll paste into Firebase Console
when wiring FCM.

---

## 3. Storage

| Location | Purpose | Access |
|----------|---------|--------|
| 1Password vault `mobile/android/upload-keystore` | Master copy + password | Founder + Eng B |
| Google Secret Manager `projects/.../secrets/android-upload-keystore` | Production fallback | CI service account |
| GitHub Actions Repo Secret `KEYSTORE_BASE64` | CI build input | Workflows only |
| Encrypted offline backup (encrypted USB in a safe) | Disaster recovery | Founder |

**Never commit `.jks`, `.keystore`, `.p12`, or `play-key.json` to git.**
The `.gitignore` at the mobile root excludes these by extension.

### Encoding for Actions secret

```bash
base64 -w 0 upload.jks > upload.jks.b64
# Then in GitHub repo settings → Secrets and variables → Actions:
#   Name:  KEYSTORE_BASE64
#   Value: paste contents of upload.jks.b64
```

Also create these secrets:
- `KEYSTORE_PASSWORD` — same password used above
- `KEY_ALIAS` — `upload`
- `KEY_PASSWORD` — same as `KEYSTORE_PASSWORD`
- `PLAY_JSON_KEY_BASE64` — base64-encoded service-account JSON from
  Play Console → Setup → API access → Create new service account →
  grant *Release manager* role. See
  <https://docs.fastlane.tools/getting-started/android/setup/#collect-your-google-credentials>

---

## 4. CI retrieval (already wired)

`mobile/android/fastlane/Fastfile` contains a `_restore_keystore_from_env`
private lane that:

1. Reads `KEYSTORE_BASE64`.
2. Decodes to `mobile/android/fastlane/upload.jks`.
3. Sets `KEYSTORE_PATH` env var consumed by `signingConfigs.release`.

The `release` lane then runs `gradle bundleRelease` with the signing
properties injected via `-Pandroid.injected.signing.*`.

---

## 5. Loss-recovery procedure

If the upload keystore is lost (machine wipe + 1Password compromise +
Secret Manager outage simultaneously, hopefully never):

1. Generate a new upload key as in §2.
2. Email a CSR + the new key's public certificate to Play Console support
   via <https://support.google.com/googleplay/android-developer/contact/key>.
3. Wait 48–72h for Google to swap the upload key.
4. Update `KEYSTORE_BASE64` + 1Password vault with the new key.
5. Resume releases.

During the swap window, **no new releases are possible**. Hotfixes must
wait. Plan around this.

---

## 6. Annual rotation (recommended)

Rotate the upload keystore yearly even if no compromise is suspected:

1. Generate new keystore.
2. Upload new public cert to Play Console (Settings → App integrity).
3. Update secrets.
4. Old keystore goes to cold storage labeled `RETIRED YYYY-MM-DD`.

The app signing key (Google-managed) is never rotated; rotation applies
only to the upload key.

---

## 7. Verifying a build was signed correctly

```bash
unzip -p app-release.aab META-INF/MANIFEST.MF | head -20
# Confirm the SHA-256 in `keytool -list -v` matches the cert in the AAB.
jarsigner -verify -verbose -certs app-release.aab
```

CI emits the SHA-256 fingerprint to the workflow log on every release for
provenance.
