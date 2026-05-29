# Android Fastlane

Spec ref: `growth-to-100/design.md` §5.1–§5.2, `tasks.md` T-G.5.3, T-G.5.5, T-G.5.21.

## Lanes

| Lane | Purpose | Trigger |
|------|---------|---------|
| `debug` | Build unsigned debug APK | Local dev, PR CI |
| `release` | Build signed release AAB | Called by other lanes |
| `internal` | Upload AAB to Play Internal Testing | `mobile-v*` tag |
| `beta` | Upload AAB to Play Closed Beta | Manual promotion |
| `production` | Promote to production at 10% rollout | Manual after beta soak |

## Local usage

```bash
cd mobile/android
bundle install                  # one-time
bundle exec fastlane debug      # PR-equivalent local build
```

For lanes that need signing, populate these env vars first (or use `direnv`):

```
export KEYSTORE_BASE64=$(base64 -w 0 path/to/upload.jks)
export KEYSTORE_PASSWORD=********
export KEY_ALIAS=upload
export KEY_PASSWORD=********
export PLAY_JSON_KEY_BASE64=$(base64 -w 0 path/to/play-key.json)
```

> Never commit the keystore or play-key.json. The `.gitignore` already
> excludes `*.jks` and `play-key.json`.

## CI usage

GitHub Actions reads the same env from repo secrets. See:
- `.github/workflows/mobile-android-debug.yml` (runs `debug` on PR)
- `.github/workflows/mobile-android-beta.yml` (runs `internal` on tag)

## Keystore recovery

If the upload keystore is lost, follow Google Play App Signing recovery:
<https://support.google.com/googleplay/android-developer/answer/9842756>.
Because Google holds the production signing key, lost upload keys are
recoverable in ≤ 72h by filing a support ticket.

See `docs/mobile/android-signing.md` for full procedure.
