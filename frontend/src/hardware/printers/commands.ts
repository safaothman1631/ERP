/**
 * High-level command helpers — turn user-facing intents (print a receipt,
 * cut paper, kick drawer, print a QR) into `PrintCommand[]` queues using
 * a supplied `Dialect`.
 *
 * The caller (POS UI, hardware service) feeds the queue into a `Transport`
 * via `printer-service.ts`. This module is pure (no I/O).
 */
import { concat } from './dialects/_baseline';
import type {
  BarcodeType,
  CashDrawerKick,
  CutMode,
  Dialect,
  PrintCommand,
  ReceiptModel,
} from './types';

// ───────────────────────── Receipt formatting helpers ────────────────────

const WESTERN_TO_ARABIC_INDIC: Record<string, string> = {
  '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
  '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
};

export function toArabicIndic(s: string): string {
  return s.replace(/[0-9]/g, (d) => WESTERN_TO_ARABIC_INDIC[d] ?? d);
}

export function formatIQD(minor: number, useArabicIndic = false): string {
  // IQD has no minor units in practice; minor === display.
  const groups = Math.floor(minor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const out = `${groups} د.ع`;
  return useArabicIndic ? toArabicIndic(out) : out;
}

/** Pad/truncate a string to fixed column width for monospace receipts. */
export function fitLine(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return s + ' '.repeat(width - s.length);
}

/**
 * Two-column line: label on left, value on right, padded to fill width.
 * If label is too long, it is truncated with an ellipsis.
 */
export function twoCol(label: string, value: string, width: number): string {
  const space = width - value.length - 1;
  const lab = label.length > space ? label.slice(0, space - 1) + '…' : label;
  return `${lab}${' '.repeat(Math.max(1, width - lab.length - value.length))}${value}`;
}

// IQD note denominations actually circulating in 2026.
export const IQD_DENOMS = [50000, 25000, 10000, 5000, 1000, 500, 250] as const;

/**
 * Break a change amount into IQD notes greedily.
 * Returns up to as many denominations as needed.
 */
export function breakdownIQD(amount: number): Array<{ noteValue: number; count: number }> {
  const out: Array<{ noteValue: number; count: number }> = [];
  let remaining = Math.max(0, Math.floor(amount));
  for (const note of IQD_DENOMS) {
    const count = Math.floor(remaining / note);
    if (count > 0) {
      out.push({ noteValue: note, count });
      remaining -= note * count;
    }
  }
  return out;
}

// ──────────────────────────── Public helpers ────────────────────────────

export function cutPaper(dialect: Dialect, mode: CutMode = 'full'): PrintCommand[] {
  return dialect.cut(mode);
}

export function kickDrawer(
  dialect: Dialect,
  pinOrKick?: 2 | 5 | CashDrawerKick,
): PrintCommand[] {
  if (pinOrKick === undefined) return dialect.kickDrawer();
  if (typeof pinOrKick === 'number') {
    return dialect.kickDrawer({
      ...dialect.defaultDrawerKick,
      pin: pinOrKick,
    });
  }
  return dialect.kickDrawer(pinOrKick);
}

export function printQR(data: string, dialect: Dialect, size = 6): PrintCommand[] {
  return dialect.qr(data, size);
}

export function printBarcode(data: string, type: BarcodeType, dialect: Dialect): PrintCommand[] {
  return dialect.barcode(data, type);
}

/**
 * Render a receipt model into a queue of print commands using the dialect.
 *
 * Width is taken from `dialect.width` (58 or 80mm). Characters per line:
 *   - 80mm → 48 cols (8 dots/mm × 80mm ÷ 12 dots/char ≈ 48).
 *   - 58mm → 32 cols (8 dots/mm × 58mm ÷ 12 dots/char ≈ 32, slight pad).
 */
export function printReceipt(model: ReceiptModel, dialect: Dialect): PrintCommand[] {
  const cols = dialect.width === 58 ? 32 : 48;
  const useArabicIndic = !!model.useArabicIndicDigits;
  const queue: PrintCommand[] = [];

  queue.push(...dialect.init());
  queue.push(...dialect.setCodePage(dialect.codePages[0] ?? 'CP437'));

  // Header — shop name centred, bold, double-size.
  queue.push(...dialect.text(model.shopName, { align: 'center', style: 'double_hw' }));
  if (model.shopAddress) {
    queue.push(...dialect.text(model.shopAddress, { align: 'center' }));
  }
  if (model.shopPhone) {
    queue.push(...dialect.text(model.shopPhone, { align: 'center' }));
  }
  if (model.shopVAT) {
    queue.push(...dialect.text(`VAT: ${model.shopVAT}`, { align: 'center' }));
  }
  queue.push(...dialect.text('-'.repeat(cols)));

  // Meta — receipt number + date.
  queue.push(...dialect.text(twoCol('Receipt:', model.receiptNumber, cols)));
  queue.push(...dialect.text(twoCol('Date:', new Date(model.issuedAt).toISOString().slice(0, 19).replace('T', ' '), cols)));
  if (model.issuedAtHijri) {
    queue.push(...dialect.text(twoCol('Hijri:', model.issuedAtHijri, cols)));
  }
  if (model.cashier) {
    queue.push(...dialect.text(twoCol('Cashier:', model.cashier, cols)));
  }
  if (model.terminalId) {
    queue.push(...dialect.text(twoCol('Terminal:', model.terminalId, cols)));
  }
  queue.push(...dialect.text('-'.repeat(cols)));

  // Items.
  for (const line of model.lines) {
    const lineTotal = line.qty * line.unitPriceMinor - (line.discountMinor ?? 0);
    queue.push(...dialect.text(fitLine(line.label, cols)));
    const qtyXprice = `${line.qty} x ${formatIQD(line.unitPriceMinor, useArabicIndic)}`;
    queue.push(...dialect.text(twoCol(`  ${qtyXprice}`, formatIQD(lineTotal, useArabicIndic), cols)));
    if (line.discountMinor && line.discountMinor > 0) {
      queue.push(...dialect.text(twoCol('  Discount', `-${formatIQD(line.discountMinor, useArabicIndic)}`, cols)));
    }
  }
  queue.push(...dialect.text('-'.repeat(cols)));

  // Totals.
  queue.push(...dialect.text(twoCol('Subtotal', formatIQD(model.subtotalMinor, useArabicIndic), cols)));
  for (const tax of model.taxes) {
    queue.push(...dialect.text(twoCol(tax.rateLabel, formatIQD(tax.amountMinor, useArabicIndic), cols)));
  }
  queue.push(...dialect.text(twoCol('TOTAL', formatIQD(model.totalMinor, useArabicIndic), cols), { style: 'bold' }));

  // Tendered / change.
  if (typeof model.tenderedMinor === 'number') {
    queue.push(...dialect.text(twoCol('Tendered', formatIQD(model.tenderedMinor, useArabicIndic), cols)));
  }
  if (typeof model.changeMinor === 'number' && model.changeMinor > 0) {
    queue.push(...dialect.text(twoCol('Change', formatIQD(model.changeMinor, useArabicIndic), cols)));
    const breakdown = model.changeDenominations ?? breakdownIQD(model.changeMinor);
    for (const d of breakdown) {
      queue.push(
        ...dialect.text(
          twoCol(`  ${d.count} x ${formatIQD(d.noteValue, useArabicIndic)}`, '', cols),
        ),
      );
    }
  }
  queue.push(...dialect.text('-'.repeat(cols)));

  // QR.
  if (model.qrPayload) {
    queue.push(...dialect.text('Scan for e-Fakhata:', { align: 'center' }));
    queue.push(...dialect.qr(model.qrPayload, 6));
  }

  // Footer.
  if (model.footer) {
    queue.push(...dialect.text(model.footer, { align: 'center' }));
  }
  queue.push(...dialect.text('Thank you / سوپاس / شكراً', { align: 'center' }));
  queue.push(...dialect.feed(3));
  queue.push(...dialect.cut('full'));

  return queue;
}

/**
 * Serialize a queue of PrintCommands into a single byte stream for
 * transports that prefer one big write (USB bulk endpoint, network).
 */
export function flattenCommands(commands: PrintCommand[]): Uint8Array {
  return concat(commands.map((c) => c.bytes));
}

/**
 * Build a human-readable trace for the test-print preview / troubleshooting log.
 */
export function debugTrace(commands: PrintCommand[]): string {
  return commands
    .map((c) => `[${c.bytes.length}B] ${c.label}${c.delayAfterMs ? ` (delay ${c.delayAfterMs}ms)` : ''}`)
    .join('\n');
}
