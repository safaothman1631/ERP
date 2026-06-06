/**
 * CRDT-like deterministic merge for multi-device POS carts.
 *
 * Strategy (per design.md §2.4):
 *
 *   - Cart-level scalar fields use Last-Write-Wins on `updatedAt`, with the
 *     device id as a lexicographic tiebreak.
 *   - Cart `lines` is an LWW-element-set keyed by `lineId`:
 *       * Union of all line ids on both sides.
 *       * Per line, the field bundle `(qty, unitPrice, discountPercent,
 *         taxRate, note, course)` is taken from the side with the newer
 *         `qtyUpdatedAt`. Ties broken by lexicographic `qtyUpdatedBy`.
 *       * A line is considered tombstoned when either side has `deletedAt`,
 *         UNLESS the other side has a strictly-newer `qtyUpdatedAt`. (A
 *         quantity edit can resurrect a tombstoned line only with explicit
 *         intent.)
 *
 * Properties (asserted by `merge.test.ts`):
 *
 *   1. Idempotence:  merge(A, A) === A
 *   2. Commutativity: merge(A, B) and merge(B, A) yield equal carts
 *      (lines maps compared key-by-key; map insertion order ignored).
 *   3. Associativity: merge(merge(A, B), C) equals merge(A, merge(B, C))
 *      under the same key-set equality.
 *
 * Pure function — no I/O, no clock reads, no random numbers.
 */
import type { CartLineRow, CartRow } from './schema';
import { needsUpgrade, upgradeLine } from './upgradeLine';

/**
 * Lazy upgrade fallback used when this device receives a remote cart
 * whose lines were written by an older client without CRDT metadata.
 * Without this guard a missing `qtyUpdatedAt` would crash LWW and a
 * missing `lineId` would silently overwrite the merged-lines map at the
 * `undefined` key, losing every legacy line. Guarding here means
 * `mergeLine` / `mergeCart` are SAFE to call on any persisted shape,
 * including cross-version sync payloads.
 */
const FALLBACK_DEVICE_ID = 'legacy-peer';

function ensureUpgraded(line: CartLineRow | undefined): CartLineRow | undefined {
  if (line === undefined) return undefined;
  if (!needsUpgrade(line)) return line;
  return upgradeLine(line, FALLBACK_DEVICE_ID);
}

/**
 * Re-key a `lines` map by each line's true `lineId`. Legacy persistence
 * sometimes stored lines under the snake_case `id` field; upgrading
 * makes that field authoritative.
 */
function normaliseLineMap(
  lines: Record<string, CartLineRow> | undefined,
): Record<string, CartLineRow> {
  if (!lines) return {};
  const out: Record<string, CartLineRow> = {};
  for (const [key, raw] of Object.entries(lines)) {
    const upgraded = ensureUpgraded(raw);
    if (!upgraded) continue;
    out[upgraded.lineId || key] = upgraded;
  }
  return out;
}

/** Return the side that wins for (timestamp, tiebreak) — `b` wins on tie? false. */
function laterWins(
  aTs: number,
  aBy: string | undefined,
  bTs: number,
  bBy: string | undefined,
): 'a' | 'b' {
  if (aTs > bTs) return 'a';
  if (bTs > aTs) return 'b';
  // Strict lexicographic tiebreak on device id. Undefined sorts before any
  // string (treat as empty) so that a real id always beats unknown.
  const aId = aBy ?? '';
  const bId = bBy ?? '';
  if (aId === bId) return 'a';
  return aId < bId ? 'a' : 'b';
}

/**
 * Stable total-order key over a line's CONTENT (non-tombstone) fields. Used
 * only to break a full LWW tie deterministically so `mergeLine` is commutative
 * and associative. Excludes `deletedAt`/`deletedBy` on purpose — the tombstone
 * is merged independently in `mergeLine`.
 */
function lineContentKey(l: CartLineRow): string {
  return JSON.stringify([
    l.lineId,
    l.itemId,
    l.itemName,
    l.sku ?? null,
    l.qty,
    l.unitPrice,
    l.discountPercent,
    l.taxRate,
    l.note ?? null,
    l.course ?? null,
    l.qtyUpdatedAt,
    l.qtyUpdatedBy,
  ]);
}

