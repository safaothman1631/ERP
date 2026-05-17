/**
 * Unit tests for the useLanguage hook.
 *
 * Validates:
 *   - Returns current language and isRTL flag
 *   - changeLanguage() delegates to i18n and updates state
 *   - isRTL is true for Kurdish and Arabic, false for English
 *
 * Requirements: 4.3, 4.4, 4.5
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('useLanguage hook', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.dir = '';
    document.documentElement.lang = '';
  });

  it('returns the current language (defaults to ku)', async () => {
    const { useLanguage } = await import('./useLanguage');
    const { result } = renderHook(() => useLanguage());
    expect(result.current.language).toBe('ku');
  });

  it('isRTL is true for Kurdish (ku) — Requirement 4.5', async () => {
    const { useLanguage } = await import('./useLanguage');
    const { result } = renderHook(() => useLanguage());
    expect(result.current.isRTL).toBe(true);
  });

  it('isRTL becomes false after switching to English — Requirement 4.5', async () => {
    const { useLanguage } = await import('./useLanguage');
    const { result } = renderHook(() => useLanguage());

    await act(async () => {
      await result.current.changeLanguage('en');
    });

    expect(result.current.language).toBe('en');
    expect(result.current.isRTL).toBe(false);
  });

  it('isRTL is true for Arabic (ar) — Requirement 4.5', async () => {
    const { useLanguage } = await import('./useLanguage');
    const { result } = renderHook(() => useLanguage());

    await act(async () => {
      await result.current.changeLanguage('ar');
    });

    expect(result.current.language).toBe('ar');
    expect(result.current.isRTL).toBe(true);
  });

  it('changeLanguage updates document.documentElement.dir — Requirement 4.5', async () => {
    const { useLanguage } = await import('./useLanguage');
    const { result } = renderHook(() => useLanguage());

    await act(async () => {
      await result.current.changeLanguage('en');
    });

    expect(document.documentElement.dir).toBe('ltr');

    await act(async () => {
      await result.current.changeLanguage('ar');
    });

    expect(document.documentElement.dir).toBe('rtl');
  });

  it('changeLanguage persists to localStorage — Requirement 4.3', async () => {
    const mockSetItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: mockSetItem,
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();

    const { useLanguage } = await import('./useLanguage');
    const { result } = renderHook(() => useLanguage());

    await act(async () => {
      await result.current.changeLanguage('en');
    });

    expect(mockSetItem).toHaveBeenCalledWith('app_language', 'en');
  });
});
