/**
 * `AddGateProvider` — shared store for the Selective_Add system
 * (system-wide-ux-overhaul, R9.4, R10.1, R10.2, R10.3, R10.4).
 *
 * The provider owns two pieces of cross-cutting state used by every
 * Section that exposes an "Add" / "Create" action:
 *
 *   1. **Records** — the latest `recordCount` for each {@link SectionId},
 *      written through the imperative `setRecordCount(sectionId, n)`
 *      API exposed on {@link AddGateContext}.
 *   2. **Flows** — the multi-step onboarding / wizard flows registered
 *      via `registerFlow()`, evaluated at the moment the user attempts
 *      to advance via `advance(flowId)`.
 *
 * The provider populates the existing
 * {@link AddGateContext} (declared in `useAddGate.ts`) so that every
 * `useAddGate(sectionId)` consumer transparently sees live data. It
 * additionally exposes a sibling {@link AddGateFlowContext} for flow
 * orchestration (multi-step wizards, progress indicators, final-step
 * summaries) — the two contexts are split because most Sections only
 * need the per-section snapshot, while only wizard hosts need the flow
 * APIs. Splitting also means the flow API surface can grow without
 * disturbing the read-stable shape of `AddGateContextValue`.
 *
 * Contract — `advance(flowId)` (R9.4, R10.1, R10.4)
 * --------------------------------------------------
 *
 * - Looks up the flow's current step.
 * - If the step is **required** and the bound Section's
 *   `recordCount === 0`, returns `{ ok: false, blockedSection }` and
 *   leaves the flow's state untouched. The caller (typically a wizard
 *   shell) renders an inline validation message in the
 *   Active_Language and focuses the Add button (R9.4).
 * - Otherwise, marks the current step `completed`, advances
 *   `currentStepId` to the next still-incomplete step, and returns
 *   `{ ok: true, nextStepId }`. When no incomplete steps remain, the
 *   flow's `complete` flag flips to `true` and `advance` returns
 *   `{ ok: true, complete: true }`.
 *
 * Status surface (R10.3)
 * ----------------------
 *
 * Every step's live status — surfaced via {@link FlowView.steps[].status}
 * and consumed by progress indicators — is derived from `(records,
 * step.required, step.completed)`:
 *
 *   - `completed`       — `step.completed === true`.
 *   - `required-incomplete` — `step.required && recordCount === 0`.
 *   - `optional`        — anything else (including the
 *     "already configured" case from R10.2 where the Section already
 *     has records and the user can skip).
 *
 * Final-step summary (R10.4)
 * --------------------------
 *
 * `getUnsatisfiedRequiredSections(flowId)` returns the list of
 * required steps whose Sections still have `recordCount === 0`, each
 * with an optional `route` for deep-linking. The optional `route` is
 * carried on every {@link FlowStepBinding} and is the only piece of
 * authoring information this provider owns about routing — actual
 * navigation is performed by the caller via React Router.
 *
 * Default behaviour — no provider mounted
 * ---------------------------------------
 *
 * Until a host wraps its tree in `<AddGateProvider>`, components that
 * call `useAddGateFlow(flowId)` see the inert
 * {@link DEFAULT_FLOW_CONTEXT}: `getFlow` returns `null`, `advance`
 * succeeds as a no-op (`ok: true, complete: true`), and
 * `getUnsatisfiedRequiredSections` returns an empty array. This mirrors
 * the noop default already exported from `useAddGate.ts` so unit tests,
 * Storybook stories, and unmigrated routes never crash.
 *
 * _Validates: Requirements 9.4, 10.1, 10.2, 10.3, 10.4_
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { SectionId } from '../../help/sectionIds';
import {
  AddGateContext,
  type AddGateContextValue,
  type AddGateFlow,
  type AddGateRecordSnapshot,
} from './useAddGate';

// ─────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────

/**
 * The three values surfaced by the multi-step flow's progress indicator
 * (R10.3).
 *
 * - `required-incomplete` — the step is required and its Section is
 *   currently empty. `advance()` will block on this step.
 * - `optional` — the step is either explicitly optional, or it is
 *   required but already satisfied ("Optional — already configured",
 *   R10.2).
 * - `completed` — `advance()` has moved past this step.
 */
