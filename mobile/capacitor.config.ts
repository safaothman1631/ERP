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
      launchShowDuration: 1500,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      backgroundColor: '#0c0d10',
      showSpinner: false,
      splashImmersive: true,
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
  },

  loggingBehavior: 'production',
  cordova: {},
};

export default config;
