/**
 * Onboarding telemetry (T-LR.3.12)
 *
 * Spec: launch-readiness design.md §4.8
 *
 * Events:
 *   - onboarding.started
 *   - onboarding.step_completed     (step, elapsed_ms)
 *   - onboarding.step_skipped       (step)
 *   - onboarding.completed          (total_elapsed_ms, steps_skipped[])
 *   - onboarding.abandoned          (last_step, elapsed_ms)
 *
 * Transport: POST to `/api/rum/vitals` (the existing RUM ingest used by
 * world-class-performance R6.1). Failures swallow silently — telemetry must
 * never break the user flow.
 */

import api from '../api';

type WizardEventName =
  | 'onboarding.started'
  | 'onboarding.step_completed'
  | 'onboarding.step_skipped'
  | 'onboarding.completed'
  | 'onboarding.abandoned';

interface WizardEvent {
  event: WizardEventName;
  timestamp: number;
  tenant_id?: string;
  step?: number;
  elapsed_ms?: number;
  total_elapsed_ms?: number;
  steps_skipped?: number[];
}

function getTenantId(): string | undefined {
  try {
    const raw = localStorage.getItem('org.store.v1');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as {
      state?: { currentCompany?: { id?: string } };
    };
    return parsed?.state?.currentCompany?.id;
  } catch {
    return undefined;
  }
}

async function emit(event: WizardEvent): Promise<void> {
  // Don't await the network — fire-and-forget, swallow errors.
  try {
    await api.post('/api/rum/vitals', {
      kind: 'onboarding_event',
      payload: { ...event, tenant_id: event.tenant_id ?? getTenantId() },
    });
  } catch {
    // RUM failures must NEVER surface to user
  }
}

let started = false;

export const telemetry = {
  started(): void {
    if (started) return;
    started = true;
    void emit({ event: 'onboarding.started', timestamp: Date.now() });
  },

  stepCompleted(step: number, elapsed_ms: number): void {
    void emit({
      event: 'onboarding.step_completed',
      timestamp: Date.now(),
      step,
      elapsed_ms,
    });
  },

  stepSkipped(step: number): void {
    void emit({ event: 'onboarding.step_skipped', timestamp: Date.now(), step });
  },

  completed(total_elapsed_ms: number, steps_skipped: number[]): void {
    void emit({
      event: 'onboarding.completed',
      timestamp: Date.now(),
      total_elapsed_ms,
      steps_skipped,
    });
  },

  abandoned(last_step: number, elapsed_ms: number): void {
    void emit({
      event: 'onboarding.abandoned',
      timestamp: Date.now(),
      step: last_step,
      elapsed_ms,
    });
  },

  /** Test-only reset. */
  _resetStartedFlag(): void {
    started = false;
  },
};
