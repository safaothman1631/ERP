/**
 * Baseline ESC/POS helpers shared by all dialects.
 *
 * Most thermal printers in Iraq (Epson, Xprinter, Bixolon, generic Goojprt,
 * Rongta, etc.) speak the same Epson ESC/POS command set with small
 * deviations. We implement the baseline here; per-vendor dialects override
 * specific commands (cut byte, drawer pulse) by composing these primitives.
 */
import type {
  BarcodeType,
  CashDrawerKick,
  CutMode,
  Dialect,
  DialectId,
  PaperWidthMm,
  PrintCommand,
  TextOptions,
} from '../types';

// Single-byte ESC/POS constants.
export const ESC = 0x1b;
export const GS = 0x1d;
export const LF = 0x0a;
export const FS = 0x1c;
export const DLE = 0x10;
export const NUL = 0x00;

export function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Encode text using a code-page hint. CP864/CP720 used for Arabic, CP437 fallback. */
export function encodeText(text: string, _codePage: string): Uint8Array {
  // The browser TextEncoder only supports UTF-8. For thermal printers we
  // do best-effort mapping: if all chars are ASCII we use ASCII, else we
  // emit UTF-8 and rely on firmware ≥ 2020 that supports it (Xprinter
  // T80B, Epson TM-T20III firmware ≥ K). Older firmware falls back to
  // garbled output — the receipt template can downgrade per dialect.
  // eslint-disable-next-line no-control-regex -- ASCII range guard is intentional
  const ascii = /^[\x00-\x7f]*$/.test(text);
  if (ascii) {
    return Uint8Array.from(text, (c) => c.charCodeAt(0));
  }
  // UTF-8 path for Kurdish / Arabic. Dialects that lack UTF-8 firmware
  // override `text()` to transliterate or use CP864 mapping.
  return new TextEncoder().encode(text);
  // Note: `codePage` is consumed by `setCodePage()` via ESC t n — this
  // function does not re-encode based on it because the browser cannot.
}

export function cmd(label: string, b: Uint8Array, delayAfterMs?: number): PrintCommand {
  return { label, bytes: b, delayAfterMs };
}

// ───────────────────────────── Baseline implementations ──────────────────

/** ESC @ — initialize printer (clears modes & buffers). */
export function init(): PrintCommand[] {
  return [cmd('ESC @ init', bytes(ESC, 0x40))];
}

/** ESC t n — select character code table. */
export function setCodePage(codePage: string): PrintCommand[] {
  const map: Record<string, number> = {
    CP437: 0,
    CP850: 2,
    CP858: 19,
    CP860: 3,
    CP863: 4,
    CP865: 5,
    CP720: 32, // Arabic
    CP864: 22, // Arabic (Epson uses 22, Xprinter sometimes 37)
    CP866: 17,
    UTF8: 255, // unofficial; firmware ≥ 2020 only.
  };
  const n = map[codePage.toUpperCase()] ?? 0;
  return [cmd(`ESC t ${n} codepage=${codePage}`, bytes(ESC, 0x74, n))];
}

/** Apply text-options prelude (align + style) and return the prelude commands. */
function applyTextOpts(opts?: TextOptions): PrintCommand[] {
  const out: PrintCommand[] = [];
  // ESC a n — align (0=left, 1=center, 2=right).
  const alignByte = opts?.align === 'center' ? 1 : opts?.align === 'right' ? 2 : 0;
  out.push(cmd(`ESC a ${alignByte}`, bytes(ESC, 0x61, alignByte)));

  // GS ! n — character size. bits 0–3 height, bits 4–7 width.
  let sizeByte = 0;
  switch (opts?.style) {
    case 'double_h':
      sizeByte = 0x01;
      break;
    case 'double_w':
      sizeByte = 0x10;
      break;
    case 'double_hw':
      sizeByte = 0x11;
      break;
  }
  out.push(cmd(`GS ! ${sizeByte}`, bytes(GS, 0x21, sizeByte)));

  // ESC E n — bold.
  const bold = opts?.style === 'bold' ? 1 : 0;
  out.push(cmd(`ESC E ${bold}`, bytes(ESC, 0x45, bold)));

  // ESC - n — underline.
  const underline = opts?.underline ? 1 : 0;
  out.push(cmd(`ESC - ${underline}`, bytes(ESC, 0x2d, underline)));

  return out;
}

/** Print text — accepts UTF-8 string, encoder picks ASCII/UTF-8. */
export function text(s: string, codePage: string, opts?: TextOptions): PrintCommand[] {
  const cmds = applyTextOpts(opts);
  cmds.push(cmd('TEXT', encodeText(s, codePage)));
  cmds.push(cmd('LF', bytes(LF)));
  const after = opts?.feedAfter ?? 0;
  if (after > 0) cmds.push(...feed(after));
  // Reset bold/underline so subsequent default text isn't sticky.
  cmds.push(cmd('ESC E 0', bytes(ESC, 0x45, 0)));
  cmds.push(cmd('ESC - 0', bytes(ESC, 0x2d, 0)));
  return cmds;
}

export function feed(lines: number): PrintCommand[] {
  const n = Math.max(0, Math.min(255, Math.floor(lines)));
  // ESC d n — feed n lines.
  return [cmd(`ESC d ${n}`, bytes(ESC, 0x64, n))];
}

