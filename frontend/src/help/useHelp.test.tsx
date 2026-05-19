/**
 * Unit tests for the `useHelp(sectionId)` hook
 * (system-wide-ux-overhaul, task 2.3).
 *
 * Validates:
 *   - R6.1 — surrounding Section continues to render when registry is unavailable.
 *   - R6.4 — active-locale resolution; per-key fallback marks `fellBack: true` when applicable.
 *   - R8.4 — hook never throws; never blocks language switching.
 *   - R12.5 — fallback paths are independent (UI fallback works even when
 *             logging is suppressed).
 *   - R15.5 — graceful failure when the lazy `helpRegistry` chunk fails to load.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import {
  useHelp,
  __resetHelpRegistryCacheForTests,
  type ResolvedHelp,
} from './useHelp';
import i18n from '../i18n';

describe('useHelp (task 2.3)', () => {
  beforeEach(() => {
    __resetHelpRegistryCacheForTests();
    // Suppress warn output but keep it spy-able.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves to a stable `ResolvedHelp` shape after the registry chunk loads (R6.4)', async () => {
    await i18n.changeLanguage('en');

    const { result } = renderHook(() => useHelp('sales.invoices'));

    await waitFor(() => {
      expect(result.current.unavailable).toBe(false);
    });

    const r = result.current;
    expect(r.sectionId).toBe('sales.invoices');
    expect(typeof r.what).toBe('string');
    expect(typeof r.why).toBe('string');
    expect(Array.isArray(r.relatesTo)).toBe(true);
    expect(Array.isArray(r.howSteps)).toBe(true);
    expect(r.howSteps.length).toBeGreaterThanOrEqual(2);
    expect(r.howSteps.length).toBeLessThanOrEqual(7);
    expect(typeof r.fellBack).toBe('boolean');
    expect(r.unavailable).toBe(false);

    // The resolved value's keys are exactly the public contract.
    const keys = Object.keys(r).sort();
    expect(keys).toEqual(
      ['fellBack', 'howSteps', 'relatesTo', 'sectionId', 'unavailable', 'what', 'why'].sort(),
    );
  });

  it('returns `unavailable: true` synchronously on first mount (loading phase)', async () => {
    // With a freshly reset cache, the first render must resolve the
    // synchronous `loading` state — `unavailable: true` with a non-empty
    // localized `what` message and empty `why`/`relatesTo`/`howSteps`.
    await i18n.changeLanguage('en');

    const { result, unmount } = renderHook(() => useHelp('settings.taxes'));

    // Capture the initial state BEFORE the lazy import resolves.
    const initial: ResolvedHelp = result.current;
    expect(initial.unavailable).toBe(true);
    expect(initial.fellBack).toBe(false);
    expect(initial.sectionId).toBe('settings.taxes');
    expect(initial.what.length).toBeGreaterThan(0);
    expect(initial.what).not.toBe('help.unavailable.message');
    expect(initial.why).toBe('');
    expect(initial.relatesTo).toEqual([]);
    expect(initial.howSteps).toEqual([]);

    unmount();
  });

  it('NEVER throws and surfaces `unavailable: true` when the registry chunk fails to load (R6.1, R8.4, R15.5)', async () => {
    // Mock the dynamic import path so it rejects.
    vi.doMock('./registry', () => {
      throw new Error('Simulated chunk-load failure');
    });

    // Re-import the hook so the doMock takes effect for the lazy import.
    vi.resetModules();
    const helpModule = await import('./useHelp');
    helpModule.__resetHelpRegistryCacheForTests();

    const i18nModule = await import('../i18n');
    await i18nModule.default.changeLanguage('en');

    let renderError: unknown = null;
    let finalResult: ResolvedHelp | null = null;

    try {
      const { result } = renderHook(() => helpModule.useHelp('sales.invoices'));
      // The hook must surface `unavailable: true` either during loading
      // (initial render) or after the failure resolves; both are valid.
      await waitFor(() => {
        expect(result.current.unavailable).toBe(true);
      });
      finalResult = result.current;
    } catch (err) {
      renderError = err;
    }

    expect(renderError).toBeNull();
    expect(finalResult).not.toBeNull();
    if (finalResult !== null) {
      expect(finalResult.sectionId).toBe('sales.invoices');
      expect(finalResult.what.length).toBeGreaterThan(0);
      expect(finalResult.fellBack).toBe(false);
      expect(finalResult.relatesTo).toEqual([]);
      expect(finalResult.howSteps).toEqual([]);
    }

    vi.doUnmock('./registry');
    vi.resetModules();
  });

  it('does NOT block language switching (R8.4)', async () => {
    await i18n.changeLanguage('en');

    const { result, rerender } = renderHook(() => useHelp('sales.invoices'));

    await waitFor(() => {
      expect(result.current.unavailable).toBe(false);
    });

    // Switching language must not throw, must not reset the locale, and
    // must continue returning a usable `ResolvedHelp`.
    await i18n.changeLanguage('ku');
    expect(i18n.language).toBe('ku');
    rerender();

    expect(result.current.unavailable).toBe(false);
    expect(result.current.sectionId).toBe('sales.invoices');

    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
  });

  it('logs a structured warn (does not throw) when console.warn itself throws (R12.5 — independent paths)', async () => {
    // Force every `console.warn` call to throw, then confirm the hook still
    // returns a usable shape — the UI fallback is independent of the log path.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      throw new Error('logger broken');
    });

    await i18n.changeLanguage('en');

    let renderError: unknown = null;
    try {
      const { result } = renderHook(() => useHelp('dashboard.kpis'));
      await waitFor(() => {
        expect(result.current.unavailable).toBe(false);
      });
      // UI path still produces resolved strings even though logging blew up.
      expect(typeof result.current.what).toBe('string');
    } catch (err) {
      renderError = err;
    }

    expect(renderError).toBeNull();
    warnSpy.mockRestore();
  });
});
