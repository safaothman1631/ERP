/**
 * Epson ESC/POS dialect — TM-T20III, TM-T88VI, TM-m30.
 *
 * Reference: Epson "ESC/POS Command Reference" rev. 2.4.
 * Notes:
 *   - Cut: GS V 0 (full) is reliable on TM-T20III/T88VI; some firmware
 *     prefers GS V B 0 (with feed). We use GS V B 0 for safety — paper
 *     advances by `n` lines then full cut.
 *   - Drawer: ESC p m t1 t2. Pin 2 = m=0 (newer Epson default), Pin 5 = m=1
 *     (legacy USB drawers). Pulse 50/100 ms is the safe default.
 *   - UTF-8: TM-T20III firmware ≥ K.B6 supports UTF-8 via FS C 1. Older
 *     firmware needs CP864 for Arabic; we attempt UTF-8 and fall back.
 *   - GS I 1 returns vendor identifier — known Epson IDs are captured
 *     for the dialect-detection probe.
 */
import { bytes, cmd, makeBaselineDialect } from './_baseline';
import type { CashDrawerKick, CutMode, Dialect, PrintCommand } from '../types';

const epsonDrawer: CashDrawerKick = {
  pin: 2,
  pulseOnMs: 50,
  pulseOffMs: 150,
};

// Known identifiers returned by GS I 1 on real Epson printers (hex strings
// of the first 8 response bytes). Captured during physical lab testing —
// when the lab procures the device, append more identifiers here.
const KNOWN_EPSON_IDS: ReadonlyArray<Uint8Array> = [
  // TM-T20III USB returns "EPSON" prefix in some firmwares.
  Uint8Array.from([0x45, 0x50, 0x53, 0x4f, 0x4e]),
  // TM-T88VI returns vendor byte 0x29 then "EPSON".
  Uint8Array.from([0x29, 0x45, 0x50, 0x53, 0x4f, 0x4e]),
];

/** Cut override — TM-T20III prefers GS V B 0 (cut with feed) for clean rip. */
function cutEpson(mode: CutMode, delayAfterMs = 80): PrintCommand[] {
  if (mode === 'none') return [];
  // GS V B n — cut after feeding n lines. n=3 ensures the cut line clears
  // the printhead so the last line of text isn't lost.
  const b =
    mode === 'full'
      ? bytes(0x1d, 0x56, 0x42, 0x03) // full cut + feed 3
      : bytes(0x1d, 0x56, 0x41, 0x03); // partial cut + feed 3
  return [cmd(`GS V ${mode === 'full' ? 'B' : 'A'} 3 (Epson)`, b, delayAfterMs)];
}

export const epsonDialect: Dialect = makeBaselineDialect({
  id: 'escpos-epson',
  displayName: 'Epson TM-T20III / TM-T88VI',
  width: 80,
  codePages: ['UTF8', 'CP864', 'CP437'],
  defaultDrawerKick: epsonDrawer,
  knownIdentifiers: KNOWN_EPSON_IDS,
  overrides: {
    cut: (mode) => cutEpson(mode),
  },
});

export default epsonDialect;
