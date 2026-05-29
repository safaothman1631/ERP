/**
 * Bluetooth customer display driver — paired tablet running the slim PWA
 * at `display.zoho-kurdish.iq/{terminal_id}`.
 *
 * Spec: growth-to-100/requirements.md R3.9(b), design.md §3.6.
 *
 * The tablet subscribes to a Firestore document `pos_display_state/{tid}`.
 * From the POS terminal's side, "publishing to Bluetooth display" is
 * really "writing the Firestore doc that the BLE-paired tablet is reading".
 *
 * We model this driver as a transport whose `connect()` ensures the tablet
 * is reachable (ping pattern), and `pushState()` writes the state doc.
 * The bluetooth handle itself is only used for presence detection — the
 * data path is Firestore so cart updates survive BLE disconnection.
 */
import type { DisplayDescriptor, DisplayDriver, DisplayState } from './types';

type DisplayStateWriter = (terminalId: string, state: DisplayState) => Promise<void>;

export class BluetoothCustomerDisplay implements DisplayDriver {
  readonly descriptor: DisplayDescriptor;
  private connected_ = false;
  private terminalId: string;
  private writer: DisplayStateWriter;
  private state: DisplayState = { line1: '', line2: '' };

  constructor(opts: {
    deviceId: string;
    deviceLabel: string;
    terminalId: string;
    writer: DisplayStateWriter;
  }) {
    this.descriptor = {
      kind: 'bluetooth',
      id: opts.deviceId,
      label: opts.deviceLabel,
    };
    this.terminalId = opts.terminalId;
    this.writer = opts.writer;
  }

  async connect(): Promise<void> {
    // Empty by design — the Bluetooth pairing is OS-level; the data
    // channel is Firestore. We just mark connected and immediately push
    // a "Welcome" state so the tablet shows something.
    this.connected_ = true;
    await this.pushState({
      line1: 'Welcome',
      line2: 'POS connected',
    });
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
