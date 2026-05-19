/**
 * `useAddGate(sectionId)` — Selective Add gate (system-wide-ux-overhaul, R9.5).
 *
 * Implements the Add_Gate state machine that drives the Selective_Add UX
 * across every Section that exposes an "Add" / "Create" action. It reads
 * the section's current `recordCount` and active `flow` binding from a
 * shared {@link AddGateContext} (populated by `AddGateProvider` — see
 * task 3.3) and returns the derived gate state, plus the imperative
 * {@link AddGateState.setRecordCount} API.
 *
 * State machine (per design.md → "Selective Add System")
 * ------------------------------------------------------
 *
 * | `recordCount` | inside incomplete multi-step flow? | `mode`      |
 * | ------------- | ----------------------------------- | ----------- |
 * | `0`           | yes                                 | `mandatory` |
 * | `0`           | no                                  | `mandatory` |
 * | `≥ 1`         | yes                                 | `optional`  |
 * | `≥ 1`         | no                                  | `optional`  |
 *
 * Transitions:
 *
 * - `0 → ≥ 1` — auto-demote to `optional`; clear any "at least one
 *   required" validation marker without a page reload (R9.6).
 * - `≥ 1 → 0` — re-promote to `mandatory` **only if** the Section is
 *   currently inside an **incomplete** multi-step flow; outside such a
 *   flow, `mode` remains `optional` (R9.7). This intentional hysteresis
 *   reflects the design note that, outside a flow, there is no
 *   "proceed" to block — `mandatory` only adds friction when a step
 *   genuinely requires data.
 *
 * Default behaviour when no `AddGateProvider` is mounted
 * ------------------------------------------------------
 *
 * The provider that owns the shared store is wired in **task 3.3**.
 * Until then, components that consume this hook (e.g. EmptyState,
 * onboarding wizards) must not crash. The hook therefore falls back to
 * a noop {@link AddGateContextValue} that reports `recordCount = 0`,
 * `flow = null`, and silently swallows `setRecordCount` calls. With
 * `recordCount === 0`, the initial `mode` is `mandatory`, which is the
 * conservative default — Sections render their Empty_State CTA until
 * real record-count data is available.
 *
 * _Validates: Requirements 9.2, 9.3, 9.5, 9.6, 9.7_
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { SectionId } from '../../help/sectionIds';
import { asTranslationKey, type TranslationKey } from '../../i18n/types';

/**
 * The two values of the Add_Gate state.
 *
 * - `mandatory` — the Section is empty (or, inside an incomplete flow,
 *   has been emptied) and the Empty_State CTA must be the prominent
 *   path. Inside a multi-step flow this also blocks `advance()`.
 * - `optional` — the Section already contains records; the Add action
 *   is visible and enabled, but never blocks navigation.
 */
export type AddGateMode = 'mandatory' | 'optional';

/**
 * Multi-step flow context for a Section. Populated by
 * `AddGateProvider.registerFlow` (task 3.3).
 */
export interface AddGateFlow {
  /** Stable identifier for the flow (e.g. `'onboarding'`). */
  id: string;
  /** The step within the flow that this Section satisfies. */
  stepId: string;
  /** `true` once the flow has finished its final step. */
  complete: boolean;
}

/**
 * Snapshot of one Section's record count + flow binding, as exposed by
 * the shared store.
 */
export interface AddGateRecordSnapshot {
  recordCount: number;
  flow: AddGateFlow | null;
}

/**
 * Shape of the React Context that backs `useAddGate`.
 *
 * `AddGateProvider` (task 3.3) owns the canonical store and exposes a
 * read-only `getRecord(sectionId)` plus the imperative
 * `setRecordCount(sectionId, n)`. Until that provider is mounted,
 * {@link DEFAULT_CONTEXT} is used.
 */
export interface AddGateContextValue {
  /** Read the current snapshot for a Section; never throws. */
  getRecord: (sectionId: SectionId) => AddGateRecordSnapshot;
  /** Write the latest record count for a Section. */
  setRecordCount: (sectionId: SectionId, n: number) => void;
}

const DEFAULT_SNAPSHOT: AddGateRecordSnapshot = { recordCount: 0, flow: null };

/**
 * Context default used when no `AddGateProvider` is mounted.
 *
 * Returns a stable empty snapshot for every `sectionId` and silently
 * swallows writes. This keeps consumers safe to render in isolation
 * (Storybook, unit tests, the early waves of the umbrella rollout
 * before task 3.3 wires the provider).
 *
 * @internal
 */
const DEFAULT_CONTEXT: AddGateContextValue = {
  getRecord: () => DEFAULT_SNAPSHOT,
  setRecordCount: () => {
    /* noop until AddGateProvider (task 3.3) is mounted */
  },
};

/**
 * React Context that backs `useAddGate`. The provider lives in
 * `AddGateProvider.tsx` (task 3.3); consumers only ever read this via
 * `useAddGate(sectionId)`.
 */
export const AddGateContext = createContext<AddGateContextValue>(DEFAULT_CONTEXT);

/**
 * Translation key rendered as the Empty_State CTA when `mode` is
 * `mandatory` (R9.8). Backfilled into `en.json` / `ku.json` by task 6.4.
 */