export type FlowStepStatus = 'required-incomplete' | 'optional' | 'completed';

/**
 * Authoring shape passed to {@link AddGateProvider} via its
 * `flowBindings` prop and to `registerFlow()` at runtime.
 *
 * `status` is the **initial** status used to seed the step's `required`
 * intent and (when `'completed'`) to pre-mark the step completed. The
 * live status surfaced through {@link FlowView} is recomputed on every
 * read, so consumers never need to re-`registerFlow` when a Section's
 * record count changes.
 */
export interface FlowStepBinding {
  /** Identifier of the multi-step flow this step belongs to. */
  flowId: string;
  /** Identifier of this step within the flow. Unique per `flowId`. */
  stepId: string;
  /** The Section this step is bound to. */
  sectionId: SectionId;
  /** Initial status (also encodes the "is required?" intent). */
  status: FlowStepStatus;
  /**
   * Optional deep-link route used by the final-step summary so the
   * user can jump back to an unsatisfied required Section (R10.4).
   */
  route?: string;
}

export interface AddGateProviderProps {
  /**
   * Flow definitions to register up-front. Bindings sharing the same
   * `flowId` are grouped into a single flow whose step order matches
   * the order of the bindings array. Additional flows can be added at
   * runtime via {@link AddGateFlowContextValue.registerFlow}.
   */
  flowBindings?: FlowStepBinding[];
  children: React.ReactNode;
}

/**
 * Live read-only view of one step inside a flow.
 */
export interface FlowStepView {
  stepId: string;
  sectionId: SectionId;
  status: FlowStepStatus;
  route?: string;
}

/**
 * Live read-only view of one flow.
 *
 * `currentStepId` is `null` only when the flow has been registered
 * with no steps; in normal use it always points at a real step. When
 * `complete === true`, `currentStepId` retains the id of the last
 * step that was advanced past so callers can render summary state for
 * that step.
 */
export interface FlowView {
  flowId: string;
  steps: FlowStepView[];
  currentStepId: string | null;
  complete: boolean;
  /**
   * `true` when the current step is the last incomplete step in the
   * flow. Wizard shells use this to show the final-step summary
   * (R10.4) alongside the "advance" / "finish" CTA.
   */
  isFinalStep: boolean;
}

/**
 * Result of {@link AddGateFlowContextValue.advance}.
 *
 * - `ok: false` — the current step was required and its Section was
 *   empty. `blockedSection` carries the offending {@link SectionId}.
 *   The flow's state is **not** mutated.
 * - `ok: true` — the current step was advanced past. `nextStepId` is
 *   the new `currentStepId` if any incomplete steps remain;
 *   `complete: true` is set when the flow has finished.
 */
export interface AdvanceResult {
  ok: boolean;
  blockedSection?: SectionId;
  nextStepId?: string;
  complete?: boolean;
}

/**
 * One entry in the final-step summary (R10.4).
 */
export interface UnsatisfiedSection {
  sectionId: SectionId;
  stepId: string;
  /** Deep link from the binding, if any. */
  route?: string;
}

/**
 * The flow-orchestration context. Hosted by {@link AddGateProvider};
 * read by `useAddGateFlow(flowId)`.
 */
export interface AddGateFlowContextValue {
  /**
   * Register (or replace) a flow. All bindings in `bindings` are
   * grouped by `flowId`; a flow registered with no bindings is
   * removed.
   */
  registerFlow: (bindings: FlowStepBinding[]) => void;
  /** Attempt to advance the flow's current step. */
  advance: (flowId: string) => AdvanceResult;
  /** Read the live view of a flow, or `null` if not registered. */
  getFlow: (flowId: string) => FlowView | null;
  /** List required sections whose `recordCount` is still `0`. */
  getUnsatisfiedRequiredSections: (flowId: string) => UnsatisfiedSection[];
}

// ─────────────────────────────────────────────────────────────────────
// Internal types & helpers
// ─────────────────────────────────────────────────────────────────────