/** Merge a single line. Either side may be undefined (line absent there). */
export function mergeLine(
  localIn: CartLineRow | undefined,
  remoteIn: CartLineRow | undefined,
): CartLineRow | undefined {
  // Defensive upgrade: a legacy line missing lineId/qtyUpdatedAt would
  // otherwise break LWW. See `upgradeLine.ts` for the contract.
  const local = ensureUpgraded(localIn);
  const remote = ensureUpgraded(remoteIn);
  if (!local && !remote) return undefined;
  if (!local) return remote;
  if (!remote) return local;

  // 1) Pick the winning side for the quantity / pricing bundle.
  // On a FULL tie (identical qtyUpdatedAt AND qtyUpdatedBy) `laterWins` returns
  // 'a' — i.e. whichever argument came first — which makes the merge
  // argument-order dependent and breaks commutativity/associativity when the
  // two tied versions differ in other content (note, qty, price…). Break such
  // ties by a stable order over the CONTENT fields qtyWinner contributes — NOT
  // the tombstone (`deletedAt`/`deletedBy`), which is merged separately below
  // and is recomputed at each step, so including it would re-break
  // associativity (`min` over a total order is commutative AND associative).
  const fullyTied =
    local.qtyUpdatedAt === remote.qtyUpdatedAt &&
    (local.qtyUpdatedBy ?? '') === (remote.qtyUpdatedBy ?? '');
  const qtyWinner = fullyTied
    ? lineContentKey(local) <= lineContentKey(remote)
      ? local
      : remote
    : laterWins(local.qtyUpdatedAt, local.qtyUpdatedBy, remote.qtyUpdatedAt, remote.qtyUpdatedBy) ===
        'a'
      ? local
      : remote;

  // 2) Compute the tombstone state.
  // A line is alive iff its qtyUpdate is strictly newer than the latest
  // deletion on either side, OR there is no deletion at all.
  const deletes: Array<{ at: number; by: string | undefined }> = [];
  if (local.deletedAt != null) {
    deletes.push({ at: local.deletedAt, by: local.deletedBy });
  }
  if (remote.deletedAt != null) {
    deletes.push({ at: remote.deletedAt, by: remote.deletedBy });
  }

  let deletedAt: number | undefined;
  let deletedBy: string | undefined;
  if (deletes.length > 0) {
    // Pick the latest deletion (LWW).
    let winner = deletes[0];
    for (let i = 1; i < deletes.length; i++) {
      if (laterWins(winner.at, winner.by, deletes[i].at, deletes[i].by) === 'b') {
        winner = deletes[i];
      }
    }
    // The quantity edit resurrects the line only if strictly newer than the
    // latest deletion.
    const aliveByEdit =
      laterWins(qtyWinner.qtyUpdatedAt, qtyWinner.qtyUpdatedBy, winner.at, winner.by) === 'a' &&
      qtyWinner.qtyUpdatedAt > winner.at;
    if (!aliveByEdit) {
      deletedAt = winner.at;
      deletedBy = winner.by;
    }
  }

  // 3) Identity / content fields are taken WHOLESALE from the qty winner.
  //
  // We deliberately do NOT fall back to the other side's itemId/itemName/sku.
  // A field-by-field "prefer winner, else other side" merge is NOT associative:
  // when the winner's `sku` is empty, the recovered value depends on which
  // neighbour happens to be `local` at that step, so `(A∘B)∘C` and `A∘(B∘C)`
  // can disagree (proven by the merge property tests). Because the winner is
  // selected by a total order (LWW on qtyUpdatedAt → qtyUpdatedBy → stable
  // content key), copying its fields verbatim makes `mergeLine` a real
  // semilattice join: commutative, associative, and idempotent.
  const merged: CartLineRow = {
    lineId: qtyWinner.lineId,
    itemId: qtyWinner.itemId,
    itemName: qtyWinner.itemName,
    sku: qtyWinner.sku,
    qty: qtyWinner.qty,
    unitPrice: qtyWinner.unitPrice,
    discountPercent: qtyWinner.discountPercent,
    taxRate: qtyWinner.taxRate,
    note: qtyWinner.note,
    course: qtyWinner.course,
    qtyUpdatedAt: qtyWinner.qtyUpdatedAt,
    qtyUpdatedBy: qtyWinner.qtyUpdatedBy,
  };
  if (deletedAt != null) {
    merged.deletedAt = deletedAt;
    merged.deletedBy = deletedBy;
  }
  return merged;
}

