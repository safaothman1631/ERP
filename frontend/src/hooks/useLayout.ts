/**
 * useLayout — React hook for layout mode persistence and switching.
 *
 * Wraps the Zustand `useAuthStore` so components get a reactive `layoutMode`
 * value and a `setLayout` function without importing the store directly.
 *
 * On every call to `setLayout`:
 *   - The Zustand store is updated
 *   - localStorage["shell.layoutMode"] is updated
 *   - document.documentElement[data-layout] is set to the new mode
 *
 * The layout is applied immediately on store initialisation so the document
 * attribute reflects the saved preference before any component mounts.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
import { useCallback } from 'react';
import { useAuthStore } from '../store';
import type { LayoutMode } from '../store';

export type { LayoutMode };

/** All supported layout modes (Requirement 8.1). */
export const LAYOUT_MODES: LayoutMode[] = [
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

export interface UseLayoutReturn {
  /** The currently active layout mode. */
  layoutMode: LayoutMode;
  /**
   * Switch to a new layout mode.
   * Persists to localStorage and updates the document.documentElement
   * `data-layout` attribute.
   *
   * @param mode - The layout mode to activate.
   */
  setLayout: (mode: LayoutMode) => void;
  /** Whether the current layout uses a sidebar (classic-sidebar, dual-rail, icon-rail). */
  isSidebarLayout: boolean;
  /** Whether the current layout uses a top navigation bar (top-megamenu). */
  isTopNavLayout: boolean;
  /** Whether the current layout is optimised for mobile (mobile-bottom-nav). */
  isMobileLayout: boolean;
}

const SIDEBAR_LAYOUTS: LayoutMode[] = ['classic-sidebar', 'dual-rail', 'icon-rail'];
const TOP_NAV_LAYOUTS: LayoutMode[] = ['top-megamenu'];
const MOBILE_LAYOUTS: LayoutMode[] = ['mobile-bottom-nav'];

/**
 * React hook that exposes the current layout mode and a setter.
 *
 * @example
 * ```tsx
 * const { layoutMode, setLayout, isSidebarLayout } = useLayout();
 * ```
 */
export function useLayout(): UseLayoutReturn {
  const layoutMode = useAuthStore((state) => state.layoutMode);
  const setLayoutMode = useAuthStore((state) => state.setLayoutMode);

  const setLayout = useCallback(
    (mode: LayoutMode) => {
      setLayoutMode(mode);
    },
    [setLayoutMode],
  );

  return {
    layoutMode,
    setLayout,
    isSidebarLayout: SIDEBAR_LAYOUTS.includes(layoutMode),
    isTopNavLayout: TOP_NAV_LAYOUTS.includes(layoutMode),
    isMobileLayout: MOBILE_LAYOUTS.includes(layoutMode),
  };
}
