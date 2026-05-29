/**
 * Hardware registry — canonical list of devices the POS hardware layer
 * is expected to work with.
 *
 * Spec: growth-to-100/requirements.md R3.1, R3.3, R3.6, R3.8.
 *
 * Each entry binds a model name to:
 *   - its dialect (printers) / driver category (scanners, drawers, displays)
 *   - default connection method(s)
 *   - default config (drawer pin, paper width, etc.)
 *   - status: 'tested' / 'pending-physical-test' / 'community-reported'
 *   - approximate USD cost in 2026 Iraqi market (for sales kit pricing)
 *
 * The pairing wizard uses this registry to power the manual-override
 * picker; the compatibility matrix doc is generated from it.
 */

import type { DialectId } from '../hardware/printers/types';
import type { DrawerPin } from '../hardware/printers/types';

// ───────────────────────── Common types ───────────────────────────────

export type DeviceStatus = 'tested' | 'pending-physical-test' | 'community-reported';

export type ConnectionMethod = 'usb' | 'bluetooth' | 'serial' | 'wifi' | 'native-ble';

export interface BasePrinterEntry {
  id: string;
  vendor: string;
  model: string;
  dialect: DialectId;
  paperWidthMm: 58 | 80;
  connections: ConnectionMethod[];
  status: DeviceStatus;
  /** Approximate USD cost on the Iraqi market in 2026. */
  approxUsd: number;
  /** Default drawer pin to suggest if this printer drives a drawer. */
  defaultDrawerPin: DrawerPin;
  notes?: string;
}

export interface ScannerEntry {
  id: string;
  vendor: string;
  model: string;
  category: 'hid-usb' | 'hid-bluetooth' | 'camera';
  status: DeviceStatus;
  approxUsd: number;
  notes?: string;
}

export interface DrawerEntry {
  id: string;
  vendor: string;
  model: string;
  pinout: 'epson-pin5' | 'epson-pin2' | 'star-pin5' | 'generic';
  recommendedPin: DrawerPin;
  status: DeviceStatus;
  approxUsd: number;
  notes?: string;
}

export interface DisplayEntry {
  id: string;
  vendor: string;
  model: string;
  connection: 'serial' | 'bluetooth' | 'wifi';
  geometry?: { cols: number; rows: number };
  status: DeviceStatus;
  approxUsd: number;
  notes?: string;
}

// ───────────────────────── Printers ───────────────────────────────────

export const PRINTERS: ReadonlyArray<BasePrinterEntry> = [
  {
    id: 'epson-tm-t20iii',
    vendor: 'Epson',
    model: 'TM-T20III',
    dialect: 'escpos-epson',
    paperWidthMm: 80,
    connections: ['usb'],
    status: 'pending-physical-test',
    approxUsd: 220,
    defaultDrawerPin: 2,
    notes: 'Workhorse — most reliable cut & UTF-8 firmware option.',
  },
  {
    id: 'epson-tm-t88vi',
    vendor: 'Epson',
    model: 'TM-T88VI',
    dialect: 'escpos-epson',
    paperWidthMm: 80,
    connections: ['usb', 'serial'],
    status: 'pending-physical-test',
    approxUsd: 420,
    defaultDrawerPin: 2,
    notes: 'Premium tier; supports e-Fakhata QR codes natively.',
  },
  {
    id: 'epson-tm-m30',
    vendor: 'Epson',
    model: 'TM-m30',
    dialect: 'escpos-epson',
    paperWidthMm: 80,
    connections: ['usb', 'bluetooth', 'wifi'],
    status: 'pending-physical-test',
    approxUsd: 290,
    defaultDrawerPin: 2,
    notes: 'Compact, multi-interface; recommended for mobile / food-truck POS.',
  },
  {
    id: 'xprinter-xp-t80a',
    vendor: 'Xprinter',
    model: 'XP-T80A',
    dialect: 'escpos-xprinter',
    paperWidthMm: 80,
    connections: ['usb'],
    status: 'pending-physical-test',
    approxUsd: 75,
    defaultDrawerPin: 5,
    notes: 'Budget option; widely sold in Baghdad markets.',
  },
  {
    id: 'xprinter-xp-t80b',
    vendor: 'Xprinter',
    model: 'XP-T80B',
    dialect: 'escpos-xprinter',
    paperWidthMm: 80,
    connections: ['usb', 'bluetooth'],
    status: 'pending-physical-test',
    approxUsd: 95,
    defaultDrawerPin: 5,
    notes: 'BT variant of T80A; drawer pulse needs the doubled timing override.',
  },
  {
    id: 'bixolon-srp-330ii',
    vendor: 'Bixolon',
    model: 'SRP-330II',
    dialect: 'escpos-bixolon',
    paperWidthMm: 80,
    connections: ['usb', 'serial'],
    status: 'pending-physical-test',
    approxUsd: 180,
    defaultDrawerPin: 5,
    notes: 'Premium Korean OEM; quiet partial cut.',
  },
  {
    id: 'bixolon-srp-350iii',
    vendor: 'Bixolon',
    model: 'SRP-350III',
    dialect: 'escpos-bixolon',
    paperWidthMm: 80,
    connections: ['usb', 'serial', 'wifi'],
    status: 'pending-physical-test',
    approxUsd: 230,
    defaultDrawerPin: 5,
  },
  {
    id: 'goojprt-pt210',
    vendor: 'Goojprt',
    model: 'PT-210',
    dialect: 'escpos-generic-58',
    paperWidthMm: 58,
    connections: ['bluetooth', 'native-ble'],
    status: 'community-reported',
    approxUsd: 22,
    defaultDrawerPin: 2,
    notes: 'No cutter; pocket-size BT printer popular with delivery couriers.',
  },
  {
    id: 'rongta-rpp02n',
    vendor: 'Rongta',
    model: 'RPP02N',
    dialect: 'escpos-generic-58',
    paperWidthMm: 58,
    connections: ['bluetooth', 'native-ble'],
    status: 'community-reported',
    approxUsd: 28,
    defaultDrawerPin: 2,
  },
  {
    id: 'sunmi-v1s',
    vendor: 'Sunmi',
    model: 'V1s (integrated)',
    dialect: 'escpos-generic-58',
    paperWidthMm: 58,
    connections: ['native-ble'],
    status: 'community-reported',
    approxUsd: 320,
    defaultDrawerPin: 2,
    notes: 'Integrated Android POS terminal — printer fires via Sunmi SDK; we fall back to ESC/POS for portability.',
  },
];