interface FlowStepInternal {
  stepId: string;
  sectionId: SectionId;
  /**
   * Whether the step is required at all. Derived from the binding's
   * initial `status === 'required-incomplete'`.
   */
  required: boolean;
  /** `true` once `advance()` has moved past this step. */
  completed: boolean;
  route?: string;
}

interface FlowInternal {
  flowId: string;
  steps: FlowStepInternal[];
  currentStepId: string | null;
  complete: boolean;
}

/**
 * Group bindings by `flowId` and build the internal flow shape.
 *
 * Bindings whose initial `status === 'completed'` are pre-marked
 * completed so that flows resumed from persistence (e.g. a partly-
 * finished onboarding) start at the right step. Bindings whose
 * `status === 'optional'` carry `required: false`. Bindings whose
 * `status === 'required-incomplete'` carry `required: true`.
 */
function buildFlowsFromBindings(
  bindings: readonly FlowStepBinding[],
): Map<string, FlowInternal> {
  const groups = new Map<string, FlowStepBinding[]>();
  for (const b of bindings) {
    const existing = groups.get(b.flowId);
    if (existing) {
      existing.push(b);
    } else {
      groups.set(b.flowId, [b]);
    }
  }
  const result = new Map<string, FlowInternal>();
  for (const [flowId, items] of groups) {
    const steps: FlowStepInternal[] = items.map((b) => ({
      stepId: b.stepId,
      sectionId: b.sectionId,
      required: b.status === 'required-incomplete',
      completed: b.status === 'completed',
      route: b.route,
    }));
    const firstIncomplete = steps.find((s) => !s.completed);
    const allComplete = steps.length > 0 && steps.every((s) => s.completed);
    const currentStepId =
      firstIncomplete?.stepId ??
      (steps.length > 0 ? steps[steps.length - 1]!.stepId : null);
    result.set(flowId, {
      flowId,
      steps,
      currentStepId,
      complete: allComplete,
    });
  }
  return result;
}

/**
 * Compute one step's live status from the AddGate state.
 */
function deriveStepStatus(
  step: FlowStepInternal,
  recordCount: number,
): FlowStepStatus {
  if (step.completed) return 'completed';
  if (step.required && recordCount === 0) return 'required-incomplete';
  return 'optional';
}

// ─────────────────────────────────────────────────────────────────────
// Default flow context — used when no provider is mounted
// ─────────────────────────────────────────────────────────────────────

/**
 * Inert default for {@link AddGateFlowContext}. `advance` succeeds as
 * a no-op so wizards don't deadlock if the provider is missing in
 * test or Storybook environments; the rest of the API returns empty
 * values.
 */
const DEFAULT_FLOW_CONTEXT: AddGateFlowContextValue = {
  registerFlow: () => {
    /* noop until AddGateProvider is mounted */
  },
  advance: () => ({ ok: true, complete: true }),
  getFlow: () => null,
  getUnsatisfiedRequiredSections: () => [],
};

/**
 * React Context that backs `useAddGateFlow`. Hosted by
 * {@link AddGateProvider}; consumers should prefer the
 * `useAddGateFlow(flowId)` hook below over reading this directly.
 */
export const AddGateFlowContext =
  createContext<AddGateFlowContextValue>(DEFAULT_FLOW_CONTEXT);

// ─────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────

/**
 * Shared store + context host for the Selective_Add system. See the
 * file-level JSDoc for the full contract.
 */
