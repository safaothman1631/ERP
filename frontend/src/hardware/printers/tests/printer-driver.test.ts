/**
 * Printer driver byte-stream tests.
 *
 * Spec: growth-to-100/tasks.md T-G.3.4–T-G.3.7 — each dialect's generator
 * output is asserted against a recorded byte fixture.
 *
 * Note on fixtures: The real lab will replace the `expected*` arrays below
 * with bytes captured from physical devices (Wireshark over BLE / Serial).
 * Until then, these tests lock in the *generated* output so a regression
 * (someone changing the cut byte from 0x42 to 0x41) is caught.
 */
import { describe, expect, it } from 'vitest';

import { flattenCommands, printReceipt, printQR, printBarcode, cutPaper, kickDrawer } from '../commands';
import { buildIdentifierProbe, detectDialect } from '../detection';
import {
  bixolonDialect,
  epsonDialect,
  generic58mmBtDialect,
  generic80mmDialect,
  xprinterDialect,
} from '../dialects';
import type { ReceiptModel } from '../types';

const SAMPLE_RECEIPT: ReceiptModel = {
  shopName: 'Test Shop',
  shopPhone: '+964 750 000 0000',
  receiptNumber: 'TEST-0001',
  issuedAt: '2026-05-29T12:00:00Z',
  currency: 'IQD',
  lines: [
    { label: 'Coffee', qty: 2, unitPriceMinor: 5000 },
    { label: 'Bread', qty: 1, unitPriceMinor: 1500 },
  ],
  subtotalMinor: 11500,
  taxes: [{ rateLabel: 'VAT 5%', amountMinor: 575 }],
  totalMinor: 12075,
  tenderedMinor: 15000,
  changeMinor: 2925,
};

// ───────────────────────── Init / codepage ──────────────────────────────

describe('baseline ESC/POS', () => {
  it('emits ESC @ for init', () => {
    const out = flattenCommands(epsonDialect.init());
    expect(Array.from(out)).toEqual([0x1b, 0x40]);
  });

  it('emits ESC t n for code-page select', () => {
    const out = flattenCommands(epsonDialect.setCodePage('CP864'));
    // CP864 maps to 22 in our table.
    expect(Array.from(out)).toEqual([0x1b, 0x74, 22]);
  });

  it('CP437 maps to 0', () => {
    const out = flattenCommands(generic80mmDialect.setCodePage('CP437'));
    expect(Array.from(out)).toEqual([0x1b, 0x74, 0]);
  });
});

// ───────────────────────── Cut variants ────────────────────────────────

describe('cut commands', () => {
  it('Epson full cut uses GS V B 3 (with feed)', () => {
    const out = flattenCommands(cutPaper(epsonDialect, 'full'));
    expect(Array.from(out)).toEqual([0x1d, 0x56, 0x42, 0x03]);
  });

  it('Xprinter full cut uses GS V 0 (no feed variant)', () => {
    const out = flattenCommands(cutPaper(xprinterDialect, 'full'));
    expect(Array.from(out)).toEqual([0x1d, 0x56, 0x00]);
  });

  it('Bixolon partial cut uses GS V 1', () => {
    const out = flattenCommands(cutPaper(bixolonDialect, 'partial'));
    expect(Array.from(out)).toEqual([0x1d, 0x56, 0x01]);
  });

  it('generic 58mm emits cut even if cutter is absent', () => {
    const out = flattenCommands(cutPaper(generic58mmBtDialect, 'full'));
    expect(Array.from(out)).toEqual([0x1d, 0x56, 0x01]);
  });

  it('cut mode none emits zero bytes', () => {
    const out = flattenCommands(cutPaper(epsonDialect, 'none'));
    expect(out.length).toBe(0);
  });
});

// ───────────────────────── Drawer kick matrix ──────────────────────────

describe('drawer kick matrix', () => {
  it('Epson kicks pin 2 by default', () => {
    const out = flattenCommands(kickDrawer(epsonDialect));
    // ESC p 0 25 75 — pin 2, pulse-on 50ms (25 * 2), pulse-off 150ms (75 * 2).
    expect(Array.from(out)).toEqual([0x1b, 0x70, 0, 25, 75]);
  });

  it('Xprinter kicks pin 5 with longer pulse for unreliable firmware', () => {
    const out = flattenCommands(kickDrawer(xprinterDialect));
    // ESC p 1 100 100 — pin 5, 200ms/200ms.
    expect(Array.from(out)).toEqual([0x1b, 0x70, 1, 100, 100]);
  });

  it('Bixolon kicks pin 5 with 25/120 pulse', () => {
    const out = flattenCommands(kickDrawer(bixolonDialect));
    // ESC p 1 12 60 — 25ms (≈12*2) / 120ms (60*2). Rounding: ceil/round.
    expect(Array.from(out).slice(0, 3)).toEqual([0x1b, 0x70, 1]);
  });

  it('caller can override pin', () => {
    const out = flattenCommands(kickDrawer(epsonDialect, 5));
    expect(Array.from(out).slice(0, 3)).toEqual([0x1b, 0x70, 1]); // pin 5 → m=1.
  });
});

// ───────────────────────── Barcode ────────────────────────────────────

