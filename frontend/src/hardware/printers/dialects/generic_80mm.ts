/**
 * Generic 80mm USB/Bluetooth thermal dialect — safe fallback for any
 * 80mm printer where the dialect-detection probe returns an unknown
 * identifier or no response.
 *
 * Uses baseline ESC/POS only — no vendor extensions. The pairing wizard
 * routes to this dialect when:
 *   - GS I 1 returns bytes that don't match a known vendor prefix.
 *   - BLE name advertised is generic ("POS-80", "Printer", "BT-Printer").
 */
import { makeBaselineDialect } from './_baseline';
import type { CashDrawerKick, Dialect } from '../types';

const generic80Drawer: CashDrawerKick = {
  pin: 2,
  pulseOnMs: 50,
  pulseOffMs: 150,
};

export const generic80mmDialect: Dialect = makeBaselineDialect({
  id: 'escpos-generic-80',
  displayName: 'Generic 80mm (baseline ESC/POS)',
  width: 80,
  codePages: ['CP437', 'CP864'],
  defaultDrawerKick: generic80Drawer,
});

export default generic80mmDialect;
