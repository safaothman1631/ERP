/**
 * Dialect detection — heuristic that picks the right printer profile.
 *
 * Two inputs:
 *   1. BLE advertised name / USB string descriptor — matched against
 *      regex patterns per vendor.
 *   2. GS I 1 response bytes (if the transport supports read()) — matched
 *      against the `knownIdentifiers` of each dialect.
 *
 * If neither matches, returns `escpos-generic-80` (assumes 80mm because
 * that's the dominant SKU in 2026 Iraqi retail). The pairing wizard will
 * let the operator override to 58mm or pick a specific dialect.
 */
import { ALL_DIALECTS } from './dialects';
import { generic58mmBtDialect, generic80mmDialect } from './dialects';
import type { Dialect, DialectId } from './types';

export interface DetectionResult {
  dialect: Dialect;
  confidence: 'high' | 'medium' | 'low' | 'fallback';
  reason: string;
}

// Vendor name patterns. Ordered: longest / most-specific first.
const NAME_PATTERNS: Array<{ rx: RegExp; id: DialectId; conf: DetectionResult['confidence']; reason: string }> = [
  { rx: /\b(tm[-_ ]?t\d|tm[-_ ]?m\d|epson)\b/i, id: 'escpos-epson', conf: 'high', reason: 'BLE/USB name matches Epson family' },
  { rx: /\b(xp[-_ ]?t?\d{2,}|xprinter)/i, id: 'escpos-xprinter', conf: 'high', reason: 'BLE/USB name matches Xprinter family' },
  { rx: /\b(srp[-_ ]?\d|bixolon)/i, id: 'escpos-bixolon', conf: 'high', reason: 'BLE/USB name matches Bixolon family' },
  { rx: /\b(pt[-_ ]?\d{3}|goojprt|rpp\d|rongta|sunmi[-_ ]?v\d)\b/i, id: 'escpos-generic-58', conf: 'medium', reason: 'BLE name matches a known 58mm generic OEM' },
  { rx: /\b58\s?mm\b/i, id: 'escpos-generic-58', conf: 'medium', reason: 'Name mentions 58mm width' },
  { rx: /\b80\s?mm\b/i, id: 'escpos-generic-80', conf: 'medium', reason: 'Name mentions 80mm width' },
  { rx: /\b(pos[-_ ]?80|bt[-_ ]?printer|thermal[-_ ]?printer|printer)\b/i, id: 'escpos-generic-80', conf: 'low', reason: 'Generic printer-class name; assuming 80mm' },
];

function startsWith(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length > haystack.length) return false;
  for (let i = 0; i < needle.length; i++) if (haystack[i] !== needle[i]) return false;
  return true;
}

function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0) return true;
  const max = haystack.length - needle.length;
  outer: for (let i = 0; i <= max; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Choose the best dialect for a device.
 *
 * @param deviceName       — BLE / USB advertised name (lowercased internally).
 * @param identifierBytes  — optional GS I 1 response captured during pairing.
 * @param serviceUuids     — optional BLE GATT service UUIDs (for NUS detection).
 */
export function detectDialect(
  deviceName: string | undefined,
  identifierBytes?: Uint8Array | null,
  serviceUuids?: ReadonlyArray<string>,
): DetectionResult {
  // 1. Identifier-byte match — highest confidence.
  if (identifierBytes && identifierBytes.length > 0) {
    for (const dialect of ALL_DIALECTS) {
      if (!dialect.knownIdentifiers) continue;
      for (const id of dialect.knownIdentifiers) {
        if (startsWith(identifierBytes, id) || containsBytes(identifierBytes, id)) {
          return {
            dialect,
            confidence: 'high',
            reason: `GS I 1 response matches ${dialect.displayName} identifier`,
          };
        }
      }
    }
  }

  // 2. Name regex match.
  if (deviceName) {
    for (const pat of NAME_PATTERNS) {
      if (pat.rx.test(deviceName)) {
        const dialect = ALL_DIALECTS.find((d) => d.id === pat.id) ?? generic80mmDialect;
        return { dialect, confidence: pat.conf, reason: pat.reason };
      }
    }
  }

  // 3. BLE service hint — Nordic UART Service strongly suggests generic
  //    BT thermal (cheap modem chipset rebadged across SKUs).
  if (serviceUuids?.some((u) => u.toLowerCase().includes('6e400001'))) {
    return {
      dialect: generic58mmBtDialect,
      confidence: 'low',
      reason: 'Nordic UART service advertised — likely generic 58mm BT thermal',
    };
  }

  // 4. Fallback.
  return {
    dialect: generic80mmDialect,
    confidence: 'fallback',
    reason: 'No vendor signal — using safe baseline (80mm). Operator should confirm in wizard.',
  };
}

/**
 * Build the `GS I 1` probe bytes — used by the pairing wizard to elicit
 * the vendor identifier response.
 */
export function buildIdentifierProbe(): Uint8Array {
  // GS I n with n=1 returns the printer-model ID (vendor-specific bytes).
  return Uint8Array.from([0x1d, 0x49, 0x01]);
}

/** Build a status probe — DLE EOT n with n=1 returns transmission status. */
export function buildStatusProbe(): Uint8Array {
  return Uint8Array.from([0x10, 0x04, 0x01]);
}
