# ADR 0003 — Capacitor for the native mobile shell (not React Native)

| | |
|---|---|
| **Date** | 2026-05-27 |
| **Authors** | Safa Othman |
| **Reviewers** | FE lead, mobile contributor |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | design.md §7, §11 (D-005); requirements.md §12; `mobile/` |

## 1. Context

The Iraqi market needs us on the Play Store and the App Store. Cashier
hardware is increasingly Android-only tablets (Sunmi V2, Wintec Anycard,
generic 10" Android slates) and merchant managers expect to track sales
from an iPhone. A web app behind Safari works, but it cannot:

* Pair with a Bluetooth thermal printer reliably (`navigator.bluetooth` is patchy on iOS).
* Use the OS NFC reader for ID cards.
* Use the OS-level camera as a barcode scanner without the Chrome / Safari toolbar consuming screen real estate.
* Be installed from the Play Store / App Store with the marketing presence that comes with that.

The choice for shipping a native build is between:

* **Capacitor** (Ionic's successor to Cordova) — wraps the existing web bundle in a `WKWebView` / Android `WebView`; native plugins are JS bridges.
* **React Native** — rewrite the UI in RN components; share *logic* via TypeScript and platform-specific UI.
* **Flutter** — full rewrite in Dart; share nothing with the web.
* **Native Android + iOS** — two separate codebases.

The codebase is 276 React pages, ~ 4,600 LOC of settings, multiple
custom hooks for live data, three-language i18n with RTL, and Ant
Design as the component library. Throwing that away would consume
the next 6-9 months of FE capacity.

## 2. Decision

**We ship the mobile app via Capacitor.** The same `frontend/dist` web
build that ships to Vercel is wrapped in a Capacitor shell that adds:

* Native Bluetooth (BLE) for ESC/POS thermal printers (`@capacitor-community/bluetooth-le`).
* Native barcode scanner via ML Kit (`@capacitor-mlkit/barcode-scanning`).
* Native NFC reader (stub today; full implementation Sprint+1).
* Splash screen, status bar, deep links via the standard Capacitor plugins.

The shell lives in `mobile/`. Its `webDir` points at `../frontend/dist`,
so there is no "mobile-specific" UI to maintain. The few capabilities
that differ between web and native are encapsulated behind hook-shaped
bridges (`mobile/src/bridge/*.ts`) that the web fallback implements
in pure JS.

## 3. Consequences

### Positive

* Reuse of 100% of the existing UI, navigation, i18n, RTL, and form code. The mobile binary is *almost* exactly what ships to Vercel.
* Single QA surface — the same Playwright tests cover web and native, with the bridges stubbed.
* New features ship to mobile and web simultaneously (no feature-skew window).
* Native plugin ecosystem covers everything we need today (printer, scanner, NFC, filesystem, network info).
* The shell binary is small — Android APK around 6-10 MB.

### Negative

* App is a `WKWebView` / `WebView` — there is a small startup cost (~ 300-500 ms) for the runtime to attach.
* Some advanced native capabilities (custom in-app camera UI, advanced graphics) require writing a Capacitor plugin, which is non-trivial.
* WebView quirks: iOS WKWebView caps memory differently than Mobile Safari; Android WebView version varies across devices (the very low-end Android 8 / Chromium 70 user is left behind, and that's fine — our `minWebViewVersion: 90` puts the floor at Android 9+).
* Touch-id / Face-id / payment-terminal integrations are plugin-by-plugin and may require contributing upstream.

### Neutral / known unknowns

* `expo-router` / RN's deep-link story is mature. We replicate it through Capacitor's `App.addListener('appUrlOpen')` — works fine in practice.
* Performance: on a Pixel 6, the web build hits 60fps in Chrome. The WebView is the same Chromium build, so we expect parity. Verified by running the existing Lighthouse budget against the Capacitor build.
* App Store review: shells around web content used to be a friction with Apple ("4.2 Minimum Functionality"). Modern Capacitor apps (Discord, Sworkit, etc.) pass without issue because the app calls native APIs (printer, scanner). We document this in the App Store submission notes.

## 4. Alternatives considered

### Alternative A — React Native

* **Pros:** Native feel; mature ecosystem; great DX.
* **Cons:** Requires re-implementing the UI in `react-native-*` components — Ant Design has no RN port. This is months of work, and the result is a *parallel* codebase that drifts from web.
* **Why rejected:** Cost is unacceptable; we have no months of FE capacity to allocate.

### Alternative B — Flutter

* **Pros:** Best native performance of the cross-platform options; great tooling.
* **Cons:** Dart rewrite; would discard the entire React investment.
* **Why rejected:** Same as RN, only worse.

### Alternative C — Native Android + iOS (two codebases)

* **Pros:** Theoretical max performance and platform fit.
* **Cons:** Two codebases; two release cycles; team has neither Swift nor mature Kotlin expertise.
* **Why rejected:** We are 4 engineers. Operating three codebases (web + Android + iOS) would consume our entire roadmap.

### Alternative D — PWA only

* **Pros:** Zero new code; iOS PWA install + Android home-screen.
* **Cons:** Cannot access native Bluetooth reliably; no Play Store presence; install funnel is poor on iOS (Add to Home Screen is hidden).
* **Why rejected:** Loses the printer integration that is table-stakes for POS in Iraq.

## 5. Validation

* T-6.5 exit: Debug builds install + open on a Pixel 6 (Android 14) and an iPhone 12 (iOS 17). Login → POS sale completes.
* T-6.6 exit: Google Play pre-launch report shows zero crashes across the top 12 device classes.
* Performance: cold-start to login screen < 2.5s on a Pixel 6; same TBT budget as web.

## 6. Notes

* The Capacitor team's roadmap commitments (Capacitor 7 in late 2026) align with our Sprint+2 mobile work.
* If the WebView model ever becomes the constraint, the migration path is to introduce a single screen as a native view first (e.g. a custom camera screen) — Capacitor supports mixed-stack apps without forcing a rewrite. Decision is reversible at a sub-screen granularity.

---

*Last reviewed: 2026-05-27 by Safa Othman. Next review: 2026-11-27.*
