/**
 * Serial (RS-232 / USB-serial) customer display driver — VFD-style pole.
 *
 * Spec: growth-to-100/design.md §3.6, T-G.3.15.
 *
 * Targets common 20×2 character VFDs (e.g. Bematech LD-220, Posiflex
 * PD-2200, Logic Controls PD-3000, generic "VFD-220"). These all share
 * the same basic command set derived from Epson DM-D110:
 *
 *   - ESC @           — reset / clear.
 *   - ESC l n m       — move cursor to column n, row m.
 *   - ESC R n         — international charset (n=0 USA, n=11 Latin Arabic).
 *   - ESC W 1 / 0     — overwrite mode.
 *   - Plain text bytes are rendered at the cursor.
 *   - 0x0c            — clear display.
 *
 * Connects via Web Serial (Chrome/Edge desktop) — Capacitor-on-Android
 * does not expose serial-over-USB to the WebView, so this path is desktop
 * only. On Capacitor we expect the LCD to ship with a BLE bridge module
 * and use `bluetooth-driver.ts` instead.
 */
import type { DisplayDescriptor, DisplayDriver, DisplayState } from './types';

export class SerialCustomerDisplay implements DisplayDriver {
  readonly descriptor: DisplayDescriptor;
  private port: any;
  private writer: any = null;
  private connected_ = false;
  private cols: number;
  private rows: number;

  constructor(port: any, opts?: { cols?: number; rows?: number; label?: string }) {
    this.port = port;
    this.cols = opts?.cols ?? 20;
    this.rows = opts?.rows ?? 2;
    const info = port.getInfo?.() ?? {};
    this.descriptor = {
      kind: 'serial',
      id: `${info.usbVendorId ?? '?'}:${info.usbProductId ?? '?'}`,
      label: opts?.label ?? `LCD pole ${this.cols}x${this.rows}`,
      geometry: { cols: this.cols, rows: this.rows },
    };
  }

  async connect(): Promise<void> {
    await this.port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
    this.writer = this.port.writable.getWriter();
    // Reset.
    await this.write(Uint8Array.from([0x1b, 0x40]));
    this.connected_ = true;
  }

  async disconnect(): Promise<void> {
    try {
      await this.clear();
      this.writer?.releaseLock?.();
      await this.port.close?.();
    } finally {
      this.connected_ = false;
    }
  }

  isConnected(): boolean {
    return this.connected_;
  }

  private async write(b: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error('Not connected');
    await this.writer.write(b);
  }

  private async moveCursor(col: number, row: number): Promise<void> {
    // ESC l n m — n=column (1-based), m=row (1-based).
    await this.write(Uint8Array.from([0x1b, 0x6c, col + 1, row + 1]));
  }

  private fit(text: string): string {
    const t = text.replace(/[\n\r]/g, ' ');
    if (t.length >= this.cols) return t.slice(0, this.cols);
    return t + ' '.repeat(this.cols - t.length);
  }

  async updateLine1(text: string): Promise<void> {
    await this.moveCursor(0, 0);
    await this.write(Uint8Array.from(this.fit(text), (c) => c.charCodeAt(0) & 0xff));
  }

  async updateLine2(text: string): Promise<void> {
    if (this.rows < 2) return;
    await this.moveCursor(0, 1);
    await this.write(Uint8Array.from(this.fit(text), (c) => c.charCodeAt(0) & 0xff));
  }

  async showTotal(amount: number, currency = 'IQD'): Promise<void> {
    const display = `${amount.toLocaleString('en-US')} ${currency}`;
    await this.updateLine2(`TOTAL: ${display}`);
  }

  async pushState(state: DisplayState): Promise<void> {
    await this.updateLine1(state.line1 || state.cartLastLine || '');
    if (typeof state.cartTotalMinor === 'number') {
      await this.showTotal(state.cartTotalMinor, state.currency);
    } else {
      await this.updateLine2(state.line2 || '');
    }
  }

  async clear(): Promise<void> {
    await this.write(Uint8Array.from([0x0c]));
  }
}

export async function pairSerialDisplay(): Promise<SerialCustomerDisplay | null> {
  const navAny: any = navigator;
  if (!navAny?.serial) return null;
  try {
    const port = await navAny.serial.requestPort({});
    return new SerialCustomerDisplay(port);
  } catch {
    return null;
  }
}
