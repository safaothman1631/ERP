/**
 * Barcode scanner service — unifies HID keyboard-wedge + camera fallback.
 *
 * Spec: growth-to-100/requirements.md R3.6 (HID + BT + camera),
 *       R3.7 (camera in Web Worker), tasks.md T-G.3.13–T-G.3.14.
 *
 * Two paths:
 *   1. HID keyboard-wedge — USB or Bluetooth scanner that appears as a
 *      keyboard. We attach a global keypress listener and treat rapid
 *      bursts ending in Enter as a barcode scan.
 *   2. Camera — falls through to the existing `@zxing/browser` worker
 *      (`frontend/src/workers/barcode.ts`). The HID path is preferred
 *      when available; the camera path is opt-in.
 *
 * Both paths feed the same `useBarcodeInput()` hook so POS UIs don't
 * branch on transport.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ───────────────────────── Types ────────────────────────────────────────

export type ScanSource = 'hid' | 'camera' | 'native';
export type Symbology =
  | 'EAN_13'
  | 'EAN_8'
  | 'UPC_A'
  | 'UPC_E'
  | 'CODE_128'
  | 'CODE_39'
  | 'CODE_93'
  | 'ITF'
  | 'CODABAR'
  | 'QR_CODE'
  | 'DATA_MATRIX'
  | 'PDF_417'
  | 'AZTEC'
  | 'UNKNOWN';

export interface ScannerReading {
  value: string;
  source: ScanSource;
  symbology: Symbology;
  /** Local-time ms since epoch when the scan completed. */
  timestamp: number;
}

export interface ScannerOptions {
  /** Minimum char count to qualify as a barcode (default 6). */
  minLength?: number;
  /** Max ms between two keystrokes for them to count as one scan (default 60). */
  maxInterKeyMs?: number;
  /** Suppress identical scans inside this window (default 800ms). */
  duplicateSuppressionMs?: number;
  /** If true, ignore HID input while a text field is focused (default true). */
  respectFocus?: boolean;
}

// ───────────────────────── HID detection ────────────────────────────────

const DEFAULT_OPTS: Required<ScannerOptions> = {
  minLength: 6,
  maxInterKeyMs: 60,
  duplicateSuppressionMs: 800,
  respectFocus: true,
};

const FOCUS_IGNORE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

interface HidState {
  buffer: string;
  lastKeyAt: number;
  startedAt: number;
}

/** Heuristic symbology classification from the raw string. */
export function classifySymbology(raw: string): Symbology {
  if (/^\d{13}$/.test(raw)) return 'EAN_13';
  if (/^\d{8}$/.test(raw)) return 'EAN_8';
  if (/^\d{12}$/.test(raw)) return 'UPC_A';
  if (/^\d{6,11}$/.test(raw)) return 'UPC_E';
  if (/^[0-9A-Z\-\.\$/\+%\s]+$/.test(raw) && raw.length <= 43) return 'CODE_39';
  if (/^[\x00-\x7f]+$/.test(raw)) return 'CODE_128';
  return 'UNKNOWN';
}

// ───────────────────────── HID singleton listener ───────────────────────

type Listener = (reading: ScannerReading) => void;

let hidListeners = new Set<Listener>();
let hidAttached = false;
let lastEmitted: { value: string; at: number } | null = null;
let hidState: HidState = { buffer: '', lastKeyAt: 0, startedAt: 0 };
let currentOpts: Required<ScannerOptions> = { ...DEFAULT_OPTS };

function shouldIgnoreFocus(): boolean {
  if (!currentOpts.respectFocus) return false;
  const el = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
  if (!el) return false;
  if (FOCUS_IGNORE_TAGS.has(el.tagName)) return true;
  if ((el as any).isContentEditable) return true;
  return false;
}

