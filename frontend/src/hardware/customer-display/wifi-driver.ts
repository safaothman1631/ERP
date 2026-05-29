/**
 * WiFi customer display driver — smart TV or tablet on the local network
 * showing the slim PWA at `display.zoho-kurdish.iq/{terminal_id}`.
 *
 * Spec: growth-to-100/requirements.md R3.9(c), design.md §3.6.
 *
 * Same data path as the Bluetooth driver (Firestore-backed); the
 * distinction is presence (no BLE pairing involved — the TV is just
 * pointed at the URL). We optionally POST a "wake/refresh" to a local
 * REST endpoint exposed by some smart-TV apps.
 */
import type { DisplayDescriptor, DisplayDriver, DisplayState } from './types';

type DisplayStateWriter = (terminalId: string, state: DisplayState) => Promise<void>;

export class WifiCustomerDisplay implements DisplayDriver {
  readonly descriptor: DisplayDescriptor;
  private connected_ = false;
  private terminalId: string;
  private writer: DisplayStateWriter;
  private wakeUrl?: string;
  private state: DisplayState = { line1: '', line2: '' };

  constructor(opts: {
    endpoint: string;
    label: string;
    terminalId: string;
    writer: DisplayStateWriter;
    wakeUrl?: string;
  }) {
    this.descriptor = {
      kind: 'wifi',
      id: opts.endpoint,
      label: opts.label,
      endpoint: opts.endpoint,
    };
    this.terminalId = opts.terminalId;
    this.writer = opts.writer;
    this.wakeUrl = opts.wakeUrl;
  }

  async connect(): Promise<void> {
    this.connected_ = true;
    if (this.wakeUrl) {
      // Best-effort wake — ignore failures (TV may not expose REST).
      try {
        await fetch(this.wakeUrl, { method: 'POST', mode: 'no-cors' });
      } catch {
        // ignore.
      }
    }
    await this.pushState({ line1: 'Welcome', line2: 'POS connected' });
  }

  async disconnect(): Promise<void> {
    this.connected_ = false;
  }

  isConnected(): boolean {
    return this.connected_;
  }

  async updateLine1(text: string): Promise<void> {
    this.state = { ...this.state, line1: text };
    await this.pushState(this.state);
  }

  async updateLine2(text: string): Promise<void> {
    this.state = { ...this.state, line2: text };
    await this.pushState(this.state);
  }

  async showTotal(amount: number, currency = 'IQD'): Promise<void> {
    this.state = {
      ...this.state,
      cartTotalMinor: amount,
      currency,
      line2: `TOTAL: ${amount.toLocaleString('en-US')} ${currency}`,
    };
    await this.pushState(this.state);
  }

  async pushState(next: DisplayState): Promise<void> {
    this.state = { ...this.state, ...next };
    await this.writer(this.terminalId, this.state);
  }

  async clear(): Promise<void> {
    this.state = { line1: '', line2: '' };
    await this.writer(this.terminalId, this.state);
  }
}
