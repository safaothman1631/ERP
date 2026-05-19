/**
 * useViewport.test.ts — boundary tests for the system-wide viewport hook.
 *
 * Spec: system-wide-ux-overhaul, Task 1.2
 * Validates: Requirements 2.4, 2.6, 4.1, 4.5
 *
 * R2.6 boundary semantics — Mobile_Viewport is evaluated as a strict
 * `width <= 640 px` threshold:
 *   - mobile  : width <= 640
 *   - tablet  : 640 <  width <= 1024
 *   - desktop : 1024 < width <= 1280
 *   - wide    : 1280 < width
 *
 * `isDesktop` covers BOTH `desktop` and `wide` so call-sites do not need to
 * special-case ultra-wide monitors.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import {
  useViewport,
  classifyViewport,
  VIEWPORT_BREAKPOINTS,
  type ViewportState,
} from './useViewport';

// ---------------------------------------------------------------------------
// Test helpers — install a `matchMedia` mock and pin `window.innerWidth`.
// ---------------------------------------------------------------------------

/** Pin `window.innerWidth` before mounting the hook so initial classification
 *  is deterministic. jsdom's default is 1024, so widths must be set explicitly. */
function setInnerWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
}

/** Install a minimal `matchMedia` mock that satisfies the hook's listener
 *  attachment without driving any cross-state transitions. */
function installMatchMediaMock(): void {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// classifyViewport — pure-function boundary table
// ---------------------------------------------------------------------------

describe('classifyViewport — boundary classification', () => {
  /**
   * Validates: Requirements 2.4, 2.6
   *
   * The seven widths span every named breakpoint plus the strict-boundary
   * cases on either side of `sm` and `xl`.
   */
  it.each([
    { width: 320, expected: 'mobile' as const, note: 'smallest supported viewport' },
    { width: 640, expected: 'mobile' as const, note: 'sm boundary — Mobile_Viewport upper bound (R2.6)' },
    { width: 641, expected: 'tablet' as const, note: 'one px past sm — must flip to tablet (R2.6)' },
    { width: 768, expected: 'tablet' as const, note: 'md breakpoint' },
    { width: 1024, expected: 'tablet' as const, note: 'lg boundary — Tablet_Viewport upper bound' },
    { width: 1280, expected: 'desktop' as const, note: 'xl boundary — Desktop_Viewport upper bound' },
    { width: 1281, expected: 'wide' as const, note: 'one px past xl — must flip to wide' },
  ])('width $width px → $expected ($note)', ({ width, expected }) => {
    expect(classifyViewport(width)).toBe(expected);
  });

  it('exposes the four named Tailwind breakpoints (sanity check)', () => {
    // Validates: Requirements 2.4 — exactly four named breakpoints.
    expect(VIEWPORT_BREAKPOINTS).toEqual({
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    });
  });
});

// ---------------------------------------------------------------------------
// useViewport hook — initial classification with mocked matchMedia
// ---------------------------------------------------------------------------

describe('useViewport — initial classification with mocked matchMedia', () => {
  beforeEach(() => {
    installMatchMediaMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Validates: Requirements 2.4, 2.6, 4.1, 4.5
   *
   * Mounts the hook at each boundary width and asserts the full
   * `ViewportState` shape — viewport label plus the three derived flags.
   * `isDesktop` is verified to cover both `desktop` and `wide` (1280 and 1281).
   */
  it.each<{
    width: number;
    viewport: ViewportState['viewport'];
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
  }>([
    { width: 320,  viewport: 'mobile',  isMobile: true,  isTablet: false, isDesktop: false },
    { width: 640,  viewport: 'mobile',  isMobile: true,  isTablet: false, isDesktop: false },
    { width: 641,  viewport: 'tablet',  isMobile: false, isTablet: true,  isDesktop: false },
    { width: 768,  viewport: 'tablet',  isMobile: false, isTablet: true,  isDesktop: false },
    { width: 1024, viewport: 'tablet',  isMobile: false, isTablet: true,  isDesktop: false },
    { width: 1280, viewport: 'desktop', isMobile: false, isTablet: false, isDesktop: true  },
    { width: 1281, viewport: 'wide',    isMobile: false, isTablet: false, isDesktop: true  },
  ])(
    'at $width px returns viewport=$viewport, isMobile=$isMobile, isTablet=$isTablet, isDesktop=$isDesktop',
    ({ width, viewport, isMobile, isTablet, isDesktop }) => {
      setInnerWidth(width);
      const { result } = renderHook(() => useViewport());
      expect(result.current.viewport).toBe(viewport);
      expect(result.current.isMobile).toBe(isMobile);
      expect(result.current.isTablet).toBe(isTablet);
      expect(result.current.isDesktop).toBe(isDesktop);
    },
  );

  it('subscribes to all four named breakpoints via window.matchMedia', () => {
    // Validates: Requirements 2.4 — single source of truth for breakpoints.
    setInnerWidth(1024);
    renderHook(() => useViewport());
    const matchMediaMock = window.matchMedia as unknown as ReturnType<typeof vi.fn>;
    const queries = matchMediaMock.mock.calls.map(([q]) => q as string);
    expect(queries).toEqual(
      expect.arrayContaining([
        `(min-width: ${VIEWPORT_BREAKPOINTS.sm}px)`,
        `(min-width: ${VIEWPORT_BREAKPOINTS.md}px)`,
        `(min-width: ${VIEWPORT_BREAKPOINTS.lg}px)`,
        `(min-width: ${VIEWPORT_BREAKPOINTS.xl}px)`,
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// useViewport hook — SSR-safe default (no `window`)
// ---------------------------------------------------------------------------

describe('useViewport — SSR-safe default', () => {
  /**
   * Validates: Requirements 2.4, 4.1
   *
   * The hook MUST return `desktop` defaults when `window` is unavailable so
   * server renders never crash and never collapse to a mobile layout.
   *
   * We simulate SSR inside the jsdom environment by:
   *   1. Removing the `window` global so `typeof window === 'undefined'`
   *      evaluates to `true` inside `readViewport`.
   *   2. Rendering the hook through `react-dom/server`'s `renderToString`,
   *      which exercises `useState`'s initializer (i.e., the SSR-safe
   *      branch in `readViewport`) without scheduling `useEffect`.
   *   3. Restoring the `window` global afterwards so subsequent tests are
   *      not affected.
   */
  it('returns viewport=desktop when window is undefined', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

    // Step 1 — make `typeof window === 'undefined'` evaluate true.
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    let captured: ViewportState | null = null;
    const Probe = (): null => {
      captured = useViewport();
      return null;
    };

    try {
      // Step 2 — exercise the SSR initializer path.
      renderToString(React.createElement(Probe));
    } finally {
      // Step 3 — always restore `window` so later tests still see jsdom.
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'window', originalDescriptor);
      } else {
        delete (globalThis as { window?: unknown }).window;
      }
    }

    expect(captured).not.toBeNull();
    expect(captured!.viewport).toBe('desktop');
    expect(captured!.isDesktop).toBe(true);
    expect(captured!.isMobile).toBe(false);
    expect(captured!.isTablet).toBe(false);
  });
});
