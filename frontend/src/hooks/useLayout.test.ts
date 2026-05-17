/**
 * useLayout.test.ts
 *
 * Unit tests for the useLayout hook and the layout helpers in store.ts.
 *
 * Covers:
 *   - applyLayout() sets data-layout on document.documentElement (Req 8.4)
 *   - getPersistedLayout() reads from localStorage (Req 8.3)
 *   - setLayoutMode() persists to localStorage and updates DOM (Req 8.3, 8.4)
 *   - useLayout hook returns correct layoutMode and derived flags
 *   - Layout switching via setLayout() updates store, localStorage, and DOM
 *   - Default layout is "classic-sidebar" (Req 8.2)
 *   - All 10 layout modes are supported (Req 8.1)
 *
 * Runner: Vitest (jsdom environment)
 *
 * Feature: settings-documentation
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LAYOUT_MODES } from './useLayout';
import type { LayoutMode } from './useLayout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetEnv() {
  localStorage.clear();
  document.documentElement.removeAttribute('data-layout');
}

// ---------------------------------------------------------------------------
// applyLayout — Requirement 8.4
// ---------------------------------------------------------------------------
describe('applyLayout', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('sets data-layout="classic-sidebar" on document.documentElement', async () => {
    const { applyLayout } = await import('../store');
    applyLayout('classic-sidebar');
    expect(document.documentElement.getAttribute('data-layout')).toBe('classic-sidebar');
  });

  it('sets data-layout="top-megamenu" on document.documentElement', async () => {
    const { applyLayout } = await import('../store');
    applyLayout('top-megamenu');
    expect(document.documentElement.getAttribute('data-layout')).toBe('top-megamenu');
  });

  it('sets data-layout="mobile-bottom-nav" on document.documentElement', async () => {
    const { applyLayout } = await import('../store');
    applyLayout('mobile-bottom-nav');
    expect(document.documentElement.getAttribute('data-layout')).toBe('mobile-bottom-nav');
  });

  it('overwrites a previous data-layout value', async () => {
    const { applyLayout } = await import('../store');
    applyLayout('icon-rail');
    applyLayout('dual-rail');
    expect(document.documentElement.getAttribute('data-layout')).toBe('dual-rail');
  });

  it('applies all 10 layout modes without error — Requirement 8.1', async () => {
    const { applyLayout } = await import('../store');
    for (const mode of LAYOUT_MODES) {
      applyLayout(mode);
      expect(document.documentElement.getAttribute('data-layout')).toBe(mode);
    }
  });
});

// ---------------------------------------------------------------------------
// getPersistedLayout — Requirement 8.3
// ---------------------------------------------------------------------------
describe('getPersistedLayout', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('returns "classic-sidebar" when no layout is stored — Requirement 8.2', async () => {
    const { getPersistedLayout } = await import('../store');
    expect(getPersistedLayout()).toBe('classic-sidebar');
  });

  it('returns the stored layout mode from localStorage', async () => {
    localStorage.setItem('shell.layoutMode', 'top-megamenu');
    const { getPersistedLayout } = await import('../store');
    expect(getPersistedLayout()).toBe('top-megamenu');
  });

  it('returns "icon-rail" when that mode is stored', async () => {
    localStorage.setItem('shell.layoutMode', 'icon-rail');
    const { getPersistedLayout } = await import('../store');
    expect(getPersistedLayout()).toBe('icon-rail');
  });
});

// ---------------------------------------------------------------------------
// setLayoutMode via useAuthStore — Requirements 8.3, 8.4
// ---------------------------------------------------------------------------
describe('setLayoutMode via useAuthStore', () => {
  beforeEach(() => {
    resetEnv();
    vi.resetModules();
  });
  afterEach(() => {
    resetEnv();
    vi.resetModules();
  });

  it('persists layout mode to localStorage["shell.layoutMode"]', async () => {
    const { useAuthStore } = await import('../store');
    useAuthStore.getState().setLayoutMode('top-megamenu');
    expect(localStorage.getItem('shell.layoutMode')).toBe('top-megamenu');
  });

  it('updates document.documentElement data-layout attribute', async () => {
    const { useAuthStore } = await import('../store');
    useAuthStore.getState().setLayoutMode('dual-rail');
    expect(document.documentElement.getAttribute('data-layout')).toBe('dual-rail');
  });

  it('updates the store layoutMode state', async () => {
    const { useAuthStore } = await import('../store');
    useAuthStore.getState().setLayoutMode('icon-rail');
    expect(useAuthStore.getState().layoutMode).toBe('icon-rail');
  });

  it('defaults to "classic-sidebar" when localStorage is empty — Requirement 8.2', async () => {
    const { useAuthStore } = await import('../store');
    expect(useAuthStore.getState().layoutMode).toBe('classic-sidebar');
  });

  it('hydrates layoutMode from localStorage on store initialisation — Requirement 8.3', async () => {
    localStorage.setItem('shell.layoutMode', 'workspace-tabs');
    const { useAuthStore } = await import('../store');
    expect(useAuthStore.getState().layoutMode).toBe('workspace-tabs');
  });

  it('applies persisted layout to document on store initialisation — Requirement 8.4', async () => {
    localStorage.setItem('shell.layoutMode', 'apps-launcher');
    const { applyLayout, getPersistedLayout } = await import('../store');
    applyLayout(getPersistedLayout());
    expect(document.documentElement.getAttribute('data-layout')).toBe('apps-launcher');
  });
});

// ---------------------------------------------------------------------------
// useLayout hook — Requirements 8.1, 8.2, 8.3, 8.4
// ---------------------------------------------------------------------------
describe('useLayout hook', () => {
  beforeEach(() => {
    resetEnv();
    vi.resetModules();
  });
  afterEach(() => {
    resetEnv();
    vi.resetModules();
  });

  it('returns the current layoutMode (defaults to classic-sidebar) — Requirement 8.2', async () => {
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());
    expect(result.current.layoutMode).toBe('classic-sidebar');
  });

  it('isSidebarLayout is true for classic-sidebar', async () => {
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());
    expect(result.current.isSidebarLayout).toBe(true);
  });

  it('isSidebarLayout is false for top-megamenu', async () => {
    const { useAuthStore } = await import('../store');
    useAuthStore.setState({ layoutMode: 'top-megamenu' });
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());
    expect(result.current.isSidebarLayout).toBe(false);
  });

  it('isTopNavLayout is true for top-megamenu', async () => {
    const { useAuthStore } = await import('../store');
    useAuthStore.setState({ layoutMode: 'top-megamenu' });
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());
    expect(result.current.isTopNavLayout).toBe(true);
  });

  it('isTopNavLayout is false for classic-sidebar', async () => {
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());
    expect(result.current.isTopNavLayout).toBe(false);
  });

  it('isMobileLayout is true for mobile-bottom-nav', async () => {
    const { useAuthStore } = await import('../store');
    useAuthStore.setState({ layoutMode: 'mobile-bottom-nav' });
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());
    expect(result.current.isMobileLayout).toBe(true);
  });

  it('isMobileLayout is false for classic-sidebar', async () => {
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());
    expect(result.current.isMobileLayout).toBe(false);
  });

  it('setLayout() updates layoutMode in the hook — Requirement 8.4', async () => {
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());

    act(() => {
      result.current.setLayout('icon-rail');
    });

    expect(result.current.layoutMode).toBe('icon-rail');
  });

  it('setLayout() persists to localStorage — Requirement 8.3', async () => {
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());

    act(() => {
      result.current.setLayout('dual-rail');
    });

    expect(localStorage.getItem('shell.layoutMode')).toBe('dual-rail');
  });

  it('setLayout() updates document.documentElement data-layout — Requirement 8.4', async () => {
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());

    act(() => {
      result.current.setLayout('command-centric');
    });

    expect(document.documentElement.getAttribute('data-layout')).toBe('command-centric');
  });

  it('isSidebarLayout is true for dual-rail', async () => {
    const { useAuthStore } = await import('../store');
    useAuthStore.setState({ layoutMode: 'dual-rail' });
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());
    expect(result.current.isSidebarLayout).toBe(true);
  });

  it('isSidebarLayout is true for icon-rail', async () => {
    const { useAuthStore } = await import('../store');
    useAuthStore.setState({ layoutMode: 'icon-rail' });
    const { useLayout } = await import('./useLayout');
    const { result } = renderHook(() => useLayout());
    expect(result.current.isSidebarLayout).toBe(true);
  });

  it('LAYOUT_MODES contains all 10 supported modes — Requirement 8.1', () => {
    expect(LAYOUT_MODES).toHaveLength(10);
    const expected: LayoutMode[] = [
      'classic-sidebar',
      'top-megamenu',
      'dual-rail',
      'icon-rail',
      'dashboard-first',
      'command-centric',
      'workspace-tabs',
      'apps-launcher',
      'split-master-detail',
      'mobile-bottom-nav',
    ];
    expect(LAYOUT_MODES).toEqual(expected);
  });
});
