/**
 * Printer driver types — ESC/POS hardware abstraction layer.
 *
 * Spec: growth-to-100/design.md §3.1 (adapter pattern), §3.2 (registry),
 *       growth-to-100/requirements.md R3.1–R3.3, R3.10–R3.12.
 *
 * Three layers compose:
 *   1. Transport   — moves bytes (USB / Bluetooth / Network / Serial).
 *   2. Dialect     — translates high-level commands into vendor bytes.
 *   3. Receipt     — turns a ReceiptModel into a sequence of dialect calls.
 *
 * This file defines the contracts shared by all three layers. Each printer
 * profile in `dialects/` implements `Dialect`; the high-level helpers in
 * `commands.ts` accept any `Dialect` and produce a `PrintCommand[]`.
 */

// ───────────────────────── Dialect identifier ─────────────────────────

export type DialectId =
  | 'escpos-epson'
  | 'escpos-xprinter'
  | 'escpos-bixolon'
  | 'escpos-generic-58'
  | 'escpos-generic-80'
  | 'escpos-unknown';

export type PaperWidthMm = 58 | 80;

export type CutMode = 'full' | 'partial' | 'none';

/** Pin number on the RJ-12 cash-drawer connector. */
export type DrawerPin = 2 | 5;

export interface CashDrawerKick {
  /** Pin to fire — 2 (alternate) or 5 (standard). */
  pin: DrawerPin;
  /**
   * Pulse-on time in ms — actual byte sent is value * 2 (per ESC/POS).
   * Typical: 50–100 ms.
   */
  pulseOnMs: number;
  /**
   * Pulse-off time in ms — silence after pulse, byte = value * 2.
   * Typical: 150–200 ms.
   */
  pulseOffMs: number;
}

/** Symbology supported by ESC/POS GS k. */
export type BarcodeType =
  | 'UPC_A'
  | 'UPC_E'
  | 'EAN13'
  | 'EAN8'
  | 'CODE39'
  | 'ITF'
  | 'CODABAR'
  | 'CODE128';

export type TextAlign = 'left' | 'center' | 'right';
export type TextStyle = 'normal' | 'bold' | 'double_h' | 'double_w' | 'double_hw';

export interface TextOptions {
  align?: TextAlign;
  style?: TextStyle;
  underline?: boolean;
  feedAfter?: number;
}

/**
 * Single low-level printer command — produced by a `Dialect` and queued
 * by the printer service. The `bytes` field is the actual wire payload;
 * the other fields are diagnostic so we can render a human-readable trace
 * in the test-print preview and the troubleshooting log.
 */
export interface PrintCommand {
  /** Wire bytes to send. */
  bytes: Uint8Array;
  /** Human label e.g. "ESC @ init" / "GS V 66 0 full cut". */
  label: string;
  /**
   * Suggested delay after this command before the next, in ms.
   * Some printers need 50–200 ms after cut / drawer commands to settle.
   */
  delayAfterMs?: number;
}

// ───────────────────────────── Dialect ──────────────────────────────

/**
 * Vendor profile producing ESC/POS byte sequences.
 *
 * Each method MUST return one or more `PrintCommand`s. Methods never block,
 * never touch I/O — they are pure byte generators. The transport layer
 * concatenates and writes them.
 */
export interface Dialect {
  /** Stable identifier for persistence + telemetry. */
  readonly id: DialectId;
  /** Vendor-display name, e.g. "Epson TM-T20III". */
  readonly displayName: string;
  /** Default paper width — 58 or 80. */
  readonly width: PaperWidthMm;
  /**
   * Code pages this printer is known to support. The receipt renderer
   * picks one that covers the text (Arabic / Kurdish needs CP864 or UTF-8
   * if firmware ≥ a known version).
   */
  readonly codePages: ReadonlyArray<string>;
  /** Default drawer kick used when the operator has not customised. */
  readonly defaultDrawerKick: CashDrawerKick;
  /** Vendor identifier bytes returned by GS I 1, captured during pairing. */
  readonly knownIdentifiers?: ReadonlyArray<Uint8Array>;

