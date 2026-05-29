/**
 * Capacitor configuration — Zoho Kurdish ERP mobile wrapper.
 *
 * Spec ref: design.md §7, tasks.md T-6.5.
 *
 * The mobile app does not build its own JS — it points `webDir` at the
 * frontend's existing Vite output, so iOS + Android ship the exact same
 * bundle that production web users see. This keeps us on a single QA
 * surface and a single i18n catalogue.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zoho.kurdishierp',
  appName: 'Zoho Kurdish',
  webDir: '../frontend/dist',
  bundledWebRuntime: false,

  // The native shell loads the production frontend by default. For dev,
  // override CAP_SERVER_URL to point at a local Vite dev server (e.g.
  // http://10.0.2.2:5173 from Android emulator). This setting is only
  // applied when the env var is set at sync time.
  server: process.env.CAP_SERVER_URL
    ? {
        url: process.env.CAP_SERVER_URL,
        cleartext: process.env.CAP_SERVER_URL.startsWith('http://'),
      }
    : {
        androidScheme: 'https',
        iosScheme: 'https',
        // Allow Cloud Run API origin
        allowNavigation: [
          '*.run.app',
          '*.zoho.kurd.iq',
          '*.googleapis.com',
          '*.firebaseio.com',
        ],
      },

  android: {
    minWebViewVersion: 90, // Chromium 90 (Android 7+ devices that updated)
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
  },

  ios: {
    contentInset: 'always',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
    backgroundColor: '#ffffff',
  },

  plugins: {
    SplashScreen: {
      // Spec ref: R5.7 — splash with logo + localized "Loading…".
      launchShowDuration: 1500,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      backgroundColor: '#0c0d10',
      showSpinner: false,
      splashImmersive: true,
      // Brand logo lives under `android/app/src/main/res/drawable-*/splash.png`
      // and `ios/App/App/Assets.xcassets/Splash.imageset/`. The localized
      // "Loading…" string is rendered by the React shell once webview is ready.
      androidSplashResourceName: 'splash',
      iosSpinnerStyle: 'small',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0c0d10',
      overlaysWebView: false,
    },
    BluetoothLe: {
      // BT printer + payment terminal pairing.
      displayStrings: {
        scanning: 'Scanning for printers...',
        cancel: 'Cancel',
        availableDevices: 'Available devices',
        noDeviceFound: 'No device found',
      },
    },
    BarcodeScanner: {
      // Bundled vs. Google Play Services scanner module. Bundled = larger
      // APK, but works offline + on devices without GPS.
      bundle: true,
    },
    Preferences: {
      group: 'com.zoho.kurdishierp.prefs',
    },
    // ── Push (FCM + APNs) — design.md §5.4 ─────────────────────────────────
    PushNotifications: {
      // Show heads-up banner + sound on Android. iOS is configured in
      // `ios/App/App/AppDelegate.swift` via `UNUserNotificationCenter`.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // Firebase Messaging (preferred over the bare Capacitor PushNotifications
    // plugin on Android because it exposes topic management + foreground
    // delivery callbacks). iOS still uses APNs under the hood; this plugin
    // bridges the FCM token via the APNs registration callback.
    FirebaseMessaging: {
      // Auto-init the SDK; we manage the token lifecycle ourselves in
      // `src/bridge/push.ts`.
    },
    // In-app update (Android Play Store only — iOS uses App Store banner).
    AppUpdate: {
      // Reads min/latest from `/api/mobile/version-check` at cold start; this
      // plugin's role is to surface the Play Store in-app update prompt for
      // Android once the backend decides an update is required.
    },
    // App lifecycle + deep links (used by the in-app update gate to listen
    // for `appStateChange` events and re-check version on resume).
    App: {},
    // Network plugin: drives offline banner + queued mutations in POS.
    Network: {},
    // Filesystem: used by offline cache and printer ESC/POS payload staging.
    Filesystem: {},
  },

  loggingBehavior: 'production',
  cordova: {},
};

export default config;
