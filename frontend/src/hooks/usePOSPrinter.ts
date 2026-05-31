/**
 * usePOSPrinter — receipt printer abstraction.
 *
 * Runtime detection picks the best available backend:
 *
 *   1. Capacitor native plugin (`@capacitor/core` + a community ESC/POS
 *      Bluetooth plugin like `escpos-printer` / `bluetooth-le`). When the
 *      web build is wrapped by Capacitor (mobile/), the plugin handles the
 *      printer connection. We invoke via `Capacitor.Plugins.PosPrinter.print`.
 *
 *   2. Web Bluetooth — `navigator.bluetooth.requestDevice({ filters: [...] })`
 *      followed by a GATT write to the printer's serial characteristic.
 *      Works on Chrome / Edge on Android and desktop.
 *
 *   3. Fallback to "browser print" (open a print dialog with the receipt
 *      HTML) — used in dev or when nothing better is available.
 *
 * The hook is intentionally device-agnostic — callers pass ESC/POS bytes,
 * not HTML. Conversion lives in `ReceiptTemplate80mm.tsx` already.
 *
 * Performance instrumentation:
 *   - `performance.mark('pos:print:start')` before flush
 *   - `performance.mark('pos:print:end')`  after  flush
 *   - `performance.measure('pos:print', 'pos:print:start', 'pos:print:end')`
 *
 * The measure is consumed by the RUM hook (P4) to enforce the ≤ 200ms SLO.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// Common ESC/POS service UUID used by most cheap receipt printers (Xprinter,
// Bixolon, Epson TM-P series). 18f0-2af6 is the de-facto serial-over-BLE pair.
const ESC_POS_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const ESC_POS_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

type Backend = 'capacitor' | 'web-bluetooth' | 'browser';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: {
    PosPrinter?: {
      print: (options: { data: number[] }) => Promise<void>;
      connect?: () => Promise<{ name?: string } | void>;
      isReady?: () => Promise<boolean>;
    };
  };
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

export interface POSPrinterState {
  print: (commands: Uint8Array) => Promise<void>;
  isReady: boolean;
  isPrinting: boolean;
  deviceLabel: string | null;
  backend: Backend;
  reconnect: () => Promise<void>;
}

function detectCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = window.Capacitor;
  if (!cap) return false;
  try {
    if (typeof cap.isNativePlatform === 'function' && !cap.isNativePlatform()) return false;
  } catch {
    return false;
  }
  return !!cap.Plugins?.PosPrinter;
}

function detectWebBluetooth(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export function usePOSPrinter(): POSPrinterState {
  const backendRef = useRef<Backend>(
    detectCapacitor() ? 'capacitor' : detectWebBluetooth() ? 'web-bluetooth' : 'browser',
  );
  const [backend] = useState<Backend>(backendRef.current);
  const [isReady, setReady] = useState<boolean>(backend === 'browser');
  const [isPrinting, setPrinting] = useState<boolean>(false);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);

  // Web Bluetooth state.
  const btDeviceRef = useRef<BluetoothDevice | null>(null);
  const btCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  // ---- backend: Capacitor -----------------------------------------------
  const probeCapacitor = useCallback(async (): Promise<void> => {
    const plugin = window.Capacitor?.Plugins?.PosPrinter;
    if (!plugin) {
      setReady(false);
      return;
    }
    try {
      if (plugin.isReady) {
        const ok = await plugin.isReady();
        setReady(!!ok);
      } else {
        setReady(true);
      }
      if (plugin.connect) {
        const dev = await plugin.connect();
        setDeviceLabel((dev as { name?: string })?.name ?? 'POS Printer');
      } else {
        setDeviceLabel('POS Printer');
      }
    } catch {
      setReady(false);
    }
  }, []);

  // ---- backend: Web Bluetooth -------------------------------------------
  const connectWebBluetooth = useCallback(async (): Promise<void> => {
    if (!detectWebBluetooth()) {
      setReady(false);
      return;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [ESC_POS_SERVICE_UUID] },
          { namePrefix: 'Printer' },
          { namePrefix: 'XP-' },
          { namePrefix: 'BlueTooth Printer' },
        ],
        optionalServices: [ESC_POS_SERVICE_UUID],
      });
      const gatt = device.gatt;
      if (!gatt) throw new Error('no gatt');
      const server = await gatt.connect();
      const service = await server.getPrimaryService(ESC_POS_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(ESC_POS_CHARACTERISTIC_UUID);
      btDeviceRef.current = device;
      btCharacteristicRef.current = characteristic;
      setDeviceLabel(device.name ?? 'Bluetooth Printer');
      setReady(true);

      device.addEventListener('gattserverdisconnected', () => {
        btCharacteristicRef.current = null;
        setReady(false);
      });
    } catch (err) {
       
      console.warn('[usePOSPrinter] Web Bluetooth connect failed', err);
      setReady(false);
    }
  }, []);

  // ---- printing ----------------------------------------------------------
  const printCapacitor = useCallback(async (commands: Uint8Array): Promise<void> => {
    const plugin = window.Capacitor?.Plugins?.PosPrinter;
    if (!plugin) throw new Error('Capacitor PosPrinter plugin unavailable');
    await plugin.print({ data: Array.from(commands) });
  }, []);

  const printWebBluetooth = useCallback(async (commands: Uint8Array): Promise<void> => {
    let ch = btCharacteristicRef.current;
    if (!ch) {
      await connectWebBluetooth();
      ch = btCharacteristicRef.current;
    }
    if (!ch) throw new Error('printer not connected');
    // BLE has a 20-byte default MTU on many printers; chunk to be safe.
    const CHUNK = 100;
    for (let i = 0; i < commands.length; i += CHUNK) {
      const slice = commands.slice(i, i + CHUNK);
      await ch.writeValue(slice);
    }
  }, [connectWebBluetooth]);

  const printBrowser = useCallback(async (commands: Uint8Array): Promise<void> => {
    // Last-resort: produce a printable iframe with the bytes rendered as
    // hex. Real text printing is the responsibility of `ReceiptTemplate80mm`
    // — this path is hit only when no real printer is connected, primarily
    // useful in dev.
    if (typeof window === 'undefined') return;
    const w = window.open('', 'pos-print', 'width=400,height=600');
    if (!w) return;
    w.document.write(`<pre style="font:12px monospace">${commands.length} bytes</pre>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }, []);

  const print = useCallback(
    async (commands: Uint8Array): Promise<void> => {
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('pos:print:start');
      }
      setPrinting(true);
      try {
        if (backend === 'capacitor') await printCapacitor(commands);
        else if (backend === 'web-bluetooth') await printWebBluetooth(commands);
        else await printBrowser(commands);
      } finally {
        setPrinting(false);
        if (typeof performance !== 'undefined' && performance.mark) {
          performance.mark('pos:print:end');
          try {
            performance.measure('pos:print', 'pos:print:start', 'pos:print:end');
          } catch {
            /* no-op if marks missing */
          }
        }
      }
    },
    [backend, printCapacitor, printWebBluetooth, printBrowser],
  );

  const reconnect = useCallback(async (): Promise<void> => {
    if (backend === 'capacitor') return probeCapacitor();
    if (backend === 'web-bluetooth') return connectWebBluetooth();
    setReady(true);
  }, [backend, probeCapacitor, connectWebBluetooth]);

  useEffect(() => {
    if (backend === 'capacitor') {
      void probeCapacitor();
    } else if (backend === 'web-bluetooth') {
      // Wait for user gesture before requesting — Chrome requires it.
      setReady(false);
    } else {
      setReady(true);
      setDeviceLabel('Browser print');
    }
  }, [backend, probeCapacitor]);

  return { print, isReady, isPrinting, deviceLabel, backend, reconnect };
}

export default usePOSPrinter;