const EMPTY_STATE_CTA_KEY: TranslationKey = asTranslationKey(
  'addGate.atLeastOneRequired',
);

/**
 * Translation key for the inline validation message shown when the user
 * attempts to proceed while `mode === 'mandatory'` (R9.4). Backfilled
 * into `en.json` / `ku.json` by task 6.4.
 */
const BLOCKED_MESSAGE_KEY: TranslationKey = asTranslationKey(
  'addGate.blockedMessage',
);

/**
 * The value returned by {@link useAddGate}. Mirrors the design contract
 * in `system-wide-ux-overhaul/design.md` → "Selective Add System".
 */
export interface AddGateState {
  /** Derived gate state — `mandatory` or `optional`. */
  mode: AddGateMode;
  /** Current record count for the Section, sourced from the store. */
  recordCount: number;
  /** Multi-step flow binding, or `null` outside any flow. */
  flow: AddGateFlow | null;
  /** Translation key for the Empty_State CTA when mandatory (R9.8). */
  emptyStateCtaKey: TranslationKey;
  /** Translation key for the inline blocked-validation message (R9.4). */
  blockedMessageKey: TranslationKey;
  /** Imperatively register the latest record count for this Section. */
  setRecordCount: (n: number) => void;
}

/**
 * Compute the initial `mode` for a freshly-mounted consumer.
 *
 * Per R9.3, an empty Section is `mandatory`; otherwise it is `optional`.
 * This is the only place the default rule applies without hysteresis —
 * subsequent transitions follow {@link transitionMode}.
 *
 * Exported so that property tests (Property 4 — AddGate monotonicity and
 * transition correctness) can validate the rule directly without
 * reaching through React.
 */
export function deriveInitialMode(recordCount: number): AddGateMode {
  return recordCount === 0 ? 'mandatory' : 'optional';
}

/**
 * Pure transition function for the Add_Gate state machine.
 *
 * Given the previous and next record counts, the previous `mode`, and
 * the current multi-step flow binding, return the next `mode` per the
 * formal transition rules in `system-wide-ux-overhaul/design.md` →
 * "Selective Add System":
 *
 * - `prevCount === nextCount`: no transition; `mode` unchanged.
 * - `0 → ≥ 1`: auto-demote to `optional` (R9.6).
 * - `≥ 1 → 0` inside an incomplete multi-step flow (`flow !== null &&
 *   !flow.complete`): re-promote to `mandatory` (R9.7).
 * - `≥ 1 → 0` outside an incomplete flow (no flow, or flow already
 *   complete): `mode` remains as it was — there is no "proceed" to
 *   block, so the hook keeps the previous `mode` rather than forcing
 *   `mandatory` (R9.7, design "outside such a flow, leave `mode` as it
 *   was").
 *
 * Exported so that Property 4 can validate the rule directly without
 * reaching through React. The hook's `useEffect` consumes this helper.
 *
 * _Validates: Requirements 9.6, 9.7_
 */
export function transitionMode(
  prevCount: number,
  nextCount: number,
  prevMode: AddGateMode,
  flow: AddGateFlow | null,
): AddGateMode {
  if (prevCount === nextCount) {
    return prevMode;
  }
  if (prevCount === 0 && nextCount >= 1) {
    return 'optional';
  }
  if (prevCount >= 1 && nextCount === 0) {
    const inIncompleteFlow = flow !== null && !flow.complete;
    return inIncompleteFlow ? 'mandatory' : prevMode;
  }
  // Both ≥ 1 (e.g. 3 → 7) or any other count change that does not
  // cross the empty-section boundary leaves `mode` as it was.
  return prevMode;
}

/**
 * Selective_Add gate hook.
 *
 * @param sectionId - The {@link SectionId} of the Section being gated.
 * @returns The current {@link AddGateState}.
 *
 * @remarks
 * The hook is intentionally a thin wrapper over the shared store: it
 * does not own any business state beyond the {@link AddGateMode}
 * hysteresis required by R9.7. Multi-step flow advancement, blocked
 * events, and per-section record bookkeeping all live in
 * `AddGateProvider` (task 3.3).
 */
export function useAddGate(sectionId: SectionId): AddGateState {
  const ctx = useContext(AddGateContext);
  const { recordCount, flow } = ctx.getRecord(sectionId);

  const [mode, setMode] = useState<AddGateMode>(() =>
    deriveInitialMode(recordCount),
  );
  const prevCountRef = useRef<number>(recordCount);

  useEffect(() => {
    const prev = prevCountRef.current;
    const next = recordCount;

    if (prev === next) {
      return;
    }

    setMode((current) => transitionMode(prev, next, current, flow));
    prevCountRef.current = next;
  }, [recordCount, flow]);

  const setRecordCount = useCallback(
    (n: number) => {
      ctx.setRecordCount(sectionId, n);
    },
    [ctx, sectionId],
  );

  return {
    mode,
    recordCount,
    flow,
    emptyStateCtaKey: EMPTY_STATE_CTA_KEY,
    blockedMessageKey: BLOCKED_MESSAGE_KEY,
    setRecordCount,
  };
}
