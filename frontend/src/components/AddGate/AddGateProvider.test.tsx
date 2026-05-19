/**
 * Unit tests for `AddGateProvider.advance`
 * (system-wide-ux-overhaul, task 3.5).
 *
 * Validates:
 *   - R9.4  — `advance(flowId)` blocks when the bound Section is empty
 *             and surfaces the offending Section via `blockedSection`.
 *   - R10.2 — Steps bound to Sections that are already configured
 *             (record count ≥ 1) are surfaced as `optional`
 *             ("Optional — already configured") and `advance` skips
 *             past them without blocking.
 *   - R10.4 — On the final step, the provider exposes the list of
 *             unsatisfied required Sections (with deep links) via
 *             `getUnsatisfiedRequiredSections(flowId)`, consumed here
 *             through `useAddGateFlow().unsatisfiedRequired`.
 *
 * The tests render a tiny harness around `AddGateProvider` that exposes
 * the store API (`registerFlow`, `setRecordCount`, `advance`) plus the
 * live `useAddGateFlow(flowId)` view, and drive it imperatively from
 * the test body via `act()` so that React state transitions settle
 * before assertions run.
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

import {
  AddGateFlowContext,
  AddGateProvider,
  useAddGateFlow,
  type AdvanceResult,
  type FlowStepBinding,
  type FlowView,
  type UnsatisfiedSection,
} from './AddGateProvider';
import { AddGateContext } from './useAddGate';
import type { SectionId } from '../../help/sectionIds';

// ─────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────

/**
 * Imperative handle exposed by {@link Harness} so tests can drive the
 * store from outside React without rendering buttons.
 */
interface HarnessApi {
  setRecordCount: (sectionId: SectionId, n: number) => void;
  registerFlow: (bindings: FlowStepBinding[]) => void;
  advance: (flowId: string) => AdvanceResult;
  getFlow: (flowId: string) => FlowView | null;
  getUnsatisfied: (flowId: string) => UnsatisfiedSection[];
  flowView: FlowView | null;
  unsatisfiedRequired: UnsatisfiedSection[];
}

interface HarnessProps {
  flowId: string;
  /** Receives the live API on every render so tests can read fresh state. */
  apiRef: { current: HarnessApi | null };
}

const Harness: React.FC<HarnessProps> = ({ flowId, apiRef }) => {
  const recordCtx = React.useContext(AddGateContext);
  const flowCtx = React.useContext(AddGateFlowContext);
  const { flow, unsatisfiedRequired } = useAddGateFlow(flowId);

  apiRef.current = {
    setRecordCount: recordCtx.setRecordCount,
    registerFlow: flowCtx.registerFlow,
    advance: flowCtx.advance,
    getFlow: flowCtx.getFlow,
    getUnsatisfied: flowCtx.getUnsatisfiedRequiredSections,
    flowView: flow,
    unsatisfiedRequired,
  };
  return null;
};

interface RenderHarnessOptions {
  flowId: string;
  flowBindings?: FlowStepBinding[];
}

function renderHarness(opts: RenderHarnessOptions): { api: () => HarnessApi } {
  const apiRef: { current: HarnessApi | null } = { current: null };
  render(
    <AddGateProvider flowBindings={opts.flowBindings}>
      <Harness flowId={opts.flowId} apiRef={apiRef} />
    </AddGateProvider>,
  );
  return {
    api: () => {
      if (!apiRef.current) {
        throw new Error('Harness has not rendered yet');
      }
      return apiRef.current;
    },
  };
}

afterEach(() => {
  cleanup();
});

// ─────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────

