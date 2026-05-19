/**
 * useLoadingState — unit tests
 *
 * Verifies the 300ms skeleton delay, immediate hide on data ready,
 * and 5000ms error timeout.
 *
 * Requirements: 9.3, 9.4, 11.3, 11.4, 11.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoadingState } from './useLoadingState';

describe('useLoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show skeleton immediately when loading starts', () => {
    const { result } = renderHook(() => useLoadingState(true));
    expect(result.current.showSkeleton).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('shows skeleton after 300ms when still loading', () => {
    const { result } = renderHook(() => useLoadingState(true));

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current.showSkeleton).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1); // now at 300ms
    });
    expect(result.current.showSkeleton).toBe(true);
  });

  it('does not show skeleton when loading completes before 300ms', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }: { isLoading: boolean }) => useLoadingState(isLoading),
      { initialProps: { isLoading: true } },
    );

    act(() => {
      vi.advanceTimersByTime(200); // 200ms — still within threshold
    });

    // Data arrives before 300ms
    rerender({ isLoading: false });

    act(() => {
      vi.advanceTimersByTime(200); // advance past the original 300ms mark
    });

    expect(result.current.showSkeleton).toBe(false);
  });

  it('hides skeleton immediately when data becomes ready', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }: { isLoading: boolean }) => useLoadingState(isLoading),
      { initialProps: { isLoading: true } },
    );

    // Let skeleton appear
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.showSkeleton).toBe(true);

    // Data arrives
    rerender({ isLoading: false });
    expect(result.current.showSkeleton).toBe(false);
  });

  it('sets isError after 5000ms of continuous loading', () => {
    const { result } = renderHook(() => useLoadingState(true));

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current.isError).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1); // now at 5000ms
    });
    expect(result.current.isError).toBe(true);
  });

  it('clears error state when loading completes', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }: { isLoading: boolean }) => useLoadingState(isLoading),
      { initialProps: { isLoading: true } },
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.isError).toBe(true);

    rerender({ isLoading: false });
    expect(result.current.isError).toBe(false);
  });

  it('resets correctly when loading restarts after completing', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }: { isLoading: boolean }) => useLoadingState(isLoading),
      { initialProps: { isLoading: true } },
    );

    // First load completes
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender({ isLoading: false });
    expect(result.current.showSkeleton).toBe(false);

    // Second load starts
    rerender({ isLoading: true });
    expect(result.current.showSkeleton).toBe(false); // not yet

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.showSkeleton).toBe(true);
  });
});
