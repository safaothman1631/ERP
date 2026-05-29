/**
 * Xprinter dialect — XP-T80A, XP-T80B, XP-58IIH (entry-level Chinese OEM).
 *
 * Reference: Xprinter "POS Printer Programming Manual" v3.0.
 * Notes:
 *   - XP-T80A is a clone of Epson TM-T20 internals; ESC/POS works as-is.
 *   - XP-T80B (BT) sometimes mis-fires drawer on pin 5 because timing
 *     constants are interpreted as 1-ms (not 2-ms) units in some firmware.
 *     We bump the pulse to 200 ms / 200 ms to compensate.
 *   - GS V 1 (partial cut) sometimes leaves a strip; GS V 0 (full cut) is
 *     more reliable. We override accordingly.
 *   - UTF-8 support is firmware-dependent. Default code page is CP437; for
 *     Arabic/Kurdish the operator must select CP864 in the pairing wizard.
 *   - GS I 1 returns "XP-T80A V01" style ASCII string on most firmware.
 */
import { bytes, cmd, makeBaselineDialect } from './_baseline';
import type { CashDrawerKick, CutMode, Dialect, PrintCommand } from '../types';

const xprinterDrawer: CashDrawerKick = {
  // Pin 5 is standard on Xprinter cash drawers; bumped pulse for unreliable
  // firmware timing.
  pin: 5,
  pulseOnMs: 200,
  pulseOffMs: 200,
};

const KNOWN_XPRINTER_IDS: ReadonlyArray<Uint8Array> = [
  // "XP-T80A" ASCII.
  Uint8Array.from([0x58, 0x50, 0x2d, 0x54, 0x38, 0x30, 0x41]),
  // "XP-T80B" ASCII.
  Uint8Array.from([0x58, 0x50, 0x2d, 0x54, 0x38, 0x30, 0x42]),
  // "XPRINTER" prefix.
  Uint8Array.from([0x58, 0x50, 0x52, 0x49, 0x4e, 0x54, 0x45, 0x52]),
];

function cutXprinter(mode: CutMode): PrintCommand[] {
  if (mode === 'none') return [];
  // Always emit full cut — partial leaves a strip on T80A/T80B.
  return [cmd('GS V 0 (Xprinter full cut)', bytes(0x1d, 0x56, 0x00), 80)];
}

export const xprinterDialect: Dialect = makeBaselineDialect({
  id: 'escpos-xprinter',
  displayName: 'Xprinter XP-T80A / T80B',
  width: 80,
  codePages: ['CP437', 'CP864', 'UTF8'],
  defaultDrawerKick: xprinterDrawer,
  knownIdentifiers: KNOWN_XPRINTER_IDS,
  overrides: {
    cut: cutXprinter,
  },
});

export default xprinterDialect;