// ───────────────────────── Scanners ───────────────────────────────────

export const SCANNERS: ReadonlyArray<ScannerEntry> = [
  {
    id: 'honeywell-1450g',
    vendor: 'Honeywell',
    model: '1450g',
    category: 'hid-usb',
    status: 'pending-physical-test',
    approxUsd: 95,
    notes: 'USB 2D scanner; plug-and-play HID, no driver.',
  },
  {
    id: 'symbol-ls2208',
    vendor: 'Symbol (Zebra)',
    model: 'LS2208',
    category: 'hid-usb',
    status: 'pending-physical-test',
    approxUsd: 75,
    notes: 'Workhorse 1D laser scanner; 6-month battery on the BT variant.',
  },
  {
    id: 'netum-c750',
    vendor: 'Netum',
    model: 'C750',
    category: 'hid-bluetooth',
    status: 'pending-physical-test',
    approxUsd: 35,
    notes: 'BT HID; budget option from Chinese OEM — pairs as keyboard.',
  },
  {
    id: 'tera-hw0002',
    vendor: 'Tera',
    model: 'HW0002',
    category: 'hid-bluetooth',
    status: 'community-reported',
    approxUsd: 28,
    notes: 'Sold heavily on AliExpress / Iraqi e-commerce sites.',
  },
  {
    id: 'camera-zxing',
    vendor: 'In-app',
    model: 'Camera fallback (ZXing)',
    category: 'camera',
    status: 'tested',
    approxUsd: 0,
    notes: 'Browser camera + ZXing worker; runs on any tablet without a USB scanner.',
  },
];

// ───────────────────────── Cash drawers ───────────────────────────────

export const DRAWERS: ReadonlyArray<DrawerEntry> = [
  {
    id: 'epson-eb-3000',
    vendor: 'Epson-style',
    model: 'EB-3000',
    pinout: 'epson-pin5',
    recommendedPin: 5,
    status: 'pending-physical-test',
    approxUsd: 60,
    notes: 'Standard 6-pin RJ-12; fires on pin 5.',
  },
  {
    id: 'alt-4pin',
    vendor: 'Generic',
    model: '4-pin alternate',
    pinout: 'epson-pin2',
    recommendedPin: 2,
    status: 'pending-physical-test',
    approxUsd: 40,
    notes: 'Cheaper 4-pin drawer with pin-2 wiring; wizard tests pin 5 first, falls back.',
  },
];

// ───────────────────────── Customer displays ──────────────────────────

export const DISPLAYS: ReadonlyArray<DisplayEntry> = [
  {
    id: 'bematech-ld220',
    vendor: 'Bematech',
    model: 'LD-220',
    connection: 'serial',
    geometry: { cols: 20, rows: 2 },
    status: 'pending-physical-test',
    approxUsd: 120,
    notes: 'VFD pole display; Epson DM-D110 compatible commands.',
  },
  {
    id: 'generic-vfd220',
    vendor: 'Generic',
    model: 'VFD-220',
    connection: 'serial',
    geometry: { cols: 20, rows: 2 },
    status: 'community-reported',
    approxUsd: 55,
  },
  {
    id: 'pwa-bluetooth-tablet',
    vendor: 'In-app',
    model: 'PWA tablet (BT-paired)',
    connection: 'bluetooth',
    status: 'tested',
    approxUsd: 90,
    notes: '8" Android tablet running the slim PWA at display.zoho-kurdish.iq/{terminal_id}.',
  },
  {
    id: 'pwa-wifi-tv',
    vendor: 'In-app',
    model: 'PWA WiFi (smart TV)',
    connection: 'wifi',
    status: 'tested',
    approxUsd: 0,
    notes: 'Point any smart TV browser at display.zoho-kurdish.iq/{terminal_id}.',
  },
];

// ───────────────────────── Lookup helpers ─────────────────────────────

export function findPrinterById(id: string): BasePrinterEntry | undefined {
  return PRINTERS.find((p) => p.id === id);
}

export function findScannerById(id: string): ScannerEntry | undefined {
  return SCANNERS.find((s) => s.id === id);
}

export function findDrawerById(id: string): DrawerEntry | undefined {
  return DRAWERS.find((d) => d.id === id);
}

export function findDisplayById(id: string): DisplayEntry | undefined {
  return DISPLAYS.find((d) => d.id === id);
}

export const HardwareRegistry = {
  PRINTERS,
  SCANNERS,
  DRAWERS,
  DISPLAYS,
  findPrinterById,
  findScannerById,
  findDrawerById,
  findDisplayById,
};

export default HardwareRegistry;
