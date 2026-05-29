/**
 * Printer service — orchestrates discovery, connection, dialect detection,
 * and printing across all transports.
 *
 * Transport resolution priority:
 *   1. Capacitor native BLE bridge   (`mobile/src/bridge/printer.ts`)
 *   2. Web Bluetooth                  (Chrome / Edge desktop)
 *   3. WebUSB                         (Chrome / Edge desktop, USB cable)
 *   4. Web Serial                     (Chrome / Edge desktop, RS-232 over USB-adapter)
 *   5. Browser-print PDF fallback     (last resort — opens OS print dialog)
 *
 * Each transport implements the `Transport` interface from `types.ts`.
 * The service hides transport choice from the caller — pass a
 * `TransportDescriptor` (obtained via `discover()`), and the service
 * picks the right implementation.
 */
import { buildIdentifierProbe, detectDialect } from './detection';
import { ALL_DIALECTS, getDialectById } from './dialects';
import { flattenCommands, printReceipt } from './commands';
import type {
  Dialect,
  DialectId,
  PrintCommand,
  PrinterStatus,
  ReceiptModel,
  TestPrintResult,
  Transport,
  TransportDescriptor,
  TransportKind,
} from './types';

// ───────────────────────── Capabilities ──────────────────────────────────

export interface PrinterServiceCapabilities {
  hasNativeBle: boolean;
  hasWebBluetooth: boolean;
  hasWebUsb: boolean;
  hasWebSerial: boolean;
  /** Browser-print is always available. */
  hasBrowserPrint: true;
}

export function detectCapabilities(): PrinterServiceCapabilities {
  const w = typeof window !== 'undefined' ? (window as any) : {};
  const cap = w?.Capacitor;
  const isNative = cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
  return {
    hasNativeBle: !!isNative,
    hasWebBluetooth: !!(w.navigator && (w.navigator as any).bluetooth),
    hasWebUsb: !!(w.navigator && (w.navigator as any).usb),
    hasWebSerial: !!(w.navigator && (w.navigator as any).serial),
    hasBrowserPrint: true,
  };
}

// ───────────────────────── Web Bluetooth transport ───────────────────────

const PRINTER_NAME_REGEX = /printer|pos|xp-?\d+|rongta|goojprt|sunmi|epson|bixolon|srp/i;
const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_CHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

/** GATT characteristics commonly used by ESC/POS BT printers, in priority order. */
const PRINTER_SERVICES: ReadonlyArray<string> = [
  NUS_SERVICE,
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic SPP-over-BLE
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip RN4870
];

class WebBluetoothTransport implements Transport {
  readonly descriptor: TransportDescriptor;
  private device: any | null = null;
  private characteristic: any | null = null;
  private readCharacteristic: any | null = null;
  private open_ = false;

  constructor(device: any) {
    this.device = device;
    this.descriptor = {
      kind: 'bluetooth',
      id: device.id ?? 'webble',
      label: device.name ?? 'Bluetooth printer',
    };
  }

  async open(): Promise<void> {
    if (!this.device) throw new Error('No BLE device');
    const server = await this.device.gatt.connect();
    let service: any = null;
    for (const uuid of PRINTER_SERVICES) {
      try {
        service = await server.getPrimaryService(uuid);
        if (service) break;
      } catch {
        // try next.
      }
    }
    if (!service) throw new Error('No printer GATT service found');
    try {
      this.characteristic = await service.getCharacteristic(NUS_TX_CHAR);
    } catch {
      const chars = await service.getCharacteristics();
      this.characteristic = chars.find((c: any) => c.properties?.writeWithoutResponse || c.properties?.write) ?? chars[0];
    }
    try {
      this.readCharacteristic = await service.getCharacteristic(NUS_RX_CHAR);
    } catch {
      this.readCharacteristic = null;
    }
    this.open_ = true;
  }

  async close(): Promise<void> {
    try {
      this.device?.gatt?.disconnect?.();
    } finally {
      this.open_ = false;
    }
  }

  isOpen(): boolean {
    return this.open_;
  }

  async write(b: Uint8Array): Promise<void> {
    if (!this.characteristic) throw new Error('Not connected');
    // Chunk for BLE MTU (default 20–185 bytes).
    const CHUNK = 180;
    for (let i = 0; i < b.length; i += CHUNK) {
      const slice = b.slice(i, i + CHUNK);
      if (this.characteristic.writeValueWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(slice);
      } else {
        await this.characteristic.writeValue(slice);
      }
    }
  }

