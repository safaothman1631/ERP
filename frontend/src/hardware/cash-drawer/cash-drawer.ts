/**
 * Cash drawer service — fires the drawer kick over the active printer.
 *
 * Spec: growth-to-100/requirements.md R3.8 (two drawers, two pin configs),
 *       design.md §3.4 (matrix), tasks.md T-G.3.12.
 *
 * Cash drawers connect to the printer via an RJ-12 jack and fire when the
 * printer emits ESC p (pin t1 t2). There are two pin profiles:
 *   - Pin 5 → standard / most drawers globally
 *   - Pin 2 → alternate / used by some Epson + cheaper drawers
 *
 * The pairing wizard tests pin 5 first, then pin 2 if pin 5 doesn't fire.
 */
import { sendCommands, getActivePrinter } from '../printers/printer-service';
import type { CashDrawerKick, DrawerPin } from '../printers/types';

// Per-vendor defaults — used by the wizard's "auto" mode.
export const DRAWER_DEFAULTS_BY_DIALECT: Record<string, CashDrawerKick> = {
  'escpos-epson': { pin: 2, pulseOnMs: 50, pulseOffMs: 150 },
  // Star printers (separate vendor; placeholder since no Star dialect yet).
  'escpos-star': { pin: 5, pulseOnMs: 100, pulseOffMs: 100 },
  'escpos-xprinter': { pin: 5, pulseOnMs: 200, pulseOffMs: 200 },
  'escpos-bixolon': { pin: 5, pulseOnMs: 25, pulseOffMs: 120 },
  'escpos-generic-58': { pin: 2, pulseOnMs: 100, pulseOffMs: 200 },
  'escpos-generic-80': { pin: 2, pulseOnMs: 50, pulseOffMs: 150 },
};

export interface DrawerConfig {
  pin: DrawerPin;
  /** Pulse-on time in ms. Default 50. */
  pulseOnMs?: number;
  /** Pulse-off time in ms. Default 150. */
  pulseOffMs?: number;
}

export interface DrawerKickResult {
  ok: boolean;
  bytesSent: number;
  durationMs: number;
  pinUsed: DrawerPin;
  error?: string;
}

/**
 * Fire the cash drawer through the active printer.
 *
 * Returns ok=false if no printer is connected. The drawer never reports
 * back to the printer (no feedback channel on RJ-12), so we can't actually
 * detect drawer-not-firing — the wizard's UX prompt ("Did the drawer
 * open?") is the only feedback loop.
 */
export async function kickDrawer(config: DrawerConfig): Promise<DrawerKickResult> {
  const active = getActivePrinter();
  if (!active) {
    return {
      ok: false,
      bytesSent: 0,
      durationMs: 0,
      pinUsed: config.pin,
      error: 'No printer connected — drawer fires through the printer.',
    };
  }
  const kick: CashDrawerKick = {
    pin: config.pin,
    pulseOnMs: config.pulseOnMs ?? active.dialect.defaultDrawerKick.pulseOnMs,
    pulseOffMs: config.pulseOffMs ?? active.dialect.defaultDrawerKick.pulseOffMs,
  };
  const commands = active.dialect.kickDrawer(kick);
  try {
    const res = await sendCommands(commands);
    return {
      ok: true,
      bytesSent: res.bytesSent,
      durationMs: res.durationMs,
      pinUsed: kick.pin,
    };
  } catch (err: any) {
    return {
      ok: false,
      bytesSent: 0,
      durationMs: 0,
      pinUsed: kick.pin,
      error: err?.message ?? String(err),
    };
  }
}

/**
 * Try pin 5 first; if the operator confirms it didn't fire, try pin 2.
 * The wizard wraps this and shows a Y/N prompt between calls.
 */
export async function kickPin5(): Promise<DrawerKickResult> {
  return kickDrawer({ pin: 5 });
}

export async function kickPin2(): Promise<DrawerKickResult> {
  return kickDrawer({ pin: 2 });
}

/** Returns the auto-detected default for the active dialect. */
export function getActiveDrawerDefault(): CashDrawerKick | null {
  const active = getActivePrinter();
  if (!active) return null;
  return DRAWER_DEFAULTS_BY_DIALECT[active.dialect.id] ?? active.dialect.defaultDrawerKick;
}

export const CashDrawerService = {
  kickDrawer,
  kickPin5,
  kickPin2,
  getActiveDrawerDefault,
  DRAWER_DEFAULTS_BY_DIALECT,
};

export default CashDrawerService;