export const AddGateProvider: React.FC<AddGateProviderProps> = ({
  flowBindings,
  children,
}) => {
  // ── Records ──────────────────────────────────────────────────────
  const [records, setRecords] = useState<ReadonlyMap<SectionId, number>>(
    () => new Map<SectionId, number>(),
  );

  // ── Flows (seeded from props, mutated via registerFlow / advance) ─
  const [flows, setFlows] = useState<ReadonlyMap<string, FlowInternal>>(() =>
    buildFlowsFromBindings(flowBindings ?? []),
  );

  // Refs mirror the latest state so the imperative callbacks
  // (`advance`, `setRecordCount`, …) always read fresh data without
  // forcing every consumer to re-subscribe through the dependency
  // array of `useCallback`.
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const flowsRef = useRef(flows);
  flowsRef.current = flows;

  // ── Per-section flow snapshot (referentially stable per flows
  // ── change). `getRecord(sectionId)` reads `flow` from this map so
  // ── that `useAddGate`'s `useEffect([recordCount, flow])` does not
  // ── fire spuriously on unrelated record updates.
  const flowForSectionMap = useMemo<ReadonlyMap<SectionId, AddGateFlow>>(() => {
    const map = new Map<SectionId, AddGateFlow>();
    for (const flow of flows.values()) {
      if (flow.complete) continue;
      for (const step of flow.steps) {
        if (step.completed) continue;
        if (map.has(step.sectionId)) continue;
        map.set(step.sectionId, {
          id: flow.flowId,
          stepId: step.stepId,
          complete: flow.complete,
        });
      }
    }
    return map;
  }, [flows]);

  // ── AddGateContextValue (records side) ───────────────────────────
  const setRecordCount = useCallback((sectionId: SectionId, n: number) => {
    setRecords((prev) => {
      const previous = prev.get(sectionId) ?? 0;
      if (previous === n) return prev;
      const next = new Map(prev);
      next.set(sectionId, n);
      return next;
    });
  }, []);

  const getRecord = useCallback(
    (sectionId: SectionId): AddGateRecordSnapshot => {
      const recordCount = recordsRef.current.get(sectionId) ?? 0;
      const flow = flowForSectionMap.get(sectionId) ?? null;
      return { recordCount, flow };
    },
    [flowForSectionMap],
  );

  const recordContextValue = useMemo<AddGateContextValue>(
    () => ({ getRecord, setRecordCount }),
    [getRecord, setRecordCount],
  );

  // ── AddGateFlowContextValue (flows side) ─────────────────────────
  const registerFlow = useCallback((bindings: FlowStepBinding[]) => {
    const fresh = buildFlowsFromBindings(bindings);
    setFlows((prev) => {
      const next = new Map(prev);
      // If `bindings` is empty for a previously-registered flowId,
      // skip — empty bindings cannot identify a flow to remove. The
      // caller explicitly registers an empty list per flowId via
      // `bindings = []` only when wiping all flows, in which case we
      // simply leave existing flows in place. To remove a specific
      // flow, register it with a single binding of completed steps,
      // or expose a future `unregisterFlow` API.
      for (const [flowId, flow] of fresh) {
        next.set(flowId, flow);
      }
      return next;
    });
  }, []);

  const advance = useCallback((flowId: string): AdvanceResult => {
    const flow = flowsRef.current.get(flowId);
    if (!flow) {
      // Unknown flow — treat as a no-op success so callers that
      // optimistically `advance()` before `registerFlow()` do not
      // hang. This is consistent with the inert default context.
      return { ok: true, complete: true };
    }
    if (flow.complete) {
      return { ok: true, complete: true };
    }
    const idx = flow.steps.findIndex((s) => s.stepId === flow.currentStepId);
    if (idx === -1) {
      // currentStepId points at no step (e.g. flow had no steps).
      // Mark complete and bail.
      setFlows((prev) => {
        const next = new Map(prev);
        next.set(flowId, { ...flow, complete: true });
        return next;
      });
      return { ok: true, complete: true };
    }
    const step = flow.steps[idx]!;
    const recordCount = recordsRef.current.get(step.sectionId) ?? 0;

    // Block: required step + empty Section (R9.4, R10.1).
    if (step.required && recordCount === 0 && !step.completed) {
      return { ok: false, blockedSection: step.sectionId };
    }

    // Advance: mark current step completed; find next incomplete.
    const updatedSteps = flow.steps.map((s, i) =>
      i === idx ? { ...s, completed: true } : s,
    );
    const nextIncomplete = updatedSteps.find((s, i) => i > idx && !s.completed);
    const allComplete = updatedSteps.every((s) => s.completed);

    setFlows((prev) => {
      const next = new Map(prev);
      next.set(flowId, {
        ...flow,
        steps: updatedSteps,
        currentStepId: nextIncomplete?.stepId ?? flow.currentStepId,
        complete: allComplete,
      });
      return next;
    });

    if (nextIncomplete) {
      return { ok: true, nextStepId: nextIncomplete.stepId, complete: false };
    }
    return { ok: true, complete: true };
  }, []);

  const buildFlowView = useCallback(
    (flow: FlowInternal): FlowView => {
      const recordsNow = recordsRef.current;
      const steps: FlowStepView[] = flow.steps.map((s) => {
        const view: FlowStepView = {
          stepId: s.stepId,
          sectionId: s.sectionId,
          status: deriveStepStatus(s, recordsNow.get(s.sectionId) ?? 0),
        };
        if (s.route !== undefined) {
          view.route = s.route;
        }
        return view;
      });
      const currentIdx = flow.currentStepId
        ? flow.steps.findIndex((s) => s.stepId === flow.currentStepId)
        : -1;
      const remainingIncomplete = flow.steps
        .slice(currentIdx === -1 ? 0 : currentIdx + 1)
        .some((s) => !s.completed);
      const isFinalStep =
        !flow.complete && flow.currentStepId !== null && !remainingIncomplete;
      return {
        flowId: flow.flowId,
        steps,
        currentStepId: flow.currentStepId,
        complete: flow.complete,
        isFinalStep,
      };
    },
    // `recordsRef`/`flowsRef` are refs; reads are inherently fresh.
    [],
  );

  const getFlow = useCallback(
    (flowId: string): FlowView | null => {
      const flow = flowsRef.current.get(flowId);
      if (!flow) return null;
      return buildFlowView(flow);
    },
    [buildFlowView],
  );

  const getUnsatisfiedRequiredSections = useCallback(
    (flowId: string): UnsatisfiedSection[] => {
      const flow = flowsRef.current.get(flowId);
      if (!flow) return [];
      const recordsNow = recordsRef.current;
      const result: UnsatisfiedSection[] = [];
      for (const step of flow.steps) {
        if (!step.required) continue;
        if (step.completed) continue;
        const recordCount = recordsNow.get(step.sectionId) ?? 0;
        if (recordCount > 0) continue;
        const entry: UnsatisfiedSection = {
          sectionId: step.sectionId,
          stepId: step.stepId,
        };
        if (step.route !== undefined) {
          entry.route = step.route;
        }
        result.push(entry);
      }
      return result;
    },
    [],
  );

  // Reading flows via the React state value (not the ref) here is
  // deliberate so consumers re-render when the flow set changes.
  const flowContextValue = useMemo<AddGateFlowContextValue>(
    () => ({
      registerFlow,
      advance,
      getFlow,
      getUnsatisfiedRequiredSections,
    }),
    // `flows` is included so the memo identity changes when the flow
    // set changes, which forces consumers to re-derive their views.
    // The callbacks themselves remain referentially stable across
    // re-renders, but the wrapping object identity must update so
    // `useContext` triggers a re-render.
    [flows, registerFlow, advance, getFlow, getUnsatisfiedRequiredSections],
  );

  return (
    <AddGateContext.Provider value={recordContextValue}>
      <AddGateFlowContext.Provider value={flowContextValue}>
        {children}
      </AddGateFlowContext.Provider>
    </AddGateContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Convenience hook
// ─────────────────────────────────────────────────────────────────────

/**
 * Read the live view of a flow plus a bound `advance()` callback and
 * the final-step unsatisfied-required-sections summary.
 *
 * The returned `flow` is a snapshot at render time; callers that need
 * to react to flow updates simply re-read from this hook on subsequent
 * renders (the provider triggers re-renders when records or flows
 * change).
 */
export function useAddGateFlow(flowId: string): {
  flow: FlowView | null;
  advance: () => AdvanceResult;
  unsatisfiedRequired: UnsatisfiedSection[];
} {
  const ctx = useContext(AddGateFlowContext);
  const flow = ctx.getFlow(flowId);
  const advance = useCallback(() => ctx.advance(flowId), [ctx, flowId]);
  const unsatisfiedRequired = ctx.getUnsatisfiedRequiredSections(flowId);
  return { flow, advance, unsatisfiedRequired };
}

export default AddGateProvider;
