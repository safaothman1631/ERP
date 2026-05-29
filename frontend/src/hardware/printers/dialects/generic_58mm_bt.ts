/**
 * Generic 58mm Bluetooth thermal dialect — Goojprt PT-210, Rongta RPP02N,
 * Sunmi V1, and an army of no-name SKUs rebadged across Iraqi shops.
 *
 * These devices speak baseline ESC/POS but have quirks:
 *   - 32 characters per line at standard font (vs 48 on 80mm).
 *   - Cut command is often ignored (no cutter mechanism); they emit a
 *     blank feed instead. We send GS V 1 anyway — printers without a
 *     cutter just feed silently, no error.
 *   - Drawer kick is rarely supported on 58mm; if absent, the byte
 *     sequence is consumed without effect. We still emit it.
 *   - UTF-8 firmware is uncommon. Default code page is CP437; Arabic
 *     needs CP864 mapping at the renderer level.
 *   - GS I 1 may not respond at all (BT modem doesn't echo). Detection
 *     falls back to BLE-advertised name pattern.
 */
import { bytes, cmd, makeBaselineDialect } from './_baseline';
import type { CashDrawerKick, CutMode, Dialect, PrintCommand } from '../types';

const generic58Drawer: CashDrawerKick = {
  pin: 2,
  pulseOnMs: 100,
  pulseOffMs: 200,
};

const KNOWN_58MM_IDS: ReadonlyArray<Uint8Array> = [
  // "PT-210" Goojprt.
  Uint8Array.from([0x50, 0x54, 0x2d, 0x32, 0x31, 0x30]),
  // "RPP" prefix (Rongta).
  Uint8Array.from([0x52, 0x50, 0x50]),
  // "Sunmi" prefix (capital S, lowercase rest).
  Uint8Array.from([0x53, 0x75, 0x6e, 0x6d, 0x69]),
];

function cutGeneric58(mode: CutMode): PrintCommand[] {
  if (mode === 'none') return [];
  // Many 58mm BT printers ignore the cut byte. We send GS V 1 anyway —
  // printers without a cutter discard it; printers with one perform a
  // partial cut.
  return [cmd('GS V 1 (generic 58mm — may no-op)', bytes(0x1d, 0x56, 0x01), 40)];
}

export const generic58mmBtDialect: Dialect = makeBaselineDialect({
  id: 'escpos-generic-58',
  displayName: 'Generic 58mm Bluetooth (Goojprt / Rongta / Sunmi)',
  width: 58,
  codePages: ['CP437', 'CP864', 'CP720'],
  defaultDrawerKick: generic58Drawer,
  knownIdentifiers: KNOWN_58MM_IDS,
  overrides: {
    cut: cutGeneric58,
  },
});

export default generic58mmBtDialect;