function onKeydown(ev: KeyboardEvent) {
  // Allow Enter even from focused inputs — many HID scanners append CR.
  const isEnter = ev.key === 'Enter';
  if (!isEnter && shouldIgnoreFocus()) {
    // Reset buffer; a manual typist is using a real input.
    hidState = { buffer: '', lastKeyAt: 0, startedAt: 0 };
    return;
  }
  const now = performance.now();
  if (hidState.lastKeyAt && now - hidState.lastKeyAt > currentOpts.maxInterKeyMs) {
    // Gap too long — discard prior buffer (human typing).
    hidState = { buffer: '', lastKeyAt: now, startedAt: now };
  }
  if (isEnter) {
    const totalDurationMs = hidState.startedAt ? now - hidState.startedAt : 0;
    const isFastEnough = hidState.buffer.length >= currentOpts.minLength && totalDurationMs < hidState.buffer.length * currentOpts.maxInterKeyMs * 1.5;
    if (isFastEnough) {
      ev.preventDefault();
      ev.stopPropagation();
      const value = hidState.buffer;
      const nowMs = Date.now();
      if (!(lastEmitted && lastEmitted.value === value && nowMs - lastEmitted.at < currentOpts.duplicateSuppressionMs)) {
        lastEmitted = { value, at: nowMs };
        const reading: ScannerReading = {
          value,
          source: 'hid',
          symbology: classifySymbology(value),
          timestamp: nowMs,
        };
        for (const l of hidListeners) {
          try {
            l(reading);
          } catch {
            // ignore listener errors.
          }
        }
      }
    }
    hidState = { buffer: '', lastKeyAt: 0, startedAt: 0 };
    return;
  }
  // Only printable single-char keys go in the buffer.
  if (ev.key.length === 1) {
    if (!hidState.startedAt) hidState.startedAt = now;
    hidState.buffer += ev.key;
    hidState.lastKeyAt = now;
  }
}

function attachHid() {
  if (hidAttached || typeof window === 'undefined') return;
  window.addEventListener('keydown', onKeydown, true);
  hidAttached = true;
}

function detachHid() {
  if (!hidAttached || typeof window === 'undefined') return;
  window.removeEventListener('keydown', onKeydown, true);
  hidAttached = false;
}

export function setScannerOptions(opts: ScannerOptions) {
  currentOpts = { ...DEFAULT_OPTS, ...opts };
}

export function subscribeScanner(listener: Listener): () => void {
  attachHid();
  hidListeners.add(listener);
  return () => {
    hidListeners.delete(listener);
    if (hidListeners.size === 0) detachHid();
  };
}

/** Manually push a reading (used by camera path / native bridge). */
export function emitScannerReading(reading: ScannerReading) {
  const now = Date.now();
  if (lastEmitted && lastEmitted.value === reading.value && now - lastEmitted.at < currentOpts.duplicateSuppressionMs) {
    return;
  }
  lastEmitted = { value: reading.value, at: now };
  for (const l of hidListeners) {
    try {
      l(reading);
    } catch {
      // ignore.
    }
  }
}

// ───────────────────────── React hook ───────────────────────────────────

export interface UseBarcodeInputResult {
  lastScan: ScannerReading | null;
  scanCount: number;
}

/**
 * React hook for HID + camera + native scans.
 * Returns the most recent reading and a running count.
 */
export function useBarcodeInput(opts?: {
  enabled?: boolean;
  options?: ScannerOptions;
  onScan?: (r: ScannerReading) => void;
}): UseBarcodeInputResult {
  const { enabled = true, options, onScan } = opts ?? {};
  const [lastScan, setLastScan] = useState<ScannerReading | null>(null);
  const countRef = useRef(0);
  const [scanCount, setScanCount] = useState(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    if (options) setScannerOptions(options);
    const unsubscribe = subscribeScanner((r) => {
      setLastScan(r);
      countRef.current += 1;
      setScanCount(countRef.current);
      try {
        onScanRef.current?.(r);
      } catch {
        // swallow.
      }
    });
    return unsubscribe;
  }, [enabled, options]);

  return { lastScan, scanCount };
}

// ───────────────────────── Camera fallback bridge ───────────────────────

/**
 * Start the camera path — delegates to the existing barcode worker if
 * present. The worker streams readings back into the scanner service via
 * `emitScannerReading()`, so subscribers don't need to know which path
 * fired.
 *
 * Returns a stop function. If no worker is available, returns null.
 */
export async function startCameraScan(): Promise<(() => void) | null> {
  try {
    const mod = await import('../../workers/barcode' as any).catch(() => null);
    if (!mod || typeof (mod as any).startCameraWorker !== 'function') return null;
    const stop = await (mod as any).startCameraWorker((result: { value: string; format?: string }) => {
      emitScannerReading({
        value: result.value,
        source: 'camera',
        symbology: (result.format as Symbology) ?? classifySymbology(result.value),
        timestamp: Date.now(),
      });
    });
    return typeof stop === 'function' ? stop : () => undefined;
  } catch {
    return null;
  }
}

export const ScannerService = {
  setScannerOptions,
  subscribeScanner,
  emitScannerReading,
  useBarcodeInput,
  startCameraScan,
  classifySymbology,
};

export default ScannerService;
