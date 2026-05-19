/**
 * Shared `fast-check` arbitraries for AddGate property tests.
 *
 * Used by `frontend/src/system-wide-ux-overhaul.pbt.test.ts` (Property 4
 * — AddGate monotonicity and transition correctness).
 *
 * The generators here describe the input space for the formal Add_Gate
 * state machine documented in
 * `.kiro/specs/system-wide-ux-overhaul/design.md` →
 * "Selective Add System":
 *
 * - {@link recordCountArb} — non-negative record counts.
 * - {@link flowArb} — optional multi-step flow binding.
 * - {@link modeArb} — `'mandatory' | 'optional'`.
 * - {@link gateStateArb} — full `(recordCount, flow)` snapshot.
 * - {@link transitionArb} — a `(prevCount, nextCount, prevMode, flow)`
 *   tuple suitable for testing the pure `transitionMode` helper.
 *
 * The generators stay close to the input space the production code
 * actually sees: counts are bounded (avoid pathological `Number.MAX`
 * cases), strings are short ASCII, and the `flow` shape mirrors
 * {@link AddGateFlow} from `useAddGate.ts`.
 */

import * as fc from 'fast-check';

import type { AddGateFlow, AddGateMode } from '../useAddGate';

/**
 * Non-negative record count.
 *
 * Bounded at 100 because the AddGate state machine only branches on
 * `=== 0` vs `>= 1`; any larger count is behaviourally identical and
 * inflating the bound only slows shrinking.
 */
export const recordCountArb: fc.Arbitrary<number> = fc.nat({ max: 100 });

/**
 * Strictly positive record count (≥ 1).
 *
 * Useful when generating "left side ≥ 1" scenarios for the `≥ 1 → 0`
 * transition rule.
 */
export const positiveRecordCountArb: fc.Arbitrary<number> = fc.integer({
  min: 1,
  max: 100,
});

/**
 * Multi-step flow binding, or `null`.
 *
 * Mirrors {@link AddGateFlow}: a stable `id`, a `stepId` within the
 * flow, and a `complete` flag. `null` means the Section is rendered
 * outside any flow.
 */
export const flowArb: fc.Arbitrary<AddGateFlow | null> = fc.option(
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 16 }),
    stepId: fc.string({ minLength: 1, maxLength: 16 }),
    complete: fc.boolean(),
  }),
  { nil: null, freq: 3 },
);

/**
 * `'mandatory' | 'optional'`.
 */
export const modeArb: fc.Arbitrary<AddGateMode> = fc.constantFrom<AddGateMode>(
  'mandatory',
  'optional',
);

/**
 * One snapshot of the AddGate state — `(recordCount, flow)`.
 */
export interface GateStateSample {
  recordCount: number;
  flow: AddGateFlow | null;
}

export const gateStateArb: fc.Arbitrary<GateStateSample> = fc.record({
  recordCount: recordCountArb,
  flow: flowArb,
});

/**
 * One transition tuple — `(prevCount, nextCount, prevMode, flow)`.
 *
 * The `flow` is shared between the prev and next snapshots: AddGate
 * transitions only ever fire because of a `setRecordCount` change, not
 * because of a flow swap, so generating one shared flow per transition
 * matches the production code path.
 */
export interface TransitionSample {
  prevCount: number;
  nextCount: number;
  prevMode: AddGateMode;
  flow: AddGateFlow | null;
}

export const transitionArb: fc.Arbitrary<TransitionSample> = fc.record({
  prevCount: recordCountArb,
  nextCount: recordCountArb,
  prevMode: modeArb,
  flow: flowArb,
});

/**
 * A `0 → ≥ 1` transition: `prevCount === 0`, `nextCount >= 1`.
 */
export const zeroToNonZeroTransitionArb: fc.Arbitrary<TransitionSample> =
  fc.record({
    prevCount: fc.constant(0),
    nextCount: positiveRecordCountArb,
    prevMode: modeArb,
    flow: flowArb,
  });

/**
 * A `≥ 1 → 0` transition: `prevCount >= 1`, `nextCount === 0`.
 */
export const nonZeroToZeroTransitionArb: fc.Arbitrary<TransitionSample> =
  fc.record({
    prevCount: positiveRecordCountArb,
    nextCount: fc.constant(0),
    prevMode: modeArb,
    flow: flowArb,
  });

/**
 * A "no boundary cross" transition: both `prevCount` and `nextCount`
 * are ≥ 1, OR both are 0. Used to assert `mode` does not change when
 * the empty/non-empty boundary is not crossed.
 */
export const noBoundaryCrossTransitionArb: fc.Arbitrary<TransitionSample> =
  fc.oneof(
    fc.record({
      prevCount: positiveRecordCountArb,
      nextCount: positiveRecordCountArb,
      prevMode: modeArb,
      flow: flowArb,
    }),
    fc.record({
      prevCount: fc.constant(0),
      nextCount: fc.constant(0),
      prevMode: modeArb,
      flow: flowArb,
    }),
  );
