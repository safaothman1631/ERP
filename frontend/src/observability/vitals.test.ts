/**
 * Tests for VitalBatcher logic (T-0.1).
 *
 * Note: We exercise the batcher directly without invoking web-vitals so the
 * test does not need a full DOM lifecycle.
 */

import { describe, expect, it, vi } from 'vitest';
import { VitalBatcher, type VitalEvent, __test__ } from './vitals';

function makeEvent(overrides: Partial<VitalEvent> = {}): VitalEvent {
  return {
    sessionId: 's-1',
    appVersion: 'test',
    route: '/x',
    deviceClass: 'desktop',
    network: 'wifi',
    metric: 'LCP',
    value: 1234,
    rating: 'good',
    ts: 1_700_000_000_000,
    ...overrides,
  };
}

describe('VitalBatcher', () => {
  it('does not flush until BATCH_MAX events arrive', () => {
    const sender = vi.fn();
    const b = new VitalBatcher('/api/rum/vitals', sender);
    for (let i = 0; i < __test__.BATCH_MAX - 1; i++) {
      b.push(makeEvent());
    }
    expect(sender).not.toHaveBeenCalled();
    expect(b.peek().length).toBe(__test__.BATCH_MAX - 1);
  });

  it('auto-flushes once BATCH_MAX is reached', () => {
    const sender = vi.fn();
    const b = new VitalBatcher('/api/rum/vitals', sender);
    for (let i = 0; i < __test__.BATCH_MAX; i++) {
      b.push(makeEvent());
    }
    expect(sender).toHaveBeenCalledTimes(1);
    const sentBody = JSON.parse(sender.mock.calls[0][0] as string);
    expect(sentBody.events).toHaveLength(__test__.BATCH_MAX);
    expect(b.peek().length).toBe(0);
  });

  it('flush() is idempotent on an empty queue', () => {
    const sender = vi.fn();
    const b = new VitalBatcher('/api/rum/vitals', sender);
    b.flush();
    expect(sender).not.toHaveBeenCalled();
  });

  it('flush() drains queued events', () => {
    const sender = vi.fn();
    const b = new VitalBatcher('/api/rum/vitals', sender);
    b.push(makeEvent({ metric: 'CLS', value: 0.02 }));
    b.push(makeEvent({ metric: 'INP', value: 75 }));
    b.flush();
    expect(sender).toHaveBeenCalledTimes(1);
    const body = JSON.parse(sender.mock.calls[0][0] as string);
    expect(body.events).toHaveLength(2);
    expect(body.events[0].metric).toBe('CLS');
    expect(body.events[1].metric).toBe('INP');
  });

  it('flush(true) uses sendBeacon when available', () => {
    const beacon = vi.fn().mockReturnValue(true);
    const originalNav = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { sendBeacon: beacon },
    });
    const sender = vi.fn();
    try {
      const b = new VitalBatcher('/api/rum/vitals', sender);
      b.push(makeEvent());
      b.flush(true);
      expect(beacon).toHaveBeenCalledTimes(1);
      expect(sender).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNav,
      });
    }
  });
});
