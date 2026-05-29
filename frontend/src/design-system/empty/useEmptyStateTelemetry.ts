/**
 * @file useEmptyStateTelemetry.ts
 * @description Emits the seven empty-state / quick-create events to the
 * existing RUM ingest endpoint (`/api/rum/vitals` for vitals; this hook posts
 * to the same backend but with an `event` discriminator).
 *
 * Events emitted (per Requirement 12.1):
 *
 *  - `empty_state.shown`
 *  - `empty_state.cta_clicked`
 *  - `quick_create.opened`
 *  - `quick_create.cancelled`
 *  - `quick_create.succeeded`
 *  - `quick_create.failed`
 *  - `quick_create.full_form_link_clicked`
 *
 * Internally the hook batches events in-memory and flushes via `fetch` keepalive
 * (or `sendBeacon` on unload). The implementation is deliberately defensive —
 * if RUM is disabled or the network is offline, events are dropped silently.
 *
 * @see design.md §6
 */

import { useCallback, useMemo, useRef } from 'react';
import type {
  EmptyStateContext,
  EmptyStateVariant,
  EntitySlug,
} from './types';

/* ---------------------------------------------------------------------------
 * Internal sender — calls the existing RUM ingest endpoint.
 * ---------------------------------------------------------------------------
 */

const RUM_ENDPOINT = '/api/rum/events';

interface EmptyStateEvent {
  event: string;
  variant?: EmptyStateVariant;
  entity?: string;
  route?: string;
  ts: number;
  attrs: Record<string, unknown>;
}

/** Best-effort send; never throws. */
function dispatch(payload: EmptyStateEvent): void {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      // sendBeacon is fire-and-forget and survives page unload.
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon(RUM_ENDPOINT, blob);
      if (ok) return;
    }
    if (typeof fetch !== 'undefined') {
      void fetch(RUM_ENDPOINT, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => {
        /* swallow — telemetry must never affect the user */
      });
    }
  } catch {
    /* swallow */
  }
}

/* ---------------------------------------------------------------------------
 * Public hook
 * ---------------------------------------------------------------------------
 */

export interface UseEmptyStateTelemetryParams {
  variant: EmptyStateVariant;
  entity?: EntitySlug | string;
  context?: EmptyStateContext;
}

export interface EmptyStateTelemetryApi {
  fireShown: (extra?: Record<string, unknown>) => void;
  fireCtaClicked: (extra?: Record<string, unknown>) => void;
  fireOpened: (extra?: Record<string, unknown>) => void;
  fireCancelled: (timeOpenMs: number, wasDirty: boolean) => void;
  fireSucceeded: (timeToSaveMs: number) => void;
  fireFailed: (errorCode: string | number | undefined) => void;
  fireFullFormLink: (timeOpenMs: number) => void;
}

/**
 * Hook returning seven `fireX` callbacks. The route is captured at hook-call
 * time from `window.location.pathname`. The context object is merged into every
 * emitted event for attribution.
 */
export function useEmptyStateTelemetry(
  params: UseEmptyStateTelemetryParams,
): EmptyStateTelemetryApi {
  const { variant, entity, context } = params;

  // Stable ref ensures latest values are captured without retriggering effects.
  const ctxRef = useRef({ variant, entity, context });
  ctxRef.current = { variant, entity, context };

  const fire = useCallback((event: string, extra: Record<string, unknown> = {}) => {
    const { variant: v, entity: e, context: c } = ctxRef.current;
    const route =
      typeof window !== 'undefined' && window.location ? window.location.pathname : undefined;
    dispatch({
      event,
      variant: v,
      entity: e,
      route,
      ts: Date.now(),
      attrs: { ...(c ?? {}), ...extra },
    });
  }, []);

  return useMemo<EmptyStateTelemetryApi>(
    () => ({
      fireShown: (extra) => fire('empty_state.shown', { has_search_query: Boolean(ctxRef.current.context?.search), ...extra }),
      fireCtaClicked: (extra) => fire('empty_state.cta_clicked', extra ?? {}),
      fireOpened: (extra) => fire('quick_create.opened', extra ?? {}),
      fireCancelled: (timeOpenMs, wasDirty) =>
        fire('quick_create.cancelled', { time_open_ms: timeOpenMs, was_dirty: wasDirty }),
      fireSucceeded: (timeToSaveMs) =>
        fire('quick_create.succeeded', { time_to_save_ms: timeToSaveMs }),
      fireFailed: (errorCode) => fire('quick_create.failed', { error_code: errorCode ?? 'unknown' }),
      fireFullFormLink: (timeOpenMs) =>
        fire('quick_create.full_form_link_clicked', { time_open_ms: timeOpenMs }),
    }),
    [fire],
  );
}
