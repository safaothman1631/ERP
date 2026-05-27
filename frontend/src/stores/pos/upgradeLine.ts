/**
 * upgradeLine — Data-safety helper for migrating legacy POS cart lines
 * into the CRDT-aware `CartLineRow` shape required by `merge.ts`.
 *
 * Background
 * ----------
 * Before the P3 CRDT refactor, cart lines persisted in IndexedDB
 * (`zoho-pos-db` v1) only carried `{ id, item_id, qty, unit_price, ... }`.
 * The new merge logic in `merge.ts` REQUIRES three additional fields on
 * every line:
 *
 *   - `lineId: string`           — ULID-style stable identifier
 *   - `qtyUpdatedAt: number`     — ms epoch of the last qty/price edit
 *   - `qtyUpdatedBy: string`     — device id (LWW tiebreak)
 *
 * Carts written by the old code don't have those fields. Feeding such a
 * line into `mergeLine()` would silently produce `undefined`/`NaN` values
 * and lose data on the next sync round-trip. This helper rewrites legacy
 * lines into the new shape and is called from two places:
 *
 *   1. `db.ts` legacy migration — when copying v1 → v4 rows on first boot.
 *   2. `merge.ts` runtime guard — when a fresh device receives a remote
 *      cart that still carries legacy lines (e.g. coming from a peer that
 *      hadn't booted the new code yet).
 *
 * Pure, idempotent, no I/O.
 */
import type { CartLineRow } from './schema';

/** Crockford-ULID-ish 26-char identifier (timestamp + 80-bit randomness). */
function generateLineId(): string {
  // 48-bit timestamp (10 chars, base32 Crockford).
  const time = Date.now();
  const timePart = encodeBase32(time, 10);
  // 80-bit randomness (16 chars).
  const rand = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(rand);
  } else {
    for (let i = 0; i < rand.length; i++) rand[i] = Math.floor(Math.random() * 256);
  }
  let randPart = '';
  // Pack 80 bits into 16 base32 chars, 5 bits per char.
  let bits = 0;
  let value = 0;
  for (let i = 0; i < rand.length; i++) {
    value = (value << 8) | rand[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      randPart += CROCKFORD[(value >> bits) & 0x1f];
    }
  }
  if (randPart.length < 16) {
    randPart += CROCKFORD[(value << (5 - bits)) & 0x1f];
  }
  return (timePart + randPart).slice(0, 26);
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeBase32(n: number, length: number): string {
  let out = '';
  let v = n;
  for (let i = 0; i < length; i++) {
    out = CROCKFORD[v & 0x1f] + out;
    v = Math.floor(v / 32);
  }
  return out;
}

/**
 * Type-narrowing predicate. A line `needsUpgrade` when either of the two
 * required CRDT fields are missing or malformed. We intentionally do NOT
 * check `qtyUpdatedBy`: an empty device id is recoverable (treated as the
 * lexicographic minimum by `merge.ts`) whereas a missing timestamp would
 * make LWW non-deterministic.
 */
export function needsUpgrade(line: unknown): boolean {
  if (line == null || typeof line !== 'object') return true;
  const l = line as Partial<CartLineRow> & Record<string, unknown>;
  if (typeof l.lineId !== 'string' || l.lineId.length === 0) return true;
  if (typeof l.qtyUpdatedAt !== 'number' || !Number.isFinite(l.qtyUpdatedAt)) return true;
  return false;
}

/**
 * Convert a legacy or partial line into a valid `CartLineRow`. Always
 * returns a new object — the input is never mutated. If the input is
 * already a complete `CartLineRow`, the value is returned unchanged
 * (referential equality is intentionally NOT promised; callers must use
 * structural comparisons).
 *
 * The function tolerates both camelCase (`itemId`, `unitPrice`) and
 * snake_case (`item_id`, `unit_price`) field names because the legacy
 * Zustand persistence layer used snake_case.
 */
export function upgradeLine(
  legacyLine: unknown,
  deviceId: string,
  now: number = Date.now(),
): CartLineRow {
  const raw = (legacyLine ?? {}) as Record<string, unknown>;

  // Fast-path: already upgraded → preserve every field as-is.
  if (!needsUpgrade(raw)) {
    return raw as unknown as CartLineRow;
  }

  const lineId =
    (typeof raw.lineId === 'string' && raw.lineId.length > 0 && raw.lineId) ||
    (typeof raw.id === 'string' && raw.id.length > 0 && raw.id) ||
    generateLineId();

  const itemId =
    (typeof raw.itemId === 'string' && raw.itemId) ||
    (typeof raw.item_id === 'string' && raw.item_id) ||
    '';
  const itemName =
    (typeof raw.itemName === 'string' && raw.itemName) ||
    (typeof raw.item_name === 'string' && raw.item_name) ||
    '';
  const sku =
    (typeof raw.sku === 'string' && raw.sku) || undefined;

  const qty = toNumber(raw.qty, 0);
  const unitPrice = toNumber(
    raw.unitPrice !== undefined ? raw.unitPrice : raw.unit_price,
    0,
  );
  const discountPercent = toNumber(
    raw.discountPercent !== undefined ? raw.discountPercent : raw.discount_percent,
    0,
  );
  const taxRate = toNumber(
    raw.taxRate !== undefined ? raw.taxRate : raw.tax_rate,
    0,
  );

  const note =
    (typeof raw.note === 'string' && raw.note) || undefined;
  const course =
    (typeof raw.course === 'string' && raw.course) || undefined;

  const qtyUpdatedAt =
    typeof raw.qtyUpdatedAt === 'number' && Number.isFinite(raw.qtyUpdatedAt)
      ? raw.qtyUpdatedAt
      : now;
  const qtyUpdatedBy =
    (typeof raw.qtyUpdatedBy === 'string' && raw.qtyUpdatedBy) || deviceId;

  const upgraded: CartLineRow = {
    lineId: lineId as string,
    itemId,
    itemName,
    sku,
    qty,
    unitPrice,
    discountPercent,
    taxRate,
    note,
    course,
    qtyUpdatedAt,
    qtyUpdatedBy,
  };

  // Preserve tombstone bookkeeping if present.
  if (typeof raw.deletedAt === 'number' && Number.isFinite(raw.deletedAt)) {
    upgraded.deletedAt = raw.deletedAt;
  }
  if (typeof raw.deletedBy === 'string' && raw.deletedBy.length > 0) {
    upgraded.deletedBy = raw.deletedBy;
  }
  return upgraded;
}

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
