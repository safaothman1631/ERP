/**
 * Native ESC/POS printer bridge (BLE).
 *
 * Spec: design.md §7 (bridges), requirements.md §4.7 (receipt ≤ 200ms),
 * R12 (mobile native bridge).
 *
 * The Zoho Kurdish ERP supports 80mm BT thermal printers commonly sold
 * in Iraq under various rebranded names (XPrinter, Goojprt, Rongta,
 * etc.). All speak ESC/POS — the printer differences are entirely in
 * the Bluetooth pairing path. We use Bluetooth LE because:
 *   1. Newer printers default to BLE; classic-BT requires Android-only
 *      `BluetoothClassic` plugins that don't have a maintained
 *      Capacitor 6+ port.
 *   2. iOS has dropped support for non-MFi classic Bluetooth — BLE is
 *      the only path to ship a single iOS+Android binary.
 *
 * If your printer is classic-BT only and ignores the BLE service UUID
 * exposed below, you have two options:
 *   - Pair the printer to the OS once via Settings, then use SPP via
 *     a fork of cordova-plugin-bluetooth-serial. Track in Sprint+1.
 *   - Use the WebPrinter fallback (`usePOSPrinter` web hook), which
 *     dispatches a printable PDF to the OS print dialog.
 *
 * Public API mirrors `frontend/src/hooks/usePOSPrinter.ts` so callers
 * never branch on platform.
 */

import { Capacitor } from '@capacitor/core';

// --- Public types -------------------------------------------------------

export interface PrinterDevice {
  /** Stable per-device identifier (BLE MAC on Android, UUID on iOS). */
  id: string;
  /** Human-readable name (printer model + last-4 of MAC). */
  name: string;
  /** RSSI at scan time, in dBm. Lower (more negative) = farther. */
  rssi?: number;
  /** Paired previously / cached as default. */
  remembered?: boolean;
}

export interface PrinterStatus {
  connected: boolean;
  deviceId?: string;
  paperOut?: boolean;
  coverOpen?: boolean;
  batteryPercent?: number;
}

export interface PrintJob {
  /**
   * Pre-rendered ESC/POS byte stream (the receipt template emits this).
   * Encoded as base64 to cross the JS-bridge cheaply.
   */
  escposBase64: string;
  /** Optional human label for diagnostics. */
  jobName?: string;
  /** How many copies (default 1). Customer + merchant. */
  copies?: number;
}

export interface PrinterBridge {
  isAvailable(): Promise<boolean>;
  scan(timeoutMs?: number): Promise<PrinterDevice[]>;
  connect(deviceId: string): Promise<PrinterStatus>;
  disconnect(): Promise<void>;
  print(job: PrintJob): Promise<{ jobId: string; durationMs: number }>;
  status(): Promise<PrinterStatus>;
  rememberDefault(deviceId: string): Promise<void>;
  getDefault(): Promise<string | null>;
}

// --- Constants ---------------------------------------------------------

/**
 * Most ESC/POS BT thermal printers advertise the Nordic UART Service
 * (NUS) by accident, because the BT module chipset (HC-08 / JDY-25M /
 * AT09) is shared across thousands of OEM SKUs.
 *
 * Some printers use a different vendor-specific UUID; the scan filter
 * therefore allows any device whose name matches `/printer|pos|xp-?\d+/i`.
 */
const NUS_SERVICE = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const NUS_TX_CHAR = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
const PRINTER_NAME_REGEX = /printer|pos|xp-?\d+|rongta|goojprt|sunmi/i;

const PREF_DEFAULT_PRINTER = 'pos.printer.defaultDeviceId';

// --- Implementation ----------------------------------------------------

let nativePlugin: any = null;
let preferences: any = null;

async function loadDeps() {
  if (!nativePlugin) {
    try {
      const ble = await import('@capacitor-community/bluetooth-le');
      nativePlugin = (ble as any).BleClient;
    } catch (e) {
      throw new Error('Bluetooth-LE plugin not installed. Run: npm install @capacitor-community/bluetooth-le');
    }
  }
  if (!preferences) {
    try {
      const prefs = await import('@capacitor/preferences');
      preferences = (prefs as any).Preferences;
    } catch (_) {
      // Preferences plugin is optional; fallback to in-memory cache.
      preferences = null;
    }
  }
}

let connectedDeviceId: string | null = null;

// --- Dialect awareness (G3 hardware compatibility layer) -----------------
//
// The frontend `printer-service` runs dialect detection on the byte stream
// itself; the native bridge only needs to ferry pre-rendered ESC/POS bytes.
// We expose the helper below so the frontend can, when running on native,
// pass a dialect hint to the bridge for diagnostics (e.g. choosing MTU
// based on chipset). Today it's pass-through; physical lab testing may
// reveal MTU quirks per dialect that we encode here.

