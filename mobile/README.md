# Mobile — Capacitor wrapper

> **Spec ref:** design.md §7, requirements.md §12, tasks.md T-6.5
> **Owners:** FE + mobile contributor

This directory contains the **Capacitor** wrapper that ships the Zoho
Kurdish ERP as an Android + iOS app. It deliberately reuses the
`frontend/` Vite build 1:1 — there is no separate React Native code,
no separate UI to maintain.

## 1. Prerequisites

### Common
* Node 20+, npm 10+
* Java 17 (Temurin / OpenJDK)
* The `frontend/` build must succeed (`cd frontend && npm run build`).

### Android
* Android Studio Hedgehog (2023.1.1) or newer
* Android SDK platforms 33 + 34 installed
* `ANDROID_HOME` exported (typically `~/Android/Sdk`)
* Optional: a physical Pixel 6 / 7 with USB debugging enabled

### iOS (macOS only)
* Xcode 15.4+
* CocoaPods 1.15+: `sudo gem install cocoapods`
* An Apple Developer account for signing
* Optional: an iPhone 12+ on iOS 16+

## 2. First-time setup

```bash
cd mobile
npm install

# Scaffold native projects (run once, commits the android/ + ios/ folders)
npm run add:android
npm run add:ios     # macOS only

# Build the web bundle and copy it into both native projects
npm run build:android
npm run build:ios   # macOS only
```

This generates:

```
mobile/
├── android/                ← Gradle Android project
├── ios/                    ← Xcode iOS project
├── capacitor.config.ts     ← already committed
├── package.json
└── src/bridge/             ← Capacitor → app glue (printer, scanner, NFC)
```

## 3. Run on an emulator / simulator

### Android emulator

```bash
cd mobile
npm run build:android
npm run android         # opens Android Studio
# In Android Studio: Run > Run 'app' (Shift+F10)
```

If the device is offline, you can also use:

```bash
cd mobile/android
./gradlew installDebug
adb shell am start -n com.zoho.kurdishierp/.MainActivity
```

### iOS simulator

```bash
cd mobile
npm run build:ios
npm run ios            # opens Xcode
# In Xcode: pick a simulator and press Cmd+R
```

## 4. Run on a physical device

### Android

1. Plug the phone in via USB; accept the debug prompt.
2. `adb devices` should list the device.
3. From Android Studio: pick the device in the run-target dropdown and Run.

### iOS

1. Plug the iPhone in via Lightning / USB-C.
2. In Xcode: Window > Devices and Simulators — verify the phone shows.
3. Pick the device in the target dropdown; Xcode will prompt to register your developer profile the first time.
4. Run.

## 5. Native bridges (`src/bridge/`)

The native APIs we wrap:

| Bridge | Underlying plugin | Spec |
|---|---|---|
| `printer.ts` | `@capacitor-community/bluetooth-le` | R12 — POS Bluetooth thermal printer (ESC/POS). |
| `scanner.ts` | `@capacitor-mlkit/barcode-scanning` | R4.9 — barcode scan moves off the main thread. |
| `nfc.ts` | TBD (Sprint+1; placeholder stub today) | R12 — contactless ID + ticketing. |

Each bridge exposes the **same TS interface** that the web app already
uses (`usePOSPrinter`, `useBarcodeScanner` hooks), so the only diff
between web and mobile is the implementation. The hook does a runtime
`Capacitor.isNativePlatform()` check and picks the right backend.

## 6. Dev with live reload

If you don't want to rebuild on every change, point Capacitor at the Vite dev server:

```bash
# Terminal 1
cd frontend && npm run dev -- --host 0.0.0.0      # exposes 5173

# Terminal 2 — Android emulator
cd mobile
CAP_SERVER_URL=http://10.0.2.2:5173 npm run sync
npm run android
```

iOS simulator uses `http://localhost:5173` for `CAP_SERVER_URL`.

## 7. Releasing

### Android internal track (Play Console)

1. Bump `versionCode` and `versionName` in `android/app/build.gradle`.
2. `cd mobile/android && ./gradlew bundleRelease` — outputs an `.aab`.
3. Sign with the upload key (held in 1Password by the mobile lead).
4. Upload to Google Play Console → Internal testing track.
5. Address the pre-launch report (covered by tasks.md T-6.6).

### iOS TestFlight

1. Bump the build number in Xcode (Project > Targets > General).
2. Product > Archive in Xcode.
3. Window > Organizer → Distribute App → App Store Connect → Upload.
4. In App Store Connect, push to TestFlight internal testers.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Web Asset Server not running" on Android | Old debug config | Stop the app, `npm run sync`, re-run. |
| `npm run android` hangs | Android Studio not installed / `ANDROID_HOME` unset | Install Studio, export `ANDROID_HOME`. |
| White screen on launch | `webDir` is stale | `npm run build:android` again. |
| Pod install fails on iOS | Outdated CocoaPods | `sudo gem install cocoapods` then `pod repo update`. |
| Plugin "X" not found at runtime | Forgot to `npm run sync` after adding a dep | `npm install <pkg> && npm run sync`. |

## 9. Layout

```
mobile/
├── README.md             ← you are here
├── package.json          ← wrapper deps + scripts
├── capacitor.config.ts   ← Capacitor configuration
├── src/
│   └── bridge/
│       ├── printer.ts    ← ESC/POS over BLE
│       ├── scanner.ts    ← ML Kit barcode
│       └── nfc.ts        ← interface only (Sprint+1)
├── android/              ← created by `cap add android`
└── ios/                  ← created by `cap add ios` (macOS)
```