/** GS V — cut paper. m=0 full, m=1 partial. Variants with feed: m=65/66 with n feed. */
export function cut(mode: CutMode, delayAfterMs = 50): PrintCommand[] {
  if (mode === 'none') return [];
  // GS V B n — feed and full cut. n is feed lines before cut.
  const fullCut = bytes(GS, 0x56, 0x42, 0x00);
  const partialCut = bytes(GS, 0x56, 0x41, 0x00);
  const b = mode === 'full' ? fullCut : partialCut;
  return [cmd(`GS V ${mode} cut`, b, delayAfterMs)];
}

const BARCODE_TYPE_BYTE: Record<BarcodeType, number> = {
  UPC_A: 0x41,
  UPC_E: 0x42,
  EAN13: 0x43,
  EAN8: 0x44,
  CODE39: 0x45,
  ITF: 0x46,
  CODABAR: 0x47,
  CODE128: 0x49,
};

/** GS k m d1...dn NUL — print barcode. We use Function B (with explicit length). */
export function barcode(data: string, type: BarcodeType): PrintCommand[] {
  const m = BARCODE_TYPE_BYTE[type];
  const payload = Uint8Array.from(data, (c) => c.charCodeAt(0));
  // GS H 2 — HRI position below.
  // GS h n — barcode height (default 100).
  // GS w n — barcode width (default 3).
  const prelude = bytes(GS, 0x48, 0x02, GS, 0x68, 0x64, GS, 0x77, 0x03);
  // GS k m n d... (Function B with length byte n).
  const header = bytes(GS, 0x6b, m, payload.length);
  return [
    cmd('GS H 2 / h 100 / w 3 prelude', prelude),
    cmd(`GS k ${type} (${data})`, concat([header, payload])),
    cmd('LF', bytes(LF)),
  ];
}

/** GS ( k — QR code. Multi-step: model, size, store, print. */
export function qr(data: string, size = 6): PrintCommand[] {
  // Clamp size to a sane 1–16 range (printer firmware tops out around 16).
  const sz = Math.max(1, Math.min(16, size));
  const payload = new TextEncoder().encode(data);
  // Function 165 — QR model: { GS ( k pL pH cn 65 n1 n2 } cn=49, n1=49 (model 2), n2=0.
  const model = bytes(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
  // Function 167 — module size: { GS ( k pL pH cn 67 n } cn=49.
  const moduleSize = bytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, sz);
  // Function 169 — error correction: { GS ( k pL pH cn 69 n } cn=49, n=49 (L) ... 52 (H). Use M (50).
  const errCorr = bytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x32);
  // Function 180 — store data: { GS ( k pL pH cn 80 m d... } cn=49, m=48.
  const len = payload.length + 3;
  const pL = len & 0xff;
  const pH = (len >> 8) & 0xff;
  const storeHeader = bytes(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
  const storeCmd = concat([storeHeader, payload]);
  // Function 181 — print: { GS ( k pL pH cn 81 m } cn=49, m=48.
  const printCmd = bytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
  return [
    cmd('QR model 2', model),
    cmd(`QR module size ${sz}`, moduleSize),
    cmd('QR error correction M', errCorr),
    cmd(`QR store data (${payload.length}B)`, storeCmd),
    cmd('QR print', printCmd),
  ];
}

/**
 * ESC p m t1 t2 — generalised drawer kick.
 *   m  = pin (0 = pin 2, 1 = pin 5)
 *   t1 = pulse-on time in 2-ms units
 *   t2 = pulse-off time in 2-ms units
 */
export function kickDrawer(kick: CashDrawerKick, delayAfterMs = 100): PrintCommand[] {
  const pinByte = kick.pin === 5 ? 1 : 0;
  const t1 = Math.max(1, Math.min(255, Math.round(kick.pulseOnMs / 2)));
  const t2 = Math.max(1, Math.min(255, Math.round(kick.pulseOffMs / 2)));
  return [
    cmd(
      `ESC p pin=${kick.pin} on=${kick.pulseOnMs}ms off=${kick.pulseOffMs}ms`,
      bytes(ESC, 0x70, pinByte, t1, t2),
      delayAfterMs,
    ),
  ];
}

/** Create the boilerplate Dialect with sensible defaults; vendors override fields. */
export function makeBaselineDialect(opts: {
  id: DialectId;
  displayName: string;
  width: PaperWidthMm;
  codePages: ReadonlyArray<string>;
  defaultDrawerKick: CashDrawerKick;
  knownIdentifiers?: ReadonlyArray<Uint8Array>;
  overrides?: Partial<Dialect>;
}): Dialect {
  const base: Dialect = {
    id: opts.id,
    displayName: opts.displayName,
    width: opts.width,
    codePages: opts.codePages,
    defaultDrawerKick: opts.defaultDrawerKick,
    knownIdentifiers: opts.knownIdentifiers,
    init,
    setCodePage,
    text: (s, o) => text(s, opts.codePages[0] ?? 'CP437', o),
    feed,
    cut,
    barcode,
    qr,
    raw: (b, label) => [cmd(label ?? 'RAW', b)],
    kickDrawer: (k) => kickDrawer(k ?? opts.defaultDrawerKick),
  };
  return { ...base, ...(opts.overrides ?? {}) };
}
