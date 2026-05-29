/**
 * Dialect registry — every known printer profile in one place.
 *
 * The dialect-detection probe in `../detection.ts` iterates this list to
 * match GS I 1 response bytes; the pairing wizard renders this list as
 * the manual-override picker.
 */
import type { Dialect, DialectId } from '../types';

import { bixolonDialect } from './bixolon';
import { epsonDialect } from './epson';
import { generic58mmBtDialect } from './generic_58mm_bt';
import { generic80mmDialect } from './generic_80mm';
import { xprinterDialect } from './xprinter';

export const ALL_DIALECTS: ReadonlyArray<Dialect> = [
  epsonDialect,
  xprinterDialect,
  bixolonDialect,
  generic58mmBtDialect,
  generic80mmDialect,
];

export const DIALECT_BY_ID: Readonly<Record<DialectId, Dialect>> = Object.freeze({
  'escpos-epson': epsonDialect,
  'escpos-xprinter': xprinterDialect,
  'escpos-bixolon': bixolonDialect,
  'escpos-generic-58': generic58mmBtDialect,
  'escpos-generic-80': generic80mmDialect,
  // Unknown defaults to generic 80mm — receipt renderer can downgrade to
  // 58mm if the operator confirms paper width during the wizard.
  'escpos-unknown': generic80mmDialect,
});

export function getDialectById(id: DialectId): Dialect {
  return DIALECT_BY_ID[id] ?? generic80mmDialect;
}

export { epsonDialect, xprinterDialect, bixolonDialect, generic58mmBtDialect, generic80mmDialect };
