/**
 * Bixolon dialect — SRP-330II, SRP-350III (Korean OEM, premium tier).
 *
 * Reference: Bixolon "SRP-330II Command Manual" v1.5.
 * Notes:
 *   - Bixolon drawer pulse default is lower than Epson: 25/120 ms in the
 *     spec. Some shipped firmware doubles the t2 byte → we use 25/120.
 *   - Cut uses GS V m only — feed-and-cut variant (GS V B n) is supported
 *     on SRP-350III but not SRP-330II. We emit GS V 1 (partial) by default
 *     because SRP-330II's full cut is slow and noisy. Operators wanting
 *     full cut select it in the pairing wizard.
 *   - UTF-8 support added on SRP-330II firmware ≥ 1.0F. Older firmware
 *     uses CP437; Arabic via CP864.
 *   - GS I 1 returns "BIXOLON" prefix.
 */
import { bytes, cmd, makeBaselineDialect } from './_baseline';
import type { CashDrawerKick, CutMode, Dialect, PrintCommand } from '../types';

const bixolonDrawer: CashDrawerKick = {
  pin: 5,
  pulseOnMs: 25,
  pulseOffMs: 120,
};

const KNOWN_BIXOLON_IDS: ReadonlyArray<Uint8Array> = [
  // "BIXOLON" ASCII.
  Uint8Array.from([0x42, 0x49, 0x58, 0x4f, 0x4c, 0x4f, 0x4e]),
  // "SRP-330" ASCII.
  Uint8Array.from([0x53, 0x52, 0x50, 0x2d, 0x33, 0x33, 0x30]),
  // "SRP-350" ASCII.
  Uint8Array.from([0x53, 0x52, 0x50, 0x2d, 0x33, 0x35, 0x30]),
];

function cutBixolon(mode: CutMode): PrintCommand[] {
  if (mode === 'none') return [];
  // Partial cut default — full cut on SRP-330II is loud and slow.
  const b = mode === 'full' ? bytes(0x1d, 0x56, 0x00) : bytes(0x1d, 0x56, 0x01);
  return [cmd(`GS V ${mode === 'full' ? '0' : '1'} (Bixolon)`, b, 60)];
}

export const bixolonDialect: Dialect = makeBaselineDialect({
  id: 'escpos-bixolon',
  displayName: 'Bixolon SRP-330II / SRP-350III',
  width: 80,
  codePages: ['CP437', 'CP864', 'UTF8'],
  defaultDrawerKick: bixolonDrawer,
  knownIdentifiers: KNOWN_BIXOLON_IDS,
  overrides: {
    cut: cutBixolon,
  },
});

export default bixolonDialect;
