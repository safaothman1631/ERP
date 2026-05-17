/**
 * Unit tests for useFeatureFlag and useFeatureFlags hooks.
 *
 * Validates:
 *   - useFeatureFlag returns isEnabled from is_active field
 *   - useFeatureFlag defaults to isEnabled: false while loading
 *   - useFeatureFlag sets error and isEnabled: false on API failure
 *   - useFeatureFlag handles empty flagKey gracefully
 *   - useFeatureFlags returns all flags for the org
 *   - useFeatureFlags sets error and empty array on API failure
 *
 * Requirements: 7.4, 7.5, 7.6
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ── Shared mock flag data ─────────────────────────────────────────────────────

const mockFlag = {
  key: 'new-dashboard',
  enabled: true,
  rollout_pct: 100,
  description: 'New dashboard feature',
  org_id: 'org-1',
  is_active: true,
};

const mockFlagDisabled = {
  key: 'beta-feature',
  enabled: true,
  rollout_pct: 10,
  description: 'Beta feature at 10% rollout',
  org_id: 'org-1',
  is_active: false, // user not in the 10%
};

// ── useFeatureFlag ────────────────────────────────────────────────────────────

describe('useFeatureFlag', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with isLoading: true and isEnabled: false', async () => {
    vi.doMock('../api/featureFlags', () => ({
      fetchFeatureFlag: () => new Promise(() => {}), // never resolves
    }));

    const { useFeatureFlag } = await import('./useFeatureFlag');
    const { result } = renderHook(() => useFeatureFlag('new-dashboard'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets isEnabled: true when is_active is true — Requirement 7.4', async () => {
    vi.doMock('../api/featureFlags', () => ({
      fetchFeatureFlag: vi.fn().mockResolvedValue(mockFlag),
    }));

    const { useFeatureFlag } = await import('./useFeatureFlag');
    const { result } = renderHook(() => useFeatureFlag('new-dashboard'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('sets isEnabled: false when is_active is false (gradual rollout) — Requirement 7.6', async () => {
    vi.doMock('../api/featureFlags', () => ({
      fetchFeatureFlag: vi.fn().mockResolvedValue(mockFlagDisabled),
    }));

    const { useFeatureFlag } = await import('./useFeatureFlag');
    const { result } = renderHook(() => useFeatureFlag('beta-feature'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error and isEnabled: false on API failure — Requirement 7.5', async () => {
    const apiError = new Error('Network error');
    vi.doMock('../api/featureFlags', () => ({
      fetchFeatureFlag: vi.fn().mockRejectedValue(apiError),
    }));

    const { useFeatureFlag } = await import('./useFeatureFlag');
    const { result } = renderHook(() => useFeatureFlag('new-dashboard'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network error');
  });

  it('handles empty flagKey without calling API', async () => {
    const fetchSpy = vi.fn();
    vi.doMock('../api/featureFlags', () => ({
      fetchFeatureFlag: fetchSpy,
    }));

    const { useFeatureFlag } = await import('./useFeatureFlag');
    const { result } = renderHook(() => useFeatureFlag(''));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('wraps non-Error rejections in an Error object', async () => {
    vi.doMock('../api/featureFlags', () => ({
      fetchFeatureFlag: vi.fn().mockRejectedValue('string error'),
    }));

    const { useFeatureFlag } = await import('./useFeatureFlag');
    const { result } = renderHook(() => useFeatureFlag('some-flag'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string error');
  });
});

// ── useFeatureFlags ───────────────────────────────────────────────────────────

describe('useFeatureFlags', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with isLoading: true and empty flags array', async () => {
    vi.doMock('../api/featureFlags', () => ({
      fetchFeatureFlags: () => new Promise(() => {}), // never resolves
    }));

    const { useFeatureFlags } = await import('./useFeatureFlags');
    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.flags).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns all flags for the org — Requirement 7.4', async () => {
    const allFlags = [mockFlag, mockFlagDisabled];
    vi.doMock('../api/featureFlags', () => ({
      fetchFeatureFlags: vi.fn().mockResolvedValue(allFlags),
    }));

    const { useFeatureFlags } = await import('./useFeatureFlags');
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.flags).toHaveLength(2);
    expect(result.current.flags[0].key).toBe('new-dashboard');
    expect(result.current.flags[1].key).toBe('beta-feature');
    expect(result.current.error).toBeNull();
  });

  it('is_active reflects gradual rollout for each flag — Requirement 7.6', async () => {
    const allFlags = [mockFlag, mockFlagDisabled];
    vi.doMock('../api/featureFlags', () => ({
      fetchFeatureFlags: vi.fn().mockResolvedValue(allFlags),
    }));

    const { useFeatureFlags } = await import('./useFeatureFlags');
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const active = result.current.flags.find((f) => f.key === 'new-dashboard');
    const inactive = result.current.flags.find((f) => f.key === 'beta-feature');

    expect(active?.is_active).toBe(true);
    expect(inactive?.is_active).toBe(false);
  });

  it('sets error and empty flags on API failure', async () => {
    const apiError = new Error('Unauthorized');
    vi.doMock('../api/featureFlags', () => ({
      fetchFeatureFlags: vi.fn().mockRejectedValue(apiError),
    }));

    const { useFeatureFlags } = await import('./useFeatureFlags');
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.flags).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Unauthorized');
  });

  it('returns empty array when org has no flags', async () => {
    vi.doMock('../api/featureFlags', () => ({
      fetchFeatureFlags: vi.fn().mockResolvedValue([]),
    }));

    const { useFeatureFlags } = await import('./useFeatureFlags');
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.flags).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