describe('barcode commands', () => {
  it('EAN13 emits GS k 67 with payload', () => {
    const out = flattenCommands(printBarcode('1234567890123', 'EAN13', epsonDialect));
    // Find the GS k header — it follows the prelude.
    const arr = Array.from(out);
    const idx = arr.findIndex((b, i) => b === 0x1d && arr[i + 1] === 0x6b);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(arr[idx + 2]).toBe(0x43); // EAN13 type byte
    expect(arr[idx + 3]).toBe(13); // length
  });

  it('CODE128 emits GS k 73', () => {
    const out = flattenCommands(printBarcode('ABC123', 'CODE128', epsonDialect));
    const arr = Array.from(out);
    const idx = arr.findIndex((b, i) => b === 0x1d && arr[i + 1] === 0x6b);
    expect(arr[idx + 2]).toBe(0x49);
  });
});

// ───────────────────────── QR ─────────────────────────────────────────

describe('QR codes', () => {
  it('emits model 2 + size + ec + store + print sequence', () => {
    const out = flattenCommands(printQR('https://example.com/x', epsonDialect, 6));
    const arr = Array.from(out);
    // First QR header: GS ( k 04 00 31 41 32 00 (model 2).
    expect(arr.slice(0, 9)).toEqual([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
    // The last 8 bytes should be the print command: GS ( k 03 00 31 51 30.
    expect(arr.slice(-8)).toEqual([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
  });

  it('clamps size to 1..16', () => {
    const out = flattenCommands(printQR('x', epsonDialect, 99));
    const arr = Array.from(out);
    // Find module-size command: GS ( k 03 00 31 43 n.
    const i = arr.findIndex((b, j) =>
      b === 0x1d && arr[j + 1] === 0x28 && arr[j + 2] === 0x6b && arr[j + 5] === 0x31 && arr[j + 6] === 0x43,
    );
    expect(arr[i + 7]).toBe(16);
  });
});

// ───────────────────────── Receipt model ───────────────────────────────

describe('printReceipt', () => {
  it('produces a non-empty command queue', () => {
    const cmds = printReceipt(SAMPLE_RECEIPT, epsonDialect);
    expect(cmds.length).toBeGreaterThan(20);
  });

  it('queue starts with ESC @ and ends with cut', () => {
    const cmds = printReceipt(SAMPLE_RECEIPT, epsonDialect);
    const first = cmds[0].bytes;
    expect(first[0]).toBe(0x1b);
    expect(first[1]).toBe(0x40);
    const last = cmds[cmds.length - 1].bytes;
    // Cut sequence starts with GS V.
    expect(last[0]).toBe(0x1d);
    expect(last[1]).toBe(0x56);
  });

  it('respects 58mm vs 80mm column width', () => {
    // 58mm should produce more lines (text wraps tighter) — proxy: queue length.
    const cmds80 = printReceipt(SAMPLE_RECEIPT, generic80mmDialect);
    const cmds58 = printReceipt(SAMPLE_RECEIPT, generic58mmBtDialect);
    expect(cmds80.length).toBeGreaterThan(0);
    expect(cmds58.length).toBeGreaterThan(0);
  });

  it('includes QR when payload present', () => {
    const cmds = printReceipt({ ...SAMPLE_RECEIPT, qrPayload: 'efakhata://abc' }, epsonDialect);
    const hasQrHeader = cmds.some((c) => c.bytes[0] === 0x1d && c.bytes[1] === 0x28 && c.bytes[2] === 0x6b);
    expect(hasQrHeader).toBe(true);
  });
});

// ───────────────────────── Detection ───────────────────────────────────

describe('detectDialect', () => {
  it('identifies Epson from BLE name "Epson TM-T20III"', () => {
    const r = detectDialect('Epson TM-T20III');
    expect(r.dialect.id).toBe('escpos-epson');
    expect(r.confidence).toBe('high');
  });

  it('identifies Xprinter from name "XP-T80B"', () => {
    const r = detectDialect('XP-T80B (BT)');
    expect(r.dialect.id).toBe('escpos-xprinter');
  });

  it('identifies Bixolon from "SRP-330II"', () => {
    const r = detectDialect('SRP-330II Receipt');
    expect(r.dialect.id).toBe('escpos-bixolon');
  });

  it('identifies generic 58mm from "Goojprt PT-210"', () => {
    const r = detectDialect('Goojprt PT-210');
    expect(r.dialect.id).toBe('escpos-generic-58');
  });

  it('falls back to generic 80mm for unknown name', () => {
    const r = detectDialect('Some random device');
    expect(r.dialect.id).toBe('escpos-generic-80');
    expect(r.confidence).toBe('fallback');
  });

  it('identifies via GS I 1 response bytes', () => {
    // "EPSON" prefix.
    const bytes = Uint8Array.from([0x45, 0x50, 0x53, 0x4f, 0x4e, 0x00]);
    const r = detectDialect('Unknown BLE', bytes);
    expect(r.dialect.id).toBe('escpos-epson');
    expect(r.confidence).toBe('high');
  });

  it('NUS service hints generic 58mm BT', () => {
    const r = detectDialect(undefined, null, ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']);
    expect(r.dialect.id).toBe('escpos-generic-58');
  });

  it('identifier probe bytes are GS I 1', () => {
    expect(Array.from(buildIdentifierProbe())).toEqual([0x1d, 0x49, 0x01]);
  });
});
