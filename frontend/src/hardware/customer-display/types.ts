/**
 * Customer display types — three transport paths share one driver
 * interface and the high-level `DisplayService` API.
 *
 * Spec: growth-to-100/requirements.md R3.9 (three paths), R3.11
 *       (item-level updates), design.md §3.6.
 */

export type DisplayTransportKind = 'serial' | 'bluetooth' | 'wifi';

export interface DisplayDescriptor {
  kind: DisplayTransportKind;
  id: string;
  label: string;
  /** Columns × rows for fixed-width LCD; e.g. {cols:20, rows:2}. */
  geometry?: { cols: number; rows: number };
  /** WiFi displays carry a target URL / IP. */
  endpoint?: string;
}

export interface DisplayState {
  line1: string;
  line2: string;
  /** Optional structured fields for rich (PWA) displays. */
  cartTotalMinor?: number;
  cartLastLine?: string;
  currency?: string;
}

export interface DisplayDriver {
  readonly descriptor: DisplayDescriptor;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  updateLine1(text: string): Promise<void>;
  updateLine2(text: string): Promise<void>;
  showTotal(amount: number, currency?: string): Promise<void>;
  /** Push a full structured state (used by PWA-based displays). */
  pushState(state: DisplayState): Promise<void>;
  clear(): Promise<void>;
}
