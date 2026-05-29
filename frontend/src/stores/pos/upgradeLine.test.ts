/**
 * Tests for upgradeLine — data-safety helper for legacy cart lines.
 *
 * Verifies:
 *   1. Legacy snake_case lines gain the required CRDT fields.
 *   2. Lines that are already CRDT-ready pass through unchanged.
 *   3. mergeCart() of two carts where one side carries legacy lines and
 *      the other side carries upgraded lines preserves every itemId.
 *   4. A property-based check: across arbitrary mixes of legacy /
 *      upgraded lines, no itemId present in either input is lost from
 *      the merge output.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { needsUpgrade, upgradeLine } from './upgradeLine';
import { mergeCart } from './merge';
import type { CartLineRow, CartRow } from './schema';

const DEVICE = 'test-device';

describe('needsUpgrade', () => {
  it('returns true for legacy snake_case lines', () => {
    const legacy = {
      id: 'abc',
      item_id: 'i1',
      item_name: 'Apple',
      qty: 2,
      unit_price: 100,
      discount_percent: 0,
      tax_rate: 0,
    };
    expect(needsUpgrade(legacy)).toBe(true);
  });

  it('returns true when lineId is missing even if other fields exist', () => {
    const partial = {
      itemId: 'i1',
      qty: 1,
      qtyUpdatedAt: 1000,
      qtyUpdatedBy: 'a',
    };
    expect(needsUpgrade(partial)).toBe(true);
  });

  it('returns true when qtyUpdatedAt is missing', () => {
    const partial = { lineId: 'L1', itemId: 'i1', qty: 1, qtyUpdatedBy: 'a' };
    expect(needsUpgrade(partial)).toBe(true);
  });

  it('returns false for a complete CartLineRow', () => {
    const full: CartLineRow = {
      lineId: 'L1',
      itemId: 'i1',
      itemName: 'Apple',
      qty: 1,
      unitPrice: 100,
      discountPercent: 0,
      taxRate: 0,
      qtyUpdatedAt: 1000,
      qtyUpdatedBy: 'a',
    };
    expect(needsUpgrade(full)).toBe(false);
  });

  it('returns true for null / non-object input', () => {
    expect(needsUpgrade(null)).toBe(true);
    expect(needsUpgrade(undefined)).toBe(true);
    expect(needsUpgrade('not an object')).toBe(true);
  });
});

describe('upgradeLine', () => {
  it('upgrades a legacy snake_case line and preserves all values', () => {
    const legacy = {
      id: 'legacy-id-1',
      item_id: 'item-7',
      item_name: 'Coffee',
      sku: 'SKU7',
      qty: 3,
      unit_price: 1500,
      discount_percent: 10,
      tax_rate: 5,
      note: 'extra hot',
      course: 'main',
    };
    const upgraded = upgradeLine(legacy, DEVICE, 9_999);
    expect(upgraded.lineId).toBe('legacy-id-1');
    expect(upgraded.itemId).toBe('item-7');
    expect(upgraded.itemName).toBe('Coffee');
    expect(upgraded.sku).toBe('SKU7');
    expect(upgraded.qty).toBe(3);
    expect(upgraded.unitPrice).toBe(1500);
    expect(upgraded.discountPercent).toBe(10);
    expect(upgraded.taxRate).toBe(5);
    expect(upgraded.note).toBe('extra hot');
    expect(upgraded.course).toBe('main');
    expect(upgraded.qtyUpdatedAt).toBe(9_999);
    expect(upgraded.qtyUpdatedBy).toBe(DEVICE);
  });

  it('generates a lineId when neither lineId nor legacy id exists', () => {
    const upgraded = upgradeLine({ item_id: 'x', qty: 1 }, DEVICE, 1_000);
    expect(typeof upgraded.lineId).toBe('string');
    expect(upgraded.lineId.length).toBeGreaterThan(0);
    expect(upgraded.qtyUpdatedAt).toBe(1_000);
  });

  it('returns the same shape for already-upgraded lines (idempotent)', () => {
    const full: CartLineRow = {
      lineId: 'L1',
      itemId: 'i1',
      itemName: 'Apple',
      sku: 'A1',
      qty: 2,
      unitPrice: 100,
      discountPercent: 0,
      taxRate: 0,
      qtyUpdatedAt: 1234,
      qtyUpdatedBy: 'dev-a',
    };
    const first = upgradeLine(full, DEVICE, 9_999);
    const second = upgradeLine(first, DEVICE, 9_999);
    expect(first).toEqual(full);
    expect(second).toEqual(full);
    // Specifically: timestamps must NOT be rewritten.
    expect(first.qtyUpdatedAt).toBe(1234);
    expect(first.qtyUpdatedBy).toBe('dev-a');
  });

  it('preserves tombstones when present on the legacy row', () => {
    const legacy = {
      id: 'L1',
      item_id: 'i1',
      qty: 0,
      unit_price: 100,
      discount_percent: 0,
      tax_rate: 0,
      deletedAt: 5000,
      deletedBy: 'dev-x',
    };
    const upgraded = upgradeLine(legacy, DEVICE, 9_999);
    expect(upgraded.deletedAt).toBe(5000);
    expect(upgraded.deletedBy).toBe('dev-x');
  });
});

// ---------------------------------------------------------------------------
// Integration with mergeCart
// ---------------------------------------------------------------------------

function makeCart(lines: Record<string, CartLineRow>, updatedAt: number, updatedBy: string): CartRow {
  return {
    cartId: 'cart-1',
    sessionId: 'sess-1',
    lines,
    customer: null,
    table: null,
    pricelistId: null,
    presetId: null,
    discountTotal: 0,
    notes: '',
    updatedAt,
    updatedBy,
  };
}

describe('mergeCart — legacy / upgraded mix', () => {
  it('does not lose lines when one side is legacy and the other is upgraded', () => {
    // "legacy" side: line stored under snake_case id, missing lineId / qtyUpdatedAt
    const legacyRaw = {
      id: 'L-legacy',
      item_id: 'item-legacy',
      item_name: 'Legacy',
      qty: 1,
      unit_price: 50,
      discount_percent: 0,
      tax_rate: 0,
    } as unknown as CartLineRow;
    const localLegacy = makeCart(
      { 'L-legacy': legacyRaw },
      1000,
      'dev-legacy',
    );

    const upgraded: CartLineRow = {
      lineId: 'L-new',
      itemId: 'item-new',
      itemName: 'Upgraded',
      qty: 2,
      unitPrice: 75,
      discountPercent: 0,
      taxRate: 0,
      qtyUpdatedAt: 2000,
      qtyUpdatedBy: 'dev-new',
    };
    const remoteUpgraded = makeCart({ 'L-new': upgraded }, 2000, 'dev-new');

    const merged = mergeCart(localLegacy, remoteUpgraded);
    const itemIds = Object.values(merged.lines).map((l) => l.itemId);
    expect(itemIds.sort()).toEqual(['item-legacy', 'item-new']);
  });

  it('property: every input itemId is present in the merge output', () => {
    const legacyLineArb = fc.record({
      id: fc.uuid(),
      item_id: fc.constantFrom('i-a', 'i-b', 'i-c', 'i-d'),
      item_name: fc.constant('legacy'),
      qty: fc.integer({ min: 1, max: 10 }),
      unit_price: fc.integer({ min: 0, max: 1000 }),
      discount_percent: fc.integer({ min: 0, max: 50 }),
      tax_rate: fc.integer({ min: 0, max: 30 }),
    });

    const upgradedLineArb: fc.Arbitrary<CartLineRow> = fc.record({
      lineId: fc.uuid(),
      itemId: fc.constantFrom('i-e', 'i-f', 'i-g', 'i-h'),
      itemName: fc.constant('upgraded'),
      qty: fc.integer({ min: 1, max: 10 }),
      unitPrice: fc.integer({ min: 0, max: 1000 }),
      discountPercent: fc.integer({ min: 0, max: 50 }),
      taxRate: fc.integer({ min: 0, max: 30 }),
      qtyUpdatedAt: fc.integer({ min: 1, max: 10_000 }),
      qtyUpdatedBy: fc.constantFrom('dev-a', 'dev-b'),
    });

    fc.assert(
      fc.property(
        fc.array(legacyLineArb, { maxLength: 4 }),
        fc.array(upgradedLineArb, { maxLength: 4 }),
        fc.array(legacyLineArb, { maxLength: 4 }),
        fc.array(upgradedLineArb, { maxLength: 4 }),
        (legacyA, upgradedA, legacyB, upgradedB) => {
          // Build cart A: mix of legacy + upgraded keyed by their natural id.
          const aLines: Record<string, CartLineRow> = {};
          for (const l of legacyA) aLines[l.id] = l as unknown as CartLineRow;
          for (const l of upgradedA) aLines[l.lineId] = l;
          const bLines: Record<string, CartLineRow> = {};
          for (const l of legacyB) bLines[l.id] = l as unknown as CartLineRow;
          for (const l of upgradedB) bLines[l.lineId] = l;

          const a = makeCart(aLines, 1000, 'dev-a');
          const b = makeCart(bLines, 2000, 'dev-b');
          const merged = mergeCart(a, b);

          const wantedItemIds = new Set<string>();
          for (const l of legacyA) wantedItemIds.add(l.item_id);
          for (const l of upgradedA) wantedItemIds.add(l.itemId);
          for (const l of legacyB) wantedItemIds.add(l.item_id);
          for (const l of upgradedB) wantedItemIds.add(l.itemId);

          const haveItemIds = new Set<string>();
          for (const l of Object.values(merged.lines)) {
            // Tombstoned lines should not count as "lost" data even if they survived.
            haveItemIds.add(l.itemId);
          }
          for (const id of wantedItemIds) {
            expect(haveItemIds.has(id)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