export type DialectHint =
  | 'escpos-epson'
  | 'escpos-xprinter'
  | 'escpos-bixolon'
  | 'escpos-generic-58'
  | 'escpos-generic-80'
  | 'escpos-unknown';

/** Returns the recommended BLE MTU chunk size for a dialect, in bytes. */
export function recommendedChunkSize(dialect?: DialectHint): number {
  switch (dialect) {
    case 'escpos-epson':
      return 200; // Epson chipsets handle larger frames cleanly.
    case 'escpos-bixolon':
      return 180;
    case 'escpos-xprinter':
      return 160; // Xprinter cheaper modules drop frames > 160B.
    case 'escpos-generic-58':
      return 120; // Goojprt / Rongta — conservative.
    default:
      return 180;
  }
}

let currentDialectHint: DialectHint | undefined;

export function setDialectHint(d: DialectHint | undefined): void {
  currentDialectHint = d;
}

export function getDialectHint(): DialectHint | undefined {
  return currentDialectHint;
}

export const nativePrinter: PrinterBridge = {
  async isAvailable() {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      await loadDeps();
      await nativePlugin.initialize({ androidNeverForLocation: true });
      return true;
    } catch {
      return false;
    }
  },

  async scan(timeoutMs = 8000) {
    await loadDeps();
    const found: PrinterDevice[] = [];
    const seen = new Set<string>();
    await nativePlugin.requestLEScan(
      { allowDuplicates: false, namePrefix: '' },
      (result: any) => {
        const id = result.device?.deviceId;
        if (!id || seen.has(id)) return;
        const name = result.device?.name || result.localName || '';
        if (!name || !PRINTER_NAME_REGEX.test(name)) return;
        seen.add(id);
        found.push({
          id,
          name,
          rssi: result.rssi,
        });
      },
    );
    await new Promise((r) => setTimeout(r, timeoutMs));
    await nativePlugin.stopLEScan();
    // Mark the remembered default if present.
    const def = await this.getDefault();
    if (def) {
      for (const d of found) if (d.id === def) d.remembered = true;
    }
    return found;
  },

  async connect(deviceId: string) {
    await loadDeps();
    await nativePlugin.connect(deviceId, () => {
      // Disconnect callback — clear local cache.
      if (connectedDeviceId === deviceId) connectedDeviceId = null;
    });
    connectedDeviceId = deviceId;
    return { connected: true, deviceId };
  },

  async disconnect() {
    if (!connectedDeviceId) return;
    await loadDeps();
    try {
      await nativePlugin.disconnect(connectedDeviceId);
    } finally {
      connectedDeviceId = null;
    }
  },

  async print(job: PrintJob) {
    await loadDeps();
    if (!connectedDeviceId) {
      const def = await this.getDefault();
      if (!def) throw new Error('No printer connected and no default remembered.');
      await this.connect(def);
    }

    const t0 = performance.now();
    const bytes = base64ToBytes(job.escposBase64);
    const copies = Math.max(1, Math.min(3, job.copies ?? 1));

    // Chunked write — most BLE stacks cap MTU at 20-185 bytes per packet.
    // Per-dialect chunk size (G3) accounts for cheaper modules dropping frames.
    const CHUNK = recommendedChunkSize(currentDialectHint);
    for (let c = 0; c < copies; c++) {
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const slice = bytes.slice(i, i + CHUNK);
        await nativePlugin.writeWithoutResponse(
          connectedDeviceId,
          NUS_SERVICE,
          NUS_TX_CHAR,
          new DataView(slice.buffer, slice.byteOffset, slice.byteLength),
        );
      }
    }
    return {
      jobId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      durationMs: performance.now() - t0,
    };
  },

  async status() {
    if (!connectedDeviceId) return { connected: false };
    return { connected: true, deviceId: connectedDeviceId };
  },

  async rememberDefault(deviceId: string) {
    if (preferences) {
      await preferences.set({ key: PREF_DEFAULT_PRINTER, value: deviceId });
    } else {
      (globalThis as any).__zoho_default_printer = deviceId;
    }
  },

  async getDefault() {
    if (preferences) {
      const { value } = await preferences.get({ key: PREF_DEFAULT_PRINTER });
      return value || null;
    }
    return (globalThis as any).__zoho_default_printer || null;
  },
};

// --- Helpers -----------------------------------------------------------

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default nativePrinter;