  // --- High-level command generators ---
  init(): PrintCommand[];
  setCodePage(codePage: string): PrintCommand[];
  text(s: string, opts?: TextOptions): PrintCommand[];
  feed(lines: number): PrintCommand[];
  cut(mode: CutMode): PrintCommand[];
  barcode(data: string, type: BarcodeType): PrintCommand[];
  qr(data: string, size?: number): PrintCommand[];
  /** Send raw bytes (for vendor-specific extensions / debugging). */
  raw(bytes: Uint8Array, label?: string): PrintCommand[];
  /**
   * Cash-drawer kick command — pin & pulse override per call.
   * Default pin is in `defaultDrawerKick`.
   */
  kickDrawer(kick?: CashDrawerKick): PrintCommand[];
}

// ───────────────────────────── Transport ────────────────────────────

export type TransportKind = 'bluetooth' | 'usb' | 'serial' | 'network' | 'native-ble';

export interface TransportDescriptor {
  kind: TransportKind;
  /** Stable id (BLE MAC, USB vendor:product:serial, IP:port). */
  id: string;
  /** Display label (printer model + last-4 of mac, etc.). */
  label: string;
  /** Optional RSSI for BLE / WiFi. */
  rssi?: number;
  /** Detected paper width if announced (BLE name often contains "58"/"80"). */
  hintedWidth?: PaperWidthMm;
}

export interface Transport {
  readonly descriptor: TransportDescriptor;
  open(): Promise<void>;
  close(): Promise<void>;
  isOpen(): boolean;
  /** Write a chunk. Implementations chunk for BLE MTU limits internally. */
  write(bytes: Uint8Array): Promise<void>;
  /**
   * Optional read for dialect detection. Resolves with the next response
   * blob within `timeoutMs`. If unsupported, returns null.
   */
  read?(timeoutMs: number): Promise<Uint8Array | null>;
}

// ───────────────────────────── Receipt model ────────────────────────

export interface ReceiptLine {
  /** Item label (truncated by renderer to width). */
  label: string;
  /** Quantity. */
  qty: number;
  /** Unit price in minor units (IQD has no minor — value == display). */
  unitPriceMinor: number;
  /** Optional discount in minor units. */
  discountMinor?: number;
  /** Optional tax-rate label for the line summary. */
  taxLabel?: string;
}

export interface ReceiptTaxBreakdown {
  rateLabel: string;
  amountMinor: number;
}

export interface ReceiptDenomination {
  /** IQD note denomination (250 / 500 / 1000 / 5000 / 10000 / 25000 / 50000). */
  noteValue: number;
  count: number;
}

export interface ReceiptModel {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  shopVAT?: string;
  cashier?: string;
  terminalId?: string;
  receiptNumber: string;
  /** ISO 8601 UTC. */
  issuedAt: string;
  /** Optional Hijri equivalent. */
  issuedAtHijri?: string;
  /** Currency code — always IQD for Iraq, but kept open. */
  currency: 'IQD' | 'USD' | string;
  lines: ReceiptLine[];
  subtotalMinor: number;
  taxes: ReceiptTaxBreakdown[];
  totalMinor: number;
  tenderedMinor?: number;
  changeMinor?: number;
  changeDenominations?: ReceiptDenomination[];
  /** Free-text footer (loyalty, thanks-message). */
  footer?: string;
  /** Optional QR payload (e.g. e-Fakhata QR string). */
  qrPayload?: string;
  /** Optional logo (PNG dataURL, monochrome already rendered). */
  logoPngDataUrl?: string;
  /** Render in Arabic-Indic digits if true. */
  useArabicIndicDigits?: boolean;
}

// ───────────────────────────── Status types ─────────────────────────

export interface PrinterStatus {
  connected: boolean;
  paperOut?: boolean;
  coverOpen?: boolean;
  drawerOpen?: boolean;
  errorState?: string;
}

export interface TestPrintResult {
  startedAt: string;
  durationMs: number;
  commandsSent: number;
  bytesSent: number;
  cutVerified?: boolean;
  drawerKicked?: boolean;
  notes?: string;
}