  async read(timeoutMs: number): Promise<Uint8Array | null> {
    if (!this.readCharacteristic) return null;
    return new Promise((resolve) => {
      let done = false;
      const handler = (ev: any) => {
        if (done) return;
        done = true;
        try {
          this.readCharacteristic.removeEventListener('characteristicvaluechanged', handler);
        } catch {
          // ignore.
        }
        const v: DataView = ev.target.value;
        resolve(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)));
      };
      try {
        this.readCharacteristic.addEventListener('characteristicvaluechanged', handler);
        this.readCharacteristic.startNotifications();
      } catch {
        resolve(null);
        return;
      }
      setTimeout(() => {
        if (!done) {
          done = true;
          try {
            this.readCharacteristic.removeEventListener('characteristicvaluechanged', handler);
          } catch {
            // ignore.
          }
          resolve(null);
        }
      }, timeoutMs);
    });
  }
}

// ───────────────────────── WebUSB transport ──────────────────────────────

class WebUsbTransport implements Transport {
  readonly descriptor: TransportDescriptor;
  private device: any;
  private endpointOut: number | null = null;
  private endpointIn: number | null = null;
  private interfaceNum: number | null = null;
  private open_ = false;

  constructor(device: any) {
    this.device = device;
    this.descriptor = {
      kind: 'usb',
      id: `${device.vendorId.toString(16)}:${device.productId.toString(16)}:${device.serialNumber ?? 'unknown'}`,
      label: device.productName ?? `USB ${device.vendorId.toString(16)}:${device.productId.toString(16)}`,
    };
  }

  async open(): Promise<void> {
    await this.device.open();
    if (this.device.configuration === null) await this.device.selectConfiguration(1);
    const iface = this.device.configuration.interfaces[0];
    this.interfaceNum = iface.interfaceNumber;
    await this.device.claimInterface(this.interfaceNum);
    const alt = iface.alternates[0];
    for (const ep of alt.endpoints) {
      if (ep.direction === 'out' && this.endpointOut === null) this.endpointOut = ep.endpointNumber;
      if (ep.direction === 'in' && this.endpointIn === null) this.endpointIn = ep.endpointNumber;
    }
    if (this.endpointOut === null) throw new Error('USB printer has no OUT endpoint');
    this.open_ = true;
  }

  async close(): Promise<void> {
    try {
      if (this.interfaceNum !== null) await this.device.releaseInterface(this.interfaceNum);
      await this.device.close();
    } finally {
      this.open_ = false;
    }
  }

  isOpen(): boolean {
    return this.open_;
  }

  async write(b: Uint8Array): Promise<void> {
    if (this.endpointOut === null) throw new Error('Not connected');
    await this.device.transferOut(this.endpointOut, b);
  }

  async read(timeoutMs: number): Promise<Uint8Array | null> {
    if (this.endpointIn === null) return null;
    const result = await Promise.race<any>([
      this.device.transferIn(this.endpointIn, 64),
      new Promise((res) => setTimeout(() => res(null), timeoutMs)),
    ]);
    if (!result || !result.data) return null;
    const data: DataView = result.data;
    return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }
}

// ───────────────────────── Web Serial transport ──────────────────────────

class WebSerialTransport implements Transport {
  readonly descriptor: TransportDescriptor;
  private port: any;
  private writer: any = null;
  private reader: any = null;
  private open_ = false;

  constructor(port: any) {
    this.port = port;
    const info = port.getInfo?.() ?? {};
    this.descriptor = {
      kind: 'serial',
      id: `${info.usbVendorId ?? '?'}:${info.usbProductId ?? '?'}`,
      label: `Serial ${info.usbVendorId?.toString(16) ?? '?'}:${info.usbProductId?.toString(16) ?? '?'}`,
    };
  }

  async open(): Promise<void> {
    await this.port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
    this.writer = this.port.writable?.getWriter();
    this.reader = this.port.readable?.getReader();
    this.open_ = true;
  }

  async close(): Promise<void> {
    try {
      this.writer?.releaseLock?.();
      this.reader?.releaseLock?.();
      await this.port.close();
    } finally {
      this.open_ = false;
    }
  }

  isOpen(): boolean {
    return this.open_;
  }

  async write(b: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error('Not connected');
    await this.writer.write(b);
  }

  async read(timeoutMs: number): Promise<Uint8Array | null> {
    if (!this.reader) return null;
    const race = await Promise.race<any>([
      this.reader.read(),
      new Promise((res) => setTimeout(() => res({ done: true }), timeoutMs)),
    ]);
    if (race.done || !race.value) return null;
    return race.value as Uint8Array;
  }
}

// ───────────────────────── Native BLE transport (Capacitor) ──────────────

