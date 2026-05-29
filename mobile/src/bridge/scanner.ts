/**
 * Native barcode + QR scanner bridge — ML Kit.
 *
 * Spec: design.md §7 (bridges), requirements.md §4.9 (no main-thread block).
 *
 * On the web, the existing barcode worker (`frontend/src/workers/barcode.ts`)
 * uses ZXing in a Web Worker. On mobile we delegate to Google ML Kit via
 * `@capacitor-mlkit/barcode-scanning`, which:
 *   - Runs on the native side (no JS main-thread cost).
 *   - Uses the device camera directly (no `getUserMedia` overhead).
 *   - Supports the same symbologies we care about: EAN-13/8, Code128,
 *     QR, DataMatrix, ITF (used by Iraqi pharmacy supply chain).
 *
 * Public API mirrors `frontend/src/hooks/useBarcodeScanner.ts`.
 */

import { Capacitor } from '@capacitor/core';

export type BarcodeFormat =
  | 'QR_CODE'
  | 'EAN_13'
  | 'EAN_8'
  | 'CODE_128'
  | 'CODE_39'
  | 'CODE_93'
  | 'CODABAR'
  | 'ITF'
  | 'UPC_A'
  | 'UPC_E'
  | 'DATA_MATRIX'
  | 'PDF_417'
  | 'AZTEC';

export interface ScanResult {
  rawValue: string;
  format: BarcodeFormat;
  /** Best-effort camera bounding box for UI overlay. */
  cornerPoints?: Array<{ x: number; y: number }>;
}

export interface ScannerOptions {
  /** Restrict the symbologies we attempt. Default: all 1D + QR + DM. */
  formats?: BarcodeFormat[];
  /**
   * Continuous mode — emit every detection through `onResult` instead of
   * resolving the promise after the first hit. Caller must call `stop()`.
   */
  continuous?: boolean;
  onResult?: (r: ScanResult) => void;
}

export interface ScannerBridge {
  isAvailable(): Promise<boolean>;
  requestPermission(): Promise<{ camera: 'granted' | 'denied' | 'prompt' }>;
  scan(options?: ScannerOptions): Promise<ScanResult | null>;
  stop(): Promise<void>;
  /** Show / hide the live torch (flashlight) — useful in dim shops. */
  setTorch(on: boolean): Promise<void>;
}

let plugin: any = null;
let activeListener: { remove: () => void } | null = null;

async function load() {
  if (plugin) return;
  try {
    const mod = await import('@capacitor-mlkit/barcode-scanning');
    plugin = (mod as any).BarcodeScanner;
  } catch (_) {
    throw new Error(
      'ML Kit barcode plugin missing. Run: npm install @capacitor-mlkit/barcode-scanning',
    );
  }
}

export const nativeScanner: ScannerBridge = {
  async isAvailable() {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      await load();
      const r = await plugin.isSupported();
      return Boolean(r?.supported);
    } catch {
      return false;
    }
  },

  async requestPermission() {
    await load();
    const r = await plugin.requestPermissions();
    return { camera: r?.camera ?? 'prompt' };
  },

  async scan(options: ScannerOptions = {}) {
    await load();

    // ML Kit will only load the model on first call — pre-warm to keep
    // the first scan latency below the 200ms POS budget.
    try {
      const installed = await plugin.isGoogleBarcodeScannerModuleAvailable();
      if (installed && !installed.available) {
        await plugin.installGoogleBarcodeScannerModule();
      }
    } catch {
      // Best-effort; some Capacitor versions don't expose this method.
    }

    if (options.continuous && options.onResult) {
      activeListener = await plugin.addListener('barcodesScanned', (event: any) => {
        for (const b of event?.barcodes ?? []) {
          options.onResult!({
            rawValue: b.rawValue,
            format: b.format,
            cornerPoints: b.cornerPoints,
          });
        }
      });
      await plugin.startScan({ formats: options.formats });
      return null;
    }

    const { barcodes } = await plugin.scan({ formats: options.formats });
    if (!barcodes || barcodes.length === 0) return null;
    const b = barcodes[0];
    return {
      rawValue: b.rawValue,
      format: b.format,
      cornerPoints: b.cornerPoints,
    };
  },

  async stop() {
    if (activeListener) {
      try { activeListener.remove(); } catch { /* noop */ }
      activeListener = null;
    }
    if (plugin?.stopScan) {
      try { await plugin.stopScan(); } catch { /* noop */ }
    }
  },

  async setTorch(on: boolean) {
    await load();
    if (on) await plugin.enableTorch?.();
    else await plugin.disableTorch?.();
  },
};

export default nativeScanner;

// --- Unified scanner (G3) ------------------------------------------------
//
// `unifiedScanner` ties together the native ML Kit path (this file) with
// the web HID + camera paths in `frontend/src/hardware/scanner/scanner-service.ts`.
// Callers can subscribe once via `start(onResult)` and receive scans
// regardless of which path fired. The HID path runs in the web layer; the
// native path runs here. They share a single emit channel.

type UnifiedListener = (r: ScanResult) => void;

const unifiedListeners = new Set<UnifiedListener>();

/** Push a scan from any source — used by the web HID handler and the native ML Kit callback. */
export function emitScan(reading: ScanResult): void {
  for (const l of unifiedListeners) {
    try {
      l(reading);
    } catch {
      // ignore listener errors.
    }
  }
}

/** Start receiving scans. On native, kicks off the ML Kit continuous path. */
export async function startUnified(onResult: UnifiedListener): Promise<() => Promise<void>> {
  unifiedListeners.add(onResult);
  let stopNative = async () => {
    /* noop */
  };
  if (Capacitor.isNativePlatform()) {
    try {
      await nativeScanner.scan({
        continuous: true,
        onResult: (r) => emitScan(r),
      });
      stopNative = async () => {
        await nativeScanner.stop();
      };
    } catch {
      // Native unavailable — fall back to HID-only via web layer.
    }
  }
  return async () => {
    unifiedListeners.delete(onResult);
    await stopNative();
  };
}

export const unifiedScanner = {
  startUnified,
  emitScan,
};
