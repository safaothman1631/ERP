/**
 * Property-based tests for the POS CRDT-like merge.
 *
 * The merge function must be:
 *
 *   - idempotent:   merge(A, A) ≡ A
 *   - commutative:  merge(A, B) ≡ merge(B, A)
 *   - associative:  merge(merge(A, B), C) ≡ merge(A, merge(B, C))
 *
 * "Equivalence" is structural equality on the JSON-normalised form, since the
 * Map insertion order of merged.lines is irrelevant to semantics.
 *
 * Framework: fast-check (already in devDependencies)
 * Runner:    Vitest
 * Iterations: 1000 per property (per the P3 owner's brief)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CartLineRow, CartRow } from './schema';
import { mergeCart, mergeLine, normalizeCart } from './merge';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const deviceIdArb = fc.constantFrom('dev-a', 'dev-b', 'dev-c', 'dev-d');
const lineIdArb = fc.constantFrom('L1', 'L2', 'L3', 'L4', 'L5');

const cartLineArb = (lineId: string): fc.Arbitrary<CartLineRow> =>
  fc.record({
    lineId: fc.constant(lineId),
    itemId: fc.constantFrom('item-1', 'item-2', 'item-3'),
    itemName: fc.constantFrom('Apple', 'Bread', 'Coffee'),
    sku: fc.option(fc.constantFrom('SKU1', 'SKU2'), { nil: undefined }),
    qty: fc.integer({ min: 1, max: 100 }),
    unitPrice: fc.integer({ min: 0, max: 10_000 }),
    discountPercent: fc.integer({ min: 0, max: 100 }),
    taxRate: fc.integer({ min: 0, max: 30 }),
    note: fc.option(fc.constantFrom('VIP', 'No ice'), { nil: undefined }),
    course: fc.option(fc.constantFrom('starter', 'main'), { nil: undefined }),
    qtyUpdatedAt: fc.integer({ min: 1_000, max: 10_000 }),
    qtyUpdatedBy: deviceIdArb,
    deletedAt: fc.option(fc.integer({ min: 1_000, max: 10_000 }), { nil: undefined }),
    deletedBy: fc.option(deviceIdArb, { nil: undefined }),
  });

const linesArb: fc.Arbitrary<Record<string, CartLineRow>> = fc
  .uniqueArray(lineIdArb, { minLength: 0, maxLength: 5 })
  .chain((ids) => {
    if (ids.length === 0) {
      return fc.constant<Record<string, CartLineRow>>({});
    }
    return fc
      .tuple(...(ids.map((id) => cartLineArb(id)) as [fc.Arbitrary<CartLineRow>, ...fc.Arbitrary<CartLineRow>[]]))
      .map((lines) =>
        Object.fromEntries((lines as CartLineRow[]).map((l) => [l.lineId, l])),
      );
  });

const cartArb: fc.Arbitrary<CartRow> = fc.record({
  cartId: fc.constantFrom('cart-1'), // same cart id across replicas
  sessionId: fc.constantFrom('sess-1', null),
  lines: linesArb,
  customer: fc.option(fc.record({ id: fc.constant('cust-1') }), { nil: null }),
  table: fc.option(fc.record({ id: fc.constant('table-1') }), { nil: null }),
  pricelistId: fc.option(fc.constant('pl-1'), { nil: null }),
  presetId: fc.option(fc.constant('preset-1'), { nil: null }),
  discountTotal: fc.integer({ min: 0, max: 5_000 }),
  notes: fc.constantFrom('', 'note', 'hello'),
  updatedAt: fc.integer({ min: 1_000, max: 10_000 }),
  updatedBy: deviceIdArb,
});

const ITERATIONS = 1000;

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('mergeCart — algebraic properties', () => {
  it('is idempotent: merge(A, A) ≡ A', () => {
    fc.assert(
      fc.property(cartArb, (a) => {
        expect(normalizeCart(mergeCart(a, a))).toEqual(normalizeCart(a));
      }),
      { numRuns: ITERATIONS },
    );
  });

  it('is commutative: merge(A, B) ≡ merge(B, A)', () => {
    fc.assert(
      fc.property(cartArb, cartArb, (a, b) => {
        const ab = normalizeCart(mergeCart(a, b));
        const ba = normalizeCart(mergeCart(b, a));
        expect(ab).toEqual(ba);
      }),
      { numRuns: ITERATIONS },
    );
  });

  it('is associative: merge(merge(A, B), C) ≡ merge(A, merge(B, C))', () => {
    fc.assert(
      fc.property(cartArb, cartArb, cartArb, (a, b, c) => {
        const left = normalizeCart(mergeCart(mergeCart(a, b), c));
        const right = normalizeCart(mergeCart(a, mergeCart(b, c)));
        expect(left).toEqual(right);
      }),
      { numRuns: ITERATIONS },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit checks for invariants
// ---------------------------------------------------------------------------

describe('mergeLine — invariants', () => {
  const base = (): CartLineRow => ({
    lineId: 'L1',
    itemId: 'I1',
    itemName: 'Item',
    qty: 1,
    unitPrice: 100,
    discountPercent: 0,
    taxRate: 0,
    qtyUpdatedAt: 1000,
    qtyUpdatedBy: 'a',
  });

  it('LWW picks later qtyUpdatedAt', () => {
    const a = base();
    const b: CartLineRow = { ...base(), qty: 5, qtyUpdatedAt: 2000, qtyUpdatedBy: 'b' };
    const merged = mergeLine(a, b);
    expect(merged?.qty).toBe(5);
    expect(merged?.qtyUpdatedBy).toBe('b');
  });

  it('ties are broken lexicographically by device id', () => {
    const a: CartLineRow = { ...base(), qty: 1, qtyUpdatedBy: 'a' };
    const b: CartLineRow = { ...base(), qty: 5, qtyUpdatedBy: 'b' };
    // both at qtyUpdatedAt 1000 → 'a' < 'b' so 'a' wins
    const merged = mergeLine(a, b);
    expect(merged?.qty).toBe(1);
    expect(merged?.qtyUpdatedBy).toBe('a');
  });

  it('a tombstone older than a qty edit is overridden by the edit', () => {
    const tombstoned: CartLineRow = {
      ...base(),
      qtyUpdatedAt: 1000,
      deletedAt: 500,
      deletedBy: 'a',
    };
    const edited: CartLineRow = {
      ...base(),
      qty: 9,
      qtyUpdatedAt: 1500,
      qtyUpdatedBy: 'b',
    };
    const merged = mergeLine(tombstoned, edited);
    expect(merged?.deletedAt).toBeUndefined();
    expect(merged?.qty).toBe(9);
  });

  it('a tombstone newer than the qty edit wins (line stays deleted)', () => {
    const edited: CartLineRow = {
      ...base(),
      qty: 9,
      qtyUpdatedAt: 1000,
      qtyUpdatedBy: 'a',
    };
    const tombstoned: CartLineRow = {
      ...base(),
      qtyUpdatedAt: 800,
      deletedAt: 1500,
      deletedBy: 'b',
    };
    const merged = mergeLine(edited, tombstoned);
    expect(merged?.deletedAt).toBe(1500);
  });

  it('returns the present side when the other is undefined', () => {
    const a = base();
    expect(mergeLine(a, undefined)).toEqual(a);
    expect(mergeLine(undefined, a)).toEqual(a);
    expect(mergeLine(undefined, undefined)).toBeUndefined();
  });
});

describe('mergeCart — basic scenarios', () => {
  const now = 1_000;
  const baseCart = (overrides: Partial<CartRow> = {}): CartRow => ({
    cartId: 'cart-1',
    sessionId: 'sess-1',
    lines: {},
    customer: null,
    table: null,
    pricelistId: null,
    presetId: null,
    discountTotal: 0,
    notes: '',
    updatedAt: now,
    updatedBy: 'a',
    ...overrides,
  });

  it('unions disjoint line sets', () => {
    const lineA: CartLineRow = {
      lineId: 'L1',
      itemId: 'i1',
      itemName: 'A',
      qty: 1,
      unitPrice: 100,
      discountPercent: 0,
      taxRate: 0,
      qtyUpdatedAt: now,
      qtyUpdatedBy: 'a',
    };
    const lineB: CartLineRow = { ...lineA, lineId: 'L2', itemId: 'i2', qtyUpdatedBy: 'b' };
    const a = baseCart({ lines: { L1: lineA } });
    const b = baseCart({ lines: { L2: lineB }, updatedBy: 'b' });
    const merged = mergeCart(a, b);
    expect(Object.keys(merged.lines).sort()).toEqual(['L1', 'L2']);
  });

  it('keeps top-level fields from the device with newer updatedAt', () => {
    const a = baseCart({ notes: 'A note', updatedAt: 1000, updatedBy: 'a' });
    const b = baseCart({ notes: 'B note', updatedAt: 2000, updatedBy: 'b' });
    expect(mergeCart(a, b).notes).toBe('B note');
    expect(mergeCart(b, a).notes).toBe('B note');
  });
});