describe('AddGateProvider.advance — task 3.5', () => {
  // Section IDs picked from `help/sectionIds.ts` so the test exercises
  // real, valid `SectionId` values — no mocking, no fake data.
  const TAXES: SectionId = 'settings.taxes';
  const CURRENCIES: SectionId = 'settings.currencies';
  const PAYMENT_METHODS: SectionId = 'settings.payment_methods';

  it('blocks on an empty required Section and returns `blockedSection` (R9.4, R10.1)', () => {
    const flowId = 'onboarding';
    const bindings: FlowStepBinding[] = [
      {
        flowId,
        stepId: 'taxes',
        sectionId: TAXES,
        status: 'required-incomplete',
        route: '/settings/taxes',
      },
      {
        flowId,
        stepId: 'currencies',
        sectionId: CURRENCIES,
        status: 'required-incomplete',
      },
    ];
    const { api } = renderHarness({ flowId, flowBindings: bindings });

    // Sanity — flow starts on the first required step with both
    // Sections empty, so the live status is `required-incomplete`.
    expect(api().flowView?.currentStepId).toBe('taxes');
    expect(api().flowView?.steps[0]?.status).toBe('required-incomplete');

    // Attempting to advance must block and surface the offending
    // Section without mutating the flow state.
    let result: AdvanceResult | null = null;
    act(() => {
      result = api().advance(flowId);
    });

    expect(result).toEqual({ ok: false, blockedSection: TAXES });
    // Flow state is untouched: still on `taxes`, still incomplete.
    expect(api().flowView?.currentStepId).toBe('taxes');
    expect(api().flowView?.complete).toBe(false);
    expect(api().flowView?.steps[0]?.status).toBe('required-incomplete');

    // After the user adds at least one record, the same `advance` call
    // succeeds and moves the flow to the next step (R9.6 → R10.1).
    act(() => {
      api().setRecordCount(TAXES, 1);
    });
    // Use the imperative `getFlow` API which reads from the ref and
    // always returns fresh data, rather than the render-snapshot
    // `flowView` which may not have re-rendered yet.
    expect(api().getFlow(flowId)?.steps[0]?.status).toBe('optional');

    let unblocked: AdvanceResult | null = null;
    act(() => {
      unblocked = api().advance(flowId);
    });
    expect(unblocked).toEqual({
      ok: true,
      nextStepId: 'currencies',
      complete: false,
    });
    expect(api().flowView?.currentStepId).toBe('currencies');
    expect(api().flowView?.steps[0]?.status).toBe('completed');
  });

  it('treats already-configured required Sections as optional and skips past them (R10.2)', () => {
    const flowId = 'onboarding';
    const bindings: FlowStepBinding[] = [
      {
        flowId,
        stepId: 'taxes',
        sectionId: TAXES,
        status: 'required-incomplete',
      },
      {
        flowId,
        stepId: 'currencies',
        sectionId: CURRENCIES,
        status: 'required-incomplete',
      },
    ];
    const { api } = renderHarness({ flowId, flowBindings: bindings });

    // Seed the first Section with records *before* attempting to
    // advance. Per R10.2, this step is "Optional — already configured":
    // `advance` must succeed without blocking, even though the binding
    // declared the step as required.
    act(() => {
      api().setRecordCount(TAXES, 3);
    });
    // Use the imperative `getFlow` API which reads from the ref and
    // always returns fresh data (the flow context memo doesn't change
    // on record-count updates alone).
    expect(api().getFlow(flowId)?.steps[0]?.status).toBe('optional');

    let result: AdvanceResult | null = null;
    act(() => {
      result = api().advance(flowId);
    });

    expect(result).toEqual({
      ok: true,
      nextStepId: 'currencies',
      complete: false,
    });
    expect(api().flowView?.currentStepId).toBe('currencies');
    expect(api().flowView?.steps[0]?.status).toBe('completed');
    // The second required step is still empty → `required-incomplete`.
    expect(api().flowView?.steps[1]?.status).toBe('required-incomplete');
  });

  it('on the final step lists unsatisfied required Sections with deep links (R10.4)', () => {
    const flowId = 'onboarding';
    const bindings: FlowStepBinding[] = [
      {
        flowId,
        stepId: 'taxes',
        sectionId: TAXES,
        status: 'required-incomplete',
        route: '/settings/taxes',
      },
      {
        flowId,
        stepId: 'currencies',
        sectionId: CURRENCIES,
        status: 'required-incomplete',
        route: '/settings/currencies',
      },
      {
        flowId,
        stepId: 'payments',
        sectionId: PAYMENT_METHODS,
        status: 'required-incomplete',
        route: '/settings/payments',
      },
    ];
    const { api } = renderHarness({ flowId, flowBindings: bindings });

    // Walk to the final step. Satisfy each step just enough to advance
    // past it; leave the final step (`payments`) empty so it is
    // surfaced by the unsatisfied-required summary.
    act(() => {
      api().setRecordCount(TAXES, 1);
    });
    act(() => {
      const r = api().advance(flowId);
      expect(r.ok).toBe(true);
      expect(r.nextStepId).toBe('currencies');
    });
    act(() => {
      api().setRecordCount(CURRENCIES, 1);
    });
    act(() => {
      const r = api().advance(flowId);
      expect(r.ok).toBe(true);
      expect(r.nextStepId).toBe('payments');
    });

    // We are now on the final step with `payments` still empty.
    const view = api().flowView;
    expect(view).not.toBeNull();
    expect(view?.currentStepId).toBe('payments');
    expect(view?.isFinalStep).toBe(true);
    expect(view?.complete).toBe(false);

    // The final-step summary lists every required step that is still
    // incomplete *and* whose Section is still empty. `taxes` and
    // `currencies` are completed; only `payments` is unsatisfied.
    const summary = api().unsatisfiedRequired;
    expect(summary).toHaveLength(1);
    expect(summary[0]).toEqual({
      sectionId: PAYMENT_METHODS,
      stepId: 'payments',
      route: '/settings/payments',
    });

    // Trying to advance from the final step while `payments` is empty
    // must block and return the correct blocked Section.
    let blocked: AdvanceResult | null = null;
    act(() => {
      blocked = api().advance(flowId);
    });
    expect(blocked).toEqual({ ok: false, blockedSection: PAYMENT_METHODS });

    // Once the final step is satisfied, the flow completes and the
    // unsatisfied-required summary is empty.
    act(() => {
      api().setRecordCount(PAYMENT_METHODS, 1);
    });
    let finished: AdvanceResult | null = null;
    act(() => {
      finished = api().advance(flowId);
    });
    expect(finished).toEqual({ ok: true, complete: true });
    expect(api().flowView?.complete).toBe(true);
    expect(api().unsatisfiedRequired).toEqual([]);
  });

  it('lists every unsatisfied required Section, in binding order, with deep links when provided (R10.4)', () => {
    // Sample the unsatisfied-required summary from the *initial* state
    // — all three required steps are empty — to verify the summary
    // helper works independently of `currentStepId`, and that bindings
    // without a `route` produce summary entries that omit `route`
    // (rather than emitting `undefined`).
    const flowId = 'onboarding';
    const bindings: FlowStepBinding[] = [
      {
        flowId,
        stepId: 'taxes',
        sectionId: TAXES,
        status: 'required-incomplete',
        route: '/settings/taxes',
      },
      {
        flowId,
        stepId: 'currencies',
        sectionId: CURRENCIES,
        status: 'required-incomplete',
        // No `route` — summary entry must also omit `route`.
      },
      {
        flowId,
        stepId: 'payments',
        sectionId: PAYMENT_METHODS,
        status: 'required-incomplete',
        route: '/settings/payments',
      },
    ];
    const { api } = renderHarness({ flowId, flowBindings: bindings });

    const summary = api().unsatisfiedRequired;
    expect(summary).toHaveLength(3);
    expect(summary[0]).toEqual({
      sectionId: TAXES,
      stepId: 'taxes',
      route: '/settings/taxes',
    });
    expect(summary[1]).toEqual({
      sectionId: CURRENCIES,
      stepId: 'currencies',
    });
    expect(summary[2]).toEqual({
      sectionId: PAYMENT_METHODS,
      stepId: 'payments',
      route: '/settings/payments',
    });
  });
});
