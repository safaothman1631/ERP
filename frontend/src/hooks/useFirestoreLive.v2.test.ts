/**
 * @file useFirestoreLive.v2.test.ts
 * @description Vitest coverage for the time-boxed Firestore subscription hook.
 *
 * The Firebase Firestore SDK is mocked at module scope so the tests can:
 *   - assert that `onSnapshot` is invoked,
 *   - drive snapshots synchronously,
 *   - simulate errors,
 *   - and verify the idle-detach / re-attach paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/* ------------------------------------------------------------------------- */
/* Mock firebase/firestore                                                    */
/* ------------------------------------------------------------------------- */

type SnapHandler = (snap: any) => void;
type ErrHandler = (err: Error) => void;

const onSnapshotMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ __kind: 'collection', path }),
  doc: (_db: unknown, path: string) => ({ __kind: 'doc', path }),
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
}));

vi.mock('../firebase', () => ({
  db: {},
}));

import {
  useFirestoreLive,
  activeListeners,
  LISTENER_WARNING_THRESHOLD,
} from './useFirestoreLive.v2';

/* ------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* ------------------------------------------------------------------------- */

/** Build a fake collection snapshot that responds to `forEach`. */
function fakeCollectionSnapshot(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>,
) {
  return {
    forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) =>
      docs.forEach(cb),
  };
}

/** Build a fake document snapshot. */
function fakeDocSnapshot(
  exists: boolean,
  id: string,
  data: Record<string, unknown> = {},
) {
  return {
    exists: () => exists,
    id,
    data: () => data,
  };
}

/** Pull the (next, error) handlers out of the most recent onSnapshot call. */
function lastSnapshotHandlers(): { next: SnapHandler; err: ErrHandler } {
  const call = onSnapshotMock.mock.calls.at(-1)!;
  // signature: onSnapshot(ref, next, err)
  return { next: call[1] as SnapHandler, err: call[2] as ErrHandler };
}

/* ------------------------------------------------------------------------- */
/* Setup                                                                      */
/* ------------------------------------------------------------------------- */

let unsubSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  onSnapshotMock.mockReset();
  unsubSpy = vi.fn();
  onSnapshotMock.mockImplementation(() => unsubSpy);
  activeListeners.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------------------------- */
/* Tests                                                                      */
/* ------------------------------------------------------------------------- */

describe('useFirestoreLive (v2)', () => {
  it('subscribes on mount and exposes the first snapshot', () => {
    const { result } = renderHook(() =>
      useFirestoreLive<{ id: string; name: string }>(
        'tenants/t1/items',
      ),
    );

    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true);

    act(() => {
      const { next } = lastSnapshotHandlers();
      next(
        fakeCollectionSnapshot([
          { id: 'a', data: () => ({ name: 'Alpha' }) },
          { id: 'b', data: () => ({ name: 'Beta' }) },
        ]),
      );
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual([
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
    ]);
    expect(result.current.lastSnapshotAt).toBeTypeOf('number');
    expect(result.current.isStale).toBe(false);
  });

  it('filters out soft-deleted documents', () => {
    const { result } = renderHook(() =>
      useFirestoreLive('tenants/t1/items'),
    );
    act(() => {
      const { next } = lastSnapshotHandlers();
      next(
        fakeCollectionSnapshot([
          { id: 'a', data: () => ({ name: 'Alpha' }) },
          { id: 'b', data: () => ({ name: 'Gone', deleted_at: 12345 }) },
        ]),
      );
    });
    expect((result.current.data as unknown[]).length).toBe(1);
  });

  it('treats even-segment paths as a single document', () => {
    const { result } = renderHook(() =>
      useFirestoreLive<{ id: string; total: number }>(
        'tenants/t1/invoices/inv-1',
      ),
    );

    act(() => {
      const { next } = lastSnapshotHandlers();
      next(fakeDocSnapshot(true, 'inv-1', { total: 99 }));
    });

    expect(result.current.data).toEqual({ id: 'inv-1', total: 99 });
  });

  it('returns null data when a document does not exist', () => {
    const { result } = renderHook(() =>
      useFirestoreLive('tenants/t1/invoices/missing'),
    );
    act(() => {
      const { next } = lastSnapshotHandlers();
      next(fakeDocSnapshot(false, 'missing'));
    });
    expect(result.current.data).toBeNull();
  });

  it('detaches after the idle period elapses', () => {
    renderHook(() =>
      useFirestoreLive('tenants/t1/items', { idleDetachMs: 5_000 }),
    );

    expect(unsubSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5_500);
    });

    expect(unsubSpy).toHaveBeenCalledTimes(1);
  });

  it('re-attaches on a visibilitychange when previously detached', () => {
    renderHook(() =>
      useFirestoreLive('tenants/t1/items', { idleDetachMs: 1_000 }),
    );

    // Idle out
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(unsubSpy).toHaveBeenCalledTimes(1);
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    // Simulate the tab returning to focus.
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
  });

  it('tracks the global listener count', () => {
    const { unmount } = renderHook(() =>
      useFirestoreLive('tenants/t1/items'),
    );
    expect(activeListeners.get('tenants/t1/items')).toBe(1);

    unmount();
    expect(activeListeners.get('tenants/t1/items')).toBeUndefined();
  });

  it('warns when the global listener count exceeds the threshold', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const hooks: Array<{ unmount: () => void }> = [];
    for (let i = 0; i <= LISTENER_WARNING_THRESHOLD; i++) {
      hooks.push(
        renderHook(() => useFirestoreLive(`tenants/t1/c${i}`)),
      );
    }

    // The very last mount should have crossed the threshold.
    expect(warnSpy).toHaveBeenCalled();

    for (const h of hooks) h.unmount();
    warnSpy.mockRestore();
  });

  it('reports errors via the result object', () => {
    const { result } = renderHook(() =>
      useFirestoreLive('tenants/t1/items'),
    );
    act(() => {
      const { err } = lastSnapshotHandlers();
      err(new Error('permission-denied'));
    });
    expect(result.current.error?.message).toBe('permission-denied');
    expect(result.current.isLoading).toBe(false);
  });

  it('does not subscribe when enabled is false', () => {
    renderHook(() =>
      useFirestoreLive('tenants/t1/items', { enabled: false }),
    );
    expect(onSnapshotMock).not.toHaveBeenCalled();
  });
});