class NativeBleTransport implements Transport {
  readonly descriptor: TransportDescriptor;
  private bridge: any;
  private open_ = false;

  constructor(bridge: any, device: { id: string; name: string }) {
    this.bridge = bridge;
    this.descriptor = {
      kind: 'native-ble',
      id: device.id,
      label: device.name,
    };
  }

  async open(): Promise<void> {
    await this.bridge.connect(this.descriptor.id);
    this.open_ = true;
  }

  async close(): Promise<void> {
    try {
      await this.bridge.disconnect?.();
    } finally {
      this.open_ = false;
    }
  }

  isOpen(): boolean {
    return this.open_;
  }

  async write(b: Uint8Array): Promise<void> {
    // The native bridge expects base64-encoded ESC/POS — encode here.
    const bin = String.fromCharCode(...b);
    const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(b).toString('base64');
    await this.bridge.print({ escposBase64: b64 });
  }
}

// ───────────────────────── Discovery ─────────────────────────────────────

export async function discoverBluetooth(): Promise<TransportDescriptor[]> {
  const caps = detectCapabilities();
  if (!caps.hasWebBluetooth) return [];
  const navAny: any = navigator;
  try {
    const device = await navAny.bluetooth.requestDevice({
      filters: PRINTER_SERVICES.map((u) => ({ services: [u] })),
      optionalServices: PRINTER_SERVICES.slice(),
    });
    return [
      {
        kind: 'bluetooth',
        id: device.id ?? 'webble-pending',
        label: device.name ?? 'BLE printer',
      },
    ];
  } catch {
    return [];
  }
}

export async function discoverUsb(): Promise<TransportDescriptor[]> {
  const caps = detectCapabilities();
  if (!caps.hasWebUsb) return [];
  const navAny: any = navigator;
  try {
    const device = await navAny.usb.requestDevice({
      filters: [
        { vendorId: 0x04b8 }, // Epson
        { vendorId: 0x0519 }, // Star Micronics
        { vendorId: 0x0fe6 }, // ICS Advent / Bixolon
        { vendorId: 0x0416 }, // Winbond (Xprinter uses sometimes)
        { vendorId: 0x1659 }, // Posiflex
      ],
    });
    return [
      {
        kind: 'usb',
        id: `${device.vendorId.toString(16)}:${device.productId.toString(16)}`,
        label: device.productName ?? 'USB printer',
      },
    ];
  } catch {
    return [];
  }
}

// ───────────────────────── Connection record ─────────────────────────────

export interface ActivePrinter {
  transport: Transport;
  dialect: Dialect;
}

let active: ActivePrinter | null = null;
let pendingHandles: Map<string, any> = new Map(); // descriptor.id → underlying device handle

export function getActivePrinter(): ActivePrinter | null {
  return active;
}

/**
 * Establish a connection given a transport descriptor + optional dialect id.
 * If dialect id is omitted, runs the detection probe and picks the best fit.
 */
export async function connect(
  descriptor: TransportDescriptor,
  dialectId?: DialectId,
): Promise<ActivePrinter> {
  if (active && active.transport.isOpen()) {
    await active.transport.close();
  }
  const transport = await buildTransport(descriptor);
  await transport.open();

  let dialect: Dialect;
  if (dialectId) {
    dialect = getDialectById(dialectId);
  } else {
    // Probe.
    let identifier: Uint8Array | null = null;
    try {
      if (transport.read) {
        await transport.write(buildIdentifierProbe());
        identifier = await transport.read(800);
      }
    } catch {
      identifier = null;
    }
    const det = detectDialect(descriptor.label, identifier);
    dialect = det.dialect;
  }
  active = { transport, dialect };
  return active;
}