/**
 * Stable total-order key over a cart's SCALAR (non-line) fields. Used only to
 * break a full LWW tie deterministically so `mergeCart` is commutative and
 * associative. Excludes `lines` on purpose — see `mergeCart`.
 */
function scalarKey(c: CartRow): string {
  return JSON.stringify([
    c.cartId,
    c.sessionId,
    c.customer ?? null,
    c.table ?? null,
    c.pricelistId ?? null,
    c.presetId ?? null,
    c.discountTotal,
    c.notes,
    c.updatedAt,
    c.updatedBy,
  ]);
}

/** Merge two carts deterministically. Pure function. */
export function mergeCart(local: CartRow, remote: CartRow): CartRow {
  // Cart-level winner for scalar fields (notes, customer, table, …).
  // On a FULL tie (identical updatedAt AND updatedBy) `laterWins` returns 'a' —
  // i.e. whichever cart was passed first — which makes the merge
  // argument-order dependent and breaks commutativity/associativity when two
  // tied carts differ in scalar content. Break such ties by a stable order over
  // the SCALAR fields only (NOT the lines: lines merge separately and converge,
  // and intermediate merges carry different line sets, so including them would
  // re-break associativity). Comparing a scalar-only key makes the winner the
  // `min` over a total order, which is both commutative and associative.
  const cartFullyTied =
    local.updatedAt === remote.updatedAt &&
    (local.updatedBy ?? '') === (remote.updatedBy ?? '');
  const winner = cartFullyTied
    ? scalarKey(local) <= scalarKey(remote)
      ? local
      : remote
    : laterWins(local.updatedAt, local.updatedBy, remote.updatedAt, remote.updatedBy) === 'a'
      ? local
      : remote;

  // Re-key any legacy line maps by `lineId` after upgrading. This
  // ensures union/lookup by `lineId` is correct even when one side is
  // still keyed by the legacy `id`.
  const localLines = normaliseLineMap(local.lines);
  const remoteLines = normaliseLineMap(remote.lines);

  // Union of line ids
  const ids = new Set<string>();
  for (const id of Object.keys(localLines)) ids.add(id);
  for (const id of Object.keys(remoteLines)) ids.add(id);

  const mergedLines: Record<string, CartLineRow> = {};
  // Iterate in sorted order so the resulting object's serialization is
  // deterministic — useful for hashing / equality checks in tests.
  for (const id of [...ids].sort()) {
    const m = mergeLine(localLines[id], remoteLines[id]);
    if (m) mergedLines[id] = m;
  }

  return {
    cartId: winner.cartId,
    sessionId: winner.sessionId,
    lines: mergedLines,
    customer: winner.customer,
    table: winner.table,
    pricelistId: winner.pricelistId,
    presetId: winner.presetId,
    discountTotal: winner.discountTotal,
    notes: winner.notes,
    updatedAt: winner.updatedAt,
    updatedBy: winner.updatedBy,
  };
}

/**
 * Normalises a cart for equality comparison: lines map serialized with
 * sorted keys, top-level fields in a fixed order. Used by the property
 * tests to assert convergence regardless of merge order.
 */
export function normalizeCart(cart: CartRow): string {
  const sortedLineIds = Object.keys(cart.lines ?? {}).sort();
  const lines = sortedLineIds.map((id) => {
    const l = cart.lines[id];
    return {
      lineId: l.lineId,
      itemId: l.itemId,
      itemName: l.itemName,
      sku: l.sku ?? null,
      qty: l.qty,
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent,
      taxRate: l.taxRate,
      note: l.note ?? null,
      course: l.course ?? null,
      qtyUpdatedAt: l.qtyUpdatedAt,
      qtyUpdatedBy: l.qtyUpdatedBy,
      deletedAt: l.deletedAt ?? null,
      deletedBy: l.deletedBy ?? null,
    };
  });
  return JSON.stringify({
    cartId: cart.cartId,
    sessionId: cart.sessionId,
    customer: cart.customer ?? null,
    table: cart.table ?? null,
    pricelistId: cart.pricelistId ?? null,
    presetId: cart.presetId ?? null,
    discountTotal: cart.discountTotal,
    notes: cart.notes,
    updatedAt: cart.updatedAt,
    updatedBy: cart.updatedBy,
    lines,
  });
}
