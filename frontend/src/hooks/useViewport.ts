/**
 * useViewport — single source of truth for viewport-width decisions.
 *
 * Owned by the `system-wide-ux-overhaul` umbrella spec. Every "is this Mobile_Viewport?"
 * decision in the product MUST go through this hook. No other hook, component, or utility
 * is allowed to branch on viewport size by reading `window.innerWidth` directly or by
 * sniffing the user agent.
 *
 * The hook is wired to the four named Tailwind breakpoints (`sm`, `md`, `lg`, `xl`) via
 * `window.matchMedia` listeners. On every breakpoint transition the viewport is
 * reclassified from the live `window.innerWidth`, so the hook reacts to viewport changes
 * (window resize, device rotation, devtools toggling) without polling.
 *
 * Boundary semantics (from `system-wide-ux-overhaul` requirement 2.6 — Mobile_Viewport is
 * evaluated as a strict `width <= 640 px` threshold):
 *   - mobile  : width <= 640
 *   - tablet  : 640 <  width <= 1024
 *   - desktop : 1024 < width <= 1280
 *   - wide    : 1280 < width
 *
 * `isDesktop` returns `true` for both `desktop` and `wide` so callers do not need to
 * special-case ultra-wide monitors when they only care about "is this above the lg
 * breakpoint?".
 *
 * SSR-safe: when `window` is unavailable the hook returns `desktop` defaults so server
 * renders never crash and never collapse to a mobile layout.
 *
 * FORBIDDEN inside this hook (umbrella spec hard rule — `no-ua-layout-detection` lint):
 *   - `navigator.userAgent`
 *   - `navigator.userAgentData`
 *   - `matchMedia('(pointer: coarse)')` or any "isTouch" heuristic
 *
 * Validates: Requirements 2.4, 4.1, 4.5, 4.7
 */
import { useEffect, useState } from 'react';

/** Viewport classification — one of four named buckets. */
export type Viewport = 'mobile' | 'tablet' | 'desktop' | 'wide';

/** Tailwind named breakpoints — single source of truth (mirrors `tailwind.config.ts`). */
export const VIEWPORT_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/**
 * Shape returned by `useViewport`.
 *
 * The boolean flags are derived from `viewport` and intentionally redundant — call sites
 * read whichever form is most readable in context.
 */
export interface ViewportState {
  /** Current viewport bucket. */
  viewport: Viewport;
  /** True when `viewport === 'mobile'` (width <= 640 px). */
  isMobile: boolean;
  /** True when `viewport === 'tablet'` (640 < width <= 1024 px). */
  isTablet: boolean;
  /** True when `viewport === 'desktop' || viewport === 'wide'` (width > 1024 px). */
  isDesktop: boolean;
}

/**
 * Classify a viewport bucket from a numeric inline-size in CSS pixels.
 *
 * Exported for unit tests; production code SHOULD use {@link useViewport} so the
 * classification stays reactive.
 */
export function classifyViewport(width: number): Viewport {
  if (width <= VIEWPORT_BREAKPOINTS.sm) return 'mobile';
  if (width <= VIEWPORT_BREAKPOINTS.lg) return 'tablet';
  if (width <= VIEWPORT_BREAKPOINTS.xl) return 'desktop';
  return 'wide';
}

/** SSR-safe default — assume desktop when `window` is unavailable. */
const SSR_DEFAULT: Viewport = 'desktop';

/** Resolve the current viewport from `window.innerWidth`, falling back on SSR. */
function readViewport(): Viewport {
  if (typeof window === 'undefined') return SSR_DEFAULT;
  return classifyViewport(window.innerWidth);
}

/** Build the `ViewportState` shape from a `Viewport` value. */
function toState(viewport: Viewport): ViewportState {
  return {
    viewport,
    isMobile: viewport === 'mobile',
    isTablet: viewport === 'tablet',
    isDesktop: viewport === 'desktop' || viewport === 'wide',
  };
}

/**
 * Single source of truth for viewport-width-driven UI decisions.
 *
 * @example
 * ```tsx
 * const { isMobile } = useViewport();
 * return isMobile ? <BottomSheet /> : <CenteredModal />;
 * ```
 */
export function useViewport(): ViewportState {
  const [viewport, setViewport] = useState<Viewport>(readViewport);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      // Non-browser environment (SSR / unsupported test harness) — keep the default and
      // do not attempt to attach listeners.
      return;
    }

    // Listen on each named Tailwind breakpoint. Any boundary transition triggers a
    // reclassification from the live `window.innerWidth`, so the four listeners are
    // sufficient to cover every transition between buckets.
    const queries = [
      `(min-width: ${VIEWPORT_BREAKPOINTS.sm}px)`,
      `(min-width: ${VIEWPORT_BREAKPOINTS.md}px)`,
      `(min-width: ${VIEWPORT_BREAKPOINTS.lg}px)`,
      `(min-width: ${VIEWPORT_BREAKPOINTS.xl}px)`,
    ] as const;

    const mqls = queries.map((q) => window.matchMedia(q));

    const handleChange = (): void => {
      setViewport(classifyViewport(window.innerWidth));
    };

    // Sync once on mount in case the initial state was computed before listeners attached
    // (e.g., the viewport was resized between render and effect).
    handleChange();

    for (const mql of mqls) {
      mql.addEventListener('change', handleChange);
    }

    return () => {
      for (const mql of mqls) {
        mql.removeEventListener('change', handleChange);
      }
    };
  }, []);

  return toState(viewport);
}