async function buildTransport(descriptor: TransportDescriptor): Promise<Transport> {
  switch (descriptor.kind) {
    case 'bluetooth': {
      const navAny: any = navigator;
      const device =
        pendingHandles.get(descriptor.id) ??
        (await navAny.bluetooth.requestDevice({
          filters: PRINTER_SERVICES.map((u) => ({ services: [u] })),
          optionalServices: PRINTER_SERVICES.slice(),
        }));
      pendingHandles.set(descriptor.id, device);
      return new WebBluetoothTransport(device);
    }
    case 'usb': {
      const navAny: any = navigator;
      const device =
        pendingHandles.get(descriptor.id) ??
        (await navAny.usb.requestDevice({ filters: [] }));
      pendingHandles.set(descriptor.id, device);
      return new WebUsbTransport(device);
    }
    case 'serial': {
      const navAny: any = navigator;
      const port = pendingHandles.get(descriptor.id) ?? (await navAny.serial.requestPort({}));
      pendingHandles.set(descriptor.id, port);
      return new WebSerialTransport(port);
    }
    case 'native-ble': {
      // @vite-ignore: the native bridge lives in the sibling `mobile/` package
      // (Capacitor-only). On web this import simply rejects → caught → null →
      // the caller falls back to Web Bluetooth. The marker stops the web bundler
      // from trying to resolve `@capacitor/core` at build time.
      const bridge = await import(/* @vite-ignore */ '../../../../mobile/src/bridge/printer').then((m: any) => m.nativePrinter ?? m.default).catch(() => null);
      if (!bridge) throw new Error('Native printer bridge not available');
      return new NativeBleTransport(bridge, { id: descriptor.id, label: descriptor.label } as any);
    }
    case 'network':
      throw new Error('Network transport requires Capacitor socket plugin — not yet wired');
    default:
      throw new Error(`Unknown transport kind: ${(descriptor as any).kind}`);
  }
}

// ───────────────────────── Print operations ──────────────────────────────

export async function sendCommands(commands: PrintCommand[]): Promise<{ bytesSent: number; durationMs: number }> {
  if (!active || !active.transport.isOpen()) {
    throw new Error('No printer connected');
  }
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let bytesSent = 0;
  for (const cmd of commands) {
    await active.transport.write(cmd.bytes);
    bytesSent += cmd.bytes.length;
    if (cmd.delayAfterMs && cmd.delayAfterMs > 0) {
      await new Promise((r) => setTimeout(r, cmd.delayAfterMs));
    }
  }
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { bytesSent, durationMs: t1 - t0 };
}

export async function printReceiptModel(model: ReceiptModel): Promise<{ bytesSent: number; durationMs: number }> {
  if (!active) throw new Error('No printer connected');
  const queue = printReceipt(model, active.dialect);
  return sendCommands(queue);
}

/**
 * Test-print — generates a deterministic page covering text styles, a
 * barcode, a QR, then cuts.
 */
export async function testPrint(options?: { skipCut?: boolean; kickDrawer?: boolean }): Promise<TestPrintResult> {
  if (!active) throw new Error('No printer connected');
  const d = active.dialect;
  const cols = d.width === 58 ? 32 : 48;
  const startedAt = new Date().toISOString();
  const queue: PrintCommand[] = [
    ...d.init(),
    ...d.setCodePage(d.codePages[0] ?? 'CP437'),
    ...d.text('TEST PRINT', { align: 'center', style: 'double_hw' }),
    ...d.text(d.displayName, { align: 'center' }),
    ...d.text('-'.repeat(cols)),
    ...d.text('Normal text — the quick brown fox.'),
    ...d.text('Bold text', { style: 'bold' }),
    ...d.text('Double width', { style: 'double_w' }),
    ...d.text('Double height', { style: 'double_h' }),
    ...d.text('سۆرانی / Arabic — اختبار طباعة'),
    ...d.text('-'.repeat(cols)),
    ...d.barcode('1234567890123', 'EAN13'),
    ...d.qr('https://zoho-kurdish.iq/test-print', 6),
    ...d.feed(3),
  ];
  if (!options?.skipCut) {
    queue.push(...d.cut('full'));
  }
  if (options?.kickDrawer) {
    queue.push(...d.kickDrawer());
  }
  const res = await sendCommands(queue);
  return {
    startedAt,
    durationMs: res.durationMs,
    commandsSent: queue.length,
    bytesSent: res.bytesSent,
    drawerKicked: !!options?.kickDrawer,
  };
}

export async function getStatus(): Promise<PrinterStatus> {
  if (!active || !active.transport.isOpen()) return { connected: false };
  return { connected: true };
}

export async function disconnect(): Promise<void> {
  if (active) {
    try {
      await active.transport.close();
    } finally {
      active = null;
    }
  }
}

/** Last-resort fallback — render via browser print dialog. */
export function browserPrintFallback(html: string): void {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  setTimeout(() => w.close(), 1000);
}

export const PrinterService = {
  detectCapabilities,
  discoverBluetooth,
  discoverUsb,
  connect,
  disconnect,
  sendCommands,
  printReceiptModel,
  testPrint,
  getStatus,
  getActivePrinter,
  browserPrintFallback,
  ALL_DIALECTS,
};

export default PrinterService;

// Convenience re-exports for callers that want them in one place.
export type {
  Dialect,
  DialectId,
  PrintCommand,
  PrinterStatus,
  ReceiptModel,
  TestPrintResult,
  Transport,
  TransportDescriptor,
  TransportKind,
};
